/**
 * Lumiverse Helper Extension - Main Entry Point (Bundled Version)
 *
 * This file handles SillyTavern initialization and registration.
 * All ST API access goes through stContext.js for stability.
 * React UI is bundled together - no dynamic loading needed.
 */

// Import ST APIs from centralized accessor
import {
  getContext,
  getEventSource,
  getEventTypes,
  getMacrosParser,
  getSlashCommand,
  getSlashCommandParser,
} from "./stContext.js";

// Import DOM utilities
import { query, queryAll } from "./sthelpers/domUtils.js";

// Import lib modules
import {
  MODULE_NAME,
  getSettings,
  loadSettings,
  initPackFileStorage,
  resetRandomLumia,
} from "./lib/settingsManager.js";

import { handleNewBook, fetchWorldBook, importPack } from "./lib/dataProcessor.js";

import {
  showSelectionModal,
  showMiscFeaturesModal,
  showLoomSelectionModal,
  showSummarizationModal,
  showPromptSettingsModal,
  showLucidCardsModal,
  refreshUIDisplay,
  setRefreshUICallback,
  setProcessAllLumiaOOCCommentsRef,
  updateLoomSummaryButtonState,
} from "./lib/uiModals.js";

import {
  generateLoomSummary,
  checkAutoSummarization,
  restoreSummaryMarkers,
} from "./lib/summarization.js";

import { registerLumiaMacros, getOOCTriggerText, setLastAIMessageIndex } from "./lib/lumiaContent.js";

import {
  processLoomConditionals,
  captureLoomSummary,
  hideLoomSumBlocks,
  registerLoomMacros,
  setLastUserMessageContent,
  setCapturedUserMessageFlag,
} from "./lib/loomSystem.js";

import {
  processLumiaOOCComments,
  processAllLumiaOOCComments,
  processAllOOCCommentsSynchronous,
  scheduleOOCProcessingAfterRender,
  unhideAndProcessOOCMarkers,
  setupLumiaOOCObserver,
  setIsGenerating,
  initializeRAFBatchRenderer,
  flushPendingUpdates,
  clearProcessedTexts,
  resetRAFState,
} from "./lib/oocComments.js";

import {
  showLumiaEditorModal,
  setEditorRefreshUICallback,
} from "./lib/lumiaEditor.js";

import {
  initializeReactUI,
  registerCallback as registerReactCallback,
  notifyReactOfSettingsChange,
} from "./lib/reactBridge.js";

import { initPresetBindingService } from "./lib/presetBindingService.js";

// Import React UI - this bundles it together and exposes window.LumiverseUI
import "./react-ui/index.jsx";

// --- CACHED REGEX OBJECTS (Performance optimization) ---
// Pre-compile regex objects once at module load to avoid recreation on every function call

const CACHED_HTML_TAG_REGEXES = {};
const CACHED_LOOM_TAG_REGEXES = {};

// Maximum iterations for recursive tag stripping to prevent unbounded loops
const MAX_RECURSIVE_ITERATIONS = 20;

(function initCachedRegexes() {
  // HTML tags to strip (excluding div which has special handling)
  const htmlTags = ["span", "b", "i", "u", "em", "strong", "s", "strike", "sub", "sup", "mark", "small", "big"];
  for (const tag of htmlTags) {
    CACHED_HTML_TAG_REGEXES[tag] = {
      open: new RegExp(`<${tag}(?:\\s[^>]*)?>`, "gi"),
      close: new RegExp(`</${tag}>`, "gi"),
    };
  }

  // Loom-related tags to strip
  const loomTags = [
    "loom_sum", "loom_if", "loom_else", "loom_endif",
    "lumia_ooc", "lumiaooc", "lumio_ooc", "lumioooc",
    "loom_state", "loom_memory", "loom_context", "loom_inject", "loom_var", "loom_set", "loom_get",
    "loom_record", "loomrecord", "loom_ledger", "loomledger",
  ];
  for (const tag of loomTags) {
    CACHED_LOOM_TAG_REGEXES[tag] = {
      paired: new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi"),
      self: new RegExp(`<${tag}(?:\\s[^>]*)?\\/?>`, "gi"),
    };
  }
})();

// --- CONTEXT FILTER FUNCTIONS ---

/**
 * Strip common HTML formatting tags from content, preserving the text inside
 * Uses cached regex objects to avoid recreation on every call
 */
function stripHtmlTags(content) {
  if (!content) return content;

  let result = content;
  result = handleDivFiltering(result);

  // Use cached regexes - reset lastIndex before each use for global regexes
  for (const tag of Object.keys(CACHED_HTML_TAG_REGEXES)) {
    const regexes = CACHED_HTML_TAG_REGEXES[tag];
    regexes.open.lastIndex = 0;
    regexes.close.lastIndex = 0;
    result = result.replace(regexes.open, "");
    result = result.replace(regexes.close, "");
  }

  return result;
}

/**
 * Handle div filtering with special logic for codeblock containers
 * Limited to MAX_RECURSIVE_ITERATIONS to prevent unbounded loops
 */
function handleDivFiltering(content) {
  if (!content) return content;

  let result = content;
  let prevResult;
  let iterations = 0;

  do {
    if (++iterations > MAX_RECURSIVE_ITERATIONS) break;
    prevResult = result;
    result = result.replace(
      /<div[^>]*style\s*=\s*["'][^"']*display\s*:\s*none[^"']*["'][^>]*>(\s*```[\s\S]*?```\s*)<\/div>/gi,
      "$1",
    );
    result = result.replace(/<div(?:\s[^>]*)?>([\s\S]*?)<\/div>/gi, "");
  } while (result !== prevResult);

  result = result.replace(/<\/div>/gi, "");
  return result;
}

/**
 * Strip <font> tags from content, preserving the text inside
 */
function stripFontTags(content) {
  if (!content) return content;
  let result = content;
  result = result.replace(/<font(?:\s[^>]*)?>/gi, "");
  result = result.replace(/<\/font>/gi, "");
  return result;
}

/**
 * Remove <details> blocks from content entirely
 * Limited to MAX_RECURSIVE_ITERATIONS to prevent unbounded loops
 */
function stripDetailsBlocks(content) {
  if (!content) return content;

  let result = content;
  let prevResult;
  let iterations = 0;

  do {
    if (++iterations > MAX_RECURSIVE_ITERATIONS) break;
    prevResult = result;
    result = result.replace(/<details(?:\s[^>]*)?>([\s\S]*?)<\/details>/gi, "");
  } while (result !== prevResult);

  return result;
}

/**
 * Remove Loom-related tags from content
 * Uses cached regex objects to avoid recreation on every call
 */
function stripLoomTags(content) {
  if (!content) return content;

  let result = content;

  // Use cached regexes - reset lastIndex before each use for global regexes
  for (const tag of Object.keys(CACHED_LOOM_TAG_REGEXES)) {
    const regexes = CACHED_LOOM_TAG_REGEXES[tag];
    regexes.paired.lastIndex = 0;
    regexes.self.lastIndex = 0;
    result = result.replace(regexes.paired, "");
    result = result.replace(regexes.self, "");
  }

  return result;
}

/**
 * Trim excessive newlines that may result from empty macro replacements.
 * Reduces 3+ consecutive newlines to 2 (standard paragraph break).
 * Also handles patterns where an empty macro was on its own line.
 * @param {string} content - The content to clean
 * @returns {string} - Content with trimmed newlines
 */
function trimEmptyMacroNewlines(content) {
  if (!content || typeof content !== "string") return content;

  // Replace 3+ consecutive newlines with 2 (standard paragraph break)
  // This handles cases where an empty macro was on its own line
  let result = content.replace(/\n{3,}/g, "\n\n");

  // Also handle cases with whitespace-only lines between real content
  // Pattern: newline, optional whitespace, newline, optional whitespace, newline
  result = result.replace(/\n[ \t]*\n[ \t]*\n/g, "\n\n");

  return result;
}

// --- GENERATION INTERCEPTOR ---
// CRITICAL: Must be exposed on globalThis for ST to find it via manifest.json
globalThis.lumiverseHelperGenInterceptor = async function (chat, contextSize, abort, type) {
  console.log(`[${MODULE_NAME}] Generation interceptor called with type: ${type}`);

  // Reset random Lumia on every generation type
  resetRandomLumia();

  const settings = getSettings();
  const sovereignHandEnabled = settings.sovereignHand?.enabled || false;
  const contextFilters = settings.contextFilters || {};
  const messageTruncation = settings.messageTruncation || {};

  // Message Truncation: Keep only the last N messages
  if (messageTruncation.enabled && messageTruncation.keepCount > 0) {
    const keepCount = messageTruncation.keepCount;
    if (chat.length > keepCount) {
      const removedCount = chat.length - keepCount;
      chat.splice(0, removedCount);
      console.log(`[${MODULE_NAME}] Message Truncation: Removed ${removedCount} older messages, keeping last ${keepCount}`);
    }
  }

  // Sovereign Hand: Capture and optionally exclude last user message
  const excludeLastMessage = settings.sovereignHand?.excludeLastMessage !== false;
  if (sovereignHandEnabled) {
    let lastUserIndex = -1;
    for (let i = chat.length - 1; i >= 0; i--) {
      if (chat[i] && chat[i].is_user) {
        lastUserIndex = i;
        break;
      }
    }

    if (lastUserIndex !== -1) {
      const lastUserMsg = chat[lastUserIndex];
      const messageContent = lastUserMsg.mes || lastUserMsg.content || "";

      setLastUserMessageContent(messageContent);
      setCapturedUserMessageFlag(true);
      console.log(`[${MODULE_NAME}] Sovereign Hand: Captured last user message at index ${lastUserIndex}`);

      if (excludeLastMessage) {
        chat.splice(lastUserIndex, 1);
        console.log(`[${MODULE_NAME}] Sovereign Hand: Removed last user message from context array`);
      }
    } else {
      setLastUserMessageContent("");
      setCapturedUserMessageFlag(false);
      console.log(`[${MODULE_NAME}] Sovereign Hand: No user message found (continuation mode)`);
    }
  } else {
    setLastUserMessageContent("");
    setCapturedUserMessageFlag(false);
  }

  // Calculate "keep depth" thresholds
  const htmlKeepDepth = contextFilters.htmlTags?.keepDepth ?? 3;
  const detailsKeepDepth = contextFilters.detailsBlocks?.keepDepth ?? 3;
  const loomKeepDepth = contextFilters.loomItems?.keepDepth ?? 5;
  const fontKeepDepth = contextFilters.htmlTags?.fontKeepDepth ?? 3;

  const htmlFilterEnabled = contextFilters.htmlTags?.enabled || false;
  const fontFilterEnabled = contextFilters.htmlTags?.stripFonts || false;
  const detailsFilterEnabled = contextFilters.detailsBlocks?.enabled || false;
  const loomFilterEnabled = contextFilters.loomItems?.enabled || false;
  const anyFilterEnabled = htmlFilterEnabled || fontFilterEnabled || detailsFilterEnabled || loomFilterEnabled;

  // Process loomIf conditionals and apply content filters
  for (let i = 0; i < chat.length; i++) {
    const depthFromEnd = chat.length - 1 - i;

    const filterContent = (content) => {
      if (!content || typeof content !== "string") return content;
      let result = content;

      if (htmlFilterEnabled && depthFromEnd >= htmlKeepDepth) {
        result = stripHtmlTags(result);
      }
      if (htmlFilterEnabled && fontFilterEnabled && depthFromEnd >= fontKeepDepth) {
        result = stripFontTags(result);
      }
      if (detailsFilterEnabled && depthFromEnd >= detailsKeepDepth) {
        result = stripDetailsBlocks(result);
      }
      if (loomFilterEnabled && depthFromEnd >= loomKeepDepth) {
        result = stripLoomTags(result);
      }

      return result;
    };

    if (chat[i] && typeof chat[i].content === "string") {
      chat[i].content = processLoomConditionals(chat[i].content);
      if (anyFilterEnabled) {
        chat[i].content = filterContent(chat[i].content);
      }
      // Clean up excessive newlines from empty macro replacements
      chat[i].content = trimEmptyMacroNewlines(chat[i].content);
    }

    if (chat[i] && typeof chat[i].mes === "string") {
      chat[i].mes = processLoomConditionals(chat[i].mes);
      if (anyFilterEnabled) {
        chat[i].mes = filterContent(chat[i].mes);
      }
      // Clean up excessive newlines from empty macro replacements
      chat[i].mes = trimEmptyMacroNewlines(chat[i].mes);
    }
  }

  return { chat, contextSize, abort };
};

// --- MACRO REGISTRATION ---
// Register macros when MacrosParser is available (Macros 2.0 format)
function registerAllMacros() {
  const MacrosParser = getMacrosParser();
  if (!MacrosParser) {
    console.warn(`[${MODULE_NAME}] MacrosParser not available - macros will not be registered`);
    return;
  }

  registerLumiaMacros(MacrosParser);
  registerLoomMacros(MacrosParser);

  // Message count macro - returns simple count, no resolution needed
  MacrosParser.registerMacro("lumiaMessageCount", {
    handler: () => {
      const stContext = getContext();
      if (!stContext || !stContext.chat) return "0";
      return stContext.chat.length.toString();
    },
    description: "Returns the current chat message count.",
    returns: "Number of messages as a string",
    returnType: "integer",
    exampleUsage: ["{{lumiaMessageCount}}"],
  });

  // OOC trigger countdown/trigger macro
  // Uses shared function from lumiaContent.js to avoid code duplication
  MacrosParser.registerMacro("lumiaOOCTrigger", {
    handler: () => {
      return getOOCTriggerText();
    },
    description: "Returns OOC trigger countdown or activation message based on message count and interval setting.",
    returns: "Countdown text or 'OOC Commentary Time!' activation message",
    returnType: "string",
    exampleUsage: ["{{lumiaOOCTrigger}}"],
  });

  console.log(`[${MODULE_NAME}] Macros registered successfully (Macros 2.0 format)`);
}

// --- INITIALIZATION ---
jQuery(async () => {
  console.log(`[${MODULE_NAME}] jQuery initialization starting...`);
  console.log(`[${MODULE_NAME}] window.LumiverseUI available:`, !!window.LumiverseUI);

  // Get ST APIs
  const eventSource = getEventSource();
  const event_types = getEventTypes();

  if (!eventSource || !event_types) {
    console.error(`[${MODULE_NAME}] ST APIs not available - extension may not work correctly`);
  }

  // Load settings from extension_settings
  loadSettings();

  // Initialize file storage for packs (migrates on first run)
  // IMPORTANT: Must await this before initializing React UI so that selections
  // from file storage are loaded into settings before React reads them
  try {
    const usingFileStorage = await initPackFileStorage();
    if (usingFileStorage) {
      console.log(`[${MODULE_NAME}] Pack file storage initialized`);
    }
  } catch (err) {
    console.error(`[${MODULE_NAME}] Failed to initialize pack file storage:`, err);
  }

  // Register macros
  registerAllMacros();

  // Initialize RAF batch renderer for optimized OOC rendering
  initializeRAFBatchRenderer();

  // Initialize preset binding service for auto-switching
  initPresetBindingService();

  // Set up UI refresh callback for modals
  setRefreshUICallback(refreshUIDisplay);

  // Set up OOC processing reference for modals
  setProcessAllLumiaOOCCommentsRef(processAllLumiaOOCComments);

  // Set up editor refresh callback
  setEditorRefreshUICallback(refreshUIDisplay);

  // --- REACT UI INITIALIZATION ---
  // Register callbacks that React components can trigger
  registerReactCallback("showSelectionModal", showSelectionModal);
  registerReactCallback("showLoomSelectionModal", showLoomSelectionModal);
  registerReactCallback("showMiscFeaturesModal", showMiscFeaturesModal);
  registerReactCallback("showSummarizationModal", showSummarizationModal);
  registerReactCallback("showPromptSettingsModal", showPromptSettingsModal);
  registerReactCallback("showLumiaEditorModal", showLumiaEditorModal);
  registerReactCallback("showLucidCardsModal", showLucidCardsModal);
  registerReactCallback("fetchWorldBook", () => {
    const url = jQuery("#lumia-url-input-react").val() || jQuery("#lumia-url-input").val();
    fetchWorldBook(url).then(() => {
      refreshUIDisplay();
      notifyReactOfSettingsChange();
    });
  });
  registerReactCallback("handleNewBook", (data, filename) => {
    // Use importPack which handles both native Lumiverse format and World Book format
    importPack(data, filename, false);
    refreshUIDisplay();
    notifyReactOfSettingsChange();
  });
  registerReactCallback("refreshUIDisplay", () => {
    refreshUIDisplay();
    notifyReactOfSettingsChange();
  });
  registerReactCallback("refreshOOCComments", (clearExisting = true) => {
    if (clearExisting) {
      // Style change - use synchronous processing to prevent race conditions
      processAllOOCCommentsSynchronous();
    } else {
      // Normal refresh - use RAF batching
      processAllLumiaOOCComments(clearExisting);
    }
  });
  registerReactCallback("generateSummary", async () => {
    // Generate summary with manual trigger and visual feedback
    return await generateLoomSummary(null, true, true);
  });

  // Initialize React UI (bundled together, should be available immediately)
  console.log(`[${MODULE_NAME}] About to initialize React UI...`);
  const reactContainer = document.getElementById("extensions_settings");
  console.log(`[${MODULE_NAME}] extensions_settings container:`, reactContainer);

  if (reactContainer) {
    const reactInitialized = await initializeReactUI(reactContainer);
    if (reactInitialized) {
      console.log(`[${MODULE_NAME}] React UI initialized successfully`);
    } else {
      console.error(`[${MODULE_NAME}] React UI failed to initialize - check console for errors`);
    }
  }

  // Initial UI refresh
  refreshUIDisplay();

  // --- UI EVENT LISTENERS (Legacy jQuery for compatibility) ---
  jQuery("#lumia-fetch-btn").on("click", () => {
    const url = jQuery("#lumia-url-input").val();
    fetchWorldBook(url).then(() => {
      refreshUIDisplay();
      notifyReactOfSettingsChange();
    });
  });

  jQuery("#lumia-open-definitions-btn").on("click", () => showSelectionModal("definition"));
  jQuery("#lumia-open-behaviors-btn").on("click", () => showSelectionModal("behavior"));
  jQuery("#lumia-open-personalities-btn").on("click", () => showSelectionModal("personality"));
  jQuery("#lumia-open-misc-btn").on("click", () => showMiscFeaturesModal());
  jQuery("#lumia-open-summarization-btn").on("click", () => showSummarizationModal());
  jQuery("#lumia-open-prompt-settings-btn").on("click", () => showPromptSettingsModal());
  jQuery("#loom-open-style-btn").on("click", () => showLoomSelectionModal("Narrative Style"));
  jQuery("#loom-open-utils-btn").on("click", () => showLoomSelectionModal("Loom Utilities"));
  jQuery("#loom-open-retrofits-btn").on("click", () => showLoomSelectionModal("Retrofits"));
  jQuery("#lumia-browse-lucid-btn").on("click", () => showLucidCardsModal());
  jQuery("#lumia-create-lumia-btn").on("click", () => showLumiaEditorModal());

  jQuery("#lumia-upload-btn").on("click", () => jQuery("#lumia-file-input").trigger("click"));
  jQuery("#lumia-file-input").on("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        // Use importPack which handles both native Lumiverse format and World Book format
        importPack(data, file.name, false);
        refreshUIDisplay();
        notifyReactOfSettingsChange();
      } catch (error) {
        console.error("Lumia Injector Error:", error);
        toastr.error("Failed to parse: " + error.message);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  });

  // --- SILLYTAVERN EVENT HANDLERS ---
  if (eventSource && event_types) {
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mesId) => {
      console.log(`[${MODULE_NAME}] CHARACTER_MESSAGE_RENDERED event for mesId ${mesId}`);
      setIsGenerating(false);
      captureLoomSummary();
      checkAutoSummarization();

      // Track the AI message index for swipe/regenerate detection
      // This helps getOOCTriggerText() calculate consistent triggers across swipes
      const context = getContext();
      if (context?.chat) {
        setLastAIMessageIndex(context.chat.length - 1);
        console.log(`[${MODULE_NAME}] Tracked last AI message at index ${context.chat.length - 1}`);
      }

      const messageElement = query(`div[mesid="${mesId}"] .mes_text`);
      if (messageElement) {
        hideLoomSumBlocks(messageElement);
        unhideAndProcessOOCMarkers(messageElement);

        // Check for OOC tags in raw content - ONLY tag-based detection
        // Legacy font-based detection has been removed
        const chatMessage = context?.chat?.[mesId];
        const rawContent = chatMessage?.mes || chatMessage?.content || "";
        const hasOOCTags = /<lumi[ao]_?ooc[^>]*>/i.test(rawContent);

        if (hasOOCTags) {
          console.log(`[${MODULE_NAME}] Found OOC tags in raw content, scheduling OOC processing for message ${mesId}`);
          processLumiaOOCComments(mesId);
        }
      }
    });

    eventSource.on(event_types.MESSAGE_EDITED, (mesId) => {
      console.log(`[${MODULE_NAME}] MESSAGE_EDITED event for mesId ${mesId}`);
      // Clear cached user message to prevent stale data on regenerate
      setLastUserMessageContent("");
      setCapturedUserMessageFlag(false);
      // Clear tracked texts to avoid stuck states
      clearProcessedTexts(mesId);
      const messageElement = query(`div[mesid="${mesId}"] .mes_text`);
      if (messageElement) {
        const existingBoxes = queryAll("[data-lumia-ooc]", messageElement);
        existingBoxes.forEach((box) => box.remove());
      }
      // Force reprocess since content may have changed
      processLumiaOOCComments(mesId, true);
    });

    eventSource.on(event_types.MESSAGE_SWIPED, (mesId) => {
      console.log(`[${MODULE_NAME}] MESSAGE_SWIPED event for mesId ${mesId}`);
      // Clear cached user message to prevent stale data on regenerate
      setLastUserMessageContent("");
      setCapturedUserMessageFlag(false);
      // Clear tracked texts and force reprocess for the new swipe
      clearProcessedTexts(mesId);
      const messageElement = query(`div[mesid="${mesId}"] .mes_text`);
      if (messageElement) {
        const existingBoxes = queryAll("[data-lumia-ooc]", messageElement);
        existingBoxes.forEach((box) => box.remove());
      }
      processLumiaOOCComments(mesId, true);
    });

    eventSource.on(event_types.CHAT_CHANGED, () => {
      console.log(`[${MODULE_NAME}] CHAT_CHANGED event - resetting state and scheduling OOC reprocessing`);
      // Clear cached user message state for fresh start
      setLastUserMessageContent("");
      setCapturedUserMessageFlag(false);
      // Reset RAF state for fresh processing on new chat
      resetRAFState();
      // Reset AI message tracking for swipe/regen detection
      setLastAIMessageIndex(-1);
      captureLoomSummary();
      scheduleOOCProcessingAfterRender();
      requestAnimationFrame(() => {
        restoreSummaryMarkers();
        updateLoomSummaryButtonState();
      });
    });

    eventSource.on(event_types.GENERATION_STARTED, () => {
      console.log(`[${MODULE_NAME}] GENERATION_STARTED - disabling OOC observer processing`);
      setIsGenerating(true);
    });

    eventSource.on(event_types.GENERATION_ENDED, () => {
      console.log(`[${MODULE_NAME}] GENERATION_ENDED (error case) - resetting state`);
      // setIsGenerating(false) triggers setStreamingState(false) which auto-flushes pending updates
      // No need for explicit flushPendingUpdates() call - avoid double flush
      setIsGenerating(false);
    });

    eventSource.on(event_types.GENERATION_STOPPED, () => {
      console.log(`[${MODULE_NAME}] GENERATION_STOPPED (user cancel) - resetting state`);
      // setIsGenerating(false) triggers setStreamingState(false) which auto-flushes pending updates
      // No need for explicit flushPendingUpdates() call - avoid double flush
      setIsGenerating(false);
    });
  }

  // Set up MutationObserver for streaming support
  setupLumiaOOCObserver();

  // Process any existing OOC comments on initial load
  console.log(`[${MODULE_NAME}] Initial load - scheduling OOC processing`);
  scheduleOOCProcessingAfterRender();

  // --- SLASH COMMANDS ---
  const SlashCommandParser = getSlashCommandParser();
  const SlashCommand = getSlashCommand();

  if (SlashCommandParser && SlashCommand) {
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: "loom-summarize",
        callback: async () => {
          const settings = getSettings();
          const sumSettings = settings.summarization;
          if (!sumSettings || sumSettings.mode === "disabled") {
            toastr.warning("Summarization is disabled. Enable it in Lumia Injector settings.");
            return "Summarization is disabled.";
          }

          try {
            toastr.info("Generating loom summary...");
            const result = await generateLoomSummary(null, true);
            if (result) {
              toastr.success("Loom summary generated and saved!");
              return "Summary generated successfully.";
            } else {
              toastr.warning("No summary generated. Check if there are messages to summarize.");
              return "No summary generated.";
            }
          } catch (error) {
            toastr.error(`Summarization failed: ${error.message}`);
            return `Error: ${error.message}`;
          }
        },
        aliases: ["loom-sum", "summarize"],
        helpString: "Manually generate a loom summary of the current chat using your configured summarization settings (uses Manual Message Context).",
      }),
    );
  }

  console.log(`${MODULE_NAME} initialized`);
});
