import React, { useCallback } from 'react';
import { useSettings, useLumiverseActions, useUI, useUpdates } from './store/LumiverseContext';
import SettingsPanel from './components/SettingsPanel';
import ModalContainer from './components/ModalContainer';
import PackDetailModal from './components/modals/PackDetailModal';
import LoomPackDetailModal from './components/modals/LoomPackDetailModal';
import UpdateBanner from './components/UpdateBanner';
import { useUpdateChecker } from './hooks/useUpdateChecker';

/* global SillyTavern */

/**
 * Main App component for Lumiverse Helper
 * This serves as the root of the React UI
 */
function App() {
    const settings = useSettings();
    const actions = useLumiverseActions();
    const ui = useUI();
    const { extensionUpdate } = useUpdates();

    // Debug: Log when App renders
    console.log('[App] Component rendering, actions available:', !!actions);

    // Initialize update checking (runs once at app mount)
    useUpdateChecker();

    const handleDismissUpdate = useCallback(() => {
        if (extensionUpdate?.latestVersion) {
            actions.dismissExtensionUpdate(extensionUpdate.latestVersion);
        }
    }, [actions, extensionUpdate?.latestVersion]);

    return (
        <div className="lumiverse-app">
            {/* Update notification banner */}
            <UpdateBanner variant="full" onDismiss={handleDismissUpdate} />

            <SettingsPanel />

            {/* Modal portal - modals render here */}
            <ModalContainer />

            {/* Pack detail modals - portal to document.body */}
            <PackDetailModal />
            <LoomPackDetailModal />

            {/* Loading overlay */}
            {ui.isLoading && (
                <div className="lumiverse-loading-overlay">
                    <div className="lumiverse-spinner" />
                </div>
            )}

            {/* Error toast */}
            {ui.error && (
                <div className="lumiverse-error-toast" onClick={actions.clearError}>
                    <span>{ui.error}</span>
                    <button className="lumiverse-error-dismiss">Dismiss</button>
                </div>
            )}
        </div>
    );
}

export default App;
