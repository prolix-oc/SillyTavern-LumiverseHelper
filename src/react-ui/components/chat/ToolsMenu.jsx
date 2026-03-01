/**
 * ToolsMenu — Dropdown menu anchored to the "more tools" button in InputArea
 *
 * Items: Author's Note, Convert to Group, Start New Chat, Manage Chats, Batch Delete
 */

import React, { useEffect, useRef, useCallback, useState, useSyncExternalStore } from 'react';
import { StickyNote, Users, Plus, FolderOpen, Scissors, X, EyeOff, Eye } from 'lucide-react';
import {
    openAuthorNotePanel,
    triggerConvertToGroup,
    triggerNewChat,
    triggerCloseChat,
    getCharacterInfo,
    hideAllUserMessages,
    unhideAllUserMessages,
} from '../../../lib/chatSheldService';
import { useLumiverseStore, useLumiverseActions } from '../../store/LumiverseContext';
import ConfirmationModal from '../shared/ConfirmationModal';

const store = useLumiverseStore;

export default function ToolsMenu({ onClose }) {
    const actions = useLumiverseActions();
    const menuRef = useRef(null);
    const [confirmAction, setConfirmAction] = useState(null);

    const charInfo = getCharacterInfo();
    const isGroup = charInfo?.isGroup || false;

    // Close on click outside (but not when a confirmation modal is open)
    const confirmActionRef = useRef(confirmAction);
    confirmActionRef.current = confirmAction;
    useEffect(() => {
        const handleClickOutside = (e) => {
            // Skip when a confirmation modal is open — its backdrop handles dismissal
            if (confirmActionRef.current) return;
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        // Defer listener to avoid catching the opening click
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

    const handleAuthorsNote = useCallback(() => {
        // Mobile: use modal (useFixedPositionFix neutralises ST's html transform);
        // Desktop: use side panel
        if (window.innerWidth <= 600) {
            actions.openModal('authorsNote');
        } else {
            openAuthorNotePanel();
        }
        onClose();
    }, [actions, onClose]);

    const handleConvertToGroup = useCallback(() => {
        setConfirmAction({
            title: 'Convert to Group Chat',
            message: 'This will convert the current chat into a group chat. This action cannot be easily undone. Continue?',
            variant: 'warning',
            onConfirm: () => {
                triggerConvertToGroup();
                setConfirmAction(null);
                onClose();
            },
        });
    }, [onClose]);

    const handleNewChat = useCallback(() => {
        setConfirmAction({
            title: 'Start New Chat',
            message: 'Start a new chat with this character? The current chat will be saved and you can switch back to it later.',
            variant: 'safe',
            onConfirm: async () => {
                console.log('[Lumiverse] ToolsMenu: onConfirm fired — calling triggerNewChat');
                setConfirmAction(null);
                const ok = await triggerNewChat();
                console.log('[Lumiverse] ToolsMenu: triggerNewChat returned', ok);
                if (!ok && typeof toastr !== 'undefined') {
                    toastr.error('Failed to create new chat');
                }
                onClose();
            },
        });
    }, [onClose]);

    const handleManageChats = useCallback(() => {
        actions.openModal('manageChats');
        onClose();
    }, [actions, onClose]);

    const handleHideAll = useCallback(() => {
        setConfirmAction({
            title: 'Hide All User Messages',
            message: 'This will hide all your messages from AI context. The AI will not see any of your messages during generation. You can unhide them later.',
            variant: 'warning',
            onConfirm: async () => {
                setConfirmAction(null);
                await hideAllUserMessages();
                onClose();
            },
        });
    }, [onClose]);

    const handleUnhideAll = useCallback(async () => {
        await unhideAllUserMessages();
        onClose();
    }, [onClose]);

    const handleBatchDelete = useCallback(() => {
        const current = store.getState().chatSheld;
        store.setState({
            chatSheld: { ...current, batchDeleteMode: true, batchDeleteFromId: null },
        });
        onClose();
    }, [onClose]);

    return (
        <>
            <div className="lcs-tools-menu" ref={menuRef}>
                <button className="lcs-tools-menu-item" onClick={handleAuthorsNote} type="button">
                    <StickyNote size={14} />
                    <span>Author's Note</span>
                </button>

                {!isGroup && (
                    <button className="lcs-tools-menu-item" onClick={handleConvertToGroup} type="button">
                        <Users size={14} />
                        <span>Convert to Group</span>
                    </button>
                )}

                <button className="lcs-tools-menu-item" onClick={handleNewChat} type="button">
                    <Plus size={14} />
                    <span>Start New Chat</span>
                </button>

                <button className="lcs-tools-menu-item" onClick={handleManageChats} type="button">
                    <FolderOpen size={14} />
                    <span>Manage Chats</span>
                </button>

                <button className="lcs-tools-menu-item" onClick={handleHideAll} type="button">
                    <EyeOff size={14} />
                    <span>Hide All User Messages</span>
                </button>

                <button className="lcs-tools-menu-item" onClick={handleUnhideAll} type="button">
                    <Eye size={14} />
                    <span>Unhide All User Messages</span>
                </button>

                <div className="lcs-tools-menu-divider" />

                <button className="lcs-tools-menu-item lcs-tools-menu-item--danger" onClick={handleBatchDelete} type="button">
                    <Scissors size={14} />
                    <span>Batch Delete</span>
                </button>

                <button className="lcs-tools-menu-item lcs-tools-menu-item--danger" onClick={() => { triggerCloseChat(); onClose(); }} type="button">
                    <X size={14} />
                    <span>Close Chat</span>
                </button>
            </div>

            <ConfirmationModal
                isOpen={!!confirmAction}
                onConfirm={confirmAction?.onConfirm || (() => {})}
                onCancel={() => setConfirmAction(null)}
                title={confirmAction?.title || ''}
                message={confirmAction?.message || ''}
                variant={confirmAction?.variant || 'safe'}
                confirmText="Continue"
            />
        </>
    );
}
