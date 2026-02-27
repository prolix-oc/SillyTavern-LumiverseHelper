/**
 * Lucid Loom Service
 *
 * Core service for the Lucid Loom Preset Builder feature.
 * Handles CRUD operations, ST preset import/export, prompt assembly,
 * binding resolution, and macro registry for the builder UI.
 */

import { getContext, getSubstituteParams } from "../stContext.js";
import { MODULE_NAME } from "./settingsManager.js";
import { getLoomPresetFileKey } from "./fileStorage.js";
import { captureReasoningSnapshot, applyReasoningSnapshot, getAdaptiveThinkingEnabled, getStartReplyWith } from "./presetsService.js";
import {
    getLoomPresetRegistry,
    getActiveLoomPresetId,
    setActiveLoomPresetId,
    getLoomBindings,
    setLoomBindings,
    getLoomPreset,
    getLoomPresetSync,
    upsertLoomPreset,
    removeLoomPreset,
} from "./packCache.js";

// Category marker used by ST presets
const CATEGORY_MARKER = '\u2501'; // ━

// ============================================================================
// ST MARKER MAPPINGS
// ============================================================================

/**
 * Maps ST preset well-known identifiers → internal marker types.
 * These identifiers appear in ST preset `prompts[].identifier` and `prompt_order`.
 */
const ST_IDENTIFIER_TO_MARKER = {
    chatHistory:        'chat_history',
    worldInfoBefore:    'world_info_before',
    worldInfoAfter:     'world_info_after',
    charDescription:    'char_description',
    charPersonality:    'char_personality',
    personaDescription: 'persona_description',
    scenario:           'scenario',
    dialogueExamples:   'dialogue_examples',
    main:               'main_prompt',
    enhanceDefinitions: 'enhance_definitions',
    jailbreak:          'jailbreak',
    nsfw:               'nsfw_prompt',
};

/** Reverse map: internal marker type → ST identifier (for export) */
const MARKER_TO_ST_IDENTIFIER = Object.fromEntries(
    Object.entries(ST_IDENTIFIER_TO_MARKER).map(([k, v]) => [v, k])
);

/** Display names for all marker types */
const MARKER_NAMES = {
    chat_history:        'Chat History',
    world_info_before:   'World Info (Before)',
    world_info_after:    'World Info (After)',
    char_description:    'Char Description',
    char_personality:    'Char Personality',
    persona_description: 'User Persona',
    scenario:            'Scenario',
    dialogue_examples:   'Example Messages',
    main_prompt:         'Main Prompt',
    enhance_definitions: 'Enhance Definitions',
    jailbreak:           'Post-History Instructions',
    nsfw_prompt:         'NSFW Prompt',
    category:            'Category',
};

/**
 * Markers that resolve via a ST macro at assembly time.
 * Their content field is ignored — the macro produces the content dynamically.
 */
const MARKER_MACROS = {
    char_description:    '{{description}}',
    char_personality:    '{{personality}}',
    persona_description: '{{persona}}',
    scenario:            '{{scenario}}',
    dialogue_examples:   '{{mesExamples}}',
};

/**
 * Content-bearing markers: these have user-editable content that gets
 * resolved through the macro parser at assembly time (like regular blocks).
 */
const CONTENT_BEARING_MARKERS = new Set([
    'main_prompt',
    'enhance_definitions',
    'jailbreak',
    'nsfw_prompt',
]);

/**
 * Structural markers (marker: true in ST) that are pure insertion points.
 * These are always locked and have no editable content.
 */
const STRUCTURAL_MARKERS = new Set([
    'chat_history',
    'world_info_before',
    'world_info_after',
    'char_description',
    'char_personality',
    'persona_description',
    'scenario',
    'dialogue_examples',
]);

// Export for use in LoomBuilder.jsx
export { MARKER_NAMES };

// ============================================================================
// DEFAULT SAMPLER OVERRIDES & CUSTOM BODY
// ============================================================================

/**
 * Default sampler overrides — null means "use ST/provider default".
 * All values are nullable; only non-null values get applied.
 */
export const DEFAULT_SAMPLER_OVERRIDES = {
    enabled: false,
    maxTokens: null,         // Max response tokens (int)
    contextSize: null,       // Max context tokens (int, provider-specific)
    temperature: null,       // 0.0–2.0
    topP: null,              // 0.0–1.0
    minP: null,              // 0.0–1.0 (OpenRouter, text gen)
    topK: null,              // 0–500 (Claude, OpenRouter, text gen)
    frequencyPenalty: null,  // 0.0–2.0
    presencePenalty: null,   // 0.0–2.0
    repetitionPenalty: null, // 0.0–2.0 (OpenRouter, text gen)
};

/**
 * Default custom body configuration.
 * rawJson is a string that users edit directly as JSON.
 * When enabled, parsed values are spread onto generate_data.
 */
export const DEFAULT_CUSTOM_BODY = {
    enabled: false,
    rawJson: '{}',
};

// ============================================================================
// DEFAULT PROMPT BEHAVIOR, COMPLETION SETTINGS, ADVANCED SETTINGS
// ============================================================================

/**
 * Utility prompts that vary by generation type (continue, impersonate, group, etc.).
 * These are injected at assembly time based on the generation type.
 */
export const DEFAULT_PROMPT_BEHAVIOR = {
    continueNudge: '[Continue your last message without repeating its original content.]',
    impersonationPrompt: '[Write your next reply from the point of view of {{user}}, using the chat history so far as a guideline for the writing style of {{user}}. Don\'t write as {{char}} or system. Don\'t describe actions of {{char}}.]',
    groupNudge: '[Write the next reply only as {{char}}.]',
    newChatPrompt: '[Start a new Chat]',
    newGroupChatPrompt: '[Start a new group chat. Group members: {{group}}]',
    sendIfEmpty: '',
};

/**
 * Completion settings that control how the request is assembled and sent.
 * Provider-specific settings (prefill) are included in model profiles.
 */
export const DEFAULT_COMPLETION_SETTINGS = {
    assistantPrefill: '',             // Claude: prepended to assistant response
    assistantImpersonation: '',       // Claude: prefill when impersonating
    continuePrefill: false,           // Use prefill for continues (Claude)
    continuePostfix: ' ',             // Appended after continue: '', ' ', '\n', '\n\n'
    namesBehavior: 0,                 // -1=none, 0=default, 1=completion, 2=content
    squashSystemMessages: false,      // Merge consecutive system messages
    useSystemPrompt: true,            // Send system role (Claude/Gemini); false → system msgs become user
    enableWebSearch: false,           // Enable web search / grounding
    sendInlineMedia: true,            // Preserve inline media in messages; false → strip to text
    enableFunctionCalling: true,      // Allow function/tool calling; false → remove tools from request
};

/**
 * Advanced generation settings — seed and custom stop strings.
 */
export const DEFAULT_ADVANCED_SETTINGS = {
    seed: -1,                         // -1 = random
    customStopStrings: [],            // Array of strings
};

/**
 * Sampler parameter metadata — used by UI to render controls
 * and by the service to know which fields to apply.
 *
 * `apiKey` is the default request body key.
 * `apiKeyBySource` overrides apiKey for specific chat_completion_source values.
 */
export const SAMPLER_PARAMS = [
    { key: 'maxTokens',        label: 'Max Response',       apiKey: 'max_tokens',          type: 'int',   min: 1,    max: 128000, step: 1,    defaultHint: 16384, unit: 'tokens',
        apiKeyBySource: { makersuite: 'maxOutputTokens', vertexai: 'maxOutputTokens' } },
    { key: 'contextSize',      label: 'Context Size',       apiKey: 'max_context_length',  type: 'int',   min: 1024, max: 2097152, step: 1024, defaultHint: 128000, unit: 'tokens' },
    { key: 'temperature',      label: 'Temperature',        apiKey: 'temperature',         type: 'float', min: 0,    max: 2,    step: 0.01, defaultHint: 1.0 },
    { key: 'topP',             label: 'Top P',              apiKey: 'top_p',               type: 'float', min: 0,    max: 1,    step: 0.01, defaultHint: 0.95 },
    { key: 'minP',             label: 'Min P',              apiKey: 'min_p',               type: 'float', min: 0,    max: 1,    step: 0.01, defaultHint: 0 },
    { key: 'topK',             label: 'Top K',              apiKey: 'top_k',               type: 'int',   min: 0,    max: 500,  step: 1,    defaultHint: 0 },
    { key: 'frequencyPenalty', label: 'Freq Penalty',       apiKey: 'frequency_penalty',   type: 'float', min: 0,    max: 2,    step: 0.01, defaultHint: 0 },
    { key: 'presencePenalty',  label: 'Pres Penalty',       apiKey: 'presence_penalty',    type: 'float', min: 0,    max: 2,    step: 0.01, defaultHint: 0 },
    { key: 'repetitionPenalty',label: 'Rep Penalty',        apiKey: 'repetition_penalty',  type: 'float', min: 0,    max: 2,    step: 0.01, defaultHint: 0 },
];

// ============================================================================
// STORED CORE CHAT — set by interceptor, used by assembly
// ============================================================================

let _storedCoreChat = null;

/**
 * World Info cache — populated by WORLD_INFO_ACTIVATED event (fires before
 * CHAT_COMPLETION_SETTINGS_READY) so assembleMessages() can include WI content.
 * @type {{ before: string, after: string }}
 */
let _worldInfoCache = { before: '', after: '' };

/**
 * Store world info text captured from the WORLD_INFO_ACTIVATED event.
 * @param {string} before - WI entries with position=0 (before char defs)
 * @param {string} after - WI entries with position=1 (after char defs)
 */
export function setWorldInfoCache(before, after) {
    _worldInfoCache = { before: before || '', after: after || '' };
}

/**
 * Clear the world info cache (called on GENERATION_ENDED / CHAT_CHANGED).
 */
export function clearWorldInfoCache() {
    _worldInfoCache = { before: '', after: '' };
}

/**
 * Last assembly breakdown — per-block itemization captured during assembleMessages().
 * Used by the prompt itemization modal to show Loom-specific breakdowns.
 * @type {Object|null}
 */
let _lastAssemblyBreakdown = null;

/**
 * Get the breakdown from the most recent assembleMessages() call.
 * @returns {Object|null} { presetName, presetId, entries: [{type, ...}] }
 */
export function getLastAssemblyBreakdown() {
    return _lastAssemblyBreakdown;
}

/**
 * Store the processed coreChat from the generation interceptor.
 * Called in index.js when a Loom preset is active.
 * @param {Array|null} chat - Processed coreChat array (or null to clear)
 */
export function setStoredCoreChat(chat) {
    _storedCoreChat = chat;
}

/**
 * Get the stored coreChat.
 * @returns {Array|null}
 */
function getStoredCoreChat() {
    return _storedCoreChat;
}

/**
 * Pre-resolve media URLs on stored coreChat messages.
 * Fetches image/video server paths and converts them to data: URLs
 * so that the synchronous assembleMessages() can include them as
 * multipart content arrays. Must be called from an async context
 * (e.g., the generation interceptor) before assembly runs.
 *
 * @param {Array} chatMessages - The stored coreChat array (mutated in place)
 */
export async function preResolveMedia(chatMessages) {
    if (!chatMessages?.length) return;

    const promises = [];

    for (const msg of chatMessages) {
        const media = msg.extra?.media;
        if (!media?.length) continue;

        for (const item of media) {
            if (!item.url || (item.type !== 'image' && item.type !== 'video')) continue;

            const promise = (async () => {
                try {
                    const response = await fetch(item.url, { cache: 'force-cache' });
                    if (!response.ok) return;
                    const blob = await response.blob();
                    const dataUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    if (!msg._resolvedMedia) msg._resolvedMedia = [];
                    msg._resolvedMedia.push({
                        type: item.type === 'image' ? 'image_url' : 'video_url',
                        [item.type === 'image' ? 'image_url' : 'video_url']: { url: dataUrl },
                    });
                } catch (e) {
                    console.warn(`[${MODULE_NAME}] Loom: Failed to resolve media URL: ${item.url}`, e);
                }
            })();
            promises.push(promise);
        }
    }

    if (promises.length > 0) {
        await Promise.all(promises);
        const resolved = chatMessages.filter(m => m._resolvedMedia?.length).length;
    }
}

/**
 * Generate a unique ID that works in non-secure contexts (HTTP).
 */
function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try { return crypto.randomUUID(); } catch (e) { /* fall through */ }
    }
    const hex = '0123456789abcdef';
    let id = '';
    for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) id += '-';
        else if (i === 14) id += '4';
        else if (i === 19) id += hex[(Math.random() * 4) | 8];
        else id += hex[(Math.random() * 16) | 0];
    }
    return id;
}

// ============================================================================
// PROMPT BLOCK FACTORY
// ============================================================================

/**
 * Create a new prompt block with defaults.
 * @param {Partial<Object>} overrides
 * @returns {Object} PromptBlock
 */
export function createBlock(overrides = {}) {
    return {
        id: generateId(),
        name: 'New Prompt',
        content: '',
        role: 'system',
        enabled: true,
        position: 'pre_history',
        depth: 0,
        marker: null,
        isLocked: false,
        color: null,
        injectionTrigger: [],  // empty = fire always; ['normal','continue','impersonate','quiet','swipe','regenerate']
        ...overrides,
    };
}

/**
 * Create a marker block (structural insertion point).
 * @param {string} markerType - One of the keys in MARKER_NAMES
 * @param {string} [name] - Optional override name
 * @returns {Object} PromptBlock
 */
export function createMarkerBlock(markerType, name) {
    const displayName = name || MARKER_NAMES[markerType] || markerType;
    const isStructural = STRUCTURAL_MARKERS.has(markerType);
    const isContentBearing = CONTENT_BEARING_MARKERS.has(markerType);

    return createBlock({
        name: markerType === 'category' ? (name || 'Category') : displayName,
        marker: markerType,
        content: '',
        // Structural markers are always locked; content-bearing and category are not
        isLocked: isStructural,
    });
}

// ============================================================================
// PRESET CRUD
// ============================================================================

/**
 * Create a new Loom preset with starter blocks.
 * @param {string} name
 * @param {string} [description='']
 * @returns {Promise<Object>} The created preset
 */
export async function createPreset(name, description = '') {
    const now = Date.now();
    const preset = {
        id: generateId(),
        name,
        description,
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
        blocks: [
            createBlock({ name: 'System Prompt', content: '', role: 'system', position: 'pre_history' }),
            createMarkerBlock('chat_history'),
        ],
        source: null,
        isDefault: false,
        samplerOverrides: { ...DEFAULT_SAMPLER_OVERRIDES },
        customBody: { ...DEFAULT_CUSTOM_BODY },
        promptBehavior: { ...DEFAULT_PROMPT_BEHAVIOR },
        completionSettings: { ...DEFAULT_COMPLETION_SETTINGS },
        advancedSettings: { ...DEFAULT_ADVANCED_SETTINGS },
    };

    const registryEntry = buildRegistryEntry(preset);
    await upsertLoomPreset(preset.id, preset, registryEntry);
    return preset;
}

/**
 * Backfill new fields on presets loaded from storage that predate
 * the samplerOverrides/customBody additions.
 * @param {Object|null} preset
 * @returns {Object|null}
 */
function migratePreset(preset) {
    if (!preset) return preset;
    // Key-level merge: spread defaults first, then existing values on top.
    // This ensures new keys get their defaults while preserving user customization.
    preset.samplerOverrides = { ...DEFAULT_SAMPLER_OVERRIDES, ...(preset.samplerOverrides || {}) };
    preset.customBody = { ...DEFAULT_CUSTOM_BODY, ...(preset.customBody || {}) };
    preset.promptBehavior = { ...DEFAULT_PROMPT_BEHAVIOR, ...(preset.promptBehavior || {}) };
    preset.completionSettings = { ...DEFAULT_COMPLETION_SETTINGS, ...(preset.completionSettings || {}) };
    preset.advancedSettings = { ...DEFAULT_ADVANCED_SETTINGS, ...(preset.advancedSettings || {}) };
    if (!preset.modelProfiles) {
        preset.modelProfiles = {};
    }
    if (!preset.lastProfileKey) {
        preset.lastProfileKey = null;
    }
    // Backfill injectionTrigger on blocks
    if (Array.isArray(preset.blocks)) {
        for (const block of preset.blocks) {
            if (!Array.isArray(block.injectionTrigger)) {
                block.injectionTrigger = [];
            }
        }
    }
    return preset;
}

/**
 * Load a preset by ID (async, may load from file).
 * @param {string} presetId
 * @returns {Promise<Object|null>}
 */
export async function loadPreset(presetId) {
    return migratePreset(await getLoomPreset(presetId));
}

/**
 * Load a preset by ID (sync, cache only).
 * @param {string} presetId
 * @returns {Object|null}
 */
export function loadPresetSync(presetId) {
    return migratePreset(getLoomPresetSync(presetId));
}

/**
 * Save a preset (persist to file + update registry).
 * @param {Object} preset
 * @returns {Promise<void>}
 */
export async function savePreset(preset) {
    preset.updatedAt = Date.now();
    const registryEntry = buildRegistryEntry(preset);
    await upsertLoomPreset(preset.id, preset, registryEntry);
}

/**
 * Delete a preset.
 * @param {string} presetId
 * @returns {Promise<void>}
 */
export async function deletePreset(presetId) {
    await removeLoomPreset(presetId);
}

/**
 * Duplicate a preset with a new name.
 * @param {string} presetId
 * @param {string} newName
 * @returns {Promise<Object>} The new preset
 */
export async function duplicatePreset(presetId, newName) {
    const original = await loadPreset(presetId);
    if (!original) throw new Error(`Preset ${presetId} not found`);

    const now = Date.now();
    const newPreset = {
        ...JSON.parse(JSON.stringify(original)),
        id: generateId(),
        name: newName,
        createdAt: now,
        updatedAt: now,
        isDefault: false,
        source: original.source ? { ...original.source } : null,
    };

    // Regenerate block IDs
    for (const block of newPreset.blocks) {
        block.id = generateId();
    }

    const registryEntry = buildRegistryEntry(newPreset);
    await upsertLoomPreset(newPreset.id, newPreset, registryEntry);
    return newPreset;
}

/**
 * Get the preset registry metadata.
 * @returns {Object}
 */
export function listPresets() {
    return getLoomPresetRegistry();
}

// ============================================================================
// IMPORT / EXPORT
// ============================================================================

/**
 * Convert a single ST prompt entry to an internal block.
 * Recognizes well-known ST identifiers and converts them to marker blocks.
 *
 * @param {Object} p - ST prompt object
 * @param {boolean} enabled - Enabled override (from prompt_order if available)
 * @returns {Object} PromptBlock
 */
function convertSTPromptToBlock(p, enabled) {
    // Check for well-known ST identifier
    const markerType = ST_IDENTIFIER_TO_MARKER[p.identifier];
    if (markerType) {
        const block = createMarkerBlock(markerType, p.name || undefined);
        block.enabled = enabled;
        // For content-bearing markers (main, enhance, jailbreak, nsfw),
        // preserve their original content for macro resolution at assembly time
        if (CONTENT_BEARING_MARKERS.has(markerType) && p.content) {
            block.content = p.content;
        }
        return block;
    }

    // Check for category markers (name starts with ━)
    const isCategory = p.name?.startsWith(CATEGORY_MARKER);

    // Determine position/depth from injection settings
    // injection_position=0 → relative (ordered in place, no depth)
    // injection_position=1 → at-depth (inserted at injection_depth within chat history)
    let position = 'pre_history';
    let depth = 0;
    if (p.injection_position === 1 && typeof p.injection_depth === 'number') {
        position = 'in_history';
        depth = p.injection_depth;
    }

    return createBlock({
        name: p.name || 'Untitled',
        content: p.content || '',
        role: p.role || 'system',
        enabled,
        position,
        depth,
        marker: isCategory ? 'category' : null,
        isLocked: false,
    });
}

/**
 * Import from a SillyTavern preset JSON (the prompts[] array format).
 * Recognizes all well-known ST identifiers and parses them as mandatory markers.
 * Uses prompt_order for enabled status overrides.
 *
 * @param {Object} stPresetData - Full ST preset JSON with `prompts` array
 * @param {string} name - Name for the imported preset
 * @returns {Promise<Object>} The created internal preset
 */
export async function importFromSTPreset(stPresetData, name) {
    const now = Date.now();
    const prompts = stPresetData.prompts || [];
    const blocks = [];

    // Build enabled overrides from prompt_order
    // Prefer higher character_id keys (more customized)
    const enabledOverrides = new Map();
    const promptOrder = stPresetData.prompt_order;
    if (promptOrder) {
        const keys = Object.keys(promptOrder)
            .filter(k => promptOrder[k]?.order?.length > 0)
            .sort((a, b) => Number(b) - Number(a));
        // Apply overrides from all orders, highest priority last
        for (let i = keys.length - 1; i >= 0; i--) {
            for (const entry of promptOrder[keys[i]].order) {
                enabledOverrides.set(entry.identifier, entry.enabled !== false);
            }
        }
    }

    // Process all prompts in array order
    for (const p of prompts) {
        // Use prompt_order enabled override if available, else prompt's own enabled
        const enabled = enabledOverrides.has(p.identifier)
            ? enabledOverrides.get(p.identifier)
            : (p.enabled !== false);

        const block = convertSTPromptToBlock(p, enabled);
        blocks.push(block);
    }

    // Verify chat_history marker exists (it should from chatHistory identifier)
    const hasChatHistory = blocks.some(b => b.marker === 'chat_history');
    if (!hasChatHistory) {
        // Insert after last pre_history block, before first in_history
        let insertIdx = blocks.length;
        for (let i = 0; i < blocks.length; i++) {
            if (blocks[i].position === 'in_history' || blocks[i].position === 'post_history') {
                insertIdx = i;
                break;
            }
        }
        blocks.splice(insertIdx, 0, createMarkerBlock('chat_history'));
    }

    const preset = {
        id: generateId(),
        name,
        description: `Imported from ST preset "${stPresetData.name || name}"`,
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
        blocks,
        source: {
            type: 'st_import',
            slug: null,
            importedVersion: null,
            importedName: stPresetData.name || name,
            importedAt: now,
        },
        isDefault: false,
        samplerOverrides: { ...DEFAULT_SAMPLER_OVERRIDES },
        customBody: { ...DEFAULT_CUSTOM_BODY },
        promptBehavior: { ...DEFAULT_PROMPT_BEHAVIOR },
        completionSettings: { ...DEFAULT_COMPLETION_SETTINGS },
        advancedSettings: { ...DEFAULT_ADVANCED_SETTINGS },
    };

    const registryEntry = buildRegistryEntry(preset);
    await upsertLoomPreset(preset.id, preset, registryEntry);
    return preset;
}

/**
 * Export a preset to ST prompts[] format.
 * Marker blocks are exported with their proper ST identifiers and flags.
 *
 * @param {Object} preset
 * @returns {Object} ST-compatible preset data
 */
export function exportToSTFormat(preset) {
    const prompts = [];

    for (const block of preset.blocks) {
        const stIdentifier = MARKER_TO_ST_IDENTIFIER[block.marker];

        if (stIdentifier) {
            // This is a well-known ST marker — export with proper identifier and flags
            const isStructural = STRUCTURAL_MARKERS.has(block.marker);
            prompts.push({
                identifier: stIdentifier,
                name: block.name,
                content: isStructural ? '' : (block.content || ''),
                role: block.role || 'system',
                enabled: block.enabled,
                system_prompt: true,
                marker: isStructural,
                injection_position: 0,
                injection_depth: 4,
                injection_order: 100,
                forbid_overrides: false,
            });
            continue;
        }

        if (block.marker === 'category') {
            // Category separator
            prompts.push({
                identifier: block.id,
                name: `${CATEGORY_MARKER}${block.name}`,
                content: '',
                role: 'system',
                enabled: block.enabled,
                system_prompt: false,
                marker: false,
                injection_position: 1,
                injection_depth: 4,
                injection_order: 100,
                forbid_overrides: false,
            });
            continue;
        }

        // Regular prompt block
        prompts.push({
            identifier: block.id,
            name: block.name,
            content: block.content || '',
            role: block.role || 'system',
            enabled: block.enabled,
            system_prompt: false,
            marker: false,
            injection_position: block.position === 'in_history' ? 0 : 1,
            injection_depth: block.position === 'in_history' ? block.depth : 4,
            injection_order: 100,
            forbid_overrides: false,
        });
    }

    return {
        name: preset.name,
        prompts,
    };
}

/**
 * Import a previously exported internal preset JSON.
 * @param {Object} jsonData - Full preset JSON data
 * @returns {Promise<Object>} The created preset
 */
export async function importFromFile(jsonData) {
    const now = Date.now();
    const preset = {
        ...jsonData,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
    };

    // Regenerate block IDs to avoid collisions
    if (Array.isArray(preset.blocks)) {
        for (const block of preset.blocks) {
            block.id = generateId();
        }
    }

    const registryEntry = buildRegistryEntry(preset);
    await upsertLoomPreset(preset.id, preset, registryEntry);
    return preset;
}

// ============================================================================
// BINDING RESOLUTION
// ============================================================================

/**
 * Set a binding (character or chat) to a preset.
 * @param {'character'|'chat'} type
 * @param {string} id - Character avatar or chat ID
 * @param {string} presetId
 */
export async function setBinding(type, id, presetId) {
    const bindings = { ...getLoomBindings() };
    if (type === 'character') {
        bindings.characters = { ...bindings.characters, [id]: presetId };
    } else {
        bindings.chats = { ...bindings.chats, [id]: presetId };
    }
    await setLoomBindings(bindings);
}

/**
 * Clear a binding.
 * @param {'character'|'chat'} type
 * @param {string} id
 */
export async function clearBinding(type, id) {
    const bindings = { ...getLoomBindings() };
    if (type === 'character') {
        const chars = { ...bindings.characters };
        delete chars[id];
        bindings.characters = chars;
    } else {
        const chats = { ...bindings.chats };
        delete chats[id];
        bindings.chats = chats;
    }
    await setLoomBindings(bindings);
}

/**
 * Resolve the active preset ID based on binding priority: Chat > Character > Default.
 * @returns {string|null} Resolved preset ID
 */
export function resolveBinding() {
    const bindings = getLoomBindings();
    const registry = getLoomPresetRegistry();

    try {
        const ctx = getContext();

        // Check chat binding
        if (ctx.chatId && bindings.chats?.[ctx.chatId]) {
            const presetId = bindings.chats[ctx.chatId];
            if (registry[presetId]) return presetId;
        }

        // Check character binding
        const avatar = ctx.characters?.[ctx.characterId]?.avatar;
        if (avatar && bindings.characters?.[avatar]) {
            const presetId = bindings.characters[avatar];
            if (registry[presetId]) return presetId;
        }
    } catch (e) {
        // Context may not be available
    }

    // Check for default preset
    for (const [id, entry] of Object.entries(registry)) {
        if (entry.isDefault) return id;
    }

    return getActiveLoomPresetId();
}

/**
 * Resolve the active preset for generation. Returns null if no preset is active.
 * @returns {Object|null} The full preset data, or null
 */
export function resolveActivePreset() {
    const presetId = resolveBinding();
    if (!presetId) return null;
    return migratePreset(getLoomPresetSync(presetId));
}

/**
 * Set the active preset (non-binding manual selection).
 * @param {string|null} presetId
 */
export function setActivePreset(presetId) {
    setActiveLoomPresetId(presetId);
}

/**
 * Get all enabled content blocks within a named category from the active Loom preset.
 * Categories are marker blocks (marker === 'category') that act as headers;
 * all blocks between one category and the next belong to that category.
 * @param {string} categoryName - The category name to look up (case-insensitive)
 * @returns {Array<{name: string, content: string}>} Array of {name, content} for enabled blocks in the category
 */
export function getBlocksInCategory(categoryName) {
    const preset = resolveActivePreset();
    if (!preset?.blocks) return [];

    const target = categoryName.toLowerCase();
    let inCategory = false;
    const result = [];

    for (const block of preset.blocks) {
        if (block.marker === 'category') {
            const name = block.name.replace(/^\u2501\s*/, '').trim();
            inCategory = name.toLowerCase() === target;
            continue;
        }
        if (inCategory && block.enabled && block.content?.trim()) {
            result.push({ name: block.name, content: block.content.trim() });
        }
    }

    return result;
}

// ============================================================================
// RUNTIME ASSEMBLY
// ============================================================================

/**
 * Assemble the full messages array from a Loom preset.
 * Called from the CHAT_COMPLETION_SETTINGS_READY event handler.
 *
 * This replaces ST's entire prompt assembly — system prompts, character data,
 * chat history, jailbreak, etc. are all controlled by the preset's blocks.
 *
 * @param {Object} preset - The Loom preset
 * @param {Object} generateData - The generate_data object from CHAT_COMPLETION_SETTINGS_READY
 * @returns {Array} Assembled messages array [{role, content}] for the API
 */
export function assembleMessages(preset, generateData) {
    if (!preset?.blocks) return null;

    const genType = generateData?.type || 'normal';
    const enabledBlocks = preset.blocks.filter(b => b.enabled);
    const substituteParams = getSubstituteParams();

    // Resolve macro content in a string using ST's canonical macro resolver
    const resolveMacros = (text) => {
        if (!text || typeof text !== 'string') return text;
        try {
            if (substituteParams) {
                return substituteParams(text);
            }
        } catch (e) {
            console.warn(`[${MODULE_NAME}] Macro resolution error:`, e);
        }
        return text;
    };

    // Convert stored coreChat messages to OpenAI {role, content} format.
    // Falls back to extracting conversation messages from generate_data.messages.
    // When sendInlineMedia is true and media was pre-resolved, messages may contain
    // multipart content arrays (image_url / video_url parts alongside text).
    const sendInlineMedia = preset.completionSettings?.sendInlineMedia !== false;
    const chatMessages = buildChatMessages(generateData, sendInlineMedia);

    // Detect if this is a group chat
    let isGroupChat = false;
    try {
        const ctx = getContext();
        isGroupChat = !!ctx?.groupId;
    } catch (e) { /* not available */ }

    const behavior = preset.promptBehavior || {};
    const completion = preset.completionSettings || {};

    // Build messages array in block order, tracking per-block breakdown
    const result = [];
    const breakdown = [];

    for (const block of enabledBlocks) {
        // Category markers are visual-only, skip
        if (block.marker === 'category') continue;

        // Injection trigger filtering: skip blocks whose trigger list is non-empty
        // and doesn't include the current generation type
        if (block.injectionTrigger?.length > 0 && !block.injectionTrigger.includes(genType)) {
            continue;
        }

        // Chat history marker — insert conversation messages here
        if (block.marker === 'chat_history') {
            // Inject new chat separator at chat history start
            if (isGroupChat && behavior.newGroupChatPrompt) {
                const resolved = resolveMacros(behavior.newGroupChatPrompt);
                if (resolved?.trim()) {
                    result.push({ role: 'system', content: resolved });
                    breakdown.push({ type: 'separator', name: 'New Chat Separator', content: resolved });
                }
            } else if (!isGroupChat && behavior.newChatPrompt) {
                const resolved = resolveMacros(behavior.newChatPrompt);
                if (resolved?.trim()) {
                    result.push({ role: 'system', content: resolved });
                    breakdown.push({ type: 'separator', name: 'New Chat Separator', content: resolved });
                }
            }
            // Flatten chat messages to text for itemization
            const chatText = chatMessages.map(m => {
                if (typeof m.content === 'string') return m.content;
                if (Array.isArray(m.content)) return m.content.filter(p => p.type === 'text').map(p => p.text).join('\n');
                return '';
            }).join('\n');
            breakdown.push({ type: 'chat_history', messageCount: chatMessages.length, content: chatText });
            result.push(...chatMessages);
            continue;
        }

        // Resolve block content based on marker type
        const content = resolveBlockContent(block, resolveMacros);

        // Skip empty resolved content
        if (!content || !content.trim()) continue;

        let role = block.role || 'system';

        // Post-history blocks are sent as assistant messages
        if (block.position === 'post_history') {
            role = 'assistant';
        }

        result.push({ role, content });
        breakdown.push({
            type: 'block',
            blockId: block.id,
            blockName: block.name,
            marker: block.marker || null,
            role,
            content,
            color: block.color || null,
        });
    }

    // Inject utility prompts based on generation type
    if (genType === 'continue' && !completion.continuePrefill) {
        const nudge = behavior.continueNudge;
        if (nudge) {
            const resolved = resolveMacros(nudge);
            if (resolved?.trim()) {
                result.push({ role: 'system', content: resolved });
                breakdown.push({ type: 'utility', name: 'Continue Nudge', content: resolved });
            }
        }
    } else if (genType === 'impersonate') {
        const prompt = behavior.impersonationPrompt;
        if (prompt) {
            const resolved = resolveMacros(prompt);
            if (resolved?.trim()) {
                result.push({ role: 'system', content: resolved });
                breakdown.push({ type: 'utility', name: 'Impersonation Prompt', content: resolved });
            }
        }
    } else if (isGroupChat && genType !== 'impersonate') {
        const nudge = behavior.groupNudge;
        if (nudge) {
            const resolved = resolveMacros(nudge);
            if (resolved?.trim()) {
                result.push({ role: 'system', content: resolved });
                breakdown.push({ type: 'utility', name: 'Group Nudge', content: resolved });
            }
        }
    }

    // sendIfEmpty: if last message is assistant and this field is set,
    // insert a user message with that content
    if (behavior.sendIfEmpty) {
        const lastMsg = result[result.length - 1];
        if (lastMsg?.role === 'assistant') {
            const resolved = resolveMacros(behavior.sendIfEmpty);
            if (resolved?.trim()) {
                result.push({ role: 'user', content: resolved });
                breakdown.push({ type: 'utility', name: 'Send If Empty', content: resolved });
            }
        }
    }

    // Store breakdown for prompt itemization
    _lastAssemblyBreakdown = {
        presetName: preset.name,
        presetId: preset.id,
        entries: breakdown,
    };

    return result;
}

// ============================================================================
// EXTENSION PROMPT INJECTION
// ============================================================================

/**
 * Friendly labels for ST's extension_prompts keys.
 * Keys not listed here fall through to a cleaned-up version of the key itself.
 */
const EXTENSION_PROMPT_LABELS = {
    '1_memory':             'Summary',
    '2_floating_prompt':    "Author's Note",
    '3_vectors':            'Vectors',
    '4_vectors_data_bank':  'Data Bank',
    'chromadb':             'Smart Context',
};

/** Keys to always skip when injecting extension prompts. */
const SKIP_EXTENSION_KEYS = new Set(['QUIET_PROMPT', '__STORY_STRING__']);

/** ST position enum values. */
const EXT_POS = { NONE: -1, IN_PROMPT: 0, IN_CHAT: 1, BEFORE_PROMPT: 2 };

/** Map ST role numbers to OpenAI role strings. */
const ROLE_MAP = { 0: 'system', 1: 'user', 2: 'assistant' };

/**
 * Inject ST extension prompts (Summary, Author's Note, Vectors, Smart Context,
 * Data Bank, depth-positioned WI, etc.) into the assembled Loom messages array.
 *
 * Also auto-injects World Info (from the WI cache) when no explicit WI blocks
 * exist in the preset.
 *
 * Mutates `result` (message array) and `breakdown` (itemization entries) in place.
 *
 * @param {Array} result - Assembled messages array from assembleMessages()
 * @param {Array} breakdown - Breakdown entries array from _lastAssemblyBreakdown
 * @param {Object} extensionPrompts - ctx.extensionPrompts (= ST's extension_prompts global)
 * @param {Array} enabledBlocks - The preset's enabled blocks (to check for explicit WI blocks)
 */
export function injectExtensionPrompts(result, breakdown, extensionPrompts, enabledBlocks) {
    if (!extensionPrompts || typeof extensionPrompts !== 'object') return;

    // Find the index of the first user or assistant message (boundary between
    // system preamble and conversation). Used for IN_PROMPT placement.
    const firstChatIdx = result.findIndex(m => m.role === 'user' || m.role === 'assistant');

    // Track how many messages we've inserted so subsequent indices stay correct
    let offset = 0;

    for (const [key, entry] of Object.entries(extensionPrompts)) {
        // Skip blanks, NONE position, and blacklisted keys
        if (!entry?.value?.trim()) continue;
        if (entry.position === EXT_POS.NONE) continue;
        if (SKIP_EXTENSION_KEYS.has(key)) continue;
        if (key.startsWith('customWIOutlet_')) continue;

        const role = ROLE_MAP[entry.role] || 'system';
        const label = EXTENSION_PROMPT_LABELS[key] || key.replace(/^\d+_/, '').replace(/_/g, ' ');

        // Compute insertion index based on ST position semantics
        let idx;
        if (entry.position === EXT_POS.BEFORE_PROMPT) {
            // Before everything
            idx = 0;
        } else if (entry.position === EXT_POS.IN_PROMPT) {
            // Before the first user/assistant message (after system preamble)
            idx = firstChatIdx >= 0 ? firstChatIdx + offset : result.length;
        } else if (entry.position === EXT_POS.IN_CHAT) {
            // Depth-positioned: insert from the end
            const depth = Math.max(0, entry.depth || 0);
            idx = Math.max(0, result.length - depth);
        } else {
            // Unknown position — append
            idx = result.length;
        }

        result.splice(idx, 0, { role, content: entry.value });
        breakdown.push({
            type: 'extension',
            name: label,
            role,
            content: entry.value,
        });
        offset++;
    }

    // Auto-inject World Info if no explicit WI blocks exist in the preset
    const hasExplicitWI = enabledBlocks?.some(b =>
        b.marker === 'world_info_before' || b.marker === 'world_info_after'
    );

    if (!hasExplicitWI) {
        const wiBefore = _worldInfoCache.before;
        const wiAfter = _worldInfoCache.after;

        if (wiBefore?.trim()) {
            const idx = firstChatIdx >= 0 ? firstChatIdx + offset : result.length;
            result.splice(idx, 0, { role: 'system', content: wiBefore });
            breakdown.push({
                type: 'world_info',
                name: 'World Info (Before)',
                marker: 'world_info_before',
                role: 'system',
                content: wiBefore,
            });
            offset++;
        }

        if (wiAfter?.trim()) {
            const idx = firstChatIdx >= 0 ? firstChatIdx + offset : result.length;
            result.splice(idx, 0, { role: 'system', content: wiAfter });
            breakdown.push({
                type: 'world_info',
                name: 'World Info (After)',
                marker: 'world_info_after',
                role: 'system',
                content: wiAfter,
            });
            offset++;
        }
    }
}

/**
 * Build the chat messages portion from stored coreChat or generate_data.
 *
 * Priority:
 * 1. Use stored coreChat from the interceptor (already processed with filters)
 * 2. Fall back to extracting user/assistant messages from generate_data.messages
 *
 * @param {Object} generateData - The generate_data object
 * @returns {Array} Chat messages in {role, content} format
 */
function buildChatMessages(generateData, sendInlineMedia = true) {
    const storedChat = getStoredCoreChat();

    if (storedChat && storedChat.length > 0) {
        // Convert coreChat format → OpenAI format
        // When sendInlineMedia is true, include pre-resolved media as multipart
        // content arrays (image_url / video_url alongside text).
        return storedChat.map(m => {
            const role = m.is_user ? 'user' : (m.is_system ? 'system' : 'assistant');
            const text = m.mes || m.content || '';

            // Include pre-resolved media when enabled
            if (sendInlineMedia && m._resolvedMedia?.length > 0) {
                const contentParts = [];
                if (text.trim()) {
                    contentParts.push({ type: 'text', text });
                }
                contentParts.push(...m._resolvedMedia);
                return { role, content: contentParts };
            }

            return { role, content: text };
        }).filter(m => {
            if (typeof m.content === 'string') return m.content.trim();
            if (Array.isArray(m.content)) return m.content.length > 0;
            return false;
        });
    }

    // Fallback: extract conversation messages from the existing messages array
    // These are already in {role, content} format from ST's assembly
    if (generateData?.messages) {
        return generateData.messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role, content: m.content || '' }));
    }

    return [];
}

/**
 * Resolve the content for a block based on its marker type.
 *
 * - Structural markers (char_description, scenario, etc.) → resolve via ST macro
 * - World info markers → resolve from ST context
 * - Content-bearing markers (main_prompt, jailbreak, etc.) → resolve stored content through macros
 * - Regular blocks → resolve stored content through macros
 *
 * @param {Object} block
 * @param {Function} resolveMacros - Macro resolution function
 * @returns {string} Resolved content
 */
function resolveBlockContent(block, resolveMacros) {
    // Structural markers that map to a specific ST macro
    if (MARKER_MACROS[block.marker]) {
        return resolveMacros(MARKER_MACROS[block.marker]);
    }

    // World info markers — resolve from ST context
    if (block.marker === 'world_info_before' || block.marker === 'world_info_after') {
        return resolveWorldInfo(block.marker);
    }

    // Content-bearing markers and regular blocks — resolve their stored content
    return resolveMacros(block.content);
}

/**
 * Resolve world info content from the cached WI entries.
 * The cache is populated by the WORLD_INFO_ACTIVATED event handler in index.js,
 * which fires during Generate() before CHAT_COMPLETION_SETTINGS_READY.
 * @param {string} markerType - 'world_info_before' or 'world_info_after'
 * @returns {string}
 */
function resolveWorldInfo(markerType) {
    if (markerType === 'world_info_before') return _worldInfoCache.before;
    if (markerType === 'world_info_after') return _worldInfoCache.after;
    return '';
}

// ============================================================================
// MACRO REGISTRY (for UI inserter)
// ============================================================================

/**
 * Get available macros grouped by category for the UI inserter.
 * @returns {Array<{category: string, macros: Array<{name: string, syntax: string, description: string}>}>}
 */
export function getAvailableMacros() {
    return [
        {
            category: 'ST Standard',
            macros: [
                { name: 'Scenario', syntax: '{{scenario}}', description: 'Character scenario' },
                { name: 'Personality', syntax: '{{personality}}', description: 'Character personality' },
                { name: 'Description', syntax: '{{description}}', description: 'Character description' },
                { name: 'Character Name', syntax: '{{char}}', description: 'Character name' },
                { name: 'User Name', syntax: '{{user}}', description: 'User name' },
                { name: 'User Persona', syntax: '{{persona}}', description: 'User persona' },
                { name: 'Example Messages', syntax: '{{mesExamples}}', description: 'Example dialogue messages' },
            ],
        },
        {
            category: 'Lumiverse — Lumia Content',
            macros: [
                { name: 'Lumia Definition', syntax: '{{lumiaDef}}', description: 'Selected physical definition' },
                { name: 'Lumia Definition Count', syntax: '{{lumiaDef::len}}', description: 'Number of active definitions' },
                { name: 'Lumia Behavior', syntax: '{{lumiaBehavior}}', description: 'All selected behaviors' },
                { name: 'Lumia Behavior Count', syntax: '{{lumiaBehavior::len}}', description: 'Number of active behaviors' },
                { name: 'Lumia Personality', syntax: '{{lumiaPersonality}}', description: 'All selected personalities' },
                { name: 'Lumia Personality Count', syntax: '{{lumiaPersonality::len}}', description: 'Number of active personalities' },
                { name: 'Lumia Quirks', syntax: '{{lumiaQuirks}}', description: 'User-defined behavioral quirks' },
                { name: 'Random Lumia', syntax: '{{randomLumia}}', description: 'Random Lumia (full)' },
                { name: 'Random Lumia Name', syntax: '{{randomLumia::name}}', description: 'Random Lumia name' },
                { name: 'Random Lumia Physical', syntax: '{{randomLumia::phys}}', description: 'Random Lumia physical definition' },
                { name: 'Random Lumia Personality', syntax: '{{randomLumia::pers}}', description: 'Random Lumia personality' },
                { name: 'Random Lumia Behavior', syntax: '{{randomLumia::behav}}', description: 'Random Lumia behavior' },
            ],
        },
        {
            category: 'Lumiverse — Lumia OOC',
            macros: [
                { name: 'Lumia OOC', syntax: '{{lumiaOOC}}', description: 'OOC commentary prompt' },
                { name: 'Lumia OOC Erotic', syntax: '{{lumiaOOCErotic}}', description: 'Mirror & Synapse erotic OOC' },
                { name: 'Lumia OOC Erotic Bleed', syntax: '{{lumiaOOCEroticBleed}}', description: 'Narrative Rupture erotic bleed' },
                { name: 'OOC Trigger', syntax: '{{lumiaOOCTrigger}}', description: 'OOC trigger countdown/activation' },
            ],
        },
        {
            category: 'Lumiverse — Self-Reference',
            macros: [
                { name: 'Self (my/our)', syntax: '{{lumiaSelf::1}}', description: 'Possessive determiner — my or our' },
                { name: 'Self (mine/ours)', syntax: '{{lumiaSelf::2}}', description: 'Possessive pronoun — mine or ours' },
                { name: 'Self (me/us)', syntax: '{{lumiaSelf::3}}', description: 'Object pronoun — me or us' },
                { name: 'Self (I/we)', syntax: '{{lumiaSelf::4}}', description: 'Subject pronoun — I or we' },
            ],
        },
        {
            category: 'Lumiverse — Loom System',
            macros: [
                { name: 'Loom Style', syntax: '{{loomStyle}}', description: 'Selected narrative style' },
                { name: 'Loom Style Count', syntax: '{{loomStyle::len}}', description: 'Number of active styles' },
                { name: 'Loom Utilities', syntax: '{{loomUtils}}', description: 'All selected utilities' },
                { name: 'Loom Utility Count', syntax: '{{loomUtils::len}}', description: 'Number of active utilities' },
                { name: 'Loom Retrofits', syntax: '{{loomRetrofits}}', description: 'All selected retrofits' },
                { name: 'Loom Retrofit Count', syntax: '{{loomRetrofits::len}}', description: 'Number of active retrofits' },
                { name: 'Loom Summary', syntax: '{{loomSummary}}', description: 'Current story summary' },
                { name: 'Summary Directive', syntax: '{{loomSummaryPrompt}}', description: 'Summarization directive prompt' },
                { name: 'Sovereign Hand', syntax: '{{loomSovHand}}', description: 'Co-pilot mode prompt' },
                { name: 'Sovereign Hand Active', syntax: '{{loomSovHandActive}}', description: 'Sovereign Hand status (yes/no)' },
                { name: 'Last User Message', syntax: '{{loomLastUserMessage}}', description: 'Last user message content' },
                { name: 'Last Char Message', syntax: '{{loomLastCharMessage}}', description: 'Last character message content' },
                { name: 'Last Message Name', syntax: '{{lastMessageName}}', description: 'Name of last message sender' },
                { name: 'Continue Prompt', syntax: '{{loomContinuePrompt}}', description: 'Continuation instructions' },
            ],
        },
        {
            category: 'Lumiverse — Council',
            macros: [
                { name: 'Council Instructions', syntax: '{{lumiaCouncilInst}}', description: 'Council member instructions' },
                { name: 'Council Deliberation', syntax: '{{lumiaCouncilDeliberation}}', description: 'Council tool results' },
                { name: 'State Synthesis', syntax: '{{lumiaStateSynthesis}}', description: 'State synthesis prompt' },
                { name: 'Council Mode Active', syntax: '{{lumiaCouncilModeActive}}', description: 'Council mode status (yes/no)' },
                { name: 'Council Tools Active', syntax: '{{lumiaCouncilToolsActive}}', description: 'Council tools status (yes/no)' },
                { name: 'Council Tools List', syntax: '{{lumiaCouncilToolsList}}', description: 'Available council tools reminder' },
            ],
        },
        {
            category: 'Lumiverse — Utility',
            macros: [
                { name: 'Message Count', syntax: '{{lumiaMessageCount}}', description: 'Current chat message count' },
            ],
        },
    ];
}

// ============================================================================
// CONNECTION PROFILE DETECTION
// ============================================================================

/**
 * Per-provider sampler support maps.
 * Keys = chat_completion_source values from ST.
 * Values = Set of supported samplerOverrides keys.
 */
const PROVIDER_PARAMS = {
    // OpenAI (GPT-4o, GPT-4, etc.)
    openai:       new Set(['maxTokens', 'contextSize', 'temperature', 'topP', 'frequencyPenalty', 'presencePenalty']),
    azure_openai: new Set(['maxTokens', 'contextSize', 'temperature', 'topP', 'frequencyPenalty', 'presencePenalty']),
    // Claude
    claude:       new Set(['maxTokens', 'contextSize', 'temperature', 'topP', 'topK']),
    // Gemini (AI Studio / Vertex)
    makersuite:   new Set(['maxTokens', 'contextSize', 'temperature', 'topP', 'topK']),
    vertexai:     new Set(['maxTokens', 'contextSize', 'temperature', 'topP', 'topK']),
    // OpenRouter — nearly everything
    openrouter:   new Set(['maxTokens', 'contextSize', 'temperature', 'topP', 'topK', 'minP', 'frequencyPenalty', 'presencePenalty', 'repetitionPenalty']),
    // Custom/proxy — assume all params may work
    custom:       new Set(['maxTokens', 'contextSize', 'temperature', 'topP', 'topK', 'minP', 'frequencyPenalty', 'presencePenalty', 'repetitionPenalty']),
    // Mistral
    mistralai:    new Set(['maxTokens', 'contextSize', 'temperature', 'topP']),
    // Cohere — has topK, frequency + presence clamped 0-1
    cohere:       new Set(['maxTokens', 'contextSize', 'temperature', 'topP', 'topK', 'frequencyPenalty', 'presencePenalty']),
    // Perplexity — topK, penalties
    perplexity:   new Set(['maxTokens', 'contextSize', 'temperature', 'topP', 'topK', 'frequencyPenalty', 'presencePenalty']),
    // Groq — base OpenAI-like
    groq:         new Set(['maxTokens', 'contextSize', 'temperature', 'topP', 'frequencyPenalty', 'presencePenalty']),
    // DeepSeek
    deepseek:     new Set(['maxTokens', 'contextSize', 'temperature', 'topP', 'frequencyPenalty', 'presencePenalty']),
    // xAI
    xai:          new Set(['maxTokens', 'contextSize', 'temperature', 'topP']),
    // Chutes — extra samplers
    chutes:       new Set(['maxTokens', 'contextSize', 'temperature', 'topP', 'topK', 'minP', 'repetitionPenalty']),
    // NanoGPT
    nanogpt:      new Set(['maxTokens', 'contextSize', 'temperature', 'topP', 'topK', 'minP', 'repetitionPenalty']),
    // ElectronHub
    electronhub:  new Set(['maxTokens', 'contextSize', 'temperature', 'topP', 'topK', 'frequencyPenalty', 'presencePenalty']),
    // AI21
    ai21:         new Set(['maxTokens', 'contextSize', 'temperature', 'topP']),
};

/** Default params when provider is unknown */
const DEFAULT_PROVIDER_PARAMS = new Set(['maxTokens', 'contextSize', 'temperature', 'topP', 'frequencyPenalty', 'presencePenalty']);

/** All params for text completion APIs */
const TEXT_COMPLETION_PARAMS = new Set(['maxTokens', 'contextSize', 'temperature', 'topP', 'topK', 'minP', 'frequencyPenalty', 'presencePenalty', 'repetitionPenalty']);

/**
 * Detect the current connection profile from ST context.
 * Returns an object describing the API type, source, model, and which sampler
 * parameters are supported by the current provider.
 *
 * @returns {{ mainApi: string, source: string|null, model: string|null, supportedParams: Set<string> }}
 */
export function detectConnectionProfile() {
    const profile = {
        mainApi: 'unknown',
        source: null,
        model: null,
        supportedParams: DEFAULT_PROVIDER_PARAMS,
    };

    try {
        const ctx = getContext();
        if (!ctx) return profile;

        profile.mainApi = ctx.mainApi || 'unknown';

        if (ctx.mainApi === 'openai') {
            const oaiSettings = ctx.chatCompletionSettings;
            profile.source = oaiSettings?.chat_completion_source || null;
            profile.model = typeof ctx.getChatCompletionModel === 'function'
                ? ctx.getChatCompletionModel() : null;

            // Look up provider-specific param set
            profile.supportedParams = PROVIDER_PARAMS[profile.source] || DEFAULT_PROVIDER_PARAMS;
        } else if (['textgenerationwebui', 'kobold', 'novel'].includes(ctx.mainApi)) {
            profile.source = ctx.textCompletionSettings?.type || null;
            profile.supportedParams = TEXT_COMPLETION_PARAMS;
        }
    } catch (e) {
        // Context not available; return defaults
    }

    return profile;
}

// ============================================================================
// SAMPLER OVERRIDES & CUSTOM BODY APPLICATION
// ============================================================================

/**
 * Apply sampler overrides from a Loom preset onto the generate_data object.
 * Only non-null overrides are applied. Resolves provider-specific API keys
 * (e.g., `maxOutputTokens` for Gemini instead of `max_tokens`).
 *
 * @param {Object} preset - The Loom preset with samplerOverrides
 * @param {Object} generateData - The generate_data object (mutated in place)
 * @returns {string[]} List of applied override descriptions for logging
 */
export function applySamplerOverrides(preset, generateData) {
    const overrides = preset?.samplerOverrides;
    if (!overrides?.enabled) return [];

    // Detect current provider for key resolution
    const profile = detectConnectionProfile();
    const applied = [];

    for (const param of SAMPLER_PARAMS) {
        const value = overrides[param.key];
        if (value === null || value === undefined) continue;

        const numValue = Number(value);
        if (isNaN(numValue)) continue;

        // Resolve the correct API key for this provider
        const resolvedKey = param.apiKeyBySource?.[profile.source] || param.apiKey;

        // If using a provider-specific key, also remove the default key
        // to avoid sending both (e.g., both max_tokens and maxOutputTokens)
        if (resolvedKey !== param.apiKey && param.apiKey in generateData) {
            delete generateData[param.apiKey];
        }

        generateData[resolvedKey] = numValue;
        applied.push(`${param.label}: ${numValue} (${resolvedKey})`);
    }

    return applied;
}

/**
 * Apply custom body JSON from a Loom preset onto the generate_data object.
 * Parses the user-provided JSON string and spreads all keys onto generate_data.
 * Supports both flat keys and nested objects (e.g., `thinking: { type: "enabled" }`).
 *
 * @param {Object} preset - The Loom preset with customBody
 * @param {Object} generateData - The generate_data object (mutated in place)
 * @returns {string[]} List of applied key names for logging
 */
export function applyCustomBody(preset, generateData) {
    const customBody = preset?.customBody;
    if (!customBody?.enabled || !customBody.rawJson) return [];

    try {
        const parsed = JSON.parse(customBody.rawJson);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];

        const applied = [];

        for (const [key, value] of Object.entries(parsed)) {
            if (value === undefined) continue;
            generateData[key] = value;
            applied.push(key);
        }

        return applied;
    } catch (e) {
        console.warn(`[${MODULE_NAME}] Loom Builder: Failed to parse custom body JSON:`, e.message);
        return [];
    }
}

// ============================================================================
// ADAPTIVE THINKING (Claude 4.6)
// ============================================================================

/** Regex matching Claude models that support adaptive thinking */
const ADAPTIVE_THINKING_REGEX = /^claude-(opus-4-6|sonnet-4-6)/;

/** Regex matching Claude Opus 4.5 (supports effort but not adaptive thinking) */
const OPUS_45_EFFORT_REGEX = /^claude-opus-4-5/;

/** Valid effort levels for Opus 4.5 (subset of 4.6 levels) */
const OPUS_45_EFFORT_LEVELS = new Set(['low', 'medium', 'high']);

/**
 * Check if a model supports adaptive thinking (thinking.type: 'adaptive').
 * @param {string} model - Model ID string
 * @returns {boolean}
 */
export function isAdaptiveThinkingModel(model) {
    return !!model && ADAPTIVE_THINKING_REGEX.test(model);
}

/**
 * Apply adaptive thinking configuration for Claude 4.6 models, and
 * effort-only configuration for Opus 4.5.
 *
 * Claude 4.6 (adaptive):
 * - Sets thinking.type = 'adaptive'
 * - Maps reasoning_effort to output_config.effort
 * - Removes top_k (incompatible with adaptive thinking)
 *
 * Opus 4.5 (effort only):
 * - Maps reasoning_effort to output_config.effort (low/medium/high only)
 *
 * Both paths respect the user's adaptive thinking toggle.
 *
 * @param {Object} preset - The active Loom preset
 * @param {Object} generateData - The generate_data object (mutated in place)
 * @param {Object} [profile] - Connection profile (auto-detected if not provided)
 * @returns {string[]} List of applied changes for logging
 */
export function applyAdaptiveThinking(preset, generateData, profile) {
    if (!generateData) return [];

    // Respect user toggle
    if (!getAdaptiveThinkingEnabled()) return [];

    const p = profile || detectConnectionProfile();
    // Only applies to Claude direct or OpenRouter
    if (p.source !== 'claude' && p.source !== 'openrouter') return [];

    const model = generateData.model || p.model || '';

    // Reasoning must be enabled
    if (!generateData.show_thoughts) return [];

    const effort = generateData.reasoning_effort || 'auto';

    // Claude 4.6: full adaptive thinking
    if (isAdaptiveThinkingModel(model)) {
        const applied = [];

        generateData.thinking = { type: 'adaptive' };
        applied.push('thinking: { type: "adaptive" }');

        if (effort && effort !== 'auto') {
            generateData.output_config = { effort };
            applied.push(`output_config.effort: "${effort}"`);
        }

        // Remove top_k — incompatible with adaptive thinking
        if ('top_k' in generateData) {
            delete generateData.top_k;
            applied.push('removed top_k (incompatible)');
        }

        return applied;
    }

    // Opus 4.5: effort only (low/medium/high)
    if (OPUS_45_EFFORT_REGEX.test(model) && OPUS_45_EFFORT_LEVELS.has(effort)) {
        generateData.output_config = { effort };
        return [`output_config.effort: "${effort}" (Opus 4.5)`];
    }

    return [];
}

// ============================================================================
// COMPLETION SETTINGS & ADVANCED SETTINGS APPLICATION
// ============================================================================

/**
 * Apply completion settings from a Loom preset onto generate_data.
 * Handles assistant prefill, continue prefill, postfix, names behavior,
 * and system message squashing.
 *
 * @param {Object} preset - The Loom preset with completionSettings
 * @param {Object} generateData - The generate_data object (mutated in place)
 * @returns {string[]} List of applied setting descriptions for logging
 */
export function applyCompletionSettings(preset, generateData) {
    const settings = preset?.completionSettings;
    if (!settings) return [];

    const applied = [];
    const genType = generateData?.type || 'normal';

    // Detect source for prefill support
    const profile = detectConnectionProfile();
    const isClaude = profile.source === 'claude';

    // Determine prefill text based on generation type and preset settings.
    // Falls back to ST's "Start Reply With" (user_prompt_bias) since Loom Builder
    // replaces generate_data.messages and discards the Prompt Manager's injection.
    let prefillText = null;
    if (genType !== 'quiet' && genType !== 'continue') {
        if (genType === 'impersonate' && settings.assistantImpersonation) {
            prefillText = settings.assistantImpersonation;
        } else if (settings.assistantPrefill) {
            prefillText = settings.assistantPrefill;
        } else {
            // Fall back to ST's native "Start Reply With" setting
            const stBias = getStartReplyWith();
            if (stBias?.trim()) {
                prefillText = stBias;
            }
        }
    }

    if (prefillText && isClaude) {
        // Claude: use the dedicated assistant_prefill field (handled by ST backend)
        generateData.assistant_prefill = prefillText;
        applied.push(`assistant_prefill: "${prefillText.substring(0, 30)}..."`);
    } else if (prefillText && generateData.messages?.length > 0) {
        // Non-Claude APIs (Gemini, OpenAI, etc.): append as assistant message.
        // ST's backend converts assistant → model role for Gemini, acting as prefill.
        generateData.messages.push({ role: 'assistant', content: prefillText });
        applied.push(`assistant_prefill (message): "${prefillText.substring(0, 30)}..."`);
    }

    // Continue prefill: move last message content into prefill position
    if (settings.continuePrefill && genType === 'continue') {
        const messages = generateData.messages;
        if (messages?.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg?.role === 'assistant' && lastMsg.content) {
                if (isClaude) {
                    // Claude: use dedicated prefill field
                    generateData.assistant_prefill = lastMsg.content;
                    messages.pop();
                    applied.push('continuePrefill: moved last assistant message to prefill');
                }
                // Non-Claude: last assistant message is already in position — no action needed.
                // The API will treat it as a continuation point.
            }
        }
    }

    // Continue postfix
    if (settings.continuePostfix !== undefined && settings.continuePostfix !== ' ') {
        generateData.continue_postfix = settings.continuePostfix;
        applied.push(`continue_postfix: ${JSON.stringify(settings.continuePostfix)}`);
    }

    // Names behavior
    if (settings.namesBehavior !== undefined && settings.namesBehavior !== 0) {
        generateData.names_behavior = settings.namesBehavior;
        applied.push(`names_behavior: ${settings.namesBehavior}`);
    }

    // Squash system messages — merge consecutive system messages
    if (settings.squashSystemMessages && generateData.messages) {
        const messages = generateData.messages;
        const squashed = [];
        for (const msg of messages) {
            const prev = squashed[squashed.length - 1];
            if (prev && prev.role === 'system' && msg.role === 'system') {
                prev.content = (prev.content || '') + '\n\n' + (msg.content || '');
            } else {
                squashed.push({ ...msg });
            }
        }
        if (squashed.length < messages.length) {
            generateData.messages = squashed;
            applied.push(`squashSystemMessages: ${messages.length} → ${squashed.length} messages`);
        }
    }

    // Use system prompt — when false, convert system role → user in our messages.
    // Also sets the generate_data flag so ST's proxy knows for any messages it handles.
    if (settings.useSystemPrompt !== undefined) {
        generateData.use_sysprompt = !!settings.useSystemPrompt;
        if (!settings.useSystemPrompt && generateData.messages) {
            let converted = 0;
            for (const msg of generateData.messages) {
                if (msg.role === 'system') {
                    msg.role = 'user';
                    converted++;
                }
            }
            if (converted > 0) {
                applied.push(`use_sysprompt: false (converted ${converted} system → user)`);
            }
        }
    }

    // Enable web search / grounding
    if (settings.enableWebSearch !== undefined) {
        generateData.enable_web_search = !!settings.enableWebSearch;
        if (settings.enableWebSearch) {
            applied.push('enable_web_search: true');
        }
    }

    // Send inline media — when false, strip multipart content arrays to text-only.
    // Our assembly already outputs plain {role, content: string} messages, but
    // ST's native messages or fallback paths may contain content arrays with images.
    if (settings.sendInlineMedia === false && generateData.messages) {
        let stripped = 0;
        for (const msg of generateData.messages) {
            if (Array.isArray(msg.content)) {
                // Extract text parts only, discard image/media parts
                const textParts = msg.content
                    .filter(p => p.type === 'text')
                    .map(p => p.text || '')
                    .join('\n');
                msg.content = textParts;
                stripped++;
            }
        }
        if (stripped > 0) {
            applied.push(`sendInlineMedia: false (stripped media from ${stripped} messages)`);
        }
    }

    // Enable function calling — when false, remove tools/tool_choice from request.
    // ST's ToolManager may have already added these; we remove them if the preset says no.
    if (settings.enableFunctionCalling === false) {
        if (generateData.tools) {
            delete generateData.tools;
            delete generateData.tool_choice;
            applied.push('enableFunctionCalling: false (removed tools)');
        }
    }

    return applied;
}

/**
 * Apply advanced settings from a Loom preset onto generate_data.
 * Handles seed and custom stop strings.
 *
 * @param {Object} preset - The Loom preset with advancedSettings
 * @param {Object} generateData - The generate_data object (mutated in place)
 * @returns {string[]} List of applied setting descriptions for logging
 */
export function applyAdvancedSettings(preset, generateData) {
    const settings = preset?.advancedSettings;
    if (!settings) return [];

    const applied = [];

    // Seed
    if (typeof settings.seed === 'number' && settings.seed >= 0) {
        generateData.seed = settings.seed;
        applied.push(`seed: ${settings.seed}`);
    }

    // Custom stop strings — append to existing stop array
    if (Array.isArray(settings.customStopStrings) && settings.customStopStrings.length > 0) {
        if (!Array.isArray(generateData.stop)) {
            generateData.stop = [];
        }
        for (const s of settings.customStopStrings) {
            if (s && typeof s === 'string') {
                generateData.stop.push(s);
            }
        }
        applied.push(`customStopStrings: +${settings.customStopStrings.length} entries`);
    }

    return applied;
}

// ============================================================================
// MODEL PROFILES — per-model sampler + reasoning state
// ============================================================================

/**
 * Build the profile key for the current connection.
 * Format: "{source}:{model}" or "{mainApi}" as fallback.
 * @returns {string}
 */
export function getProfileKey() {
    const profile = detectConnectionProfile();
    const source = profile.source || profile.mainApi || 'unknown';
    const model = profile.model || 'default';
    return `${source}:${model}`;
}

/**
 * Capture the current sampler + reasoning state into a model profile snapshot.
 * Reads samplers from the preset, reasoning from ST globals.
 * @param {Object} preset - The active Loom preset
 * @returns {Object} Model profile snapshot
 */
export function captureModelProfile(preset) {
    return {
        samplerOverrides: { ...preset.samplerOverrides },
        customBody: { ...preset.customBody },
        completionSettings: { ...(preset.completionSettings || DEFAULT_COMPLETION_SETTINGS) },
        ...captureReasoningSnapshot(),
    };
}

/**
 * Save the current state to the active model profile in the preset.
 * Called before switching away from a model.
 * @param {Object} preset - The active Loom preset
 * @param {string} profileKey - The current model profile key
 * @returns {Object} Updated preset with the profile saved
 */
export function saveCurrentModelProfile(preset, profileKey) {
    if (!preset || !profileKey) return preset;
    const profiles = { ...(preset.modelProfiles || {}) };
    profiles[profileKey] = captureModelProfile(preset);
    return { ...preset, modelProfiles: profiles, lastProfileKey: profileKey };
}

/**
 * Load a model profile from the preset and apply it.
 * Returns the updated preset with samplerOverrides/customBody replaced.
 * Also applies reasoning settings to ST globals.
 * @param {Object} preset - The active Loom preset
 * @param {string} profileKey - The new model profile key to load
 * @returns {Object} Updated preset with sampler/body from the profile
 */
export function loadModelProfile(preset, profileKey) {
    if (!preset) return preset;
    const profiles = preset.modelProfiles || {};
    const profile = profiles[profileKey];

    if (profile) {
        // Apply reasoning to ST globals
        applyReasoningSnapshot(profile);
        // Return preset with sampler/body/completion from profile
        return {
            ...preset,
            samplerOverrides: { ...profile.samplerOverrides },
            customBody: { ...profile.customBody },
            ...(profile.completionSettings ? { completionSettings: { ...profile.completionSettings } } : {}),
            lastProfileKey: profileKey,
        };
    }

    // No saved profile for this model — keep current settings, just update key
    return { ...preset, lastProfileKey: profileKey };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a registry entry from a full preset object.
 * @param {Object} preset
 * @returns {Object}
 */
function buildRegistryEntry(preset) {
    return {
        name: preset.name,
        fileKey: getLoomPresetFileKey(preset.name),
        blockCount: preset.blocks?.length || 0,
        sourceSlug: preset.source?.slug || null,
        sourceVersion: preset.source?.importedVersion || null,
        createdAt: preset.createdAt,
        updatedAt: preset.updatedAt,
        isDefault: preset.isDefault || false,
    };
}
