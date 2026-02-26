import { useEffect, useRef, useCallback } from 'react';
import { useLumiverseActions } from '../store/LumiverseContext';
import { checkExtensionUpdate, subscribeToUpdates } from '../../lib/updateService';
import { checkForPresetUpdates } from '../../lib/presetsService';

// Check intervals
const INITIAL_CHECK_DELAY = 5000; // 5 seconds after mount
const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Update the accordion badge in the DOM (outside React)
 */
function updateAccordionBadge(hasUpdates, presetCount, hasExtUpdate) {
    // Try to use the global LumiverseUI API if available
    if (typeof window !== 'undefined' && window.LumiverseUI?.updateAccordionBadge) {
        let badgeText = 'New!';
        if (hasExtUpdate && presetCount > 0) {
            badgeText = 'Updates!';
        } else if (presetCount > 1) {
            badgeText = `${presetCount} updates`;
        }
        window.LumiverseUI.updateAccordionBadge(hasUpdates, badgeText);
    }
}

/**
 * Hook to initialize update checking for both extension and presets.
 * Should be called once at the app root level.
 * 
 * Updates are stored in the React store so all components can access them.
 */
export function useUpdateChecker() {

    const actions = useLumiverseActions();
    const checkIntervalRef = useRef(null);
    const hasInitialized = useRef(false);

    const performUpdateCheck = useCallback(async () => {

        // Defensive check - actions must be available
        if (!actions) {
            console.error('[useUpdateChecker] Actions not available - cannot perform update check');
            return;
        }

        // Verify required action methods exist
        if (typeof actions.setExtensionUpdate !== 'function') {
            console.error('[useUpdateChecker] setExtensionUpdate action not available');
            return;
        }
        if (typeof actions.setPresetUpdates !== 'function') {
            console.error('[useUpdateChecker] setPresetUpdates action not available');
            return;
        }

        try {
            // Check extension updates
            const extUpdate = await checkExtensionUpdate();

            if (extUpdate) {
                actions.setExtensionUpdate(extUpdate);
            }

            // Check preset updates
            const presetUpdates = await checkForPresetUpdates();
            actions.setPresetUpdates(presetUpdates);

            // Update the accordion badge (DOM element outside React)
            const hasAny = extUpdate?.hasUpdate || (presetUpdates?.length > 0);
            updateAccordionBadge(hasAny, presetUpdates?.length || 0, extUpdate?.hasUpdate);

        } catch (error) {
            console.error('[useUpdateChecker] Update check failed:', error);
            console.error('[useUpdateChecker] Error stack:', error?.stack);
        }
    }, [actions]);

    useEffect(() => {
        if (hasInitialized.current) {
            return;
        }
        hasInitialized.current = true;

        // Defensive check for actions
        if (!actions) {
            console.error('[useUpdateChecker] Cannot initialize - actions not available');
            return;
        }

        // Initial check after delay
        const initialTimeout = setTimeout(() => {
            performUpdateCheck();
        }, INITIAL_CHECK_DELAY);

        // Periodic checks
        checkIntervalRef.current = setInterval(() => {
            performUpdateCheck();
        }, UPDATE_CHECK_INTERVAL);

        // Subscribe to update service changes (for manual refresh triggers)
        const unsubscribe = subscribeToUpdates((state) => {
            if (state.extensionUpdate && actions?.setExtensionUpdate) {
                actions.setExtensionUpdate(state.extensionUpdate);
            }
        });

        return () => {
            clearTimeout(initialTimeout);
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
            }
            unsubscribe();
        };
    }, [performUpdateCheck, actions]);

    return { refresh: performUpdateCheck };
}

export default useUpdateChecker;
