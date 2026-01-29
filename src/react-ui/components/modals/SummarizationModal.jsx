import React, { useState, useCallback } from 'react';
import { useLumiverseStore, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { 
    AlignLeft, Settings, Cloud, Server, Play, 
    Clock, Edit3, MessageSquare, AlertTriangle, 
    Check, X, Loader2 
} from 'lucide-react';

/**
 * Summarization Settings Modal
 * 
 * Configures Loom summarization:
 * - Mode (disabled, auto, manual)
 * - Auto settings (interval, context)
 * - API source (main or secondary LLM)
 * - Secondary LLM configuration
 * - Message truncation settings
 * 
 * Replaces the old jQuery showSummarizationModal()
 */

// Provider configuration
const PROVIDER_CONFIG = {
    openai: { name: 'OpenAI', placeholder: 'gpt-4-turbo-preview' },
    anthropic: { name: 'Anthropic', placeholder: 'claude-3-opus-20240229' },
    google: { name: 'Google AI', placeholder: 'gemini-pro' },
    openrouter: { name: 'OpenRouter', placeholder: 'anthropic/claude-3-opus' },
    custom: { name: 'Custom Endpoint', placeholder: 'your-model-name' },
};

// Self-contained styles
const styles = {
    layout: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 20px',
        borderBottom: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
    },
    headerIcon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(147, 112, 219, 0.2), rgba(147, 112, 219, 0.1))',
        color: 'var(--lumiverse-primary)',
    },
    headerText: {
        flex: 1,
    },
    title: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 600,
        color: 'var(--lumiverse-text)',
    },
    subtitle: {
        margin: '4px 0 0',
        fontSize: '12px',
        color: 'var(--lumiverse-text-muted)',
    },
    scrollArea: {
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        padding: '16px 20px',
    },
    section: {
        marginBottom: '20px',
        padding: '14px',
        background: 'rgba(0, 0, 0, 0.15)',
        borderRadius: '10px',
        border: '1px solid var(--lumiverse-border)',
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        color: 'var(--lumiverse-text)',
        fontWeight: 500,
        fontSize: '14px',
    },
    sectionIcon: {
        color: 'var(--lumiverse-primary)',
    },
    modeOptions: {
        display: 'flex',
        gap: '8px',
    },
    modeOption: {
        flex: 1,
        padding: '10px',
        background: 'rgba(0, 0, 0, 0.2)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textAlign: 'center',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--lumiverse-text)',
    },
    modeOptionSelected: {
        background: 'rgba(147, 112, 219, 0.15)',
        borderColor: 'var(--lumiverse-primary)',
        color: 'var(--lumiverse-primary)',
    },
    field: {
        marginBottom: '12px',
    },
    fieldRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
    },
    fieldRow3: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '12px',
    },
    label: {
        display: 'block',
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--lumiverse-text)',
        marginBottom: '6px',
    },
    input: {
        width: '100%',
        padding: '10px 12px',
        fontSize: '13px',
        background: 'var(--lumiverse-input-bg)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        color: 'var(--lumiverse-text)',
        outline: 'none',
        boxSizing: 'border-box',
    },
    select: {
        width: '100%',
        padding: '10px 12px',
        fontSize: '13px',
        background: 'var(--lumiverse-input-bg)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        color: 'var(--lumiverse-text)',
        outline: 'none',
        boxSizing: 'border-box',
    },
    hint: {
        fontSize: '11px',
        color: 'var(--lumiverse-text-muted)',
        marginTop: '4px',
    },
    toggleRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
    },
    toggleLabel: {
        flex: 1,
    },
    toggleText: {
        display: 'block',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--lumiverse-text)',
    },
    toggleHint: {
        display: 'block',
        fontSize: '11px',
        color: 'var(--lumiverse-text-muted)',
        marginTop: '2px',
    },
    toggle: {
        position: 'relative',
        width: '44px',
        height: '24px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
    },
    toggleActive: {
        background: 'var(--lumiverse-primary)',
    },
    toggleThumb: {
        position: 'absolute',
        top: '2px',
        left: '2px',
        width: '20px',
        height: '20px',
        background: 'white',
        borderRadius: '50%',
        transition: 'transform 0.2s ease',
    },
    toggleThumbActive: {
        transform: 'translateX(20px)',
    },
    warningBox: {
        display: 'flex',
        gap: '12px',
        padding: '12px',
        background: 'rgba(255, 152, 0, 0.1)',
        border: '1px solid rgba(255, 152, 0, 0.3)',
        borderRadius: '8px',
        marginTop: '12px',
    },
    warningIcon: {
        color: '#ff9800',
        flexShrink: 0,
    },
    warningContent: {
        flex: 1,
    },
    warningTitle: {
        fontSize: '12px',
        fontWeight: 600,
        color: '#ff9800',
        marginBottom: '4px',
    },
    warningText: {
        fontSize: '11px',
        color: 'var(--lumiverse-text-muted)',
        lineHeight: 1.4,
    },
    testSection: {
        marginBottom: '20px',
        padding: '14px',
        background: 'rgba(147, 112, 219, 0.08)',
        borderRadius: '10px',
        border: '1px solid rgba(147, 112, 219, 0.2)',
    },
    testButton: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '12px',
        fontSize: '14px',
        fontWeight: 500,
        background: 'var(--lumiverse-primary)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
    },
    testButtonDisabled: {
        opacity: 0.5,
        cursor: 'not-allowed',
    },
    testResult: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px',
        borderRadius: '8px',
        marginTop: '12px',
    },
    testResultSuccess: {
        background: 'rgba(76, 175, 80, 0.1)',
        border: '1px solid rgba(76, 175, 80, 0.3)',
    },
    testResultError: {
        background: 'rgba(244, 67, 54, 0.1)',
        border: '1px solid rgba(244, 67, 54, 0.3)',
    },
    footer: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        padding: '12px 20px',
        borderTop: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
    },
    button: {
        padding: '10px 16px',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    buttonSecondary: {
        background: 'var(--lumiverse-surface)',
        color: 'var(--lumiverse-text)',
        border: '1px solid var(--lumiverse-border)',
    },
    buttonPrimary: {
        background: 'var(--lumiverse-primary)',
        color: 'white',
    },
    hidden: {
        display: 'none',
    },
};

function SummarizationModal({ onClose }) {
    const store = useLumiverseStore;
    const actions = useLumiverseActions();
    
    // Get current settings
    const currentSettings = store.getState();
    const sumSettings = currentSettings.summarization || {};
    const secondary = sumSettings.secondary || {};
    const truncSettings = currentSettings.messageTruncation || {};
    
    // Form state
    const [mode, setMode] = useState(sumSettings.mode || 'disabled');
    const [apiSource, setApiSource] = useState(sumSettings.apiSource || 'main');
    const [autoInterval, setAutoInterval] = useState(sumSettings.autoInterval || 10);
    const [autoContext, setAutoContext] = useState(sumSettings.autoMessageContext || 10);
    const [manualContext, setManualContext] = useState(sumSettings.manualMessageContext || 10);
    
    // Secondary LLM settings
    const [provider, setProvider] = useState(secondary.provider || 'openai');
    const [model, setModel] = useState(secondary.model || '');
    const [endpoint, setEndpoint] = useState(secondary.endpoint || '');
    const [apiKey, setApiKey] = useState(secondary.apiKey || '');
    const [temperature, setTemperature] = useState(secondary.temperature || 0.7);
    const [topP, setTopP] = useState(secondary.topP !== undefined ? secondary.topP : 1.0);
    const [maxTokens, setMaxTokens] = useState(secondary.maxTokens || 8192);
    
    // Message truncation
    const [truncEnabled, setTruncEnabled] = useState(truncSettings.enabled || false);
    const [truncKeepCount, setTruncKeepCount] = useState(truncSettings.keepCount ?? 50);
    
    // Test state
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    const handleSave = useCallback(() => {
        const parseMaxTokens = (val) => {
            const parsed = parseInt(val, 10);
            if (isNaN(parsed)) return 8192;
            return Math.max(256, parsed);
        };

        // Build settings object
        const newSettings = {
            summarization: {
                mode,
                apiSource,
                autoInterval: parseInt(autoInterval, 10) || 10,
                autoMessageContext: parseInt(autoContext, 10) || 10,
                manualMessageContext: parseInt(manualContext, 10) || 10,
                secondary: {
                    provider,
                    model,
                    endpoint,
                    apiKey,
                    temperature: parseFloat(temperature) || 0.7,
                    topP: parseFloat(topP) || 1.0,
                    maxTokens: parseMaxTokens(maxTokens),
                },
            },
            messageTruncation: {
                enabled: truncEnabled,
                keepCount: parseInt(truncKeepCount, 10) || 50,
            },
        };
        
        // Update store
        actions.setSettings(newSettings);
        
        // Persist
        saveToExtension();
        
        if (window.toastr) {
            window.toastr.success('Summarization settings saved!');
        }
        
        onClose();
    }, [
        mode, apiSource, autoInterval, autoContext, manualContext,
        provider, model, endpoint, apiKey, temperature, topP, maxTokens,
        truncEnabled, truncKeepCount, actions, onClose
    ]);

    const handleTest = useCallback(async () => {
        setTesting(true);
        setTestResult(null);
        
        try {
            const callbacks = window.LumiverseBridge?.getCallbacks?.();
            if (callbacks?.generateSummary) {
                const tempSettings = {
                    mode,
                    apiSource,
                    autoInterval: parseInt(autoInterval, 10) || 10,
                    autoMessageContext: parseInt(autoContext, 10) || 10,
                    manualMessageContext: parseInt(manualContext, 10) || 10,
                    secondary: {
                        provider,
                        model,
                        endpoint,
                        apiKey,
                        temperature: parseFloat(temperature) || 0.7,
                        topP: parseFloat(topP) || 1.0,
                        maxTokens: parseInt(maxTokens, 10) || 8192,
                    },
                };
                
                const result = await callbacks.generateSummary(tempSettings, true);
                
                if (result) {
                    setTestResult({ success: true, message: 'Summary woven successfully! Saved to chat metadata.' });
                    if (window.toastr) {
                        window.toastr.success('Summary generated and saved to chat metadata!');
                    }
                } else {
                    setTestResult({ success: false, message: 'No summary generated. Check console for details.' });
                }
            } else {
                setTestResult({ success: false, message: 'Summary generation not available.' });
            }
        } catch (error) {
            console.error('[SummarizationModal] Test error:', error);
            setTestResult({ success: false, message: error.message || 'Failed to generate summary' });
        } finally {
            setTesting(false);
        }
    }, [mode, apiSource, autoInterval, autoContext, manualContext, provider, model, endpoint, apiKey, temperature, topP, maxTokens]);

    // Check if we have an active chat
    const hasActiveChat = (() => {
        try {
            const ctx = window.SillyTavern?.getContext?.();
            return ctx?.chat && ctx.chat.length > 0;
        } catch {
            return false;
        }
    })();

    return (
        <div style={styles.layout}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerIcon}>
                    <AlignLeft size={20} strokeWidth={1.5} />
                </div>
                <div style={styles.headerText}>
                    <h3 style={styles.title}>Summarization</h3>
                    <p style={styles.subtitle}>Configure story summarization settings</p>
                </div>
            </div>

            {/* Scrollable Content */}
            <div style={styles.scrollArea}>
                {/* Mode Selection */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <Settings size={16} style={styles.sectionIcon} />
                        <span>Mode</span>
                    </div>
                    <div style={styles.modeOptions}>
                        {['disabled', 'auto', 'manual'].map((m) => (
                            <button
                                key={m}
                                type="button"
                                style={{
                                    ...styles.modeOption,
                                    ...(mode === m ? styles.modeOptionSelected : {}),
                                }}
                                onClick={() => setMode(m)}
                            >
                                {m.charAt(0).toUpperCase() + m.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Auto Settings */}
                {mode === 'auto' && (
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <Clock size={16} style={styles.sectionIcon} />
                            <span>Auto Settings</span>
                        </div>
                        <div style={styles.fieldRow}>
                            <div style={styles.field}>
                                <label style={styles.label}>Interval</label>
                                <input
                                    type="number"
                                    style={styles.input}
                                    min="1"
                                    value={autoInterval}
                                    onChange={(e) => setAutoInterval(e.target.value)}
                                />
                                <div style={styles.hint}>Every N messages</div>
                            </div>
                            <div style={styles.field}>
                                <label style={styles.label}>Context</label>
                                <input
                                    type="number"
                                    style={styles.input}
                                    min="1"
                                    max="100"
                                    value={autoContext}
                                    onChange={(e) => setAutoContext(e.target.value)}
                                />
                                <div style={styles.hint}>Messages to include</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Manual Context */}
                {(mode === 'manual' || mode === 'auto') && (
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <Edit3 size={16} style={styles.sectionIcon} />
                            <span>Manual Context</span>
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>Messages to include</label>
                            <input
                                type="number"
                                style={styles.input}
                                min="1"
                                max="100"
                                value={manualContext}
                                onChange={(e) => setManualContext(e.target.value)}
                            />
                            <div style={styles.hint}>When using /loom-summarize command</div>
                        </div>
                    </div>
                )}

                {/* API Source */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <Cloud size={16} style={styles.sectionIcon} />
                        <span>API Source</span>
                    </div>
                    <div style={styles.modeOptions}>
                        <button
                            type="button"
                            style={{
                                ...styles.modeOption,
                                ...(apiSource === 'main' ? styles.modeOptionSelected : {}),
                            }}
                            onClick={() => setApiSource('main')}
                        >
                            Main API
                        </button>
                        <button
                            type="button"
                            style={{
                                ...styles.modeOption,
                                ...(apiSource === 'secondary' ? styles.modeOptionSelected : {}),
                            }}
                            onClick={() => setApiSource('secondary')}
                        >
                            Secondary LLM
                        </button>
                    </div>
                </div>

                {/* Secondary LLM Config */}
                {apiSource === 'secondary' && (
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <Server size={16} style={styles.sectionIcon} />
                            <span>Secondary LLM</span>
                        </div>
                        
                        <div style={styles.field}>
                            <label style={styles.label}>Provider</label>
                            <select
                                style={styles.select}
                                value={provider}
                                onChange={(e) => setProvider(e.target.value)}
                            >
                                {Object.entries(PROVIDER_CONFIG).map(([key, config]) => (
                                    <option key={key} value={key}>{config.name}</option>
                                ))}
                            </select>
                            {provider !== 'custom' && (
                                <div style={styles.hint}>Uses API key from SillyTavern settings</div>
                            )}
                        </div>

                        <div style={styles.field}>
                            <label style={styles.label}>Model</label>
                            <input
                                type="text"
                                style={styles.input}
                                placeholder={PROVIDER_CONFIG[provider]?.placeholder || 'model-name'}
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                            />
                        </div>

                        {provider === 'custom' && (
                            <>
                                <div style={styles.field}>
                                    <label style={styles.label}>Endpoint URL</label>
                                    <input
                                        type="text"
                                        style={styles.input}
                                        placeholder="https://your-api.com/v1/chat/completions"
                                        value={endpoint}
                                        onChange={(e) => setEndpoint(e.target.value)}
                                    />
                                </div>
                                <div style={styles.field}>
                                    <label style={styles.label}>API Key</label>
                                    <input
                                        type="password"
                                        style={styles.input}
                                        placeholder="Your API key"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                    />
                                </div>
                            </>
                        )}

                        <div style={styles.fieldRow3}>
                            <div style={styles.field}>
                                <label style={styles.label}>Temp</label>
                                <input
                                    type="number"
                                    style={styles.input}
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    value={temperature}
                                    onChange={(e) => setTemperature(e.target.value)}
                                />
                            </div>
                            <div style={styles.field}>
                                <label style={styles.label}>Top-P</label>
                                <input
                                    type="number"
                                    style={styles.input}
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={topP}
                                    onChange={(e) => setTopP(e.target.value)}
                                />
                            </div>
                            <div style={styles.field}>
                                <label style={styles.label}>Max Tokens</label>
                                <input
                                    type="number"
                                    style={styles.input}
                                    value={maxTokens}
                                    onChange={(e) => setMaxTokens(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Test Section */}
                <div style={styles.testSection}>
                    <div style={styles.sectionHeader}>
                        <Play size={16} style={styles.sectionIcon} />
                        <span>Test</span>
                    </div>
                    <button
                        type="button"
                        style={{
                            ...styles.testButton,
                            ...(!hasActiveChat || testing ? styles.testButtonDisabled : {}),
                        }}
                        onClick={handleTest}
                        disabled={!hasActiveChat || testing}
                    >
                        {testing ? (
                            <>
                                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                <span>Weaving summary...</span>
                            </>
                        ) : (
                            <>
                                <Check size={16} />
                                <span>{hasActiveChat ? 'Generate Summary Now' : 'No Active Chat'}</span>
                            </>
                        )}
                    </button>
                    
                    {testResult && (
                        <div style={{
                            ...styles.testResult,
                            ...(testResult.success ? styles.testResultSuccess : styles.testResultError),
                        }}>
                            {testResult.success ? (
                                <Check size={16} style={{ color: '#4caf50' }} />
                            ) : (
                                <X size={16} style={{ color: '#f44336' }} />
                            )}
                            <span style={{ fontSize: '12px', color: 'var(--lumiverse-text)' }}>
                                {testResult.message}
                            </span>
                        </div>
                    )}
                    
                    {!hasActiveChat && (
                        <div style={{ ...styles.hint, marginTop: '8px', textAlign: 'center' }}>
                            Open a chat to test summarization
                        </div>
                    )}
                </div>

                {/* Message Truncation */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <MessageSquare size={16} style={styles.sectionIcon} />
                        <span>Save N Messages</span>
                    </div>
                    
                    <div style={styles.toggleRow}>
                        <div style={styles.toggleLabel}>
                            <span style={styles.toggleText}>Limit Context Messages</span>
                            <span style={styles.toggleHint}>Only send the last N messages to the AI</span>
                        </div>
                        <div
                            style={{
                                ...styles.toggle,
                                ...(truncEnabled ? styles.toggleActive : {}),
                            }}
                            onClick={() => setTruncEnabled(!truncEnabled)}
                        >
                            <div style={{
                                ...styles.toggleThumb,
                                ...(truncEnabled ? styles.toggleThumbActive : {}),
                            }} />
                        </div>
                    </div>
                    
                    {truncEnabled && (
                        <>
                            <div style={styles.field}>
                                <label style={styles.label}>Messages to keep</label>
                                <input
                                    type="number"
                                    style={styles.input}
                                    min="5"
                                    max="500"
                                    value={truncKeepCount}
                                    onChange={(e) => setTruncKeepCount(e.target.value)}
                                />
                                <div style={styles.hint}>Number of recent messages to include in context</div>
                            </div>
                            
                            <div style={styles.warningBox}>
                                <AlertTriangle size={20} style={styles.warningIcon} />
                                <div style={styles.warningContent}>
                                    <div style={styles.warningTitle}>Memory Loss Warning</div>
                                    <div style={styles.warningText}>
                                        Older messages beyond this limit will be excluded from the AI's context.
                                        The AI will lose awareness of earlier events, character details, and plot points.
                                        Consider using Loom summarization to preserve important memories.
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div style={styles.footer}>
                <button
                    type="button"
                    style={{ ...styles.button, ...styles.buttonSecondary }}
                    onClick={onClose}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    style={{ ...styles.button, ...styles.buttonPrimary }}
                    onClick={handleSave}
                >
                    Save Changes
                </button>
            </div>
            
            {/* Keyframe for spinner animation */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default SummarizationModal;
