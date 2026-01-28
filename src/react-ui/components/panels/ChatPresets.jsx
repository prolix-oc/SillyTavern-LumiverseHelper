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
    ExternalLink
} from 'lucide-react';
import { 
    fetchAvailablePresets, 
    downloadAndImportPreset,
    configureReasoning,
    setStartReplyWith,
    getReasoningSettings,
    getStartReplyWith,
    REASONING_PRESETS,
    applyReasoningWithBias
} from '../../../lib/presetsService';

/* global toastr */

/**
 * Chat Presets Panel - Trigger component that opens the modal
 * Displays current status and a button to open the full browser
 */
export function ChatPresetsPanel() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [reasoningSettings, setReasoningSettings] = useState(null);
    const [startReplyWith, setStartReplyWithState] = useState('');

    // Load initial settings
    useEffect(() => {
        setReasoningSettings(getReasoningSettings());
        setStartReplyWithState(getStartReplyWith());
    }, []);

    const handleOpenModal = useCallback(() => {
        setIsModalOpen(true);
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        // Refresh settings in case they were changed in modal
        setReasoningSettings(getReasoningSettings());
        setStartReplyWithState(getStartReplyWith());
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
            <div className="lumiverse-presets-trigger">
                <button
                    className="lumiverse-presets-trigger-btn"
                    onClick={handleOpenModal}
                    type="button"
                >
                    <div className="lumiverse-presets-trigger-left">
                        <div className="lumiverse-presets-trigger-icon">
                            <Cloud size={18} strokeWidth={1.5} />
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
                <ChatPresetsModal onClose={handleCloseModal} />
            )}
        </>
    );
}

/**
 * Chat Presets Modal - Full-featured preset browser and reasoning settings
 * Uses createPortal for proper layering and event handling
 */
function ChatPresetsModal({ onClose }) {
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
            } else {
                toastr?.error(result.message, 'Import Failed');
            }
        } catch (err) {
            toastr?.error(err.message, 'Download Failed');
        } finally {
            setDownloadingVersion(null);
        }
    }, []);

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
                                {presets.map((preset, index) => (
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
                                    />
                                ))}
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
                                        className="lumiverse-presets-startreply-btn"
                                        onClick={() => handleStartReplyWithChange('<thinking>\n')}
                                        title="Set to <thinking> tag"
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
 * Individual preset card with expandable version list
 */
function PresetCard({ preset, isExpanded, onToggle, onDownload, downloadingVersion, animationIndex }) {
    // Combine standard and prolix versions
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
        
        return versions;
    }, [preset.versions]);

    // Staggered animation delay via CSS custom property
    const animationStyle = {
        '--card-delay': `${Math.min(animationIndex * 40, 250)}ms`
    };

    return (
        <div 
            className={clsx(
                'lumiverse-preset-card',
                isExpanded && 'is-expanded'
            )}
            style={animationStyle}
        >
            <button
                className="lumiverse-preset-card-header"
                onClick={onToggle}
                type="button"
            >
                <div className="lumiverse-preset-card-icon">
                    <FileJson size={16} strokeWidth={1.5} />
                </div>
                <div className="lumiverse-preset-card-info">
                    <span className="lumiverse-preset-card-name">{preset.name}</span>
                    <span className="lumiverse-preset-card-meta">
                        <Clock size={10} strokeWidth={2} />
                        {preset.totalVersions} version{preset.totalVersions !== 1 ? 's' : ''}
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
            </button>

            {/* Expanded version list - no AnimatePresence to avoid layout thrashing */}
            <div className={clsx(
                'lumiverse-preset-card-versions',
                isExpanded && 'is-expanded'
            )}>
                <div className="lumiverse-preset-card-versions-inner">
                    {allVersions.map((version) => {
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
                                    onClick={() => onDownload(preset.slug, version.slug, version.name)}
                                    disabled={isDownloading}
                                    type="button"
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
                </div>
            </div>
        </div>
    );
}

export default ChatPresetsPanel;
