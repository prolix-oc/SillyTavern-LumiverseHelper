/**
 * QuickRepliesView — Full QR set + entry management UI for Lumiverse settings.
 *
 * Provides CRUD for QR2 sets and entries via quickReplyService,
 * styled with Lumiverse's adaptive theming.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    Zap, Plus, Trash2, ChevronDown, ChevronRight,
    Eye, EyeOff, Globe, MessageCircle, Save, X,
} from 'lucide-react';
import {
    isQRAvailable,
    getAllSets,
    createSet,
    deleteSet,
    createQR,
    updateQR,
    deleteQR,
    toggleGlobalSet,
    toggleChatSet,
} from '../../../lib/quickReplyService';
import ConfirmationModal from '../shared/ConfirmationModal';

/* global toastr */

// ─── Inline Styles ───────────────────────────────────────────────────

const s = {
    view: {
        padding: '20px',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
    },
    headerTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '16px',
        fontWeight: 600,
        color: 'var(--lumiverse-text)',
    },
    unavailable: {
        padding: '40px 20px',
        textAlign: 'center',
        color: 'var(--lumiverse-text-muted)',
        fontSize: '13px',
        lineHeight: '1.6',
    },
    createBar: {
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
    },
    input: {
        flex: 1,
        padding: '8px 12px',
        fontSize: '13px',
        background: 'var(--lumiverse-input-bg)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        color: 'var(--lumiverse-text)',
        outline: 'none',
        boxSizing: 'border-box',
    },
    btn: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '7px 14px',
        fontSize: '12px',
        fontWeight: 500,
        borderRadius: '8px',
        border: '1px solid var(--lumiverse-border)',
        background: 'var(--lumiverse-fill-subtle)',
        color: 'var(--lumiverse-text)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
    },
    btnPrimary: {
        background: 'var(--lumiverse-primary, rgba(100,120,255,0.15))',
        borderColor: 'var(--lumiverse-primary, rgba(100,120,255,0.3))',
        color: 'var(--lumiverse-text)',
    },
    btnDanger: {
        background: 'rgba(255,60,60,0.08)',
        borderColor: 'rgba(255,60,60,0.2)',
        color: 'var(--lumiverse-danger, rgba(255,100,100,0.9))',
    },
    btnSmall: {
        padding: '4px 10px',
        fontSize: '11px',
    },
    setCard: {
        marginBottom: '10px',
        background: 'var(--lumiverse-fill-subtle)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '10px',
        overflow: 'hidden',
    },
    setHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
        userSelect: 'none',
    },
    setColorDot: {
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        flexShrink: 0,
        border: '1px solid rgba(255,255,255,0.1)',
    },
    setName: {
        flex: 1,
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--lumiverse-text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    badge: {
        fontSize: '9.5px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        padding: '2px 7px',
        borderRadius: '4px',
        lineHeight: '1.4',
    },
    badgeGlobal: {
        background: 'rgba(100,120,255,0.12)',
        color: 'var(--lumiverse-primary, rgba(130,150,255,0.8))',
    },
    badgeChat: {
        background: 'rgba(100,220,160,0.12)',
        color: 'var(--lumiverse-success, rgba(100,220,160,0.8))',
    },
    setBody: {
        padding: '0 14px 14px',
        borderTop: '1px solid var(--lumiverse-border)',
    },
    setControls: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '10px 0',
        borderBottom: '1px solid var(--lumiverse-border)',
        marginBottom: '10px',
    },
    entryRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 6px',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'background 0.12s ease',
    },
    entryIcon: {
        width: '20px',
        textAlign: 'center',
        flexShrink: 0,
        color: 'var(--lumiverse-text-dim)',
        fontSize: '12px',
    },
    entryLabel: {
        flex: 1,
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--lumiverse-text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    entryPreview: {
        flex: 2,
        fontSize: '11.5px',
        color: 'var(--lumiverse-text-muted)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    entryBadges: {
        display: 'flex',
        gap: '3px',
        flexShrink: 0,
    },
    autoBadge: {
        fontSize: '9px',
        fontWeight: 600,
        padding: '1px 5px',
        borderRadius: '3px',
        background: 'rgba(255,180,60,0.12)',
        color: 'rgba(255,200,100,0.8)',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
    },
    hiddenBadge: {
        fontSize: '9px',
        fontWeight: 600,
        padding: '1px 5px',
        borderRadius: '3px',
        background: 'rgba(255,255,255,0.05)',
        color: 'var(--lumiverse-text-muted)',
        textTransform: 'uppercase',
    },
    editor: {
        padding: '12px',
        marginTop: '6px',
        marginBottom: '6px',
        background: 'var(--lumiverse-fill-light, rgba(0,0,0,0.15))',
        borderRadius: '8px',
        border: '1px solid var(--lumiverse-border)',
    },
    editorField: {
        marginBottom: '10px',
    },
    label: {
        display: 'block',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: 'var(--lumiverse-text-dim)',
        marginBottom: '4px',
    },
    textarea: {
        width: '100%',
        minHeight: '80px',
        maxHeight: '300px',
        padding: '8px 10px',
        fontSize: '12.5px',
        fontFamily: 'ui-monospace, "SF Mono", SFMono-Regular, "Cascadia Code", Menlo, Consolas, monospace',
        background: 'var(--lumiverse-input-bg)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '6px',
        color: 'var(--lumiverse-text)',
        outline: 'none',
        resize: 'vertical',
        boxSizing: 'border-box',
        lineHeight: '1.5',
    },
    checkboxGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        gap: '6px',
    },
    checkboxRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: 'var(--lumiverse-text)',
        cursor: 'pointer',
    },
    editorActions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        marginTop: '12px',
        paddingTop: '10px',
        borderTop: '1px solid var(--lumiverse-border)',
    },
    addEntryRow: {
        display: 'flex',
        gap: '8px',
        marginTop: '8px',
    },
};

// ─── Auto-execute flag metadata ──────────────────────────────────────

const AUTO_FLAGS = [
    { key: 'executeOnStartup', label: 'On Startup' },
    { key: 'executeOnUser', label: 'On User Message' },
    { key: 'executeOnAi', label: 'On AI Message' },
    { key: 'executeOnChatChange', label: 'On Chat Change' },
    { key: 'executeOnNewChat', label: 'On New Chat' },
    { key: 'executeOnGroupMemberDraft', label: 'On Group Draft' },
];

// ─── Sub-Components ──────────────────────────────────────────────────

function QREntryEditor({ entry, setName, onSaved, onCancel }) {
    const [form, setForm] = useState({ ...entry });
    const [saving, setSaving] = useState(false);

    const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    const handleSave = useCallback(async () => {
        setSaving(true);
        await updateQR(setName, form.id, {
            label: form.label,
            message: form.message,
            icon: form.icon,
            title: form.title,
            automationId: form.automationId,
            isHidden: form.isHidden,
            executeOnStartup: form.executeOnStartup,
            executeOnUser: form.executeOnUser,
            executeOnAi: form.executeOnAi,
            executeOnChatChange: form.executeOnChatChange,
            executeOnNewChat: form.executeOnNewChat,
            executeOnGroupMemberDraft: form.executeOnGroupMemberDraft,
            preventAutoExecute: form.preventAutoExecute,
        });
        setSaving(false);
        onSaved();
    }, [form, setName, onSaved]);

    return (
        <div style={s.editor}>
            {/* Label */}
            <div style={s.editorField}>
                <label style={s.label}>Label</label>
                <input
                    style={s.input}
                    value={form.label}
                    onChange={e => update('label', e.target.value)}
                    placeholder="Button label"
                />
            </div>

            {/* Message */}
            <div style={s.editorField}>
                <label style={s.label}>Message / Command</label>
                <textarea
                    style={s.textarea}
                    value={form.message}
                    onChange={e => update('message', e.target.value)}
                    placeholder="/command or message content"
                />
            </div>

            {/* Icon + Title row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                    <label style={s.label}>Icon (FA class)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            style={{ ...s.input, flex: 1 }}
                            value={form.icon}
                            onChange={e => update('icon', e.target.value)}
                            placeholder="fa-solid fa-bolt"
                        />
                        {form.icon && (
                            <i className={form.icon} style={{ fontSize: '14px', color: 'var(--lumiverse-text-dim)' }} />
                        )}
                    </div>
                </div>
                <div>
                    <label style={s.label}>Title / Tooltip</label>
                    <input
                        style={s.input}
                        value={form.title}
                        onChange={e => update('title', e.target.value)}
                        placeholder="Tooltip text"
                    />
                </div>
            </div>

            {/* Automation ID */}
            <div style={s.editorField}>
                <label style={s.label}>Automation ID</label>
                <input
                    style={s.input}
                    value={form.automationId}
                    onChange={e => update('automationId', e.target.value)}
                    placeholder="Optional automation identifier"
                />
            </div>

            {/* Hidden toggle */}
            <div style={{ ...s.editorField, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ ...s.checkboxRow, margin: 0 }}>
                    <input
                        type="checkbox"
                        checked={form.isHidden}
                        onChange={e => update('isHidden', e.target.checked)}
                    />
                    <span>Hidden</span>
                    {form.isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                </label>
                <label style={{ ...s.checkboxRow, margin: 0, marginLeft: '16px' }}>
                    <input
                        type="checkbox"
                        checked={form.preventAutoExecute}
                        onChange={e => update('preventAutoExecute', e.target.checked)}
                    />
                    <span>Prevent Auto-Execute</span>
                </label>
            </div>

            {/* Auto-execute flags */}
            <div style={s.editorField}>
                <label style={s.label}>Auto-Execute Triggers</label>
                <div style={s.checkboxGrid}>
                    {AUTO_FLAGS.map(flag => (
                        <label key={flag.key} style={s.checkboxRow}>
                            <input
                                type="checkbox"
                                checked={form[flag.key] || false}
                                onChange={e => update(flag.key, e.target.checked)}
                            />
                            <span>{flag.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div style={s.editorActions}>
                <button
                    style={{ ...s.btn, ...s.btnSmall }}
                    onClick={onCancel}
                    type="button"
                >
                    <X size={12} /> Cancel
                </button>
                <button
                    style={{ ...s.btn, ...s.btnSmall, ...s.btnPrimary }}
                    onClick={handleSave}
                    disabled={saving}
                    type="button"
                >
                    <Save size={12} /> {saving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    );
}

function QRSetCard({ set, onRefresh }) {
    const [expanded, setExpanded] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [newLabel, setNewLabel] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);

    const handleToggleGlobal = useCallback(async () => {
        await toggleGlobalSet(set.name, !set.isGlobal);
        onRefresh();
    }, [set, onRefresh]);

    const handleToggleChat = useCallback(async () => {
        await toggleChatSet(set.name, !set.isChat);
        onRefresh();
    }, [set, onRefresh]);

    const handleDeleteSet = useCallback(() => {
        setConfirmAction({
            title: 'Delete QR Set',
            message: `Permanently delete the set "${set.name}" and all its entries?`,
            onConfirm: async () => {
                await deleteSet(set.name);
                setConfirmAction(null);
                onRefresh();
            },
        });
    }, [set.name, onRefresh]);

    const handleAddEntry = useCallback(async () => {
        const label = newLabel.trim();
        if (!label) return;
        await createQR(set.name, label);
        setNewLabel('');
        onRefresh();
    }, [set.name, newLabel, onRefresh]);

    const handleDeleteEntry = useCallback((id, label) => {
        setConfirmAction({
            title: 'Delete Quick Reply',
            message: `Delete the entry "${label || '(untitled)'}"?`,
            onConfirm: async () => {
                await deleteQR(set.name, id);
                setConfirmAction(null);
                setEditingId(null);
                onRefresh();
            },
        });
    }, [set.name, onRefresh]);

    const handleEntrySaved = useCallback(() => {
        setEditingId(null);
        onRefresh();
    }, [onRefresh]);

    const hasAutoFlags = (entry) => AUTO_FLAGS.some(f => entry[f.key]);

    return (
        <div style={s.setCard}>
            {/* Set header — click to expand/collapse */}
            <div
                style={s.setHeader}
                onClick={() => setExpanded(prev => !prev)}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--lumiverse-fill-subtle)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
                {expanded
                    ? <ChevronDown size={14} style={{ flexShrink: 0, color: 'var(--lumiverse-text-dim)' }} />
                    : <ChevronRight size={14} style={{ flexShrink: 0, color: 'var(--lumiverse-text-dim)' }} />
                }
                {set.color && (
                    <div style={{ ...s.setColorDot, background: set.color }} />
                )}
                <span style={s.setName}>{set.name}</span>
                <span style={{ fontSize: '11px', color: 'var(--lumiverse-text-muted)' }}>
                    {set.qrs.length} {set.qrs.length === 1 ? 'entry' : 'entries'}
                </span>
                {set.isGlobal && <span style={{ ...s.badge, ...s.badgeGlobal }}>Global</span>}
                {set.isChat && <span style={{ ...s.badge, ...s.badgeChat }}>Chat</span>}
            </div>

            {/* Expanded body */}
            {expanded && (
                <div style={s.setBody}>
                    {/* Set-level controls */}
                    <div style={s.setControls}>
                        <button
                            style={{ ...s.btn, ...s.btnSmall, ...(set.isGlobal ? s.btnPrimary : {}) }}
                            onClick={handleToggleGlobal}
                            title={set.isGlobal ? 'Remove from global sets' : 'Add to global sets'}
                            type="button"
                        >
                            <Globe size={11} /> {set.isGlobal ? 'Global: ON' : 'Global: OFF'}
                        </button>
                        <button
                            style={{ ...s.btn, ...s.btnSmall, ...(set.isChat ? s.btnPrimary : {}) }}
                            onClick={handleToggleChat}
                            title={set.isChat ? 'Remove from chat sets' : 'Add to chat sets'}
                            type="button"
                        >
                            <MessageCircle size={11} /> {set.isChat ? 'Chat: ON' : 'Chat: OFF'}
                        </button>
                        <button
                            style={{ ...s.btn, ...s.btnSmall, ...s.btnDanger }}
                            onClick={handleDeleteSet}
                            type="button"
                        >
                            <Trash2 size={11} /> Delete Set
                        </button>
                    </div>

                    {/* Entry list */}
                    {set.qrs.map(entry => (
                        <div key={entry.id}>
                            <div
                                style={s.entryRow}
                                onClick={() => setEditingId(editingId === entry.id ? null : entry.id)}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--lumiverse-fill-subtle)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                            >
                                <div style={s.entryIcon}>
                                    {entry.icon
                                        ? <i className={entry.icon} />
                                        : <Zap size={12} />
                                    }
                                </div>
                                <span style={s.entryLabel}>{entry.label || '(untitled)'}</span>
                                <span style={s.entryPreview}>
                                    {(entry.message || '').replace(/\n/g, ' ').slice(0, 60)}
                                </span>
                                <div style={s.entryBadges}>
                                    {entry.isHidden && <span style={s.hiddenBadge}>Hidden</span>}
                                    {hasAutoFlags(entry) && <span style={s.autoBadge}>Auto</span>}
                                </div>
                                <button
                                    style={{ ...s.btn, ...s.btnSmall, ...s.btnDanger, padding: '3px 6px' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteEntry(entry.id, entry.label);
                                    }}
                                    title="Delete entry"
                                    type="button"
                                >
                                    <Trash2 size={11} />
                                </button>
                            </div>

                            {editingId === entry.id && (
                                <QREntryEditor
                                    entry={entry}
                                    setName={set.name}
                                    onSaved={handleEntrySaved}
                                    onCancel={() => setEditingId(null)}
                                />
                            )}
                        </div>
                    ))}

                    {/* Add new entry */}
                    <div style={s.addEntryRow}>
                        <input
                            style={{ ...s.input, flex: 1, fontSize: '12px', padding: '6px 10px' }}
                            value={newLabel}
                            onChange={e => setNewLabel(e.target.value)}
                            placeholder="New entry label"
                            onKeyDown={e => e.key === 'Enter' && handleAddEntry()}
                        />
                        <button
                            style={{ ...s.btn, ...s.btnSmall, ...s.btnPrimary }}
                            onClick={handleAddEntry}
                            disabled={!newLabel.trim()}
                            type="button"
                        >
                            <Plus size={11} /> Add
                        </button>
                    </div>
                </div>
            )}

            {/* Confirmations */}
            <ConfirmationModal
                isOpen={!!confirmAction}
                onConfirm={confirmAction?.onConfirm || (() => {})}
                onCancel={() => setConfirmAction(null)}
                title={confirmAction?.title || ''}
                message={confirmAction?.message || ''}
                variant="danger"
                confirmText="Delete"
            />
        </div>
    );
}

// ─── Main View ───────────────────────────────────────────────────────

export default function QuickRepliesView() {
    const [sets, setSets] = useState([]);
    const [newSetName, setNewSetName] = useState('');
    const available = isQRAvailable();

    const refresh = useCallback(() => {
        if (!available) return;
        setSets(getAllSets());
    }, [available]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const handleCreateSet = useCallback(async () => {
        const name = newSetName.trim();
        if (!name) return;
        await createSet(name);
        setNewSetName('');
        refresh();
    }, [newSetName, refresh]);

    if (!available) {
        return (
            <div className="lumiverse-settings-view" style={s.view}>
                <div style={s.header}>
                    <div style={s.headerTitle}>
                        <Zap size={18} style={{ color: 'var(--lumiverse-primary)' }} />
                        Quick Replies
                    </div>
                </div>
                <div style={s.unavailable}>
                    <p>The Quick Replies v2 extension is not active.</p>
                    <p style={{ marginTop: '8px', fontSize: '12px' }}>
                        Enable it in SillyTavern's Extensions panel to manage quick replies here.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="lumiverse-settings-view" style={s.view}>
            <div style={s.header}>
                <div style={s.headerTitle}>
                    <Zap size={18} style={{ color: 'var(--lumiverse-primary)' }} />
                    Quick Replies
                </div>
            </div>

            {/* Create new set */}
            <div style={s.createBar}>
                <input
                    style={s.input}
                    value={newSetName}
                    onChange={e => setNewSetName(e.target.value)}
                    placeholder="New set name"
                    onKeyDown={e => e.key === 'Enter' && handleCreateSet()}
                />
                <button
                    style={{ ...s.btn, ...s.btnPrimary }}
                    onClick={handleCreateSet}
                    disabled={!newSetName.trim()}
                    type="button"
                >
                    <Plus size={13} /> Create Set
                </button>
            </div>

            {/* Set list */}
            {sets.length === 0 ? (
                <div style={s.unavailable}>
                    <p>No Quick Reply sets found.</p>
                    <p style={{ marginTop: '8px', fontSize: '12px' }}>
                        Create a set above or add one in SillyTavern's Quick Replies panel.
                    </p>
                </div>
            ) : (
                sets.map(set => (
                    <QRSetCard key={set.name} set={set} onRefresh={refresh} />
                ))
            )}
        </div>
    );
}
