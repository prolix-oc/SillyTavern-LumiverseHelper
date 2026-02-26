/**
 * useChunkedMessages — Hook for paginated message display
 *
 * Manages a sliding window over the full message array, loading older
 * messages in chunks when the user scrolls to the top.
 */

import { useState, useCallback, useLayoutEffect, useMemo, useRef, useEffect } from 'react';

const CHUNK_SIZE = 50;
const MAX_DOM_MESSAGES = 500;

/**
 * Hook providing chunked message pagination.
 * @param {Array} messages - Full message array from useChatData
 * @param {string} [chatId] - Active chat ID for reliable reset detection
 * @returns {Object} Chunked messages and load-more controls
 */
export function useChunkedMessages(messages, chatId) {
    // Track how many messages to show from the end
    const [displayCount, setDisplayCount] = useState(CHUNK_SIZE);
    const loadingRef = useRef(false);
    const prevLengthRef = useRef(0);
    const prevChatIdRef = useRef(chatId);

    // Reset display count on chat switch — useLayoutEffect ensures the
    // synchronous re-render happens before paint, so the user never sees
    // the old displayCount's worth of messages flash on screen.
    useLayoutEffect(() => {
        if (chatId !== prevChatIdRef.current) {
            prevChatIdRef.current = chatId;
            setDisplayCount(CHUNK_SIZE);
            prevLengthRef.current = messages.length;
        }
    }, [chatId, messages.length]);

    // Fallback: reset when messages shrink significantly (covers edge cases
    // where chatId isn't available or doesn't change)
    useEffect(() => {
        const currentLength = messages.length;
        if (currentLength < prevLengthRef.current - 10) {
            setDisplayCount(CHUNK_SIZE);
        }
        prevLengthRef.current = currentLength;
    }, [messages.length]);

    // The visible slice of messages
    const visibleMessages = useMemo(() => {
        const start = Math.max(0, messages.length - displayCount);
        return messages.slice(start);
    }, [messages, displayCount]);

    // Whether there are more messages above
    const hasMore = useMemo(() => {
        return messages.length > displayCount;
    }, [messages.length, displayCount]);

    // Load the next chunk of older messages.
    // displayCount is allowed to exceed messages.length — visibleMessages.slice()
    // clamps to index 0 safely. This lets loadMore + loadOlderMessages batch
    // together when the IO observer fires.
    const loadMore = useCallback(() => {
        if (loadingRef.current) return;
        loadingRef.current = true;

        setDisplayCount(prev => Math.min(prev + CHUNK_SIZE, MAX_DOM_MESSAGES));

        // Brief cooldown to prevent rapid-fire loads
        setTimeout(() => {
            loadingRef.current = false;
        }, 100);
    }, []);

    // Reset to show only the last chunk
    const resetToBottom = useCallback(() => {
        setDisplayCount(CHUNK_SIZE);
    }, []);

    return {
        visibleMessages,
        hasMore,
        loadMore,
        resetToBottom,
        totalCount: messages.length,
        displayCount: Math.min(displayCount, messages.length),
    };
}
