import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

/**
 * Reusable Confirmation Modal Component
 * 
 * A customizable confirmation dialog with three variants:
 * - danger: Red accents for destructive actions (delete, remove, etc.)
 * - warning: Yellow accents for cautionary actions
 * - safe: Purple accents for neutral/safe actions
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {function} props.onConfirm - Callback when user confirms
 * @param {function} props.onCancel - Callback when user cancels
 * @param {string} props.title - Modal title
 * @param {string|React.ReactNode} props.message - Modal message/content
 * @param {'danger'|'warning'|'safe'} props.variant - Color variant (default: 'safe')
 * @param {string} props.confirmText - Text for confirm button (default: 'Confirm')
 * @param {string} props.cancelText - Text for cancel button (default: 'Cancel')
 * @param {React.ReactNode} props.icon - Custom icon (optional, uses default based on variant)
 */
const ConfirmationModal = ({
    isOpen,
    onConfirm,
    onCancel,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    variant = 'safe',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    icon: customIcon,
}) => {
    // Handle escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onCancel?.();
            }
        };
        
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }
        
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onCancel]);

    // Handle backdrop click
    const handleBackdropClick = useCallback((e) => {
        if (e.target === e.currentTarget) {
            onCancel?.();
        }
    }, [onCancel]);

    // Get variant-specific styles
    const getVariantStyles = () => {
        switch (variant) {
            case 'danger':
                return {
                    iconBg: 'rgba(239, 68, 68, 0.15)',
                    iconColor: '#ef4444',
                    confirmBg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9))',
                    confirmHoverBg: 'linear-gradient(135deg, rgba(248, 113, 113, 0.95), rgba(239, 68, 68, 0.95))',
                    confirmBorder: 'rgba(239, 68, 68, 0.5)',
                    accentGlow: 'rgba(239, 68, 68, 0.3)',
                    borderAccent: 'rgba(239, 68, 68, 0.2)',
                };
            case 'warning':
                return {
                    iconBg: 'rgba(245, 158, 11, 0.15)',
                    iconColor: '#f59e0b',
                    confirmBg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.9))',
                    confirmHoverBg: 'linear-gradient(135deg, rgba(251, 191, 36, 0.95), rgba(245, 158, 11, 0.95))',
                    confirmBorder: 'rgba(245, 158, 11, 0.5)',
                    accentGlow: 'rgba(245, 158, 11, 0.3)',
                    borderAccent: 'rgba(245, 158, 11, 0.2)',
                };
            case 'safe':
            default:
                return {
                    iconBg: 'rgba(147, 112, 219, 0.15)',
                    iconColor: '#9370db',
                    confirmBg: 'linear-gradient(135deg, rgba(147, 112, 219, 0.9), rgba(124, 58, 237, 0.9))',
                    confirmHoverBg: 'linear-gradient(135deg, rgba(167, 139, 250, 0.95), rgba(147, 112, 219, 0.95))',
                    confirmBorder: 'rgba(147, 112, 219, 0.5)',
                    accentGlow: 'rgba(147, 112, 219, 0.3)',
                    borderAccent: 'rgba(147, 112, 219, 0.2)',
                };
        }
    };

    // Get default icon based on variant
    const getDefaultIcon = () => {
        switch (variant) {
            case 'danger':
                return <AlertCircle size={24} />;
            case 'warning':
                return <AlertTriangle size={24} />;
            case 'safe':
            default:
                return <Info size={24} />;
        }
    };

    const variantStyles = getVariantStyles();
    const displayIcon = customIcon || getDefaultIcon();

    // Use portal to render at document body level, escaping any parent pointer-events restrictions
    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="lumiverse-confirm-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={handleBackdropClick}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                        background: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(4px)',
                        WebkitBackdropFilter: 'blur(4px)',
                        pointerEvents: 'auto',
                    }}
                >
                    <motion.div
                        className="lumiverse-confirm-modal"
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: '420px',
                            background: 'linear-gradient(135deg, rgba(30, 25, 45, 0.98), rgba(20, 18, 30, 0.98))',
                            borderRadius: '16px',
                            border: `1px solid ${variantStyles.borderAccent}`,
                            boxShadow: `
                                0 25px 50px -12px rgba(0, 0, 0, 0.5),
                                0 0 0 1px rgba(255, 255, 255, 0.05),
                                0 0 40px ${variantStyles.accentGlow}
                            `,
                            overflow: 'hidden',
                        }}
                    >
                        {/* Close button */}
                        <button
                            onClick={onCancel}
                            style={{
                                position: 'absolute',
                                top: '12px',
                                right: '12px',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                color: 'rgba(255, 255, 255, 0.6)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                            }}
                            type="button"
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>

                        {/* Content */}
                        <div style={{ padding: '28px 24px 24px' }}>
                            {/* Icon */}
                            <div
                                style={{
                                    width: '56px',
                                    height: '56px',
                                    margin: '0 auto 20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: variantStyles.iconBg,
                                    borderRadius: '14px',
                                    color: variantStyles.iconColor,
                                }}
                            >
                                {displayIcon}
                            </div>

                            {/* Title */}
                            <h3
                                style={{
                                    margin: '0 0 12px',
                                    fontSize: '18px',
                                    fontWeight: 600,
                                    color: '#ffffff',
                                    textAlign: 'center',
                                }}
                            >
                                {title}
                            </h3>

                            {/* Message */}
                            <div
                                style={{
                                    fontSize: '14px',
                                    lineHeight: 1.6,
                                    color: 'rgba(255, 255, 255, 0.7)',
                                    textAlign: 'center',
                                }}
                            >
                                {message}
                            </div>
                        </div>

                        {/* Actions */}
                        <div
                            style={{
                                display: 'flex',
                                gap: '12px',
                                padding: '0 24px 24px',
                            }}
                        >
                            {/* Cancel button */}
                            <button
                                onClick={onCancel}
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
                                type="button"
                            >
                                {cancelText}
                            </button>

                            {/* Confirm button */}
                            <button
                                onClick={onConfirm}
                                style={{
                                    flex: 1,
                                    padding: '12px 20px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    background: variantStyles.confirmBg,
                                    border: `1px solid ${variantStyles.confirmBorder}`,
                                    borderRadius: '10px',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    boxShadow: `0 4px 12px ${variantStyles.accentGlow}`,
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = variantStyles.confirmHoverBg;
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = `0 6px 16px ${variantStyles.accentGlow}`;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = variantStyles.confirmBg;
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = `0 4px 12px ${variantStyles.accentGlow}`;
                                }}
                                type="button"
                            >
                                {confirmText}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default ConfirmationModal;
