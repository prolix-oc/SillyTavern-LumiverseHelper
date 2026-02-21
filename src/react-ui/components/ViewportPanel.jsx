import React, { useState, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { User, Package, MessageSquare, Sliders, FileText, ChevronRight, ChevronLeft, X, Sparkles, Bookmark, Users } from 'lucide-react';
import { useLumiverseStore, useUpdates } from '../store/LumiverseContext';
import { UpdateDot } from './UpdateBanner';
import UpdateBanner from './UpdateBanner';

// Get store for direct access
const store = useLumiverseStore;

// Stable fallback constants for useSyncExternalStore
const DEFAULT_DRAWER_SETTINGS = { side: 'right', verticalPosition: 15, tabSize: 'large' };

// Stable selector functions
const selectDrawerSettings = () => store.getState().drawerSettings ?? DEFAULT_DRAWER_SETTINGS;

// Panel dimensions
const DESKTOP_PANEL_WIDTH = 376; // 56px tabs + 320px content
const DRAWER_TAB_WIDTH = 48; // Width of the flush-mounted tab (desktop)
const DRAWER_TAB_WIDTH_COMPACT = 32; // Width of the compact tab
const MOBILE_DRAWER_TAB_WIDTH = 40; // Width of the flush-mounted tab (mobile)
const MOBILE_DRAWER_TAB_WIDTH_COMPACT = 32; // Width of the compact tab (mobile)
const MOBILE_BREAKPOINT = 600;

/**
 * Custom hook to detect mobile viewport
 */
function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
    );

    useEffect(() => {
        const handleResize = () => {
            const newIsMobile = window.innerWidth <= breakpoint;
            // Only update state if value actually changed
            setIsMobile(prev => prev !== newIsMobile ? newIsMobile : prev);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [breakpoint]);

    return isMobile;
}

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
 * Collapse/expand toggle button
 * Arrow direction changes based on panel side and collapsed state
 */
function CollapseButton({ isCollapsed, onClick, side = 'right' }) {
    const isLeft = side === 'left';
    // When on right: collapsed arrow points left (to expand), expanded points right (to collapse)
    // When on left: collapsed arrow points right (to expand), expanded points left (to collapse)
    const showLeftArrow = isLeft ? !isCollapsed : isCollapsed;
    const Icon = showLeftArrow ? ChevronLeft : ChevronRight;
    
    return (
        <button
            className="lumiverse-vp-collapse-btn"
            onClick={onClick}
            title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
            type="button"
        >
            <span className="lumiverse-vp-collapse-icon">
                <Icon size={18} strokeWidth={2} />
            </span>
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
 * Tab configuration for the viewport panel
 */
const PANEL_TABS = [
    {
        id: 'profile',
        Icon: User,
        label: 'Profile',
        title: 'Character Lumia Profile',
    },
    {
        id: 'presets',
        Icon: Bookmark,
        label: 'Presets',
        title: 'Lumia Presets',
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
    drawerSettings: drawerSettingsProp,
    // Tab content components passed as props
    ProfileContent,
    PresetsContent,
    BrowserContent,
    OOCContent,
    PromptContent,
    CouncilContent,
    SummaryContent,
}) {
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const isMobile = useIsMobile();
    const { hasAnyUpdate } = useUpdates();

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
    const isLeft = side === 'left';

    // Panel dimensions based on viewport
    // On mobile, we use CSS calc() for fluid sizing; on desktop, fixed pixel values
    const panelWidth = isMobile ? window.innerWidth : DESKTOP_PANEL_WIDTH;

    // Tab width (the drawer handle)
    const isCompact = tabSize === 'compact';
    const tabWidth = isMobile 
        ? (isCompact ? MOBILE_DRAWER_TAB_WIDTH_COMPACT : MOBILE_DRAWER_TAB_WIDTH)
        : (isCompact ? DRAWER_TAB_WIDTH_COMPACT : DRAWER_TAB_WIDTH);

    // Desktop: fixed width for main content. Mobile: CSS flex handles it
    const mainContentWidth = 320;

    // Wrapper width: on mobile use calc(100vw + tab), on desktop use fixed pixels
    const wrapperWidth = isMobile 
        ? `calc(100vw + ${tabWidth}px)`
        : (DESKTOP_PANEL_WIDTH + tabWidth);
    
    // Collapse only applies to desktop (mobile has no collapse button)
    // Right side: positive translateX to slide content off-screen right
    // Left side: negative translateX to slide content off-screen left
    const collapseOffset = isMobile ? 0 : (isLeft ? -mainContentWidth : mainContentWidth);

    const handleTabClick = useCallback((tabId) => {
        if (isCollapsed) {
            setIsCollapsed(false);
        }
        setActiveTab(tabId);
    }, [isCollapsed]);

    const toggleCollapse = useCallback(() => {
        setIsCollapsed(prev => !prev);
    }, []);

    const activeTabConfig = PANEL_TABS.find(tab => tab.id === activeTab);

    // Memoize tab content components to prevent unnecessary re-renders
    // Pass handleTabClick to ProfileContent so it can navigate to other tabs (e.g., Council)
    const tabPanels = useMemo(() => ({
        profile: ProfileContent ? <ProfileContent onTabChange={handleTabClick} /> : <PlaceholderContent tab="profile" />,
        presets: PresetsContent ? <PresetsContent /> : <PlaceholderContent tab="presets" />,
        browser: BrowserContent ? <BrowserContent /> : <PlaceholderContent tab="browser" />,
        ooc: OOCContent ? <OOCContent /> : <PlaceholderContent tab="ooc" />,
        prompt: PromptContent ? <PromptContent /> : <PlaceholderContent tab="prompt" />,
        council: CouncilContent ? <CouncilContent /> : <PlaceholderContent tab="council" />,
        summary: SummaryContent ? <SummaryContent /> : <PlaceholderContent tab="summary" />,
    }), [ProfileContent, PresetsContent, BrowserContent, OOCContent, PromptContent, CouncilContent, SummaryContent, handleTabClick]);

    // Calculate wrapper positioning based on side
    const getWrapperStyle = () => {
        const baseStyle = {
            position: 'fixed',
            top: 0,
            bottom: 0,
            width: wrapperWidth,
            zIndex: 9998,
            transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
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
                {/* Main panel container - slides when collapsed */}
            <div
                className={clsx(
                    'lumiverse-viewport-panel',
                    isCollapsed && 'lumiverse-viewport-panel--collapsed',
                    isLeft && 'lumiverse-viewport-panel--left'
                )}
                style={{
                    transform: isCollapsed ? `translateX(${collapseOffset}px)` : 'translateX(0)',
                    transition: 'transform 0.2s ease',
                    // Explicit pointer-events for Android WebView compatibility
                    // Some Android browsers don't properly inherit through nested pointer-events containers
                    pointerEvents: 'auto',
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
                <div className="lumiverse-vp-tabs">
                    {PANEL_TABS.map(tab => (
                        <TabButton
                            key={tab.id}
                            id={tab.id}
                            Icon={tab.Icon}
                            label={tab.label}
                            isActive={activeTab === tab.id}
                            onClick={handleTabClick}
                        />
                    ))}
                    <div className="lumiverse-vp-tabs-spacer" />
                    {!isMobile && (
                        <CollapseButton
                            isCollapsed={isCollapsed}
                            onClick={toggleCollapse}
                            side={side}
                        />
                    )}
                </div>

                {/* Main panel content */}
                <div
                    className="lumiverse-vp-main"
                    style={{
                        // On desktop, use fixed width. On mobile, flex handles it via CSS
                        width: isMobile ? undefined : mainContentWidth,
                        opacity: isCollapsed ? 0 : 1,
                        transition: 'opacity 0.2s ease',
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
                        {PANEL_TABS.map(tab => (
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
