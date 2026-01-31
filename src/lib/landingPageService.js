/**
 * Landing Page Service
 *
 * Handles fetching and managing recent chats for the custom landing page.
 * Uses global characters and groups arrays (compatible with lazy loading).
 * Integrates with Lumiverse preset bindings to show contextual information.
 */

import { getSettings } from "./settingsManager.js";
import { getCachedIndex } from "./packCache.js";

const MODULE_NAME = "lumia-injector";

/**
 * Get recent chats from global characters and groups arrays
 * Compatible with SillyTavern's lazy loading feature
 * @param {number} limit - Maximum number of chats to retrieve
 * @returns {Promise<Array>} Array of recent chat objects
 */
export async function getRecentChats(limit = 10) {
    try {
        // Dynamic import to get global arrays (avoids bundling issues)
        const { characters, groups } = await import(/* webpackIgnore: true */ '../../../../../script.js');

        // Merge characters and groups, filtering for those with chat history
        const recentItems = [
            ...(characters || []).map(char => ({
                ...char,
                _isGroup: false,
                _sortDate: char.date_last_chat || 0,
            })),
            ...(groups || []).map(group => ({
                ...group,
                _isGroup: true,
                _sortDate: group.date_last_chat || 0,
            })),
        ]
            .filter(item => item._sortDate > 0) // Only items with history
            .sort((a, b) => b._sortDate - a._sortDate) // Sort by date descending
            .slice(0, limit);

        // Normalize to a common format
        return recentItems.map(item => ({
            id: item._isGroup ? item.id : characters.indexOf(item),
            name: item.name,
            avatar: item.avatar,
            avatar_url: item.avatar_url,
            is_group: item._isGroup,
            date_last_chat: item._sortDate,
            // Include members array for groups (used to detect group type)
            members: item.members,
        }));
    } catch (error) {
        console.error(`[${MODULE_NAME}] Error getting recent chats:`, error);
        return [];
    }
}

/**
 * Get the active preset for a given character name
 * Checks preset bindings from the pack cache
 * @param {string} characterName - The character name to look up
 * @returns {string|null} The preset name or null
 */
export function getCharacterPreset(characterName) {
    if (!characterName) return null;

    const index = getCachedIndex();
    if (!index?.presetBindings) return null;

    // Find binding for this character
    const binding = index.presetBindings[characterName];
    if (binding?.presetName) {
        return binding.presetName;
    }

    return null;
}

/**
 * Check if the custom landing page is enabled
 * @returns {boolean}
 */
export function isLandingPageEnabled() {
    const settings = getSettings();
    return settings.enableLandingPage !== false; // Default to true
}

/**
 * Set the landing page enabled state
 * @param {boolean} enabled
 */
export function setLandingPageEnabled(enabled) {
    const { savePreferences } = require("./settingsManager.js");
    savePreferences({ enableLandingPage: enabled });
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {string|number} timestamp - Unix timestamp or date string
 * @returns {string} Human-readable relative time
 */
export function formatRelativeTime(timestamp) {
    if (!timestamp) return 'Unknown';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Truncate text to a specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength).trim() + '...';
}

/**
 * Get avatar URL for a character or group
 * @param {Object} item - The character or group item
 * @returns {Promise<string>} Full avatar URL
 */
export async function getAvatarUrl(item) {
    if (!item) return '/img/fa-solid-user.svg';

    // Groups use avatar_url or fallback
    if (item.members || item.is_group) {
        return item.avatar_url || '/img/fa-solid-groups.svg';
    }

    // Characters use getThumbnailUrl for optimized thumbnails
    if (item.avatar) {
        try {
            // Import getThumbnailUrl from SillyTavern core
            const { getThumbnailUrl } = await import(/* webpackIgnore: true */ '../../../../../script.js');
            if (getThumbnailUrl) {
                return getThumbnailUrl('avatar', item.avatar);
            }
        } catch (err) {
            // Fallback to raw path if import fails
            console.warn(`[${MODULE_NAME}] Failed to import getThumbnailUrl, using fallback:`, err);
        }
        // Fallback: raw characters path (supports WebP/animation)
        return `/characters/${encodeURIComponent(item.avatar)}`;
    }

    return '/img/fa-solid-user.svg';
}
