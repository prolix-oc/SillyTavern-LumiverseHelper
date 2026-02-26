/**
 * Shared hook for Chat Preset settings (Reasoning, API Reasoning, Start Reply With)
 * Used by both ChatPresetsModal and PromptSettings sidebar
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
    configureReasoning,
    setStartReplyWith,
    getReasoningSettings,
    getStartReplyWith,
    REASONING_PRESETS,
    applyReasoningWithBias,
    getAPIReasoningSettings,
    setIncludeReasoning,
    setReasoningEffort,
    REASONING_EFFORT_LEVELS,
    subscribeToReasoningChanges,
    getPostProcessing,
    setPostProcessing,
    POST_PROCESSING_OPTIONS,
    getAdaptiveThinkingEnabled,
    setAdaptiveThinkingEnabled,
} from '../../lib/presetsService';
import {
    suppressReasoningReapply,
    saveReasoningToModelProfile,
    isLoomControlActive,
} from '../../lib/oaiPresetSync';

/**
 * Custom hook for managing Chat Preset settings
 * Provides synchronized state between multiple UI consumers
 */
export function useChatPresetSettings() {
    // Reasoning/CoT state
    const [reasoningSettings, setReasoningSettings] = useState(null);
    const [startReplyWith, setStartReplyWithState] = useState('');

    // API Reasoning state (show_thoughts / reasoning_effort)
    const [apiReasoning, setApiReasoning] = useState({ enabled: false, effort: 'auto' });

    // Post-processing state
    const [postProcessing, setPostProcessingState] = useState('');

    // Adaptive thinking state (Lumiverse-only, per-model-profile)
    const [adaptiveThinking, setAdaptiveThinkingState] = useState(() => getAdaptiveThinkingEnabled());

    // Sync reference to prevent stale closures
    const stateRef = useRef({ startReplyWith: '' });
    stateRef.current.startReplyWith = startReplyWith;

    // Debounced save to Loom model profile — persists reasoning changes
    // to the preset file after the user stops making rapid edits.
    const profileSaveTimerRef = useRef(null);
    const debouncedSaveToProfile = useCallback(() => {
        if (!isLoomControlActive()) return;
        if (profileSaveTimerRef.current) clearTimeout(profileSaveTimerRef.current);
        profileSaveTimerRef.current = setTimeout(() => {
            saveReasoningToModelProfile();
            profileSaveTimerRef.current = null;
        }, 500);
    }, []);

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (profileSaveTimerRef.current) clearTimeout(profileSaveTimerRef.current);
        };
    }, []);

    // Load initial settings and subscribe to changes
    useEffect(() => {
        setReasoningSettings(getReasoningSettings());
        setStartReplyWithState(getStartReplyWith());
        setApiReasoning(getAPIReasoningSettings());
        setPostProcessingState(getPostProcessing());
        setAdaptiveThinkingState(getAdaptiveThinkingEnabled());

        // Subscribe to reasoning changes from other UI components
        const unsubscribe = subscribeToReasoningChanges((settings) => {
            setReasoningSettings(settings.reasoning);
            setStartReplyWithState(settings.startReplyWith);
            setApiReasoning(settings.apiReasoning);
            setPostProcessingState(settings.postProcessing);
            if (settings.adaptiveThinking !== undefined) {
                setAdaptiveThinkingState(settings.adaptiveThinking);
            }
        });

        return unsubscribe;
    }, []);

    // Refresh all state from source
    const refreshState = useCallback(() => {
        setReasoningSettings(getReasoningSettings());
        setStartReplyWithState(getStartReplyWith());
        setApiReasoning(getAPIReasoningSettings());
        setPostProcessingState(getPostProcessing());
        setAdaptiveThinkingState(getAdaptiveThinkingEnabled());
    }, []);

    // Apply a reasoning preset with optional bias
    const handleApplyReasoningPreset = useCallback((presetKey, withBias = false) => {
        const preset = REASONING_PRESETS[presetKey];
        if (!preset) return;

        suppressReasoningReapply();
        if (withBias) {
            applyReasoningWithBias(presetKey);
        } else {
            configureReasoning(preset);
        }

        setReasoningSettings(getReasoningSettings());
        setStartReplyWithState(getStartReplyWith());
        debouncedSaveToProfile();
    }, [debouncedSaveToProfile]);

    // Handle Start Reply With change
    const handleStartReplyWithChange = useCallback((text) => {
        suppressReasoningReapply();
        setStartReplyWithState(text);
        setStartReplyWith(text);
        debouncedSaveToProfile();
    }, [debouncedSaveToProfile]);

    // Toggle individual reasoning setting
    const handleReasoningToggle = useCallback((key, value) => {
        suppressReasoningReapply();
        configureReasoning({ [key]: value });
        setReasoningSettings(getReasoningSettings());
        debouncedSaveToProfile();
    }, [debouncedSaveToProfile]);

    // Handle API reasoning toggle (Include Reasoning checkbox)
    // When enabled, clears "Start Reply With" since API reasoning handles the bias
    const handleAPIReasoningToggle = useCallback((enabled) => {
        suppressReasoningReapply();
        setIncludeReasoning(enabled);
        setApiReasoning(getAPIReasoningSettings());
        // Clear Start Reply With when enabling API reasoning
        if (enabled && stateRef.current.startReplyWith) {
            setStartReplyWithState('');
            setStartReplyWith('');
        }
        debouncedSaveToProfile();
    }, [debouncedSaveToProfile]);

    // Handle reasoning effort change
    const handleReasoningEffortChange = useCallback((effort) => {
        suppressReasoningReapply();
        setReasoningEffort(effort);
        setApiReasoning(getAPIReasoningSettings());
        debouncedSaveToProfile();
    }, [debouncedSaveToProfile]);

    // Handle post-processing change
    const handlePostProcessingChange = useCallback((strategy) => {
        suppressReasoningReapply();
        setPostProcessingState(strategy);
        setPostProcessing(strategy);
        debouncedSaveToProfile();
    }, [debouncedSaveToProfile]);

    // Handle adaptive thinking toggle
    const handleAdaptiveThinkingToggle = useCallback((enabled) => {
        suppressReasoningReapply();
        setAdaptiveThinkingEnabled(enabled);
        setAdaptiveThinkingState(enabled);
        debouncedSaveToProfile();
    }, [debouncedSaveToProfile]);

    return {
        // State
        reasoningSettings,
        startReplyWith,
        apiReasoning,
        postProcessing,
        adaptiveThinking,

        // Handlers
        handleApplyReasoningPreset,
        handleStartReplyWithChange,
        handleReasoningToggle,
        handleAPIReasoningToggle,
        handleReasoningEffortChange,
        handlePostProcessingChange,
        handleAdaptiveThinkingToggle,
        refreshState,

        // Constants
        REASONING_EFFORT_LEVELS,
        POST_PROCESSING_OPTIONS
    };
}

export default useChatPresetSettings;
