/**
 * Settings Manager Module
 * Handles all settings persistence, migration, and state management for Lumia Injector
 *
 * Storage Architecture:
 * - Extension settings (settings.json): UI preferences, feature toggles, migration flags
 * - File storage (User Files API): Pack data, selections, pack-related preferences
 *
 * The pack cache (packCache.js) handles in-memory caching and lazy loading of packs.
 * This module bridges between the React UI, extension settings, and the pack cache.
 */

import { getExtensionSettings, getSaveSettingsDebounced } from "../stContext.js";
import {
  initPackCache,
  isCacheInitialized,
  getCachedIndex,
  getAllPacksSync,
  getPackSync,
  getPack,
  upsertPack,
  removePack as removePackFromCache,
  updateSelections,
  updatePreferences,
  updatePreferencesImmediate,
  getPresets as getCachedPresets,
  upsertPreset,
  deletePreset as deletePresetFromCache,
  updatePresets,
  flushIndexSave,
  migratePacksFromSettings,
  migrateSelectionsFromSettings,
  subscribeToCacheChanges,
  clearAllData,
} from "./packCache.js";

export const MODULE_NAME = "lumia-injector";
export const SETTINGS_KEY = "lumia_injector_settings";
export const LOOM_SUMMARY_KEY = "loom_summary";

// Schema version for pack format migrations
// v1: Original mixed items[] array with old field names
// v2: Separate lumiaItems[]/loomItems[] with new field names
export const SCHEMA_VERSION = 2;

// Gender identity constants
export const GENDER = {
  SHE_HER: 0,
  HE_HIM: 1,
  THEY_THEM: 2,
};

// Default settings structure
const DEFAULT_SETTINGS = {
  schemaVersion: SCHEMA_VERSION,
  packs: {},
  selectedDefinition: null,
  selectedBehaviors: [],
  selectedPersonalities: [],
  dominantBehavior: null, // { packName, itemName } - the dominant behavior trait
  dominantPersonality: null, // { packName, itemName } - the dominant personality trait
  selectedLoomStyle: [],
  selectedLoomUtils: [],
  selectedLoomRetrofits: [],
  // Preset system
  presets: {}, // Saved preset configurations keyed by name
  activePresetName: null, // Currently loaded preset name (for UI indication)
  // Chimera/Council modes (for preset compatibility)
  chimeraMode: false,
  selectedDefinitions: [], // Array of { packName, itemName } - used in Chimera mode
  councilMode: false,
  councilMembers: [], // Array of council member configurations
  lumiaQuirks: '', // User text for behavioral quirks (works in all modes)
  stateSynthesis: {
    enabled: false, // Toggle for non-council synthesis prompt
  },
  lumiaOOCInterval: null,
  lumiaOOCStyle: "social",
  sovereignHand: {
    enabled: false,
    excludeLastMessage: true, // Whether to remove last user message from context
    includeMessageInPrompt: true, // Whether to include user message in {{loomSovHand}} macro
  },
  contextFilters: {
    htmlTags: {
      enabled: false,
      keepDepth: 3, // Number of recent messages to keep HTML tags in
      stripFonts: false, // Whether to also strip <font> tags
      fontKeepDepth: 3, // Number of recent messages to keep <font> tags in
    },
    detailsBlocks: {
      enabled: false,
      keepDepth: 3, // Number of recent messages to keep <details> in
    },
    loomItems: {
      enabled: false,
      keepDepth: 5, // Number of recent messages to keep Loom tags in
    },
  },
  messageTruncation: {
    enabled: false,
    keepCount: 50, // Number of recent messages to keep in context
  },
  summarization: {
    mode: "disabled",
    apiSource: "main",
    autoInterval: 10,
    autoMessageContext: 10,
    manualMessageContext: 10,
    secondary: {
      provider: "openai",
      model: "",
      endpoint: "",
      apiKey: "",
      temperature: 0.7,
      topP: 1.0,
      maxTokens: 8192,
    },
  },
  // Cache control for Anthropic API calls
  lumiaConfigVersion: 1,
  lastLumiaChangeTimestamp: null,
  disableAnthropicCache: false,
  // Tracked presets from Lucid.cards (for update notifications)
  trackedPresets: {}, // { [presetSlug]: { name, version: {major, minor, patch}, importedAt, versionName } }
  // Dismissed update version (to not show banner again for same version)
  dismissedUpdateVersion: null,
  // Lumia button position (percentage from edges)
  lumiaButtonPosition: {
    useDefault: true, // When true, use default positioning (top-right, animates with panel)
    xPercent: 1,      // Percentage from right edge (0-100)
    yPercent: 1,      // Percentage from top edge (0-100)
  },
};

// Settings state - module-level singleton
let settings = { ...DEFAULT_SETTINGS };

// Lumia Randomization State
let currentRandomLumia = null;

/**
 * Get the current settings object
 * @returns {Object} Current settings
 */
export function getSettings() {
  return settings;
}

/**
 * Get the current random Lumia selection
 * @returns {Object|null} Current random Lumia or null
 */
export function getCurrentRandomLumia() {
  return currentRandomLumia;
}

/**
 * Set the current random Lumia selection
 * @param {Object|null} lumia - The Lumia to set, or null to clear
 */
export function setCurrentRandomLumia(lumia) {
  currentRandomLumia = lumia;
}

/**
 * Reset the random Lumia selection
 */
export function resetRandomLumia() {
  currentRandomLumia = null;
}

/**
 * Migrate a single Lumia item from old format to new format
 * @param {Object} oldItem - Item with old field names
 * @returns {Object} Item with new field names
 */
function migrateLumiaItem(oldItem) {
  return {
    lumiaName: oldItem.lumiaDefName,
    lumiaDefinition: oldItem.lumiaDef || null,
    lumiaPersonality: oldItem.lumia_personality || null,
    lumiaBehavior: oldItem.lumia_behavior || null,
    avatarUrl: oldItem.lumia_img || null,
    genderIdentity: GENDER.SHE_HER, // Default to she/her
    authorName: oldItem.defAuthor || null,
    version: 1,
  };
}

/**
 * Migrate a single Loom item from old format to new format
 * @param {Object} oldItem - Item with old field names
 * @returns {Object} Item with new field names
 */
function migrateLoomItem(oldItem) {
  return {
    loomName: oldItem.loomName,
    loomContent: oldItem.loomContent,
    loomCategory: oldItem.loomCategory,
    authorName: null,
    version: 1,
  };
}

/**
 * Migrate a pack from old format (mixed items[]) to new format (separate lumiaItems[]/loomItems[])
 * @param {Object} oldPack - Pack with old structure
 * @returns {Object} Pack with new structure
 */
function migratePackToV2(oldPack) {
  const lumiaItems = [];
  const loomItems = [];

  // Process mixed items array
  for (const item of oldPack.items || []) {
    if (item.lumiaDefName) {
      // This is a Lumia item
      lumiaItems.push(migrateLumiaItem(item));
    } else if (item.loomCategory) {
      // This is a Loom item
      loomItems.push(migrateLoomItem(item));
    }
  }

  return {
    packName: oldPack.name || oldPack.packName,
    packAuthor: oldPack.author || oldPack.packAuthor || null,
    coverUrl: oldPack.coverUrl || null,
    version: 1,
    packExtras: oldPack.packExtras || [],
    lumiaItems,
    loomItems,
    // Preserve internal flags
    isCustom: oldPack.isCustom || false,
    url: oldPack.url || "",
  };
}

/**
 * Migrate all packs to v2 schema format
 * @returns {boolean} True if migration occurred
 */
function migratePacksToV2() {
  let migrated = false;
  const currentVersion = settings.schemaVersion || 1;

  if (currentVersion >= SCHEMA_VERSION) {
    return false; // Already at current version
  }

  console.log(`[${MODULE_NAME}] Migrating packs from schema v${currentVersion} to v${SCHEMA_VERSION}...`);

  // Migrate each pack
  for (const packName in settings.packs) {
    const pack = settings.packs[packName];

    // Check if pack needs migration (has old items[] array, no lumiaItems/loomItems)
    if (pack.items && !pack.lumiaItems && !pack.loomItems) {
      console.log(`[${MODULE_NAME}] Migrating pack: ${packName}`);
      settings.packs[packName] = migratePackToV2(pack);
      migrated = true;
    }
  }

  // Update schema version
  settings.schemaVersion = SCHEMA_VERSION;

  if (migrated) {
    console.log(`[${MODULE_NAME}] Pack migration complete`);
  }

  return migrated;
}

/**
 * Migrate settings from v1 (flat library) to v2 (packs)
 * @returns {boolean} True if migration occurred
 */
export function migrateSettings() {
  let migrated = false;

  // Import processWorldBook dynamically to avoid circular dependency
  // This is only needed during migration of legacy settings

  // If old keys exist and packs is empty
  if (
    (settings.lumiaLibrary || settings.worldBookData) &&
    Object.keys(settings.packs).length === 0
  ) {
    console.log("Lumia Injector: Migrating legacy settings...");
    const legacyItems = settings.lumiaLibrary || [];
    let items = legacyItems;

    // Note: For legacy migration, we'd need to process the worldBookData
    // But this path is unlikely to be hit in modern usage
    if (items.length === 0 && settings.worldBookData) {
      // Legacy data exists but can't be processed here
      // This would require importing processWorldBook which creates circular dep
      console.warn(
        "Legacy worldBookData found but cannot be migrated automatically. Please re-import your world book.",
      );
    }

    if (items.length > 0) {
      const packName = "Default (Legacy)";
      settings.packs[packName] = {
        name: packName,
        items: items,
        url: settings.worldBookUrl || "Legacy",
      };

      const getName = (idx) => items[idx]?.lumiaDefName;

      if (typeof settings.selectedDefinition === "number") {
        const name = getName(settings.selectedDefinition);
        if (name) settings.selectedDefinition = { packName, itemName: name };
        else settings.selectedDefinition = null;
      }

      if (
        Array.isArray(settings.selectedBehaviors) &&
        settings.selectedBehaviors.length > 0 &&
        typeof settings.selectedBehaviors[0] === "number"
      ) {
        settings.selectedBehaviors = settings.selectedBehaviors
          .map((idx) => {
            const name = getName(idx);
            return name ? { packName, itemName: name } : null;
          })
          .filter((x) => x);
      } else {
        settings.selectedBehaviors = [];
      }

      if (
        Array.isArray(settings.selectedPersonalities) &&
        settings.selectedPersonalities.length > 0 &&
        typeof settings.selectedPersonalities[0] === "number"
      ) {
        settings.selectedPersonalities = settings.selectedPersonalities
          .map((idx) => {
            const name = getName(idx);
            return name ? { packName, itemName: name } : null;
          })
          .filter((x) => x);
      } else {
        settings.selectedPersonalities = [];
      }

      delete settings.lumiaLibrary;
      delete settings.worldBookData;
      delete settings.worldBookUrl;
      migrated = true;
    }
  }

  // Migrate packs to v2 schema format (separate lumiaItems/loomItems arrays)
  if (migratePacksToV2()) {
    migrated = true;
  }

  // Fix isCustom flag for packs based on URL presence
  // Packs WITH a URL are from external sources (not custom/editable)
  // Packs WITHOUT a URL are user uploads (custom/editable)
  for (const packName in settings.packs) {
    const pack = settings.packs[packName];
    if (pack.url) {
      // Has URL = external source = not custom
      if (pack.isCustom === true) {
        console.log(`[${MODULE_NAME}] Fixing isCustom flag for URL pack: ${packName}`);
        pack.isCustom = false;
        migrated = true;
      }
    } else {
      // No URL = user upload = custom
      if (pack.isCustom !== true) {
        console.log(`[${MODULE_NAME}] Fixing isCustom flag for local pack: ${packName}`);
        pack.isCustom = true;
        migrated = true;
      }
    }
  }

  // Ensure defaults
  if (!settings.schemaVersion) settings.schemaVersion = SCHEMA_VERSION;
  if (!settings.packs) settings.packs = {};
  if (!settings.selectedBehaviors) settings.selectedBehaviors = [];
  if (!settings.selectedPersonalities) settings.selectedPersonalities = [];
  if (settings.dominantBehavior === undefined) settings.dominantBehavior = null;
  if (settings.dominantPersonality === undefined)
    settings.dominantPersonality = null;
  if (!settings.selectedLoomUtils) settings.selectedLoomUtils = [];
  if (!settings.selectedLoomRetrofits) settings.selectedLoomRetrofits = [];
  if (settings.lumiaOOCInterval === undefined) settings.lumiaOOCInterval = null;
  if (!settings.lumiaOOCStyle) settings.lumiaOOCStyle = "social";

  // Ensure sovereignHand defaults
  if (!settings.sovereignHand) {
    settings.sovereignHand = {
      enabled: false,
      excludeLastMessage: true,
      includeMessageInPrompt: true,
    };
  }
  // Ensure excludeLastMessage default for existing sovereignHand settings
  if (settings.sovereignHand.excludeLastMessage === undefined) {
    settings.sovereignHand.excludeLastMessage = true;
  }
  // Ensure includeMessageInPrompt default for existing sovereignHand settings
  if (settings.sovereignHand.includeMessageInPrompt === undefined) {
    settings.sovereignHand.includeMessageInPrompt = true;
  }

  // Ensure contextFilters defaults
  if (!settings.contextFilters) {
    settings.contextFilters = {
      htmlTags: { enabled: false, stripFonts: false, fontKeepDepth: 3 },
      detailsBlocks: { enabled: false, keepDepth: 3 },
      loomItems: { enabled: false, keepDepth: 5 },
    };
  }
  // Ensure nested defaults exist
  if (!settings.contextFilters.htmlTags) {
    settings.contextFilters.htmlTags = { enabled: false, keepDepth: 3, stripFonts: false, fontKeepDepth: 3 };
  }
  // Ensure new htmlTags sub-fields exist
  if (settings.contextFilters.htmlTags.keepDepth === undefined) {
    settings.contextFilters.htmlTags.keepDepth = 3;
  }
  if (settings.contextFilters.htmlTags.stripFonts === undefined) {
    settings.contextFilters.htmlTags.stripFonts = false;
  }
  if (settings.contextFilters.htmlTags.fontKeepDepth === undefined) {
    settings.contextFilters.htmlTags.fontKeepDepth = 3;
  }
  if (!settings.contextFilters.detailsBlocks) {
    settings.contextFilters.detailsBlocks = { enabled: false, keepDepth: 3 };
  }
  if (settings.contextFilters.detailsBlocks.keepDepth === undefined) {
    settings.contextFilters.detailsBlocks.keepDepth = 3;
  }
  if (!settings.contextFilters.loomItems) {
    settings.contextFilters.loomItems = { enabled: false, keepDepth: 5 };
  }
  if (settings.contextFilters.loomItems.keepDepth === undefined) {
    settings.contextFilters.loomItems.keepDepth = 5;
  }

  // Ensure messageTruncation defaults
  if (!settings.messageTruncation) {
    settings.messageTruncation = {
      enabled: false,
      keepCount: 50,
    };
  }
  if (settings.messageTruncation.keepCount === undefined) {
    settings.messageTruncation.keepCount = 50;
  }

  // Ensure summarization defaults
  if (!settings.summarization) {
    settings.summarization = {
      mode: "disabled",
      apiSource: "main",
      autoInterval: 10,
      autoMessageContext: 10,
      manualMessageContext: 10,
      secondary: {
        provider: "openai",
        model: "",
        endpoint: "",
        apiKey: "",
        temperature: 0.7,
        topP: 1.0,
        maxTokens: 8192,
      },
    };
  }

  // Migrate old messageContext to new split fields
  if (settings.summarization.messageContext !== undefined) {
    settings.summarization.autoMessageContext =
      settings.summarization.messageContext;
    settings.summarization.manualMessageContext =
      settings.summarization.messageContext;
    delete settings.summarization.messageContext;
    migrated = true;
  }

  // Ensure new fields exist with defaults
  if (settings.summarization.autoMessageContext === undefined) {
    settings.summarization.autoMessageContext = 10;
  }
  if (settings.summarization.manualMessageContext === undefined) {
    settings.summarization.manualMessageContext = 10;
  }
  if (!settings.summarization.secondary) {
    settings.summarization.secondary = {
      provider: "openai",
      model: "",
      endpoint: "",
      apiKey: "",
      temperature: 0.7,
      topP: 1.0,
      maxTokens: 8192,
    };
  }
  // Ensure topP exists
  if (settings.summarization.secondary.topP === undefined) {
    settings.summarization.secondary.topP = 1.0;
  }
  // Ensure maxTokens has sane default
  if (
    !settings.summarization.secondary.maxTokens ||
    settings.summarization.secondary.maxTokens < 256
  ) {
    settings.summarization.secondary.maxTokens = 8192;
  }

  // Ensure preset system defaults
  if (!settings.presets) settings.presets = {};
  if (settings.activePresetName === undefined) settings.activePresetName = null;

  // Ensure Chimera mode defaults
  if (settings.chimeraMode === undefined) settings.chimeraMode = false;
  if (!settings.selectedDefinitions) settings.selectedDefinitions = [];

  // Ensure Council mode defaults
  if (settings.councilMode === undefined) settings.councilMode = false;
  if (!settings.councilMembers) settings.councilMembers = [];

  // Migrate councilQuirks → lumiaQuirks (quirks now work in all modes)
  if (settings.councilQuirks !== undefined && settings.lumiaQuirks === undefined) {
    settings.lumiaQuirks = settings.councilQuirks;
    delete settings.councilQuirks;
    migrated = true;
  }
  if (settings.lumiaQuirks === undefined) settings.lumiaQuirks = '';
  if (!settings.stateSynthesis) settings.stateSynthesis = { enabled: false };

  return migrated;
}

/** @type {boolean} Whether file storage has been initialized */
let fileStorageInitialized = false;

/** @type {boolean} Whether packs have been migrated to file storage */
let packsMigrated = false;

/**
 * Load settings from SillyTavern storage
 */
export function loadSettings() {
  const extension_settings = getExtensionSettings();
  if (extension_settings[SETTINGS_KEY]) {
    settings = { ...settings, ...extension_settings[SETTINGS_KEY] };

    if (migrateSettings()) {
      saveSettings();
    }
  } else {
    extension_settings[SETTINGS_KEY] = settings;
  }
}

/**
 * Initialize pack file storage.
 * This should be called after loadSettings() during extension startup.
 * Migrates packs from extension_settings to file storage on first run.
 * @returns {Promise<boolean>} True if file storage is available and initialized
 */
export async function initPackFileStorage() {
  if (fileStorageInitialized) {
    return isCacheInitialized();
  }

  console.log(`[${MODULE_NAME}] Initializing pack file storage...`);

  // Check if we've already migrated (flag in settings)
  const alreadyMigrated = settings.packStorageMigrated === true;

  // Initialize the pack cache
  const cacheReady = await initPackCache();

  if (!cacheReady) {
    console.warn(`[${MODULE_NAME}] File storage not available, using extension settings`);
    fileStorageInitialized = true;
    return false;
  }

  // If not migrated yet and we have packs in settings, migrate them
  if (!alreadyMigrated && settings.packs && Object.keys(settings.packs).length > 0) {
    console.log(`[${MODULE_NAME}] Migrating packs to file storage...`);

    const { migrated, failed } = await migratePacksFromSettings(settings.packs);

    if (migrated > 0) {
      // Also migrate selections and preferences
      migrateSelectionsFromSettings(settings);

      // Mark as migrated
      settings.packStorageMigrated = true;

      // Clear packs from extension settings to reduce size
      // Keep a backup flag in case we need to recover
      settings.packsBackedUp = true;
      delete settings.packs;

      // Save the updated settings
      saveSettings();

      console.log(`[${MODULE_NAME}] Migration complete: ${migrated} packs moved to file storage`);
      if (failed > 0) {
        console.warn(`[${MODULE_NAME}] ${failed} packs failed to migrate`);
      }
    }

    packsMigrated = true;
  } else if (alreadyMigrated) {
    console.log(`[${MODULE_NAME}] Packs already migrated to file storage`);
    packsMigrated = true;
    
    // One-time cleanup: remove duplicated selections/preferences from extension_settings
    // This handles users who migrated before we added this cleanup
    if (!settings.selectionsCleanedUp) {
      console.log(`[${MODULE_NAME}] Cleaning up duplicated selections from extension_settings...`);
      settings.selectionsCleanedUp = true;
      saveSettings(); // This now excludes selections/preferences
    }
  }

  fileStorageInitialized = true;

  // Merge selections, preferences, and presets from cache into in-memory settings
  // This ensures getSettings() returns the correct values
  const index = getCachedIndex();
  if (index) {
    if (index.selections) {
      Object.assign(settings, index.selections);
    }
    if (index.preferences) {
      Object.assign(settings, index.preferences);
    }
    if (index.presets) {
      settings.presets = index.presets;
    }
  }

  // Subscribe to cache changes to keep React in sync
  subscribeToCacheChanges(() => {
    // Notify any listeners that pack data changed
    // This will be used by the React store to refresh
    if (typeof window !== 'undefined' && window.LumiverseBridge?.onPackCacheChange) {
      window.LumiverseBridge.onPackCacheChange();
    }
  });

  return true;
}

/**
 * Check if file storage is being used for packs.
 * @returns {boolean}
 */
export function isUsingFileStorage() {
  return fileStorageInitialized && isCacheInitialized();
}

/**
 * Save settings to SillyTavern storage.
 * Note: Pack data and selections are now saved via the pack cache, not here.
 */
export function saveSettings() {
  const extension_settings = getExtensionSettings();
  const saveSettingsDebounced = getSaveSettingsDebounced();

  // If using file storage, exclude packs AND selections/preferences (they're in file storage)
  if (isUsingFileStorage()) {
    // Create a copy without pack-related data for saving
    const settingsToSave = { ...settings };
    delete settingsToSave.packs; // Packs are in file storage
    
    // Remove selections - these are now in index.selections
    delete settingsToSave.selectedDefinition;
    delete settingsToSave.selectedBehaviors;
    delete settingsToSave.selectedPersonalities;
    delete settingsToSave.dominantBehavior;
    delete settingsToSave.dominantPersonality;
    delete settingsToSave.selectedLoomStyle;
    delete settingsToSave.selectedLoomUtils;
    delete settingsToSave.selectedLoomRetrofits;
    delete settingsToSave.selectedDefinitions;
    delete settingsToSave.councilMembers;
    
    // Remove preferences that are in index.preferences
    delete settingsToSave.chimeraMode;
    delete settingsToSave.councilMode;
    delete settingsToSave.lumiaQuirks;
    delete settingsToSave.lumiaQuirksEnabled;
    delete settingsToSave.lumiaOOCInterval;
    delete settingsToSave.lumiaOOCStyle;
    delete settingsToSave.activePresetName;
    
    // Remove presets - these are now in index.presets
    delete settingsToSave.presets;
    
    extension_settings[SETTINGS_KEY] = settingsToSave;
  } else {
    extension_settings[SETTINGS_KEY] = settings;
  }

  saveSettingsDebounced();
}

/**
 * Get packs from the appropriate source (cache or settings).
 * @returns {Object} Packs object keyed by pack name
 */
export function getPacks() {
  if (isUsingFileStorage()) {
    // Build packs object from cache
    const packs = {};
    for (const pack of getAllPacksSync()) {
      const packName = pack.packName || pack.name;
      packs[packName] = pack;
    }
    return packs;
  }
  return settings.packs || {};
}

/**
 * Get a single pack by name.
 * @param {string} packName - The pack name
 * @returns {Object|null} The pack or null
 */
export function getPackByName(packName) {
  if (isUsingFileStorage()) {
    return getPackSync(packName);
  }
  return settings.packs?.[packName] || null;
}

/**
 * Get a single pack by name (async version, may load from file).
 * @param {string} packName - The pack name
 * @returns {Promise<Object|null>} The pack or null
 */
export async function getPackByNameAsync(packName) {
  if (isUsingFileStorage()) {
    return await getPack(packName);
  }
  return settings.packs?.[packName] || null;
}

/**
 * Save or update a pack.
 * @param {Object} pack - The pack object
 * @returns {Promise<void>}
 */
export async function savePack(pack) {
  const packName = pack.packName || pack.name;

  if (isUsingFileStorage()) {
    await upsertPack(pack);
  } else {
    // Fallback to extension settings
    if (!settings.packs) settings.packs = {};
    settings.packs[packName] = pack;
    saveSettings();
  }
}

/**
 * Delete a pack.
 * @param {string} packName - The pack name to delete
 * @returns {Promise<void>}
 */
export async function deletePack(packName) {
  if (isUsingFileStorage()) {
    await removePackFromCache(packName);
  } else {
    if (settings.packs?.[packName]) {
      delete settings.packs[packName];
      saveSettings();
    }
  }
}

/**
 * Update selections (write-through to file storage or settings).
 * @param {Object} newSelections - Partial selections to merge
 */
export function saveSelections(newSelections) {
  // Always update in-memory settings so getSettings() returns current values
  Object.assign(settings, newSelections);
  
  if (isUsingFileStorage()) {
    updateSelections(newSelections);
  } else {
    saveSettings();
  }
}

/**
 * Get current selections.
 * @returns {Object} Selections object
 */
export function getSelections() {
  if (isUsingFileStorage()) {
    const index = getCachedIndex();
    return index?.selections || {};
  }
  // Extract selections from settings
  return {
    selectedDefinition: settings.selectedDefinition,
    selectedBehaviors: settings.selectedBehaviors || [],
    selectedPersonalities: settings.selectedPersonalities || [],
    dominantBehavior: settings.dominantBehavior,
    dominantPersonality: settings.dominantPersonality,
    selectedLoomStyle: settings.selectedLoomStyle || [],
    selectedLoomUtils: settings.selectedLoomUtils || [],
    selectedLoomRetrofits: settings.selectedLoomRetrofits || [],
    selectedDefinitions: settings.selectedDefinitions || [],
    councilMembers: settings.councilMembers || [],
  };
}

/**
 * Update preferences (write-through to file storage or settings).
 * @param {Object} newPreferences - Partial preferences to merge
 */
export function savePreferences(newPreferences) {
  // Always update in-memory settings so getSettings() returns current values
  Object.assign(settings, newPreferences);
  
  if (isUsingFileStorage()) {
    updatePreferences(newPreferences);
  } else {
    saveSettings();
  }
}

/**
 * Update preferences with immediate save (no debounce).
 * Use for critical settings that must persist before page unload or modal close.
 * @param {Object} newPreferences - Partial preferences to merge
 * @returns {Promise<void>}
 */
export async function savePreferencesImmediate(newPreferences) {
  // Always update in-memory settings so getSettings() returns current values
  Object.assign(settings, newPreferences);
  
  if (isUsingFileStorage()) {
    await updatePreferencesImmediate(newPreferences);
  } else {
    saveSettings();
  }
}

// ============================================================================
// PRESET OPERATIONS
// ============================================================================

/**
 * Get all presets.
 * @returns {Object} Presets object keyed by name
 */
export function getPresets() {
  if (isUsingFileStorage()) {
    return getCachedPresets();
  }
  return settings.presets || {};
}

/**
 * Save or update a preset.
 * @param {string} presetName - The preset name
 * @param {Object} presetData - The preset data
 */
export function savePreset(presetName, presetData) {
  // Update in-memory settings
  if (!settings.presets) {
    settings.presets = {};
  }
  settings.presets[presetName] = presetData;
  
  if (isUsingFileStorage()) {
    upsertPreset(presetName, presetData);
  } else {
    saveSettings();
  }
}

/**
 * Delete a preset.
 * @param {string} presetName - The preset name to delete
 */
export function deletePreset(presetName) {
  // Update in-memory settings
  if (settings.presets) {
    delete settings.presets[presetName];
  }
  
  if (isUsingFileStorage()) {
    deletePresetFromCache(presetName);
  } else {
    saveSettings();
  }
}

/**
 * Replace all presets (for bulk operations).
 * @param {Object} newPresets - Complete presets object
 */
export function setAllPresets(newPresets) {
  settings.presets = newPresets;
  
  if (isUsingFileStorage()) {
    updatePresets(newPresets);
  } else {
    saveSettings();
  }
}

/**
 * Flush any pending saves before shutdown.
 * @returns {Promise<void>}
 */
export async function flushPendingSaves() {
  if (isUsingFileStorage()) {
    await flushIndexSave();
  }
}

/**
 * Get the current Lumia config version
 * Used for cache invalidation with Anthropic API
 * @returns {number} Current version number
 */
export function getLumiaConfigVersion() {
  return settings.lumiaConfigVersion || 1;
}

/**
 * Increment Lumia config version for cache invalidation
 * Call this whenever Lumia definitions change
 */
export function bumpLumiaConfigVersion() {
  settings.lumiaConfigVersion = (settings.lumiaConfigVersion || 0) + 1;
  settings.lastLumiaChangeTimestamp = Date.now();
  saveSettings();
  console.log(`[${MODULE_NAME}] Lumia config version bumped to ${settings.lumiaConfigVersion}`);
}

/**
 * Clear Claude cache by bumping version and setting temporary disable flag
 * This forces all subsequent requests to bypass any cached prompts
 * @returns {number} New version number
 */
export function clearClaudeCache() {
  settings.lumiaConfigVersion = (settings.lumiaConfigVersion || 0) + 1;
  settings.lastLumiaChangeTimestamp = Date.now();
  settings.disableAnthropicCache = true;
  saveSettings();
  console.log(`[${MODULE_NAME}] Claude cache cleared - version now ${settings.lumiaConfigVersion}`);

  // Re-enable cache after a short delay (for next request series)
  setTimeout(() => {
    settings.disableAnthropicCache = false;
    saveSettings();
  }, 5000);

  return settings.lumiaConfigVersion;
}

/**
 * Reset all settings to defaults (nuclear option)
 * This completely wipes all extension settings, User Files API data, and reloads the page.
 * On reload, the extension will initialize with fresh DEFAULT_SETTINGS.
 */
export async function resetAllSettings() {
  const extension_settings = getExtensionSettings();
  const saveSettingsDebounced = getSaveSettingsDebounced();

  console.log(`[${MODULE_NAME}] NUCLEAR RESET: Wiping all extension settings and User Files data...`);

  // First, clear all User Files API data (packs, index, toggle states)
  try {
    const result = await clearAllData();
    console.log(`[${MODULE_NAME}] User Files cleanup: ${result.deleted.length} deleted, ${result.failed.length} failed`);
  } catch (err) {
    console.error(`[${MODULE_NAME}] Failed to clear User Files data:`, err);
    // Continue with settings reset even if file cleanup fails
  }

  // Delete the entire settings key
  delete extension_settings[SETTINGS_KEY];

  // Reset the module-level settings to defaults immediately
  // This ensures the in-memory state is also cleared
  settings = { ...DEFAULT_SETTINGS };

  // Force a save to persist the deletion
  // Note: saveSettingsDebounced has a ~1000ms debounce delay
  saveSettingsDebounced();

  console.log(`[${MODULE_NAME}] Settings wiped. Page will reload...`);

  // Wait long enough for the debounced save to complete (1500ms > 1000ms debounce)
  // then reload to reinitialize with fresh defaults
  setTimeout(() => {
    window.location.reload();
  }, 1500);
}

/**
 * Get the extension directory path
 * Note: In bundled mode, this is less reliable - use for compatibility only
 * @returns {string} Extension directory path
 */
export function getExtensionDirectory() {
  // Try to find extension path from script tags
  const scripts = document.querySelectorAll('script[src*="lumia"], script[src*="lumiverse"]');
  for (const script of scripts) {
    const src = script.src;
    const match = src.match(/(\/scripts\/extensions\/third-party\/[^/]+)/);
    if (match) {
      return match[1];
    }
  }
  // Fallback
  return "/scripts/extensions/third-party/SillyTavern-LumiverseHelper";
}
