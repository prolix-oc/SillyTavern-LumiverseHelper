/**
 * File Storage Module
 * 
 * Provides persistent storage for Lumiverse packs using SillyTavern's User Files API.
 * This offloads pack data from extension_settings to individual files, keeping settings.json lightweight.
 * 
 * Architecture:
 * - Index file: lumiverse_index.json (pack registry, selections, settings - saved frequently)
 * - Pack files: lumiverse_pack_{hash}.json (individual pack content - saved on import/edit)
 * 
 * The User Files API has these constraints:
 * - Flat directory (no subdirectories)
 * - Files visible in "Chat Attachments" manager
 * - Overwrite only (no append/partial edit)
 * - Single file per request (batch via client-side queue)
 */

import { getRequestHeaders } from "../stContext.js";
import { MODULE_NAME } from "./settingsManager.js";

// Namespace prefix for all Lumiverse files
const FILE_PREFIX = "lumiverse_";

// Index filename
const INDEX_FILENAME = `${FILE_PREFIX}index.json`;

// Pack file prefix
const PACK_PREFIX = `${FILE_PREFIX}pack_`;

/**
 * Generate a simple hash from a string for pack file naming.
 * Uses a fast non-cryptographic hash suitable for file naming.
 * @param {string} str - String to hash
 * @returns {string} 8-character hex hash
 */
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    // Convert to unsigned and take 8 hex chars
    return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generate the file key for a pack based on its name.
 * @param {string} packName - The pack name
 * @returns {string} File key (e.g., "lumiverse_pack_a1b2c3d4.json")
 */
export function getPackFileKey(packName) {
    return `${PACK_PREFIX}${hashString(packName)}.json`;
}

/**
 * Encode data to Base64 for the User Files API.
 * Handles UTF-8 characters correctly.
 * @param {Object} dataObj - Data object to encode
 * @returns {string} Base64 encoded string
 */
function encodeDataToBase64(dataObj) {
    const jsonString = JSON.stringify(dataObj);
    // Handle UTF-8 characters correctly
    return btoa(unescape(encodeURIComponent(jsonString)));
}

/**
 * Upload a file to the User Files API.
 * @param {string} filename - The filename (will be namespaced)
 * @param {Object} dataObj - The data object to save
 * @returns {Promise<{path: string}>} Response with file path
 * @throws {Error} If upload fails
 */
async function uploadFile(filename, dataObj) {
    const base64Data = encodeDataToBase64(dataObj);

    const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            name: filename,
            data: base64Data,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to save file ${filename}: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

/**
 * Load a file from the User Files API.
 * @param {string} filename - The filename to load
 * @returns {Promise<Object|null>} Parsed data or null if file doesn't exist
 */
async function loadFile(filename) {
    // Add cache buster to prevent stale data
    const url = `/user/files/${filename}?t=${Date.now()}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                return null; // File doesn't exist yet
            }
            throw new Error(`Failed to load file: ${response.status}`);
        }
        return await response.json();
    } catch (err) {
        console.warn(`[${MODULE_NAME}] Could not load file ${filename}:`, err);
        return null;
    }
}

/**
 * Delete a file from the User Files API.
 * @param {string} filename - The filename to delete
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deleteFile(filename) {
    try {
        const response = await fetch('/api/files/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ path: filename }),
        });
        return response.ok;
    } catch (err) {
        console.warn(`[${MODULE_NAME}] Could not delete file ${filename}:`, err);
        return false;
    }
}

// ============================================================================
// INDEX FILE OPERATIONS
// ============================================================================

/**
 * Index file schema:
 * {
 *   version: number,               // Schema version for migrations
 *   packRegistry: {                // Map of packId -> pack metadata (no content)
 *     [packId]: {
 *       packName: string,
 *       fileKey: string,           // Filename for pack content
 *       version: number,           // Pack version
 *       lumiaCount: number,
 *       loomCount: number,
 *       isCustom: boolean,
 *       url: string | null,        // Source URL if imported from URL
 *       packAuthor: string | null,
 *       coverUrl: string | null,
 *     }
 *   },
 *   selections: {                  // Current selections (references only)
 *     selectedDefinition: { packId, itemName } | null,
 *     selectedBehaviors: [{ packId, itemName }],
 *     selectedPersonalities: [{ packId, itemName }],
 *     dominantBehavior: { packId, itemName } | null,
 *     dominantPersonality: { packId, itemName } | null,
 *     selectedLoomStyle: [{ packId, itemName }],
 *     selectedLoomUtils: [{ packId, itemName }],
 *     selectedLoomRetrofits: [{ packId, itemName }],
 *     selectedDefinitions: [{ packId, itemName }],  // Chimera mode
 *     councilMembers: [...],                         // Council mode
 *   },
 *   preferences: {                 // User preferences
 *     chimeraMode: boolean,
 *     councilMode: boolean,
 *     lumiaQuirks: string,
 *     lumiaQuirksEnabled: boolean,
 *     lumiaOOCInterval: number | null,
 *     lumiaOOCStyle: string,
 *     // ... other settings that don't need to be in extension_settings
 *   }
 * }
 */

const INDEX_SCHEMA_VERSION = 1;

/**
 * Create a default index structure.
 * @returns {Object} Default index object
 */
function createDefaultIndex() {
    return {
        version: INDEX_SCHEMA_VERSION,
        packRegistry: {},
        selections: {
            selectedDefinition: null,
            selectedBehaviors: [],
            selectedPersonalities: [],
            dominantBehavior: null,
            dominantPersonality: null,
            selectedLoomStyle: [],
            selectedLoomUtils: [],
            selectedLoomRetrofits: [],
            selectedDefinitions: [],
            councilMembers: [],
        },
        preferences: {
            chimeraMode: false,
            councilMode: false,
            lumiaQuirks: '',
            lumiaQuirksEnabled: true,
            lumiaOOCInterval: null,
            lumiaOOCStyle: 'social',
            activePresetName: null,
        },
    };
}

/**
 * Save the index file.
 * @param {Object} indexData - The index data to save
 * @returns {Promise<void>}
 */
export async function saveIndex(indexData) {
    try {
        await uploadFile(INDEX_FILENAME, indexData);
        console.log(`[${MODULE_NAME}] Index saved successfully`);
    } catch (err) {
        console.error(`[${MODULE_NAME}] Failed to save index:`, err);
        throw err;
    }
}

/**
 * Load the index file.
 * @returns {Promise<Object>} The index data (creates default if not exists)
 */
export async function loadIndex() {
    const data = await loadFile(INDEX_FILENAME);
    if (data) {
        // TODO: Add migration logic here if version < INDEX_SCHEMA_VERSION
        return data;
    }
    return createDefaultIndex();
}

// ============================================================================
// PACK FILE OPERATIONS
// ============================================================================

/**
 * Pack file schema (matches existing pack format):
 * {
 *   packName: string,
 *   packAuthor: string | null,
 *   coverUrl: string | null,
 *   version: number,
 *   packExtras: [],
 *   lumiaItems: [...],
 *   loomItems: [...],
 *   isCustom: boolean,
 *   url: string,
 * }
 */

/**
 * Save a pack to its own file.
 * @param {Object} pack - The pack object to save
 * @returns {Promise<string>} The file key used
 */
export async function savePack(pack) {
    const packName = pack.packName || pack.name;
    const fileKey = getPackFileKey(packName);

    try {
        await uploadFile(fileKey, pack);
        console.log(`[${MODULE_NAME}] Pack "${packName}" saved to ${fileKey}`);
        return fileKey;
    } catch (err) {
        console.error(`[${MODULE_NAME}] Failed to save pack "${packName}":`, err);
        throw err;
    }
}

/**
 * Load a pack from its file.
 * @param {string} fileKey - The pack file key
 * @returns {Promise<Object|null>} The pack data or null if not found
 */
export async function loadPack(fileKey) {
    return await loadFile(fileKey);
}

/**
 * Delete a pack file.
 * @param {string} fileKey - The pack file key
 * @returns {Promise<boolean>} True if deleted
 */
export async function deletePack(fileKey) {
    return await deleteFile(fileKey);
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Load multiple packs concurrently with a concurrency limit.
 * @param {string[]} fileKeys - Array of pack file keys to load
 * @param {number} concurrency - Max concurrent requests (default 3)
 * @returns {Promise<Map<string, Object>>} Map of fileKey -> pack data
 */
export async function loadPacksBatch(fileKeys, concurrency = 3) {
    const results = new Map();

    if (fileKeys.length === 0) {
        return results;
    }

    const queue = [];
    const loadItem = async (fileKey) => {
        try {
            const pack = await loadPack(fileKey);
            if (pack) {
                results.set(fileKey, pack);
            }
        } catch (err) {
            console.warn(`[${MODULE_NAME}] Failed to load pack ${fileKey}:`, err);
        }
    };

    for (const fileKey of fileKeys) {
        const promise = loadItem(fileKey).then(() => {
            // Remove from queue when done
            queue.splice(queue.indexOf(promise), 1);
        });
        queue.push(promise);

        if (queue.length >= concurrency) {
            await Promise.race(queue);
        }
    }

    // Wait for remaining items
    await Promise.all(queue);

    return results;
}

/**
 * Save multiple packs concurrently with a concurrency limit.
 * @param {Object[]} packs - Array of pack objects to save
 * @param {number} concurrency - Max concurrent requests (default 3)
 * @returns {Promise<{success: string[], failed: string[]}>} Results
 */
export async function savePacksBatch(packs, concurrency = 3) {
    const success = [];
    const failed = [];

    if (packs.length === 0) {
        return { success, failed };
    }

    const queue = [];
    const saveItem = async (pack) => {
        const packName = pack.packName || pack.name;
        try {
            await savePack(pack);
            success.push(packName);
        } catch (err) {
            console.warn(`[${MODULE_NAME}] Failed to save pack ${packName}:`, err);
            failed.push(packName);
        }
    };

    for (const pack of packs) {
        const promise = saveItem(pack).then(() => {
            queue.splice(queue.indexOf(promise), 1);
        });
        queue.push(promise);

        if (queue.length >= concurrency) {
            await Promise.race(queue);
        }
    }

    await Promise.all(queue);

    return { success, failed };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if the User Files API is available.
 * @returns {Promise<boolean>} True if API is available
 */
export async function isFileStorageAvailable() {
    try {
        // Try to load the index file - if the API is available, this will work
        // (either returning data or null for not found)
        const response = await fetch(`/user/files/${INDEX_FILENAME}?t=${Date.now()}`, {
            method: 'HEAD',
        });
        // 200 (file exists) or 404 (file doesn't exist) both mean API is available
        return response.ok || response.status === 404;
    } catch (err) {
        console.warn(`[${MODULE_NAME}] File storage API not available:`, err);
        return false;
    }
}

/**
 * List all Lumiverse pack files.
 * Note: This uses a HEAD request pattern to check existence.
 * For a full list, we rely on the index file's packRegistry.
 * @param {Object} index - The loaded index
 * @returns {string[]} Array of pack file keys
 */
export function getPackFileKeysFromIndex(index) {
    if (!index?.packRegistry) return [];
    return Object.values(index.packRegistry)
        .map(meta => meta.fileKey)
        .filter(Boolean);
}

/**
 * Create pack registry entry from a full pack object.
 * This extracts just the metadata needed for the index.
 * @param {Object} pack - Full pack object
 * @returns {Object} Registry entry (metadata only)
 */
export function createPackRegistryEntry(pack) {
    const packName = pack.packName || pack.name;
    return {
        packName,
        fileKey: getPackFileKey(packName),
        version: pack.version || 1,
        lumiaCount: pack.lumiaItems?.length || 0,
        loomCount: pack.loomItems?.length || 0,
        isCustom: pack.isCustom ?? !pack.url,
        url: pack.url || null,
        packAuthor: pack.packAuthor || pack.author || null,
        coverUrl: pack.coverUrl || null,
    };
}

/**
 * Generate a unique pack ID from pack name.
 * This is used as the key in packRegistry.
 * @param {string} packName - The pack name
 * @returns {string} Pack ID
 */
export function generatePackId(packName) {
    // For simplicity, use the pack name as the ID (normalized)
    // This maintains backwards compatibility with existing selection format
    return packName;
}
