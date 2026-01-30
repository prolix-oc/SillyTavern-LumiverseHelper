/**
 * Pack Cache Module
 * 
 * Provides in-memory caching for Lumiverse packs to minimize disk I/O.
 * Packs are loaded from the User Files API once and cached for the session.
 * 
 * Key features:
 * - Lazy loading: Only loads packs that have active selections initially
 * - Background loading: Remaining packs loaded in background for UI browsing
 * - Write-through: Pack changes are immediately persisted and cache updated
 * - Debounced index saves: Selection changes batch into periodic saves
 * 
 * Cache lifecycle:
 * 1. On extension init: Load index + packs with active selections
 * 2. On UI browse: Lazy-load additional packs as needed
 * 3. On selection change: Update cache + debounced index save
 * 4. On pack edit/create: Update cache + immediate pack file save + index update
 */

import {
    loadIndex,
    saveIndex,
    loadPack,
    savePack,
    deletePack,
    loadPacksBatch,
    getPackFileKey,
    createPackRegistryEntry,
    generatePackId,
    isFileStorageAvailable,
    saveToggleState,
    loadToggleState,
    deleteToggleState,
    createToggleStateRegistryEntry,
    deleteAllLumiverseFiles,
} from "./fileStorage.js";
import { MODULE_NAME } from "./settingsManager.js";

// ============================================================================
// CACHE STATE
// ============================================================================

/** @type {Object|null} The loaded index (pack registry, selections, preferences) */
let cachedIndex = null;

/** @type {Map<string, Object>} Map of packId -> full pack data */
const packCache = new Map();

/** @type {Set<string>} Set of packIds currently being loaded (prevents duplicate fetches) */
const loadingPacks = new Set();

/** @type {boolean} Whether the cache has been initialized */
let initialized = false;

/** @type {boolean} Whether all packs have been loaded into cache */
let allPacksLoaded = false;

/** @type {number|null} Debounce timer for index saves */
let indexSaveTimer = null;

/** @type {number} Debounce delay for index saves (ms) */
const INDEX_SAVE_DEBOUNCE = 500;

/** @type {Set<Function>} Listeners for cache changes */
const cacheListeners = new Set();

/** @type {Object} Pending updates queued before cache was initialized */
const pendingUpdates = {
    selections: null,
    preferences: null,
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the pack cache.
 * Loads the index and packs that have active selections.
 * @returns {Promise<boolean>} True if initialized successfully
 */
export async function initPackCache() {
    if (initialized) {
        console.log(`[${MODULE_NAME}] Pack cache already initialized`);
        return true;
    }

    // Check if file storage is available
    const available = await isFileStorageAvailable();
    if (!available) {
        console.warn(`[${MODULE_NAME}] File storage not available, falling back to extension settings`);
        return false;
    }

    try {
        // Load the index
        const { index, isNew, migrated } = await loadIndex();
        cachedIndex = index;
        console.log(`[${MODULE_NAME}] Index loaded:`, {
            packCount: Object.keys(cachedIndex.packRegistry).length,
            hasSelections: !!cachedIndex.selections?.selectedDefinition,
            presetCount: Object.keys(cachedIndex.presets || {}).length,
            isNew,
            migrated,
        });

        // If this is a fresh index or was migrated, save it to create/update the file
        if (isNew || migrated) {
            console.log(`[${MODULE_NAME}] ${isNew ? 'Creating initial' : 'Saving migrated'} index file...`);
            await saveIndex(cachedIndex);
        }

        // Determine which packs to load immediately (those with active selections)
        const activePackIds = getActivePackIds(cachedIndex.selections);
        console.log(`[${MODULE_NAME}] Active pack IDs:`, activePackIds);

        if (activePackIds.length > 0) {
            // Get file keys for active packs
            const fileKeys = activePackIds
                .map(id => cachedIndex.packRegistry[id]?.fileKey)
                .filter(Boolean);

            // Load active packs
            const loadedPacks = await loadPacksBatch(fileKeys, 3);
            
            // Populate cache
            for (const [fileKey, pack] of loadedPacks) {
                const packId = generatePackId(pack.packName || pack.name);
                packCache.set(packId, pack);
            }

            console.log(`[${MODULE_NAME}] Loaded ${packCache.size} active packs into cache`);
        }

        initialized = true;

        // Apply any pending updates that were queued before initialization
        applyPendingUpdates();

        // Background load remaining packs
        loadRemainingPacksBackground();

        return true;
    } catch (err) {
        console.error(`[${MODULE_NAME}] Failed to initialize pack cache:`, err);
        return false;
    }
}

/**
 * Get pack IDs that have active selections.
 * @param {Object} selections - The selections object from index
 * @returns {string[]} Array of pack IDs
 */
function getActivePackIds(selections) {
    if (!selections) return [];

    const packIds = new Set();

    // Helper to extract packId from selection
    const addFromSelection = (sel) => {
        if (sel?.packName) packIds.add(sel.packName);
        if (sel?.packId) packIds.add(sel.packId);
    };

    // Single selections
    addFromSelection(selections.selectedDefinition);
    addFromSelection(selections.dominantBehavior);
    addFromSelection(selections.dominantPersonality);

    // Array selections
    const arrayFields = [
        'selectedBehaviors',
        'selectedPersonalities',
        'selectedLoomStyle',
        'selectedLoomUtils',
        'selectedLoomRetrofits',
        'selectedDefinitions',
    ];

    for (const field of arrayFields) {
        if (Array.isArray(selections[field])) {
            selections[field].forEach(addFromSelection);
        }
    }

    // Council members
    if (Array.isArray(selections.councilMembers)) {
        for (const member of selections.councilMembers) {
            addFromSelection(member);
            if (Array.isArray(member.behaviors)) {
                member.behaviors.forEach(addFromSelection);
            }
            if (Array.isArray(member.personalities)) {
                member.personalities.forEach(addFromSelection);
            }
        }
    }

    return Array.from(packIds);
}

/**
 * Apply any pending updates that were queued before the cache was initialized.
 */
function applyPendingUpdates() {
    if (pendingUpdates.selections && cachedIndex) {
        console.log(`[${MODULE_NAME}] Applying pending selection updates`);
        cachedIndex.selections = {
            ...cachedIndex.selections,
            ...pendingUpdates.selections,
        };
        pendingUpdates.selections = null;
    }

    if (pendingUpdates.preferences && cachedIndex) {
        console.log(`[${MODULE_NAME}] Applying pending preference updates`);
        cachedIndex.preferences = {
            ...cachedIndex.preferences,
            ...pendingUpdates.preferences,
        };
        pendingUpdates.preferences = null;
    }

    // If we applied any pending updates, trigger a save
    if (cachedIndex && (pendingUpdates.selections === null || pendingUpdates.preferences === null)) {
        debouncedIndexSave();
    }
}

/**
 * Load remaining packs in the background.
 * This runs after initial load to populate the cache for UI browsing.
 */
async function loadRemainingPacksBackground() {
    if (!cachedIndex?.packRegistry || allPacksLoaded) return;

    const allPackIds = Object.keys(cachedIndex.packRegistry);
    const loadedPackIds = Array.from(packCache.keys());
    const remainingIds = allPackIds.filter(id => !loadedPackIds.includes(id));

    if (remainingIds.length === 0) {
        allPacksLoaded = true;
        return;
    }

    console.log(`[${MODULE_NAME}] Background loading ${remainingIds.length} remaining packs...`);

    // Use requestIdleCallback if available, otherwise setTimeout
    const scheduleLoad = (callback) => {
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(callback, { timeout: 5000 });
        } else {
            setTimeout(callback, 100);
        }
    };

    // Load in small batches to avoid blocking
    const batchSize = 2;
    let index = 0;

    const loadNextBatch = async () => {
        if (index >= remainingIds.length) {
            allPacksLoaded = true;
            console.log(`[${MODULE_NAME}] All packs loaded into cache`);
            notifyListeners();
            return;
        }

        const batchIds = remainingIds.slice(index, index + batchSize);
        const fileKeys = batchIds
            .map(id => cachedIndex.packRegistry[id]?.fileKey)
            .filter(Boolean);

        try {
            const loadedPacks = await loadPacksBatch(fileKeys, batchSize);
            for (const [fileKey, pack] of loadedPacks) {
                const packId = generatePackId(pack.packName || pack.name);
                packCache.set(packId, pack);
            }
        } catch (err) {
            console.warn(`[${MODULE_NAME}] Error loading background batch:`, err);
        }

        index += batchSize;
        scheduleLoad(loadNextBatch);
    };

    scheduleLoad(loadNextBatch);
}

// ============================================================================
// CACHE ACCESS
// ============================================================================

/**
 * Check if the cache is initialized.
 * @returns {boolean}
 */
export function isCacheInitialized() {
    return initialized;
}

/**
 * Get the cached index.
 * @returns {Object|null}
 */
export function getCachedIndex() {
    return cachedIndex;
}

/**
 * Get a pack from the cache.
 * If not in cache, attempts to load it.
 * @param {string} packId - The pack ID (pack name)
 * @returns {Promise<Object|null>} The pack or null
 */
export async function getPack(packId) {
    // Check cache first
    if (packCache.has(packId)) {
        return packCache.get(packId);
    }

    // Check if already loading
    if (loadingPacks.has(packId)) {
        // Wait for it to finish
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!loadingPacks.has(packId)) {
                    clearInterval(checkInterval);
                    resolve(packCache.get(packId) || null);
                }
            }, 50);
        });
    }

    // Try to load from file
    const registryEntry = cachedIndex?.packRegistry?.[packId];
    if (!registryEntry?.fileKey) {
        return null;
    }

    loadingPacks.add(packId);
    try {
        const pack = await loadPack(registryEntry.fileKey);
        if (pack) {
            packCache.set(packId, pack);
        }
        return pack;
    } finally {
        loadingPacks.delete(packId);
    }
}

/**
 * Get a pack synchronously from cache only.
 * Returns null if pack is not in cache (doesn't trigger load).
 * @param {string} packId - The pack ID
 * @returns {Object|null}
 */
export function getPackSync(packId) {
    return packCache.get(packId) || null;
}

/**
 * Get all packs from cache.
 * @returns {Object[]} Array of all cached packs
 */
export function getAllPacksSync() {
    return Array.from(packCache.values());
}

/**
 * Get the pack registry from the cached index.
 * @returns {Object} Pack registry (metadata only)
 */
export function getPackRegistry() {
    return cachedIndex?.packRegistry || {};
}

/**
 * Get selections from the cached index.
 * @returns {Object} Selections object
 */
export function getSelections() {
    return cachedIndex?.selections || {};
}

/**
 * Get preferences from the cached index.
 * @returns {Object} Preferences object
 */
export function getPreferences() {
    return cachedIndex?.preferences || {};
}

// ============================================================================
// CACHE MUTATIONS
// ============================================================================

/**
 * Add or update a pack in the cache and persist it.
 * @param {Object} pack - The pack object
 * @returns {Promise<void>}
 */
export async function upsertPack(pack) {
    const packName = pack.packName || pack.name;
    const packId = generatePackId(packName);

    // Update cache immediately
    packCache.set(packId, pack);

    // Save pack file
    const fileKey = await savePack(pack);

    // Update registry
    if (!cachedIndex) {
        cachedIndex = await loadIndex();
    }
    cachedIndex.packRegistry[packId] = createPackRegistryEntry(pack);

    // Debounced index save
    debouncedIndexSave();

    notifyListeners();
}

/**
 * Remove a pack from the cache and delete its file.
 * @param {string} packId - The pack ID (pack name)
 * @returns {Promise<void>}
 */
export async function removePack(packId) {
    const registryEntry = cachedIndex?.packRegistry?.[packId];
    const cachedPack = packCache.get(packId);

    // Determine the file key - prefer registry, fall back to computing from pack name
    let fileKey = registryEntry?.fileKey;
    if (!fileKey) {
        // Compute file key from pack ID (which is the pack name)
        // This handles cases where pack was in cache but not yet in registry
        fileKey = getPackFileKey(packId);
        console.log(`[${MODULE_NAME}] No registry entry for pack "${packId}", computed fileKey: ${fileKey}`);
    }

    // Remove from cache
    packCache.delete(packId);

    // Delete file - always attempt if we have a fileKey
    if (fileKey) {
        console.log(`[${MODULE_NAME}] Deleting pack file: ${fileKey}`);
        const deleted = await deletePack(fileKey);
        if (deleted) {
            console.log(`[${MODULE_NAME}] Successfully deleted pack file: ${fileKey}`);
        } else {
            console.warn(`[${MODULE_NAME}] Failed to delete pack file: ${fileKey}`);
        }
    }

    // Remove from registry
    if (cachedIndex?.packRegistry) {
        delete cachedIndex.packRegistry[packId];
    }

    // Clean up any selections referencing this pack
    cleanupSelectionsForPack(packId);

    // Debounced index save
    debouncedIndexSave();

    notifyListeners();
}

/**
 * Update selections in the cache and trigger debounced save.
 * @param {Object} newSelections - Partial selections to merge
 */
export function updateSelections(newSelections) {
    if (!cachedIndex) {
        console.warn(`[${MODULE_NAME}] updateSelections called before cache initialized, queuing update`);
        // Queue the update for when cache is ready
        pendingUpdates.selections = { ...pendingUpdates.selections, ...newSelections };
        return;
    }

    cachedIndex.selections = {
        ...cachedIndex.selections,
        ...newSelections,
    };

    debouncedIndexSave();
    notifyListeners();
}

/**
 * Update preferences in the cache and trigger debounced save.
 * @param {Object} newPreferences - Partial preferences to merge
 */
export function updatePreferences(newPreferences) {
    if (!cachedIndex) {
        console.warn(`[${MODULE_NAME}] updatePreferences called before cache initialized, queuing update`);
        // Queue the update for when cache is ready
        pendingUpdates.preferences = { ...pendingUpdates.preferences, ...newPreferences };
        return;
    }

    cachedIndex.preferences = {
        ...cachedIndex.preferences,
        ...newPreferences,
    };

    debouncedIndexSave();
    notifyListeners();
}

/**
 * Update preferences in the cache and save immediately (no debounce).
 * Use for critical settings that must persist before page unload.
 * @param {Object} newPreferences - Partial preferences to merge
 * @returns {Promise<void>}
 */
export async function updatePreferencesImmediate(newPreferences) {
    if (!cachedIndex) {
        console.warn(`[${MODULE_NAME}] updatePreferencesImmediate called before cache initialized, queuing update`);
        pendingUpdates.preferences = { ...pendingUpdates.preferences, ...newPreferences };
        return;
    }

    cachedIndex.preferences = {
        ...cachedIndex.preferences,
        ...newPreferences,
    };

    // Cancel any pending debounced save and save immediately
    if (indexSaveTimer) {
        clearTimeout(indexSaveTimer);
        indexSaveTimer = null;
    }

    try {
        await saveIndex(cachedIndex);
    } catch (err) {
        console.error(`[${MODULE_NAME}] Failed to save preferences immediately:`, err);
    }

    notifyListeners();
}

// ============================================================================
// PRESETS
// ============================================================================

/**
 * Get all presets from the cache.
 * @returns {Object} Presets object keyed by name
 */
export function getPresets() {
    return cachedIndex?.presets || {};
}

/**
 * Get a single preset by name.
 * @param {string} presetName - The preset name
 * @returns {Object|null} The preset or null
 */
export function getPreset(presetName) {
    return cachedIndex?.presets?.[presetName] || null;
}

/**
 * Save or update a preset in the cache and trigger debounced save.
 * @param {string} presetName - The preset name
 * @param {Object} presetData - The preset data
 */
export function upsertPreset(presetName, presetData) {
    if (!cachedIndex) return;
    
    if (!cachedIndex.presets) {
        cachedIndex.presets = {};
    }
    
    cachedIndex.presets[presetName] = presetData;
    
    debouncedIndexSave();
    notifyListeners();
}

/**
 * Delete a preset from the cache and trigger debounced save.
 * @param {string} presetName - The preset name to delete
 */
export function deletePreset(presetName) {
    if (!cachedIndex?.presets) return;
    
    delete cachedIndex.presets[presetName];
    
    debouncedIndexSave();
    notifyListeners();
}

/**
 * Update all presets at once (for bulk operations).
 * @param {Object} newPresets - Complete presets object to replace existing
 */
export function updatePresets(newPresets) {
    if (!cachedIndex) return;
    
    cachedIndex.presets = newPresets;
    
    debouncedIndexSave();
    notifyListeners();
}

// ============================================================================
// TOGGLE STATES (Prompt Enable/Disable Snapshots)
// ============================================================================

/**
 * Get all toggle state names from the registry.
 * @returns {string[]} Array of toggle state names
 */
export function getToggleStateNames() {
    if (!cachedIndex?.toggleStateRegistry) return [];
    return Object.keys(cachedIndex.toggleStateRegistry);
}

/**
 * Get the toggle state registry.
 * @returns {Object} Registry object with state metadata
 */
export function getToggleStateRegistry() {
    return cachedIndex?.toggleStateRegistry || {};
}

/**
 * Save a new toggle state (prompts enabled/disabled snapshot).
 * @param {string} stateName - User-provided name for the state
 * @param {Object} toggles - Map of prompt identifier -> enabled boolean
 * @param {string} [sourcePreset] - Optional: the ST preset this was captured from
 * @returns {Promise<void>}
 */
export async function upsertToggleState(stateName, toggles, sourcePreset = null) {
    if (!cachedIndex) return;
    
    // Ensure registry exists
    if (!cachedIndex.toggleStateRegistry) {
        cachedIndex.toggleStateRegistry = {};
    }
    
    // Save to file storage
    await saveToggleState(stateName, toggles, sourcePreset);
    
    // Update registry
    cachedIndex.toggleStateRegistry[stateName] = createToggleStateRegistryEntry(stateName, sourcePreset);
    
    debouncedIndexSave();
    notifyListeners();
}

/**
 * Load a toggle state's data from file storage.
 * @param {string} stateName - The state name to load
 * @returns {Promise<Object|null>} The toggle state data or null
 */
export async function getToggleState(stateName) {
    return await loadToggleState(stateName);
}

/**
 * Delete a toggle state.
 * @param {string} stateName - The state name to delete
 * @returns {Promise<void>}
 */
export async function removeToggleState(stateName) {
    if (!cachedIndex?.toggleStateRegistry) return;
    
    // Delete from file storage
    await deleteToggleState(stateName);
    
    // Remove from registry
    delete cachedIndex.toggleStateRegistry[stateName];
    
    debouncedIndexSave();
    notifyListeners();
}

/**
 * Clean up selections when a pack is removed.
 * @param {string} packId - The pack ID being removed
 */
function cleanupSelectionsForPack(packId) {
    if (!cachedIndex?.selections) return;

    const sel = cachedIndex.selections;

    // Helper to check if selection matches pack
    const matchesPack = (s) => s?.packName === packId || s?.packId === packId;

    // Single selections
    if (matchesPack(sel.selectedDefinition)) {
        sel.selectedDefinition = null;
    }
    if (matchesPack(sel.dominantBehavior)) {
        sel.dominantBehavior = null;
    }
    if (matchesPack(sel.dominantPersonality)) {
        sel.dominantPersonality = null;
    }

    // Array selections
    const arrayFields = [
        'selectedBehaviors',
        'selectedPersonalities',
        'selectedLoomStyle',
        'selectedLoomUtils',
        'selectedLoomRetrofits',
        'selectedDefinitions',
    ];

    for (const field of arrayFields) {
        if (Array.isArray(sel[field])) {
            sel[field] = sel[field].filter(s => !matchesPack(s));
        }
    }

    // Council members
    if (Array.isArray(sel.councilMembers)) {
        sel.councilMembers = sel.councilMembers.filter(m => !matchesPack(m));
        for (const member of sel.councilMembers) {
            if (Array.isArray(member.behaviors)) {
                member.behaviors = member.behaviors.filter(s => !matchesPack(s));
            }
            if (Array.isArray(member.personalities)) {
                member.personalities = member.personalities.filter(s => !matchesPack(s));
            }
        }
    }
}

// ============================================================================
// PERSISTENCE
// ============================================================================

/**
 * Debounced save of the index file.
 */
function debouncedIndexSave() {
    if (indexSaveTimer) {
        clearTimeout(indexSaveTimer);
    }

    indexSaveTimer = setTimeout(async () => {
        if (cachedIndex) {
            try {
                await saveIndex(cachedIndex);
            } catch (err) {
                console.error(`[${MODULE_NAME}] Failed to save index:`, err);
            }
        }
        indexSaveTimer = null;
    }, INDEX_SAVE_DEBOUNCE);
}

/**
 * Force an immediate save of the index (for shutdown, etc.).
 * @returns {Promise<void>}
 */
export async function flushIndexSave() {
    if (indexSaveTimer) {
        clearTimeout(indexSaveTimer);
        indexSaveTimer = null;
    }

    if (cachedIndex) {
        await saveIndex(cachedIndex);
    }
}

// ============================================================================
// LISTENERS
// ============================================================================

/**
 * Subscribe to cache changes.
 * @param {Function} listener - Callback to invoke on changes
 * @returns {Function} Unsubscribe function
 */
export function subscribeToCacheChanges(listener) {
    cacheListeners.add(listener);
    return () => cacheListeners.delete(listener);
}

/**
 * Notify all listeners of cache changes.
 */
function notifyListeners() {
    for (const listener of cacheListeners) {
        try {
            listener();
        } catch (err) {
            console.error(`[${MODULE_NAME}] Cache listener error:`, err);
        }
    }
}

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * Migrate packs from extension_settings to file storage.
 * This is called once during the first load after this feature is deployed.
 * @param {Object} legacyPacks - The packs object from extension_settings
 * @returns {Promise<{migrated: number, failed: number}>}
 */
export async function migratePacksFromSettings(legacyPacks) {
    if (!legacyPacks || typeof legacyPacks !== 'object') {
        return { migrated: 0, failed: 0 };
    }

    const packEntries = Object.entries(legacyPacks);
    if (packEntries.length === 0) {
        return { migrated: 0, failed: 0 };
    }

    console.log(`[${MODULE_NAME}] Migrating ${packEntries.length} packs to file storage...`);

    let migrated = 0;
    let failed = 0;

    // Initialize index if needed
    if (!cachedIndex) {
        const { index } = await loadIndex();
        cachedIndex = index;
    }

    for (const [key, pack] of packEntries) {
        try {
            const packName = pack.packName || pack.name || key;
            const packId = generatePackId(packName);

            // Normalize pack format
            const normalizedPack = {
                packName,
                packAuthor: pack.packAuthor || pack.author || null,
                coverUrl: pack.coverUrl || null,
                version: pack.version || 1,
                packExtras: pack.packExtras || [],
                lumiaItems: pack.lumiaItems || [],
                loomItems: pack.loomItems || [],
                isCustom: pack.isCustom ?? !pack.url,
                url: pack.url || '',
            };

            // Handle legacy items array
            if (pack.items && !pack.lumiaItems && !pack.loomItems) {
                normalizedPack.lumiaItems = [];
                normalizedPack.loomItems = [];
                
                for (const item of pack.items) {
                    if (item.lumiaDefName || item.lumiaName) {
                        normalizedPack.lumiaItems.push({
                            lumiaName: item.lumiaName || item.lumiaDefName,
                            lumiaDefinition: item.lumiaDefinition || item.lumiaDef || null,
                            lumiaPersonality: item.lumiaPersonality || item.lumia_personality || null,
                            lumiaBehavior: item.lumiaBehavior || item.lumia_behavior || null,
                            avatarUrl: item.avatarUrl || item.lumia_img || null,
                            genderIdentity: item.genderIdentity ?? 0,
                            authorName: item.authorName || item.defAuthor || null,
                            version: 1,
                        });
                    } else if (item.loomName) {
                        normalizedPack.loomItems.push({
                            loomName: item.loomName,
                            loomContent: item.loomContent || '',
                            loomCategory: item.loomCategory || 'Loom Utilities',
                            authorName: item.authorName || null,
                            version: 1,
                        });
                    }
                }
            }

            // Save pack to file
            const fileKey = await savePack(normalizedPack);

            // Update registry
            cachedIndex.packRegistry[packId] = createPackRegistryEntry(normalizedPack);

            // Add to cache
            packCache.set(packId, normalizedPack);

            migrated++;
        } catch (err) {
            console.error(`[${MODULE_NAME}] Failed to migrate pack ${key}:`, err);
            failed++;
        }
    }

    // Save updated index
    await saveIndex(cachedIndex);

    console.log(`[${MODULE_NAME}] Migration complete: ${migrated} succeeded, ${failed} failed`);
    return { migrated, failed };
}

/**
 * Migrate selections from extension_settings format to cache format.
 * Converts packName references to match the new system.
 * @param {Object} legacySettings - The settings object from extension_settings
 */
export function migrateSelectionsFromSettings(legacySettings) {
    if (!cachedIndex) return;

    const selectionFields = [
        'selectedDefinition',
        'selectedBehaviors',
        'selectedPersonalities',
        'dominantBehavior',
        'dominantPersonality',
        'selectedLoomStyle',
        'selectedLoomUtils',
        'selectedLoomRetrofits',
        'selectedDefinitions',
        'councilMembers',
    ];

    for (const field of selectionFields) {
        if (legacySettings[field] !== undefined) {
            cachedIndex.selections[field] = legacySettings[field];
        }
    }

    const preferenceFields = [
        'chimeraMode',
        'councilMode',
        'lumiaQuirks',
        'lumiaQuirksEnabled',
        'lumiaOOCInterval',
        'lumiaOOCStyle',
        'activePresetName',
    ];

    for (const field of preferenceFields) {
        if (legacySettings[field] !== undefined) {
            cachedIndex.preferences[field] = legacySettings[field];
        }
    }
    
    // Migrate presets
    if (legacySettings.presets && typeof legacySettings.presets === 'object') {
        if (!cachedIndex.presets) {
            cachedIndex.presets = {};
        }
        Object.assign(cachedIndex.presets, legacySettings.presets);
        console.log(`[${MODULE_NAME}] Migrated ${Object.keys(legacySettings.presets).length} presets`);
    }
}

// ============================================================================
// DEBUG UTILITIES
// ============================================================================

// ============================================================================
// NUCLEAR RESET
// ============================================================================

/**
 * Clear all Lumiverse data - both in-memory cache and User Files API.
 * This is the "nuclear option" that completely wipes all extension data.
 * @returns {Promise<{deleted: string[], failed: string[]}>} Results from file deletion
 */
export async function clearAllData() {
    console.log(`[${MODULE_NAME}] NUCLEAR: Clearing all Lumiverse data...`);
    
    // Cancel any pending index save
    if (indexSaveTimer) {
        clearTimeout(indexSaveTimer);
        indexSaveTimer = null;
    }
    
    // Clear all in-memory state
    cachedIndex = null;
    packCache.clear();
    loadingPacks.clear();
    initialized = false;
    allPacksLoaded = false;
    pendingUpdates.selections = null;
    pendingUpdates.preferences = null;
    
    // Delete all files from User Files API
    const result = await deleteAllLumiverseFiles();
    
    // Notify listeners that cache has been cleared
    notifyListeners();
    
    console.log(`[${MODULE_NAME}] NUCLEAR: All Lumiverse data cleared`);
    
    return result;
}

// ============================================================================
// DEBUG
// ============================================================================

/**
 * Debug function to dump cache state.
 */
export function debugDumpCache() {
    console.group(`[${MODULE_NAME}] Pack Cache State`);
    console.log('Initialized:', initialized);
    console.log('All packs loaded:', allPacksLoaded);
    console.log('Cached index:', cachedIndex);
    console.log('Pack cache size:', packCache.size);
    console.log('Cached pack IDs:', Array.from(packCache.keys()));
    console.log('Loading packs:', Array.from(loadingPacks));
    console.groupEnd();
}

// Expose debug function globally
if (typeof window !== 'undefined') {
    window.debugLumiversePackCache = debugDumpCache;
}
