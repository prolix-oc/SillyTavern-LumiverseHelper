import React, { useState, useCallback } from 'react';
import { Globe, Check, AlertCircle, Trash2 } from 'lucide-react';

/**
 * Loom Summary Modal
 * 
 * View and edit the Loom summary for the current chat.
 * Saves to chat metadata for persistence.
 * 
 * Replaces the old jQuery showLoomSummaryModal()
 */

// Summary key constant (must match settingsManager.js)
const LOOM_SUMMARY_KEY = 'lumiverseLoomSummary';

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
    scrollArea: {
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    status: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: '8px',
        fontSize: '12px',
    },
    statusExists: {
        background: 'rgba(76, 175, 80, 0.1)',
        border: '1px solid rgba(76, 175, 80, 0.3)',
        color: '#4caf50',
    },
    statusEmpty: {
        background: 'rgba(255, 152, 0, 0.1)',
        border: '1px solid rgba(255, 152, 0, 0.3)',
        color: '#ff9800',
    },
    textarea: {
        flex: 1,
        minHeight: '200px',
        padding: '14px',
        fontSize: '13px',
        lineHeight: 1.6,
        fontFamily: 'inherit',
        background: 'var(--lumiverse-input-bg)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '10px',
        color: 'var(--lumiverse-text)',
        resize: 'vertical',
        outline: 'none',
        transition: 'border-color 0.2s ease',
    },
    footer: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '12px 20px',
        borderTop: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
    },
    footerLeft: {
        display: 'flex',
        gap: '8px',
    },
    footerRight: {
        display: 'flex',
        gap: '8px',
    },
    button: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
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
    buttonDanger: {
        background: 'rgba(244, 67, 54, 0.1)',
        color: '#f44336',
        border: '1px solid rgba(244, 67, 54, 0.3)',
    },
    buttonDangerDisabled: {
        opacity: 0.5,
        cursor: 'not-allowed',
    },
    buttonPrimary: {
        background: 'var(--lumiverse-primary)',
        color: 'white',
    },
};

// Placeholder text for the textarea
const PLACEHOLDER = `Write or paste your Loom summary here...

Use the structured format:
**Completed Objectives**
- ...

**Focused Objectives**
- ...

**Foreshadowing Beats**
- ...

(etc.)`;

function LoomSummaryModal({ onClose }) {
    // Get context from SillyTavern
    const getContext = useCallback(() => {
        try {
            return window.SillyTavern?.getContext?.();
        } catch {
            return null;
        }
    }, []);
    
    const context = getContext();
    
    // Check if we have an active chat
    const hasChat = context?.chat && context.chat.length > 0;
    
    // Get current summary
    const currentSummary = context?.chatMetadata?.[LOOM_SUMMARY_KEY] || '';
    const hasSummary = !!currentSummary;
    
    // Form state
    const [summary, setSummary] = useState(currentSummary);
    
    // Handle save
    const handleSave = useCallback(() => {
        const ctx = getContext();
        if (!ctx) {
            if (window.toastr) {
                window.toastr.error('No active chat context');
            }
            return;
        }
        
        if (!ctx.chatMetadata) {
            ctx.chatMetadata = {};
        }
        
        const trimmed = summary.trim();
        if (trimmed) {
            ctx.chatMetadata[LOOM_SUMMARY_KEY] = trimmed;
            if (window.toastr) {
                window.toastr.success('Loom summary saved!');
            }
        } else {
            delete ctx.chatMetadata[LOOM_SUMMARY_KEY];
            if (window.toastr) {
                window.toastr.info('Loom summary cleared');
            }
        }
        
        // Save metadata
        ctx.saveMetadata?.();
        
        // Update button state if function exists
        if (typeof window.updateLoomSummaryButtonState === 'function') {
            window.updateLoomSummaryButtonState();
        }
        
        onClose();
    }, [summary, getContext, onClose]);
    
    // Handle clear
    const handleClear = useCallback(() => {
        if (!window.confirm('Are you sure you want to clear the Loom summary for this chat?')) {
            return;
        }
        
        const ctx = getContext();
        if (ctx?.chatMetadata) {
            delete ctx.chatMetadata[LOOM_SUMMARY_KEY];
            ctx.saveMetadata?.();
            
            if (window.toastr) {
                window.toastr.info('Loom summary cleared');
            }
            
            // Update button state
            if (typeof window.updateLoomSummaryButtonState === 'function') {
                window.updateLoomSummaryButtonState();
            }
        }
        
        onClose();
    }, [getContext, onClose]);
    
    // Handle no active chat
    if (!hasChat) {
        return (
            <div style={styles.layout}>
                <div style={styles.header}>
                    <div style={styles.headerIcon}>
                        <Globe size={20} strokeWidth={1.5} />
                    </div>
                    <div style={styles.headerText}>
                        <h3 style={styles.title}>Loom Summary</h3>
                    </div>
                </div>
                
                <div style={styles.scrollArea}>
                    <div style={{ ...styles.status, ...styles.statusEmpty }}>
                        <AlertCircle size={16} />
                        <span>No active chat to view summary for</span>
                    </div>
                </div>
                
                <div style={styles.footer}>
                    <div />
                    <button
                        type="button"
                        style={{ ...styles.button, ...styles.buttonSecondary }}
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.layout}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerIcon}>
                    <Globe size={20} strokeWidth={1.5} />
                </div>
                <div style={styles.headerText}>
                    <h3 style={styles.title}>Loom Summary</h3>
                </div>
            </div>

            {/* Content */}
            <div style={styles.scrollArea}>
                {/* Status indicator */}
                <div style={{
                    ...styles.status,
                    ...(hasSummary ? styles.statusExists : styles.statusEmpty),
                }}>
                    {hasSummary ? (
                        <>
                            <Check size={16} />
                            <span>Summary exists for this chat</span>
                        </>
                    ) : (
                        <>
                            <AlertCircle size={16} />
                            <span>No summary yet - generate one or write your own</span>
                        </>
                    )}
                </div>
                
                {/* Textarea */}
                <textarea
                    style={styles.textarea}
                    placeholder={PLACEHOLDER}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    autoFocus
                />
            </div>

            {/* Footer */}
            <div style={styles.footer}>
                <div style={styles.footerLeft}>
                    <button
                        type="button"
                        style={{
                            ...styles.button,
                            ...styles.buttonDanger,
                            ...(!hasSummary ? styles.buttonDangerDisabled : {}),
                        }}
                        onClick={handleClear}
                        disabled={!hasSummary}
                    >
                        <Trash2 size={14} />
                        Clear
                    </button>
                </div>
                <div style={styles.footerRight}>
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
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

export default LoomSummaryModal;
