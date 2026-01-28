
import { getContext } from "../stContext.js";

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
}

export const chatPresetService = new ChatPresetService();
