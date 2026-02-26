/**
 * SwipeControls — Left/right swipe navigation with counter
 *
 * Delegates swipe actions to ST via chatSheldService.
 */

import React, { useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { triggerSwipe } from '../../../lib/chatSheldService';

export default function SwipeControls({ mesId, swipeId, swipeCount, isLastMessage }) {
    const handleSwipeLeft = useCallback(() => {
        triggerSwipe('left');
    }, []);

    const handleSwipeRight = useCallback(() => {
        triggerSwipe('right');
    }, []);

    // Only the last message can be swiped in ST
    if (!isLastMessage) {
        return (
            <div className="lcs-swipe">
                <span className="lcs-swipe-counter">
                    {swipeId + 1} / {swipeCount}
                </span>
            </div>
        );
    }

    // On the last message, right arrow is always enabled — it generates a new swipe in ST
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
