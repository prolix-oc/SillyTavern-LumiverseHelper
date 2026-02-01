/**
 * Preset Binding Service
 * 
 * Manages automatic preset switching and prompt toggle state application
 * based on character/chat context.
 * 
 * Supports binding to:
 * - Specific characters (by avatar name)
 * - Specific chats (by chat ID)
 * 
 * Priority for preset bindings: Chat > Character > None
 * Priority for toggle states: Chat > Character > None
 * 
 * Toggle states are applied AFTER preset bindings, allowing for:
 * 1. A base preset to be loaded (via binding)
 * 2. Then specific prompt toggles to be applied on top (via toggle state)
 */

import { getContext, getEventSource, getEventTypes } from "../stContext.js";
import { chatPresetService } from "./chatPresetService.js";
import {
    getCachedIndex,
    updateSelections,
    getChatToggleBinding,
    getCharacterToggleBinding,
} from "./packCache.js";

const MODULE_NAME = "PresetBindingService";

// Track the last applied binding to avoid redundant switches
let lastAppliedBinding = null;
// Track if we're currently switching to prevent loops
let isSwitching = false;
// Callback for when bindings change (for React UI updates)
let bindingsChangeCallback = null;

/**
 * Get all preset bindings from the cache
 * @returns {{characters: Object, chats: Object}}
 */
export function getPresetBindings() {
    const index = getCachedIndex();
    return index?.selections?.presetBindings || {
        characters: {},
        chats: {},
    };
}

/**
 * Save preset bindings to the cache
 * @param {{characters: Object, chats: Object}} bindings 
 */
function savePresetBindings(bindings) {
    updateSelections({ presetBindings: bindings });
    if (bindingsChangeCallback) {
        bindingsChangeCallback(bindings);
    }
}

/**
 * Set a character-level preset binding
 * @param {string} avatarName - Character avatar filename (unique identifier)
 * @param {string|null} presetName - Preset name to bind, or null to remove binding
 */
export function setCharacterBinding(avatarName, presetName) {
    if (!avatarName) {
        console.warn(`[${MODULE_NAME}] Cannot set binding: no avatar name provided`);
        return;
    }

    const bindings = getPresetBindings();
    
    if (presetName) {
        bindings.characters[avatarName] = presetName;
        console.log(`[${MODULE_NAME}] Bound character "${avatarName}" to preset "${presetName}"`);
    } else {
        delete bindings.characters[avatarName];
        console.log(`[${MODULE_NAME}] Removed binding for character "${avatarName}"`);
    }
    
    savePresetBindings(bindings);
}

/**
 * Set a chat-level preset binding
 * @param {string} chatId - Chat ID (filename)
 * @param {string|null} presetName - Preset name to bind, or null to remove binding
 */
export function setChatBinding(chatId, presetName) {
    if (!chatId) {
        console.warn(`[${MODULE_NAME}] Cannot set binding: no chat ID provided`);
        return;
    }

    const bindings = getPresetBindings();
    
    if (presetName) {
        bindings.chats[chatId] = presetName;
        console.log(`[${MODULE_NAME}] Bound chat "${chatId}" to preset "${presetName}"`);
    } else {
        delete bindings.chats[chatId];
        console.log(`[${MODULE_NAME}] Removed binding for chat "${chatId}"`);
    }
    
    savePresetBindings(bindings);
}

/**
 * Get the binding for a specific character
 * @param {string} avatarName 
 * @returns {string|null}
 */
export function getCharacterBinding(avatarName) {
    if (!avatarName) return null;
    const bindings = getPresetBindings();
    return bindings.characters[avatarName] || null;
}

/**
 * Get the binding for a specific chat
 * @param {string} chatId 
 * @returns {string|null}
 */
export function getChatBinding(chatId) {
    if (!chatId) return null;
    const bindings = getPresetBindings();
    return bindings.chats[chatId] || null;
}

/**
 * Remove all bindings for a specific preset (when preset is deleted)
 * @param {string} presetName 
 */
export function removeBindingsForPreset(presetName) {
    const bindings = getPresetBindings();
    let changed = false;

    // Remove from character bindings
    for (const [avatar, preset] of Object.entries(bindings.characters)) {
        if (preset === presetName) {
            delete bindings.characters[avatar];
            changed = true;
        }
    }

    // Remove from chat bindings
    for (const [chatId, preset] of Object.entries(bindings.chats)) {
        if (preset === presetName) {
            delete bindings.chats[chatId];
            changed = true;
        }
    }

    if (changed) {
        savePresetBindings(bindings);
        console.log(`[${MODULE_NAME}] Removed all bindings for deleted preset "${presetName}"`);
    }
}

/**
 * Get the current character avatar name from ST context
 * @returns {string|null}
 */
export function getCurrentCharacterAvatar() {
    const ctx = getContext();
    if (!ctx || ctx.characterId === undefined || ctx.characterId === null) {
        return null;
    }
    return ctx.characters?.[ctx.characterId]?.avatar || null;
}

/**
 * Get the current chat ID from ST context
 * @returns {string|null}
 */
export function getCurrentChatId() {
    const ctx = getContext();
    if (!ctx) return null;
    
    // Use getCurrentChatId if available
    if (typeof ctx.getCurrentChatId === 'function') {
        return ctx.getCurrentChatId();
    }
    
    // Fallback: derive from character or group
    if (ctx.groupId) {
        // Group chat
        return ctx.groups?.find(g => g.id === ctx.groupId)?.chat_id || null;
    }
    
    // Character chat
    const char = ctx.characters?.[ctx.characterId];
    return char?.chat || null;
}

/**
 * Determine which preset should be applied for the current context
 * Priority: Chat > Character > null (no binding)
 * @returns {{presetName: string|null, bindingType: 'chat'|'character'|null, bindingId: string|null}}
 */
export function resolveCurrentBinding() {
    const chatId = getCurrentChatId();
    const avatarName = getCurrentCharacterAvatar();

    // Check chat-level binding first (higher priority)
    if (chatId) {
        const chatPreset = getChatBinding(chatId);
        if (chatPreset) {
            return {
                presetName: chatPreset,
                bindingType: 'chat',
                bindingId: chatId,
            };
        }
    }

    // Check character-level binding
    if (avatarName) {
        const charPreset = getCharacterBinding(avatarName);
        if (charPreset) {
            return {
                presetName: charPreset,
                bindingType: 'character',
                bindingId: avatarName,
            };
        }
    }

    return {
        presetName: null,
        bindingType: null,
        bindingId: null,
    };
}

/**
 * Apply the appropriate preset based on current bindings
 * Called on CHAT_CHANGED event
 * 
 * IMPORTANT: This function now implements a "clean slate" approach:
 * 1. Always reset prompts to preset defaults FIRST
 * 2. Then apply any context-specific toggle bindings
 * 
 * This prevents toggle state "leakage" between different chats/characters.
 * 
 * @returns {Promise<boolean>} Whether a preset was switched
 */
export async function applyBindingForCurrentContext() {
    if (isSwitching) {
        console.log(`[${MODULE_NAME}] Already switching, skipping...`);
        return false;
    }

    const binding = resolveCurrentBinding();
    
    // CRITICAL FIX: Always reset prompts to default state first
    // This ensures no toggle state "leakage" from previous context
    chatPresetService.resetPromptsToDefault();
    
    // No binding for current context
    if (!binding.presetName) {
        console.log(`[${MODULE_NAME}] No preset binding for current context`);
        lastAppliedBinding = null;
        // After reset, check if there are context-specific toggle states to apply
        await applyToggleStatesForCurrentContext();
        return false;
    }

    // Already applied this binding
    const bindingKey = `${binding.bindingType}:${binding.bindingId}:${binding.presetName}`;
    if (lastAppliedBinding === bindingKey) {
        console.log(`[${MODULE_NAME}] Preset binding already applied, checking toggle states...`);
        // Still apply toggle states even if preset is same (they were reset above)
        await applyToggleStatesForCurrentContext();
        return false;
    }

    // Verify preset still exists
    const availablePresets = chatPresetService.getAvailablePresets();
    if (!availablePresets.includes(binding.presetName)) {
        console.warn(`[${MODULE_NAME}] Bound preset "${binding.presetName}" no longer exists`);
        // Optionally remove the stale binding
        if (binding.bindingType === 'chat') {
            setChatBinding(binding.bindingId, null);
        } else if (binding.bindingType === 'character') {
            setCharacterBinding(binding.bindingId, null);
        }
        return false;
    }

    // Apply the preset
    isSwitching = true;
    try {
        console.log(`[${MODULE_NAME}] Applying ${binding.bindingType} binding: "${binding.presetName}" for ${binding.bindingId}`);
        const success = await chatPresetService.selectPreset(binding.presetName);
        
        if (success) {
            lastAppliedBinding = bindingKey;
            console.log(`[${MODULE_NAME}] Successfully switched to preset "${binding.presetName}"`);
            
            // Show toast notification
            if (typeof toastr !== 'undefined') {
                const bindingLabel = binding.bindingType === 'chat' ? 'chat' : 'character';
                toastr.info(`Preset switched to "${binding.presetName}" (${bindingLabel} binding)`, 'Lumiverse Helper', {
                    timeOut: 2000,
                    preventDuplicates: true,
                });
            }

            // After preset is loaded, apply any toggle state overrides
            // Note: selectPreset loads fresh preset state, so we apply on top of that
            await applyToggleStatesForCurrentContext();
        }
        
        return success;
    } catch (error) {
        console.error(`[${MODULE_NAME}] Failed to apply binding:`, error);
        return false;
    } finally {
        isSwitching = false;
    }
}

/**
 * Apply prompt toggle states for the current context.
 * Priority: Chat toggle state > Character toggle state > None
 * 
 * This is called after preset binding is applied, allowing for layered configuration:
 * 1. Base preset provides the prompts and their default enabled states
 * 2. Toggle state overrides specific prompts' enabled/disabled status
 * 
 * Toggle bindings are now loaded from the Lumiverse index file for persistence.
 * 
 * @returns {Promise<{applied: boolean, source: 'chat'|'character'|null, matched: number}>}
 */
export async function applyToggleStatesForCurrentContext() {
    const chatId = getCurrentChatId();
    const avatar = getCurrentCharacterAvatar();

    // Check for chat-level toggle state first (higher priority)
    if (chatId) {
        const chatToggleState = getChatToggleBinding(chatId);
        if (chatToggleState) {
            console.log(`[${MODULE_NAME}] Found chat toggle binding for "${chatId}", applying...`);
            const result = await applyToggleStateToCurrentPreset(chatToggleState);
            if (result.applied) {
                if (typeof toastr !== 'undefined') {
                    toastr.info(`Prompt toggles applied (chat binding: ${result.matched} prompts)`, 'Lumiverse Helper', {
                        timeOut: 2000,
                        preventDuplicates: true,
                    });
                }
                return { applied: true, source: 'chat', matched: result.matched };
            }
        }
    }

    // Check for character-level toggle state
    if (avatar) {
        const charToggleState = getCharacterToggleBinding(avatar);
        if (charToggleState) {
            console.log(`[${MODULE_NAME}] Found character toggle binding for "${avatar}", applying...`);
            const result = await applyToggleStateToCurrentPreset(charToggleState);
            if (result.applied) {
                if (typeof toastr !== 'undefined') {
                    toastr.info(`Prompt toggles applied (character binding: ${result.matched} prompts)`, 'Lumiverse Helper', {
                        timeOut: 2000,
                        preventDuplicates: true,
                    });
                }
                return { applied: true, source: 'character', matched: result.matched };
            }
        }
    }

    console.log(`[${MODULE_NAME}] No toggle bindings to apply`);
    return { applied: false, source: null, matched: 0 };
}

/**
 * Apply toggle state data to the current preset's prompts.
 * 
 * Per SillyTavern's documentation (9_programmatic_prompt_toggling.md):
 * - The enabled state is stored in prompt_order, not prompts
 * - For Global Strategy, use dummy ID (100001 for OpenAI)
 * - Must trigger UI update after changes
 * 
 * Access pattern (discovered via codebase analysis):
 * - oai_settings is available via SillyTavern.getContext().chatCompletionSettings
 * - PromptManager is NOT exposed on context, so we use jQuery workaround for UI refresh
 * 
 * @param {Object} toggleState - Toggle state data with { toggles: { identifier: boolean } }
 * @returns {Promise<{applied: boolean, matched: number}>}
 */
async function applyToggleStateToCurrentPreset(toggleState) {
    if (!toggleState?.toggles) {
        console.log(`[${MODULE_NAME}] applyToggleStateToCurrentPreset: No toggles in state`);
        return { applied: false, matched: 0 };
    }

    const toggleCount = Object.keys(toggleState.toggles).length;
    console.log(`[${MODULE_NAME}] applyToggleStateToCurrentPreset: Applying ${toggleCount} toggles`);

    // Access oai_settings via the correct path: context.chatCompletionSettings
    const ctx = getContext();
    const oaiSettings = ctx?.chatCompletionSettings;
    
    if (!oaiSettings) {
        console.warn(`[${MODULE_NAME}] chatCompletionSettings not available on context`);
        return { applied: false, matched: 0 };
    }

    // Get prompt_order array
    const promptOrder = oaiSettings.prompt_order;
    if (!Array.isArray(promptOrder)) {
        console.warn(`[${MODULE_NAME}] prompt_order not available or not an array`);
        return { applied: false, matched: 0 };
    }

    // Determine the active character ID
    // Global Strategy uses dummy ID 100001 for OpenAI
    // Character-specific uses the actual character ID
    const OPENAI_DUMMY_ID = 100001;
    
    // Check if using global strategy (prompt_manager_settings.showCharacterPromptOrder)
    const isGlobalStrategy = !oaiSettings.prompt_manager_settings?.showCharacterPromptOrder;
    const activeCharId = isGlobalStrategy ? OPENAI_DUMMY_ID : ctx?.characterId;
    
    console.log(`[${MODULE_NAME}] Strategy: ${isGlobalStrategy ? 'Global' : 'Character'}, activeCharId: ${activeCharId}`);

    // Find the prompt_order entry for this character
    const orderEntry = promptOrder.find(entry => entry.character_id === activeCharId);
    if (!orderEntry || !Array.isArray(orderEntry.order)) {
        console.warn(`[${MODULE_NAME}] No prompt_order entry for character ${activeCharId}`);
        return { applied: false, matched: 0 };
    }

    // Apply toggles to the order entries
    let matched = 0;
    let unmatched = 0;

    for (const [promptId, enabled] of Object.entries(toggleState.toggles)) {
        const orderItem = orderEntry.order.find(item => item.identifier === promptId);
        if (orderItem) {
            orderItem.enabled = enabled;
            matched++;
        } else {
            unmatched++;
        }
    }

    if (matched > 0) {
        console.log(`[${MODULE_NAME}] Applied ${matched} toggles, ${unmatched} unmatched. Triggering UI update...`);
        
        // Trigger UI refresh via jQuery workaround
        // Since PromptManager.render() is not accessible, use the preset update button
        if (typeof jQuery !== 'undefined') {
            jQuery('#update_oai_preset').trigger('click');
        }
        
        // Save settings via ST's debounced save
        if (typeof ctx?.saveSettingsDebounced === 'function') {
            ctx.saveSettingsDebounced();
        }
        
        console.log(`[${MODULE_NAME}] Toggle state applied successfully`);
        return { applied: true, matched };
    }

    console.log(`[${MODULE_NAME}] No prompts matched toggle state (${unmatched} unmatched)`);
    return { applied: false, matched: 0 };
}

/**
 * Get all bindings in a flattened format for UI display
 * @returns {Array<{type: 'character'|'chat', id: string, displayName: string, presetName: string}>}
 */
export function getAllBindingsForDisplay() {
    const bindings = getPresetBindings();
    const ctx = getContext();
    const result = [];

    // Character bindings
    for (const [avatar, presetName] of Object.entries(bindings.characters)) {
        // Try to find display name from characters array
        let displayName = avatar;
        if (ctx?.characters) {
            const char = ctx.characters.find(c => c.avatar === avatar);
            if (char?.name) {
                displayName = char.name;
            }
        }
        result.push({
            type: 'character',
            id: avatar,
            displayName,
            presetName,
        });
    }

    // Chat bindings
    for (const [chatId, presetName] of Object.entries(bindings.chats)) {
        result.push({
            type: 'chat',
            id: chatId,
            displayName: chatId, // Could be enhanced to show character name + chat suffix
            presetName,
        });
    }

    return result;
}

/**
 * Get current context info for UI display
 * @returns {{characterAvatar: string|null, characterName: string|null, chatId: string|null}}
 */
export function getCurrentContextInfo() {
    const ctx = getContext();
    const avatar = getCurrentCharacterAvatar();
    const chatId = getCurrentChatId();
    
    let characterName = null;
    if (avatar && ctx?.characters) {
        const char = ctx.characters.find(c => c.avatar === avatar);
        characterName = char?.name || null;
    }

    return {
        characterAvatar: avatar,
        characterName,
        chatId,
    };
}

/**
 * Subscribe to binding changes (for React UI updates)
 * @param {Function} callback 
 */
export function onBindingsChange(callback) {
    bindingsChangeCallback = callback;
}

/**
 * Initialize the binding service - subscribe to CHAT_CHANGED events
 */
export function initPresetBindingService() {
    const eventSource = getEventSource();
    const event_types = getEventTypes();

    if (!eventSource || !event_types?.CHAT_CHANGED) {
        console.warn(`[${MODULE_NAME}] Cannot initialize: ST event system not available`);
        return false;
    }

    eventSource.on(event_types.CHAT_CHANGED, () => {
        console.log(`[${MODULE_NAME}] CHAT_CHANGED detected, checking bindings...`);
        // Small delay to ensure ST context is updated
        setTimeout(() => {
            applyBindingForCurrentContext();
        }, 100);
    });

    console.log(`[${MODULE_NAME}] Preset binding service initialized`);
    return true;
}

/**
 * Clear all bindings (for testing/reset)
 */
export function clearAllBindings() {
    savePresetBindings({ characters: {}, chats: {} });
    lastAppliedBinding = null;
    console.log(`[${MODULE_NAME}] All bindings cleared`);
}
