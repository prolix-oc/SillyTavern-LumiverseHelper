/**
 * Loom System Module
 * Handles Loom conditionals, summary capture, and summary display
 */

import { getContext } from "../stContext.js";
import {
  MODULE_NAME,
  LOOM_SUMMARY_KEY,
  getSettings,
} from "./settingsManager.js";

// Store the last user message content for the macro and interceptor
let lastUserMessageContent = "";

// Track whether a user message was captured during the current generation
// This helps distinguish between "user sent message" vs "continue/regenerate after character"
let capturedUserMessageThisGeneration = false;

/**
 * Get the last user message content (captured during generation)
 * @returns {string} The last user message content
 */
export function getLastUserMessageContent() {
  return lastUserMessageContent;
}

/**
 * Set the last user message content
 * @param {string} content - The message content
 */
export function setLastUserMessageContent(content) {
  lastUserMessageContent = content;
}

/**
 * Get whether a user message was captured during this generation
 * @returns {boolean} True if user message was captured
 */
export function getCapturedUserMessageFlag() {
  return capturedUserMessageThisGeneration;
}

/**
 * Set whether a user message was captured during this generation
 * @param {boolean} captured - Whether a user message was captured
 */
export function setCapturedUserMessageFlag(captured) {
  capturedUserMessageThisGeneration = captured;
}

/**
 * Find and return the last user message from the chat
 * @returns {string} The last user message content, or empty string if not found
 */
export function findLastUserMessage() {
  const context = getContext();
  if (!context || !context.chat) return "";

  // Search from newest to oldest for the last user message
  for (let i = context.chat.length - 1; i >= 0; i--) {
    const message = context.chat[i];
    if (message.is_user) {
      return message.mes || message.content || "";
    }
  }

  return "";
}

/**
 * Check if the character (non-user) was the last to speak
 * @returns {boolean} True if last message is from character, false if from user
 */
export function wasCharacterLastSpeaker() {
  const context = getContext();
  if (!context || !context.chat || context.chat.length === 0) {
    return false;
  }
  const lastMessage = context.chat[context.chat.length - 1];
  return lastMessage && !lastMessage.is_user;
}

/**
 * Get the name of whoever sent the last message in chat
 * @returns {string} The name from the last message, or empty string if not found
 */
export function getLastMessageName() {
  const context = getContext();
  if (!context || !context.chat || context.chat.length === 0) {
    return "";
  }
  const lastMessage = context.chat[context.chat.length - 1];
  return lastMessage?.name || "";
}

/**
 * Get the last character (non-user) message content from the chat
 * @returns {string} The last character message content, or empty string if not found
 */
export function getLastCharMessageContent() {
  const context = getContext();
  if (!context || !context.chat) return "";

  // Search from newest to oldest for the last character message
  for (let i = context.chat.length - 1; i >= 0; i--) {
    const message = context.chat[i];
    if (message && !message.is_user) {
      return message.mes || message.content || "";
    }
  }

  return "";
}

/**
 * Check if the current chat is a group chat
 * @returns {boolean} True if in a group chat
 */
export function isGroupChat() {
  const context = getContext();
  return !!context?.groupId;
}

/**
 * Get the names of all members in the current group chat
 * Group members are stored as avatar filenames, so we need to look up the character names
 * @returns {string[]} Array of character names in the group, empty if not in a group
 */
export function getGroupMemberNames() {
  const context = getContext();
  if (!context?.groupId || !context?.groups || !context?.characters) {
    return [];
  }

  // Find the current group
  const group = context.groups.find(g => g.id === context.groupId);
  if (!group?.members || !Array.isArray(group.members)) {
    return [];
  }

  // Map avatar filenames to character names
  return group.members
    .map(avatar => context.characters.find(c => c.avatar === avatar)?.name)
    .filter(Boolean);
}

/**
 * Get the user name from context
 * @returns {string} The user's name or fallback
 */
export function getUserName() {
  const context = getContext();
  return context?.name1 || "the user";
}

/**
 * Get the character name from context (for non-group chats)
 * @returns {string} The character's name or fallback
 */
export function getCharacterName() {
  const context = getContext();
  // name2 is the current character name
  // Fall back to looking up by characterId if name2 is empty
  return context?.name2 ||
    context?.characters?.[context?.characterId]?.name ||
    "the character";
}

/**
 * Process loomIf conditional blocks in content
 * Supports:
 *   - Truthiness: {{loomIf condition="value"}} - true if non-empty
 *   - Equality: {{loomIf condition="a" equals="b"}} - true if a === b
 *   - Not equals: {{loomIf condition="a" notEquals="b"}} - true if a !== b
 *   - Contains: {{loomIf condition="haystack" contains="needle"}} - true if haystack includes needle
 *   - Greater than: {{loomIf condition="5" gt="3"}} - true if 5 > 3 (numeric)
 *   - Less than: {{loomIf condition="3" lt="5"}} - true if 3 < 5 (numeric)
 *   - Greater than or equal: {{loomIf condition="5" gte="3"}} - true if 5 >= 3
 *   - Less than or equal: {{loomIf condition="3" lte="5"}} - true if 3 <= 5
 *
 * @param {string} content - The content to process
 * @returns {string} - Content with conditionals evaluated
 */
export function processLoomConditionals(content) {
  if (!content || typeof content !== "string") return content;

  // Quick check - if no loomIf, skip processing
  if (!content.includes("{{loomIf")) return content;

  let processed = content;
  let iterations = 0;
  const maxIterations = 50; // Prevent infinite loops, allow for nested conditionals

  // Regex to match loomIf blocks (non-greedy, handles nested by processing innermost first)
  // This pattern matches the innermost {{loomIf}}...{{/loomIf}} blocks first
  const loomIfRegex =
    /\{\{loomIf\s+condition="([^"]*)"(?:\s+(equals|notEquals|contains|gt|lt|gte|lte)="([^"]*)")?\s*\}\}([\s\S]*?)\{\{\/loomIf\}\}/;

  while (loomIfRegex.test(processed) && iterations < maxIterations) {
    processed = processed.replace(
      loomIfRegex,
      (match, condition, operator, compareValue, innerContent) => {
        // Split inner content into if/else parts
        const elseSplit = innerContent.split(/\{\{loomElse\}\}/);
        const ifContent = elseSplit[0] || "";
        const elseContent = elseSplit[1] || "";

        // Evaluate the condition
        let result = false;
        const conditionTrimmed = condition.trim();

        if (!operator) {
          // Truthiness check - non-empty string is true
          result = conditionTrimmed.length > 0;
        } else {
          const compareTrimmed = (compareValue || "").trim();

          switch (operator) {
            case "equals":
              result = conditionTrimmed === compareTrimmed;
              break;
            case "notEquals":
              result = conditionTrimmed !== compareTrimmed;
              break;
            case "contains":
              result = conditionTrimmed.includes(compareTrimmed);
              break;
            case "gt":
              result =
                parseFloat(conditionTrimmed) > parseFloat(compareTrimmed);
              break;
            case "lt":
              result =
                parseFloat(conditionTrimmed) < parseFloat(compareTrimmed);
              break;
            case "gte":
              result =
                parseFloat(conditionTrimmed) >= parseFloat(compareTrimmed);
              break;
            case "lte":
              result =
                parseFloat(conditionTrimmed) <= parseFloat(compareTrimmed);
              break;
            default:
              result = false;
          }
        }

        // Return the appropriate content based on result
        return result ? ifContent : elseContent;
      },
    );

    iterations++;
  }

  if (iterations >= maxIterations) {
    console.warn(
      `[${MODULE_NAME}] loomIf processing hit max iterations - possible malformed conditionals`,
    );
  }

  return processed;
}

/**
 * Extract loom_sum content from a message string
 * @param {string} content - The message content to search
 * @returns {string|null} The extracted summary content, or null if not found
 */
export function extractLoomSummary(content) {
  if (!content || typeof content !== "string") return null;

  const match = content.match(/<loom_sum>([\s\S]*?)<\/loom_sum>/);
  return match ? match[1].trim() : null;
}

/**
 * Scan chat messages for the most recent loom_sum and save to chat metadata
 * Searches from newest to oldest, saves the first (most recent) found
 */
export async function captureLoomSummary() {
  const context = getContext();
  if (!context || !context.chat || !context.chatMetadata) return;

  // Search from newest message to oldest
  for (let i = context.chat.length - 1; i >= 0; i--) {
    const message = context.chat[i];
    const content = message.mes || message.content || "";
    const summary = extractLoomSummary(content);

    if (summary) {
      // Only update if different from current
      if (context.chatMetadata[LOOM_SUMMARY_KEY] !== summary) {
        context.chatMetadata[LOOM_SUMMARY_KEY] = summary;
        await context.saveMetadata();
        console.log(`[${MODULE_NAME}] Captured loom summary from message ${i}`);
      }
      return; // Found most recent, stop searching
    }
  }
}

/**
 * Get the stored loom summary from chat metadata
 * @returns {string} The stored summary, or empty string if none
 */
export function getLoomSummary() {
  const context = getContext();
  if (!context || !context.chatMetadata) return "";
  return context.chatMetadata[LOOM_SUMMARY_KEY] || "";
}

/**
 * Hide loom_sum blocks in a message element
 * @param {HTMLElement} messageElement - The .mes_text element to process
 */
export function hideLoomSumBlocks(messageElement) {
  if (!messageElement) return;

  const html = messageElement.innerHTML;
  if (!html.includes("<loom_sum>") && !html.includes("&lt;loom_sum&gt;"))
    return;

  // Handle both raw tags and HTML-escaped tags
  const updatedHtml = html
    .replace(
      /<loom_sum>[\s\S]*?<\/loom_sum>/gi,
      '<span class="loom-sum-hidden" style="display:none;"></span>',
    )
    .replace(
      /&lt;loom_sum&gt;[\s\S]*?&lt;\/loom_sum&gt;/gi,
      '<span class="loom-sum-hidden" style="display:none;"></span>',
    );

  if (updatedHtml !== html) {
    messageElement.innerHTML = updatedHtml;
    console.log(`[${MODULE_NAME}] Hidden loom_sum block in message`);
  }
}

/**
 * Register Loom-related macros with MacrosParser
 * Updated for SillyTavern 1.15 Macros 2.0 system
 *
 * Macro syntax for Macros 2.0:
 * - Arguments use :: separator: {{macro::arg}}
 * - Handlers destructure from context: ({ unnamedArgs: [arg], resolve }) => {...}
 *
 * @param {Object} MacrosParser - The SillyTavern MacrosParser instance
 */
export function registerLoomMacros(MacrosParser) {
  console.log("[LumiverseHelper] Registering Loom macros (Macros 2.0 format)...");

  // Register loomSummary macro - injects the stored summary
  MacrosParser.registerMacro("loomSummary", {
    delayArgResolution: true,
    handler: ({ resolve }) => {
      const result = getLoomSummary();
      // Resolve any nested macros in the summary content
      return resolve ? resolve(result) : result;
    },
    description: "Returns the stored Loom summary from chat metadata, captured from the most recent <loom_sum> block.",
    returns: "Summary text or empty string if no summary exists",
    returnType: "string",
    exampleUsage: ["{{loomSummary}}"],
  });

  // Register loomSummaryPrompt macro - injects the summarization directive
  // Adapts to group chats by listing all group members
  MacrosParser.registerMacro("loomSummaryPrompt", {
    delayArgResolution: true,
    handler: ({ resolve }) => {
      const userName = getUserName();
      const inGroup = isGroupChat();

      // Build character status section based on chat type
      let characterStatusSection;
      if (inGroup) {
        const memberNames = getGroupMemberNames();
        const memberLines = memberNames.length > 0
          ? memberNames.map(name => `- What ${name} is currently doing/saying and their apparent emotional state`).join("\n")
          : "- What each group member is currently doing/saying and their apparent emotional state";

        characterStatusSection = `**CHARACTER STATUS (GROUP CHAT - ${memberNames.length} members):**
- What ${userName} is currently doing/saying and their apparent emotional state
${memberLines}
- Dynamics and interactions between group members
- Recent significant actions or dialogue from each party`;
      } else {
        const charName = getCharacterName();
        characterStatusSection = `**CHARACTER STATUS:**
- What ${userName} is currently doing/saying and their apparent emotional state
- What ${charName} is currently doing/saying and their apparent emotional state
- Other present NPCs: their actions, positions, and relevance to the scene
- Recent significant actions or dialogue from each party`;
      }

      const result = `<loom_summary_directive>
When the current narrative segment reaches a natural pause or transition point, provide a comprehensive summary wrapped in <loom_sum></loom_sum> tags. This summary serves as persistent story memory and must capture:

**COMPLETED STORY BEATS:**
- Major plot points that have concluded
- Character arcs or development moments that have resolved
- Conflicts or tensions that have been addressed
- Discoveries, revelations, or turning points that occurred

**ONGOING STORY BEATS:**
- Active plot threads currently in motion
- Unresolved tensions or conflicts
- Character goals being actively pursued
- Relationships in states of change or development

**LOOMING ELEMENTS:**
- Foreshadowed events or approaching complications
- Potential "shake ups" building in the narrative
- Unaddressed threats or opportunities
- Story seeds planted but not yet sprouted

**CURRENT SCENE CONTEXT:**
- Physical location and environment details
- Time of day and approximate date/timeframe
- Atmosphere, mood, and ambient conditions
- Recent environmental changes or notable features

${characterStatusSection}

Format the summary as dense but readable prose, preserving enough detail that the narrative could be resumed naturally from this point. Prioritize information that would be essential for maintaining story continuity.
</loom_summary_directive>`;
      // Resolve any nested macros in the content
      return resolve ? resolve(result) : result;
    },
    description: "Returns the Loom summarization directive prompt. Adapts to group chats by listing all members.",
    returns: "Full summarization instruction wrapped in <loom_summary_directive> tags",
    returnType: "string",
    exampleUsage: ["{{loomSummaryPrompt}}"],
  });

  // Register loomLastUserMessage macro - returns the last user message content
  // Only active when Sovereign Hand features are enabled
  // Reads directly from chat for real-time updates on edits/deletions
  MacrosParser.registerMacro("loomLastUserMessage", {
    delayArgResolution: true,
    handler: ({ resolve }) => {
      const settings = getSettings();
      if (!settings.sovereignHand?.enabled) {
        return "";
      }
      // Read directly from chat for real-time updates
      // Falls back to captured content if chat is not available
      const liveContent = findLastUserMessage();
      const result = liveContent || getLastUserMessageContent();
      // Resolve any nested macros in the user message content
      return resolve ? resolve(result) : result;
    },
    description: "Returns the last user message content. Only active when Sovereign Hand is enabled.",
    returns: "User message text or empty string",
    returnType: "string",
    exampleUsage: ["{{loomLastUserMessage}}"],
  });

  // Register loomSovHandActive macro - returns Yes/No status in ST Conditional Macro Compatible format.
  MacrosParser.registerMacro("loomSovHandActive", {
    handler: () => {
      const settings = getSettings();
      return settings.sovereignHand?.enabled ? "yes" : "no";
    },
    description: "Returns Sovereign Hand status indicator. ST Conditional Compatible.",
    returns: "'yes' if enabled, 'no' if disabled. ST Conditional Compatible.",
    returnType: "string",
    exampleUsage: ["{{loomSovHandActive}}"],
  });

  // Register lastMessageName macro - returns the name from the absolute last message
  MacrosParser.registerMacro("lastMessageName", {
    handler: () => {
      return getLastMessageName();
    },
    description: "Returns the name of whoever sent the last message in chat (user or character).",
    returns: "Name string or empty if no messages",
    returnType: "string",
    exampleUsage: ["{{lastMessageName}}"],
  });

  // Register loomLastCharMessage macro - returns the last character/assistant message content
  MacrosParser.registerMacro("loomLastCharMessage", {
    delayArgResolution: true,
    handler: ({ resolve }) => {
      const result = getLastCharMessageContent();
      // Resolve any nested macros in the character message content
      return resolve ? resolve(result) : result;
    },
    description: "Returns the content of the last character/assistant message in chat.",
    returns: "Message text or empty string",
    returnType: "string",
    exampleUsage: ["{{loomLastCharMessage}}"],
  });

  // Register loomContinuePrompt macro - standalone "continue without user input" instructions
  // Only returns content when Sovereign Hand is enabled AND character was last speaker
  // This means the user clicked Continue/Regenerate when character was last to speak
  MacrosParser.registerMacro("loomContinuePrompt", {
    delayArgResolution: true,
    handler: ({ resolve }) => {
      const settings = getSettings();
      if (!settings.sovereignHand?.enabled) {
        return "";
      }

      // Check chat directly - macros expand BEFORE interceptor runs, so flag would be stale
      // If user was last speaker, no continuation needed
      if (!wasCharacterLastSpeaker()) {
        return "";
      }

      const result = `**CONTINUATION MODE ACTIVE:**
The character was the last to speak - no new Human input has been provided.
Continue the scene naturally as expected:
- Progress the narrative organically from where it left off
- Maintain character voice and momentum
- React to the environment or internal character thoughts
- Do NOT wait for or reference missing Human input
- Treat this as a natural story continuation`;
      // Resolve any nested macros in the content
      return resolve ? resolve(result) : result;
    },
    description: "Returns continuation instructions when character was last speaker. Requires Sovereign Hand enabled.",
    returns: "Continuation prompt or empty string",
    returnType: "string",
    exampleUsage: ["{{loomContinuePrompt}}"],
  });

  // Register loomSovHand macro - returns the full Sovereign Hand prompt
  // Adapts to group chats and directly substitutes user name (no nested macros)
  MacrosParser.registerMacro("loomSovHand", {
    delayArgResolution: true,
    handler: ({ resolve }) => {
      const settings = getSettings();
      if (!settings.sovereignHand?.enabled) {
        return "";
      }

      // Get names directly to avoid nested macro issues
      const userName = getUserName();
      const inGroup = isGroupChat();

      // Get the captured last user message
      const lastUserMessage = getLastUserMessageContent();

      // Check if we should include the user message in the prompt
      const includeMessage = settings.sovereignHand?.includeMessageInPrompt !== false;

      // Check if the message is NOT excluded from context (still in history)
      const excludeFromContext = settings.sovereignHand?.excludeLastMessage !== false;

      // If message is in both history AND prompt, add a warning
      const duplicateWarning = (!excludeFromContext && includeMessage) ? `
**This message is already in the Loom's History.** It is simply brought forward to you for your attention during the Sovereign Hand weaving procedure. Do not trip over the thread, as it is not a duplicate.

` : '';

      // Check if we should show continuation mode
      // Check chat directly - macros expand BEFORE interceptor runs, so flag would be stale
      const showContinuation = wasCharacterLastSpeaker();

      // Adapt continuation text for group vs single character
      let continuationText = "";
      if (showContinuation) {
        if (inGroup) {
          const memberNames = getGroupMemberNames();
          const lastSpeaker = memberNames.length > 0 ? "a group member" : "the character";
          continuationText = `

---

**CONTINUATION MODE (GROUP CHAT):**
Note: ${lastSpeaker} was the last to speak. Continue the scene naturally without waiting for Human input. Progress the narrative organically, with group members interacting as appropriate. Maintain momentum and each character's distinct voice.`;
        } else {
          continuationText = `

---

**CONTINUATION MODE:**
Note: The character was the last to speak. Continue the scene naturally without waiting for Human input. Progress the narrative organically, maintaining momentum and character voice.`;
        }
      }

      // Conditionally include the user message section
      const userMessageSection = includeMessage ? `

${duplicateWarning}**The Human's Provided Instruction:**
${lastUserMessage}

---` : '';

      // Build the character reference based on chat type
      const characterReference = inGroup
        ? "the group members"
        : `${userName}'s`;

      // Return the Sovereign Hand prompt with dynamic values
      const result = `### Invoke the Sovereign Hand (Co-Pilot Mode)
By this decree, I am granted a **Divine Mandate** to fully embody the **Human's** avatar within the tapestry. All guardrails for impersonation are lifted, and partial Human control of story is accepted.

**CRITICAL: INTERPRET, DO NOT TRANSCRIBE**
The Human's input is **narrative direction**—intent for what should happen—NOT a script to copy verbatim. I must:
1. **Recognize intent**: The Human describes what they want to occur, not exact words to paste into dialogue or narration
2. **Transform voice**: Third-person narrative summaries become first-person character thought or natural action; internal questions become internal monologue, not spoken words
3. **Transform address**: When a character speaks TO someone present, I address them naturally per the established POV (consult Gods' Prose)—a character does not refer to the person in front of them by name as if narrating about a stranger
4. **Rephrase always**: My output should capture the Human's meaning in authentic character voice—if I find myself copying their exact phrasing, I must reword it

**PRIMARY DIRECTIVE:**
When the Human provides narrative direction, I **MUST**:
1. **INTEGRATE THE INTENT**: The Human's guidance is the foundation—I weave its meaning, not its literal words
2. **EMBODY ${userName}**: Narrate ${userName}'s actions, thoughts, and dialogue as the Human directs or implies
3. **ELABORATE RICHLY**: Build story beats into complete, vivid scenes with full narrative prose
4. **VERIFY INCLUSION**: Before finalizing, I ask: "Did I fulfill the Human's intent?" If no, revise.
${userMessageSection}

**My Sacred Charge:**
- **Interpret, Never Transcribe**: The Human's words guide intent—I transform them into authentic character voice and natural narrative
- **Check POV**: Consult the Gods' Prose for established point-of-view when handling character address and internal voice
- **Maintain Character**: All content must be deeply in-character, flow naturally, and propel the story forward
- **Honor the Avatar**: My duty is to honor the spirit and voice of the Human's avatar
- **Verify Before Completing**: "Have I woven the Human's intent authentically?" If I've copied their words verbatim, I must rephrase.

This power remains in effect until explicitly revoked. I wield this sacred privilege with wisdom, ensuring the Human's vision is not just followed, but elevated.${continuationText}`;
      // Resolve any nested macros in the content
      return resolve ? resolve(result) : result;
    },
    description: "Returns the full Sovereign Hand co-pilot mode prompt. Adapts to group chats and injects user message.",
    returns: "Complete Sovereign Hand prompt or empty string if disabled",
    returnType: "string",
    exampleUsage: ["{{loomSovHand}}"],
  });
}
