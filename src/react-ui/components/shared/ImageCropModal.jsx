import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import Cropper from 'react-easy-crop';
import { X, ZoomIn, ZoomOut, RotateCcw, Crop } from 'lucide-react';
import useFixedPositionFix from '../../hooks/useFixedPositionFix';
import cropImage from '../../lib/cropImage';

const ASPECT = 2 / 3;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

/**
 * Image Crop Modal — touch-friendly crop/zoom/pan overlay for avatar images.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {string|null} props.imageSrc - Object URL or data URL to crop
 * @param {(blob: Blob) => void} props.onCropDone - Called with the cropped PNG Blob
 * @param {() => void} props.onCancel
 */
const ImageCropModal = ({ isOpen, imageSrc, onCropDone, onCancel }) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [isApplying, setIsApplying] = useState(false);

    useFixedPositionFix(isOpen);

    // Reset state when a new image opens
    useEffect(() => {
        if (isOpen) {
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setCroppedAreaPixels(null);
            setIsApplying(false);
        }
    }, [isOpen, imageSrc]);

    // Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e) => {
            if (e.key === 'Escape') onCancel?.();
        };
        document.addEventListener('keydown', handleEscape);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onCancel]);

    const onCropComplete = useCallback((_croppedArea, croppedAreaPx) => {
        setCroppedAreaPixels(croppedAreaPx);
    }, []);

    const handleApply = useCallback(async () => {
        if (!croppedAreaPixels || !imageSrc) return;
        setIsApplying(true);
        try {
            const blob = await cropImage(imageSrc, croppedAreaPixels);
            onCropDone(blob);
        } catch (err) {
            console.error('[ImageCropModal] crop failed:', err);
        } finally {
            setIsApplying(false);
        }
    }, [croppedAreaPixels, imageSrc, onCropDone]);

    const handleReset = useCallback(() => {
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    }, []);

    const handleBackdropClick = useCallback((e) => {
        if (e.target === e.currentTarget) onCancel?.();
    }, [onCancel]);

    // Variant styles matching ConfirmationModal 'safe' variant
    const accentGlow = 'rgba(147, 112, 219, 0.3)';
    const borderAccent = 'var(--lumiverse-primary-020, rgba(147, 112, 219, 0.2))';
    const confirmBg = 'linear-gradient(135deg, rgba(147, 112, 219, 0.9), rgba(124, 58, 237, 0.9))';
    const confirmHoverBg = 'linear-gradient(135deg, rgba(167, 139, 250, 0.95), rgba(147, 112, 219, 0.95))';
    const confirmBorder = 'var(--lumiverse-primary-050, rgba(147, 112, 219, 0.5))';

    return createPortal(
        <AnimatePresence>
            {isOpen && imageSrc && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={handleBackdropClick}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10003,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                        background: 'var(--lumiverse-modal-backdrop, rgba(0, 0, 0, 0.6))',
                        backdropFilter: 'blur(4px)',
                        WebkitBackdropFilter: 'blur(4px)',
                        pointerEvents: 'auto',
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: '480px',
                            background: 'var(--lumiverse-gradient-modal, linear-gradient(135deg, rgba(30, 25, 45, 0.98), rgba(20, 18, 30, 0.98)))',
                            borderRadius: '16px',
                            border: `1px solid ${borderAccent}`,
                            boxShadow: `
                                0 25px 50px -12px rgba(0, 0, 0, 0.5),
                                0 0 0 1px var(--lumiverse-border),
                                0 0 40px ${accentGlow}
                            `,
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px 20px 12px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'var(--lumiverse-primary-015, rgba(147, 112, 219, 0.15))',
                                    borderRadius: '10px',
                                    color: 'var(--lumiverse-primary, #9370db)',
                                }}>
                                    <Crop size={18} />
                                </div>
                                <h3 style={{
                                    margin: 0,
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    color: 'var(--lumiverse-text, #ffffff)',
                                }}>
                                    Crop Avatar
                                </h3>
                            </div>
                            <button
                                onClick={onCancel}
                                type="button"
                                aria-label="Close"
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'var(--lumiverse-bg-dark, rgba(255, 255, 255, 0.05))',
                                    border: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.1))',
                                    borderRadius: '8px',
                                    color: 'var(--lumiverse-text-muted, rgba(255, 255, 255, 0.6))',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--lumiverse-bg-darker, rgba(255, 255, 255, 0.1))';
                                    e.currentTarget.style.color = 'var(--lumiverse-text, rgba(255, 255, 255, 0.9))';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'var(--lumiverse-bg-dark, rgba(255, 255, 255, 0.05))';
                                    e.currentTarget.style.color = 'var(--lumiverse-text-muted, rgba(255, 255, 255, 0.6))';
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Cropper Area */}
                        <div style={{
                            position: 'relative',
                            width: '100%',
                            height: '340px',
                            background: 'rgba(0, 0, 0, 0.3)',
                        }}>
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={ASPECT}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                                minZoom={MIN_ZOOM}
                                maxZoom={MAX_ZOOM}
                                style={{
                                    containerStyle: {
                                        width: '100%',
                                        height: '100%',
                                    },
                                    cropAreaStyle: {
                                        border: '2px solid var(--lumiverse-primary, #9370db)',
                                        borderRadius: '8px',
                                    },
                                }}
                            />
                        </div>

                        {/* Zoom Controls */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '14px 20px',
                        }}>
                            <ZoomOut
                                size={16}
                                strokeWidth={1.5}
                                style={{
                                    color: 'var(--lumiverse-text-muted, rgba(255, 255, 255, 0.6))',
                                    flexShrink: 0,
                                    cursor: 'pointer',
                                }}
                                onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
                            />
                            <input
                                type="range"
                                min={MIN_ZOOM}
                                max={MAX_ZOOM}
                                step={ZOOM_STEP}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                style={{
                                    flex: 1,
                                    height: '4px',
                                    appearance: 'none',
                                    WebkitAppearance: 'none',
                                    background: `linear-gradient(to right, var(--lumiverse-primary, #9370db) ${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%, rgba(255,255,255,0.15) ${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%)`,
                                    borderRadius: '2px',
                                    outline: 'none',
                                    cursor: 'pointer',
                                }}
                            />
                            <ZoomIn
                                size={16}
                                strokeWidth={1.5}
                                style={{
                                    color: 'var(--lumiverse-text-muted, rgba(255, 255, 255, 0.6))',
                                    flexShrink: 0,
                                    cursor: 'pointer',
                                }}
                                onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
                            />
                            <button
                                onClick={handleReset}
                                type="button"
                                title="Reset zoom & position"
                                style={{
                                    width: '30px',
                                    height: '30px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'var(--lumiverse-bg-dark, rgba(255, 255, 255, 0.05))',
                                    border: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.1))',
                                    borderRadius: '8px',
                                    color: 'var(--lumiverse-text-muted, rgba(255, 255, 255, 0.6))',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--lumiverse-bg-darker, rgba(255, 255, 255, 0.1))';
                                    e.currentTarget.style.color = 'var(--lumiverse-text, rgba(255, 255, 255, 0.9))';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'var(--lumiverse-bg-dark, rgba(255, 255, 255, 0.05))';
                                    e.currentTarget.style.color = 'var(--lumiverse-text-muted, rgba(255, 255, 255, 0.6))';
                                }}
                            >
                                <RotateCcw size={13} />
                            </button>
                        </div>

                        {/* Footer */}
                        <div style={{
                            display: 'flex',
                            gap: '12px',
                            padding: '0 20px 18px',
                        }}>
                            <button
                                onClick={onCancel}
                                type="button"
                                style={{
                                    flex: 1,
                                    padding: '12px 20px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '10px',
                                    color: 'rgba(255, 255, 255, 0.8)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApply}
                                disabled={isApplying || !croppedAreaPixels}
                                type="button"
                                style={{
                                    flex: 1,
                                    padding: '12px 20px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    background: confirmBg,
                                    border: `1px solid ${confirmBorder}`,
                                    borderRadius: '10px',
                                    color: '#ffffff',
                                    cursor: isApplying ? 'wait' : 'pointer',
                                    transition: 'all 0.15s ease',
                                    boxShadow: `0 4px 12px ${accentGlow}`,
                                    opacity: (isApplying || !croppedAreaPixels) ? 0.6 : 1,
                                }}
                                onMouseEnter={(e) => {
                                    if (!isApplying && croppedAreaPixels) {
                                        e.currentTarget.style.background = confirmHoverBg;
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                        e.currentTarget.style.boxShadow = `0 6px 16px ${accentGlow}`;
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = confirmBg;
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = `0 4px 12px ${accentGlow}`;
                                }}
                            >
                                {isApplying ? 'Applying...' : 'Apply Crop'}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
};

export default ImageCropModal;
