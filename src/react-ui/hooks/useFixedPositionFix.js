import { useEffect } from 'react';

/**
 * Properties on ancestor elements that create a new containing block,
 * breaking position:fixed (makes it relative to the ancestor, not the viewport).
 *
 * SillyTavern applies these GPU-acceleration hacks on <html>:
 *   -webkit-transform: translateZ(0);
 *   -webkit-backface-visibility: hidden;
 *   -webkit-perspective: 1000;
 *
 * This causes all position:fixed overlays (portaled to document.body) to be
 * positioned relative to <html> instead of the viewport, resulting in modals
 * rendering off-screen on mobile when the user has scrolled or when the visual
 * viewport differs from the layout viewport.
 *
 * This hook temporarily neutralizes these properties while the overlay is open.
 * The body scroll lock (overflow:hidden) ensures no visual disruption from the
 * GPU acceleration hack being removed, since the entire viewport is covered.
 */

// Track how many overlays are currently using the fix (nested modal support)
let activeCount = 0;
let savedTransform = '';
let savedPerspective = '';
let savedBackfaceVisibility = '';

function applyFix() {
    if (activeCount === 0) {
        const html = document.documentElement;
        // Save current inline values (not computed — we only need to restore what was inline)
        savedTransform = html.style.getPropertyValue('-webkit-transform');
        savedPerspective = html.style.getPropertyValue('-webkit-perspective');
        savedBackfaceVisibility = html.style.getPropertyValue('-webkit-backface-visibility');

        // Override with !important to beat both stylesheet and any inline rules
        html.style.setProperty('-webkit-transform', 'none', 'important');
        html.style.setProperty('-webkit-perspective', 'none', 'important');
        html.style.setProperty('-webkit-backface-visibility', 'visible', 'important');
        // Also set unprefixed in case the browser uses those
        html.style.setProperty('transform', 'none', 'important');
        html.style.setProperty('perspective', 'none', 'important');
    }
    activeCount++;
}

function removeFix() {
    activeCount--;
    if (activeCount <= 0) {
        activeCount = 0;
        const html = document.documentElement;

        // Restore or remove each property
        const restore = (prop, saved) => {
            if (saved) {
                html.style.setProperty(prop, saved);
            } else {
                html.style.removeProperty(prop);
            }
        };
        restore('-webkit-transform', savedTransform);
        restore('-webkit-perspective', savedPerspective);
        restore('-webkit-backface-visibility', savedBackfaceVisibility);
        html.style.removeProperty('transform');
        html.style.removeProperty('perspective');
    }
}

/**
 * Hook that temporarily neutralizes CSS properties on <html> that break
 * position:fixed for portaled overlays. Call this in any modal/overlay
 * component that uses createPortal + position:fixed.
 *
 * @param {boolean} isActive - Whether the overlay is currently visible
 */
export default function useFixedPositionFix(isActive) {
    useEffect(() => {
        if (!isActive) return;
        applyFix();
        return () => removeFix();
    }, [isActive]);
}
