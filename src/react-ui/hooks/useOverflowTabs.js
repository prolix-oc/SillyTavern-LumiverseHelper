/**
 * useOverflowTabs — Priority+ pattern for sidebar tab overflow
 *
 * Observes the tabs container height via ResizeObserver and splits tabs into
 * visible (direct) vs overflow sets. Only active on mobile — desktop returns
 * all tabs as direct with no overflow.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Mobile tab slot: 44px height + 4px gap
const TAB_SLOT = 48;
// Bottom reserved: settings btn (36) + overflow btn (44) + padding (12)
const BOTTOM_RESERVED = 92;

export default function useOverflowTabs(tabs, isMobile, containerRef) {
    const [splitIndex, setSplitIndex] = useState(tabs.length);
    const tabsLenRef = useRef(tabs.length);
    tabsLenRef.current = tabs.length;

    const computeSplit = useCallback((height) => {
        const maxVisible = Math.floor((height - BOTTOM_RESERVED) / TAB_SLOT);
        const clamped = Math.max(1, Math.min(tabsLenRef.current, maxVisible));
        setSplitIndex(prev => prev !== clamped ? clamped : prev);
    }, []);

    useEffect(() => {
        if (!isMobile || !containerRef.current) {
            // Desktop: show all
            setSplitIndex(tabs.length);
            return;
        }

        const el = containerRef.current;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                computeSplit(entry.contentRect.height);
            }
        });
        ro.observe(el);

        // Initial measurement
        computeSplit(el.clientHeight);

        return () => ro.disconnect();
    }, [isMobile, containerRef, computeSplit, tabs.length]);

    // When tabs array length changes, recompute immediately
    useEffect(() => {
        if (!isMobile || !containerRef.current) {
            setSplitIndex(tabs.length);
            return;
        }
        computeSplit(containerRef.current.clientHeight);
    }, [tabs.length, isMobile, containerRef, computeSplit]);

    const needsOverflow = isMobile && splitIndex < tabs.length;

    return {
        directTabs: needsOverflow ? tabs.slice(0, splitIndex) : tabs,
        overflowTabs: needsOverflow ? tabs.slice(splitIndex) : [],
        needsOverflow,
    };
}
