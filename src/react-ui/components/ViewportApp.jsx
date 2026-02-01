import React, { useState, useCallback, useSyncExternalStore } from 'react';
import ViewportPanel from './ViewportPanel';
import CharacterProfile from './panels/CharacterProfile';
import PresetManager from './panels/PresetManager';
import PackBrowser from './panels/PackBrowser';
import OOCSettings from './panels/OOCSettings';
import PromptSettings from './panels/PromptSettings';
import CouncilManager from './panels/CouncilManager';
import SummaryEditor from './panels/SummaryEditor';
import PackDetailModal from './modals/PackDetailModal';
import LoomPackDetailModal from './modals/LoomPackDetailModal';
import { useLumiverseStore } from '../store/LumiverseContext';

// Get the store for direct access
const store = useLumiverseStore;

// Default drawer settings
const DEFAULT_DRAWER_SETTINGS = { side: 'right', verticalPosition: 15, tabSize: 'large' };

/**
 * Main viewport application component
 * Contains the toggle button and panel as one unified sliding unit
 * Respects the showLumiverseDrawer setting from the store
 */
function ViewportApp() {
    const [isPanelVisible, setIsPanelVisible] = useState(false);

    // Check if drawer should be shown at all
    const showDrawer = useSyncExternalStore(
        store.subscribe,
        () => store.getState().showLumiverseDrawer ?? true,
        () => store.getState().showLumiverseDrawer ?? true
    );

    // Get drawer settings for positioning
    const drawerSettings = useSyncExternalStore(
        store.subscribe,
        () => store.getState().drawerSettings ?? DEFAULT_DRAWER_SETTINGS,
        () => store.getState().drawerSettings ?? DEFAULT_DRAWER_SETTINGS
    );

    const handleToggle = useCallback(() => {
        setIsPanelVisible(prev => !prev);
    }, []);

    const handleClose = useCallback(() => {
        setIsPanelVisible(false);
    }, []);

    // Don't render anything if drawer is disabled
    if (!showDrawer) {
        return null;
    }

    return (
        <>
            <ViewportPanel
                isVisible={isPanelVisible}
                onToggle={handleToggle}
                onClose={handleClose}
                defaultTab="profile"
                drawerSettings={drawerSettings}
                ProfileContent={CharacterProfile}
                PresetsContent={PresetManager}
                BrowserContent={PackBrowser}
                OOCContent={OOCSettings}
                PromptContent={PromptSettings}
                CouncilContent={CouncilManager}
                SummaryContent={SummaryEditor}
            />
            {/* Pack detail modal - rendered when viewingPack is set */}
            <PackDetailModal />
            {/* Loom pack detail modal - rendered when viewingLoomPack is set */}
            <LoomPackDetailModal />
        </>
    );
}

export default ViewportApp;
