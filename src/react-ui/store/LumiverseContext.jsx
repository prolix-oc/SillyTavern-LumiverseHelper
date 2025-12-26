import { createContext, useEffect, useRef, useSyncExternalStore, useCallback, useMemo } from 'react';

/* global SillyTavern, LumiverseBridge */

// Debounce helper for saving
let saveTimeout = null;
const debouncedSave = (fn, delay = 300) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(fn, delay);
};

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
 * Initial state - matches the EXACT format from oldLumiverseCode/lib/settingsManager.js
 *
 * IMPORTANT: This must match the DEFAULT_SETTINGS from the old code exactly.
 * DO NOT transform, rename, or restructure any fields.
 *
 * Packs format: OBJECT keyed by pack name (NOT array)
 * Selection format: { packName: string, itemName: string }
 * Item format (Lumia): { lumiaDefName, lumia_img, lumia_personality, lumia_behavior, lumiaDef, defAuthor }
 * Item format (Loom): { loomName, loomCategory, loomContent }
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

    // Chat change tracking (React-only, incremented on syncFromExtension)
    // Components can subscribe to this to reload when chat changes
    chatChangeCounter: 0,

    // UI state (React-only, not saved to extension)
    ui: {
        activeModal: null,
        isLoading: false,
        error: null,
        viewingPack: null,      // Pack name currently being viewed in detail modal
        viewingLoomPack: null,  // Pack name currently being viewed in loom detail modal
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
            packsObj[pack.name] = { ...pack, isCustom: true };
        });
        store.setState({ packs: packsObj });
    },

    addCustomPack: (pack) => {
        const state = store.getState();
        const packsObj = state.packs && typeof state.packs === 'object' ? { ...state.packs } : {};
        // Store pack by name with isCustom flag
        packsObj[pack.name] = { ...pack, isCustom: true };
        store.setState({ packs: packsObj });
    },

    updateCustomPack: (packIdOrName, updates) => {
        const state = store.getState();
        const packsObj = state.packs && typeof state.packs === 'object' ? { ...state.packs } : {};

        // Find the pack by id or name
        let packKey = null;
        for (const [key, pack] of Object.entries(packsObj)) {
            if (pack.id === packIdOrName || pack.name === packIdOrName || key === packIdOrName) {
                packKey = key;
                break;
            }
        }

        if (packKey) {
            // If updating name, we need to re-key the object
            const newName = updates.name || packsObj[packKey].name;
            const updatedPack = { ...packsObj[packKey], ...updates, isCustom: true };

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

        // Find and remove the pack by id or name
        for (const [key, pack] of Object.entries(packsObj)) {
            if (pack.id === packIdOrName || pack.name === packIdOrName || key === packIdOrName) {
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
     * Enable all traits for a Lumia item
     * Sets the definition (if item has one) and adds behaviors/personalities
     * without duplicating already-selected items
     *
     * @param {string} packName - The pack containing the item
     * @param {string} itemName - The lumiaDefName of the item
     */
    enableAllTraitsForLumia: (packName, itemName) => {
        const state = store.getState();
        const pack = state.packs[packName];
        if (!pack) return;

        const item = pack.items.find(i => i.lumiaDefName === itemName);
        if (!item) return;

        const selection = { packName, itemName };
        const newState = {};

        // Set definition if item has one
        if (item.lumiaDef) {
            newState.selectedDefinition = selection;
        }

        // Add behavior if item has one and not already selected
        if (item.lumia_behavior) {
            const behaviors = state.selectedBehaviors || [];
            const alreadySelected = behaviors.some(
                b => b.packName === packName && b.itemName === itemName
            );
            if (!alreadySelected) {
                newState.selectedBehaviors = [...behaviors, selection];
            }
        }

        // Add personality if item has one and not already selected
        if (item.lumia_personality) {
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
            councilMembers: JSON.parse(JSON.stringify(state.councilMembers || [])),
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
            councilMembers: JSON.parse(JSON.stringify(state.councilMembers || [])),
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

        // Look up the Lumia item to get its inherent traits
        const pack = state.packs[member.packName];
        const item = pack?.items?.find(i => i.lumiaDefName === member.itemName);

        const behaviors = [];
        const personalities = [];

        // Auto-attach inherent behavior if exists
        if (item?.lumia_behavior) {
            behaviors.push({ packName: member.packName, itemName: member.itemName });
        }

        // Auto-attach inherent personality if exists
        if (item?.lumia_personality) {
            personalities.push({ packName: member.packName, itemName: member.itemName });
        }

        store.setState({
            councilMembers: [
                ...state.councilMembers,
                {
                    id: crypto.randomUUID(),
                    packName: member.packName,
                    itemName: member.itemName,
                    behaviors,
                    personalities,
                    dominantBehavior: null,
                    dominantPersonality: null,
                    role: '',
                },
            ],
        });
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
    if (!extensionSettings) {
        console.warn('[LumiverseStore] syncFromExtension called with null settings');
        return;
    }

    console.log('[LumiverseStore] syncFromExtension - received:', {
        packsType: typeof extensionSettings.packs,
        packsKeys: extensionSettings.packs ? Object.keys(extensionSettings.packs) : [],
        selectedDefinition: extensionSettings.selectedDefinition,
        selectedBehaviorsCount: extensionSettings.selectedBehaviors?.length || 0,
    });

    // Preserve React-only state
    const currentState = store.getState();
    const currentUI = currentState.ui;
    const currentChatCounter = currentState.chatChangeCounter || 0;

    // Merge extension settings directly into store
    // This preserves the EXACT structure from the old code
    store.setState({
        ...extensionSettings,
        // Keep React-only UI state
        ui: currentUI,
        // Increment chat change counter so components know to reload
        chatChangeCounter: currentChatCounter + 1,
    });

    console.log('[LumiverseStore] syncFromExtension - store updated:', {
        packsKeys: Object.keys(store.getState().packs || {}),
    });
}

/**
 * Export state for saving to extension
 *
 * IMPORTANT: Returns the EXACT format expected by settingsManager.js.
 * No transformation - just exclude the React-only UI state.
 */
function exportForExtension() {
    const state = store.getState();

    // Return everything except the React-only UI state
    const { ui, ...settingsToExport } = state;

    console.log('[LumiverseStore] exportForExtension:', {
        packsKeys: Object.keys(settingsToExport.packs || {}),
    });

    return settingsToExport;
}

// Save to extension (debounced)
function saveToExtension() {
    debouncedSave(() => {
        if (typeof LumiverseBridge !== 'undefined' && LumiverseBridge.saveSettings) {
            const exportedState = exportForExtension();
            LumiverseBridge.saveSettings(exportedState);
            console.log('[LumiverseStore] Settings saved to extension');
        }
    });
}

// Save to extension immediately (no debounce - for critical settings like OOC style)
function saveToExtensionImmediate() {
    if (typeof LumiverseBridge !== 'undefined' && LumiverseBridge.saveSettings) {
        const exportedState = exportForExtension();
        LumiverseBridge.saveSettings(exportedState);
        console.log('[LumiverseStore] Settings saved immediately');
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

/**
 * Hook to access just the settings
 */
export function useSettings() {
    return useLumiverse(selectSettings);
}

/**
 * Hook to access LUMIA selections (character-focused content)
 */
export function useSelections() {
    const behaviors = useSyncExternalStore(
        store.subscribe,
        () => store.getState().selectedBehaviors,
        () => store.getState().selectedBehaviors
    );
    const personalities = useSyncExternalStore(
        store.subscribe,
        () => store.getState().selectedPersonalities,
        () => store.getState().selectedPersonalities
    );
    const definition = useSyncExternalStore(
        store.subscribe,
        () => store.getState().selectedDefinition,
        () => store.getState().selectedDefinition
    );
    const dominantBehavior = useSyncExternalStore(
        store.subscribe,
        () => store.getState().dominantBehavior,
        () => store.getState().dominantBehavior
    );
    const dominantPersonality = useSyncExternalStore(
        store.subscribe,
        () => store.getState().dominantPersonality,
        () => store.getState().dominantPersonality
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
 *
 * OLD CODE FIELD NAMES:
 * - selectedLoomStyle (not selectedLoomStyles)
 * - selectedLoomUtils (not selectedLoomUtilities)
 * - selectedLoomRetrofits
 */
export function useLoomSelections() {
    const styles = useSyncExternalStore(
        store.subscribe,
        () => store.getState().selectedLoomStyle || [],
        () => store.getState().selectedLoomStyle || []
    );
    const utilities = useSyncExternalStore(
        store.subscribe,
        () => store.getState().selectedLoomUtils || [],
        () => store.getState().selectedLoomUtils || []
    );
    const retrofits = useSyncExternalStore(
        store.subscribe,
        () => store.getState().selectedLoomRetrofits || [],
        () => store.getState().selectedLoomRetrofits || []
    );

    return useMemo(() => ({
        styles,
        utilities,
        retrofits,
    }), [styles, utilities, retrofits]);
}

/**
 * Hook to access packs
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
        () => store.getState().packs,
        () => store.getState().packs
    );

    return useMemo(() => {
        // Convert packs to array - handle both object and array formats
        let packsArray = [];
        if (packsRaw) {
            if (Array.isArray(packsRaw)) {
                packsArray = packsRaw;
            } else if (typeof packsRaw === 'object') {
                packsArray = Object.values(packsRaw);
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
