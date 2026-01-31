/**
 * Update Service Module
 * Checks for extension updates via lucid.cards API
 */

import * as versionModule from "./version.js";

export const MODULE_NAME = "update-service";

// Extension name constant
const EXTENSION_NAME = "SillyTavern-LumiverseHelper";

// Lucid.cards API endpoint for version checking
const LUCID_API_URL = "https://lucid.cards/api/extension-versions";

// Current extension version - safely extract from module or use fallback
const EXTENSION_VERSION = versionModule?.EXTENSION_VERSION || versionModule?.default || "4.0.22";

// Cached local version
let localVersion = null;

// Cached update state
let cachedExtensionUpdate = null;
let lastExtensionCheck = 0;
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Event listeners for update state changes
const updateListeners = new Set();

/**
 * Subscribe to update state changes
 * @param {Function} listener - Callback invoked when update state changes
 * @returns {Function} Unsubscribe function
 */
export function subscribeToUpdates(listener) {
    updateListeners.add(listener);
    return () => updateListeners.delete(listener);
}

/**
 * Notify all listeners of an update state change
 * @private
 */
function notifyUpdateChange() {
    const state = getUpdateState();
    updateListeners.forEach(listener => {
        try {
            listener(state);
        } catch (err) {
            console.error(`[${MODULE_NAME}] Update listener error:`, err);
        }
    });
}

/**
 * Parse semver string into comparable object
 * @param {string} version - Version string like "4.0.1"
 * @returns {{major: number, minor: number, patch: number}}
 */
function parseSemver(version) {
    if (!version || typeof version !== 'string') {
        return { major: 0, minor: 0, patch: 0 };
    }
    const parts = version.replace(/^v/, '').split('.').map(Number);
    return {
        major: parts[0] || 0,
        minor: parts[1] || 0,
        patch: parts[2] || 0,
    };
}

/**
 * Compare two semver versions
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareSemver(v1, v2) {
    const a = parseSemver(v1);
    const b = parseSemver(v2);
    
    if (a.major !== b.major) return a.major < b.major ? -1 : 1;
    if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
    if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
    return 0;
}

/**
 * Get the local extension version.
 * Uses the EXTENSION_VERSION constant from version.js, which is updated
 * by update.sh whenever the manifest.json version changes.
 * This avoids all manifest caching issues since the version is baked into the code.
 * @param {boolean} forceFresh - Ignored - kept for API compatibility
 * @returns {Promise<string>}
 */
async function getLocalVersion(forceFresh = false) {
    if (typeof EXTENSION_VERSION !== 'undefined' && EXTENSION_VERSION) {
        localVersion = EXTENSION_VERSION;
        return localVersion;
    }
    return "4.0.0";
}

/**
 * Fetch the latest version from lucid.cards API
 * @returns {Promise<{version: string}|null>}
 */
async function fetchRemoteVersion() {
    try {
        const response = await fetch(`${LUCID_API_URL}?extension=${encodeURIComponent(EXTENSION_NAME)}`);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const data = await response.json();
        if (!data.success || !data.data || !data.data.version) {
            return null;
        }
        return { version: data.data.version };
    } catch (err) {
        console.error(`[${MODULE_NAME}] Fetch error:`, err);
        return null;
    }
}

/**
 * Get the current local extension version synchronously
 * @returns {string}
 */
export function getCurrentVersion() {
    return EXTENSION_VERSION;
}

/**
 * Check for extension updates
 * @param {boolean} force - Force check even if within interval
 * @returns {Promise<{hasUpdate: boolean, currentVersion: string, latestVersion: string}|null>}
 */
export async function checkExtensionUpdate(force = false) {
    const now = Date.now();
    
    // Invalidate cache if the local version has changed (e.g., after update + reload)
    // This ensures we don't show stale "update available" when already up-to-date
    if (cachedExtensionUpdate && cachedExtensionUpdate.currentVersion !== EXTENSION_VERSION) {
        console.log(`[${MODULE_NAME}] Cache invalidated: version changed from ${cachedExtensionUpdate.currentVersion} to ${EXTENSION_VERSION}`);
        cachedExtensionUpdate = null;
        lastExtensionCheck = 0;
    }
    
    // Return cached result if within interval
    if (!force && cachedExtensionUpdate && (now - lastExtensionCheck) < CHECK_INTERVAL) {
        return cachedExtensionUpdate;
    }
    
    const currentVersion = await getLocalVersion(true);
    const remoteVersion = await fetchRemoteVersion();

    if (!remoteVersion) {
        return null;
    }

    const latestVersion = remoteVersion.version;
    const hasUpdate = compareSemver(currentVersion, latestVersion) < 0;
    
    cachedExtensionUpdate = {
        hasUpdate,
        currentVersion,
        latestVersion,
    };
    lastExtensionCheck = now;
    
    notifyUpdateChange();
    return cachedExtensionUpdate;
}

/**
 * Get combined update state for UI
 * @returns {{extensionUpdate: Object|null, presetUpdates: Array}}
 */
export function getUpdateState() {
    return {
        extensionUpdate: cachedExtensionUpdate,
        // Preset updates are managed by presetsService, but we expose them here for convenience
        presetUpdates: [], // Will be populated by the React store
    };
}

/**
 * Get cached extension update without triggering a new check
 * @returns {{hasUpdate: boolean, currentVersion: string, latestVersion: string}|null}
 */
export function getCachedExtensionUpdate() {
    return cachedExtensionUpdate;
}

/**
 * Clear cached update state (useful for testing or manual refresh)
 */
export function clearUpdateCache() {
    cachedExtensionUpdate = null;
    lastExtensionCheck = 0;
    notifyUpdateChange();
}

/**
 * Set local version (for cases where we need to override, e.g., after update)
 * @param {string} version 
 */
export function setLocalVersion(version) {
    localVersion = version;
    clearUpdateCache();
}

// Expose debug function globally for testing
if (typeof window !== 'undefined') {
    window.debugUpdateCheck = () => checkExtensionUpdate(true);
}
