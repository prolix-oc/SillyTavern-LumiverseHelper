/**
 * worldBookService.js — Service layer for World Book (World Info) CRUD operations.
 *
 * Wraps ST's REST API endpoints for world info management.
 * Provides cache, normalization, and import/export utilities.
 *
 * All ST access goes through stContext.js (never direct imports).
 */

import { getContext, getRequestHeaders } from '../stContext';

// ---------------------------------------------------------------------------
// Store reference (set by initWorldBookInterceptor)
// ---------------------------------------------------------------------------

let storeRef = null;

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/** @type {Map<string, {entries: object[], originalData: object, loadedAt: number}>} */
const bookCache = new Map();

const CACHE_TTL = 60_000; // 1 minute

function invalidateCache(name) {
    if (name) {
        bookCache.delete(name);
    } else {
        bookCache.clear();
    }
}

// ---------------------------------------------------------------------------
// Entry defaults (mirrors ST's newWorldInfoEntryDefinition)
// ---------------------------------------------------------------------------

const DEFAULT_ENTRY = {
    uid: 0,
    key: [],
    keysecondary: [],
    content: '',
    comment: '',
    selective: true,
    selectiveLogic: 0, // AND_ANY
    constant: false,
    vectorized: false,
    disable: false,
    probability: 100,
    useProbability: true,
    position: 1, // After Char Defs
    depth: 4,
    role: 0, // System
    scanDepth: null,
    caseSensitive: null,
    matchWholeWords: null,
    useGroupScoring: null,
    excludeRecursion: false,
    preventRecursion: false,
    delayUntilRecursion: false,
    sticky: null,
    cooldown: null,
    delay: null,
    group: '',
    groupOverride: false,
    groupWeight: 100,
    order: 100,
    displayIndex: 0,
    characterFilter: null,
    triggers: [],
    addMemo: false,
    automationId: '',
    outletName: '',
    ignoreBudget: false,
    matchPersonaDescription: false,
    matchCharacterDescription: false,
    matchCharacterPersonality: false,
    matchCharacterDepthPrompt: false,
    matchScenario: false,
    matchCreatorNotes: false,
};

// Position labels
export const POSITION_LABELS = [
    { value: 0, label: '\u2191 Before Char Defs', short: '\u2191Char' },
    { value: 1, label: '\u2193 After Char Defs', short: '\u2193Char' },
    { value: 2, label: '\u2191 Before Example Messages', short: '\u2191EM' },
    { value: 3, label: '\u2193 After Example Messages', short: '\u2193EM' },
    { value: 4, label: '@ Depth', short: '@Depth' },
    { value: 5, label: '\u2191 Before Author\'s Note', short: '\u2191AT' },
    { value: 6, label: '\u2193 After Author\'s Note', short: '\u2193AT' },
    { value: 7, label: 'Outlet', short: 'Outlet' },
];

// Selective logic labels
export const SELECTIVE_LOGIC_OPTIONS = [
    { value: 0, label: 'AND ANY' },
    { value: 1, label: 'AND ALL' },
    { value: 2, label: 'NOT ALL' },
    { value: 3, label: 'NOT ANY' },
];

// Role labels
export const ROLE_OPTIONS = [
    { value: 0, label: 'System' },
    { value: 1, label: 'User' },
    { value: 2, label: 'Assistant' },
];

// Trigger options
export const TRIGGER_OPTIONS = [
    { value: 0, label: 'Normal' },
    { value: 1, label: 'Continue' },
    { value: 2, label: 'Impersonate' },
    { value: 3, label: 'Swipe' },
    { value: 4, label: 'Regenerate' },
    { value: 5, label: 'Quiet' },
];

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a uid-keyed entries object into an array with defaults applied.
 * ST stores: { entries: { "0": {...}, "1": {...} } }
 * We want: [{ uid: 0, ... }, { uid: 1, ... }]
 */
export function normalizeEntries(entriesObj) {
    if (!entriesObj || typeof entriesObj !== 'object') return [];

    return Object.entries(entriesObj).map(([uid, entry]) => {
        const normalized = { ...DEFAULT_ENTRY };
        const numUid = parseInt(uid, 10);

        // Merge all known fields from the entry
        for (const key of Object.keys(DEFAULT_ENTRY)) {
            if (entry[key] !== undefined) {
                normalized[key] = entry[key];
            }
        }

        // Ensure uid is always set
        normalized.uid = entry.uid ?? numUid;

        // Normalize key/keysecondary to arrays
        if (typeof normalized.key === 'string') {
            normalized.key = normalized.key.split(',').map(k => k.trim()).filter(Boolean);
        }
        if (typeof normalized.keysecondary === 'string') {
            normalized.keysecondary = normalized.keysecondary.split(',').map(k => k.trim()).filter(Boolean);
        }

        // Normalize character filter
        if (entry.characterFilter) {
            normalized.characterFilter = {
                names: entry.characterFilter.names || [],
                tags: entry.characterFilter.tags || [],
                isExclude: entry.characterFilter.isExclude ?? false,
            };
        }

        // Normalize triggers to array
        if (!Array.isArray(normalized.triggers)) {
            normalized.triggers = [];
        }

        return normalized;
    });
}

/**
 * Convert normalized array back to uid-keyed object for API calls.
 */
export function denormalizeEntries(entriesArray) {
    const obj = {};
    for (const entry of entriesArray) {
        const clone = { ...entry };
        // Convert key arrays back to comma-separated strings if ST expects that
        // Actually ST handles both formats — keep as arrays for modern ST
        obj[String(clone.uid)] = clone;
    }
    return obj;
}

/**
 * Get next available UID from an entries array.
 */
export function getNextUid(entries) {
    if (!entries.length) return 0;
    return Math.max(...entries.map(e => e.uid)) + 1;
}

/**
 * Create a new entry with defaults and the given UID.
 */
export function createDefaultEntry(uid) {
    return {
        ...DEFAULT_ENTRY,
        uid,
        displayIndex: uid,
    };
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Fetch list of all available world books.
 * @returns {Promise<Array<{name: string}>>}
 */
export async function fetchBookList() {
    try {
        const headers = getRequestHeaders();
        const resp = await fetch('/api/worldinfo/list', {
            method: 'POST',
            headers,
            body: JSON.stringify({}),
        });
        if (!resp.ok) throw new Error(`Failed to fetch book list: ${resp.status}`);
        const data = await resp.json();
        // ST returns array of file names (strings) or objects with name property
        if (Array.isArray(data)) {
            return data.map(item => {
                if (typeof item === 'string') return { name: item };
                return { name: item.name || item.file_id || String(item) };
            });
        }
        return [];
    } catch (err) {
        console.error('[Lumiverse WB] fetchBookList error:', err);
        return [];
    }
}

/**
 * Fetch a complete world book with all entries.
 * @param {string} name - Book name/file_id
 * @returns {Promise<{entries: object[], originalData: object}|null>}
 */
export async function fetchBook(name) {
    if (!name) return null;

    // Check cache
    const cached = bookCache.get(name);
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL) {
        return { entries: cached.entries, originalData: cached.originalData };
    }

    try {
        const headers = getRequestHeaders();
        const resp = await fetch('/api/worldinfo/get', {
            method: 'POST',
            headers,
            body: JSON.stringify({ name }),
        });
        if (!resp.ok) throw new Error(`Failed to fetch book "${name}": ${resp.status}`);
        const data = await resp.json();

        const entries = normalizeEntries(data.entries);

        const result = { entries, originalData: data };
        bookCache.set(name, { ...result, loadedAt: Date.now() });
        return result;
    } catch (err) {
        console.error('[Lumiverse WB] fetchBook error:', err);
        return null;
    }
}

/**
 * Save a world book with entries.
 * @param {string} name - Book name
 * @param {object} data - Full book data (with entries as uid-keyed object)
 * @returns {Promise<boolean>}
 */
export async function saveBook(name, data) {
    try {
        const headers = getRequestHeaders();
        const resp = await fetch('/api/worldinfo/edit', {
            method: 'POST',
            headers,
            body: JSON.stringify({ name, data }),
        });
        if (!resp.ok) throw new Error(`Failed to save book "${name}": ${resp.status}`);
        invalidateCache(name);
        return true;
    } catch (err) {
        console.error('[Lumiverse WB] saveBook error:', err);
        return false;
    }
}

/**
 * Delete a world book.
 * @param {string} name - Book name
 * @returns {Promise<boolean>}
 */
export async function deleteBook(name) {
    try {
        const headers = getRequestHeaders();
        const resp = await fetch('/api/worldinfo/delete', {
            method: 'POST',
            headers,
            body: JSON.stringify({ name }),
        });
        if (!resp.ok) throw new Error(`Failed to delete book "${name}": ${resp.status}`);
        invalidateCache(name);
        return true;
    } catch (err) {
        console.error('[Lumiverse WB] deleteBook error:', err);
        return false;
    }
}

/**
 * Import a world book from file data.
 * @param {File} file - File to import
 * @returns {Promise<string|null>} - Imported book name, or null on failure
 */
export async function importBookFromFile(file) {
    try {
        const headers = getRequestHeaders();
        // Remove Content-Type so browser sets multipart boundary
        const importHeaders = { ...headers };
        delete importHeaders['Content-Type'];

        const formData = new FormData();
        formData.append('file', file);

        const resp = await fetch('/api/worldinfo/import', {
            method: 'POST',
            headers: importHeaders,
            body: formData,
        });
        if (!resp.ok) throw new Error(`Failed to import book: ${resp.status}`);
        const data = await resp.json();
        invalidateCache();
        return data.name || null;
    } catch (err) {
        console.error('[Lumiverse WB] importBook error:', err);
        return null;
    }
}

/**
 * Create a new empty world book.
 * @param {string} name - Book name
 * @returns {Promise<boolean>}
 */
export async function createNewBook(name) {
    if (!name) return false;
    try {
        const headers = getRequestHeaders();
        // Create via the import endpoint with convertedData
        const resp = await fetch('/api/worldinfo/import', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                convertedData: {
                    entries: {},
                    originalData: { entries: {} },
                },
                name,
            }),
        });
        if (!resp.ok) throw new Error(`Failed to create book "${name}": ${resp.status}`);
        invalidateCache();
        return true;
    } catch (err) {
        console.error('[Lumiverse WB] createNewBook error:', err);
        return false;
    }
}

// ---------------------------------------------------------------------------
// Book management utilities
// ---------------------------------------------------------------------------

/**
 * Export a book as downloadable JSON file.
 * @param {string} name - Book name
 */
export async function exportBookToFile(name) {
    const result = await fetchBook(name);
    if (!result) return;

    const exportData = {
        ...result.originalData,
        entries: denormalizeEntries(result.entries),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Rename a book (fetch → save as new → delete old).
 * @param {string} oldName
 * @param {string} newName
 * @returns {Promise<boolean>}
 */
export async function renameBook(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return false;
    const result = await fetchBook(oldName);
    if (!result) return false;

    const saveData = {
        ...result.originalData,
        entries: denormalizeEntries(result.entries),
    };

    const saved = await saveBook(newName, saveData);
    if (!saved) return false;

    const deleted = await deleteBook(oldName);
    return deleted;
}

/**
 * Duplicate a book under a new name.
 * @param {string} sourceName
 * @param {string} newName
 * @returns {Promise<boolean>}
 */
export async function duplicateBook(sourceName, newName) {
    if (!sourceName || !newName) return false;
    const result = await fetchBook(sourceName);
    if (!result) return false;

    const saveData = {
        ...result.originalData,
        entries: denormalizeEntries(result.entries),
    };

    return await saveBook(newName, saveData);
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

/**
 * Backfill empty comments with the first keyword.
 * @param {object[]} entries - Normalized entries array
 * @returns {object[]} - Updated entries (new array, entries mutated in-place for convenience)
 */
export function backfillMemos(entries) {
    return entries.map(entry => {
        if (!entry.comment && entry.key.length > 0) {
            return { ...entry, comment: entry.key[0] };
        }
        return entry;
    });
}

/**
 * Rewrite displayIndex to match a given sort order.
 * @param {object[]} entries - Sorted entries array
 * @returns {object[]} - Updated entries with sequential displayIndex values
 */
export function applySortOrder(entries) {
    return entries.map((entry, idx) => ({
        ...entry,
        displayIndex: idx,
    }));
}

/**
 * Get the list of world names currently active for the selected character/chat.
 * @returns {string[]}
 */
export function getActiveWorldNames() {
    try {
        const ctx = getContext();
        // ST stores active world names in various places
        if (ctx?.worldNames && Array.isArray(ctx.worldNames)) {
            return ctx.worldNames;
        }
        return [];
    } catch {
        return [];
    }
}

/**
 * Get globally enabled world books by reading ST's #world_info select element.
 * Returns an array of book names that are currently selected (globally active).
 * @returns {string[]}
 */
export function getGloballyEnabledBooks() {
    try {
        const select = document.querySelector('#world_info');
        if (!select) return [];
        const selected = [];
        for (const opt of select.options) {
            if (opt.selected) selected.push(opt.textContent);
        }
        return selected;
    } catch {
        return [];
    }
}

/**
 * Toggle a world book's global enabled state.
 * Manipulates ST's #world_info select element and fires a change event
 * so ST's internal onWorldInfoChange() persists the change.
 * @param {string} bookName - Name of the world book
 * @param {boolean} enabled - Whether to enable or disable
 * @returns {boolean} Whether the toggle succeeded
 */
export function setGlobalBookEnabled(bookName, enabled) {
    try {
        const select = document.querySelector('#world_info');
        if (!select) return false;
        for (const opt of select.options) {
            if (opt.textContent === bookName) {
                opt.selected = enabled;
                // Trigger change event so ST persists the selection
                select.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
        }
        return false;
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// ST button interceptor
// ---------------------------------------------------------------------------

/**
 * Initialize the World Book button interceptor.
 *
 * Intercepts ST's #WIDrawerIcon click (capture phase) to open the Lumiverse
 * World Book Editor modal instead of ST's native jQuery-based World Info panel.
 *
 * @param {Object} store - Lumiverse vanilla JS store instance
 */
export function initWorldBookInterceptor(store) {
    storeRef = store;

    const wiIcon = document.getElementById('WIDrawerIcon');
    if (!wiIcon) return;

    wiIcon.addEventListener(
        'click',
        (e) => {
            if (!storeRef.getState().enableWorldBookEditor) {
                return; // Let ST handle it natively
            }

            e.stopImmediatePropagation();
            e.preventDefault();

            // Close ST's native World Info panel if it was open
            const wiPanel = document.getElementById('WorldInfo');
            if (wiPanel?.classList.contains('openDrawer')) {
                wiPanel.classList.remove('openDrawer');
                wiPanel.classList.add('closedDrawer');
                wiIcon.classList.remove('openIcon');
                wiIcon.classList.add('closedIcon');
            }

            // Open our modal via the store
            storeRef.setState({
                ui: {
                    ...storeRef.getState().ui,
                    activeModal: { name: 'worldBookEditor', props: {} },
                },
            });
        },
        true // capture phase — fires before ST's jQuery handler
    );
}
