import { useEffect, useRef, useCallback } from 'react';
import { useLumiverseActions } from '../store/LumiverseContext';
import { checkExtensionUpdate, subscribeToUpdates } from '../../lib/updateService';
import { checkForPresetUpdates } from '../../lib/presetsService';

// Check intervals
const INITIAL_CHECK_DELAY = 5000; // 5 seconds after mount
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

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

            console.log('[useUpdateChecker] Update check complete:', {
                extensionUpdate: extUpdate?.hasUpdate,
                presetUpdates: presetUpdates?.length || 0,
            });
        } catch (error) {
            console.warn('[useUpdateChecker] Update check failed:', error);
        }
    }, [actions]);

    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

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
            if (state.extensionUpdate) {
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
