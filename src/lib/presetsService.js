/**
 * Presets Service Module
 * Handles downloading and importing Chat Completion presets from Lucid.cards API
 * Also provides utilities for Reasoning (CoT) and Start Reply With settings
 */

import { getContext } from "../stContext.js";
import { getSettings, saveSettings } from "./settingsManager.js";

export const MODULE_NAME = "presets-service";
const LUCID_API_BASE = "https://lucid.cards";

// --- Event Emitter for Preset Tracking Changes ---
// Allows UI components to subscribe to real-time tracking updates

const trackingListeners = new Set();

/**
 * Subscribe to preset tracking changes
 * @param {Function} listener - Callback invoked when tracked presets change
 * @returns {Function} Unsubscribe function
 */
export function subscribeToTrackingChanges(listener) {
    trackingListeners.add(listener);
    return () => trackingListeners.delete(listener);
}

/**
 * Notify all listeners of a tracking change
 * @private
 */
function notifyTrackingChange() {
    const trackedPresets = getTrackedPresets();
    trackingListeners.forEach(listener => {
        try {
            listener(trackedPresets);
        } catch (err) {
            console.error(`[${MODULE_NAME}] Tracking listener error:`, err);
        }
    });
}

// --- Event Emitter for Reasoning Settings Changes ---
// Allows multiple UI components to stay in sync with reasoning state

const reasoningListeners = new Set();

/**
 * Subscribe to reasoning settings changes
 * @param {Function} listener - Callback invoked when reasoning settings change
 * @returns {Function} Unsubscribe function
 */
export function subscribeToReasoningChanges(listener) {
    reasoningListeners.add(listener);
    return () => reasoningListeners.delete(listener);
}

/**
 * Notify all listeners of a reasoning settings change
 * @private
 */
function notifyReasoningChange() {
    const settings = {
        reasoning: getReasoningSettings(),
        startReplyWith: getStartReplyWith(),
        apiReasoning: getAPIReasoningSettings(),
        postProcessing: getPostProcessingValue(),
    };
    reasoningListeners.forEach(listener => {
        try {
            listener(settings);
        } catch (err) {
            console.error(`[${MODULE_NAME}] Reasoning listener error:`, err);
        }
    });
}

/**
 * Get the current prompt post-processing strategy (internal helper)
 * Used by notifyReasoningChange before the exported function is defined
 * @private
 */
function getPostProcessingValue() {
    const context = getContext();
    return context?.chatCompletionSettings?.custom_prompt_post_processing || '';
}

// --- Connection Settings Preservation ---
// These keys represent user connection configuration that should NOT be overwritten by presets
// See: developer_guides/5_safe_preset_importing.md

const CONNECTION_KEYS = [
    // Global Source
    'chat_completion_source',
    
    // Model Selections
    'openai_model',
    'claude_model',
    'openrouter_model',
    'mistralai_model',
    'ai21_model',
    'cohere_model',
    'perplexity_model',
    'groq_model',
    'chutes_model',
    'siliconflow_model',
    'electronhub_model',
    'nanogpt_model',
    'deepseek_model',
    'aimlapi_model',
    'xai_model',
    'pollinations_model',
    'moonshot_model',
    'fireworks_model',
    'cometapi_model',
    'google_model',
    'vertexai_model',
    'zai_model',
    'azure_openai_model',
    'custom_model',

    // Custom Endpoint Config
    'custom_url',
    'custom_include_body',
    'custom_exclude_body',
    'custom_include_headers',
    'custom_prompt_post_processing',

    // OpenRouter Specifics
    'openrouter_use_fallback',
    'openrouter_group_models',
    'openrouter_sort_models',
    'openrouter_providers',
    'openrouter_allow_fallbacks',
    'openrouter_middleout',

    // Azure Specifics
    'azure_base_url',
    'azure_deployment_name',
    'azure_api_version',

    // Vertex AI Specifics
    'vertexai_auth_mode',
    'vertexai_region',
    'vertexai_express_project_id',

    // ZAI Specifics
    'zai_endpoint',

    // Proxy & Auth
    'reverse_proxy',
    'proxy_password',
    'bypass_status_check',
    'show_external_models'
];

// Keys that MUST exist to prevent ST core crashes
const REQUIRED_KEYS = ['mistralai_model'];

/**
 * Hydrates preset data with user's current connection settings to prevent overwrites.
 * This ensures the preset changes settings to what they already are for connection-related keys.
 * @param {Object} importData - The raw preset JSON data
 * @param {Object} currentSettings - The active oai_settings object
 * @returns {Object} Safe preset data ready for import
 */
function hydratePresetWithConnectionSettings(importData, currentSettings) {
    const safeData = { ...importData };

    // Backfill missing connection keys with current user settings
    CONNECTION_KEYS.forEach(key => {
        if (typeof safeData[key] === 'undefined') {
            safeData[key] = currentSettings[key];
        }
    });

    // Ensure required keys exist (fallback to empty string if currentSettings is also missing them)
    REQUIRED_KEYS.forEach(key => {
        if (typeof safeData[key] === 'undefined' || safeData[key] === null) {
            safeData[key] = currentSettings[key] || "";
        }
    });

    return safeData;
}

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
    notifyTrackingChange();
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
        notifyTrackingChange();
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
            // Hydrate preset with user's current connection settings to prevent overwrites
            // ST exposes oai_settings as chatCompletionSettings in context
            const currentSettings = context.chatCompletionSettings || window.oai_settings || {};
            const safePresetData = hydratePresetWithConnectionSettings(presetData, currentSettings);
            
            // Debug: verify hydration added required keys
            console.log(`[${MODULE_NAME}] Hydrated preset has mistralai_model:`, typeof safePresetData.mistralai_model, safePresetData.mistralai_model);
            
            const manager = context.getPresetManager("openai");
            
            // savePreset will store the preset and update openai_settings array
            await manager.savePreset(presetName, safePresetData);
            
            // After save, get the stored preset and patch if needed
            // ST's getCompletionPresetByName returns reference to the stored object
            const storedPreset = manager.getCompletionPresetByName?.(presetName);
            if (storedPreset) {
                console.log(`[${MODULE_NAME}] Stored preset has mistralai_model:`, typeof storedPreset.mistralai_model, storedPreset.mistralai_model);
                // Patch directly on the stored object if missing
                REQUIRED_KEYS.forEach(key => {
                    if (typeof storedPreset[key] === 'undefined') {
                        storedPreset[key] = "";
                        console.log(`[${MODULE_NAME}] Patched stored preset with ${key}`);
                    }
                });
            } else {
                console.warn(`[${MODULE_NAME}] Could not find stored preset to verify`);
            }
            
            if (activate) {
                // ST's migrateChatCompletionSettings reads from openai_settings during preset change
                // Ensure required keys exist on the global to prevent crashes
                REQUIRED_KEYS.forEach(key => {
                    if (currentSettings && typeof currentSettings[key] === "undefined") {
                        currentSettings[key] = "";
                    }
                });
                
                // Allow DOM/state to settle before triggering preset change
                // savePreset's updateList adds the option, but selection may race with it
                await new Promise(resolve => setTimeout(resolve, 50));
                
                // Use findPreset to get the correct option value (numeric index)
                const optionValue = manager.findPreset?.(presetName);
                console.log(`[${MODULE_NAME}] selectPreset - name: "${presetName}", optionValue: "${optionValue}"`);
                
                if (optionValue !== undefined && optionValue !== null) {
                    await manager.selectPreset(optionValue);
                } else {
                    // Fallback to name if findPreset not available
                    await manager.selectPreset(presetName);
                }
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
            // Hydrate preset with user's current connection settings to prevent overwrites
            // ST exposes oai_settings as chatCompletionSettings in context
            const currentSettings = context.chatCompletionSettings || window.oai_settings || {};
            const safePresetData = hydratePresetWithConnectionSettings(presetData.preset, currentSettings);
            const manager = context.getPresetManager("openai");
            await manager.savePreset(safePresetData.name || presetName, safePresetData);
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

        // Extract version info from response
        // API returns: { preset: { latestVersion: { name, version: {major,minor,patch} }, version: {...} } }, data: {...} }
        // When downloading a specific version (not "latest"), use response.preset.version
        // which contains the metadata for the requested version, not latestVersion
        const versionInfo = versionSlug === "latest" 
            ? (response.preset?.latestVersion || response.preset?.version || null)
            : (response.preset?.version || response.preset?.latestVersion || null);
        
        // Build preset name from response metadata
        const presetName = versionInfo?.name || `${presetSlug} ${versionSlug}`;

        // Import into SillyTavern
        const result = await importPreset(response.data, presetName, importOptions);

        // Track the version for update notifications if import succeeded
        console.log(`[${MODULE_NAME}] Import result:`, { 
            success: result.success, 
            trackVersion, 
            hasVersion: !!versionInfo,
            versionInfo
        });
        
        if (result.success && trackVersion) {
            // Track with version info from latestVersion, or fallback
            trackPresetVersion(presetSlug, response.preset, versionInfo || { name: versionSlug, version: null });
        }

        return {
            ...result,
            presetInfo: response.preset,
            versionInfo,
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

    const $ = window.jQuery;

    // Apply configuration to global state AND update UI elements
    if (config.autoParse !== undefined) {
        power_user.reasoning.auto_parse = config.autoParse;
        if ($) $('#reasoning_auto_parse').prop('checked', config.autoParse);
    }
    if (config.prefix !== undefined) {
        power_user.reasoning.prefix = config.prefix;
        if ($) $('#reasoning_prefix').val(config.prefix);
    }
    if (config.suffix !== undefined) {
        power_user.reasoning.suffix = config.suffix;
        if ($) $('#reasoning_suffix').val(config.suffix);
    }
    if (config.showHidden !== undefined) {
        power_user.reasoning.show_hidden = config.showHidden;
        if ($) $('#reasoning_show_hidden').prop('checked', config.showHidden);
    }
    if (config.autoExpand !== undefined) {
        power_user.reasoning.auto_expand = config.autoExpand;
        if ($) $('#reasoning_auto_expand').prop('checked', config.autoExpand);
    }
    if (config.addToPrompts !== undefined) {
        power_user.reasoning.add_to_prompts = config.addToPrompts;
        if ($) $('#reasoning_add_to_prompts').prop('checked', config.addToPrompts);
    }

    context.saveSettingsDebounced();
    console.log(`[${MODULE_NAME}] Reasoning settings updated`);
    notifyReasoningChange();
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
    notifyReasoningChange();
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

// --- API Reasoning Settings (Chat Completion) ---

/**
 * Valid reasoning effort levels
 */
export const REASONING_EFFORT_LEVELS = ['auto', 'low', 'medium', 'high', 'min', 'max'];

/**
 * Get the current API reasoning settings (show_thoughts and reasoning_effort)
 * These control the API request, not the display formatting
 * @returns {{ enabled: boolean, effort: string }}
 */
export function getAPIReasoningSettings() {
    const context = getContext();
    if (!context?.chatCompletionSettings) {
        return { enabled: false, effort: 'auto' };
    }
    return {
        enabled: !!context.chatCompletionSettings.show_thoughts,
        effort: context.chatCompletionSettings.reasoning_effort || 'auto',
    };
}

/**
 * Set whether to include reasoning in API requests
 * @param {boolean} enabled - Whether to request reasoning from supported APIs
 */
export function setIncludeReasoning(enabled) {
    const context = getContext();
    if (!context?.chatCompletionSettings) {
        console.warn(`[${MODULE_NAME}] Chat completion settings not available`);
        return;
    }

    // Update global state
    context.chatCompletionSettings.show_thoughts = !!enabled;

    // Update UI element
    const $ = window.jQuery;
    if ($) {
        $('#openai_show_thoughts').prop('checked', !!enabled);
    }

    // If disabling, reset effort to 'auto' to prevent conflicting params
    if (!enabled) {
        context.chatCompletionSettings.reasoning_effort = 'auto';
        if ($) {
            $('#openai_reasoning_effort').val('auto');
        }
    }

    context.saveSettingsDebounced();
    console.log(`[${MODULE_NAME}] Include Reasoning set to: ${enabled}`);
    notifyReasoningChange();
}

/**
 * Set the reasoning effort level for supported APIs
 * @param {string} level - One of: 'auto', 'low', 'medium', 'high', 'min', 'max'
 */
export function setReasoningEffort(level) {
    const context = getContext();
    if (!context?.chatCompletionSettings) {
        console.warn(`[${MODULE_NAME}] Chat completion settings not available`);
        return;
    }

    // Validate level
    if (!REASONING_EFFORT_LEVELS.includes(level)) {
        console.warn(`[${MODULE_NAME}] Invalid reasoning effort: ${level}`);
        return;
    }

    // Update global state
    context.chatCompletionSettings.reasoning_effort = level;

    // Update UI element
    const $ = window.jQuery;
    if ($) {
        $('#openai_reasoning_effort').val(level);
    }

    context.saveSettingsDebounced();
    console.log(`[${MODULE_NAME}] Reasoning Effort set to: ${level}`);
    notifyReasoningChange();
}

// --- Prompt Post-Processing ---

/**
 * Valid post-processing strategies
 */
export const POST_PROCESSING_OPTIONS = [
    { value: '', label: 'None (Default)' },
    { value: 'merge', label: 'Merge (Recommended for Claude/OpenAI)' },
    { value: 'merge_tools', label: 'Merge (preserve tool calls)' },
    { value: 'semi', label: 'Semi-alternation' },
    { value: 'semi_tools', label: 'Semi-alternation (with tools)' },
    { value: 'strict', label: 'Strict alternation' },
    { value: 'strict_tools', label: 'Strict alternation (with tools)' },
    { value: 'single', label: 'Single (last user message only)' },
];

/**
 * Get the current prompt post-processing strategy
 * @returns {string} Current post-processing value
 */
export function getPostProcessing() {
    const context = getContext();
    return context?.chatCompletionSettings?.custom_prompt_post_processing || '';
}

/**
 * Set the prompt post-processing strategy
 * @param {string} strategy - One of: '', 'merge', 'merge_tools', 'semi', 'semi_tools', 'strict', 'strict_tools', 'single'
 */
export function setPostProcessing(strategy) {
    const context = getContext();
    if (!context?.chatCompletionSettings) {
        console.warn(`[${MODULE_NAME}] Chat completion settings not available`);
        return;
    }

    // Validate strategy
    const validValues = POST_PROCESSING_OPTIONS.map(opt => opt.value);
    if (!validValues.includes(strategy)) {
        console.warn(`[${MODULE_NAME}] Invalid post-processing strategy: ${strategy}`);
        return;
    }

    // Update global state
    context.chatCompletionSettings.custom_prompt_post_processing = strategy;

    // Update UI element
    const $ = window.jQuery;
    if ($) {
        $('#custom_prompt_post_processing').val(strategy);
    }

    context.saveSettingsDebounced();
    console.log(`[${MODULE_NAME}] Post-processing set to: ${strategy || '(none)'}`);
    notifyReasoningChange();
}

// --- Preset Templates ---

/**
 * Common reasoning preset configurations
 */
export const REASONING_PRESETS = {
    deepseek: {
        autoParse: true,
        prefix: "<think>\n",
        suffix: "\n</think>",
        showHidden: true,
        autoExpand: false,
        addToPrompts: false,
    },
    openai_o1: {
        autoParse: true,
        prefix: "<reasoning>\n",
        suffix: "\n</reasoning>",
        showHidden: true,
        autoExpand: false,
        addToPrompts: false,
    },
    claude_extended: {
        autoParse: true,
        prefix: "<thinking>\n",
        suffix: "\n</thinking>",
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
