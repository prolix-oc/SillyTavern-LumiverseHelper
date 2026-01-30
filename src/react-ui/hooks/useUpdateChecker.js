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
    console.log('[useUpdateChecker] Hook function called');

    const actions = useLumiverseActions();
    const checkIntervalRef = useRef(null);
    const hasInitialized = useRef(false);

    console.log('[useUpdateChecker] Got actions:', !!actions);

    const performUpdateCheck = useCallback(async () => {
        console.log('[useUpdateChecker] performUpdateCheck started, actions available:', !!actions);

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
            console.log('[useUpdateChecker] Calling checkExtensionUpdate...');
            const extUpdate = await checkExtensionUpdate();
            console.log('[useUpdateChecker] checkExtensionUpdate result:', extUpdate);

            if (extUpdate) {
                actions.setExtensionUpdate(extUpdate);
            }

            // Check preset updates
            console.log('[useUpdateChecker] Calling checkForPresetUpdates...');
            const presetUpdates = await checkForPresetUpdates();
            console.log('[useUpdateChecker] checkForPresetUpdates result:', presetUpdates);
            actions.setPresetUpdates(presetUpdates);

            // Update the accordion badge (DOM element outside React)
            const hasAny = extUpdate?.hasUpdate || (presetUpdates?.length > 0);
            updateAccordionBadge(hasAny, presetUpdates?.length || 0, extUpdate?.hasUpdate);

            console.log('[useUpdateChecker] Update check complete:', {
                extensionUpdate: extUpdate?.hasUpdate,
                presetUpdates: presetUpdates?.length || 0,
            });
        } catch (error) {
            console.error('[useUpdateChecker] Update check failed:', error);
            console.error('[useUpdateChecker] Error stack:', error?.stack);
        }
    }, [actions]);

    useEffect(() => {
        if (hasInitialized.current) {
            console.log('[useUpdateChecker] Already initialized, skipping');
            return;
        }
        hasInitialized.current = true;

        // Defensive check for actions
        if (!actions) {
            console.error('[useUpdateChecker] Cannot initialize - actions not available');
            return;
        }

        console.log('[useUpdateChecker] Hook initialized, scheduling check in', INITIAL_CHECK_DELAY, 'ms');
        console.log('[useUpdateChecker] Available actions:', Object.keys(actions).filter(k => typeof actions[k] === 'function'));

        // Initial check after delay
        const initialTimeout = setTimeout(() => {
            console.log('[useUpdateChecker] Running initial update check...');
            performUpdateCheck();
        }, INITIAL_CHECK_DELAY);

        // Periodic checks
        checkIntervalRef.current = setInterval(() => {
            console.log('[useUpdateChecker] Running periodic update check...');
            performUpdateCheck();
        }, UPDATE_CHECK_INTERVAL);

        // Subscribe to update service changes (for manual refresh triggers)
        const unsubscribe = subscribeToUpdates((state) => {
            console.log('[useUpdateChecker] Received update from service:', state);
            if (state.extensionUpdate && actions?.setExtensionUpdate) {
                actions.setExtensionUpdate(state.extensionUpdate);
            }
        });

        return () => {
            console.log('[useUpdateChecker] Cleaning up...');
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
