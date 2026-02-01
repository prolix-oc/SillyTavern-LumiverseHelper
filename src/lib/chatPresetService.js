
import { getContext, getChatMetadata, getSaveSettingsDebounced } from "../stContext.js";
import {
    getToggleStateNames,
    getToggleStateRegistry,
    upsertToggleState,
    getToggleState,
    removeToggleState,
    getChatToggleBinding,
    getCharacterToggleBinding,
    setChatToggleBinding,
    setCharacterToggleBinding,
    clearChatToggleBinding as clearChatToggleBindingCache,
    clearCharacterToggleBinding as clearCharacterToggleBindingCache,
} from "./packCache.js";

const API_ID = 'openai';

// Metadata keys for storing toggle states (deprecated - kept for migration reference)
const CHAT_TOGGLE_STATE_KEY = 'lumiverse_prompt_toggles';
const CHAR_TOGGLE_STATES_KEY = 'lumiverse_character_toggles'; // Stored in extension settings

/**
 * Service for interacting with SillyTavern's Chat Completion Preset Manager.
 * Allows getting current settings, editing prompts, and saving changes.
 */
export class ChatPresetService {
    constructor() {
        // We get the context dynamically to ensure it's available
        this.context = getContext();
    }

    /**
     * Get the preset manager instance
     */
    getManager() {
        if (!this.context) {
            this.context = getContext();
        }
        return this.context?.getPresetManager(API_ID);
    }

    /**
     * Pull the current preset configuration
     * @returns {{name: string, settings: object}|null}
     */
    getCurrentPreset() {
        const manager = this.getManager();
        if (!manager) {
            console.warn('[ChatPresetService] Manager not found for API_ID:', API_ID);
            return null;
        }

        // Get the name of the currently active preset
        const presetName = manager.getSelectedPresetName();
        console.log('[ChatPresetService] Active preset name:', presetName);
        
        let settings = null;

        // Workaround for SillyTavern issue where getPresetSettings('openai') fails
        // We prefer getPresetList().settings for OpenAI as it returns the live object
        if (API_ID === 'openai') {
            const list = manager.getPresetList();
            if (list && list.settings) {
                console.log('[ChatPresetService] Using getPresetList().settings for OpenAI');
                settings = list.settings;
            }
        }

        // Fallback or for other APIs
        if (!settings) {
            settings = manager.getPresetSettings(presetName);
        }
        
        console.log('[ChatPresetService] Raw settings found:', !!settings, settings ? Object.keys(settings) : 'null');
        
        if (!settings) return null;

        // Ensure prompts array exists
        if (!Array.isArray(settings.prompts)) {
            console.warn('[ChatPresetService] Prompts array missing or invalid in settings, defaulting to empty');
            settings.prompts = [];
        }

        // Return a deep copy to ensure we don't mutate state accidentally
        try {
            return {
                name: presetName,
                settings: structuredClone(settings)
            };
        } catch (e) {
            console.error('[ChatPresetService] structuredClone failed:', e);
            // Fallback: shallow copy + manual copy of prompts
            return {
                name: presetName,
                settings: {
                    ...settings,
                    prompts: settings.prompts.map(p => ({ ...p }))
                }
            };
        }
    }

    /**
     * Get all available preset names
     * @returns {string[]}
     */
    getAvailablePresets() {
        const manager = this.getManager();
        if (!manager) return [];
        
        if (typeof manager.getAllPresets === 'function') {
            return manager.getAllPresets();
        }

        // Fallback using getPresetList if getAllPresets fails/missing
        const list = manager.getPresetList();
        if (list && list.preset_names) {
            if (Array.isArray(list.preset_names)) return list.preset_names;
            return Object.keys(list.preset_names);
        }

        return [];
    }

    /**
     * Select a preset by name
     * @param {string} name 
     */
    async selectPreset(name) {
        const manager = this.getManager();
        if (!manager) return false;
        
        // Use findPreset to get value, then selectPreset
        const value = manager.findPreset(name);
        if (value) {
            manager.selectPreset(value);
            return true;
        }
        return false;
    }

    /**
     * Export preset as JSON string
     * @param {string} name (Optional) name to export, defaults to current
     * @returns {string|null} JSON string
     */
    exportPreset(name) {
        const current = this.getCurrentPreset();
        if (!current || !current.settings) return null;
        
        // If name matches current, return current settings
        if (!name || name === current.name) {
            return JSON.stringify(current.settings, null, 4);
        }

        // Otherwise fetch specific preset
        const manager = this.getManager();
        const settings = manager.getCompletionPresetByName(name);
        if (settings) {
             return JSON.stringify(settings, null, 4);
        }
        return null;
    }

    /**
     * Create a new preset
     * @param {string} name 
     * @param {object} data 
     */
    async createPreset(name, data) {
        const manager = this.getManager();
        if (!manager) return false;
        await manager.savePreset(name, data);
        return true;
    }

    /**
     * Delete a preset
     * @param {string} name 
     */
    async deletePreset(name) {
        const manager = this.getManager();
        if (!manager) return false;
        await manager.deletePreset(name);
        return true;
    }

    /**
     * Save the entire preset settings
     * @param {string} name 
     * @param {object} settings 
     */
    async savePreset(name, settings) {
        const manager = this.getManager();
        if (!manager) return false;
        try {
            await manager.savePreset(name, settings);
            return true;
        } catch (error) {
            console.error('Failed to save preset:', error);
            return false;
        }
    }

    /**
     * Update the prompts list for the current preset
     * @param {Array} newPrompts 
     */
    async updatePrompts(newPrompts) {
        const current = this.getCurrentPreset();
        if (!current) return false;

        const { name, settings } = current;
        settings.prompts = newPrompts;

        return await this.savePreset(name, settings);
    }

    // =========================================================================
    // TOGGLE STATE OPERATIONS
    // =========================================================================

    /**
     * Get all saved toggle state names
     * @returns {string[]}
     */
    getToggleStateNames() {
        return getToggleStateNames();
    }

    /**
     * Get the toggle state registry with metadata
     * @returns {Object}
     */
    getToggleStateRegistry() {
        return getToggleStateRegistry();
    }

    /**
     * Capture current prompts' enabled states and save as a toggle state
     * @param {string} stateName - User-provided name for the state
     * @param {Array} prompts - Current prompts array
     * @returns {Promise<void>}
     */
    async saveToggleState(stateName, prompts) {
        const current = this.getCurrentPreset();
        const sourcePreset = current?.name || null;

        // Build toggle map: identifier -> enabled
        const toggles = {};
        for (const prompt of prompts) {
            const key = prompt.identifier || prompt.name;
            if (key) {
                toggles[key] = prompt.enabled !== false;
            }
        }

        await upsertToggleState(stateName, toggles, sourcePreset);
        console.log(`[ChatPresetService] Saved toggle state "${stateName}" with ${Object.keys(toggles).length} prompts`);
    }

    /**
     * Load a toggle state by name
     * @param {string} stateName 
     * @returns {Promise<Object|null>} Toggle state data
     */
    async loadToggleState(stateName) {
        return await getToggleState(stateName);
    }

    /**
     * Apply a saved toggle state to the given prompts array
     * Returns a new array with enabled states updated for matching prompts
     * @param {string} stateName - The toggle state name to apply
     * @param {Array} prompts - Current prompts array
     * @returns {Promise<{prompts: Array, matched: number, unmatched: number}>}
     */
    async applyToggleState(stateName, prompts) {
        const state = await getToggleState(stateName);
        if (!state?.toggles) {
            return { prompts, matched: 0, unmatched: 0 };
        }

        let matched = 0;
        let unmatched = 0;

        const newPrompts = prompts.map(prompt => {
            const key = prompt.identifier || prompt.name;
            if (key && key in state.toggles) {
                matched++;
                return { ...prompt, enabled: state.toggles[key] };
            }
            unmatched++;
            return prompt;
        });

        console.log(`[ChatPresetService] Applied toggle state "${stateName}": ${matched} matched, ${unmatched} unmatched`);
        return { prompts: newPrompts, matched, unmatched };
    }

    /**
     * Delete a saved toggle state
     * @param {string} stateName 
     * @returns {Promise<void>}
     */
    async deleteToggleState(stateName) {
        await removeToggleState(stateName);
        console.log(`[ChatPresetService] Deleted toggle state "${stateName}"`);
    }

    // =========================================================================
    // CHAT-SPECIFIC TOGGLE STATE OPERATIONS
    // =========================================================================

    /**
     * Get the current chat ID.
     * @returns {string|null}
     */
    getCurrentChatId() {
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
     * Save current prompts' enabled states to the current chat.
     * This creates a per-chat override that is automatically applied when
     * switching to this chat. Persisted to the Lumiverse index file.
     * @param {Array} prompts - Current prompts array
     * @returns {Promise<boolean>} Success status
     */
    async saveToggleStateToChat(prompts) {
        const chatId = this.getCurrentChatId();
        if (!chatId) {
            console.warn('[ChatPresetService] No chat ID available');
            return false;
        }

        // Build toggle map: identifier -> enabled
        const toggles = {};
        for (const prompt of prompts) {
            const key = prompt.identifier || prompt.name;
            if (key) {
                toggles[key] = prompt.enabled !== false;
            }
        }

        // Store in packCache (persisted to index file)
        setChatToggleBinding(chatId, {
            toggles,
            sourcePreset: this.getCurrentPreset()?.name || null,
        });

        console.log(`[ChatPresetService] Saved toggle state to chat "${chatId}" with ${Object.keys(toggles).length} prompts`);
        return true;
    }

    /**
     * Get the toggle state stored for the current chat.
     * @returns {Object|null} Toggle state data or null if not set
     */
    getChatToggleState() {
        const chatId = this.getCurrentChatId();
        if (!chatId) return null;
        return getChatToggleBinding(chatId);
    }

    /**
     * Clear the toggle state from the current chat.
     * @returns {boolean} Success status
     */
    clearChatToggleState() {
        const chatId = this.getCurrentChatId();
        if (!chatId) return false;

        clearChatToggleBindingCache(chatId);
        console.log(`[ChatPresetService] Cleared toggle state for chat "${chatId}"`);
        return true;
    }

    /**
     * Check if the current chat has a toggle state saved.
     * @returns {boolean}
     */
    hasChatToggleState() {
        return this.getChatToggleState() !== null;
    }

    // =========================================================================
    // CHARACTER-SPECIFIC TOGGLE STATE OPERATIONS
    // =========================================================================

    /**
     * Get the current character's avatar name.
     * @returns {string|null}
     */
    getCurrentCharacterAvatar() {
        const ctx = getContext();
        if (!ctx || ctx.characterId === undefined || ctx.characterId === null) {
            return null;
        }
        return ctx.characters?.[ctx.characterId]?.avatar || null;
    }

    /**
     * Save current prompts' enabled states for the current character.
     * This creates a per-character override that is automatically applied
     * when switching to any chat with this character. Persisted to the Lumiverse index file.
     * @param {Array} prompts - Current prompts array
     * @returns {Promise<boolean>} Success status
     */
    async saveToggleStateToCharacter(prompts) {
        const avatar = this.getCurrentCharacterAvatar();
        if (!avatar) {
            console.warn('[ChatPresetService] No character avatar available');
            return false;
        }

        // Build toggle map: identifier -> enabled
        const toggles = {};
        for (const prompt of prompts) {
            const key = prompt.identifier || prompt.name;
            if (key) {
                toggles[key] = prompt.enabled !== false;
            }
        }

        // Store in packCache (persisted to index file)
        setCharacterToggleBinding(avatar, {
            toggles,
            sourcePreset: this.getCurrentPreset()?.name || null,
        });

        console.log(`[ChatPresetService] Saved toggle state for character "${avatar}" with ${Object.keys(toggles).length} prompts`);
        return true;
    }

    /**
     * Get the toggle state for the current character.
     * @returns {Object|null} Toggle state data or null if not set
     */
    getCharacterToggleState() {
        const avatar = this.getCurrentCharacterAvatar();
        if (!avatar) return null;
        return getCharacterToggleBinding(avatar);
    }

    /**
     * Get the toggle state for a specific character by avatar.
     * @param {string} avatar - Character avatar filename
     * @returns {Object|null} Toggle state data or null if not set
     */
    getCharacterToggleStateByAvatar(avatar) {
        if (!avatar) return null;
        return getCharacterToggleBinding(avatar);
    }

    /**
     * Clear the toggle state for the current character.
     * @returns {boolean} Success status
     */
    clearCharacterToggleState() {
        const avatar = this.getCurrentCharacterAvatar();
        if (!avatar) return false;

        clearCharacterToggleBindingCache(avatar);
        console.log(`[ChatPresetService] Cleared toggle state for character "${avatar}"`);
        return true;
    }

    /**
     * Check if the current character has a toggle state saved.
     * @returns {boolean}
     */
    hasCharacterToggleState() {
        return this.getCharacterToggleState() !== null;
    }

    /**
     * Apply toggle state from raw toggle data (used by binding service).
     * @param {Object} toggleData - Object with { toggles: { identifier: boolean } }
     * @param {Array} prompts - Current prompts array
     * @returns {{prompts: Array, matched: number, unmatched: number}}
     */
    applyToggleData(toggleData, prompts) {
        if (!toggleData?.toggles) {
            return { prompts, matched: 0, unmatched: 0 };
        }

        let matched = 0;
        let unmatched = 0;

        const newPrompts = prompts.map(prompt => {
            const key = prompt.identifier || prompt.name;
            if (key && key in toggleData.toggles) {
                matched++;
                return { ...prompt, enabled: toggleData.toggles[key] };
            }
            unmatched++;
            return prompt;
        });

        return { prompts: newPrompts, matched, unmatched };
    }

    // =========================================================================
    // PROMPT ORDER TOGGLE OPERATIONS (Runtime State)
    // =========================================================================

    /**
     * Get the active character ID for prompt_order access.
     * For Global Strategy, returns dummy ID 100001.
     * For Character-specific, returns the actual character ID.
     * @returns {{activeCharId: number, isGlobal: boolean}|null}
     */
    getActivePromptOrderCharacterId() {
        const ctx = getContext();
        const oaiSettings = ctx?.chatCompletionSettings;
        
        if (!oaiSettings) {
            console.warn('[ChatPresetService] chatCompletionSettings not available');
            return null;
        }

        const OPENAI_DUMMY_ID = 100001;
        const isGlobal = !oaiSettings.prompt_manager_settings?.showCharacterPromptOrder;
        const activeCharId = isGlobal ? OPENAI_DUMMY_ID : ctx?.characterId;

        return { activeCharId, isGlobal };
    }

    /**
     * Get the prompt_order entry for the active character.
     * @returns {Object|null} The order entry with { character_id, order: [...] }
     */
    getActivePromptOrderEntry() {
        const ctx = getContext();
        const oaiSettings = ctx?.chatCompletionSettings;
        
        if (!oaiSettings?.prompt_order) {
            return null;
        }

        const charInfo = this.getActivePromptOrderCharacterId();
        if (!charInfo) return null;

        return oaiSettings.prompt_order.find(entry => entry.character_id === charInfo.activeCharId);
    }

    /**
     * Toggle a single prompt's enabled state in the runtime prompt_order.
     * This is the CORRECT way to toggle prompts per SillyTavern documentation.
     * 
     * @param {string} promptId - The prompt identifier
     * @param {boolean} enabled - Whether to enable or disable
     * @returns {boolean} Whether the toggle was successful
     */
    setPromptEnabled(promptId, enabled) {
        const orderEntry = this.getActivePromptOrderEntry();
        if (!orderEntry?.order) {
            console.warn('[ChatPresetService] No prompt_order entry found');
            return false;
        }

        const orderItem = orderEntry.order.find(item => item.identifier === promptId);
        if (!orderItem) {
            console.warn(`[ChatPresetService] Prompt "${promptId}" not found in prompt_order`);
            return false;
        }

        orderItem.enabled = enabled;
        return true;
    }

    /**
     * Apply multiple toggle states to the runtime prompt_order.
     * This modifies the live prompt_order and triggers UI refresh.
     * 
     * @param {Object} toggles - Object mapping { identifier: boolean }
     * @returns {{matched: number, unmatched: number}}
     */
    applyTogglesToPromptOrder(toggles) {
        if (!toggles || typeof toggles !== 'object') {
            return { matched: 0, unmatched: 0 };
        }

        const orderEntry = this.getActivePromptOrderEntry();
        if (!orderEntry?.order) {
            console.warn('[ChatPresetService] No prompt_order entry found');
            return { matched: 0, unmatched: 0 };
        }

        let matched = 0;
        let unmatched = 0;

        for (const [promptId, enabled] of Object.entries(toggles)) {
            const orderItem = orderEntry.order.find(item => item.identifier === promptId);
            if (orderItem) {
                orderItem.enabled = enabled;
                matched++;
            } else {
                unmatched++;
            }
        }

        return { matched, unmatched };
    }

    /**
     * Trigger UI refresh after modifying prompt_order.
     * Since PromptManager.render() is not exposed, we use jQuery workaround.
     */
    refreshPromptManagerUI() {
        if (typeof jQuery !== 'undefined') {
            jQuery('#update_oai_preset').trigger('click');
        }

        // Also save settings
        const ctx = getContext();
        if (typeof ctx?.saveSettingsDebounced === 'function') {
            ctx.saveSettingsDebounced();
        }
    }

    /**
     * Reset prompts to the default enabled states from the current preset.
     * This ensures a "clean slate" before applying per-chat/character toggle bindings.
     * 
     * IMPORTANT: This method resets the runtime prompt_order to match the preset's
     * default toggle states, preventing "leakage" from one context to another.
     * 
     * @returns {boolean} Whether the reset was successful
     */
    resetPromptsToDefault() {
        const current = this.getCurrentPreset();
        if (!current?.settings?.prompts) {
            console.warn('[ChatPresetService] Cannot reset - no current preset or prompts');
            return false;
        }

        const orderEntry = this.getActivePromptOrderEntry();
        if (!orderEntry?.order) {
            console.warn('[ChatPresetService] Cannot reset - no prompt_order entry');
            return false;
        }

        // Build a map of prompt identifier -> default enabled state from the preset
        const defaultStates = {};
        for (const prompt of current.settings.prompts) {
            const key = prompt.identifier || prompt.name;
            if (key) {
                // Default to enabled if not explicitly set to false
                defaultStates[key] = prompt.enabled !== false;
            }
        }

        // Apply default states to the runtime prompt_order
        let resetCount = 0;
        for (const orderItem of orderEntry.order) {
            if (orderItem.identifier && orderItem.identifier in defaultStates) {
                orderItem.enabled = defaultStates[orderItem.identifier];
                resetCount++;
            }
        }

        console.log(`[ChatPresetService] Reset ${resetCount} prompts to default enabled states`);
        return resetCount > 0;
    }

    /**
     * Apply a saved toggle state to the runtime prompt_order (not to preset file).
     * This is the correct method for applying toggle states at runtime.
     * 
     * @param {string} stateName - The toggle state name to apply
     * @returns {Promise<{applied: boolean, matched: number, unmatched: number}>}
     */
    async applyToggleStateToRuntime(stateName) {
        const state = await getToggleState(stateName);
        if (!state?.toggles) {
            return { applied: false, matched: 0, unmatched: 0 };
        }

        const result = this.applyTogglesToPromptOrder(state.toggles);
        
        if (result.matched > 0) {
            this.refreshPromptManagerUI();
            console.log(`[ChatPresetService] Applied toggle state "${stateName}" to runtime: ${result.matched} matched, ${result.unmatched} unmatched`);
            return { applied: true, ...result };
        }

        return { applied: false, ...result };
    }

    /**
     * Capture current prompt_order toggle states.
     * Reads from runtime prompt_order, not from the prompts array.
     * 
     * @returns {Object|null} Object mapping { identifier: boolean }
     */
    captureCurrentToggles() {
        const orderEntry = this.getActivePromptOrderEntry();
        if (!orderEntry?.order) {
            return null;
        }

        const toggles = {};
        for (const item of orderEntry.order) {
            if (item.identifier) {
                toggles[item.identifier] = item.enabled !== false;
            }
        }

        return toggles;
    }
}

export const chatPresetService = new ChatPresetService();
