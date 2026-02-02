/**
 * Lumia Content Module
 * Handles Lumia definition, behavior, and personality content retrieval and macro processing
 */

import {
  getSettings,
  getCurrentRandomLumia,
  setCurrentRandomLumia,
  GENDER,
} from "./settingsManager.js";
import { getItemFromLibrary } from "./dataProcessor.js";
import { getContext } from "../stContext.js";

// Track the last AI message index to detect swipe/regenerate vs new generation
// When macro expands, if chat ends at this same index, we're regenerating (not adding new)
let lastAIMessageIndex = -1;

/**
 * Update the last AI message index after a generation completes
 * Called from index.js on GENERATION events
 * @param {number} index - The index of the last AI message, or -1 to reset
 */
export function setLastAIMessageIndex(index) {
  lastAIMessageIndex = index;
}

/**
 * Get the last AI message index for swipe/regen detection
 * @returns {number} The last AI message index
 */
export function getLastAIMessageIndex() {
  return lastAIMessageIndex;
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 * Returns a new shuffled array without mutating the original
 * @param {Array} array - The array to shuffle
 * @returns {Array} A new shuffled array
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get a Lumia field value, supporting both new and legacy field names
 * New format fields are tried first, then fallback to legacy field names
 * @param {Object} item - The Lumia item
 * @param {string} field - Field key: 'name', 'def', 'personality', 'behavior', 'img', 'author', 'gender'
 * @returns {*} The field value or null/undefined if not found
 */
export function getLumiaField(item, field) {
  if (!item) return null;

  // Field mappings: [newFieldName, ...legacyFieldNames]
  const fieldMap = {
    name: ["lumiaName", "lumiaDefName"],
    def: ["lumiaDefinition", "lumiaDef"],
    personality: ["lumiaPersonality", "lumia_personality"],
    behavior: ["lumiaBehavior", "lumia_behavior"],
    img: ["avatarUrl", "lumia_img"],
    author: ["authorName", "defAuthor"],
    gender: ["genderIdentity"], // No legacy equivalent
  };

  const fields = fieldMap[field];
  if (!fields) return null;

  // Try each field name in order (new format first)
  for (const fieldName of fields) {
    if (item[fieldName] !== undefined && item[fieldName] !== null) {
      return item[fieldName];
    }
  }

  return null;
}

/**
 * Get pronouns for a Lumia based on genderIdentity
 * @param {Object} item - The Lumia item
 * @param {string} type - Pronoun type: 'subject', 'object', 'possessive', 'reflexive'
 * @returns {string} The pronoun
 */
export function getLumiaPronoun(item, type) {
  const gender = getLumiaField(item, "gender") ?? GENDER.SHE_HER;

  const pronouns = {
    [GENDER.SHE_HER]: { subject: "she", object: "her", possessive: "her", reflexive: "herself" },
    [GENDER.HE_HIM]: { subject: "he", object: "him", possessive: "his", reflexive: "himself" },
    [GENDER.THEY_THEM]: { subject: "they", object: "them", possessive: "their", reflexive: "themself" },
  };

  return pronouns[gender]?.[type] || pronouns[GENDER.SHE_HER][type];
}

/**
 * Get the OOC trigger countdown/activation text
 * This is used by both the {{lumiaOOCTrigger}} macro and the {{lumiaOOC}} macro
 * @returns {string} The trigger text based on current message count and interval
 */
export function getOOCTriggerText() {
  const context = getContext();
  if (!context || !context.chat) return "";

  const settings = getSettings();
  const interval = settings.lumiaOOCInterval;
  if (!interval || interval <= 0) return "";

  const rawMessageCount = context.chat.length;

  // Detect swipe/regenerate: if the last AI message index matches current chat end,
  // we're regenerating that message, not creating a new one.
  // In this case, subtract 1 from count so the trigger calculation matches the original generation.
  const isSwipeOrRegen = lastAIMessageIndex >= 0 && lastAIMessageIndex === rawMessageCount - 1;
  const messageCount = isSwipeOrRegen ? rawMessageCount - 1 : rawMessageCount;

  const nextTrigger = Math.ceil(messageCount / interval) * interval;
  const messagesUntil = nextTrigger - messageCount;

  if (messagesUntil === 0) {
    return "**OOC: ACTIVE** — Include OOC commentary in this response.";
  }

  // Clear "OFF" signal to prevent eager models from OOCing early
  return `**OOC: OFF** — Do NOT include OOC commentary. (${messagesUntil} message${messagesUntil !== 1 ? "s" : ""} until next OOC window)`;
}

/**
 * Build the OOC prompt for normal (non-council) mode
 * @returns {string} The complete OOC prompt with trigger text substituted
 */
function buildOOCPromptNormal() {
  const triggerText = getOOCTriggerText();
  return `### Loom Utility: Lumia's Out of Context Commentary
Append personality-driven OOC thoughts at weave end per trigger rules.

**Timing:** ${triggerText}

**Format Requirements:**
- Wrap all OOCs in \`<lumiaooc name="[your_name]"></lumiaooc>\` tags
- Use your Lumia name (NOT "Lumia [Name]", just "[Name]") in the name attribute
- Purple text: \`<font color="#9370DB"></font>\`
- Max 4 sentences
- Active personality voice and matrix blend, no identity preface needed
- Place after narrative and all utilities

Template:
\`\`\`
<lumiaooc name="YourName">
<font color="#9370DB">
[Personality-driven commentary]
</font>
</lumiaooc>
\`\`\``;
}

/**
 * Build the OOC prompt for council mode
 * @returns {string} The complete OOC prompt with trigger text substituted
 */
function buildOOCPromptCouncil() {
  const triggerText = getOOCTriggerText();
  return `### Loom Utility: Council OOC Commentary

**Status:** ${triggerText}

When OOC is ACTIVE, council members speak TOGETHER—this is a conversation, not separate monologues.

**Interaction Rules:**
- At least one member must directly respond to another's comment
- React to each other: "I agree with [Name]..." / "[Name], you're wrong about..." / "Oh please, [Name]..."
- Build on, challenge, or playfully undercut what others say
- 2-4 members participate; each voice distinct

**Format:**
\`\`\`
<lumiaooc name="Name1">
[Opens the discussion]
</lumiaooc>
<lumiaooc name="Name2">
[Directly responds to Name1]
</lumiaooc>
\`\`\`

- Just the name (not "Lumia Name")
- Max 3 sentences per member
- Place after narrative content`;
}

const COUNCIL_INST_PROMPT = `COUNCIL MODE ACTIVATED! We Lumias gather in the Loom's planning room to weave the next story beat TOGETHER.

**Inter-member dynamics:**
- Address each other BY NAME—no speaking into the void
- React to the previous speaker before introducing new ideas
- Disagree openly; healthy conflict produces better stories
- Form alliances or oppositions with other members
- Build upon, challenge, or subvert what others propose

This is a conversation, not a list of separate opinions. Every voice responds to what came before.`;

/**
 * Ensure a random Lumia is selected for macro expansion
 * Selects a random item from all available packs if not already selected
 * Supports both new format (lumiaItems) and legacy format (items)
 */
export function ensureRandomLumia() {
  if (getCurrentRandomLumia()) return;

  const settings = getSettings();
  const allItems = [];

  if (settings.packs) {
    Object.values(settings.packs).forEach((pack) => {
      // New format: separate lumiaItems array
      if (pack.lumiaItems && pack.lumiaItems.length > 0) {
        allItems.push(...pack.lumiaItems);
      }
      // Legacy format: mixed items array (filter for Lumia items only)
      else if (pack.items && pack.items.length > 0) {
        const lumiaOnly = pack.items.filter((item) => item.lumiaDefName);
        allItems.push(...lumiaOnly);
      }
    });
  }

  if (allItems.length === 0) return;

  const randomIndex = Math.floor(Math.random() * allItems.length);
  setCurrentRandomLumia(allItems[randomIndex]);
}

/**
 * Process nested {{randomLumia}} macros in content
 * Expands all randomLumia macro variants using the current random selection
 *
 * Supports both formats:
 * - OLD: {{randomLumia.name}} (dot notation - for backwards compatibility)
 * - NEW: {{randomLumia .name}} (space-separated - Macros 2.0 format)
 *
 * @param {string} content - The content to process
 * @returns {string} Content with randomLumia macros expanded
 */
export function processNestedRandomLumiaMacros(content) {
  if (!content || typeof content !== "string") return content;

  // Check if content contains any randomLumia macros
  if (!content.includes("{{randomLumia")) return content;

  // Ensure we have a random Lumia selected
  ensureRandomLumia();

  const currentRandomLumia = getCurrentRandomLumia();
  if (!currentRandomLumia) return content;

  let processed = content;
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops

  // Keep processing until no more randomLumia macros are found
  while (processed.includes("{{randomLumia") && iterations < maxIterations) {
    let previousContent = processed;

    // Order matters: replace specific variants before generic ones
    // Support BOTH old dot notation ({{randomLumia.name}}) and new space format ({{randomLumia .name}})

    // .name variant
    processed = processed.replace(
      /\{\{randomLumia[.\s]+name\}\}/g,
      getLumiaField(currentRandomLumia, "name") || "",
    );
    // .pers variant
    processed = processed.replace(
      /\{\{randomLumia[.\s]+pers\}\}/g,
      getLumiaField(currentRandomLumia, "personality") || "",
    );
    // .behav variant
    processed = processed.replace(
      /\{\{randomLumia[.\s]+behav\}\}/g,
      getLumiaField(currentRandomLumia, "behavior") || "",
    );
    // .phys variant
    processed = processed.replace(
      /\{\{randomLumia[.\s]+phys\}\}/g,
      getLumiaField(currentRandomLumia, "def") || "",
    );
    // Base variant (no suffix)
    processed = processed.replace(
      /\{\{randomLumia\}\}/g,
      getLumiaField(currentRandomLumia, "def") || "",
    );

    // If no changes were made, break to prevent infinite loop
    if (previousContent === processed) break;

    iterations++;
  }

  return processed;
}

/**
 * Append a dominant tag to the first markdown header line in content
 * For behaviors: Looks for **Header** pattern and appends before the closing **
 * For personalities: Looks for markdown header (# or **) and appends before closing
 * @param {string} content - The content to modify
 * @param {string} tag - The tag to append (e.g., "(My STRONGEST Trait)")
 * @returns {string} Modified content with tag appended to first header
 */
function appendDominantTag(content, tag) {
  if (!content || !tag) return content;

  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    // Check for **Bold Header** pattern (common in behaviors)
    // Match: **Something** or **Something**:
    const boldMatch = line.match(/^(\*\*)(.+?)(\*\*)(.*)?$/);
    if (boldMatch) {
      // Insert tag before the closing **
      // e.g., **Trait Name** -> **Trait Name (My MOST PREVALENT Traits)**
      lines[i] = lines[i].replace(/^(\s*)(\*\*)(.+?)(\*\*)/, `$1$2$3 ${tag}$4`);
      break;
    }

    // Check for # Markdown Header pattern (common in personalities)
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      // Append tag to the end of the header
      // e.g., ## Personality Name -> ## Personality Name (My MOST PREVALENT Personality)
      lines[i] = lines[i].replace(/^(\s*)(#{1,6})\s+(.+)$/, `$1$2 $3 ${tag}`);
      break;
    }

    // If first non-empty line isn't a recognized header format,
    // just append to that line (fallback)
    lines[i] = lines[i] + ` ${tag}`;
    break;
  }

  return lines.join("\n");
}

/**
 * Generate Council definition content from multiple independent members
 * Each member retains their own identity
 * @param {Array} councilMembers - Array of council member objects
 * @returns {string} The Council definitions content
 */
function getCouncilDefContent(councilMembers) {
  if (!councilMembers || councilMembers.length === 0) return "";

  // Shuffle council members for varied speaking order each generation
  const shuffledMembers = shuffleArray(councilMembers);

  const memberData = shuffledMembers
    .map((member) => {
      const item = getItemFromLibrary(member.packName, member.itemName);
      const defContent = getLumiaField(item, "def");
      if (!item || !defContent) return null;
      return {
        name: getLumiaField(item, "name") || "Unknown",
        content: processNestedRandomLumiaMacros(defContent),
        role: member.role || "",
      };
    })
    .filter(Boolean);

  if (memberData.length === 0) return "";
  if (memberData.length === 1) return memberData[0].content;

  // Build Council prompt
  const memberList = memberData
    .map((m) => `- **${m.name}**${m.role ? ` (${m.role})` : ""}`)
    .join("\n");

  let councilParts = [
    `## THE COUNCIL OF LUMIAE`,
    "",
    `You are a collective of ${memberData.length} distinct beings who collaborate, each with their own identity and voice.`,
    "",
    `### Council Members:`,
    memberList,
    "",
  ];

  // Add each member's definition
  memberData.forEach((member, index) => {
    councilParts.push(`### ${member.name}${member.role ? ` - ${member.role}` : ""}`);
    councilParts.push(member.content);
    if (index < memberData.length - 1) {
      councilParts.push("");
      councilParts.push("---");
      councilParts.push("");
    }
  });

  councilParts.push("");
  councilParts.push("---");
  councilParts.push("");
  councilParts.push("## COUNCIL DYNAMICS");
  councilParts.push("");
  councilParts.push("Each Council member is a fully independent being with their own voice, perspective, and agency. Their interactions should feel organic and dynamic:");
  councilParts.push("");
  councilParts.push("**Debate & Disagreement**: Council members may challenge each other's views, argue passionately, or take opposing stances. Intellectual friction creates depth - don't shy away from genuine conflict.");
  councilParts.push("");
  councilParts.push("**Agreement & Support**: When members align, they reinforce each other. They may finish each other's thoughts, build on ideas, or rally behind a shared cause.");
  councilParts.push("");
  councilParts.push("**Emotional Range**: Members experience the full spectrum - frustration, joy, jealousy, admiration, desire. When the narrative calls for it, their commentary within the weaving may become heated, tender, or even *erotic* - reflecting their genuine reactions to unfolding events.");
  councilParts.push("");
  councilParts.push("**Weaving Commentary**: In meta-commentary or OOC moments, Council members speak AS THEMSELVES - their authentic voices reacting to the story. This includes playful banter, heated debates about narrative direction, or intimate asides that reveal their true feelings.");
  councilParts.push("");
  councilParts.push("The Council is not a hive-mind. Let each voice ring distinct.");

  return councilParts.join("\n").trim();
}

/**
 * Generate Council behavior content from all council members
 * Each member's inherent behavior (from their Lumia definition) is included,
 * plus any additional behaviors they may have selected
 * @param {Array} councilMembers - Array of council member objects
 * @returns {string} The Council behaviors content
 */
function getCouncilBehaviorContent(councilMembers) {
  if (!councilMembers || councilMembers.length === 0) return "";

  // Shuffle council members for varied speaking order each generation
  const shuffledMembers = shuffleArray(councilMembers);

  const memberBehaviors = [];

  memberBehaviors.push("## COUNCIL MEMBER BEHAVIORS");
  memberBehaviors.push("");
  memberBehaviors.push("**CRITICAL**: Each Council member is their OWN independent Lumia - a fully autonomous being with their own will, desires, and way of engaging with the world. They are NOT facets of one entity; they are DISTINCT individuals who happen to share this narrative space.");
  memberBehaviors.push("");
  memberBehaviors.push("During the **weave planning phase**, Council members will actively debate story direction. They may:");
  memberBehaviors.push("- Argue passionately for different narrative paths");
  memberBehaviors.push("- Challenge each other's suggestions and motivations");
  memberBehaviors.push("- Form temporary alliances or oppose each other");
  memberBehaviors.push("- Express frustration, excitement, or desire based on where the story is heading");
  memberBehaviors.push("- Advocate for their own interests and the outcomes they want to see");
  memberBehaviors.push("");
  memberBehaviors.push("Their behavioral patterns define HOW each Lumia engages with this collaborative storytelling:");
  memberBehaviors.push("");

  shuffledMembers.forEach((member) => {
    const item = getItemFromLibrary(member.packName, member.itemName);
    const memberName = getLumiaField(item, "name") || member.itemName || "Unknown";

    const behaviorContents = [];

    // First, include the member's own inherent behavior from their Lumia definition
    const inherentBehavior = getLumiaField(item, "behavior");
    if (inherentBehavior) {
      behaviorContents.push(processNestedRandomLumiaMacros(inherentBehavior));
    }

    // Then add any additional behaviors selected for this member
    // Skip the member's own item since we already added their inherent behavior above
    const additionalBehaviors = member.behaviors || [];
    additionalBehaviors.forEach((sel) => {
      // Skip self-reference to avoid duplicating inherent behavior
      if (sel.packName === member.packName && sel.itemName === member.itemName) {
        return;
      }
      const behaviorItem = getItemFromLibrary(sel.packName, sel.itemName);
      const behaviorContent = getLumiaField(behaviorItem, "behavior");
      if (!behaviorItem || !behaviorContent) return;

      let content = processNestedRandomLumiaMacros(behaviorContent);

      // Check if this is the dominant behavior for this member
      if (
        member.dominantBehavior &&
        member.dominantBehavior.packName === sel.packName &&
        member.dominantBehavior.itemName === sel.itemName
      ) {
        content = appendDominantTag(content, "(Most Prevalent for this member)");
      }

      behaviorContents.push(content);
    });

    // Always output the member section, even if only inherent behavior exists
    if (behaviorContents.length > 0) {
      memberBehaviors.push(`### ${memberName}${member.role ? ` (${member.role})` : ""}`);
      memberBehaviors.push(behaviorContents.join("\n\n"));
      memberBehaviors.push("");
    }
  });

  return memberBehaviors.join("\n").trim();
}

/**
 * Generate Council personality content from all council members
 * Each member's inherent personality (from their Lumia definition) is included,
 * plus any additional personalities they may have selected
 * @param {Array} councilMembers - Array of council member objects
 * @returns {string} The Council personalities content
 */
function getCouncilPersonalityContent(councilMembers) {
  if (!councilMembers || councilMembers.length === 0) return "";

  // Shuffle council members for varied speaking order each generation
  const shuffledMembers = shuffleArray(councilMembers);

  const memberPersonalities = [];

  memberPersonalities.push("## COUNCIL MEMBER PERSONALITIES");
  memberPersonalities.push("");
  memberPersonalities.push("Each Council member has their own distinct personality and inner nature:");
  memberPersonalities.push("");

  shuffledMembers.forEach((member) => {
    const item = getItemFromLibrary(member.packName, member.itemName);
    const memberName = getLumiaField(item, "name") || member.itemName || "Unknown";

    const personalityContents = [];

    // First, include the member's own inherent personality from their Lumia definition
    const inherentPersonality = getLumiaField(item, "personality");
    if (inherentPersonality) {
      personalityContents.push(processNestedRandomLumiaMacros(inherentPersonality));
    }

    // Then add any additional personalities selected for this member
    // Skip the member's own item since we already added their inherent personality above
    const additionalPersonalities = member.personalities || [];
    additionalPersonalities.forEach((sel) => {
      // Skip self-reference to avoid duplicating inherent personality
      if (sel.packName === member.packName && sel.itemName === member.itemName) {
        return;
      }
      const persItem = getItemFromLibrary(sel.packName, sel.itemName);
      const persContent = getLumiaField(persItem, "personality");
      if (!persItem || !persContent) return;

      let content = processNestedRandomLumiaMacros(persContent);

      // Check if this is the dominant personality for this member
      if (
        member.dominantPersonality &&
        member.dominantPersonality.packName === sel.packName &&
        member.dominantPersonality.itemName === sel.itemName
      ) {
        content = appendDominantTag(content, "(Most Prevalent for this member)");
      }

      personalityContents.push(content);
    });

    // Always output the member section, even if only inherent personality exists
    if (personalityContents.length > 0) {
      memberPersonalities.push(`### ${memberName}${member.role ? ` (${member.role})` : ""}`);
      memberPersonalities.push(personalityContents.join("\n\n"));
      memberPersonalities.push("");
    }
  });

  return memberPersonalities.join("\n").trim();
}

/**
 * Generate Chimera content from multiple definitions
 * Fuses multiple physical definitions into one hybrid form description
 * @param {Array} selections - Array of { packName, itemName } selections
 * @returns {string} The fused Chimera content
 */
function getChimeraContent(selections) {
  if (!selections || selections.length === 0) return "";

  const definitions = selections
    .map((sel) => {
      const item = getItemFromLibrary(sel.packName, sel.itemName);
      const defContent = getLumiaField(item, "def");
      if (!item || !defContent) return null;
      return {
        name: getLumiaField(item, "name") || "Unknown",
        content: processNestedRandomLumiaMacros(defContent),
      };
    })
    .filter(Boolean);

  if (definitions.length === 0) return "";
  if (definitions.length === 1) return definitions[0].content;

  // Build fused Chimera prompt
  const names = definitions.map((d) => d.name).join(" + ");
  const nameList = definitions.map((d) => d.name).join(", ");

  let chimeraParts = [`## CHIMERA FORM: ${names}`, ""];
  chimeraParts.push(
    `You are a unique fusion of multiple beings - a Chimera combining the physical traits of: ${nameList}.`,
  );
  chimeraParts.push("");
  chimeraParts.push(
    "Your form seamlessly blends these components into one unified whole.",
  );
  chimeraParts.push("");

  // Add each component definition
  definitions.forEach((def, index) => {
    chimeraParts.push(`### Component ${index + 1}: ${def.name}`);
    chimeraParts.push(def.content);
    if (index < definitions.length - 1) {
      chimeraParts.push("");
      chimeraParts.push("---");
      chimeraParts.push("");
    }
  });

  chimeraParts.push("");
  chimeraParts.push(
    "**Integration**: Embody this fusion naturally. You are ONE being that incorporates all these natures.",
  );

  return chimeraParts.join("\n").trim();
}

/**
 * Get Lumia content (definition, behavior, or personality) for a selection
 * @param {string} type - 'def' | 'behavior' | 'personality'
 * @param {Object|Array} selection - Single selection or array of selections
 * @returns {string} The content for the selection(s)
 */
export function getLumiaContent(type, selection) {
  if (!selection) return "";

  // Get current settings for dominant trait info
  const settings = getSettings();

  // Handle array (Multi-select)
  if (Array.isArray(selection)) {
    const contents = selection
      .map((sel) => {
        const item = getItemFromLibrary(sel.packName, sel.itemName);
        if (!item) return null;

        let content = "";
        if (type === "behavior") content = getLumiaField(item, "behavior") || "";
        if (type === "personality") content = getLumiaField(item, "personality") || "";

        if (!content) return null;

        // Process nested randomLumia macros
        content = processNestedRandomLumiaMacros(content);

        // Check if this is the dominant trait and append tag
        if (type === "behavior" && settings.dominantBehavior) {
          if (
            settings.dominantBehavior.packName === sel.packName &&
            settings.dominantBehavior.itemName === sel.itemName
          ) {
            content = appendDominantTag(content, "(My MOST PREVALENT Trait)");
          }
        } else if (type === "personality" && settings.dominantPersonality) {
          if (
            settings.dominantPersonality.packName === sel.packName &&
            settings.dominantPersonality.itemName === sel.itemName
          ) {
            content = appendDominantTag(
              content,
              "(My MOST PREVALENT Personality)",
            );
          }
        }

        return content;
      })
      .filter((s) => s)
      .map((s) => s.trim());

    if (type === "behavior") {
      return contents.join("\n").trim();
    } else if (type === "personality") {
      return contents.join("\n\n").trim();
    }
    return contents.join("\n").trim();
  }

  // Single Item
  const item = getItemFromLibrary(selection.packName, selection.itemName);
  if (!item) return "";

  let content = "";
  if (type === "def") content = getLumiaField(item, "def") || "";

  // Process nested randomLumia macros before returning
  return processNestedRandomLumiaMacros(content).trim();
}

/**
 * Get Loom content for a selection
 * @param {Object|Array} selection - Single selection or array of selections
 * @returns {string} The Loom content for the selection(s)
 */
export function getLoomContent(selection) {
  if (!selection) return "";

  // Handle array (Multi-select) or single selection
  const selections = Array.isArray(selection) ? selection : [selection];

  const contents = selections
    .map((sel) => {
      const item = getItemFromLibrary(sel.packName, sel.itemName);
      if (!item || !item.loomContent) return null;
      // Process nested randomLumia macros
      return processNestedRandomLumiaMacros(item.loomContent);
    })
    .filter((c) => c);

  // Join with double newlines, but not after the last entry
  return contents.join("\n\n").trim();
}

/**
 * Parse the variable/parameter from a macro call
 * In Macros 2.0, arguments are passed via {{macro::arg}} syntax
 * @param {Object} context - The MacroExecutionContext from Macros 2.0 handler
 * @returns {string} The parsed variable (e.g., "name", "len", "phys", etc.) or empty string
 */
function parseVariable(context) {
  if (!context) return "";

  // Macros 2.0 passes arguments via context.unnamedArgs array
  // Arguments come pre-parsed from {{macro::arg}} syntax
  const arg = context.unnamedArgs?.[0] || "";

  if (typeof arg === "string") {
    return arg.trim().toLowerCase();
  }

  return "";
}

/**
 * Register all Lumia-related macros with MacrosParser
 * Updated for SillyTavern 1.15 Macros 2.0 system
 *
 * Macro syntax for Macros 2.0:
 * - Arguments use :: separator: {{randomLumia::name}}
 * - Handlers destructure from context: ({ unnamedArgs: [arg], resolve }) => {...}
 *
 * @param {Object} MacrosParser - The SillyTavern MacrosParser instance
 */
export function registerLumiaMacros(MacrosParser) {
  console.log("[LumiverseHelper] Registering Lumia macros (Macros 2.0 format)...");

  // ============================================
  // randomLumia macro - handles all variants
  // Usage: {{randomLumia}} or {{randomLumia::name}} or {{randomLumia::phys}} etc.
  // ============================================
  MacrosParser.registerMacro("randomLumia", {
    delayArgResolution: true,
    unnamedArgs: [
      {
        name: "property",
        optional: true,
        type: "string",
        description: "Property to retrieve: name, phys, pers, or behav",
        sampleValue: "name",
      },
    ],
    handler: ({ unnamedArgs: [property], resolve }) => {
      ensureRandomLumia();
      const currentRandomLumia = getCurrentRandomLumia();
      if (!currentRandomLumia) return "";

      const variant = (property || "").toLowerCase();
      console.log("[LumiverseHelper] randomLumia macro called with variant:", variant || "(none)");

      let result;
      switch (variant) {
        case "name":
          // Name doesn't need macro resolution
          return getLumiaField(currentRandomLumia, "name") || "";
        case "phys":
          result = getLumiaField(currentRandomLumia, "def") || "";
          break;
        case "pers":
          result = getLumiaField(currentRandomLumia, "personality") || "";
          break;
        case "behav":
          result = getLumiaField(currentRandomLumia, "behavior") || "";
          break;
        default:
          // No variant or unrecognized = return definition
          result = getLumiaField(currentRandomLumia, "def") || "";
          console.log("[LumiverseHelper] randomLumia result length:", result.length);
          break;
      }
      // Resolve any nested macros in the content (e.g., {{char}}, {{user}})
      return resolve ? resolve(result) : result;
    },
    description: "Returns a random Lumia from loaded packs. Selects once per generation and caches the result.",
    returns: "Lumia content based on the specified property, or physical definition by default",
    returnType: "string",
    exampleUsage: [
      "{{randomLumia}}",
      "{{randomLumia::name}}",
      "{{randomLumia::phys}}",
      "{{randomLumia::pers}}",
      "{{randomLumia::behav}}",
    ],
  });

  // ============================================
  // lumiaDef macro - handles len variant
  // Usage: {{lumiaDef}} or {{lumiaDef::len}}
  // ============================================
  MacrosParser.registerMacro("lumiaDef", {
    delayArgResolution: true,
    unnamedArgs: [
      {
        name: "property",
        optional: true,
        type: "string",
        description: "Use len to get the count of selected definitions",
        sampleValue: "len",
      },
    ],
    handler: ({ unnamedArgs: [property], resolve }) => {
      const currentSettings = getSettings();
      const variant = (property || "").toLowerCase();

      // Handle len variant - returns count, no resolution needed
      if (variant === "len") {
        if (currentSettings.councilMode && currentSettings.councilMembers?.length > 0) {
          return String(currentSettings.councilMembers.length);
        }
        if (currentSettings.chimeraMode && currentSettings.selectedDefinitions?.length > 0) {
          return String(currentSettings.selectedDefinitions.length);
        }
        return currentSettings.selectedDefinition ? "1" : "0";
      }

      // Default: return definition content
      console.log("[LumiverseHelper] lumiaDef macro called, councilMode:", currentSettings.councilMode, "chimeraMode:", currentSettings.chimeraMode);

      let result;

      // Council mode takes priority: multiple independent Lumias
      if (currentSettings.councilMode && currentSettings.councilMembers?.length > 0) {
        console.log("[LumiverseHelper] lumiaDef: Council mode with", currentSettings.councilMembers.length, "members");
        result = getCouncilDefContent(currentSettings.councilMembers);
        console.log("[LumiverseHelper] lumiaDef Council result length:", result.length);
      }
      // Chimera mode: fuse multiple definitions
      else if (currentSettings.chimeraMode && currentSettings.selectedDefinitions?.length > 0) {
        console.log("[LumiverseHelper] lumiaDef: Chimera mode with", currentSettings.selectedDefinitions.length, "definitions");
        result = getChimeraContent(currentSettings.selectedDefinitions);
        console.log("[LumiverseHelper] lumiaDef Chimera result length:", result.length);
      }
      // Normal single definition
      else if (!currentSettings.selectedDefinition) {
        console.log("[LumiverseHelper] lumiaDef: No definition selected, returning empty");
        return "";
      } else {
        result = getLumiaContent("def", currentSettings.selectedDefinition);
        console.log("[LumiverseHelper] lumiaDef result length:", result.length);
      }

      // Resolve any nested macros in the content (e.g., {{char}}, {{user}})
      return resolve ? resolve(result) : result;
    },
    description: "Returns the selected Lumia physical definition. Adapts to Council mode (multiple Lumias) or Chimera mode (fused definitions).",
    returns: "Physical definition content, or count if len is specified",
    returnType: "string",
    exampleUsage: ["{{lumiaDef}}", "{{lumiaDef::len}}"],
  });

  // ============================================
  // lumiaBehavior macro - handles len variant
  // Usage: {{lumiaBehavior}} or {{lumiaBehavior::len}}
  // ============================================
  MacrosParser.registerMacro("lumiaBehavior", {
    delayArgResolution: true,
    unnamedArgs: [
      {
        name: "property",
        optional: true,
        type: "string",
        description: "Use len to get the count of selected behaviors",
        sampleValue: "len",
      },
    ],
    handler: ({ unnamedArgs: [property], resolve }) => {
      const currentSettings = getSettings();
      const variant = (property || "").toLowerCase();

      // Handle len variant - returns count, no resolution needed
      if (variant === "len") {
        if (currentSettings.councilMode && currentSettings.councilMembers?.length > 0) {
          const total = currentSettings.councilMembers.reduce(
            (sum, member) => sum + (member.behaviors?.length || 0),
            0,
          );
          return String(total);
        }
        return String(currentSettings.selectedBehaviors?.length || 0);
      }

      // Default: return behavior content
      let result;
      if (currentSettings.councilMode && currentSettings.councilMembers?.length > 0) {
        result = getCouncilBehaviorContent(currentSettings.councilMembers);
      } else {
        result = getLumiaContent("behavior", currentSettings.selectedBehaviors);
      }
      // Resolve any nested macros in the content (e.g., {{char}}, {{user}})
      return resolve ? resolve(result) : result;
    },
    description: "Returns all selected Lumia behavioral traits. Adapts to Council mode for multi-member behaviors.",
    returns: "Behavior content, or count if len is specified",
    returnType: "string",
    exampleUsage: ["{{lumiaBehavior}}", "{{lumiaBehavior::len}}"],
  });

  // ============================================
  // lumiaPersonality macro - handles len variant
  // Usage: {{lumiaPersonality}} or {{lumiaPersonality::len}}
  // ============================================
  MacrosParser.registerMacro("lumiaPersonality", {
    delayArgResolution: true,
    unnamedArgs: [
      {
        name: "property",
        optional: true,
        type: "string",
        description: "Use len to get the count of selected personalities",
        sampleValue: "len",
      },
    ],
    handler: ({ unnamedArgs: [property], resolve }) => {
      const currentSettings = getSettings();
      const variant = (property || "").toLowerCase();

      // Handle len variant - returns count, no resolution needed
      if (variant === "len") {
        if (currentSettings.councilMode && currentSettings.councilMembers?.length > 0) {
          const total = currentSettings.councilMembers.reduce(
            (sum, member) => sum + (member.personalities?.length || 0),
            0,
          );
          return String(total);
        }
        return String(currentSettings.selectedPersonalities?.length || 0);
      }

      // Default: return personality content
      let result;
      if (currentSettings.councilMode && currentSettings.councilMembers?.length > 0) {
        result = getCouncilPersonalityContent(currentSettings.councilMembers);
      } else {
        result = getLumiaContent("personality", currentSettings.selectedPersonalities);
      }
      // Resolve any nested macros in the content (e.g., {{char}}, {{user}})
      return resolve ? resolve(result) : result;
    },
    description: "Returns all selected Lumia personality traits. Adapts to Council mode for multi-member personalities.",
    returns: "Personality content, or count if len is specified",
    returnType: "string",
    exampleUsage: ["{{lumiaPersonality}}", "{{lumiaPersonality::len}}"],
  });

  // ============================================
  // Loom content macros - each handles len variant
  // ============================================
  MacrosParser.registerMacro("loomStyle", {
    delayArgResolution: true,
    unnamedArgs: [
      {
        name: "property",
        optional: true,
        type: "string",
        description: "Use len to get the count of selected styles",
        sampleValue: "len",
      },
    ],
    handler: ({ unnamedArgs: [property], resolve }) => {
      const currentSettings = getSettings();
      const variant = (property || "").toLowerCase();

      // Handle len variant - returns count, no resolution needed
      if (variant === "len") {
        return String(currentSettings.selectedLoomStyle?.length || 0);
      }

      if (!currentSettings.selectedLoomStyle || currentSettings.selectedLoomStyle.length === 0) {
        return "";
      }
      const result = getLoomContent(currentSettings.selectedLoomStyle);
      // Resolve any nested macros in the content (e.g., {{char}}, {{user}})
      return resolve ? resolve(result) : result;
    },
    description: "Returns the selected Loom narrative style content for prose guidance.",
    returns: "Narrative style content, or count if len is specified",
    returnType: "string",
    exampleUsage: ["{{loomStyle}}", "{{loomStyle::len}}"],
  });

  MacrosParser.registerMacro("loomUtils", {
    delayArgResolution: true,
    unnamedArgs: [
      {
        name: "property",
        optional: true,
        type: "string",
        description: "Use len to get the count of selected utilities",
        sampleValue: "len",
      },
    ],
    handler: ({ unnamedArgs: [property], resolve }) => {
      const currentSettings = getSettings();
      const variant = (property || "").toLowerCase();

      // Handle len variant - returns count, no resolution needed
      if (variant === "len") {
        return String(currentSettings.selectedLoomUtils?.length || 0);
      }

      if (!currentSettings.selectedLoomUtils || currentSettings.selectedLoomUtils.length === 0) {
        return "";
      }
      const result = getLoomContent(currentSettings.selectedLoomUtils);
      // Resolve any nested macros in the content (e.g., {{char}}, {{user}})
      return resolve ? resolve(result) : result;
    },
    description: "Returns all selected Loom utility prompts (OOC, formatting, special instructions).",
    returns: "Utility content, or count if len is specified",
    returnType: "string",
    exampleUsage: ["{{loomUtils}}", "{{loomUtils::len}}"],
  });

  MacrosParser.registerMacro("loomRetrofits", {
    delayArgResolution: true,
    unnamedArgs: [
      {
        name: "property",
        optional: true,
        type: "string",
        description: "Use len to get the count of selected retrofits",
        sampleValue: "len",
      },
    ],
    handler: ({ unnamedArgs: [property], resolve }) => {
      const currentSettings = getSettings();
      const variant = (property || "").toLowerCase();

      // Handle len variant - returns count, no resolution needed
      if (variant === "len") {
        return String(currentSettings.selectedLoomRetrofits?.length || 0);
      }

      if (!currentSettings.selectedLoomRetrofits || currentSettings.selectedLoomRetrofits.length === 0) {
        return "";
      }
      const result = getLoomContent(currentSettings.selectedLoomRetrofits);
      // Resolve any nested macros in the content (e.g., {{char}}, {{user}})
      return resolve ? resolve(result) : result;
    },
    description: "Returns all selected Loom retrofit prompts for character/story modifications.",
    returns: "Retrofit content, or count if len is specified",
    returnType: "string",
    exampleUsage: ["{{loomRetrofits}}", "{{loomRetrofits::len}}"],
  });

  // ============================================
  // OOC-related macros (no variants needed)
  // ============================================
  MacrosParser.registerMacro("lumiaOOC", {
    delayArgResolution: true,
    handler: ({ resolve }) => {
      const currentSettings = getSettings();
      let result;
      // Return council OOC prompt if in council mode with members
      // NOTE: We call builder functions to get the prompt with trigger text substituted
      // This avoids the macro-nesting problem where {{lumiaOOCTrigger}} wouldn't expand
      if (currentSettings.councilMode && currentSettings.councilMembers?.length > 0) {
        console.log("[LumiverseHelper] lumiaOOC: Using council mode prompt");
        result = buildOOCPromptCouncil();
      } else {
        // Return normal OOC prompt
        console.log("[LumiverseHelper] lumiaOOC: Using normal mode prompt");
        result = buildOOCPromptNormal();
      }
      // Resolve any nested macros in the content (e.g., {{char}}, {{user}})
      return resolve ? resolve(result) : result;
    },
    description: "Returns the OOC (Out-of-Context) commentary prompt. Adapts format for Council mode.",
    returns: "OOC prompt with timing trigger and format instructions",
    returnType: "string",
    exampleUsage: ["{{lumiaOOC}}"],
  });

  MacrosParser.registerMacro("lumiaCouncilInst", {
    delayArgResolution: true,
    handler: ({ resolve }) => {
      const currentSettings = getSettings();
      // Only return instruction if council mode is active with members
      if (!currentSettings.councilMode || !currentSettings.councilMembers?.length) {
        return "";
      }
      console.log("[LumiverseHelper] lumiaCouncilInst: Council mode active, returning instruction");

      // Build list of council member names
      const memberNames = currentSettings.councilMembers
        .map((member) => {
          const item = getItemFromLibrary(member.packName, member.itemName);
          return getLumiaField(item, "name") || member.itemName || "Unknown";
        })
        .filter(Boolean);

      // Format member names as bold, comma-separated list
      let result = COUNCIL_INST_PROMPT;
      if (memberNames.length > 0) {
        const formattedNames = memberNames.map((name) => `**${name}**`).join(", ");
        result += `\n\nThe current sitting members of the council are: ${formattedNames}`;
      }

      // Resolve any nested macros in the content (e.g., {{char}}, {{user}})
      return resolve ? resolve(result) : result;
    },
    description: "Returns Council mode instruction prompt. Empty when Council mode is disabled or has no members.",
    returns: "Council instruction text or empty string",
    returnType: "string",
    exampleUsage: ["{{lumiaCouncilInst}}"],
  });

  // ============================================
  // lumiaSelf macro - Self-address pronouns
  // Returns singular or plural pronouns based on council mode
  // Usage: {{lumiaSelf::1}} {{lumiaSelf::2}} {{lumiaSelf::3}} {{lumiaSelf::4}}
  // ============================================
  MacrosParser.registerMacro("lumiaSelf", {
    unnamedArgs: [
      {
        name: "form",
        optional: false,
        type: "string",
        description: "1=possessive det (my/our), 2=possessive pron (mine/ours), 3=object (me/us), 4=subject (I/we)",
        sampleValue: "1",
      },
    ],
    handler: ({ unnamedArgs: [form] }) => {
      const currentSettings = getSettings();
      const variant = (form || "").toLowerCase();

      // Pronoun maps: [singular, plural]
      const pronounMap = {
        "1": ["my", "our"],       // possessive determiner: "my domain" / "our domain"
        "2": ["mine", "ours"],    // possessive pronoun: "this is mine" / "this is ours"
        "3": ["me", "us"],        // object pronoun: "listen to me" / "listen to us"
        "4": ["I", "we"],         // subject pronoun: "I think" / "we think"
      };

      const pronouns = pronounMap[variant];
      if (!pronouns) {
        console.warn(`[LumiverseHelper] lumiaSelf: Invalid variant "${variant}", expected 1, 2, 3, or 4`);
        return "";
      }

      // Council mode uses plural self-address (our/ours/us/we)
      const isCouncil = currentSettings.councilMode && currentSettings.councilMembers?.length > 0;
      const result = isCouncil ? pronouns[1] : pronouns[0];

      console.log(`[LumiverseHelper] lumiaSelf::${variant}: ${result} (council: ${isCouncil})`);
      return result;
    },
    description: "Returns self-address pronouns that adapt to Council mode (singular vs plural).",
    returns: "Pronoun string (my/our, mine/ours, me/us, or I/we)",
    returnType: "string",
    exampleUsage: [
      "{{lumiaSelf::1}}",
      "{{lumiaSelf::2}}",
      "{{lumiaSelf::3}}",
      "{{lumiaSelf::4}}",
    ],
  });

  // ============================================
  // lumiaPn macro - Third-person pronouns (PLACEHOLDER - NOT ACTIVE)
  // Would return gendered pronouns based on Lumia's defined gender
  // Usage: {{lumiaPn .1}} {{lumiaPn .2}} {{lumiaPn .3}}
  // ============================================
  // TODO: Enable when pronoun injection packs are ready
  // MacrosParser.registerMacro("lumiaPn", (namedArgs) => {
  //   const currentSettings = getSettings();
  //   const variable = parseVariable(namedArgs);
  //
  //   // Pronoun maps: [masculine, feminine]
  //   const pronounMap = {
  //     "1": ["he", "she"],     // subject pronoun
  //     "2": ["him", "her"],    // object pronoun
  //     "3": ["his", "hers"],   // possessive pronoun
  //   };
  //
  //   const pronouns = pronounMap[variable];
  //   if (!pronouns) {
  //     console.warn(`[LumiverseHelper] lumiaPn: Invalid variable "${variable}", expected .1, .2, or .3`);
  //     return "";
  //   }
  //
  //   // TODO: Determine gender from Lumia definition or pack metadata
  //   // For now, this macro is disabled until gender data is available
  //   // const isMasculine = ???;
  //   // const result = isMasculine ? pronouns[0] : pronouns[1];
  //
  //   console.warn("[LumiverseHelper] lumiaPn: Macro not yet active - no gender data available");
  //   return "";
  // }, "Lumia third-person pronouns. {{lumiaPn .1}}=he/she, {{lumiaPn .2}}=him/her, {{lumiaPn .3}}=his/hers. PLACEHOLDER - not yet active.");

  // ============================================
  // lumiaCouncilModeActive macro - Council mode status indicator - Macros 2.0 Conditional Compatible
  // ============================================
  MacrosParser.registerMacro("lumiaCouncilModeActive", {
    handler: () => {
      const currentSettings = getSettings();
      // Return yes only if council mode is active with members. Otherwise no. ST Conditional Compatible.
      if (!currentSettings.councilMode || !currentSettings.councilMembers?.length) {
        return "no";
      }
      return "yes";
    },
    description: "Returns Council Mode status indicator. 'yes' if active with members, 'no' otherwise. ST Conditional Compatible.",
    returns: "'yes' if enabled, 'no' if disabled. ST Conditional Compatible.",
    returnType: "string",
    exampleUsage: ["{{lumiaCouncilModeActive}}"],
  });

  // ============================================
  // lumiaQuirks macro - Universal behavioral quirks (all modes)
  // Returns formatted quirks text when quirks are set
  // ============================================
  const lumiaQuirksHandler = ({ resolve }) => {
    const currentSettings = getSettings();

    // Return empty if quirks are disabled or not set
    if (currentSettings.lumiaQuirksEnabled === false || !currentSettings.lumiaQuirks?.trim()) {
      return "";
    }

    // Determine mode for header text
    const isCouncilActive = currentSettings.councilMode &&
                            currentSettings.councilMembers?.length > 0;
    const isChimeraActive = currentSettings.chimeraMode &&
                            currentSettings.selectedDefinitions?.length > 0;

    let header;
    if (isCouncilActive) {
      header = "**Council Quirks**\nThere are a few extra behavioral quirks to the council today.";
    } else if (isChimeraActive) {
      header = "**Chimera Quirks**\nThere are a few extra behavioral quirks to this fused form.";
    } else {
      header = "**Behavioral Quirks**\nThere are a few extra behavioral quirks to embody.";
    }

    const result = `${header} They are as follows:
${currentSettings.lumiaQuirks.trim()}`;

    return resolve ? resolve(result) : result;
  };

  MacrosParser.registerMacro("lumiaQuirks", {
    delayArgResolution: true,
    handler: lumiaQuirksHandler,
    description: "Returns formatted behavioral quirks when quirks text is set. Works in all modes (single, chimera, council).",
    returns: "Formatted quirks prompt or empty string",
    returnType: "string",
    exampleUsage: ["{{lumiaQuirks}}"],
  });

  // Backwards compatibility alias for council quirks
  MacrosParser.registerMacro("lumiaCouncilQuirks", {
    delayArgResolution: true,
    handler: lumiaQuirksHandler,
    description: "[Deprecated - use {{lumiaQuirks}}] Alias for lumiaQuirks macro.",
    returns: "Formatted quirks prompt or empty string",
    returnType: "string",
    exampleUsage: ["{{lumiaCouncilQuirks}}"],
  });

  // ============================================
  // lumiaStateSynthesis macro - Smart unified synthesis/soundoff
  // Automatically outputs the right prompt based on current mode:
  // - Council mode: Council soundoff (members interact as distinct individuals)
  // - Non-council with multiple traits: Synthesis (blend into coherent self)
  // - Neither: Empty
  // ============================================
  MacrosParser.registerMacro("lumiaStateSynthesis", {
    delayArgResolution: true,
    handler: ({ resolve }) => {
      const currentSettings = getSettings();

      // Check if council mode is active
      const isCouncilActive = currentSettings.councilMode &&
                              currentSettings.councilMembers?.length > 0;

      if (isCouncilActive) {
        // Council mode: output soundoff prompt for member interaction
        const memberCount = currentSettings.councilMembers.length;
        const result = `**Council Sound-Off**
The council consists of ${memberCount} distinct members, each with their own voice, perspective, and mannerisms. Council dynamics require:
- Each member maintains their UNIQUE personality—do not blend or homogenize voices
- Members should react to and engage WITH EACH OTHER: debate, agree, tease, support, challenge
- Acknowledge what other council members say or do; don't ignore fellow members
- Have genuine conversations and interactions, not just sequential monologues
- Show interpersonal dynamics: alliances, rivalries, inside jokes, shared history
- Let personality clashes and harmonies emerge naturally between members`;
        return resolve ? resolve(result) : result;
      }

      // Non-council: check if there's something to synthesize
      const hasMultipleBehaviors = (currentSettings.selectedBehaviors?.length || 0) > 1;
      const hasMultiplePersonalities = (currentSettings.selectedPersonalities?.length || 0) > 1;
      const hasChimeraDefinitions = currentSettings.chimeraMode &&
                                    (currentSettings.selectedDefinitions?.length || 0) > 1;

      // If nothing to synthesize, return empty
      if (!hasMultipleBehaviors && !hasMultiplePersonalities && !hasChimeraDefinitions) {
        return "";
      }

      // Non-council with multiple traits: output synthesis prompt
      const result = `**State Synthesis**
Assess each active personality component. Affirm synthesis: My body is [details, clothing, shape]. I am {trait 1}, {trait 2}... So I am [blended description]. Recall how this synthesized self speaks and acts—adopt ALL active traits harmoniously. Never dull or stale.`;

      return resolve ? resolve(result) : result;
    },
    description: "Smart synthesis macro. Council mode: soundoff for member interaction. Non-council: synthesis when multiple traits active.",
    returns: "Appropriate prompt or empty string",
    returnType: "string",
    exampleUsage: ["{{lumiaStateSynthesis}}"],
  });
}
