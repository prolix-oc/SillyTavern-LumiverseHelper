import React, { useCallback, useRef } from 'react';
import clsx from 'clsx';
import { highlightContent } from '../../lib/syntaxHighlighter';

/**
 * SyntaxTextArea — Inline textarea with live syntax highlighting overlay.
 *
 * Uses the "transparent textarea over highlighted <pre>" technique
 * (same as TextExpanderModal) but rendered inline with a fixed row height.
 *
 * The <pre> overlay renders color-coded HTML (pointer-events: none), while
 * a transparent <textarea> on top captures input and shows the caret.
 * Scroll positions are synced on every scroll event.
 */
export default function SyntaxTextArea({ value, onChange, rows = 6, placeholder, className }) {
    const textareaRef = useRef(null);
    const overlayRef = useRef(null);

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

    // Compute height from rows — matches the monospace line-height (1.65 * 13px ≈ 21.45px)
    // plus vertical padding (12px * 2 = 24px)
    const height = Math.round(rows * 21.45 + 24);

    return (
        <div
            className={clsx('lumiverse-syntax-textarea', className)}
            style={{ height: `${height}px` }}
        >
            <pre
                ref={overlayRef}
                className="lumiverse-syntax-textarea-overlay"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: highlightContent(value) + '\n' }}
            />
            <textarea
                ref={textareaRef}
                className="lumiverse-syntax-textarea-input"
                value={value || ''}
                onChange={handleChange}
                onScroll={syncScroll}
                placeholder={placeholder}
                spellCheck={false}
            />
        </div>
    );
}
