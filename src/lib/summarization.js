/**
 * Summarization Module
 * Handles all summarization logic including API calls, prompt building, and auto-trigger
 */

import { getContext, getRequestHeaders } from "../stContext.js";
import {
  getSettings,
  MODULE_NAME,
  LOOM_SUMMARY_KEY,
  getLumiaConfigVersion,
} from "./settingsManager.js";
import {
  getUserName,
  getCharacterName,
  isGroupChat,
  getGroupMemberNames,
} from "./loomSystem.js";

// Metadata key for tracking last summarized message count
export const LOOM_LAST_SUMMARIZED_KEY = "loom_last_summarized_at";

// Track current spinner element for cleanup
let currentSpinnerElement = null;
// Track the message element that triggered the current summary
let currentSummaryMessageElement = null;
// Track if summarization is currently in progress
let isSummarizing = false;

/**
 * Check if summarization is currently in progress
 * @returns {boolean}
 */
export function getIsSummarizing() {
  return isSummarizing;
}

/**
 * Get the last summarized message count from chat metadata
 * @returns {number} The message count when last summarized, or 0 if never
 */
export function getLastSummarizedCount() {
  const context = getContext();
  if (!context?.chatMetadata?.[LOOM_LAST_SUMMARIZED_KEY]) return 0;
  return context.chatMetadata[LOOM_LAST_SUMMARIZED_KEY].messageCount || 0;
}

/**
 * Store the last summarized message count in chat metadata
 * @param {number} messageCount - The current message count
 */
function storeLastSummarizedCount(messageCount) {
  const context = getContext();
  if (!context?.chatMetadata) return;

  context.chatMetadata[LOOM_LAST_SUMMARIZED_KEY] = {
    messageCount: messageCount,
    timestamp: Date.now(),
  };

  // Note: saveMetadata is called by the caller after this
}

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

// Secret keys mapping from SillyTavern's secrets system
const SECRET_KEYS = {
  OPENAI: "api_key_openai",
  CLAUDE: "api_key_claude",
  OPENROUTER: "api_key_openrouter",
  MAKERSUITE: "api_key_makersuite", // Google AI Studio
  CHUTES: "api_key_chutes",
  ELECTRONHUB: "api_key_electronhub",
  NANOGPT: "api_key_nanogpt",
  ZAI: "api_key_zai",
};

// Provider configuration with endpoints and settings
export const PROVIDER_CONFIG = {
  openai: {
    name: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    secretKey: SECRET_KEYS.OPENAI,
    placeholder: "gpt-4o-mini",
    format: "openai",
  },
  anthropic: {
    name: "Anthropic Claude",
    endpoint: "https://api.anthropic.com/v1/messages",
    secretKey: SECRET_KEYS.CLAUDE,
    placeholder: "claude-sonnet-4-5-20250929",
    format: "anthropic",
  },
  openrouter: {
    name: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    secretKey: SECRET_KEYS.OPENROUTER,
    placeholder: "openai/gpt-4o-mini",
    format: "openai",
  },
  google: {
    name: "Google AI Studio",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    secretKey: SECRET_KEYS.MAKERSUITE,
    placeholder: "gemini-2.0-flash",
    format: "google", // Google's native generateContent API
  },
  chutes: {
    name: "Chutes",
    endpoint: "https://llm.chutes.ai/v1/chat/completions",
    secretKey: SECRET_KEYS.CHUTES,
    placeholder: "deepseek-ai/DeepSeek-V3",
    format: "openai",
  },
  electronhub: {
    name: "ElectronHub",
    endpoint: "https://api.electronhub.ai/v1/chat/completions",
    secretKey: SECRET_KEYS.ELECTRONHUB,
    placeholder: "gpt-4o-mini",
    format: "openai",
  },
  nanogpt: {
    name: "NanoGPT",
    endpoint: "https://nano-gpt.com/api/v1/chat/completions",
    secretKey: SECRET_KEYS.NANOGPT,
    placeholder: "chatgpt-4o-latest",
    format: "openai",
  },
  zai: {
    name: "Z.AI",
    endpoint: "https://api.z.ai/api/paas/v4/chat/completions",
    secretKey: SECRET_KEYS.ZAI,
    placeholder: "gpt-4o-mini",
    format: "openai",
  },
  custom: {
    name: "Custom (OpenAI Compatible)",
    endpoint: "",
    secretKey: null, // User provides their own key
    placeholder: "your-model-id",
    format: "openai",
  },
};

/**
 * Get provider configuration
 * @param {string} provider - The provider name
 * @returns {Object} Provider configuration
 */
export function getProviderConfig(provider) {
  return PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.custom;
}

/**
 * Get default endpoints for known providers (legacy compatibility)
 * @param {string} provider - The provider name
 * @returns {Object} Default endpoint and placeholder model
 */
export function getProviderDefaults(provider) {
  const config = getProviderConfig(provider);
  return {
    endpoint: config.endpoint,
    placeholder: config.placeholder,
  };
}

/**
 * Fetch API key from SillyTavern's secrets system
 * @param {string} secretKey - The secret key identifier
 * @returns {Promise<string|null>} The API key or null if not found
 */
export async function fetchSecretKey(secretKey) {
  if (!secretKey) return null;

  try {
    const response = await fetch("/api/secrets/find", {
      method: "POST",
      headers: getRequestHeaders(),
      body: JSON.stringify({ key: secretKey }),
    });

    if (!response.ok) {
      console.warn(
        `[${MODULE_NAME}] Could not fetch secret key: ${secretKey} (status: ${response.status})`,
      );
      return null;
    }

    const data = await response.json();
    return data.value || null;
  } catch (error) {
    console.error(`[${MODULE_NAME}] Error fetching secret key:`, error);
    return null;
  }
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

  // Get names from context (avoid nested macros)
  const userName = getUserName();
  const inGroup = isGroupChat();
  const charName = getCharacterName();
  const groupMembers = inGroup ? getGroupMemberNames() : [];

  // Build relationship description based on chat type
  let relationshipDesc;
  if (inGroup) {
    const memberList = groupMembers.length > 0 ? groupMembers.join(", ") : "group members";
    relationshipDesc = `Track evolving dynamics between characters (${memberList}) and between characters and ${userName}. Trust, tension, affection, rivalry. (NEVER track ${userName}'s internal state—only how characters perceive or relate to them.)`;
  } else {
    relationshipDesc = `Track evolving dynamics between ${charName} and ${userName}, as well as any NPCs. Trust, tension, affection, rivalry. (NEVER track ${userName}'s internal state—only how characters perceive or relate to them.)`;
  }

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

**Completed Objectives** (MAX 7 items)
Story beats and arcs that have already concluded. Plot points resolved, conflicts addressed, milestones reached.

**Focused Objectives** (MAX 5 items)
Active story threads requiring attention. These can shift or be deviated from at any time but represent current narrative focus.

**Foreshadowing Beats** (MAX 5 items)
Events hinted at or seeded in recent story beats. Potential future complications, promises made, warnings given.

**Character Developments** (MAX 7 items total)
Track meaningful changes in personality, beliefs, skills, or emotional state for each character (NEVER ${userName}).

**Memorable Actions** (MAX 7 items)
Physical actions of significance—combat moves, gestures, gifts exchanged, locations visited. Details that may matter later.

**Memorable Dialogues** (MAX 5 items)
Words that left a mark. Confessions, promises, threats, revelations, or simply beautiful turns of phrase.

**Relationships** (MAX 5 items)
${relationshipDesc}

CRITICAL GUIDELINES:
- Use bullet points under each header for clarity—avoid walls of text
- Be precise and detailed, never sacrifice important information
- Be concise, never pad with redundant or obvious observations
- If a category has no relevant content, write "None at present" rather than inventing filler
- NEVER track or summarize ${userName}'s thoughts, feelings, or internal state
- RESPECT ITEM LIMITS: Each category has a maximum item count. When at capacity, remove the oldest or least relevant item to make room for new ones
- PRESERVE IMPORTANT HISTORY: When removing items, prioritize keeping entries that have ongoing narrative relevance (active plot threads, unresolved tensions, recurring themes)
- CONSOLIDATE when possible: Combine related items into single, more comprehensive bullet points rather than having many fragmented entries`;

  const userPrompt = `${existingSummary ? `**PREVIOUS LOOM SUMMARY** (use this as your foundation—do NOT discard important information):
${existingSummary}

---

**MERGE INSTRUCTIONS:**
- Start with ALL existing entries from the previous summary
- Add new developments from the recent events below
- When a category exceeds its item limit, consolidate related items or remove the least narratively relevant
- NEVER silently drop items that still have ongoing relevance (active conflicts, unresolved threads, important relationships)
- If an item from the previous summary is still relevant but needs updating, modify it rather than removing it

---

` : ""}**RECENT STORY EVENTS** to weave into the summary:

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
 * Generate summary using Secondary LLM
 * Uses SillyTavern's secrets system for API keys (except for custom provider)
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
  const temperature = secondary.temperature || 0.7;
  const topP = secondary.topP !== undefined ? secondary.topP : 1.0;
  const maxTokens = secondary.maxTokens || 8192;

  if (!model) {
    throw new Error("No model specified for secondary LLM");
  }

  // Get provider configuration
  const providerConfig = getProviderConfig(provider);

  // Resolve API key: use ST secrets for known providers, manual key for custom
  let apiKey;
  if (provider === "custom") {
    apiKey = secondary.apiKey;
    if (!apiKey) {
      throw new Error("No API key specified for custom provider");
    }
  } else {
    // Fetch from SillyTavern's secrets system
    apiKey = await fetchSecretKey(providerConfig.secretKey);
    if (!apiKey) {
      throw new Error(
        `No API key found for ${providerConfig.name}. Please add your API key in SillyTavern's API settings.`,
      );
    }
  }

  const prompts = buildSummarizationPrompt(messageContext);
  if (!prompts) {
    throw new Error("No chat messages to summarize");
  }

  // Get endpoint: use provider's predefined endpoint, or custom endpoint for custom provider
  const endpoint =
    provider === "custom"
      ? secondary.endpoint
      : providerConfig.endpoint;

  if (!endpoint) {
    throw new Error("No endpoint specified for secondary LLM");
  }

  console.log(
    `[${MODULE_NAME}] Generating summary with ${providerConfig.name}...`,
  );

  let response;

  if (providerConfig.format === "anthropic") {
    // Get current settings for cache control
    const currentSettings = getSettings();
    const lumiaVersion = getLumiaConfigVersion();

    // Anthropic uses a different API format
    // When cache is disabled, use ephemeral cache_control to force fresh response
    const requestBody = {
      model: model,
      max_tokens: maxTokens,
      system: currentSettings.disableAnthropicCache
        ? [{ type: "text", text: prompts.systemPrompt, cache_control: { type: "ephemeral" } }]
        : prompts.systemPrompt,
      messages: [{ role: "user", content: prompts.userPrompt }],
      temperature: temperature,
      // Include Lumia config version in metadata for debugging
      metadata: {
        lumia_config_version: String(lumiaVersion),
      },
    };
    // Only include top_p if it's not the default (1.0) and not 0 (user wants to omit)
    if (topP > 0 && topP < 1.0) {
      requestBody.top_p = topP;
    }

    // Prepare headers - include beta header for cache control when needed
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };

    // Add beta header for prompt caching API when cache control is being used
    if (currentSettings.disableAnthropicCache) {
      headers["anthropic-beta"] = "prompt-caching-2024-07-31";
      console.log(`[${MODULE_NAME}] Cache busting enabled for this request (Lumia config v${lumiaVersion})`);
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
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Anthropic returns content as an array of blocks
    if (data.content && Array.isArray(data.content)) {
      const textBlock = data.content.find((block) => block.type === "text");
      return textBlock?.text || "";
    }
    return "";
  } else if (providerConfig.format === "google") {
    // Google AI Studio uses generateContent API
    // Endpoint format: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
    const googleEndpoint = `${endpoint}/${model}:generateContent`;

    // Google uses a different message format with "contents" array
    // System prompt is prepended as a user message, followed by actual user prompt
    const requestBody = {
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
      ],
      contents: [
        {
          role: "user",
          parts: [{ text: `${prompts.systemPrompt}\n\n---\n\n${prompts.userPrompt}` }],
        },
      ],
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: maxTokens,
      },
    };
    // Only include topP if it's not the default (1.0) and not 0 (user wants to omit)
    if (topP > 0 && topP < 1.0) {
      requestBody.generationConfig.topP = topP;
    }

    response = await fetch(googleEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => "Unable to read error");
      throw new Error(`Google AI Studio API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Google returns candidates array with content.parts
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }
    return "";
  } else {
    // OpenAI-compatible format (most providers)
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
    // Only include top_p if it's not the default (1.0) and not 0 (user wants to omit)
    if (topP > 0 && topP < 1.0) {
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
      throw new Error(`${providerConfig.name} API error: ${response.status} - ${errorText}`);
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

      // Track when we summarized (message count) for auto-summary interval
      storeLastSummarizedCount(context.chat.length);

      await context.saveMetadata();
      console.log(`[${MODULE_NAME}] Summary saved to chat metadata at message ${context.chat.length}`);

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
 * Check if auto-summarization should trigger based on messages since last summary
 */
export function checkAutoSummarization() {
  // Don't trigger if already summarizing
  if (isSummarizing) return;

  const settings = getSettings();
  const sumSettings = settings.summarization;
  if (!sumSettings || sumSettings.mode !== "auto") return;

  const context = getContext();
  if (!context || !context.chat) return;

  const interval = sumSettings.autoInterval || 10;
  const currentMessageCount = context.chat.length;

  // Get the last summarized count from chat metadata
  const lastSummarizedAt = getLastSummarizedCount();

  // Calculate how many messages since last summary
  const messagesSinceLastSummary = currentMessageCount - lastSummarizedAt;

  // Trigger if we've accumulated enough new messages since last summary
  // Also ensure we have at least 'interval' messages total (don't trigger on tiny chats)
  if (currentMessageCount >= interval && messagesSinceLastSummary >= interval) {
    console.log(
      `[${MODULE_NAME}] Auto-summarization triggered: ${messagesSinceLastSummary} messages since last summary (at ${lastSummarizedAt}), current count: ${currentMessageCount}`,
    );

    // Set summarizing state for UI feedback
    isSummarizing = true;

    // Import and call UI update dynamically to avoid circular dependency
    import("./uiModals.js")
      .then(({ updateLoomSummaryButtonState }) => {
        updateLoomSummaryButtonState();
      })
      .catch(() => {});

    // Pass showVisualFeedback=true for auto-summarization to show spinner
    generateLoomSummary(null, false, true)
      .then((result) => {
        isSummarizing = false;
        // Update UI state after completion
        import("./uiModals.js")
          .then(({ updateLoomSummaryButtonState }) => {
            updateLoomSummaryButtonState();
          })
          .catch(() => {});

        if (result) {
          toastr.info("Loom summary updated automatically");
        }
      })
      .catch((error) => {
        isSummarizing = false;
        import("./uiModals.js")
          .then(({ updateLoomSummaryButtonState }) => {
            updateLoomSummaryButtonState();
          })
          .catch(() => {});
        console.error(`[${MODULE_NAME}] Auto-summarization failed:`, error);
      });
  }
}
