import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { 
    Download, 
    RefreshCw, 
    Check, 
    X, 
    ChevronDown, 
    ChevronRight,
    Brain, 
    Loader2,
    AlertCircle,
    Package,
    Sparkles,
    Zap,
    FileJson,
    Cloud,
    Tag,
    Clock,
    Settings2,
    ExternalLink,
    Bell,
    ArrowUpCircle
} from 'lucide-react';
import { 
    fetchAvailablePresets, 
    downloadAndImportPreset,
    configureReasoning,
    setStartReplyWith,
    getReasoningSettings,
    getStartReplyWith,
    REASONING_PRESETS,
    applyReasoningWithBias,
    checkForPresetUpdates,
    getTrackedPresets,
    formatVersion
} from '../../../lib/presetsService';

/* global toastr */

// Check for updates every 30 minutes
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;

/**
 * Chat Presets Panel - Trigger component that opens the modal
 * Displays current status, update notifications, and a button to open the full browser
 */
export function ChatPresetsPanel() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [reasoningSettings, setReasoningSettings] = useState(null);
    const [startReplyWith, setStartReplyWithState] = useState('');
    const [availableUpdates, setAvailableUpdates] = useState([]);
    const updateCheckRef = useRef(null);

    // Load initial settings and check for updates
    useEffect(() => {
        setReasoningSettings(getReasoningSettings());
        setStartReplyWithState(getStartReplyWith());
        
        // Initial update check (delayed to not block UI)
        const initialCheck = setTimeout(() => {
            checkForPresetUpdates().then(setAvailableUpdates);
        }, 5000);
        
        // Periodic update checks
        updateCheckRef.current = setInterval(() => {
            checkForPresetUpdates().then(setAvailableUpdates);
        }, UPDATE_CHECK_INTERVAL);
        
        return () => {
            clearTimeout(initialCheck);
            if (updateCheckRef.current) {
                clearInterval(updateCheckRef.current);
            }
        };
    }, []);

    const handleOpenModal = useCallback(() => {
        setIsModalOpen(true);
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        // Refresh settings in case they were changed in modal
        setReasoningSettings(getReasoningSettings());
        setStartReplyWithState(getStartReplyWith());
        // Re-check for updates after modal closes (in case user updated a preset)
        checkForPresetUpdates().then(setAvailableUpdates);
    }, []);

    // Dismiss a specific update notification
    const handleDismissUpdate = useCallback((slug) => {
        setAvailableUpdates(prev => prev.filter(u => u.slug !== slug));
    }, []);

    // Get current status text
    const statusText = useMemo(() => {
        const parts = [];
        if (reasoningSettings?.auto_parse) {
            parts.push(`CoT: ${reasoningSettings.prefix || '<think>'}`);
        }
        if (startReplyWith) {
            const preview = startReplyWith.slice(0, 15).replace(/\n/g, '↵');
            parts.push(`Bias: "${preview}${startReplyWith.length > 15 ? '…' : ''}"`);
        }
        return parts.length > 0 ? parts.join(' • ') : 'Click to configure presets & reasoning';
    }, [reasoningSettings, startReplyWith]);

    return (
        <>
            {/* Update notification banners */}
            {availableUpdates.length > 0 && (
                <div className="lumiverse-presets-updates">
                    {availableUpdates.map((update) => (
                        <div key={update.slug} className="lumiverse-presets-update-banner">
                            <div className="lumiverse-presets-update-icon">
                                <ArrowUpCircle size={14} strokeWidth={2} />
                            </div>
                            <div className="lumiverse-presets-update-text">
                                <span className="lumiverse-presets-update-title">
                                    Update available for "{update.name}"
                                </span>
                                <span className="lumiverse-presets-update-version">
                                    {formatVersion(update.currentVersion)} → {update.latestVersionName}
                                </span>
                            </div>
                            <div className="lumiverse-presets-update-actions">
                                <button
                                    className="lumiverse-presets-update-btn"
                                    onClick={handleOpenModal}
                                    title="Open presets to update"
                                    type="button"
                                >
                                    Update
                                </button>
                                <button
                                    className="lumiverse-presets-update-dismiss"
                                    onClick={() => handleDismissUpdate(update.slug)}
                                    title="Dismiss"
                                    type="button"
                                >
                                    <X size={12} strokeWidth={2} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="lumiverse-presets-trigger">
                <button
                    className="lumiverse-presets-trigger-btn"
                    onClick={handleOpenModal}
                    type="button"
                >
                    <div className="lumiverse-presets-trigger-left">
                        <div className={clsx(
                            'lumiverse-presets-trigger-icon',
                            availableUpdates.length > 0 && 'has-updates'
                        )}>
                            <Cloud size={18} strokeWidth={1.5} />
                            {availableUpdates.length > 0 && (
                                <span className="lumiverse-presets-trigger-badge">
                                    {availableUpdates.length}
                                </span>
                            )}
                        </div>
                        <div className="lumiverse-presets-trigger-text">
                            <span className="lumiverse-presets-trigger-title">Chat Presets & Reasoning</span>
                            <span className="lumiverse-presets-trigger-status">{statusText}</span>
                        </div>
                    </div>
                    <ExternalLink size={14} strokeWidth={2} className="lumiverse-presets-trigger-arrow" />
                </button>
            </div>

            {isModalOpen && (
                <ChatPresetsModal 
                    onClose={handleCloseModal} 
                    availableUpdates={availableUpdates}
                    onUpdateComplete={() => checkForPresetUpdates().then(setAvailableUpdates)}
                />
            )}
        </>
    );
}

/**
 * Chat Presets Modal - Full-featured preset browser and reasoning settings
 * Uses createPortal for proper layering and event handling
 */
function ChatPresetsModal({ onClose, availableUpdates = [], onUpdateComplete }) {
    // Preset browser state
    const [presets, setPresets] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedPreset, setExpandedPreset] = useState(null);
    const [downloadingVersion, setDownloadingVersion] = useState(null);

    // Reasoning/CoT state
    const [reasoningSettings, setReasoningSettings] = useState(null);
    const [startReplyWith, setStartReplyWithState] = useState('');

    // Refs for avoiding layout thrashing
    const modalRef = useRef(null);
    const scrollContainerRef = useRef(null);

    // Load initial reasoning settings
    useEffect(() => {
        setReasoningSettings(getReasoningSettings());
        setStartReplyWithState(getStartReplyWith());
    }, []);

    // Handle escape key and body scroll lock
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    // Fetch presets from API
    const loadPresets = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchAvailablePresets();
            setPresets(data.presets || []);
        } catch (err) {
            setError(err.message);
            console.error('[ChatPresets] Failed to load:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Download and import a preset version
    const handleDownload = useCallback(async (presetSlug, versionSlug, versionName) => {
        setDownloadingVersion(`${presetSlug}-${versionSlug}`);
        try {
            const result = await downloadAndImportPreset(presetSlug, versionSlug, { activate: true });
            if (result.success) {
                toastr?.success(`Imported: ${versionName || versionSlug}`, 'Preset Added');
                // Notify parent to refresh update list (new version is now tracked)
                onUpdateComplete?.();
            } else {
                toastr?.error(result.message, 'Import Failed');
            }
        } catch (err) {
            toastr?.error(err.message, 'Download Failed');
        } finally {
            setDownloadingVersion(null);
        }
    }, [onUpdateComplete]);

    // Apply a reasoning preset with optional bias
    const handleApplyReasoningPreset = useCallback((presetKey, withBias = false) => {
        const preset = REASONING_PRESETS[presetKey];
        if (!preset) return;

        if (withBias) {
            applyReasoningWithBias(presetKey);
        } else {
            configureReasoning(preset);
        }

        setReasoningSettings(getReasoningSettings());
        setStartReplyWithState(getStartReplyWith());
        toastr?.success(`Applied ${presetKey} reasoning settings`, 'Reasoning Updated');
    }, []);

    // Handle Start Reply With change
    const handleStartReplyWithChange = useCallback((text) => {
        setStartReplyWithState(text);
        setStartReplyWith(text);
    }, []);

    // Toggle individual reasoning setting
    const handleReasoningToggle = useCallback((key, value) => {
        configureReasoning({ [key]: value });
        setReasoningSettings(getReasoningSettings());
    }, []);

    // Handle backdrop click
    const handleBackdropClick = useCallback((e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    // Stop propagation to prevent ST from closing the drawer
    const handleModalClick = useCallback((e) => {
        e.stopPropagation();
    }, []);

    return createPortal(
        <div
            className="lumia-modal-backdrop"
            onClick={handleBackdropClick}
            onMouseDown={handleModalClick}
            onMouseUp={handleModalClick}
        >
            <div
                ref={modalRef}
                className="lumia-modal lumiverse-presets-modal"
                onClick={handleModalClick}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="lumiverse-presets-modal-header">
                    <div className="lumiverse-presets-modal-header-info">
                        <span className="lumiverse-presets-modal-header-icon">
                            <Cloud size={22} strokeWidth={1.5} />
                        </span>
                        <div className="lumiverse-presets-modal-header-text">
                            <h3 className="lumiverse-presets-modal-title">Chat Presets</h3>
                            <p className="lumiverse-presets-modal-subtitle">
                                Download presets from Lucid.cards & configure reasoning
                            </p>
                        </div>
                    </div>
                    <button
                        className="lumiverse-presets-modal-close"
                        onClick={onClose}
                        title="Close"
                        type="button"
                    >
                        <X size={18} strokeWidth={2} />
                    </button>
                </div>

                {/* Content */}
                <div className="lumiverse-presets-modal-content" ref={scrollContainerRef}>
                    {/* Preset Browser Section */}
                    <div className="lumiverse-presets-section">
                        <div className="lumiverse-presets-section-header">
                            <div className="lumiverse-presets-section-title">
                                <Download size={14} strokeWidth={2} />
                                <span>Download Presets</span>
                            </div>
                            <button
                                className={clsx(
                                    'lumiverse-presets-refresh',
                                    isLoading && 'is-loading'
                                )}
                                onClick={loadPresets}
                                disabled={isLoading}
                                title="Refresh preset list"
                                type="button"
                            >
                                <RefreshCw size={14} strokeWidth={2} />
                            </button>
                        </div>

                        {/* Initial state - prompt to load */}
                        {!presets && !isLoading && !error && (
                            <div className="lumiverse-presets-empty">
                                <div className="lumiverse-presets-empty-icon">
                                    <Package size={28} strokeWidth={1} />
                                </div>
                                <span className="lumiverse-presets-empty-text">
                                    Browse curated Chat Completion presets
                                </span>
                                <button 
                                    className="lumiverse-presets-empty-btn"
                                    onClick={loadPresets}
                                    type="button"
                                >
                                    <RefreshCw size={14} strokeWidth={2} />
                                    Load Presets
                                </button>
                            </div>
                        )}

                        {/* Loading state */}
                        {isLoading && (
                            <div className="lumiverse-presets-loading">
                                <div className="lumiverse-presets-loading-spinner">
                                    <Loader2 size={22} strokeWidth={1.5} />
                                </div>
                                <span>Fetching presets...</span>
                            </div>
                        )}

                        {/* Error state */}
                        {error && (
                            <div className="lumiverse-presets-error">
                                <AlertCircle size={16} strokeWidth={1.5} />
                                <span>{error}</span>
                                <button onClick={loadPresets} type="button">Retry</button>
                            </div>
                        )}

                        {/* Preset list */}
                        {presets && presets.length > 0 && (
                            <div className="lumiverse-presets-list">
                                {presets.map((preset, index) => {
                                    const updateInfo = availableUpdates.find(u => u.slug === preset.slug);
                                    return (
                                        <PresetCard
                                            key={preset.slug}
                                            preset={preset}
                                            isExpanded={expandedPreset === preset.slug}
                                            onToggle={() => setExpandedPreset(
                                                expandedPreset === preset.slug ? null : preset.slug
                                            )}
                                            onDownload={handleDownload}
                                            downloadingVersion={downloadingVersion}
                                            animationIndex={index}
                                            updateAvailable={updateInfo}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Reasoning / CoT Section */}
                    <div className="lumiverse-presets-section">
                        <div className="lumiverse-presets-section-header">
                            <div className="lumiverse-presets-section-title">
                                <Brain size={14} strokeWidth={2} />
                                <span>Reasoning / Chain of Thought</span>
                            </div>
                        </div>

                        <div className="lumiverse-presets-reasoning">
                            {/* Quick presets */}
                            <div className="lumiverse-presets-reasoning-quick">
                                <span className="lumiverse-presets-reasoning-label">
                                    <Sparkles size={12} strokeWidth={2} />
                                    Quick Presets
                                </span>
                                <div className="lumiverse-presets-reasoning-btns">
                                    <button
                                        className="lumiverse-presets-reasoning-btn lumiverse-presets-reasoning-btn--deepseek"
                                        onClick={() => handleApplyReasoningPreset('deepseek', false)}
                                        title="Apply DeepSeek <think> tags"
                                        type="button"
                                    >
                                        <span className="lumiverse-presets-reasoning-btn-label">DeepSeek</span>
                                        <code>&lt;think&gt;</code>
                                    </button>
                                    <button
                                        className="lumiverse-presets-reasoning-btn lumiverse-presets-reasoning-btn--claude"
                                        onClick={() => handleApplyReasoningPreset('claude_extended', false)}
                                        title="Apply Claude <thinking> tags"
                                        type="button"
                                    >
                                        <span className="lumiverse-presets-reasoning-btn-label">Claude</span>
                                        <code>&lt;thinking&gt;</code>
                                    </button>
                                    <button
                                        className="lumiverse-presets-reasoning-btn lumiverse-presets-reasoning-btn--o1"
                                        onClick={() => handleApplyReasoningPreset('openai_o1', false)}
                                        title="Apply o1 <reasoning> tags"
                                        type="button"
                                    >
                                        <span className="lumiverse-presets-reasoning-btn-label">o1</span>
                                        <code>&lt;reasoning&gt;</code>
                                    </button>
                                </div>
                            </div>

                            {/* Current settings display */}
                            {reasoningSettings && (
                                <div className="lumiverse-presets-reasoning-current">
                                    <div className="lumiverse-presets-reasoning-row">
                                        <label className="lumiverse-presets-reasoning-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={reasoningSettings.auto_parse || false}
                                                onChange={(e) => handleReasoningToggle('autoParse', e.target.checked)}
                                            />
                                            <span className="lumiverse-presets-reasoning-checkmark"></span>
                                            <span>Auto-parse thoughts</span>
                                        </label>
                                    </div>
                                    <div className="lumiverse-presets-reasoning-tags">
                                        <Tag size={12} strokeWidth={2} />
                                        <span>Tags:</span>
                                        <code>{reasoningSettings.prefix || '<think>'}</code>
                                        <span className="lumiverse-presets-reasoning-tags-sep">/</span>
                                        <code>{reasoningSettings.suffix || '</think>'}</code>
                                    </div>
                                </div>
                            )}

                            {/* Start Reply With */}
                            <div className="lumiverse-presets-startreply">
                                <label className="lumiverse-presets-startreply-label">
                                    <Zap size={12} strokeWidth={2} />
                                    <span>Start Reply With (Prompt Bias)</span>
                                </label>
                                <div className="lumiverse-presets-startreply-input-wrap">
                                    <textarea
                                        className="lumiverse-presets-startreply-input"
                                        value={startReplyWith}
                                        onChange={(e) => handleStartReplyWithChange(e.target.value)}
                                        placeholder="Force AI to start response with..."
                                        rows={2}
                                    />
                                </div>
                                <div className="lumiverse-presets-startreply-quick">
                                    <button
                                        className="lumiverse-presets-startreply-btn"
                                        onClick={() => handleStartReplyWithChange('<think>\n')}
                                        title="Set to <think> tag"
                                        type="button"
                                    >
                                        &lt;think&gt;
                                    </button>
                                    <button
                                        className="lumiverse-presets-startreply-btn lumiverse-presets-startreply-btn--claude"
                                        onClick={() => handleStartReplyWithChange('<thinking>')}
                                        title="Set to <thinking> tag (Claude, no newline)"
                                        type="button"
                                    >
                                        &lt;thinking&gt;
                                    </button>
                                    <button
                                        className="lumiverse-presets-startreply-btn lumiverse-presets-startreply-btn--clear"
                                        onClick={() => handleStartReplyWithChange('')}
                                        title="Clear"
                                        type="button"
                                    >
                                        <X size={12} strokeWidth={2} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="lumiverse-presets-modal-footer">
                    <button
                        className="lumiverse-presets-modal-btn lumiverse-presets-modal-btn--primary"
                        onClick={onClose}
                        type="button"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

/**
 * Maximum versions shown before pagination kicks in
 */
const MAX_VISIBLE_VERSIONS = 3;

/**
 * Individual preset card - unified clickable container with paginated version list
 */
function PresetCard({ preset, isExpanded, onToggle, onDownload, downloadingVersion, animationIndex, updateAvailable }) {
    const [showAllVersions, setShowAllVersions] = useState(false);
    
    // Combine standard and prolix versions, sorted by latest first
    const allVersions = useMemo(() => {
        const versions = [];
        
        if (preset.versions?.standard) {
            preset.versions.standard.forEach((v) => {
                versions.push({ ...v, isProlix: false });
            });
        }
        
        if (preset.versions?.prolix) {
            preset.versions.prolix.forEach((v) => {
                versions.push({ ...v, isProlix: true });
            });
        }
        
        // Sort: latest first, then by name descending (semantic version order)
        return versions.sort((a, b) => {
            if (a.isLatest && !b.isLatest) return -1;
            if (!a.isLatest && b.isLatest) return 1;
            return b.name.localeCompare(a.name, undefined, { numeric: true });
        });
    }, [preset.versions]);
    
    // Paginated versions for accessibility
    const visibleVersions = useMemo(() => {
        if (showAllVersions || allVersions.length <= MAX_VISIBLE_VERSIONS) {
            return allVersions;
        }
        return allVersions.slice(0, MAX_VISIBLE_VERSIONS);
    }, [allVersions, showAllVersions]);
    
    const hiddenCount = allVersions.length - MAX_VISIBLE_VERSIONS;
    const hasMore = hiddenCount > 0 && !showAllVersions;

    // Staggered animation delay via CSS custom property
    const animationStyle = {
        '--card-delay': `${Math.min(animationIndex * 40, 250)}ms`
    };
    
    // Reset pagination when collapsing
    useEffect(() => {
        if (!isExpanded) {
            setShowAllVersions(false);
        }
    }, [isExpanded]);
    
    // Handle card click - toggle expansion
    const handleCardClick = useCallback((e) => {
        // Don't toggle if clicking on interactive elements
        if (e.target.closest('button')) return;
        onToggle();
    }, [onToggle]);
    
    // Handle keyboard navigation
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
        }
    }, [onToggle]);

    return (
        <div 
            className={clsx(
                'lumiverse-preset-card',
                isExpanded && 'is-expanded',
                updateAvailable && 'has-update'
            )}
            style={animationStyle}
            onClick={handleCardClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            aria-label={`${preset.name} preset${updateAvailable ? ' - update available' : ''}`}
        >
            <div className="lumiverse-preset-card-header">
                <div className={clsx(
                    'lumiverse-preset-card-icon',
                    updateAvailable && 'has-update'
                )}>
                    {updateAvailable ? (
                        <ArrowUpCircle size={16} strokeWidth={1.5} />
                    ) : (
                        <FileJson size={16} strokeWidth={1.5} />
                    )}
                </div>
                <div className="lumiverse-preset-card-info">
                    <span className="lumiverse-preset-card-name">
                        {preset.name}
                        {updateAvailable && (
                            <span className="lumiverse-preset-card-update-badge">Update</span>
                        )}
                    </span>
                    <span className="lumiverse-preset-card-meta">
                        {updateAvailable ? (
                            <>
                                <ArrowUpCircle size={10} strokeWidth={2} />
                                {formatVersion(updateAvailable.currentVersion)} → {updateAvailable.latestVersionName}
                            </>
                        ) : (
                            <>
                                <Clock size={10} strokeWidth={2} />
                                {preset.totalVersions} version{preset.totalVersions !== 1 ? 's' : ''}
                            </>
                        )}
                    </span>
                </div>
                <div className="lumiverse-preset-card-actions">
                    {/* Quick download latest */}
                    <button
                        className="lumiverse-preset-card-download"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDownload(preset.slug, 'latest', preset.latestVersion?.name);
                        }}
                        disabled={downloadingVersion === `${preset.slug}-latest`}
                        title="Download latest version"
                        type="button"
                    >
                        {downloadingVersion === `${preset.slug}-latest` ? (
                            <Loader2 size={14} strokeWidth={2} className="lumiverse-spin" />
                        ) : (
                            <Download size={14} strokeWidth={2} />
                        )}
                    </button>
                    <ChevronRight 
                        size={14} 
                        strokeWidth={2}
                        className="lumiverse-preset-card-chevron"
                    />
                </div>
            </div>

            {/* Expanded version list - CSS grid collapse for smooth animation */}
            <div 
                className={clsx(
                    'lumiverse-preset-card-versions',
                    isExpanded && 'is-expanded'
                )}
                role="region"
                aria-label={`${preset.name} versions`}
            >
                <div className="lumiverse-preset-card-versions-inner">
                    {visibleVersions.map((version) => {
                        const versionKey = `${preset.slug}-${version.slug}`;
                        const isDownloading = downloadingVersion === versionKey;

                        return (
                            <div 
                                key={version.slug}
                                className={clsx(
                                    'lumiverse-preset-version',
                                    version.isProlix && 'is-prolix',
                                    version.isLatest && 'is-latest'
                                )}
                            >
                                <div className="lumiverse-preset-version-info">
                                    <span className="lumiverse-preset-version-name">
                                        {version.name}
                                    </span>
                                    <div className="lumiverse-preset-version-badges">
                                        {version.isLatest && (
                                            <span className="lumiverse-preset-version-badge is-latest">
                                                Latest
                                            </span>
                                        )}
                                        {version.isProlix && (
                                            <span className="lumiverse-preset-version-badge is-prolix">
                                                Prolix
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    className="lumiverse-preset-version-download"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDownload(preset.slug, version.slug, version.name);
                                    }}
                                    disabled={isDownloading}
                                    type="button"
                                    aria-label={`Download ${version.name}`}
                                >
                                    {isDownloading ? (
                                        <Loader2 size={12} strokeWidth={2} className="lumiverse-spin" />
                                    ) : (
                                        <>
                                            <Download size={12} strokeWidth={2} />
                                            <span>Add</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                    
                    {/* Show more button for pagination */}
                    {hasMore && (
                        <button
                            className="lumiverse-preset-versions-showmore"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowAllVersions(true);
                            }}
                            type="button"
                        >
                            <ChevronDown size={12} strokeWidth={2} />
                            <span>Show {hiddenCount} more version{hiddenCount !== 1 ? 's' : ''}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ChatPresetsPanel;
