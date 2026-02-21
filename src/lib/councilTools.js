/**
 * Council Tools Module
 * 
 * Provides tool calling functionality for council members, allowing each member
 * to independently contribute suggestions/directions without influence from others.
 * 
 * Uses direct fetch() calls with native tool_use API (Anthropic) or function calling
 * (OpenAI-compatible) instead of generateRaw, giving full control over request bodies
 * and avoiding parameter mapping bugs from ST's internal pipeline.
 * 
 * Tool results are collected into a single Markdown block for council deliberation.
 */

import { getSettings, MODULE_NAME } from "./settingsManager.js";
import { getContext, getUserPersona, getCharacterCardInfo, registerFunctionTool, unregisterFunctionTool, isToolCallingSupported } from "../stContext.js";
import { getItemFromLibrary } from "./dataProcessor.js";
import { getLumiaField } from "./lumiaContent.js";
import { getProviderConfig, fetchSecretKey } from "./summarization.js";
import {
  showCouncilIndicator,
  addMemberToIndicator,
  markIndicatorComplete,
  hideCouncilIndicator,
} from "./councilVisuals.js";

// Prefix for ST ToolManager registrations to avoid name collisions
const ST_TOOL_PREFIX = "lumiverse_council_";

// Track which tools are currently registered with ST's ToolManager
let registeredSTTools = new Set();

// Storage for captured world info entries — refreshed each generation cycle
let capturedWorldInfoEntries = [];

/**
 * Capture activated world info entries from the WORLD_INFO_ACTIVATED event.
 * Stores only the text content (no metadata) to minimize token usage.
 * @param {Array} entries - Array of activated WI entry objects
 */
export function captureWorldInfoEntries(entries) {
  if (!Array.isArray(entries)) return;
  capturedWorldInfoEntries = entries
    .filter(e => e.content && e.content.trim())
    .map(e => e.content.trim());
  console.log(`[${MODULE_NAME}] Captured ${capturedWorldInfoEntries.length} world info entries for tool context enrichment`);
}

/**
 * Get the currently captured world info entry texts.
 * @returns {Array<string>} Array of entry content strings
 */
export function getCapturedWorldInfoEntries() {
  return [...capturedWorldInfoEntries];
}

/**
 * Clear captured world info entries. Called at the start of each generation cycle.
 */
export function clearWorldInfoEntries() {
  capturedWorldInfoEntries = [];
}

// Tool definitions with prompts and JSON schemas for each tool type
const COUNCIL_TOOLS = {
  suggest_direction: {
    name: "suggest_direction",
    displayName: "Suggest Direction",
    description: "Suggest where the story should go next based on current context",
    prompt: `Based on the current story context, suggest a clear direction for where the narrative should go next.

Consider:
- Character motivations and arcs
- Plot momentum and pacing  
- Themes and emotional beats
- Potential conflicts or resolutions

Provide a specific, actionable suggestion that could guide the next scene or story beat. Be concise but detailed enough to be useful.`,
    inputSchema: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          description: "A clear, specific suggestion for where the story should go next. Include reasoning based on character motivations, plot momentum, and emotional beats.",
        },
        priority: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "How urgently this direction should be pursued in the narrative.",
        },
      },
      required: ["direction"],
    },
  },
  
  analyze_character: {
    name: "analyze_character",
    displayName: "Analyze Character",
    description: "Analyze a character's current state and suggest development opportunities",
    prompt: `Analyze the current emotional and psychological state of the main characters in this scene.

Consider:
- What are they feeling right now?
- What do they want/need?
- What internal conflicts are present?
- How might they grow or change?
- What actions would be authentic to their nature?

Provide insights that could inform their next actions or dialogue.`,
    inputSchema: {
      type: "object",
      properties: {
        analysis: {
          type: "string",
          description: "Analysis of the character's current emotional and psychological state, including what they feel, want, and what internal conflicts are present.",
        },
        development_opportunities: {
          type: "string",
          description: "Specific suggestions for how the character could grow, change, or take authentic actions.",
        },
      },
      required: ["analysis"],
    },
  },
  
  propose_twist: {
    name: "propose_twist",
    displayName: "Propose Twist",
    description: "Propose an unexpected plot development or revelation",
    prompt: `Propose an unexpected twist, revelation, or complication for the story.

This could be:
- A hidden truth coming to light
- An unexpected arrival or departure
- A sudden change in circumstances
- A revelation about relationships or past events
- An unforeseen consequence of recent actions

Make it surprising but internally consistent with established story elements.`,
    inputSchema: {
      type: "object",
      properties: {
        twist: {
          type: "string",
          description: "The proposed twist, revelation, or complication. Should be surprising but internally consistent with established story elements.",
        },
        setup_elements: {
          type: "string",
          description: "Existing story elements that support or foreshadow this twist, making it feel earned rather than random.",
        },
      },
      required: ["twist"],
    },
  },
  
  voice_concern: {
    name: "voice_concern",
    displayName: "Voice Concern",
    description: "Voice concerns about current story trajectory or pacing",
    prompt: `Voice concerns about the current state of the narrative.

Consider:
- Is the pacing too fast or too slow?
- Are character actions consistent with their established nature?
- Are there missed opportunities for drama or development?
- Could certain elements be more impactful?
- Are there logical inconsistencies or plot holes?

Be constructive but honest about what could be improved.`,
    inputSchema: {
      type: "object",
      properties: {
        concern: {
          type: "string",
          description: "A specific concern about the current story trajectory, pacing, character consistency, or missed opportunities.",
        },
        suggestion: {
          type: "string",
          description: "A constructive suggestion for how to address the concern.",
        },
      },
      required: ["concern"],
    },
  },
  
  highlight_opportunity: {
    name: "highlight_opportunity",
    displayName: "Highlight Opportunity",
    description: "Point out a narrative opportunity that should be explored",
    prompt: `Identify a specific narrative opportunity that the story could capitalize on.

Look for:
- Unexplored character dynamics
- Story threads that could be developed
- Emotional moments that could be deepened
- Worldbuilding elements that could be expanded
- Themes that could be reinforced

Point out what makes this opportunity compelling and how it could enhance the story.`,
    inputSchema: {
      type: "object",
      properties: {
        opportunity: {
          type: "string",
          description: "A specific narrative opportunity that could be capitalized on, explaining what makes it compelling.",
        },
        enhancement: {
          type: "string",
          description: "How exploring this opportunity would enhance the story.",
        },
      },
      required: ["opportunity"],
    },
  },
  
  worldbuilding_note: {
    name: "worldbuilding_note",
    displayName: "Worldbuilding Note",
    description: "Suggest worldbuilding details or lore that could enrich the setting",
    prompt: `Suggest worldbuilding details, lore, or setting elements that could enrich the current scene or story.

Consider:
- Cultural practices or traditions relevant to the moment
- Historical context that adds depth
- Environmental or sensory details
- Social dynamics or power structures
- Magical systems or technological elements

Provide specific details that feel organic to the established world.`,
    inputSchema: {
      type: "object",
      properties: {
        detail: {
          type: "string",
          description: "A specific worldbuilding detail, piece of lore, or setting element that would enrich the current scene.",
        },
        integration: {
          type: "string",
          description: "How this detail could be naturally integrated into the narrative without feeling forced.",
        },
      },
      required: ["detail"],
    },
  },

  full_canon: {
    name: "full_canon",
    displayName: "Full Canon Analysis",
    description: "Analyze how the character should act, talk, think, and portray themselves in 100% faithful source material adherence",
    prompt: `Analyze the current scene and determine how the character should authentically behave, speak, think, and present themselves with ZERO deviation from established source material and lore.

Ground your analysis in:
- The current location and setting context
- Established character behaviors, personality traits, and mannerisms from source material
- How the character would genuinely react to the current situation based on their canonical history
- Speech patterns, vocabulary, and thought processes true to the character
- World lore and established rules that constrain or inform their actions

Provide specific guidance on what the character should do, say, or think next, ensuring 100% fidelity to source material with no creative liberties or AU interpretations.`,
    inputSchema: {
      type: "object",
      properties: {
        character_analysis: {
          type: "string",
          description: "Analysis of how the character should authentically behave, speak, and think based on 100% source material fidelity, grounded in current location and established character traits.",
        },
        recommended_action: {
          type: "string",
          description: "Specific guidance on what the character should do, say, or think next with zero deviation from canonical behavior.",
        },
        canon_justification: {
          type: "string",
          description: "Reference to specific source material, lore, or established character traits that justify this analysis and recommendation.",
        },
      },
      required: ["character_analysis", "recommended_action"],
    },
  },

  au_canon: {
    name: "au_canon",
    displayName: "AU Canon Analysis",
    description: "Analyze character behavior with minor flexibility for alternate universe scenarios while maintaining core authenticity",
    prompt: `Analyze the current scene and determine how the character should behave, speak, think, and present themselves with MINOR flexibility for alternate universe (AU) interpretations, while maintaining core character authenticity.

Ground your analysis in:
- The current location and setting context (which may differ from canon)
- Core character personality traits that remain consistent even in AUs
- How AU circumstances might reasonably influence behavior without breaking character
- Speech patterns and thought processes that feel authentic to the character's essence
- AU-specific lore or setting rules that inform actions

Allow for:
- Situational adaptations to different settings or circumstances
- Evolution of relationships in AU contexts
- Creative interpretations that don't contradict core personality

Do NOT allow:
- Complete personality overhauls
- Out-of-character behavior that contradicts established traits
- Actions that would be impossible given the character's nature

Provide specific guidance on what the character should do, say, or think next, balancing AU flexibility with character authenticity.`,
    inputSchema: {
      type: "object",
      properties: {
        character_analysis: {
          type: "string",
          description: "Analysis of how the character should behave, speak, and think with minor AU flexibility, grounded in current location and core character traits.",
        },
        recommended_action: {
          type: "string",
          description: "Specific guidance on what the character should do, say, or think next, balancing AU flexibility with character authenticity.",
        },
        au_justification: {
          type: "string",
          description: "Explanation of how AU circumstances influence this recommendation while maintaining core character authenticity.",
        },
        canon_fidelity: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "Assessment of how closely this recommendation adheres to canonical character traits (high = very faithful, medium = some AU flexibility, low = significant AU interpretation).",
        },
      },
      required: ["character_analysis", "recommended_action"],
    },
  },

  prose_guardian: {
    name: "prose_guardian",
    displayName: "Prose Guardian",
    description: "Analyze previous messages for repeated patterns in speech, thought, or literary structure and guide restructuring",
    prompt: `Analyze the recent messages in this conversation for repetitive patterns, stylistic tics, or literary structures that may be becoming stale or predictable.

Look for:
- Repeated sentence structures or rhythms
- Overused phrases, transitions, or dialogue tags
- Predictable thought patterns or internal monologue structures
- Repetitive descriptive techniques or sensory details
- Formulaic paragraph or scene structures
- Character voice inconsistencies or drift
- Over-reliance on specific literary devices (metaphors, similes, etc.)

For each pattern identified:
- Quote or reference specific examples
- Explain why this pattern is problematic (monotony, weakening impact, etc.)
- Suggest specific alternatives or restructuring approaches
- Provide guidance on varying sentence length, structure, and rhythm

Your goal is to help maintain fresh, engaging prose that keeps readers invested through stylistic variety and intentional craft.`,
    inputSchema: {
      type: "object",
      properties: {
        patterns_identified: {
          type: "string",
          description: "List of repetitive patterns, stylistic tics, or literary structures identified in recent messages, with specific examples quoted.",
        },
        impact_analysis: {
          type: "string",
          description: "Analysis of how these patterns affect reader engagement and prose quality (monotony, predictability, weakening impact, etc.).",
        },
        restructuring_guidance: {
          type: "string",
          description: "Specific, actionable guidance on restructuring approaches, alternative phrasings, and techniques for varying sentence structure, rhythm, and literary devices.",
        },
        priority_fixes: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
          description: "Priority level for addressing these patterns (critical = immediate attention needed, high = should fix soon, medium = moderate concern, low = minor stylistic preference).",
        },
      },
      required: ["patterns_identified", "restructuring_guidance"],
    },
  },

  flame_kindler: {
    name: "flame_kindler",
    displayName: "Flame Kindler",
    description: "Analyze relationships between characters and guide their logical progression based on established history, character details, and lore",
    prompt: `Analyze the relationships between characters in the current scene and provide guidance on how these relationships should logically progress.

Consider:
- Established history between characters (shared experiences, past interactions, conflicts, bonds)
- Current relationship status (strangers, acquaintances, friends, rivals, enemies, romantic interests, etc.)
- Character personalities and how they influence relationship dynamics
- Recent developments that might shift relationship trajectories
- World lore and cultural norms that affect relationships
- Natural pacing - how quickly or slowly should this relationship develop?

For each significant relationship:
- Identify the current state and emotional tenor
- Note key historical moments that inform the present
- Assess character compatibility and friction points
- Recommend pacing (slow burn, gradual, moderate, accelerated)
- Suggest next steps or milestones in the relationship arc
- Flag any potential conflicts or complications

Your goal is to help create authentic, compelling relationship progression that feels earned and true to the characters and world.`,
    inputSchema: {
      type: "object",
      properties: {
        relationships_analyzed: {
          type: "string",
          description: "Analysis of significant character relationships in the current scene, including current status, emotional tenor, and key historical moments.",
        },
        progression_guidance: {
          type: "string",
          description: "Specific guidance on how each relationship should progress, including recommended pacing, next steps, milestones, and potential complications.",
        },
        pacing_recommendations: {
          type: "string",
          description: "Assessment of relationship development speed (slow burn, gradual, moderate, accelerated) with justification based on character dynamics and story needs.",
        },
        conflict_opportunities: {
          type: "string",
          description: "Potential conflicts, friction points, or complications that could arise in these relationships to create dramatic tension.",
        },
      },
      required: ["relationships_analyzed", "progression_guidance"],
    },
  },
};

// Storage for latest tool results - cleared each generation
let latestToolResults = [];
let toolExecutionPromise = null;

// Flag to track whether a generation cycle is in progress.
// Used to detect recursive Generate() calls (from ST tool call handling)
// so the interceptor doesn't clear tool results that inline actions just accumulated.
let generationCycleActive = false;

/**
 * Get all available council tool definitions
 * @returns {Object} Map of tool names to tool definitions
 */
export function getAvailableTools() {
  return { ...COUNCIL_TOOLS };
}

/**
 * Get tool definition by name
 * @param {string} toolName - The tool name
 * @returns {Object|null} The tool definition or null
 */
export function getToolByName(toolName) {
  return COUNCIL_TOOLS[toolName] || null;
}

/**
 * Get all available tool names as an array
 * @returns {Array} Array of tool name strings
 */
export function getToolNames() {
  return Object.keys(COUNCIL_TOOLS);
}

/**
 * Set the latest tool results (called by interceptor after execution)
 * @param {Array} results - Array of tool result objects
 */
export function setLatestToolResults(results) {
  latestToolResults = results || [];
}

/**
 * Get the latest tool results
 * @returns {Array} Array of tool result objects
 */
export function getLatestToolResults() {
  return [...latestToolResults];
}

/**
 * Clear tool results (called at start of new generation)
 */
export function clearToolResults() {
  latestToolResults = [];
}

/**
 * Check if a generation cycle is currently active.
 * Used by the interceptor to detect recursive Generate() calls from ST tool handling.
 * @returns {boolean} True if we're inside a generation cycle (i.e., this is a recursive call)
 */
export function isGenerationCycleActive() {
  return generationCycleActive;
}

/**
 * Mark the start of a generation cycle.
 * Called by the interceptor on the first (non-recursive) call.
 */
export function markGenerationCycleStart() {
  generationCycleActive = true;
}

/**
 * Mark the end of a generation cycle.
 * Called when generation completes (GENERATION_ENDED/STOPPED events).
 */
export function markGenerationCycleEnd() {
  generationCycleActive = false;
  toolExecutionPromise = null;
}

/**
 * Check if council tools are enabled for current settings
 * @returns {boolean}
 */
export function areCouncilToolsEnabled() {
  const settings = getSettings();
  return settings.councilMode === true && 
         settings.councilTools?.enabled === true &&
         settings.councilMembers?.length > 0;
}

/**
 * Build user control guidance text based on the allowUserControl setting.
 * When disabled (default), instructs the LLM to focus on NPCs only.
 * When enabled, allows the LLM to plan/speak for the user's character too.
 * @returns {string} Guidance block to inject into tool prompts
 */
function buildUserControlGuidance() {
  const settings = getSettings();
  const allowUserControl = settings.councilTools?.allowUserControl === true;

  if (allowUserControl) {
    return `\n\n### User Character Guidance ###\nYou may plan and suggest actions, dialogue, thoughts, and development for ALL characters in the story, including {{user}} (the user's character). Treat all participants — including the user — as characters whose arcs, actions, and dialogue you can direct and shape.`;
  }

  return `\n\n### User Character Guidance ###\nIMPORTANT: Do NOT plan actions, dialogue, thoughts, or decisions for {{user}} (the user's character). Focus exclusively on how the story's non-player characters should react, behave, and develop in response to the user's input. Your suggestions should only concern the characters, world, and narrative elements — never dictate what the user's character does, says, thinks, or feels.`;
}

/**
 * Build a role-based tool descriptor for a council member
 * @param {Object} member - Council member object
 * @returns {string} Role descriptor for tool prompts
 */
function buildRoleDescriptor(member) {
  if (!member.role) return "";
  
  return `Your role on the council is: ${member.role}. 
When using your tools, consider how your role influences your perspective and recommendations.
Draw upon your expertise as ${member.role} to provide valuable insights.`;
}

/**
 * Build Lumia personality, behavior, and lens context for a council member
 * This ensures council members answer from their biased perspective
 * @param {Object} member - Council member object
 * @returns {string} Lumia context for tool prompts
 */
function buildLumiaContext(member) {
  const item = getItemFromLibrary(member.packName, member.itemName);
  if (!item) return "";
  
  const personality = getLumiaField(item, "personality");
  const behavior = getLumiaField(item, "behavior");
  const definition = getLumiaField(item, "def");
  
  const parts = [];
  
  if (definition) {
    parts.push(`### Your Physical Identity ###\n${definition}`);
  }
  
  if (personality) {
    parts.push(`### Your Personality ###\n${personality}`);
  }
  
  if (behavior) {
    parts.push(`### Your Behavioral Patterns ###\n${behavior}`);
  }
  
  if (parts.length === 0) return "";
  
  return `### WHO YOU ARE ###\n\n${parts.join("\n\n")}\n\n### INSTRUCTION ###\nYou MUST answer ALL tool calls and contributions through the lens of your personality, behavior, and identity described above. Your biases, quirks, speech patterns, and perspective should color every observation and suggestion you make. Do NOT provide generic or neutral responses—filter everything through who you are. Your unique voice and worldview must be evident in every contribution.`;
}

/**
 * Build chat context text from recent messages
 * @param {Array} chatContext - Full chat array
 * @returns {string} Formatted context text
 */
function buildContextText(chatContext) {
  const settings = getSettings();
  // Use configurable context window for sidecar mode, fallback to 10 for inline
  const isSidecarMode = getCouncilToolsMode() === 'sidecar';
  const contextWindow = isSidecarMode 
    ? (settings.councilTools?.sidecarContextWindow || 25)
    : 10;
  const recentMessages = chatContext.slice(-contextWindow);
  return recentMessages
    .map((msg) => {
      const name = msg.is_user ? "{{user}}" : (msg.name || "Assistant");
      return `${name}: ${msg.mes || msg.content || ""}`;
    })
    .join("\n\n");
}

/**
 * Build optional context enrichment text based on councilTools settings.
 * Gathers user persona, character card info, and/or captured world book entries
 * into a formatted block for injection into sidecar tool prompts.
 * @returns {string} Formatted enrichment context block, or empty string if nothing enabled/available
 */
function buildEnrichmentContext() {
  const settings = getSettings();
  const ct = settings.councilTools || {};
  const sections = [];

  // User persona
  if (ct.includeUserPersona) {
    const persona = getUserPersona();
    if (persona && persona.persona) {
      sections.push(
        `### User Persona ###\nName: ${persona.name}\n${persona.persona}`
      );
    }
  }

  // Character description / personality
  if (ct.includeCharacterInfo) {
    const charInfo = getCharacterCardInfo();
    if (charInfo) {
      const parts = [];
      if (charInfo.description) parts.push(`Description: ${charInfo.description}`);
      if (charInfo.personality) parts.push(`Personality: ${charInfo.personality}`);
      if (charInfo.scenario) parts.push(`Scenario: ${charInfo.scenario}`);
      if (parts.length > 0) {
        sections.push(
          `### Character Card: ${charInfo.name} ###\n${parts.join("\n\n")}`
        );
      }
    }
  }

  // Triggered world book entries
  if (ct.includeWorldInfo) {
    const entries = getCapturedWorldInfoEntries();
    if (entries.length > 0) {
      sections.push(
        `### Active World Book Entries ###\n${entries.join("\n\n---\n\n")}`
      );
    }
  }

  if (sections.length === 0) return "";

  return `### Context Enrichment ###\n\n${sections.join("\n\n")}`;
}

/**
 * Build Anthropic-format tools array from council tool names
 * @param {Array<string>} toolNames - Array of tool names to include
 * @returns {Array} Anthropic tools array
 */
function buildAnthropicTools(toolNames) {
  return toolNames
    .map((toolName) => {
      const tool = COUNCIL_TOOLS[toolName];
      if (!tool) return null;
      return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      };
    })
    .filter(Boolean);
}

/**
 * Build OpenAI-format tools array from council tool names
 * @param {Array<string>} toolNames - Array of tool names to include
 * @returns {Array} OpenAI tools array
 */
function buildOpenAITools(toolNames) {
  return toolNames
    .map((toolName) => {
      const tool = COUNCIL_TOOLS[toolName];
      if (!tool) return null;
      return {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      };
    })
    .filter(Boolean);
}

/**
 * Resolve API key and provider config for council tools.
 * Uses the dedicated council tools LLM configuration (settings.councilTools.llm).
 * Falls back to summarization secondary config for backwards compatibility.
 * @returns {Promise<{apiKey: string, providerConfig: Object, secondary: Object, provider: string}>}
 */
async function resolveProviderConfig() {
  const settings = getSettings();
  // Use dedicated council tools LLM config; fall back to summarization secondary
  const llmConfig = settings.councilTools?.llm || settings.summarization?.secondary || {};
  const provider = llmConfig.provider || "anthropic";
  const providerConfig = getProviderConfig(provider);

  let apiKey;
  if (provider === "custom") {
    apiKey = llmConfig.apiKey;
    if (!apiKey) {
      throw new Error("No API key specified for custom provider");
    }
  } else {
    apiKey = await fetchSecretKey(providerConfig.secretKey);
    if (!apiKey) {
      throw new Error(
        `No API key found for ${providerConfig.name}. Please add your API key in SillyTavern's API settings.`,
      );
    }
  }

  return { apiKey, providerConfig, secondary: llmConfig, provider };
}

/**
 * Execute all tools for a council member via Anthropic's native tool_use API.
 * Makes a single API call per member with all tools defined, letting the model
 * choose which to invoke.
 * @param {Object} member - Council member object
 * @param {Array<string>} memberTools - Tool names assigned to this member
 * @param {string} contextText - Formatted chat context
 * @param {string} apiKey - API key
 * @param {Object} secondary - Secondary LLM settings
 * @param {string} endpoint - API endpoint
 * @param {string} [enrichmentText=''] - Optional context enrichment block
 * @returns {Promise<Array>} Array of tool results for this member
 */
async function executeToolsForMemberAnthropic(member, memberTools, contextText, apiKey, secondary, endpoint, enrichmentText = '') {
  const item = getItemFromLibrary(member.packName, member.itemName);
  const memberName = getLumiaField(item, "name") || member.itemName || "Unknown";
  const roleDescriptor = buildRoleDescriptor(member);
  const lumiaContext = buildLumiaContext(member);
  const model = secondary.model;
  const maxTokens = Math.max(256, parseInt(secondary.maxTokens, 10) || 4096);
  const temperature = parseFloat(secondary.temperature) || 0.7;

  // Build native tool definitions
  const tools = buildAnthropicTools(memberTools);

  // Build the user prompt that provides context and asks the member to use their tools
  const toolDescriptions = memberTools
    .map((tn) => COUNCIL_TOOLS[tn])
    .filter(Boolean)
    .map((t) => `- **${t.displayName}**: ${t.description}`)
    .join("\n");

  const userPrompt = `You are ${memberName}, a council member contributing to collaborative story direction.

${lumiaContext ? lumiaContext + "\n\n" : ""}${roleDescriptor ? roleDescriptor + "\n\n" : ""}You have the following tools available:
${toolDescriptions}
${enrichmentText ? "\n" + enrichmentText + "\n" : ""}
### Current Story Context ###

${contextText}

### Your Task ###

Review the story context above and use ALL of your assigned tools to provide your contributions. For each tool, provide specific, actionable input from your unique perspective as ${memberName}. Be concise but insightful. Remember to filter all your contributions through your personality, biases, and worldview as described above.${buildUserControlGuidance()}`;

  const requestBody = {
    model: model,
    max_tokens: maxTokens,
    temperature: temperature,
    system: "You are a council member contributing to story direction. Use your tools to provide structured contributions. Be concise and specific. You MUST use all available tools.",
    messages: [{ role: "user", content: userPrompt }],
    tools: tools,
    tool_choice: { type: "any" },
  };

  console.log(`[${MODULE_NAME}] Executing ${memberTools.length} tools for ${memberName} via Anthropic tool_use API`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unable to read error");
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const results = [];

  // Parse tool_use content blocks from the response
  if (data.content && Array.isArray(data.content)) {
    for (const block of data.content) {
      if (block.type === "tool_use") {
        const toolDef = COUNCIL_TOOLS[block.name];
        if (toolDef) {
          // Extract all input values into a readable response string
          const responseText = formatToolInput(block.input, toolDef);
          results.push({
            memberName,
            packName: member.packName,
            itemName: member.itemName,
            toolName: block.name,
            toolDisplayName: toolDef.displayName,
            success: true,
            response: responseText,
          });
        }
      }
    }
  }

  // If the model returned text blocks without tool_use (fallback), capture that too
  if (results.length === 0) {
    const textBlocks = (data.content || []).filter((b) => b.type === "text");
    if (textBlocks.length > 0) {
      const fallbackText = textBlocks.map((b) => b.text).join("\n");
      // Attribute to first tool as a fallback
      const firstTool = COUNCIL_TOOLS[memberTools[0]];
      results.push({
        memberName,
        packName: member.packName,
        itemName: member.itemName,
        toolName: memberTools[0],
        toolDisplayName: firstTool?.displayName || memberTools[0],
        success: true,
        response: fallbackText.trim(),
      });
    }
  }

  return results;
}

/**
 * Execute all tools for a council member via OpenAI-compatible function calling API.
 * @param {Object} member - Council member object
 * @param {Array<string>} memberTools - Tool names assigned to this member
 * @param {string} contextText - Formatted chat context
 * @param {string} apiKey - API key
 * @param {Object} secondary - Secondary LLM settings
 * @param {string} endpoint - API endpoint
 * @param {string} provider - Provider name (for extra headers)
 * @param {string} [enrichmentText=''] - Optional context enrichment block
 * @returns {Promise<Array>} Array of tool results for this member
 */
async function executeToolsForMemberOpenAI(member, memberTools, contextText, apiKey, secondary, endpoint, provider, enrichmentText = '') {
  const item = getItemFromLibrary(member.packName, member.itemName);
  const memberName = getLumiaField(item, "name") || member.itemName || "Unknown";
  const roleDescriptor = buildRoleDescriptor(member);
  const lumiaContext = buildLumiaContext(member);
  const model = secondary.model;
  const maxTokens = Math.max(256, parseInt(secondary.maxTokens, 10) || 4096);
  const temperature = parseFloat(secondary.temperature) || 0.7;

  // Build OpenAI function tool definitions
  const tools = buildOpenAITools(memberTools);

  const toolDescriptions = memberTools
    .map((tn) => COUNCIL_TOOLS[tn])
    .filter(Boolean)
    .map((t) => `- **${t.displayName}**: ${t.description}`)
    .join("\n");

  const userPrompt = `You are ${memberName}, a council member contributing to collaborative story direction.

${lumiaContext ? lumiaContext + "\n\n" : ""}${roleDescriptor ? roleDescriptor + "\n\n" : ""}You have the following tools available:
${toolDescriptions}
${enrichmentText ? "\n" + enrichmentText + "\n" : ""}
### Current Story Context ###

${contextText}

### Your Task ###

Review the story context above and use your assigned tools to provide your contributions. For each tool, provide specific, actionable input from your unique perspective as ${memberName}. Be concise but insightful. Remember to filter all your contributions through your personality, biases, and worldview as described above.${buildUserControlGuidance()}`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (provider === "openrouter") {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "Lumia Injector";
  }

  const requestBody = {
    model: model,
    max_tokens: maxTokens,
    temperature: temperature,
    messages: [
      { role: "system", content: "You are a council member contributing to story direction. Use your tools to provide structured contributions. Be concise and specific." },
      { role: "user", content: userPrompt },
    ],
    tools: tools,
    tool_choice: "auto",
  };

  console.log(`[${MODULE_NAME}] Executing ${memberTools.length} tools for ${memberName} via OpenAI function calling API`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unable to read error");
    throw new Error(`${provider} API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const results = [];

  // Parse tool_calls from the response
  const message = data.choices?.[0]?.message;
  if (message?.tool_calls && Array.isArray(message.tool_calls)) {
    for (const toolCall of message.tool_calls) {
      if (toolCall.type === "function") {
        const toolDef = COUNCIL_TOOLS[toolCall.function.name];
        if (toolDef) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            parsedArgs = { response: toolCall.function.arguments };
          }
          const responseText = formatToolInput(parsedArgs, toolDef);
          results.push({
            memberName,
            packName: member.packName,
            itemName: member.itemName,
            toolName: toolCall.function.name,
            toolDisplayName: toolDef.displayName,
            success: true,
            response: responseText,
          });
        }
      }
    }
  }

  // Fallback: if no tool calls, use the message content
  if (results.length === 0 && message?.content) {
    const firstTool = COUNCIL_TOOLS[memberTools[0]];
    results.push({
      memberName,
      packName: member.packName,
      itemName: member.itemName,
      toolName: memberTools[0],
      toolDisplayName: firstTool?.displayName || memberTools[0],
      success: true,
      response: message.content.trim(),
    });
  }

  return results;
}

/**
 * Execute all tools for a council member via Google's API (prompt-based fallback,
 * as Google's function calling format differs significantly).
 * @param {Object} member - Council member object
 * @param {Array<string>} memberTools - Tool names assigned to this member
 * @param {string} contextText - Formatted chat context
 * @param {string} apiKey - API key
 * @param {Object} secondary - Secondary LLM settings
 * @param {string} baseEndpoint - Base API endpoint
 * @param {string} [enrichmentText=''] - Optional context enrichment block
 * @returns {Promise<Array>} Array of tool results for this member
 */
async function executeToolsForMemberGoogle(member, memberTools, contextText, apiKey, secondary, baseEndpoint, enrichmentText = '') {
  const item = getItemFromLibrary(member.packName, member.itemName);
  const memberName = getLumiaField(item, "name") || member.itemName || "Unknown";
  const roleDescriptor = buildRoleDescriptor(member);
  const lumiaContext = buildLumiaContext(member);
  const model = secondary.model;
  const maxTokens = Math.max(256, parseInt(secondary.maxTokens, 10) || 4096);
  const temperature = parseFloat(secondary.temperature) || 0.7;

  const googleEndpoint = `${baseEndpoint}/${model}:generateContent`;

  // For Google, we use prompt-based tool simulation since their function calling
  // format is substantially different and would need separate handling
  const toolPrompts = memberTools
    .map((tn) => {
      const tool = COUNCIL_TOOLS[tn];
      if (!tool) return null;
      return `## ${tool.displayName}\n${tool.prompt}`;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  const fullPrompt = `You are ${memberName}, a council member contributing to collaborative story direction. Be concise and specific.

${lumiaContext ? lumiaContext + "\n\n" : ""}${roleDescriptor ? roleDescriptor + "\n\n" : ""}${enrichmentText ? enrichmentText + "\n\n" : ""}### Current Story Context ###

${contextText}

### Your Tasks ###

For each task below, provide a clearly labeled response:

${toolPrompts}

Provide your contributions from your unique perspective as ${memberName}, filtering everything through your personality, biases, and worldview. Label each section clearly.${buildUserControlGuidance()}`;

  const requestBody = {
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
    ],
    contents: [
      { role: "user", parts: [{ text: fullPrompt }] },
    ],
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: maxTokens,
    },
  };

  console.log(`[${MODULE_NAME}] Executing ${memberTools.length} tools for ${memberName} via Google prompt-based fallback`);

  const response = await fetch(googleEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unable to read error");
    throw new Error(`Google AI Studio API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const fullText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // For prompt-based fallback, return one result per tool with the combined response
  // attributed to the first tool, since we can't reliably parse sections
  const results = [];
  if (fullText.trim()) {
    // Try to split by tool headers if possible
    for (const toolName of memberTools) {
      const toolDef = COUNCIL_TOOLS[toolName];
      if (!toolDef) continue;
      results.push({
        memberName,
        packName: member.packName,
        itemName: member.itemName,
        toolName: toolName,
        toolDisplayName: toolDef.displayName,
        success: true,
        response: fullText.trim(),
      });
      break; // Only attribute to first tool for prompt-based; full text contains all
    }
  }

  return results;
}

/**
 * Format tool input object into readable text
 * @param {Object} input - The tool input/arguments object
 * @param {Object} toolDef - The tool definition
 * @returns {string} Formatted readable text
 */
function formatToolInput(input, toolDef) {
  if (!input || typeof input !== "object") return String(input || "");

  const parts = [];
  const schema = toolDef.inputSchema?.properties || {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    // Use a human-readable label from the key
    const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    parts.push(`**${label}:** ${value}`);
  }

  return parts.join("\n\n") || JSON.stringify(input);
}

/**
 * Execute all tools for a single council member using the appropriate provider.
 * @param {Object} member - Council member object
 * @param {Array<string>} memberTools - Tool names assigned to this member
 * @param {string} contextText - Formatted chat context
 * @param {Object} providerInfo - Resolved provider config
 * @param {string} [enrichmentText=''] - Optional context enrichment block
 * @returns {Promise<Array>} Array of tool results
 */
async function executeToolsForMember(member, memberTools, contextText, providerInfo, enrichmentText = '') {
  const { apiKey, providerConfig, secondary, provider } = providerInfo;
  const endpoint = provider === "custom" ? secondary.endpoint : providerConfig.endpoint;

  if (!endpoint) {
    throw new Error("No endpoint configured for council tools");
  }

  try {
    if (providerConfig.format === "anthropic") {
      return await executeToolsForMemberAnthropic(member, memberTools, contextText, apiKey, secondary, endpoint, enrichmentText);
    } else if (providerConfig.format === "google") {
      return await executeToolsForMemberGoogle(member, memberTools, contextText, apiKey, secondary, endpoint, enrichmentText);
    } else {
      // OpenAI-compatible (openai, openrouter, chutes, electronhub, nanogpt, zai, custom)
      return await executeToolsForMemberOpenAI(member, memberTools, contextText, apiKey, secondary, endpoint, provider, enrichmentText);
    }
  } catch (error) {
    const item = getItemFromLibrary(member.packName, member.itemName);
    const memberName = getLumiaField(item, "name") || member.itemName || "Unknown";
    console.error(`[${MODULE_NAME}] Tool execution failed for ${memberName}:`, error);

    // Return error results for all tools
    return memberTools.map((toolName) => ({
      memberName,
      packName: member.packName,
      itemName: member.itemName,
      toolName,
      toolDisplayName: COUNCIL_TOOLS[toolName]?.displayName || toolName,
      success: false,
      error: error.message,
      response: "",
    }));
  }
}

/**
 * Execute all tools for all council members.
 * Uses direct fetch() with native tool_use/function calling APIs.
 * All members execute in parallel for maximum efficiency.
 * @returns {Promise<Array>} Array of all tool results
 */
export async function executeAllCouncilTools() {
  const settings = getSettings();
  
  if (!areCouncilToolsEnabled()) {
    clearToolResults();
    return [];
  }

  // Check if we already have a promise in flight (prevents duplicate execution)
  if (toolExecutionPromise) {
    console.log(`[${MODULE_NAME}] Tool execution already in progress, awaiting...`);
    return toolExecutionPromise;
  }

  const context = getContext();
  const chatContext = context?.chat || [];
  const councilMembers = settings.councilMembers || [];

  console.log(`[${MODULE_NAME}] Starting council tool execution for ${councilMembers.length} members...`);

  // Create the execution promise
  toolExecutionPromise = (async () => {
    // Show visual indicator for sidecar mode
    showCouncilIndicator();

    // Resolve provider config once (shared across all members)
    let providerInfo;
    try {
      providerInfo = await resolveProviderConfig();
    } catch (error) {
      console.error(`[${MODULE_NAME}] Failed to resolve provider for council tools:`, error);
      hideCouncilIndicator();
      // Return error results for all members
      const errorResults = [];
      for (const member of councilMembers) {
        for (const toolName of (member.tools || [])) {
          errorResults.push({
            memberName: member.itemName,
            packName: member.packName,
            itemName: member.itemName,
            toolName,
            toolDisplayName: COUNCIL_TOOLS[toolName]?.displayName || toolName,
            success: false,
            error: error.message,
            response: "",
          });
        }
      }
      setLatestToolResults(errorResults);
      return errorResults;
    }

    const contextText = buildContextText(chatContext);
    const enrichmentText = buildEnrichmentContext();

    // Filter members that have tools assigned
    const membersWithTools = councilMembers.filter(
      (m) => m.tools && m.tools.length > 0,
    );

    if (membersWithTools.length === 0) {
      console.log(`[${MODULE_NAME}] No council members have tools assigned`);
      hideCouncilIndicator();
      setLatestToolResults([]);
      return [];
    }

    // Execute all members in parallel - each member is one API call
    // Wrap each execution to track visual progress
    const memberPromises = membersWithTools.map(async (member) => {
      const results = await executeToolsForMember(member, member.tools, contextText, providerInfo, enrichmentText);
      // Add member to visual indicator when their tools complete
      addMemberToIndicator(member);
      return results;
    });

    const memberResultArrays = await Promise.all(memberPromises);
    const allResults = memberResultArrays.flat();

    // Store results for macro access
    setLatestToolResults(allResults);
    
    const successCount = allResults.filter((r) => r.success).length;
    console.log(`[${MODULE_NAME}] Council tool execution complete. ${successCount}/${allResults.length} tools succeeded.`);

    // Mark visual indicator as complete
    markIndicatorComplete();

    return allResults;
  })();

  return toolExecutionPromise;
}

/**
 * Format tool results into the Markdown deliberation block
 * @param {Array} results - Array of tool results
 * @returns {string} Formatted Markdown block
 */
export function formatToolResultsForDeliberation(results) {
  if (!results || results.length === 0) {
    return "## Council Deliberation\n\nNo tools were executed for this generation.";
  }

  const lines = ["## Council Deliberation"];
  lines.push("");
  lines.push("The following contributions have been gathered from council members:");
  lines.push("");

  // Group results by member
  const resultsByMember = {};
  results.forEach((result) => {
    if (!result.success) return;
    
    const key = result.memberName;
    if (!resultsByMember[key]) {
      resultsByMember[key] = [];
    }
    resultsByMember[key].push(result);
  });

  // Format each member's contributions
  Object.entries(resultsByMember).forEach(([memberName, memberResults]) => {
    lines.push(`### **${memberName}** says:`);
    lines.push("");

    memberResults.forEach((result) => {
      lines.push(`**${result.toolDisplayName}:**`);
      lines.push(result.response);
      lines.push("");
    });

    lines.push("---");
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Get the deliberation prompt that instructs the council how to use tool results
 * @returns {string} Deliberation instructions
 */
export function getCouncilDeliberationInstructions() {
  return `## Council Deliberation Instructions

You have access to the contributions from your fellow council members above. 

Your task:
1. Review each member's contributions carefully
2. Debate which suggestions have the most merit
3. Consider how different ideas might combine or conflict
4. Reach a consensus on the best path forward
5. In your OOC commentary, reflect this deliberation process

**CRITICAL - Chain of Thought for Deliberation:**
When reviewing suggestions, you MUST:
- **ALWAYS** attempt to integrate and accommodate ALL reasonable suggestions from council members
- Exhaustively consider how multiple ideas can coexist and complement each other
- Only reject or challenge a suggestion if it would create irreconcilable conflicts with established lore (to the point of nonsense or contradiction)
- Default stance: "How can we make this work together?" rather than "Why won't this work?"
- If two suggestions seem to conflict, explore creative synthesis first before dismissing either
- Treat lore inconsistencies as rare exceptions requiring strong justification, not default responses

**Guidelines for Deliberation:**
- Reference specific contributions by name ("Elandra's suggestion about...", "I disagree with Kael's proposal because...")
- Build upon good ideas ("Taking Mira's point further...")
- When challenging: only do so if the suggestion fundamentally breaks established lore beyond repair
- Find synthesis between competing ideas—this is the DEFAULT expectation
- Your final narrative output should reflect the consensus reached through generous integration

**Tone:** Professional but passionate. You are invested in telling the best possible story through collaborative synthesis.`;
}

/**
 * Get the current council tools execution mode.
 * @returns {'sidecar'|'inline'} The current mode
 */
export function getCouncilToolsMode() {
  const settings = getSettings();
  return settings.councilTools?.mode || "sidecar";
}

// ============================================================================
// INLINE MODE: ST ToolManager Integration
// ============================================================================

/**
 * Sanitize a string for use in a tool name (alphanumeric + underscore only)
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeToolName(str) {
  return str.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

/**
 * Build a unique ST tool name for a specific council member + tool combination.
 * Format: lumiverse_council_<memberId>_<toolName>
 * @param {Object} member - Council member object
 * @param {string} toolName - The base tool name
 * @returns {string} Unique tool name for ST ToolManager
 */
function buildMemberToolName(member, toolName) {
  const memberId = sanitizeToolName(member.id || `${member.packName}_${member.itemName}`);
  return `${ST_TOOL_PREFIX}${memberId}_${toolName}`;
}

/**
 * Build a combined description for an inline tool that includes member-specific context.
 * In inline mode, the main LLM sees the tool descriptions and decides when to call them.
 * @param {Object} toolDef - The COUNCIL_TOOLS definition
 * @param {Object} member - Council member object
 * @returns {string} Enhanced description for ST ToolManager with member context
 */
function buildInlineToolDescription(toolDef, member) {
  const item = getItemFromLibrary(member.packName, member.itemName);
  const memberName = getLumiaField(item, "name") || member.itemName || "Unknown";
  const roleContext = member.role ? ` Their role on the council is: ${member.role}.` : '';
  
  return `[Lumiverse Council - ${memberName}] ${toolDef.description}.${roleContext} ${toolDef.prompt}${buildUserControlGuidance()}`;
}

/**
 * Build the display name for an inline tool, showing which member it belongs to.
 * @param {Object} toolDef - The COUNCIL_TOOLS definition
 * @param {Object} member - Council member object
 * @returns {string} Display name for ST ToolManager UI
 */
function buildInlineToolDisplayName(toolDef, member) {
  const item = getItemFromLibrary(member.packName, member.itemName);
  const memberName = getLumiaField(item, "name") || member.itemName || "Unknown";
  return `${memberName}: ${toolDef.displayName}`;
}

/**
 * Build the action callback for an inline tool specific to a council member.
 * When the main LLM calls this tool, the action runs locally (no extra API call).
 * It stores the result in latestToolResults for the {{lumiaCouncilDeliberation}} macro.
 * @param {Object} toolDef - The COUNCIL_TOOLS definition
 * @param {Object} member - Council member this tool belongs to
 * @returns {Function} Action callback for ToolManager
 */
function buildInlineToolAction(toolDef, member) {
  return async (args) => {
    const item = getItemFromLibrary(member.packName, member.itemName);
    const memberName = getLumiaField(item, "name") || member.itemName || "Unknown";

    // Format the input args into readable text
    const formattedArgs = formatToolInput(args, toolDef);

    // Build a rich response that includes member attribution.
    // This is what ST saves as a system message and the LLM sees on the recursive pass.
    const responseText = `[Council Member: ${memberName}] ${toolDef.displayName}\n\n${formattedArgs}`;

    const result = {
      memberName,
      packName: member.packName,
      itemName: member.itemName,
      toolName: toolDef.name,
      toolDisplayName: toolDef.displayName,
      success: true,
      response: formattedArgs,
    };

    // Accumulate into latestToolResults (inline tools may fire across recursive Generate cycles)
    latestToolResults.push(result);

    console.log(`[${MODULE_NAME}] Inline tool ${toolDef.displayName} invoked by LLM for member ${memberName}`);

    // Return the attributed response — ST saves this as a system message for the LLM
    return responseText;
  };
}

/**
 * Register all council tools with SillyTavern's ToolManager for inline mode.
 * 
 * In this implementation, tools are registered PER COUNCIL MEMBER, not per tool type.
 * This means if 3 council members all have "suggest_direction" assigned, 3 separate
 * tools are registered (one for each member), allowing the LLM to invoke suggestions
 * from specific members.
 * 
 * Tool names follow the pattern: lumiverse_council_<memberId>_<toolName>
 * 
 * The `shouldRegister` gate dynamically checks whether each member-specific tool
 * should be included in a given generation request based on:
 * - Council mode enabled
 * - Council tools enabled
 * - Inline mode active
 * - The specific member has this tool assigned
 *
 * Tools are NOT stealth — ST must save tool results as system messages and recurse
 * Generate() so the LLM produces a final text response incorporating the results.
 *
 * This should be called once at init — no re-registration needed on settings changes
 * because the shouldRegister gate handles dynamic inclusion.
 */
export function registerSTTools() {
  // Unregister any previously registered tools first (clean slate)
  unregisterSTTools();

  let registeredCount = 0;
  
  // Get council members to register tools per-member
  const settings = getSettings();
  const councilMembers = settings.councilMembers || [];
  
  // For each member, register each tool they have assigned
  for (const member of councilMembers) {
    const memberTools = member.tools || [];
    if (memberTools.length === 0) continue;
    
    for (const toolName of memberTools) {
      const toolDef = COUNCIL_TOOLS[toolName];
      if (!toolDef) {
        console.warn(`[${MODULE_NAME}] Unknown tool "${toolName}" assigned to member ${member.itemName}, skipping`);
        continue;
      }
      
      const stToolName = buildMemberToolName(member, toolName);
      
      // Capture member in closure for shouldRegister check
      const memberId = member.id;
      const memberToolName = toolName;

      try {
        registerFunctionTool({
          name: stToolName,
          displayName: buildInlineToolDisplayName(toolDef, member),
          description: buildInlineToolDescription(toolDef, member),
          parameters: toolDef.inputSchema,
          action: buildInlineToolAction(toolDef, member),
          // NOT stealth: ST needs to save the result and recurse Generate() for a final response.
          stealth: false,
          shouldRegister: () => {
            // Dynamic gate: only include in generation request when all conditions are met
            const currentSettings = getSettings();
            if (
              currentSettings.councilMode !== true ||
              currentSettings.councilTools?.enabled !== true ||
              currentSettings.councilTools?.mode !== "inline"
            ) {
              return false;
            }
            // Check that this specific member still has this tool assigned
            const currentMembers = currentSettings.councilMembers || [];
            const currentMember = currentMembers.find(m => m.id === memberId);
            return currentMember && currentMember.tools && currentMember.tools.includes(memberToolName);
          },
        });

        registeredSTTools.add(stToolName);
        registeredCount++;
      } catch (error) {
        console.error(`[${MODULE_NAME}] Failed to register ST tool ${stToolName}:`, error);
      }
    }
  }

  console.log(`[${MODULE_NAME}] Registered ${registeredCount} council member-specific tools with ST ToolManager (inline mode)`);
}

/**
 * Unregister all council tools from SillyTavern's ToolManager.
 * Called when switching modes, disabling tools, or during cleanup.
 */
export function unregisterSTTools() {
  if (registeredSTTools.size === 0) return;

  let removedCount = 0;
  for (const stToolName of registeredSTTools) {
    try {
      unregisterFunctionTool(stToolName);
      removedCount++;
    } catch (error) {
      console.warn(`[${MODULE_NAME}] Failed to unregister ST tool ${stToolName}:`, error);
    }
  }

  registeredSTTools.clear();
  console.log(`[${MODULE_NAME}] Unregistered ${removedCount} council tools from ST ToolManager`);
}

/**
 * Check if ST's tool calling is currently supported.
 * Inline mode requires the main API to support function calling.
 * @returns {boolean} Whether inline mode can work
 */
export function isInlineModeAvailable() {
  return isToolCallingSupported();
}

/**
 * Get available tools as formatted list for UI
 * @returns {Array} Array of {name, displayName, description} objects
 */
export function getToolsForUI() {
  return Object.values(COUNCIL_TOOLS).map((tool) => ({
    name: tool.name,
    displayName: tool.displayName,
    description: tool.description,
  }));
}
