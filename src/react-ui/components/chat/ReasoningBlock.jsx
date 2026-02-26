/**
 * ReasoningBlock — Collapsible extended thinking/reasoning display
 *
 * Uses `marked` for lightweight Markdown rendering of thinking content.
 * Handles partial/streaming markdown gracefully via silent mode.
 * Displays thinking duration: live timer during streaming, static after completion.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Marked } from 'marked';
import { ChevronRight, Brain } from 'lucide-react';

// Isolated marked instance configured for thinking content
const md = new Marked({
    gfm: true,
    breaks: true,
    silent: true, // Gracefully handle incomplete markdown (streaming)
});

/**
 * Format a duration in milliseconds to a human-readable string.
 * @param {number} ms - Duration in milliseconds
 * @returns {string} e.g. "3s", "1m 24s", "2h 5m"
 */
function formatDuration(ms) {
    if (!ms || ms < 0) return '';
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
}

export default function ReasoningBlock({ content, duration, isStreaming }) {
    const [isOpen, setIsOpen] = useState(false);
    const [liveElapsed, setLiveElapsed] = useState(0);
    const timerRef = useRef(null);
    const startTimeRef = useRef(null);

    const toggle = useCallback(() => {
        setIsOpen(prev => !prev);
    }, []);

    // Live timer during streaming when we have reasoning content but no final duration
    useEffect(() => {
        if (isStreaming && content && !duration) {
            if (!startTimeRef.current) {
                startTimeRef.current = Date.now();
            }
            timerRef.current = setInterval(() => {
                setLiveElapsed(Date.now() - startTimeRef.current);
            }, 1000);
            return () => {
                clearInterval(timerRef.current);
                timerRef.current = null;
            };
        }
        // Reset when streaming ends or duration arrives
        if (!isStreaming || duration) {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            startTimeRef.current = null;
            setLiveElapsed(0);
        }
    }, [isStreaming, !!content, !!duration]);

    if (!content) return null;

    // Handle both string and object reasoning content
    const text = typeof content === 'string' ? content : content.content || JSON.stringify(content);

    // Parse markdown to HTML (memoized to avoid re-parsing on toggle)
    const html = useMemo(() => md.parse(text), [text]);

    // Determine label text
    let labelText = 'Thinking';
    if (duration) {
        // Final duration from ST
        labelText = `Thought for ${formatDuration(duration)}`;
    } else if (isStreaming && liveElapsed > 0) {
        // Live timer during streaming
        labelText = `Thinking for ${formatDuration(liveElapsed)}`;
    }

    return (
        <div className="lcs-reasoning">
            <button
                className="lcs-reasoning-toggle"
                onClick={toggle}
                type="button"
                aria-expanded={isOpen}
            >
                <ChevronRight
                    size={14}
                    className={`lcs-reasoning-chevron ${isOpen ? 'lcs-reasoning-chevron--open' : ''}`}
                />
                <Brain size={14} style={{ opacity: 0.6 }} />
                <span>{labelText}</span>
            </button>
            <div className={`lcs-reasoning-body-wrap${isOpen ? ' lcs-reasoning-body-wrap--open' : ''}`}>
                <div className="lcs-reasoning-body-overflow">
                    <div
                        className="lcs-reasoning-body"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                </div>
            </div>
        </div>
    );
}
