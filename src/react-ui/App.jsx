import React from 'react';
import { useSettings, useLumiverseActions, useUI } from './store/LumiverseContext';
import SettingsPanel from './components/SettingsPanel';
import ModalContainer from './components/ModalContainer';
import PackDetailModal from './components/modals/PackDetailModal';
import LoomPackDetailModal from './components/modals/LoomPackDetailModal';

/* global SillyTavern */

/**
 * Main App component for Lumiverse Helper
 * This serves as the root of the React UI
 */
function App() {
    const settings = useSettings();
    const actions = useLumiverseActions();
    const ui = useUI();

    return (
        <div className="lumiverse-app">
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
