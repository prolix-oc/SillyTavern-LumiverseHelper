/**
 * MessageActions — Hover-reveal action buttons for messages
 *
 * Delegates all mutations to ST via chatSheldService.
 * Includes: Copy, Fork, Prompt Breakdown, Edit, Delete (with swipe-aware dialog)
 */

import React, { useCallback, useState } from 'react';
import { Copy, Check, Pencil, Trash2, GitBranch, BarChart3, X } from 'lucide-react';
import { copyMessageContent, deleteMessageDirect, deleteSwipeDirect, triggerFork } from '../../../lib/chatSheldService';
import { useLumiverseActions } from '../../store/LumiverseContext';
import ConfirmationModal from '../shared/ConfirmationModal';

export default function MessageActions({ mesId, content, isUser, swipeId, swipeCount, onStartEdit }) {
    const [copied, setCopied] = useState(false);
    const [forkState, setForkState] = useState(null); // null | 'confirm' | 'success' | 'error'
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const actions = useLumiverseActions();

    // Can offer swipe deletion when: not a user message, has multiple swipes, and a swipe is selected
    const canDeleteSwipe = !isUser && swipeCount > 1 && swipeId != null;

    const handleCopy = useCallback(async () => {
        const ok = await copyMessageContent(content);
        if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    }, [content]);

    const handleFork = useCallback(() => {
        setForkState('confirm');
    }, []);

    const handleForkConfirm = useCallback(async () => {
        setForkState(null);
        const ok = await triggerFork(mesId);
        setForkState(ok ? 'success' : 'error');
        setTimeout(() => setForkState(null), 2000);
    }, [mesId]);

    const handlePrompt = useCallback(() => {
        actions.openModal('promptItemization', { mesId });
    }, [mesId, actions]);

    const handleEdit = useCallback(() => {
        if (onStartEdit) onStartEdit();
    }, [onStartEdit]);

    const handleDelete = useCallback(() => {
        setShowDeleteConfirm(true);
    }, []);

    // Delete the entire message (confirm button when swipeable, or sole confirm when not)
    const handleDeleteMessage = useCallback(async () => {
        setShowDeleteConfirm(false);
        await deleteMessageDirect(mesId);
    }, [mesId]);

    // Delete only the current swipe (secondary button)
    const handleDeleteSwipe = useCallback(async () => {
        setShowDeleteConfirm(false);
        await deleteSwipeDirect(mesId, swipeId);
    }, [mesId, swipeId]);

    return (
        <>
            <div className="lcs-message-actions">
                <button
                    className="lcs-action-btn"
                    onClick={handleCopy}
                    title={copied ? 'Copied!' : 'Copy'}
                    type="button"
                >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button
                    className="lcs-action-btn"
                    onClick={handleFork}
                    title={forkState === 'success' ? 'Forked!' : forkState === 'error' ? 'Fork failed' : 'Fork chat here'}
                    type="button"
                >
                    {forkState === 'success' ? <Check size={14} /> : forkState === 'error' ? <X size={14} /> : <GitBranch size={14} />}
                </button>
                <button
                    className="lcs-action-btn"
                    onClick={handlePrompt}
                    title="Prompt breakdown"
                    type="button"
                >
                    <BarChart3 size={14} />
                </button>
                <button
                    className="lcs-action-btn"
                    onClick={handleEdit}
                    title="Edit"
                    type="button"
                >
                    <Pencil size={14} />
                </button>
                <button
                    className="lcs-action-btn lcs-action-btn--danger"
                    onClick={handleDelete}
                    title="Delete"
                    type="button"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            <ConfirmationModal
                isOpen={forkState === 'confirm'}
                onConfirm={handleForkConfirm}
                onCancel={() => setForkState(null)}
                title="Fork Chat"
                message="Create a new chat branch at this message? A new chat will be created containing all messages up to this point."
                variant="safe"
                confirmText="Fork"
            />

            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onConfirm={handleDeleteMessage}
                onCancel={() => setShowDeleteConfirm(false)}
                title={canDeleteSwipe ? 'Delete' : 'Delete Message'}
                message={
                    canDeleteSwipe
                        ? `Delete swipe ${swipeId + 1}/${swipeCount}, or delete the entire message #${mesId}? This cannot be undone.`
                        : `Delete message #${mesId}? This cannot be undone.`
                }
                variant="danger"
                confirmText="Delete Message"
                secondaryText={canDeleteSwipe ? 'Delete Swipe' : undefined}
                onSecondary={canDeleteSwipe ? handleDeleteSwipe : undefined}
                secondaryVariant="warning"
            />
        </>
    );
}
