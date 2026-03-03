/**
 * personaService — Persona listing and switching for Chat Sheld.
 *
 * Reads persona data from ST's powerUserSettings and provides
 * a clean API for the PersonaPopover component.
 *
 * Persona identity is the avatar FILENAME (e.g. "alice.png"), NOT
 * the display name.  Multiple personas can share the same display
 * name, so all look-ups and switches must use the filename key.
 */

import { getContext, getRequestHeaders, getEventSource, getEventTypes } from '../stContext.js';

const LOG_TAG = '[LumiverseHelper:Persona]';

let _currentUserAvatar = null;
let _listenerBound = false;

/**
 * Lazily resolve ST's personas module via dynamic import.
 * Stores the full module namespace so we can read `user_avatar`
 * as an ES module live binding (reflects ST's current value).
 * @returns {Promise<Object|null>}
 */
let _personasModule = null;
async function getPersonasModule() {
    if (_personasModule) return _personasModule;
    try {
        // webpackIgnore prevents webpack from bundling this — it resolves
        // at runtime against ST's own ES module on the page.
        _personasModule = await import(/* webpackIgnore: true */ '/scripts/personas.js');
        return _personasModule;
    } catch (e) {
        console.warn('[LumiverseHelper] Could not dynamically import personas.js:', e.message);
    }
    return null;
}

/** Shortcut: get setUserAvatar from the cached module. */
async function getSetUserAvatar() {
    const mod = await getPersonasModule();
    return (mod && typeof mod.setUserAvatar === 'function') ? mod.setUserAvatar : null;
}

/**
 * Bind the PERSONA_CHANGED listener (idempotent — safe to call multiple times).
 * ST emits PERSONA_CHANGED with the avatar filename as the first argument.
 * Also eagerly loads the personas module so user_avatar is available early.
 */
export function initPersonaListener() {
    if (_listenerBound) return;
    const es = getEventSource();
    const et = getEventTypes();
    if (es && et?.PERSONA_CHANGED) {
        es.on(et.PERSONA_CHANGED, (avatarId) => {
            const prev = _currentUserAvatar;
            _currentUserAvatar = avatarId || null;
            if (prev !== _currentUserAvatar) {
                console.debug(LOG_TAG, 'PERSONA_CHANGED event:', prev, '→', _currentUserAvatar);
            }
        });
        _listenerBound = true;
    }
    // Eagerly load the personas module so user_avatar binding is available
    // for getCurrentPersonaAvatar() without waiting for the first switchPersona() call.
    // Await the import and seed _currentUserAvatar from user_avatar if the event
    // hasn't fired yet — eliminates the race window where both sources are empty.
    getPersonasModule().then(mod => {
        if (mod?.user_avatar && !_currentUserAvatar) {
            _currentUserAvatar = mod.user_avatar;
            console.debug(LOG_TAG, 'Seeded _currentUserAvatar from module import:', _currentUserAvatar);
        }
    });
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
 *
 * Sources (in priority order):
 * 1. PERSONA_CHANGED event payload (captured by initPersonaListener)
 * 2. ST's user_avatar live binding from personas.js module namespace
 *
 * No name-based fallback is used because multiple personas can share
 * the same display name, making first-match iteration unreliable.
 *
 * @returns {string|null}
 */
export function getCurrentPersonaAvatar() {
    // Best source: captured from PERSONA_CHANGED event
    if (_currentUserAvatar) return _currentUserAvatar;

    // Read ST's user_avatar via ES module live binding (filename-based, no ambiguity)
    if (_personasModule && _personasModule.user_avatar) {
        _currentUserAvatar = _personasModule.user_avatar;
        console.debug(LOG_TAG, 'getCurrentPersonaAvatar: resolved from module binding:', _currentUserAvatar);
        return _currentUserAvatar;
    }

    // Both reliable sources unavailable — module not yet loaded and
    // PERSONA_CHANGED hasn't fired. Return null rather than guessing
    // by name (which breaks when multiple personas share a display name).
    console.warn(LOG_TAG, 'getCurrentPersonaAvatar: no reliable source available yet.',
        'Module loaded:', !!_personasModule,
        '| Listener bound:', _listenerBound,
        '| This is expected during early init; will resolve once PERSONA_CHANGED fires or module loads.');
    return null;
}

/**
 * Get ST's raw user_avatar from the personas module binding.
 * Unlike getCurrentPersonaAvatar(), this does NOT fall back to the cached
 * event value — it reads the live module export directly, giving the true
 * ST-side value at this instant.
 * @returns {string|null}
 */
export function getSTModuleUserAvatar() {
    return _personasModule?.user_avatar || null;
}

/**
 * Switch to a different persona by avatar filename.
 *
 * Uses ST's setUserAvatar(imgfile) directly via dynamic import so that
 * duplicate display names are handled correctly (the avatar filename
 * is the unique key, not the display name).
 *
 * @param {string} avatarId - The avatar filename to switch to
 */
export async function switchPersona(avatarId) {
    const ctx = getContext();
    if (!ctx) return;

    // Primary: call setUserAvatar directly — filename-based, no name ambiguity
    const setUA = await getSetUserAvatar();
    if (setUA) {
        try {
            await setUA(avatarId);
            _currentUserAvatar = avatarId;
            console.debug('[LumiverseHelper] switchPersona: used setUserAvatar() for', avatarId);
            return;
        } catch (e) {
            console.warn('[LumiverseHelper] setUserAvatar() failed:', e.message);
        }
    } else {
        console.warn('[LumiverseHelper] switchPersona: dynamic import of setUserAvatar unavailable, trying fallbacks');
    }

    // DOM fallback — click the persona entry by data-avatar-id attribute
    try {
        const item = document.querySelector(`#user_avatar_block .avatar-container[data-avatar-id="${CSS.escape(avatarId)}"]`);
        if (item) {
            item.click();
            _currentUserAvatar = avatarId;
            console.debug('[LumiverseHelper] switchPersona: used DOM click fallback for', avatarId);
            return;
        }
    } catch { /* ignore */ }

    // Last resort: simulate a click on the avatar container by first ensuring
    // the persona list is populated, then clicking the matching entry.
    // NOTE: The /persona slash command is NOT used here because ST's
    // setNameCallback resolves through display names via autoSelectPersona(),
    // which does first-match iteration and picks the wrong persona when
    // multiple personas share the same display name.
    console.warn('[LumiverseHelper] switchPersona: all methods failed for', avatarId,
        '— setUserAvatar unavailable and DOM element not found.',
        'Open the persona panel in ST settings and try again.');
}
