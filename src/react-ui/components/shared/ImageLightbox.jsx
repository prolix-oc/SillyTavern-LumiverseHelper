/**
 * ImageLightbox — Shared full-screen image overlay with mobile touch support.
 *
 * Features: dark blurred backdrop, centered image, click/Escape to dismiss,
 * JS-based pinch-to-zoom + pan on mobile, double-tap to toggle zoom.
 *
 * Props-driven (no store dependency) so it can be used from any context.
 *
 * @param {Object} props
 * @param {string} props.src - Image URL to display
 * @param {string} [props.alt] - Alt text / label
 * @param {Function} props.onClose - Called when the lightbox should dismiss
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import useFixedPositionFix from '../../hooks/useFixedPositionFix';

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function getTouchDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

export default function ImageLightbox({ src, alt, onClose }) {
    // Neutralize ST's html transform that breaks position:fixed on mobile
    useFixedPositionFix(true);

    const imgRef = useRef(null);
    const stateRef = useRef({
        scale: 1,
        translateX: 0,
        translateY: 0,
        initialDistance: 0,
        initialScale: 1,
        isPanning: false,
        panStartX: 0,
        panStartY: 0,
        panStartTranslateX: 0,
        panStartTranslateY: 0,
        lastTapTime: 0,
    });

    // ── Transform helpers ───────────────────────────────────────────────

    const applyTransform = useCallback(() => {
        const img = imgRef.current;
        if (!img) return;
        const s = stateRef.current;
        img.style.transform = `translate(${s.translateX}px, ${s.translateY}px) scale(${s.scale})`;
    }, []);

    const resetTransform = useCallback(() => {
        const s = stateRef.current;
        s.scale = 1;
        s.translateX = 0;
        s.translateY = 0;
        applyTransform();
    }, [applyTransform]);

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
        const imgW = rect.width / s.scale;
        const imgH = rect.height / s.scale;
        const maxX = (imgW * (s.scale - 1)) / 2;
        const maxY = (imgH * (s.scale - 1)) / 2;
        s.translateX = Math.max(-maxX, Math.min(maxX, s.translateX));
        s.translateY = Math.max(-maxY, Math.min(maxY, s.translateY));
    }, []);

    // Reset zoom when src changes
    useEffect(() => { resetTransform(); }, [src, resetTransform]);

    // ── Touch handlers ──────────────────────────────────────────────────

    const handleTouchStart = useCallback((e) => {
        const s = stateRef.current;
        if (e.touches.length === 2) {
            e.preventDefault();
            s.initialDistance = getTouchDistance(e.touches[0], e.touches[1]);
            s.initialScale = s.scale;
            s.isPanning = false;
        } else if (e.touches.length === 1) {
            const now = Date.now();
            if (now - s.lastTapTime < 300) {
                e.preventDefault();
                if (s.scale > 1.1) {
                    s.scale = 1;
                    s.translateX = 0;
                    s.translateY = 0;
                } else {
                    s.scale = 2.5;
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
            e.preventDefault();
            const dist = getTouchDistance(e.touches[0], e.touches[1]);
            const ratio = dist / s.initialDistance;
            s.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s.initialScale * ratio));
            clampTranslation();
            applyTransform();
        } else if (e.touches.length === 1 && s.isPanning) {
            e.preventDefault();
            s.translateX = s.panStartTranslateX + (e.touches[0].clientX - s.panStartX);
            s.translateY = s.panStartTranslateY + (e.touches[0].clientY - s.panStartY);
            clampTranslation();
            applyTransform();
        }
    }, [applyTransform, clampTranslation]);

    const handleTouchEnd = useCallback((e) => {
        const s = stateRef.current;
        if (e.touches.length < 2) s.initialDistance = 0;
        if (e.touches.length === 0) {
            s.isPanning = false;
            if (s.scale < 1.05) {
                s.scale = 1;
                s.translateX = 0;
                s.translateY = 0;
                applyTransform();
            }
        }
    }, [applyTransform]);

    // Click image: dismiss only when not zoomed
    const handleImgClick = useCallback(() => {
        if (stateRef.current.scale <= 1.05) onClose();
    }, [onClose]);

    // Escape to close
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return createPortal(
        <div className="lumiverse-lightbox-backdrop" onClick={onClose}>
            <div className="lumiverse-lightbox-content" onClick={(e) => e.stopPropagation()}>
                <img
                    ref={imgRef}
                    className="lumiverse-lightbox-img"
                    src={src}
                    alt={alt || ''}
                    onClick={handleImgClick}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                />
                {alt && <span className="lumiverse-lightbox-label">{alt}</span>}
            </div>
        </div>,
        document.body,
    );
}
