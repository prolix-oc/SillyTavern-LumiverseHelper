import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';

/**
 * Main layout wrapper for editor modals
 * Ensures proper scrolling behavior with flexbox
 */
export function EditorLayout({ children, className }) {
    return (
        <div 
            className={clsx('lumiverse-editor-layout', className)}
            style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                flex: 1, 
                minHeight: 0, 
                height: '100%', 
                overflow: 'hidden' 
            }}
        >
            {children}
        </div>
    );
}

/**
 * Scrollable content area
 */
export function EditorContent({ children, className }) {
    return (
        <div 
            className={clsx('lumiverse-editor-content', className)}
            style={{ 
                flex: 1, 
                minHeight: 0, 
                overflowY: 'auto', 
                overflowX: 'hidden',
                padding: '16px' // Standard padding
            }}
        >
            {children}
        </div>
    );
}

/**
 * Fixed footer for actions
 */
export function EditorFooter({ children, className }) {
    return (
        <div 
            className={clsx('lumiverse-editor-footer', className)}
            style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px',
                background: 'var(--lumiverse-bg-elevated)',
                borderTop: '1px solid var(--lumiverse-border)',
                flexShrink: 0
            }}
        >
            {children}
        </div>
    );
}

/**
 * Form Field Wrapper
 */
export function FormField({ label, required, hint, error, children, className }) {
    return (
        <div className={clsx('lumiverse-form-field', error && 'lumiverse-form-field--error', className)} style={{ marginBottom: '16px' }}>
            <label className="lumiverse-form-label" style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontSize: '13px', 
                fontWeight: 500, 
                color: 'var(--lumiverse-text-muted)' 
            }}>
                {label}
                {required && <span className="lumiverse-required" style={{ color: 'var(--lumiverse-danger)', marginLeft: '4px' }}>*</span>}
            </label>
            {children}
            {hint && <div className="lumiverse-form-hint" style={{ marginTop: '6px', fontSize: '11px', color: 'var(--lumiverse-text-dim)', lineHeight: 1.4 }}>{hint}</div>}
            {error && <div className="lumiverse-form-error" style={{ marginTop: '4px', fontSize: '12px', color: 'var(--lumiverse-danger)' }}>{error}</div>}
        </div>
    );
}

/**
 * Section with Icon header
 */
export function EditorSection({ Icon, title, children, defaultExpanded = true, className }) {
    const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

    return (
        <div className={clsx('lumiverse-editor-section', className)} style={{ marginBottom: '20px' }}>
            <div 
                className="lumiverse-editor-section-header" 
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    paddingBottom: '10px',
                    marginBottom: '10px',
                    borderBottom: '1px solid var(--lumiverse-border)',
                    cursor: 'pointer',
                    userSelect: 'none'
                }}
            >
                {Icon && (
                    <div className="lumiverse-section-icon" style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: '24px', 
                        height: '24px', 
                        borderRadius: '6px',
                        background: 'rgba(147, 112, 219, 0.1)',
                        color: 'var(--lumiverse-primary)'
                    }}>
                        <Icon size={14} strokeWidth={2} />
                    </div>
                )}
                <span style={{ 
                    fontSize: '13px', 
                    fontWeight: 600, 
                    color: 'var(--lumiverse-text)',
                    flex: 1 
                }}>
                    {title}
                </span>
                <div style={{ color: 'var(--lumiverse-text-dim)' }}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
            </div>
            
            {isExpanded && (
                <div className="lumiverse-editor-section-content">
                    {children}
                </div>
            )}
        </div>
    );
}

/**
 * Standard Text Input
 */
export function TextInput({ value, onChange, placeholder, className, autoFocus, ...props }) {
    return (
        <input
            type="text"
            className={clsx('lumiverse-input', className)}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--lumiverse-border)',
                borderRadius: '8px',
                color: 'var(--lumiverse-text)',
                fontSize: '13px',
                fontFamily: 'inherit'
            }}
            {...props}
        />
    );
}

/**
 * Standard Text Area
 */
export function TextArea({ value, onChange, placeholder, rows = 4, className, ...props }) {
    return (
        <textarea
            className={clsx('lumiverse-textarea', className)}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--lumiverse-border)',
                borderRadius: '8px',
                color: 'var(--lumiverse-text)',
                fontSize: '13px',
                fontFamily: 'inherit',
                lineHeight: 1.5,
                resize: 'vertical'
            }}
            {...props}
        />
    );
}

/**
 * Standard Select Input
 */
export function Select({ value, onChange, options, className, ...props }) {
    return (
        <div className="lumiverse-select-wrapper" style={{ position: 'relative' }}>
            <select
                className={clsx('lumiverse-select', className)}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: '100%',
                    padding: '10px 32px 10px 12px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid var(--lumiverse-border)',
                    borderRadius: '8px',
                    color: 'var(--lumiverse-text)',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    appearance: 'none',
                    cursor: 'pointer'
                }}
                {...props}
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            <div style={{ 
                position: 'absolute', 
                right: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                pointerEvents: 'none',
                color: 'var(--lumiverse-text-muted)'
            }}>
                <ChevronDown size={14} />
            </div>
        </div>
    );
}

/**
 * Image Input with Preview
 */
export function ImageInput({ value, onChange, placeholder, className }) {
    const [previewError, setPreviewError] = useState(false);
    // Safe hook usage - handles empty URL gracefully
    const { objectPosition } = useAdaptiveImagePosition(value || '');

    // Reset error when value changes
    useEffect(() => {
        setPreviewError(false);
    }, [value]);

    return (
        <div className={clsx('lumiverse-image-input', className)}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                    <TextInput
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder || 'https://...'}
                    />
                </div>
                {value && !previewError && (
                    <div className="lumiverse-image-preview" style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        border: '1px solid var(--lumiverse-border)',
                        flexShrink: 0,
                        background: 'rgba(0,0,0,0.2)'
                    }}>
                        <img
                            src={value}
                            alt="Preview"
                            style={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'cover',
                                objectPosition 
                            }}
                            onError={() => setPreviewError(true)}
                        />
                    </div>
                )}
                {(!value || previewError) && (
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '6px',
                        border: '1px dashed var(--lumiverse-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: 'var(--lumiverse-text-dim)'
                    }}>
                        <ImageIcon size={16} />
                    </div>
                )}
            </div>
        </div>
    );
}
