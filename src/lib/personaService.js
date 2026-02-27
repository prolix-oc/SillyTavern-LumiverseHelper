/**
 * personaService — Persona listing and switching for Chat Sheld.
 *
 * Reads persona data from ST's powerUserSettings and provides
 * a clean API for the PersonaPopover component.
 */

import { getContext, getRequestHeaders, getEventSource, getEventTypes, getExecuteSlashCommands } from '../stContext.js';

let _currentUserAvatar = null;
let _listenerBound = false;

/**
 * Bind the PERSONA_CHANGED listener (idempotent — safe to call multiple times).
 */
export function initPersonaListener() {
    if (_listenerBound) return;
    const es = getEventSource();
    const et = getEventTypes();
    if (es && et?.PERSONA_CHANGED) {
        es.on(et.PERSONA_CHANGED, () => {
            const ctx = getContext();
            _currentUserAvatar = ctx?.user_avatar || null;
        });
        _listenerBound = true;
    }
}

/**
 * Fetch the full list of configured personas.
 * Merges avatar file list with persona names and descriptions.
 * @returns {Promise<Array<{ avatarId: string, name: string, title: string, avatarUrl: string }>>}
 */
export async function fetchPersonaList() {
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
    } catch {
        // If API unavailable, fall back to personas keys
    }

    // Build avatar set from both sources
    const avatarSet = new Set([
        ...avatarFiles,
        ...Object.keys(personas),
    ]);

    const list = [];
    for (const avatarId of avatarSet) {
        const name = personas[avatarId] || avatarId.replace(/\.[^.]+$/, '');
        const desc = descriptions[avatarId];
        const title = desc?.description || '';
        list.push({
            avatarId,
            name,
            title,
            avatarUrl: `User Avatars/${avatarId}`,
        });
    }

    // Sort alphabetically by name
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
}

/**
 * Get the currently active persona avatar identifier.
 * @returns {string|null}
 */
export function getCurrentPersonaAvatar() {
    if (_currentUserAvatar) return _currentUserAvatar;

    const ctx = getContext();
    if (ctx?.user_avatar) {
        _currentUserAvatar = ctx.user_avatar;
        return _currentUserAvatar;
    }

    // DOM fallback
    try {
        const img = document.querySelector('#user_avatar_block img[src]');
        if (img) {
            const src = img.getAttribute('src');
            const match = src?.match(/User Avatars\/(.+)/);
            if (match) return match[1];
        }
    } catch { /* ignore */ }

    return null;
}

/**
 * Switch to a different persona.
 * Uses ST's slash command system for a full persona switch.
 * @param {string} avatarId - The avatar filename to switch to
 */
export async function switchPersona(avatarId) {
    const ctx = getContext();
    if (!ctx) return;

    const personas = ctx.powerUserSettings?.personas || {};
    const name = personas[avatarId];
    if (!name) {
        console.warn('[LumiverseHelper] Cannot switch persona — no name for avatar:', avatarId);
        return;
    }

    const exec = getExecuteSlashCommands();
    if (exec) {
        try {
            await exec(`/persona ${name}`);
            _currentUserAvatar = avatarId;
            return;
        } catch (e) {
            console.warn('[LumiverseHelper] Slash command persona switch failed:', e.message);
        }
    }

    // DOM fallback — click the persona entry
    try {
        const item = document.querySelector(`.persona_avatar[imgfile="${avatarId}"]`);
        if (item) {
            item.click();
            _currentUserAvatar = avatarId;
        }
    } catch { /* ignore */ }
}
