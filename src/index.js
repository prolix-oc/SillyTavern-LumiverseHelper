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
  getTokenCountAsync,
  getSaveSettingsDebounced,
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
  isGenerationCycleActive, markGenerationCycleStart, markGenerationCycleEnd,
  abortToolExecution,
  captureWorldInfoEntries, clearWorldInfoEntries } from "./lib/councilTools.js";
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
import { resolveActivePreset, assembleMessages, resolveBinding, setActivePreset, setStoredCoreChat, preResolveMedia, applySamplerOverrides, applyCustomBody, applyCompletionSettings, applyAdvancedSettings, applyAdaptiveThinking, getProfileKey, saveCurrentModelProfile, loadModelProfile, savePreset, getLastAssemblyBreakdown, loadPreset, captureModelProfile, setWorldInfoCache, clearWorldInfoCache, injectExtensionPrompts, applyLoomToggleBindingsForContext, hasLoomBindingForCurrentContext } from "./lib/lucidLoomService.js";
import { captureReasoningSnapshot } from "./lib/presetsService.js";
import { storeLoomBreakdown, loadLoomBreakdowns } from "./lib/chatSheldService.js";
import { handleLoomPresetTransition, isLoomControlActive, syncContextSize, syncSamplerOverrides, subscribeToOAIPresetEvents, reapplyLoomReasoningSettings } from "./lib/oaiPresetSync.js";
import { applyGuidesToGeneration } from "./lib/guidedGenerationService.js";
import { initPersonaListener } from "./lib/personaService.js";
import { initCharacterBrowser } from "./lib/characterBrowserService.js";
import { initPersonaManager } from "./lib/personaManagerService.js";
import { initWorldBookInterceptor } from "./lib/worldBookService.js";

import {
    isLandingPageEnabled,
    getRecentChats,
    getCharacterPreset,
} from "./lib/landingPageService.js";

import { initJokesCache } from "./lib/jokesService.js";
import { initConnectionProfiles, resolveProfileBinding, applyProfile as applyConnectionProfile, isApplyingProfile, getStoredActiveProfileId } from "./lib/connectionService.js";

import {
    isChatSheldEnabled,
    activateChatSheld,
    deactivateChatSheld,
    isChatSheldActive,
    setStoreRef as setChatSheldStoreRef,
    syncTailChat,
    resetStreamingState,
} from "./lib/chatSheldService.js";

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

// --- CONTEXT METER: Live token estimation ---
// Debounced helper that counts chat tokens and pushes an estimate to the store.
// Called on CHAT_CHANGED and CHARACTER_MESSAGE_RENDERED to keep the meter live.
let _ctxMeterTimer = null;
function updateContextMeterTokens() {
  clearTimeout(_ctxMeterTimer);
  _ctxMeterTimer = setTimeout(async () => {
    try {
      const tokenCounter = getTokenCountAsync();
      const store = window.LumiverseUI?.getStore?.();
      if (!tokenCounter || !store) return;

      const ctx = getContext();
      const chat = ctx?.chat;
      if (!chat || chat.length === 0) return;

      // Priority: Loom Builder contextSize override > ST API-specific context > fallback
      const loomPreset = resolveActivePreset();
      const loomContextSize = loomPreset?.samplerOverrides?.enabled
        ? loomPreset.samplerOverrides.contextSize : null;
      const maxContext = loomContextSize
        || (ctx?.mainApi === 'openai'
          ? (ctx?.chatCompletionSettings?.openai_max_context || ctx?.maxContext || 0)
          : (ctx?.maxContext || 0));
      const maxTokens = ctx?.chatCompletionSettings?.openai_max_tokens || 0;
      if (maxContext <= 0) return;

      const chatText = chat.map(m => (m.content || m.mes || '')).join('\n');
      const promptTokens = await tokenCounter(chatText);

      store.setState(prev => ({
        loomBuilder: {
          ...prev.loomBuilder,
          tokenUsage: { promptTokens, maxContext, maxTokens, timestamp: Date.now(), isEstimate: true },
        },
      }));
    } catch (err) {
      // Non-critical — silently ignore
    }
  }, 500);
}

// --- CONTEXT OVERFLOW WARNING ---
/**
 * Show a themed confirmation dialog when the prompt may exceed the context window.
 * Returns a promise that resolves to true (proceed) or false (cancel).
 * Uses vanilla DOM to avoid React dependency in the interceptor path.
 */
function showContextOverflowWarning(chatTokens, maxContext, maxTokens) {
  return new Promise((resolve) => {
    const budget = maxContext - maxTokens;
    const overflow = chatTokens - budget;
    const pct = Math.round((chatTokens / budget) * 100);

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10001;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--lumiverse-font, system-ui, sans-serif);
    `;

    overlay.innerHTML = `
      <div style="
        background: var(--lumiverse-bg-elevated, #1e1e2e);
        border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.1));
        border-radius: 12px; padding: 24px; width: 380px; max-width: 90vw;
        color: var(--lumiverse-text, #e0e0e0);
        box-shadow: 0 16px 48px rgba(0,0,0,0.4);
      ">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--lumiverse-warning, #f59e0b)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
          <span style="font-size:16px; font-weight:600;">Context Overflow</span>
        </div>
        <p style="font-size:13px; line-height:1.5; margin:0 0 6px; color:var(--lumiverse-text-muted, #aaa);">
          Your chat history alone uses <strong style="color:var(--lumiverse-text, #e0e0e0)">${chatTokens.toLocaleString()}</strong> tokens, which
          ${overflow > 0
            ? `exceeds your available budget of <strong style="color:var(--lumiverse-text, #e0e0e0)">${budget.toLocaleString()}</strong> by <strong style="color:var(--lumiverse-danger, #ef4444)">${overflow.toLocaleString()}</strong> tokens.`
            : `combined with system prompts will likely exceed your budget of <strong style="color:var(--lumiverse-text, #e0e0e0)">${budget.toLocaleString()}</strong>.`
          }
        </p>
        <p style="font-size:12px; line-height:1.4; margin:0 0 14px; color:var(--lumiverse-text-dim, #888);">
          Context: ${maxContext.toLocaleString()} max &minus; ${maxTokens.toLocaleString()} response = ${budget.toLocaleString()} budget (${pct}% used by chat alone)
        </p>
        <label id="lumi-ctx-dismiss-label" style="
          display:flex; align-items:center; gap:8px; margin:0 0 18px;
          font-size:12px; color:var(--lumiverse-text-muted, #aaa); cursor:pointer; user-select:none;
        ">
          <input type="checkbox" id="lumi-ctx-dismiss" style="
            width:14px; height:14px; accent-color:var(--lumiverse-warning, #f59e0b); cursor:pointer;
          " />
          Don't remind me again for this chat
        </label>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button id="lumi-ctx-cancel" style="
            padding:8px 16px; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer;
            border:1px solid var(--lumiverse-border, rgba(255,255,255,0.1));
            background:var(--lumiverse-bg, #181825); color:var(--lumiverse-text, #e0e0e0);
          ">Cancel</button>
          <button id="lumi-ctx-proceed" style="
            padding:8px 16px; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer;
            border:1px solid var(--lumiverse-warning, #f59e0b);
            background:var(--lumiverse-warning, #f59e0b); color:#000;
          ">Proceed Anyway</button>
        </div>
      </div>
    `;

    const cleanup = (result) => {
      overlay.remove();
      resolve(result);
    };

    const dismissCheckbox = overlay.querySelector('#lumi-ctx-dismiss');
    overlay.querySelector('#lumi-ctx-cancel').addEventListener('click', () => cleanup({ proceed: false, dismiss: false }));
    overlay.querySelector('#lumi-ctx-proceed').addEventListener('click', () => cleanup({ proceed: true, dismiss: !!dismissCheckbox.checked }));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup({ proceed: false, dismiss: false }); });

    document.body.appendChild(overlay);
  });
}

// --- GENERATION INTERCEPTOR ---
// CRITICAL: Must be exposed on globalThis for ST to find it via manifest.json
globalThis.lumiverseHelperGenInterceptor = async function (chat, contextSize, abort, type) {

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
    clearWorldInfoEntries();
    resetIndicator();
  } else {
  }

  // === CONTEXT OVERFLOW CHECK (before council tools) ===
  // On first call for user-initiated generations, estimate token usage from the
  // chat array. If chatTokens + maxResponseTokens >= maxContext, warn the user.
  const isUserGeneration = type === 'normal' || type === 'swipe' || type === 'regenerate' || !type;
  if (!isRecursiveCall && isUserGeneration) {
    const tokenCounter = getTokenCountAsync();
    if (tokenCounter) {
      try {
        const ctx = getContext();
        // Priority: Loom Builder contextSize override > ST API-specific context > fallback
        const loomCtxPreset = resolveActivePreset();
        const loomCtxSize = loomCtxPreset?.samplerOverrides?.enabled
          ? loomCtxPreset.samplerOverrides.contextSize : null;
        const maxContext = loomCtxSize
          || (ctx?.mainApi === 'openai'
            ? (ctx?.chatCompletionSettings?.openai_max_context || ctx?.maxContext || 0)
            : (ctx?.maxContext || 0));
        const maxTokens = ctx?.chatCompletionSettings?.openai_max_tokens || 0;

        if (maxContext > 0) {
          // Skip warning if user previously dismissed for this chat
          const dismissed = ctx.chatMetadata?.lumiverse_dismiss_context_warning;
          if (!dismissed) {
            const chatText = chat.map(m => (m.content || m.mes || '')).join('\n');
            const chatTokens = await tokenCounter(chatText);

            if (chatTokens + maxTokens >= maxContext) {
              const result = await showContextOverflowWarning(chatTokens, maxContext, maxTokens);
              if (!result.proceed) {
                return { chat: [], contextSize: 0, abort: true };
              }
              if (result.dismiss && ctx.chatMetadata) {
                ctx.chatMetadata.lumiverse_dismiss_context_warning = true;
                const saveFn = getSaveSettingsDebounced();
                if (saveFn) saveFn();
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[${MODULE_NAME}] Context overflow check failed (non-blocking):`, err);
      }
    }
  }

  // Execute council tools if enabled (only on first call, not recursive passes)
  // Run for normal sends, swipes, and regenerations (but not continue/impersonate/quiet)
  const shouldRunTools = isUserGeneration;
  
  if (!isRecursiveCall && shouldRunTools && areCouncilToolsEnabled()) {
    const toolMode = getCouncilToolsMode();

    if (toolMode === 'sidecar') {
      // Sidecar mode: execute tools via direct fetch with dedicated LLM before generation
      // CRITICAL: This must complete before returning to ST to stall the generation.
      // If the user stops generation, abortToolExecution() cancels all in-flight fetches
      // and this await resolves promptly via AbortError.
      try {
        const startTime = Date.now();
        const results = await executeAllCouncilTools();
        const duration = Date.now() - startTime;
      } catch (error) {
        if (error?.name === 'AbortError') {
        } else {
          console.error(`[${MODULE_NAME}] Council tools (sidecar) execution failed:`, error);
        }
        // Continue — ST's stop mechanism handles the rest
      }
    } else if (toolMode === 'inline') {
      // Inline mode: tools are registered with ST's ToolManager and will be
      // included in the main generation request. The LLM decides when to call them.
      // Tool action callbacks accumulate results into latestToolResults.
    }
  }

  // === LOOM PRESET BUILDER: Store coreChat reference ===
  // The actual prompt assembly happens in CHAT_COMPLETION_SETTINGS_READY handler,
  // which fires later with the full generate_data.messages array.
  // Here we just store the processed coreChat so it can be used at assembly time.
  const loomPreset = resolveActivePreset();
  if (loomPreset) {
    // Store a snapshot of the chat array BEFORE we apply filters below.
    // The CHAT_COMPLETION_SETTINGS_READY handler will use this as the chat history.
    const chatSnapshot = chat.map(m => ({ ...m }));
    setStoredCoreChat(chatSnapshot);

    // Pre-resolve media URLs for inline media support.
    // Images are stored as server paths on chat[i].extra.media; this fetches
    // them and converts to data: URLs so the synchronous assembler can include them.
    if (loomPreset.completionSettings?.sendInlineMedia !== false) {
      try {
        await preResolveMedia(chatSnapshot);
      } catch (e) {
        console.warn(`[${MODULE_NAME}] Loom Builder: Media pre-resolution failed (non-blocking):`, e);
      }
    }

  } else {
    setStoredCoreChat(null);
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

      if (excludeLastMessage) {
        chat.splice(lastUserIndex, 1);
      }
    } else {
      setLastUserMessageContent("");
      setCapturedUserMessageFlag(false);
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

}

// --- INITIALIZATION ---
jQuery(async () => {

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
  } catch (err) {
    console.warn(`[${MODULE_NAME}] Failed to register ST council tools:`, err);
  }

  // Initialize RAF batch renderer for optimized OOC rendering
  initializeRAFBatchRenderer();

  // Initialize preset binding service for auto-switching
  initPresetBindingService();

  // Initialize connection profiles (loaded by initPackCache, this is a no-op placeholder)
  initConnectionProfiles();

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
  const reactContainer = document.getElementById("extensions_settings");

  if (reactContainer) {
    const reactInitialized = await initializeReactUI(reactContainer);
    if (reactInitialized) {
    } else {
      console.error(`[${MODULE_NAME}] React UI failed to initialize - check console for errors`);
    }
  }

  // Re-apply active connection profile on boot so ST matches what Lumiverse persisted.
  // Without this, the UI shows a profile as active but ST keeps its pre-reload settings.
  const storedProfileId = getStoredActiveProfileId();
  if (storedProfileId) {
    applyConnectionProfile(storedProfileId, { silent: true }).catch(err => {
      console.warn(`[${MODULE_NAME}] Failed to re-apply connection profile on boot:`, err);
    });
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
      setIsGenerating(false);
      markGenerationCycleEnd();
      captureLoomSummary();
      checkAutoSummarization();
      updateContextMeterTokens();

      // Track the AI message index for swipe/regenerate detection
      // This helps getOOCTriggerText() calculate consistent triggers across swipes
      const context = getContext();
      if (context?.chat) {
        setLastAIMessageIndex(context.chat.length - 1);
      }

      // Skip DOM work when Chat Sheld is active — #chat is hidden and React
      // handles OOC rendering via parseOOCTags() in the React path
      if (!isChatSheldActive()) {
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
            processLumiaOOCComments(mesId);
          }
        }
      }
    });

    eventSource.on(event_types.MESSAGE_EDITED, (mesId) => {
      // Clear cached user message to prevent stale data on regenerate
      setLastUserMessageContent("");
      setCapturedUserMessageFlag(false);
      // Clear tracked texts to avoid stuck states
      clearProcessedTexts(mesId);
      // Skip DOM OOC work when Chat Sheld is active — React handles OOC rendering
      if (!isChatSheldActive()) {
        const messageElement = query(`div[mesid="${mesId}"] .mes_text`);
        if (messageElement) {
          const existingBoxes = queryAll("[data-lumia-ooc]", messageElement);
          existingBoxes.forEach((box) => box.remove());
        }
        // Force reprocess since content may have changed
        processLumiaOOCComments(mesId, true);
      }
    });

    eventSource.on(event_types.MESSAGE_SWIPED, (mesId) => {
      // Clear cached user message to prevent stale data on regenerate
      setLastUserMessageContent("");
      setCapturedUserMessageFlag(false);
      // Clear tracked texts and force reprocess for the new swipe
      clearProcessedTexts(mesId);
      // Skip DOM OOC work when Chat Sheld is active — React handles OOC rendering
      if (!isChatSheldActive()) {
        const messageElement = query(`div[mesid="${mesId}"] .mes_text`);
        if (messageElement) {
          const existingBoxes = queryAll("[data-lumia-ooc]", messageElement);
          existingBoxes.forEach((box) => box.remove());
        }
        processLumiaOOCComments(mesId, true);
      }
      // CRITICAL: Reset generation cycle on swipe to ensure council tools can fire
      // Swipe is a fresh generation, not a recursive call
      markGenerationCycleEnd();
      clearToolResults();
      resetIndicator();
    });

    eventSource.on(event_types.CHAT_CHANGED, () => {
      // Clear cached user message state for fresh start
      setLastUserMessageContent("");
      setCapturedUserMessageFlag(false);
      // Reset RAF state for fresh processing on new chat
      resetRAFState();
      // Reset AI message tracking for swipe/regen detection
      setLastAIMessageIndex(-1);
      captureLoomSummary();
      // Skip DOM OOC scheduling when Chat Sheld is active — the 2000ms polling
      // loop scans the hidden #chat for DOM stability, completely wasted work.
      // React handles OOC rendering via parseOOCTags() in MessageContent.
      if (!isChatSheldActive()) {
        scheduleOOCProcessingAfterRender();
      }
      updateContextMeterTokens();
      requestAnimationFrame(() => {
        restoreSummaryMarkers();
        updateLoomSummaryButtonState();
      });

      // Resolve Loom preset binding for the new chat/character
      try {
        const resolvedPresetId = resolveBinding();
        const store = window.LumiverseUI?.getStore?.();
        const currentId = store?.getState()?.loomBuilder?.activePresetId;
        if (resolvedPresetId !== currentId) {
          setActivePreset(resolvedPresetId);
          if (store) {
            const lb = store.getState().loomBuilder || {};
            store.setState({ loomBuilder: { ...lb, activePresetId: resolvedPresetId } });
          }
        }

        // Pre-warm Loom preset cache for sync access during generation
        // (belt-and-suspenders in case initPackCache didn't load it yet)
        if (resolvedPresetId) {
          loadPreset(resolvedPresetId).catch(() => {});
        }

        // Sync ST OAI preset based on Loom preset transition
        const loomSyncPreset = resolvedPresetId ? resolveActivePreset() : null;
        handleLoomPresetTransition(resolvedPresetId, loomSyncPreset);

        // Apply Loom toggle bindings (block enabled/disabled states) for the new context.
        // Runs whenever a Loom preset is active — toggle bindings work independently
        // of preset bindings (user can save block states without creating a preset binding).
        // applyLoomToggleBindingsForContext returns {applied:false} quickly if no
        // toggle bindings exist, so there's no cost when they're absent.
        if (resolvedPresetId) {
          applyLoomToggleBindingsForContext(resolvedPresetId).then(result => {
            if (result.applied) {
              // Notify React store so useLoomBuilder re-reads the preset with updated block states
              if (store) {
                const lb = store.getState().loomBuilder || {};
                store.setState({ loomBuilder: { ...lb, _blockToggleTs: Date.now() } });
              }
              if (typeof toastr !== 'undefined') {
                const msg = result.source === 'defaults'
                  ? `Restored default Loom block states (${result.matched} blocks)`
                  : `Loom block toggles applied (${result.source} binding: ${result.matched} blocks)`;
                toastr.info(msg, 'Lumiverse Helper', { timeOut: 2000, preventDuplicates: true });
              }
            }
          }).catch(() => {});
        }
      } catch (err) {
        // Binding resolution is best-effort
      }

      // Resolve connection profile binding for the new chat/character
      try {
        const resolvedConnProfileId = resolveProfileBinding();
        const connStore = window.LumiverseUI?.getStore?.();
        const currentConnId = connStore?.getState()?.connectionManager?.activeProfileId;
        if (resolvedConnProfileId && resolvedConnProfileId !== currentConnId && !isApplyingProfile()) {
          applyConnectionProfile(resolvedConnProfileId, { silent: true }).catch(() => {});
        }
      } catch (err) {
        // Connection binding resolution is best-effort
      }
    });

    eventSource.on(event_types.GENERATION_STARTED, () => {
      setIsGenerating(true);
    });

    eventSource.on(event_types.GENERATION_ENDED, () => {
      // setIsGenerating(false) triggers setStreamingState(false) which auto-flushes pending updates
      // No need for explicit flushPendingUpdates() call - avoid double flush
      setIsGenerating(false);
      // Abort any in-flight council tool requests — they're no longer needed
      abortToolExecution();
      // Reset generation cycle flag so next generation starts fresh
      markGenerationCycleEnd();
      // Clear WI cache — it's per-generation and must not persist to the next one
      clearWorldInfoCache();
    });

    eventSource.on(event_types.GENERATION_STOPPED, () => {
      // setIsGenerating(false) triggers setStreamingState(false) which auto-flushes pending updates
      // No need for explicit flushPendingUpdates() call - avoid double flush
      setIsGenerating(false);
      // Abort any in-flight council tool requests — user wants to stop everything
      abortToolExecution();
      // Reset generation cycle flag so next generation starts fresh
      markGenerationCycleEnd();
    });

    // World Info capture for council tools context enrichment + Loom preset WI
    if (event_types.WORLD_INFO_ACTIVATED) {
      eventSource.on(event_types.WORLD_INFO_ACTIVATED, (entries) => {
        captureWorldInfoEntries(entries);

        // Cache WI for Loom preset assembly — bucket all positions
        if (Array.isArray(entries) && resolveActivePreset()) {
          const bucket = (pos) => entries.filter(e => e.position === pos)
              .map(e => e.content).filter(Boolean).join('\n');
          setWorldInfoCache({
            before:   bucket(0),
            after:    bucket(1),
            emBefore: bucket(2),
            emAfter:  bucket(3),
            depth: entries.filter(e => e.position === 4).map(e => ({
              content: e.content,
              depth: e.depth ?? 4,
              role: e.role === 1 ? 'user' : e.role === 2 ? 'assistant' : 'system',
            })),
            anBefore: bucket(5),
            anAfter:  bucket(6),
          });
        }
      });
    }

    // === MODEL PROFILE SWITCHING ===
    // When the user changes API or model, save the current profile and load the new one.
    async function handleModelChange() {
      const newKey = getProfileKey();
      const store = window.LumiverseUI?.getStore?.();
      const currentPresetId = store?.getState()?.loomBuilder?.activePresetId;
      if (!currentPresetId) return;

      let preset = resolveActivePreset();
      if (!preset) return;

      const oldKey = preset.lastProfileKey;
      if (oldKey === newKey) return; // Same model, no switch needed

      // 1. Save current settings to the old profile
      let updated = saveCurrentModelProfile(preset, oldKey || newKey);

      // 2. Load settings from the new profile (if exists)
      updated = loadModelProfile(updated, newKey);

      // 3. Persist the updated preset (await to prevent data loss on reload)
      await savePreset(updated);

      // 4. Update React store so UI reflects new samplers
      if (store) {
        store.setState(prev => ({
          loomBuilder: { ...prev.loomBuilder, _profileSwitchTs: Date.now() },
        }));
      }

      // 5. Re-sync all sampler overrides after model profile switch
      if (isLoomControlActive()) {
        const freshPreset = resolveActivePreset();
        if (freshPreset) syncSamplerOverrides(freshPreset);
      }
    }

    // Listen for API/model change events (defensive — only subscribe if event exists)
    if (event_types.MAIN_API_CHANGED) {
      eventSource.on(event_types.MAIN_API_CHANGED, () => {
        handleModelChange();
      });
    }
    if (event_types.CONNECTION_PROFILE_LOADED) {
      eventSource.on(event_types.CONNECTION_PROFILE_LOADED, () => {
        handleModelChange();
      });
    }

    // === LOOM PRESET BUILDER: Full prompt assembly ===
    // Hook into CHAT_COMPLETION_SETTINGS_READY to replace the fully assembled
    // messages array when a Loom preset is active. This fires right before
    // the API call with the complete generate_data object.
    if (event_types.CHAT_COMPLETION_SETTINGS_READY) {
      eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, (generateData) => {
        let activePreset = resolveActivePreset();
        if (!activePreset) return;

        // Fallback model profile detection: catch model changes that
        // events may have missed (e.g., if events aren't available)
        const currentKey = getProfileKey();
        if (activePreset.lastProfileKey && activePreset.lastProfileKey !== currentKey) {
          handleModelChange();
          activePreset = resolveActivePreset();
          if (!activePreset) return;
        }

        try {
          // 1. Assemble messages from preset blocks
          const assembled = assembleMessages(activePreset, generateData);
          if (assembled && assembled.length > 0) {
            // 1a. Inject extension prompts (Summary, AN, Vectors, Smart Context, WI auto-inject)
            const loomBreakdown = getLastAssemblyBreakdown();
            const ctx2 = getContext();
            if (ctx2?.extensionPrompts && loomBreakdown) {
              const enabledBlocks = activePreset.blocks?.filter(b => b.enabled) || [];
              injectExtensionPrompts(assembled, loomBreakdown.entries, ctx2.extensionPrompts, enabledBlocks);
            }

            generateData.messages = assembled;
          }

          // 1b. Store Loom assembly breakdown for prompt itemization
          // (Read AFTER injectExtensionPrompts so breakdown includes extension entries)
          const loomBreakdown = getLastAssemblyBreakdown();
          if (loomBreakdown) {
            const ctxForBreakdown = getContext();
            const chatLen = ctxForBreakdown.chat?.length || 0;
            const genType = generateData.type || 'normal';
            // Estimate mesId: regen/swipe/continue target last message; normal/impersonate create new
            const estimatedMesId = (genType === 'regenerate' || genType === 'swipe' || genType === 'continue')
              ? chatLen - 1
              : chatLen;
            // Build raw prompt display from assembled messages (now includes extension prompts)
            const rawPrompt = assembled.map(m => {
              const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content, null, 2);
              return `[${m.role}]\n${text}`;
            }).join('\n\n');
            storeLoomBreakdown(estimatedMesId, {
              ...loomBreakdown,
              api: ctxForBreakdown.mainApi || 'unknown',
              model: generateData.model || '',
              tokenizer: generateData.tokenizer || '',
              maxContext: generateData.max_context_length || ctxForBreakdown.maxContext || 0,
              maxTokens: generateData.max_tokens || 0,
              rawPrompt,
            });
          }

          // 2. Apply sampler overrides (temperature, top_p, max_tokens, etc.)
          const samplerApplied = applySamplerOverrides(activePreset, generateData);
          if (samplerApplied.length > 0) {
          }

          // 3. Apply custom body JSON (raw_body, extra_body, thinking, etc.)
          const bodyApplied = applyCustomBody(activePreset, generateData);
          if (bodyApplied.length > 0) {
          }

          // 4. Apply completion settings (prefill, names, squash, continue postfix)
          const completionApplied = applyCompletionSettings(activePreset, generateData);
          if (completionApplied.length > 0) {
          }

          // 5. Apply advanced settings (seed, custom stop strings)
          const advancedApplied = applyAdvancedSettings(activePreset, generateData);
          if (advancedApplied.length > 0) {
          }

          // 6. Apply and sync reasoning/CoT settings from the Loom model profile.
          //
          //    The Loom model profile is the source of truth for reasoning settings.
          //    Apply saved reasoning to both ST globals and generateData to ensure:
          //    a) The generation uses correct reasoning settings regardless of what
          //       ST's OAI preset may have overwritten
          //    b) The UI reflects the correct state
          //
          //    After applying, capture any user-initiated changes (made since last
          //    profile save) and persist them.
          //
          //    Also normalize: when reasoning is off, force effort to 'auto' in
          //    both ST globals and generate_data.
          const currentProfileKey = getProfileKey();
          if (currentProfileKey) {
            if (!activePreset.modelProfiles) activePreset.modelProfiles = {};
            const savedProfile = activePreset.modelProfiles[currentProfileKey];

            if (savedProfile) {
              // Apply saved reasoning to ST globals and generateData
              reapplyLoomReasoningSettings();

              // Mirror apiReasoning onto generateData directly (belt-and-suspenders:
              // generateData may have been assembled from stale ST globals)
              if (savedProfile.apiReasoning) {
                if (savedProfile.apiReasoning.enabled !== undefined) {
                  generateData.show_thoughts = savedProfile.apiReasoning.enabled;
                }
                if (savedProfile.apiReasoning.effort) {
                  generateData.reasoning_effort = savedProfile.apiReasoning.effort;
                }
              }

              // Now capture current state — if user changed reasoning in ST UI
              // since last save, those changes will show up here
              const currentReasoning = captureReasoningSnapshot();
              const reasoningChanged =
                JSON.stringify(savedProfile.reasoning) !== JSON.stringify(currentReasoning.reasoning) ||
                JSON.stringify(savedProfile.apiReasoning) !== JSON.stringify(currentReasoning.apiReasoning) ||
                savedProfile.startReplyWith !== currentReasoning.startReplyWith ||
                savedProfile.postProcessing !== currentReasoning.postProcessing;

              if (reasoningChanged) {
                activePreset.modelProfiles[currentProfileKey] = {
                  ...savedProfile,
                  ...currentReasoning,
                };
                activePreset.lastProfileKey = currentProfileKey;
                savePreset(activePreset);
              }
            } else {
              // No profile yet for this model — create one with current state
              activePreset.modelProfiles[currentProfileKey] = captureModelProfile(activePreset);
              activePreset.lastProfileKey = currentProfileKey;
              savePreset(activePreset);
            }
          }

          // Normalize stale reasoning_effort when reasoning is disabled.
          // IMPORTANT: Set to 'auto' instead of deleting. ST's server-side
          // calculateClaudeBudgetTokens() returns null for 'auto' (no thinking),
          // but returns 1024 for undefined (falls through switch with budgetTokens=0,
          // then Math.max(0, 1024) = 1024, attaching unwanted thinking).
          {
            const ctx3 = getContext();
            if (ctx3?.chatCompletionSettings && !ctx3.chatCompletionSettings.show_thoughts) {
              if (ctx3.chatCompletionSettings.reasoning_effort && ctx3.chatCompletionSettings.reasoning_effort !== 'auto') {
                ctx3.chatCompletionSettings.reasoning_effort = 'auto';
                const $ = window.jQuery;
                if ($) $('#openai_reasoning_effort').val('auto');
              }
              generateData.reasoning_effort = 'auto';
            }
            // Also normalize on generateData when show_thoughts is explicitly off
            if (generateData.show_thoughts === false) {
              generateData.reasoning_effort = 'auto';
            }
          }

          // 6b. Apply adaptive thinking for Claude 4.6 models
          const adaptiveApplied = applyAdaptiveThinking(activePreset, generateData);
          if (adaptiveApplied.length > 0) {
          }

          // 6c. Final cleanup: Keep reasoning_effort='auto' rather than deleting it.
          // ST's server-side calculateClaudeBudgetTokens() correctly returns null
          // for 'auto' (no thinking), but returns 1024 for undefined (switch
          // fallthrough → Math.max(0, 1024)). Leaving 'auto' ensures the server
          // won't attach an unwanted thinking block.
          //
          // When reasoning is disabled, also clean up any thinking/output_config
          // that may have leaked through from stale state.
          if (!generateData.show_thoughts) {
            delete generateData.thinking;
            delete generateData.output_config;
          }

          // 7. Count tokens for the context meter (fire-and-forget, non-blocking)
          const tokenCounter = getTokenCountAsync();
          if (tokenCounter && window.LumiverseUI?.getStore) {
            const ctx = getContext();
            // generateData.max_context_length already reflects Loom Builder overrides
            const maxContext = generateData.max_context_length
              || (ctx?.mainApi === 'openai'
                ? (ctx?.chatCompletionSettings?.openai_max_context || ctx?.maxContext || 0)
                : (ctx?.maxContext || 0));
            const maxTokens = generateData.max_tokens || 0;
            const msgs = generateData.messages || [];

            const fullText = msgs.map(m => m.content || '').join('\n');
            tokenCounter(fullText).then(promptTokens => {
              const store = window.LumiverseUI.getStore();
              if (store) {
                store.setState(prev => ({
                  loomBuilder: {
                    ...prev.loomBuilder,
                    tokenUsage: { promptTokens, maxContext, maxTokens, timestamp: Date.now(), isEstimate: false },
                  },
                }));
              }
            }).catch(() => {});
          }
        } catch (err) {
          console.error(`[${MODULE_NAME}] Loom Builder: Assembly failed, using ST native assembly:`, err);
        }
      });
    }

    // Subscribe to OAI preset change events persistently.
    // This ensures Loom reasoning settings are restored whenever ST applies a preset.
    subscribeToOAIPresetEvents();

    // Enforce sampler overrides on page load if a Loom preset is already active.
    // CHAT_CHANGED fires later and handles binding resolution, but the initial
    // preset may already be set in the registry before any chat loads. Defer to
    // allow ST's DOM (preset dropdown, sliders) to be fully ready.
    setTimeout(() => {
      try {
        const initialPresetId = resolveBinding();
        if (initialPresetId) {
          const initialPreset = resolveActivePreset();
          if (initialPreset) {
            handleLoomPresetTransition(initialPresetId, initialPreset);
          }
        }
      } catch (err) {
        // Best-effort — CHAT_CHANGED will retry
      }
    }, 1000);
  }

  // Guided Generations — always active, independent of Loom presets.
  // Runs after Loom assembly so user messages exist in the array.
  if (event_types.CHAT_COMPLETION_SETTINGS_READY) {
    eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, (generateData) => {
      try {
        applyGuidesToGeneration(generateData);
      } catch (err) {
        console.error(`[${MODULE_NAME}] Guided Generations: Injection failed:`, err);
      }
    });
  }

  // Initialize persona change listener for Quick Persona feature
  initPersonaListener();

  // Initialize inside jokes cache (fire-and-forget, non-blocking)
  initJokesCache().catch(() => {});

  // Set up MutationObserver for streaming support
  setupLumiaOOCObserver();

  // Process any existing OOC comments on initial load
  scheduleOOCProcessingAfterRender();

  // --- CUSTOM LANDING PAGE ---
  // Render Lumiverse landing page when no chat is open
  // Uses the strategy from the SillyTavern developer guide:
  // - Hide #sheld (opacity: 0, pointer-events: none)
  // - Inject full-screen landing page on top
  let lumiverseLandingContainer = null;
  let originalBodyOverflow = '';

  function renderCustomLanding() {

    // Check if landing page is enabled
    if (!isLandingPageEnabled()) {
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

    if (isChatOpen) {
      // Chat is open - restore sheld and remove landing page
      restoreSheld();
      removeLandingPage();
      return;
    }

    // No chat open - show landing page
    showLandingPage();
  }

  function showLandingPage() {

    // Lock body scroll to prevent underlying content from scrolling
    if (!originalBodyOverflow) {
      originalBodyOverflow = document.body.style.overflow;
    }
    document.body.style.overflow = 'hidden';

    // Hide the default sheld per developer guide
    const sheld = document.querySelector('#sheld');
    if (sheld) {
      sheld.style.opacity = '0';
      sheld.style.pointerEvents = 'none';
    } else {
      console.warn(`[${MODULE_NAME}] #sheld not found!`);
    }

    // Check if landing page already exists
    if (lumiverseLandingContainer) {
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

    // Mount the landing page React component
    if (window.LumiverseUI?.renderLandingPage) {
      window.LumiverseUI.renderLandingPage(lumiverseLandingContainer);
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

  // --- CHAT SHELD OVERRIDE ---
  // Glassmorphic chat redesign that replaces ST's default chat display.
  // Coordination with landing page: mutually exclusive — landing page hides #sheld entirely,
  // chat sheld activates only when a chat IS open (landing page is removed).
  {
    // Give the chat sheld service access to the store for state updates
    if (window.LumiverseUI?.getStore) {
      setChatSheldStoreRef(window.LumiverseUI.getStore());
    }

    let chatSheldCleanup = null;

    function manageChatSheld() {
      if (!isChatSheldEnabled()) {
        // Setting disabled — ensure deactivated
        if (isChatSheldActive()) {
          deactivateChatSheld();
          if (chatSheldCleanup) {
            chatSheldCleanup();
            chatSheldCleanup = null;
          }
          // OOC DOM processing was skipped while chat sheld was active —
          // reprocess now that #chat is visible again
          scheduleOOCProcessingAfterRender();
        }
        return;
      }

      const ctx = getContext();
      const hasChatId = ctx?.chatId !== undefined && ctx?.chatId !== null && ctx?.chatId !== '';
      const isTempChat = ctx?.characterId === undefined &&
                         ctx?.name2 &&
                         ctx?.name2 === ctx?.neutralCharacterName;
      const isChatOpen = hasChatId || isTempChat;

      if (isChatOpen) {
        // Chat is open — activate chat sheld if not already
        if (!isChatSheldActive()) {
          const container = activateChatSheld();
          if (container && window.LumiverseUI?.mountChatSheld) {
            chatSheldCleanup = window.LumiverseUI.mountChatSheld(container);
          }
          // Restore persisted Loom breakdowns on first activation (page refresh)
          loadLoomBreakdowns();
        } else {
          // Already active — reset stale streaming state from previous chat,
          // then tail-first sync for fast visual feedback on chat switch
          resetStreamingState();
          syncTailChat();
          // Restore persisted Loom breakdowns for prompt itemization
          loadLoomBreakdowns();
        }
      } else {
        // No chat open — deactivate chat sheld (landing page handles this state)
        if (isChatSheldActive()) {
          deactivateChatSheld();
          if (chatSheldCleanup) {
            chatSheldCleanup();
            chatSheldCleanup = null;
          }
        }
      }
    }

    // Hook into the same events as the landing page
    if (eventSource && event_types) {
      eventSource.on(event_types.CHAT_CHANGED, manageChatSheld);
      // Also check on APP_READY in case a chat is already open
      eventSource.on(event_types.APP_READY, manageChatSheld);
    }
  }

  // --- CHARACTER BROWSER ---
  // Initialize character browser service with store reference
  if (window.LumiverseUI?.getStore) {
    initCharacterBrowser(window.LumiverseUI.getStore());
  }

  // --- PERSONA MANAGER ---
  // Initialize persona manager service with store reference
  if (window.LumiverseUI?.getStore) {
    initPersonaManager(window.LumiverseUI.getStore());
  }

  // --- WORLD BOOK INTERCEPTOR ---
  // Intercept ST's World Info button to open Lumiverse World Book Editor modal
  if (window.LumiverseUI?.getStore) {
    initWorldBookInterceptor(window.LumiverseUI.getStore());
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

});
