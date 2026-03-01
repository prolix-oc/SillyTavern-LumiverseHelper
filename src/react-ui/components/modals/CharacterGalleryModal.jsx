/**
 * CharacterGalleryModal — Wide-view character gallery for desktop
 *
 * Renders CharacterBrowser in wide mode inside an xlarge modal.
 * Card clicks navigate to chat and dismiss the modal (no editor transition).
 * Batch action footer is rendered as a direct child of the modal layout
 * (not inside CharacterBrowser) so it pins to the modal bottom.
 */

import React, { useState, useCallback } from 'react';
import { X, Trash2 } from 'lucide-react';
import CharacterBrowser from '../panels/CharacterBrowser';
import ConfirmationModal from '../shared/ConfirmationModal';

const s = {
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
        justifyContent: 'space-between',
        padding: '16px 20px 12px',
        borderBottom: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
        flexShrink: 0,
    },
    title: {
        fontSize: '16px',
        fontWeight: 600,
        color: 'var(--lumiverse-text)',
        margin: 0,
    },
    closeBtn: {
        background: 'transparent',
        border: 'none',
        borderRadius: '6px',
        color: 'var(--lumiverse-text-muted)',
        cursor: 'pointer',
        padding: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
    },
    footer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 16px',
        borderTop: '2px solid var(--lumiverse-danger, #ef4444)',
        background: 'var(--lumiverse-bg-deepest, rgb(16, 13, 24))',
        flexShrink: 0,
        position: 'relative',
        zIndex: 20,
    },
    footerText: {
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--lumiverse-text-muted, rgba(255,255,255,0.7))',
        whiteSpace: 'nowrap',
    },
    footerActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
};

export default function CharacterGalleryModal({ onClose }) {
    const [batch, setBatch] = useState(null);

    const handleBatchStateChange = useCallback((state) => {
        setBatch(state);
    }, []);

    const showFooter = batch?.batchMode && !batch?.batchProgress;
    const selectedCount = batch?.batchSelected?.size ?? 0;

    return (
        <div style={s.layout}>
            <div style={s.header}>
                <h3 style={s.title}>Character Gallery</h3>
                <button style={s.closeBtn} onClick={onClose} type="button" aria-label="Close">
                    <X size={16} />
                </button>
            </div>
            <div style={s.body}>
                <CharacterBrowser wideMode onDismiss={onClose} onBatchStateChange={handleBatchStateChange} />
            </div>

            {/* Batch footer — direct child of layout, pins to modal bottom */}
            {showFooter && (
                <div style={s.footer}>
                    <span style={s.footerText}>
                        {selectedCount > 0
                            ? `${selectedCount} selected`
                            : 'Click characters to select'}
                    </span>
                    <div style={s.footerActions}>
                        <button
                            className="lumiverse-cb-batch-bar-btn lumiverse-cb-batch-bar-btn--danger"
                            onClick={() => batch.setBatchConfirmOpen(true)}
                            type="button"
                            disabled={selectedCount === 0}
                        >
                            <Trash2 size={14} strokeWidth={1.5} />
                            <span>Delete Selected</span>
                        </button>
                        <button
                            className="lumiverse-cb-batch-bar-btn"
                            onClick={batch.clearBatchSelection}
                            type="button"
                        >
                            <X size={14} strokeWidth={2} />
                            <span>Cancel</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Batch delete confirmation modal */}
            <ConfirmationModal
                isOpen={!!batch?.batchConfirmOpen}
                variant="danger"
                title="Delete Selected Characters"
                message={(
                    <>
                        <strong>{selectedCount}</strong> character{selectedCount !== 1 ? 's' : ''} will be permanently deleted.
                        <br /><br />
                        Choose whether to also delete all associated chat history, or keep the chat files.
                    </>
                )}
                confirmText="Delete Everything"
                secondaryText="Keep Chats"
                secondaryVariant="warning"
                cancelText="Cancel"
                onConfirm={() => batch?.executeBatchDelete(true)}
                onSecondary={() => batch?.executeBatchDelete(false)}
                onCancel={() => batch?.setBatchConfirmOpen(false)}
            />
        </div>
    );
}
