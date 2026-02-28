/**
 * MessageList — Paginated message display with Intersection Observer load-more
 *
 * Renders all messages from the store directly (no intermediate slicing).
 * Progressive loading is handled by syncTailChat() on chat switch and
 * loadOlderMessages() via IntersectionObserver when the user scrolls up.
 * This single-tier approach eliminates the double-render race condition
 * that the old useChunkedMessages hook introduced.
 */

import React, { useRef, useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import { MessageSquare } from 'lucide-react';
import { useLumiverseStore } from '../../store/LumiverseContext';
import { loadOlderMessages } from '../../../lib/chatSheldService.js';
import MessageCard from './MessageCard';

const store = useLumiverseStore;
const selectBatchDeleteMode = () => store.getState().chatSheld?.batchDeleteMode || false;
const selectBatchDeleteFromId = () => store.getState().chatSheld?.batchDeleteFromId ?? null;
const selectActiveChat = () => store.getState().chatSheld?.activeChat || null;
const selectTotalChatLength = () => store.getState().chatSheld?.totalChatLength ?? 0;
const selectScrollSnapTrigger = () => store.getState().chatSheld?.scrollSnapTrigger ?? 0;
const selectDisplayMode = () => store.getState().chatSheldDisplayMode || 'minimal';

export default function MessageList({ messages, isStreaming, streamingContent, scrollContainerRef }) {
    const activeChat = useSyncExternalStore(store.subscribe, selectActiveChat, selectActiveChat);

    const batchDeleteMode = useSyncExternalStore(store.subscribe, selectBatchDeleteMode, selectBatchDeleteMode);
    const batchDeleteFromId = useSyncExternalStore(store.subscribe, selectBatchDeleteFromId, selectBatchDeleteFromId);
    const totalChatLength = useSyncExternalStore(store.subscribe, selectTotalChatLength, selectTotalChatLength);
    const scrollSnapTrigger = useSyncExternalStore(store.subscribe, selectScrollSnapTrigger, selectScrollSnapTrigger);
    const displayMode = useSyncExternalStore(store.subscribe, selectDisplayMode, selectDisplayMode);

    const sentinelRef = useRef(null);
    const bottomRef = useRef(null);
    const isUserScrolledUpRef = useRef(false);
    const autoScrollActiveRef = useRef(0);  // Guard counter for programmatic scrolls
    const prevMessageCountRef = useRef(0);
    const prevFirstMesIdRef = useRef(null);
    const prevLastMesIdRef = useRef(null);
    const prevChatRef = useRef(null);
    const isSettlingRef = useRef(true);
    const skipNextScrollRef = useRef(false);
    const streamScrollRAF = useRef(null);
    const loadingMoreRef = useRef(false);
    const settleRAFRef = useRef(null);

    // Derived values for scroll logic
    const firstMesId = messages.length > 0 ? messages[0].mesId : null;
    const lastMesId = messages.length > 0 ? messages[messages.length - 1].mesId : null;

    /**
     * Resolve the scroll container element.
     * On first mount, scrollContainerRef.current is null because React processes
     * refs parent→child in the commit phase but fires effects child→parent.
     * MessageList's useLayoutEffect runs BEFORE ChatSheld's ref is attached.
     * Fall back to DOM traversal from bottomRef (our own element, always set).
     */
    function getScrollContainer() {
        return scrollContainerRef?.current
            || bottomRef.current?.closest('.lcs-scroll-container');
    }

    /**
     * Perform a programmatic scroll with a guard that prevents the resulting
     * browser scroll event from falsely flipping isUserScrolledUpRef.
     *
     * The scroll event fires AFTER rAF callbacks in the same frame's
     * "update the rendering" step. A double-rAF ensures the guard is
     * cleared in the frame AFTER the scroll event was processed.
     */
    function guardedScroll(fn) {
        autoScrollActiveRef.current++;
        fn();
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                autoScrollActiveRef.current = Math.max(0, autoScrollActiveRef.current - 1);
            });
        });
    }

    /**
     * Smart scroll to the last message on chat load.
     * If the last message is taller than the viewport, position its top edge
     * at the container's top so the user starts reading from the beginning.
     * Otherwise, snap to the absolute bottom (normal behavior).
     */
    function scrollToLastMessage(container) {
        if (!container) return;
        guardedScroll(() => {
            const lastMsgEl = container.querySelector(`[data-mesid="${lastMesId}"]`);
            if (lastMsgEl && lastMsgEl.offsetHeight > container.clientHeight) {
                const containerRect = container.getBoundingClientRect();
                const msgRect = lastMsgEl.getBoundingClientRect();
                container.scrollTop += msgRect.top - containerRect.top;
            } else {
                container.scrollTop = container.scrollHeight;
            }
        });
    }

    // ── Instant snap to bottom on chat load/switch ──
    // useLayoutEffect runs after DOM commit but BEFORE browser paint,
    // so scrollTop is set before the user ever sees the content at the
    // wrong position. The chat-length guard in chatSheldService prevents
    // ST's CHARACTER_MESSAGE_RENDERED events from triggering syncFullChat()
    // when the chat hasn't actually grown (i.e., ST is just rendering
    // existing messages in its hidden #chat during chat display).
    //
    // Also handles scroll preservation for prepended messages (load-more).
    // When older messages are prepended by loadOlderMessages(), the first
    // mesId decreases. We detect this and adjust scrollTop by the height
    // delta BEFORE the browser paints, preventing any visual jump.
    useLayoutEffect(() => {
        const container = getScrollContainer();
        const chatChanged = activeChat !== prevChatRef.current;

        if (chatChanged) {
            prevChatRef.current = activeChat;
            isSettlingRef.current = true;
            skipNextScrollRef.current = true;
            isUserScrolledUpRef.current = false;
            prevFirstMesIdRef.current = firstMesId;
            prevLastMesIdRef.current = lastMesId;
            prevMessageCountRef.current = messages.length;

            // Immediate snap (useLayoutEffect = before paint)
            scrollToLastMessage(container);

            // Cancel any previous settle loop
            if (settleRAFRef.current !== null) {
                cancelAnimationFrame(settleRAFRef.current);
            }

            // rAF loop: keep snapping for several frames to ride out any
            // layout settling (image loads, OOC bridge mounts, flex reflow).
            // Every frame uses scrollToLastMessage() for consistent smart
            // positioning (top-of-last-message or absolute bottom if it fits).
            let frameCount = 0;
            const maxFrames = 6;
            const settleLoop = () => {
                frameCount++;
                const c = getScrollContainer();

                if (frameCount >= maxFrames) {
                    isSettlingRef.current = false;
                    settleRAFRef.current = null;
                }
                scrollToLastMessage(c);
                if (frameCount < maxFrames) {
                    settleRAFRef.current = requestAnimationFrame(settleLoop);
                }
            };
            settleRAFRef.current = requestAnimationFrame(settleLoop);
        }

        // Snap every render while settling — use smart positioning consistently
        if (isSettlingRef.current && container && messages.length > 0) {
            scrollToLastMessage(container);
        }

        // ── Scroll preservation for prepended messages ──
        // When loadOlderMessages() prepends content, the first mesId decreases
        // while the last mesId stays the same. Adjust scrollTop by the height
        // delta so the user's viewport stays at the same visual position.
        // This runs in useLayoutEffect (before paint) so there's no visible jump.
        if (
            !chatChanged &&
            !isSettlingRef.current &&
            container &&
            prevFirstMesIdRef.current !== null &&
            firstMesId !== null &&
            firstMesId < prevFirstMesIdRef.current &&
            lastMesId === prevLastMesIdRef.current
        ) {
            const prevScrollHeight = container._lcsPrePrependScrollHeight;
            const prevScrollTop = container._lcsPrePrependScrollTop;
            if (prevScrollHeight !== undefined && prevScrollTop !== undefined) {
                const delta = container.scrollHeight - prevScrollHeight;
                guardedScroll(() => { container.scrollTop = prevScrollTop + delta; });
                delete container._lcsPrePrependScrollHeight;
                delete container._lcsPrePrependScrollTop;
            }
        }

        prevFirstMesIdRef.current = firstMesId;
        prevLastMesIdRef.current = lastMesId;
    }, [activeChat, messages.length, firstMesId, lastMesId, scrollContainerRef]);

    // Clean up settle loop on unmount
    useEffect(() => {
        return () => {
            if (settleRAFRef.current !== null) {
                cancelAnimationFrame(settleRAFRef.current);
            }
        };
    }, []);

    // ── Instant scroll for new messages (same chat) ──
    // Only fires when a genuinely new message is appended at the END
    // (lastMesId changes). Prepended messages (from loadOlderMessages)
    // change firstMesId but NOT lastMesId, so they don't trigger this.
    useEffect(() => {
        const count = messages.length;
        const prev = prevMessageCountRef.current;
        prevMessageCountRef.current = count;

        if (skipNextScrollRef.current) {
            skipNextScrollRef.current = false;
            return;
        }

        // Only snap to bottom if:
        // 1. Message count increased (new messages)
        // 2. The LAST message changed (appended, not prepended)
        // 3. User hasn't scrolled up
        if (
            count > prev &&
            lastMesId !== prevLastMesIdRef.current &&
            !isUserScrolledUpRef.current
        ) {
            const container = getScrollContainer();
            if (container) {
                guardedScroll(() => { container.scrollTop = container.scrollHeight; });
            }
        }

        // Note: prevLastMesIdRef is updated in useLayoutEffect (runs first)
    }, [messages.length, lastMesId, scrollContainerRef]);

    // ── Streaming scroll — RAF-batched instant tracking ──
    // Uses requestAnimationFrame with cancellation to prevent layout thrashing.
    // Instant scrollTop (not smooth scrollIntoView) keeps up with fast streaming
    // content, matching ST's scrollChatToBottom({ waitForFrame: true }) pattern.
    useEffect(() => {
        if (!isStreaming || isUserScrolledUpRef.current) return;
        const container = getScrollContainer();
        if (!container) return;

        // Cancel pending scroll to coalesce rapid updates
        if (streamScrollRAF.current !== null) {
            cancelAnimationFrame(streamScrollRAF.current);
        }

        streamScrollRAF.current = requestAnimationFrame(() => {
            const c = getScrollContainer();
            if (c) guardedScroll(() => { c.scrollTop = c.scrollHeight; });
            streamScrollRAF.current = null;
        });

        return () => {
            if (streamScrollRAF.current !== null) {
                cancelAnimationFrame(streamScrollRAF.current);
                streamScrollRAF.current = null;
            }
        };
    }, [streamingContent, isStreaming, scrollContainerRef]);

    // ── Scroll snap for swipe/regenerate ──
    // On swipe/regenerate, message count and lastMesId don't change, so the
    // normal "new message" scroll effect doesn't fire. The service bumps
    // scrollSnapTrigger to force a snap to bottom.
    useEffect(() => {
        if (!scrollSnapTrigger || isUserScrolledUpRef.current) return;
        const container = getScrollContainer();
        if (container) {
            guardedScroll(() => { container.scrollTop = container.scrollHeight; });
        }
    }, [scrollSnapTrigger, scrollContainerRef]);

    // ── Intersection Observer for loading older messages ──
    // Single-source: fetches older messages from ST's chat[] via
    // loadOlderMessages() when the user scrolls near the top sentinel.
    // Scroll preservation is handled in useLayoutEffect (above) by
    // detecting firstMesId changes, NOT in the IO callback's rAF.
    const canFetchMore = messages.length < totalChatLength;

    useEffect(() => {
        if (!canFetchMore) return; // Nothing more to load
        const sentinel = sentinelRef.current;
        const scrollContainer = getScrollContainer();
        if (!sentinel || !scrollContainer) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (isSettlingRef.current) return;
                if (!entry.isIntersecting) return;
                if (loadingMoreRef.current) return;

                loadingMoreRef.current = true;

                // Snapshot scroll state BEFORE the store update + re-render.
                // These are read in the useLayoutEffect's prepend-detection
                // branch to compute the delta and preserve scroll position.
                const sc = getScrollContainer();
                if (sc) {
                    sc._lcsPrePrependScrollHeight = sc.scrollHeight;
                    sc._lcsPrePrependScrollTop = sc.scrollTop;
                }

                loadOlderMessages();

                // Brief cooldown to prevent rapid-fire loads.
                // The cooldown resets after the re-render + scroll preservation.
                setTimeout(() => { loadingMoreRef.current = false; }, 200);
            },
            {
                root: scrollContainer,
                rootMargin: '200px 0px 0px 0px',
                threshold: 0,
            }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [canFetchMore, scrollContainerRef, messages.length, totalChatLength]);

    // ── Track user scroll position ──
    // The handler distinguishes user scrolls from programmatic scrolls via
    // autoScrollActiveRef. During programmatic scrolls, layout shifts
    // (backdrop-filter recomposite, image loads, content reflow) can
    // temporarily put us far from bottom, falsely triggering "scrolled up".
    // The guard prevents this. Only genuine user scrolls set the flag.
    // Reaching the bottom always clears the flag regardless of source.
    useEffect(() => {
        const container = getScrollContainer();
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const distFromBottom = scrollHeight - scrollTop - clientHeight;

            // Near bottom — always clear (user scrolled back, or auto-scroll landed)
            if (distFromBottom <= 100) {
                isUserScrolledUpRef.current = false;
                return;
            }

            // During programmatic scrolls, don't flip the flag — layout shifts
            // can cause transient distance > 100 that isn't user intent
            if (autoScrollActiveRef.current > 0) return;

            isUserScrolledUpRef.current = true;
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [scrollContainerRef]);

    // ── Viewport-gated blur for bubble mode ──
    // In bubble mode, backdrop-filter is only applied to cards visible in the
    // viewport (+ 200px buffer). An IntersectionObserver toggles .lcs-in-viewport
    // on each card, and the CSS rule `.lcs-bubble .lcs-message.lcs-in-viewport`
    // applies the blur. Off-screen cards skip the expensive GPU compositing layer.
    // This reduces active blur layers from N (entire chat) to ~5-8 (visible cards).
    useEffect(() => {
        if (displayMode !== 'bubble') return;
        const container = getScrollContainer();
        if (!container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (let i = 0; i < entries.length; i++) {
                    entries[i].target.classList.toggle('lcs-in-viewport', entries[i].isIntersecting);
                }
            },
            { root: container, rootMargin: '200px 0px' }
        );

        const cards = container.querySelectorAll('.lcs-message');
        cards.forEach(el => observer.observe(el));

        return () => {
            observer.disconnect();
            const remaining = container.querySelectorAll('.lcs-in-viewport');
            remaining.forEach(el => el.classList.remove('lcs-in-viewport'));
        };
    }, [displayMode, messages.length, scrollContainerRef]);

    if (messages.length === 0) {
        return (
            <div className="lcs-empty">
                <div className="lcs-empty-icon">
                    <MessageSquare size={32} />
                </div>
                <div className="lcs-empty-text">
                    No messages yet. Start a conversation!
                </div>
            </div>
        );
    }

    return (
        <div className="lcs-message-list">
            {/* Load more sentinel — visible when older messages exist in ST's chat[] */}
            {canFetchMore && (
                <div className="lcs-load-more" ref={sentinelRef}>
                    <div className="lcs-load-more-spinner" />
                </div>
            )}

            {messages.map((msg) => (
                <MessageCard
                    key={`${msg.mesId}-${msg.swipeId}`}
                    message={msg}
                    isLastMessage={msg.mesId === totalChatLength - 1}
                    isStreaming={isStreaming && msg.mesId === totalChatLength - 1}
                    batchDeleteMode={batchDeleteMode}
                    batchDeleteFromId={batchDeleteFromId}
                />
            ))}

            {/* Scroll anchor */}
            <div ref={bottomRef} />
        </div>
    );
}
