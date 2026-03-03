/**
 * AvatarLightbox — Full-screen image overlay for character/persona avatars
 *
 * Triggered by clicking avatars in immersive/bubble mode or from SidePortrait/Gallery.
 * Features: dark blurred backdrop, centered image, click/Escape to dismiss,
 * JS-based pinch-to-zoom + pan on mobile, double-tap to toggle zoom.
 *
 * Gallery mode: When lightbox.galleryImages exists, renders prev/next navigation
 * arrows and a counter display. Keyboard: ArrowLeft/ArrowRight for gallery nav.
 */

import React, { useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLumiverseStore } from '../../store/LumiverseContext';
import useFixedPositionFix from '../../hooks/useFixedPositionFix';

const store = useLumiverseStore;
const selectLightbox = () => store.getState().chatSheld?.avatarLightbox || null;

const MIN_SCALE = 1;
const MAX_SCALE = 4;

/**
 * Get distance between two touch points.
 */
function getTouchDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get midpoint between two touch points.
 */
function getTouchMidpoint(t1, t2) {
    return {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
    };
}

export default function AvatarLightbox() {
    const lightbox = useSyncExternalStore(store.subscribe, selectLightbox, selectLightbox);

    // Neutralize ST's html transform that breaks position:fixed on mobile
    useFixedPositionFix(!!lightbox);

    const dismiss = useCallback(() => {
        const cs = store.getState().chatSheld;
        store.setState({ chatSheld: { ...cs, avatarLightbox: null } });
    }, []);

    const isGalleryMode = !!(lightbox?.galleryImages?.length);
    const galleryIndex = lightbox?.galleryIndex ?? 0;
    const galleryLength = lightbox?.galleryImages?.length ?? 0;

    const navigateGallery = useCallback((direction) => {
        if (!lightbox?.galleryImages) return;
        const images = lightbox.galleryImages;
        const currentIdx = lightbox.galleryIndex ?? 0;
        const newIdx = direction === 'prev'
            ? Math.max(0, currentIdx - 1)
            : Math.min(images.length - 1, currentIdx + 1);
        if (newIdx === currentIdx) return;

        const cs = store.getState().chatSheld;
        store.setState({
            chatSheld: {
                ...cs,
                avatarLightbox: {
                    ...lightbox,
                    src: images[newIdx]?.path || '',
                    galleryIndex: newIdx,
                },
            },
        });
    }, [lightbox]);

    // ── Pinch-to-zoom + pan state ──────────────────────────────────────
    const imgRef = useRef(null);
    const stateRef = useRef({
        scale: 1,
        translateX: 0,
        translateY: 0,
        // Pinch tracking
        initialDistance: 0,
        initialScale: 1,
        // Pan tracking (single finger when zoomed)
        isPanning: false,
        panStartX: 0,
        panStartY: 0,
        panStartTranslateX: 0,
        panStartTranslateY: 0,
        // Double-tap detection
        lastTapTime: 0,
    });

    /** Apply current transform to the image element */
    const applyTransform = useCallback(() => {
        const img = imgRef.current;
        if (!img) return;
        const s = stateRef.current;
        img.style.transform = `translate(${s.translateX}px, ${s.translateY}px) scale(${s.scale})`;
    }, []);

    /** Reset zoom/pan to default */
    const resetTransform = useCallback(() => {
        const s = stateRef.current;
        s.scale = 1;
        s.translateX = 0;
        s.translateY = 0;
        applyTransform();
    }, [applyTransform]);

    // Reset transform when image source changes (gallery navigation)
    useEffect(() => {
        resetTransform();
    }, [lightbox?.src, resetTransform]);

    /** Clamp translation so the image doesn't drift off screen */
    const clampTranslation = useCallback(() => {
        const img = imgRef.current;
        if (!img) return;
        const s = stateRef.current;
        if (s.scale <= 1) {
            s.translateX = 0;
            s.translateY = 0;
            return;
        }
        const rect = img.getBoundingClientRect();
        const imgW = rect.width / s.scale; // unscaled width
        const imgH = rect.height / s.scale;
        const maxX = (imgW * (s.scale - 1)) / 2;
        const maxY = (imgH * (s.scale - 1)) / 2;
        s.translateX = Math.max(-maxX, Math.min(maxX, s.translateX));
        s.translateY = Math.max(-maxY, Math.min(maxY, s.translateY));
    }, []);

    // ── Touch handlers ──────────────────────────────────────────────────
    const handleTouchStart = useCallback((e) => {
        const s = stateRef.current;
        if (e.touches.length === 2) {
            // Pinch start
            e.preventDefault();
            s.initialDistance = getTouchDistance(e.touches[0], e.touches[1]);
            s.initialScale = s.scale;
            s.isPanning = false;
        } else if (e.touches.length === 1) {
            // Double-tap detection
            const now = Date.now();
            if (now - s.lastTapTime < 300) {
                e.preventDefault();
                // Toggle between 1x and 2.5x
                if (s.scale > 1.1) {
                    s.scale = 1;
                    s.translateX = 0;
                    s.translateY = 0;
                } else {
                    s.scale = 2.5;
                    // Zoom toward tap point
                    const img = imgRef.current;
                    if (img) {
                        const rect = img.getBoundingClientRect();
                        const cx = rect.left + rect.width / 2;
                        const cy = rect.top + rect.height / 2;
                        s.translateX = (cx - e.touches[0].clientX) * 0.6;
                        s.translateY = (cy - e.touches[0].clientY) * 0.6;
                        clampTranslation();
                    }
                }
                applyTransform();
                s.lastTapTime = 0;
                return;
            }
            s.lastTapTime = now;

            // Pan start (only when zoomed)
            if (s.scale > 1.05) {
                e.preventDefault();
                s.isPanning = true;
                s.panStartX = e.touches[0].clientX;
                s.panStartY = e.touches[0].clientY;
                s.panStartTranslateX = s.translateX;
                s.panStartTranslateY = s.translateY;
            }
        }
    }, [applyTransform, clampTranslation]);

    const handleTouchMove = useCallback((e) => {
        const s = stateRef.current;
        if (e.touches.length === 2) {
            // Pinch move
            e.preventDefault();
            const dist = getTouchDistance(e.touches[0], e.touches[1]);
            const ratio = dist / s.initialDistance;
            s.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s.initialScale * ratio));
            clampTranslation();
            applyTransform();
        } else if (e.touches.length === 1 && s.isPanning) {
            // Pan move
            e.preventDefault();
            const dx = e.touches[0].clientX - s.panStartX;
            const dy = e.touches[0].clientY - s.panStartY;
            s.translateX = s.panStartTranslateX + dx;
            s.translateY = s.panStartTranslateY + dy;
            clampTranslation();
            applyTransform();
        }
    }, [applyTransform, clampTranslation]);

    const handleTouchEnd = useCallback((e) => {
        const s = stateRef.current;
        if (e.touches.length < 2) {
            s.initialDistance = 0;
        }
        if (e.touches.length === 0) {
            s.isPanning = false;
            // Snap back to 1x if barely zoomed
            if (s.scale < 1.05) {
                s.scale = 1;
                s.translateX = 0;
                s.translateY = 0;
                applyTransform();
            }
        }
    }, [applyTransform]);

    // Handle click on image — only dismiss if not zoomed
    const handleImgClick = useCallback(() => {
        const s = stateRef.current;
        if (s.scale <= 1.05) {
            dismiss();
        }
    }, [dismiss]);

    // Keyboard: Escape to close, ArrowLeft/ArrowRight for gallery nav
    useEffect(() => {
        if (!lightbox) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') dismiss();
            if (isGalleryMode && e.key === 'ArrowLeft') navigateGallery('prev');
            if (isGalleryMode && e.key === 'ArrowRight') navigateGallery('next');
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [lightbox, dismiss, isGalleryMode, navigateGallery]);

    if (!lightbox) return null;

    return createPortal(
        <div className="lcs-avatar-lightbox" onClick={dismiss}>
            <div className="lcs-avatar-lightbox-content" onClick={(e) => e.stopPropagation()}>
                {/* Gallery prev button */}
                {isGalleryMode && (
                    <button
                        className="lcs-lightbox-nav lcs-lightbox-nav--prev"
                        onClick={() => navigateGallery('prev')}
                        disabled={galleryIndex <= 0}
                        title="Previous image"
                        type="button"
                    >
                        <ChevronLeft size={20} />
                    </button>
                )}

                <img
                    ref={imgRef}
                    className="lcs-avatar-lightbox-img"
                    src={lightbox.src}
                    alt={lightbox.name || ''}
                    onClick={handleImgClick}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                />

                {/* Gallery next button */}
                {isGalleryMode && (
                    <button
                        className="lcs-lightbox-nav lcs-lightbox-nav--next"
                        onClick={() => navigateGallery('next')}
                        disabled={galleryIndex >= galleryLength - 1}
                        title="Next image"
                        type="button"
                    >
                        <ChevronRight size={20} />
                    </button>
                )}

                {/* Name label */}
                {lightbox.name && (
                    <span className="lcs-avatar-lightbox-name">{lightbox.name}</span>
                )}

                {/* Gallery counter */}
                {isGalleryMode && (
                    <span className="lcs-lightbox-counter">
                        {galleryIndex + 1} / {galleryLength}
                    </span>
                )}
            </div>
        </div>,
        document.body,
    );
}
