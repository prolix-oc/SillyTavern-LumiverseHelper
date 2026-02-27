/**
 * GuidedGenPopover — Glass popover for managing guided generation prompts.
 *
 * Lists all guides with toggle/fire buttons, edit actions,
 * and a "New Guide" button at the bottom.
 */

import React, { useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import {
    Compass,
    Plus,
    Pencil,
    Power,
    Zap,
} from 'lucide-react';
import { useLumiverseStore } from '../../store/LumiverseContext';
import { toggleGuide } from '../../../lib/guidedGenerationService';

const store = useLumiverseStore;
const selectGuides = () => store.getState().guidedGenerations || [];

const POSITION_LABELS = {
    system: 'System',
    user_prefix: 'Before Msg',
    user_suffix: 'After Msg',
};

export default function GuidedGenPopover({ onClose }) {
    const guides = useSyncExternalStore(store.subscribe, selectGuides, selectGuides);
    const menuRef = useRef(null);

    // Close on click outside (deferred)
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    // Close on Escape
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const handleToggle = useCallback((id) => {
        toggleGuide(id);
    }, []);

    const openSettingsToGuides = useCallback(() => {
        onClose();
        const ui = store.getState().ui;
        store.setState({
            ui: { ...ui, settingsModal: { isOpen: true, activeView: 'guidedGen' } },
        });
    }, [onClose]);

    const isEmpty = guides.length === 0;

    return (
        <div className="lcs-guide-popover" ref={menuRef}>
            {isEmpty ? (
                <div className="lcs-guide-empty">
                    <Compass size={20} style={{ opacity: 0.4 }} />
                    <span>No guided generations</span>
                    <span style={{ fontSize: '11px', opacity: 0.6 }}>
                        Create custom prompts that attach to your messages
                    </span>
                </div>
            ) : (
                <div className="lcs-guide-list">
                    {guides.map((g) => (
                        <div className="lcs-guide-item" key={g.id}>
                            {g.color && (
                                <div
                                    className="lcs-guide-item-color"
                                    style={{ background: g.color }}
                                />
                            )}
                            <div className="lcs-guide-item-info">
                                <span className="lcs-guide-item-name">{g.name}</span>
                                <div className="lcs-guide-item-meta">
                                    <span className={`lcs-guide-mode-badge${g.mode === 'persistent' ? ' lcs-guide-mode-badge--persistent' : ''}`}>
                                        {g.mode === 'persistent' ? 'Persistent' : 'One-shot'}
                                    </span>
                                    <span className="lcs-guide-position-badge">
                                        {POSITION_LABELS[g.position] || g.position}
                                    </span>
                                </div>
                            </div>
                            <div className="lcs-guide-item-actions">
                                <button
                                    className="lcs-guide-edit-btn"
                                    onClick={openSettingsToGuides}
                                    title="Edit guide"
                                    type="button"
                                >
                                    <Pencil size={13} />
                                </button>
                                {g.mode === 'persistent' ? (
                                    <button
                                        className={`lcs-guide-toggle${g.enabled ? ' lcs-guide-toggle--active' : ''}`}
                                        onClick={() => handleToggle(g.id)}
                                        title={g.enabled ? 'Disable' : 'Enable'}
                                        type="button"
                                    >
                                        <Power size={14} />
                                    </button>
                                ) : (
                                    <button
                                        className={`lcs-guide-fire-btn${g.enabled ? ' lcs-guide-toggle--active' : ''}`}
                                        onClick={() => handleToggle(g.id)}
                                        title={g.enabled ? 'Armed — click to disarm' : 'Arm for next generation'}
                                        type="button"
                                    >
                                        <Zap size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <button
                className="lcs-guide-new-btn"
                onClick={openSettingsToGuides}
                type="button"
            >
                <Plus size={14} />
                <span>New Guide</span>
            </button>
        </div>
    );
}
