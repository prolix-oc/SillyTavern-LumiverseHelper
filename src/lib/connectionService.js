/**
 * Connection Service
 *
 * Manages connection profiles for the Connection Manager feature.
 * Handles CRUD operations, applying profiles to ST, force-persistence,
 * binding resolution (chat > character > last active), and ST profile migration.
 */

import {
    getContext,
    getOaiSettings,
    getExecuteSlashCommands,
    writeSecret,
    getEventSource,
    getEventTypes,
    getSaveSettingsDebounced,
} from "../stContext.js";
import {
    getConnectionProfileRegistry,
    getActiveConnectionProfileId,
    setActiveConnectionProfileId,
    getConnectionProfileBindings,
    setConnectionProfileBindings,
    getConnectionProfileSync,
    getConnectionProfile,
    upsertConnectionProfile,
    removeConnectionProfile,
} from "./packCache.js";
import { getConnectionProfileFileKey } from "./fileStorage.js";
import { captureReasoningSnapshot, applyReasoningSnapshot } from "./presetsService.js";
import { MODULE_NAME } from "./settingsManager.js";
import { resolveBinding as resolveLoomBinding, setActivePreset as setActiveLoomPreset, SAMPLER_PARAMS } from "./lucidLoomService.js";

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

export const PROVIDER_DEFAULTS = {
    openai:       { label: 'OpenAI',                secretKey: 'api_key_openai' },
    claude:       { label: 'Anthropic',             secretKey: 'api_key_claude' },
    makersuite:   { label: 'Google AI Studio',      secretKey: 'api_key_makersuite' },
    openrouter:   { label: 'OpenRouter',            secretKey: 'api_key_openrouter' },
    groq:         { label: 'Groq',                  secretKey: 'api_key_groq' },
    mistralai:    { label: 'Mistral AI',            secretKey: 'api_key_mistralai' },
    deepseek:     { label: 'DeepSeek',              secretKey: 'api_key_deepseek' },
    xai:          { label: 'xAI',                   secretKey: 'api_key_xai' },
    custom:       { label: 'Custom (OpenAI-compat)', secretKey: 'api_key_custom' },
    azure_openai: { label: 'Azure OpenAI',          secretKey: 'api_key_azure_openai' },
};

// ============================================================================
// STATE
// ============================================================================

let _isApplying = false;
let _persistenceGuardUnsub = null;
let _suppressPersistence = false;
let _suppressTimer = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize connection profiles on boot.
 * Called after initPackCache() has loaded all profiles into cache.
 */
export function initConnectionProfiles() {
    // Nothing special needed — profiles are pre-loaded in initPackCache().
    // The CHAT_CHANGED handler in index.js handles binding resolution.
}

// ============================================================================
// CRUD
// ============================================================================

/**
 * Generate a UUID for profile IDs.
 * @returns {string}
 */
function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

/**
 * Build a registry entry from a full profile.
 * @param {Object} profile
 * @returns {Object}
 */
function buildRegistryEntry(profile) {
    return {
        id: profile.id,
        name: profile.name,
        provider: profile.provider,
        model: profile.model,
        color: profile.color || null,
        updatedAt: profile.updatedAt,
        fileKey: getConnectionProfileFileKey(profile.id),
    };
}

/**
 * Create a new connection profile.
 * @param {Object} data - Partial profile data
 * @returns {Promise<Object>} The created profile
 */
export async function createProfile(data) {
    const now = Date.now();
    const profile = {
        id: generateId(),
        name: data.name || 'New Profile',
        createdAt: now,
        updatedAt: now,
        provider: data.provider || 'openai',
        model: data.model || '',
        secretMode: data.secretMode || 'own',
        apiKey: data.apiKey || null,
        stSecretId: data.stSecretId || null,
        endpointUrl: data.endpointUrl || null,
        oaiPreset: data.oaiPreset || null,
        reasoning: data.reasoning || null,
        samplerOverrides: data.samplerOverrides || null,
        promptPostProcessing: data.promptPostProcessing || '',
        stopStrings: data.stopStrings || [],
        regexPreset: data.regexPreset || null,
        loomPresetId: data.loomPresetId || null,
        color: data.color || null,
    };

    const registryEntry = buildRegistryEntry(profile);
    await upsertConnectionProfile(profile.id, profile, registryEntry);
    return profile;
}

/**
 * Load a profile by ID.
 * @param {string} profileId
 * @returns {Promise<Object|null>}
 */
export async function loadProfile(profileId) {
    return await getConnectionProfile(profileId);
}

/**
 * Load a profile synchronously from cache.
 * @param {string} profileId
 * @returns {Object|null}
 */
export function loadProfileSync(profileId) {
    return getConnectionProfileSync(profileId);
}

/**
 * Save an existing profile.
 * @param {Object} profile
 */
export async function saveProfile(profile) {
    profile.updatedAt = Date.now();
    const registryEntry = buildRegistryEntry(profile);
    await upsertConnectionProfile(profile.id, profile, registryEntry);
}

/**
 * Delete a profile by ID.
 * @param {string} profileId
 */
export async function deleteProfile(profileId) {
    await removeConnectionProfile(profileId);
}

/**
 * Duplicate a profile with a new name.
 * @param {string} profileId
 * @param {string} newName
 * @returns {Promise<Object>} The duplicated profile
 */
export async function duplicateProfile(profileId, newName) {
    const source = await loadProfile(profileId);
    if (!source) throw new Error('Profile not found');

    const now = Date.now();
    const duplicate = {
        ...source,
        id: generateId(),
        name: newName || `${source.name} (copy)`,
        createdAt: now,
        updatedAt: now,
    };

    const registryEntry = buildRegistryEntry(duplicate);
    await upsertConnectionProfile(duplicate.id, duplicate, registryEntry);
    return duplicate;
}

/**
 * Capture the current ST state into a new profile.
 * @param {string} name
 * @returns {Promise<Object>} The created profile
 */
export async function captureCurrentAsProfile(name) {
    const ctx = getContext();
    if (!ctx) throw new Error('ST context not available');

    const oaiSettings = ctx.chatCompletionSettings || {};
    const source = oaiSettings.chat_completion_source || 'openai';
    const model = typeof ctx.getChatCompletionModel === 'function'
        ? ctx.getChatCompletionModel() : '';

    const profileName = name || `${PROVIDER_DEFAULTS[source]?.label || source} - ${model || 'Unknown'}`;
    console.log(`[${MODULE_NAME}] Capturing current connection as profile: "${profileName}" (${source}/${model})`);

    // Also capture the current OAI preset name if available
    const currentPreset = oaiSettings.preset_settings_openai || null;

    const profile = await createProfile({
        name: profileName,
        provider: source,
        model: model || '',
        secretMode: 'st',
        endpointUrl: oaiSettings.reverse_proxy || null,
        oaiPreset: currentPreset,
        reasoning: captureReasoningSnapshot(),
    });

    console.log(`[${MODULE_NAME}] Profile captured successfully: ${profile.id}`);
    return profile;
}

// ============================================================================
// APPLY PROFILE
// ============================================================================

/**
 * Apply a connection profile to ST.
 * This is the core flow — sets API source, model, key, endpoint, presets, reasoning.
 * @param {string} profileId
 * @returns {Promise<boolean>} True if applied successfully
 */
export async function applyProfile(profileId) {
    if (_isApplying) return false;
    _isApplying = true;

    try {
        const profile = await loadProfile(profileId);
        if (!profile) {
            console.warn(`[${MODULE_NAME}] Connection profile not found: ${profileId}`);
            return false;
        }

        const executeSlash = getExecuteSlashCommands();
        const oaiSettings = getOaiSettings();

        // 1. Apply API key
        if (profile.secretMode === 'own' && profile.apiKey) {
            const providerConfig = PROVIDER_DEFAULTS[profile.provider];
            if (providerConfig) {
                await writeSecret(providerConfig.secretKey, profile.apiKey);
            }
        }

        // 2. Set chat completion source via slash command
        if (executeSlash && profile.provider) {
            try {
                await executeSlash(`/api ${profile.provider}`);
            } catch (err) {
                console.warn(`[${MODULE_NAME}] Failed to set API source:`, err.message);
            }
        }

        // 3. Set model via slash command
        if (executeSlash && profile.model) {
            try {
                await executeSlash(`/model ${profile.model}`);
            } catch (err) {
                console.warn(`[${MODULE_NAME}] Failed to set model:`, err.message);
            }
        }

        // 4. Handle endpoint URL (reverse proxy simplification)
        if (oaiSettings) {
            if (profile.endpointUrl) {
                oaiSettings.reverse_proxy = profile.endpointUrl;
                oaiSettings.proxy_password = profile.apiKey || '';
            } else {
                oaiSettings.reverse_proxy = '';
                oaiSettings.proxy_password = '';
            }
        }

        // 5. Apply OAI preset if specified
        if (executeSlash && profile.oaiPreset) {
            try {
                await executeSlash(`/preset ${profile.oaiPreset}`);
            } catch (err) {
                console.warn(`[${MODULE_NAME}] Failed to set preset:`, err.message);
            }
            // Re-set API source (preset can override it)
            if (profile.provider) {
                try {
                    await executeSlash(`/api ${profile.provider}`);
                } catch (err) {
                    // Best-effort
                }
            }
        }

        // 6. Apply reasoning settings
        if (profile.reasoning) {
            suppressPersistence(1500);
            applyReasoningSnapshot(profile.reasoning);
        }

        // 7. Apply sampler overrides (provider-aware via SAMPLER_PARAMS)
        if (profile.samplerOverrides?.enabled && oaiSettings) {
            const overrides = profile.samplerOverrides;
            for (const param of SAMPLER_PARAMS) {
                const value = overrides[param.key];
                if (value === null || value === undefined) continue;
                const resolvedKey = param.apiKeyBySource?.[profile.provider] || param.apiKey;
                oaiSettings[resolvedKey] = Number(value);
            }
        }

        // 8. Apply prompt post-processing
        if (profile.promptPostProcessing && oaiSettings) {
            oaiSettings.custom_prompt_post_processing = profile.promptPostProcessing;
        }

        // 9. Activate linked Loom preset
        if (profile.loomPresetId) {
            const store = window.LumiverseUI?.getStore?.();
            if (store) {
                const lb = store.getState().loomBuilder || {};
                store.setState({ loomBuilder: { ...lb, activePresetId: profile.loomPresetId } });
            }
            setActiveLoomPreset(profile.loomPresetId);
        }

        // 10. Save ST settings
        const saveDebounced = getSaveSettingsDebounced();
        if (saveDebounced) saveDebounced();

        // 11. Update active profile ID
        setActiveConnectionProfileId(profileId);

        // 12. Update React store — connection manager + Loom Builder profile switch
        const store = window.LumiverseUI?.getStore?.();
        if (store) {
            const prev = store.getState();
            const cm = prev.connectionManager || {};
            store.setState({
                connectionManager: { ...cm, activeProfileId: profileId },
                // Trigger _profileSwitchTs so useLoomBuilder refreshes sampler/reasoning UI
                loomBuilder: { ...prev.loomBuilder, _profileSwitchTs: Date.now() },
            });
        }

        // 13. Start persistence guard
        startPersistenceGuard(profile);

        return true;
    } catch (err) {
        console.error(`[${MODULE_NAME}] Failed to apply connection profile:`, err);
        return false;
    } finally {
        _isApplying = false;
    }
}

/**
 * Check if we're currently in the middle of applying a profile.
 * @returns {boolean}
 */
export function isApplyingProfile() {
    return _isApplying;
}

// ============================================================================
// FORCE-PERSISTENCE GUARD
// ============================================================================

/**
 * Suppress persistence guard for a duration.
 * @param {number} durationMs
 */
function suppressPersistence(durationMs = 1500) {
    _suppressPersistence = true;
    if (_suppressTimer) clearTimeout(_suppressTimer);
    _suppressTimer = setTimeout(() => {
        _suppressPersistence = false;
        _suppressTimer = null;
    }, durationMs);
}

/**
 * Start the force-persistence guard.
 * Watches for ST overwriting our settings and re-applies critical fields.
 * @param {Object} profile - The profile to guard
 */
function startPersistenceGuard(profile) {
    stopPersistenceGuard();

    const eventSource = getEventSource();
    const eventTypes = getEventTypes();
    if (!eventSource || !eventTypes?.SETTINGS_UPDATED) return;

    let debounceTimer = null;

    const handler = () => {
        if (_isApplying || _suppressPersistence) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            if (_isApplying || _suppressPersistence) return;
            reapplyCriticalFields(profile);
        }, 200);
    };

    eventSource.on(eventTypes.SETTINGS_UPDATED, handler);
    _persistenceGuardUnsub = () => {
        eventSource.removeListener(eventTypes.SETTINGS_UPDATED, handler);
        if (debounceTimer) clearTimeout(debounceTimer);
    };
}

/**
 * Stop the force-persistence guard.
 */
function stopPersistenceGuard() {
    if (_persistenceGuardUnsub) {
        _persistenceGuardUnsub();
        _persistenceGuardUnsub = null;
    }
}

/**
 * Re-apply critical fields if ST overwrote them.
 * @param {Object} profile
 */
function reapplyCriticalFields(profile) {
    const oaiSettings = getOaiSettings();
    if (!oaiSettings) return;

    let changed = false;

    // Check source
    if (profile.provider && oaiSettings.chat_completion_source !== profile.provider) {
        oaiSettings.chat_completion_source = profile.provider;
        changed = true;
    }

    // Check endpoint
    if (profile.endpointUrl) {
        if (oaiSettings.reverse_proxy !== profile.endpointUrl) {
            oaiSettings.reverse_proxy = profile.endpointUrl;
            changed = true;
        }
    }

    if (changed) {
        suppressPersistence(1500);
        const saveDebounced = getSaveSettingsDebounced();
        if (saveDebounced) saveDebounced();
    }
}

// ============================================================================
// BINDINGS
// ============================================================================

/**
 * Resolve which profile should be active based on current chat/character.
 * Priority: chat > character > last active.
 * @returns {string|null} Profile ID or null
 */
export function resolveProfileBinding() {
    const bindings = getConnectionProfileBindings();
    const registry = getConnectionProfileRegistry();

    try {
        const ctx = getContext();
        if (!ctx) return getActiveConnectionProfileId();

        // Chat binding (highest priority)
        if (ctx.chatId && bindings.chats?.[ctx.chatId]) {
            const profileId = bindings.chats[ctx.chatId];
            if (registry[profileId]) return profileId;
        }

        // Character binding
        const avatar = ctx.characters?.[ctx.characterId]?.avatar;
        if (avatar && bindings.characters?.[avatar]) {
            const profileId = bindings.characters[avatar];
            if (registry[profileId]) return profileId;
        }
    } catch (e) {
        // Context not available
    }

    // Fall back to last active
    return getActiveConnectionProfileId();
}

/**
 * Set a character-level profile binding.
 * @param {string} avatar
 * @param {string|null} profileId - null to clear
 */
export async function setCharacterBinding(avatar, profileId) {
    const bindings = { ...getConnectionProfileBindings() };
    bindings.characters = { ...bindings.characters };
    if (profileId) {
        bindings.characters[avatar] = profileId;
    } else {
        delete bindings.characters[avatar];
    }
    await setConnectionProfileBindings(bindings);
}

/**
 * Set a chat-level profile binding.
 * @param {string} chatId
 * @param {string|null} profileId - null to clear
 */
export async function setChatBinding(chatId, profileId) {
    const bindings = { ...getConnectionProfileBindings() };
    bindings.chats = { ...bindings.chats };
    if (profileId) {
        bindings.chats[chatId] = profileId;
    } else {
        delete bindings.chats[chatId];
    }
    await setConnectionProfileBindings(bindings);
}

// ============================================================================
// ST PROFILE MIGRATION
// ============================================================================

/**
 * Detect existing ST connection manager profiles.
 * Reads directly from SillyTavern's extension_settings in the browser context.
 * ST stores profiles at extension_settings.connectionManager.profiles (array of ConnectionProfile).
 * @returns {Promise<Array>} Array of ST profile objects with metadata
 */
export async function detectSTProfiles() {
    try {
        const ctx = getContext();
        if (!ctx) {
            console.warn(`[${MODULE_NAME}] Cannot detect ST profiles: context not available`);
            return [];
        }

        // ST's connection-manager extension stores profiles at extension_settings.connectionManager.profiles
        // Accessible via ctx.extensionSettings (which aliases extension_settings)
        const connManagerSettings = ctx.extensionSettings?.connectionManager;
        if (!connManagerSettings) {
            console.log(`[${MODULE_NAME}] No ST connection manager settings found (extension may not be loaded)`);
            return [];
        }

        const profiles = connManagerSettings.profiles;
        if (!Array.isArray(profiles) || profiles.length === 0) {
            console.log(`[${MODULE_NAME}] ST connection manager has no profiles`);
            return [];
        }

        console.log(`[${MODULE_NAME}] Found ${profiles.length} ST connection manager profile(s)`);

        // ST profile schema uses slash command names as keys:
        // { id, mode, name, api, preset, model, proxy, 'api-url', 'secret-id', 'regex-preset', ... }
        return profiles.map(p => ({
            stName: p.name || 'Unnamed',
            stId: p.id || null,
            provider: p.api || null,
            model: p.model || null,
            secretId: p['secret-id'] || null,
            preset: p.preset || null,
            proxy: p.proxy || null,
            apiUrl: p['api-url'] || null,
            mode: p.mode || 'cc',
            raw: p,
        }));
    } catch (err) {
        console.warn(`[${MODULE_NAME}] Failed to detect ST profiles:`, err);
        return [];
    }
}

/**
 * Migrate a single ST profile to a Lumiverse connection profile.
 * References ST's secret (doesn't copy the actual key value).
 * @param {Object} stProfile - From detectSTProfiles()
 * @returns {Promise<Object>} The created Lumiverse profile
 */
export async function migrateSTProfile(stProfile) {
    console.log(`[${MODULE_NAME}] Migrating ST profile: "${stProfile.stName}" (${stProfile.provider}/${stProfile.model})`);
    return await createProfile({
        name: stProfile.stName,
        provider: stProfile.provider || 'openai',
        model: stProfile.model || '',
        secretMode: 'st',
        stSecretId: stProfile.secretId || null,
        endpointUrl: stProfile.apiUrl || null,
        oaiPreset: stProfile.preset || null,
    });
}

// ============================================================================
// EXPORTS FOR INDEX.JS INTEGRATION
// ============================================================================

/**
 * Get the current active profile ID.
 * @returns {string|null}
 */
export function getActiveProfileId() {
    return getActiveConnectionProfileId();
}

/**
 * Get the full registry.
 * @returns {Object}
 */
export function getRegistry() {
    return getConnectionProfileRegistry();
}

/**
 * Get bindings.
 * @returns {{ characters: Object, chats: Object }}
 */
export function getBindings() {
    return getConnectionProfileBindings();
}
