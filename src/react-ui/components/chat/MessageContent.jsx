/**
 * MessageContent — Renders message content with markdown formatting and inline OOC blocks
 *
 * Uses a local Marked instance for all markdown rendering (streaming and static).
 * OOC blocks are rendered by mounting the real DOM factory output from oocComments.js
 * via refs — single source of truth, no duplicate template code.
 */

import React, { useMemo, useRef, useLayoutEffect, useSyncExternalStore } from 'react';
import { Marked } from 'marked';
import { segmentMessageContent } from '../../../lib/oocParser';
import {
    createOOCCommentBox,
    createIRCChatRoom,
    cleanOOCContent,
    getLumiaAvatarByName,
    refreshOocColorCache,
} from '../../../lib/oocComments';
import { useLumiverseStore } from '../../store/LumiverseContext';

const store = useLumiverseStore;

const selectOOCStyle = () => store.getState().lumiaOOCStyle || 'social';
const selectCouncilMode = () => store.getState().councilMode || false;
const selectCouncilChatStyle = () => store.getState().councilChatStyle || { enabled: false };
const selectTheme = () => store.getState().theme;

// Marked instance for all content rendering (streaming and static).
// We use our own pipeline instead of ST's messageFormatting to avoid its
// heavy regex/sanitize passes and keep rendering fully under our control.
//
// Custom renderer adds themed prose classes:
// - <em> → .lcs-prose-italic (thoughts / internal monologue)
// - <strong> → .lcs-prose-bold (emphasis)
// - <blockquote> inherits themed color from CSS
// Dialogue coloring ("quoted speech") is handled in post-processing
// since Marked doesn't have a dedicated token for quoted strings.
const md = new Marked({
    gfm: true,
    breaks: true,     // \n → <br>
    silent: true,      // Gracefully handle incomplete markdown
    renderer: {
        em({ tokens }) {
            const body = this.parser.parseInline(tokens);
            return `<em class="lcs-prose-italic">${body}</em>`;
        },
        strong({ tokens }) {
            const body = this.parser.parseInline(tokens);
            return `<strong class="lcs-prose-bold">${body}</strong>`;
        },
    },
});

/**
 * Normalize all smart/curly quotation marks to straight ASCII equivalents.
 * LLMs frequently output Unicode quotes (\u201C \u201D \u2018 \u2019 etc.).
 */
function normalizeQuotes(text) {
    return text
        .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')   // double smart quotes → "
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'");               // single smart quotes → '
}

/**
 * Normalize smart quote HTML entities in rendered HTML output.
 * Catches any entities that survive the pre-parse normalization.
 */
function normalizeQuotesInHTML(html) {
    return html
        .replace(/&ldquo;|&rdquo;|&bdquo;/g, '"')
        .replace(/&lsquo;|&rsquo;|&sbquo;/g, "'")
        .replace(/&laquo;|&raquo;/g, '"');
}

/**
 * Wrap dialogue (straight-quoted strings) in themed spans.
 * Matches "text" that isn't inside an HTML tag attribute.
 * Uses a negative lookbehind for `=` to avoid matching href="..." etc.
 */
const DIALOGUE_RE = /(?<![\w=])"([^"]+)"(?![\w])/g;

function colorizeDialogue(html) {
    // Split on HTML tags to only process text nodes
    const parts = html.split(/(<[^>]*>)/);
    for (let i = 0; i < parts.length; i++) {
        // Odd indices are tags, even are text — only process text
        if (i % 2 === 0 && parts[i]) {
            parts[i] = parts[i].replace(DIALOGUE_RE, '<span class="lcs-prose-dialogue">&quot;$1&quot;</span>');
        }
    }
    return parts.join('');
}

/**
 * Format message content using our Marked pipeline.
 * Post-processes output to normalize smart quotes, colorize dialogue,
 * and lazy-load images (character cards can embed large inline media).
 */
function formatContent(raw) {
    if (!raw) return '';
    const normalized = normalizeQuotes(raw);
    let html = normalizeQuotesInHTML(md.parse(normalized));
    // Themed dialogue coloring — wraps "quoted speech" in styled spans
    html = colorizeDialogue(html);
    // Lazy-load all images in rendered HTML to prevent network stalls
    // from large inline media embedded in character cards
    html = html.replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy"');
    return html;
}

// ── DOM Bridge Components ─────────────────────────────────────────────
// Mount the real DOM factory output from oocComments.js via refs.
// Single source of truth — no duplicate templates.

/**
 * Bridge for social/margin/whisper/raw OOC styles.
 * Calls createOOCCommentBox() which internally dispatches to the correct
 * template based on the user's lumiaOOCStyle setting.
 */
function OocDomBridge({ segment, index, oocStyle, themeRef }) {
    const ref = useRef(null);

    useLayoutEffect(() => {
        if (!ref.current) return;
        refreshOocColorCache();
        const avatarUrl = getLumiaAvatarByName(segment.name);
        const cleaned = cleanOOCContent(segment.content);
        const el = createOOCCommentBox(cleaned, avatarUrl, index, segment.name);
        ref.current.innerHTML = '';
        ref.current.appendChild(el);
    }, [segment.content, segment.name, index, oocStyle, themeRef]);

    return <div ref={ref} />;
}

/**
 * Bridge for IRC chatroom mode.
 * Calls createIRCChatRoom() which builds the full container with
 * timestamps, handles, @mention highlighting, and collapsible toggle.
 */
function IrcDomBridge({ entries, themeRef }) {
    const ref = useRef(null);

    useLayoutEffect(() => {
        if (!ref.current) return;
        refreshOocColorCache();
        const ircEntries = entries.map(seg => ({
            handle: seg.name || 'Unknown',
            content: cleanOOCContent(seg.content),
            avatarUrl: getLumiaAvatarByName(seg.name),
        }));
        const el = createIRCChatRoom(ircEntries);
        ref.current.innerHTML = '';
        ref.current.appendChild(el);
    }, [entries, themeRef]);

    return <div ref={ref} />;
}

// ── Main Component ─────────────────────────────────────────────────────

export default function MessageContent({ content, oocMatches, isSystem, isUser, name, mesId, isStreaming, displayMode }) {
    const oocStyle = useSyncExternalStore(store.subscribe, selectOOCStyle, selectOOCStyle);
    const councilMode = useSyncExternalStore(store.subscribe, selectCouncilMode, selectCouncilMode);
    const councilChatStyle = useSyncExternalStore(store.subscribe, selectCouncilChatStyle, selectCouncilChatStyle);
    // Theme reference — when it changes, OOC DOM bridges re-mount with fresh colors
    const theme = useSyncExternalStore(store.subscribe, selectTheme, selectTheme);

    // Format the content through our Marked pipeline
    const formattedContent = useMemo(
        () => formatContent(content),
        [content],
    );

    // Segment the content into text and OOC blocks
    const segments = useMemo(() => {
        if (!content) return [];
        return segmentMessageContent(content);
    }, [content]);

    // For IRC mode, collect ALL OOC segments into a single batch appended
    // at the end — mirrors the original DOM pipeline which removes OOC from
    // their inline positions and builds one IRC container. Mid-weave/narrative
    // rupture OOC comments are grouped together rather than left in-place.
    const useIrcMode = councilMode && councilChatStyle?.enabled;
    const processedSegments = useMemo(() => {
        if (!useIrcMode || !oocMatches?.length) return segments;

        const textSegments = [];
        const allOoc = [];

        for (const seg of segments) {
            if (seg.type === 'ooc') {
                allOoc.push(seg);
            } else {
                // Skip whitespace-only segments that were between OOC tags
                const isWhitespaceOnly = !seg.content.replace(/[\s\n\r]+/g, '').length;
                if (!isWhitespaceOnly) {
                    textSegments.push(seg);
                }
            }
        }

        // All text first, then single IRC container at the end
        const result = [...textSegments];
        if (allOoc.length > 0) {
            result.push({ type: 'irc-batch', entries: allOoc });
        }
        return result;
    }, [segments, useIrcMode, oocMatches]);

    // ── Chunk fade: per-delta fade-in during streaming ─────────────────
    const contentRef = useRef(null);
    const prevTextLen = useRef(0);
    const prevMesId = useRef(null);

    // Reset character counter on new message
    if (mesId !== prevMesId.current) {
        prevTextLen.current = 0;
        prevMesId.current = mesId;
    }

    useLayoutEffect(() => {
        if (!isStreaming || !contentRef.current) return;

        const el = contentRef.current;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let charCount = 0;
        const nodesToWrap = [];

        let node;
        while ((node = walker.nextNode())) {
            const nodeLen = node.textContent.length;
            if (nodeLen === 0) continue;
            if (charCount + nodeLen > prevTextLen.current) {
                const splitAt = Math.max(0, prevTextLen.current - charCount);
                nodesToWrap.push({ node, splitAt });
            }
            charCount += nodeLen;
        }

        // Wrap new text nodes in fade spans (DOM is fresh from dangerouslySetInnerHTML)
        for (const { node: textNode, splitAt } of nodesToWrap) {
            let targetNode = textNode;
            if (splitAt > 0) {
                targetNode = textNode.splitText(splitAt);
            }
            const wrapper = document.createElement('span');
            wrapper.className = 'lcs-chunk-fade';
            targetNode.parentNode.insertBefore(wrapper, targetNode);
            wrapper.appendChild(targetNode);
        }

        prevTextLen.current = charCount;
    }, [formattedContent, isStreaming]);

    // Reset when streaming ends so next stream starts fresh
    useLayoutEffect(() => {
        if (!isStreaming) {
            prevTextLen.current = 0;
        }
    }, [isStreaming]);

    if (!content) {
        // Always render the wrapper div — returning null removes the DOM node
        // entirely, collapsing the card to zero height. The subsequent re-expansion
        // with backdrop-filter doesn't repaint correctly (browser compositing bug),
        // causing a "blank" viewport that only scrolling fixes.
        return (
            <div className="lcs-message-content">
                {isStreaming && (
                    <div className="lcs-streaming">
                        <div className="lcs-streaming-dot" />
                        <div className="lcs-streaming-dot" />
                        <div className="lcs-streaming-dot" />
                    </div>
                )}
            </div>
        );
    }

    // If no OOC matches, render the whole formatted content as HTML
    if (!oocMatches || oocMatches.length === 0) {
        return (
            <div
                ref={contentRef}
                className="lcs-message-content"
                dangerouslySetInnerHTML={{ __html: formattedContent }}
            />
        );
    }

    // Render segmented content with DOM-bridged OOC blocks
    const activeSegments = useIrcMode ? processedSegments : segments;

    return (
        <div ref={contentRef} className="lcs-message-content">
            {activeSegments.map((segment, i) => {
                // IRC batch → single container with all entries
                if (segment.type === 'irc-batch') {
                    return <IrcDomBridge key={i} entries={segment.entries} themeRef={theme} />;
                }

                // Individual OOC → dispatch via createOOCCommentBox
                if (segment.type === 'ooc') {
                    return (
                        <OocDomBridge
                            key={i}
                            segment={segment}
                            index={i}
                            oocStyle={oocStyle}
                            themeRef={theme}
                        />
                    );
                }

                // Normal text segment — format and render as HTML
                return (
                    <div
                        key={i}
                        dangerouslySetInnerHTML={{
                            __html: formatContent(segment.content),
                        }}
                    />
                );
            })}
        </div>
    );
}
