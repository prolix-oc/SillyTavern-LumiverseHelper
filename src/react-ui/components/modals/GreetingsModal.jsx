/**
 * GreetingsModal — Lists all alternate greetings for the first message (mesId 0).
 *
 * Each greeting is shown as a glassmorphic card with a truncated preview.
 * Clicking a card navigates to that greeting via chatSheldService.
 */

import React, { useCallback, useMemo } from 'react';
import { MessageCircle, Check } from 'lucide-react';
import { navigateToGreeting, getCharacterGreetings } from '../../../lib/chatSheldService';

export default function GreetingsModal({ swipes, swipeId, onClose }) {
    // Source greeting text from character card data — more reliable than
    // chat[0].swipes which may be stale or incomplete for pristine chats.
    const greetingTexts = useMemo(() => getCharacterGreetings(), []);

    const handleSelect = useCallback(async (index) => {
        await navigateToGreeting(index);
        onClose();
    }, [onClose]);

    // Use character greeting count if swipes is incomplete
    const greetingCount = Math.max(swipes?.length || 0, greetingTexts.length);

    if (greetingCount <= 1) {
        return (
            <div className="lcs-greetings-modal">
                <div className="lcs-greetings-header">
                    <MessageCircle size={18} />
                    <h3>Greetings</h3>
                </div>
                <p className="lcs-greetings-empty">No alternate greetings available.</p>
            </div>
        );
    }

    // Build greeting entries from the most complete source available.
    // greetingTexts (from character card) is canonical; swipes (from chat[0])
    // may be stale or only contain the current swipe for pristine chats.
    const entries = Array.from({ length: greetingCount }, (_, i) => {
        // Prefer character card text, fall back to swipe content
        const cardText = (typeof greetingTexts[i] === 'string') ? greetingTexts[i] : '';
        const swipeText = (swipes && typeof swipes[i] === 'string') ? swipes[i] : '';
        const rawText = cardText || swipeText;
        // Strip HTML tags, decode common entities, trim whitespace
        const stripped = rawText
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .trim()
            .slice(0, 300);
        return stripped;
    });

    return (
        <div className="lcs-greetings-modal">
            <div className="lcs-greetings-header">
                <MessageCircle size={18} />
                <h3>Greetings</h3>
                <span className="lcs-greetings-count">{greetingCount} greetings</span>
            </div>
            <div className="lcs-greetings-list">
                {entries.map((preview, index) => {
                    const isActive = index === swipeId;
                    const label = index === 0 ? 'Primary Greeting' : `Alternate ${index}`;

                    return (
                        <div
                            key={index}
                            role="button"
                            tabIndex={0}
                            className={`lcs-greeting-card${isActive ? ' lcs-greeting-card--active' : ''}`}
                            onClick={() => handleSelect(index)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(index); } }}
                        >
                            <div className="lcs-greeting-card-header">
                                <span className="lcs-greeting-label">{label}</span>
                                {isActive && (
                                    <span className="lcs-greeting-active-badge">
                                        <Check size={12} />
                                        Active
                                    </span>
                                )}
                            </div>
                            <div className="lcs-greeting-preview">
                                {preview || 'Empty greeting'}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
