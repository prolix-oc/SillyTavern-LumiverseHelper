/**
 * Persona Manager Service
 *
 * Full CRUD operations for ST personas. Reads from power_user.personas /
 * persona_descriptions and the /api/avatars/* REST endpoints.
 * Pushes normalized PersonaItem[] into the vanilla JS store.
 *
 * Re-exports helpers from personaService.js so consumers only need one import.
 */

import {
    getContext,
    getRequestHeaders,
    getEventSource,
    getEventTypes,
    getSaveSettingsDebounced,
} from '../stContext.js';

// Re-export persona helpers that PersonaPopover already depends on
export { switchPersona, getCurrentPersonaAvatar, initPersonaListener } from './personaService.js';

/** @type {ReturnType<typeof import('../react-ui/store/LumiverseContext.jsx').useLumiverseStore> | null} */
let storeRef = null;

/** Debounce timer for persona sync */
let syncTimer = null;
const SYNC_DEBOUNCE = 200;

// ─── Read Operations ────────────────────────────────────────────

/**
 * Fetch the full persona list, merging avatar files with power_user data.
 * Returns a normalized PersonaItem[] ready for the store.
 * @returns {Promise<import('./personaManagerService').PersonaItem[]>}
 */
export async function fetchFullPersonaList() {
    const ctx = getContext();
    if (!ctx) return [];

    const personas = ctx.powerUserSettings?.personas || {};
    const descriptions = ctx.powerUserSettings?.persona_descriptions || {};

    // Fetch avatar file list from ST API
    let avatarFiles = [];
    try {
        const resp = await fetch('/api/avatars/get', {
            method: 'POST',
            headers: getRequestHeaders(),
        });
        if (resp.ok) {
            avatarFiles = await resp.json();
        }
    } catch { /* fallback to personas keys */ }

    // Merge both sources
    const avatarSet = new Set([...avatarFiles, ...Object.keys(personas)]);

    const defaultPersonaId = getDefaultPersonaId();
    const chatLockedId = getChatLockedPersona();

    const list = [];
    for (const avatarId of avatarSet) {
        const name = personas[avatarId] || avatarId.replace(/\.[^.]+$/, '');
        const desc = descriptions[avatarId] || {};
        const connections = Array.isArray(desc.extensions?.connections)
            ? desc.extensions.connections
            : [];

        list.push({
            avatarId,
            name,
            title: desc.title || '',
            description: desc.description || '',
            avatarUrl: `User Avatars/${avatarId}`,
            position: desc.position ?? 0,
            depth: desc.depth ?? 0,
            role: desc.role ?? 0,
            lorebook: desc.extensions?.lorebook || '',
            connections,
            isActive: avatarId === getCurrentActivePersona(),
            isDefault: avatarId === defaultPersonaId,
            isChatLocked: avatarId === chatLockedId,
            hasConnections: connections.length > 0,
        });
    }

    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
}

/**
 * Get the default persona avatar ID.
 * @returns {string|null}
 */
export function getDefaultPersonaId() {
    const ctx = getContext();
    return ctx?.powerUserSettings?.default_persona || null;
}

/**
 * Get the chat-locked persona avatar ID.
 * @returns {string|null}
 */
export function getChatLockedPersona() {
    const ctx = getContext();
    return ctx?.chatMetadata?.persona || null;
}

/**
 * Get the currently active persona avatar ID.
 * Uses name matching against power_user.personas as fallback.
 * @returns {string|null}
 */
function getCurrentActivePersona() {
    const ctx = getContext();
    if (!ctx) return null;

    const personas = ctx.powerUserSettings?.personas || {};
    const currentName = ctx.name1;
    if (!currentName) return null;

    for (const [avatarId, name] of Object.entries(personas)) {
        if (name === currentName) return avatarId;
    }
    return null;
}

/**
 * Get persona connections for a specific avatar.
 * @param {string} avatarId
 * @returns {Array<{type: string, id: string}>}
 */
export function getPersonaConnections(avatarId) {
    const ctx = getContext();
    const desc = ctx?.powerUserSettings?.persona_descriptions?.[avatarId];
    return Array.isArray(desc?.extensions?.connections) ? desc.extensions.connections : [];
}

// ─── Write Operations ───────────────────────────────────────────

/**
 * Create a new persona by uploading an avatar.
 * @param {string} name - Display name
 * @param {File} avatarFile - Image file
 * @returns {Promise<string|null>} New avatar ID or null on failure
 */
export async function createPersona(name, avatarFile) {
    const ctx = getContext();
    if (!ctx || !avatarFile) return null;

    const formData = new FormData();
    formData.append('avatar', avatarFile);
    formData.append('overwrite_name', '');

    try {
        const headers = { ...getRequestHeaders() };
        delete headers['Content-Type']; // Let browser set multipart boundary
        const resp = await fetch('/api/avatars/upload', {
            method: 'POST',
            headers,
            body: formData,
        });
        // Upload endpoint returns the filename
        if (!resp.ok) return null;
        const avatarId = await resp.text();
        if (!avatarId) return null;

        // Register in power_user
        if (!ctx.powerUserSettings.personas) ctx.powerUserSettings.personas = {};
        if (!ctx.powerUserSettings.persona_descriptions) ctx.powerUserSettings.persona_descriptions = {};

        ctx.powerUserSettings.personas[avatarId] = name;
        ctx.powerUserSettings.persona_descriptions[avatarId] = {
            description: '',
            title: '',
            position: 0,
            depth: 0,
            role: 0,
            extensions: { connections: [], lorebook: '' },
        };

        getSaveSettingsDebounced()();
        debouncedSync();
        return avatarId;
    } catch (e) {
        console.error('[Lumiverse] PersonaManager: createPersona failed:', e);
        return null;
    }
}

/**
 * Upload / replace a persona's avatar image.
 * @param {string} avatarId - Existing avatar filename
 * @param {File} file - New image file
 * @returns {Promise<boolean>}
 */
export async function uploadPersonaAvatar(avatarId, file) {
    if (!avatarId || !file) return false;

    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('overwrite_name', avatarId);

    try {
        const headers = { ...getRequestHeaders() };
        delete headers['Content-Type']; // Let browser set multipart boundary
        const resp = await fetch('/api/avatars/upload', {
            method: 'POST',
            headers,
            body: formData,
        });
        if (resp.ok) {
            debouncedSync();
            return true;
        }
    } catch (e) {
        console.error('[Lumiverse] PersonaManager: uploadAvatar failed:', e);
    }
    return false;
}

/**
 * Rename a persona.
 * @param {string} avatarId
 * @param {string} newName
 */
export function renamePersona(avatarId, newName) {
    const ctx = getContext();
    if (!ctx?.powerUserSettings?.personas) return;

    ctx.powerUserSettings.personas[avatarId] = newName;
    getSaveSettingsDebounced()();
    debouncedSync();
}

/**
 * Partial update to persona description fields.
 * @param {string} avatarId
 * @param {Object} changes - Partial descriptor: { description, title, position, depth, role }
 */
export function updatePersonaDescription(avatarId, changes) {
    const ctx = getContext();
    if (!ctx) return;

    if (!ctx.powerUserSettings.persona_descriptions) {
        ctx.powerUserSettings.persona_descriptions = {};
    }
    const desc = ctx.powerUserSettings.persona_descriptions[avatarId] || {};

    // Apply changes shallowly
    for (const [key, val] of Object.entries(changes)) {
        if (key === 'extensions') {
            desc.extensions = { ...(desc.extensions || {}), ...val };
        } else {
            desc[key] = val;
        }
    }

    ctx.powerUserSettings.persona_descriptions[avatarId] = desc;
    getSaveSettingsDebounced()();
    debouncedSync();
}

/**
 * Delete a persona entirely.
 * @param {string} avatarId
 * @returns {Promise<boolean>}
 */
export async function deletePersona(avatarId) {
    const ctx = getContext();
    if (!ctx || !avatarId) return false;

    try {
        const resp = await fetch('/api/avatars/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ avatar: avatarId }),
        });
        if (!resp.ok) return false;

        // Clean up power_user
        delete ctx.powerUserSettings.personas?.[avatarId];
        delete ctx.powerUserSettings.persona_descriptions?.[avatarId];

        // If this was the default, clear it
        if (ctx.powerUserSettings.default_persona === avatarId) {
            ctx.powerUserSettings.default_persona = null;
        }
        // If chat-locked, clear
        if (ctx.chatMetadata?.persona === avatarId) {
            delete ctx.chatMetadata.persona;
        }

        getSaveSettingsDebounced()();
        debouncedSync();
        return true;
    } catch (e) {
        console.error('[Lumiverse] PersonaManager: deletePersona failed:', e);
        return false;
    }
}

/**
 * Duplicate a persona (re-upload its avatar with a new name).
 * @param {string} avatarId - Source avatar
 * @returns {Promise<string|null>} New avatar ID or null
 */
export async function duplicatePersona(avatarId) {
    const ctx = getContext();
    if (!ctx) return null;

    const personas = ctx.powerUserSettings?.personas || {};
    const descriptions = ctx.powerUserSettings?.persona_descriptions || {};
    const srcName = personas[avatarId];
    if (!srcName) return null;

    // Fetch the avatar image as a blob
    try {
        const imgResp = await fetch(`User Avatars/${avatarId}`);
        if (!imgResp.ok) return null;
        const blob = await imgResp.blob();
        const file = new File([blob], avatarId, { type: blob.type || 'image/png' });

        const newName = `${srcName} (Copy)`;
        const newId = await createPersona(newName, file);
        if (!newId) return null;

        // Clone description
        const srcDesc = descriptions[avatarId];
        if (srcDesc) {
            ctx.powerUserSettings.persona_descriptions[newId] = JSON.parse(JSON.stringify(srcDesc));
            getSaveSettingsDebounced()();
            debouncedSync();
        }

        return newId;
    } catch (e) {
        console.error('[Lumiverse] PersonaManager: duplicatePersona failed:', e);
        return null;
    }
}

/**
 * Toggle default persona status.
 * @param {string} avatarId
 */
export function toggleDefaultPersona(avatarId) {
    const ctx = getContext();
    if (!ctx) return;

    if (ctx.powerUserSettings.default_persona === avatarId) {
        ctx.powerUserSettings.default_persona = null;
    } else {
        ctx.powerUserSettings.default_persona = avatarId;
    }

    getSaveSettingsDebounced()();
    debouncedSync();
}

/**
 * Toggle chat lock for a persona.
 * @param {string} avatarId
 * @param {boolean} lock - true to lock, false to unlock
 */
export function toggleChatLock(avatarId, lock) {
    const ctx = getContext();
    if (!ctx?.chatMetadata) return;

    if (lock) {
        ctx.chatMetadata.persona = avatarId;
    } else {
        delete ctx.chatMetadata.persona;
    }

    // Save chat metadata
    if (typeof ctx.saveMetadata === 'function') {
        ctx.saveMetadata();
    }
    getSaveSettingsDebounced()();
    debouncedSync();
}

/**
 * Add a connection to a persona descriptor.
 * @param {string} avatarId
 * @param {{ type: string, id: string }} connection
 */
export function addConnection(avatarId, connection) {
    const ctx = getContext();
    if (!ctx) return;

    const desc = ctx.powerUserSettings?.persona_descriptions?.[avatarId];
    if (!desc) return;

    if (!desc.extensions) desc.extensions = {};
    if (!Array.isArray(desc.extensions.connections)) desc.extensions.connections = [];

    desc.extensions.connections.push(connection);
    getSaveSettingsDebounced()();
    debouncedSync();
}

/**
 * Remove a connection from a persona descriptor by index.
 * @param {string} avatarId
 * @param {number} idx
 */
export function removeConnection(avatarId, idx) {
    const ctx = getContext();
    if (!ctx) return;

    const conns = ctx.powerUserSettings?.persona_descriptions?.[avatarId]?.extensions?.connections;
    if (!Array.isArray(conns) || idx < 0 || idx >= conns.length) return;

    conns.splice(idx, 1);
    getSaveSettingsDebounced()();
    debouncedSync();
}

/**
 * Set the lorebook for a persona.
 * @param {string} avatarId
 * @param {string} bookName
 */
export function setPersonaLorebook(avatarId, bookName) {
    const ctx = getContext();
    if (!ctx) return;

    const desc = ctx.powerUserSettings?.persona_descriptions?.[avatarId];
    if (!desc) return;

    if (!desc.extensions) desc.extensions = {};
    desc.extensions.lorebook = bookName || '';
    getSaveSettingsDebounced()();
    debouncedSync();
}

// ─── Store Sync ─────────────────────────────────────────────────

/**
 * Full rebuild of personaManager store state from ST data.
 */
export async function syncPersonas() {
    if (!storeRef) return;

    const personas = await fetchFullPersonaList();
    const defaultId = getDefaultPersonaId();
    const chatLockedId = getChatLockedPersona();
    const activeId = getCurrentActivePersona();

    storeRef.setState({
        personaManager: {
            personas,
            activePersonaId: activeId,
            defaultPersonaId: defaultId,
            chatLockedPersonaId: chatLockedId,
            lastSyncTimestamp: Date.now(),
        },
    });
}

/**
 * Debounced sync wrapper.
 */
function debouncedSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(syncPersonas, SYNC_DEBOUNCE);
}

/**
 * Initialize the persona manager service.
 * Subscribes to ST events and performs initial sync.
 * @param {Object} store - Lumiverse vanilla JS store
 */
export function initPersonaManager(store) {
    storeRef = store;

    const eventSource = getEventSource();
    const eventTypes = getEventTypes();

    if (!eventSource || !eventTypes) {
        console.warn('[Lumiverse] PersonaManager: Event system not available');
        return;
    }

    // Initial sync
    eventSource.on(eventTypes.APP_READY, () => {
        syncPersonas();
    });

    // Live updates
    if (eventTypes.PERSONA_CHANGED) {
        eventSource.on(eventTypes.PERSONA_CHANGED, debouncedSync);
    }
    if (eventTypes.CHAT_CHANGED) {
        eventSource.on(eventTypes.CHAT_CHANGED, debouncedSync);
    }
    if (eventTypes.SETTINGS_UPDATED) {
        eventSource.on(eventTypes.SETTINGS_UPDATED, debouncedSync);
    }

    // Intercept ST's persona management button to open Lumiverse Personas tab instead
    const personaBtn = document.getElementById('persona-management-button');
    if (personaBtn) {
        personaBtn.addEventListener(
            'click',
            (e) => {
                if (!storeRef.getState().enablePersonaManager) {
                    return; // Let ST handle it natively
                }

                e.stopImmediatePropagation();
                e.preventDefault();

                // Signal Lumiverse to open Personas tab
                storeRef.setState({ _openToTab: 'personas' });
            },
            true // capture phase — fires before ST's handler
        );
    }
}
