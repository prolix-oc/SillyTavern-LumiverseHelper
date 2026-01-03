import React, { useState, useMemo, useCallback, useSyncExternalStore } from 'react';
import { useSettings, useSelections, useLoomSelections, useLumiverseActions, usePacks, saveToExtension, useLumiverseStore } from '../store/LumiverseContext';
import { useAdaptiveImagePosition } from '../hooks/useAdaptiveImagePosition';
import { exportPack } from './modals/PackEditorModal';
import { CollapsibleContent } from './Collapsible';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { Eye, Sparkles, Wrench, Layers, Trash2, Users, Bookmark, Plus, ChevronDown, Check, X, AlertTriangle } from 'lucide-react';

/* global LumiverseBridge, toastr */

// Get the store for direct access
const store = useLumiverseStore;

// Stable fallback constants for useSyncExternalStore
// CRITICAL: These must be defined outside components to prevent infinite loops
// Using inline `|| []` or `|| {}` creates new references each render
const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};
const DEFAULT_BUTTON_POSITION = { useDefault: true, xPercent: 1, yPercent: 1 };

// Stable selector functions for useSyncExternalStore
const selectPresets = () => store.getState().presets || EMPTY_OBJECT;
const selectActivePresetName = () => store.getState().activePresetName;
const selectChimeraMode = () => store.getState().chimeraMode || false;
const selectCouncilMode = () => store.getState().councilMode || false;
const selectCouncilMembers = () => store.getState().councilMembers || EMPTY_ARRAY;
const selectSelectedDefinitions = () => store.getState().selectedDefinitions || EMPTY_ARRAY;
const selectShowDrawer = () => store.getState().showLumiverseDrawer ?? true;
const selectButtonPosition = () => store.getState().lumiaButtonPosition ?? DEFAULT_BUTTON_POSITION;

/**
 * SVG Icons for mode toggles
 */
const ModeIcons = {
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
const Icons = {
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
function LumiaPackItem({ item, packName, onEdit, editIcon }) {
    // Support both new schema (avatarUrl, lumiaName) and legacy (lumia_img, lumiaDefName)
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
        </div>
    );
}

/**
 * Panel component - panel with header, optional action button, and optional collapsibility
 */
function Panel({ title, icon, action, collapsible, collapsed, onToggle, children }) {
    // If collapsible, handle internal state if not controlled externally
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
function CollapsiblePanel({ title, icon, children }) {
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
 * Displays all selections as a comma-separated list with ★ prefix for dominant
 */
function SelectionButton({ label, hint, selections, dominant, modalName }) {
    const actions = useLumiverseActions();
    const count = selections?.length || 0;

    // Build display text as comma-separated list with star for dominant
    const displayText = useMemo(() => {
        if (count === 0) return `No ${label.toLowerCase()} selected`;

        // Get dominant item ID for comparison - check multiple possible ID fields
        const dominantId = dominant?.id;
        const dominantName = dominant?.name || dominant?.itemName || dominant?.lumiaDefName;

        // Build list with star prefix for dominant item
        const names = selections.map(item => {
            const name = item?.name || item?.itemName || item?.lumiaDefName || 'Unknown';
            const itemId = item?.id;

            // Match by ID first, fall back to name matching
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
function ToolButton({ icon, label, onClick, accent = false }) {
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
function ModeToggle({ icon, label, description, checked, onChange, disabled }) {
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
function MacroItem({ code, description }) {
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
 * Provides compact controls for frequently-used actions
 */
function QuickActionsSection({ councilMode, councilMembers, onOpenCouncil, actions }) {
    const [isCreating, setIsCreating] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [showPresetDropdown, setShowPresetDropdown] = useState(false);

    // Subscribe to presets and activePresetName
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
            {/* Council Config Button - always visible, disabled when council mode is off */}
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
                        {/* New Preset Button */}
                        <button
                            className="lumia-quick-action-btn lumia-quick-action-btn--primary"
                            onClick={() => setIsCreating(true)}
                            title="Save current configuration as preset"
                            type="button"
                        >
                            <Plus size={14} strokeWidth={2} />
                        </button>

                        {/* Preset Dropdown */}
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

                            {/* Dropdown Menu */}
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
                    </>
                ) : (
                    /* Create New Preset Form */
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

/**
 * Main Settings Panel component - matching old HTML structure exactly
 */
function SettingsPanel() {
    const settings = useSettings();
    const selections = useSelections();
    const loomSelections = useLoomSelections();
    const actions = useLumiverseActions();
    const { packs, customPacks, allPacks } = usePacks();

    // Track which custom pack is expanded to show Lumia items
    const [expandedPackId, setExpandedPackId] = useState(null);

    // Track collapsed state for pack sections (start expanded)
    const [sectionsCollapsed, setSectionsCollapsed] = useState({
        customPacks: false,
        downloadedPacks: false,
        loomPacks: false,
    });

    const toggleSection = useCallback((section) => {
        setSectionsCollapsed(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    }, []);

    // Subscribe to Chimera and Council mode state
    const chimeraMode = useSyncExternalStore(
        store.subscribe,
        selectChimeraMode,
        selectChimeraMode
    );
    const councilMode = useSyncExternalStore(
        store.subscribe,
        selectCouncilMode,
        selectCouncilMode
    );
    const councilMembers = useSyncExternalStore(
        store.subscribe,
        selectCouncilMembers,
        selectCouncilMembers
    );
    const selectedDefinitions = useSyncExternalStore(
        store.subscribe,
        selectSelectedDefinitions,
        selectSelectedDefinitions
    );

    // Check if council mode is active with members
    const isCouncilActive = councilMode && councilMembers.length > 0;

    // Handle mode toggles
    const handleChimeraModeChange = useCallback((enabled) => {
        actions.setChimeraMode(enabled);
        saveToExtension();
    }, [actions]);

    const handleCouncilModeChange = useCallback((enabled) => {
        actions.setCouncilMode(enabled);
        saveToExtension();
    }, [actions]);

    // Handle Clear All selections
    const handleClearAll = useCallback(() => {
        actions.clearSelections();
        saveToExtension();
        if (typeof toastr !== 'undefined') {
            toastr.info('All Lumia selections cleared');
        }
    }, [actions]);

    // Handle pack deletion
    const handleDeletePack = useCallback((packName) => {
        if (!confirm(`Are you sure you want to delete "${packName}"?`)) {
            return;
        }
        actions.removePack(packName);
        saveToExtension();
        if (typeof toastr !== 'undefined') {
            toastr.success(`Pack "${packName}" deleted`);
        }
    }, [actions]);

    // Toggle pack expansion
    const togglePackExpansion = useCallback((packId) => {
        setExpandedPackId(prev => prev === packId ? null : packId);
    }, []);

    // Calculate stats
    const totalPacks = allPacks.length;
    const totalItems = useMemo(() => {
        return allPacks.reduce((sum, pack) => {
            // New format: lumiaItems + loomItems
            const lumiaCount = pack.lumiaItems?.length || 0;
            const loomCount = pack.loomItems?.length || 0;
            // Legacy format: items array
            const legacyCount = pack.items?.length || 0;
            // Use new format counts if available, otherwise legacy
            return sum + (lumiaCount + loomCount > 0 ? lumiaCount + loomCount : legacyCount);
        }, 0);
    }, [allPacks]);

    // Memoize loom packs filter to avoid IIFE in render
    const loomPacks = useMemo(() => {
        return packs.filter(pack => {
            // New format: loomItems array
            if (pack.loomItems?.length > 0) return true;
            // Check legacy structure
            if (pack.loomStyles?.length > 0) return true;
            if (pack.loomUtils?.length > 0) return true;
            if (pack.loomRetrofits?.length > 0) return true;
            // Check items array with loomCategory
            if (pack.items?.some(item => item.loomCategory)) return true;
            return false;
        });
    }, [packs]);

    // Call extension callbacks if available
    const callExtensionCallback = useCallback((name, ...args) => {
        if (typeof LumiverseBridge !== 'undefined') {
            const callbacks = LumiverseBridge.getCallbacks();
            if (callbacks && callbacks[name]) {
                callbacks[name](...args);
            }
        }
    }, []);

    // Handle JSON file upload
    const handleFileUpload = useCallback((event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        console.log('[SettingsPanel] File selected for upload:', file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                console.log('[SettingsPanel] JSON parsed successfully, entries:', data.entries ? Object.keys(data.entries).length : 'no entries field');

                // Call the extension's handleNewBook callback
                if (typeof LumiverseBridge !== 'undefined') {
                    const callbacks = LumiverseBridge.getCallbacks();
                    console.log('[SettingsPanel] Available callbacks:', callbacks ? Object.keys(callbacks).filter(k => callbacks[k]) : 'none');

                    if (callbacks && callbacks.handleNewBook) {
                        console.log('[SettingsPanel] Calling handleNewBook...');
                        callbacks.handleNewBook(data, file.name, false);
                        // Refresh the UI after import
                        if (callbacks.refreshUIDisplay) {
                            callbacks.refreshUIDisplay();
                        }
                        console.log('[SettingsPanel] Import complete');
                    } else {
                        console.error('[SettingsPanel] handleNewBook callback not registered');
                        if (typeof toastr !== 'undefined') {
                            toastr.error('Import function not available. Please reload the page.');
                        }
                    }
                } else {
                    console.error('[SettingsPanel] LumiverseBridge not available');
                    if (typeof toastr !== 'undefined') {
                        toastr.error('Bridge not available. Please reload the page.');
                    }
                }
            } catch (error) {
                console.error('[SettingsPanel] Failed to parse JSON:', error);
                if (typeof toastr !== 'undefined') {
                    toastr.error('Failed to parse JSON: ' + error.message);
                }
            }
        };
        reader.onerror = () => {
            console.error('[SettingsPanel] Failed to read file');
            if (typeof toastr !== 'undefined') {
                toastr.error('Failed to read file');
            }
        };
        reader.readAsText(file);

        // Reset the input so the same file can be selected again
        event.target.value = '';
    }, []);

    // Get drawer visibility setting from store
    const showDrawer = useSyncExternalStore(
        store.subscribe,
        selectShowDrawer,
        selectShowDrawer
    );

    // Get button position settings from store
    const buttonPosition = useSyncExternalStore(
        store.subscribe,
        selectButtonPosition,
        selectButtonPosition
    );

    // Handle drawer toggle
    const handleDrawerToggle = useCallback((enabled) => {
        store.setState({ showLumiverseDrawer: enabled });
        saveToExtension();
    }, []);

    // Handle nuclear reset - wipe all settings and reload
    const handleNuclearReset = useCallback(() => {
        const confirmed = window.confirm(
            'WARNING: This will completely reset ALL Lumiverse Helper settings to defaults.\n\n' +
            'This includes:\n' +
            '- All downloaded packs\n' +
            '- All custom packs\n' +
            '- All Lumia and Loom selections\n' +
            '- All presets\n' +
            '- All advanced settings\n\n' +
            'The page will reload after reset.\n\n' +
            'Are you sure you want to continue?'
        );

        if (confirmed) {
            if (typeof LumiverseBridge !== 'undefined' && LumiverseBridge.resetAllSettings) {
                if (typeof toastr !== 'undefined') {
                    toastr.warning('Resetting all settings...');
                }
                LumiverseBridge.resetAllSettings();
            } else {
                console.error('[SettingsPanel] resetAllSettings not available on bridge');
                if (typeof toastr !== 'undefined') {
                    toastr.error('Reset function not available. Please reload the page.');
                }
            }
        }
    }, []);

    // Handle button position toggle
    const handleButtonPositionToggle = useCallback((useDefault) => {
        store.setState({
            lumiaButtonPosition: {
                ...store.getState().lumiaButtonPosition,
                useDefault,
            }
        });
        saveToExtension();
    }, []);

    // Handle X position change
    const handleXPositionChange = useCallback((value) => {
        const xPercent = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
        store.setState({
            lumiaButtonPosition: {
                ...store.getState().lumiaButtonPosition,
                xPercent,
            }
        });
        saveToExtension();
    }, []);

    // Handle Y position change
    const handleYPositionChange = useCallback((value) => {
        const yPercent = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
        store.setState({
            lumiaButtonPosition: {
                ...store.getState().lumiaButtonPosition,
                yPercent,
            }
        });
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

            {/* Button Position Settings - only show when drawer is enabled */}
            {showDrawer && (
                <div className="lumia-button-position-container">
                    <label className="lumiverse-toggle-wrapper">
                        <div className="lumiverse-toggle-text">
                            <span className="lumiverse-toggle-label">Custom Button Position</span>
                            <span className="lumiverse-toggle-description">
                                Position the Lumia button anywhere on screen
                            </span>
                        </div>
                        <div className={clsx('lumiverse-toggle', !buttonPosition.useDefault && 'lumiverse-toggle--on')}>
                            <input
                                type="checkbox"
                                className="lumiverse-toggle-input"
                                checked={!buttonPosition.useDefault}
                                onChange={(e) => handleButtonPositionToggle(!e.target.checked)}
                            />
                            <span className="lumiverse-toggle-slider"></span>
                        </div>
                    </label>

                    {/* Position inputs - only show when custom position is enabled */}
                    {!buttonPosition.useDefault && (
                        <div className="lumia-button-position-inputs">
                            <div className="lumia-position-field">
                                <label htmlFor="lumia-btn-x">X (% from right)</label>
                                <input
                                    type="number"
                                    id="lumia-btn-x"
                                    className="lumia-input lumia-input-sm"
                                    value={buttonPosition.xPercent}
                                    onChange={(e) => handleXPositionChange(e.target.value)}
                                    min="0"
                                    max="100"
                                />
                            </div>
                            <div className="lumia-position-field">
                                <label htmlFor="lumia-btn-y">Y (% from top)</label>
                                <input
                                    type="number"
                                    id="lumia-btn-y"
                                    className="lumia-input lumia-input-sm"
                                    value={buttonPosition.yPercent}
                                    onChange={(e) => handleYPositionChange(e.target.value)}
                                    min="0"
                                    max="100"
                                />
                            </div>
                            <span className="lumia-position-hint">
                                Slide-out animation is disabled with custom positioning
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* World Book Source Section */}
            <Panel title="World Book Source" icon={Icons.book}>
                <div className="lumia-status-badge">
                    {totalPacks > 0
                        ? `${totalPacks} pack${totalPacks !== 1 ? 's' : ''} loaded (${totalItems} items)`
                        : 'No packs loaded'}
                </div>

                <div className="lumia-input-row">
                    <input
                        type="text"
                        className="lumia-input"
                        placeholder="Enter World Book URL (JSON)"
                        id="lumia-url-input-react"
                    />
                    <button
                        className="lumia-btn lumia-btn-primary"
                        onClick={() => callExtensionCallback('fetchWorldBook')}
                        type="button"
                    >
                        Fetch
                    </button>
                </div>

                <div className="lumia-source-actions">
                    <div className="lumia-divider-text">or</div>

                    <button
                        className="lumia-btn lumia-btn-secondary lumia-btn-full"
                        onClick={() => document.getElementById('lumia-file-input-react')?.click()}
                        type="button"
                    >
                        {Icons.upload}
                        Upload JSON File
                    </button>
                    <input
                        type="file"
                        id="lumia-file-input-react"
                        accept=".json"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                    />

                    <div className="lumia-divider-text">or</div>

                    <button
                        className="lumia-btn lumia-btn-primary lumia-btn-full"
                        onClick={() => callExtensionCallback('showLucidCardsModal')}
                        type="button"
                    >
                        {Icons.box}
                        Browse Lucid Cards
                    </button>
                </div>
            </Panel>

            {/* Lumia Configuration Section */}
            <Panel
                title="Lumia Configuration"
                icon={Icons.settings}
                action={
                    <button
                        className="lumia-clear-all-btn"
                        onClick={handleClearAll}
                        title="Clear all Lumia selections"
                        type="button"
                    >
                        <Trash2 size={14} strokeWidth={1.5} />
                        Clear All
                    </button>
                }
            >
                {/* Mode Toggles */}
                <div className="lumia-mode-toggles">
                    <ModeToggle
                        icon={ModeIcons.chimera}
                        label="Chimera Mode"
                        description="Fuse multiple physical definitions"
                        checked={chimeraMode}
                        onChange={handleChimeraModeChange}
                        disabled={councilMode}
                    />
                    <ModeToggle
                        icon={ModeIcons.council}
                        label="Council Mode"
                        description="Multiple independent Lumias"
                        checked={councilMode}
                        onChange={handleCouncilModeChange}
                        disabled={chimeraMode}
                    />
                </div>

                {/* Quick Actions: Council Config + Preset Management */}
                <QuickActionsSection
                    councilMode={councilMode}
                    councilMembers={councilMembers}
                    onOpenCouncil={() => actions.openModal('councilSelect')}
                    actions={actions}
                />

                <div className={clsx('lumia-selector-group', isCouncilActive && 'lumia-selector-group--disabled')}>
                    <SelectionButton
                        label={chimeraMode ? "Chimera Definitions" : "Definition"}
                        hint={chimeraMode ? "Select Multiple" : "Select One"}
                        selections={chimeraMode ? selectedDefinitions : (selections.definition ? [selections.definition] : [])}
                        modalName="definitions"
                    />

                    <SelectionButton
                        label="Behaviors"
                        hint="Select Multiple"
                        selections={selections.behaviors}
                        dominant={selections.dominantBehavior}
                        modalName="behaviors"
                    />

                    <SelectionButton
                        label="Personalities"
                        hint="Select Multiple"
                        selections={selections.personalities}
                        dominant={selections.dominantPersonality}
                        modalName="personalities"
                    />
                </div>
            </Panel>

            {/* Loom Configuration Section */}
            <Panel title="Loom Configuration" icon={Icons.layers}>
                <div className="lumia-selector-group">
                    <SelectionButton
                        label="Narrative Style"
                        hint="Select Multiple"
                        selections={loomSelections.styles}
                        modalName="loomStyles"
                    />

                    <SelectionButton
                        label="Loom Utilities"
                        hint="Select Multiple"
                        selections={loomSelections.utilities}
                        modalName="loomUtilities"
                    />

                    <SelectionButton
                        label="Retrofits"
                        hint="Select Multiple"
                        selections={loomSelections.retrofits}
                        modalName="loomRetrofits"
                    />
                </div>
            </Panel>

            {/* Tools Section */}
            <Panel title="Tools" icon={Icons.tools}>
                <div className="lumia-tools-row">
                    <ToolButton
                        icon={Icons.plus}
                        label="Lumia Editor"
                        onClick={() => actions.openModal('packSelector')}
                        accent
                    />
                    <ToolButton
                        icon={Icons.dots}
                        label="OOC Settings"
                        onClick={() => callExtensionCallback('showMiscFeaturesModal')}
                    />
                    <ToolButton
                        icon={Icons.lines}
                        label="Summarization"
                        onClick={() => callExtensionCallback('showSummarizationModal')}
                    />
                    <ToolButton
                        icon={Icons.edit}
                        label="Prompt Settings"
                        onClick={() => callExtensionCallback('showPromptSettingsModal')}
                    />
                </div>
            </Panel>

            {/* Macro Reference (Collapsible) */}
            <CollapsiblePanel title="Macro Reference" icon={Icons.terminal}>
                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Lumia Content</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{lumiaDef}}" description="Physical Definition" />
                        <MacroItem code="{{lumiaBehavior}}" description="Behavior(s)" />
                        <MacroItem code="{{lumiaPersonality}}" description="Personality(s)" />
                        <MacroItem code="{{lumiaCouncilModeActive}}" description="Yes/No status indicator" />
                    </div>
                </div>

                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Loom Content</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{loomStyle}}" description="Narrative Style" />
                        <MacroItem code="{{loomUtils}}" description="Loom Utilities" />
                        <MacroItem code="{{loomRetrofits}}" description="Retrofits" />
                    </div>
                </div>

                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Random Lumia</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{randomLumia}}" description="Random definition" />
                        <MacroItem code="{{randomLumia.pers}}" description="Random personality" />
                        <MacroItem code="{{randomLumia.behav}}" description="Random behavior" />
                        <MacroItem code="{{randomLumia.name}}" description="Random name" />
                    </div>
                </div>

                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Tracking & OOC</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{lumiaMessageCount}}" description="Message count" />
                        <MacroItem code="{{lumiaOOCTrigger}}" description="OOC trigger/countdown" />
                    </div>
                </div>

                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Summarization</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{loomSummary}}" description="Stored summary" />
                        <MacroItem code="{{loomSummaryPrompt}}" description="Summary directive" />
                        <MacroItem code="/loom-summarize" description="Manual trigger" />
                    </div>
                </div>

                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Sovereign Hand</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{loomSovHand}}" description="Full Sovereign Hand prompt (with user message)" />
                        <MacroItem code="{{loomSovHandActive}}" description="Yes/No status indicator" />
                        <MacroItem code="{{loomLastUserMessage}}" description="Last user message content" />
                        <MacroItem code="{{loomLastCharMessage}}" description="Last character message content" />
                        <MacroItem code="{{lastMessageName}}" description="Name of whoever sent the last message" />
                        <MacroItem code="{{loomContinuePrompt}}" description="Continue-scene prompt when character spoke last" />
                    </div>
                </div>
            </CollapsiblePanel>

            {/* Custom Packs Section (only if custom packs exist) */}
            {customPacks.length > 0 && (
                <Panel
                    title="Custom Packs"
                    icon={Icons.package}
                    collapsible
                    collapsed={sectionsCollapsed.customPacks}
                    onToggle={() => toggleSection('customPacks')}
                >
                    <div className="lumia-custom-packs">
                        {customPacks.map((pack) => {
                            // Use pack.name as fallback if pack.id is undefined
                            const packKey = pack.id || pack.name;
                            const isExpanded = expandedPackId === packKey;
                            // Support both new format (lumiaItems) and legacy format (items)
                            const lumiaItems = pack.lumiaItems?.length > 0
                                ? pack.lumiaItems
                                : (pack.items?.filter(item => item.lumiaDefName) || []);

                            return (
                                <motion.div
                                    key={packKey}
                                    className={clsx('lumia-pack-item-container', isExpanded && 'lumia-pack-item-container--expanded')}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    {/* Pack header row */}
                                    <div className="lumia-pack-item">
                                        <button
                                            className="lumia-pack-expand-btn"
                                            onClick={() => togglePackExpansion(packKey)}
                                            type="button"
                                            title={isExpanded ? 'Collapse' : 'Expand to see Lumias'}
                                        >
                                            <span className={clsx('lumia-pack-chevron', isExpanded && 'lumia-pack-chevron--expanded')}>
                                                {Icons.chevronDown}
                                            </span>
                                        </button>
                                        <span
                                            className="lumia-pack-name"
                                            onClick={() => togglePackExpansion(packKey)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            {pack.name}
                                        </span>
                                        <span className="lumia-pack-count">
                                            {lumiaItems.length} Lumia{lumiaItems.length !== 1 ? 's' : ''}
                                        </span>
                                        <button
                                            className="lumia-btn lumia-btn-icon"
                                            onClick={() => exportPack(pack)}
                                            title="Export as Lumiverse Pack"
                                            type="button"
                                        >
                                            {Icons.download}
                                        </button>
                                        <button
                                            className="lumia-btn lumia-btn-icon"
                                            onClick={() => actions.openModal('packEditor', { packId: packKey })}
                                            title="Edit pack"
                                            type="button"
                                        >
                                            {Icons.edit}
                                        </button>
                                    </div>

                                    {/* Expanded Lumia items list - uses CSS grid for smooth, performant animation */}
                                    <CollapsibleContent
                                        isOpen={isExpanded && lumiaItems.length > 0}
                                        className="lumia-pack-items-list"
                                        duration={200}
                                    >
                                        {lumiaItems.map((item, index) => (
                                            <LumiaPackItem
                                                key={item.lumiaDefName || index}
                                                item={item}
                                                packName={pack.name}
                                                onEdit={(pn, it) => actions.openModal('lumiaEditor', {
                                                    packName: pn,
                                                    editingItem: it
                                                })}
                                                editIcon={Icons.edit}
                                            />
                                        ))}
                                    </CollapsibleContent>
                                    <CollapsibleContent
                                        isOpen={isExpanded && lumiaItems.length === 0}
                                        className="lumia-pack-items-empty"
                                        duration={200}
                                    >
                                        <span>No Lumias in this pack yet</span>
                                    </CollapsibleContent>
                                </motion.div>
                            );
                        })}
                    </div>
                </Panel>
            )}

            {/* Downloaded Packs Section (non-custom packs) */}
            {packs.length > 0 && (
                <Panel
                    title="Downloaded Packs"
                    icon={Icons.box}
                    collapsible
                    collapsed={sectionsCollapsed.downloadedPacks}
                    onToggle={() => toggleSection('downloadedPacks')}
                >
                    <div className="lumia-downloaded-packs">
                        {packs.map((pack) => {
                            const packName = pack.name || pack.packName || 'Unknown Pack';
                            // Support both new format (lumiaItems) and legacy format (items)
                            const lumiaItems = pack.lumiaItems?.length > 0
                                ? pack.lumiaItems
                                : (pack.items?.filter(item => item.lumiaDefName && item.lumiaDef) || []);
                            const coverUrl = pack.coverUrl || pack.packCover;

                            return (
                                <div key={packName} className="lumia-downloaded-pack-item">
                                    {coverUrl ? (
                                        <img
                                            src={coverUrl}
                                            alt={packName}
                                            className="lumia-downloaded-pack-cover"
                                        />
                                    ) : (
                                        <div className="lumia-downloaded-pack-cover-placeholder">
                                            {Icons.package}
                                        </div>
                                    )}
                                    <div className="lumia-downloaded-pack-info">
                                        <span className="lumia-downloaded-pack-name">{packName}</span>
                                        <span className="lumia-downloaded-pack-count">
                                            {lumiaItems.length} Lumia{lumiaItems.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="lumia-downloaded-pack-actions">
                                        <button
                                            className="lumia-btn lumia-btn-icon"
                                            onClick={() => actions.openPackDetail(packName)}
                                            title="View pack contents"
                                            type="button"
                                        >
                                            <Eye size={16} strokeWidth={1.5} />
                                        </button>
                                        <button
                                            className="lumia-btn lumia-btn-icon lumia-btn-icon-danger"
                                            onClick={() => handleDeletePack(packName)}
                                            title="Delete pack"
                                            type="button"
                                        >
                                            <Trash2 size={16} strokeWidth={1.5} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Panel>
            )}

            {/* Loom Packs Section (packs with Loom items) */}
            {loomPacks.length > 0 && (
                <Panel
                    title="Loom Packs"
                    icon={Icons.layers}
                    collapsible
                    collapsed={sectionsCollapsed.loomPacks}
                    onToggle={() => toggleSection('loomPacks')}
                >
                    <div className="lumia-loom-packs">
                        {loomPacks.map((pack) => {
                            const packName = pack.name || pack.packName || 'Unknown Pack';

                            // Count loom items by category
                            let styles = pack.loomStyles?.length || 0;
                            let utilities = pack.loomUtils?.length || 0;
                            let retrofits = pack.loomRetrofits?.length || 0;

                            // Also check items array
                            if (pack.items) {
                                pack.items.forEach(item => {
                                    const cat = item.loomCategory || item.category;
                                    if (cat === 'Narrative Style' || cat === 'loomStyles') styles++;
                                    else if (cat === 'Loom Utilities' || cat === 'loomUtils') utilities++;
                                    else if (cat === 'Retrofits' || cat === 'loomRetrofits') retrofits++;
                                });
                            }

                            return (
                                <div key={packName} className="lumia-loom-pack-item">
                                    {pack.packCover ? (
                                        <img
                                            src={pack.packCover}
                                            alt={packName}
                                            className="lumia-loom-pack-cover"
                                        />
                                    ) : (
                                        <div className="lumia-loom-pack-cover-placeholder">
                                            {Icons.layers}
                                        </div>
                                    )}
                                    <div className="lumia-loom-pack-info">
                                        <span className="lumia-loom-pack-name">{packName}</span>
                                        <div className="lumia-loom-pack-stats">
                                            {styles > 0 && (
                                                <span><Sparkles size={10} /> {styles}</span>
                                            )}
                                            {utilities > 0 && (
                                                <span><Wrench size={10} /> {utilities}</span>
                                            )}
                                            {retrofits > 0 && (
                                                <span><Layers size={10} /> {retrofits}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="lumia-loom-pack-actions">
                                        <button
                                            className="lumia-btn lumia-btn-icon"
                                            onClick={() => actions.openLoomPackDetail(packName)}
                                            title="View loom contents"
                                            type="button"
                                        >
                                            <Eye size={16} strokeWidth={1.5} />
                                        </button>
                                        <button
                                            className="lumia-btn lumia-btn-icon lumia-btn-icon-danger"
                                            onClick={() => handleDeletePack(packName)}
                                            title="Delete pack"
                                            type="button"
                                        >
                                            <Trash2 size={16} strokeWidth={1.5} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Panel>
            )}

            {/* Danger Zone - Reset Settings */}
            <CollapsiblePanel
                title="Danger Zone"
                icon={<AlertTriangle size={16} strokeWidth={1.5} />}
            >
                <div className="lumia-danger-zone">
                    <p className="lumia-danger-zone-description">
                        If you're experiencing issues with the extension, you can reset all settings to their defaults.
                        This will remove all packs, selections, and configurations.
                    </p>
                    <button
                        className="lumia-btn lumia-btn-danger lumia-btn-full"
                        onClick={handleNuclearReset}
                        type="button"
                    >
                        <AlertTriangle size={16} strokeWidth={1.5} />
                        Reset All Settings
                    </button>
                </div>
            </CollapsiblePanel>
        </div>
    );
}

export default SettingsPanel;
