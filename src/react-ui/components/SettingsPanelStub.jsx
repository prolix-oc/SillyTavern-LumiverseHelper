import React, { useCallback, useSyncExternalStore } from 'react';
import { useLumiverseActions, saveToExtension, useLumiverseStore } from '../store/LumiverseContext';
import { Settings } from 'lucide-react';
import clsx from 'clsx';

const store = useLumiverseStore;

// Stable selectors (must be defined outside the component)
const selectShowDrawer = () => store.getState().showLumiverseDrawer ?? true;

/**
 * Minimal stub that replaces the full SettingsPanel inside
 * the SillyTavern #extensions_settings accordion.
 *
 * Provides:
 *  - Drawer visibility toggle (useful inline)
 *  - "Open Lumiverse Settings" button → opens the settings modal
 */
export default function SettingsPanelStub() {
    const actions = useLumiverseActions();
    const showDrawer = useSyncExternalStore(store.subscribe, selectShowDrawer);

    const handleDrawerToggle = useCallback((checked) => {
        store.setState({ showLumiverseDrawer: checked });
        saveToExtension();
    }, []);

    return (
        <div className="lumia-injector-settings">
            {/* Drawer Toggle */}
            <div className="lumia-drawer-toggle-container">
                <label className="lumiverse-toggle-wrapper">
                    <div className="lumiverse-toggle-text">
                        <span className="lumiverse-toggle-label">Show Lumiverse Drawer</span>
                        <span className="lumiverse-toggle-description">
                            Access quick settings from a slide-out panel
                        </span>
                    </div>
                    <div className={clsx('lumiverse-toggle', showDrawer && 'lumiverse-toggle--on')}>
                        <input
                            type="checkbox"
                            className="lumiverse-toggle-input"
                            checked={showDrawer}
                            onChange={(e) => handleDrawerToggle(e.target.checked)}
                        />
                        <span className="lumiverse-toggle-slider"></span>
                    </div>
                </label>
            </div>

            {/* Open full settings modal */}
            <button
                className="lumia-btn lumia-btn-primary lumia-btn-full"
                onClick={() => actions.openSettingsModal()}
                type="button"
                style={{ marginTop: '12px' }}
            >
                <Settings size={16} strokeWidth={1.5} />
                Open Lumiverse Settings
            </button>
        </div>
    );
}
