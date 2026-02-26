/**
 * MessageEditArea — Inline editing for message content and reasoning
 *
 * Renders auto-resizing textareas for message content (always) and reasoning
 * (assistant messages only, when reasoning exists). Glassmorphic styling
 * consistent with the Chat Sheld input area.
 *
 * Keyboard: Escape → cancel, Ctrl+Enter → save
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { Save, X } from 'lucide-react';

/** Max height before the textarea becomes scrollable */
const MAX_EDIT_HEIGHT = 45 * 16; // ~45em

/**
 * Auto-resize a textarea to fit its content, capping at MAX_EDIT_HEIGHT.
 * Beyond the cap the textarea scrolls instead of growing.
 * @param {HTMLTextAreaElement} el
 */
function autoResize(el) {
    if (!el) return;
    el.style.height = 'auto';
    const capped = Math.min(el.scrollHeight, MAX_EDIT_HEIGHT);
    el.style.height = capped + 'px';
    el.style.overflowY = el.scrollHeight > MAX_EDIT_HEIGHT ? 'auto' : 'hidden';
}

export default function MessageEditArea({ mesId, content, reasoning, isUser, isSystem, onSave, onCancel }) {
    const contentRef = useRef(null);
    const reasoningRef = useRef(null);

    // Show reasoning textarea for assistant messages that have reasoning
    const showReasoning = !isUser && !isSystem && reasoning != null;

    // Auto-resize on mount
    useEffect(() => {
        autoResize(contentRef.current);
        autoResize(reasoningRef.current);
    }, []);

    // Handle input for auto-resize
    const handleInput = useCallback((e) => {
        autoResize(e.target);
    }, []);

    // Keyboard shortcuts
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSave({
                content: contentRef.current?.value ?? content,
                reasoning: showReasoning ? (reasoningRef.current?.value ?? reasoning) : undefined,
            });
        }
    }, [onCancel, onSave, content, reasoning, showReasoning]);

    const handleSaveClick = useCallback(() => {
        onSave({
            content: contentRef.current?.value ?? content,
            reasoning: showReasoning ? (reasoningRef.current?.value ?? reasoning) : undefined,
        });
    }, [onSave, content, reasoning, showReasoning]);

    return (
        <div className="lcs-edit-area" onKeyDown={handleKeyDown}>
            {showReasoning && (
                <>
                    <label className="lcs-edit-label">Reasoning</label>
                    <textarea
                        ref={reasoningRef}
                        className="lcs-edit-textarea lcs-edit-textarea--reasoning"
                        defaultValue={reasoning || ''}
                        onInput={handleInput}
                        rows={3}
                        placeholder="Reasoning / thinking content..."
                    />
                </>
            )}
            <label className="lcs-edit-label">Message</label>
            <textarea
                ref={contentRef}
                className="lcs-edit-textarea"
                defaultValue={content}
                onInput={handleInput}
                rows={3}
                autoFocus
                placeholder="Message content..."
            />
            <div className="lcs-edit-actions">
                <button
                    className="lcs-edit-btn lcs-edit-btn--cancel"
                    onClick={onCancel}
                    type="button"
                    title="Cancel (Escape)"
                >
                    <X size={14} />
                    <span>Cancel</span>
                </button>
                <button
                    className="lcs-edit-btn lcs-edit-btn--save"
                    onClick={handleSaveClick}
                    type="button"
                    title="Save (Ctrl+Enter)"
                >
                    <Save size={14} />
                    <span>Save</span>
                </button>
            </div>
        </div>
    );
}
