import React, { useState, useMemo, useCallback, useSyncExternalStore } from 'react';
import { useLumiverseActions, saveToExtension, useLumiverseStore } from '../../store/LumiverseContext';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';
import { CollapsibleContent } from '../Collapsible';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { Sparkles, Wrench, Layers, Trash2, Users, Bookmark, Plus, ChevronDown, Check, X, Settings2 } from 'lucide-react';

// Get the store for direct access
const store = useLumiverseStore;

// Stable selector functions for QuickActionsSection
const EMPTY_OBJECT = {};
const selectPresets = () => store.getState().presets || EMPTY_OBJECT;
const selectActivePresetName = () => store.getState().activePresetName;

/* global toastr */

/**
 * SVG Icons for mode toggles
 */
export const ModeIcons = {
    chimera: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
        </svg>
    ),
    council: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
    ),
};

/**
 * SVG Icons - matching the old HTML design exactly
 */
export const Icons = {
    book: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
    ),
    settings: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
    ),
    layers: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
        </svg>
    ),
    tools: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
    ),
    terminal: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
    ),
    upload: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
    ),
    box: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
    ),
    plus: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    ),
    dots: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="19" cy="12" r="1"></circle>
            <circle cx="5" cy="12" r="1"></circle>
        </svg>
    ),
    lines: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="21" y1="10" x2="3" y2="10"></line>
            <line x1="21" y1="6" x2="3" y2="6"></line>
            <line x1="21" y1="14" x2="3" y2="14"></line>
            <line x1="21" y1="18" x2="3" y2="18"></line>
        </svg>
    ),
    edit: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
    ),
    chevronDown: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
    ),
    package: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
    ),
    download: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
    ),
};

/**
 * Individual Lumia item in the pack list with adaptive image positioning
 */
export function LumiaPackItem({ item, packName, onEdit, onDelete, editIcon }) {
    const avatarUrl = item.avatarUrl || item.lumia_img;
    const displayName = item.lumiaName || item.lumiaDefName;
    const { objectPosition } = useAdaptiveImagePosition(avatarUrl);

    return (
        <div className="lumia-pack-lumia-item">
            {avatarUrl && (
                <img
                    src={avatarUrl}
                    alt=""
                    className="lumia-pack-lumia-avatar"
                    style={{ objectPosition }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                />
            )}
            <span className="lumia-pack-lumia-name">
                {displayName}
            </span>
            <button
                className="lumia-btn lumia-btn-icon lumia-btn-icon-sm"
                onClick={() => onEdit(packName, item)}
                title="Edit Lumia"
                type="button"
            >
                {editIcon}
            </button>
            <button
                className="lumia-btn lumia-btn-icon lumia-btn-icon-sm lumia-btn-icon-danger"
                onClick={() => onDelete(packName, item, displayName)}
                title="Delete Lumia"
                type="button"
            >
                <Trash2 size={12} strokeWidth={1.5} />
            </button>
        </div>
    );
}

/**
 * Single Loom item row for custom packs - inline display with category icon
 */
export function LoomPackItem({ item, packName, onEdit, onDelete, editIcon }) {
    const itemName = item.loomName || item.itemName || item.name || 'Unknown';
    const category = item.loomCategory || item.category || 'Narrative Style';

    const getCategoryIcon = () => {
        if (category === 'Narrative Style' || category === 'loomStyles') {
            return <Sparkles size={14} strokeWidth={1.5} />;
        } else if (category === 'Loom Utilities' || category === 'loomUtils') {
            return <Wrench size={14} strokeWidth={1.5} />;
        } else if (category === 'Retrofits' || category === 'loomRetrofits') {
            return <Layers size={14} strokeWidth={1.5} />;
        }
        return <Sparkles size={14} strokeWidth={1.5} />;
    };

    return (
        <div className="lumia-pack-loom-item">
            <span className="lumia-pack-loom-icon">
                {getCategoryIcon()}
            </span>
            <span className="lumia-pack-loom-name">
                {itemName}
            </span>
            <button
                className="lumia-btn lumia-btn-icon lumia-btn-icon-sm"
                onClick={() => onEdit(packName, item)}
                title="Edit Loom item"
                type="button"
            >
                {editIcon}
            </button>
            <button
                className="lumia-btn lumia-btn-icon lumia-btn-icon-sm lumia-btn-icon-danger"
                onClick={() => onDelete(packName, item, itemName)}
                title="Delete Loom item"
                type="button"
            >
                <Trash2 size={12} strokeWidth={1.5} />
            </button>
        </div>
    );
}

/**
 * Helper to get all Loom items from a pack as a flat array
 * Supports multiple schema formats
 */
export function getLoomItemsFromPack(pack) {
    const items = [];

    if (pack.loomItems && Array.isArray(pack.loomItems)) {
        items.push(...pack.loomItems);
    }

    if (pack.loomStyles && Array.isArray(pack.loomStyles)) {
        pack.loomStyles.forEach(item => items.push({ ...item, loomCategory: 'Narrative Style' }));
    }
    if (pack.loomUtils && Array.isArray(pack.loomUtils)) {
        pack.loomUtils.forEach(item => items.push({ ...item, loomCategory: 'Loom Utilities' }));
    }
    if (pack.loomRetrofits && Array.isArray(pack.loomRetrofits)) {
        pack.loomRetrofits.forEach(item => items.push({ ...item, loomCategory: 'Retrofits' }));
    }

    if (pack.items && Array.isArray(pack.items)) {
        pack.items.forEach(item => {
            if (item.loomCategory || item.category) {
                items.push(item);
            }
        });
    }

    return items;
}

/**
 * Panel component - panel with header, optional action button, and optional collapsibility
 */
export function Panel({ title, icon, action, collapsible, collapsed, onToggle, children }) {
    const isControlled = collapsed !== undefined;
    const [internalCollapsed, setInternalCollapsed] = useState(false);
    const isCollapsed = isControlled ? collapsed : internalCollapsed;

    const handleToggle = useCallback(() => {
        if (isControlled && onToggle) {
            onToggle();
        } else {
            setInternalCollapsed(prev => !prev);
        }
    }, [isControlled, onToggle]);

    return (
        <div className={clsx('lumia-panel', collapsible && isCollapsed && 'lumia-panel--collapsed')}>
            <div
                className={clsx('lumia-panel-header', collapsible && 'lumia-panel-header-clickable')}
                onClick={collapsible ? handleToggle : undefined}
            >
                <span className="lumia-panel-icon">{icon}</span>
                <span className="lumia-panel-title">{title}</span>
                {action && (
                    <span className="lumia-panel-action" onClick={(e) => e.stopPropagation()}>
                        {action}
                    </span>
                )}
                {collapsible && (
                    <span className={clsx('lumia-panel-chevron', !isCollapsed && 'lumia-panel-chevron--expanded')}>
                        {Icons.chevronDown}
                    </span>
                )}
            </div>
            {collapsible ? (
                <CollapsibleContent isOpen={!isCollapsed} className="lumia-panel-content" duration={200}>
                    {children}
                </CollapsibleContent>
            ) : (
                <div className="lumia-panel-content">
                    {children}
                </div>
            )}
        </div>
    );
}

/**
 * Collapsible Panel - for macro reference (using details/summary like old design)
 */
export function CollapsiblePanel({ title, icon, children }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <details
            className="lumia-panel lumia-panel-collapsible"
            open={isOpen}
            onToggle={(e) => setIsOpen(e.target.open)}
        >
            <summary className="lumia-panel-header lumia-panel-header-clickable">
                <span className="lumia-panel-icon">{icon}</span>
                <span className="lumia-panel-title">{title}</span>
                <span className="lumia-panel-chevron">
                    {Icons.chevronDown}
                </span>
            </summary>
            <div className="lumia-panel-content lumia-macro-reference">
                {children}
            </div>
        </details>
    );
}

/**
 * Selection button that shows current selections and opens a modal
 */
export function SelectionButton({ label, hint, selections, dominant, modalName }) {
    const actions = useLumiverseActions();
    const count = selections?.length || 0;

    const displayText = useMemo(() => {
        if (count === 0) return `No ${label.toLowerCase()} selected`;

        const dominantId = dominant?.id;
        const dominantName = dominant?.name || dominant?.itemName || dominant?.lumiaDefName;

        const names = selections.map(item => {
            const name = item?.name || item?.itemName || item?.lumiaDefName || 'Unknown';
            const itemId = item?.id;

            const isDominant = dominant && (
                (dominantId && itemId && dominantId === itemId) ||
                (dominantName && name && dominantName === name)
            );

            return isDominant ? `★ ${name}` : name;
        });

        return names.join(', ');
    }, [count, selections, label, dominant]);

    return (
        <div className="lumia-selector">
            <div className="lumia-selector-header">
                <span className="lumia-selector-label">{label}</span>
                <span className="lumia-selector-hint">{hint}</span>
            </div>
            <div className="lumia-selector-row">
                <div className="lumia-selector-value">
                    {displayText}
                </div>
                <button
                    className="lumia-btn lumia-btn-sm"
                    onClick={() => actions.openModal(modalName)}
                    type="button"
                >
                    Select
                </button>
            </div>
        </div>
    );
}

/**
 * Tool button component - matching old design exactly
 */
export function ToolButton({ icon, label, onClick, accent = false }) {
    return (
        <button
            className={clsx('lumia-tool-btn', accent && 'lumia-tool-btn-accent')}
            onClick={onClick}
            type="button"
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

/**
 * Mode Toggle component - for Chimera and Council modes
 */
export function ModeToggle({ icon, label, description, checked, onChange, disabled }) {
    return (
        <label className={clsx('lumiverse-mode-toggle', disabled && 'lumiverse-mode-toggle--disabled')}>
            <span className="lumiverse-mode-toggle-icon">{icon}</span>
            <div className="lumiverse-mode-toggle-text">
                <span className="lumiverse-mode-toggle-label">{label}</span>
                <span className="lumiverse-mode-toggle-description">{description}</span>
            </div>
            <div className={clsx('lumiverse-toggle lumiverse-toggle--sm', checked && 'lumiverse-toggle--on')}>
                <input
                    type="checkbox"
                    className="lumiverse-toggle-input"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                />
                <span className="lumiverse-toggle-slider"></span>
            </div>
        </label>
    );
}

/**
 * Macro reference item
 */
export function MacroItem({ code, description }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, [code]);

    return (
        <div
            className={clsx('lumia-macro', copied && 'lumia-macro--copied')}
            onClick={handleCopy}
            title="Click to copy"
        >
            <code>{code}</code>
            <span>{copied ? 'Copied!' : description}</span>
        </div>
    );
}

/**
 * Quick Actions Section - combines Council Config and Preset Management
 */
export function QuickActionsSection({ councilMode, councilMembers, onOpenCouncil, actions }) {
    const [isCreating, setIsCreating] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [showPresetDropdown, setShowPresetDropdown] = useState(false);

    const presets = useSyncExternalStore(
        store.subscribe,
        selectPresets,
        selectPresets
    );
    const activePresetName = useSyncExternalStore(
        store.subscribe,
        selectActivePresetName,
        selectActivePresetName
    );

    const presetList = useMemo(() => {
        return Object.values(presets).sort((a, b) => {
            const timeA = a.updatedAt || a.createdAt || 0;
            const timeB = b.updatedAt || b.createdAt || 0;
            return timeB - timeA;
        });
    }, [presets]);

    const handleSavePreset = useCallback(() => {
        const trimmedName = newPresetName.trim();
        if (!trimmedName) return;
        if (presets[trimmedName]) {
            if (typeof toastr !== 'undefined') {
                toastr.warning(`Preset "${trimmedName}" already exists`);
            }
            return;
        }
        actions.savePreset(trimmedName);
        saveToExtension();
        setNewPresetName('');
        setIsCreating(false);
        if (typeof toastr !== 'undefined') {
            toastr.success(`Preset "${trimmedName}" saved`);
        }
    }, [newPresetName, presets, actions]);

    const handleLoadPreset = useCallback((presetName) => {
        actions.loadPreset(presetName);
        saveToExtension();
        setShowPresetDropdown(false);
        if (typeof toastr !== 'undefined') {
            toastr.info(`Loaded preset "${presetName}"`);
        }
    }, [actions]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSavePreset();
        if (e.key === 'Escape') {
            setIsCreating(false);
            setNewPresetName('');
        }
    };

    return (
        <div className="lumia-quick-actions">
            {/* Council Config Button */}
            <button
                className={clsx(
                    'lumia-quick-action-btn',
                    'lumia-quick-action-btn--council',
                    !councilMode && 'lumia-quick-action-btn--disabled'
                )}
                onClick={councilMode ? onOpenCouncil : undefined}
                disabled={!councilMode}
                type="button"
                title={councilMode ? 'Configure council members' : 'Enable Council Mode first'}
            >
                <Users size={14} strokeWidth={1.5} />
                <span className="lumia-quick-action-text">
                    {councilMode
                        ? (councilMembers.length > 0
                            ? `${councilMembers.length} member${councilMembers.length !== 1 ? 's' : ''}`
                            : 'Configure')
                        : 'Council'}
                </span>
            </button>

            {/* Preset Management */}
            <div className="lumia-quick-action-group">
                {!isCreating ? (
                    <>
                        <button
                            className="lumia-quick-action-btn lumia-quick-action-btn--primary"
                            onClick={() => setIsCreating(true)}
                            title="Save current configuration as preset"
                            type="button"
                        >
                            <Plus size={14} strokeWidth={2} />
                        </button>

                        <div className="lumia-quick-action-dropdown-wrapper">
                            <button
                                className={clsx(
                                    'lumia-quick-action-btn',
                                    activePresetName && 'lumia-quick-action-btn--active'
                                )}
                                onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                                title={activePresetName ? `Active: ${activePresetName}` : 'Load preset'}
                                type="button"
                            >
                                <Bookmark size={14} strokeWidth={1.5} />
                                <span className="lumia-quick-action-text">
                                    {activePresetName || 'Presets'}
                                </span>
                                <ChevronDown
                                    size={12}
                                    strokeWidth={2}
                                    className={clsx('lumia-quick-action-chevron', showPresetDropdown && 'lumia-quick-action-chevron--open')}
                                />
                            </button>

                            <AnimatePresence>
                                {showPresetDropdown && (
                                    <motion.div
                                        className="lumia-quick-action-dropdown"
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        {presetList.length === 0 ? (
                                            <div className="lumia-quick-action-dropdown-empty">
                                                No presets saved
                                            </div>
                                        ) : (
                                            presetList.map((preset) => (
                                                <button
                                                    key={preset.name}
                                                    className={clsx(
                                                        'lumia-quick-action-dropdown-item',
                                                        activePresetName === preset.name && 'lumia-quick-action-dropdown-item--active'
                                                    )}
                                                    onClick={() => handleLoadPreset(preset.name)}
                                                    type="button"
                                                >
                                                    <span>{preset.name}</span>
                                                    {activePresetName === preset.name && (
                                                        <Check size={12} strokeWidth={2} />
                                                    )}
                                                </button>
                                            ))
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <button
                            className="lumia-quick-action-btn"
                            onClick={() => actions.openModal('presetManage')}
                            title="Manage presets"
                            type="button"
                        >
                            <Settings2 size={14} strokeWidth={1.5} />
                        </button>
                    </>
                ) : (
                    <div className="lumia-quick-action-form">
                        <input
                            type="text"
                            className="lumia-quick-action-input"
                            placeholder="Preset name..."
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                        <button
                            className="lumia-quick-action-btn lumia-quick-action-btn--primary"
                            onClick={handleSavePreset}
                            disabled={!newPresetName.trim()}
                            type="button"
                            title="Save preset"
                        >
                            <Check size={14} strokeWidth={2} />
                        </button>
                        <button
                            className="lumia-quick-action-btn"
                            onClick={() => {
                                setIsCreating(false);
                                setNewPresetName('');
                            }}
                            type="button"
                            title="Cancel"
                        >
                            <X size={14} strokeWidth={2} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
