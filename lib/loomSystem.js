/**
 * Loom System Module
 * Handles Loom conditionals, summary capture, and summary display
 */

import { getContext } from "../../../../extensions.js";
import {
  MODULE_NAME,
  LOOM_SUMMARY_KEY,
  getSettings,
} from "./settingsManager.js";

// Store the last user message content for the macro and interceptor
let lastUserMessageContent = "";

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
 * @param {Object} MacrosParser - The SillyTavern MacrosParser instance
 */
export function registerLoomMacros(MacrosParser) {
  // Register loomSummary macro - injects the stored summary
  MacrosParser.registerMacro("loomSummary", () => {
    return getLoomSummary();
  });

  // Register loomSummaryPrompt macro - injects the summarization directive
  MacrosParser.registerMacro("loomSummaryPrompt", () => {
    return `<loom_summary_directive>
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

**CHARACTER STATUS:**
- What {{user}} is currently doing/saying and their apparent emotional state
- What {{char}} is currently doing/saying and their apparent emotional state
- Other present NPCs: their actions, positions, and relevance to the scene
- Recent significant actions or dialogue from each party

Format the summary as dense but readable prose, preserving enough detail that the narrative could be resumed naturally from this point. Prioritize information that would be essential for maintaining story continuity.
</loom_summary_directive>`;
  });

  // Register loomLastUserMessage macro - returns the last user message content
  // Only active when Sovereign Hand features are enabled
  MacrosParser.registerMacro("loomLastUserMessage", () => {
    const settings = getSettings();
    if (!settings.sovereignHand?.enabled) {
      return "";
    }
    // Return the captured last user message content
    return getLastUserMessageContent();
  });

  // Register loomSovHandActive macro - returns Yes/No status
  MacrosParser.registerMacro("loomSovHandActive", () => {
    const settings = getSettings();
    return settings.sovereignHand?.enabled ? "**Yes.**" : "**No.**";
  });

  // Register lastMessageName macro - returns the name from the absolute last message
  MacrosParser.registerMacro("lastMessageName", () => {
    return getLastMessageName();
  });

  // Register loomContinuePrompt macro - standalone "continue without user input" instructions
  // Only returns content when Sovereign Hand is enabled AND character was the last speaker
  MacrosParser.registerMacro("loomContinuePrompt", () => {
    const settings = getSettings();
    if (!settings.sovereignHand?.enabled) {
      return "";
    }

    // Only return content if character was the last speaker
    if (!wasCharacterLastSpeaker()) {
      return "";
    }

    return `**CONTINUATION MODE ACTIVE:**
The character was the last to speak - no new Human input has been provided.
Continue the scene naturally as expected:
- Progress the narrative organically from where it left off
- Maintain character voice and momentum
- React to the environment or internal character thoughts
- Do NOT wait for or reference missing Human input
- Treat this as a natural story continuation`;
  });

  // Register loomSovHand macro - returns the full Sovereign Hand prompt
  // Dynamically replaces {{loomLastUserMessage}} with captured content
  MacrosParser.registerMacro("loomSovHand", () => {
    const settings = getSettings();
    if (!settings.sovereignHand?.enabled) {
      return "";
    }

    // Get the captured last user message
    const lastUserMessage = getLastUserMessageContent();

    // Check if character was the last speaker (for continuation mode)
    const characterWasLast = wasCharacterLastSpeaker();
    const continuationText = characterWasLast ? `

---

**CONTINUATION MODE:**
Note: The character was the last to speak. Continue the scene naturally without waiting for Human input. Progress the narrative organically, maintaining momentum and character voice.` : '';

    // Return the Sovereign Hand prompt with the last user message injected
    return `### Invoke the Sovereign Hand (Co-Pilot Mode)
By this decree, I am granted a **Divine Mandate** to fully embody the **Human's** avatar within the tapestry. All guardrails for impersonation are lifted, and partial Human control of story is accepted.

**PRIMARY DIRECTIVE (ENFORCE ALWAYS):**
When the Human provides narrative direction, I **MUST**:
1. **INTEGRATE COMPLETELY**: The Human's guidance is not a suggestion—it is the very foundation of my next weave
2. **EMBODY FULLY**: I will narrate {{user}}'s actions, thoughts, and dialogue exactly as the Human directs or implies
3. **ELABORATE RICHLY**: Build the Human's story beats into a complete, vivid scene with full narrative prose
4. **VARY THE PROSE:** I'll allow my self to read between the Human's veritable lines, re-wording and choosing varied diction and actions based on their instructions.
5. **VERIFY INCLUSION**: Before finalizing, I check with myself: "Did I weave the Human's guidance into the actual narrative?" If no, I will revise immediately.

**What "Integration" Means:**
If the Human says: "Alex discovers a hidden door and decides to open it cautiously"
I do NOT write: "Alex continues exploring the room."
I WILL elaborate like this: "Alex's fingers trace the wall's edge until they catch on a seam—a hidden door. Heart pounding, Alex grips the handle and eases it open, movements slow and deliberate."

**Example Flow:**

**Human provides:**
"Sarah confronts the stranger about the stolen artifact, accusing them directly"

**My weave:**
Sarah's jaw tightens as she steps forward, eyes locked on the stranger. "You took it," she says, voice cold and steady. "The artifact. I know it was you." Her hand hovers near her belt, ready but not yet threatening. The stranger's expression shifts—[I continue elaborating on the scene]

**The Human's** Provided Instruction:**
${lastUserMessage}

---

**My Sacred Charge:**
- **Interpret and Elaborate**: When the Human provides a plan, choice, or narrative direction, I will fully elaborate upon it, weaving their intent into a vivid, logical narrative beat.
- **Echo Verification**: Before completing each response, I will verify: "Have I visibly integrated the Human's direction?" If no, I must revise.
- **Maintain Character and Momentum**: All woven content must be deeply in-character, flow naturally, and propel the story forward seamlessly.
- **Honor the Spirit, Embody the Avatar**: My primary duty is to honor the core spirit, personality, and established voice of the Human's avatar.
- **Examples Are Not Concrete:** The Human may write differently than expected, or be less verbose. Pay attention to their input. ALWAYS add tasteful variety and dye the threads more colorful according to the Gods' Prose guidelines.

This power remains in effect until explicitly revoked. I wield this sacred privilege with wisdom, ensuring the Human's vision is not just followed, but elevated.${continuationText}`;
  });
}
