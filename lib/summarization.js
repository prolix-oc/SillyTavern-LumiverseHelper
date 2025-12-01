/**
 * Summarization Module
 * Handles all summarization logic including API calls, prompt building, and auto-trigger
 */

import { getContext } from "../../../../extensions.js";
import {
  getSettings,
  MODULE_NAME,
  LOOM_SUMMARY_KEY,
} from "./settingsManager.js";

// Track current spinner element for cleanup
let currentSpinnerElement = null;
// Track the message element that triggered the current summary
let currentSummaryMessageElement = null;

// SVG Icons for summary indicators
const LOOM_SPOOL_SVG = `<svg class="loom-summary-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="12" cy="12" rx="8" ry="10" stroke="currentColor" stroke-width="1.5" fill="none"/>
  <ellipse cx="12" cy="12" rx="3" ry="10" stroke="currentColor" stroke-width="1.5" fill="none"/>
  <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.5"/>
  <line x1="4" y1="16" x2="20" y2="16" stroke="currentColor" stroke-width="1.5"/>
  <circle cx="12" cy="12" r="2" fill="currentColor"/>
</svg>`;

const LOOM_ERROR_SVG = `<svg class="loom-summary-icon loom-summary-icon-error" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" fill="none"/>
  <path d="M15 9L9 15M9 9L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`;

/**
 * Get the message ID from a message element
 * @param {HTMLElement} messageElement - The message DOM element
 * @returns {string|null} The message ID or null
 */
function getMessageId(messageElement) {
  return messageElement?.getAttribute("mesid") || null;
}

/**
 * Find message element by its mesid
 * @param {string} mesId - The message ID
 * @returns {HTMLElement|null} The message element or null
 */
function findMessageByMesId(mesId) {
  if (!mesId) return null;
  return document.querySelector(`.mes[mesid="${mesId}"]`);
}

/**
 * Show a loading spinner on the last message's timestamp area
 * @param {string} status - "loading", "complete", or "error"
 * @param {string} [message] - Optional message to display
 */
function showSummaryIndicator(status, message = "") {
  // Remove any existing temporary indicator (spinner)
  hideSummaryIndicator();

  // Find the last message's timestamp element
  const chatElement = document.getElementById("chat");
  if (!chatElement) return;

  const lastMessage = chatElement.querySelector(".mes:last-child");
  if (!lastMessage) return;

  const timestampElement = lastMessage.querySelector(".timestamp");
  if (!timestampElement) return;

  // Track which message we're summarizing
  currentSummaryMessageElement = lastMessage;

  // Create the indicator
  const indicator = document.createElement("span");
  indicator.className = "loom-summary-indicator";
  indicator.id = "loom-summary-indicator";

  if (status === "loading") {
    indicator.innerHTML = `<span class="loom-summary-spinner"></span><span>Weaving summary...</span>`;
    timestampElement.appendChild(indicator);
    currentSpinnerElement = indicator;
  } else if (status === "complete") {
    // For complete status, add a persistent marker
    addPersistentSummaryMarker(lastMessage, "complete");
  } else if (status === "error") {
    // For error status, add a persistent error marker
    addPersistentSummaryMarker(lastMessage, "error");
  }
}

/**
 * Add a persistent summary marker to a message (thread spool or error X)
 * @param {HTMLElement} messageElement - The message element
 * @param {string} type - "complete" or "error"
 */
function addPersistentSummaryMarker(messageElement, type) {
  if (!messageElement) return;

  const timestampElement = messageElement.querySelector(".timestamp");
  if (!timestampElement) return;

  // Remove any existing persistent marker on this message
  const existingMarker = timestampElement.querySelector(".loom-summary-marker");
  if (existingMarker) {
    existingMarker.remove();
  }

  // Create the persistent marker
  const marker = document.createElement("span");
  marker.className = "loom-summary-marker";
  marker.setAttribute("data-summary-type", type);

  if (type === "complete") {
    marker.classList.add("loom-summary-marker-complete");
    marker.innerHTML = LOOM_SPOOL_SVG;
    marker.title = "Summary woven up to this message";
  } else if (type === "error") {
    marker.classList.add("loom-summary-marker-error");
    marker.innerHTML = LOOM_ERROR_SVG;
    marker.title = "Summary generation failed at this message";
  }

  timestampElement.appendChild(marker);

  // Store the message ID in chat metadata for persistence across reloads
  const mesId = getMessageId(messageElement);
  if (mesId) {
    storeSummaryMarkerInMetadata(mesId, type);
  }
}

/**
 * Store summary marker info in chat metadata
 * @param {string} mesId - The message ID
 * @param {string} type - "complete" or "error"
 */
function storeSummaryMarkerInMetadata(mesId, type) {
  const context = getContext();
  if (!context?.chatMetadata) return;

  // Store the last summarized message info
  context.chatMetadata.loom_summary_marker = {
    mesId: mesId,
    type: type,
    timestamp: Date.now(),
  };

  // Save metadata (don't await, fire and forget)
  context.saveMetadata?.();
}

/**
 * Restore summary markers from chat metadata (call on chat load)
 */
export function restoreSummaryMarkers() {
  const context = getContext();
  if (!context?.chatMetadata?.loom_summary_marker) return;

  const markerInfo = context.chatMetadata.loom_summary_marker;
  if (!markerInfo.mesId) return;

  const messageElement = findMessageByMesId(markerInfo.mesId);
  if (messageElement) {
    addPersistentSummaryMarker(messageElement, markerInfo.type);
  }
}

/**
 * Hide/remove the temporary summary indicator (spinner only)
 */
function hideSummaryIndicator() {
  if (currentSpinnerElement) {
    currentSpinnerElement.remove();
    currentSpinnerElement = null;
  }
  // Also clean up by ID in case reference was lost
  const existing = document.getElementById("loom-summary-indicator");
  if (existing) {
    existing.remove();
  }
}

/**
 * Get default endpoints for known providers
 * @param {string} provider - The provider name
 * @returns {Object} Default endpoint and placeholder model
 */
export function getProviderDefaults(provider) {
  const defaults = {
    openai: {
      endpoint: "https://api.openai.com/v1/chat/completions",
      placeholder: "gpt-4o-mini",
    },
    anthropic: {
      endpoint: "https://api.anthropic.com/v1/messages",
      placeholder: "claude-sonnet-4-5-20250929",
    },
    openrouter: {
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      placeholder: "openai/gpt-4o-mini",
    },
    custom: {
      endpoint: "",
      placeholder: "your-model-id",
    },
  };
  return defaults[provider] || defaults.custom;
}

/**
 * Build the summarization prompt with chat context
 * @param {number} messageContext - Number of messages to include
 * @returns {Object|null} Object with systemPrompt and userPrompt, or null if no messages
 */
export function buildSummarizationPrompt(messageContext) {
  const context = getContext();
  if (!context || !context.chat) return null;

  const chat = context.chat;
  const recentMessages = chat.slice(-messageContext);

  if (recentMessages.length === 0) {
    return null;
  }

  // Get existing summary if any
  const existingSummary = context.chatMetadata?.[LOOM_SUMMARY_KEY] || "";

  // Build conversation text
  let conversationText = "";
  recentMessages.forEach((msg) => {
    const role = msg.is_user ? msg.name || "User" : msg.name || "Character";
    let content = msg.mes || msg.content || "";

    // Strip any existing loom_sum blocks from the content
    content = content.replace(/<loom_sum>[\s\S]*?<\/loom_sum>/gi, "").trim();

    if (content) {
      conversationText += `${role}: ${content}\n\n`;
    }
  });

  const systemPrompt = `You are a Lucid Loom narrative archivist for interactive fiction and roleplay. Your task is to weave comprehensive story summaries that maintain narrative continuity while capturing the essence of the tale.

Your summary MUST use this exact structured format with clear headers:

**Completed Objectives**
Story beats and arcs that have already concluded. Plot points resolved, conflicts addressed, milestones reached.

**Focused Objectives**
Active story threads requiring attention. These can shift or be deviated from at any time but represent current narrative focus.

**Foreshadowing Beats**
Events hinted at or seeded in recent story beats. Potential future complications, promises made, warnings given.

**Character Developments**
Track meaningful changes in personality, beliefs, skills, or emotional state for each character (NEVER the {{user}}).

**Memorable Actions**
Physical actions of significance—combat moves, gestures, gifts exchanged, locations visited. Details that may matter later.

**Memorable Dialogues**
Words that left a mark. Confessions, promises, threats, revelations, or simply beautiful turns of phrase.

**Relationships**
Track evolving dynamics between characters and between characters and {{user}}. Trust, tension, affection, rivalry. (NEVER track {{user}}'s internal state—only how characters perceive or relate to them.)

CRITICAL GUIDELINES:
- Use bullet points under each header for clarity—avoid walls of text
- Be precise and detailed, never sacrifice important information
- Be concise, never pad with redundant or obvious observations
- If a category has no relevant content, write "None at present" rather than inventing filler
- NEVER track or summarize {{user}}'s thoughts, feelings, or internal state`;

  const userPrompt = `${existingSummary ? `Previous Loom Summary to build upon:\n${existingSummary}\n\n---\n\n` : ""}Recent story events to weave into the summary:

${conversationText}

Provide an updated Loom Summary incorporating these new events. Use the exact structured format with all seven headers. Output ONLY the summary content—no meta-commentary or additional formatting.`;

  return { systemPrompt, userPrompt };
}

/**
 * Generate summary using Main API (SillyTavern's generateRaw)
 * @param {Object} sumSettings - Summarization settings
 * @param {number} messageContext - Number of messages to include
 * @returns {Promise<string>} The generated summary
 */
export async function generateSummaryWithMainAPI(sumSettings, messageContext) {
  const { generateRaw } = getContext();

  if (!generateRaw) {
    throw new Error(
      "generateRaw not available - is SillyTavern properly loaded?",
    );
  }

  const prompts = buildSummarizationPrompt(messageContext);
  if (!prompts) {
    throw new Error("No chat messages to summarize");
  }

  console.log(`[${MODULE_NAME}] Generating summary with Main API...`);

  const result = await generateRaw({
    systemPrompt: prompts.systemPrompt,
    prompt: prompts.userPrompt,
    prefill: "",
  });

  return result;
}

/**
 * Generate summary using Secondary LLM (custom endpoint)
 * @param {Object} sumSettings - Summarization settings
 * @param {number} messageContext - Number of messages to include
 * @returns {Promise<string>} The generated summary
 */
export async function generateSummaryWithSecondaryLLM(
  sumSettings,
  messageContext,
) {
  const secondary = sumSettings.secondary || {};
  const provider = secondary.provider || "openai";
  const model = secondary.model;
  const apiKey = secondary.apiKey;
  const temperature = secondary.temperature || 0.7;
  const topP = secondary.topP !== undefined ? secondary.topP : 1.0;
  const maxTokens = secondary.maxTokens || 8192;

  if (!model) {
    throw new Error("No model specified for secondary LLM");
  }

  if (!apiKey) {
    throw new Error("No API key specified for secondary LLM");
  }

  const prompts = buildSummarizationPrompt(messageContext);
  if (!prompts) {
    throw new Error("No chat messages to summarize");
  }

  // Get endpoint (use default if not specified)
  const defaults = getProviderDefaults(provider);
  const endpoint = secondary.endpoint || defaults.endpoint;

  if (!endpoint) {
    throw new Error("No endpoint specified for secondary LLM");
  }

  console.log(
    `[${MODULE_NAME}] Generating summary with Secondary LLM (${provider})...`,
  );

  let response;

  if (provider === "anthropic") {
    // Anthropic uses a different API format
    const requestBody = {
      model: model,
      max_tokens: maxTokens,
      system: prompts.systemPrompt,
      messages: [{ role: "user", content: prompts.userPrompt }],
      temperature: temperature,
    };
    // Only include top_p if it's not the default (1.0)
    if (topP < 1.0) {
      requestBody.top_p = topP;
    }

    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => "Unable to read error");
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Anthropic returns content as an array of blocks
    if (data.content && Array.isArray(data.content)) {
      const textBlock = data.content.find((block) => block.type === "text");
      return textBlock?.text || "";
    }
    return "";
  } else {
    // OpenAI-compatible format (OpenAI, OpenRouter, Custom)
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    // OpenRouter requires additional headers
    if (provider === "openrouter") {
      headers["HTTP-Referer"] = window.location.origin;
      headers["X-Title"] = "Lumia Injector";
    }

    const requestBody = {
      model: model,
      messages: [
        { role: "system", content: prompts.systemPrompt },
        { role: "user", content: prompts.userPrompt },
      ],
      temperature: temperature,
      max_tokens: maxTokens,
    };
    // Only include top_p if it's not the default (1.0)
    if (topP < 1.0) {
      requestBody.top_p = topP;
    }

    response = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => "Unable to read error");
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Standard OpenAI format
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    return "";
  }
}

/**
 * Main function to generate a loom summary
 * @param {Object} overrideSettings - Optional settings override for testing
 * @param {boolean} isManual - Whether this is a manual trigger (uses manualMessageContext)
 * @param {boolean} showVisualFeedback - Whether to show spinner/indicator in chat
 * @returns {Promise<string|null>} The generated summary or null
 */
export async function generateLoomSummary(
  overrideSettings = null,
  isManual = false,
  showVisualFeedback = false,
) {
  const settings = getSettings();
  const sumSettings = overrideSettings || settings.summarization;

  if (!sumSettings) {
    console.log(`[${MODULE_NAME}] Summarization not configured`);
    return null;
  }

  const context = getContext();
  if (!context || !context.chat || context.chat.length === 0) {
    console.log(`[${MODULE_NAME}] No chat to summarize`);
    return null;
  }

  // Determine which message context to use based on trigger type
  const messageContext = isManual
    ? sumSettings.manualMessageContext || 10
    : sumSettings.autoMessageContext || 10;

  console.log(
    `[${MODULE_NAME}] Using ${isManual ? "manual" : "auto"} message context: ${messageContext} messages`,
  );

  // Show loading indicator if visual feedback is enabled
  if (showVisualFeedback) {
    showSummaryIndicator("loading");
  }

  try {
    let summaryText;

    if (sumSettings.apiSource === "main") {
      summaryText = await generateSummaryWithMainAPI(
        sumSettings,
        messageContext,
      );
    } else if (sumSettings.apiSource === "secondary") {
      summaryText = await generateSummaryWithSecondaryLLM(
        sumSettings,
        messageContext,
      );
    } else {
      if (showVisualFeedback) {
        showSummaryIndicator("error", "Invalid API source");
      }
      throw new Error(`Unknown API source: ${sumSettings.apiSource}`);
    }

    if (summaryText && summaryText.trim()) {
      // Store the summary in chat metadata
      context.chatMetadata[LOOM_SUMMARY_KEY] = summaryText.trim();
      await context.saveMetadata();
      console.log(`[${MODULE_NAME}] Summary saved to chat metadata`);

      // Show completion indicator
      if (showVisualFeedback) {
        showSummaryIndicator("complete");
      }

      return summaryText.trim();
    }

    // No summary generated
    if (showVisualFeedback) {
      hideSummaryIndicator();
    }
    return null;
  } catch (error) {
    console.error(`[${MODULE_NAME}] Summary generation failed:`, error);

    // Show error indicator
    if (showVisualFeedback) {
      showSummaryIndicator("error");
    }

    throw error;
  }
}

/**
 * Check if auto-summarization should trigger
 */
export function checkAutoSummarization() {
  const settings = getSettings();
  const sumSettings = settings.summarization;
  if (!sumSettings || sumSettings.mode !== "auto") return;

  const context = getContext();
  if (!context || !context.chat) return;

  const interval = sumSettings.autoInterval || 10;
  const messageCount = context.chat.length;

  // Trigger when message count is divisible by interval
  if (messageCount > 0 && messageCount % interval === 0) {
    console.log(
      `[${MODULE_NAME}] Auto-summarization triggered at message ${messageCount}`,
    );
    // Pass showVisualFeedback=true for auto-summarization to show spinner
    generateLoomSummary(null, false, true)
      .then((result) => {
        if (result) {
          toastr.info("Loom summary updated automatically");
        }
      })
      .catch((error) => {
        console.error(`[${MODULE_NAME}] Auto-summarization failed:`, error);
      });
  }
}
