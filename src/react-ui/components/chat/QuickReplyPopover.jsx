/**
 * QuickReplyPopover — Glassmorphic QR popover anchored above the input action bar
 *
 * Shows active QR sets grouped with set headers + color accent stripes.
 * Each entry has an icon, label, truncated preview, and a dedicated Send button.
 * Click-outside + Escape to close (deferred mousedown pattern from ToolsMenu).
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, MessageSquare, Zap } from 'lucide-react';
import { getActiveQRSets, executeQR } from '../../../lib/quickReplyService';

/**
 * Renders a FontAwesome icon string (e.g. "fa-solid fa-bolt") as an <i> element,
 * or falls back to a lucide icon.
 */
function QRIcon({ icon }) {
    if (icon && icon.trim()) {
        // FontAwesome class string
        return <i className={icon.trim()} style={{ fontSize: '13px', width: '16px', textAlign: 'center' }} />;
    }
    return <Zap size={14} />;
}

/**
 * Truncate a string to maxLen characters, adding ellipsis.
 */
function truncate(str, maxLen = 80) {
    if (!str) return '';
    const clean = str.replace(/\n/g, ' ').trim();
    if (clean.length <= maxLen) return clean;
    return clean.slice(0, maxLen).trimEnd() + '\u2026';
}

export default function QuickReplyPopover({ onClose }) {
    const [sets, setSets] = useState([]);
    const menuRef = useRef(null);

    // Load active QR sets on mount
    useEffect(() => {
        setSets(getActiveQRSets());
    }, []);

    // Close on click outside (deferred to avoid catching the opening click)
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    // Close on Escape
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const handleExecute = useCallback((setName, id) => {
        onClose();
        executeQR(setName, id);
    }, [onClose]);

    const isEmpty = sets.length === 0;

    return (
        <div className="lcs-qr-popover" ref={menuRef}>
            {isEmpty ? (
                <div className="lcs-qr-empty">
                    <MessageSquare size={20} style={{ opacity: 0.4 }} />
                    <span>No active Quick Reply sets</span>
                </div>
            ) : (
                sets.map(set => (
                    <div className="lcs-qr-set-group" key={set.name}>
                        <div
                            className="lcs-qr-set-header"
                            style={set.color ? { borderLeftColor: set.color } : undefined}
                        >
                            <span className="lcs-qr-set-name">{set.name}</span>
                            <div className="lcs-qr-set-badges">
                                {set.isGlobal && <span className="lcs-qr-badge lcs-qr-badge--global">Global</span>}
                                {set.isChat && <span className="lcs-qr-badge lcs-qr-badge--chat">Chat</span>}
                            </div>
                        </div>
                        {set.qrs.map(qr => (
                            <div className="lcs-qr-entry" key={qr.id}>
                                <div className="lcs-qr-entry-icon">
                                    <QRIcon icon={qr.icon} />
                                </div>
                                <div className="lcs-qr-entry-text">
                                    <span className="lcs-qr-entry-label" title={qr.title || qr.label}>
                                        {qr.label || '(untitled)'}
                                    </span>
                                    {qr.message && (
                                        <span className="lcs-qr-entry-preview">
                                            {truncate(qr.message)}
                                        </span>
                                    )}
                                </div>
                                <button
                                    className="lcs-qr-entry-send"
                                    onClick={() => handleExecute(set.name, qr.id)}
                                    title={`Execute: ${qr.label}`}
                                    type="button"
                                >
                                    <Send size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                ))
            )}
        </div>
    );
}
