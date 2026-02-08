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
import { getSettings, saveSettings } from "./settingsManager.js";
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

// --- DEFAULT TOGGLE STATE CAPTURE ---
// Captured state is now persisted in settingsManager for page refresh survival
// Track whether we're currently "on defaults" to avoid redundant reapplication
let isCurrentlyOnDefaults = false;

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
 * Check if the current context has ANY bindings (preset or toggle)
 * @returns {{hasPresetBinding: boolean, hasToggleBinding: boolean, chatId: string|null, avatar: string|null}}
 */
function checkCurrentContextBindings() {
    const chatId = getCurrentChatId();
    const avatar = getCurrentCharacterAvatar();
    
    // Check preset bindings
    const presetBinding = resolveCurrentBinding();
    const hasPresetBinding = !!presetBinding.presetName;
    
    // Check toggle bindings
    let hasToggleBinding = false;
    if (chatId) {
        const chatToggles = getChatToggleBinding(chatId);
        if (chatToggles?.toggles && Object.keys(chatToggles.toggles).length > 0) {
            hasToggleBinding = true;
        }
    }
    if (!hasToggleBinding && avatar) {
        const charToggles = getCharacterToggleBinding(avatar);
        if (charToggles?.toggles && Object.keys(charToggles.toggles).length > 0) {
            hasToggleBinding = true;
        }
    }
    
    return { hasPresetBinding, hasToggleBinding, chatId, avatar };
}

/**
 * Capture the current preset's toggle states as the "defaults".
 * Called once on initialization to establish baseline state.
 * These defaults are restored when switching to chats without bindings.
 * 
 * @returns {boolean} Whether defaults were successfully captured
 */
export function captureDefaultToggleState() {
    const toggles = chatPresetService.captureCurrentToggles();
    if (!toggles || Object.keys(toggles).length === 0) {
        console.warn(`[${MODULE_NAME}] Failed to capture default toggle state - no toggles available`);
        return false;
    }

    // Persist to settings so it survives page refresh
    const settings = getSettings();
    settings.capturedDefaultToggles = toggles;
    saveSettings();

    isCurrentlyOnDefaults = true;
    console.log(`[${MODULE_NAME}] Captured default toggle state with ${Object.keys(toggles).length} toggles`);
    return true;
}

/**
 * Check if there are captured default toggles available.
 * @returns {boolean}
 */
export function hasDefaultToggleState() {
    const settings = getSettings();
    return settings.capturedDefaultToggles !== null && Object.keys(settings.capturedDefaultToggles).length > 0;
}

/**
 * Get the captured default toggle state.
 * @returns {Object|null} The default toggles or null if not captured
 */
export function getDefaultToggleState() {
    return getSettings().capturedDefaultToggles;
}

/**
 * Check if current toggles match the captured defaults.
 * Used to avoid redundant reapplication when already on defaults.
 * 
 * @returns {boolean} True if current toggles match defaults
 */
function areCurrentTogglesMatchingDefaults() {
    const settings = getSettings();
    const capturedDefaultToggles = settings.capturedDefaultToggles;
    if (!capturedDefaultToggles) return false;

    const currentToggles = chatPresetService.captureCurrentToggles();
    if (!currentToggles) return false;

    // Compare toggle states
    const defaultKeys = Object.keys(capturedDefaultToggles);
    const currentKeys = Object.keys(currentToggles);

    // Quick length check
    if (defaultKeys.length !== currentKeys.length) return false;

    // Deep compare
    for (const key of defaultKeys) {
        if (currentToggles[key] !== capturedDefaultToggles[key]) {
            return false;
        }
    }

    return true;
}

/**
 * Restore toggle states to captured defaults.
 * This applies the initially captured toggle configuration.
 * 
 * @returns {{applied: boolean, matched: number}} Result of applying defaults
 */
function restoreDefaultToggleState() {
    const settings = getSettings();
    const capturedDefaultToggles = settings.capturedDefaultToggles;

    if (!capturedDefaultToggles) {
        console.warn(`[${MODULE_NAME}] No default toggle state captured - cannot restore`);
        return { applied: false, matched: 0 };
    }

    const ctx = getContext();
    const oaiSettings = ctx?.chatCompletionSettings;
    
    if (!oaiSettings?.prompt_order) {
        console.warn(`[${MODULE_NAME}] Cannot restore defaults - prompt_order not available`);
        return { applied: false, matched: 0 };
    }

    // Determine active character ID (same logic as applyToggleStateToCurrentPreset)
    const OPENAI_DUMMY_ID = 100001;
    const isGlobalStrategy = !oaiSettings.prompt_manager_settings?.showCharacterPromptOrder;
    const activeCharId = isGlobalStrategy ? OPENAI_DUMMY_ID : ctx?.characterId;

    const orderEntry = oaiSettings.prompt_order.find(entry => entry.character_id === activeCharId);
    if (!orderEntry?.order) {
        console.warn(`[${MODULE_NAME}] Cannot restore defaults - no prompt_order entry for character ${activeCharId}`);
        return { applied: false, matched: 0 };
    }

    // Apply default toggles
    let matched = 0;
    for (const [promptId, enabled] of Object.entries(capturedDefaultToggles)) {
        const orderItem = orderEntry.order.find(item => item.identifier === promptId);
        if (orderItem) {
            orderItem.enabled = enabled;
            matched++;
        }
    }

    if (matched > 0) {
        // Save runtime settings
        if (typeof ctx?.saveSettingsDebounced === 'function') {
            ctx.saveSettingsDebounced();
        }
        
        isCurrentlyOnDefaults = true;
        console.log(`[${MODULE_NAME}] Restored ${matched} toggles to default state`);
    }

    return { applied: matched > 0, matched };
}

/**
 * Apply the appropriate preset based on current bindings
 * Called on CHAT_CHANGED event
 * 
 * Behavior:
 * - If NO bindings exist for the current context AND we have captured defaults:
 *   - If already on defaults, do nothing (optimization)
 *   - Otherwise, restore the captured default toggle state
 * - If bindings DO exist:
 *   1. Reset prompts to preset defaults FIRST (clean slate)
 *   2. Apply preset binding if one exists
 *   3. Apply toggle binding on top if one exists
 * 
 * This prevents toggle state "leakage" between different chats/characters
 * by restoring defaults when switching to unbound contexts.
 * 
 * @returns {Promise<boolean>} Whether a preset was switched
 */
export async function applyBindingForCurrentContext() {
    if (isSwitching) {
        console.log(`[${MODULE_NAME}] Already switching, skipping...`);
        return false;
    }

    // CRITICAL: Check if there are ANY bindings for this context FIRST
    const bindingCheck = checkCurrentContextBindings();
    
    // If no bindings of any kind, restore defaults (if we have them)
    if (!bindingCheck.hasPresetBinding && !bindingCheck.hasToggleBinding) {
        lastAppliedBinding = null;
        
        // Check if default state restoration is disabled
        const settings = getSettings();
        if (settings.disableDefaultStateRestore) {
            console.log(`[${MODULE_NAME}] No bindings for current context - default state restoration is disabled, skipping`);
            return false;
        }
        
        // If we don't have captured defaults, nothing to restore
        if (!hasDefaultToggleState()) {
            console.log(`[${MODULE_NAME}] No bindings for current context and no defaults captured - leaving preset state untouched`);
            return false;
        }
        
        // If already on defaults, skip redundant reapplication
        if (isCurrentlyOnDefaults && areCurrentTogglesMatchingDefaults()) {
            console.log(`[${MODULE_NAME}] No bindings for current context - already on defaults, skipping`);
            return false;
        }
        
        // Restore defaults
        console.log(`[${MODULE_NAME}] No bindings for current context - restoring default toggle state`);
        const result = restoreDefaultToggleState();
        
        if (result.applied && typeof toastr !== 'undefined') {
            toastr.info(`Restored default toggles (${result.matched} prompts)`, 'Lumiverse Helper', {
                timeOut: 2000,
                preventDuplicates: true,
            });
        }
        
        return false;
    }

    const binding = resolveCurrentBinding();
    
    // We have at least one type of binding - mark that we're NOT on defaults anymore
    isCurrentlyOnDefaults = false;
    
    // We have at least one type of binding - reset to defaults first for clean slate
    // This only happens when we KNOW we're going to apply bindings
    console.log(`[${MODULE_NAME}] Bindings detected (preset: ${bindingCheck.hasPresetBinding}, toggle: ${bindingCheck.hasToggleBinding}) - resetting to defaults`);
    chatPresetService.resetPromptsToDefault();
    
    // No preset binding but we have toggle binding
    if (!binding.presetName) {
        console.log(`[${MODULE_NAME}] No preset binding, but toggle binding exists - applying toggles only`);
        lastAppliedBinding = null;
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
        console.log(`[${MODULE_NAME}] Applied ${matched} toggles, ${unmatched} unmatched.`);
        
        // IMPORTANT: Do NOT trigger #update_oai_preset - that saves the ENTIRE preset to file,
        // which would overwrite the preset's reasoning/CoT settings with current values.
        // We only want to persist the runtime prompt_order changes, not modify the preset file.
        
        // Save runtime settings via ST's debounced save
        // This persists prompt_order changes without touching preset files or reasoning settings
        if (typeof ctx?.saveSettingsDebounced === 'function') {
            ctx.saveSettingsDebounced();
        }
        
        console.log(`[${MODULE_NAME}] Toggle state applied successfully (runtime only, preset file unchanged)`);
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
 * Initialize the binding service - subscribe to CHAT_CHANGED events.
 * Note: Default toggle state capture is now manual via the UI button,
 * not automatic on page load.
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
        // Delay to ensure ST context is fully updated before reading chatId/characterId
        // 500ms provides reliable context stabilization after chat switch
        setTimeout(() => {
            applyBindingForCurrentContext();
        }, 500);
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

/**
 * Reset the default toggle state capture.
 * Useful when user changes their base preset and wants to recapture.
 * 
 * @returns {boolean} Whether defaults were successfully recaptured
 */
export function recaptureDefaultToggleState() {
    isCurrentlyOnDefaults = false;
    return captureDefaultToggleState();
}

/**
 * Check if we're currently on the default toggle state.
 * @returns {boolean}
 */
export function isOnDefaultToggles() {
    return isCurrentlyOnDefaults;
}
