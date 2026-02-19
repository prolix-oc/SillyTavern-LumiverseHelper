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
import { query, queryAll, getSafeLandingPageZIndex } from "./lib/domUtils.js";

// Import landing page styles for fallback
import { landingPageStyles } from "./react-ui/components/LandingPageStyles.js";

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

import {
  registerLumiaMacros, getOOCTriggerText, setLastAIMessageIndex } from "./lib/lumiaContent.js";
import {
  executeAllCouncilTools, clearToolResults, areCouncilToolsEnabled,
  getCouncilToolsMode, registerSTTools, unregisterSTTools,
  isGenerationCycleActive, markGenerationCycleStart, markGenerationCycleEnd } from "./lib/councilTools.js";
import { resetIndicator } from "./lib/councilVisuals.js";

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

import {
    isLandingPageEnabled,
    getRecentChats,
    getCharacterPreset,
} from "./lib/landingPageService.js";

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

  // Detect recursive Generate() calls from ST's tool call handling.
  // When the LLM invokes inline tools, ST calls Generate() recursively, which
  // re-runs this interceptor. We must NOT clear tool results or re-execute
  // sidecar tools on recursive passes — the results from the first pass or
  // from inline action callbacks must be preserved.
  const isRecursiveCall = isGenerationCycleActive();

  if (!isRecursiveCall) {
    // First call in this generation cycle — fresh start
    markGenerationCycleStart();
    resetRandomLumia();
    clearToolResults();
    resetIndicator();
  } else {
    console.log(`[${MODULE_NAME}] Recursive interceptor call detected — preserving tool results`);
  }

  // Execute council tools if enabled (only on first call, not recursive passes)
  // Defensive: handle undefined type, and explicitly check for swipe
  const isNormalOrSwipe = type === 'normal' || type === 'swipe' || !type;
  console.log(`[${MODULE_NAME}] Council tools check: type="${type}", isRecursive=${isRecursiveCall}, isNormalOrSwipe=${isNormalOrSwipe}, enabled=${areCouncilToolsEnabled()}`);
  
  if (!isRecursiveCall && isNormalOrSwipe && areCouncilToolsEnabled()) {
    const toolMode = getCouncilToolsMode();

    if (toolMode === 'sidecar') {
      // Sidecar mode: execute tools via direct fetch with dedicated LLM before generation
      // CRITICAL: This must complete before returning to ST to stall the generation
      try {
        console.log(`[${MODULE_NAME}] Council tools (sidecar mode) executing - STALLING generation...`);
        const startTime = Date.now();
        const results = await executeAllCouncilTools();
        const duration = Date.now() - startTime;
        console.log(`[${MODULE_NAME}] Council tools (sidecar) execution COMPLETE in ${duration}ms - ${results.length} results obtained, resuming generation`);
      } catch (error) {
        console.error(`[${MODULE_NAME}] Council tools (sidecar) execution failed:`, error);
        // Continue with generation even if tools fail
      }
    } else if (toolMode === 'inline') {
      // Inline mode: tools are registered with ST's ToolManager and will be
      // included in the main generation request. The LLM decides when to call them.
      // Tool action callbacks accumulate results into latestToolResults.
      console.log(`[${MODULE_NAME}] Council tools (inline mode) — tools registered with ST ToolManager, LLM will invoke during generation`);
    }
  }

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

  // OPTIMIZATION: Hide default landing page immediately if enabled
  // This prevents a flash of the default screen before our React UI loads
  // We do this before any async operations to be as fast as possible
  try {
    if (isLandingPageEnabled()) {
      const sheld = document.querySelector('#sheld');
      if (sheld) {
        sheld.style.opacity = '0';
        sheld.style.pointerEvents = 'none';
      }
    }
  } catch (e) {
    console.warn(`[${MODULE_NAME}] Failed to pre-hide sheld:`, e);
  }

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

  // Register council tools with ST's ToolManager if inline mode is active.
  // Tools have a shouldRegister gate that dynamically checks mode/enabled state,
  // so registering eagerly is safe — they only appear in generation requests when conditions are met.
  try {
    registerSTTools();
    console.log(`[${MODULE_NAME}] Council tools registered with ST ToolManager (shouldRegister gate active)`);
  } catch (err) {
    console.warn(`[${MODULE_NAME}] Failed to register ST council tools:`, err);
  }

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
  registerReactCallback("handleNewBook", async (data, filename) => {
    // Use importPack which handles both native Lumiverse format and World Book format
    // MUST await since importPack is async - otherwise pack won't be in cache yet
    await importPack(data, filename, false);
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
      markGenerationCycleEnd();
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
      // CRITICAL: Reset generation cycle on swipe to ensure council tools can fire
      // Swipe is a fresh generation, not a recursive call
      markGenerationCycleEnd();
      clearToolResults();
      resetIndicator();
      console.log(`[${MODULE_NAME}] Reset generation cycle and cleared tool results for swipe`);
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
      // Reset generation cycle flag so next generation starts fresh
      markGenerationCycleEnd();
    });

    eventSource.on(event_types.GENERATION_STOPPED, () => {
      console.log(`[${MODULE_NAME}] GENERATION_STOPPED (user cancel) - resetting state`);
      // setIsGenerating(false) triggers setStreamingState(false) which auto-flushes pending updates
      // No need for explicit flushPendingUpdates() call - avoid double flush
      setIsGenerating(false);
      // Reset generation cycle flag so next generation starts fresh
      markGenerationCycleEnd();
    });
  }

  // Set up MutationObserver for streaming support
  setupLumiaOOCObserver();

  // Process any existing OOC comments on initial load
  console.log(`[${MODULE_NAME}] Initial load - scheduling OOC processing`);
  scheduleOOCProcessingAfterRender();

  // --- CUSTOM LANDING PAGE ---
  // Render Lumiverse landing page when no chat is open
  // Uses the strategy from the SillyTavern developer guide:
  // - Hide #sheld (opacity: 0, pointer-events: none)
  // - Inject full-screen landing page on top
  let lumiverseLandingContainer = null;
  let originalBodyOverflow = '';

  function renderCustomLanding() {
    console.log(`[${MODULE_NAME}] renderCustomLanding called`);

    // Check if landing page is enabled
    if (!isLandingPageEnabled()) {
      console.log(`[${MODULE_NAME}] Landing page disabled, using default welcome screen`);
      restoreSheld();
      return;
    }

    // Check if a chat is currently open
    // IMPORTANT: Temporary chats don't have a chatId, but can be detected via:
    //   - characterId is undefined AND name2 equals neutralCharacterName
    // See: developer_guides/12_troubleshoot_temp_chat.md - Section 2: Custom Landing Pages
    const ctx = getContext();
    
    // Regular chat detection: has a chatId
    const hasChatId = ctx?.chatId !== undefined && ctx?.chatId !== null && ctx?.chatId !== '';
    
    // Temporary chat detection: no character selected but name2 is the neutral assistant name
    // This indicates the user started a temporary/scratchpad chat
    const isTempChat = ctx?.characterId === undefined && 
                       ctx?.name2 && 
                       ctx?.name2 === ctx?.neutralCharacterName;
    
    const isChatOpen = hasChatId || isTempChat;
    console.log(`[${MODULE_NAME}] Context:`, { 
      chatId: ctx?.chatId, 
      characterId: ctx?.characterId, 
      groupId: ctx?.groupId, 
      name2: ctx?.name2,
      neutralCharacterName: ctx?.neutralCharacterName,
      chatLength: ctx?.chat?.length 
    });
    console.log(`[${MODULE_NAME}] isChatOpen:`, isChatOpen, `(hasChatId: ${hasChatId}, isTempChat: ${isTempChat})`);

    if (isChatOpen) {
      // Chat is open - restore sheld and remove landing page
      console.log(`[${MODULE_NAME}] Chat is open, hiding landing page`);
      restoreSheld();
      removeLandingPage();
      return;
    }

    // No chat open - show landing page
    console.log(`[${MODULE_NAME}] No chat open, showing landing page`);
    showLandingPage();
  }

  function showLandingPage() {
    console.log(`[${MODULE_NAME}] showLandingPage called`);

    // Lock body scroll to prevent underlying content from scrolling
    if (!originalBodyOverflow) {
      originalBodyOverflow = document.body.style.overflow;
    }
    document.body.style.overflow = 'hidden';

    // Hide the default sheld per developer guide
    const sheld = document.querySelector('#sheld');
    if (sheld) {
      console.log(`[${MODULE_NAME}] Hiding #sheld`);
      sheld.style.opacity = '0';
      sheld.style.pointerEvents = 'none';
    } else {
      console.warn(`[${MODULE_NAME}] #sheld not found!`);
    }

    // Check if landing page already exists
    if (lumiverseLandingContainer) {
      console.log(`[${MODULE_NAME}] Landing page container already exists, triggering refresh`);
      // Trigger refresh in React component to ensure data is up to date (e.g. on APP_READY)
      window.dispatchEvent(new Event('lumiverse:landing-refresh'));
      return;
    }

    // Create full-screen container with explicit positioning
    lumiverseLandingContainer = document.createElement('div');
    lumiverseLandingContainer.id = 'lumiverse-landing-page-container';
    
    // Get safe z-index relative to top bar
    const safeZ = getSafeLandingPageZIndex();
    
    lumiverseLandingContainer.style.cssText = `
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100dvh;
      z-index: ${safeZ};
      pointer-events: none;
    `;
    document.body.appendChild(lumiverseLandingContainer);
    console.log(`[${MODULE_NAME}] Landing page container created and appended to body`, lumiverseLandingContainer);

    // Mount the landing page React component
    if (window.LumiverseUI?.renderLandingPage) {
      console.log(`[${MODULE_NAME}] Calling window.LumiverseUI.renderLandingPage`);
      window.LumiverseUI.renderLandingPage(lumiverseLandingContainer);
      console.log(`[${MODULE_NAME}] Custom landing page rendered (full-screen)`);
    } else {
      console.warn(`[${MODULE_NAME}] window.LumiverseUI.renderLandingPage not found, using fallback`);
      // Fallback: render simple HTML landing page
      renderSimpleLandingPage(lumiverseLandingContainer);
    }
  }

  function removeLandingPage() {
    if (lumiverseLandingContainer) {
      lumiverseLandingContainer.remove();
      lumiverseLandingContainer = null;
      console.log(`[${MODULE_NAME}] Landing page removed`);
      
      // Restore body scroll
      document.body.style.overflow = originalBodyOverflow || '';
      originalBodyOverflow = '';
    }
  }

  function restoreSheld() {
    const sheld = document.querySelector('#sheld');
    if (sheld) {
      sheld.style.opacity = '';
      sheld.style.pointerEvents = '';
    }
  }

  // Simple HTML fallback when React is not available
  // Uses global characters/groups arrays (compatible with lazy loading)
  // Implements glassmorphic card grid design matching the React version
  async function renderSimpleLandingPage(container) {
    try {
      // Inject styles manually since React isn't running
      const styleId = 'lumiverse-landing-styles-fallback';
      if (!document.getElementById(styleId)) {
        const styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = landingPageStyles;
        document.head.appendChild(styleEl);
      }

      // Import global arrays and helpers from SillyTavern core
      const { characters, selectCharacterById, getThumbnailUrl } = await import(/* webpackIgnore: true */ '../../../../../script.js');
      const { groups, openGroupById } = await import(/* webpackIgnore: true */ '../../../../group-chats.js');

      // Merge and sort by date_last_chat
      const allItems = [
        ...(characters || []).map((char, index) => ({
          ...char,
          _type: 'character',
          _index: index,
          _sortDate: char.date_last_chat || 0,
        })),
        ...(groups || []).map(group => ({
          ...group,
          _type: 'group',
          _sortDate: group.date_last_chat || 0,
        })),
      ]
        .filter(item => item._sortDate > 0)
        .sort((a, b) => b._sortDate - a._sortDate)
        .slice(0, 12);

      // Format relative time helper
      const formatTime = (timestamp) => {
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
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      };

      let html = `
        <div class="lumiverse-lp-container">
          <!-- Ambient background effects -->
          <div class="lumiverse-lp-bg">
            <div class="lumiverse-lp-bg-glow lumiverse-lp-bg-glow-1"></div>
            <div class="lumiverse-lp-bg-glow lumiverse-lp-bg-glow-2"></div>
            <div class="lumiverse-lp-bg-glow lumiverse-lp-bg-glow-3"></div>
          </div>
          <!-- Grid pattern overlay -->
          <div class="lumiverse-lp-grid"></div>

          <div class="lumiverse-lp-content">
            <!-- Header -->
            <header class="lumiverse-lp-header">
              <div class="lumiverse-lp-header-left">
                <div class="lumiverse-lp-logo">
                  <div class="lumiverse-lp-logo-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                  </div>
                  <div class="lumiverse-lp-logo-text">
                    <h1>Lumiverse</h1>
                    <span>Continue your story</span>
                  </div>
                </div>
              </div>
              <div class="lumiverse-lp-header-right">
                <button class="lumiverse-lp-btn lumiverse-lp-btn-toggle" id="lumiverse-lp-toggle-sheld" type="button">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <span>Show Sheld</span>
                </button>
              </div>
            </header>

            <!-- Main grid -->
            <main class="lumiverse-lp-main">
      `;

      if (allItems.length === 0) {
        html += `
          <div class="lumiverse-lp-empty">
            <div class="lumiverse-lp-empty-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
            </div>
            <h3>Begin Your Journey</h3>
            <p>No recent conversations found. Select a character to start a new adventure.</p>
          </div>
        `;
      } else {
        html += '<div class="lumiverse-lp-grid-cards">';
        allItems.forEach((item, index) => {
          const isGroup = item._type === 'group';
          const time = formatTime(item._sortDate);

          // Avatar URL: groups use avatar_url, characters use getThumbnailUrl for thumbnails
          let avatarUrl;
          if (isGroup) {
            avatarUrl = item.avatar_url || '/img/fa-solid-groups.svg';
          } else if (item.avatar && getThumbnailUrl) {
            avatarUrl = getThumbnailUrl('avatar', item.avatar);
          } else if (item.avatar) {
            avatarUrl = `/characters/${encodeURIComponent(item.avatar)}`;
          } else {
            avatarUrl = '/img/fa-solid-user.svg';
          }

          const groupBadge = isGroup ? `<span class="lumiverse-lp-card-badge lumiverse-lp-card-badge-group"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Group</span>` : '';

          html += `
            <div class="lumiverse-lp-card" data-type="${item._type}" data-id="${isGroup ? item.id : item._index}" style="animation-delay: ${index * 60}ms">
              <div class="lumiverse-lp-card-shimmer"></div>
              <div class="lumiverse-lp-card-image-container">
                <div class="lumiverse-lp-card-glow"></div>
                ${isGroup ? `
                  <div class="lumiverse-lp-card-avatar-group">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                ` : `
                  <img src="${avatarUrl}" alt="${item.name}" class="lumiverse-lp-card-avatar" loading="lazy" onerror="this.src='/img/fa-solid-user.svg'">
                `}
                <div class="lumiverse-lp-card-time-badge">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>${time}</span>
                </div>
              </div>
              <div class="lumiverse-lp-card-content">
                <h3 class="lumiverse-lp-card-name">${item.name || 'Unnamed'}</h3>
                <div class="lumiverse-lp-card-meta">
                  ${groupBadge}
                </div>
              </div>
              <div class="lumiverse-lp-card-indicator"></div>
            </div>
          `;
        });
        html += '</div>';
      }

      html += `
            </main>

            <!-- Footer -->
            <footer class="lumiverse-lp-footer">
              <p>Select a character to continue your journey</p>
            </footer>
          </div>
        </div>
      `;

      container.innerHTML = html;

      // Add click handlers to cards
      container.querySelectorAll('.lumiverse-lp-card').forEach(card => {
        card.addEventListener('click', async () => {
          const type = card.dataset.type;
          const id = card.dataset.id;
          try {
            if (type === 'group') {
              if (openGroupById) await openGroupById(id);
            } else {
              if (selectCharacterById) await selectCharacterById(String(id));
            }
          } catch (err) {
            console.error(`[${MODULE_NAME}] Error opening chat:`, err);
          }
        });
      });

      // Toggle sheld button handler
      const toggleBtn = container.querySelector('#lumiverse-lp-toggle-sheld');
      if (toggleBtn) {
        let sheldVisible = false;
        toggleBtn.addEventListener('click', () => {
          const sheld = document.querySelector('#sheld');
          if (sheld) {
            if (sheldVisible) {
              sheld.style.opacity = '0';
              sheld.style.pointerEvents = 'none';
              toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Show Sheld</span>`;
            } else {
              sheld.style.opacity = '';
              sheld.style.pointerEvents = '';
              toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>Show Landing</span>`;
            }
            sheldVisible = !sheldVisible;
          }
        });
      }

      console.log(`[${MODULE_NAME}] Simple landing page rendered with ${allItems.length} chats`);
    } catch (err) {
      console.error(`[${MODULE_NAME}] Error rendering simple landing page:`, err);
    }
  }

  // Register landing page event listeners
  if (eventSource && event_types) {
    eventSource.on(event_types.APP_READY, () => {
      window.lumiverseAppReady = true;
      renderCustomLanding();
    });
    eventSource.on(event_types.CHAT_CHANGED, renderCustomLanding);
    
    // Trigger immediately in case we missed APP_READY or want to render ASAP
    // This ensures the landing page appears as soon as the script loads
    renderCustomLanding();
  }

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

  // Set up beforeunload handler to flush pending saves
  window.addEventListener('beforeunload', async () => {
    try {
      const { flushPendingSaves } = await import('./lib/settingsManager.js');
      await flushPendingSaves();
    } catch (err) {
      console.warn(`[${MODULE_NAME}] Error flushing saves on unload:`, err);
    }
  });

  console.log(`${MODULE_NAME} initialized`);
});
