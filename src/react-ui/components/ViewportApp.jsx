import React, { useState, useCallback, useEffect, useSyncExternalStore } from 'react';
import ViewportPanel from './ViewportPanel';
import CharacterProfile from './panels/CharacterProfile';
import PresetManager from './panels/PresetManager';
import PackBrowser from './panels/PackBrowser';
import OOCSettings from './panels/OOCSettings';
import PromptSettings from './panels/PromptSettings';
import CouncilManager from './panels/CouncilManager';
import SummaryEditor from './panels/SummaryEditor';
import FeedbackPanel from './panels/FeedbackPanel';
import ContentWorkshop from './panels/ContentWorkshop';
import LoomBuilder from './panels/LoomBuilder';
import CharacterBrowser from './panels/CharacterBrowser';
import PersonaManager from './panels/PersonaManager';
import PackDetailModal from './modals/PackDetailModal';
import LoomPackDetailModal from './modals/LoomPackDetailModal';
import SettingsModal from './modals/SettingsModal';
import { useLumiverseStore } from '../store/LumiverseContext';

// Get the store for direct access
const store = useLumiverseStore;

// Default drawer settings
const DEFAULT_DRAWER_SETTINGS = { side: 'right', verticalPosition: 15, tabSize: 'large', panelWidthMode: 'default', customPanelWidth: 35 };

/**
 * Main viewport application component
 * Contains the toggle button and panel as one unified sliding unit
 * Respects the showLumiverseDrawer setting from the store
 */
function ViewportApp() {
    const [isPanelVisible, setIsPanelVisible] = useState(false);
    const [requestedTab, setRequestedTab] = useState(null);

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

    // Watch for external _openToTab signal (e.g. from ST button interceptor)
    const openToTab = useSyncExternalStore(
        store.subscribe,
        () => store.getState()._openToTab,
        () => store.getState()._openToTab
    );

    useEffect(() => {
        if (openToTab) {
            // If already open on this tab, toggle closed; otherwise open to the tab
            if (isPanelVisible && requestedTab === openToTab) {
                setIsPanelVisible(false);
                setRequestedTab(null);
            } else {
                setIsPanelVisible(true);
                setRequestedTab(openToTab);
            }
            store.setState({ _openToTab: null });
        }
    }, [openToTab]);

    // Watch for _ensureTab signal — always opens panel (no toggle), used after navigation
    const ensureTab = useSyncExternalStore(
        store.subscribe,
        () => store.getState()._ensureTab,
        () => store.getState()._ensureTab
    );

    useEffect(() => {
        if (ensureTab) {
            setIsPanelVisible(true);
            setRequestedTab(ensureTab);
            store.setState({ _ensureTab: null });
        }
    }, [ensureTab]);

    // Watch for _closeDrawer signal — close the panel when triggered
    const closeDrawer = useSyncExternalStore(
        store.subscribe,
        () => store.getState()._closeDrawer,
        () => store.getState()._closeDrawer
    );

    useEffect(() => {
        if (closeDrawer) {
            setIsPanelVisible(false);
            store.setState({ _closeDrawer: null });
        }
    }, [closeDrawer]);

    const handleToggle = useCallback(() => {
        setIsPanelVisible(prev => !prev);
    }, []);

    const handleClose = useCallback(() => {
        setIsPanelVisible(false);
    }, []);

    return (
        <>
            {/* Drawer + viewport panel (hidden when drawer is disabled) */}
            {showDrawer && (
                <ViewportPanel
                    isVisible={isPanelVisible}
                    onToggle={handleToggle}
                    onClose={handleClose}
                    defaultTab="profile"
                    requestedTab={requestedTab}
                    drawerSettings={drawerSettings}
                    ProfileContent={CharacterProfile}
                    PresetsContent={PresetManager}
                    LoomContent={LoomBuilder}
                    BrowserContent={PackBrowser}
                    CharacterBrowserContent={CharacterBrowser}
                    PersonasContent={PersonaManager}
                    CreateContent={ContentWorkshop}
                    OOCContent={OOCSettings}
                    PromptContent={PromptSettings}
                    CouncilContent={CouncilManager}
                    SummaryContent={SummaryEditor}
                    FeedbackContent={FeedbackPanel}
                />
            )}
            {/* These portals must always render regardless of drawer visibility */}
            <PackDetailModal />
            <LoomPackDetailModal />
            <SettingsModal onDismissDrawer={handleClose} />
        </>
    );
}

export default ViewportApp;
