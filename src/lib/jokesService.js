/**
 * Jokes Service
 *
 * Fetches inside jokes from the Lucid Cards API and caches them locally
 * via SillyTavern's User Files API. Used as an easter egg on the landing
 * page loading states.
 *
 * API: GET https://lucid.cards/api/inside-jokes → { success: boolean, jokes: string[] }
 * Cache: lumiverse_jokes.json via User Files API, refreshed every 24h
 */

import { getRequestHeaders } from "../stContext.js";

const MODULE_NAME = "lumia-injector";
const JOKES_FILENAME = "lumiverse_jokes.json";
const JOKES_API_URL = "https://lucid.cards/api/inside-jokes";
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;   // Poll every 10 minutes
const STALENESS_MS = 24 * 60 * 60 * 1000;     // Stale after 24 hours

// ── In-memory cache ─────────────────────────────────────────────────────

let _jokesCache = { jokes: [], lastFetched: 0 };
let _pollIntervalId = null;
let _readyCallbacks = [];
let _isReady = false;

function notifyReady() {
    if (_isReady) return;
    if (_jokesCache.jokes.length === 0) return;
    _isReady = true;
    const cbs = _readyCallbacks;
    _readyCallbacks = [];
    for (const cb of cbs) cb();
}

// ── File I/O (mirrors fileStorage.js patterns) ─────────────────────────

function encodeToBase64(obj) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

async function saveJokesFile(data) {
    try {
        await fetch('/api/files/upload', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ name: JOKES_FILENAME, data: encodeToBase64(data) }),
        });
    } catch (err) {
        console.warn(`[${MODULE_NAME}] Jokes: Failed to save cache file:`, err);
    }
}

async function loadJokesFile() {
    try {
        const res = await fetch(`/user/files/${JOKES_FILENAME}?t=${Date.now()}`);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

// ── API fetch ───────────────────────────────────────────────────────────

async function fetchJokesFromAPI() {
    try {
        const res = await fetch(JOKES_API_URL);
        if (!res.ok) return null;
        const data = await res.json();
        if (data?.success && Array.isArray(data.jokes)) {
            return data.jokes;
        }
        return null;
    } catch (err) {
        console.warn(`[${MODULE_NAME}] Jokes: API fetch failed:`, err);
        return null;
    }
}

// ── Refresh logic ───────────────────────────────────────────────────────

async function maybeRefreshJokes() {
    if (Date.now() - _jokesCache.lastFetched < STALENESS_MS) return;

    const jokes = await fetchJokesFromAPI();
    if (!jokes || jokes.length === 0) return;

    _jokesCache = { jokes, lastFetched: Date.now() };
    notifyReady();
    await saveJokesFile(_jokesCache);
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Initialize the jokes cache. Loads from file storage, starts polling.
 * Non-blocking — safe to call fire-and-forget.
 */
export async function initJokesCache() {
    try {
        const stored = await loadJokesFile();
        if (stored && Array.isArray(stored.jokes) && stored.jokes.length > 0) {
            _jokesCache = { jokes: stored.jokes, lastFetched: stored.lastFetched || 0 };
            notifyReady();
        }
    } catch {
        // Ignore — will fetch fresh
    }

    // Initial refresh attempt (fire-and-forget)
    maybeRefreshJokes().catch(() => {});

    // Start polling interval
    if (!_pollIntervalId) {
        _pollIntervalId = setInterval(() => {
            maybeRefreshJokes().catch(() => {});
        }, REFRESH_INTERVAL_MS);
    }
}

/**
 * Get a random joke from the cache.
 * @returns {string|null} A random joke string, or null if cache is empty.
 */
export function getRandomJoke() {
    const { jokes } = _jokesCache;
    if (!jokes || jokes.length === 0) return null;
    return jokes[Math.floor(Math.random() * jokes.length)];
}

/**
 * Subscribe to jokes becoming available. If already loaded, fires immediately.
 * @param {Function} cb — Called once when jokes are available.
 * @returns {Function} Unsubscribe function.
 */
export function onJokesReady(cb) {
    if (_isReady) {
        cb();
        return () => {};
    }
    _readyCallbacks.push(cb);
    return () => {
        _readyCallbacks = _readyCallbacks.filter(fn => fn !== cb);
    };
}

/**
 * Tear down the polling interval.
 */
export function destroyJokesCache() {
    if (_pollIntervalId) {
        clearInterval(_pollIntervalId);
        _pollIntervalId = null;
    }
}
