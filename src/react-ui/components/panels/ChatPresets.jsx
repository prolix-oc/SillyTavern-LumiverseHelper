import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { 
    Download, 
    RefreshCw, 
    Check, 
    X, 
    ChevronDown, 
    ChevronRight,
    Settings2, 
    Brain, 
    Loader2,
    AlertCircle,
    Package,
    Sparkles,
    Zap,
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
 * Chat Presets Panel
 * Downloads and manages Chat Completion presets from Lucid.cards
 * Also provides Reasoning/CoT and Start Reply With settings
 */
export function ChatPresetsPanel() {
    // Preset browser state
    const [presets, setPresets] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedPreset, setExpandedPreset] = useState(null);
    const [downloadingVersion, setDownloadingVersion] = useState(null);

    // Reasoning/CoT state
    const [reasoningExpanded, setReasoningExpanded] = useState(false);
    const [reasoningSettings, setReasoningSettings] = useState(null);
    const [startReplyWith, setStartReplyWithState] = useState('');

    // Load initial reasoning settings
    useEffect(() => {
        setReasoningSettings(getReasoningSettings());
        setStartReplyWithState(getStartReplyWith());
    }, []);

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
        const newSettings = { ...reasoningSettings, [key]: value };
        configureReasoning({ [key]: value });
        setReasoningSettings(newSettings);
    }, [reasoningSettings]);

    return (
        <div className="lumiverse-chatpresets">
            {/* Preset Browser Section */}
            <div className="lumiverse-chatpresets-section">
                <div className="lumiverse-chatpresets-section-header">
                    <div className="lumiverse-chatpresets-section-title">
                        <Download size={16} strokeWidth={1.5} />
                        <span>Download Presets</span>
                    </div>
                    <button
                        className="lumiverse-chatpresets-refresh"
                        onClick={loadPresets}
                        disabled={isLoading}
                        title="Refresh preset list"
                        type="button"
                    >
                        <RefreshCw size={14} strokeWidth={1.5} className={clsx(isLoading && 'lumiverse-spin')} />
                    </button>
                </div>

                {/* Initial state - prompt to load */}
                {!presets && !isLoading && !error && (
                    <div className="lumiverse-chatpresets-empty">
                        <Package size={24} strokeWidth={1} />
                        <span>Click refresh to browse Lucid.cards presets</span>
                    </div>
                )}

                {/* Loading state */}
                {isLoading && (
                    <div className="lumiverse-chatpresets-loading">
                        <Loader2 size={20} strokeWidth={1.5} className="lumiverse-spin" />
                        <span>Loading presets...</span>
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div className="lumiverse-chatpresets-error">
                        <AlertCircle size={16} strokeWidth={1.5} />
                        <span>{error}</span>
                        <button onClick={loadPresets} type="button">Retry</button>
                    </div>
                )}

                {/* Preset list */}
                {presets && presets.length > 0 && (
                    <div className="lumiverse-chatpresets-list">
                        {presets.map((preset) => (
                            <PresetItem
                                key={preset.slug}
                                preset={preset}
                                isExpanded={expandedPreset === preset.slug}
                                onToggle={() => setExpandedPreset(
                                    expandedPreset === preset.slug ? null : preset.slug
                                )}
                                onDownload={handleDownload}
                                downloadingVersion={downloadingVersion}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Reasoning / CoT Section */}
            <div className="lumiverse-chatpresets-section">
                <button
                    className="lumiverse-chatpresets-section-header lumiverse-chatpresets-section-header--clickable"
                    onClick={() => setReasoningExpanded(!reasoningExpanded)}
                    type="button"
                >
                    <div className="lumiverse-chatpresets-section-title">
                        <Brain size={16} strokeWidth={1.5} />
                        <span>Reasoning / Chain of Thought</span>
                    </div>
                    <ChevronDown 
                        size={14} 
                        strokeWidth={1.5} 
                        className={clsx(
                            'lumiverse-chatpresets-chevron',
                            reasoningExpanded && 'lumiverse-chatpresets-chevron--expanded'
                        )}
                    />
                </button>

                <AnimatePresence>
                    {reasoningExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="lumiverse-chatpresets-reasoning"
                        >
                            {/* Quick presets */}
                            <div className="lumiverse-chatpresets-reasoning-presets">
                                <span className="lumiverse-chatpresets-reasoning-label">Quick Presets:</span>
                                <div className="lumiverse-chatpresets-reasoning-buttons">
                                    <button
                                        onClick={() => handleApplyReasoningPreset('deepseek', false)}
                                        title="Apply DeepSeek <think> tags"
                                        type="button"
                                    >
                                        DeepSeek
                                    </button>
                                    <button
                                        onClick={() => handleApplyReasoningPreset('claude_extended', false)}
                                        title="Apply Claude <thinking> tags"
                                        type="button"
                                    >
                                        Claude
                                    </button>
                                    <button
                                        onClick={() => handleApplyReasoningPreset('openai_o1', false)}
                                        title="Apply o1 <reasoning> tags"
                                        type="button"
                                    >
                                        o1
                                    </button>
                                </div>
                            </div>

                            {/* Current settings display */}
                            {reasoningSettings && (
                                <div className="lumiverse-chatpresets-reasoning-current">
                                    <div className="lumiverse-chatpresets-reasoning-row">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={reasoningSettings.auto_parse || false}
                                                onChange={(e) => handleReasoningToggle('autoParse', e.target.checked)}
                                            />
                                            <span>Auto-parse thoughts</span>
                                        </label>
                                    </div>
                                    <div className="lumiverse-chatpresets-reasoning-row">
                                        <span className="lumiverse-chatpresets-reasoning-tags">
                                            Tags: <code>{reasoningSettings.prefix || '<think>'}</code> / <code>{reasoningSettings.suffix || '</think>'}</code>
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Start Reply With */}
                            <div className="lumiverse-chatpresets-startreply">
                                <label className="lumiverse-chatpresets-startreply-label">
                                    <Zap size={14} strokeWidth={1.5} />
                                    <span>Start Reply With:</span>
                                </label>
                                <textarea
                                    className="lumiverse-chatpresets-startreply-input"
                                    value={startReplyWith}
                                    onChange={(e) => handleStartReplyWithChange(e.target.value)}
                                    placeholder="Force AI to start response with..."
                                    rows={2}
                                />
                                <div className="lumiverse-chatpresets-startreply-quick">
                                    <button
                                        onClick={() => handleStartReplyWithChange('<think>\n')}
                                        title="Set to <think> tag"
                                        type="button"
                                    >
                                        &lt;think&gt;
                                    </button>
                                    <button
                                        onClick={() => handleStartReplyWithChange('<thinking>\n')}
                                        title="Set to <thinking> tag"
                                        type="button"
                                    >
                                        &lt;thinking&gt;
                                    </button>
                                    <button
                                        onClick={() => handleStartReplyWithChange('')}
                                        title="Clear"
                                        type="button"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

/**
 * Individual preset item with expandable version list
 */
function PresetItem({ preset, isExpanded, onToggle, onDownload, downloadingVersion }) {
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

    return (
        <div className={clsx(
            'lumiverse-chatpresets-item',
            isExpanded && 'lumiverse-chatpresets-item--expanded'
        )}>
            <button
                className="lumiverse-chatpresets-item-header"
                onClick={onToggle}
                type="button"
            >
                <div className="lumiverse-chatpresets-item-info">
                    <span className="lumiverse-chatpresets-item-name">{preset.name}</span>
                    <span className="lumiverse-chatpresets-item-meta">
                        {preset.totalVersions} version{preset.totalVersions !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="lumiverse-chatpresets-item-actions">
                    {/* Quick download latest */}
                    <button
                        className="lumiverse-chatpresets-item-quick"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDownload(preset.slug, 'latest', preset.latestVersion?.name);
                        }}
                        disabled={downloadingVersion === `${preset.slug}-latest`}
                        title="Download latest version"
                        type="button"
                    >
                        {downloadingVersion === `${preset.slug}-latest` ? (
                            <Loader2 size={14} className="lumiverse-spin" />
                        ) : (
                            <Download size={14} strokeWidth={1.5} />
                        )}
                    </button>
                    <ChevronRight 
                        size={14} 
                        strokeWidth={1.5}
                        className={clsx(
                            'lumiverse-chatpresets-item-chevron',
                            isExpanded && 'lumiverse-chatpresets-item-chevron--expanded'
                        )}
                    />
                </div>
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="lumiverse-chatpresets-item-versions"
                    >
                        {allVersions.map((version) => {
                            const versionKey = `${preset.slug}-${version.slug}`;
                            const isDownloading = downloadingVersion === versionKey;

                            return (
                                <div 
                                    key={version.slug}
                                    className={clsx(
                                        'lumiverse-chatpresets-version',
                                        version.isProlix && 'lumiverse-chatpresets-version--prolix',
                                        version.isLatest && 'lumiverse-chatpresets-version--latest'
                                    )}
                                >
                                    <div className="lumiverse-chatpresets-version-info">
                                        <span className="lumiverse-chatpresets-version-name">
                                            {version.name}
                                            {version.isLatest && (
                                                <span className="lumiverse-chatpresets-version-badge">Latest</span>
                                            )}
                                            {version.isProlix && (
                                                <span className="lumiverse-chatpresets-version-badge lumiverse-chatpresets-version-badge--prolix">
                                                    Prolix
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <button
                                        className="lumiverse-chatpresets-version-download"
                                        onClick={() => onDownload(preset.slug, version.slug, version.name)}
                                        disabled={isDownloading}
                                        type="button"
                                    >
                                        {isDownloading ? (
                                            <Loader2 size={12} className="lumiverse-spin" />
                                        ) : (
                                            <Download size={12} strokeWidth={1.5} />
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default ChatPresetsPanel;
