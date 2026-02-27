/**
 * React Bridge Module
 * Handles integration between the React UI and the existing extension system.
 *
 * This module:
 * 1. Syncs state between React and the extension settings
 * 2. Exposes callbacks for React components to trigger extension actions
 *
 * NOTE: In the bundled architecture, React is included in the same bundle,
 * so window.LumiverseUI is available immediately - no dynamic loading needed.
 */

import {
  getSettings,
  saveSettings,
  MODULE_NAME,
  clearClaudeCache,
  resetAllSettings,
  getPacks,
  isUsingFileStorage,
  saveSelections,
  savePreferences,
  savePreferencesImmediate,
  setAllPresets,
  savePack,
  deletePack,
} from "./settingsManager.js";
import {
  getLoomPresetRegistry,
  getActiveLoomPresetId,
  getLoomBindings,
} from "./packCache.js";
import { applyTheme, removeThemeOverrides, getDefaultTheme } from "./themeManager.js";
import { getEventSource, getEventTypes, getRequestHeaders, triggerExtensionUpdate, getExtensionGitVersion } from "../stContext.js";

// Extension name discovery from import.meta.url per EXTENSION_GUIDE_UPDATES.md
// Structure: .../third-party/<folder_name>/src/lib/reactBridge.js
// We need to go back 4 levels from the filename to get the extension folder
const myUrl = import.meta.url;
const pathParts = myUrl.split('/');
const EXTENSION_FOLDER_NAME = pathParts[pathParts.length - 4] || 'SillyTavern-LumiverseHelper';

// Track if React UI is loaded
let reactUILoaded = false;
let cleanupFn = null;
let viewportCleanupFn = null;

// Flag to prevent re-sync loops when React is saving
let isSavingFromReact = false;

// Callbacks that React components can trigger
const extensionCallbacks = {
  // Pack management
  onPacksChanged: null,
  onSelectionChanged: null,

  // Modal triggers
  showSelectionModal: null,
  showLoomSelectionModal: null,
  showMiscFeaturesModal: null,
  showSummarizationModal: null,
  showPromptSettingsModal: null,
  showLumiaEditorModal: null,
  showLucidCardsModal: null,

  // Data operations
  fetchWorldBook: null,
  handleNewBook: null,

  // UI refresh
  refreshUIDisplay: null,

  // OOC comment processing
  refreshOOCComments: null,

  // Summary generation
  generateSummary: null,
};

/**
 * Register a callback from the main extension
 * @param {string} name - Callback name
 * @param {Function} fn - Callback function
 */
export function registerCallback(name, fn) {
  if (name in extensionCallbacks) {
    extensionCallbacks[name] = fn;
  } else {
  }
}

/**
 * Get all registered callbacks (for React components to use)
 * @returns {Object} Callbacks object
 */
export function getCallbacks() {
  return { ...extensionCallbacks };
}

/**
 * Convert extension settings to React store format
 *
 * IMPORTANT: This merges settings with packs from the cache (if using file storage).
 * The old code stores settings.packs as an OBJECT keyed by pack name.
 * React components must handle this format directly to maintain compatibility.
 *
 * @returns {Object} Settings with packs merged in
 */
export function settingsToReactFormat() {
  const settings = getSettings();

  // If using file storage, get packs from cache
  // Otherwise, packs are already in settings
  if (isUsingFileStorage()) {
    return {
      ...settings,
      packs: getPacks(),
      // Populate loomBuilder state from packCache
      loomBuilder: {
        activePresetId: getActiveLoomPresetId(),
        registry: getLoomPresetRegistry(),
        bindings: getLoomBindings(),
      },
    };
  }

  return settings;
}

/**
 * Apply React state changes back to extension settings
 *
 * IMPORTANT: React should be sending data in the EXACT same format as getSettings().
 * We simply merge the incoming state with the current settings.
 * 
 * When using file storage, selections, presets, and pack changes are handled specially
 * to ensure they're persisted to the appropriate files, not extension_settings.
 *
 * @param {Object} reactState - State from React store (same format as getSettings())
 * @param {boolean} immediate - If true, save preferences immediately (no debounce)
 */
export async function reactFormatToSettings(reactState, immediate = false) {
  // Set flag to prevent re-sync loops
  isSavingFromReact = true;
  
  try {
    const settings = getSettings();

    // If using file storage, handle pack changes
    if (isUsingFileStorage() && reactState.packs !== undefined) {
      await syncPackChangesToFileStorage(reactState.packs);
    }

    // If using file storage, handle presets separately
    if (isUsingFileStorage() && reactState.presets !== undefined) {
      // Update presets in file storage
      setAllPresets(reactState.presets);
    }

    // If using file storage, handle selections separately
    if (isUsingFileStorage()) {
      // Extract selection fields that need to be persisted to file storage
      const selections = {};
      const selectionFields = [
        'selectedDefinition',
        'selectedBehaviors',
        'selectedPersonalities',
        'dominantBehavior',
        'dominantPersonality',
        'selectedLoomStyle',
        'selectedLoomUtils',
        'selectedLoomRetrofits',
        'selectedDefinitions',
        'councilMembers',
      ];
      for (const field of selectionFields) {
        if (reactState[field] !== undefined) {
          selections[field] = reactState[field];
        }
      }
      if (Object.keys(selections).length > 0) {
        saveSelections(selections);
      }

      // Extract preference fields that need to be persisted to file storage
      const preferences = {};
      const preferenceFields = [
        'chimeraMode',
        'councilMode',
        'councilChatStyle',
        'councilTools',
        'lumiaQuirks',
        'lumiaQuirksEnabled',
        'lumiaOOCInterval',
        'lumiaOOCStyle',
        'activePresetName',
        'dismissedUpdateVersion',
        'theme',
        'enableChatSheld',
        'chatSheldDisplayMode',
        'chatSheldPageSize',
        'sidePortraitEnabled',
        'sidePortraitSide',
        'authorNotePanelSide',
        'guidedGenerations',
      ];
      for (const field of preferenceFields) {
        if (reactState[field] !== undefined) {
          preferences[field] = reactState[field];
        }
      }
      if (Object.keys(preferences).length > 0) {
        if (immediate) {
          await savePreferencesImmediate(preferences);
        } else {
          savePreferences(preferences);
        }
      }
    }

    // Merge all properties from reactState into settings
    // This preserves the exact structure without transformation
    Object.assign(settings, reactState);

    saveSettings();
  } finally {
    // Clear flag after a short delay to allow any pending notifications to be ignored
    setTimeout(() => {
      isSavingFromReact = false;
    }, 100);
  }
}

/**
 * Sync pack changes from React state to file storage.
 * Detects added/modified/deleted packs and persists appropriately.
 * 
 * @param {Object} reactPacks - Packs object from React state
 */
async function syncPackChangesToFileStorage(reactPacks) {
  const currentPacks = getPacks();
  const reactPackNames = new Set(Object.keys(reactPacks || {}));
  const currentPackNames = new Set(Object.keys(currentPacks || {}));

  // Find deleted packs (in current but not in react)
  for (const packName of currentPackNames) {
    if (!reactPackNames.has(packName)) {
      try {
        await deletePack(packName);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Failed to delete pack ${packName}:`, err);
      }
    }
  }

  // Find added/modified packs
  for (const [packName, reactPack] of Object.entries(reactPacks || {})) {
    const currentPack = currentPacks[packName];
    
    // Check if pack is new or modified
    // We do a simple JSON comparison to detect changes
    const isNew = !currentPack;
    const isModified = currentPack && JSON.stringify(reactPack) !== JSON.stringify(currentPack);
    
    if (isNew || isModified) {
      try {
        await savePack(reactPack);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Failed to save pack ${packName}:`, err);
      }
    }
  }
}

/**
 * Notify React UI of settings changes from the extension side
 */
export function notifyReactOfSettingsChange() {
  if (window.LumiverseUI?.syncSettings) {
    window.LumiverseUI.syncSettings(settingsToReactFormat());
  }
}

/**
 * Set up event listeners for syncing
 */
function setupEventSync() {
  const eventSource = getEventSource();
  const event_types = getEventTypes();

  if (eventSource && event_types?.CHAT_CHANGED) {
    // When chat changes, notify React
    eventSource.on(event_types.CHAT_CHANGED, () => {
      notifyReactOfSettingsChange();
    });
  }
}

/**
 * Initialize the React UI
 * In bundled mode, LumiverseUI is available immediately.
 * @param {HTMLElement} container - Container element to mount into
 * @returns {Promise<boolean>} Success status
 */
export async function initializeReactUI(container) {

  if (reactUILoaded) {
    return true;
  }

  try {
    // In bundled mode, LumiverseUI should already be available
    if (!window.LumiverseUI) {
      console.error("[ReactBridge] LumiverseUI not available - bundle issue");
      return false;
    }

    // Provide initial settings to React
    const initialSettings = settingsToReactFormat();

    // Apply saved theme before mounting UI to prevent flash of default colors.
    // When theme is null (first boot or legacy Default Purple), apply the
    // built-in Default Purple so we always have an explicit <style> element
    // that wins over any external CSS overrides.
    const bootTheme = initialSettings.theme || getDefaultTheme();
    applyTheme(bootTheme);

    // Expose the bridge API to React
    window.LumiverseBridge = {
      getSettings: settingsToReactFormat,
      saveSettings: reactFormatToSettings,
      getCallbacks,
      notifySettingsChange: notifyReactOfSettingsChange,
      clearClaudeCache: clearClaudeCache,
      resetAllSettings: resetAllSettings,
      getRequestHeaders: getRequestHeaders,
      // Extension update functions per EXTENSION_GUIDE_UPDATES.md
      triggerExtensionUpdate: (name) => triggerExtensionUpdate(name || EXTENSION_FOLDER_NAME),
      getExtensionGitVersion: (name) => getExtensionGitVersion(name || EXTENSION_FOLDER_NAME),
      // Expose detected extension name for React store
      extensionName: EXTENSION_FOLDER_NAME,
      // Push council tool results into React store for the Feedback panel
      setCouncilToolResults: (results) => {
        window.LumiverseUI?.getStore()?.setState({ councilToolResults: results || [] });
      },
      // Called by packCache when pack data changes
      onPackCacheChange: () => {
        // Skip if this change was triggered by React saving
        if (isSavingFromReact) {
          return;
        }
        notifyReactOfSettingsChange();
      },
    };

    // Mount the React settings panel
    if (container && window.LumiverseUI.mountSettingsPanel) {
      cleanupFn = window.LumiverseUI.mountSettingsPanel("lumiverse-react-root", initialSettings);
    } else {
      console.error(
        "[ReactBridge] Cannot mount: container=",
        container,
        "mountSettingsPanel=",
        window.LumiverseUI?.mountSettingsPanel,
      );
    }

    // Mount the viewport panel (sidebar with profile, browser, analytics)
    if (window.LumiverseUI.mountViewportPanel) {
      viewportCleanupFn = window.LumiverseUI.mountViewportPanel(initialSettings);
    }

    // Subscribe to theme changes from the React store for live updates
    if (window.LumiverseUI.subscribe) {
      let lastTheme = initialSettings.theme;
      window.LumiverseUI.subscribe(() => {
        const state = window.LumiverseUI.getState();
        if (state.theme !== lastTheme) {
          lastTheme = state.theme;
          // Always apply — null means Default Purple, never remove the style element
          applyTheme(state.theme || getDefaultTheme());
        }
      });
    }

    // Set up event sync
    setupEventSync();

    reactUILoaded = true;

    // Re-apply theme after all initialization is complete.
    // SillyTavern injects the extension CSS file (style.css via manifest "css" field)
    // AFTER the JS runs. The :root defaults in main.css override our theme <style>
    // element because the <link> tag is appended later in the cascade.
    // A double-rAF ensures the CSS file has been injected, then re-appending
    // our <style> moves it to the end of <head>, after all stylesheets.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyTheme(bootTheme);
      });
    });

    return true;
  } catch (error) {
    console.error("[ReactBridge] Failed to initialize React UI:", error);
    return false;
  }
}

/**
 * Cleanup and unmount React UI
 */
export function destroyReactUI() {
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }

  if (viewportCleanupFn) {
    viewportCleanupFn();
    viewportCleanupFn = null;
  }

  if (window.LumiverseUI && window.LumiverseUI.unmountAll) {
    window.LumiverseUI.unmountAll();
  }

  reactUILoaded = false;
}

/**
 * Check if React UI is available and loaded
 * @returns {boolean}
 */
export function isReactUIAvailable() {
  return reactUILoaded && !!window.LumiverseUI;
}
