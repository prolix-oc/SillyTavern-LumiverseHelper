import React, { useState, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { User, Package, MessageSquare, Sliders, FileText, ChevronRight, X, Sparkles, Bookmark, Users } from 'lucide-react';
import { useLumiverseStore } from '../store/LumiverseContext';

// Get store for direct access
const store = useLumiverseStore;

// Panel dimensions
const DESKTOP_PANEL_WIDTH = 376; // 56px tabs + 320px content
const TAB_BAR_WIDTH = 56;
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
            setIsMobile(window.innerWidth <= breakpoint);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [breakpoint]);

    return isMobile;
}

/**
 * Toggle button - now part of the sliding container
 */
function ToggleButton({ isVisible, onClick }) {
    return (
        <button
            className={clsx(
                'lumiverse-panel-toggle',
                isVisible && 'lumiverse-panel-toggle--active'
            )}
            onClick={onClick}
            title={isVisible ? 'Hide Lumiverse Panel' : 'Show Lumiverse Panel'}
            type="button"
        >
            <span className="lumiverse-panel-toggle-icon">
                <Sparkles size={18} strokeWidth={2} />
            </span>
            <span className="lumiverse-panel-toggle-label">Lumia</span>
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
 */
function CollapseButton({ isCollapsed, onClick }) {
    return (
        <button
            className="lumiverse-vp-collapse-btn"
            onClick={onClick}
            title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
            type="button"
        >
            <span
                className={clsx(
                    'lumiverse-vp-collapse-icon',
                    isCollapsed && 'lumiverse-vp-collapse-icon--rotated'
                )}
            >
                <ChevronRight size={18} strokeWidth={2} />
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
 */
function ViewportPanel({
    isVisible,
    onToggle,
    onClose,
    defaultTab = 'profile',
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

    // Subscribe to button position settings
    const buttonPosition = useSyncExternalStore(
        store.subscribe,
        () => store.getState().lumiaButtonPosition ?? { useDefault: true, xPercent: 1, yPercent: 1 },
        () => store.getState().lumiaButtonPosition ?? { useDefault: true, xPercent: 1, yPercent: 1 }
    );

    // Determine if using custom position (disables slide-out animation)
    const useCustomPosition = !buttonPosition.useDefault;

    // Calculate panel width based on viewport
    const panelWidth = isMobile ? window.innerWidth : DESKTOP_PANEL_WIDTH;
    const mainContentWidth = isMobile ? window.innerWidth - 56 : 320;

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

    // Calculate custom button position styles
    const getButtonPositionStyle = () => {
        if (useCustomPosition) {
            // Custom position: use CSS variables for positioning (allows !important override in CSS)
            return {
                '--lumia-btn-top': `${buttonPosition.yPercent}%`,
                '--lumia-btn-right': `${buttonPosition.xPercent}%`,
                zIndex: 9999,
                pointerEvents: 'auto',
                // No transition - static position
                display: isMobile && isVisible ? 'none' : 'block',
            };
        }

        // Default position: animates with panel
        return {
            position: 'fixed',
            top: 12,
            right: isVisible
                ? (isCollapsed ? TAB_BAR_WIDTH + 12 : panelWidth + 12)
                : 12,
            zIndex: 9999,
            pointerEvents: 'auto',
            transition: 'right 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            display: isMobile && isVisible ? 'none' : 'block',
        };
    };

    // Use transform for smooth GPU-accelerated animation
    return (
        <>
            {/* Toggle button - animates alongside panel when default position, static when custom */}
            {/* Hide toggle when panel is visible on mobile - use close button instead */}
            <div
                className={clsx(
                    'lumiverse-toggle-container',
                    useCustomPosition && 'lumiverse-toggle-container--custom'
                )}
                style={getButtonPositionStyle()}
            >
                <ToggleButton isVisible={isVisible} onClick={onToggle} />
            </div>

            {/* Panel wrapper - slides via transform */}
            <div
                className="lumiverse-viewport-wrapper"
                style={{
                    position: 'fixed',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: panelWidth,
                    zIndex: 9998,
                    transform: `translateX(${isVisible ? 0 : panelWidth}px)`,
                    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    pointerEvents: 'none',
                }}
            >
                {/* Main panel - slides together when collapsed */}
            <div
                className={clsx(
                    'lumiverse-viewport-panel',
                    isCollapsed && 'lumiverse-viewport-panel--collapsed'
                )}
                style={{
                    transform: isCollapsed ? `translateX(${mainContentWidth}px)` : 'translateX(0)',
                    transition: 'transform 0.2s ease',
                }}
            >
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
                    <CollapseButton
                        isCollapsed={isCollapsed}
                        onClick={toggleCollapse}
                    />
                </div>

                {/* Main panel content */}
                <div
                    className="lumiverse-vp-main"
                    style={{
                        width: mainContentWidth,
                        opacity: isCollapsed ? 0 : 1,
                        transition: 'opacity 0.2s ease',
                    }}
                >
                    <PanelHeader
                        title={activeTabConfig?.title || 'Panel'}
                        Icon={activeTabConfig?.Icon || User}
                        onClose={onClose}
                    />
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
