import React, { useState, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { CollapsibleContent } from '../Collapsible';
import clsx from 'clsx';
import {
    FileText, Check, AlertCircle, Trash2, Save, RefreshCw,
    Settings, Clock, Cloud, Cpu, ChevronDown, Play, MessageSquare, Scissors, RefreshCcw
} from 'lucide-react';
import { useLumiverseStore, saveToExtension } from '../../store/LumiverseContext';
import { motion, AnimatePresence } from 'motion/react';

/* global LumiverseBridge, SillyTavern */

// Get the store for direct access
const store = useLumiverseStore;

const LOOM_SUMMARY_KEY = 'loom_summary';

const PLACEHOLDER_TEXT = `Write or paste your Loom summary here...

Use the structured format:
**Completed Objectives**
- ...

**Focused Objectives**
- ...

**Foreshadowing Beats**
- ...

**Character States**
- ...

**World State**
- ...

**Tone & Atmosphere**
- ...

**Threads to Weave**
- ...`;

// Provider configurations matching old code
const PROVIDER_CONFIG = {
    openai: { name: 'OpenAI', placeholder: 'gpt-4o-mini' },
    anthropic: { name: 'Anthropic', placeholder: 'claude-3-haiku-20240307' },
    google: { name: 'Google AI', placeholder: 'gemini-1.5-flash' },
    openrouter: { name: 'OpenRouter', placeholder: 'openai/gpt-4o-mini' },
    custom: { name: 'Custom', placeholder: 'your-model-name' },
};

/**
 * Collapsible section component - uses CSS grid for smooth, performant animation
 */
function CollapsibleSection({ Icon, title, children, defaultOpen = false, status }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={clsx('lumiverse-vp-collapsible', isOpen && 'lumiverse-vp-collapsible--open')}>
            <button
                className="lumiverse-vp-collapsible-header"
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span className={clsx('lumiverse-vp-collapsible-chevron', isOpen && 'lumiverse-vp-collapsible-chevron--open')}>
                    <ChevronDown size={14} strokeWidth={2} />
                </span>
                <span className="lumiverse-vp-collapsible-icon">
                    <Icon size={16} strokeWidth={1.5} />
                </span>
                <span className="lumiverse-vp-collapsible-title">{title}</span>
                {status !== undefined && (
                    <span className={clsx('lumiverse-vp-collapsible-status', status && 'lumiverse-vp-collapsible-status--active')}>
                        {status ? 'Active' : 'Off'}
                    </span>
                )}
            </button>
            <CollapsibleContent
                isOpen={isOpen}
                className="lumiverse-vp-collapsible-content"
                duration={200}
            >
                <div className="lumiverse-vp-collapsible-inner">
                    {children}
                </div>
            </CollapsibleContent>
        </div>
    );
}

/**
 * Toggle switch component
 */
function Toggle({ id, checked, onChange, label, hint }) {
    return (
        <div className="lumiverse-vp-toggle-row">
            <label className="lumiverse-vp-toggle-label" htmlFor={id}>
                <span className="lumiverse-vp-toggle-text">{label}</span>
                {hint && <span className="lumiverse-vp-toggle-hint">{hint}</span>}
            </label>
            <div className="lumiverse-vp-toggle-switch-wrapper">
                <input
                    type="checkbox"
                    id={id}
                    className="lumiverse-vp-toggle-input"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <label htmlFor={id} className="lumiverse-vp-toggle-switch-label">
                    <div className={clsx('lumiverse-vp-toggle-track', checked && 'lumiverse-vp-toggle-track--on')}>
                        <div className="lumiverse-vp-toggle-thumb" />
                    </div>
                </label>
            </div>
        </div>
    );
}

/**
 * Radio option component
 */
function RadioOption({ name, value, checked, onChange, label }) {
    return (
        <label className={clsx('lumiverse-vp-radio-option', checked && 'lumiverse-vp-radio-option--selected')}>
            <input
                type="radio"
                name={name}
                value={value}
                checked={checked}
                onChange={() => onChange(value)}
            />
            <span className="lumiverse-vp-radio-option-label">{label}</span>
        </label>
    );
}

/**
 * Number field component
 */
function NumberField({ id, label, hint, value, onChange, min, max, step = 1 }) {
    return (
        <div className="lumiverse-vp-field">
            <label className="lumiverse-vp-field-label" htmlFor={id}>{label}</label>
            <input
                type="number"
                id={id}
                className="lumiverse-vp-field-input lumiverse-vp-field-input--small"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                min={min}
                max={max}
                step={step}
            />
            {hint && <span className="lumiverse-vp-field-hint">{hint}</span>}
        </div>
    );
}

/**
 * Text field component
 */
function TextField({ id, label, hint, value, onChange, placeholder, type = 'text' }) {
    return (
        <div className="lumiverse-vp-field">
            <label className="lumiverse-vp-field-label" htmlFor={id}>{label}</label>
            <input
                type={type}
                id={id}
                className="lumiverse-vp-field-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
            {hint && <span className="lumiverse-vp-field-hint">{hint}</span>}
        </div>
    );
}

/**
 * Select field component
 */
function SelectField({ id, label, hint, value, onChange, options }) {
    return (
        <div className="lumiverse-vp-field">
            <label className="lumiverse-vp-field-label" htmlFor={id}>{label}</label>
            <select
                id={id}
                className="lumiverse-vp-field-select"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            {hint && <span className="lumiverse-vp-field-hint">{hint}</span>}
        </div>
    );
}

/**
 * Status indicator component
 */
function StatusIndicator({ hasContent, hasChat }) {
    if (!hasChat) {
        return (
            <div className="lumiverse-vp-summary-status lumiverse-vp-summary-status--no-chat">
                <AlertCircle size={16} strokeWidth={2} />
                <span>No active chat</span>
            </div>
        );
    }

    if (hasContent) {
        return (
            <div className="lumiverse-vp-summary-status lumiverse-vp-summary-status--exists">
                <Check size={16} strokeWidth={2} />
                <span>Summary exists for this chat</span>
            </div>
        );
    }

    return (
        <div className="lumiverse-vp-summary-status lumiverse-vp-summary-status--empty">
            <AlertCircle size={16} strokeWidth={2} />
            <span>No summary yet</span>
        </div>
    );
}

/**
 * Action button component
 */
function ActionButton({ Icon, label, onClick, disabled, variant = 'secondary', loading = false, iconOnly = false }) {
    return (
        <motion.button
            className={clsx(
                'lumiverse-vp-action-btn',
                `lumiverse-vp-action-btn--${variant}`,
                disabled && 'lumiverse-vp-action-btn--disabled',
                iconOnly && 'lumiverse-vp-action-btn--icon-only'
            )}
            onClick={onClick}
            disabled={disabled || loading}
            whileHover={disabled ? {} : { scale: 1.05 }}
            whileTap={disabled ? {} : { scale: 0.95 }}
            type="button"
            title={label}
        >
            {loading ? (
                <span className="lumiverse-vp-action-btn-spinner" />
            ) : (
                <Icon size={iconOnly ? 16 : 14} strokeWidth={2} />
            )}
            {!iconOnly && <span>{label}</span>}
        </motion.button>
    );
}

/**
 * Summarization Config Section
 */
function SummarizationConfig() {
    // Get summarization settings from store
    const summarization = useSyncExternalStore(
        store.subscribe,
        () => store.getState().summarization || {},
        () => store.getState().summarization || {}
    );
    const messageTruncation = useSyncExternalStore(
        store.subscribe,
        () => store.getState().messageTruncation || { enabled: false, keepCount: 50 },
        () => store.getState().messageTruncation || { enabled: false, keepCount: 50 }
    );

    const mode = summarization.mode || 'disabled';
    const apiSource = summarization.apiSource || 'main';
    const autoInterval = summarization.autoInterval || 10;
    const autoMessageContext = summarization.autoMessageContext || 10;
    const manualMessageContext = summarization.manualMessageContext || 10;
    const secondary = summarization.secondary || {};

    const updateSummarization = useCallback((updates) => {
        const current = store.getState().summarization || {};
        store.setState({
            summarization: { ...current, ...updates }
        });
        saveToExtension();
    }, []);

    const updateSecondary = useCallback((updates) => {
        const current = store.getState().summarization || {};
        const currentSecondary = current.secondary || {};
        store.setState({
            summarization: {
                ...current,
                secondary: { ...currentSecondary, ...updates }
            }
        });
        saveToExtension();
    }, []);

    const updateTruncation = useCallback((updates) => {
        const current = store.getState().messageTruncation || {};
        store.setState({
            messageTruncation: { ...current, ...updates }
        });
        saveToExtension();
    }, []);

    const providerOptions = Object.entries(PROVIDER_CONFIG).map(([key, config]) => ({
        value: key,
        label: config.name
    }));

    return (
        <div className="lumiverse-vp-summary-config">
            {/* Mode Selection */}
            <CollapsibleSection
                Icon={Settings}
                title="Summarization Mode"
                status={mode !== 'disabled'}
                defaultOpen={true}
            >
                <div className="lumiverse-vp-radio-group">
                    <RadioOption
                        name="sum-mode"
                        value="disabled"
                        checked={mode === 'disabled'}
                        onChange={(v) => updateSummarization({ mode: v })}
                        label="Disabled"
                    />
                    <RadioOption
                        name="sum-mode"
                        value="auto"
                        checked={mode === 'auto'}
                        onChange={(v) => updateSummarization({ mode: v })}
                        label="Automatic"
                    />
                    <RadioOption
                        name="sum-mode"
                        value="manual"
                        checked={mode === 'manual'}
                        onChange={(v) => updateSummarization({ mode: v })}
                        label="Manual"
                    />
                </div>
                <p className="lumiverse-vp-settings-desc">
                    {mode === 'disabled' && 'Summarization is turned off.'}
                    {mode === 'auto' && 'Summaries are generated automatically at set intervals.'}
                    {mode === 'manual' && 'Use /loom-summarize command to generate summaries.'}
                </p>
            </CollapsibleSection>

            {/* Auto Settings - uses CSS grid for smooth animation */}
            <CollapsibleContent isOpen={mode === 'auto'} duration={200}>
                <CollapsibleSection Icon={Clock} title="Auto Settings" defaultOpen={true}>
                    <div className="lumiverse-vp-field-row">
                        <NumberField
                            id="sum-interval"
                            label="Interval"
                            hint="Every N messages"
                            value={autoInterval}
                            onChange={(v) => updateSummarization({ autoInterval: v })}
                            min={1}
                        />
                        <NumberField
                            id="sum-auto-context"
                            label="Context"
                            hint="Messages to include"
                            value={autoMessageContext}
                            onChange={(v) => updateSummarization({ autoMessageContext: v })}
                            min={1}
                            max={100}
                        />
                    </div>
                </CollapsibleSection>
            </CollapsibleContent>

            {/* Manual Context - uses CSS grid for smooth animation */}
            <CollapsibleContent isOpen={mode === 'manual' || mode === 'auto'} duration={200}>
                <CollapsibleSection Icon={FileText} title="Manual Context" defaultOpen={mode === 'manual'}>
                    <NumberField
                        id="sum-manual-context"
                        label="Messages to include"
                        hint="When using /loom-summarize command"
                        value={manualMessageContext}
                        onChange={(v) => updateSummarization({ manualMessageContext: v })}
                        min={1}
                        max={100}
                    />
                </CollapsibleSection>
            </CollapsibleContent>

            {/* API Source - uses CSS grid for smooth animation */}
            <CollapsibleContent isOpen={mode !== 'disabled'} duration={200}>
                <CollapsibleSection Icon={Cloud} title="API Source" defaultOpen={false}>
                    <div className="lumiverse-vp-radio-group lumiverse-vp-radio-group--wide">
                        <RadioOption
                            name="sum-source"
                            value="main"
                            checked={apiSource === 'main'}
                            onChange={(v) => updateSummarization({ apiSource: v })}
                            label="Main API"
                        />
                        <RadioOption
                            name="sum-source"
                            value="secondary"
                            checked={apiSource === 'secondary'}
                            onChange={(v) => updateSummarization({ apiSource: v })}
                            label="Secondary LLM"
                        />
                    </div>
                </CollapsibleSection>
            </CollapsibleContent>

            {/* Secondary LLM Config - uses CSS grid for smooth animation */}
            <CollapsibleContent isOpen={mode !== 'disabled' && apiSource === 'secondary'} duration={200}>
                <CollapsibleSection Icon={Cpu} title="Secondary LLM" defaultOpen={true}>
                    <SelectField
                        id="sum-provider"
                        label="Provider"
                        value={secondary.provider || 'openai'}
                        onChange={(v) => updateSecondary({ provider: v })}
                        options={providerOptions}
                        hint={secondary.provider !== 'custom' ? 'Uses API key from SillyTavern settings' : undefined}
                    />

                    <TextField
                        id="sum-model"
                        label="Model"
                        value={secondary.model || ''}
                        onChange={(v) => updateSecondary({ model: v })}
                        placeholder={PROVIDER_CONFIG[secondary.provider || 'openai']?.placeholder}
                    />

                    {/* Custom endpoint fields - uses CSS grid for smooth animation */}
                    <CollapsibleContent isOpen={secondary.provider === 'custom'} duration={200}>
                        <TextField
                            id="sum-endpoint"
                            label="Endpoint URL"
                            value={secondary.endpoint || ''}
                            onChange={(v) => updateSecondary({ endpoint: v })}
                            placeholder="https://your-api.com/v1/chat/completions"
                        />
                        <TextField
                            id="sum-apikey"
                            label="API Key"
                            type="password"
                            value={secondary.apiKey || ''}
                            onChange={(v) => updateSecondary({ apiKey: v })}
                            placeholder="Your API key"
                        />
                    </CollapsibleContent>

                    <div className="lumiverse-vp-field-row lumiverse-vp-field-row--3">
                        <NumberField
                            id="sum-temp"
                            label="Temp"
                            value={secondary.temperature ?? 0.7}
                            onChange={(v) => updateSecondary({ temperature: v })}
                            min={0}
                            max={2}
                            step={0.1}
                        />
                        <NumberField
                            id="sum-topp"
                            label="Top-P"
                            value={secondary.topP ?? 1.0}
                            onChange={(v) => updateSecondary({ topP: v })}
                            min={0}
                            max={1}
                            step={0.05}
                        />
                        <NumberField
                            id="sum-maxtokens"
                            label="Max Tokens"
                            value={secondary.maxTokens || 8192}
                            onChange={(v) => updateSecondary({ maxTokens: v })}
                            min={100}
                            max={128000}
                        />
                    </div>
                </CollapsibleSection>
            </CollapsibleContent>

            {/* Claude Cache Control - Show when using Anthropic provider or main API (which might be Claude) */}
            <CollapsibleContent isOpen={mode !== 'disabled' && (apiSource === 'main' || secondary.provider === 'anthropic')} duration={200}>
                <CollapsibleSection Icon={RefreshCcw} title="Claude Cache" defaultOpen={false}>
                    <p className="lumiverse-vp-settings-desc">
                        If Claude seems to ignore changes to your Lumia definitions,
                        clearing the cache will force fresh responses on the next summarization.
                    </p>
                    <ActionButton
                        Icon={RefreshCcw}
                        label="Clear Claude Cache"
                        onClick={() => {
                            if (typeof LumiverseBridge !== 'undefined' && LumiverseBridge.clearClaudeCache) {
                                LumiverseBridge.clearClaudeCache();
                                // Show success feedback
                                if (typeof toastr !== 'undefined') {
                                    toastr.success('Claude cache cleared! Next request will use fresh definitions.');
                                }
                            } else {
                                console.warn('[SummaryEditor] clearClaudeCache not available');
                                if (typeof toastr !== 'undefined') {
                                    toastr.error('Cache clear function not available');
                                }
                            }
                        }}
                        variant="secondary"
                    />
                </CollapsibleSection>
            </CollapsibleContent>

            {/* Message Truncation */}
            <CollapsibleSection
                Icon={Scissors}
                title="Message Limit"
                status={messageTruncation.enabled}
            >
                <Toggle
                    id="trunc-toggle"
                    checked={messageTruncation.enabled}
                    onChange={(v) => updateTruncation({ enabled: v })}
                    label="Limit Context Messages"
                    hint="Only send the last N messages to the AI"
                />
                {/* Uses CSS grid for smooth animation */}
                <CollapsibleContent isOpen={messageTruncation.enabled} duration={200}>
                    <NumberField
                        id="trunc-count"
                        label="Messages to keep"
                        hint="Number of recent messages to include"
                        value={messageTruncation.keepCount ?? 50}
                        onChange={(v) => updateTruncation({ keepCount: v })}
                        min={5}
                        max={500}
                    />
                    <div className="lumiverse-vp-warning-box">
                        <AlertCircle size={14} strokeWidth={2} />
                        <span>Older messages will be excluded. Consider using summarization to preserve memories.</span>
                    </div>
                </CollapsibleContent>
            </CollapsibleSection>
        </div>
    );
}

/**
 * Summary Text Editor Section
 */
function SummaryTextEditor() {
    const [summary, setSummary] = useState('');
    const [originalSummary, setOriginalSummary] = useState('');
    const [hasChat, setHasChat] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const textareaRef = useRef(null);

    // Subscribe to chat change counter to reload when chat changes
    const chatChangeCounter = useSyncExternalStore(
        store.subscribe,
        () => store.getState().chatChangeCounter || 0,
        () => 0
    );

    const hasChanges = summary !== originalSummary;
    const hasContent = summary.trim().length > 0;

    // Load summary from chat metadata
    const loadSummary = useCallback(() => {
        try {
            if (typeof SillyTavern !== 'undefined') {
                const context = SillyTavern.getContext();
                const chatExists = context?.chat && context.chat.length > 0;
                setHasChat(chatExists);

                if (chatExists && context.chatMetadata) {
                    const storedSummary = context.chatMetadata[LOOM_SUMMARY_KEY] || '';
                    setSummary(storedSummary);
                    setOriginalSummary(storedSummary);
                } else {
                    setSummary('');
                    setOriginalSummary('');
                }
            } else {
                // Demo mode
                setHasChat(true);
                setSummary('');
                setOriginalSummary('');
            }
        } catch (e) {
            console.warn('[SummaryEditor] Error loading summary:', e);
        }
    }, []);

    // Load on mount and when chat changes
    useEffect(() => {
        loadSummary();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatChangeCounter]); // Reload when chat changes

    // Handle text changes
    const handleTextChange = useCallback((e) => {
        setSummary(e.target.value);
    }, []);

    // Save summary to chat metadata
    const handleSave = useCallback(() => {
        try {
            if (typeof SillyTavern !== 'undefined') {
                const context = SillyTavern.getContext();
                if (!context.chatMetadata) {
                    context.chatMetadata = {};
                }

                const trimmedSummary = summary.trim();
                if (trimmedSummary) {
                    context.chatMetadata[LOOM_SUMMARY_KEY] = trimmedSummary;
                } else {
                    delete context.chatMetadata[LOOM_SUMMARY_KEY];
                }

                // Save metadata
                context.saveMetadata?.();

                // Update button state if function exists
                if (typeof LumiverseBridge !== 'undefined' && LumiverseBridge.updateSummaryButtonState) {
                    LumiverseBridge.updateSummaryButtonState();
                }

                setOriginalSummary(trimmedSummary);
                setIsSaving(true);
                setTimeout(() => setIsSaving(false), 1500);
            }
        } catch (e) {
            console.error('[SummaryEditor] Error saving summary:', e);
        }
    }, [summary]);

    // Clear summary
    const handleClear = useCallback(() => {
        if (confirm('Are you sure you want to clear the summary?')) {
            setSummary('');

            try {
                if (typeof SillyTavern !== 'undefined') {
                    const context = SillyTavern.getContext();
                    if (context.chatMetadata) {
                        delete context.chatMetadata[LOOM_SUMMARY_KEY];
                        context.saveMetadata?.();

                        if (typeof LumiverseBridge !== 'undefined' && LumiverseBridge.updateSummaryButtonState) {
                            LumiverseBridge.updateSummaryButtonState();
                        }
                    }
                }
                setOriginalSummary('');
            } catch (e) {
                console.error('[SummaryEditor] Error clearing summary:', e);
            }
        }
    }, []);

    // Refresh from stored value
    const handleRefresh = useCallback(() => {
        loadSummary();
    }, [loadSummary]);

    // Generate summary using the configured API
    const handleGenerate = useCallback(async () => {
        if (!hasChat || isGenerating) return;

        setIsGenerating(true);
        try {
            // Call the bridge to generate summary if available
            if (typeof LumiverseBridge !== 'undefined' && LumiverseBridge.getCallbacks) {
                const callbacks = LumiverseBridge.getCallbacks();
                if (callbacks.generateSummary) {
                    const result = await callbacks.generateSummary();
                    if (result) {
                        setSummary(result);
                    }
                } else {
                    console.warn('[SummaryEditor] generateSummary callback not available');
                }
            }
        } catch (e) {
            console.error('[SummaryEditor] Error generating summary:', e);
        } finally {
            setIsGenerating(false);
        }
    }, [hasChat, isGenerating]);

    return (
        <CollapsibleSection Icon={FileText} title="Summary Text" defaultOpen={true}>
            {/* Status */}
            <StatusIndicator hasContent={originalSummary.length > 0} hasChat={hasChat} />

            {/* Textarea */}
            <div className="lumiverse-vp-summary-textarea-wrapper">
                <textarea
                    ref={textareaRef}
                    className="lumiverse-vp-summary-textarea"
                    value={summary}
                    onChange={handleTextChange}
                    placeholder={PLACEHOLDER_TEXT}
                    disabled={!hasChat}
                />
            </div>

            {/* Actions */}
            <div className="lumiverse-vp-summary-actions">
                <ActionButton
                    Icon={Play}
                    label={isGenerating ? 'Generating...' : 'Generate'}
                    onClick={handleGenerate}
                    disabled={!hasChat}
                    loading={isGenerating}
                    variant="primary"
                    iconOnly
                />
                <ActionButton
                    Icon={RefreshCw}
                    label="Refresh"
                    onClick={handleRefresh}
                    disabled={!hasChat}
                    iconOnly
                />
                <ActionButton
                    Icon={Trash2}
                    label="Clear"
                    onClick={handleClear}
                    disabled={!hasChat || !originalSummary}
                    variant="danger"
                    iconOnly
                />
                <ActionButton
                    Icon={isSaving ? Check : Save}
                    label={isSaving ? 'Saved!' : 'Save'}
                    onClick={handleSave}
                    disabled={!hasChat || !hasChanges}
                    variant="primary"
                    iconOnly
                />
            </div>

            {/* Unsaved changes indicator */}
            <AnimatePresence>
                {hasChanges && (
                    <motion.div
                        className="lumiverse-vp-summary-unsaved"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                    >
                        <span>You have unsaved changes</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </CollapsibleSection>
    );
}

/**
 * Summary Editor Panel
 * View and edit the Loom summary for the current chat + configuration
 */
function SummaryEditor() {
    return (
        <div className="lumiverse-vp-summary-editor">
            {/* Summary Text Editor */}
            <SummaryTextEditor />

            {/* Summarization Configuration */}
            <SummarizationConfig />
        </div>
    );
}

export default SummaryEditor;
