
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
        if (!manager) return null;

        // Get the name of the currently active preset
        const presetName = manager.getSelectedPresetName();
        
        // Get the full settings object (includes parameters and prompts)
        const settings = manager.getPresetSettings(presetName);
        
        if (!settings) return null;

        // Return a deep copy to ensure we don't mutate state accidentally
        return {
            name: presetName,
            settings: structuredClone(settings)
        };
    }

    /**
     * Get all available preset names
     * @returns {string[]}
     */
    getAvailablePresets() {
        const manager = this.getManager();
        if (!manager) return [];
        
        // SillyTavern's manager.presets is usually an object where keys are names
        // or a list depending on version, but typically available via getPresetNames() or keys
        // The manager usually has a `presets` property.
        if (manager.presets) {
             return Object.keys(manager.presets).sort();
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
        await manager.selectPreset(name);
        return true;
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
