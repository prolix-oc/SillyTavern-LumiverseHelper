/**
 * CharacterGalleryModal — Wide-view character gallery for desktop
 *
 * Renders CharacterBrowser in wide mode inside an xlarge modal.
 * Card clicks navigate to chat and dismiss the modal (no editor transition).
 */

import React from 'react';
import { X } from 'lucide-react';
import CharacterBrowser from '../panels/CharacterBrowser';

const s = {
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px 12px',
        borderBottom: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
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
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
};

export default function CharacterGalleryModal({ onClose }) {
    return (
        <>
            <div style={s.header}>
                <h3 style={s.title}>Character Gallery</h3>
                <button style={s.closeBtn} onClick={onClose} type="button" aria-label="Close">
                    <X size={16} />
                </button>
            </div>
            <div style={s.body}>
                <CharacterBrowser wideMode onDismiss={onClose} />
            </div>
        </>
    );
}
