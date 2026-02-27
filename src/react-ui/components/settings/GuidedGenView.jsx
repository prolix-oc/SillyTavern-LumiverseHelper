/**
 * GuidedGenView — Full Guided Generations management UI for Lumiverse settings.
 *
 * Provides CRUD for guided generation prompts with inline editing,
 * styled with Lumiverse's adaptive theming (var(--lumiverse-*)).
 */

import React, { useState, useCallback, useSyncExternalStore } from 'react';
import {
    Compass, Plus, Trash2, Pencil, Power, Zap, Save, X,
} from 'lucide-react';
import { useLumiverseStore } from '../../store/LumiverseContext';
import { saveGuide, deleteGuide, toggleGuide } from '../../../lib/guidedGenerationService';
import ConfirmationModal from '../shared/ConfirmationModal';

const store = useLumiverseStore;
const selectGuides = () => store.getState().guidedGenerations || [];

const POSITIONS = [
    { value: 'system', label: 'System' },
    { value: 'user_prefix', label: 'Before Message' },
    { value: 'user_suffix', label: 'After Message' },
];

const PRESET_COLORS = [
    null, '#8b82ff', '#ff6b6b', '#4ecdc4', '#ffd93d', '#6c5ce7', '#a8e6cf', '#fd79a8', '#00b894',
];

const s = {
    view: { padding: '20px' },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px',
    },
    headerTitle: {
        display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: '16px', fontWeight: 600, color: 'var(--lumiverse-text)',
    },
    description: {
        fontSize: '13px', color: 'var(--lumiverse-text-muted)', lineHeight: '1.5', marginBottom: '16px',
    },
    addBtn: {
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '8px 16px', border: '1px solid var(--lumiverse-border)',
        borderRadius: '10px', background: 'var(--lumiverse-fill-subtle)',
        color: 'var(--lumiverse-text)', fontSize: '13px', fontWeight: 500,
        cursor: 'pointer',
    },
    list: { display: 'flex', flexDirection: 'column', gap: '8px' },
    card: {
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '12px', background: 'var(--lumiverse-fill-subtle)',
        overflow: 'hidden',
    },
    cardHeader: {
        display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px',
    },
    cardColor: { width: '4px', height: '32px', borderRadius: '2px', flexShrink: 0 },
    cardInfo: { flex: 1, minWidth: 0 },
    cardName: {
        fontSize: '14px', fontWeight: 600, color: 'var(--lumiverse-text)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    },
    cardMeta: {
        display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px',
    },
    badge: {
        fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.03em', padding: '1px 6px', borderRadius: '4px',
        background: 'var(--lumiverse-fill)', color: 'var(--lumiverse-text-muted)',
    },
    badgePersistent: {
        background: 'var(--lumiverse-primary-008)', color: 'var(--lumiverse-primary-text)',
    },
    cardActions: { display: 'flex', gap: '4px', flexShrink: 0 },
    iconBtn: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '32px', height: '32px', border: 'none', borderRadius: '8px',
        background: 'transparent', color: 'var(--lumiverse-text-muted)',
        cursor: 'pointer',
    },
    iconBtnActive: { color: 'var(--lumiverse-primary-text)' },
    // Editor form
    editor: {
        padding: '14px', borderTop: '1px solid var(--lumiverse-border)',
        display: 'flex', flexDirection: 'column', gap: '12px',
    },
    field: { display: 'flex', flexDirection: 'column', gap: '4px' },
    label: {
        fontSize: '11px', fontWeight: 600, color: 'var(--lumiverse-text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.03em',
    },
    input: {
        padding: '8px 12px', border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px', background: 'var(--lumiverse-fill-subtle)',
        color: 'var(--lumiverse-text)', fontSize: '13px', fontFamily: 'inherit',
        outline: 'none',
    },
    textarea: { minHeight: '100px', resize: 'vertical' },
    hint: { fontSize: '11px', color: 'var(--lumiverse-text-muted)' },
    row: { display: 'flex', gap: '12px' },
    select: {
        padding: '8px 12px', border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px', background: 'var(--lumiverse-fill-subtle)',
        color: 'var(--lumiverse-text)', fontSize: '13px', fontFamily: 'inherit',
        outline: 'none', cursor: 'pointer',
    },
    colorRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
    colorSwatch: (c, active) => ({
        width: '24px', height: '24px', borderRadius: '6px', padding: 0, cursor: 'pointer',
        border: active
            ? '2px solid var(--lumiverse-primary-text)'
            : '1px solid var(--lumiverse-border)',
        background: c || 'var(--lumiverse-fill-subtle)',
    }),
    editorActions: {
        display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px',
    },
    saveBtn: {
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '7px 16px', border: '1px solid var(--lumiverse-primary-040)',
        borderRadius: '8px', background: 'var(--lumiverse-primary-020)',
        color: 'var(--lumiverse-primary-text)', fontSize: '13px', fontWeight: 500,
        cursor: 'pointer',
    },
    cancelBtn: {
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '7px 16px', border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px', background: 'var(--lumiverse-fill-subtle)',
        color: 'var(--lumiverse-text)', fontSize: '13px', fontWeight: 500,
        cursor: 'pointer',
    },
    deleteBtn: {
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '7px 16px', border: '1px solid rgba(255,100,100,0.2)',
        borderRadius: '8px', background: 'transparent',
        color: 'var(--lumiverse-danger)', fontSize: '13px', fontWeight: 500,
        cursor: 'pointer',
    },
    empty: {
        padding: '40px 20px', textAlign: 'center',
        color: 'var(--lumiverse-text-muted)', fontSize: '13px', lineHeight: '1.6',
    },
    toggleWrapper: {
        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
        fontSize: '13px', color: 'var(--lumiverse-text)',
    },
    toggleTrack: (active) => ({
        width: '36px', height: '20px', borderRadius: '10px', position: 'relative',
        background: active ? 'var(--lumiverse-primary-040)' : 'var(--lumiverse-fill)',
        transition: 'background 0.15s ease', flexShrink: 0,
    }),
    toggleThumb: (active) => ({
        position: 'absolute', top: '2px', left: '2px',
        width: '16px', height: '16px', borderRadius: '50%',
        background: 'var(--lumiverse-text)',
        transform: active ? 'translateX(16px)' : 'none',
        transition: 'transform 0.15s ease',
    }),
};

function GuideCard({ guide, isEditing, onStartEdit, onSave, onDelete }) {
    const [name, setName] = useState(guide.name);
    const [content, setContent] = useState(guide.content);
    const [position, setPosition] = useState(guide.position);
    const [mode, setMode] = useState(guide.mode);
    const [color, setColor] = useState(guide.color);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const handleSave = useCallback(() => {
        onSave({
            ...guide,
            name: name.trim() || 'Untitled Guide',
            content, position, mode, color,
        });
    }, [guide, name, content, position, mode, color, onSave]);

    return (
        <div style={s.card}>
            <div style={s.cardHeader}>
                {guide.color && (
                    <div style={{ ...s.cardColor, background: guide.color }} />
                )}
                <div style={s.cardInfo}>
                    <div style={s.cardName}>{guide.name}</div>
                    <div style={s.cardMeta}>
                        <span style={{
                            ...s.badge,
                            ...(guide.mode === 'persistent' ? s.badgePersistent : {}),
                        }}>
                            {guide.mode === 'persistent' ? 'Persistent' : 'One-shot'}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--lumiverse-text-muted)' }}>
                            {POSITIONS.find(p => p.value === guide.position)?.label || guide.position}
                        </span>
                    </div>
                </div>
                <div style={s.cardActions}>
                    <button
                        style={s.iconBtn}
                        onClick={() => onStartEdit(guide.id)}
                        title="Edit"
                        type="button"
                    >
                        <Pencil size={14} />
                    </button>
                    <button
                        style={{
                            ...s.iconBtn,
                            ...(guide.enabled ? s.iconBtnActive : {}),
                        }}
                        onClick={() => toggleGuide(guide.id)}
                        title={guide.enabled ? 'Disable' : 'Enable'}
                        type="button"
                    >
                        {guide.mode === 'persistent' ? <Power size={14} /> : <Zap size={14} />}
                    </button>
                </div>
            </div>

            {isEditing && (
                <div style={s.editor}>
                    <div style={s.field}>
                        <label style={s.label}>Name</label>
                        <input
                            style={s.input}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Guide name..."
                        />
                    </div>
                    <div style={s.field}>
                        <label style={s.label}>Prompt Content</label>
                        <textarea
                            style={{ ...s.input, ...s.textarea }}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Write your instruction here..."
                        />
                        <span style={s.hint}>
                            Supports {'{{macros}}'} — e.g. {'{{char}}'}, {'{{user}}'}
                        </span>
                    </div>
                    <div style={s.row}>
                        <div style={{ ...s.field, flex: 1 }}>
                            <label style={s.label}>Position</label>
                            <select
                                style={s.select}
                                value={position}
                                onChange={(e) => setPosition(e.target.value)}
                            >
                                {POSITIONS.map(p => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ ...s.field, flex: 1 }}>
                            <label style={s.label}>Mode</label>
                            <div
                                style={s.toggleWrapper}
                                onClick={() => setMode(m => m === 'persistent' ? 'oneshot' : 'persistent')}
                            >
                                <div style={s.toggleTrack(mode === 'persistent')}>
                                    <div style={s.toggleThumb(mode === 'persistent')} />
                                </div>
                                <span>{mode === 'persistent' ? 'Persistent' : 'One-shot'}</span>
                            </div>
                        </div>
                    </div>
                    <div style={s.field}>
                        <label style={s.label}>Accent Color</label>
                        <div style={s.colorRow}>
                            {PRESET_COLORS.map((c, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    style={s.colorSwatch(c, c === color)}
                                    title={c || 'None'}
                                />
                            ))}
                        </div>
                    </div>
                    <div style={s.editorActions}>
                        <button style={s.deleteBtn} onClick={() => setConfirmDelete(true)} type="button">
                            <Trash2 size={13} /> Delete
                        </button>
                        <div style={{ flex: 1 }} />
                        <button style={s.cancelBtn} onClick={() => onStartEdit(null)} type="button">
                            <X size={13} /> Cancel
                        </button>
                        <button style={s.saveBtn} onClick={handleSave} type="button">
                            <Save size={13} /> Save
                        </button>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmDelete}
                onConfirm={() => { setConfirmDelete(false); onDelete(guide.id); }}
                onCancel={() => setConfirmDelete(false)}
                title="Delete Guide"
                message={`Delete "${guide.name}"? This cannot be undone.`}
                variant="danger"
                confirmText="Delete"
                zIndex={10100}
            />
        </div>
    );
}

export default function GuidedGenView() {
    const guides = useSyncExternalStore(store.subscribe, selectGuides, selectGuides);
    const [editingId, setEditingId] = useState(null);

    const handleAdd = useCallback(() => {
        const newGuide = saveGuide({
            name: 'New Guide',
            content: '',
            position: 'system',
            mode: 'persistent',
            enabled: false,
            color: null,
        });
        setEditingId(newGuide.id);
    }, []);

    const handleSave = useCallback((guide) => {
        saveGuide(guide);
        setEditingId(null);
    }, []);

    const handleDelete = useCallback((id) => {
        deleteGuide(id);
        setEditingId(null);
    }, []);

    return (
        <div className="lumiverse-settings-view" style={s.view}>
            <div style={s.header}>
                <div style={s.headerTitle}>
                    <Compass size={18} />
                    <span>Guided Generations</span>
                </div>
                <button style={s.addBtn} onClick={handleAdd} type="button">
                    <Plus size={14} /> New Guide
                </button>
            </div>
            <p style={s.description}>
                Create custom prompts that automatically attach to your messages during generation.
                Persistent guides stay active across messages. One-shot guides fire once and deactivate.
            </p>

            {guides.length === 0 ? (
                <div style={s.empty}>
                    <Compass size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
                    <div>No guided generations configured</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                        Click "New Guide" to create your first custom prompt
                    </div>
                </div>
            ) : (
                <div style={s.list}>
                    {guides.map(g => (
                        <GuideCard
                            key={g.id}
                            guide={g}
                            isEditing={editingId === g.id}
                            onStartEdit={setEditingId}
                            onSave={handleSave}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
