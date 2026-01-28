import React from 'react';
import { ArrowUpCircle, ExternalLink, X } from 'lucide-react';
import clsx from 'clsx';
import { useUpdates, useLumiverseActions } from '../store/LumiverseContext';

/**
 * Update Banner Component
 * Displays a notification banner when extension or preset updates are available.
 * 
 * Design: Warm amber/orange gradient with purple accents to blend with Lumiverse theme.
 * Shows extension updates prominently, with preset updates listed below.
 */
export default function UpdateBanner({ variant = 'full', onDismiss }) {
    const { extensionUpdate, presetUpdates, hasAnyUpdate } = useUpdates();

    if (!hasAnyUpdate) {
        return null;
    }

    const hasExtUpdate = extensionUpdate?.hasUpdate;
    const presetCount = presetUpdates?.length || 0;

    // Compact variant for sidebar toggle area
    if (variant === 'compact') {
        return (
            <div className="lumiverse-update-indicator">
                <ArrowUpCircle size={12} strokeWidth={2.5} />
            </div>
        );
    }

    // Minimal variant for accordion title
    if (variant === 'badge') {
        return (
            <span className="lumiverse-update-badge">New!</span>
        );
    }

    // Full banner for settings panel and sidebar
    return (
        <div className={clsx('lumiverse-update-banner', hasExtUpdate && 'has-extension-update')}>
            <div className="lumiverse-update-banner-content">
                <div className="lumiverse-update-banner-icon">
                    <ArrowUpCircle size={20} strokeWidth={2} />
                </div>
                
                <div className="lumiverse-update-banner-text">
                    {hasExtUpdate && (
                        <div className="lumiverse-update-banner-main">
                            <strong>Lumiverse Helper {extensionUpdate.latestVersion}</strong> available
                            <a 
                                href="https://github.com/prolix-oc/SillyTavern-LumiverseHelper/releases"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="lumiverse-update-banner-link"
                            >
                                Update now <ExternalLink size={12} />
                            </a>
                        </div>
                    )}
                    
                    {presetCount > 0 && (
                        <div className="lumiverse-update-banner-presets">
                            {presetCount} preset{presetCount !== 1 ? 's' : ''} {presetCount !== 1 ? 'have' : 'has'} updates: {
                                presetUpdates.slice(0, 3).map(p => p.name).join(', ')
                            }{presetCount > 3 ? `, +${presetCount - 3} more` : ''}
                        </div>
                    )}
                </div>

                {onDismiss && (
                    <button 
                        className="lumiverse-update-banner-dismiss"
                        onClick={onDismiss}
                        title="Dismiss"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
        </div>
    );
}

/**
 * Inline update indicator for sidebar toggle
 * Shows a small pulsing dot when updates are available
 */
export function UpdateDot() {
    const { hasAnyUpdate } = useUpdates();
    
    if (!hasAnyUpdate) {
        return null;
    }

    return <span className="lumiverse-update-dot" />;
}

/**
 * Text badge for accordion title
 */
export function UpdateBadge() {
    const { hasAnyUpdate, hasExtensionUpdate, presetUpdates } = useUpdates();
    
    if (!hasAnyUpdate) {
        return null;
    }

    // Show different badge text based on what has updates
    let badgeText = 'New!';
    if (hasExtensionUpdate && presetUpdates.length > 0) {
        badgeText = 'Updates!';
    } else if (presetUpdates.length > 1) {
        badgeText = `${presetUpdates.length} updates`;
    }

    return <span className="lumiverse-update-badge">{badgeText}</span>;
}
