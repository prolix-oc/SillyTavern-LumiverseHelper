/**
 * useIsMobile — Shared hook to detect mobile viewport
 *
 * Returns true when window.innerWidth <= breakpoint.
 * Debounces resize events via state-diff check to avoid unnecessary re-renders.
 */

import { useState, useEffect } from 'react';

const DEFAULT_BREAKPOINT = 600;

export default function useIsMobile(breakpoint = DEFAULT_BREAKPOINT) {
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
    );

    useEffect(() => {
        const handleResize = () => {
            const newIsMobile = window.innerWidth <= breakpoint;
            setIsMobile(prev => prev !== newIsMobile ? newIsMobile : prev);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [breakpoint]);

    return isMobile;
}
