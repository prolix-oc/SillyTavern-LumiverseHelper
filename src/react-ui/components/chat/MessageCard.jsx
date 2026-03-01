/**
 * MessageCard — Individual message rendered as a glassmorphic card
 *
 * Handles character/user/system variants, accent bars, avatar, OOC, and actions.
 */

import React, { memo, useState, useCallback, useSyncExternalStore } from 'react';
import { Bookmark, Loader2, Eye } from 'lucide-react';
import MessageContent from './MessageContent';
import MessageActions from './MessageActions';
import MessageEditArea from './MessageEditArea';
import SwipeControls from './SwipeControls';
import ReasoningBlock from './ReasoningBlock';
import TokenBadge from './TokenBadge';
import LazyImage from '../shared/LazyImage';
import { useLumiverseStore } from '../../store/LumiverseContext';
import { getRawMessageForEdit, editMessageContent, editMessageReasoning, unhideMessage } from '../../../lib/chatSheldService';

const store = useLumiverseStore;

/** SVG spool icon matching the original summarization.js design */
const SpoolIcon = () => (
    <svg className="lcs-summary-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="12" cy="12" rx="8" ry="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <ellipse cx="12" cy="12" rx="3" ry="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="4" y1="16" x2="20" y2="16" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
    </svg>
);

const selectDisplayMode = () => store.getState().chatSheldDisplayMode || 'minimal';

/**
 * Custom memo comparator — compares actual message data fields instead of
 * object identity. syncFullChat() creates new message objects for every
 * message even when only one changed, defeating React.memo's default
 * shallow comparison. This comparator ensures unchanged cards skip rendering.
 */
function arePropsEqual(prev, next) {
    const pm = prev.message;
    const nm = next.message;
    return pm.mesId === nm.mesId
        && pm.content === nm.content
        && pm.swipeId === nm.swipeId
        && pm.swipeCount === nm.swipeCount
        && pm.isBookmark === nm.isBookmark
        && pm.tokenCount === nm.tokenCount
        && pm.reasoning === nm.reasoning
        && pm.avatar === nm.avatar
        && pm.name === nm.name
        && pm.timestamp === nm.timestamp
        && pm.isDraftHidden === nm.isDraftHidden
        && prev.isLastMessage === next.isLastMessage
        && prev.isStreaming === next.isStreaming
        && prev.batchDeleteMode === next.batchDeleteMode
        && prev.batchDeleteFromId === next.batchDeleteFromId;
}

const MessageCard = memo(function MessageCard({ message, isLastMessage, isStreaming, batchDeleteMode, batchDeleteFromId }) {
    const {
        mesId,
        name,
        isUser,
        isSystem,
        isDraftHidden,
        content,
        oocMatches,
        swipes,
        swipeId,
        swipeCount,
        timestamp,
        avatar,
        reasoning,
        isBookmark,
        tokenCount,
    } = message;

    // Determine variant class — draft-hidden messages keep user variant
    let variantClass = 'lcs-message--character';
    if (isUser) variantClass = 'lcs-message--user';
    if (isSystem && !isDraftHidden) variantClass = 'lcs-message--system';

    // Format timestamp
    const formattedTime = timestamp ? formatTime(timestamp) : '';

    // Summary marker state from store
    const selectMarker = () => store.getState().chatSheld?.summaryMarkers?.[mesId] || null;
    const summaryMarker = useSyncExternalStore(store.subscribe, selectMarker, selectMarker);

    // Display mode for immersive/bubble features
    const displayMode = useSyncExternalStore(store.subscribe, selectDisplayMode, selectDisplayMode);
    const isImmersive = displayMode === 'immersive';
    const isBubble = displayMode === 'bubble';

    // Avatar is already resolved in transformMessage (force_avatar takes priority there)
    const avatarSrc = avatar;
    const initial = (name || '?')[0].toUpperCase();

    // Avatar lightbox — open on click (immersive/bubble modes only)
    const handleAvatarClick = useCallback((e) => {
        if (!avatarSrc || batchDeleteMode) return;
        e.stopPropagation();
        const cs = store.getState().chatSheld;
        store.setState({ chatSheld: { ...cs, avatarLightbox: { src: avatarSrc, name } } });
    }, [avatarSrc, name, batchDeleteMode]);

    // Batch delete mode: clicking sets this message as the truncation point
    const isBatchMarked = batchDeleteMode && batchDeleteFromId !== null && mesId >= batchDeleteFromId;
    const isBatchCutpoint = batchDeleteMode && mesId === batchDeleteFromId;

    const handleBatchClick = useCallback(() => {
        if (!batchDeleteMode) return;
        const current = store.getState().chatSheld;
        store.setState({
            chatSheld: { ...current, batchDeleteFromId: mesId },
        });
    }, [batchDeleteMode, mesId]);

    // ── Inline editing state ────────────────────────────────────────
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState(null);

    const handleStartEdit = useCallback(() => {
        const raw = getRawMessageForEdit(mesId);
        if (!raw) return;
        setEditData(raw);
        setIsEditing(true);
    }, [mesId]);

    const handleCancelEdit = useCallback(() => {
        setIsEditing(false);
        setEditData(null);
    }, []);

    const handleSaveEdit = useCallback(async ({ content: newContent, reasoning: newReasoning }) => {
        // Save content
        await editMessageContent(mesId, newContent);
        // Save reasoning if it was editable and changed
        if (newReasoning !== undefined) {
            await editMessageReasoning(mesId, newReasoning);
        }
        setIsEditing(false);
        setEditData(null);
    }, [mesId]);

    // Build class string
    let className = `lcs-message ${variantClass}`;
    if (isStreaming) className += ' lcs-message--streaming';
    if (isBatchMarked) className += ' lcs-message--batch-marked';
    if (isBatchCutpoint) className += ' lcs-message--batch-cutpoint';

    // ── Draft-hidden collapsed card (early return) ────────────────
    if (isDraftHidden) {
        let draftClassName = `lcs-message lcs-message--draft-hidden`;
        if (isBatchMarked) draftClassName += ' lcs-message--batch-marked';
        if (isBatchCutpoint) draftClassName += ' lcs-message--batch-cutpoint';

        const preview = (content || '').replace(/\n/g, ' ').slice(0, 60);

        const handleUnhide = (e) => {
            e.stopPropagation();
            unhideMessage(mesId);
        };

        return (
            <div
                className={draftClassName}
                data-mesid={mesId}
                onClick={batchDeleteMode ? handleBatchClick : undefined}
                style={batchDeleteMode ? { cursor: 'pointer' } : undefined}
            >
                <div className="lcs-draft-hidden-inner">
                    <span className="lcs-draft-hidden-id">#{mesId}</span>
                    <span className="lcs-draft-hidden-label">Draft Hidden</span>
                    <span className="lcs-draft-hidden-preview">{preview}</span>
                    {!batchDeleteMode && (
                        <button
                            className="lcs-draft-hidden-unhide"
                            onClick={handleUnhide}
                            title="Restore message (unhide from AI context)"
                            type="button"
                        >
                            <Eye size={13} />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Shared summary markers fragment
    const summaryMarkers = (
        <>
            {summaryMarker === 'loading' && (
                <span className="lcs-summary-marker lcs-summary-marker--loading" title="Weaving summary...">
                    <Loader2 size={11} className="lcs-summary-spinner" />
                </span>
            )}
            {summaryMarker === 'complete' && (
                <span className="lcs-summary-marker lcs-summary-marker--complete" title="Summary woven up to this message">
                    <SpoolIcon />
                </span>
            )}
            {summaryMarker === 'error' && (
                <span className="lcs-summary-marker lcs-summary-marker--error" title="Summary generation failed">
                    <SpoolIcon />
                </span>
            )}
        </>
    );

    return (
        <div
            className={className}
            data-mesid={mesId}
            onClick={batchDeleteMode ? handleBatchClick : undefined}
            style={batchDeleteMode ? { cursor: 'pointer' } : undefined}
        >
            {isBookmark && (
                <span className="lcs-bookmark" title="Bookmark">
                    <Bookmark size={14} />
                </span>
            )}

            {/* Immersive mode: message number badge */}
            {isImmersive && !isSystem && (
                <span className="lcs-immersive-mesid">#{mesId}</span>
            )}

            {/* Immersive mode: large blended avatar background (decorative — CSS opacity would conflict with LazyImage) */}
            {isImmersive && !isSystem && avatarSrc && (
                <div className="lcs-immersive-avatar-bg" onClick={handleAvatarClick} style={{ cursor: 'pointer', pointerEvents: 'auto' }}>
                    <img className="lcs-immersive-avatar-img" src={avatarSrc} alt="" loading="lazy" />
                </div>
            )}

            {/* Immersive mode: floating depth elements (assistant messages only) */}
            {isImmersive && !isSystem && !isUser && (
                <div className="lcs-immersive-depth" />
            )}

            {/* Bubble mode: dissolving avatar background with mask-composite (decorative — CSS opacity would conflict with LazyImage) */}
            {isBubble && !isSystem && avatarSrc && (
                <div className="lcs-bubble-avatar-bg" onClick={handleAvatarClick} style={{ cursor: 'pointer', pointerEvents: 'auto' }}>
                    <img className="lcs-bubble-avatar-img" src={avatarSrc} alt="" loading="lazy" />
                    <div className="lcs-bubble-avatar-scrim" />
                </div>
            )}

            {/* Bubble mode: header with squircle avatar + name + meta pill */}
            {isBubble && !isSystem && (
                <div className="lcs-message-header lcs-bubble-header">
                    <div className="lcs-bubble-header-left">
                        <LazyImage
                            containerClassName="lcs-message-avatar"
                            src={avatarSrc}
                            alt={name}
                            spinnerSize={12}
                            containerStyle={{ cursor: 'pointer' }}
                            onClick={handleAvatarClick}
                            fallback={
                                <div className="lcs-message-avatar lcs-message-avatar--placeholder">
                                    {initial}
                                </div>
                            }
                        />
                        <div className="lcs-message-meta">
                            <span className="lcs-message-name">{name}</span>
                            <span className="lcs-bubble-meta-pill">
                                <span>#{mesId}</span>
                                <span className="lcs-bubble-meta-dot">&middot;</span>
                                <span>{formattedTime}</span>
                                {tokenCount > 0 && (
                                    <>
                                        <span className="lcs-bubble-meta-dot">&middot;</span>
                                        <span>{tokenCount}t</span>
                                    </>
                                )}
                                {summaryMarkers}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Standard header (minimal + immersive modes) */}
            {!isBubble && !isSystem && (
                <div className="lcs-message-header">
                    <LazyImage
                        containerClassName="lcs-message-avatar"
                        src={avatarSrc}
                        alt=""
                        spinnerSize={12}
                        fallback={
                            <div className="lcs-message-avatar lcs-message-avatar--placeholder">
                                {initial}
                            </div>
                        }
                    />
                    <div className="lcs-message-meta">
                        <span className="lcs-message-name">{name}</span>
                        <span className="lcs-message-timestamp">
                            {formattedTime}
                            <TokenBadge tokenCount={tokenCount} content={content} />
                            {summaryMarkers}
                        </span>
                    </div>
                </div>
            )}

            {isEditing && editData ? (
                <MessageEditArea
                    mesId={mesId}
                    content={editData.content}
                    reasoning={editData.reasoning}
                    isUser={isUser}
                    isSystem={isSystem}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                />
            ) : (
                <>
                    {reasoning && (
                        <ReasoningBlock content={reasoning} duration={message.reasoningDuration} isStreaming={isStreaming} />
                    )}

                    <MessageContent
                        content={content}
                        oocMatches={oocMatches}
                        isSystem={isSystem}
                        isUser={isUser}
                        name={name}
                        mesId={mesId}
                        isStreaming={isStreaming}
                        displayMode={displayMode}
                    />

                    {!isSystem && (
                        <MessageActions mesId={mesId} content={content} isUser={isUser} swipeId={swipeId} swipeCount={swipeCount} onStartEdit={handleStartEdit} />
                    )}
                </>
            )}

            {!isSystem && !isUser && (swipeCount > 1 || isLastMessage) && (
                <SwipeControls
                    mesId={mesId}
                    swipeId={swipeId}
                    swipeCount={swipeCount}
                    swipes={swipes}
                    isLastMessage={isLastMessage}
                />
            )}
        </div>
    );
}, arePropsEqual);

/**
 * Format a timestamp into a short time string.
 * @param {string|number} ts
 * @returns {string}
 */
function formatTime(ts) {
    try {
        const date = new Date(typeof ts === 'number' ? ts : ts);
        if (isNaN(date.getTime())) return '';

        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        if (isToday) {
            return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        }

        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}

export default MessageCard;
