/**
 * React hook for managing preset bindings to characters and chats.
 * Supports both ST/OAI presets and Loom presets — auto-detects mode based
 * on whether a Loom preset is currently active.
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
import {
    setBinding as setLoomBinding,
    clearBinding as clearLoomBinding,
    captureLoomBlockStates,
} from '../../lib/lucidLoomService.js';
import {
    getLoomBindings,
    getLoomPresetRegistry as getLoomRegistry,
    getLoomChatToggleBinding,
    getLoomCharacterToggleBinding,
    setLoomChatToggleBinding,
    setLoomCharacterToggleBinding,
    clearLoomChatToggleBinding,
    clearLoomCharacterToggleBinding,
    subscribeToCacheChanges,
} from '../../lib/packCache.js';
import { chatPresetService } from '../../lib/chatPresetService.js';
import { useLumiverse, useLumiverseActions } from '../store/LumiverseContext.jsx';

// Stable selectors (defined outside component)
const selectDisableDefaultStateRestore = state => state.disableDefaultStateRestore ?? false;
const selectLoomBuilder = state => state.loomBuilder;

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

    // Loom mode detection
    const loomBuilder = useLumiverse(selectLoomBuilder);
    const isLoomMode = !!loomBuilder?.activePresetId;

    // Helper: check Loom toggle binding status for current context
    const checkLoomToggleBindings = useCallback(() => {
        const info = getCurrentContextInfo();
        setHasChatToggleBinding(
            isLoomMode
                ? !!getLoomChatToggleBinding(info.chatId)
                : chatPresetService.hasChatToggleState()
        );
        setHasCharacterToggleBinding(
            isLoomMode
                ? !!getLoomCharacterToggleBinding(info.characterAvatar)
                : chatPresetService.hasCharacterToggleState()
        );
    }, [isLoomMode]);

    // Subscribe to binding changes
    useEffect(() => {
        const updateBindings = (newBindings) => {
            setBindings(newBindings || getPresetBindings());
        };

        onBindingsChange(updateBindings);

        // Load initial available presets
        if (isLoomMode) {
            const registry = getLoomRegistry();
            setAvailablePresets(
                Object.entries(registry).map(([id, entry]) => ({
                    value: id,
                    label: entry.name || id,
                }))
            );
        } else {
            setAvailablePresets(
                chatPresetService.getAvailablePresets().map(name => ({
                    value: name,
                    label: name,
                }))
            );
        }

        // Check toggle state bindings
        checkLoomToggleBindings();

        // Subscribe to cache changes for toggle bindings updates
        const unsubscribeCache = subscribeToCacheChanges(() => {
            checkLoomToggleBindings();
        });

        // Refresh context periodically (every 2 seconds) to catch changes
        const contextInterval = setInterval(() => {
            setContextInfo(getCurrentContextInfo());
            checkLoomToggleBindings();
        }, 2000);

        return () => {
            onBindingsChange(null);
            clearInterval(contextInterval);
            unsubscribeCache();
        };
    }, [isLoomMode, checkLoomToggleBindings]);

    // Refresh context info (call when modal opens to ensure fresh data)
    const refreshContext = useCallback(() => {
        setContextInfo(getCurrentContextInfo());
        checkLoomToggleBindings();
    }, [checkLoomToggleBindings]);

    // Refresh available presets, toggle state status, AND context
    const refreshPresets = useCallback(() => {
        if (isLoomMode) {
            const registry = getLoomRegistry();
            setAvailablePresets(
                Object.entries(registry).map(([id, entry]) => ({
                    value: id,
                    label: entry.name || id,
                }))
            );
        } else {
            setAvailablePresets(
                chatPresetService.getAvailablePresets().map(name => ({
                    value: name,
                    label: name,
                }))
            );
        }
        // Also refresh context and toggle binding status
        setContextInfo(getCurrentContextInfo());
        checkLoomToggleBindings();
    }, [isLoomMode, checkLoomToggleBindings]);

    // Get current binding for active context
    const currentBinding = useMemo(() => {
        return resolveCurrentBinding();
    }, [bindings, contextInfo]);

    // Bind current character to a preset
    const bindCurrentCharacter = useCallback((presetValue) => {
        const avatar = contextInfo.characterAvatar;
        if (!avatar) return false;

        if (isLoomMode) {
            setLoomBinding('character', avatar, presetValue);
        } else {
            setCharacterBinding(avatar, presetValue);
        }
        setBindings(getPresetBindings());
        return true;
    }, [contextInfo.characterAvatar, isLoomMode]);

    // Bind current chat to a preset
    const bindCurrentChat = useCallback((presetValue) => {
        const chatId = contextInfo.chatId;
        if (!chatId) return false;

        if (isLoomMode) {
            setLoomBinding('chat', chatId, presetValue);
        } else {
            setChatBinding(chatId, presetValue);
        }
        setBindings(getPresetBindings());
        return true;
    }, [contextInfo.chatId, isLoomMode]);

    // Remove character binding
    const removeCharacterBinding = useCallback((avatarName) => {
        if (isLoomMode) {
            clearLoomBinding('character', avatarName);
        } else {
            setCharacterBinding(avatarName, null);
        }
        setBindings(getPresetBindings());
    }, [isLoomMode]);

    // Remove chat binding
    const removeChatBinding = useCallback((chatId) => {
        if (isLoomMode) {
            clearLoomBinding('chat', chatId);
        } else {
            setChatBinding(chatId, null);
        }
        setBindings(getPresetBindings());
    }, [isLoomMode]);

    // Get all bindings for display — merged ST + Loom with type tags
    const allBindings = useMemo(() => {
        const stBindings = getAllBindingsForDisplay().map(b => ({
            ...b,
            presetType: 'st',
        }));

        const loomBindings = [];
        const loomData = getLoomBindings();
        const loomRegistry = getLoomRegistry();

        // Character bindings
        for (const [avatar, presetId] of Object.entries(loomData.characters || {})) {
            if (!loomRegistry[presetId]) continue;
            let displayName = avatar;
            try {
                const ctx = window.SillyTavern?.getContext?.();
                if (ctx?.characters) {
                    const char = ctx.characters.find(c => c.avatar === avatar);
                    if (char?.name) displayName = char.name;
                }
            } catch (e) { /* ignore */ }
            loomBindings.push({
                type: 'character',
                id: avatar,
                displayName,
                presetName: loomRegistry[presetId]?.name || presetId,
                presetType: 'loom',
            });
        }

        // Chat bindings
        for (const [chatId, presetId] of Object.entries(loomData.chats || {})) {
            if (!loomRegistry[presetId]) continue;
            loomBindings.push({
                type: 'chat',
                id: chatId,
                displayName: chatId,
                presetName: loomRegistry[presetId]?.name || presetId,
                presetType: 'loom',
            });
        }

        return [...stBindings, ...loomBindings];
    }, [bindings, loomBuilder]);

    // Get binding for current character
    const currentCharacterBinding = useMemo(() => {
        if (!contextInfo.characterAvatar) return null;
        if (isLoomMode) {
            const loomData = getLoomBindings();
            const presetId = loomData.characters?.[contextInfo.characterAvatar];
            if (!presetId) return null;
            const registry = getLoomRegistry();
            return registry[presetId]?.name || presetId;
        }
        return getCharacterBinding(contextInfo.characterAvatar);
    }, [contextInfo.characterAvatar, bindings, isLoomMode, loomBuilder]);

    // Get binding for current chat
    const currentChatBinding = useMemo(() => {
        if (!contextInfo.chatId) return null;
        if (isLoomMode) {
            const loomData = getLoomBindings();
            const presetId = loomData.chats?.[contextInfo.chatId];
            if (!presetId) return null;
            const registry = getLoomRegistry();
            return registry[presetId]?.name || presetId;
        }
        return getChatBinding(contextInfo.chatId);
    }, [contextInfo.chatId, bindings, isLoomMode, loomBuilder]);

    // =========================================================================
    // PROMPT TOGGLE STATE BINDINGS
    // =========================================================================

    /**
     * Save current prompt toggle states to the current chat.
     * In Loom mode, captures block enabled/disabled states.
     * In ST mode, captures prompt_order enabled/disabled states.
     */
    const saveTogglesToChat = useCallback(async () => {
        const chatId = contextInfo.chatId || chatPresetService.getCurrentChatId();
        if (!chatId) return false;

        if (isLoomMode) {
            const blockStates = captureLoomBlockStates();
            if (!blockStates) {
                console.warn('[usePresetBindings] No Loom block states to save');
                return false;
            }
            console.debug('[LoomToggle] Saving chat toggle — chatId:', chatId, 'blocks:', Object.keys(blockStates).length, 'states:', blockStates);
            await setLoomChatToggleBinding(chatId, {
                blockStates,
                sourcePresetId: loomBuilder?.activePresetId || null,
            });
            setHasChatToggleBinding(true);
            return true;
        }

        // ST mode
        const toggles = chatPresetService.captureCurrentToggles();
        if (!toggles || Object.keys(toggles).length === 0) {
            console.warn('[usePresetBindings] No toggles to save (prompt_order empty or unavailable)');
            return false;
        }

        const { setChatToggleBinding } = await import('../../lib/packCache.js');
        await setChatToggleBinding(chatId, {
            toggles,
            sourcePreset: chatPresetService.getCurrentPreset()?.name || null,
        });

        setHasChatToggleBinding(true);
        return true;
    }, [isLoomMode, contextInfo.chatId, loomBuilder?.activePresetId]);

    /**
     * Clear the toggle state binding from the current chat.
     */
    const clearChatToggleBindingFn = useCallback(async () => {
        if (isLoomMode) {
            const chatId = contextInfo.chatId || chatPresetService.getCurrentChatId();
            if (!chatId) return false;
            await clearLoomChatToggleBinding(chatId);
            setHasChatToggleBinding(false);
            return true;
        }
        const success = await chatPresetService.clearChatToggleState();
        if (success) {
            setHasChatToggleBinding(false);
        }
        return success;
    }, [isLoomMode, contextInfo.chatId]);

    /**
     * Save current prompt toggle states to the current character.
     * In Loom mode, captures block enabled/disabled states.
     * In ST mode, captures prompt_order enabled/disabled states.
     */
    const saveTogglesToCharacter = useCallback(async () => {
        const avatar = contextInfo.characterAvatar || chatPresetService.getCurrentCharacterAvatar();
        if (!avatar) return false;

        if (isLoomMode) {
            const blockStates = captureLoomBlockStates();
            if (!blockStates) {
                console.warn('[usePresetBindings] No Loom block states to save');
                return false;
            }
            await setLoomCharacterToggleBinding(avatar, {
                blockStates,
                sourcePresetId: loomBuilder?.activePresetId || null,
            });
            setHasCharacterToggleBinding(true);
            return true;
        }

        // ST mode
        const toggles = chatPresetService.captureCurrentToggles();
        if (!toggles || Object.keys(toggles).length === 0) {
            console.warn('[usePresetBindings] No toggles to save (prompt_order empty or unavailable)');
            return false;
        }

        const { setCharacterToggleBinding } = await import('../../lib/packCache.js');
        await setCharacterToggleBinding(avatar, {
            toggles,
            sourcePreset: chatPresetService.getCurrentPreset()?.name || null,
        });

        setHasCharacterToggleBinding(true);
        return true;
    }, [isLoomMode, contextInfo.characterAvatar, loomBuilder?.activePresetId]);

    /**
     * Clear the toggle state binding from the current character.
     */
    const clearCharacterToggleBindingFn = useCallback(async () => {
        if (isLoomMode) {
            const avatar = contextInfo.characterAvatar || chatPresetService.getCurrentCharacterAvatar();
            if (!avatar) return false;
            await clearLoomCharacterToggleBinding(avatar);
            setHasCharacterToggleBinding(false);
            return true;
        }
        const success = await chatPresetService.clearCharacterToggleState();
        if (success) {
            setHasCharacterToggleBinding(false);
        }
        return success;
    }, [isLoomMode, contextInfo.characterAvatar]);

    return {
        // State
        bindings,
        contextInfo,
        availablePresets,
        currentBinding,
        allBindings,
        currentCharacterBinding,
        currentChatBinding,

        // Mode
        isLoomMode,

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
        clearChatToggleBinding: clearChatToggleBindingFn,
        saveTogglesToCharacter,
        clearCharacterToggleBinding: clearCharacterToggleBindingFn,

        // Default state restoration actions
        setDisableDefaultStateRestore: actions.setDisableDefaultStateRestore,
        recaptureDefaultToggleState,

        // Direct access for advanced use
        setCharacterBinding,
        setChatBinding,
    };
}
