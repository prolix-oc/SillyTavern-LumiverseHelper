/**
 * Settings Manager Module
 * Handles all settings persistence, migration, and state management for Lumia Injector
 */

import { extension_settings } from "../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../script.js";

export const MODULE_NAME = "lumia-injector";
export const SETTINGS_KEY = "lumia_injector_settings";
export const LOOM_SUMMARY_KEY = "loom_summary";

// Default settings structure
const DEFAULT_SETTINGS = {
  packs: {},
  selectedDefinition: null,
  selectedBehaviors: [],
  selectedPersonalities: [],
  dominantBehavior: null, // { packName, itemName } - the dominant behavior trait
  dominantPersonality: null, // { packName, itemName } - the dominant personality trait
  selectedLoomStyle: [],
  selectedLoomUtils: [],
  selectedLoomRetrofits: [],
  lumiaOOCInterval: null,
  lumiaOOCStyle: "social",
  sovereignHand: {
    enabled: false,
    excludeLastMessage: true, // Whether to remove last user message from context
  },
  contextFilters: {
    htmlTags: {
      enabled: false,
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

  // Ensure defaults
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
    };
  }
  // Ensure excludeLastMessage default for existing sovereignHand settings
  if (settings.sovereignHand.excludeLastMessage === undefined) {
    settings.sovereignHand.excludeLastMessage = true;
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
    settings.contextFilters.htmlTags = { enabled: false, stripFonts: false, fontKeepDepth: 3 };
  }
  // Ensure new htmlTags sub-fields exist
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

  return migrated;
}

/**
 * Load settings from SillyTavern storage
 */
export function loadSettings() {
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
 * Save settings to SillyTavern storage
 */
export function saveSettings() {
  extension_settings[SETTINGS_KEY] = settings;
  saveSettingsDebounced();
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
 * Get the extension directory path
 * @returns {string} Extension directory path
 */
export function getExtensionDirectory() {
  const index_path = new URL(import.meta.url).pathname;
  // Go up from lib/ to extension root
  const libPath = index_path.substring(0, index_path.lastIndexOf("/"));
  return libPath.substring(0, libPath.lastIndexOf("/"));
}

/**
 * Load the settings HTML template
 * @returns {Promise<string>} Settings HTML content
 */
export async function loadSettingsHtml() {
  const response = await fetch(`${getExtensionDirectory()}/settings.html`);
  const html = await response.text();
  return html;
}
