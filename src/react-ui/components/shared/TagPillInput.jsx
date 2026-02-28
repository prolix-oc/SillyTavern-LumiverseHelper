import React, { useState, useCallback, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * TagPillInput — Pill-based tag input with inline text field.
 *
 * Renders tags as themed removable pills inside a flex-wrap container.
 * Tags are added via Enter, comma, or blur. Backspace removes last tag
 * when input is empty. Duplicate prevention is built in.
 *
 * @param {Object} props
 * @param {string[]} props.value - Array of tag strings
 * @param {(tags: string[]) => void} props.onChange - Called with updated array
 * @param {string} [props.placeholder] - Placeholder when no tags and empty input
 */
export default function TagPillInput({ value = [], onChange, placeholder = 'Add tag...' }) {
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef(null);

    const addTag = useCallback((raw) => {
        const tag = raw.trim();
        if (!tag) return;
        if (value.includes(tag)) return; // duplicate prevention
        onChange([...value, tag]);
    }, [value, onChange]);

    const removeTag = useCallback((index) => {
        onChange(value.filter((_, i) => i !== index));
    }, [value, onChange]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(inputValue);
            setInputValue('');
        } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
            removeTag(value.length - 1);
        }
    }, [inputValue, value, addTag, removeTag]);

    const handleBlur = useCallback(() => {
        if (inputValue.trim()) {
            addTag(inputValue);
            setInputValue('');
        }
    }, [inputValue, addTag]);

    const handleContainerClick = useCallback(() => {
        inputRef.current?.focus();
    }, []);

    return (
        <div
            className="lumiverse-tag-pill-input"
            onClick={handleContainerClick}
        >
            {value.map((tag, i) => (
                <span key={`${tag}-${i}`} className="lumiverse-tag-pill">
                    <span className="lumiverse-tag-pill-text">{tag}</span>
                    <button
                        className="lumiverse-tag-pill-remove"
                        onClick={(e) => { e.stopPropagation(); removeTag(i); }}
                        type="button"
                        aria-label={`Remove ${tag}`}
                    >
                        <X size={10} strokeWidth={2.5} />
                    </button>
                </span>
            ))}
            <input
                ref={inputRef}
                className="lumiverse-tag-pill-input-field"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                placeholder={value.length === 0 ? placeholder : ''}
                size={1}
            />
        </div>
    );
}
