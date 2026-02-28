/**
 * WorldBookEditorModal — Full-screen world book editor modal.
 *
 * Renders WorldBookEditor in wide mode inside an xlarge modal.
 * Opened by intercepting ST's #WIDrawerIcon button (top bar).
 * Uses useFixedPositionFix to neutralize ST's HTML transforms.
 */

import React from 'react';
import { X, BookOpen } from 'lucide-react';
import WorldBookEditor from '../panels/WorldBookEditor';
import useFixedPositionFix from '../../hooks/useFixedPositionFix';

const s = {
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px 12px',
        borderBottom: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
        flexShrink: 0,
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    headerIcon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        background: 'var(--lumiverse-primary-010, var(--lumiverse-primary-light))',
        color: 'var(--lumiverse-primary)',
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

export default function WorldBookEditorModal({ onClose }) {
    useFixedPositionFix(true);

    return (
        <>
            <div style={s.header}>
                <div style={s.headerLeft}>
                    <div style={s.headerIcon}>
                        <BookOpen size={15} strokeWidth={2} />
                    </div>
                    <h3 style={s.title}>World Book Editor</h3>
                </div>
                <button style={s.closeBtn} onClick={onClose} type="button" aria-label="Close">
                    <X size={16} />
                </button>
            </div>
            <div style={s.body}>
                <WorldBookEditor wideMode />
            </div>
        </>
    );
}
