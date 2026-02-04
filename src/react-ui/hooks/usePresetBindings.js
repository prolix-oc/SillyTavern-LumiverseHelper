/**
 * React hook for managing preset bindings to characters and chats
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    getPresetBindings,
    setCharacterBinding,
    setChatBinding,
    getCharacterBinding,
    getChatBinding,
    getAllBindingsForDisplay,
    getCurrentContextInfo,
    resolveCurrentBinding,
    onBindingsChange,
    recaptureDefaultToggleState,
    hasDefaultToggleState,
} from '../../lib/presetBindingService.js';
import { chatPresetService } from '../../lib/chatPresetService.js';
import { subscribeToCacheChanges } from '../../lib/packCache.js';
import { useLumiverse, useLumiverseActions } from '../store/LumiverseContext.jsx';

// Stable selector for disableDefaultStateRestore (defined outside component)
const selectDisableDefaultStateRestore = state => state.disableDefaultStateRestore ?? false;

/**
 * Hook for managing preset bindings
 * @returns {Object} Binding management utilities
 */
export function usePresetBindings() {
    const [bindings, setBindings] = useState(() => getPresetBindings());
    const [contextInfo, setContextInfo] = useState(() => getCurrentContextInfo());
    const [availablePresets, setAvailablePresets] = useState([]);
    
    // Toggle state bindings
    const [hasChatToggleBinding, setHasChatToggleBinding] = useState(false);
    const [hasCharacterToggleBinding, setHasCharacterToggleBinding] = useState(false);

    // Get disableDefaultStateRestore from store
    const disableDefaultStateRestore = useLumiverse(selectDisableDefaultStateRestore);
    const actions = useLumiverseActions();

    // Subscribe to binding changes
    useEffect(() => {
        const updateBindings = (newBindings) => {
            setBindings(newBindings || getPresetBindings());
        };

        onBindingsChange(updateBindings);

        // Load initial available presets
        setAvailablePresets(chatPresetService.getAvailablePresets());

        // Check toggle state bindings
        setHasChatToggleBinding(chatPresetService.hasChatToggleState());
        setHasCharacterToggleBinding(chatPresetService.hasCharacterToggleState());

        // Subscribe to cache changes for toggle bindings updates
        const unsubscribeCache = subscribeToCacheChanges(() => {
            setHasChatToggleBinding(chatPresetService.hasChatToggleState());
            setHasCharacterToggleBinding(chatPresetService.hasCharacterToggleState());
        });

        // Refresh context periodically (every 2 seconds) to catch changes
        const contextInterval = setInterval(() => {
            setContextInfo(getCurrentContextInfo());
            setHasChatToggleBinding(chatPresetService.hasChatToggleState());
            setHasCharacterToggleBinding(chatPresetService.hasCharacterToggleState());
        }, 2000);

        return () => {
            onBindingsChange(null);
            clearInterval(contextInterval);
            unsubscribeCache();
        };
    }, []);

    // Refresh context info (call when modal opens to ensure fresh data)
    const refreshContext = useCallback(() => {
        setContextInfo(getCurrentContextInfo());
        setHasChatToggleBinding(chatPresetService.hasChatToggleState());
        setHasCharacterToggleBinding(chatPresetService.hasCharacterToggleState());
    }, []);

    // Refresh available presets, toggle state status, AND context
    const refreshPresets = useCallback(() => {
        setAvailablePresets(chatPresetService.getAvailablePresets());
        // Also refresh context and toggle binding status
        setContextInfo(getCurrentContextInfo());
        setHasChatToggleBinding(chatPresetService.hasChatToggleState());
        setHasCharacterToggleBinding(chatPresetService.hasCharacterToggleState());
    }, []);

    // Get current binding for active context
    const currentBinding = useMemo(() => {
        return resolveCurrentBinding();
    }, [bindings, contextInfo]);

    // Bind current character to a preset
    const bindCurrentCharacter = useCallback((presetName) => {
        const avatar = contextInfo.characterAvatar;
        if (!avatar) {
            console.warn('[usePresetBindings] No current character to bind');
            return false;
        }
        setCharacterBinding(avatar, presetName);
        setBindings(getPresetBindings());
        return true;
    }, [contextInfo.characterAvatar]);

    // Bind current chat to a preset
    const bindCurrentChat = useCallback((presetName) => {
        const chatId = contextInfo.chatId;
        if (!chatId) {
            console.warn('[usePresetBindings] No current chat to bind');
            return false;
        }
        setChatBinding(chatId, presetName);
        setBindings(getPresetBindings());
        return true;
    }, [contextInfo.chatId]);

    // Remove character binding
    const removeCharacterBinding = useCallback((avatarName) => {
        setCharacterBinding(avatarName, null);
        setBindings(getPresetBindings());
    }, []);

    // Remove chat binding
    const removeChatBinding = useCallback((chatId) => {
        setChatBinding(chatId, null);
        setBindings(getPresetBindings());
    }, []);

    // Get all bindings for display
    const allBindings = useMemo(() => {
        return getAllBindingsForDisplay();
    }, [bindings]);

    // Get binding for current character
    const currentCharacterBinding = useMemo(() => {
        if (!contextInfo.characterAvatar) return null;
        return getCharacterBinding(contextInfo.characterAvatar);
    }, [contextInfo.characterAvatar, bindings]);

    // Get binding for current chat
    const currentChatBinding = useMemo(() => {
        if (!contextInfo.chatId) return null;
        return getChatBinding(contextInfo.chatId);
    }, [contextInfo.chatId, bindings]);

    // =========================================================================
    // PROMPT TOGGLE STATE BINDINGS
    // =========================================================================

    /**
     * Save current prompt toggle states to the current chat.
     * This creates a per-chat override that auto-applies when switching to this chat.
     * 
     * IMPORTANT: Uses captureCurrentToggles() to read from runtime prompt_order,
     * NOT from the static preset prompts array. This ensures we capture the
     * actual current enabled/disabled states.
     */
    const saveTogglesToChat = useCallback(async () => {
        // Capture toggles from runtime prompt_order (the correct source)
        const toggles = chatPresetService.captureCurrentToggles();
        if (!toggles || Object.keys(toggles).length === 0) {
            console.warn('[usePresetBindings] No toggles to save (prompt_order empty or unavailable)');
            return false;
        }
        
        const chatId = chatPresetService.getCurrentChatId();
        if (!chatId) {
            console.warn('[usePresetBindings] No current chat to bind toggles');
            return false;
        }
        
        // Import the setter directly since we're bypassing the prompts-based method
        const { setChatToggleBinding } = await import('../../lib/packCache.js');
        // CRITICAL: Await the async setter to ensure immediate persistence
        // This prevents race conditions when switching chats before save completes
        await setChatToggleBinding(chatId, {
            toggles,
            sourcePreset: chatPresetService.getCurrentPreset()?.name || null,
        });
        
        setHasChatToggleBinding(true);
        console.log(`[usePresetBindings] Saved ${Object.keys(toggles).length} toggle states to chat "${chatId}"`);
        return true;
    }, []);

    /**
     * Clear the toggle state binding from the current chat.
     */
    const clearChatToggleBinding = useCallback(async () => {
        const success = await chatPresetService.clearChatToggleState();
        if (success) {
            setHasChatToggleBinding(false);
        }
        return success;
    }, []);

    /**
     * Save current prompt toggle states to the current character.
     * 
     * IMPORTANT: Uses captureCurrentToggles() to read from runtime prompt_order,
     * NOT from the static preset prompts array. This ensures we capture the
     * actual current enabled/disabled states.
     */
    const saveTogglesToCharacter = useCallback(async () => {
        // Capture toggles from runtime prompt_order (the correct source)
        const toggles = chatPresetService.captureCurrentToggles();
        if (!toggles || Object.keys(toggles).length === 0) {
            console.warn('[usePresetBindings] No toggles to save (prompt_order empty or unavailable)');
            return false;
        }
        
        const avatar = chatPresetService.getCurrentCharacterAvatar();
        if (!avatar) {
            console.warn('[usePresetBindings] No current character to bind toggles');
            return false;
        }
        
        // Import the setter directly since we're bypassing the prompts-based method
        const { setCharacterToggleBinding } = await import('../../lib/packCache.js');
        // CRITICAL: Await the async setter to ensure immediate persistence
        // This prevents race conditions when switching characters before save completes
        await setCharacterToggleBinding(avatar, {
            toggles,
            sourcePreset: chatPresetService.getCurrentPreset()?.name || null,
        });
        
        setHasCharacterToggleBinding(true);
        console.log(`[usePresetBindings] Saved ${Object.keys(toggles).length} toggle states to character "${avatar}"`);
        return true;
    }, []);

    /**
     * Clear the toggle state binding from the current character.
     */
    const clearCharacterToggleBinding = useCallback(async () => {
        const success = await chatPresetService.clearCharacterToggleState();
        if (success) {
            setHasCharacterToggleBinding(false);
        }
        return success;
    }, []);

    return {
        // State
        bindings,
        contextInfo,
        availablePresets,
        currentBinding,
        allBindings,
        currentCharacterBinding,
        currentChatBinding,
        
        // Toggle state bindings
        hasChatToggleBinding,
        hasCharacterToggleBinding,
        
        // Default state restoration settings
        disableDefaultStateRestore,
        hasDefaultToggles: hasDefaultToggleState(),

        // Actions
        bindCurrentCharacter,
        bindCurrentChat,
        removeCharacterBinding,
        removeChatBinding,
        refreshPresets,
        refreshContext,
        
        // Toggle state actions
        saveTogglesToChat,
        clearChatToggleBinding,
        saveTogglesToCharacter,
        clearCharacterToggleBinding,
        
        // Default state restoration actions
        setDisableDefaultStateRestore: actions.setDisableDefaultStateRestore,
        recaptureDefaultToggleState,

        // Direct access for advanced use
        setCharacterBinding,
        setChatBinding,
    };
}
