/**
 * AuthorsNotePanel — Side panel (desktop) for editing Author's Note metadata.
 * AuthorsNoteModalContent — Modal content (mobile) for the same.
 *
 * Both share AuthorsNoteForm which reads/writes chat metadata
 * (note_prompt, note_depth, note_position, note_role, note_interval)
 * via chatSheldService helpers. Auto-saves with debounce on every field change.
 */

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { X, ArrowLeftRight } from 'lucide-react';
import {
    readAuthorNoteMetadata,
    writeAuthorNoteMetadata,
    closeAuthorNotePanel,
} from '../../../lib/chatSheldService';
import { getTokenCountAsync } from '../../../stContext';
import { useLumiverseStore } from '../../store/LumiverseContext';

const store = useLumiverseStore;

const selectPanelOpen = () => store.getState().chatSheld?.authorNotePanelOpen || false;
const selectPanelSide = () => store.getState().authorNotePanelSide || 'right';

// Position labels and values matching ST's Author's Note system
const POSITIONS = [
    { value: 2, label: 'Before Main Prompt' },
    { value: 0, label: 'After Main Prompt' },
    { value: 1, label: 'In-chat @ Depth' },
];

const ROLES = [
    { value: 0, label: 'System' },
    { value: 1, label: 'User' },
    { value: 2, label: 'Assistant' },
];

// ── Shared Form ────────────────────────────────────────────────────────

/**
 * Shared form body used by both the side panel and the modal.
 * @param {{ isOpen: boolean }} props
 */
function AuthorsNoteForm({ isOpen }) {
    const [noteText, setNoteText] = useState('');
    const [position, setPosition] = useState(1);
    const [depth, setDepth] = useState(4);
    const [role, setRole] = useState(0);
    const [interval, setInterval_] = useState(1);
    const [tokenCount, setTokenCount] = useState(null);

    const saveTimerRef = useRef(null);
    const tokenTimerRef = useRef(null);

    // On open: read fresh metadata
    useEffect(() => {
        if (!isOpen) return;
        const meta = readAuthorNoteMetadata();
        setNoteText(meta.note_prompt);
        setPosition(meta.note_position);
        setDepth(meta.note_depth);
        setRole(meta.note_role);
        setInterval_(meta.note_interval);
        setTokenCount(null);

        if (meta.note_prompt) {
            const counter = getTokenCountAsync();
            if (counter) {
                counter(meta.note_prompt).then(count => setTokenCount(count)).catch(() => {});
            }
        }
    }, [isOpen]);

    const scheduleSave = useCallback((data) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            writeAuthorNoteMetadata(data);
        }, 400);
    }, []);

    const scheduleTokenCount = useCallback((text) => {
        if (tokenTimerRef.current) clearTimeout(tokenTimerRef.current);
        if (!text) {
            setTokenCount(0);
            return;
        }
        tokenTimerRef.current = setTimeout(() => {
            const counter = getTokenCountAsync();
            if (counter) {
                counter(text).then(count => setTokenCount(count)).catch(() => {});
            }
        }, 500);
    }, []);

    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            if (tokenTimerRef.current) clearTimeout(tokenTimerRef.current);
        };
    }, []);

    const handleTextChange = useCallback((e) => {
        const val = e.target.value;
        setNoteText(val);
        scheduleSave({ note_prompt: val });
        scheduleTokenCount(val);
    }, [scheduleSave, scheduleTokenCount]);

    const handlePositionChange = useCallback((val) => {
        const numVal = Number(val);
        setPosition(numVal);
        scheduleSave({ note_position: numVal });
    }, [scheduleSave]);

    const handleDepthChange = useCallback((e) => {
        const val = Math.max(0, Math.min(9999, Number(e.target.value) || 0));
        setDepth(val);
        scheduleSave({ note_depth: val });
    }, [scheduleSave]);

    const handleRoleChange = useCallback((e) => {
        const val = Number(e.target.value);
        setRole(val);
        scheduleSave({ note_role: val });
    }, [scheduleSave]);

    const handleIntervalChange = useCallback((e) => {
        const val = Math.max(0, Math.min(9999, Number(e.target.value) || 0));
        setInterval_(val);
        scheduleSave({ note_interval: val });
    }, [scheduleSave]);

    return (
        <div className="lcs-an-panel-body">
            {/* Note Text */}
            <div className="lcs-an-field">
                <label className="lcs-an-label">Note</label>
                <textarea
                    className="lcs-an-textarea"
                    rows={8}
                    value={noteText}
                    onChange={handleTextChange}
                    placeholder="Write instructions or context for the AI..."
                />
                <div className="lcs-an-token-count">
                    {tokenCount !== null ? `${tokenCount} tokens` : ''}
                </div>
            </div>

            {/* Position */}
            <div className="lcs-an-field">
                <label className="lcs-an-label">Position</label>
                <div className="lcs-an-radio-group">
                    {POSITIONS.map(p => (
                        <label key={p.value} className="lcs-an-radio-label">
                            <input
                                type="radio"
                                name="an-position"
                                className="lcs-an-radio"
                                checked={position === p.value}
                                onChange={() => handlePositionChange(p.value)}
                            />
                            <span>{p.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Depth — visible when position is "In-chat @ Depth" (1) */}
            {position === 1 && (
                <div className="lcs-an-field">
                    <label className="lcs-an-label">Depth</label>
                    <input
                        type="number"
                        className="lcs-an-input"
                        min={0}
                        max={9999}
                        value={depth}
                        onChange={handleDepthChange}
                    />
                </div>
            )}

            {/* Role — visible when position is "In-chat @ Depth" (1) */}
            {position === 1 && (
                <div className="lcs-an-field">
                    <label className="lcs-an-label">Role</label>
                    <select
                        className="lcs-an-select"
                        value={role}
                        onChange={handleRoleChange}
                    >
                        {ROLES.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Insertion Frequency */}
            <div className="lcs-an-field">
                <label className="lcs-an-label">Insertion Frequency</label>
                <input
                    type="number"
                    className="lcs-an-input"
                    min={0}
                    max={9999}
                    value={interval}
                    onChange={handleIntervalChange}
                />
                <span className="lcs-an-helper">0 = Disable, 1 = Always</span>
            </div>
        </div>
    );
}

// ── Side Panel (desktop) ───────────────────────────────────────────────

export default function AuthorsNotePanel() {
    const isOpen = useSyncExternalStore(store.subscribe, selectPanelOpen, selectPanelOpen);
    const side = useSyncExternalStore(store.subscribe, selectPanelSide, selectPanelSide);

    const panelRef = useRef(null);

    // Swap side
    const handleSwapSide = useCallback(() => {
        const newSide = side === 'right' ? 'left' : 'right';
        store.setState({ authorNotePanelSide: newSide });
    }, [side]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') closeAuthorNotePanel();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen]);

    // Close on click outside (deferred mousedown)
    useEffect(() => {
        if (!isOpen) return;
        let handler;
        const timer = setTimeout(() => {
            handler = (e) => {
                if (panelRef.current && !panelRef.current.contains(e.target)) {
                    closeAuthorNotePanel();
                }
            };
            document.addEventListener('mousedown', handler);
        }, 0);
        return () => {
            clearTimeout(timer);
            if (handler) document.removeEventListener('mousedown', handler);
        };
    }, [isOpen]);

    const sideClass = side === 'left' ? 'lcs-an-panel--left' : 'lcs-an-panel--right';
    const openClass = isOpen ? ' lcs-an-panel--open' : '';

    return (
        <div className={`lcs-an-panel ${sideClass}${openClass}`} ref={panelRef}>
            <div className="lcs-an-panel-header">
                <button
                    className="lcs-an-header-btn"
                    onClick={handleSwapSide}
                    title={`Move to ${side === 'right' ? 'left' : 'right'} side`}
                    type="button"
                >
                    <ArrowLeftRight size={14} />
                </button>
                <span className="lcs-an-title">Author's Note</span>
                <button
                    className="lcs-an-header-btn"
                    onClick={closeAuthorNotePanel}
                    title="Close"
                    type="button"
                >
                    <X size={14} />
                </button>
            </div>

            <AuthorsNoteForm isOpen={isOpen} />
        </div>
    );
}

// ── Modal Content (mobile) ─────────────────────────────────────────────

/**
 * Modal-wrapped Author's Note for mobile. Rendered by ModalContainer
 * which handles useFixedPositionFix, backdrop, and escape/click-outside.
 */
export function AuthorsNoteModalContent({ onClose }) {
    return (
        <div className="lcs-an-modal-content">
            <div className="lcs-an-panel-header">
                <span className="lcs-an-title" style={{ paddingLeft: 36 }}>Author's Note</span>
                <button
                    className="lcs-an-header-btn"
                    onClick={onClose}
                    title="Close"
                    type="button"
                >
                    <X size={14} />
                </button>
            </div>
            <AuthorsNoteForm isOpen={true} />
        </div>
    );
}
