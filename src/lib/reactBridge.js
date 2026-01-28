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
} from "./settingsManager.js";
import { getEventSource, getEventTypes } from "../stContext.js";

// Track if React UI is loaded
let reactUILoaded = false;
let cleanupFn = null;
let viewportCleanupFn = null;

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
    console.warn(`[ReactBridge] Unknown callback: ${name}`);
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
 * @param {Object} reactState - State from React store (same format as getSettings())
 */
export function reactFormatToSettings(reactState) {
  const settings = getSettings();

  // Merge all properties from reactState into settings
  // This preserves the exact structure without transformation
  Object.assign(settings, reactState);

  saveSettings();
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
  console.log("[ReactBridge] initializeReactUI called, container:", container);
  console.log("[ReactBridge] window.LumiverseUI exists:", !!window.LumiverseUI);

  if (reactUILoaded) {
    console.warn("[ReactBridge] React UI already initialized");
    return true;
  }

  try {
    // In bundled mode, LumiverseUI should already be available
    if (!window.LumiverseUI) {
      console.error("[ReactBridge] LumiverseUI not available - bundle issue");
      return false;
    }

    console.log("[ReactBridge] LumiverseUI API:", window.LumiverseUI);
    console.log("[ReactBridge] mountSettingsPanel exists:", typeof window.LumiverseUI.mountSettingsPanel);

    // Provide initial settings to React
    const initialSettings = settingsToReactFormat();
    console.log("[ReactBridge] Initial settings prepared");

    // Expose the bridge API to React
    window.LumiverseBridge = {
      getSettings: settingsToReactFormat,
      saveSettings: reactFormatToSettings,
      getCallbacks,
      notifySettingsChange: notifyReactOfSettingsChange,
      clearClaudeCache: clearClaudeCache,
      resetAllSettings: resetAllSettings,
      // Called by packCache when pack data changes
      onPackCacheChange: () => {
        console.log("[ReactBridge] Pack cache changed, syncing to React...");
        notifyReactOfSettingsChange();
      },
    };
    console.log("[ReactBridge] Bridge API exposed on window.LumiverseBridge");

    // Mount the React settings panel
    if (container && window.LumiverseUI.mountSettingsPanel) {
      console.log("[ReactBridge] Calling mountSettingsPanel...");
      cleanupFn = window.LumiverseUI.mountSettingsPanel("lumiverse-react-root", initialSettings);
      console.log("[ReactBridge] mountSettingsPanel returned:", cleanupFn);
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
      console.log("[ReactBridge] Mounting viewport panel...");
      viewportCleanupFn = window.LumiverseUI.mountViewportPanel(initialSettings);
      console.log("[ReactBridge] Viewport panel mounted");
    }

    // Set up event sync
    setupEventSync();

    reactUILoaded = true;
    console.log("[ReactBridge] React UI initialized successfully");
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
  console.log("[ReactBridge] React UI destroyed");
}

/**
 * Check if React UI is available and loaded
 * @returns {boolean}
 */
export function isReactUIAvailable() {
  return reactUILoaded && !!window.LumiverseUI;
}
