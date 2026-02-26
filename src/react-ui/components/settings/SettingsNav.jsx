import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import {
    Monitor, Palette, Package, Bookmark, Layers,
    Sliders as SlidersIcon, MessageSquare, FileText, Terminal, AlertTriangle, X,
    Settings2, Sparkles, ChevronDown, Zap,
} from 'lucide-react';

/**
 * Navigation structure for the settings modal sidebar
 */
const NAV_GROUPS = [
    {
        label: 'General',
        items: [
            { id: 'general', label: 'Display', Icon: Monitor },
            { id: 'theme', label: 'Theme', Icon: Palette },
        ],
    },
    {
        label: 'Content',
        items: [
            { id: 'packs', label: 'Packs', Icon: Package },
            { id: 'chatPresets', label: 'Chat Presets', Icon: Bookmark },
            { id: 'presetBindings', label: 'Bindings', Icon: Layers },
        ],
    },
    {
        label: 'Configuration',
        items: [
            { id: 'lumiaConfig', label: 'Lumia', Icon: Sparkles },
            { id: 'loomConfig', label: 'Loom', Icon: Layers },
        ],
    },
    {
        label: 'Tools',
        items: [
            { id: 'ooc', label: 'OOC', Icon: MessageSquare },
            { id: 'summarization', label: 'Summary', Icon: FileText },
            { id: 'promptSettings', label: 'Prompt', Icon: SlidersIcon },
            { id: 'quickReplies', label: 'Quick Replies', Icon: Zap },
        ],
    },
    {
        label: 'Advanced',
        items: [
            { id: 'macros', label: 'Macros', Icon: Terminal },
            { id: 'danger', label: 'Danger Zone', Icon: AlertTriangle },
        ],
    },
];

// Flat lookup for resolving active item info
const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items);

export { NAV_GROUPS };

export default function SettingsNav({ activeView, onNavigate, onClose }) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const selectorRef = useRef(null);

    const activeItem = ALL_ITEMS.find(i => i.id === activeView) || ALL_ITEMS[0];

    const handleMobileNavigate = (id) => {
        onNavigate(id);
        setIsDropdownOpen(false);
    };

    // Close dropdown on outside click
    useEffect(() => {
        if (!isDropdownOpen) return;
        const handler = (e) => {
            if (
                !dropdownRef.current?.contains(e.target) &&
                !selectorRef.current?.contains(e.target)
            ) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('pointerdown', handler);
        return () => document.removeEventListener('pointerdown', handler);
    }, [isDropdownOpen]);

    return (
        <nav className="lumiverse-settings-nav">
            {/* ---- Desktop sidebar (hidden on mobile via CSS) ---- */}
            <div className="lumiverse-settings-nav-header">
                <Settings2 size={16} strokeWidth={1.5} />
                <span>Settings</span>
                <button
                    className="lumiverse-settings-nav-close"
                    onClick={onClose}
                    type="button"
                    aria-label="Close settings"
                >
                    <X size={16} strokeWidth={2} />
                </button>
            </div>
            <div className="lumiverse-settings-nav-items">
                {NAV_GROUPS.map(group => (
                    <div key={group.label} className="lumiverse-settings-nav-group">
                        <div className="lumiverse-settings-nav-group-label">{group.label}</div>
                        {group.items.map(item => (
                            <button
                                key={item.id}
                                className={clsx(
                                    'lumiverse-settings-nav-item',
                                    activeView === item.id && 'lumiverse-settings-nav-item--active'
                                )}
                                onClick={() => onNavigate(item.id)}
                                type="button"
                            >
                                <item.Icon size={15} strokeWidth={1.5} />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                ))}
            </div>

            {/* ---- Mobile dropdown header (hidden on desktop via CSS) ---- */}
            <div className="lumiverse-settings-mobile-header">
                <button
                    ref={selectorRef}
                    className="lumiverse-settings-mobile-selector"
                    onClick={() => setIsDropdownOpen(prev => !prev)}
                    type="button"
                    aria-expanded={isDropdownOpen}
                    aria-haspopup="listbox"
                >
                    <activeItem.Icon size={15} strokeWidth={1.5} />
                    <span className="lumiverse-settings-mobile-selector-label">
                        {activeItem.label}
                    </span>
                    <ChevronDown
                        size={14}
                        strokeWidth={2}
                        className={clsx(
                            'lumiverse-settings-mobile-chevron',
                            isDropdownOpen && 'lumiverse-settings-mobile-chevron--open'
                        )}
                    />
                </button>
                <button
                    className="lumiverse-settings-mobile-close"
                    onClick={onClose}
                    type="button"
                    aria-label="Close settings"
                >
                    <X size={16} strokeWidth={2} />
                </button>
            </div>

            {/* ---- Mobile dropdown panel ---- */}
            {isDropdownOpen && (
                <div ref={dropdownRef} className="lumiverse-settings-mobile-dropdown" role="listbox">
                    {NAV_GROUPS.map(group => (
                        <div key={group.label} className="lumiverse-settings-mobile-group">
                            <div className="lumiverse-settings-mobile-group-label">{group.label}</div>
                            {group.items.map(item => (
                                <button
                                    key={item.id}
                                    role="option"
                                    aria-selected={activeView === item.id}
                                    className={clsx(
                                        'lumiverse-settings-mobile-item',
                                        activeView === item.id && 'lumiverse-settings-mobile-item--active'
                                    )}
                                    onClick={() => handleMobileNavigate(item.id)}
                                    type="button"
                                >
                                    <item.Icon size={14} strokeWidth={1.5} />
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </nav>
    );
}
