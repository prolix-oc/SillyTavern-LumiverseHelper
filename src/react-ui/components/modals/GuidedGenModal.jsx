/**
 * GuidedGenModal — Modal form for creating/editing guided generation prompts.
 *
 * Fields: name, content (textarea), position (dropdown), mode (toggle), color.
 * Registered in ModalContainer as 'guidedGen'.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useLumiverseStore } from '../../store/LumiverseContext';
import { saveGuide, deleteGuide } from '../../../lib/guidedGenerationService';

const store = useLumiverseStore;

const POSITIONS = [
    { value: 'system', label: 'System (injected before chat)' },
    { value: 'user_prefix', label: 'Before Message (prepended to user message)' },
    { value: 'user_suffix', label: 'After Message (appended to user message)' },
];

const PRESET_COLORS = [
    null, '#8b82ff', '#ff6b6b', '#4ecdc4', '#ffd93d', '#6c5ce7', '#a8e6cf', '#fd79a8', '#00b894',
];

export default function GuidedGenModal({ onClose }) {
    const modalData = store.getState().ui?.modalData;
    const existing = modalData?.guide || null;

    const [name, setName] = useState(existing?.name || '');
    const [content, setContent] = useState(existing?.content || '');
    const [position, setPosition] = useState(existing?.position || 'system');
    const [mode, setMode] = useState(existing?.mode || 'persistent');
    const [color, setColor] = useState(existing?.color || null);
    const [enabled, setEnabled] = useState(existing?.enabled ?? false);

    const handleSave = useCallback(() => {
        saveGuide({
            id: existing?.id,
            name: name.trim() || 'Untitled Guide',
            content,
            position,
            mode,
            enabled,
            color,
        });
        onClose();
    }, [existing, name, content, position, mode, enabled, color, onClose]);

    const handleDelete = useCallback(() => {
        if (existing?.id) {
            deleteGuide(existing.id);
        }
        onClose();
    }, [existing, onClose]);

    return (
        <div className="lcs-guide-modal-form">
            {/* Name */}
            <div className="lcs-guide-modal-field">
                <label className="lcs-guide-modal-label">Name</label>
                <input
                    className="lcs-guide-modal-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Describe scenery, Inner thoughts..."
                />
            </div>

            {/* Content */}
            <div className="lcs-guide-modal-field">
                <label className="lcs-guide-modal-label">Prompt Content</label>
                <textarea
                    className="lcs-guide-modal-input lcs-guide-modal-textarea"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your instruction here..."
                />
                <span className="lcs-guide-modal-hint">
                    Supports {'{{macros}}'} — e.g. {'{{char}}'}, {'{{user}}'}, {'{{random}}'}
                </span>
            </div>

            {/* Position + Mode row */}
            <div className="lcs-guide-modal-row">
                <div className="lcs-guide-modal-field" style={{ flex: 1 }}>
                    <label className="lcs-guide-modal-label">Position</label>
                    <select
                        className="lcs-guide-modal-select"
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                    >
                        {POSITIONS.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>
                </div>
                <div className="lcs-guide-modal-field" style={{ flex: 1 }}>
                    <label className="lcs-guide-modal-label">Mode</label>
                    <label className="lcs-guide-modal-toggle">
                        <div
                            className={`lcs-guide-modal-toggle-track${mode === 'persistent' ? ' lcs-guide-modal-toggle-track--active' : ''}`}
                            onClick={() => setMode(m => m === 'persistent' ? 'oneshot' : 'persistent')}
                        >
                            <div className="lcs-guide-modal-toggle-thumb" />
                        </div>
                        <span>{mode === 'persistent' ? 'Persistent' : 'One-shot'}</span>
                    </label>
                </div>
            </div>

            {/* Color picker */}
            <div className="lcs-guide-modal-field">
                <label className="lcs-guide-modal-label">Accent Color</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {PRESET_COLORS.map((c, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setColor(c)}
                            style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '6px',
                                border: c === color
                                    ? '2px solid var(--lumiverse-primary-text, rgba(160,150,255,0.95))'
                                    : '1px solid var(--lcs-glass-border, rgba(255,255,255,0.08))',
                                background: c || 'var(--lumiverse-fill-subtle, rgba(255,255,255,0.04))',
                                cursor: 'pointer',
                                padding: 0,
                            }}
                            title={c || 'None'}
                        />
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="lcs-guide-modal-actions">
                {existing?.id && (
                    <button
                        className="lcs-guide-modal-btn lcs-guide-modal-btn--danger"
                        onClick={handleDelete}
                        type="button"
                    >
                        Delete
                    </button>
                )}
                <div style={{ flex: 1 }} />
                <button
                    className="lcs-guide-modal-btn"
                    onClick={onClose}
                    type="button"
                >
                    Cancel
                </button>
                <button
                    className="lcs-guide-modal-btn lcs-guide-modal-btn--primary"
                    onClick={handleSave}
                    type="button"
                >
                    {existing?.id ? 'Save' : 'Create'}
                </button>
            </div>
        </div>
    );
}
