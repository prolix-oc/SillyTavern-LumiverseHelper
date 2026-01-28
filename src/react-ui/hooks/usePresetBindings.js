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

/**
 * Hook for managing preset bindings
 * @returns {Object} Binding management utilities
 */
export function usePresetBindings() {
    const [bindings, setBindings] = useState(() => getPresetBindings());
    const [contextInfo, setContextInfo] = useState(() => getCurrentContextInfo());
    const [availablePresets, setAvailablePresets] = useState([]);

    // Subscribe to binding changes
    useEffect(() => {
        const updateBindings = (newBindings) => {
            setBindings(newBindings || getPresetBindings());
        };

        onBindingsChange(updateBindings);

        // Load initial available presets
        setAvailablePresets(chatPresetService.getAvailablePresets());

        // Refresh context periodically (every 2 seconds) to catch changes
        const contextInterval = setInterval(() => {
            setContextInfo(getCurrentContextInfo());
        }, 2000);

        return () => {
            onBindingsChange(null);
            clearInterval(contextInterval);
        };
    }, []);

    // Refresh available presets
    const refreshPresets = useCallback(() => {
        setAvailablePresets(chatPresetService.getAvailablePresets());
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

    return {
        // State
        bindings,
        contextInfo,
        availablePresets,
        currentBinding,
        allBindings,
        currentCharacterBinding,
        currentChatBinding,

        // Actions
        bindCurrentCharacter,
        bindCurrentChat,
        removeCharacterBinding,
        removeChatBinding,
        refreshPresets,

        // Direct access for advanced use
        setCharacterBinding,
        setChatBinding,
    };
}
