/**
 * SillyTavern Context Accessor
 *
 * Provides safe access to ST APIs via the global SillyTavern object.
 * This centralizes all ST API access, replacing fragile relative imports.
 *
 * IMPORTANT: All ST API access must go through this module.
 * Do NOT use relative imports to ST internals (e.g., ../../../extensions.js)
 */

/**
 * Get the SillyTavern context object.
 * This provides access to chat, characters, and various utilities.
 * Note: We don't cache the context because it may be populated progressively
 * during ST initialization, and caching early could miss properties.
 * @returns {Object|null} ST context with all APIs, or null if not available
 */
export function getContext() {
  if (typeof SillyTavern !== "undefined" && SillyTavern.getContext) {
    return SillyTavern.getContext();
  }

  console.error("[LumiverseHelper] SillyTavern global not available");
  return null;
}

/**
 * Get the extension_settings object for storing extension data.
 * This is where persistent settings are stored.
 * @returns {Object} Extension settings object
 */
export function getExtensionSettings() {
  const ctx = getContext();
  return ctx?.extensionSettings || {};
}

/**
 * Get the saveSettingsDebounced function for persisting settings.
 * @returns {Function} Debounced save function
 */
export function getSaveSettingsDebounced() {
  const ctx = getContext();
  return ctx?.saveSettingsDebounced || (() => {});
}

/**
 * Get the eventSource for subscribing to ST events.
 * @returns {Object|null} EventEmitter-like object
 */
export function getEventSource() {
  const ctx = getContext();
  return ctx?.eventSource || null;
}

/**
 * Get the event_types enum for event names.
 * @returns {Object} Event types enum
 */
export function getEventTypes() {
  const ctx = getContext();
  return ctx?.eventTypes || {};
}

/**
 * Get the MacrosParser for registering custom macros.
 * Updated for SillyTavern 1.15+ Macros 2.0 system with full API compliance.
 *
 * Uses cascading fallback: tries new API first, falls back to legacy if it fails.
 * This ensures macros register successfully even if one API is buggy or unavailable.
 *
 * Macros 2.0 API properties:
 * - handler: Function executing the macro logic (required)
 * - category: Groups macro in docs/autocomplete (required)
 * - description: Explains macro functionality
 * - returns: Documents return value specifics
 * - returnType: Expected output type ('string', 'integer', 'number', 'boolean')
 * - exampleUsage: Usage examples (string or string[])
 * - aliases: Alternative names [{alias: string, visible?: boolean}]
 * - unnamedArgs: Positional argument definitions
 *
 * @returns {Object|null} MacrosParser-compatible object with registerMacro method
 */
export function getMacrosParser() {
  const ctx = getContext();

  if (!ctx) {
    console.warn("[LumiverseHelper] Context not available for macro registration");
    return null;
  }

  // Detect available APIs
  const hasNewMacrosAPI = typeof ctx.macros?.register === "function";
  const hasRegisterMacro = typeof ctx.registerMacro === "function";
  const hasLegacyParser = typeof ctx.MacrosParser?.registerMacro === "function";

  // Log what's available for debugging
  console.log("[LumiverseHelper] Macro API detection:", {
    "ctx.macros.register": hasNewMacrosAPI,
    "ctx.registerMacro": hasRegisterMacro,
    "ctx.MacrosParser": hasLegacyParser,
  });

  if (!hasNewMacrosAPI && !hasRegisterMacro && !hasLegacyParser) {
    console.warn("[LumiverseHelper] No macro registration API found");
    return null;
  }

  // Return a wrapper that tries each API in order until one succeeds
  // Accepts either legacy (name, handler, description) or new (name, options) signature
  return {
    /**
     * Register a macro with full Macros 2.0 support
     * @param {string} name - Macro name (without braces)
     * @param {Function|Object} handlerOrOptions - Handler function OR options object
     * @param {string} [legacyDescription] - Description (legacy signature only)
     *
     * Options object can include:
     * - handler: Function (required)
     * - description: string
     * - returns: string (documents return value)
     * - returnType: 'string' | 'integer' | 'number' | 'boolean'
     * - exampleUsage: string | string[]
     * - aliases: Array<{alias: string, visible?: boolean}>
     * - unnamedArgs: number | Array<{name, optional?, defaultValue?, type?, description?}>
     */
    registerMacro: (name, handlerOrOptions, legacyDescription = null) => {
      let options;

      // Detect if using new options object or legacy (handler, description) signature
      if (typeof handlerOrOptions === "function") {
        // Legacy signature: (name, handler, description)
        options = {
          handler: handlerOrOptions,
          description: legacyDescription || `Lumiverse Helper macro: ${name}`,
        };
      } else if (typeof handlerOrOptions === "object" && handlerOrOptions !== null) {
        // New signature: (name, options)
        options = {
          ...handlerOrOptions,
          description: handlerOrOptions.description || `Lumiverse Helper macro: ${name}`,
        };
      } else {
        // Static value
        options = {
          handler: () => handlerOrOptions,
          description: legacyDescription || `Lumiverse Helper macro: ${name}`,
        };
      }

      // Ensure handler exists
      const handler = options.handler;
      if (typeof handler !== "function") {
        console.error(`[LumiverseHelper] Invalid handler for macro ${name}`);
        return;
      }

      // Try 1: New Macros 2.0 API (ST 1.15+)
      if (hasNewMacrosAPI) {
        try {
          // Build full Macros 2.0 options object
          const macros2Options = {
            handler,
            category: "Lumiverse Helper",
            description: options.description,
          };

          // Add optional Macros 2.0 properties if provided
          if (options.returns) macros2Options.returns = options.returns;
          if (options.returnType) macros2Options.returnType = options.returnType;
          if (options.exampleUsage) macros2Options.exampleUsage = options.exampleUsage;
          if (options.aliases) macros2Options.aliases = options.aliases;
          if (options.unnamedArgs !== undefined) macros2Options.unnamedArgs = options.unnamedArgs;
          if (options.delayArgResolution !== undefined) macros2Options.delayArgResolution = options.delayArgResolution;

          ctx.macros.register(name, macros2Options);
          console.log(`[LumiverseHelper] Registered macro via macros.register: ${name}`);
          return; // Success - don't try other methods
        } catch (e) {
          console.warn(`[LumiverseHelper] macros.register failed for ${name}, trying fallback:`, e.message);
        }
      }

      // Try 2: Extension API (ctx.registerMacro)
      if (hasRegisterMacro) {
        try {
          ctx.registerMacro(name, handler);
          console.log(`[LumiverseHelper] Registered macro via registerMacro: ${name}`);
          return; // Success
        } catch (e) {
          console.warn(`[LumiverseHelper] registerMacro failed for ${name}, trying fallback:`, e.message);
        }
      }

      // Try 3: Legacy MacrosParser
      if (hasLegacyParser) {
        try {
          ctx.MacrosParser.registerMacro(name, handler);
          console.log(`[LumiverseHelper] Registered macro via MacrosParser: ${name}`);
          return; // Success
        } catch (e) {
          console.error(`[LumiverseHelper] All macro registration methods failed for ${name}:`, e.message);
        }
      }

      console.error(`[LumiverseHelper] Could not register macro ${name} - all methods exhausted`);
    },
  };
}

/**
 * Get the SlashCommandParser for registering slash commands.
 * ST may expose this differently depending on version.
 * @returns {Object|null} SlashCommandParser instance
 */
export function getSlashCommandParser() {
  const ctx = getContext();

  // Try context first
  if (ctx?.SlashCommandParser) {
    return ctx.SlashCommandParser;
  }

  // Try SillyTavern namespace
  if (typeof SillyTavern !== "undefined" && SillyTavern.SlashCommandParser) {
    return SillyTavern.SlashCommandParser;
  }

  // Try globalThis
  if (typeof globalThis.SlashCommandParser !== "undefined") {
    return globalThis.SlashCommandParser;
  }

  console.warn("[LumiverseHelper] SlashCommandParser not available");
  return null;
}

/**
 * Get the SlashCommand class for creating commands.
 * ST may expose this differently depending on version.
 * @returns {Function|null} SlashCommand constructor
 */
export function getSlashCommand() {
  const ctx = getContext();

  // Try context first
  if (ctx?.SlashCommand) {
    return ctx.SlashCommand;
  }

  // Try SillyTavern namespace
  if (typeof SillyTavern !== "undefined" && SillyTavern.SlashCommand) {
    return SillyTavern.SlashCommand;
  }

  // Try globalThis
  if (typeof globalThis.SlashCommand !== "undefined") {
    return globalThis.SlashCommand;
  }

  console.warn("[LumiverseHelper] SlashCommand not available");
  return null;
}

/**
 * Get request headers for API calls.
 * Required for authenticated ST backend API calls.
 * @returns {Object} Headers object for fetch requests
 */
export function getRequestHeaders() {
  const ctx = getContext();
  if (ctx?.getRequestHeaders) {
    return ctx.getRequestHeaders();
  }
  // Fallback with Content-Type for JSON requests
  return { 'Content-Type': 'application/json' };
}

/**
 * Trigger an update for the extension via ST backend API.
 * Per EXTENSION_GUIDE_UPDATES.md - uses /api/extensions/update endpoint.
 * @param {string} extensionName - Folder name of the extension
 * @returns {Promise<{success: boolean, message: string, isUpToDate?: boolean, shortCommitHash?: string}>}
 */
export async function triggerExtensionUpdate(extensionName) {
  try {
    // Backend expects just the folder name without "third-party/" prefix
    const cleanName = extensionName.replace(/^third-party\//, '').replace(/^\//, '');

    const response = await fetch('/api/extensions/update', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        extensionName: cleanName,
        global: false,
      }),
    });

    if (!response.ok) {
      console.error(`[LumiverseHelper] Update failed: ${response.statusText}`);
      return { success: false, message: `Update failed: ${response.statusText}` };
    }

    const data = await response.json();

    if (data.isUpToDate) {
      console.log(`[LumiverseHelper] Extension '${cleanName}' is already up to date.`);
      return { success: false, message: 'Already up to date', isUpToDate: true };
    } else {
      console.log(`[LumiverseHelper] Extension '${cleanName}' updated successfully to ${data.shortCommitHash}.`);
      return { 
        success: true, 
        message: `Updated to ${data.shortCommitHash}. Reload to apply changes.`,
        shortCommitHash: data.shortCommitHash,
      };
    }
  } catch (error) {
    console.error('[LumiverseHelper] Error triggering extension update:', error);
    return { success: false, message: `Error: ${error.message}` };
  }
}

/**
 * Get the current Git version details of the extension.
 * Per EXTENSION_GUIDE_UPDATES.md - uses /api/extensions/version endpoint.
 * @param {string} extensionName - Folder name of the extension
 * @returns {Promise<{currentBranchName: string, currentCommitHash: string, remoteUrl: string, isUpToDate: boolean}|null>}
 */
export async function getExtensionGitVersion(extensionName) {
  try {
    const cleanName = extensionName.replace(/^third-party\//, '').replace(/^\//, '');

    const response = await fetch('/api/extensions/version', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        extensionName: cleanName,
        global: false,
      }),
    });

    if (!response.ok) return null;

    return await response.json();
  } catch (error) {
    console.error('[LumiverseHelper] Failed to get git version:', error);
    return null;
  }
}

/**
 * Get the semantic version from manifest.json.
 * Per EXTENSION_GUIDE_UPDATES.md - resolves manifest.json relative to the current script
 * using import.meta.url. This works regardless of folder renaming or third-party prefix.
 * @param {string} [extensionName] - Optional folder name (unused, kept for compatibility)
 * @returns {Promise<string|null>} The version string (e.g., "4.0.4") or null
 */
export async function getExtensionManifestVersion(extensionName) {
  try {
    // Resolve manifest.json relative to the current script
    // Works regardless of "third-party/" prefix or folder renaming
    const manifestUrl = new URL('../manifest.json', import.meta.url).href;

    // Add cache-busting to ensure we get the latest version after updates
    const cacheBuster = `?t=${Date.now()}`;
    const response = await fetch(manifestUrl + cacheBuster, { cache: 'no-store' });
    if (!response.ok) {
      // Fallback: try the old path-based approach for compatibility
      if (extensionName) {
        const fallbackResult = await getExtensionManifestVersionLegacy(extensionName);
        return fallbackResult;
      }
      return null;
    }

    const manifest = await response.json();
    return manifest.version || null;
  } catch (error) {
    console.error('[LumiverseHelper] Failed to load manifest:', error);
    // Fallback: try the old path-based approach
    if (extensionName) {
      return await getExtensionManifestVersionLegacy(extensionName);
    }
    return null;
  }
}

/**
 * Legacy fallback for getting manifest version from ST server paths.
 * @param {string} extensionName - Folder name of the extension
 * @returns {Promise<string|null>} The version string or null
 */
async function getExtensionManifestVersionLegacy(extensionName) {
  const tryFetch = async (path) => {
    try {
      const response = await fetch(path);
      if (response.ok) return await response.json();
    } catch (e) {
      // ignore fetch errors
    }
    return null;
  };

  let manifest = await tryFetch(`/scripts/extensions/${extensionName}/manifest.json`);
  if (!manifest) {
    manifest = await tryFetch(`/scripts/extensions/third-party/${extensionName}/manifest.json`);
  }

  return manifest ? (manifest.version || null) : null;
}

/**
 * Get the generateRaw function for direct LLM calls.
 * @returns {Function|null} generateRaw function
 */
export function getGenerateRaw() {
  const ctx = getContext();
  return ctx?.generateRaw || null;
}

/**
 * Get the generateQuietPrompt function for background LLM calls.
 * @returns {Function|null} generateQuietPrompt function
 */
export function getGenerateQuietPrompt() {
  const ctx = getContext();
  return ctx?.generateQuietPrompt || null;
}

/**
 * Get chat metadata for storing per-chat data.
 * @returns {Object} Chat metadata object
 */
export function getChatMetadata() {
  const ctx = getContext();
  return ctx?.chatMetadata || {};
}

/**
 * Get the current character data.
 * @returns {Object|null} Character object
 */
export function getCurrentCharacter() {
  const ctx = getContext();
  return ctx?.characters?.[ctx?.characterId] || null;
}

/**
 * Get the current chat array.
 * @returns {Array} Array of chat messages
 */
export function getChat() {
  const ctx = getContext();
  return ctx?.chat || [];
}

