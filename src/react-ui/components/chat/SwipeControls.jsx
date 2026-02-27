/**
 * SwipeControls — Left/right swipe navigation with counter
 *
 * Delegates swipe actions to ST via chatSheldService.
 * For mesId 0 with multiple swipes, shows a "Greetings" indicator
 * that opens the GreetingsModal for easy greeting selection.
 */

import React, { useCallback } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { triggerSwipe } from '../../../lib/chatSheldService';
import { useLumiverseActions } from '../../store/LumiverseContext';

export default function SwipeControls({ mesId, swipeId, swipeCount, swipes, isLastMessage }) {
    const actions = useLumiverseActions();

    const handleSwipeLeft = useCallback(() => {
        triggerSwipe('left');
    }, []);

    const handleSwipeRight = useCallback(() => {
        triggerSwipe('right');
    }, []);

    const handleOpenGreetings = useCallback(() => {
        actions.openModal('greetings', { swipes, swipeId, swipeCount });
    }, [actions, swipes, swipeId, swipeCount]);

    // First message (mesId 0) with multiple swipes → show greetings indicator
    const isGreetingsMessage = mesId === 0 && swipeCount > 1;

    // Non-last message: read-only counter (or greetings indicator)
    if (!isLastMessage) {
        if (isGreetingsMessage) {
            return (
                <div className="lcs-swipe">
                    <button
                        className="lcs-greetings-indicator"
                        onClick={handleOpenGreetings}
                        title="Browse alternate greetings"
                        type="button"
                    >
                        <MessageCircle size={13} />
                        <span>Greetings</span>
                        <span className="lcs-greetings-badge">{swipeCount}</span>
                    </button>
                </div>
            );
        }
        return (
            <div className="lcs-swipe">
                <span className="lcs-swipe-counter">
                    {swipeId + 1} / {swipeCount}
                </span>
            </div>
        );
    }

    // Last message + greetings: show indicator + right arrow for generating new
    if (isGreetingsMessage) {
        return (
            <div className="lcs-swipe">
                <button
                    className="lcs-greetings-indicator"
                    onClick={handleOpenGreetings}
                    title="Browse alternate greetings"
                    type="button"
                >
                    <MessageCircle size={13} />
                    <span>Greetings</span>
                    <span className="lcs-greetings-badge">{swipeCount}</span>
                </button>
                <button
                    className="lcs-swipe-btn"
                    onClick={handleSwipeRight}
                    title="Generate new greeting"
                    type="button"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        );
    }

    // Normal last message swipe controls
    const hasMultiple = swipeCount > 1;

    return (
        <div className="lcs-swipe">
            {hasMultiple && (
                <button
                    className="lcs-swipe-btn"
                    onClick={handleSwipeLeft}
                    disabled={swipeId <= 0}
                    title="Previous swipe"
                    type="button"
                >
                    <ChevronLeft size={16} />
                </button>
            )}
            {hasMultiple && (
                <span className="lcs-swipe-counter">
                    {swipeId + 1} / {swipeCount}
                </span>
            )}
            <button
                className="lcs-swipe-btn"
                onClick={handleSwipeRight}
                title={hasMultiple ? 'Next swipe' : 'Generate alternative'}
                type="button"
            >
                <ChevronRight size={16} />
            </button>
        </div>
    );
}
