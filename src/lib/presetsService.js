/**
 * Presets Service Module
 * Handles downloading and importing Chat Completion presets from Lucid.cards API
 * Also provides utilities for Reasoning (CoT) and Start Reply With settings
 */

import { getContext } from "../stContext.js";
import { getSettings, saveSettings } from "./settingsManager.js";

export const MODULE_NAME = "presets-service";
const LUCID_API_BASE = "https://lucid.cards";

// --- Version Tracking ---

/**
 * Compare two semantic versions
 * @param {Object} v1 - Version object { major, minor, patch }
 * @param {Object} v2 - Version object { major, minor, patch }
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
    if (!v1 || !v2) return 0;
    
    if (v1.major !== v2.major) return v1.major < v2.major ? -1 : 1;
    if (v1.minor !== v2.minor) return v1.minor < v2.minor ? -1 : 1;
    if (v1.patch !== v2.patch) return v1.patch < v2.patch ? -1 : 1;
    return 0;
}

/**
 * Format a version object as a string
 * @param {Object} version - Version object { major, minor, patch }
 * @returns {string} Formatted version string
 */
export function formatVersion(version) {
    if (!version) return "unknown";
    return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Track an imported preset version in settings
 * @param {string} presetSlug - Preset slug identifier
 * @param {Object} presetInfo - Preset metadata from API
 * @param {Object} versionInfo - Version metadata { name, version: { major, minor, patch } }
 */
export function trackPresetVersion(presetSlug, presetInfo, versionInfo) {
    const settings = getSettings();
    
    if (!settings.trackedPresets) {
        settings.trackedPresets = {};
    }
    
    settings.trackedPresets[presetSlug] = {
        name: presetInfo?.name || presetSlug,
        version: versionInfo?.version || null,
        versionName: versionInfo?.name || "unknown",
        importedAt: Date.now(),
    };
    
    saveSettings();
    console.log(`[${MODULE_NAME}] Tracked preset: ${presetSlug} v${formatVersion(versionInfo?.version)}`);
}

/**
 * Get all tracked presets
 * @returns {Object} Map of preset slugs to tracked version info
 */
export function getTrackedPresets() {
    const settings = getSettings();
    return settings.trackedPresets || {};
}

/**
 * Fetch latest version info for a single preset
 * @param {string} presetSlug - Preset slug
 * @returns {Promise<Object|null>} Latest version info or null
 */
async function fetchLatestVersionInfo(presetSlug) {
    try {
        const response = await fetch(
            `${LUCID_API_BASE}/api/download/chat-presets/${presetSlug}/latest`
        );
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        if (!data.success) {
            return null;
        }
        return data.version || null;
    } catch {
        return null;
    }
}

/**
 * Check for preset updates by comparing tracked versions with latest available
 * Uses individual /latest endpoint for each tracked preset for efficiency
 * @returns {Promise<Array<{slug: string, name: string, currentVersion: Object, latestVersion: Object, latestVersionName: string}>>}
 */
export async function checkForPresetUpdates() {
    const tracked = getTrackedPresets();
    const trackedSlugs = Object.keys(tracked);
    
    if (trackedSlugs.length === 0) {
        return [];
    }
    
    const updates = [];
    
    // Check each tracked preset in parallel
    const checks = trackedSlugs.map(async (slug) => {
        const trackedInfo = tracked[slug];
        const latestInfo = await fetchLatestVersionInfo(slug);
        
        if (!latestInfo?.version) {
            return null;
        }
        
        const latestVersion = latestInfo.version;
        const currentVersion = trackedInfo.version;
        
        // Compare versions
        if (compareVersions(currentVersion, latestVersion) < 0) {
            return {
                slug,
                name: trackedInfo.name,
                currentVersion,
                latestVersion,
                latestVersionName: latestInfo.name || formatVersion(latestVersion),
            };
        }
        return null;
    });
    
    try {
        const results = await Promise.all(checks);
        return results.filter(Boolean);
    } catch (error) {
        console.error(`[${MODULE_NAME}] Failed to check for updates:`, error);
        return [];
    }
}

/**
 * Remove a preset from tracking
 * @param {string} presetSlug - Preset slug to stop tracking
 */
export function untrackPreset(presetSlug) {
    const settings = getSettings();
    if (settings.trackedPresets && settings.trackedPresets[presetSlug]) {
        delete settings.trackedPresets[presetSlug];
        saveSettings();
    }
}

/**
 * Fetch all available presets from Lucid.cards
 * @returns {Promise<Object>} Presets list response
 */
export async function fetchAvailablePresets() {
    try {
        const response = await fetch(`${LUCID_API_BASE}/api/download/chat-presets`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || "Unknown API error");
        }
        return data;
    } catch (error) {
        console.error(`[${MODULE_NAME}] Failed to fetch presets:`, error);
        throw error;
    }
}

/**
 * Download a specific preset version from Lucid.cards
 * @param {string} presetSlug - Preset slug (e.g., "lucid")
 * @param {string} versionSlug - Version slug (e.g., "v5-5", "latest")
 * @returns {Promise<Object>} Preset data response with full preset JSON in .data
 */
export async function downloadPreset(presetSlug, versionSlug = "latest") {
    try {
        const response = await fetch(
            `${LUCID_API_BASE}/api/download/chat-presets/${presetSlug}/${versionSlug}`
        );
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || "Preset download failed");
        }
        return data;
    } catch (error) {
        console.error(`[${MODULE_NAME}] Failed to download preset:`, error);
        throw error;
    }
}

// --- Preset Type Detection Helpers ---
// Based on SillyTavern's PresetManager detection logic

/**
 * Check if data looks like an Instruct Mode preset
 * @param {Object} data - Preset data to check
 * @returns {boolean}
 */
function isPossiblyInstructData(data) {
    const instructProps = ["input_sequence", "output_sequence"];
    return data && instructProps.every((prop) => Object.keys(data).includes(prop));
}

/**
 * Check if data looks like a Context Template preset
 * @param {Object} data - Preset data to check
 * @returns {boolean}
 */
function isPossiblyContextData(data) {
    const contextProps = ["story_string"];
    return data && contextProps.every((prop) => Object.keys(data).includes(prop));
}

/**
 * Check if data looks like a Chat/API Completion preset
 * @param {Object} data - Preset data to check
 * @returns {boolean}
 */
function isPossiblyTextCompletionData(data) {
    if (!data) return false;
    const keys = Object.keys(data);

    // Check for 'temp' OR 'temperature' OR temp_openai
    const hasTemp =
        keys.includes("temp") ||
        keys.includes("temperature") ||
        keys.includes("temp_openai");

    // Check for other key markers (one of these should exist to confirm it's a preset)
    const otherMarkers = [
        "top_p",
        "top_k",
        "rep_pen",
        "repetition_penalty",
        "frequency_penalty",
        "freq_pen_openai",
        "openai_model",
        "top_p_openai",
    ];
    const hasOtherMarker = otherMarkers.some((marker) => keys.includes(marker));

    return hasTemp && hasOtherMarker;
}

/**
 * Check if data looks like a Reasoning/CoT preset
 * @param {Object} data - Preset data to check
 * @returns {boolean}
 */
function isPossiblyReasoningData(data) {
    const reasoningProps = ["prefix", "suffix", "separator"];
    return data && reasoningProps.every((prop) => Object.keys(data).includes(prop));
}

/**
 * Import a preset into SillyTavern
 * Automatically detects preset type
 * 
 * @param {Object} presetData - The preset JSON data
 * @param {string} presetName - Name to save the preset as
 * @param {Object} options - Import options
 * @param {boolean} options.activate - Whether to activate the preset after import
 * @returns {Promise<{success: boolean, type: string, message: string}>}
 */
export async function importPreset(presetData, presetName, options = {}) {
    const { activate = false } = options;
    const context = getContext();

    if (!context) {
        return { success: false, type: "none", message: "SillyTavern context not available" };
    }

    try {
        // 1. Instruct Template
        if (isPossiblyInstructData(presetData)) {
            const manager = context.getPresetManager("instruct");
            await manager.savePreset(presetData.name || presetName, presetData);
            if (activate) {
                await manager.selectPreset(presetData.name || presetName);
            }
            context.saveSettingsDebounced();
            return { success: true, type: "instruct", message: "Imported Instruct Preset" };
        }

        // 2. Context Template
        if (isPossiblyContextData(presetData)) {
            const manager = context.getPresetManager("context");
            await manager.savePreset(presetData.name || presetName, presetData);
            if (activate) {
                await manager.selectPreset(presetData.name || presetName);
            }
            context.saveSettingsDebounced();
            return { success: true, type: "context", message: "Imported Context Preset" };
        }

        // 3. Chat/API Completion preset
        if (isPossiblyTextCompletionData(presetData)) {
            // Ensure mistralai_model exists (required by ST core)
            if (typeof presetData.mistralai_model === "undefined") {
                presetData.mistralai_model = "";
            }
            const manager = context.getPresetManager("openai");
            await manager.savePreset(presetName, presetData);
            if (activate) {
                await manager.selectPreset(presetName);
            }
            context.saveSettingsDebounced();
            return { success: true, type: "openai", message: "Imported API Preset" };
        }

        // 4. Reasoning Template
        if (isPossiblyReasoningData(presetData)) {
            const manager = context.getPresetManager("reasoning");
            await manager.savePreset(presetData.name || presetName, presetData);
            if (activate) {
                await manager.selectPreset(presetData.name || presetName);
            }
            context.saveSettingsDebounced();
            return { success: true, type: "reasoning", message: "Imported Reasoning Preset" };
        }

        // 5. Master Import (multiple sections)
        let importedCount = 0;
        const importedTypes = [];

        if (presetData.instruct && isPossiblyInstructData(presetData.instruct)) {
            const manager = context.getPresetManager("instruct");
            await manager.savePreset(presetData.instruct.name || `${presetName}_instruct`, presetData.instruct);
            importedCount++;
            importedTypes.push("instruct");
        }

        if (presetData.context && isPossiblyContextData(presetData.context)) {
            const manager = context.getPresetManager("context");
            await manager.savePreset(presetData.context.name || `${presetName}_context`, presetData.context);
            importedCount++;
            importedTypes.push("context");
        }

        if (presetData.reasoning && isPossiblyReasoningData(presetData.reasoning)) {
            const manager = context.getPresetManager("reasoning");
            await manager.savePreset(presetData.reasoning.name || `${presetName}_reasoning`, presetData.reasoning);
            importedCount++;
            importedTypes.push("reasoning");
        }

        if (presetData.preset && isPossiblyTextCompletionData(presetData.preset)) {
            // Ensure mistralai_model exists (required by ST core)
            if (typeof presetData.preset.mistralai_model === "undefined") {
                presetData.preset.mistralai_model = "";
            }
            const manager = context.getPresetManager("openai");
            await manager.savePreset(presetData.preset.name || presetName, presetData.preset);
            importedCount++;
            importedTypes.push("openai");
        }

        if (importedCount > 0) {
            context.saveSettingsDebounced();
            return {
                success: true,
                type: "master",
                message: `Imported ${importedCount} preset(s): ${importedTypes.join(", ")}`,
            };
        }

        return { success: false, type: "unknown", message: "Unknown preset format" };

    } catch (error) {
        console.error(`[${MODULE_NAME}] Import error:`, error);
        return { success: false, type: "error", message: error.message };
    }
}

/**
 * Download and import a preset from Lucid.cards in one step
 * Automatically tracks the imported version for update notifications
 * @param {string} presetSlug - Preset slug
 * @param {string} versionSlug - Version slug (default: "latest")
 * @param {Object} options - Import options
 * @param {boolean} options.activate - Whether to activate the preset after import
 * @param {boolean} options.trackVersion - Whether to track for update notifications (default: true)
 * @returns {Promise<{success: boolean, type: string, message: string, presetInfo?: Object}>}
 */
export async function downloadAndImportPreset(presetSlug, versionSlug = "latest", options = {}) {
    const { trackVersion = true, ...importOptions } = options;
    
    try {
        // Download from API
        const response = await downloadPreset(presetSlug, versionSlug);
        
        if (!response.data) {
            throw new Error("No preset data in API response");
        }

        // Build preset name from response metadata
        const presetName = response.version?.name || 
                          response.preset?.latestVersion?.name || 
                          `${presetSlug} ${versionSlug}`;

        // Import into SillyTavern
        const result = await importPreset(response.data, presetName, importOptions);

        // Track the version for update notifications if import succeeded
        if (result.success && trackVersion && response.version) {
            trackPresetVersion(presetSlug, response.preset, response.version);
        }

        return {
            ...result,
            presetInfo: response.preset,
            versionInfo: response.version,
        };

    } catch (error) {
        console.error(`[${MODULE_NAME}] Download and import failed:`, error);
        return { success: false, type: "error", message: error.message };
    }
}

// --- Reasoning / Chain of Thought Settings ---

/**
 * Configure Reasoning (Chain of Thought) settings
 * @param {Object} config - Reasoning configuration
 * @param {boolean} config.autoParse - Enable automatic thought block parsing
 * @param {string} config.prefix - Opening delimiter (e.g., "<think>")
 * @param {string} config.suffix - Closing delimiter (e.g., "</think>")
 * @param {boolean} config.showHidden - Show collapsed thought blocks
 * @param {boolean} config.autoExpand - Auto-expand thought blocks
 * @param {boolean} config.addToPrompts - Send previous thoughts in context
 */
export function configureReasoning(config) {
    const context = getContext();
    if (!context) {
        console.warn(`[${MODULE_NAME}] Context not available for reasoning config`);
        return;
    }

    const power_user = context.powerUserSettings;
    if (!power_user || !power_user.reasoning) {
        console.warn(`[${MODULE_NAME}] Reasoning settings not available`);
        return;
    }

    // Apply configuration
    if (config.autoParse !== undefined) power_user.reasoning.auto_parse = config.autoParse;
    if (config.prefix !== undefined) power_user.reasoning.prefix = config.prefix;
    if (config.suffix !== undefined) power_user.reasoning.suffix = config.suffix;
    if (config.showHidden !== undefined) power_user.reasoning.show_hidden = config.showHidden;
    if (config.autoExpand !== undefined) power_user.reasoning.auto_expand = config.autoExpand;
    if (config.addToPrompts !== undefined) power_user.reasoning.add_to_prompts = config.addToPrompts;

    context.saveSettingsDebounced();
    console.log(`[${MODULE_NAME}] Reasoning settings updated`);
}

/**
 * Get current reasoning settings
 * @returns {Object|null} Current reasoning configuration
 */
export function getReasoningSettings() {
    const context = getContext();
    if (!context?.powerUserSettings?.reasoning) {
        return null;
    }
    return { ...context.powerUserSettings.reasoning };
}

// --- Start Reply With (Prompt Bias) ---

/**
 * Set the "Start Reply With" text (user prompt bias)
 * This forces the AI to begin its response with specific text
 * 
 * @param {string} text - The text to force as reply start
 * @param {Object} options - Additional options
 * @param {boolean} options.showInUI - Make the field visible in ST settings UI
 */
export function setStartReplyWith(text, options = {}) {
    const { showInUI = true } = options;
    const context = getContext();

    if (!context) {
        console.warn(`[${MODULE_NAME}] Context not available for Start Reply With`);
        return;
    }

    const power_user = context.powerUserSettings;
    if (!power_user) {
        console.warn(`[${MODULE_NAME}] Power user settings not available`);
        return;
    }

    // Set the bias text
    power_user.user_prompt_bias = text;

    // Optionally show the field in UI
    if (showInUI) {
        power_user.show_user_prompt_bias = true;
    }

    // Update the UI input element if it exists (immediate visual feedback)
    const $ = window.jQuery;
    if ($) {
        const $input = $("#start_reply_with");
        if ($input.length) {
            $input.val(text);
        }
    }

    context.saveSettingsDebounced();
    console.log(`[${MODULE_NAME}] Start Reply With set to: "${text.substring(0, 50)}..."`);
}

/**
 * Get the current "Start Reply With" text
 * @returns {string} Current prompt bias text
 */
export function getStartReplyWith() {
    const context = getContext();
    return context?.powerUserSettings?.user_prompt_bias || "";
}

/**
 * Clear the "Start Reply With" text
 */
export function clearStartReplyWith() {
    setStartReplyWith("", { showInUI: false });
}

// --- Preset Templates ---

/**
 * Common reasoning preset configurations
 */
export const REASONING_PRESETS = {
    deepseek: {
        autoParse: true,
        prefix: "<think>",
        suffix: "</think>",
        showHidden: true,
        autoExpand: false,
        addToPrompts: false,
    },
    openai_o1: {
        autoParse: true,
        prefix: "<reasoning>",
        suffix: "</reasoning>",
        showHidden: true,
        autoExpand: false,
        addToPrompts: false,
    },
    claude_extended: {
        autoParse: true,
        prefix: "<thinking>",
        suffix: "</thinking>",
        showHidden: true,
        autoExpand: false,
        addToPrompts: false,
    },
};

/**
 * Apply a named reasoning preset
 * @param {string} presetName - Name of preset (deepseek, openai_o1, claude_extended)
 */
export function applyReasoningPreset(presetName) {
    const preset = REASONING_PRESETS[presetName];
    if (!preset) {
        console.warn(`[${MODULE_NAME}] Unknown reasoning preset: ${presetName}`);
        return;
    }
    configureReasoning(preset);
}

/**
 * Apply reasoning settings with a matching Start Reply With prompt
 * @param {string} presetName - Reasoning preset name
 * @param {string} customBias - Optional custom bias text (defaults to preset prefix)
 */
export function applyReasoningWithBias(presetName, customBias = null) {
    const preset = REASONING_PRESETS[presetName];
    if (!preset) {
        console.warn(`[${MODULE_NAME}] Unknown reasoning preset: ${presetName}`);
        return;
    }

    // Apply reasoning settings
    configureReasoning(preset);

    // Set Start Reply With to the opening tag
    const biasText = customBias || `${preset.prefix}\n`;
    setStartReplyWith(biasText);
}
