/**
 * Lumia Injector Extension - Main Entry Point
 *
 * This file handles SillyTavern initialization and registration only.
 * All functionality is delegated to sub-modules in the lib/ directory.
 */

import { getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";
import { MacrosParser } from "../../../macros.js";
import { query, queryAll } from "./sthelpers/domUtils.js";
import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";

// Import modules
import {
  MODULE_NAME,
  getSettings,
  loadSettings,
  loadSettingsHtml,
  resetRandomLumia,
} from "./lib/settingsManager.js";

import { handleNewBook, fetchWorldBook } from "./lib/dataProcessor.js";

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
  createLoomSummaryButton,
  updateLoomSummaryButtonState,
} from "./lib/uiModals.js";

import {
  generateLoomSummary,
  checkAutoSummarization,
  restoreSummaryMarkers,
} from "./lib/summarization.js";

import { registerLumiaMacros } from "./lib/lumiaContent.js";

import {
  processLoomConditionals,
  captureLoomSummary,
  hideLoomSumBlocks,
  registerLoomMacros,
  setLastUserMessageContent,
  findLastUserMessage,
} from "./lib/loomSystem.js";

import {
  processLumiaOOCComments,
  processAllLumiaOOCComments,
  scheduleOOCProcessingAfterRender,
  unhideAndProcessOOCMarkers,
  setupLumiaOOCObserver,
  isLumiaOOCFont,
  setIsGenerating,
  initializeRAFBatchRenderer,
  flushPendingUpdates,
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

// --- CONTEXT FILTER FUNCTIONS ---

/**
 * Strip common HTML formatting tags from content, preserving the text inside
 * Note: Does NOT strip <font> tags by default - those are handled separately
 * Special handling for <div>: deletes entirely EXCEPT for codeblock containers
 * @param {string} content - The content to filter
 * @returns {string} Content with HTML tags stripped
 */
function stripHtmlTags(content) {
  if (!content) return content;

  let result = content;

  // FIRST: Handle divs specially - delete most entirely, but preserve codeblock containers
  // Pattern: <div style="display: none;">```  OR  <div style="display: none;">\n```
  // These are codeblock containers from other extensions - preserve their inner content
  result = handleDivFiltering(result);

  // List of common formatting/layout tags to strip (preserving content)
  // Note: "font" is NOT included here - it's handled separately via stripFontTags
  // Note: "div" is NOT included here - it's handled specially above
  const tagsToStrip = [
    "span",
    "b",
    "i",
    "u",
    "em",
    "strong",
    "s",
    "strike",
    "sub",
    "sup",
    "mark",
    "small",
    "big",
  ];

  for (const tag of tagsToStrip) {
    // Match opening tag with any attributes, capture content, match closing tag
    // Use non-greedy matching and handle nested tags by repeating
    const openTagRegex = new RegExp(`<${tag}(?:\\s[^>]*)?>`, "gi");
    const closeTagRegex = new RegExp(`</${tag}>`, "gi");

    result = result.replace(openTagRegex, "");
    result = result.replace(closeTagRegex, "");
  }

  return result;
}

/**
 * Handle div filtering with special logic for codeblock containers
 * - Preserves content of divs that are codeblock containers (display:none followed by ```)
 * - Deletes all other divs entirely (including their contents)
 * @param {string} content - The content to filter
 * @returns {string} Content with divs processed
 */
function handleDivFiltering(content) {
  if (!content) return content;

  let result = content;
  let prevResult;

  // Keep processing until no more changes (handles nested divs)
  do {
    prevResult = result;

    // First pass: Find and preserve codeblock container divs
    // Pattern: <div with display:none> followed by ``` (with optional newline between)
    // Replace these with just their inner content (the codeblock)
    result = result.replace(
      /<div[^>]*style\s*=\s*["'][^"']*display\s*:\s*none[^"']*["'][^>]*>(\s*```[\s\S]*?```\s*)<\/div>/gi,
      "$1"
    );

    // Second pass: Delete all remaining divs entirely (including contents)
    // This removes visual/layout divs that don't belong in context
    result = result.replace(/<div(?:\s[^>]*)?>([\s\S]*?)<\/div>/gi, "");

  } while (result !== prevResult);

  // Clean up any orphaned closing tags
  result = result.replace(/<\/div>/gi, "");

  return result;
}

/**
 * Strip <font> tags from content, preserving the text inside
 * Separated from stripHtmlTags because some presets use font tags for colored dialogue
 * @param {string} content - The content to filter
 * @returns {string} Content with font tags stripped
 */
function stripFontTags(content) {
  if (!content) return content;

  // Remove <font ...> and </font> tags, keeping content
  let result = content;
  result = result.replace(/<font(?:\s[^>]*)?>/gi, "");
  result = result.replace(/<\/font>/gi, "");

  return result;
}

/**
 * Remove <details> blocks from content entirely
 * @param {string} content - The content to filter
 * @returns {string} Content with details blocks removed
 */
function stripDetailsBlocks(content) {
  if (!content) return content;

  // Match <details>...</details> including nested content
  // Use a non-greedy match that handles the most common cases
  // For deeply nested details, we may need multiple passes
  let result = content;
  let prevResult;

  // Keep removing until no more changes (handles nested details)
  do {
    prevResult = result;
    // Match details blocks - handles attributes on the tag
    result = result.replace(/<details(?:\s[^>]*)?>([\s\S]*?)<\/details>/gi, "");
  } while (result !== prevResult);

  return result;
}

/**
 * Remove Loom-related tags from content
 * These are custom tags used by Lucid Loom system
 * @param {string} content - The content to filter
 * @returns {string} Content with Loom tags stripped
 */
function stripLoomTags(content) {
  if (!content) return content;

  // List of Loom-related custom tags
  const loomTags = [
    "loom_sum",
    "loom_if",
    "loom_else",
    "loom_endif",
    "lumia_ooc",
    "loom_state",
    "loom_memory",
    "loom_context",
    "loom_inject",
    "loom_var",
    "loom_set",
    "loom_get",
  ];

  let result = content;

  for (const tag of loomTags) {
    // Match both self-closing and paired tags
    const pairedTagRegex = new RegExp(
      `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`,
      "gi",
    );
    const selfClosingRegex = new RegExp(`<${tag}(?:\\s[^>]*)?\\/?>`, "gi");

    // For paired tags, remove the entire block including content
    result = result.replace(pairedTagRegex, "");
    // For self-closing or orphan opening tags
    result = result.replace(selfClosingRegex, "");
  }

  return result;
}

// --- GENERATION INTERCEPTOR ---
// This interceptor is called before each generation (send, regenerate, swipe, continue, impersonate)
// It ensures that randomLumia is reset on every generation, including swipes
globalThis.lumiverseHelperGenInterceptor = async function (
  chat,
  contextSize,
  abort,
  type,
) {
  console.log(
    `[${MODULE_NAME}] Generation interceptor called with type: ${type}`,
  );

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
      // Remove messages from the beginning of the array (oldest messages)
      chat.splice(0, removedCount);
      console.log(
        `[${MODULE_NAME}] Message Truncation: Removed ${removedCount} older messages, keeping last ${keepCount}`,
      );
    }
  }

  // Sovereign Hand: Capture and optionally exclude last user message
  const excludeLastMessage = settings.sovereignHand?.excludeLastMessage !== false;
  if (sovereignHandEnabled) {
    // Find and capture the last user message content before any modifications
    // Search from the end of the chat array for the last user message
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

      // Store the content for the {{loomLastUserMessage}} macro
      setLastUserMessageContent(messageContent);
      console.log(
        `[${MODULE_NAME}] Sovereign Hand: Captured last user message at index ${lastUserIndex}`,
      );

      // Only remove the last user message if excludeLastMessage is enabled
      if (excludeLastMessage) {
        chat.splice(lastUserIndex, 1);
        console.log(
          `[${MODULE_NAME}] Sovereign Hand: Removed last user message from context array`,
        );
      } else {
        console.log(
          `[${MODULE_NAME}] Sovereign Hand: Last message kept in context (excludeLastMessage=false)`,
        );
      }
    } else {
      // No user message found, clear the stored content
      setLastUserMessageContent("");
    }
  } else {
    // Clear stored content when feature is disabled
    setLastUserMessageContent("");
  }

  // Calculate "keep depth" thresholds for depth-based filters
  // Depth is measured from the END of the chat (most recent messages)
  const detailsKeepDepth = contextFilters.detailsBlocks?.keepDepth ?? 3;
  const loomKeepDepth = contextFilters.loomItems?.keepDepth ?? 5;
  const fontKeepDepth = contextFilters.htmlTags?.fontKeepDepth ?? 3;

  // Check if any filters are enabled
  const htmlFilterEnabled = contextFilters.htmlTags?.enabled || false;
  const fontFilterEnabled = contextFilters.htmlTags?.stripFonts || false;
  const detailsFilterEnabled = contextFilters.detailsBlocks?.enabled || false;
  const loomFilterEnabled = contextFilters.loomItems?.enabled || false;
  const anyFilterEnabled =
    htmlFilterEnabled || fontFilterEnabled || detailsFilterEnabled || loomFilterEnabled;

  // Process loomIf conditionals and apply content filters in all chat messages
  for (let i = 0; i < chat.length; i++) {
    // Calculate depth from end (0 = last message, 1 = second to last, etc.)
    const depthFromEnd = chat.length - 1 - i;

    // Helper function to apply filters to a content string
    const filterContent = (content) => {
      if (!content || typeof content !== "string") return content;

      let result = content;

      // HTML tags filter - applies to ALL messages when enabled
      if (htmlFilterEnabled) {
        result = stripHtmlTags(result);
      }

      // Font tags filter - only applies to messages BEYOND the font keep depth
      // (requires htmlFilterEnabled since it's a sub-option)
      if (htmlFilterEnabled && fontFilterEnabled && depthFromEnd >= fontKeepDepth) {
        result = stripFontTags(result);
      }

      // Details blocks filter - only applies to messages BEYOND the keep depth
      if (detailsFilterEnabled && depthFromEnd >= detailsKeepDepth) {
        result = stripDetailsBlocks(result);
      }

      // Loom tags filter - only applies to messages BEYOND the keep depth
      if (loomFilterEnabled && depthFromEnd >= loomKeepDepth) {
        result = stripLoomTags(result);
      }

      return result;
    };

    // Process 'content' field
    if (chat[i] && typeof chat[i].content === "string") {
      chat[i].content = processLoomConditionals(chat[i].content);

      // Apply content filters if any are enabled
      if (anyFilterEnabled) {
        chat[i].content = filterContent(chat[i].content);
      }
    }

    // Also process 'mes' field which some contexts use
    if (chat[i] && typeof chat[i].mes === "string") {
      chat[i].mes = processLoomConditionals(chat[i].mes);

      // Apply content filters if any are enabled
      if (anyFilterEnabled) {
        chat[i].mes = filterContent(chat[i].mes);
      }
    }
  }

  return { chat, contextSize, abort };
};

// Register macros
registerLumiaMacros(MacrosParser);
registerLoomMacros(MacrosParser);

// Message count macro
MacrosParser.registerMacro("lumiaMessageCount", () => {
  const context = getContext();
  if (!context || !context.chat) return "0";
  return context.chat.length.toString();
});

// OOC trigger countdown/trigger macro
MacrosParser.registerMacro("lumiaOOCTrigger", () => {
  const context = getContext();
  if (!context || !context.chat) return "";

  const settings = getSettings();
  const interval = settings.lumiaOOCInterval;
  if (!interval || interval <= 0) return "";

  const messageCount = context.chat.length;
  const nextTrigger = Math.ceil(messageCount / interval) * interval;
  const messagesUntil = nextTrigger - messageCount;

  // Check if current message count is divisible by interval (trigger time!)
  if (messagesUntil === 0) {
    return "**OOC Commentary Time!** The Gods' want me to speak up to the Human right now, in the out-of-context comments for the Loom! Perfect! I've got a *lot* I want to say and I want them to hear my voice loud and clear!";
  }

  // Otherwise, show countdown
  return `Looks like I've got ${messagesUntil} message${messagesUntil !== 1 ? "s" : ""} left until it's time to speak to the Human directly! The Gods' are anticipating me to be breathless, I cannot wait for my turn!`;
});

// --- INITIALIZATION ---
jQuery(async () => {
  console.log(`[${MODULE_NAME}] jQuery initialization starting...`);
  console.log(`[${MODULE_NAME}] window.LumiverseUI available:`, !!window.LumiverseUI);

  // Load settings
  loadSettings();

  // Initialize RAF batch renderer for optimized OOC rendering
  initializeRAFBatchRenderer();

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
    const url = $("#lumia-url-input-react").val() || $("#lumia-url-input").val();
    fetchWorldBook(url).then(() => {
      refreshUIDisplay();
      notifyReactOfSettingsChange();
    });
  });
  registerReactCallback("handleNewBook", (data, filename) => {
    handleNewBook(data, filename, false);
    refreshUIDisplay();
    notifyReactOfSettingsChange();
  });
  registerReactCallback("refreshUIDisplay", () => {
    refreshUIDisplay();
    notifyReactOfSettingsChange();
  });

  // Try to initialize React UI (will gracefully fail if bundle not loaded)
  console.log(`[${MODULE_NAME}] About to initialize React UI...`);
  const reactContainer = document.getElementById("extensions_settings");
  console.log(`[${MODULE_NAME}] extensions_settings container:`, reactContainer);
  if (reactContainer) {
    const reactInitialized = await initializeReactUI(reactContainer);
    if (reactInitialized) {
      console.log(`[${MODULE_NAME}] React UI initialized successfully`);
    } else {
      console.log(`[${MODULE_NAME}] React UI not available, using legacy HTML UI`);
      // Fall back to legacy HTML settings
      const settingsHtml = await loadSettingsHtml();
      $("#extensions_settings").append(settingsHtml);
    }
  } else {
    // Load legacy HTML settings as fallback
    const settingsHtml = await loadSettingsHtml();
    $("#extensions_settings").append(settingsHtml);
  }

  // Loom Summary button is now redundant - summary is accessible via the Lumiverse Drawer
  // createLoomSummaryButton();

  // Initial UI refresh
  refreshUIDisplay();

  // --- UI EVENT LISTENERS ---

  // Fetch world book from URL
  $("#lumia-fetch-btn").click(() => {
    const url = $("#lumia-url-input").val();
    fetchWorldBook(url).then(() => refreshUIDisplay());
  });

  // Open selection modals
  $("#lumia-open-definitions-btn").click(() => {
    showSelectionModal("definition");
  });

  $("#lumia-open-behaviors-btn").click(() => {
    showSelectionModal("behavior");
  });

  $("#lumia-open-personalities-btn").click(() => {
    showSelectionModal("personality");
  });

  // Open misc features modal
  $("#lumia-open-misc-btn").click(() => {
    showMiscFeaturesModal();
  });

  // Open summarization modal
  $("#lumia-open-summarization-btn").click(() => {
    showSummarizationModal();
  });

  // Open prompt settings modal
  $("#lumia-open-prompt-settings-btn").click(() => {
    showPromptSettingsModal();
  });

  // Open Loom selection modals
  $("#loom-open-style-btn").click(() => {
    showLoomSelectionModal("Narrative Style");
  });

  $("#loom-open-utils-btn").click(() => {
    showLoomSelectionModal("Loom Utilities");
  });

  $("#loom-open-retrofits-btn").click(() => {
    showLoomSelectionModal("Retrofits");
  });

  // Open Lucid Cards browser modal
  $("#lumia-browse-lucid-btn").click(() => {
    showLucidCardsModal();
  });

  // Open Lumia Editor (create new)
  $("#lumia-create-lumia-btn").click(() => {
    showLumiaEditorModal();
  });

  // File upload handling
  $("#lumia-upload-btn").click(() => {
    $("#lumia-file-input").click();
  });

  $("#lumia-file-input").change((event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        handleNewBook(data, file.name, false);
        refreshUIDisplay();
      } catch (error) {
        console.error("Lumia Injector Error:", error);
        toastr.error("Failed to parse: " + error.message);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  });

  // --- SILLYTAVERN EVENT HANDLERS ---

  // Handle character message rendered - primary OOC processing trigger
  eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mesId) => {
    console.log(
      `[${MODULE_NAME}] CHARACTER_MESSAGE_RENDERED event for mesId ${mesId}`,
    );

    // Reset generation flag - successful render means generation completed
    // This also triggers flush of any pending RAF updates
    setIsGenerating(false);

    // Capture loom summary from chat messages
    captureLoomSummary();

    // Check if auto-summarization should trigger
    checkAutoSummarization();

    // Process immediately via RAF - no artificial delays
    // The RAF batch renderer handles timing and scroll preservation
    const messageElement = query(`div[mesid="${mesId}"] .mes_text`);
    if (messageElement) {
      // Hide any loom_sum blocks in the DOM
      hideLoomSumBlocks(messageElement);

      // Unhide any markers that were hidden during streaming
      unhideAndProcessOOCMarkers(messageElement);

      // Check for any unprocessed OOC fonts and process them
      const fontElements = queryAll("font", messageElement);
      const oocFonts = fontElements.filter(isLumiaOOCFont);

      if (oocFonts.length > 0) {
        console.log(
          `[${MODULE_NAME}] Found ${oocFonts.length} OOC font(s), scheduling OOC processing for message ${mesId}`,
        );
        processLumiaOOCComments(mesId);
      }
    }
  });

  // Handle message edits - reprocess OOC comments
  eventSource.on(event_types.MESSAGE_EDITED, (mesId) => {
    console.log(`[${MODULE_NAME}] MESSAGE_EDITED event for mesId ${mesId}`);
    const messageElement = query(`div[mesid="${mesId}"] .mes_text`);
    if (messageElement) {
      const existingBoxes = queryAll("[data-lumia-ooc]", messageElement);
      existingBoxes.forEach((box) => box.remove());
    }
    // Schedule via RAF - no artificial delay needed
    processLumiaOOCComments(mesId);
  });

  // Handle swipes - reprocess OOC comments
  eventSource.on(event_types.MESSAGE_SWIPED, (mesId) => {
    console.log(`[${MODULE_NAME}] MESSAGE_SWIPED event for mesId ${mesId}`);
    // Schedule via RAF - no artificial delay needed
    processLumiaOOCComments(mesId);
  });

  // Handle chat changes - reprocess all OOC comments and capture summaries
  eventSource.on(event_types.CHAT_CHANGED, () => {
    console.log(
      `[${MODULE_NAME}] CHAT_CHANGED event - scheduling OOC reprocessing and loom summary capture`,
    );
    captureLoomSummary();
    scheduleOOCProcessingAfterRender();
    // Restore summary markers and update summary button after DOM is ready
    requestAnimationFrame(() => {
      restoreSummaryMarkers();
      updateLoomSummaryButtonState();
    });
  });

  // Track generation start to prevent observer interference
  eventSource.on(event_types.GENERATION_STARTED, () => {
    console.log(
      `[${MODULE_NAME}] GENERATION_STARTED - disabling OOC observer processing`,
    );
    setIsGenerating(true);
  });

  // GENERATION_ENDED fires on errors - reset state and flush pending updates
  eventSource.on(event_types.GENERATION_ENDED, () => {
    console.log(
      `[${MODULE_NAME}] GENERATION_ENDED (error case) - resetting state and flushing updates`,
    );
    setIsGenerating(false);
    // Flush any pending RAF updates immediately
    flushPendingUpdates();
  });

  // GENERATION_STOPPED fires when user cancels - reset state and flush pending updates
  eventSource.on(event_types.GENERATION_STOPPED, () => {
    console.log(
      `[${MODULE_NAME}] GENERATION_STOPPED (user cancel) - resetting state and flushing updates`,
    );
    setIsGenerating(false);
    // Flush any pending RAF updates immediately
    flushPendingUpdates();
  });

  // Set up MutationObserver for streaming support
  setupLumiaOOCObserver();

  // Process any existing OOC comments on initial load
  console.log(`[${MODULE_NAME}] Initial load - scheduling OOC processing`);
  scheduleOOCProcessingAfterRender();

  // --- SLASH COMMANDS ---

  SlashCommandParser.addCommandObject(
    SlashCommand.fromProps({
      name: "loom-summarize",
      callback: async () => {
        const settings = getSettings();
        const sumSettings = settings.summarization;
        if (!sumSettings || sumSettings.mode === "disabled") {
          toastr.warning(
            "Summarization is disabled. Enable it in Lumia Injector settings.",
          );
          return "Summarization is disabled.";
        }

        try {
          toastr.info("Generating loom summary...");
          const result = await generateLoomSummary(null, true);
          if (result) {
            toastr.success("Loom summary generated and saved!");
            return "Summary generated successfully.";
          } else {
            toastr.warning(
              "No summary generated. Check if there are messages to summarize.",
            );
            return "No summary generated.";
          }
        } catch (error) {
          toastr.error(`Summarization failed: ${error.message}`);
          return `Error: ${error.message}`;
        }
      },
      aliases: ["loom-sum", "summarize"],
      helpString:
        "Manually generate a loom summary of the current chat using your configured summarization settings (uses Manual Message Context).",
    }),
  );

  console.log(`${MODULE_NAME} initialized`);
});
