import React, { useState, useCallback } from 'react';
import { useLumiverseStore, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { MessageSquare, Clock, LayoutGrid, Image, FileText, MessageCircle } from 'lucide-react';

/**
 * OOC Settings Modal
 * 
 * Configures out-of-character (OOC) comment settings:
 * - Comment trigger interval
 * - Display style (social card, margin note, whisper bubble)
 * 
 * Replaces the old jQuery showMiscFeaturesModal()
 */

// Style options
const STYLE_OPTIONS = [
    {
        value: 'social',
        label: 'Social Card',
        description: 'Full card with avatar & animations',
        Icon: Image,
    },
    {
        value: 'margin',
        label: 'Margin Note',
        description: 'Minimal hanging tag style',
        Icon: FileText,
    },
    {
        value: 'whisper',
        label: 'Whisper Bubble',
        description: 'Soft ethereal thought bubble',
        Icon: MessageCircle,
    },
];

// Self-contained styles
const styles = {
    layout: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 20px',
        borderBottom: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
    },
    headerIcon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(147, 112, 219, 0.2), rgba(147, 112, 219, 0.1))',
        color: 'var(--lumiverse-primary)',
    },
    headerText: {
        flex: 1,
    },
    title: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 600,
        color: 'var(--lumiverse-text)',
    },
    subtitle: {
        margin: '4px 0 0',
        fontSize: '12px',
        color: 'var(--lumiverse-text-muted)',
    },
    scrollArea: {
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        padding: '16px 20px',
    },
    section: {
        marginBottom: '20px',
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        color: 'var(--lumiverse-text)',
        fontWeight: 500,
        fontSize: '14px',
    },
    sectionIcon: {
        color: 'var(--lumiverse-primary)',
    },
    description: {
        fontSize: '12px',
        color: 'var(--lumiverse-text-muted)',
        marginBottom: '12px',
    },
    field: {
        marginBottom: '12px',
    },
    label: {
        display: 'block',
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--lumiverse-text)',
        marginBottom: '6px',
    },
    input: {
        width: '100%',
        padding: '10px 12px',
        fontSize: '13px',
        background: 'var(--lumiverse-input-bg)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        color: 'var(--lumiverse-text)',
        outline: 'none',
        transition: 'border-color 0.2s ease',
    },
    hint: {
        fontSize: '11px',
        color: 'var(--lumiverse-text-muted)',
        marginTop: '4px',
    },
    styleGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px',
    },
    styleOption: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '14px 8px',
        background: 'rgba(0, 0, 0, 0.2)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    styleOptionSelected: {
        background: 'rgba(147, 112, 219, 0.15)',
        borderColor: 'var(--lumiverse-primary)',
    },
    styleOptionIcon: {
        color: 'var(--lumiverse-text-muted)',
        transition: 'color 0.2s ease',
    },
    styleOptionIconSelected: {
        color: 'var(--lumiverse-primary)',
    },
    styleOptionLabel: {
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--lumiverse-text)',
        textAlign: 'center',
    },
    styleOptionDesc: {
        fontSize: '10px',
        color: 'var(--lumiverse-text-muted)',
        textAlign: 'center',
        lineHeight: 1.3,
    },
    footer: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        padding: '12px 20px',
        borderTop: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
    },
    button: {
        padding: '10px 16px',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    buttonSecondary: {
        background: 'var(--lumiverse-surface)',
        color: 'var(--lumiverse-text)',
        border: '1px solid var(--lumiverse-border)',
    },
    buttonPrimary: {
        background: 'var(--lumiverse-primary)',
        color: 'white',
    },
};

function OOCSettingsModal({ onClose }) {
    const store = useLumiverseStore;
    const actions = useLumiverseActions();
    
    // Get current settings
    const currentInterval = store.getState().lumiaOOCInterval || '';
    const currentStyle = store.getState().lumiaOOCStyle || 'social';
    
    // Local state for form
    const [interval, setInterval] = useState(currentInterval.toString());
    const [style, setStyle] = useState(currentStyle);

    const handleSave = useCallback(() => {
        // Parse interval (empty or 0 = disabled)
        const parsedInterval = interval.trim() ? parseInt(interval, 10) : null;
        
        // Update store
        actions.setSettings({
            lumiaOOCInterval: parsedInterval,
            lumiaOOCStyle: style,
        });
        
        // Persist to extension
        saveToExtension();
        
        // Show toast if available
        if (window.toastr) {
            window.toastr.success('OOC settings saved!');
        }
        
        // If style changed, trigger OOC reprocessing
        if (style !== currentStyle) {
            const callbacks = window.LumiverseBridge?.getCallbacks?.();
            if (callbacks?.refreshOOCComments) {
                setTimeout(() => callbacks.refreshOOCComments(true), 100);
            }
        }
        
        onClose();
    }, [interval, style, currentStyle, actions, onClose]);

    return (
        <div style={styles.layout}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerIcon}>
                    <MessageSquare size={20} strokeWidth={1.5} />
                </div>
                <div style={styles.headerText}>
                    <h3 style={styles.title}>OOC Settings</h3>
                    <p style={styles.subtitle}>Configure out-of-character comments</p>
                </div>
            </div>

            {/* Scrollable Content */}
            <div style={styles.scrollArea}>
                {/* Comment Trigger Section */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <Clock size={16} style={styles.sectionIcon} />
                        <span>Comment Trigger</span>
                    </div>
                    <p style={styles.description}>
                        Automatically inject OOC instructions at message intervals.
                    </p>
                    <div style={styles.field}>
                        <label style={styles.label}>Message Interval</label>
                        <input
                            type="number"
                            style={styles.input}
                            placeholder="e.g., 10 (empty = disabled)"
                            min="1"
                            value={interval}
                            onChange={(e) => setInterval(e.target.value)}
                        />
                        <div style={styles.hint}>
                            Triggers when message count is divisible by this number
                        </div>
                    </div>
                </div>

                {/* Display Style Section */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <LayoutGrid size={16} style={styles.sectionIcon} />
                        <span>Display Style</span>
                    </div>
                    <p style={styles.description}>
                        Choose how OOC comments appear in chat.
                    </p>
                    <div style={styles.styleGrid}>
                        {STYLE_OPTIONS.map((option) => {
                            const isSelected = style === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    style={{
                                        ...styles.styleOption,
                                        ...(isSelected ? styles.styleOptionSelected : {}),
                                    }}
                                    onClick={() => setStyle(option.value)}
                                >
                                    <option.Icon 
                                        size={20} 
                                        strokeWidth={1.5}
                                        style={{
                                            ...styles.styleOptionIcon,
                                            ...(isSelected ? styles.styleOptionIconSelected : {}),
                                        }}
                                    />
                                    <span style={styles.styleOptionLabel}>{option.label}</span>
                                    <span style={styles.styleOptionDesc}>{option.description}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={styles.footer}>
                <button
                    type="button"
                    style={{ ...styles.button, ...styles.buttonSecondary }}
                    onClick={onClose}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    style={{ ...styles.button, ...styles.buttonPrimary }}
                    onClick={handleSave}
                >
                    Save Changes
                </button>
            </div>
        </div>
    );
}

export default OOCSettingsModal;
