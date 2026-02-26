/**
 * ScrollToBottom — Floating action button that appears when user scrolls up
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowDown } from 'lucide-react';

export default function ScrollToBottom({ scrollContainerRef }) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const container = scrollContainerRef?.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            setIsVisible(distanceFromBottom > 200);
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [scrollContainerRef]);

    const handleClick = useCallback(() => {
        const container = scrollContainerRef?.current;
        if (container) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth',
            });
        }
    }, [scrollContainerRef]);

    return (
        <button
            className={`lcs-scroll-fab ${!isVisible ? 'lcs-scroll-fab--hidden' : ''}`}
            onClick={handleClick}
            title="Scroll to bottom"
            type="button"
            aria-label="Scroll to bottom"
        >
            <ArrowDown size={18} />
        </button>
    );
}
