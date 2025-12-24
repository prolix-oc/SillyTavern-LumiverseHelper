import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { User, Package, MessageSquare, Sliders, FileText, ChevronRight, X, Sparkles } from 'lucide-react';

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
/**
 * Animation variants for tab content transitions
 * Uses orchestration to coordinate parent/child animations
 */
const tabContentVariants = {
    initial: {
        opacity: 0,
        y: 8,
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.15,
            ease: [0.4, 0, 0.2, 1],
            when: 'beforeChildren',
            staggerChildren: 0.02,
        },
    },
    exit: {
        opacity: 0,
        y: -8,
        transition: {
            duration: 0.1,
            ease: [0.4, 0, 1, 1],
        },
    },
};

const PANEL_TABS = [
    {
        id: 'profile',
        Icon: User,
        label: 'Profile',
        title: 'Character Lumia Profile',
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
    BrowserContent,
    OOCContent,
    PromptContent,
    SummaryContent,
}) {
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const isMobile = useIsMobile();

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

    // Render the appropriate content based on active tab
    const renderContent = () => {
        switch (activeTab) {
            case 'profile':
                return ProfileContent ? <ProfileContent /> : <PlaceholderContent tab="profile" />;
            case 'browser':
                return BrowserContent ? <BrowserContent /> : <PlaceholderContent tab="browser" />;
            case 'ooc':
                return OOCContent ? <OOCContent /> : <PlaceholderContent tab="ooc" />;
            case 'prompt':
                return PromptContent ? <PromptContent /> : <PlaceholderContent tab="prompt" />;
            case 'summary':
                return SummaryContent ? <SummaryContent /> : <PlaceholderContent tab="summary" />;
            default:
                return null;
        }
    };

    // Use transform for smooth GPU-accelerated animation
    return (
        <>
            {/* Toggle button - animates alongside the panel */}
            {/* Hide toggle when panel is visible on mobile - use close button instead */}
            <div
                className="lumiverse-toggle-container"
                style={{
                    position: 'fixed',
                    top: 12,
                    right: isVisible
                        ? (isCollapsed ? TAB_BAR_WIDTH + 12 : panelWidth + 12)
                        : 12,
                    zIndex: 9999,
                    pointerEvents: 'auto',
                    transition: 'right 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: isMobile && isVisible ? 'none' : 'block',
                }}
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
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={activeTab}
                                className="lumiverse-vp-tab-content"
                                variants={tabContentVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                            >
                                {renderContent()}
                            </motion.div>
                        </AnimatePresence>
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
