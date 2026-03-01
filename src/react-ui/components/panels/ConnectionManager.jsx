import React, { useState, useCallback, useMemo } from 'react';
import {
    Plus,
    Trash2,
    Edit2,
    Check,
    X,
    Copy,
    Plug,
    Download,
    Eye,
    EyeOff,
    MoreVertical,
    Zap,
    Link,
    Unlink,
    ArrowLeft,
    Globe,
    Key,
    Server,
    Layers,
    ChevronDown,
} from 'lucide-react';
import { useConnectionManager } from '../../hooks/useConnectionManager';
import { useLumiverse, useLumiverseActions } from '../../store/LumiverseContext';
import { chatPresetService } from '../../../lib/chatPresetService';
import ConfirmationModal from '../shared/ConfirmationModal';

// ============================================================================
// PROVIDER DISPLAY NAMES
// ============================================================================

const PROVIDER_DISPLAY = {
    openai:       { label: 'OpenAI',          color: '#10a37f' },
    claude:       { label: 'Anthropic',       color: '#d4a574' },
    makersuite:   { label: 'Google AI',       color: '#4285f4' },
    openrouter:   { label: 'OpenRouter',      color: '#6366f1' },
    groq:         { label: 'Groq',            color: '#f97316' },
    mistralai:    { label: 'Mistral',         color: '#ff7000' },
    deepseek:     { label: 'DeepSeek',        color: '#0ea5e9' },
    xai:          { label: 'xAI',             color: '#ffffff' },
    custom:       { label: 'Custom',          color: '#8b5cf6' },
    azure_openai: { label: 'Azure',           color: '#0078d4' },
};

const PROVIDER_OPTIONS = Object.entries(PROVIDER_DISPLAY).map(([key, val]) => ({
    value: key,
    label: val.label,
    color: val.color,
}));

// ============================================================================
// STYLES
// ============================================================================

const styles = {
    layout: {
        display: 'flex',
        flexDirection: 'column',
        position: 'absolute',
        inset: 0,
        background: 'var(--lumiverse-bg)',
        color: 'var(--lumiverse-text)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        background: 'var(--lumiverse-bg-elevated)',
        borderBottom: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
        flexWrap: 'wrap',
    },
    headerTitle: {
        fontSize: '14px',
        fontWeight: 600,
        flex: 1,
        minWidth: 0,
    },
    headerBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        border: '1px solid var(--lumiverse-border)',
        background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.1))',
        color: 'var(--lumiverse-text)',
        cursor: 'pointer',
        flexShrink: 0,
    },
    scrollArea: {
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        padding: '12px',
    },
    card: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        marginBottom: '8px',
        borderRadius: '8px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'transparent',
        background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.1))',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
    },
    cardActive: {
        borderColor: 'var(--lumiverse-primary)',
        background: 'var(--lumiverse-fill-light, rgba(0,0,0,0.15))',
    },
    cardAccent: {
        width: '4px',
        height: '36px',
        borderRadius: '2px',
        flexShrink: 0,
    },
    cardInfo: {
        flex: 1,
        minWidth: 0,
    },
    cardName: {
        fontSize: '13px',
        fontWeight: 600,
        marginBottom: '2px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    cardMeta: {
        fontSize: '11px',
        opacity: 0.7,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    activeBadge: {
        fontSize: '10px',
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: '4px',
        background: 'var(--lumiverse-primary)',
        color: '#fff',
        flexShrink: 0,
    },
    cardBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        border: 'none',
        background: 'transparent',
        color: 'var(--lumiverse-text-secondary, var(--lumiverse-text))',
        cursor: 'pointer',
        opacity: 0.6,
        flexShrink: 0,
    },
    empty: {
        textAlign: 'center',
        padding: '40px 20px',
        opacity: 0.5,
        fontSize: '13px',
    },
    // Editor styles
    editor: {
        display: 'flex',
        flexDirection: 'column',
        position: 'absolute',
        inset: 0,
        background: 'var(--lumiverse-bg)',
        color: 'var(--lumiverse-text)',
    },
    editorHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        background: 'var(--lumiverse-bg-elevated)',
        borderBottom: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
    },
    editorScroll: {
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        padding: '16px',
    },
    fieldGroup: {
        marginBottom: '16px',
    },
    fieldLabel: {
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '6px',
        opacity: 0.7,
    },
    fieldInput: {
        width: '100%',
        padding: '8px 10px',
        borderRadius: '6px',
        border: '1px solid var(--lumiverse-border)',
        background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.1))',
        color: 'var(--lumiverse-text)',
        fontSize: '13px',
        outline: 'none',
        boxSizing: 'border-box',
    },
    fieldSelect: {
        width: '100%',
        padding: '8px 10px',
        borderRadius: '6px',
        border: '1px solid var(--lumiverse-border)',
        background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.1))',
        color: 'var(--lumiverse-text)',
        fontSize: '13px',
        outline: 'none',
        boxSizing: 'border-box',
        cursor: 'pointer',
    },
    fieldHint: {
        fontSize: '11px',
        opacity: 0.5,
        marginTop: '4px',
    },
    passwordWrap: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
    },
    passwordToggle: {
        position: 'absolute',
        right: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        border: 'none',
        background: 'transparent',
        color: 'var(--lumiverse-text)',
        cursor: 'pointer',
        opacity: 0.5,
    },
    providerGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: '6px',
    },
    providerChip: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '8px 6px',
        borderRadius: '6px',
        border: '1px solid var(--lumiverse-border)',
        background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.1))',
        color: 'var(--lumiverse-text)',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: 500,
        transition: 'border-color 0.15s',
    },
    providerChipActive: {
        borderColor: 'var(--lumiverse-primary)',
        background: 'var(--lumiverse-fill-light, rgba(0,0,0,0.15))',
    },
    providerDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        flexShrink: 0,
    },
    editorFooter: {
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        borderTop: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
    },
    saveBtn: {
        flex: 1,
        padding: '8px 16px',
        borderRadius: '6px',
        border: 'none',
        background: 'var(--lumiverse-primary)',
        color: '#fff',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
    },
    cancelBtn: {
        padding: '8px 16px',
        borderRadius: '6px',
        border: '1px solid var(--lumiverse-border)',
        background: 'transparent',
        color: 'var(--lumiverse-text)',
        fontSize: '13px',
        cursor: 'pointer',
    },
    section: {
        marginBottom: '20px',
    },
    sectionTitle: {
        fontSize: '12px',
        fontWeight: 600,
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        opacity: 0.7,
    },
    menuOverlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 999,
    },
    menu: {
        position: 'absolute',
        right: 0,
        top: '100%',
        zIndex: 1000,
        minWidth: '160px',
        padding: '4px',
        borderRadius: '8px',
        border: '1px solid var(--lumiverse-border)',
        background: 'var(--lumiverse-bg-elevated)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    },
    menuItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '8px 12px',
        border: 'none',
        borderRadius: '6px',
        background: 'transparent',
        color: 'var(--lumiverse-text)',
        fontSize: '12px',
        cursor: 'pointer',
        textAlign: 'left',
    },
    menuItemDanger: {
        color: 'var(--lumiverse-danger, #ef4444)',
    },
};

// ============================================================================
// PROFILE EDITOR
// ============================================================================

function ProfileEditor({ profile, onSave, onCancel }) {
    const [draft, setDraft] = useState(() => ({ ...profile }));
    const [showApiKey, setShowApiKey] = useState(false);

    // Get Loom Builder state for preset detection
    const loomBuilder = useLumiverse(s => s.loomBuilder);
    const isLoomMode = !!loomBuilder?.activePresetId;
    const loomRegistry = loomBuilder?.registry || {};

    // Get available ST OAI presets
    const stPresets = useMemo(() => {
        try {
            return chatPresetService.getAvailablePresets() || [];
        } catch {
            return [];
        }
    }, []);

    // Get Loom preset options
    const loomPresetOptions = useMemo(() => {
        return Object.entries(loomRegistry).map(([id, entry]) => ({
            value: id,
            label: entry.name || id,
        }));
    }, [loomRegistry]);

    const updateField = useCallback((field, value) => {
        setDraft(prev => ({ ...prev, [field]: value }));
    }, []);

    const handleSave = useCallback(() => {
        onSave(draft);
    }, [draft, onSave]);

    return (
        <div style={styles.editor}>
            <div style={styles.editorHeader}>
                <button
                    style={{ ...styles.cardBtn, opacity: 1 }}
                    onClick={onCancel}
                    title="Back"
                >
                    <ArrowLeft size={16} />
                </button>
                <span style={{ fontSize: '14px', fontWeight: 600, flex: 1 }}>
                    {profile.id ? 'Edit Profile' : 'New Profile'}
                </span>
            </div>

            <div style={styles.editorScroll}>
                {/* Profile Name */}
                <div style={styles.fieldGroup}>
                    <div style={styles.fieldLabel}>Profile Name</div>
                    <input
                        style={styles.fieldInput}
                        value={draft.name || ''}
                        onChange={e => updateField('name', e.target.value)}
                        placeholder="My API Connection"
                    />
                </div>

                {/* Provider Selector */}
                <div style={styles.fieldGroup}>
                    <div style={styles.fieldLabel}>Provider</div>
                    <div style={styles.providerGrid}>
                        {PROVIDER_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                style={{
                                    ...styles.providerChip,
                                    ...(draft.provider === opt.value ? styles.providerChipActive : {}),
                                }}
                                onClick={() => updateField('provider', opt.value)}
                            >
                                <span style={{ ...styles.providerDot, background: opt.color }} />
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Model */}
                <div style={styles.fieldGroup}>
                    <div style={styles.fieldLabel}>Model</div>
                    <input
                        style={styles.fieldInput}
                        value={draft.model || ''}
                        onChange={e => updateField('model', e.target.value)}
                        placeholder="e.g. claude-sonnet-4-20250514"
                    />
                </div>

                {/* API Key */}
                <div style={styles.fieldGroup}>
                    <div style={styles.fieldLabel}>
                        <Key size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        API Key
                    </div>
                    <div style={styles.passwordWrap}>
                        <input
                            style={{ ...styles.fieldInput, paddingRight: '36px' }}
                            type={showApiKey ? 'text' : 'password'}
                            value={draft.apiKey || ''}
                            onChange={e => {
                                updateField('apiKey', e.target.value);
                                updateField('secretMode', 'own');
                            }}
                            placeholder={draft.secretMode === 'st' ? '(Using ST secret)' : 'sk-...'}
                        />
                        <button
                            style={styles.passwordToggle}
                            onClick={() => setShowApiKey(!showApiKey)}
                            title={showApiKey ? 'Hide' : 'Show'}
                        >
                            {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                    {draft.secretMode === 'st' && (
                        <div style={styles.fieldHint}>
                            Referencing SillyTavern&apos;s stored secret. Enter a key above to use your own.
                        </div>
                    )}
                </div>

                {/* Endpoint URL */}
                <div style={styles.fieldGroup}>
                    <div style={styles.fieldLabel}>
                        <Globe size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        Endpoint URL
                    </div>
                    <input
                        style={styles.fieldInput}
                        value={draft.endpointUrl || ''}
                        onChange={e => updateField('endpointUrl', e.target.value || null)}
                        placeholder="Leave empty for direct API connection"
                    />
                    <div style={styles.fieldHint}>
                        Custom URL enables reverse-proxy mode. API key is used for both auth and proxy password.
                    </div>
                </div>

                {/* Prompt Preset — contextual: ST presets or Loom presets */}
                <div style={styles.fieldGroup}>
                    <div style={styles.fieldLabel}>
                        <Server size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        Prompt Preset
                        {isLoomMode && (
                            <span style={{ marginLeft: '6px', fontSize: '10px', opacity: 0.5, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                                (Loom active)
                            </span>
                        )}
                    </div>
                    <select
                        style={styles.fieldSelect}
                        value={draft.oaiPreset || ''}
                        onChange={e => updateField('oaiPreset', e.target.value || null)}
                    >
                        <option value="">None (don&apos;t change)</option>
                        {stPresets.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                    <div style={styles.fieldHint}>
                        ST prompt preset to apply when this profile is activated.
                    </div>
                </div>

                {/* Loom Preset Link */}
                {loomPresetOptions.length > 0 && (
                    <div style={styles.fieldGroup}>
                        <div style={styles.fieldLabel}>
                            <Layers size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                            Loom Preset
                        </div>
                        <select
                            style={styles.fieldSelect}
                            value={draft.loomPresetId || ''}
                            onChange={e => updateField('loomPresetId', e.target.value || null)}
                        >
                            <option value="">None (don&apos;t change)</option>
                            {loomPresetOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <div style={styles.fieldHint}>
                            Automatically activate this Loom preset when the connection profile is applied.
                        </div>
                    </div>
                )}

                {/* Color */}
                <div style={styles.fieldGroup}>
                    <div style={styles.fieldLabel}>Accent Color</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="color"
                            value={draft.color || (PROVIDER_DISPLAY[draft.provider]?.color || '#6366f1')}
                            onChange={e => updateField('color', e.target.value)}
                            style={{ width: '32px', height: '32px', border: 'none', background: 'none', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '12px', opacity: 0.5 }}>
                            {draft.color || 'Provider default'}
                        </span>
                    </div>
                </div>
            </div>

            <div style={styles.editorFooter}>
                <button style={styles.cancelBtn} onClick={onCancel}>Cancel</button>
                <button style={styles.saveBtn} onClick={handleSave}>Save Profile</button>
            </div>
        </div>
    );
}

// ============================================================================
// PROFILE CARD
// ============================================================================

function ProfileCard({ entry, isActive, onApply, onEdit, onDuplicate, onDelete }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const accentColor = entry.color || PROVIDER_DISPLAY[entry.provider]?.color || '#6366f1';
    const providerLabel = PROVIDER_DISPLAY[entry.provider]?.label || entry.provider;

    return (
        <div
            style={{
                ...styles.card,
                ...(isActive ? styles.cardActive : {}),
            }}
            onClick={() => onApply(entry.id)}
        >
            <div style={{ ...styles.cardAccent, background: accentColor }} />
            <div style={styles.cardInfo}>
                <div style={styles.cardName}>{entry.name}</div>
                <div style={styles.cardMeta}>
                    {providerLabel}{entry.model ? ` \u00B7 ${entry.model}` : ''}
                </div>
            </div>
            {isActive && <span style={styles.activeBadge}>ACTIVE</span>}
            <div style={{ position: 'relative' }}>
                <button
                    style={styles.cardBtn}
                    onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                    title="More actions"
                >
                    <MoreVertical size={14} />
                </button>
                {menuOpen && (
                    <>
                        <div style={styles.menuOverlay} onClick={() => setMenuOpen(false)} />
                        <div style={styles.menu}>
                            <button
                                style={styles.menuItem}
                                onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(entry.id); }}
                            >
                                <Edit2 size={14} /> Edit
                            </button>
                            <button
                                style={styles.menuItem}
                                onClick={e => { e.stopPropagation(); setMenuOpen(false); onDuplicate(entry.id); }}
                            >
                                <Copy size={14} /> Duplicate
                            </button>
                            <button
                                style={{ ...styles.menuItem, ...styles.menuItemDanger }}
                                onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(entry.id); }}
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ConnectionManager({ compact }) {
    const {
        registry,
        activeProfileId,
        activeProfile,
        isLoading,
        isApplying,
        createProfile,
        saveProfile,
        deleteProfile,
        duplicateProfile,
        captureCurrentAsProfile,
        applyProfile,
        PROVIDER_DEFAULTS,
    } = useConnectionManager();
    const actions = useLumiverseActions();

    const [editingId, setEditingId] = useState(null);
    const [editingProfile, setEditingProfile] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Sort profiles by updatedAt desc
    const profileList = useMemo(() => {
        return Object.values(registry).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, [registry]);

    // Handlers
    const handleNew = useCallback(async () => {
        const profile = await createProfile({ name: 'New Profile' });
        if (profile) {
            setEditingProfile(profile);
            setEditingId(profile.id);
        }
    }, [createProfile]);

    const handleCapture = useCallback(async () => {
        await captureCurrentAsProfile();
    }, [captureCurrentAsProfile]);

    const handleImportST = useCallback(() => {
        actions.openModal('connectionMigrate');
    }, [actions]);

    const handleApply = useCallback(async (profileId) => {
        if (profileId === activeProfileId) return;
        await applyProfile(profileId);
    }, [activeProfileId, applyProfile]);

    const handleEdit = useCallback(async (profileId) => {
        const { loadProfile } = await import('../../../lib/connectionService');
        const profile = await loadProfile(profileId);
        if (profile) {
            setEditingProfile(profile);
            setEditingId(profileId);
        }
    }, []);

    const handleDuplicate = useCallback(async (profileId) => {
        const entry = registry[profileId];
        await duplicateProfile(profileId, `${entry?.name || 'Profile'} (copy)`);
    }, [registry, duplicateProfile]);

    const handleDeleteConfirm = useCallback(async () => {
        if (deleteConfirm) {
            await deleteProfile(deleteConfirm);
            setDeleteConfirm(null);
        }
    }, [deleteConfirm, deleteProfile]);

    const handleEditorSave = useCallback(async (draft) => {
        await saveProfile(draft);
        setEditingProfile(null);
        setEditingId(null);
    }, [saveProfile]);

    const handleEditorCancel = useCallback(() => {
        setEditingProfile(null);
        setEditingId(null);
    }, []);

    // If editing, show editor
    if (editingProfile) {
        return (
            <ProfileEditor
                profile={editingProfile}
                onSave={handleEditorSave}
                onCancel={handleEditorCancel}
            />
        );
    }

    return (
        <div style={styles.layout}>
            {/* Header */}
            <div style={styles.header}>
                <Plug size={16} />
                <span style={styles.headerTitle}>Connections</span>
                <button style={styles.headerBtn} onClick={handleCapture} title="Capture current ST settings as profile">
                    <Download size={12} />
                </button>
                <button style={styles.headerBtn} onClick={handleImportST} title="Import from ST Connection Manager">
                    <Zap size={12} />
                </button>
                <button style={{ ...styles.headerBtn, background: 'var(--lumiverse-primary)', color: '#fff', borderColor: 'transparent' }} onClick={handleNew} title="Create new profile">
                    <Plus size={12} />
                </button>
            </div>

            {/* Profile List */}
            <div style={styles.scrollArea}>
                {profileList.length === 0 ? (
                    <div style={styles.empty}>
                        <Plug size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                        <div>No connection profiles yet.</div>
                        <div style={{ marginTop: '8px', fontSize: '12px' }}>
                            Create a new profile or capture your current settings.
                        </div>
                    </div>
                ) : (
                    profileList.map(entry => (
                        <ProfileCard
                            key={entry.id}
                            entry={entry}
                            isActive={activeProfileId === entry.id}
                            onApply={handleApply}
                            onEdit={handleEdit}
                            onDuplicate={handleDuplicate}
                            onDelete={id => setDeleteConfirm(id)}
                        />
                    ))
                )}
            </div>

            {/* Delete confirmation */}
            <ConfirmationModal
                isOpen={!!deleteConfirm}
                title="Delete Profile"
                message={`Delete "${registry[deleteConfirm]?.name || 'this profile'}"? This cannot be undone.`}
                confirmText="Delete"
                variant="danger"
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteConfirm(null)}
            />
        </div>
    );
}
