import React from 'react';
import clsx from 'clsx';
import {
    Monitor, Palette, Package, Bookmark, Layers,
    Sliders as SlidersIcon, MessageSquare, FileText, Terminal, AlertTriangle, X,
    Settings2, Sparkles,
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

export { NAV_GROUPS };

export default function SettingsNav({ activeView, onNavigate, onClose }) {
    return (
        <nav className="lumiverse-settings-nav">
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
        </nav>
    );
}
