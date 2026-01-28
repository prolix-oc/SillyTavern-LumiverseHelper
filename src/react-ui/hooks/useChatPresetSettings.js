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
    POST_PROCESSING_OPTIONS
} from '../../lib/presetsService';

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
    
    // Sync reference to prevent stale closures
    const stateRef = useRef({ startReplyWith: '' });
    stateRef.current.startReplyWith = startReplyWith;

    // Load initial settings and subscribe to changes
    useEffect(() => {
        setReasoningSettings(getReasoningSettings());
        setStartReplyWithState(getStartReplyWith());
        setApiReasoning(getAPIReasoningSettings());
        setPostProcessingState(getPostProcessing());
        
        // Subscribe to reasoning changes from other UI components
        const unsubscribe = subscribeToReasoningChanges((settings) => {
            setReasoningSettings(settings.reasoning);
            setStartReplyWithState(settings.startReplyWith);
            setApiReasoning(settings.apiReasoning);
            setPostProcessingState(settings.postProcessing);
        });
        
        return unsubscribe;
    }, []);

    // Refresh all state from source
    const refreshState = useCallback(() => {
        setReasoningSettings(getReasoningSettings());
        setStartReplyWithState(getStartReplyWith());
        setApiReasoning(getAPIReasoningSettings());
        setPostProcessingState(getPostProcessing());
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

    // Handle API reasoning toggle (Include Reasoning checkbox)
    // When enabled, clears "Start Reply With" since API reasoning handles the bias
    const handleAPIReasoningToggle = useCallback((enabled) => {
        setIncludeReasoning(enabled);
        setApiReasoning(getAPIReasoningSettings());
        // Clear Start Reply With when enabling API reasoning
        if (enabled && stateRef.current.startReplyWith) {
            setStartReplyWithState('');
            setStartReplyWith('');
        }
    }, []);

    // Handle reasoning effort change
    const handleReasoningEffortChange = useCallback((effort) => {
        setReasoningEffort(effort);
        setApiReasoning(getAPIReasoningSettings());
    }, []);

    // Handle post-processing change
    const handlePostProcessingChange = useCallback((strategy) => {
        setPostProcessingState(strategy);
        setPostProcessing(strategy);
    }, []);

    return {
        // State
        reasoningSettings,
        startReplyWith,
        apiReasoning,
        postProcessing,
        
        // Handlers
        handleApplyReasoningPreset,
        handleStartReplyWithChange,
        handleReasoningToggle,
        handleAPIReasoningToggle,
        handleReasoningEffortChange,
        handlePostProcessingChange,
        refreshState,
        
        // Constants
        REASONING_EFFORT_LEVELS,
        POST_PROCESSING_OPTIONS
    };
}

export default useChatPresetSettings;
