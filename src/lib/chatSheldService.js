/**
 * Chat Sheld Service
 *
 * Service layer for the Chat Sheld override feature. Manages:
 * - Reading ST's chat[] array and transforming messages for React rendering
 * - Lifecycle management (mount/unmount, hide/show ST elements)
 * - Event bridge between ST events and the vanilla JS store
 * - Streaming token handling
 *
 * This module has NO React dependency — it reads ST data and pushes to the store.
 */

import { getContext, getEventSource, getEventTypes, getRequestHeaders, getCreateBranch, getTokenCountAsync, getItemizedPrompts, getDeleteMessage, getSaveChat, getUpdateMessageBlock, getSwipeAPI, getGenerate, getStopGeneration, getAddOneMessage, getSubstituteParamsFunc, getExecuteSlashCommands, isGroupChat, getGroupMembers } from "../stContext.js";
import { getSettings } from "./settingsManager.js";
import { parseOOCTags } from "./oocParser.js";
import { chatSheldStyles } from '../react-ui/components/ChatSheldStyles.js';
import { generateThemeCSSForChatSheld } from './themeManager.js';
import { getRandomJoke, onJokesReady } from './jokesService.js';

const MODULE_NAME = "lumia-injector";

// ── State ──────────────────────────────────────────────────────────────

let isActive = false;
let lastStreamingContent = '';
let storeRef = null; // Set by mountChatSheld
let eventsSubscribed = false; // Guard against double-subscribe

// Chat-length tracking — prevents ST's chat-display events
// (CHARACTER_MESSAGE_RENDERED, USER_MESSAGE_RENDERED) from triggering
// syncFullChat() when the chat hasn't actually grown. During a chat switch,
// ST fires CHARACTER_MESSAGE_RENDERED for every message it renders in the
// hidden #chat. Since chat.length doesn't change during this rendering,
// the length check reliably distinguishes "ST rendering existing messages"
// from "a genuinely new message was generated".
let _lastSyncedChatLength = 0;

// Reasoning/thinking duration tracking
let generationStartMs = null; // When GENERATION_STARTED fired
let reasoningStartMs = null;  // When we first see reasoning content during streaming
let lastReasoningContent = ''; // To detect reasoning content changes

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Check if chat sheld override is enabled in settings.
 * @returns {boolean}
 */
export function isChatSheldEnabled() {
    const settings = getSettings();
    return settings.enableChatSheld === true;
}

/**
 * Set the store reference for state updates.
 * Called during mount from index.js.
 * @param {Object} store - The vanilla JS store (useLumiverseStore)
 */
export function setStoreRef(store) {
    storeRef = store;
}

/**
 * Activate the chat sheld override.
 * Hides ST's #chat and #form_sheld, creates the container element.
 * @returns {HTMLElement|null} The container element, or null on failure
 */
export function activateChatSheld() {
    if (isActive) return document.getElementById('lumiverse-chat-root');

    const sheld = document.querySelector('#sheld');
    if (!sheld) {
        console.warn(`[${MODULE_NAME}] Chat Sheld: #sheld not found`);
        return null;
    }

    const formSheld = document.querySelector('#form_sheld');

    // Create container — starts hidden via visibility:hidden (keeps layout
    // so scroll measurements work). #chat and #form_sheld are NOT hidden
    // here; ChatSheld's useLayoutEffect does the swap atomically so there's
    // no frame where #chat is gone but our content hasn't appeared yet.
    let container = document.getElementById('lumiverse-chat-root');
    if (!container) {
        container = document.createElement('div');
        container.id = 'lumiverse-chat-root';
        container.style.cssText = 'display:flex;flex-direction:column;flex:1 1 auto;min-height:0;width:100%;visibility:hidden;position:absolute;inset:0;';

        // Insert into #sheld
        if (formSheld) {
            sheld.insertBefore(container, formSheld);
        } else {
            sheld.appendChild(container);
        }
    }

    // ── Eager visual swap ──
    // Pre-inject styles so the container looks correct before React mounts.
    // ChatSheld's useLayoutEffect will find these and skip re-creation.
    if (!document.getElementById('lcs-chat-sheld-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'lcs-chat-sheld-styles';
        styleEl.textContent = chatSheldStyles;
        document.head.appendChild(styleEl);
    }
    if (!document.getElementById('lcs-chat-sheld-theme')) {
        const themeEl = document.createElement('style');
        themeEl.id = 'lcs-chat-sheld-theme';
        const themeCSS = generateThemeCSSForChatSheld();
        if (themeCSS) themeEl.textContent = themeCSS;
        document.head.appendChild(themeEl);
    }

    // Inject loading skeleton — dedicated styles center it in the sheld
    const joke = getRandomJoke();
    const skeleton = document.createElement('div');
    skeleton.id = 'lcs-loading-skeleton';
    skeleton.className = 'lcs-app';
    skeleton.innerHTML = `
        <div class="lcs-container">
            <div class="lcs-skeleton-spinner"></div>
            <div class="lcs-skeleton-label">Loading chat\u2026</div>
            <div class="lcs-skeleton-joke">${joke || ''}</div>
        </div>`;
    container.appendChild(skeleton);

    // If jokes cache wasn't ready yet, patch the DOM once it loads
    if (!joke) {
        const unsub = onJokesReady(() => {
            const jokeEl = skeleton.querySelector('.lcs-skeleton-joke');
            if (jokeEl) jokeEl.textContent = getRandomJoke() || '';
        });
        // Clean up if skeleton is removed before jokes load
        const obs = new MutationObserver(() => {
            if (!document.contains(skeleton)) { unsub(); obs.disconnect(); }
        });
        obs.observe(container, { childList: true });
    }

    // Swap NOW — don't wait for React
    const stChat = document.querySelector('#chat');
    const stForm = document.querySelector('#form_sheld');
    if (stChat) stChat.style.display = 'none';
    if (stForm) stForm.style.display = 'none';

    // Switch from hidden absolute (used for pre-mount layout) to flex flow.
    container.style.visibility = 'visible';
    container.style.position = '';
    container.style.inset = '';

    isActive = true;
    subscribeToEvents();

    // Tail-first sync — only transform the last ~60 messages for the first frame.
    // Older messages are loaded on-demand when the user scrolls up (loadOlderMessages).
    syncTailChat();

    return container;
}

/**
 * Deactivate the chat sheld override.
 * Restores ST's #chat and #form_sheld, removes the shadow DOM container.
 */
export function deactivateChatSheld() {
    if (!isActive) return;

    // Mark inactive first to stop event handlers from processing
    isActive = false;
    eventsSubscribed = false;

    // Restore ST's native chat display
    const chat = document.querySelector('#chat');
    if (chat) {
        chat.style.display = '';
    }

    // Restore ST's input form
    const formSheld = document.querySelector('#form_sheld');
    if (formSheld) {
        formSheld.style.display = '';
    }

    // Remove container element
    const container = document.getElementById('lumiverse-chat-root');
    if (container) {
        container.remove();
    }

    // Clean up pre-injected style elements
    document.getElementById('lcs-chat-sheld-styles')?.remove();
    document.getElementById('lcs-chat-sheld-theme')?.remove();

    // Stop streaming
    stopStreaming();

    // Clear store state
    if (storeRef) {
        storeRef.setState({
            chatSheld: {
                messages: [],
                isStreaming: false,
                streamingContent: '',
                activeChat: null,
                totalChatLength: 0,
                summaryMarkers: {},
                batchDeleteMode: false,
                batchDeleteFromId: null,
            },
        });
    }

}

/**
 * Check if the chat sheld is currently active.
 * @returns {boolean}
 */
export function isChatSheldActive() {
    return isActive;
}

// ── Chat Data Reading ──────────────────────────────────────────────────

/**
 * Read ST's chat[] array and transform messages for React rendering.
 * @param {number} [startIndex=0] - Start index in the chat array
 * @param {number} [count] - Number of messages to read (default: all)
 * @returns {Array<Object>} Transformed message objects
 */
export function readChatMessages(startIndex = 0, count) {
    const ctx = getContext();
    if (!ctx?.chat?.length) return [];

    const chat = ctx.chat;
    const end = count ? Math.min(startIndex + count, chat.length) : chat.length;
    const messages = [];

    for (let i = startIndex; i < end; i++) {
        const msg = chat[i];
        if (!msg) continue;

        messages.push(transformMessage(msg, i, ctx));
    }

    return messages;
}

/**
 * Transform a single ST chat message into our React-friendly format.
 * @param {Object} msg - ST chat message object
 * @param {number} index - Message index in chat array
 * @param {Object} ctx - ST context (for character avatar resolution)
 * @returns {Object} Transformed message
 */
function transformMessage(msg, index, ctx) {
    const isUser = msg.is_user;
    const isSystem = msg.is_system;
    const isDraftHidden = isUser === true && isSystem === true;
    const name = msg.name || (isUser ? 'You' : 'Character');
    const rawContent = msg.mes || '';

    // Parse OOC tags
    const oocMatches = parseOOCTags(rawContent);

    // Extract swipe info — clamp swipeId to valid bounds in case ST hasn't
    // finished cleanup (e.g. stop-with-no-content removes the blank swipe
    // from the array before decrementing swipe_id)
    const swipes = msg.swipes || [];
    const swipeId = Math.min(msg.swipe_id ?? 0, Math.max(swipes.length - 1, 0));

    // Extract extra metadata
    const extra = msg.extra || {};

    // Resolve avatar URL using ST's character data
    // Pattern: /characters/{encoded_avatar_filename} (matches CharacterProfile.jsx)
    let avatarUrl = null;
    if (msg.force_avatar) {
        avatarUrl = msg.force_avatar;
    } else if (!isUser && !isSystem) {
        avatarUrl = resolveCharacterAvatar(msg.name, ctx);
    }

    return {
        mesId: index,
        name,
        isUser,
        isSystem,
        isDraftHidden,
        content: rawContent,
        oocMatches,
        swipes,
        swipeId,
        swipeCount: swipes.length,
        timestamp: msg.send_date || msg.date_last_edit || null,
        avatar: avatarUrl,
        reasoning: extra.reasoning || extra.thinking || null,
        reasoningDuration: extra.reasoning_duration || null,
        isBookmark: msg.is_bookmark || false,
        tokenCount: extra.token_count || null,
        extra,
    };
}

/**
 * Resolve the avatar URL for a character message.
 * Uses the same pattern as CharacterProfile.jsx: /characters/{encoded_filename}
 * @param {string} charName - Character name from the message
 * @param {Object} ctx - ST context
 * @returns {string|null} Avatar URL or null
 */
function resolveCharacterAvatar(charName, ctx) {
    if (!ctx?.characters) return null;

    // For direct chats, use the current character
    if (ctx.characterId !== undefined && !ctx.groupId) {
        const char = ctx.characters[ctx.characterId];
        if (char?.avatar) {
            return `/characters/${encodeURIComponent(char.avatar)}`;
        }
        return null;
    }

    // For group chats, find the character by name
    if (ctx.groupId && charName) {
        const char = ctx.characters.find(c => c.name === charName);
        if (char?.avatar) {
            return `/characters/${encodeURIComponent(char.avatar)}`;
        }
    }

    return null;
}

// ── Gallery cache ─────────────────────────────────────────────────────
const galleryCache = new Map(); // Map<charName, { images: Array, fetchedAt: number }>
const GALLERY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch gallery images for a character.
 * Calls ST's image list API and caches results for 5 minutes.
 * @param {string} charName - Character name
 * @returns {Promise<Array<{ path: string, title: string }>>} Image list
 */
export async function fetchGalleryImages(charName) {
    if (!charName) return [];

    // Check cache
    const cached = galleryCache.get(charName);
    if (cached && Date.now() - cached.fetchedAt < GALLERY_CACHE_TTL) {
        return cached.images;
    }

    const ctx = getContext();
    if (!ctx) return [];

    // Determine gallery folder: check for custom override, fallback to character name
    const avatar = ctx.characters?.[ctx.characterId]?.avatar;
    const customFolder = ctx.extensionSettings?.gallery?.folders?.[avatar];
    const folder = customFolder || charName;

    try {
        const response = await fetch(`/api/images/list/${encodeURIComponent(folder)}`, {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ sort: 'date', direction: 'desc' }),
        });

        if (!response.ok) return [];

        const data = await response.json();
        // API returns filenames (strings) or objects with path/title.
        // Files are served at /user/images/{folder}/{filename}.
        const baseUrl = `/user/images/${encodeURIComponent(folder)}`;
        const images = (data || []).map(item => {
            const raw = typeof item === 'string' ? item : (item.path || item.src || '');
            const title = typeof item === 'string' ? raw.split('/').pop() : (item.title || item.name || raw.split('/').pop());
            // If already an absolute/full path, use as-is; otherwise prefix with base
            const path = raw.startsWith('/') || raw.startsWith('http')
                ? raw
                : `${baseUrl}/${encodeURIComponent(raw)}`;
            return { path, title };
        });

        galleryCache.set(charName, { images, fetchedAt: Date.now() });
        return images;
    } catch (e) {
        console.warn(`[${MODULE_NAME}] Failed to fetch gallery for "${charName}":`, e.message);
        return [];
    }
}

/**
 * Clear the gallery cache (e.g., on chat switch).
 */
export function clearGalleryCache() {
    galleryCache.clear();
}

/**
 * Sync the full chat array to the store.
 * Called on GENERATION_ENDED, MESSAGE_EDITED, MESSAGE_DELETED, etc.
 * Checks actual ST generation state rather than blindly setting isStreaming.
 */
export function syncFullChat() {
    if (!storeRef || !isActive) return;

    const ctx = getContext();
    const messages = readChatMessages();
    const activeChat = ctx?.chatId || null;

    // Use streamingActive (set/cleared by our own GENERATION_STARTED/ENDED/STOPPED
    // handlers) as the source of truth — NOT isSTGenerating(), which is a DOM
    // heuristic checking #mes_stop visibility. The DOM check races with ST's
    // cleanup: when GENERATION_STOPPED fires, ST may not have hidden #mes_stop
    // yet, causing isSTGenerating() to return true and overwrite the isStreaming:false
    // that stopStreaming() just set.

    _lastSyncedChatLength = messages.length;

    const current = storeRef.getState().chatSheld;
    storeRef.setState({
        chatSheld: {
            ...current,
            messages,
            activeChat,
            totalChatLength: messages.length,
            isStreaming: streamingActive,
            streamingContent: streamingActive ? (current?.streamingContent || '') : '',
            summaryMarkers: current?.summaryMarkers || {},
        },
    });
}

/**
 * Tail-first chat sync — only transform the last `tailSize` messages
 * synchronously, then backfill older messages after React paints.
 * @param {number} [tailSize=50] - Number of tail messages to sync immediately
 */
export function syncTailChat(tailSize) {
    if (tailSize === undefined) {
        tailSize = getSettings().chatSheldPageSize || 50;
    }
    if (!storeRef || !isActive) return;

    const ctx = getContext();
    if (!ctx?.chat?.length) return;

    const chatLength = ctx.chat.length;
    const activeChat = ctx.chatId || null;
    const tailStart = Math.max(0, chatLength - tailSize);
    const messages = readChatMessages(tailStart);

    const actuallyGenerating = isSTGenerating();
    const current = storeRef.getState().chatSheld;

    // Track the full chat length — CHARACTER_MESSAGE_RENDERED events will
    // only be processed when chat.length exceeds this value, meaning a
    // genuinely new message was generated (not just ST rendering existing
    // messages in its hidden #chat during chat display).
    _lastSyncedChatLength = chatLength;

    storeRef.setState({
        chatSheld: {
            messages,
            activeChat,
            totalChatLength: chatLength,
            isStreaming: actuallyGenerating,
            streamingContent: actuallyGenerating ? (current?.streamingContent || '') : '',
            summaryMarkers: current?.summaryMarkers || {},
        },
    });
}

/**
 * Load older messages on demand (called from MessageList's IO observer).
 * Reads `count` messages from ST's chat[] before the oldest loaded message
 * and prepends them to the store.
 * @param {number} [count=50] - Number of older messages to load
 */
export function loadOlderMessages(count) {
    if (count === undefined) {
        count = getSettings().chatSheldPageSize || 50;
    }
    if (!storeRef || !isActive) return;
    const ctx = getContext();
    if (!ctx?.chat?.length) return;

    const current = storeRef.getState().chatSheld;
    const totalLength = current.totalChatLength || ctx.chat.length;
    const loadedCount = current.messages.length;
    if (loadedCount >= totalLength) return;

    // Store messages are always a contiguous tail slice.
    // Oldest loaded message index = totalLength - loadedCount.
    const oldestLoadedIndex = totalLength - loadedCount;
    const fetchStart = Math.max(0, oldestLoadedIndex - count);
    const fetchCount = oldestLoadedIndex - fetchStart;

    const olderMessages = readChatMessages(fetchStart, fetchCount);

    storeRef.setState({
        chatSheld: {
            ...current,
            messages: [...olderMessages, ...current.messages],
        },
    });
}

/**
 * Update a single message at a given index in the store.
 * Used for MESSAGE_EDITED, MESSAGE_SWIPED events.
 * @param {number} mesId - Message index
 */
export function syncSingleMessage(mesId) {
    if (!storeRef || !isActive) return;

    const ctx = getContext();
    if (!ctx?.chat?.[mesId]) return;

    const updated = transformMessage(ctx.chat[mesId], mesId, ctx);
    const current = storeRef.getState().chatSheld;
    const messages = [...current.messages];

    // Find and replace the message at this index
    const idx = messages.findIndex(m => m.mesId === mesId);
    if (idx !== -1) {
        messages[idx] = updated;
    }

    storeRef.setState({
        chatSheld: { ...current, messages },
    });
}

/**
 * Append only genuinely new messages to the store.
 * Compares ST's chat[] length against the store's current messages and
 * transforms only the delta. Existing message object references are
 * preserved so React.memo skips unchanged cards — O(delta) instead of
 * O(N) for a full re-transform.
 *
 * Falls back to syncFullChat() when the store is empty or indices are
 * inconsistent (e.g. after a delete that shifted indices).
 */
export function appendNewMessages() {
    if (!storeRef || !isActive) return;

    const ctx = getContext();
    if (!ctx?.chat?.length) return;

    const current = storeRef.getState().chatSheld;
    const storeMessages = current?.messages;

    // If the store is empty or has no messages, fall back to full sync
    if (!storeMessages || storeMessages.length === 0) {
        syncFullChat();
        return;
    }

    const lastStoreMesId = storeMessages[storeMessages.length - 1].mesId;
    const chatLength = ctx.chat.length;

    // If ST chat has fewer or equal messages, nothing new to append
    if (chatLength <= lastStoreMesId + 1) return;

    // If the store's last mesId doesn't align with what we expect
    // (e.g. after a delete shifted indices), fall back to full sync
    if (lastStoreMesId < 0 || lastStoreMesId >= chatLength) {
        syncFullChat();
        return;
    }

    // Transform only the new messages beyond our last known index
    const newStartIndex = lastStoreMesId + 1;
    const newMessages = [];
    for (let i = newStartIndex; i < chatLength; i++) {
        if (ctx.chat[i]) {
            newMessages.push(transformMessage(ctx.chat[i], i, ctx));
        }
    }

    if (newMessages.length === 0) return;

    _lastSyncedChatLength = chatLength;

    storeRef.setState({
        chatSheld: {
            ...current,
            messages: [...storeMessages, ...newMessages],
            totalChatLength: chatLength,
            isStreaming: streamingActive,
            streamingContent: streamingActive ? (current.streamingContent || '') : '',
        },
    });
}

/**
 * Append a new message (after CHARACTER_MESSAGE_RENDERED).
 * Uses appendNewMessages() for O(1) targeted append instead of
 * full O(N) re-transform.
 */
export function appendMessage() {
    appendNewMessages();
}

/**
 * Handle message deletion — re-sync full chat since indices shift.
 */
export function handleMessageDeleted() {
    syncFullChat();
}

// ── Streaming Support ──────────────────────────────────────────────────

/** Throttle interval for stream token updates (~30fps) */
const STREAMING_THROTTLE_MS = 33;
let streamingThrottleTimer = null;
let streamingActive = false;

/**
 * Check whether ST is actively generating by inspecting #mes_stop inline style.
 * NOTE: We check the inline style directly instead of offsetParent because
 * #mes_stop lives inside #form_sheld, which is hidden (display:none) when
 * the chat sheld override is active. ST sets display:flex via inline style
 * when generating.
 * @returns {boolean}
 */
function isSTGenerating() {
    const mesStop = document.getElementById('mes_stop');
    if (!mesStop) return false;
    const d = mesStop.style.display;
    return d !== 'none' && d !== '';
}

/**
 * Begin streaming mode — sets isStreaming and streamingActive.
 * Called from GENERATION_STARTED handler (deferred) as a backup.
 * The primary activation path is handleStreamToken() on first token.
 */
export function startStreaming() {
    if (!storeRef || !isActive || streamingActive) return;

    streamingActive = true;
    lastStreamingContent = '';

    // Pick up any new messages (e.g. blank message from overswipe)
    appendNewMessages();

    // Set streaming flag after sync
    const current = storeRef.getState().chatSheld;
    storeRef.setState({
        chatSheld: { ...current, isStreaming: true, streamingContent: '' },
    });
}

/**
 * Handle a stream token event from ST.
 * Throttled to ~30fps — reads the accumulated content from chat[] and
 * updates the LAST message in the store's messages array.
 *
 * Auto-activates streaming on the first token if not already active.
 * This is the primary activation path — more reliable than the deferred
 * GENERATION_STARTED check since it proves tokens are actually flowing.
 */
function handleStreamToken() {
    if (!isActive || !storeRef) return;

    // Auto-activate streaming on first token if not yet active.
    // This is the primary path — GENERATION_STARTED's deferred startStreaming()
    // is a backup that may fail if #mes_stop isn't visible yet.
    if (!streamingActive) {
        streamingActive = true;
        lastStreamingContent = '';
        // Pick up any new messages (user msg, blank swipe, etc.)
        appendNewMessages();
        const current = storeRef.getState().chatSheld;
        if (!current?.isStreaming) {
            storeRef.setState({
                chatSheld: { ...current, isStreaming: true, streamingContent: '' },
            });
        }
    }

    // Throttle: skip if a pending update is already queued
    if (streamingThrottleTimer) return;
    streamingThrottleTimer = setTimeout(() => {
        streamingThrottleTimer = null;
        updateStreamingMessage();
    }, STREAMING_THROTTLE_MS);
}

/**
 * Read the latest content from ST's chat[] and push it into the store's
 * last message entry. This causes MessageCard to re-render with new text.
 * Also tracks reasoning content changes for live duration display.
 */
function updateStreamingMessage() {
    if (!storeRef || !isActive) return;

    const ctx = getContext();
    if (!ctx?.chat?.length) return;

    const lastMsg = ctx.chat[ctx.chat.length - 1];
    const content = lastMsg?.mes || '';
    const extra = lastMsg?.extra || {};
    const reasoning = extra.reasoning || extra.thinking || '';

    // Track reasoning start time for live timer
    if (reasoning && !lastReasoningContent && !reasoningStartMs) {
        reasoningStartMs = Date.now();
    }
    lastReasoningContent = reasoning;

    // Skip if nothing changed (content AND reasoning)
    const reasoningDuration = extra.reasoning_duration || null;
    if (content === lastStreamingContent && !reasoning) return;
    lastStreamingContent = content;

    let current = storeRef.getState().chatSheld;

    // Guard: if the store is behind ctx.chat (e.g. the blank assistant
    // message was added after GENERATION_STARTED's deferred appendNewMessages
    // ran), sync now so we update the correct message slot — not the user's.
    if (ctx.chat.length > (current.totalChatLength || 0)) {
        appendNewMessages();
        current = storeRef.getState().chatSheld;
    }

    const messages = [...current.messages];
    const lastIdx = messages.length - 1;

    if (lastIdx >= 0) {
        const updates = { content };

        // Update reasoning content and duration during streaming
        if (reasoning) {
            updates.reasoning = reasoning;
            // If ST provides the duration, use it; otherwise use our tracked start time
            updates.reasoningDuration = reasoningDuration;
            updates.reasoningStartMs = reasoningStartMs;
        }

        messages[lastIdx] = { ...messages[lastIdx], ...updates };
    }

    storeRef.setState({
        chatSheld: { ...current, messages, streamingContent: content },
    });
}

/**
 * Stop streaming mode and clear streaming state in the store.
 */
export function stopStreaming() {
    if (streamingThrottleTimer) {
        clearTimeout(streamingThrottleTimer);
        streamingThrottleTimer = null;
    }
    streamingActive = false;
    lastStreamingContent = '';
    generationStartMs = null;
    reasoningStartMs = null;
    lastReasoningContent = '';

    // Clear streaming state in the store immediately
    if (storeRef) {
        const current = storeRef.getState().chatSheld;
        if (current?.isStreaming) {
            storeRef.setState({
                chatSheld: { ...current, isStreaming: false, streamingContent: '' },
            });
        }
    }
}

/**
 * Reset streaming state for cross-chat transitions.
 * Called by manageChatSheld() in index.js BEFORE syncTailChat() so the new
 * chat doesn't inherit stale isStreaming:true from the previous chat's
 * unfinished generation. Without this, syncTailChat/syncFullChat read
 * streamingActive (still true) and set isStreaming:true for the wrong chat.
 */
export function resetStreamingState() {
    if (streamingActive) {
        stopStreaming();
    }
}

/**
 * Belt-and-suspenders cleanup after generate() resolves.
 * ST's generate() is async and resolves when the generation pipeline completes.
 * By this point, GENERATION_ENDED should have already fired and cleaned up —
 * but if the event was missed or timing was off, this ensures we don't get
 * stuck with isStreaming:true and stale content.
 */
function _ensureGenerationCleanup() {
    if (!storeRef || !isActive) return;
    // If GENERATION_ENDED already handled cleanup, streamingActive is false
    // and isStreaming in the store is false. This is a no-op.
    if (!streamingActive && !storeRef.getState().chatSheld?.isStreaming) return;
    // Something was missed — force cleanup
    stopStreaming();
    syncFullChat();
}

// ── Event Bridge ───────────────────────────────────────────────────────

/**
 * Subscribe to ST events and bridge them to store updates.
 * Uses a flag guard instead of unsubscription since ST's event emitter
 * may not support .off() reliably. Handlers check isActive before processing.
 */
function subscribeToEvents() {
    if (eventsSubscribed) return;

    const eventSource = getEventSource();
    const event_types = getEventTypes();
    if (!eventSource || !event_types) {
        console.warn(`[${MODULE_NAME}] Chat Sheld: Event source or types not available`);
        return;
    }

    // Define event handlers — all check isActive before processing
    // so deactivation effectively "unsubscribes" without needing .off()
    const safeOn = (eventName, handler) => {
        if (eventName) {
            eventSource.on(eventName, handler);
        }
    };

    // NOTE: No CHAT_CHANGED handler here — manageChatSheld() in index.js
    // already calls syncTailChat() on chat switch and resetStreamingState()
    // before it to clear stale generation context from the previous chat.

    safeOn(event_types.CHARACTER_MESSAGE_RENDERED, () => {
        if (!isActive) return;
        // Only process if the chat has genuinely grown — a new message was
        // generated, not just ST rendering existing messages in its hidden
        // #chat during chat display. This replaces the timer-based settling
        // guard with a deterministic check that works regardless of how long
        // ST takes to render its DOM.
        const ctx = getContext();
        if (!ctx?.chat || ctx.chat.length <= _lastSyncedChatLength) return;
        stopStreaming();
        appendMessage();
    });

    // User message rendered — fires after user sends a message, before generation starts.
    // Critical for showing the user's message immediately in the chat sheld.
    if (event_types.USER_MESSAGE_RENDERED) {
        safeOn(event_types.USER_MESSAGE_RENDERED, () => {
            if (!isActive) return;
            const ctx = getContext();
            if (!ctx?.chat || ctx.chat.length <= _lastSyncedChatLength) return;
            appendNewMessages();
        });
    }

    safeOn(event_types.MESSAGE_EDITED, (mesId) => {
        if (!isActive) return;
        if (typeof mesId === 'number') {
            syncSingleMessage(mesId);
        } else {
            syncFullChat();
        }
    });

    safeOn(event_types.MESSAGE_SWIPED, (mesId) => {
        if (!isActive) return;
        // Single-message sync — only re-transform the swiped message instead of
        // the entire chat. syncFullChat() created N new objects which defeated
        // React.memo on every MessageCard, causing a full re-render of every
        // card in the list. syncSingleMessage only replaces one element in the
        // array, so memo skips all unchanged cards.
        if (typeof mesId === 'number') {
            syncSingleMessage(mesId);
        } else {
            // Fallback for edge cases where mesId is not provided
            syncFullChat();
        }
        // Trigger scroll snap — swipe doesn't change message count/lastMesId
        // so the normal "new message" scroll effect doesn't fire.
        // Only snap when NOT streaming (i.e. left-swipe with restored content).
        // During right-swipe, isStreaming is already true (set in triggerSwipe),
        // so the RAF-batched streaming scroll handler manages position instead.
        if (storeRef && !streamingActive) {
            const cs = storeRef.getState().chatSheld;
            storeRef.setState({ chatSheld: { ...cs, scrollSnapTrigger: Date.now() } });
        }
    });

    // MESSAGE_DELETED may not exist in all ST versions — guard with optional chaining
    if (event_types.MESSAGE_DELETED) {
        safeOn(event_types.MESSAGE_DELETED, () => {
            if (!isActive) return;
            handleMessageDeleted();
        });
    }

    // GENERATION_STARTED fires with (type, options, dryRun).
    // Ignore quiet prompts (background summarization etc.) and dry runs.
    //
    // Critical perf note: syncFullChat() is O(N × message_length) — it re-transforms
    // every message (regex OOC parse, avatar lookup, object allocation). For a 50-message
    // chat this is 50-200ms of synchronous main-thread work. Combined with assembleMessages()
    // in CHAT_COMPLETION_SETTINGS_READY (~50-300ms), the total freeze is 170-600ms.
    //
    // If the user scrolls during this freeze, the GPU compositor shifts stale
    // backdrop-filter textures to new positions. When the thread unblocks, those
    // textures aren't repainted — rendering as a black void until the next scroll.
    //
    // Fix: For swipe/regenerate, skip syncFullChat entirely (triggerSwipe/triggerRegenerate
    // already blanked the last message — nothing else changed). For normal generation,
    // defer syncFullChat to a microtask so the browser can paint the streaming state first.
    safeOn(event_types.GENERATION_STARTED, (type, options, dryRun) => {
        if (!isActive) return;
        if (dryRun) return; // No actual generation
        if (options?.quiet_prompt) return; // Background operation

        // Track the generation context for reasoning duration
        generationStartMs = Date.now();
        reasoningStartMs = null;
        lastReasoningContent = '';

        // Set isStreaming in store immediately so UI shows stop button, etc.
        // ALSO set the module-level streamingActive flag and reset
        // lastStreamingContent so that neither the deferred startStreaming()
        // backup nor handleStreamToken()'s first-token path call
        // syncFullChat() again — which would overwrite the blanked
        // assistant message with stale content from chat[].
        streamingActive = true;
        lastStreamingContent = '';
        const current = storeRef.getState().chatSheld;
        if (!current?.isStreaming) {
            storeRef.setState({
                chatSheld: { ...current, isStreaming: true, streamingContent: '' },
            });
        }

        if (type === 'swipe' || type === 'regenerate') {
            // For swipe/regenerate, triggerSwipe()/triggerRegenerate() already blanked
            // the last assistant message and set isStreaming. The only thing syncFullChat
            // could add is re-reading unchanged messages — pure waste that blocks the
            // main thread. If for some reason the blank didn't happen (e.g. keyboard
            // shortcut bypassing our trigger functions), do a targeted single-message
            // blank instead of a full chat re-transform.
            const state = storeRef.getState().chatSheld;
            if (state?.messages?.length > 0) {
                const msgs = state.messages;
                let alreadyBlanked = false;
                for (let i = msgs.length - 1; i >= 0; i--) {
                    if (!msgs[i].isUser && !msgs[i].isSystem) {
                        alreadyBlanked = msgs[i].content === '';
                        break;
                    }
                }
                if (!alreadyBlanked) {
                    // Targeted blank — only clone the array and the one message
                    const cloned = [...msgs];
                    for (let i = cloned.length - 1; i >= 0; i--) {
                        if (!cloned[i].isUser && !cloned[i].isSystem) {
                            cloned[i] = { ...cloned[i], content: '', reasoning: null, reasoningDuration: null };
                            break;
                        }
                    }
                    storeRef.setState({
                        chatSheld: { ...state, messages: cloned, scrollSnapTrigger: Date.now() },
                    });
                }
            }
        } else {
            // Normal generation (user sent a message) — defer append to a
            // microtask so the browser can paint the isStreaming state first.
            // appendNewMessages() is O(delta) instead of O(N).
            queueMicrotask(() => {
                if (!isActive) return;
                appendNewMessages();
            });
        }

        // Deferred backup — startStreaming() guards on streamingActive,
        // so this is now a no-op for the common path but still covers
        // edge cases where streamingActive was reset between events.
        setTimeout(() => {
            if (!isActive) return;
            startStreaming();
        }, 100);
    });

    // Per-token streaming updates — replaces RAF polling for much better efficiency
    if (event_types.STREAM_TOKEN_RECEIVED) {
        safeOn(event_types.STREAM_TOKEN_RECEIVED, () => {
            handleStreamToken();
        });
    }

    safeOn(event_types.GENERATION_ENDED, () => {
        if (!isActive) return;
        // Capture before stopStreaming() clears it — if no tokens were ever
        // received, this was a failed/empty gen and we shouldn't force-scroll.
        const hadContent = lastStreamingContent.length > 0;
        stopStreaming();
        // Only sync the last message — generation only modifies one message.
        // O(1) instead of O(N) full re-transform.
        const ctx = getContext();
        if (ctx?.chat?.length) {
            syncSingleMessage(ctx.chat.length - 1);
        }
        // Bump scrollSnapTrigger — message count/lastMesId didn't change
        // (same message, just finished streaming), so the normal "new message"
        // scroll effect doesn't fire. Without this, scroll position drifts.
        // Skip if gen produced no content (failed/errored) to avoid random scrolling.
        if (storeRef && hadContent) {
            const cs = storeRef.getState().chatSheld;
            storeRef.setState({ chatSheld: { ...cs, scrollSnapTrigger: Date.now() } });
        }
    });

    safeOn(event_types.GENERATION_STOPPED, () => {
        if (!isActive) return;
        const hadContent = lastStreamingContent.length > 0;
        stopStreaming();
        // Only sync the last message — stop only affects the in-progress message.
        const ctx = getContext();
        if (ctx?.chat?.length) {
            syncSingleMessage(ctx.chat.length - 1);
        }
        // Only snap to bottom if the generation actually produced content.
        // A failed/stopped gen with no tokens shouldn't disturb scroll position.
        if (storeRef && hadContent) {
            const cs = storeRef.getState().chatSheld;
            storeRef.setState({ chatSheld: { ...cs, scrollSnapTrigger: Date.now() } });
        }
    });

    eventsSubscribed = true;
}

// ── ST Action Delegation ───────────────────────────────────────────────

/**
 * Trigger a swipe on the last message via ST's programmatic swipe API.
 * Uses ctx.swipe.left()/right() — no DOM clicks, no animation timeout issues.
 * Falls back to DOM click if the API is unavailable.
 * @param {'left'|'right'} direction
 */
export async function triggerSwipe(direction) {
    // Direction-aware visual-first:
    // - Right-swipe (new generation): blank content AND set isStreaming so streaming
    //   dots render immediately, preventing the empty-div height collapse that corrupts
    //   backdrop-filter compositing layers.
    // - Left-swipe (cached content): skip the blank entirely — syncSingleMessage from
    //   MESSAGE_SWIPED restores cached swipe content almost immediately. Old content
    //   briefly showing then morphing to new is better UX than a blank flash.
    if (storeRef && isActive && direction === 'right') {
        const current = storeRef.getState().chatSheld;
        const messages = [...current.messages];
        const lastIdx = messages.length - 1;
        if (lastIdx >= 0) {
            messages[lastIdx] = { ...messages[lastIdx], content: '', reasoning: null, reasoningDuration: null };
            streamingActive = true;
            lastStreamingContent = '';
            storeRef.setState({
                chatSheld: { ...current, messages, isStreaming: true, streamingContent: '' },
            });
        }
    }

    const swipeAPI = getSwipeAPI();
    if (swipeAPI) {
        try {
            if (direction === 'left') {
                await swipeAPI.left();
            } else {
                await swipeAPI.right();
            }
            // Swipe-right triggers a new generation — ensure cleanup
            if (direction === 'right') _ensureGenerationCleanup();
            return;
        } catch (e) {
            console.warn(`[${MODULE_NAME}] Swipe API failed, falling back to DOM click:`, e.message);
        }
    }

    // Fallback: DOM click (for older ST versions)
    const selector = direction === 'left'
        ? '.last_mes .swipe_left'
        : '.last_mes .swipe_right';
    try {
        jQuery(selector).trigger('click');
    } catch (e) {
        const btn = document.querySelector(selector);
        if (btn) btn.click();
    }
}

/**
 * Navigate to a specific greeting (swipe index) on message 0.
 * Uses the swipe API's to() method for direct index navigation.
 * @param {number} swipeIndex - The greeting index to navigate to
 */
export async function navigateToGreeting(swipeIndex) {
    const ctx = getContext();
    if (!ctx?.chat?.[0]) return;

    const currentSwipeId = ctx.chat[0].swipe_id ?? 0;
    if (swipeIndex === currentSwipeId) return;

    try {
        // Direct jump via forceSwipeId — ctx.swipe.to() is the raw swipe() function
        await ctx.swipe.to(null, 'right', {
            forceMesId: 0,
            forceSwipeId: swipeIndex,
        });
        syncSingleMessage(0);
    } catch (e) {
        console.warn(`[${MODULE_NAME}] navigateToGreeting failed:`, e.message);
        syncSingleMessage(0);
    }
}

/**
 * Get greeting texts for the current character, sourced directly from the
 * character card data. This is more reliable than reading chat[0].swipes
 * because ST only syncs swipes to storage for tainted/multi-message chats.
 * @returns {string[]} Array of greeting texts: [primary, alt1, alt2, ...]
 */
export function getCharacterGreetings() {
    const ctx = getContext();

    // Source 1: Character card data (canonical — always has greeting text if character is loaded)
    const charId = ctx?.characterId;
    if (charId !== undefined && charId !== null && charId >= 0 && ctx?.characters?.[charId]) {
        const char = ctx.characters[charId];
        const primary = char.first_mes ?? char.data?.first_mes ?? '';
        const alts = char.data?.alternate_greetings;
        if (primary || (Array.isArray(alts) && alts.length > 0)) {
            const result = [primary, ...(Array.isArray(alts) ? alts : [])];
            console.debug(`[Lumiverse] getCharacterGreetings: ${result.length} greetings from character card (charId=${charId})`);
            return result;
        }
    }

    // Source 2: Live chat[0] swipes (fallback — has runtime greeting text after macro resolution)
    const firstMsg = ctx?.chat?.[0];
    if (firstMsg?.swipes?.length > 0) {
        console.debug(`[Lumiverse] getCharacterGreetings: ${firstMsg.swipes.length} greetings from chat[0].swipes (charId=${charId})`);
        return [...firstMsg.swipes];
    }

    console.warn(`[Lumiverse] getCharacterGreetings: no greetings found (charId=${charId}, characters loaded=${!!ctx?.characters})`);
    return [];
}

/**
 * Delete a message via ST's programmatic deleteMessage API.
 * ST's deleteMessage handles: chat.splice, DOM removal, updateViewMessageIds,
 * deleteItemizedPromptForMessage, chat_metadata.tainted, emitting MESSAGE_DELETED, saving chat.
 * @param {number} mesId - Message index
 * @returns {Promise<boolean>} Success
 */
export async function deleteMessageDirect(mesId) {
    const deleteMessage = getDeleteMessage();
    if (!deleteMessage) {
        console.error(`[${MODULE_NAME}] deleteMessage API not available`);
        return false;
    }

    // Visual-first: remove the message from the React list immediately
    // so the user sees instant feedback before the ST API persists.
    if (storeRef && isActive) {
        const current = storeRef.getState().chatSheld;
        const messages = current.messages.filter(m => m.mesId !== mesId);
        storeRef.setState({ chatSheld: { ...current, messages } });
    }

    try {
        await deleteMessage(mesId, null, false);
        syncFullChat();
        return true;
    } catch (e) {
        console.error(`[${MODULE_NAME}] deleteMessage failed for mesId=${mesId}:`, e);
        // Re-sync to restore correct state on failure
        syncFullChat();
        return false;
    }
}

/**
 * Delete a single swipe from a message via ST's deleteMessage API.
 * ST's deleteMessage with a swipeDeletionIndex routes to deleteSwipe() internally,
 * which handles: swipes.splice, swipe_info.splice, swipe animation, saveChatConditional,
 * and emitting MESSAGE_SWIPE_DELETED.
 * @param {number} mesId - Message index
 * @param {number} swipeId - Swipe index to delete
 * @returns {Promise<boolean>} Success
 */
export async function deleteSwipeDirect(mesId, swipeId) {
    const deleteMessage = getDeleteMessage();
    if (!deleteMessage) {
        console.error(`[${MODULE_NAME}] deleteMessage API not available for swipe deletion`);
        return false;
    }

    try {
        await deleteMessage(mesId, swipeId, false);
        syncFullChat();
        return true;
    } catch (e) {
        console.error(`[${MODULE_NAME}] deleteSwipe failed for mesId=${mesId}, swipeId=${swipeId}:`, e);
        syncFullChat();
        return false;
    }
}

/**
 * Copy message content to clipboard.
 * @param {string} content - Message content to copy
 */
export async function copyMessageContent(content) {
    try {
        const temp = document.createElement('div');
        temp.innerHTML = content;
        const text = temp.textContent || temp.innerText || '';
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

/**
 * Edit message content via ST's programmatic APIs.
 * Updates chat[], swipes, calls updateMessageBlock, saves, and emits events.
 * @param {number} mesId - Message index
 * @param {string} newContent - New message content
 * @returns {Promise<boolean>} Success
 */
export async function editMessageContent(mesId, newContent) {
    const ctx = getContext();
    const msg = ctx?.chat?.[mesId];
    if (!msg) return false;

    // Visual-first: update the React list immediately so the edit
    // feels instant while the save/event emission happens in the background.
    if (storeRef && isActive) {
        const current = storeRef.getState().chatSheld;
        const messages = [...current.messages];
        const idx = messages.findIndex(m => m.mesId === mesId);
        if (idx !== -1) {
            messages[idx] = { ...messages[idx], content: newContent };
            storeRef.setState({ chatSheld: { ...current, messages } });
        }
    }

    try {
        msg.mes = newContent;
        if (msg.swipe_id !== undefined && Array.isArray(msg.swipes)) {
            msg.swipes[msg.swipe_id] = newContent;
        }

        const updateBlock = getUpdateMessageBlock();
        if (updateBlock) updateBlock(mesId, msg);

        const saveChat = getSaveChat();
        if (saveChat) await saveChat();

        const es = getEventSource();
        const et = getEventTypes();
        if (es && et) {
            if (et.MESSAGE_EDITED) es.emit(et.MESSAGE_EDITED, mesId);
            if (et.MESSAGE_UPDATED) es.emit(et.MESSAGE_UPDATED, mesId);
        }

        // No syncFullChat() here — visual-first update already applied above,
        // and MESSAGE_EDITED handler calls syncSingleMessage(mesId) for reconciliation.
        return true;
    } catch (e) {
        console.error(`[${MODULE_NAME}] editMessageContent failed for mesId=${mesId}:`, e);
        syncFullChat(); // Error recovery — re-sync to restore correct state
        return false;
    }
}

/**
 * Edit message reasoning/thinking via ST's programmatic APIs.
 * Updates msg.extra.reasoning, saves, and emits events.
 * @param {number} mesId - Message index
 * @param {string} newReasoning - New reasoning content (empty string to remove)
 * @returns {Promise<boolean>} Success
 */
export async function editMessageReasoning(mesId, newReasoning) {
    const ctx = getContext();
    const msg = ctx?.chat?.[mesId];
    if (!msg) return false;

    // Visual-first: update reasoning in the React list immediately.
    if (storeRef && isActive) {
        const current = storeRef.getState().chatSheld;
        const messages = [...current.messages];
        const idx = messages.findIndex(m => m.mesId === mesId);
        if (idx !== -1) {
            messages[idx] = { ...messages[idx], reasoning: newReasoning || null };
            storeRef.setState({ chatSheld: { ...current, messages } });
        }
    }

    try {
        msg.extra ??= {};
        msg.extra.reasoning = newReasoning;
        msg.extra.reasoning_type = msg.extra.reasoning_type ? 'edited' : 'manual';

        const updateBlock = getUpdateMessageBlock();
        if (updateBlock) updateBlock(mesId, msg);

        const saveChat = getSaveChat();
        if (saveChat) await saveChat();

        const es = getEventSource();
        const et = getEventTypes();
        if (es && et && et.MESSAGE_REASONING_EDITED) {
            es.emit(et.MESSAGE_REASONING_EDITED, mesId);
        }

        // No syncFullChat() here — visual-first update already applied above.
        return true;
    } catch (e) {
        console.error(`[${MODULE_NAME}] editMessageReasoning failed for mesId=${mesId}:`, e);
        syncFullChat(); // Error recovery — re-sync to restore correct state
        return false;
    }
}

/**
 * Get the raw message content for editing (before HTML rendering).
 * @param {number} mesId - Message index
 * @returns {{ content: string, reasoning: string|null, isUser: boolean, isSystem: boolean }|null}
 */
export function getRawMessageForEdit(mesId) {
    const ctx = getContext();
    const msg = ctx?.chat?.[mesId];
    if (!msg) return null;

    return {
        content: msg.mes || '',
        reasoning: msg.extra?.reasoning || null,
        isUser: msg.is_user === true,
        isSystem: msg.is_system === true,
    };
}

// ── Draft Hider ─────────────────────────────────────────────────────────

/**
 * Hide a user message from AI context by setting is_system = true.
 * When is_user && is_system, ST's prompt builder excludes the message.
 * Uses optimistic store update → mutate chat[] → DOM consistency → save.
 * @param {number} mesId - Message index
 * @returns {Promise<boolean>} Success
 */
export async function hideMessage(mesId) {
    const ctx = getContext();
    const msg = ctx?.chat?.[mesId];
    if (!msg || !msg.is_user) return false;

    // Optimistic store update
    if (storeRef && isActive) {
        const current = storeRef.getState().chatSheld;
        const messages = [...current.messages];
        const idx = messages.findIndex(m => m.mesId === mesId);
        if (idx !== -1) {
            messages[idx] = { ...messages[idx], isSystem: true, isDraftHidden: true };
            storeRef.setState({ chatSheld: { ...current, messages } });
        }
    }

    try {
        msg.is_system = true;

        const updateBlock = getUpdateMessageBlock();
        if (updateBlock) updateBlock(mesId, msg);

        const saveChat = getSaveChat();
        if (saveChat) await saveChat();

        return true;
    } catch (e) {
        console.error(`[${MODULE_NAME}] hideMessage failed for mesId=${mesId}:`, e);
        syncFullChat();
        return false;
    }
}

/**
 * Restore a hidden-draft message back to normal user message.
 * @param {number} mesId - Message index
 * @returns {Promise<boolean>} Success
 */
export async function unhideMessage(mesId) {
    const ctx = getContext();
    const msg = ctx?.chat?.[mesId];
    if (!msg || !msg.is_user) return false;

    // Optimistic store update
    if (storeRef && isActive) {
        const current = storeRef.getState().chatSheld;
        const messages = [...current.messages];
        const idx = messages.findIndex(m => m.mesId === mesId);
        if (idx !== -1) {
            messages[idx] = { ...messages[idx], isSystem: false, isDraftHidden: false };
            storeRef.setState({ chatSheld: { ...current, messages } });
        }
    }

    try {
        msg.is_system = false;

        const updateBlock = getUpdateMessageBlock();
        if (updateBlock) updateBlock(mesId, msg);

        const saveChat = getSaveChat();
        if (saveChat) await saveChat();

        return true;
    } catch (e) {
        console.error(`[${MODULE_NAME}] unhideMessage failed for mesId=${mesId}:`, e);
        syncFullChat();
        return false;
    }
}

/**
 * Hide all user messages from AI context (batch operation).
 * Sets is_system = true on every is_user && !is_system message.
 * @returns {Promise<boolean>} Success
 */
export async function hideAllUserMessages() {
    const ctx = getContext();
    if (!ctx?.chat?.length) return false;

    try {
        let changed = false;
        for (const msg of ctx.chat) {
            if (msg.is_user && !msg.is_system) {
                msg.is_system = true;
                changed = true;
            }
        }

        if (!changed) return true;

        const saveChat = getSaveChat();
        if (saveChat) await saveChat();

        syncFullChat();
        return true;
    } catch (e) {
        console.error(`[${MODULE_NAME}] hideAllUserMessages failed:`, e);
        syncFullChat();
        return false;
    }
}

/**
 * Unhide all draft-hidden user messages (batch restore).
 * Sets is_system = false on every is_user && is_system message.
 * @returns {Promise<boolean>} Success
 */
export async function unhideAllUserMessages() {
    const ctx = getContext();
    if (!ctx?.chat?.length) return false;

    try {
        let changed = false;
        for (const msg of ctx.chat) {
            if (msg.is_user && msg.is_system) {
                msg.is_system = false;
                changed = true;
            }
        }

        if (!changed) return true;

        const saveChat = getSaveChat();
        if (saveChat) await saveChat();

        syncFullChat();
        return true;
    } catch (e) {
        console.error(`[${MODULE_NAME}] unhideAllUserMessages failed:`, e);
        syncFullChat();
        return false;
    }
}

/**
 * Send a user message and trigger generation via ST's programmatic APIs.
 *
 * Sequence (mirrors ST's sendTextareaMessage → sendMessageAsUser → Generate):
 * 1. Build user message object matching ST's schema
 * 2. Push to ctx.chat[]
 * 3. Add to ST's hidden DOM via addOneMessage (keeps ST state consistent)
 * 4. Emit MESSAGE_SENT + USER_MESSAGE_RENDERED events
 * 5. Save chat to disk
 * 6. Render in our React message list
 * 7. Call Generate('normal') to kick off the LLM pipeline
 *
 * Falls back to textarea DOM injection if APIs are unavailable.
 *
 * @param {string} text - Message text to send
 */
let _sendInProgress = false;

export async function triggerSend(text) {
    if (!text?.trim()) return;
    if (_sendInProgress) return;
    _sendInProgress = true;

    try {

    const ctx = getContext();
    const generate = getGenerate();
    const addOneMessage = getAddOneMessage();
    const saveChat = getSaveChat();
    const substituteParams = getSubstituteParamsFunc();

    // If we don't have the critical APIs, fall back to DOM injection
    if (!ctx?.chat || !generate || !addOneMessage) {
        _triggerSendFallback(text);
        return;
    }

    // 1. Build user message object (matches ST's sendMessageAsUser schema)
    const processedText = substituteParams ? substituteParams(text) : text;
    const message = {
        name: ctx.name1 || 'User',
        is_user: true,
        is_system: false,
        send_date: new Date().toISOString(),
        mes: processedText,
        extra: {},
    };

    // 2. Push to ST's chat array
    ctx.chat.push(message);
    const mesId = ctx.chat.length - 1;

    // Mark chat as tainted (ST uses this to track unsaved changes)
    if (ctx.chatMetadata) ctx.chatMetadata.tainted = true;

    // 3. Add to ST's hidden DOM (keeps mesId indexing, swipe state, etc. consistent)
    try { addOneMessage(message); } catch (e) {
        console.warn(`[${MODULE_NAME}] addOneMessage failed (non-critical):`, e.message);
    }

    // 4. Emit events so ST extensions and internal systems stay in sync
    const eventSource = getEventSource();
    const eventTypes = getEventTypes();
    if (eventSource && eventTypes) {
        try {
            await eventSource.emit(eventTypes.MESSAGE_SENT, mesId);
            await eventSource.emit(eventTypes.USER_MESSAGE_RENDERED, mesId);
        } catch (e) {
            console.warn(`[${MODULE_NAME}] Event emission failed (non-critical):`, e.message);
        }
    }

    // 5. Save chat to disk
    if (saveChat) {
        try { await saveChat(); } catch (e) {
            console.warn(`[${MODULE_NAME}] saveChat failed:`, e.message);
        }
    }

    // 6. Update our React message list — USER_MESSAGE_RENDERED handler
    // (fired in step 4) already calls appendNewMessages(), so no explicit
    // sync needed here. The user message is already visible in React.

    // 7. Trigger generation — Generate('normal') picks up the user message
    // from the chat array and runs the full prompt assembly pipeline
    try {
        await generate('normal');
    } catch (e) {
        console.warn(`[${MODULE_NAME}] Generate('normal') failed:`, e.message);
    }

    _ensureGenerationCleanup();

    } finally {
        _sendInProgress = false;
    }
}

/**
 * Fallback send via textarea DOM injection.
 * Used when programmatic APIs are unavailable (older ST versions).
 * @param {string} text
 */
function _triggerSendFallback(text) {
    const textarea = document.getElementById('send_textarea');
    if (!textarea) return;

    textarea.value = text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    const sendBtn = document.getElementById('send_but');
    if (sendBtn) sendBtn.click();
}

/**
 * Get current character info for the chat header.
 * Uses the same avatar URL pattern as CharacterProfile.jsx
 * @returns {Object|null}
 */
export function getCharacterInfo() {
    const ctx = getContext();
    if (!ctx) return null;

    let avatarUrl = null;
    if (ctx.characterId !== undefined && ctx.characters?.[ctx.characterId]) {
        const char = ctx.characters[ctx.characterId];
        if (char.avatar) {
            avatarUrl = `/characters/${encodeURIComponent(char.avatar)}`;
        }
    }

    return {
        name: ctx.name2 || 'Assistant',
        avatar: avatarUrl,
        isGroup: !!ctx.groupId,
        groupId: ctx.groupId || null,
    };
}

// ── Chat Action Delegation ──────────────────────────────────────────

/**
 * Trigger a regeneration of the last message via ST's Generate API.
 * Falls back to DOM click if the API is unavailable.
 */
export async function triggerRegenerate() {
    // Visual-first: clear the last assistant message AND set isStreaming so
    // streaming dots render immediately, preventing the empty-div height
    // collapse that corrupts backdrop-filter compositing layers.
    if (storeRef && isActive) {
        const current = storeRef.getState().chatSheld;
        const messages = [...current.messages];
        const lastIdx = messages.length - 1;
        if (lastIdx >= 0 && !messages[lastIdx].isUser) {
            messages[lastIdx] = { ...messages[lastIdx], content: '', reasoning: null, reasoningDuration: null };
            streamingActive = true;
            lastStreamingContent = '';
            storeRef.setState({
                chatSheld: { ...current, messages, isStreaming: true, streamingContent: '' },
            });
        }
    }

    const generate = getGenerate();
    if (generate) {
        try {
            await generate('regenerate');
            _ensureGenerationCleanup();
            return;
        } catch (e) { console.warn(`[${MODULE_NAME}] Generate('regenerate') failed, falling back:`, e.message); }
    }
    try { jQuery('#option_regenerate').trigger('click'); }
    catch { document.getElementById('option_regenerate')?.click(); }
}

/**
 * Trigger continue generation (appends to last message) via ST's Generate API.
 * Falls back to DOM click if the API is unavailable.
 */
export async function triggerContinue() {
    const generate = getGenerate();
    if (generate) {
        try {
            await generate('continue');
            _ensureGenerationCleanup();
            return;
        } catch (e) { console.warn(`[${MODULE_NAME}] Generate('continue') failed, falling back:`, e.message); }
    }
    try { jQuery('#option_continue').trigger('click'); }
    catch { document.getElementById('option_continue')?.click(); }
}

/**
 * Silent continue — trigger a new AI response without adding a user message.
 * The AI generates based on existing chat context, as if the user "nudged"
 * it to keep going. Unlike Continue (which appends to the last message),
 * this produces a separate new message.
 *
 * Works because ST's Generate('normal') reads from #send_textarea, which is
 * empty when Chat Sheld is active (the user types in .lcs-textarea instead).
 * With an empty textarea, ST skips sendMessageAsUser() and proceeds directly
 * to prompt assembly and generation.
 */
export async function triggerSilentContinue() {
    const generate = getGenerate();
    if (generate) {
        try {
            await generate('normal');
            _ensureGenerationCleanup();
            return;
        } catch (e) { console.warn(`[${MODULE_NAME}] Generate('normal') for silent continue failed:`, e.message); }
    }
    // Fallback: clear ST's textarea and click send — same effect
    try {
        const textarea = document.getElementById('send_textarea');
        if (textarea) {
            textarea.value = '';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        jQuery('#send_but').trigger('click');
    } catch {
        document.getElementById('send_but')?.click();
    }
}

/**
 * Trigger impersonation (AI writes as user) via ST's Generate API.
 * Falls back to DOM click if the API is unavailable.
 */
export async function triggerImpersonate() {
    const generate = getGenerate();
    if (generate) {
        try {
            await generate('impersonate');
            _ensureGenerationCleanup();
            return;
        } catch (e) { console.warn(`[${MODULE_NAME}] Generate('impersonate') failed, falling back:`, e.message); }
    }
    try { jQuery('#option_impersonate').trigger('click'); }
    catch { document.getElementById('option_impersonate')?.click(); }
}

/**
 * Close the current chat and return to character select.
 * Delegates to ST's #option_close_chat click handler.
 */
export function triggerCloseChat() {
    try {
        jQuery('#option_close_chat').trigger('click');
    } catch {
        document.getElementById('option_close_chat')?.click();
    }
}

/**
 * Stop the current generation via ST's programmatic API.
 * Falls back to DOM click if the API is unavailable.
 */
export function triggerStopGeneration() {
    const stopGeneration = getStopGeneration();
    if (stopGeneration) {
        try { stopGeneration(); return; }
        catch (e) { console.warn(`[${MODULE_NAME}] stopGeneration() failed, falling back:`, e.message); }
    }
    try { jQuery('#mes_stop').trigger('click'); }
    catch { document.getElementById('mes_stop')?.click(); }
}

// ── Summary Marker Support ──────────────────────────────────────────

/**
 * Set a summary marker for a message in the chat sheld store.
 * Called by summarization.js when chat sheld is active.
 * @param {string|number} mesId - Message index
 * @param {'loading'|'complete'|'error'|null} type - Marker type, or null to remove
 */
export function setSummaryMarker(mesId, type) {
    if (!storeRef || !isActive) return;

    const current = storeRef.getState().chatSheld;
    const markers = { ...(current?.summaryMarkers || {}) };

    if (type === null) {
        delete markers[mesId];
    } else {
        markers[mesId] = type;
    }

    storeRef.setState({
        chatSheld: { ...current, summaryMarkers: markers },
    });
}

/**
 * Clear the loading summary marker (temporary spinner).
 * Called by summarization.js to remove the spinner indicator.
 */
export function clearSummaryLoading() {
    if (!storeRef || !isActive) return;

    const current = storeRef.getState().chatSheld;
    const markers = { ...(current?.summaryMarkers || {}) };

    // Remove all 'loading' markers
    for (const [k, v] of Object.entries(markers)) {
        if (v === 'loading') delete markers[k];
    }

    storeRef.setState({
        chatSheld: { ...current, summaryMarkers: markers },
    });
}

// ── Extended Tools Actions ─────────────────────────────────────────────

/**
 * Open the Author's Note side panel.
 */
export function openAuthorNotePanel() {
    if (!storeRef) return;
    const current = storeRef.getState().chatSheld;
    storeRef.setState({
        chatSheld: { ...current, authorNotePanelOpen: true },
    });
}

/**
 * Close the Author's Note side panel.
 */
export function closeAuthorNotePanel() {
    if (!storeRef) return;
    const current = storeRef.getState().chatSheld;
    storeRef.setState({
        chatSheld: { ...current, authorNotePanelOpen: false },
    });
}

/**
 * Read Author's Note metadata from the current chat.
 * @returns {{ note_prompt: string, note_depth: number, note_position: number, note_role: number, note_interval: number }}
 */
export function readAuthorNoteMetadata() {
    const ctx = getContext();
    const meta = ctx?.chatMetadata || {};
    return {
        note_prompt: meta.note_prompt ?? '',
        note_depth: meta.note_depth ?? 4,
        note_position: meta.note_position ?? 1,
        note_role: meta.note_role ?? 0,
        note_interval: meta.note_interval ?? 1,
    };
}

/**
 * Write Author's Note metadata to the current chat and persist.
 * @param {{ note_prompt?: string, note_depth?: number, note_position?: number, note_role?: number, note_interval?: number }} data
 */
export function writeAuthorNoteMetadata(data) {
    const ctx = getContext();
    if (!ctx?.chatMetadata) return;

    if (data.note_prompt !== undefined) ctx.chatMetadata.note_prompt = data.note_prompt;
    if (data.note_depth !== undefined) ctx.chatMetadata.note_depth = data.note_depth;
    if (data.note_position !== undefined) ctx.chatMetadata.note_position = data.note_position;
    if (data.note_role !== undefined) ctx.chatMetadata.note_role = data.note_role;
    if (data.note_interval !== undefined) ctx.chatMetadata.note_interval = data.note_interval;

    // Persist via ST's metadata save
    if (typeof ctx.saveMetadata === 'function') {
        ctx.saveMetadata();
    }
}

/**
 * Trigger Convert to Group via ST's UI.
 */
export function triggerConvertToGroup() {
    try { jQuery('#option_convert_to_group').trigger('click'); } catch {
        document.getElementById('option_convert_to_group')?.click();
    }
}

/**
 * Trigger Start New Chat — mirrors the fork pattern for reliability.
 * 1. Builds a greeting message from the character card
 * 2. Saves the new chat file to disk via /api/chats/save
 * 3. Switches to it via switchToChat (proven path — same as fork)
 * No popup, no monkey-patching, no DOM clicks.
 * @returns {Promise<boolean>} Success
 */
export async function triggerNewChat() {
    console.log(`[${MODULE_NAME}] triggerNewChat: ENTER`);
    try {
        const ctx = getContext();
        console.log(`[${MODULE_NAME}] triggerNewChat: ctx exists=${!!ctx}, characterId=${ctx?.characterId}, chatId=${ctx?.chatId}`);
        if (!ctx || ctx.characterId === undefined || ctx.characterId === null) {
            console.warn(`[${MODULE_NAME}] triggerNewChat: ABORT — no character selected`);
            return false;
        }

        const char = ctx.characters[ctx.characterId];
        console.log(`[${MODULE_NAME}] triggerNewChat: char name=${char?.name}, avatar=${char?.avatar}`);
        if (!char?.avatar) {
            console.warn(`[${MODULE_NAME}] triggerNewChat: ABORT — no character avatar`);
            return false;
        }

        // 1. Generate new chat filename using ST's convention
        const humanize = typeof ctx.humanizedDateTime === 'function'
            ? ctx.humanizedDateTime
            : _humanizedDateTimeFallback;
        const newChatName = `${char.name} - ${humanize()}`;
        console.log(`[${MODULE_NAME}] triggerNewChat: newChatName="${newChatName}", humanizedDateTime on ctx=${typeof ctx.humanizedDateTime}`);

        // 2. Build first message (character greeting) matching ST's getFirstMessage()
        const firstMes = char.first_mes ?? char.data?.first_mes ?? '';
        const altGreetings = char.data?.alternate_greetings;
        const sendDate = new Date().toISOString();
        console.log(`[${MODULE_NAME}] triggerNewChat: firstMes length=${firstMes.length}, altGreetings=${Array.isArray(altGreetings) ? altGreetings.length : 'none'}`);

        const greeting = {
            name: char.name,
            is_user: false,
            is_system: false,
            send_date: sendDate,
            mes: firstMes,
            extra: {},
        };

        // Add alternate greetings as swipes (matches ST's getFirstMessage)
        if (Array.isArray(altGreetings) && altGreetings.length > 0) {
            const swipes = [firstMes, ...altGreetings];
            if (!greeting.mes && swipes.length > 0) {
                swipes.shift();
                greeting.mes = swipes[0] || '';
            }
            greeting.swipe_id = 0;
            greeting.swipes = swipes;
            greeting.swipe_info = swipes.map(() => ({
                send_date: sendDate,
                gen_started: undefined,
                gen_finished: undefined,
                extra: {},
            }));
        }

        // 3. Build chat payload with header (matches ST's saveChat format)
        const chatHeader = {
            chat_metadata: {},
            user_name: 'unused',
            character_name: 'unused',
        };

        const chatPayload = greeting.mes
            ? [chatHeader, greeting]
            : [chatHeader]; // No greeting if character has no first_mes

        // 4. Save the new chat file to disk
        const headers = getRequestHeaders();
        console.log(`[${MODULE_NAME}] triggerNewChat: saving chat file — ch_name="${char.name}", file_name="${newChatName}", avatar_url="${char.avatar}", payload messages=${chatPayload.length}, headers keys=${Object.keys(headers)}`);
        const response = await fetch('/api/chats/save', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                ch_name: char.name,
                file_name: newChatName,
                chat: chatPayload,
                avatar_url: char.avatar,
            }),
        });

        console.log(`[${MODULE_NAME}] triggerNewChat: save response status=${response.status}, ok=${response.ok}`);
        if (!response.ok) {
            const body = await response.text().catch(() => '(unreadable)');
            console.error(`[${MODULE_NAME}] triggerNewChat: save FAILED — status=${response.status}, body=${body}`);
            return false;
        }

        // 5. Switch to the new chat (same proven path as fork)
        console.log(`[${MODULE_NAME}] triggerNewChat: calling switchToChat("${newChatName}")`);
        await switchToChat(newChatName);
        console.log(`[${MODULE_NAME}] triggerNewChat: switchToChat completed — SUCCESS`);
        return true;
    } catch (e) {
        console.error(`[${MODULE_NAME}] triggerNewChat EXCEPTION:`, e);
        return false;
    }
}

/** ST's humanizedDateTime format: "YYYY-MM-DD@HHhMMmSSsNNNms" */
function _humanizedDateTimeFallback() {
    const d = new Date();
    const p = (n, len = 2) => String(n).padStart(len, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}@${p(d.getHours())}h${p(d.getMinutes())}m${p(d.getSeconds())}s${p(d.getMilliseconds(), 3)}ms`;
}

/**
 * Batch delete messages from a given mesId onward (truncation).
 * Deletes the message at fromMesId and all messages after it.
 * @param {number} fromMesId - The message index from which to truncate
 * @returns {Promise<boolean>} Success
 */
export async function triggerBatchDelete(fromMesId) {
    const ctx = getContext();
    if (!ctx?.chat || fromMesId < 0 || fromMesId >= ctx.chat.length) return false;

    // Visual-first: truncate the React list and clear batch mode immediately
    // so the UI responds instantly before the save/event emission.
    if (storeRef) {
        const current = storeRef.getState().chatSheld;
        const messages = current.messages.filter(m => m.mesId < fromMesId);
        storeRef.setState({
            chatSheld: { ...current, messages, batchDeleteMode: false, batchDeleteFromId: null },
        });
    }

    try {
        // Truncate the chat array
        ctx.chat.length = fromMesId;

        // Mark chat as tainted (matches what ST's deleteMessage does)
        if (ctx.chatMetadata) ctx.chatMetadata.tainted = true;

        // Save via ST's save function
        if (typeof ctx.saveChat === 'function') {
            await ctx.saveChat();
        }

        // Emit MESSAGE_DELETED to notify other components
        const eventSource = getEventSource();
        const event_types = getEventTypes();
        if (eventSource && event_types?.MESSAGE_DELETED) {
            eventSource.emit(event_types.MESSAGE_DELETED, fromMesId);
        }

        // Final sync to reconcile
        syncFullChat();

        return true;
    } catch (e) {
        console.error(`[${MODULE_NAME}] Batch delete failed:`, e);
        syncFullChat();
        return false;
    }
}

// ── Chat Forking ───────────────────────────────────────────────────────

/**
 * Fetch existing chat file names for a character (as a Set, without .jsonl).
 * Used to generate unique branch names.
 */
async function fetchExistingChatNames(avatarUrl) {
    try {
        const response = await fetch('/api/characters/chats', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ avatar_url: avatarUrl, simple: true }),
        });
        if (!response.ok) return new Set();
        const chats = await response.json();
        return new Set(chats.map(c => (c.file_name || '').replace(/\.jsonl$/, '')));
    } catch {
        return new Set();
    }
}

/**
 * Fork the chat at a given message, creating a new chat branch.
 * @param {number} mesId - Message index to fork at
 * @returns {Promise<boolean>} Success
 */
export async function triggerFork(mesId) {
    const createBranch = getCreateBranch();
    if (createBranch) {
        try {
            const branchName = await createBranch(mesId);
            // createBranch saves the file but doesn't switch to it —
            // we need to explicitly open the new chat.
            if (branchName) {
                await switchToChat(branchName);
            }
            return true;
        } catch (e) {
            console.error(`[${MODULE_NAME}] Fork failed:`, e);
            return false;
        }
    }

    // Fallback: manual fork via /api/chats/save
    // createBranch is not on the ST context, so we replicate its logic:
    // build a unique branch name, construct a proper chat payload with header,
    // save to disk, track the branch in the parent message, then switch.
    try {
        const ctx = getContext();
        if (!ctx?.chat || mesId < 0 || mesId >= ctx.chat.length) return false;

        const char = ctx.characters?.[ctx.characterId];
        if (!char?.avatar) return false;

        // Build unique branch name from current chat name
        const mainChatName = ctx.chatId || 'chat';
        const existingNames = await fetchExistingChatNames(char.avatar);
        let branchName;
        for (let i = 1; i < 999; i++) {
            const candidate = `${mainChatName.replace(/ - Branch #\d+$/, '')} - Branch #${i}`;
            if (!existingNames.has(candidate)) {
                branchName = candidate;
                break;
            }
        }
        if (!branchName) branchName = `${mainChatName} - Branch ${Date.now()}`;

        // Truncate chat to the fork point (deep-copy last message so we
        // can stamp the fork time without mutating the original chat)
        const truncatedChat = ctx.chat.slice(0, mesId + 1);
        const lastIdx = truncatedChat.length - 1;
        if (lastIdx >= 0) {
            truncatedChat[lastIdx] = { ...truncatedChat[lastIdx], send_date: new Date().toISOString() };
        }

        // Build chat header (first element of the .jsonl file)
        const chatHeader = {
            chat_metadata: { main_chat: mainChatName },
            user_name: 'unused',
            character_name: 'unused',
        };

        const response = await fetch('/api/chats/save', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                ch_name: char.name,
                file_name: branchName,
                chat: [chatHeader, ...truncatedChat],
                avatar_url: char.avatar,
            }),
        });

        if (!response.ok) return false;

        // Track branch in parent message's extra data
        const lastMes = ctx.chat[mesId];
        if (typeof lastMes.extra !== 'object') lastMes.extra = {};
        if (!Array.isArray(lastMes.extra.branches)) lastMes.extra.branches = [];
        lastMes.extra.branches.push(branchName);

        // Switch to the new branch
        await switchToChat(branchName);
        return true;
    } catch (e) {
        console.error(`[${MODULE_NAME}] Manual fork failed:`, e);
        return false;
    }
}

// ── Group Chat Helpers ──────────────────────────────────────────────────

/**
 * Get the list of group members for the current group chat.
 * Returns empty array if not in a group chat.
 * @returns {Array<{ chid: number, name: string, avatar: string, avatarUrl: string, disabled: boolean }>}
 */
export function getGroupMemberList() {
    if (!isGroupChat()) return [];
    return getGroupMembers();
}

/**
 * Force a specific group member to speak next.
 * @param {number} chid - Character index to force reply from
 */
export async function triggerForceReply(chid) {
    const generate = getGenerate();
    if (!generate) {
        console.warn(`[${MODULE_NAME}] Generate API not available for force reply`);
        return;
    }

    // Set streaming immediately for UI feedback
    if (storeRef) {
        const current = storeRef.getState().chatSheld;
        storeRef.setState({
            chatSheld: { ...current, isStreaming: true },
        });
    }

    try {
        await generate('normal', { force_chid: chid });
    } catch (e) {
        console.error(`[${MODULE_NAME}] Force reply failed:`, e);
        // Reset streaming on failure
        if (storeRef) {
            const current = storeRef.getState().chatSheld;
            storeRef.setState({
                chatSheld: { ...current, isStreaming: false },
            });
        }
    }
}

// ── Chat File Management ───────────────────────────────────────────────

/**
 * Fetch the list of chats for the current character or group.
 * @returns {Promise<Array>} Chat file list
 */
export async function fetchCharacterChats() {
    const ctx = getContext();
    if (!ctx) return [];

    try {
        if (ctx.groupId) {
            // Group chat list
            const response = await fetch('/api/chats/group/get', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ id: ctx.groupId }),
            });
            if (!response.ok) return [];
            return await response.json();
        } else {
            // Character chat list
            const char = ctx.characters?.[ctx.characterId];
            if (!char?.avatar) return [];

            const response = await fetch('/api/characters/chats', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ avatar_url: char.avatar }),
            });
            if (!response.ok) return [];
            return await response.json();
        }
    } catch (e) {
        console.error(`[${MODULE_NAME}] Failed to fetch chats:`, e);
        return [];
    }
}

/**
 * Switch to a different chat file.
 * ST's openCharacterChat/openGroupChat expect the file name WITHOUT the
 * .jsonl extension — the backend appends it automatically.  The chat list
 * API returns names WITH the extension, so we strip it here.
 * @param {string} fileName - Chat file name (may include .jsonl)
 */
export async function switchToChat(fileName) {
    const ctx = getContext();
    console.log(`[${MODULE_NAME}] switchToChat: fileName="${fileName}", ctx exists=${!!ctx}, groupId=${ctx?.groupId}, openCharacterChat=${typeof ctx?.openCharacterChat}, openGroupChat=${typeof ctx?.openGroupChat}`);
    if (!ctx) return;

    // Strip .jsonl — ST appends it internally
    const baseName = fileName.replace(/\.jsonl$/i, '');

    try {
        if (ctx.groupId && typeof ctx.openGroupChat === 'function') {
            console.log(`[${MODULE_NAME}] switchToChat: calling openGroupChat(${ctx.groupId}, "${baseName}")`);
            await ctx.openGroupChat(ctx.groupId, baseName);
            console.log(`[${MODULE_NAME}] switchToChat: openGroupChat completed`);
        } else if (typeof ctx.openCharacterChat === 'function') {
            console.log(`[${MODULE_NAME}] switchToChat: calling openCharacterChat("${baseName}")`);
            await ctx.openCharacterChat(baseName);
            console.log(`[${MODULE_NAME}] switchToChat: openCharacterChat completed`);
        } else {
            console.warn(`[${MODULE_NAME}] switchToChat: NO API available — openCharacterChat=${typeof ctx.openCharacterChat}, openGroupChat=${typeof ctx.openGroupChat}`);
        }
    } catch (e) {
        console.error(`[${MODULE_NAME}] switchToChat EXCEPTION:`, e);
    }
}

/**
 * Rename a chat file.
 * @param {string} oldName - Original file name
 * @param {string} newName - New file name
 * @returns {Promise<boolean>} Success
 */
export async function renameChat(oldName, newName) {
    const ctx = getContext();
    if (!ctx) return false;

    // Ensure both names have .jsonl — the endpoint operates on actual files
    const oldFile = oldName.endsWith('.jsonl') ? oldName : `${oldName}.jsonl`;
    const newFile = newName.endsWith('.jsonl') ? newName : `${newName}.jsonl`;

    try {
        const char = ctx.characters?.[ctx.characterId];
        const response = await fetch('/api/chats/rename', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                is_group: !!ctx.groupId,
                avatar_url: char?.avatar || '',
                original_file: oldFile,
                renamed_file: newFile,
            }),
        });
        return response.ok;
    } catch (e) {
        console.error(`[${MODULE_NAME}] Failed to rename chat:`, e);
        return false;
    }
}

/**
 * Delete a chat file.
 * @param {string} fileName - Chat file name to delete
 * @returns {Promise<boolean>} Success
 */
export async function deleteChatFile(fileName) {
    const ctx = getContext();
    if (!ctx) return false;

    try {
        const char = ctx.characters?.[ctx.characterId];
        const response = await fetch('/api/chats/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                chatfile: fileName,
                avatar_url: char?.avatar || '',
            }),
        });
        return response.ok;
    } catch (e) {
        console.error(`[${MODULE_NAME}] Failed to delete chat:`, e);
        return false;
    }
}

/**
 * Export a chat file as .jsonl download.
 * @param {string} fileName - Chat file name to export
 */
export async function exportChat(fileName) {
    const ctx = getContext();
    if (!ctx) return;

    try {
        const char = ctx.characters?.[ctx.characterId];
        const response = await fetch('/api/chats/export', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                chatfile: fileName,
                avatar_url: char?.avatar || '',
                is_group: !!ctx.groupId,
            }),
        });

        if (!response.ok) return;

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.jsonl') ? fileName : `${fileName}.jsonl`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error(`[${MODULE_NAME}] Failed to export chat:`, e);
    }
}

// ── Loom Prompt Itemization Cache ────────────────────────────────────────
// In-memory cache for the current session, backed by localforage for persistence
// across page refreshes. Mirrors ST's own pattern from itemized-prompts.js.

const loomBreakdownCache = new Map();
const MAX_LOOM_CACHE = 50;

/** @type {ReturnType<typeof localforage.createInstance>|null} */
let loomBreakdownStorage = null;

/**
 * Get or lazily create the localforage instance for Loom breakdowns.
 * @returns {Object|null} localforage instance or null if unavailable
 */
function getLoomStorage() {
    if (loomBreakdownStorage) return loomBreakdownStorage;
    try {
        if (typeof localforage !== 'undefined') {
            loomBreakdownStorage = localforage.createInstance({ name: 'LumiverseHelper_LoomBreakdowns' });
            return loomBreakdownStorage;
        }
    } catch { /* localforage not available */ }
    return null;
}

/**
 * Load persisted Loom breakdowns for the current chat into the in-memory cache.
 * Called on CHAT_CHANGED (via manageChatSheld path) to restore data after refresh.
 */
export async function loadLoomBreakdowns() {
    const ctx = getContext();
    const chatId = ctx?.chatId;
    if (!chatId) return;

    const storage = getLoomStorage();
    if (!storage) return;

    try {
        const persisted = await storage.getItem(chatId);
        if (persisted && typeof persisted === 'object') {
            // Merge persisted entries into cache (don't overwrite fresher in-memory data)
            for (const [key, value] of Object.entries(persisted)) {
                const mesId = Number(key);
                if (!loomBreakdownCache.has(mesId)) {
                    loomBreakdownCache.set(mesId, value);
                }
            }
        }
    } catch (e) {
        console.warn('[LumiverseHelper] Failed to load Loom breakdowns from storage:', e.message);
    }
}

/**
 * Persist the current chat's Loom breakdowns to localforage.
 * Fire-and-forget — called after storing to the in-memory cache.
 */
function persistLoomBreakdowns() {
    const ctx = getContext();
    const chatId = ctx?.chatId;
    if (!chatId) return;

    const storage = getLoomStorage();
    if (!storage) return;

    // Serialize the in-memory cache as a plain object { mesId: data }
    const toStore = {};
    for (const [mesId, data] of loomBreakdownCache) {
        toStore[mesId] = data;
    }

    storage.setItem(chatId, toStore).catch(e => {
        console.warn('[LumiverseHelper] Failed to persist Loom breakdowns:', e.message);
    });
}

/**
 * Store a Loom assembly breakdown for prompt itemization.
 * Called from the CHAT_COMPLETION_SETTINGS_READY handler in index.js.
 * Stores in memory and persists to localforage for cross-refresh survival.
 * @param {number} mesId - Estimated message index
 * @param {Object} data - Breakdown data from lucidLoomService
 */
export function storeLoomBreakdown(mesId, data) {
    // Evict oldest if cache is full
    if (loomBreakdownCache.size >= MAX_LOOM_CACHE) {
        const firstKey = loomBreakdownCache.keys().next().value;
        loomBreakdownCache.delete(firstKey);
    }
    loomBreakdownCache.set(mesId, { ...data, timestamp: Date.now() });

    // Persist to IndexedDB (fire-and-forget)
    persistLoomBreakdowns();
}

/**
 * Build Loom-specific itemization from cached breakdown data.
 * Token counts each block lazily (on modal open).
 * @param {number} mesId
 * @param {Object} breakdown - Cached breakdown data
 * @returns {Promise<Object>} Loom itemization result
 */
async function buildLoomItemization(mesId, breakdown) {
    const counter = getTokenCountAsync();
    const countTokens = async (text) => {
        if (!text || !counter) return 0;
        try { return await counter(text); } catch { return 0; }
    };

    // Token-count each entry in parallel
    const tokenCounts = await Promise.all(
        breakdown.entries.map(entry => countTokens(entry.content))
    );

    const blocks = [];
    let totalTokens = 0;

    for (let i = 0; i < breakdown.entries.length; i++) {
        const entry = breakdown.entries[i];
        const tokens = tokenCounts[i];
        totalTokens += tokens;

        if (entry.type === 'chat_history') {
            blocks.push({
                name: 'Chat History',
                marker: 'chat_history',
                role: 'mixed',
                tokens,
                messageCount: entry.messageCount,
                color: null,
                _type: 'chat_history',
            });
        } else if (entry.type === 'separator') {
            blocks.push({
                name: entry.name,
                marker: null,
                role: 'system',
                tokens,
                color: null,
                _type: 'separator',
            });
        } else if (entry.type === 'utility') {
            blocks.push({
                name: entry.name,
                marker: null,
                role: 'system',
                tokens,
                color: null,
                _type: 'utility',
            });
        } else if (entry.type === 'extension') {
            blocks.push({
                name: entry.name,
                marker: null,
                role: entry.role || 'system',
                tokens,
                color: null,
                _type: 'extension',
            });
        } else if (entry.type === 'world_info') {
            blocks.push({
                name: entry.name,
                marker: entry.marker || null,
                role: entry.role || 'system',
                tokens,
                color: null,
                _type: 'world_info',
            });
        } else {
            // Regular block
            blocks.push({
                name: entry.blockName,
                marker: entry.marker,
                role: entry.role,
                tokens,
                color: entry.color,
                _type: 'block',
            });
        }
    }

    return {
        isLoomPreset: true,
        mesId,
        presetName: breakdown.presetName,
        api: breakdown.api,
        model: breakdown.model,
        tokenizer: breakdown.tokenizer,
        maxContext: breakdown.maxContext,
        maxTokens: breakdown.maxTokens,
        totalTokens,
        blocks,
        rawPrompt: breakdown.rawPrompt || null,
    };
}

// ── Prompt Itemization ─────────────────────────────────────────────────

/**
 * Get the prompt itemization data for a given message.
 * Checks Loom breakdown cache first (when a Loom preset was active),
 * then falls back to ST's native itemized prompts.
 * @param {number} mesId - Message index
 * @returns {Promise<Object|null>} Prompt breakdown or null if unavailable
 */
export async function getPromptItemization(mesId) {
    // Check Loom breakdown cache (with ±1 tolerance for mesId estimation)
    let loomData = loomBreakdownCache.get(mesId);
    if (!loomData) {
        // For recent messages, check nearby mesIds
        const nearby = loomBreakdownCache.get(mesId - 1) || loomBreakdownCache.get(mesId + 1);
        if (nearby) loomData = nearby;
    }

    // Cache miss — try loading from localforage (persisted across refresh)
    if (!loomData) {
        const ctx = getContext();
        const chatId = ctx?.chatId;
        const storage = getLoomStorage();
        if (chatId && storage) {
            try {
                const persisted = await storage.getItem(chatId);
                if (persisted && typeof persisted === 'object') {
                    const entry = persisted[mesId] || persisted[mesId - 1] || persisted[mesId + 1];
                    if (entry) {
                        loomData = entry;
                        // Backfill into memory cache for subsequent lookups
                        loomBreakdownCache.set(mesId, entry);
                    }
                }
            } catch { /* storage read failed, fall through */ }
        }
    }

    if (loomData) {
        return buildLoomItemization(mesId, loomData);
    }

    // Fall back to ST's native itemized prompts
    const prompts = await getItemizedPrompts();
    if (!prompts || !Array.isArray(prompts)) return null;

    // Find the prompt set for this mesId (itemizedPrompts index by message id)
    const promptData = prompts.find(p => p?.mesId === mesId) || prompts[mesId] || null;
    if (!promptData) return null;

    const counter = getTokenCountAsync();

    // Helper: count tokens for a text field, returns 0 if empty/null
    const countTokens = async (text) => {
        if (!text || !counter) return 0;
        try { return await counter(text); } catch { return 0; }
    };

    // Count tokens for each category
    const [
        charDescTokens,
        charPersTokens,
        scenarioTokens,
        examplesTokens,
        personaTokens,
        worldInfoTokens,
        summarizeTokens,
        authorsNoteTokens,
        smartContextTokens,
        chatVectorsTokens,
        dataBankTokens,
    ] = await Promise.all([
        countTokens(promptData.charDescription),
        countTokens(promptData.charPersonality),
        countTokens(promptData.scenarioText),
        countTokens(promptData.examplesString),
        countTokens(promptData.userPersona),
        countTokens(promptData.worldInfoString),
        countTokens(promptData.summarizeString),
        countTokens(promptData.authorsNoteString),
        countTokens(promptData.smartContextString),
        countTokens(promptData.chatVectorsString),
        countTokens(promptData.dataBankVectorsString),
    ]);

    // Use pre-computed totals from ST if available
    const totalTokens = promptData.oaiTotalTokens || promptData.oaiPromptTokens || 0;
    const mainTokens = promptData.oaiMainTokens || 0;
    const startTokens = promptData.oaiStartTokens || 0;
    const conversationTokens = promptData.oaiConversationTokens || 0;
    const biasTokens = promptData.oaiBiasTokens || 0;
    const nudgeTokens = promptData.oaiNudgeTokens || 0;
    const jailbreakTokens = promptData.oaiJailbreakTokens || 0;

    // Prompt tokens = description + personality + scenario + examples + persona
    const promptTokensTotal = charDescTokens + charPersTokens + scenarioTokens + examplesTokens + personaTokens;

    // Extensions = summarize + AN + smart context + vectors
    const extensionsTotal = summarizeTokens + authorsNoteTokens + smartContextTokens + chatVectorsTokens + dataBankTokens;

    // System info = main + start + nudge + jailbreak
    const systemInfoTotal = mainTokens + startTokens + nudgeTokens + jailbreakTokens;

    return {
        mesId,
        api: promptData.main_api || 'unknown',
        model: promptData.model || '',
        presetName: promptData.presetName || '',
        tokenizer: promptData.tokenizer || '',
        maxContext: promptData.this_max_context || 0,
        messagesCount: promptData.messagesCount || 0,
        totalTokens,

        systemInfo: {
            total: systemInfoTotal,
            main: mainTokens,
            start: startTokens,
            nudge: nudgeTokens,
            jailbreak: jailbreakTokens,
        },
        promptTokens: {
            total: promptTokensTotal,
            description: charDescTokens,
            personality: charPersTokens,
            scenario: scenarioTokens,
            examples: examplesTokens,
            persona: personaTokens,
        },
        worldInfo: worldInfoTokens,
        chatHistory: {
            total: conversationTokens,
            messagesCount: promptData.messagesCount || 0,
        },
        extensions: {
            total: extensionsTotal,
            summarize: summarizeTokens,
            authorsNote: authorsNoteTokens,
            smartContext: smartContextTokens,
            vectors: chatVectorsTokens + dataBankTokens,
        },
        bias: biasTokens,

        rawPrompt: promptData.finalPrompt || promptData.rawPrompt || null,
    };
}
