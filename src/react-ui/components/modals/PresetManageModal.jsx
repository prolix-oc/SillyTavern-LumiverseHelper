import React, { useState, useMemo, useSyncExternalStore, useCallback } from 'react';
import clsx from 'clsx';
import { Bookmark, Trash2, RefreshCw, Plus, Check, X, Clock, FileText, Zap, Heart, Users, Settings2 } from 'lucide-react';
import { useLumiverseStore, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';

// Get store for direct state access
const store = useLumiverseStore;

// Stable fallback constants for useSyncExternalStore
const EMPTY_OBJECT = {};

// Stable selector functions
const selectPresets = () => store.getState().presets || EMPTY_OBJECT;
const selectActivePresetName = () => store.getState().activePresetName;

/**
 * Format a timestamp to a relative time string
 */
function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

/**
 * Preset card component for the modal
 */
function PresetCard({ preset, isActive, onLoad, onUpdate, onDelete }) {
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    const handleDelete = () => {
        if (isConfirmingDelete) {
            onDelete(preset.name);
            setIsConfirmingDelete(false);
        } else {
            setIsConfirmingDelete(true);
            // Auto-cancel after 3 seconds
            setTimeout(() => setIsConfirmingDelete(false), 3000);
        }
    };

    // Calculate separate counts based on mode
    const counts = useMemo(() => {
        if (preset.councilMode && preset.councilMembers?.length > 0) {
            // Council mode: show member count and aggregate traits
            const memberCount = preset.councilMembers.length;
            const totalBehaviors = preset.councilMembers.reduce((sum, m) => sum + (m.behaviors?.length || 0), 0);
            const totalPersonalities = preset.councilMembers.reduce((sum, m) => sum + (m.personalities?.length || 0), 0);
            return {
                isCouncil: true,
                members: memberCount,
                behaviors: totalBehaviors,
                personalities: totalPersonalities,
            };
        } else if (preset.chimeraMode && preset.selectedDefinitions?.length > 0) {
            // Chimera mode: show fused definition count
            return {
                isChimera: true,
                definitions: preset.selectedDefinitions.length,
                behaviors: preset.selectedBehaviors?.length || 0,
                personalities: preset.selectedPersonalities?.length || 0,
            };
        } else {
            // Normal mode
            return {
                definitions: preset.selectedDefinition ? 1 : 0,
                behaviors: preset.selectedBehaviors?.length || 0,
                personalities: preset.selectedPersonalities?.length || 0,
            };
        }
    }, [preset]);

    return (
        <div className={clsx('lumiverse-preset-card', isActive && 'lumiverse-preset-card--active')}>
            <div className="lumiverse-preset-card-header">
                <span className="lumiverse-preset-card-icon">
                    <Bookmark size={16} strokeWidth={1.5} />
                </span>
                <span className="lumiverse-preset-card-name">{preset.name}</span>
                {isActive && (
                    <span className="lumiverse-preset-card-active-badge">
                        <Check size={12} strokeWidth={2} /> Active
                    </span>
                )}
            </div>

            <div className="lumiverse-preset-card-meta">
                {/* Separate trait counts with icons */}
                <div className="lumiverse-preset-stats">
                    {counts.isCouncil ? (
                        // Council mode stats
                        <>
                            <span className="lumiverse-preset-stat lumiverse-preset-stat--council">
                                <Users size={12} strokeWidth={1.5} /> {counts.members}
                            </span>
                            <span className="lumiverse-preset-stat">
                                <Zap size={12} strokeWidth={1.5} /> {counts.behaviors}
                            </span>
                            <span className="lumiverse-preset-stat">
                                <Heart size={12} strokeWidth={1.5} /> {counts.personalities}
                            </span>
                        </>
                    ) : (
                        // Normal or Chimera mode stats
                        <>
                            <span className={clsx('lumiverse-preset-stat', counts.isChimera && 'lumiverse-preset-stat--chimera')}>
                                <FileText size={12} strokeWidth={1.5} /> {counts.definitions}
                            </span>
                            <span className="lumiverse-preset-stat">
                                <Zap size={12} strokeWidth={1.5} /> {counts.behaviors}
                            </span>
                            <span className="lumiverse-preset-stat">
                                <Heart size={12} strokeWidth={1.5} /> {counts.personalities}
                            </span>
                        </>
                    )}
                </div>
                {preset.chimeraMode && (
                    <span className="lumiverse-preset-card-mode">Chimera</span>
                )}
                {preset.councilMode && (
                    <span className="lumiverse-preset-card-mode">Council</span>
                )}
                <span className="lumiverse-preset-card-time">
                    <Clock size={12} strokeWidth={1.5} />
                    {formatRelativeTime(preset.updatedAt || preset.createdAt)}
                </span>
            </div>

            <div className="lumiverse-preset-card-actions">
                <button
                    className="lumiverse-preset-btn lumiverse-preset-btn--primary"
                    onClick={() => onLoad(preset.name)}
                    title="Load this preset"
                    type="button"
                >
                    Load
                </button>
                <button
                    className="lumiverse-preset-btn"
                    onClick={() => onUpdate(preset.name)}
                    title="Update preset with current selections"
                    type="button"
                >
                    <RefreshCw size={14} strokeWidth={1.5} />
                </button>
                <button
                    className={clsx(
                        'lumiverse-preset-btn lumiverse-preset-btn--danger',
                        isConfirmingDelete && 'lumiverse-preset-btn--confirming'
                    )}
                    onClick={handleDelete}
                    title={isConfirmingDelete ? 'Click again to confirm' : 'Delete preset'}
                    type="button"
                >
                    {isConfirmingDelete ? <X size={14} strokeWidth={2} /> : <Trash2 size={14} strokeWidth={1.5} />}
                </button>
            </div>
        </div>
    );
}

/**
 * Empty state component
 */
function EmptyState({ onCreateClick }) {
    return (
        <div className="lumiverse-preset-empty">
            <span className="lumiverse-preset-empty-icon">
                <Bookmark size={32} strokeWidth={1.5} />
            </span>
            <h4>No Presets Saved</h4>
            <p>Save your current Lumia configuration as a preset to quickly switch between setups.</p>
            <button
                className="lumiverse-preset-btn lumiverse-preset-btn--primary"
                onClick={onCreateClick}
                style={{ marginTop: '16px' }}
                type="button"
            >
                <Plus size={14} strokeWidth={2} />
                Create Your First Preset
            </button>
        </div>
    );
}

// Self-contained styles for modal layout
const styles = {
    layout: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 20px',
        borderBottom: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
    },
    headerIcon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(147, 112, 219, 0.2), rgba(147, 112, 219, 0.1))',
        color: 'var(--lumiverse-primary)',
    },
    headerText: {
        flex: 1,
    },
    title: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 600,
        color: 'var(--lumiverse-text)',
    },
    subtitle: {
        margin: '4px 0 0',
        fontSize: '12px',
        color: 'var(--lumiverse-text-muted)',
    },
    scrollArea: {
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        padding: '16px 20px',
    },
    createSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
        padding: '12px',
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '10px',
        border: '1px solid rgba(147, 112, 219, 0.15)',
    },
    input: {
        flex: 1,
        padding: '10px 12px',
        fontSize: '13px',
        background: 'var(--lumiverse-input-bg)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        color: 'var(--lumiverse-text)',
        outline: 'none',
        transition: 'border-color 0.2s ease',
    },
    footer: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        padding: '12px 20px',
        borderTop: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
    },
    button: {
        padding: '10px 16px',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    buttonSecondary: {
        background: 'var(--lumiverse-surface)',
        color: 'var(--lumiverse-text)',
        border: '1px solid var(--lumiverse-border)',
    },
    buttonPrimary: {
        background: 'var(--lumiverse-primary)',
        color: 'white',
    },
};

/**
 * Preset Manage Modal
 *
 * A modal interface for managing Lumia presets (load, update, delete, create).
 * Provides the same functionality as the sidebar PresetManager but in a modal format
 * accessible from the extension settings panel.
 */
function PresetManageModal({ onClose }) {
    const actions = useLumiverseActions();
    const [newPresetName, setNewPresetName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

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

    // Convert presets object to sorted array
    const presetList = useMemo(() => {
        return Object.values(presets).sort((a, b) => {
            // Sort by most recently updated/created
            const timeA = a.updatedAt || a.createdAt || 0;
            const timeB = b.updatedAt || b.createdAt || 0;
            return timeB - timeA;
        });
    }, [presets]);

    const handleLoad = useCallback((presetName) => {
        actions.loadPreset(presetName);
        saveToExtension();
        if (typeof toastr !== 'undefined') {
            toastr.info(`Loaded preset "${presetName}"`);
        }
    }, [actions]);

    const handleUpdate = useCallback((presetName) => {
        actions.updatePreset(presetName);
        saveToExtension();
        if (typeof toastr !== 'undefined') {
            toastr.success(`Updated preset "${presetName}"`);
        }
    }, [actions]);

    const handleDelete = useCallback((presetName) => {
        actions.deletePreset(presetName);
        saveToExtension();
        if (typeof toastr !== 'undefined') {
            toastr.success(`Deleted preset "${presetName}"`);
        }
    }, [actions]);

    const handleCreate = useCallback(() => {
        const trimmedName = newPresetName.trim();
        if (!trimmedName) return;

        // Check for duplicate names
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

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleCreate();
        } else if (e.key === 'Escape') {
            if (isCreating) {
                setIsCreating(false);
                setNewPresetName('');
            }
        }
    };

    return (
        <div style={styles.layout}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerIcon}>
                    <Settings2 size={20} strokeWidth={1.5} />
                </div>
                <div style={styles.headerText}>
                    <h3 style={styles.title}>Manage Presets</h3>
                    <p style={styles.subtitle}>
                        {presetList.length > 0
                            ? `${presetList.length} preset${presetList.length !== 1 ? 's' : ''} saved`
                            : 'No presets saved yet'}
                    </p>
                </div>
            </div>

            {/* Scrollable Content */}
            <div style={styles.scrollArea}>
                {/* Create New Preset Section */}
                {isCreating ? (
                    <div style={styles.createSection}>
                        <input
                            type="text"
                            style={styles.input}
                            placeholder="Enter preset name..."
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                        <button
                            className="lumiverse-preset-btn lumiverse-preset-btn--primary"
                            onClick={handleCreate}
                            disabled={!newPresetName.trim()}
                            type="button"
                            title="Save preset"
                        >
                            <Check size={16} strokeWidth={2} />
                        </button>
                        <button
                            className="lumiverse-preset-btn"
                            onClick={() => {
                                setIsCreating(false);
                                setNewPresetName('');
                            }}
                            type="button"
                            title="Cancel"
                        >
                            <X size={16} strokeWidth={2} />
                        </button>
                    </div>
                ) : (
                    <div style={styles.createSection}>
                        <span style={{ fontSize: '13px', color: 'var(--lumiverse-text-secondary)', flex: 1 }}>
                            Save your current Lumia configuration
                        </span>
                        <button
                            className="lumiverse-preset-btn lumiverse-preset-btn--primary"
                            onClick={() => setIsCreating(true)}
                            type="button"
                        >
                            <Plus size={14} strokeWidth={2} />
                            New Preset
                        </button>
                    </div>
                )}

                {/* Preset List */}
                <div className="lumiverse-preset-list">
                    {presetList.length === 0 ? (
                        <EmptyState onCreateClick={() => setIsCreating(true)} />
                    ) : (
                        presetList.map((preset) => (
                            <PresetCard
                                key={preset.name}
                                preset={preset}
                                isActive={activePresetName === preset.name}
                                onLoad={handleLoad}
                                onUpdate={handleUpdate}
                                onDelete={handleDelete}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Footer */}
            <div style={styles.footer}>
                <button
                    type="button"
                    style={{ ...styles.button, ...styles.buttonSecondary }}
                    onClick={onClose}
                >
                    Close
                </button>
            </div>
        </div>
    );
}

export default PresetManageModal;
