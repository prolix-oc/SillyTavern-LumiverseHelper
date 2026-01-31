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
} from '../../lib/presetBindingService.js';
import { chatPresetService } from '../../lib/chatPresetService.js';
import { subscribeToCacheChanges } from '../../lib/packCache.js';

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

    // Refresh available presets and toggle state status
    const refreshPresets = useCallback(() => {
        setAvailablePresets(chatPresetService.getAvailablePresets());
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
     */
    const saveTogglesToChat = useCallback(async () => {
        const preset = chatPresetService.getCurrentPreset();
        if (!preset?.settings?.prompts?.length) {
            console.warn('[usePresetBindings] No prompts to save');
            return false;
        }
        const success = await chatPresetService.saveToggleStateToChat(preset.settings.prompts);
        if (success) {
            setHasChatToggleBinding(true);
        }
        return success;
    }, []);

    /**
     * Clear the toggle state binding from the current chat.
     */
    const clearChatToggleBinding = useCallback(() => {
        const success = chatPresetService.clearChatToggleState();
        if (success) {
            setHasChatToggleBinding(false);
        }
        return success;
    }, []);

    /**
     * Save current prompt toggle states to the current character.
     */
    const saveTogglesToCharacter = useCallback(async () => {
        const preset = chatPresetService.getCurrentPreset();
        if (!preset?.settings?.prompts?.length) {
            console.warn('[usePresetBindings] No prompts to save');
            return false;
        }
        const success = await chatPresetService.saveToggleStateToCharacter(preset.settings.prompts);
        if (success) {
            setHasCharacterToggleBinding(true);
        }
        return success;
    }, []);

    /**
     * Clear the toggle state binding from the current character.
     */
    const clearCharacterToggleBinding = useCallback(() => {
        const success = chatPresetService.clearCharacterToggleState();
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

        // Actions
        bindCurrentCharacter,
        bindCurrentChat,
        removeCharacterBinding,
        removeChatBinding,
        refreshPresets,
        
        // Toggle state actions
        saveTogglesToChat,
        clearChatToggleBinding,
        saveTogglesToCharacter,
        clearCharacterToggleBinding,

        // Direct access for advanced use
        setCharacterBinding,
        setChatBinding,
    };
}
