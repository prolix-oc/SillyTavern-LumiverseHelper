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
 * Updated for SillyTavern 1.15 Macros 2.0 system.
 *
 * The new system:
 * - Uses ctx.macros.register(name, { handler, description, category })
 * - Handler receives namedArgs object with parameters
 * - Space-separated params like {{macro .param}} pass ".param" to handler
 *
 * @returns {Object|null} MacrosParser-compatible object with registerMacro method
 */
export function getMacrosParser() {
  const ctx = getContext();

  if (!ctx) {
    console.warn("[LumiverseHelper] Context not available for macro registration");
    return null;
  }

  // Log what's available for debugging
  console.log("[LumiverseHelper] Macro API detection:", {
    "ctx.macros": !!ctx.macros,
    "ctx.macros?.register": typeof ctx.macros?.register,
    "ctx.registerMacro": typeof ctx.registerMacro,
    "ctx.MacrosParser": !!ctx.MacrosParser,
  });

  // Try 1: Use the new macros.register API (Macros 2.0 - ST 1.15+)
  // This is the preferred method for the new macro system
  if (typeof ctx.macros?.register === "function") {
    console.log("[LumiverseHelper] Using ctx.macros.register (Macros 2.0 API)");
    return {
      registerMacro: (name, handlerOrValue, description = null) => {
        try {
          const handler = typeof handlerOrValue === "function"
            ? handlerOrValue
            : () => handlerOrValue;
          ctx.macros.register(name, {
            handler,
            description: description || `Lumiverse Helper macro: ${name}`,
            category: "Lumiverse Helper",
          });
          console.log(`[LumiverseHelper] Registered macro via macros.register: ${name}`);
        } catch (e) {
          console.error(`[LumiverseHelper] Failed to register macro ${name} via macros.register:`, e);
        }
      },
    };
  }

  // Try 2: Use ctx.registerMacro (documented extension API - may still work)
  if (typeof ctx.registerMacro === "function") {
    console.log("[LumiverseHelper] Using ctx.registerMacro (extension API)");
    return {
      registerMacro: (name, handlerOrValue) => {
        try {
          ctx.registerMacro(name, handlerOrValue);
          console.log(`[LumiverseHelper] Registered macro: ${name}`);
        } catch (e) {
          console.error(`[LumiverseHelper] Failed to register macro ${name}:`, e);
        }
      },
    };
  }

  // Try 3: Legacy MacrosParser (fallback for older ST versions)
  if (ctx.MacrosParser?.registerMacro) {
    console.log("[LumiverseHelper] Using ctx.MacrosParser (legacy fallback)");
    return {
      registerMacro: (name, handlerOrValue) => {
        try {
          ctx.MacrosParser.registerMacro(name, handlerOrValue);
          console.log(`[LumiverseHelper] Registered macro via MacrosParser: ${name}`);
        } catch (e) {
          console.error(`[LumiverseHelper] Failed to register macro ${name} via MacrosParser:`, e);
        }
      },
    };
  }

  console.warn("[LumiverseHelper] No macro registration API found");
  return null;
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
 * @returns {Object} Headers object for fetch requests
 */
export function getRequestHeaders() {
  const ctx = getContext();
  if (ctx?.getRequestHeaders) {
    return ctx.getRequestHeaders();
  }
  return {};
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

