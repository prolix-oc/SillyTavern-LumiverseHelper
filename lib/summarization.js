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

  const systemPrompt = `You are a narrative summarization assistant for interactive fiction and roleplay. Your task is to create comprehensive story summaries that maintain narrative continuity.

When summarizing, capture:
1. **Completed Story Beats** - Major plot points that have concluded, character arcs resolved, conflicts addressed
2. **Ongoing Story Beats** - Active plot threads, unresolved tensions, goals being pursued
3. **Looming Elements** - Foreshadowed events, building complications, story seeds planted
4. **Current Scene Context** - Location, time, atmosphere, recent environmental changes
5. **Character Status** - What each character is doing, their emotional state, recent significant actions

Format your summary as dense but readable prose. Prioritize information essential for maintaining story continuity.`;

  const userPrompt = `${existingSummary ? `Previous summary for context:\n${existingSummary}\n\n` : ""}Recent conversation to summarize:

${conversationText}

Please provide an updated comprehensive summary of the story so far, incorporating the new events. Output ONLY the summary content - no tags, labels, or formatting markers.`;

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
 * @returns {Promise<string|null>} The generated summary or null
 */
export async function generateLoomSummary(
  overrideSettings = null,
  isManual = false,
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
      throw new Error(`Unknown API source: ${sumSettings.apiSource}`);
    }

    if (summaryText && summaryText.trim()) {
      // Store the summary in chat metadata
      context.chatMetadata[LOOM_SUMMARY_KEY] = summaryText.trim();
      await context.saveMetadata();
      console.log(`[${MODULE_NAME}] Summary saved to chat metadata`);
      return summaryText.trim();
    }

    return null;
  } catch (error) {
    console.error(`[${MODULE_NAME}] Summary generation failed:`, error);
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
    generateLoomSummary()
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
