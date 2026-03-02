import React, { useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { User, Package, MessageSquare, Sliders, FileText, X, Sparkles, Bookmark, Users, BarChart2, Layers, Settings, PenTool, Contact, UserCircle, MoreHorizontal, Plug } from 'lucide-react';
import { useLumiverseStore, useLumiverseActions, useUpdates } from '../store/LumiverseContext';
import { UpdateDot } from './UpdateBanner';
import UpdateBanner from './UpdateBanner';
import useOverflowTabs from '../hooks/useOverflowTabs';
import ErrorBoundary from './shared/ErrorBoundary';

// Get store for direct access
const store = useLumiverseStore;

// Stable fallback constants for useSyncExternalStore
const DEFAULT_DRAWER_SETTINGS = { side: 'right', verticalPosition: 15, tabSize: 'large', panelWidthMode: 'default', customPanelWidth: 35 };
const EMPTY_ARRAY = [];

// Stable selector functions
const selectDrawerSettings = () => store.getState().drawerSettings ?? DEFAULT_DRAWER_SETTINGS;
const selectCouncilMode = () => store.getState().councilMode || false;
const selectCouncilToolsEnabled = () => store.getState().councilTools?.enabled || false;
const selectCouncilMembers = () => store.getState().councilMembers || EMPTY_ARRAY;
const selectChatChangeCounter = () => store.getState().chatChangeCounter || 0;
const selectEnableCharacterBrowser = () => store.getState().enableCharacterBrowser ?? true;
const selectEnablePersonaManager = () => store.getState().enablePersonaManager ?? true;

// Panel dimensions
const DESKTOP_PANEL_WIDTH = 376; // 56px tabs + 320px content
const TAB_SIDEBAR_WIDTH = 56; // Width of the icon tab sidebar
const DRAWER_TAB_WIDTH = 48; // Width of the flush-mounted tab (desktop)
const DRAWER_TAB_WIDTH_COMPACT = 32; // Width of the compact tab
const MOBILE_DRAWER_TAB_WIDTH = 40; // Width of the flush-mounted tab (mobile)
const MOBILE_DRAWER_TAB_WIDTH_COMPACT = 32; // Width of the compact tab (mobile)
const MOBILE_BREAKPOINT = 600;

// useIsMobile extracted to shared hook
import useIsMobile from '../hooks/useIsMobile';

/**
 * Flush-mounted drawer tab - integrated into the drawer's edge
 * Animates together with the drawer as a unified element
 * Supports left or right positioning with adjustable vertical position
 */
function DrawerTab({ isVisible, onClick, hasUpdates, side = 'right', verticalPosition = 15, tabSize = 'large' }) {
    const isLeft = side === 'left';
    const isCompact = tabSize === 'compact';
    
    return (
        <button
            className={clsx(
                'lumiverse-drawer-tab',
                isVisible && 'lumiverse-drawer-tab--active',
                hasUpdates && 'lumiverse-drawer-tab--has-updates',
                isLeft && 'lumiverse-drawer-tab--left',
                isCompact && 'lumiverse-drawer-tab--compact'
            )}
            onClick={onClick}
            title={isVisible ? 'Hide Lumiverse Panel' : 'Show Lumiverse Panel'}
            type="button"
            aria-expanded={isVisible}
            aria-label="Toggle Lumiverse drawer"
            style={{
                marginTop: `${Math.max(8, Math.min(85, verticalPosition))}vh`,
            }}
        >
            <span className="lumiverse-drawer-tab-icon">
                <Sparkles size={isCompact ? 14 : 16} strokeWidth={2.5} />
            </span>
            <span className="lumiverse-drawer-tab-label">Lumia</span>
            <UpdateDot />
        </button>
    );
}

/**
 * Tab button for the panel
 */
function TabButton({ id, Icon, label, isActive, onClick }) {
    return (
        <button
            className={clsx('lumiverse-vp-tab', isActive && 'lumiverse-vp-tab--active')}
            onClick={() => onClick(id)}
            title={label}
            type="button"
        >
            <span className="lumiverse-vp-tab-icon">
                <Icon size={20} strokeWidth={1.5} />
            </span>
            <span className="lumiverse-vp-tab-label">{label}</span>
        </button>
    );
}

/**
 * Panel header with title and controls
 */
function PanelHeader({ title, Icon, onClose }) {
    return (
        <div className="lumiverse-vp-header">
            <span className="lumiverse-vp-header-icon">
                <Icon size={18} strokeWidth={1.5} />
            </span>
            <span className="lumiverse-vp-header-title">{title}</span>
            <button
                className="lumiverse-vp-close-btn"
                onClick={onClose}
                title="Close panel"
                type="button"
            >
                <X size={16} strokeWidth={2} />
            </button>
        </div>
    );
}

/**
 * Overflow "More" button — replaces the spacer when tabs overflow on mobile.
 * Shows a primary-colored dot when the active tab is hidden in overflow.
 */
function OverflowButton({ onClick, hasActiveInOverflow, isOpen }) {
    return (
        <button
            className={clsx('lumiverse-vp-tab lumiverse-vp-overflow-btn', isOpen && 'lumiverse-vp-tab--active')}
            onClick={onClick}
            title="More tabs"
            type="button"
        >
            <span className="lumiverse-vp-tab-icon">
                <MoreHorizontal size={20} strokeWidth={1.5} />
            </span>
            <span className="lumiverse-vp-tab-label">More</span>
            {hasActiveInOverflow && !isOpen && <span className="lumiverse-vp-overflow-dot" />}
        </button>
    );
}

/**
 * Floating card menu for overflow tabs.
 * Positioned next to the tab sidebar inside the content area.
 */
function OverflowMenu({ tabs, activeTab, onSelect, onClose, side }) {
    const isLeft = side === 'left';
    return (
        <>
            <div className="lumiverse-vp-overflow-backdrop" onClick={onClose} />
            <div
                className="lumiverse-vp-overflow-menu"
                style={isLeft ? { right: 'auto', left: '100%' } : { left: 'auto', right: '100%' }}
            >
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={clsx('lumiverse-vp-overflow-item', activeTab === tab.id && 'lumiverse-vp-overflow-item--active')}
                        onClick={() => onSelect(tab.id)}
                        type="button"
                    >
                        <tab.Icon size={18} strokeWidth={1.5} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>
        </>
    );
}

/**
 * Tab configuration for the viewport panel
 * Tabs with conditional: true are filtered based on state
 */
const ALL_PANEL_TABS = [
    {
        id: 'profile',
        Icon: User,
        label: 'Profile',
        title: 'Character Lumia Profile',
    },
    {
        id: 'personas',
        Icon: UserCircle,
        label: 'Personas',
        title: 'Persona Manager',
    },
    {
        id: 'characters',
        Icon: Contact,
        label: 'Chars',
        title: 'Character Browser',
    },
    {
        id: 'presets',
        Icon: Bookmark,
        label: 'Presets',
        title: 'Lumia Presets',
    },
    {
        id: 'loom',
        Icon: Layers,
        label: 'Loom',
        title: 'Lucid Loom Builder',
    },
    {
        id: 'connect',
        Icon: Plug,
        label: 'Connect',
        title: 'Connection Manager',
    },
    {
        id: 'browser',
        Icon: Package,
        label: 'Packs',
        title: 'Pack Browser',
    },
    {
        id: 'ooc',
        Icon: MessageSquare,
        label: 'OOC',
        title: 'OOC Settings',
    },
    {
        id: 'prompt',
        Icon: Sliders,
        label: 'Prompt',
        title: 'Prompt Settings',
    },
    {
        id: 'council',
        Icon: Users,
        label: 'Council',
        title: 'Council of Lumiae',
    },
    {
        id: 'summary',
        Icon: FileText,
        label: 'Summary',
        title: 'Summary Editor',
    },
    {
        id: 'feedback',
        Icon: BarChart2,
        label: 'Feedback',
        title: 'Council Feedback',
        conditional: true,
    },
    {
        id: 'create',
        Icon: PenTool,
        label: 'Create',
        title: 'Content Workshop',
    },
];

/**
 * Main Viewport Panel component
 * A collapsible sidebar that docks alongside the chat
 * Toggle button and panel move together as one unit
 * Supports docking to left or right side of screen
 */
function ViewportPanel({
    isVisible,
    onToggle,
    onClose,
    defaultTab = 'profile',
    requestedTab = null,
    drawerSettings: drawerSettingsProp,
    // Tab content components passed as props
    ProfileContent,
    PresetsContent,
    LoomContent,
    BrowserContent,
    CharacterBrowserContent,
    PersonasContent,
    ConnectContent,
    CreateContent,
    OOCContent,
    PromptContent,
    CouncilContent,
    SummaryContent,
    FeedbackContent,
}) {
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [overflowOpen, setOverflowOpen] = useState(false);
    const [mountReady, setMountReady] = useState(false);
    const tabsContainerRef = useRef(null);
    const isMobile = useIsMobile();
    const { hasAnyUpdate } = useUpdates();
    const storeActions = useLumiverseActions();

    // Track viewport width for responsive panel sizing on desktop
    const [viewportWidth, setViewportWidth] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth : 1024
    );
    // Force re-render counter for --sheldWidth CSS variable changes
    const [, sheldForceUpdate] = useState(0);

    useEffect(() => {
        const handler = () => setViewportWidth(window.innerWidth);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);

    // Subscribe to state needed for conditional tab visibility
    const councilMode = useSyncExternalStore(store.subscribe, selectCouncilMode, selectCouncilMode);
    const councilToolsEnabled = useSyncExternalStore(store.subscribe, selectCouncilToolsEnabled, selectCouncilToolsEnabled);
    const councilMembers = useSyncExternalStore(store.subscribe, selectCouncilMembers, selectCouncilMembers);
    const chatChangeCounter = useSyncExternalStore(store.subscribe, selectChatChangeCounter, selectChatChangeCounter);
    const enableCharacterBrowser = useSyncExternalStore(store.subscribe, selectEnableCharacterBrowser, selectEnableCharacterBrowser);
    const enablePersonaManager = useSyncExternalStore(store.subscribe, selectEnablePersonaManager, selectEnablePersonaManager);

    // Check if there's an active chat
    const hasActiveChat = useMemo(() => {
        try {
            if (typeof SillyTavern !== 'undefined') {
                const context = SillyTavern.getContext();
                return context?.chat && context.chat.length > 0;
            }
        } catch { /* ignore */ }
        return false;
    }, [chatChangeCounter]);

    // Filter tabs based on conditional visibility
    const visibleTabs = useMemo(() => {
        return ALL_PANEL_TABS.filter(tab => {
            if (tab.id === 'feedback') {
                return hasActiveChat && councilMode && councilToolsEnabled && councilMembers?.length > 0;
            }
            if (tab.id === 'characters') return enableCharacterBrowser;
            if (tab.id === 'personas') return enablePersonaManager;
            return true;
        });
    }, [hasActiveChat, councilMode, councilToolsEnabled, councilMembers?.length, enableCharacterBrowser, enablePersonaManager]);

    // Priority+ overflow for mobile tabs
    const { directTabs, overflowTabs, needsOverflow } = useOverflowTabs(visibleTabs, isMobile, tabsContainerRef);

    // Auto-fallback if active tab becomes hidden
    useEffect(() => {
        const isActiveTabVisible = visibleTabs.some(t => t.id === activeTab);
        if (!isActiveTabVisible && visibleTabs.length > 0) {
            setActiveTab(visibleTabs[0].id);
        }
    }, [visibleTabs, activeTab]);

    // Switch to externally requested tab
    useEffect(() => {
        if (requestedTab) {
            setActiveTab(requestedTab);
        }
    }, [requestedTab]);

    // Suppress CSS transition on initial mount so the drawer doesn't flash-animate
    // into its hidden position. Double-rAF ensures the browser has painted the
    // initial transform before we enable transitions.
    useEffect(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => setMountReady(true));
        });
    }, []);

    // Close overflow menu when panel closes
    useEffect(() => {
        if (!isVisible) setOverflowOpen(false);
    }, [isVisible]);

    // Subscribe to drawer settings from store (fallback if not passed as prop)
    const drawerSettingsFromStore = useSyncExternalStore(
        store.subscribe,
        selectDrawerSettings,
        selectDrawerSettings
    );

    // Use prop if provided, otherwise use store value
    const drawerSettings = drawerSettingsProp || drawerSettingsFromStore;
    
    // Extract settings with defaults
    const side = drawerSettings?.side || 'right';
    const verticalPosition = drawerSettings?.verticalPosition ?? 15;
    const tabSize = drawerSettings?.tabSize || 'large';
    const panelWidthMode = drawerSettings?.panelWidthMode || 'default';
    const customPanelWidthVw = drawerSettings?.customPanelWidth || 35;
    const isLeft = side === 'left';

    // Watch for --sheldWidth CSS variable changes when in stChat mode
    // Uses both MutationObserver (catches inline style changes) and ST's settings_updated event
    useEffect(() => {
        if (panelWidthMode !== 'stChat') return;

        const forceRecompute = () => sheldForceUpdate(n => n + 1);

        // Watch for style attribute mutations on <html> (catches applyChatWidth calls)
        const observer = new MutationObserver(forceRecompute);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['style'],
        });

        // Also subscribe to ST's settings_updated event for reliable chat width change detection
        let eventSource = null;
        try {
            if (typeof SillyTavern !== 'undefined') {
                const ctx = SillyTavern.getContext();
                eventSource = ctx?.eventSource ?? null;
                eventSource?.on('settings_updated', forceRecompute);
            }
        } catch { /* ignore */ }

        return () => {
            observer.disconnect();
            eventSource?.removeListener('settings_updated', forceRecompute);
        };
    }, [panelWidthMode]);

    // Compute dynamic panel dimensions based on width mode
    // Mobile always uses 100vw regardless of mode
    let panelWidth, mainContentWidth;
    if (isMobile) {
        panelWidth = viewportWidth;
        mainContentWidth = 320; // CSS flex handles actual sizing on mobile
    } else {
        switch (panelWidthMode) {
            case 'stChat': {
                // --sheldWidth is the centered chat column width (e.g. 50vw).
                // Available side space = (100% - sheldWidth) / 2
                const raw = getComputedStyle(document.documentElement)
                    .getPropertyValue('--sheldWidth')?.trim();
                let sidePx = DESKTOP_PANEL_WIDTH;
                if (raw?.endsWith('vw')) {
                    const sheldVw = parseFloat(raw);
                    sidePx = Math.round(((100 - sheldVw) / 2) * viewportWidth / 100);
                } else if (raw?.endsWith('px')) {
                    const sheldPx = parseInt(raw, 10);
                    sidePx = Math.round((viewportWidth - sheldPx) / 2);
                }
                panelWidth = Math.max(DESKTOP_PANEL_WIDTH, sidePx);
                mainContentWidth = panelWidth - TAB_SIDEBAR_WIDTH;
                break;
            }
            case 'custom': {
                panelWidth = Math.max(DESKTOP_PANEL_WIDTH, Math.round(customPanelWidthVw * viewportWidth / 100));
                mainContentWidth = panelWidth - TAB_SIDEBAR_WIDTH;
                break;
            }
            default:
                panelWidth = DESKTOP_PANEL_WIDTH;
                mainContentWidth = 320;
        }
    }

    // Tab width (the drawer handle)
    const isCompact = tabSize === 'compact';
    const tabWidth = isMobile
        ? (isCompact ? MOBILE_DRAWER_TAB_WIDTH_COMPACT : MOBILE_DRAWER_TAB_WIDTH)
        : (isCompact ? DRAWER_TAB_WIDTH_COMPACT : DRAWER_TAB_WIDTH);

    // Wrapper width: on mobile use calc(100vw + tab), on desktop use computed panel width + tab
    const wrapperWidth = isMobile
        ? `calc(100vw + ${tabWidth}px)`
        : (panelWidth + tabWidth);

    const handleTabClick = useCallback((tabId) => {
        setActiveTab(tabId);
        setOverflowOpen(false);
    }, []);

    const activeTabConfig = ALL_PANEL_TABS.find(tab => tab.id === activeTab);

    // Memoize tab content components to prevent unnecessary re-renders
    // Pass handleTabClick to ProfileContent so it can navigate to other tabs (e.g., Council)
    const tabPanels = useMemo(() => ({
        profile: <ErrorBoundary label="Profile">{ProfileContent ? <ProfileContent onTabChange={handleTabClick} /> : <PlaceholderContent tab="profile" />}</ErrorBoundary>,
        presets: <ErrorBoundary label="Presets">{PresetsContent ? <PresetsContent /> : <PlaceholderContent tab="presets" />}</ErrorBoundary>,
        loom: <ErrorBoundary label="Loom">{LoomContent ? <LoomContent compact /> : <PlaceholderContent tab="loom" />}</ErrorBoundary>,
        connect: <ErrorBoundary label="Connect">{ConnectContent ? <ConnectContent compact /> : <PlaceholderContent tab="connect" />}</ErrorBoundary>,
        browser: <ErrorBoundary label="Packs">{BrowserContent ? <BrowserContent /> : <PlaceholderContent tab="browser" />}</ErrorBoundary>,
        characters: <ErrorBoundary label="Characters">{CharacterBrowserContent ? <CharacterBrowserContent /> : <PlaceholderContent tab="characters" />}</ErrorBoundary>,
        personas: <ErrorBoundary label="Personas">{PersonasContent ? <PersonasContent /> : <PlaceholderContent tab="personas" />}</ErrorBoundary>,
        create: <ErrorBoundary label="Create">{CreateContent ? <CreateContent /> : <PlaceholderContent tab="create" />}</ErrorBoundary>,
        ooc: <ErrorBoundary label="OOC">{OOCContent ? <OOCContent /> : <PlaceholderContent tab="ooc" />}</ErrorBoundary>,
        prompt: <ErrorBoundary label="Prompt">{PromptContent ? <PromptContent /> : <PlaceholderContent tab="prompt" />}</ErrorBoundary>,
        council: <ErrorBoundary label="Council">{CouncilContent ? <CouncilContent /> : <PlaceholderContent tab="council" />}</ErrorBoundary>,
        summary: <ErrorBoundary label="Summary">{SummaryContent ? <SummaryContent /> : <PlaceholderContent tab="summary" />}</ErrorBoundary>,
        feedback: <ErrorBoundary label="Feedback">{FeedbackContent ? <FeedbackContent /> : <PlaceholderContent tab="feedback" />}</ErrorBoundary>,
    }), [ProfileContent, PresetsContent, LoomContent, ConnectContent, BrowserContent, CharacterBrowserContent, PersonasContent, CreateContent, OOCContent, PromptContent, CouncilContent, SummaryContent, FeedbackContent, handleTabClick]);

    // Calculate wrapper positioning based on side
    const getWrapperStyle = () => {
        const baseStyle = {
            position: 'fixed',
            top: 0,
            bottom: 0,
            width: wrapperWidth,
            zIndex: 9998,
            transition: mountReady ? 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
            // Wrapper itself doesn't capture events - children opt-in via pointer-events: auto
            pointerEvents: 'none',
        };

        // On mobile, use 100vw for transform to stay fluid
        // On desktop, use fixed pixel value
        const slideAmount = isMobile ? '100vw' : `${panelWidth}px`;

        if (isLeft) {
            // Left side: anchor to left edge, slide left when closed (hide panel, show tab)
            return {
                ...baseStyle,
                left: 0,
                transform: isVisible ? 'translateX(0)' : `translateX(calc(-${slideAmount}))`,
            };
        } else {
            // Right side: anchor to right edge, slide right when closed (hide panel, show tab)
            return {
                ...baseStyle,
                right: 0,
                transform: isVisible ? 'translateX(0)' : `translateX(${slideAmount})`,
            };
        }
    };

    // Use transform for smooth GPU-accelerated animation
    return (
        <>
            {/* Unified drawer wrapper - tab and panel slide together as one unit */}
            {/* The wrapper is sized to include the tab width, and the slide amount */}
            {/* only translates by panelWidth, so the tab remains visible at the edge */}
            <div
                className={clsx(
                    'lumiverse-viewport-wrapper',
                    isVisible && 'lumiverse-viewport-wrapper--visible',
                    isLeft && 'lumiverse-viewport-wrapper--left'
                )}
                style={getWrapperStyle()}
            >
            <div
                className={clsx(
                    'lumiverse-viewport-panel',
                    isLeft && 'lumiverse-viewport-panel--left'
                )}
                style={{
                    // Panel is pass-through; children (DrawerTab, vp-tabs, vp-main) opt-in.
                    // This prevents the DrawerTab's empty flex column from blocking clicks on ST content.
                    pointerEvents: 'none',
                }}
            >
                {/* Drawer tab - stays at the edge of the wrapper during slide animation */}
                <DrawerTab
                    isVisible={isVisible}
                    onClick={onToggle}
                    hasUpdates={hasAnyUpdate}
                    side={side}
                    verticalPosition={verticalPosition}
                    tabSize={tabSize}
                />
                {/* Tab sidebar */}
                <div className="lumiverse-vp-tabs" ref={tabsContainerRef} style={{ position: 'relative' }}>
                    {directTabs.map(tab => (
                        <TabButton
                            key={tab.id}
                            id={tab.id}
                            Icon={tab.Icon}
                            label={tab.label}
                            isActive={activeTab === tab.id}
                            onClick={handleTabClick}
                        />
                    ))}
                    {needsOverflow ? (
                        <OverflowButton
                            onClick={() => setOverflowOpen(prev => !prev)}
                            hasActiveInOverflow={overflowTabs.some(t => t.id === activeTab)}
                            isOpen={overflowOpen}
                        />
                    ) : (
                        <div className="lumiverse-vp-tabs-spacer" />
                    )}
                    {/* Overflow floating menu */}
                    {overflowOpen && needsOverflow && (
                        <OverflowMenu
                            tabs={overflowTabs}
                            activeTab={activeTab}
                            onSelect={handleTabClick}
                            onClose={() => setOverflowOpen(false)}
                            side={side}
                        />
                    )}
                    <div className="lumiverse-vp-tabs-spacer" />
                    <button
                        className="lumiverse-vp-settings-btn"
                        onClick={() => storeActions.openSettingsModal()}
                        title="Lumiverse Settings"
                        type="button"
                    >
                        <Settings size={18} strokeWidth={1.5} />
                    </button>
                </div>

                {/* Main panel content */}
                <div
                    className="lumiverse-vp-main"
                    style={{
                        // On desktop, use fixed width. On mobile, flex handles it via CSS
                        width: isMobile ? undefined : mainContentWidth,
                    }}
                >
                    <PanelHeader
                        title={activeTabConfig?.title || 'Panel'}
                        Icon={activeTabConfig?.Icon || User}
                        onClose={onClose}
                    />
                    {/* Update banner at top of sidebar */}
                    <UpdateBanner variant="full" />
                    <div className="lumiverse-vp-content">
                        {/* All tabs stay mounted - CSS handles visibility */}
                        {visibleTabs.map(tab => (
                            <div
                                key={tab.id}
                                className={clsx(
                                    'lumiverse-vp-tab-content',
                                    activeTab === tab.id && 'lumiverse-vp-tab-content--active'
                                )}
                                aria-hidden={activeTab !== tab.id}
                            >
                                {tabPanels[tab.id]}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            </div>
        </>
    );
}

/**
 * Placeholder content for tabs not yet implemented
 */
function PlaceholderContent({ tab }) {
    const placeholders = {
        profile: {
            Icon: User,
            title: 'Character Lumia Profile',
            description: 'View and manage Lumia traits for the current character',
        },
        presets: {
            Icon: Bookmark,
            title: 'Lumia Presets',
            description: 'Save and load preset configurations for quick switching',
        },
        browser: {
            Icon: Package,
            title: 'Pack Browser',
            description: 'Browse and search through all loaded packs with previews',
        },
        personas: {
            Icon: UserCircle,
            title: 'Persona Manager',
            description: 'Manage your user personas, avatars, and identity settings',
        },
        create: {
            Icon: PenTool,
            title: 'Content Workshop',
            description: 'Create and manage custom packs, Lumia characters, and Loom modifiers',
        },
        ooc: {
            Icon: MessageSquare,
            title: 'OOC Settings',
            description: 'Configure out-of-character comment behavior and triggers',
        },
        prompt: {
            Icon: Sliders,
            title: 'Prompt Settings',
            description: 'Configure prompt injection and formatting options',
        },
        council: {
            Icon: Users,
            title: 'Council of Lumiae',
            description: 'Manage multiple independent Lumias that collaborate as a council',
        },
        summary: {
            Icon: FileText,
            title: 'Summary Editor',
            description: 'View and edit the current conversation summary',
        },
        feedback: {
            Icon: BarChart2,
            title: 'Council Feedback',
            description: 'View diagnostic feedback from council tool executions',
        },
    };

    const config = placeholders[tab] || {};
    const { Icon } = config;

    return (
        <div className="lumiverse-vp-placeholder">
            {Icon && (
                <span className="lumiverse-vp-placeholder-icon">
                    <Icon size={32} strokeWidth={1.5} />
                </span>
            )}
            <h3>{config.title}</h3>
            <p>{config.description}</p>
            <span className="lumiverse-vp-placeholder-badge">Coming Soon</span>
        </div>
    );
}

export default ViewportPanel;
