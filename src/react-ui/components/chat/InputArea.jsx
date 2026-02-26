/**
 * InputArea — Glassmorphic message input with send button and chat action bar
 *
 * Delegates actions to ST via chatSheldService.
 * Includes: send, regenerate, continue, impersonate, stop generation, close chat,
 * tools menu, and batch delete mode.
 */

import React, { useState, useCallback, useRef, useSyncExternalStore } from 'react';
import {
    Send,
    RefreshCw,
    Play,
    UserRound,
    Square,
    X,
    MoreHorizontal,
    MessageSquareQuote,
    Trash2,
} from 'lucide-react';
import {
    triggerSend,
    triggerRegenerate,
    triggerContinue,
    triggerImpersonate,
    triggerStopGeneration,
    triggerBatchDelete,
    stopStreaming,
    syncFullChat,
} from '../../../lib/chatSheldService';
import { useLumiverseStore } from '../../store/LumiverseContext';
import ToolsMenu from './ToolsMenu';
import QuickReplyPopover from './QuickReplyPopover';
import { isQRAvailable } from '../../../lib/quickReplyService';
import ConfirmationModal from '../shared/ConfirmationModal';

const store = useLumiverseStore;
const selectIsStreaming = () => store.getState().chatSheld?.isStreaming || false;
const selectHasMessages = () => (store.getState().chatSheld?.messages?.length || 0) > 0;
const selectBatchDeleteMode = () => store.getState().chatSheld?.batchDeleteMode || false;
const selectBatchDeleteFromId = () => store.getState().chatSheld?.batchDeleteFromId ?? null;
const selectMessageCount = () => store.getState().chatSheld?.messages?.length || 0;

export default function InputArea() {
    const [text, setText] = useState('');
    const [openPopover, setOpenPopover] = useState(null); // null | 'tools' | 'qr'
    const [confirmDelete, setConfirmDelete] = useState(false);
    const textareaRef = useRef(null);
    const isStreaming = useSyncExternalStore(store.subscribe, selectIsStreaming, selectIsStreaming);
    const hasMessages = useSyncExternalStore(store.subscribe, selectHasMessages, selectHasMessages);
    const batchDeleteMode = useSyncExternalStore(store.subscribe, selectBatchDeleteMode, selectBatchDeleteMode);
    const batchDeleteFromId = useSyncExternalStore(store.subscribe, selectBatchDeleteFromId, selectBatchDeleteFromId);
    const messageCount = useSyncExternalStore(store.subscribe, selectMessageCount, selectMessageCount);

    const handleSend = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed) return;

        triggerSend(trimmed);
        setText('');

        // Re-focus textarea after send
        requestAnimationFrame(() => {
            textareaRef.current?.focus();
        });
    }, [text]);

    const handleStop = useCallback(() => {
        triggerStopGeneration();
        // Immediately clear local streaming state so the UI flips to Send.
        // Do NOT call syncFullChat() here — isSTGenerating() still returns
        // true because ST processes the stop asynchronously, and syncFullChat
        // would overwrite isStreaming back to true.
        // GENERATION_STOPPED/GENERATION_ENDED handlers will sync the final state.
        stopStreaming();
        // Safety net: if ST's stop events don't fire, sync after a delay
        // when #mes_stop has had time to update.
        setTimeout(() => syncFullChat(), 500);
    }, []);

    const handleKeyDown = useCallback((e) => {
        // Enter to send, Shift+Enter for newline
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    // Auto-resize textarea
    const handleInput = useCallback((e) => {
        setText(e.target.value);
        const ta = e.target;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
    }, []);

    const handleCancelBatch = useCallback(() => {
        const current = store.getState().chatSheld;
        store.setState({
            chatSheld: { ...current, batchDeleteMode: false, batchDeleteFromId: null },
        });
    }, []);

    const handleConfirmBatchDelete = useCallback(async () => {
        setConfirmDelete(false);
        if (batchDeleteFromId !== null) {
            await triggerBatchDelete(batchDeleteFromId);
        }
    }, [batchDeleteFromId]);

    const deleteCount = batchDeleteFromId !== null ? messageCount - batchDeleteFromId : 0;

    return (
        <div className="lcs-input-area" style={{ position: 'relative' }}>
            {/* Popovers — anchored to .lcs-input-area for proper centering */}
            {openPopover === 'tools' && <ToolsMenu onClose={() => setOpenPopover(null)} />}
            {openPopover === 'qr' && <QuickReplyPopover onClose={() => setOpenPopover(null)} />}

            {/* Batch delete mode bar */}
            {batchDeleteMode ? (
                <div className="lcs-batch-bar">
                    <span className="lcs-batch-bar-text">
                        {batchDeleteFromId !== null
                            ? `Delete from message #${batchDeleteFromId} onward (${deleteCount} message${deleteCount !== 1 ? 's' : ''})`
                            : 'Click a message to set the truncation point'
                        }
                    </span>
                    <div className="lcs-batch-bar-actions">
                        <button
                            className="lcs-action-bar-btn lcs-action-bar-btn--delete"
                            onClick={() => setConfirmDelete(true)}
                            disabled={batchDeleteFromId === null}
                            title="Delete selected messages"
                            type="button"
                        >
                            <Trash2 size={14} />
                            <span style={{ marginLeft: '4px', fontSize: '12px' }}>Delete</span>
                        </button>
                        <button
                            className="lcs-action-bar-btn"
                            onClick={handleCancelBatch}
                            title="Cancel batch delete"
                            type="button"
                        >
                            <X size={14} />
                            <span style={{ marginLeft: '4px', fontSize: '12px' }}>Cancel</span>
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Action bar — chat control buttons (hidden during streaming) */}
                    {!isStreaming && hasMessages && (
                        <div className="lcs-action-bar">
                            <button
                                className="lcs-action-bar-btn"
                                onClick={triggerRegenerate}
                                title="Regenerate last response"
                                type="button"
                            >
                                <RefreshCw size={14} />
                            </button>
                            <button
                                className="lcs-action-bar-btn"
                                onClick={triggerContinue}
                                title="Continue generation"
                                type="button"
                            >
                                <Play size={14} />
                            </button>
                            <button
                                className="lcs-action-bar-btn"
                                onClick={triggerImpersonate}
                                title="Impersonate (AI writes as you)"
                                type="button"
                            >
                                <UserRound size={14} />
                            </button>
                            {isQRAvailable() && (
                                <button
                                    className="lcs-action-bar-btn"
                                    onClick={() => setOpenPopover(p => p === 'qr' ? null : 'qr')}
                                    title="Quick Replies"
                                    type="button"
                                >
                                    <MessageSquareQuote size={14} />
                                </button>
                            )}
                            <button
                                className="lcs-action-bar-btn"
                                onClick={() => setOpenPopover(p => p === 'tools' ? null : 'tools')}
                                title="More tools"
                                type="button"
                            >
                                <MoreHorizontal size={14} />
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Input row — textarea + send/stop toggle (hidden in batch mode) */}
            {!batchDeleteMode && (
                <div className="lcs-input-row">
                    <div className="lcs-input-wrapper">
                        <textarea
                            ref={textareaRef}
                            className="lcs-textarea"
                            value={text}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            rows={1}
                            disabled={isStreaming}
                        />
                    </div>
                    {isStreaming ? (
                        <button
                            className="lcs-send-btn lcs-send-btn--stop"
                            onClick={handleStop}
                            title="Stop generation"
                            type="button"
                            aria-label="Stop generation"
                        >
                            <Square size={16} />
                        </button>
                    ) : (
                        <button
                            className="lcs-send-btn"
                            onClick={handleSend}
                            disabled={!text.trim()}
                            title="Send message"
                            type="button"
                            aria-label="Send message"
                        >
                            <Send size={16} />
                        </button>
                    )}
                </div>
            )}

            {/* Batch delete confirmation */}
            <ConfirmationModal
                isOpen={confirmDelete}
                onConfirm={handleConfirmBatchDelete}
                onCancel={() => setConfirmDelete(false)}
                title="Batch Delete Messages"
                message={`Permanently delete ${deleteCount} message${deleteCount !== 1 ? 's' : ''} from message #${batchDeleteFromId} onward? This cannot be undone.`}
                variant="danger"
                confirmText="Delete"
            />
        </div>
    );
}
