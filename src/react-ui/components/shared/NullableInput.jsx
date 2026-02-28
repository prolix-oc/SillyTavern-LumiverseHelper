/**
 * NullableInput — Reusable override input for nullable fields.
 *
 * When unchecked (null), field uses the global default.
 * When checked, shows the actual input (number or toggle).
 *
 * Used for: scanDepth, caseSensitive, matchWholeWords, useGroupScoring,
 * sticky, cooldown, delay.
 */

import React from 'react';

const s = {
    container: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    checkboxLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: 'var(--lumiverse-text-muted)',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
    },
    checkbox: {
        width: '14px',
        height: '14px',
        accentColor: 'var(--lumiverse-primary)',
        cursor: 'pointer',
    },
    numberInput: {
        width: '80px',
        padding: '6px 8px',
        background: 'var(--lumiverse-bg, rgba(0,0,0,0.2))',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '6px',
        color: 'var(--lumiverse-text)',
        fontSize: '13px',
        fontFamily: 'inherit',
    },
    toggleContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    },
    toggleLabel: {
        fontSize: '12px',
        color: 'var(--lumiverse-text-muted)',
    },
};

export default function NullableInput({
    value,
    onChange,
    label = 'Override',
    type = 'number', // 'number' | 'toggle'
    min,
    max,
    step,
    placeholder,
}) {
    const isOverridden = value !== null && value !== undefined;

    const handleToggleOverride = () => {
        if (isOverridden) {
            onChange(null);
        } else {
            // Set a default value based on type
            onChange(type === 'toggle' ? false : 0);
        }
    };

    const handleValueChange = (newVal) => {
        if (type === 'number') {
            const num = parseInt(newVal, 10);
            onChange(isNaN(num) ? 0 : num);
        } else {
            onChange(newVal);
        }
    };

    return (
        <div style={s.container}>
            <label style={s.checkboxLabel}>
                <input
                    type="checkbox"
                    checked={isOverridden}
                    onChange={handleToggleOverride}
                    style={s.checkbox}
                />
                {label}
            </label>
            {isOverridden && type === 'number' && (
                <input
                    type="number"
                    value={value ?? 0}
                    onChange={(e) => handleValueChange(e.target.value)}
                    min={min}
                    max={max}
                    step={step}
                    placeholder={placeholder}
                    style={s.numberInput}
                />
            )}
            {isOverridden && type === 'toggle' && (
                <div style={s.toggleContainer}>
                    <input
                        type="checkbox"
                        checked={!!value}
                        onChange={(e) => handleValueChange(e.target.checked)}
                        style={s.checkbox}
                    />
                    <span style={s.toggleLabel}>{value ? 'On' : 'Off'}</span>
                </div>
            )}
        </div>
    );
}
