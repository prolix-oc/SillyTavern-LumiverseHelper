import { createContext, useEffect, useRef, useSyncExternalStore, useCallback, useMemo } from 'react';

/* global SillyTavern, LumiverseBridge */

// Debounce helper for saving
let saveTimeout = null;
const debouncedSave = (fn, delay = 300) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(fn, delay);
};

/**
 * Generate a unique ID that works in non-secure contexts (HTTP).
 * Falls back to a simple random string if crypto.randomUUID is unavailable.
 */
function generateId() {
    // Try native crypto.randomUUID first (requires secure context)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
            return crypto.randomUUID();
        } catch (e) {
            // Fall through to fallback
        }
    }
    // Fallback: generate a pseudo-random ID
    // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (UUID v4-like)
    const hex = '0123456789abcdef';
    let id = '';
    for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
            id += '-';
        } else if (i === 14) {
            id += '4'; // UUID version 4
        } else if (i === 19) {
            id += hex[(Math.random() * 4) | 8]; // Variant bits
        } else {
            id += hex[(Math.random() * 16) | 0];
        }
    }
    return id;
}

/**
 * Simple vanilla JS store (no external dependencies)
 * This avoids issues with multiple React instances
 */
function createStore(initialState) {
    let state = initialState;
    const listeners = new Set();

    return {
        getState: () => state,
        setState: (partial) => {
            const nextState = typeof partial === 'function' ? partial(state) : partial;
            if (nextState !== state) {
                state = { ...state, ...nextState };
                listeners.forEach(listener => listener());
            }
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

/**
 * Initial state - matches the format from settingsManager.js
 *
 * Packs format: OBJECT keyed by pack name (NOT array)
 * Selection format: { packName: string, itemName: string }
 *
 * New Schema (v2):
 * Pack: { packName, packAuthor, coverUrl, version, packExtras, lumiaItems[], loomItems[] }
 * Lumia Item: { lumiaName, lumiaDefinition, lumiaPersonality, lumiaBehavior, avatarUrl, genderIdentity, authorName, version }
 * Loom Item: { loomName, loomContent, loomCategory, authorName, version }
 *
 * Legacy Schema (v1 - still supported with fallbacks):
 * Pack: { name, items[], url }
 * Lumia Item: { lumiaDefName, lumiaDef, lumia_personality, lumia_behavior, lumia_img, defAuthor }
 * Loom Item: { loomName, loomCategory, loomContent }
 */
const initialState = {
    // Packs - OBJECT keyed by pack name (NOT array!)
    // Each pack: { name, items: [...], url }
    packs: {},

    // Lumia selections - format: { packName, itemName }
    selectedDefinition: null,
    selectedBehaviors: [],        // Array of { packName, itemName }
    selectedPersonalities: [],    // Array of { packName, itemName }
    dominantBehavior: null,       // { packName, itemName } or null
    dominantPersonality: null,    // { packName, itemName } or null

    // Loom selections - format: { packName, itemName }
    selectedLoomStyle: [],        // Note: singular "Style" to match old code
    selectedLoomUtils: [],        // Note: "Utils" not "Utilities" to match old code
    selectedLoomRetrofits: [],

    // Preset system
    presets: {},                  // Saved preset configurations keyed by name
    activePresetName: null,       // Currently loaded preset name

    // Chimera/Council modes
    chimeraMode: false,
    selectedDefinitions: [],      // Array of { packName, itemName } - used in Chimera mode
    councilMode: false,
    councilMembers: [],           // Array of council member configurations
    lumiaQuirks: '',              // User text for behavioral quirks (all modes)
    lumiaQuirksEnabled: true,     // Toggle to enable/disable quirks output without deleting
    stateSynthesis: {
        enabled: false,           // Toggle for non-council synthesis prompt
    },

    // OOC settings
    oocEnabled: true,
    lumiaOOCStyle: 'social',
    lumiaOOCInterval: null,

    // Message truncation
    messageTruncation: {
        enabled: false,
        keepCount: 50,
    },

    // Context filters
    contextFilters: {},

    // Sovereign hand
    sovereignHand: { enabled: false, excludeLastMessage: true, includeMessageInPrompt: true },

    // Summarization
    summarization: {},

    // UI preferences
    showLumiverseDrawer: true,  // Whether to show the viewport drawer
    dismissedUpdateVersion: null, // Version user dismissed update notification for
    lumiaButtonPosition: {
        useDefault: true, // When true, use default positioning (top-right, animates with panel)
        xPercent: 1,      // Percentage from right edge (0-100)
        yPercent: 1,      // Percentage from top edge (0-100)
    },

    // Chat change tracking (React-only, incremented on syncFromExtension)
    // Components can subscribe to this to reload when chat changes
    chatChangeCounter: 0,

    // UI state (React-only, not saved to extension)
    ui: {
        activeModal: null,
        isLoading: false,
        isUpdatingExtension: false,  // True while extension update is in progress
        error: null,
        viewingPack: null,      // Pack name currently being viewed in detail modal
        viewingLoomPack: null,  // Pack name currently being viewed in loom detail modal
    },

    // Update notifications (React-only, not saved to extension)
    updates: {
        extensionUpdate: null,  // { hasUpdate: boolean, currentVersion: string, latestVersion: string }
        presetUpdates: [],      // Array of { slug, name, currentVersion, latestVersion, latestVersionName }
        lastChecked: null,      // Timestamp of last check
    },
};

// Create the store instance
const store = createStore(initialState);

// Helper to update nested path in settings
function updateSettingsPath(settings, path, value) {
    const keys = path.split('.');
    const result = { ...settings };
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    return result;
}

/**
 * Find a Lumia item in a pack - supports both new and legacy formats
 * @param {Object} pack - The pack object
 * @param {string} itemName - The item name to find
 * @returns {Object|null} The Lumia item or null
 */
function findLumiaInPack(pack, itemName) {
    if (!pack) return null;

    // New format: separate lumiaItems array with lumiaName field
    if (pack.lumiaItems && pack.lumiaItems.length > 0) {
        // Check both lumiaName and lumiaDefName for compatibility
        const found = pack.lumiaItems.find(i =>
            i.lumiaName === itemName || i.lumiaDefName === itemName
        );
        if (found) return found;
    }

    // Legacy format: mixed items array with lumiaDefName field
    if (pack.items && pack.items.length > 0) {
        return pack.items.find(i => i.lumiaDefName === itemName);
    }

    return null;
}

/**
 * Get Lumia field with fallback for old/new format
 * @param {Object} item - The Lumia item
 * @param {string} field - Field name: 'name', 'def', 'personality', 'behavior', 'img', 'author', 'gender'
 * @returns {*} The field value or null
 */
function getLumiaItemField(item, field) {
    if (!item) return null;
    const fieldMap = {
        name: ['lumiaName', 'lumiaDefName'],
        def: ['lumiaDefinition', 'lumiaDef'],
        personality: ['lumiaPersonality', 'lumia_personality'],
        behavior: ['lumiaBehavior', 'lumia_behavior'],
        img: ['avatarUrl', 'lumia_img'],
        author: ['authorName', 'defAuthor'],
        gender: ['genderIdentity'],
    };
    const fields = fieldMap[field];
    if (!fields) return null;
    for (const fieldName of fields) {
        if (item[fieldName] !== undefined && item[fieldName] !== null) {
            return item[fieldName];
        }
    }
    return null;
}

/**
 * Find a pack by name from the packs object
 * Searches by key first, then by pack.name and pack.packName properties
 * @param {Object} packs - The packs object from state
 * @param {string} packName - The pack name to find
 * @returns {Object|null} The pack or null
 */
function findPackByName(packs, packName) {
    if (!packs || !packName) return null;

    // Direct key lookup first
    if (packs[packName]) {
        return packs[packName];
    }

    // Search by pack.name or pack.packName properties
    for (const [key, pack] of Object.entries(packs)) {
        if (pack.name === packName || pack.packName === packName) {
            return pack;
        }
    }

    return null;
}

// Actions object - these modify the store
const actions = {
    // Settings actions
    updateSettings: (path, value) => {
        const state = store.getState();
        store.setState({
            settings: updateSettingsPath(state.settings, path, value),
        });
    },

    setSettings: (settings) => {
        store.setState({ settings });
    },

    // Pack actions
    setPacks: (packs) => {
        store.setState({ packs });
    },

    setCustomPacks: (customPacks) => {
        // Legacy method - convert array to object format and merge into packs
        const state = store.getState();
        const packsObj = { ...state.packs };
        customPacks.forEach(pack => {
            // Support both new (packName) and legacy (name) formats
            const packName = pack.packName || pack.name;
            packsObj[packName] = { ...pack, isCustom: true };
        });
        store.setState({ packs: packsObj });
    },

    addCustomPack: (pack) => {
        const state = store.getState();
        const packsObj = state.packs && typeof state.packs === 'object' ? { ...state.packs } : {};
        // Store pack by name with isCustom flag - support both new (packName) and legacy (name) fields
        const packName = pack.packName || pack.name;
        packsObj[packName] = { ...pack, isCustom: true };
        store.setState({ packs: packsObj });
    },

    updateCustomPack: (packIdOrName, updates) => {
        const state = store.getState();
        const packsObj = state.packs && typeof state.packs === 'object' ? { ...state.packs } : {};

        // Find the pack by id or name - support both new (packName) and legacy (name)
        let packKey = null;
        for (const [key, pack] of Object.entries(packsObj)) {
            if (pack.id === packIdOrName ||
                pack.name === packIdOrName ||
                pack.packName === packIdOrName ||
                key === packIdOrName) {
                packKey = key;
                break;
            }
        }

        if (packKey) {
            // If updating name, we need to re-key the object - support both formats
            const existingPack = packsObj[packKey];
            const newName = updates.packName || updates.name || existingPack.packName || existingPack.name;
            const updatedPack = { ...existingPack, ...updates, isCustom: true };

            if (newName !== packKey) {
                // Name changed - remove old key, add new key
                delete packsObj[packKey];
                packsObj[newName] = updatedPack;
            } else {
                packsObj[packKey] = updatedPack;
            }

            store.setState({ packs: packsObj });
        }
    },

    removeCustomPack: (packIdOrName) => {
        const state = store.getState();
        const packsObj = state.packs && typeof state.packs === 'object' ? { ...state.packs } : {};

        // Find and remove the pack by id or name - support both new (packName) and legacy (name)
        for (const [key, pack] of Object.entries(packsObj)) {
            if (pack.id === packIdOrName ||
                pack.name === packIdOrName ||
                pack.packName === packIdOrName ||
                key === packIdOrName) {
                delete packsObj[key];
                break;
            }
        }

        store.setState({ packs: packsObj });
    },

    // Generic pack removal (works for any pack - custom or downloaded)
    removePack: (packName) => {
        const state = store.getState();
        const packsObj = state.packs && typeof state.packs === 'object' ? { ...state.packs } : {};

        // Find and remove by key or name
        if (packsObj[packName]) {
            delete packsObj[packName];
        } else {
            // Search by pack.name property
            for (const [key, pack] of Object.entries(packsObj)) {
                if (pack.name === packName || pack.packName === packName) {
                    delete packsObj[key];
                    break;
                }
            }
        }

        store.setState({ packs: packsObj });
    },

    /**
     * Selection actions
     *
     * OLD CODE FORMAT - selections are stored as: { packName: string, itemName: string }
     * NOT as { id: string } or other formats
     *
     * Comparisons must use packName + itemName to match items
     */

    // Helper to compare selections (packName + itemName)
    _selectionsMatch: (a, b) => {
        if (!a || !b) return false;
        return a.packName === b.packName && a.itemName === b.itemName;
    },

    setSelectedBehaviors: (behaviors) => {
        store.setState({ selectedBehaviors: behaviors });
    },

    toggleBehavior: (selection) => {
        // selection = { packName, itemName }
        const state = store.getState();
        const match = actions._selectionsMatch;
        const index = state.selectedBehaviors.findIndex(b => match(b, selection));
        if (index >= 0) {
            const newBehaviors = [...state.selectedBehaviors];
            newBehaviors.splice(index, 1);
            store.setState({
                selectedBehaviors: newBehaviors,
                dominantBehavior: match(state.dominantBehavior, selection) ? null : state.dominantBehavior,
            });
        } else {
            store.setState({
                selectedBehaviors: [...state.selectedBehaviors, selection],
            });
        }
    },

    setDominantBehavior: (selection) => {
        // selection = { packName, itemName } or null
        store.setState({ dominantBehavior: selection });
    },

    setSelectedPersonalities: (personalities) => {
        store.setState({ selectedPersonalities: personalities });
    },

    togglePersonality: (selection) => {
        // selection = { packName, itemName }
        const state = store.getState();
        const match = actions._selectionsMatch;
        const index = state.selectedPersonalities.findIndex(p => match(p, selection));
        if (index >= 0) {
            const newPersonalities = [...state.selectedPersonalities];
            newPersonalities.splice(index, 1);
            store.setState({
                selectedPersonalities: newPersonalities,
                dominantPersonality: match(state.dominantPersonality, selection) ? null : state.dominantPersonality,
            });
        } else {
            store.setState({
                selectedPersonalities: [...state.selectedPersonalities, selection],
            });
        }
    },

    setDominantPersonality: (selection) => {
        // selection = { packName, itemName } or null
        store.setState({ dominantPersonality: selection });
    },

    setSelectedDefinition: (selection) => {
        // selection = { packName, itemName } or null
        store.setState({ selectedDefinition: selection });
    },

    clearSelections: () => {
        store.setState({
            selectedBehaviors: [],
            selectedPersonalities: [],
            selectedDefinition: null,
            dominantBehavior: null,
            dominantPersonality: null,
        });
    },

    /**
     * LOOM Selection actions
     *
     * Loom selections also use { packName, itemName } format
     * Note: Field names match old code: selectedLoomStyle, selectedLoomUtils, selectedLoomRetrofits
     */
    setSelectedLoomStyles: (styles) => {
        store.setState({ selectedLoomStyle: styles });
    },

    toggleLoomStyle: (selection) => {
        const state = store.getState();
        const match = actions._selectionsMatch;
        const current = state.selectedLoomStyle || [];
        const index = current.findIndex(s => match(s, selection));
        if (index >= 0) {
            const newStyles = [...current];
            newStyles.splice(index, 1);
            store.setState({ selectedLoomStyle: newStyles });
        } else {
            store.setState({ selectedLoomStyle: [...current, selection] });
        }
    },

    setSelectedLoomUtilities: (utilities) => {
        store.setState({ selectedLoomUtils: utilities });
    },

    toggleLoomUtility: (selection) => {
        const state = store.getState();
        const match = actions._selectionsMatch;
        const current = state.selectedLoomUtils || [];
        const index = current.findIndex(u => match(u, selection));
        if (index >= 0) {
            const newUtils = [...current];
            newUtils.splice(index, 1);
            store.setState({ selectedLoomUtils: newUtils });
        } else {
            store.setState({ selectedLoomUtils: [...current, selection] });
        }
    },

    setSelectedLoomRetrofits: (retrofits) => {
        store.setState({ selectedLoomRetrofits: retrofits });
    },

    toggleLoomRetrofit: (selection) => {
        const state = store.getState();
        const match = actions._selectionsMatch;
        const current = state.selectedLoomRetrofits || [];
        const index = current.findIndex(r => match(r, selection));
        if (index >= 0) {
            const newRetrofits = [...current];
            newRetrofits.splice(index, 1);
            store.setState({ selectedLoomRetrofits: newRetrofits });
        } else {
            store.setState({ selectedLoomRetrofits: [...current, selection] });
        }
    },

    clearLoomSelections: () => {
        store.setState({
            selectedLoomStyle: [],
            selectedLoomUtils: [],
            selectedLoomRetrofits: [],
        });
    },

    // Clear all selections (both Lumia and Loom)
    clearAllSelections: () => {
        store.setState({
            // Lumia
            selectedBehaviors: [],
            selectedPersonalities: [],
            selectedDefinition: null,
            dominantBehavior: null,
            dominantPersonality: null,
            // Loom (old code field names)
            selectedLoomStyle: [],
            selectedLoomUtils: [],
            selectedLoomRetrofits: [],
        });
    },

    /**
     * Check if all traits for a Lumia item are currently enabled
     * Returns true only if every trait the item has is selected
     *
     * @param {string} packName - The pack containing the item
     * @param {string} itemName - The lumiaName (or lumiaDefName) of the item
     * @returns {boolean} - true if all traits are enabled
     */
    areAllTraitsEnabledForLumia: (packName, itemName) => {
        const state = store.getState();
        const pack = findPackByName(state.packs, packName);
        if (!pack) return false;

        const item = findLumiaInPack(pack, itemName);
        if (!item) return false;

        // Check definition
        if (getLumiaItemField(item, 'def')) {
            const def = state.selectedDefinition;
            if (!def || def.packName !== packName || def.itemName !== itemName) {
                return false;
            }
        }

        // Check behavior
        if (getLumiaItemField(item, 'behavior')) {
            const behaviors = state.selectedBehaviors || [];
            const hasBehavior = behaviors.some(
                b => b.packName === packName && b.itemName === itemName
            );
            if (!hasBehavior) return false;
        }

        // Check personality
        if (getLumiaItemField(item, 'personality')) {
            const personalities = state.selectedPersonalities || [];
            const hasPersonality = personalities.some(
                p => p.packName === packName && p.itemName === itemName
            );
            if (!hasPersonality) return false;
        }

        return true;
    },

    /**
     * Toggle all traits for a Lumia item
     * If all traits are enabled, disables them all
     * If not all traits are enabled, enables them all
     *
     * @param {string} packName - The pack containing the item
     * @param {string} itemName - The lumiaName (or lumiaDefName) of the item
     * @returns {boolean} - true if traits were enabled, false if disabled
     */
    toggleAllTraitsForLumia: (packName, itemName) => {
        const state = store.getState();
        const pack = findPackByName(state.packs, packName);
        if (!pack) return false;

        const item = findLumiaInPack(pack, itemName);
        if (!item) return false;

        const allEnabled = actions.areAllTraitsEnabledForLumia(packName, itemName);

        if (allEnabled) {
            // Disable all traits for this Lumia
            const newState = {};

            // Clear definition if it matches this item
            if (getLumiaItemField(item, 'def')) {
                const def = state.selectedDefinition;
                if (def && def.packName === packName && def.itemName === itemName) {
                    newState.selectedDefinition = null;
                }
            }

            // Remove behavior if present
            if (getLumiaItemField(item, 'behavior')) {
                const behaviors = state.selectedBehaviors || [];
                newState.selectedBehaviors = behaviors.filter(
                    b => !(b.packName === packName && b.itemName === itemName)
                );
            }

            // Remove personality if present
            if (getLumiaItemField(item, 'personality')) {
                const personalities = state.selectedPersonalities || [];
                newState.selectedPersonalities = personalities.filter(
                    p => !(p.packName === packName && p.itemName === itemName)
                );
            }

            if (Object.keys(newState).length > 0) {
                store.setState(newState);
            }
            return false; // Traits were disabled
        } else {
            // Enable all traits for this Lumia
            const selection = { packName, itemName };
            const newState = {};

            // Set definition if item has one
            if (getLumiaItemField(item, 'def')) {
                newState.selectedDefinition = selection;
            }

            // Add behavior if item has one and not already selected
            if (getLumiaItemField(item, 'behavior')) {
                const behaviors = state.selectedBehaviors || [];
                const alreadySelected = behaviors.some(
                    b => b.packName === packName && b.itemName === itemName
                );
                if (!alreadySelected) {
                    newState.selectedBehaviors = [...behaviors, selection];
                }
            }

            // Add personality if item has one and not already selected
            if (getLumiaItemField(item, 'personality')) {
                const personalities = state.selectedPersonalities || [];
                const alreadySelected = personalities.some(
                    p => p.packName === packName && p.itemName === itemName
                );
                if (!alreadySelected) {
                    newState.selectedPersonalities = [...personalities, selection];
                }
            }

            if (Object.keys(newState).length > 0) {
                store.setState(newState);
            }
            return true; // Traits were enabled
        }
    },

    /**
     * Enable all traits for a Lumia item (legacy, use toggleAllTraitsForLumia for toggle behavior)
     * Sets the definition (if item has one) and adds behaviors/personalities
     * without duplicating already-selected items
     *
     * @param {string} packName - The pack containing the item
     * @param {string} itemName - The lumiaName (or lumiaDefName) of the item
     */
    enableAllTraitsForLumia: (packName, itemName) => {
        const state = store.getState();
        const pack = findPackByName(state.packs, packName);
        if (!pack) return;

        const item = findLumiaInPack(pack, itemName);
        if (!item) return;

        const selection = { packName, itemName };
        const newState = {};

        // Set definition if item has one
        if (getLumiaItemField(item, 'def')) {
            newState.selectedDefinition = selection;
        }

        // Add behavior if item has one and not already selected
        if (getLumiaItemField(item, 'behavior')) {
            const behaviors = state.selectedBehaviors || [];
            const alreadySelected = behaviors.some(
                b => b.packName === packName && b.itemName === itemName
            );
            if (!alreadySelected) {
                newState.selectedBehaviors = [...behaviors, selection];
            }
        }

        // Add personality if item has one and not already selected
        if (getLumiaItemField(item, 'personality')) {
            const personalities = state.selectedPersonalities || [];
            const alreadySelected = personalities.some(
                p => p.packName === packName && p.itemName === itemName
            );
            if (!alreadySelected) {
                newState.selectedPersonalities = [...personalities, selection];
            }
        }

        if (Object.keys(newState).length > 0) {
            store.setState(newState);
        }
    },

    /**
     * Preset Management Actions
     */

    /**
     * Save current Lumia selections as a named preset
     * @param {string} presetName - Name for the preset
     */
    savePreset: (presetName) => {
        const state = store.getState();
        const now = Date.now();

        const preset = {
            name: presetName,
            createdAt: now,
            updatedAt: now,
            // Lumia selections
            selectedDefinition: state.selectedDefinition,
            selectedBehaviors: [...(state.selectedBehaviors || [])],
            selectedPersonalities: [...(state.selectedPersonalities || [])],
            dominantBehavior: state.dominantBehavior,
            dominantPersonality: state.dominantPersonality,
            // Mode flags
            chimeraMode: state.chimeraMode || false,
            selectedDefinitions: [...(state.selectedDefinitions || [])],
            councilMode: state.councilMode || false,
            councilMembers: structuredClone(state.councilMembers || []),
            lumiaQuirks: state.lumiaQuirks || '',
            lumiaQuirksEnabled: state.lumiaQuirksEnabled !== false, // Default true for legacy
        };

        store.setState({
            presets: { ...state.presets, [presetName]: preset },
            activePresetName: presetName,
        });
    },

    /**
     * Load a preset, replacing current selections
     * @param {string} presetName - Name of the preset to load
     */
    loadPreset: (presetName) => {
        const state = store.getState();
        const preset = state.presets[presetName];
        if (!preset) return;

        const updates = {
            selectedDefinition: preset.selectedDefinition,
            selectedBehaviors: preset.selectedBehaviors || [],
            selectedPersonalities: preset.selectedPersonalities || [],
            dominantBehavior: preset.dominantBehavior,
            dominantPersonality: preset.dominantPersonality,
            activePresetName: presetName,
        };

        // Apply mode flags if present
        if (preset.chimeraMode !== undefined) {
            updates.chimeraMode = preset.chimeraMode;
            updates.selectedDefinitions = preset.selectedDefinitions || [];
        }
        if (preset.councilMode !== undefined) {
            updates.councilMode = preset.councilMode;
            updates.councilMembers = preset.councilMembers || [];
        }

        // Load lumiaQuirks (works in all modes, fallback to old councilQuirks for legacy presets)
        updates.lumiaQuirks = preset.lumiaQuirks || preset.councilQuirks || '';
        updates.lumiaQuirksEnabled = preset.lumiaQuirksEnabled !== false; // Default true for legacy

        store.setState(updates);
    },

    /**
     * Delete a preset
     * @param {string} presetName - Name of the preset to delete
     */
    deletePreset: (presetName) => {
        const state = store.getState();
        const { [presetName]: deleted, ...remaining } = state.presets;
        store.setState({
            presets: remaining,
            activePresetName: state.activePresetName === presetName
                ? null
                : state.activePresetName,
        });
    },

    /**
     * Update an existing preset with current selections
     * @param {string} presetName - Name of the preset to update
     */
    updatePreset: (presetName) => {
        const state = store.getState();
        const existing = state.presets[presetName];
        if (!existing) return;

        const preset = {
            ...existing,
            updatedAt: Date.now(),
            // Lumia selections
            selectedDefinition: state.selectedDefinition,
            selectedBehaviors: [...(state.selectedBehaviors || [])],
            selectedPersonalities: [...(state.selectedPersonalities || [])],
            dominantBehavior: state.dominantBehavior,
            dominantPersonality: state.dominantPersonality,
            // Mode flags
            chimeraMode: state.chimeraMode || false,
            selectedDefinitions: [...(state.selectedDefinitions || [])],
            councilMode: state.councilMode || false,
            councilMembers: structuredClone(state.councilMembers || []),
            lumiaQuirks: state.lumiaQuirks || '',
            lumiaQuirksEnabled: state.lumiaQuirksEnabled !== false,
        };

        store.setState({
            presets: { ...state.presets, [presetName]: preset },
        });
    },

    /**
     * Clear active preset indicator (when selections change manually)
     */
    clearActivePreset: () => {
        store.setState({ activePresetName: null });
    },

    /**
     * Chimera Mode Actions
     * Chimera mode allows multiple physical definitions to be selected and fused
     */

    /**
     * Toggle Chimera mode on/off
     * Handles migration between single and multi-definition selection
     * Chimera and Council modes are mutually exclusive
     * @param {boolean} enabled - Whether to enable Chimera mode
     */
    setChimeraMode: (enabled) => {
        const state = store.getState();

        // Disable Council mode if enabling Chimera (mutual exclusivity)
        if (enabled && state.councilMode) {
            store.setState({ councilMode: false, councilMembers: [] });
        }

        if (enabled && state.selectedDefinition) {
            // Migrate single selection to array
            store.setState({
                chimeraMode: true,
                selectedDefinitions: [state.selectedDefinition],
                selectedDefinition: null,
            });
        } else if (!enabled && state.selectedDefinitions?.length > 0) {
            // Keep first definition when switching back to single mode
            store.setState({
                chimeraMode: false,
                selectedDefinition: state.selectedDefinitions[0],
                selectedDefinitions: [],
            });
        } else {
            store.setState({ chimeraMode: enabled });
        }
    },

    /**
     * Toggle a definition in Chimera mode (multi-select)
     * @param {Object} selection - { packName, itemName }
     */
    toggleChimeraDefinition: (selection) => {
        const state = store.getState();
        const definitions = state.selectedDefinitions || [];
        const match = actions._selectionsMatch;
        const index = definitions.findIndex(d => match(d, selection));

        if (index >= 0) {
            // Remove from selection
            const newDefinitions = [...definitions];
            newDefinitions.splice(index, 1);
            store.setState({ selectedDefinitions: newDefinitions });
        } else {
            // Add to selection
            store.setState({
                selectedDefinitions: [...definitions, selection],
            });
        }
    },

    /**
     * Clear all Chimera definitions
     */
    clearChimeraDefinitions: () => {
        store.setState({ selectedDefinitions: [] });
    },

    /**
     * Council Mode Actions
     * Council mode allows multiple independent Lumias that collaborate
     */

    /**
     * Toggle Council mode on/off
     * Council and Chimera modes are mutually exclusive
     * @param {boolean} enabled - Whether to enable Council mode
     */
    setCouncilMode: (enabled) => {
        const state = store.getState();

        // Disable Chimera mode if enabling Council (mutual exclusivity)
        if (enabled && state.chimeraMode) {
            store.setState({ chimeraMode: false, selectedDefinitions: [] });
        }

        store.setState({ councilMode: enabled });
    },

    /**
     * Add a new council member
     * Auto-attaches the Lumia's inherent behavior and personality traits
     * @param {Object} member - { packName, itemName } of the Lumia to add
     */
    addCouncilMember: (member) => {
        const state = store.getState();
        const currentMembers = state.councilMembers || [];

        // Look up the pack using helper that supports both name formats
        const pack = findPackByName(state.packs, member.packName);
        const item = findLumiaInPack(pack, member.itemName);

        const behaviors = [];
        const personalities = [];

        // Auto-attach inherent behavior if exists
        if (getLumiaItemField(item, 'behavior')) {
            behaviors.push({ packName: member.packName, itemName: member.itemName });
        }

        // Auto-attach inherent personality if exists
        if (getLumiaItemField(item, 'personality')) {
            personalities.push({ packName: member.packName, itemName: member.itemName });
        }

        const newMember = {
            id: generateId(),
            packName: member.packName,
            itemName: member.itemName,
            behaviors,
            personalities,
            dominantBehavior: null,
            dominantPersonality: null,
            role: '',
        };

        // Create a new array reference to ensure React detects the change
        const newMembers = [...currentMembers, newMember];
        
        store.setState({
            councilMembers: newMembers,
        });

        // Return the new member for potential chaining/debugging
        return newMember;
    },

    /**
     * Update a council member's configuration
     * @param {string} memberId - The ID of the member to update
     * @param {Object} updates - The fields to update
     */
    updateCouncilMember: (memberId, updates) => {
        const state = store.getState();
        store.setState({
            councilMembers: state.councilMembers.map(member =>
                member.id === memberId ? { ...member, ...updates } : member
            ),
        });
    },

    /**
     * Remove a council member
     * @param {string} memberId - The ID of the member to remove
     */
    removeCouncilMember: (memberId) => {
        const state = store.getState();
        store.setState({
            councilMembers: state.councilMembers.filter(member => member.id !== memberId),
        });
    },

    /**
     * Clear all council members
     */
    clearCouncilMembers: () => {
        store.setState({ councilMembers: [] });
    },

    /**
     * Set lumia quirks text (works in all modes)
     * @param {string} quirks - The quirks text
     */
    setLumiaQuirks: (quirks) => {
        store.setState({ lumiaQuirks: quirks });
    },

    /**
     * Set lumia quirks enabled/disabled
     * @param {boolean} enabled - Whether quirks are enabled
     */
    setLumiaQuirksEnabled: (enabled) => {
        store.setState({ lumiaQuirksEnabled: enabled });
    },

    /**
     * Set state synthesis enabled
     * @param {boolean} enabled - Whether synthesis is enabled
     */
    setStateSynthesisEnabled: (enabled) => {
        const state = store.getState();
        store.setState({
            stateSynthesis: { ...state.stateSynthesis, enabled },
        });
    },

    /**
     * Add all Lumias from a pack to the Council
     * Skips Lumias without definitions and those already in the council
     * @param {string} packName - Name of the pack to add members from
     * @returns {number} Count of members added
     */
    addCouncilMembersFromPack: (packName) => {
        const state = store.getState();
        const pack = findPackByName(state.packs, packName);
        if (!pack) return 0;

        // Get Lumia items (handle both v2 and legacy formats)
        let lumiaItems = [];
        if (pack.lumiaItems && pack.lumiaItems.length > 0) {
            // v2 format: filter to items with definitions
            lumiaItems = pack.lumiaItems.filter(i =>
                i.lumiaDefinition || i.lumiaDef
            );
        } else if (pack.items && pack.items.length > 0) {
            // Legacy format: filter to Lumia items with definitions
            lumiaItems = pack.items.filter(i =>
                (i.lumiaDefName || i.lumiaName) && (i.lumiaDef || i.lumiaDefinition)
            );
        }

        if (lumiaItems.length === 0) return 0;

        // Build set of existing council members for fast lookup
        const currentMembers = state.councilMembers || [];
        const existingSet = new Set(
            currentMembers.map(m => `${m.packName}:${m.itemName}`)
        );

        // Filter out already-added members
        const toAdd = lumiaItems.filter(item => {
            const itemName = item.lumiaName || item.lumiaDefName;
            return !existingSet.has(`${packName}:${itemName}`);
        });

        if (toAdd.length === 0) return 0;

        // Create new council members with auto-attached traits
        const newMembers = toAdd.map(item => {
            const itemName = item.lumiaName || item.lumiaDefName;
            const behaviors = [];
            const personalities = [];

            // Auto-attach inherent behavior if exists
            if (getLumiaItemField(item, 'behavior')) {
                behaviors.push({ packName, itemName });
            }

            // Auto-attach inherent personality if exists
            if (getLumiaItemField(item, 'personality')) {
                personalities.push({ packName, itemName });
            }

            return {
                id: generateId(),
                packName,
                itemName,
                behaviors,
                personalities,
                dominantBehavior: null,
                dominantPersonality: null,
                role: '',
            };
        });

        store.setState({
            councilMembers: [...currentMembers, ...newMembers],
        });

        return newMembers.length;
    },

    // UI actions
    openModal: (modalName, props = {}) => {
        store.setState({
            ui: { ...store.getState().ui, activeModal: { name: modalName, props } },
        });
    },

    closeModal: () => {
        store.setState({
            ui: { ...store.getState().ui, activeModal: null },
        });
    },

    setLoading: (isLoading) => {
        store.setState({
            ui: { ...store.getState().ui, isLoading },
        });
    },

    setError: (error) => {
        store.setState({
            ui: { ...store.getState().ui, error },
        });
    },

    clearError: () => {
        store.setState({
            ui: { ...store.getState().ui, error: null },
        });
    },

    // Pack detail modal actions
    openPackDetail: (packName) => {
        store.setState({
            ui: { ...store.getState().ui, viewingPack: packName },
        });
    },

    closePackDetail: () => {
        store.setState({
            ui: { ...store.getState().ui, viewingPack: null },
        });
    },

    // Loom pack detail modal actions
    openLoomPackDetail: (packName) => {
        store.setState({
            ui: { ...store.getState().ui, viewingLoomPack: packName },
        });
    },

    closeLoomPackDetail: () => {
        store.setState({
            ui: { ...store.getState().ui, viewingLoomPack: null },
        });
    },

    // Update notification actions
    setExtensionUpdate: (updateInfo) => {
        const state = store.getState();
        store.setState({
            updates: { 
                ...state.updates, 
                extensionUpdate: updateInfo,
                lastChecked: Date.now(),
            },
        });
    },

    setPresetUpdates: (presetUpdates) => {
        const state = store.getState();
        store.setState({
            updates: { 
                ...state.updates, 
                presetUpdates: presetUpdates || [],
            },
        });
    },

    clearUpdates: () => {
        store.setState({
            updates: {
                extensionUpdate: null,
                presetUpdates: [],
                lastChecked: null,
            },
        });
    },

    dismissExtensionUpdate: (version) => {
        store.setState({ dismissedUpdateVersion: version });
        saveToExtensionImmediate();
    },

    /**
     * Trigger extension update via SillyTavern API.
     * Calls /api/extensions/update endpoint.
     * @returns {Promise<{success: boolean, message: string}>}
     */
    updateExtension: async () => {
        const state = store.getState();
        
        // Set updating state
        store.setState({
            ui: { ...state.ui, isUpdatingExtension: true },
        });

        try {
            // Get request headers from ST context
            const getRequestHeaders = typeof LumiverseBridge !== 'undefined' && LumiverseBridge.getRequestHeaders
                ? LumiverseBridge.getRequestHeaders
                : () => ({ 'Content-Type': 'application/json' });

            const response = await fetch('/api/extensions/update', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    extensionName: 'SillyTavern-LumiverseHelper',
                    global: false,
                }),
            });

            const currentState = store.getState();
            store.setState({
                ui: { ...currentState.ui, isUpdatingExtension: false },
            });

            if (!response.ok) {
                console.error(`[LumiverseHelper] Extension update failed: ${response.statusText}`);
                return { success: false, message: `Update failed: ${response.statusText}` };
            }

            const data = await response.json();

            if (data.isUpToDate) {
                console.log('[LumiverseHelper] Extension is already up to date.');
                return { success: false, message: 'Already up to date' };
            } else {
                console.log(`[LumiverseHelper] Extension updated successfully to ${data.shortCommitHash}.`);
                return { success: true, message: `Updated to ${data.shortCommitHash}. Reload to apply changes.` };
            }
        } catch (error) {
            console.error('[LumiverseHelper] Error updating extension:', error);
            const currentState = store.getState();
            store.setState({
                ui: { ...currentState.ui, isUpdatingExtension: false },
            });
            return { success: false, message: `Error: ${error.message}` };
        }
    },
};

/**
 * Sync settings from the extension to the React store
 *
 * IMPORTANT: This is a simple passthrough. The settings come in the EXACT format
 * from the old code's getSettings(). We do NOT transform anything.
 *
 * @param {Object} extensionSettings - Settings in the exact format from settingsManager.js
 */
function syncFromExtension(extensionSettings) {
    if (!extensionSettings) return;

    // Preserve React-only state
    const currentState = store.getState();

    // Merge extension settings directly into store
    // This preserves the EXACT structure from the old code
    store.setState({
        ...extensionSettings,
        // Keep React-only UI state
        ui: currentState.ui,
        // Increment chat change counter so components know to reload
        chatChangeCounter: (currentState.chatChangeCounter || 0) + 1,
    });
}

/**
 * Export state for saving to extension
 *
 * IMPORTANT: Returns the EXACT format expected by settingsManager.js.
 * No transformation - just exclude the React-only UI state.
 */
function exportForExtension() {
    // Return everything except the React-only UI state
    const { ui, ...settingsToExport } = store.getState();
    return settingsToExport;
}

// Save to extension (debounced)
function saveToExtension() {
    debouncedSave(() => {
        if (typeof LumiverseBridge !== 'undefined' && LumiverseBridge.saveSettings) {
            LumiverseBridge.saveSettings(exportForExtension());
        }
    });
}

// Save to extension immediately (no debounce - for critical settings like OOC style)
// Also passes immediate=true to ensure file storage saves immediately (no 500ms debounce)
async function saveToExtensionImmediate() {
    if (typeof LumiverseBridge !== 'undefined' && LumiverseBridge.saveSettings) {
        await LumiverseBridge.saveSettings(exportForExtension(), true);
    }
}

// Create a "store-like" object that matches what we were exporting before
const useLumiverseStore = {
    getState: store.getState,
    setState: store.setState,
    subscribe: store.subscribe,
    syncFromExtension,
    exportForExtension,
    saveToExtension,
};

// Make it callable like zustand for compatibility
useLumiverseStore.getState = store.getState;

// Context for providing the store to components
const LumiverseContext = createContext(null);

/**
 * Provider component that wraps the app and provides the store
 */
export function LumiverseProvider({ children, initialSettings = null }) {
    const hasInitialized = useRef(false);

    useEffect(() => {
        // Sync initial settings from extension on mount
        if (!hasInitialized.current) {
            hasInitialized.current = true;

            if (initialSettings) {
                // Settings provided by reactBridge - already in React format (packs as array)
                console.log('[LumiverseProvider] Using initialSettings from bridge');
                syncFromExtension(initialSettings);
            } else if (typeof LumiverseBridge !== 'undefined' && LumiverseBridge.getSettings) {
                // Fallback: Get settings via the bridge
                console.log('[LumiverseProvider] Fetching settings via LumiverseBridge');
                const settings = LumiverseBridge.getSettings();
                if (settings) {
                    syncFromExtension(settings);
                }
            } else {
                console.warn('[LumiverseProvider] No settings source available');
            }
        }
    }, [initialSettings]);

    return (
        <LumiverseContext.Provider value={store}>
            {children}
        </LumiverseContext.Provider>
    );
}

/**
 * Hook to use the store with a selector
 * Uses useSyncExternalStore for proper React 18 concurrent mode support
 *
 * IMPORTANT: Only pass stable selector functions (defined outside components)
 * to prevent infinite re-renders.
 */
export function useLumiverse(selector) {
    // Use useRef to store a stable reference to the selector
    const selectorRef = useRef(selector);
    selectorRef.current = selector;

    const getSnapshot = useCallback(
        () => selectorRef.current(store.getState()),
        []
    );

    const selectedState = useSyncExternalStore(
        store.subscribe,
        getSnapshot,
        getSnapshot
    );
    return selectedState;
}

/**
 * Hook to access store actions
 */
export function useLumiverseActions() {
    return actions;
}

// Stable selector functions (defined outside component to prevent recreation)
const selectSettings = state => state.settings;
const selectUI = state => state.ui;

// Stable selectors for useSelections hook
const selectBehaviors = () => store.getState().selectedBehaviors;
const selectPersonalities = () => store.getState().selectedPersonalities;
const selectDefinition = () => store.getState().selectedDefinition;
const selectDominantBehavior = () => store.getState().dominantBehavior;
const selectDominantPersonality = () => store.getState().dominantPersonality;

// Stable empty array fallback (must be same reference to prevent infinite loops)
const EMPTY_ARRAY = [];

// Stable selectors for useLoomSelections hook
// CRITICAL: Return EMPTY_ARRAY constant, not a new [] literal, to prevent useSyncExternalStore infinite loops
const selectLoomStyles = () => store.getState().selectedLoomStyle || EMPTY_ARRAY;
const selectLoomUtils = () => store.getState().selectedLoomUtils || EMPTY_ARRAY;
const selectLoomRetrofits = () => store.getState().selectedLoomRetrofits || EMPTY_ARRAY;

// Stable selector for usePacks hook
const selectPacks = () => store.getState().packs;

// Stable selector for useUpdates hook
const DEFAULT_UPDATES = { extensionUpdate: null, presetUpdates: [], lastChecked: null };
const selectUpdates = () => store.getState().updates || DEFAULT_UPDATES;

/**
 * Hook to access just the settings
 */
export function useSettings() {
    return useLumiverse(selectSettings);
}

/**
 * Hook to access LUMIA selections (character-focused content)
 * Uses stable selectors defined outside the component to prevent unnecessary re-subscriptions
 */
export function useSelections() {
    const behaviors = useSyncExternalStore(
        store.subscribe,
        selectBehaviors,
        selectBehaviors
    );
    const personalities = useSyncExternalStore(
        store.subscribe,
        selectPersonalities,
        selectPersonalities
    );
    const definition = useSyncExternalStore(
        store.subscribe,
        selectDefinition,
        selectDefinition
    );
    const dominantBehavior = useSyncExternalStore(
        store.subscribe,
        selectDominantBehavior,
        selectDominantBehavior
    );
    const dominantPersonality = useSyncExternalStore(
        store.subscribe,
        selectDominantPersonality,
        selectDominantPersonality
    );

    return useMemo(() => ({
        behaviors,
        personalities,
        definition,
        dominantBehavior,
        dominantPersonality,
    }), [behaviors, personalities, definition, dominantBehavior, dominantPersonality]);
}

/**
 * Hook to access LOOM selections (narrative-focused content)
 * Kept separate from Lumia selections for clear data separation
 * Uses stable selectors defined outside the component to prevent unnecessary re-subscriptions
 *
 * OLD CODE FIELD NAMES:
 * - selectedLoomStyle (not selectedLoomStyles)
 * - selectedLoomUtils (not selectedLoomUtilities)
 * - selectedLoomRetrofits
 */
export function useLoomSelections() {
    const styles = useSyncExternalStore(
        store.subscribe,
        selectLoomStyles,
        selectLoomStyles
    );
    const utilities = useSyncExternalStore(
        store.subscribe,
        selectLoomUtils,
        selectLoomUtils
    );
    const retrofits = useSyncExternalStore(
        store.subscribe,
        selectLoomRetrofits,
        selectLoomRetrofits
    );

    return useMemo(() => ({
        styles,
        utilities,
        retrofits,
    }), [styles, utilities, retrofits]);
}

/**
 * Hook to access packs
 * Uses stable selector defined outside the component to prevent unnecessary re-subscriptions
 *
 * The old code stores packs as an OBJECT keyed by pack name: settings.packs[packName]
 * But components need to iterate over them, so we convert to arrays.
 *
 * Custom packs are packs where pack.isCustom === true
 *
 * Returns:
 * - packs: Array of non-custom packs (for iteration)
 * - customPacks: Array of custom packs (isCustom === true)
 * - allPacks: Combined array of all packs
 */
export function usePacks() {
    const packsRaw = useSyncExternalStore(
        store.subscribe,
        selectPacks,
        selectPacks
    );

    return useMemo(() => {
        // Convert packs to array - handle both object and array formats
        let packsArray = [];
        if (packsRaw) {
            if (Array.isArray(packsRaw)) {
                packsArray = packsRaw;
            } else if (typeof packsRaw === 'object') {
                // When converting from object, use the key as the pack name
                // This ensures pack.name is always available even if packName differs
                packsArray = Object.entries(packsRaw).map(([key, pack]) => ({
                    ...pack,
                    // Ensure name field is set (use key if not already set)
                    name: pack.name || pack.packName || key,
                }));
            }
        }

        // Separate custom packs from regular packs
        const customPacks = packsArray.filter(p => p.isCustom === true);
        const regularPacks = packsArray.filter(p => !p.isCustom);

        return {
            packs: regularPacks,      // Non-custom packs array
            customPacks: customPacks, // Custom packs array (isCustom === true)
            allPacks: packsArray,     // All packs combined
        };
    }, [packsRaw]);
}

/**
 * Hook to access UI state
 */
export function useUI() {
    return useLumiverse(selectUI);
}

/**
 * Hook to access update notification state
 * Returns: { extensionUpdate, presetUpdates, hasAnyUpdate, dismissedVersion }
 */
export function useUpdates() {
    const updates = useSyncExternalStore(
        store.subscribe,
        selectUpdates,
        selectUpdates
    );

    const dismissedVersion = useSyncExternalStore(
        store.subscribe,
        () => store.getState().dismissedUpdateVersion,
        () => store.getState().dismissedUpdateVersion
    );

    return useMemo(() => {
        const extUpdate = updates.extensionUpdate;
        const isDismissed = dismissedVersion && extUpdate?.latestVersion === dismissedVersion;
        const hasExtUpdate = extUpdate?.hasUpdate && !isDismissed;

        return {
            extensionUpdate: extUpdate,
            presetUpdates: updates.presetUpdates || [],
            lastChecked: updates.lastChecked,
            dismissedVersion,
            hasExtensionUpdate: hasExtUpdate,
            hasPresetUpdates: (updates.presetUpdates?.length || 0) > 0,
            hasAnyUpdate: hasExtUpdate || (updates.presetUpdates?.length > 0),
        };
    }, [updates, dismissedVersion]);
}

// Export the store object for external access
export { useLumiverseStore, saveToExtension, saveToExtensionImmediate };

/**
 * DEBUG FUNCTION: Logs all pack data for debugging purposes.
 * Call this from the browser console via: window.debugLumiverseData()
 *
 * This will output all items in a format you can copy/paste for analysis.
 */
function debugLumiverseData() {
    const state = store.getState();

    console.log('='.repeat(80));
    console.log('LUMIVERSE DEBUG DATA DUMP');
    console.log('='.repeat(80));

    // 1. Show raw packs from store (should be OBJECT, not array)
    console.log('\n--- STORE STATE: packs ---');
    console.log('Type:', typeof state.packs, Array.isArray(state.packs) ? '(Array - WRONG!)' : '(Object - correct)');
    console.log('Pack names:', state.packs ? Object.keys(state.packs) : 'null');
    console.log('Packs:', JSON.stringify(state.packs, null, 2));

    // 2. Show current selections (format: { packName, itemName })
    console.log('\n--- CURRENT SELECTIONS ---');
    console.log('selectedDefinition:', JSON.stringify(state.selectedDefinition, null, 2));
    console.log('selectedBehaviors:', JSON.stringify(state.selectedBehaviors, null, 2));
    console.log('selectedPersonalities:', JSON.stringify(state.selectedPersonalities, null, 2));
    console.log('dominantBehavior:', JSON.stringify(state.dominantBehavior, null, 2));
    console.log('dominantPersonality:', JSON.stringify(state.dominantPersonality, null, 2));

    // 3. Show Loom selections
    console.log('\n--- LOOM SELECTIONS ---');
    console.log('selectedLoomStyle:', JSON.stringify(state.selectedLoomStyle, null, 2));
    console.log('selectedLoomUtils:', JSON.stringify(state.selectedLoomUtils, null, 2));
    console.log('selectedLoomRetrofits:', JSON.stringify(state.selectedLoomRetrofits, null, 2));

    // 4. Try to get settings from the bridge
    console.log('\n--- SETTINGS FROM LUMIVERSE BRIDGE ---');
    try {
        if (typeof LumiverseBridge !== 'undefined' && LumiverseBridge.getSettings) {
            const bridgeSettings = LumiverseBridge.getSettings();
            if (bridgeSettings) {
                console.log('Bridge packs type:', typeof bridgeSettings.packs, Array.isArray(bridgeSettings.packs) ? '(Array)' : '(Object)');
                console.log('Bridge pack names:', bridgeSettings.packs ? Object.keys(bridgeSettings.packs) : 'null');
                console.log('Full bridge settings:', JSON.stringify(bridgeSettings, null, 2));
            } else {
                console.log('LumiverseBridge.getSettings() returned null');
            }
        } else {
            console.log('LumiverseBridge not available');
        }
    } catch (e) {
        console.log('Error reading bridge settings:', e.message);
    }

    // 5. Analyze pack structure (packs is an object, use Object.entries)
    console.log('\n--- PACK STRUCTURE ANALYSIS ---');
    const packsObj = state.packs || {};
    const packEntries = Object.entries(packsObj);
    console.log('Total packs:', packEntries.length);

    packEntries.forEach(([packName, pack]) => {
        console.log(`\nPack "${packName}":`);
        console.log('  - Pack keys:', Object.keys(pack));
        const isNewFormat = !!(pack.lumiaItems || pack.loomItems);
        console.log('  - Format:', isNewFormat ? 'v2 (lumiaItems/loomItems)' : 'v1 (mixed items[])');

        if (isNewFormat) {
            // New format: separate lumiaItems and loomItems arrays
            console.log('  - lumiaItems count:', pack.lumiaItems?.length || 0);
            console.log('  - loomItems count:', pack.loomItems?.length || 0);

            if (pack.lumiaItems?.length > 0) {
                console.log('  - Lumia items:');
                pack.lumiaItems.forEach((item, idx) => {
                    const name = item.lumiaName || 'NONE';
                    const hasDef = item.lumiaDefinition ? 'YES' : 'NO';
                    const hasBehavior = item.lumiaBehavior ? 'YES' : 'NO';
                    const hasPersonality = item.lumiaPersonality ? 'YES' : 'NO';
                    const gender = item.genderIdentity ?? 'NONE';
                    console.log(`    [${idx}] lumiaName="${name}", hasDef=${hasDef}, hasBehavior=${hasBehavior}, hasPersonality=${hasPersonality}, gender=${gender}`);
                });
            }

            if (pack.loomItems?.length > 0) {
                console.log('  - Loom items:');
                pack.loomItems.forEach((item, idx) => {
                    console.log(`    [${idx}] loomName="${item.loomName}", loomCategory="${item.loomCategory}"`);
                });
            }
        } else {
            // Legacy format: mixed items array
            console.log('  - items count:', pack.items?.length || 0);

            if (pack.items && pack.items.length > 0) {
                console.log('  - First item keys:', Object.keys(pack.items[0]));
                console.log('  - Items with lumiaDefName:', pack.items.filter(i => i.lumiaDefName).length);
                console.log('  - Items with loomCategory:', pack.items.filter(i => i.loomCategory).length);

                // Show all items
                console.log('  - All items:');
                pack.items.forEach((item, itemIndex) => {
                    const lumiaName = item.lumiaDefName || 'NONE';
                    const loomCat = item.loomCategory || 'NONE';
                    const hasDef = item.lumiaDef ? 'YES' : 'NO';
                    const hasBehavior = item.lumia_behavior ? 'YES' : 'NO';
                    const hasPersonality = item.lumia_personality ? 'YES' : 'NO';
                    console.log(`    [${itemIndex}] lumiaDefName="${lumiaName}", loomCategory="${loomCat}", hasDef=${hasDef}, hasBehavior=${hasBehavior}, hasPersonality=${hasPersonality}`);
                });
            }
        }
    });

    console.log('\n' + '='.repeat(80));
    console.log('END DEBUG DUMP - Copy everything above for analysis');
    console.log('='.repeat(80));

    // Return a copyable JSON object (full state minus React-only ui)
    const { ui, ...settingsState } = state;
    return {
        storeState: settingsState
    };
}

// Expose to window for console access
if (typeof window !== 'undefined') {
    window.debugLumiverseData = debugLumiverseData;
}
