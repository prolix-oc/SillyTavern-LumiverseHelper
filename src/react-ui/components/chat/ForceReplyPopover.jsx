/**
 * ForceReplyPopover — Glass popover for selecting a group member to speak next.
 *
 * Lists enabled group members with avatar and name.
 * Click to trigger a forced generation for that character.
 * Pattern mirrors QuickReplyPopover (click-outside + Escape).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users } from 'lucide-react';
import { getGroupMemberList, triggerForceReply } from '../../../lib/chatSheldService';
import LazyImage from '../shared/LazyImage';

export default function ForceReplyPopover({ onClose }) {
    const [members, setMembers] = useState([]);
    const menuRef = useRef(null);

    // Load group members on mount
    useEffect(() => {
        setMembers(getGroupMemberList());
    }, []);

    // Close on click outside (deferred)
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

    const handleSelect = useCallback((chid) => {
        onClose();
        triggerForceReply(chid);
    }, [onClose]);

    const isEmpty = members.length === 0;

    return (
        <div className="lcs-force-reply-popover" ref={menuRef}>
            <div className="lcs-force-reply-header">Force Reply</div>
            {isEmpty ? (
                <div className="lcs-persona-empty">
                    <Users size={20} style={{ opacity: 0.4 }} />
                    <span>No group members found</span>
                </div>
            ) : (
                <div className="lcs-force-reply-list">
                    {members.map((m) => (
                        <button
                            key={m.chid}
                            className={`lcs-force-reply-item${m.disabled ? ' lcs-force-reply-item--disabled' : ''}`}
                            onClick={() => !m.disabled && handleSelect(m.chid)}
                            type="button"
                            disabled={m.disabled}
                        >
                            <LazyImage
                                className="lcs-force-reply-avatar"
                                src={m.avatarUrl}
                                alt={m.name}
                                spinnerSize={10}
                            />
                            <span className="lcs-force-reply-name">{m.name}</span>
                            {m.disabled && <span className="lcs-force-reply-disabled-label">disabled</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
