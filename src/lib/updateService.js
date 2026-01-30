/**
 * Update Service Module
 * Checks for extension and preset updates via GitHub API
 */

import { EXTENSION_VERSION } from "./version.js";

export const MODULE_NAME = "update-service";

// Fallback extension name if bridge is not available
const FALLBACK_EXTENSION_NAME = "SillyTavern-LumiverseHelper";

/**
 * Get the extension folder name, preferring the dynamic value from LumiverseBridge
 * which is derived from import.meta.url per EXTENSION_GUIDE_UPDATES.md.
 * @returns {string} Extension folder name
 */
function getExtensionName() {
    if (typeof LumiverseBridge !== 'undefined' && LumiverseBridge.extensionName) {
        return LumiverseBridge.extensionName;
    }
    return FALLBACK_EXTENSION_NAME;
}

// GitHub raw content URL for manifest.json
const GITHUB_MANIFEST_URL = "https://raw.githubusercontent.com/prolix-oc/SillyTavern-LumiverseHelper/main/manifest.json";

// Current extension version (injected at build time or read from local manifest)
let localVersion = null;

// Cached update state
let cachedExtensionUpdate = null;
let lastExtensionCheck = 0;
const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

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
function compareSemver(v1, v2) {
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
    // Use the imported constant - this is updated at build/deploy time
    // by update.sh, so it always matches the manifest.json version
    if (EXTENSION_VERSION) {
        localVersion = EXTENSION_VERSION;
        return localVersion;
    }

    // Fallback - should never happen since EXTENSION_VERSION is a required import
    console.warn(`[${MODULE_NAME}] EXTENSION_VERSION not available, using fallback`);
    return "4.0.0";
}

/**
 * Fetch the latest manifest from GitHub
 * @returns {Promise<{version: string, display_name: string}|null>}
 */
async function fetchRemoteManifest() {
    try {
        // Add cache-busting query param to bypass GitHub's CDN caching
        const cacheBuster = `?t=${Date.now()}`;
        const response = await fetch(GITHUB_MANIFEST_URL + cacheBuster, {
            cache: 'no-store',
            headers: {
                'Accept': 'application/json',
            },
        });
        
        if (!response.ok) {
            console.warn(`[${MODULE_NAME}] Failed to fetch remote manifest: ${response.status}`);
            return null;
        }
        
        const manifest = await response.json();
        return {
            version: manifest.version,
            display_name: manifest.display_name || 'Lumiverse Helper',
        };
    } catch (error) {
        console.warn(`[${MODULE_NAME}] Error fetching remote manifest:`, error);
        return null;
    }
}

/**
 * Check for extension updates
 * @param {boolean} force - Force check even if within interval
 * @returns {Promise<{hasUpdate: boolean, currentVersion: string, latestVersion: string}|null>}
 */
export async function checkExtensionUpdate(force = false) {
    const now = Date.now();
    
    // Return cached result if within interval
    if (!force && cachedExtensionUpdate && (now - lastExtensionCheck) < CHECK_INTERVAL) {
        return cachedExtensionUpdate;
    }
    
    // Always fetch fresh local version to detect manual updates
    // Use forceFresh=true to bypass cache and re-read manifest
    const currentVersion = await getLocalVersion(true);
    const remoteManifest = await fetchRemoteManifest();
    
    if (!remoteManifest) {
        return null;
    }
    
    const latestVersion = remoteManifest.version;
    const hasUpdate = compareSemver(currentVersion, latestVersion) < 0;
    
    cachedExtensionUpdate = {
        hasUpdate,
        currentVersion,
        latestVersion,
    };
    lastExtensionCheck = now;
    
    // Notify listeners
    notifyUpdateChange();
    
    console.log(`[${MODULE_NAME}] Extension update check: current=${currentVersion}, latest=${latestVersion}, hasUpdate=${hasUpdate}`);
    
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
