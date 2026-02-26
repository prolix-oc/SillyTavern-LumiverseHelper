/**
 * useChatData — Hook for syncing chat data from the store
 *
 * Provides the current chat messages, streaming state, and helper methods
 * for components to consume chat data reactively.
 */

import { useSyncExternalStore, useCallback, useMemo } from 'react';
import { useLumiverseStore } from '../store/LumiverseContext';

const store = useLumiverseStore;

const selectChatSheld = () => store.getState().chatSheld || {};
const selectMessages = () => store.getState().chatSheld?.messages || [];
const selectIsStreaming = () => store.getState().chatSheld?.isStreaming || false;
const selectStreamingContent = () => store.getState().chatSheld?.streamingContent || '';
const selectActiveChat = () => store.getState().chatSheld?.activeChat || null;

/**
 * Hook providing reactive chat data from the store.
 * @returns {Object} Chat data and helpers
 */
export function useChatData() {
    const messages = useSyncExternalStore(store.subscribe, selectMessages, selectMessages);
    const isStreaming = useSyncExternalStore(store.subscribe, selectIsStreaming, selectIsStreaming);
    const streamingContent = useSyncExternalStore(store.subscribe, selectStreamingContent, selectStreamingContent);
    const activeChat = useSyncExternalStore(store.subscribe, selectActiveChat, selectActiveChat);

    // Build the effective messages list (with streaming content merged into last message)
    const effectiveMessages = useMemo(() => {
        if (!isStreaming || !streamingContent || messages.length === 0) {
            return messages;
        }

        // Clone last message with streaming content
        const clone = [...messages];
        const last = { ...clone[clone.length - 1], content: streamingContent };
        clone[clone.length - 1] = last;
        return clone;
    }, [messages, isStreaming, streamingContent]);

    const getMessageById = useCallback((mesId) => {
        return messages.find(m => m.mesId === mesId) || null;
    }, [messages]);

    return {
        messages: effectiveMessages,
        rawMessages: messages,
        isStreaming,
        streamingContent,
        activeChat,
        messageCount: messages.length,
        getMessageById,
    };
}
