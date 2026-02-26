/**
 * AvatarLightbox — Full-screen image overlay for character/persona avatars
 *
 * Triggered by clicking avatars in immersive/bubble mode.
 * Features: dark blurred backdrop, centered image, click/Escape to dismiss,
 * native pinch-to-zoom on mobile via touch-action: pinch-zoom.
 */

import React, { useEffect, useCallback, useSyncExternalStore } from 'react';
import { useLumiverseStore } from '../../store/LumiverseContext';

const store = useLumiverseStore;
const selectLightbox = () => store.getState().chatSheld?.avatarLightbox || null;

export default function AvatarLightbox() {
    const lightbox = useSyncExternalStore(store.subscribe, selectLightbox, selectLightbox);

    const dismiss = useCallback(() => {
        const cs = store.getState().chatSheld;
        store.setState({ chatSheld: { ...cs, avatarLightbox: null } });
    }, []);

    // Escape key to close
    useEffect(() => {
        if (!lightbox) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') dismiss();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [lightbox, dismiss]);

    if (!lightbox) return null;

    return (
        <div className="lcs-avatar-lightbox" onClick={dismiss}>
            <div className="lcs-avatar-lightbox-content" onClick={(e) => e.stopPropagation()}>
                <img
                    className="lcs-avatar-lightbox-img"
                    src={lightbox.src}
                    alt={lightbox.name || ''}
                    onClick={dismiss}
                />
                {lightbox.name && (
                    <span className="lcs-avatar-lightbox-name">{lightbox.name}</span>
                )}
            </div>
        </div>
    );
}
