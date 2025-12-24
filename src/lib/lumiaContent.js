/**
 * Lumia Content Module
 * Handles Lumia definition, behavior, and personality content retrieval and macro processing
 */

import {
  getSettings,
  getCurrentRandomLumia,
  setCurrentRandomLumia,
} from "./settingsManager.js";
import { getItemFromLibrary } from "./dataProcessor.js";

/**
 * Ensure a random Lumia is selected for macro expansion
 * Selects a random item from all available packs if not already selected
 */
export function ensureRandomLumia() {
  if (getCurrentRandomLumia()) return;

  const settings = getSettings();
  const allItems = [];

  if (settings.packs) {
    Object.values(settings.packs).forEach((pack) => {
      if (pack.items && pack.items.length > 0) {
        allItems.push(...pack.items);
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
    processed = processed.replace(
      /\{\{randomLumia\.name\}\}/g,
      currentRandomLumia.lumiaDefName || "",
    );
    processed = processed.replace(
      /\{\{randomLumia\.pers\}\}/g,
      currentRandomLumia.lumia_personality || "",
    );
    processed = processed.replace(
      /\{\{randomLumia\.behav\}\}/g,
      currentRandomLumia.lumia_behavior || "",
    );
    processed = processed.replace(
      /\{\{randomLumia\.phys\}\}/g,
      currentRandomLumia.lumiaDef || "",
    );
    processed = processed.replace(
      /\{\{randomLumia\}\}/g,
      currentRandomLumia.lumiaDef || "",
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

  const memberData = councilMembers
    .map((member) => {
      const item = getItemFromLibrary(member.packName, member.itemName);
      if (!item || !item.lumiaDef) return null;
      return {
        name: item.lumiaDefName || "Unknown",
        content: processNestedRandomLumiaMacros(item.lumiaDef),
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

  councilMembers.forEach((member) => {
    const item = getItemFromLibrary(member.packName, member.itemName);
    const memberName = item?.lumiaDefName || member.itemName || "Unknown";

    const behaviorContents = [];

    // First, include the member's own inherent behavior from their Lumia definition
    if (item?.lumia_behavior) {
      const inherentBehavior = processNestedRandomLumiaMacros(item.lumia_behavior);
      behaviorContents.push(inherentBehavior);
    }

    // Then add any additional behaviors selected for this member
    const additionalBehaviors = member.behaviors || [];
    additionalBehaviors.forEach((sel) => {
      const behaviorItem = getItemFromLibrary(sel.packName, sel.itemName);
      if (!behaviorItem || !behaviorItem.lumia_behavior) return;

      let content = processNestedRandomLumiaMacros(behaviorItem.lumia_behavior);

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

  const memberPersonalities = [];

  memberPersonalities.push("## COUNCIL MEMBER PERSONALITIES");
  memberPersonalities.push("");
  memberPersonalities.push("Each Council member has their own distinct personality and inner nature:");
  memberPersonalities.push("");

  councilMembers.forEach((member) => {
    const item = getItemFromLibrary(member.packName, member.itemName);
    const memberName = item?.lumiaDefName || member.itemName || "Unknown";

    const personalityContents = [];

    // First, include the member's own inherent personality from their Lumia definition
    if (item?.lumia_personality) {
      const inherentPersonality = processNestedRandomLumiaMacros(item.lumia_personality);
      personalityContents.push(inherentPersonality);
    }

    // Then add any additional personalities selected for this member
    const additionalPersonalities = member.personalities || [];
    additionalPersonalities.forEach((sel) => {
      const persItem = getItemFromLibrary(sel.packName, sel.itemName);
      if (!persItem || !persItem.lumia_personality) return;

      let content = processNestedRandomLumiaMacros(persItem.lumia_personality);

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
      if (!item || !item.lumiaDef) return null;
      return {
        name: item.lumiaDefName || "Unknown",
        content: processNestedRandomLumiaMacros(item.lumiaDef),
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
        if (type === "behavior") content = item.lumia_behavior || "";
        if (type === "personality") content = item.lumia_personality || "";

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
  if (type === "def") content = item.lumiaDef || "";

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
 * Register all Lumia-related macros with MacrosParser
 * @param {Object} MacrosParser - The SillyTavern MacrosParser instance
 */
export function registerLumiaMacros(MacrosParser) {
  console.log("[LumiverseHelper] Registering Lumia macros...");

  // Random Lumia macros
  MacrosParser.registerMacro("randomLumia", () => {
    ensureRandomLumia();
    const currentRandomLumia = getCurrentRandomLumia();
    const result = currentRandomLumia ? currentRandomLumia.lumiaDef || "" : "";
    console.log("[LumiverseHelper] randomLumia macro called, result length:", result.length);
    return result;
  });

  MacrosParser.registerMacro("randomLumia.phys", () => {
    ensureRandomLumia();
    const currentRandomLumia = getCurrentRandomLumia();
    return currentRandomLumia ? currentRandomLumia.lumiaDef || "" : "";
  });

  MacrosParser.registerMacro("randomLumia.pers", () => {
    ensureRandomLumia();
    const currentRandomLumia = getCurrentRandomLumia();
    return currentRandomLumia ? currentRandomLumia.lumia_personality || "" : "";
  });

  MacrosParser.registerMacro("randomLumia.behav", () => {
    ensureRandomLumia();
    const currentRandomLumia = getCurrentRandomLumia();
    return currentRandomLumia ? currentRandomLumia.lumia_behavior || "" : "";
  });

  MacrosParser.registerMacro("randomLumia.name", () => {
    ensureRandomLumia();
    const currentRandomLumia = getCurrentRandomLumia();
    return currentRandomLumia ? currentRandomLumia.lumiaDefName || "" : "";
  });

  // Selected Lumia macros
  MacrosParser.registerMacro("lumiaDef", () => {
    const currentSettings = getSettings();
    console.log("[LumiverseHelper] lumiaDef macro called, councilMode:", currentSettings.councilMode, "chimeraMode:", currentSettings.chimeraMode, "selectedDefinition:", currentSettings.selectedDefinition);

    // Council mode takes priority: multiple independent Lumias
    if (currentSettings.councilMode && currentSettings.councilMembers?.length > 0) {
      console.log("[LumiverseHelper] lumiaDef: Council mode with", currentSettings.councilMembers.length, "members");
      const result = getCouncilDefContent(currentSettings.councilMembers);
      console.log("[LumiverseHelper] lumiaDef Council result length:", result.length);
      return result;
    }

    // Chimera mode: fuse multiple definitions
    if (currentSettings.chimeraMode && currentSettings.selectedDefinitions?.length > 0) {
      console.log("[LumiverseHelper] lumiaDef: Chimera mode with", currentSettings.selectedDefinitions.length, "definitions");
      const result = getChimeraContent(currentSettings.selectedDefinitions);
      console.log("[LumiverseHelper] lumiaDef Chimera result length:", result.length);
      return result;
    }

    // Normal single definition
    if (!currentSettings.selectedDefinition) {
      console.log("[LumiverseHelper] lumiaDef: No definition selected, returning empty");
      return "";
    }
    const result = getLumiaContent("def", currentSettings.selectedDefinition);
    console.log("[LumiverseHelper] lumiaDef result length:", result.length);
    return result;
  });

  MacrosParser.registerMacro("lumiaDef.len", () => {
    const currentSettings = getSettings();
    // In Council mode, return count of council members
    if (currentSettings.councilMode && currentSettings.councilMembers?.length > 0) {
      return String(currentSettings.councilMembers.length);
    }
    // In Chimera mode, return count of selected definitions
    if (currentSettings.chimeraMode && currentSettings.selectedDefinitions?.length > 0) {
      return String(currentSettings.selectedDefinitions.length);
    }
    return currentSettings.selectedDefinition ? "1" : "0";
  });

  MacrosParser.registerMacro("lumiaBehavior", () => {
    const currentSettings = getSettings();

    // Council mode: get behaviors per member
    if (currentSettings.councilMode && currentSettings.councilMembers?.length > 0) {
      return getCouncilBehaviorContent(currentSettings.councilMembers);
    }

    // Normal mode
    return getLumiaContent("behavior", currentSettings.selectedBehaviors);
  });

  MacrosParser.registerMacro("lumiaBehavior.len", () => {
    const currentSettings = getSettings();
    // In Council mode, count total behaviors across all members
    if (currentSettings.councilMode && currentSettings.councilMembers?.length > 0) {
      const total = currentSettings.councilMembers.reduce(
        (sum, member) => sum + (member.behaviors?.length || 0),
        0,
      );
      return String(total);
    }
    return String(currentSettings.selectedBehaviors?.length || 0);
  });

  MacrosParser.registerMacro("lumiaPersonality", () => {
    const currentSettings = getSettings();

    // Council mode: get personalities per member
    if (currentSettings.councilMode && currentSettings.councilMembers?.length > 0) {
      return getCouncilPersonalityContent(currentSettings.councilMembers);
    }

    // Normal mode
    return getLumiaContent(
      "personality",
      currentSettings.selectedPersonalities,
    );
  });

  MacrosParser.registerMacro("lumiaPersonality.len", () => {
    const currentSettings = getSettings();
    // In Council mode, count total personalities across all members
    if (currentSettings.councilMode && currentSettings.councilMembers?.length > 0) {
      const total = currentSettings.councilMembers.reduce(
        (sum, member) => sum + (member.personalities?.length || 0),
        0,
      );
      return String(total);
    }
    return String(currentSettings.selectedPersonalities?.length || 0);
  });

  // Loom content macros
  MacrosParser.registerMacro("loomStyle", () => {
    const currentSettings = getSettings();
    if (
      !currentSettings.selectedLoomStyle ||
      currentSettings.selectedLoomStyle.length === 0
    )
      return "";
    return getLoomContent(currentSettings.selectedLoomStyle);
  });

  MacrosParser.registerMacro("loomStyle.len", () => {
    const currentSettings = getSettings();
    return String(currentSettings.selectedLoomStyle?.length || 0);
  });

  MacrosParser.registerMacro("loomUtils", () => {
    const currentSettings = getSettings();
    if (
      !currentSettings.selectedLoomUtils ||
      currentSettings.selectedLoomUtils.length === 0
    )
      return "";
    return getLoomContent(currentSettings.selectedLoomUtils);
  });

  MacrosParser.registerMacro("loomUtils.len", () => {
    const currentSettings = getSettings();
    return String(currentSettings.selectedLoomUtils?.length || 0);
  });

  MacrosParser.registerMacro("loomRetrofits", () => {
    const currentSettings = getSettings();
    if (
      !currentSettings.selectedLoomRetrofits ||
      currentSettings.selectedLoomRetrofits.length === 0
    )
      return "";
    return getLoomContent(currentSettings.selectedLoomRetrofits);
  });

  MacrosParser.registerMacro("loomRetrofits.len", () => {
    const currentSettings = getSettings();
    return String(currentSettings.selectedLoomRetrofits?.length || 0);
  });
}
