/**
 * AuthorsNotePortal — Renders AuthorsNotePanel via createPortal into a dedicated
 * mount point on document.body with inline fixed-position styles.
 *
 * Mirrors the ViewportPanel mount pattern (inline styles on a body-level element)
 * instead of relying on CSS-class-based positioning. This avoids mobile breakage
 * caused by ST's `-webkit-transform: translateZ(0)` on <html> and other
 * containing-block quirks that interfere with `position: fixed` in CSS classes.
 *
 * The mount element carries .lcs-app so CSS custom properties (--lcs-*,
 * --lumiverse-*) cascade to the panel, but its layout styles are overridden
 * inline to prevent .lcs-app's flex/sizing rules from interfering.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AuthorsNotePanel from './AuthorsNotePanel';

const MOUNT_ID = 'lumiverse-an-portal';

export default function AuthorsNotePortal() {
    const [portalTarget, setPortalTarget] = useState(null);

    useEffect(() => {
        // Reuse existing mount point if present (hot-reload safety)
        let el = document.getElementById(MOUNT_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = MOUNT_ID;
            // .lcs-app provides CSS custom variable cascade (--lcs-*, --lumiverse-*)
            el.className = 'lcs-app';
            // Inline styles override .lcs-app's layout rules (display:flex,
            // width:100%, height:100%) and establish reliable fixed positioning.
            // Mirrors the ViewportPanel body-level mount pattern.
            el.style.cssText = [
                'position:fixed',
                'top:0',
                'left:0',
                'right:0',
                'bottom:0',
                'display:block',
                'width:auto',
                'height:auto',
                'min-height:auto',
                'pointer-events:none',
                'z-index:1050',
                'background:transparent',
            ].join(';');
            document.body.appendChild(el);
        }
        setPortalTarget(el);

        return () => {
            el.remove();
        };
    }, []);

    if (!portalTarget) return null;

    return createPortal(
        <AuthorsNotePanel />,
        portalTarget
    );
}
