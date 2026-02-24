import React, { useCallback, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { useLumiverseStore, saveToExtension } from '../../store/LumiverseContext';

const store = useLumiverseStore;

const DEFAULT_DRAWER_SETTINGS = { side: 'right', verticalPosition: 15, tabSize: 'large', panelWidthMode: 'default', customPanelWidth: 35 };
const selectShowDrawer = () => store.getState().showLumiverseDrawer ?? true;
const selectDrawerSettings = () => store.getState().drawerSettings ?? DEFAULT_DRAWER_SETTINGS;
const selectEnableLandingPage = () => store.getState().enableLandingPage ?? true;
const selectLandingPageChatsDisplayed = () => store.getState().landingPageChatsDisplayed ?? 12;

export default function GeneralSettingsView() {
    const showDrawer = useSyncExternalStore(store.subscribe, selectShowDrawer, selectShowDrawer);
    const drawerSettings = useSyncExternalStore(store.subscribe, selectDrawerSettings, selectDrawerSettings);
    const enableLandingPage = useSyncExternalStore(store.subscribe, selectEnableLandingPage, selectEnableLandingPage);
    const landingPageChatsDisplayed = useSyncExternalStore(store.subscribe, selectLandingPageChatsDisplayed, selectLandingPageChatsDisplayed);

    const handleDrawerToggle = useCallback((enabled) => {
        store.setState({ showLumiverseDrawer: enabled });
        saveToExtension();
    }, []);

    const handleDrawerSideChange = useCallback((side) => {
        store.setState({ drawerSettings: { ...store.getState().drawerSettings, side } });
        saveToExtension();
    }, []);

    const handleVerticalPositionChange = useCallback((value) => {
        const verticalPosition = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
        store.setState({ drawerSettings: { ...store.getState().drawerSettings, verticalPosition } });
        saveToExtension();
    }, []);

    const handleTabSizeChange = useCallback((tabSize) => {
        store.setState({ drawerSettings: { ...store.getState().drawerSettings, tabSize } });
        saveToExtension();
    }, []);

    const handlePanelWidthModeChange = useCallback((panelWidthMode) => {
        store.setState({ drawerSettings: { ...store.getState().drawerSettings, panelWidthMode } });
        saveToExtension();
    }, []);

    const handleCustomPanelWidthChange = useCallback((value) => {
        const customPanelWidth = Math.max(25, Math.min(60, parseInt(value, 10) || 35));
        store.setState({ drawerSettings: { ...store.getState().drawerSettings, customPanelWidth } });
        saveToExtension();
    }, []);

    const handleLandingPageToggle = useCallback((enabled) => {
        store.setState({ enableLandingPage: enabled });
        saveToExtension();
    }, []);

    const handleChatsDisplayedChange = useCallback((value) => {
        store.setState({ landingPageChatsDisplayed: parseInt(value, 10) || 12 });
        saveToExtension();
    }, []);

    return (
        <div className="lumiverse-settings-view">
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

            {/* Drawer Position Settings */}
            {showDrawer && (
                <div className="lumia-drawer-settings-container">
                    <div className="lumia-drawer-settings-row">
                        <div className="lumia-drawer-setting">
                            <label className="lumia-drawer-setting-label">Drawer Side</label>
                            <div className="lumia-drawer-side-toggle">
                                <button
                                    type="button"
                                    className={clsx('lumia-side-btn', drawerSettings.side === 'left' && 'lumia-side-btn--active')}
                                    onClick={() => handleDrawerSideChange('left')}
                                >
                                    Left
                                </button>
                                <button
                                    type="button"
                                    className={clsx('lumia-side-btn', drawerSettings.side === 'right' && 'lumia-side-btn--active')}
                                    onClick={() => handleDrawerSideChange('right')}
                                >
                                    Right
                                </button>
                            </div>
                        </div>
                        <div className="lumia-drawer-setting">
                            <label htmlFor="lumia-drawer-vpos-settings" className="lumia-drawer-setting-label">
                                Tab Position
                            </label>
                            <div className="lumia-drawer-vpos-input">
                                <input
                                    type="range"
                                    id="lumia-drawer-vpos-settings"
                                    className="lumia-slider"
                                    value={drawerSettings.verticalPosition}
                                    onChange={(e) => handleVerticalPositionChange(e.target.value)}
                                    min="8"
                                    max="85"
                                />
                                <span className="lumia-drawer-vpos-value">{drawerSettings.verticalPosition}%</span>
                            </div>
                        </div>
                    </div>
                    <div className="lumia-drawer-settings-row">
                        <div className="lumia-drawer-setting">
                            <label className="lumia-drawer-setting-label">Tab Size</label>
                            <div className="lumia-drawer-side-toggle">
                                <button
                                    type="button"
                                    className={clsx('lumia-side-btn', drawerSettings.tabSize === 'large' && 'lumia-side-btn--active')}
                                    onClick={() => handleTabSizeChange('large')}
                                >
                                    Large
                                </button>
                                <button
                                    type="button"
                                    className={clsx('lumia-side-btn', drawerSettings.tabSize === 'compact' && 'lumia-side-btn--active')}
                                    onClick={() => handleTabSizeChange('compact')}
                                >
                                    Compact
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="lumia-drawer-settings-row">
                        <div className="lumia-drawer-setting" style={{ flex: 1 }}>
                            <label className="lumia-drawer-setting-label">Panel Width</label>
                            <div className="lumia-drawer-side-toggle">
                                <button
                                    type="button"
                                    className={clsx('lumia-side-btn', (drawerSettings.panelWidthMode || 'default') === 'default' && 'lumia-side-btn--active')}
                                    onClick={() => handlePanelWidthModeChange('default')}
                                >
                                    Default
                                </button>
                                <button
                                    type="button"
                                    className={clsx('lumia-side-btn', drawerSettings.panelWidthMode === 'stChat' && 'lumia-side-btn--active')}
                                    onClick={() => handlePanelWidthModeChange('stChat')}
                                    title="Match SillyTavern's chat column width"
                                >
                                    ST Chat
                                </button>
                                <button
                                    type="button"
                                    className={clsx('lumia-side-btn', drawerSettings.panelWidthMode === 'custom' && 'lumia-side-btn--active')}
                                    onClick={() => handlePanelWidthModeChange('custom')}
                                >
                                    Custom
                                </button>
                            </div>
                        </div>
                    </div>
                    {drawerSettings.panelWidthMode === 'custom' && (
                        <div className="lumia-drawer-settings-row">
                            <div className="lumia-drawer-setting" style={{ flex: 1 }}>
                                <label htmlFor="lumia-drawer-panel-width-settings" className="lumia-drawer-setting-label">
                                    Custom Width
                                </label>
                                <div className="lumia-drawer-vpos-input">
                                    <input
                                        type="range"
                                        id="lumia-drawer-panel-width-settings"
                                        className="lumia-slider"
                                        value={drawerSettings.customPanelWidth || 35}
                                        onChange={(e) => handleCustomPanelWidthChange(e.target.value)}
                                        min="25"
                                        max="60"
                                    />
                                    <span className="lumia-drawer-vpos-value">{drawerSettings.customPanelWidth || 35}%</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Landing Page Toggle */}
            <div className="lumia-drawer-toggle-container">
                <label className="lumiverse-toggle-wrapper">
                    <div className="lumiverse-toggle-text">
                        <span className="lumiverse-toggle-label">Custom Landing Page</span>
                        <span className="lumiverse-toggle-description">
                            Show Lumiverse recent chats on the home screen
                        </span>
                    </div>
                    <div className={clsx('lumiverse-toggle', enableLandingPage && 'lumiverse-toggle--on')}>
                        <input
                            type="checkbox"
                            className="lumiverse-toggle-input"
                            checked={enableLandingPage}
                            onChange={(e) => handleLandingPageToggle(e.target.checked)}
                        />
                        <span className="lumiverse-toggle-slider"></span>
                    </div>
                </label>
                {enableLandingPage && (
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '4px' }}>
                        <span style={{ fontSize: '0.9em', opacity: 0.8 }}>Chats Displayed:</span>
                        <input
                            type="number"
                            className="lumia-input lumia-input-sm"
                            style={{ width: '60px' }}
                            value={landingPageChatsDisplayed}
                            onChange={(e) => handleChatsDisplayedChange(e.target.value)}
                            min="1"
                            max="50"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
