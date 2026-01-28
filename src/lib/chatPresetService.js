
import { getContext } from "../stContext.js";
import {
    getToggleStateNames,
    getToggleStateRegistry,
    upsertToggleState,
    getToggleState,
    removeToggleState,
} from "./packCache.js";

const API_ID = 'openai';

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
}

export const chatPresetService = new ChatPresetService();
