import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Type } from 'lucide-react';
import useFixedPositionFix from '../../hooks/useFixedPositionFix';
import { highlightContent } from '../../lib/syntaxHighlighter';

/**
 * TextExpanderModal — Fullscreen text editor with live syntax highlighting.
 *
 * Uses the "transparent textarea over highlighted overlay" technique:
 * a <pre> renders color-coded HTML (pointer-events: none), while a
 * transparent <textarea> on top captures input and shows the caret.
 * Scroll positions are synced on every scroll event.
 *
 * Portal-rendered to document.body (same pattern as ConfirmationModal).
 * Follows the `.lumiverse-modal` pattern for theme integration:
 *   - Surface: var(--lumiverse-bg)
 *   - Header/footer: var(--lumiverse-bg-elevated)
 *   - Editor well: var(--lumiverse-fill-subtle)
 *   - Shadows: var(--lumiverse-shadow-lg)
 *   - All colors derive from user's active theme
 */
const TextExpanderModal = ({ isOpen, onClose, value, onChange, title }) => {
    const textareaRef = useRef(null);
    const overlayRef = useRef(null);

    useFixedPositionFix(isOpen);

    // Focus textarea on open
    useEffect(() => {
        if (isOpen) {
            const t = setTimeout(() => textareaRef.current?.focus(), 80);
            return () => clearTimeout(t);
        }
    }, [isOpen]);

    // Escape to close
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    // Scroll sync: textarea → overlay
    const syncScroll = useCallback(() => {
        const ta = textareaRef.current;
        const ov = overlayRef.current;
        if (ta && ov) {
            ov.scrollTop = ta.scrollTop;
            ov.scrollLeft = ta.scrollLeft;
        }
    }, []);

    const handleChange = useCallback((e) => {
        onChange(e.target.value);
    }, [onChange]);

    const handleBackdrop = useCallback((e) => {
        if (e.target === e.currentTarget) onClose();
    }, [onClose]);

    const charCount = (value || '').length;
    const lineCount = (value || '').split('\n').length;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="lce-expander-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={handleBackdrop}
                >
                    <motion.div
                        className="lce-expander-container"
                        initial={{ opacity: 0, scale: 0.97, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 8 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    >
                        {/* Header */}
                        <div className="lce-expander-header">
                            <div className="lce-expander-header-left">
                                <span className="lce-expander-title">{title || 'Edit'}</span>
                                <span className="lce-expander-meta">
                                    {charCount.toLocaleString()} chars &middot; {lineCount} {lineCount === 1 ? 'line' : 'lines'}
                                </span>
                            </div>
                            <button
                                className="lce-expander-close"
                                onClick={onClose}
                                type="button"
                                aria-label="Close"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body: overlay + textarea */}
                        <div className="lce-expander-body">
                            <pre
                                ref={overlayRef}
                                className="lce-expander-overlay"
                                aria-hidden="true"
                                dangerouslySetInnerHTML={{ __html: highlightContent(value) + '\n' }}
                            />
                            <textarea
                                ref={textareaRef}
                                className="lce-expander-textarea"
                                value={value || ''}
                                onChange={handleChange}
                                onScroll={syncScroll}
                                spellCheck={false}
                            />
                        </div>

                        {/* Footer */}
                        <div className="lce-expander-footer">
                            <button
                                className="lumiverse-ce-btn lumiverse-ce-btn--primary"
                                onClick={onClose}
                                type="button"
                            >
                                Done
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default TextExpanderModal;
