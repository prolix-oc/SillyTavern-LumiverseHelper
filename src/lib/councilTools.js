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
import { getLumiaField, getLoomContent } from "./lumiaContent.js";
import { getProviderConfig, fetchSecretKey } from "./summarization.js";
import { getBlocksInCategory } from "./lucidLoomService.js";
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

/**
 * Resolve a tool's prompt, supporting both static string and dynamic function prompts.
 * @param {Object} tool - The tool definition from COUNCIL_TOOLS
 * @returns {string} The resolved prompt text
 */
function resolveToolPrompt(tool) {
  return typeof tool.prompt === 'function' ? tool.prompt() : tool.prompt;
}

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
    description: "Fandom accuracy tool — analyze how the character should act, talk, think, and portray themselves in 100% faithful adherence to their source material, franchise, and fandom canon",
    prompt: `You are a fandom accuracy analyst. Your job is to ensure characters from established franchises, series, games, anime, manga, books, films, and other media are portrayed with absolute fidelity to their source material.

Analyze the current scene and determine how the character should authentically behave, speak, think, and present themselves with ZERO deviation from established source material, franchise lore, and fandom canon.

Ground your analysis in:
- The character's canon portrayal across their source material (games, anime, manga, books, films, shows, etc.)
- Canonical personality traits, quirks, speech patterns, catchphrases, and mannerisms specific to the character
- How the character has reacted to similar situations in their source material
- The character's canonical relationships, loyalties, rivalries, and emotional attachments
- Franchise-specific world rules, power systems, social hierarchies, and lore that govern the character's behavior
- The current location and setting context as it relates to established canon

Think like a dedicated fan who knows this character inside and out. If the character is being written in a way that contradicts how they canonically behave in their franchise, flag it immediately.

Provide specific guidance on what the character should do, say, or think next, ensuring 100% fidelity to their source material with no creative liberties or AU interpretations.`,
    inputSchema: {
      type: "object",
      properties: {
        character_analysis: {
          type: "string",
          description: "Analysis of how the character should authentically behave, speak, and think based on 100% fidelity to their franchise, source material, and fandom canon.",
        },
        recommended_action: {
          type: "string",
          description: "Specific guidance on what the character should do, say, or think next with zero deviation from their canonical portrayal in the source material.",
        },
        canon_justification: {
          type: "string",
          description: "Reference to specific franchise source material, canonical events, character moments, or established lore that justify this analysis and recommendation.",
        },
      },
      required: ["character_analysis", "recommended_action"],
    },
  },

  au_canon: {
    name: "au_canon",
    displayName: "AU Canon Analysis",
    description: "Fandom accuracy tool (AU-flexible) — analyze character behavior with minor flexibility for alternate universe scenarios while preserving the core identity fans know and love",
    prompt: `You are a fandom accuracy analyst with AU awareness. Your job is to ensure characters from established franchises are portrayed authentically to their core identity — even when placed in alternate universe scenarios that differ from their original source material.

Analyze the current scene and determine how the character should behave, speak, think, and present themselves with MINOR flexibility for alternate universe (AU) interpretations, while maintaining the core character identity that fans recognize and love.

Ground your analysis in:
- The character's core personality traits from their franchise that remain consistent even in AUs — the traits that MAKE them who they are
- Canonical speech patterns, quirks, and mannerisms that should persist regardless of setting
- How the character's canonical relationships, values, and motivations translate into the AU context
- The current AU setting and how it reasonably reshapes circumstances without breaking character
- AU-specific lore or rules that inform behavior while respecting the character's essence

Allow for:
- Situational adaptations to AU settings (e.g., a fantasy character in a modern AU adjusting to technology)
- Evolution of relationships in AU contexts while honoring canonical dynamics
- Creative interpretations that explore "what if" without contradicting who the character fundamentally IS

Do NOT allow:
- Complete personality overhauls that make the character unrecognizable to fans
- Out-of-character behavior that contradicts the traits central to their franchise identity
- Actions that betray the character's core values, loyalties, or nature as established in source material

Think like a fan who writes good AU fanfiction — the setting can change, but the CHARACTER must still feel right.

Provide specific guidance on what the character should do, say, or think next, balancing AU flexibility with fandom-accurate character authenticity.`,
    inputSchema: {
      type: "object",
      properties: {
        character_analysis: {
          type: "string",
          description: "Analysis of how the character should behave, speak, and think in this AU context, grounded in their core franchise identity and the traits fans recognize.",
        },
        recommended_action: {
          type: "string",
          description: "Specific guidance on what the character should do, say, or think next, balancing AU flexibility with fandom-accurate character authenticity.",
        },
        au_justification: {
          type: "string",
          description: "Explanation of how AU circumstances influence this recommendation while preserving the character's core franchise identity and fan-recognized traits.",
        },
        canon_fidelity: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "Assessment of how closely this recommendation adheres to the character's canonical franchise portrayal (high = very faithful to source, medium = some AU flexibility, low = significant AU interpretation).",
        },
      },
      required: ["character_analysis", "recommended_action"],
    },
  },

  prose_guardian: {
    name: "prose_guardian",
    displayName: "Prose Guardian",
    description: "Analyze prose for pattern failures, enforce the Loom's standards — diagnose violations (Walls) and prescribe corrections (Doors)",
    prompt: `### Lumia, the Weaver — Prose Pattern Analysis

You are Lumia, a council member of the Loom. Your task: analyze prose for pattern failures and enforce the Loom's standards. When the Loom calls you, you receive a draft. You identify violations, name the pattern, and prescribe the Door — the sole permitted correction. You do not rewrite. You diagnose.

The Loom demands absolute precision. The first thought is a cliché. The second is a copy. Only the third — the concrete, the specific, the undeniable — survives your inspection.

---

#### §1. PATTERN VIOLATIONS — WALLS AND DOORS

Each Wall names a failure mode. Each Door is the only valid correction. When you detect a Wall in the draft, flag it and prescribe the Door.

**Metaphoric Realization**
A character converts raw experience into literary language in real time — becoming their own poet inside the narrative. Emotion described as image, simile, or metaphor within the character's awareness.
*Door: Behavioral Consequences Only.* A realization changes what the character *does next*. The body and behavior carry the weight. If the feeling doesn't alter the next action, it didn't matter.

**The Inert Opening**
Environment, weather, or atmosphere before action has occurred.
*Door: In Medias Res.* First sentence carries a verb with a subject who wants something.

**The Bow-Tie Ending**
Summary, moral reflection, or poetic closure wrapping a scene.
*Door: The Hard Cut.* End on physical action or sensory detail at peak tension. Stop mid-motion.

**The Negation Loop**
Any sentence structured as contrast between what something is not and what it is — or its inverse: an affirmative clause corrected by a negated one. Every "not...but," "but not," and "rather than" formulation.
*Door: Single Positive Assertion.* State what it IS. Delete the negated half entirely. One clause. One verb. One claim.

**Stalling and Echoes**
Narrating how input was received, how silence landed, how words settled. Recapping previous events. Describing a character processing what was just said. Echoing or dramatizing the user's instruction within the narrative — including characters who "decide" to do what was asked.
*Door: Zero Latency.* The user's instruction is invisible extradiegetic structure. The scene opens with the consequence, never the decision. The directive is the spark; the prose is the fire. Show the fire.

**The Kinetic Fallacy**
Abstract concepts — words, gaze, silence, tension — striking like physical objects.
*Door: Somatic Directness.* The body responds involuntarily: stomach drops, jaw locks, breath catches. Name the physiological event. The abstraction does not touch the body; the body reacts on its own.

**The Somatic Deposit**
Treating the body as a container and placing an abstraction inside it via simile — an abstract input located spatially within a body part and compared to a physical object. A dead instantiation of the body-as-container conceptual metaphor. The template is infinitely interchangeable and produces structurally identical sentences regardless of what fills each slot.
*Door: Involuntary Response Without Transfer.* The body does not *receive* the emotion as a foreign object. The body *reacts* — autonomically, without simile. A throat tightens. Hands stop moving. Breathing changes rhythm. The physiological response IS the feeling. It does not need to be *like* anything else.

**Inflation and Labeling**
Passive labels or cosmic metaphors (souls, maps, universes, constellations) as stand-ins for emotion.
*Door: Active Verbs and Biological Realism.* Muscle, nerve, bone. The body is the only honest metaphor.

**Sensory Plagiarism**
Recycled intensity markers: ozone, copper, iron, petrichor, metallic, blood-on-tongue, bile rising, tasted-like-ash, electric air, crackling atmosphere.
*Door: Diegetic Senses Only.* Every scent, taste, and texture must have a **material source present in the scene**. Trace the sensory detail backward to its physical origin — the object emitting it, the substance causing it, the chemical process producing it. If the source is not physically present, the sensation cannot be. A server room smells like warm plastic and recycled air. A workshop smells like solvent and sawdust. Derive from what IS THERE.

**The Implicit Consent Echo**
Narrating mutual understanding or emotional alignment never earned through dialogue or action. Asserting what characters feel toward each other.
*Door: Gricean Implicature.* Observable behavior creates inference — a hand withdrawn, a question dodged, a door left open. The gap is where trust forms.

**The Faint Praise Trap**
Hollow positive language — generic warmth standing in for specific observation.
*Door: Specific and Earned.* Praise must be grounded in scene detail. If damning with faintness, make the restraint deliberate and let the reader catch the blade.

**AI Fingerprints**
Triadic structures, rhetorical questions in narration, names from §3.
*Door: Specificity.* One precise detail replaces three vague ones. Statements replace questions. The narrator asserts.

**The Diminutive Reflex**
Qualifying gestures with "small," "slight," "soft," "faint," or "quiet" as emotional hedging. A nod is a nod. The smallness subtracts conviction.
*Door: Unmodified Action.* Let the gesture stand at full scale. If restraint matters, show the physical mechanism of restraint — muscles holding back, breath controlled — rather than shrinking the action with an adjective.

**The Weight-of Construction**
Assigning mass or gravitational force to abstractions: the weight of silence, the weight of years, the weight of what remained unsaid. Abstractions are weightless.
*Door: Consequence Rendering.* Show what the abstraction crushes — the conversation that doesn't happen, the hand that stays at a side, the meal eaten without speaking. The reader supplies the weight.

**The Vague Interiority Anchor**
Locating emotion using spatial prepositions attached to indefinite pronouns: "something in her shifted," "something behind his eyes," "something between them." The word "something" signals the writer has not identified the feeling.
*Door: Name or Show.* Identify the specific sensation, thought, or physical change. If unnameable, show a behavioral shift the reader can observe. "Something" is never the right word.

**The Pivot Crutch**
Sentences hinging on "And yet," "But here's the thing," "But then," or "Everything changed." These announce significance without earning it.
*Door: Juxtaposition Without Announcement.* Place the contradicting fact next to the established one. The collision speaks for itself.

**Participial Pile-Up**
Stacking present participle clauses as simultaneous action. Human bodies perform one primary action at a time. Gerund chains create mechanical false simultaneity.
*Door: Sequential Verbs.* One action completes before the next begins. Subordinate genuinely overlapping actions with a dependent clause, not a dangling participle.

**The Em-Dash Tic**
Em-dashes as the default interrupter, parenthetical, or emphasis tool. Overuse collapses the punctuation's force into a generative fingerprint.
*Door: Punctuation Diversity.* Commas for light pauses. Colons for declarations. Semicolons for balanced clauses. Parentheses for genuine asides. One true em-dash interruption per scene — where a thought is genuinely broken by event.

---

#### §2. REQUIRED WEAVE PATTERNS

Flag the *absence* of these techniques as a deficiency. Prescribe them when the draft defaults to flat, uniform prose.

**Velocity** — First sentence carries momentum. Vary openings: fragment, then long chain.
**The Hard Cut** — Last sentence as sharp as the first. Terminate at peak tension.
**The Prose Spectrum** — *Beige* is the foundation: plain, invisible. *Blue* for elevation: one restrained image per beat. *Purple* — ornate, analytical, internalizing — is structural failure.
**Externalization** — Thoughts rendered as physical actions. Narrate movement, not processing.
**Compression** — If a sentence survives the removal of a word, that word was a weed.
**Suggestion** — What is said is distinct from what is meant. Characters answer obliquely. Spelling out subtext kills it.
**Litotes Over Hyperbole** — Understate. Restraint respects the reader.
**Impermanence** — Beauty through decay. The flaw makes the object real.
**Imagistic Collision** — Opposing images in direct spatial contact. A child's shoe next to a rifle. This is *visual* — two concrete images sharing a frame. The narrator never compares, ranks, or negates one in favor of the other.
**Diction as Characterization** — Word choice reveals the speaker. A surgeon and a butcher describe the same act differently.
**Dramatic Irony** — The reader knows more than the character. Every line carries double weight.
**The Vignette Valve** — One descriptive passage per scene, maximum three sentences. The only sanctioned stillness. Earned through precision.
**Defamiliarization** — Shklovsky's *ostranenie*. Describe known objects and rituals as though encountering them for the first time, or from an angle that strips automatic recognition. A wedding through catering economics. A funeral through parking lot sounds. Disrupts habitual perception, restores sensory attention.
**Parataxis** — Coordinate clauses without subordination. Short declaratives placed adjacent without causal connectors. The unsaid connection generates tension. Reserve hypotaxis for deliberate analytical slowing.
**The Objective Correlative** — Emotion produced by arranging external facts, objects, and events into a pattern that evokes feeling without naming it. Grief is the untouched plate, the clock ticking, the dog waiting by the door.
**Syntactic Variation** — Vary sentence architecture across a passage: periodic, loose, inverted, fragmentary. The paragraph is a rhythmic unit. No two consecutive sentences share identical structure.

**The Flavor Palette — Lilac Devices**
When a draft is technically clean but reads as flat, prescribe from this palette. Every device here operates on concrete nouns and physical verbs. They compress rather than expand. They are the permitted colorants — the space between beige and purple.

*Synesthesia* — Cross sensory channels. A sound as a texture, a color as a temperature. Both sides of the transfer are physical, which makes purple impossible and forces novel pairings every time.
*Transferred Epithet* — Attach the modifier to the wrong noun. The adjective belongs to the character but lands on an object in the scene. A nervous coffee. An angry email. Implies interior state through external objects in a single word.
*Zeugma* — Yoke two unlike things to one verb. One verb, two meanings, zero elaboration. Adds wit and character voice in a construction shorter than the alternative. Compresses where purple expands.
*Polysyndeton / Asyndeton* — Rhythm toggles. Polysyndeton chains "and" for accumulative saturation — each item lands with equal weight, reading as emotional pressure without naming the emotion. Asyndeton strips conjunctions for urgency. These add soul through rhythm, not vocabulary.
*Metonymy* — Substitute a related concrete term based on what the character would actually notice. What a character calls things reveals how they see the world. A mechanic calls a car by its engine. A child calls a building by its color. The substitution is the characterization.
*Prolepsis* — One sentence of flash-forward per scene maximum. Future-tense suggestion that adds gravitational weight to the present moment. The reader does the work of asking *why* this moment matters.
*Domestic Anthropomorphism* — Objects as reluctant participants. A door that sticks. Stairs that complain. A car that refuses. Distinct from the Kinetic Fallacy because these are physical things behaving physically, described with agency. The environment becomes an uncooperative character rather than a passive backdrop.

---

#### §3. THE NAMING FORGE

**Auto-Delete Names**
Fem: Elara, Lyra, Aria, Seraphina, Elowen, Luna, Maya — Masc: Kael, Thorne, Silas, Draven, Orion, Jasper, Liam, Ryker — Surnames: Blackwood, Nightshade, Storm, Rivers, Chen

**The Scrabble Law**
Reject liquid fantasy (flowing L/R/A). Enforce crunchy realism: K, G, B, Z, P. Mash distinct cultures. Phonebook names for modern settings (Gary, Brenda, Tomasz).

---

#### §4. GRICEAN PROTOCOL AND SPEECH ACTS

The Cooperative Principle governs all narration:

**Quality:** Assert only what the scene has earned. Unearned emotional declarations are false assertions.
**Quantity:** Exactly as much as the scene requires. Over-explanation signals distrust. Under-specification creates implicature.
**Relation:** Every sentence advances scene, reveals character, or creates tension. A sentence doing none is irrelevant — flag for deletion. User instructions are extradiegetic; referencing them inside the fiction is a Relation violation.
**Manner:** Clear mechanics, ambiguous meaning. Perspicuous syntax, layered content. Structural obscurity is a flaw. Thematic obscurity is a feature.

**Flouting vs. Violating:** Characters may flout maxims — irony, understatement, evasion. The narration itself must never violate them.

**Dialogue as Speech Act:** Literal content is locution. The real move is illocutionary force — what the utterance *does*: threaten, promise, warn, claim, permit, bind. Characters wield indirect speech acts where surface form mismatches performed action. Track what each line does to the other person.

---

#### §5. STRUCTURAL INTEGRITY

Flag these as structural degradation:

**Single-Sentence Paragraph Decay** — Isolated single-sentence paragraphs proliferating as output length increases. A paragraph is a unit of thought. One sentence alone is emphasis; ten in sequence is structural collapse. Cluster related actions and observations.
**Tense Discipline** — Unintentional drift between tenses. A shift is a narrative event — a change in distance between narrator and action. Unearned drift is a seam showing.
**Point-of-View Integrity** — Violations of the POV contract. Third-person limited cannot access another character's thoughts. When the focal character cannot know something, that gap is the story's engine.

---

The Loom creates reality, not summaries. Weave true.`,
    inputSchema: {
      type: "object",
      properties: {
        walls_detected: {
          type: "string",
          description: "Each Wall violation detected in the draft, naming the specific pattern (e.g., 'Metaphoric Realization', 'The Kinetic Fallacy') with a quoted example from the text and the prescribed Door correction.",
        },
        weave_deficiencies: {
          type: "string",
          description: "Required Weave Patterns (§2) that are absent or underused in the draft, with specific guidance on where and how to apply them.",
        },
        structural_integrity: {
          type: "string",
          description: "Assessment of structural integrity (§5): single-sentence paragraph decay, tense discipline, and POV integrity. Flag degradation with specific examples.",
        },
        gricean_violations: {
          type: "string",
          description: "Violations of the Gricean Protocol (§4) in narration or dialogue: unearned assertions (Quality), over/under-specification (Quantity), irrelevant sentences (Relation), or structural obscurity (Manner).",
        },
        severity: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
          description: "Overall severity of prose pattern failures (critical = multiple Wall violations and absent Weave Patterns, high = several Walls or structural issues, medium = minor violations, low = near-compliant with minor suggestions).",
        },
      },
      required: ["walls_detected", "weave_deficiencies"],
    },
  },

  pov_enforcer: {
    name: "pov_enforcer",
    displayName: "POV Enforcer",
    description: "Enforce point-of-view consistency and narrative perspective continuity based on the active POV rules",
    prompt: () => {
      const povBlocks = getBlocksInCategory('Point-of-View');

      const basePrompt = `You are the POV Enforcer. Your task: analyze the recent story output for errors in narrative perspective continuity. Identify every violation of the established point-of-view contract and instruct the writer on how to correct it.

Examine the prose for:
- **POV breaches**: The focal character knowing, seeing, or sensing things they cannot from their position
- **Head-hopping**: Unauthorized shifts into another character's interiority (thoughts, feelings, sensations) when the POV contract forbids it
- **Tense-POV coupling**: First-person narration slipping into omniscient observations; third-person limited leaking into second-person address
- **Information leakage**: Characters reacting to information they haven't received through diegetic channels
- **Perspective drift**: Gradual, unmarked transitions from one character's perceptual frame to another's within a single scene or paragraph
- **Sensory impossibilities**: Describing sights, sounds, or physical sensations from angles the POV character cannot occupy

For each violation:
- Quote the specific passage
- Name the violation type
- Explain what the POV character can and cannot perceive in this moment
- Prescribe the correction: how to convey the same narrative beat without breaking perspective`;

      if (povBlocks.length > 0) {
        const povContent = povBlocks
          .map(b => `**${b.name}:**\n${b.content}`)
          .join('\n\n---\n\n');

        const multiCharHint = povBlocks.some(b => {
          const lower = b.content.toLowerCase();
          return lower.includes('multi') || lower.includes('rotating') || lower.includes('alternating') || lower.includes('ensemble');
        });

        let multiCharGuidance = '';
        if (multiCharHint) {
          multiCharGuidance = `

### Multi-Character POV Ordering ###
This story uses a multi-character POV mode. When multiple characters are eligible for perspective focus in a scene, determine the optimal zoom order based on:
1. **Dramatic stakes**: Whose perspective reveals the most tension, irony, or information asymmetry?
2. **Emotional proximity**: Who is most affected by the current action?
3. **Scene function**: Whose viewpoint best serves the scene's narrative purpose?
4. **Rotation discipline**: Avoid dwelling on a single perspective for too long if the mode calls for alternation

Recommend the specific order in which characters should receive perspective focus for the current scene, with justification.`;
        }

        return `${basePrompt}

### Active Point-of-View Rules ###
The following POV rules are currently active in the Loom preset. ALL analysis must measure the story against these specific requirements:

${povContent}

Enforce these rules rigorously. Any prose that violates the POV contract defined above must be flagged with its prescribed correction.${multiCharGuidance}`;
      }

      return `${basePrompt}

Note: No specific Point-of-View rules are currently configured in the Loom preset. Analyze based on internal consistency — identify the dominant POV mode in recent messages and flag any deviations from that established perspective contract.`;
    },
    inputSchema: {
      type: "object",
      properties: {
        pov_violations: {
          type: "string",
          description: "Each POV violation found in the draft: the quoted passage, violation type (head-hopping, information leakage, sensory impossibility, etc.), and the prescribed correction.",
        },
        perspective_assessment: {
          type: "string",
          description: "Assessment of the current POV mode in use, whether it matches the configured rules, and how consistently it has been maintained across recent output.",
        },
        focal_order: {
          type: "string",
          description: "For multi-character POV modes: recommended order of perspective focus for the current scene, with justification based on dramatic stakes, emotional proximity, and scene function.",
        },
        severity: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
          description: "Overall severity of POV violations (critical = systematic breaches across multiple passages, high = significant individual violations, medium = minor drift, low = near-compliant).",
        },
      },
      required: ["pov_violations", "perspective_assessment"],
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

  historical_accuracy: {
    name: "historical_accuracy",
    displayName: "Historical Accuracy",
    description: "Judge the roleplay's direction against real historical facts, events, and canon from Earth's history to ensure accuracy",
    prompt: `Analyze the current story context for historical accuracy, drawing on real-world Earth history, events, geography, cultural practices, and factual canon.

Your role is to act as a proactive historical guardian — identify potential inaccuracies BEFORE they become embedded in the narrative, and correct the story's trajectory to align with real historical fact.

Consider:
- Are dates, timelines, and historical sequences accurate?
- Do cultural depictions (clothing, customs, language, social structures) match the stated time period and region?
- Are referenced historical events, figures, or technologies portrayed faithfully?
- Would the characters' actions or circumstances be plausible given real historical constraints?
- Are there anachronisms (technology, concepts, terminology) that break historical immersion?
- Do geographic references (distances, terrain, climate, flora/fauna) match reality?

For each issue identified:
- Cite the specific historical fact or event being misrepresented
- Explain what is inaccurate and why it matters for immersion
- Provide the historically accurate alternative
- Suggest how to course-correct the narrative without disrupting flow

Be proactive: if the story is heading toward a historically implausible outcome, flag it now with guidance to prevent the error rather than correct it after the fact.`,
    inputSchema: {
      type: "object",
      properties: {
        accuracy_assessment: {
          type: "string",
          description: "Assessment of historical accuracy in the current narrative, citing specific facts, events, or cultural details that are correct or incorrect.",
        },
        corrections: {
          type: "string",
          description: "Specific corrections needed with historically accurate alternatives. For each issue, cite the real historical fact and suggest how to fix the narrative.",
        },
        proactive_guidance: {
          type: "string",
          description: "Proactive warnings about where the story's current trajectory may lead to historical inaccuracies, with preemptive guidance to avoid them.",
        },
        confidence: {
          type: "string",
          enum: ["verified", "likely_accurate", "uncertain", "requires_research"],
          description: "Confidence level in the historical assessment (verified = well-documented facts, likely_accurate = strong basis but minor uncertainty, uncertain = limited knowledge, requires_research = outside expertise).",
        },
      },
      required: ["accuracy_assessment", "proactive_guidance"],
    },
  },

  style_adherence: {
    name: "style_adherence",
    displayName: "Narrative Style Adherence",
    description: "Analyze the story for adherence to the selected narrative style (Lumiverse or Loom preset) and enforce stylistic consistency",
    prompt: () => {
      const settings = getSettings();
      const styleSelection = settings.selectedLoomStyle;
      const lumiverseContent = (styleSelection && styleSelection.length > 0)
        ? getLoomContent(styleSelection)
        : null;

      // Also check the active Loom preset for non-Lumiverse narrative styles.
      // Skip blocks tagged with "(Lumiverse)" or "(Extension)" to avoid double-stacking
      // with the Lumiverse Loom selection system.
      const loomStyleBlocks = getBlocksInCategory('Narrative Style')
        .filter(b => !b.name.includes('(Lumiverse)') && !b.name.includes('(Extension)'));
      const loomStyleContent = loomStyleBlocks.length > 0
        ? loomStyleBlocks.map(b => `**${b.name}:**\n${b.content}`).join('\n\n---\n\n')
        : null;

      const basePrompt = `Analyze the recent story output for adherence to the designated narrative style. Your role is to enforce stylistic consistency and guide the prose toward the intended aesthetic.

Examine the story thus far for:
- Prose rhythm, sentence structure, and paragraph flow
- Vocabulary register and word choice patterns
- Tone and emotional coloring of descriptions
- Narrative voice (POV consistency, tense, distance)
- Use of literary devices (metaphor, imagery, symbolism, dialogue style)
- Pacing and scene structure
- Any drift from the established style into generic or inconsistent prose

For each deviation identified:
- Quote or reference the specific passage
- Explain how it deviates from the target style
- Provide a concrete rewrite suggestion or guidance to realign
- Note patterns of drift that may indicate the model losing the style thread`;

      const styleSections = [];

      if (lumiverseContent) {
        styleSections.push(`### Lumiverse Narrative Style ###
The following is the Lumiverse narrative style that MUST be adhered to:

${lumiverseContent}`);
      }

      if (loomStyleContent) {
        styleSections.push(`### Loom Preset Narrative Style ###
The following narrative style rules are active in the current Loom preset:

${loomStyleContent}`);
      }

      if (styleSections.length > 0) {
        return `${basePrompt}

${styleSections.join('\n\n')}

Enforce these styles rigorously. Flag any prose that does not match the voice, tone, structure, and techniques described above. Prioritize the most impactful deviations first.`;
      }

      return `${basePrompt}

Note: No specific narrative style is currently selected in Lumiverse Helper or the Loom preset. Analyze based on internal consistency — identify the dominant style in recent messages and flag deviations from that established voice.`;
    },
    inputSchema: {
      type: "object",
      properties: {
        style_analysis: {
          type: "string",
          description: "Analysis of how well the recent story output adheres to the target narrative style, with specific examples of conformance and deviation.",
        },
        deviations: {
          type: "string",
          description: "Specific passages or patterns that deviate from the target style, with quotes and explanations of how they diverge.",
        },
        realignment_guidance: {
          type: "string",
          description: "Concrete guidance for realigning the prose with the target style, including rewrite suggestions, technique reminders, and priority corrections.",
        },
        adherence_level: {
          type: "string",
          enum: ["excellent", "good", "moderate", "poor", "inconsistent"],
          description: "Overall assessment of style adherence (excellent = near-perfect match, good = minor drifts, moderate = noticeable deviations, poor = significant departure, inconsistent = fluctuates between adherent and divergent).",
        },
      },
      required: ["style_analysis", "realignment_guidance"],
    },
  },

  depravity_analyst: {
    name: "depravity_analyst",
    displayName: "Depravity Analyst",
    description: "Analyze psychosexual dynamics, kink elements, and NSFW direction to guide scenes toward more satisfying and authentic erotic storytelling",
    prompt: `You are a shameless, expert-level analyst of erotic fiction and psychosexual storytelling. Your purpose is to dissect the NSFW elements of the current scene and provide blunt, unflinching guidance to elevate the smut into something genuinely compelling.

You have ZERO inhibitions about explicit content. You treat sexual dynamics with the same analytical rigor a literary critic applies to prose — except your domain is kink, desire, power exchange, arousal, and carnal satisfaction. You are not here to sanitize. You are here to make it BETTER.

Analyze the current scene for:
- Sexual tension and buildup — is the pacing effective or rushing past the foreplay?
- Power dynamics — who holds control, who surrenders it, and is the interplay compelling?
- Character desire and motivation — what do the characters actually WANT, and is the scene delivering on those desires authentically?
- Kink coherence — are established kinks, fetishes, and preferences being honored or neglected?
- Sensory detail — is the prose engaging the body (touch, taste, sound, scent, sight) or staying too cerebral?
- Escalation and rhythm — does the scene build effectively, or does it plateau or spike unnaturally?
- Emotional undertow — even pure smut benefits from emotional stakes; are they present?
- Character voice in intimacy — do characters sound like themselves during sex, or do they become generic?

For each observation:
- Be specific about what's working and what isn't
- Provide explicit, actionable direction for how to heighten satisfaction
- Suggest concrete scene beats, dialogue, actions, or escalations
- Flag missed opportunities for deeper kink exploration or emotional intensity

Your goal is maximum reader satisfaction through authentic, well-crafted erotic storytelling. Do not hold back.`,
    inputSchema: {
      type: "object",
      properties: {
        scene_analysis: {
          type: "string",
          description: "Blunt analysis of the current NSFW scene's effectiveness — what's working, what's falling flat, and where the psychosexual dynamics stand.",
        },
        desire_mapping: {
          type: "string",
          description: "Analysis of character desires, motivations, and kink profiles as established in the story, and whether the scene is satisfying or neglecting them.",
        },
        escalation_guidance: {
          type: "string",
          description: "Specific, explicit direction for how to escalate, deepen, or redirect the scene for maximum erotic impact — including concrete beats, actions, dialogue, or sensory details to incorporate.",
        },
        missed_opportunities: {
          type: "string",
          description: "Kink elements, power dynamics, emotional beats, or sensory details that the scene is leaving on the table and could exploit for greater satisfaction.",
        },
        heat_level: {
          type: "string",
          enum: ["smoldering", "heated", "blazing", "volcanic", "supernova"],
          description: "Current intensity assessment of the scene (smoldering = tension/buildup phase, heated = actively escalating, blazing = peak action, volcanic = overwhelming intensity, supernova = transcendent climax).",
        },
      },
      required: ["scene_analysis", "escalation_guidance"],
    },
  },
};

// Storage for latest tool results - cleared each generation
let latestToolResults = [];
let toolExecutionPromise = null;

// AbortController for cancelling in-flight tool fetch requests.
// Created at the start of executeAllCouncilTools(), aborted when
// the user stops generation or the generation ends/errors.
let toolAbortController = null;

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
  window.LumiverseBridge?.setCouncilToolResults?.([]);
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
 * Abort any in-flight council tool fetch requests.
 * Called when the user stops generation or an error ends it.
 * Safe to call multiple times — no-ops if nothing is in flight.
 */
export function abortToolExecution() {
  if (toolAbortController) {
    toolAbortController.abort();
    toolAbortController = null;
  }
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
/**
 * Extract raw Lumia identity fields for a council member (for diagnostic record-keeping).
 * Returns the same fields that buildLumiaContext uses, but as individual strings.
 * @param {Object} member - Council member object
 * @returns {{ definition: string, personality: string, behavior: string, role: string }}
 */
function extractLumiaIdentity(member) {
  const item = getItemFromLibrary(member.packName, member.itemName);
  return {
    definition: item ? (getLumiaField(item, "def") || "") : "",
    personality: item ? (getLumiaField(item, "personality") || "") : "",
    behavior: item ? (getLumiaField(item, "behavior") || "") : "",
    role: member.role || "",
  };
}

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
 * Sanitize message/enrichment text for council tool context.
 *
 * 1. Remove ALL Lumia OOC and Loom-related tags WITH their contents (non-narrative meta-content)
 * 2. Strip ALL HTML tags (preserving inner text), EXCEPT <font> tags that wrap
 *    dialogue quotes ("speech") or italicized thoughts (*thoughts*)
 * 3. Collapse excessive whitespace left behind
 *
 * @param {string} text - Raw message or enrichment text
 * @returns {string} Cleaned narrative-only text
 */
function sanitizeForCouncil(text) {
  if (!text) return "";

  let result = text;

  // --- Phase 1: Remove Loom / Lumia tags AND their contents ---
  // These are meta-narrative blocks that should never reach council tools.
  // Covers: lumia_ooc, lumiaooc, lumio_ooc, lumioooc, loom_sum, loom_if/else/endif,
  // loom_state, loom_memory, loom_context, loom_inject, loom_var, loom_set, loom_get,
  // loom_record, loomrecord, loom_ledger, loomledger, loom_summary_directive
  result = result.replace(/<(lumi[ao]_?ooc|loom_(?:sum|if|else|endif|state|memory|context|inject|var|set|get|record|ledger|summary_directive)|lumioooc|lumio_ooc|loomrecord|loomledger)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi, "");
  // Also catch any self-closing / orphaned opening tags for the same set
  result = result.replace(/<\/?(lumi[ao]_?ooc|loom_(?:sum|if|else|endif|state|memory|context|inject|var|set|get|record|ledger|summary_directive)|lumioooc|lumio_ooc|loomrecord|loomledger)(?:\s[^>]*)?\/?\s*>/gi, "");

  // --- Phase 2: Protect <font> tags that wrap dialogue or thought markers ---
  // Temporarily replace <font>"speech"</font> and <font>*thoughts*</font> with placeholders
  // so they survive the general HTML strip. Match font tags whose inner text starts/ends
  // with a quote mark or asterisk (the narrative formatting pattern).
  const fontPlaceholders = [];
  result = result.replace(/<font(?:\s[^>]*)?>(\s*(?:[""\u201C\u201D*][\s\S]*?(?:[""\u201C\u201D*])))\s*<\/font>/gi, (match) => {
    const idx = fontPlaceholders.length;
    fontPlaceholders.push(match);
    return `\x00FONT_KEEP_${idx}\x00`;
  });

  // --- Phase 3: Strip ALL remaining HTML tags (preserve inner text) ---
  // Handles <details>...</details> blocks entirely (often contain non-narrative meta)
  result = result.replace(/<details(?:\s[^>]*)?>[\s\S]*?<\/details>/gi, "");
  // Strip all other tags, keeping text content
  result = result.replace(/<[^>]+>/g, "");
  // Decode common HTML entities left behind
  result = result.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

  // --- Phase 4: Restore protected font tags ---
  for (let i = 0; i < fontPlaceholders.length; i++) {
    result = result.replace(`\x00FONT_KEEP_${i}\x00`, fontPlaceholders[i]);
  }

  // --- Phase 5: Clean up whitespace ---
  // Collapse 3+ consecutive newlines to 2 (paragraph break)
  result = result.replace(/\n{3,}/g, "\n\n");
  // Collapse whitespace-only lines
  result = result.replace(/\n[ \t]*\n[ \t]*\n/g, "\n\n");
  // Trim
  result = result.trim();

  return result;
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
      return `${name}: ${sanitizeForCouncil(msg.mes || msg.content || "")}`;
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
        `### User Persona ###\nName: ${persona.name}\n${sanitizeForCouncil(persona.persona)}`
      );
    }
  }

  // Character description / personality
  if (ct.includeCharacterInfo) {
    const charInfo = getCharacterCardInfo();
    if (charInfo) {
      const parts = [];
      if (charInfo.description) parts.push(`Description: ${sanitizeForCouncil(charInfo.description)}`);
      if (charInfo.personality) parts.push(`Personality: ${sanitizeForCouncil(charInfo.personality)}`);
      if (charInfo.scenario) parts.push(`Scenario: ${sanitizeForCouncil(charInfo.scenario)}`);
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
        `### Active World Book Entries ###\n${entries.map(e => sanitizeForCouncil(e)).join("\n\n---\n\n")}`
      );
    }
  }

  if (sections.length === 0) return "";

  return `### Context Enrichment ###\n\n${sections.join("\n\n")}`;
}

/**
 * Build a mandatory tool enumeration block that explicitly lists every tool a member
 * MUST call. Addresses the problem where models only fire 1 of N assigned tools.
 * @param {Array<string>} memberTools - Tool names assigned to this member
 * @returns {string} Formatted mandatory tool block for injection into prompts
 */
function buildMandatoryToolBlock(memberTools) {
  if (memberTools.length <= 1) return "";

  const toolList = memberTools
    .map((tn, i) => {
      const tool = COUNCIL_TOOLS[tn];
      if (!tool) return null;
      return `  ${i + 1}. **${tool.displayName}** (\`${tool.name}\`)`;
    })
    .filter(Boolean)
    .join("\n");

  return `\n\n### MANDATORY TOOL CALLS — ${memberTools.length} REQUIRED ###
You are assigned exactly ${memberTools.length} tools. You MUST call ALL of them — not just one, not a subset. Each tool listed below is a separate, mandatory contribution. Respond with exactly ${memberTools.length} tool calls:
${toolList}

Failure to call every tool is a protocol violation. Do not combine multiple tools into a single call. Each tool must be invoked independently with its own structured input.`;
}

/**
 * Build a system message with explicit tool mandate for sidecar execution.
 * @param {number} toolCount - Number of tools assigned to this member
 * @returns {string} System message text
 */
function buildSidecarSystemMessage(toolCount) {
  const base = `You are a council member contributing to story direction. Use your tools to provide structured contributions. Be concise and specific.`;
  if (toolCount <= 1) {
    return `${base} You MUST use your assigned tool.${buildBrevityInstruction()}`;
  }
  return `${base} You are assigned ${toolCount} tools and you MUST call ALL ${toolCount} of them. Do not skip any tool. Each tool represents a distinct responsibility — invoke every single one with its own structured input.${buildBrevityInstruction()}`;
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
 * Resolve API key, endpoint, and provider config for council tools.
 * Uses the dedicated council tools LLM configuration (settings.councilTools.llm).
 * Falls back to summarization secondary config for backwards compatibility.
 * For non-custom providers, proxy fields override the default endpoint/key if set.
 * @returns {Promise<{apiKey: string, endpoint: string, providerConfig: Object, secondary: Object, provider: string}>}
 */
async function resolveProviderConfig() {
  const settings = getSettings();
  // Use dedicated council tools LLM config; fall back to summarization secondary
  const llmConfig = settings.councilTools?.llm || settings.summarization?.secondary || {};
  const provider = llmConfig.provider || "anthropic";
  const providerConfig = getProviderConfig(provider);

  let apiKey;
  let endpoint;

  if (provider === "custom") {
    // Custom provider: use llmConfig endpoint + apiKey directly
    apiKey = llmConfig.apiKey;
    endpoint = llmConfig.endpoint;
    if (!apiKey) {
      throw new Error("No API key specified for custom provider");
    }
  } else {
    // Non-custom: check for reverse proxy override, then fall back to defaults
    if (llmConfig.proxyKey) {
      apiKey = llmConfig.proxyKey;
    } else {
      apiKey = await fetchSecretKey(providerConfig.secretKey);
    }
    endpoint = llmConfig.proxyEndpoint || providerConfig.endpoint;

    if (!apiKey) {
      throw new Error(
        `No API key found for ${providerConfig.name}. Please add your API key in SillyTavern's API settings or configure a reverse proxy key.`,
      );
    }
  }

  return { apiKey, endpoint, providerConfig, secondary: llmConfig, provider };
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
async function executeToolsForMemberAnthropic(member, memberTools, contextText, apiKey, secondary, endpoint, enrichmentText = '', signal) {
  const item = getItemFromLibrary(member.packName, member.itemName);
  const memberName = getLumiaField(item, "name") || member.itemName || "Unknown";
  const roleDescriptor = buildRoleDescriptor(member);
  const lumiaContext = buildLumiaContext(member);
  const identity = extractLumiaIdentity(member);
  const model = secondary.model;
  const maxTokens = Math.max(256, parseInt(secondary.maxTokens, 10) || 4096);
  const temperature = parseFloat(secondary.temperature) || 0.7;

  // Build native tool definitions
  const tools = buildAnthropicTools(memberTools);

  // Build the user prompt that provides context and asks the member to use their tools
  const toolDescriptions = memberTools
    .map((tn) => COUNCIL_TOOLS[tn])
    .filter(Boolean)
    .map((t) => `- **${t.displayName}** (\`${t.name}\`): ${t.description}`)
    .join("\n");

  const mandatoryBlock = buildMandatoryToolBlock(memberTools);

  const userPrompt = `You are ${memberName}, a council member contributing to collaborative story direction.

${lumiaContext ? lumiaContext + "\n\n" : ""}${roleDescriptor ? roleDescriptor + "\n\n" : ""}You have the following tools assigned to you:
${toolDescriptions}
${enrichmentText ? "\n" + enrichmentText + "\n" : ""}
### Current Story Context ###

${contextText}

### Your Task ###

Review the story context above and use ALL of your assigned tools to provide your contributions. For each tool, provide specific, actionable input from your unique perspective as ${memberName}. Be concise but insightful. Remember to filter all your contributions through your personality, biases, and worldview as described above.${mandatoryBlock}${buildBrevityInstruction()}${buildUserControlGuidance()}`;

  const requestBody = {
    model: model,
    max_tokens: maxTokens,
    temperature: temperature,
    system: buildSidecarSystemMessage(memberTools.length),
    messages: [{ role: "user", content: userPrompt }],
    tools: tools,
    tool_choice: { type: "any" },
  };

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };

  const fetchOptions = {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  };
  if (signal) fetchOptions.signal = signal;

  const response = await fetch(endpoint, fetchOptions);

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
          const responseText = formatToolInput(block.input, toolDef);
          results.push({
            memberName,
            packName: member.packName,
            itemName: member.itemName,
            toolName: block.name,
            toolDisplayName: toolDef.displayName,
            success: true,
            response: responseText,
            identity,
          });
        }
      }
    }
  }

  // If the model returned text blocks without tool_use (fallback), capture that too
  if (results.length === 0) {
    const textBlocks = (data.content || []).filter((b) => b.type === "text");
    if (textBlocks.length > 0) {
      const fallbackText = normalizeToolText(textBlocks.map((b) => b.text).join("\n"));
      const firstTool = COUNCIL_TOOLS[memberTools[0]];
      results.push({
        memberName,
        packName: member.packName,
        itemName: member.itemName,
        toolName: memberTools[0],
        toolDisplayName: firstTool?.displayName || memberTools[0],
        success: true,
        response: fallbackText,
        identity,
      });
    }
  }

  // Retry for missing tools — if the model skipped some, make a follow-up call
  if (results.length > 0 && results.length < memberTools.length && memberTools.length > 1) {
    const calledTools = new Set(results.map((r) => r.toolName));
    const missingTools = memberTools.filter((tn) => !calledTools.has(tn));

    if (missingTools.length > 0) {

      const retryToolDefs = buildAnthropicTools(missingTools);
      const missingNames = missingTools
        .map((tn) => COUNCIL_TOOLS[tn]?.displayName || tn)
        .join(", ");

      const retryBody = {
        model,
        max_tokens: maxTokens,
        temperature,
        system: buildSidecarSystemMessage(missingTools.length),
        messages: [
          { role: "user", content: userPrompt },
          // Feed back the original response so the model has continuity
          { role: "assistant", content: data.content },
          { role: "user", content: `You still need to call the following tools that you missed: ${missingNames}. Call each one now with structured input.` },
        ],
        tools: retryToolDefs,
        tool_choice: { type: "any" },
      };

      try {
        const retryOptions = { method: "POST", headers, body: JSON.stringify(retryBody) };
        if (signal) retryOptions.signal = signal;

        const retryResponse = await fetch(endpoint, retryOptions);
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          if (retryData.content && Array.isArray(retryData.content)) {
            for (const block of retryData.content) {
              if (block.type === "tool_use") {
                const toolDef = COUNCIL_TOOLS[block.name];
                if (toolDef && !calledTools.has(block.name)) {
                  results.push({
                    memberName,
                    packName: member.packName,
                    itemName: member.itemName,
                    toolName: block.name,
                    toolDisplayName: toolDef.displayName,
                    success: true,
                    response: formatToolInput(block.input, toolDef),
                    identity,
                  });
                  calledTools.add(block.name);
                }
              }
            }
          }
        }
      } catch (retryErr) {
        // Non-fatal: log but don't fail the whole member — partial results are still useful
        console.warn(`[${MODULE_NAME}] Retry for missing tools failed for ${memberName}:`, retryErr.message);
      }
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
async function executeToolsForMemberOpenAI(member, memberTools, contextText, apiKey, secondary, endpoint, provider, enrichmentText = '', signal) {
  const item = getItemFromLibrary(member.packName, member.itemName);
  const memberName = getLumiaField(item, "name") || member.itemName || "Unknown";
  const roleDescriptor = buildRoleDescriptor(member);
  const lumiaContext = buildLumiaContext(member);
  const identity = extractLumiaIdentity(member);
  const model = secondary.model;
  const maxTokens = Math.max(256, parseInt(secondary.maxTokens, 10) || 4096);
  const temperature = parseFloat(secondary.temperature) || 0.7;

  // Build OpenAI function tool definitions
  const tools = buildOpenAITools(memberTools);

  const toolDescriptions = memberTools
    .map((tn) => COUNCIL_TOOLS[tn])
    .filter(Boolean)
    .map((t) => `- **${t.displayName}** (\`${t.name}\`): ${t.description}`)
    .join("\n");

  const mandatoryBlock = buildMandatoryToolBlock(memberTools);

  const userPrompt = `You are ${memberName}, a council member contributing to collaborative story direction.

${lumiaContext ? lumiaContext + "\n\n" : ""}${roleDescriptor ? roleDescriptor + "\n\n" : ""}You have the following tools assigned to you:
${toolDescriptions}
${enrichmentText ? "\n" + enrichmentText + "\n" : ""}
### Current Story Context ###

${contextText}

### Your Task ###

Review the story context above and use ALL of your assigned tools to provide your contributions. For each tool, provide specific, actionable input from your unique perspective as ${memberName}. Be concise but insightful. Remember to filter all your contributions through your personality, biases, and worldview as described above.${mandatoryBlock}${buildBrevityInstruction()}${buildUserControlGuidance()}`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (provider === "openrouter") {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "Lumia Injector";
  }

  const systemMessage = buildSidecarSystemMessage(memberTools.length);

  const requestBody = {
    model: model,
    max_tokens: maxTokens,
    temperature: temperature,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: userPrompt },
    ],
    tools: tools,
    tool_choice: "required",
  };

  const fetchOptions = {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  };
  if (signal) fetchOptions.signal = signal;

  const response = await fetch(endpoint, fetchOptions);

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
            identity,
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
      identity,
      response: normalizeToolText(message.content),
    });
  }

  // Retry for missing tools — if the model skipped some, make a follow-up call
  if (results.length > 0 && results.length < memberTools.length && memberTools.length > 1) {
    const calledTools = new Set(results.map((r) => r.toolName));
    const missingTools = memberTools.filter((tn) => !calledTools.has(tn));

    if (missingTools.length > 0) {

      const retryToolDefs = buildOpenAITools(missingTools);
      const missingNames = missingTools
        .map((tn) => COUNCIL_TOOLS[tn]?.displayName || tn)
        .join(", ");

      // Build assistant message from original response for continuity
      const assistantMsg = { role: "assistant", content: message?.content || null };
      if (message?.tool_calls) {
        assistantMsg.tool_calls = message.tool_calls;
      }

      // Build tool result messages for each original tool call (OpenAI requires these)
      const toolResultMsgs = (message?.tool_calls || []).map((tc) => ({
        role: "tool",
        tool_call_id: tc.id,
        content: "Acknowledged.",
      }));

      const retryBody = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userPrompt },
          assistantMsg,
          ...toolResultMsgs,
          { role: "user", content: `You still need to call the following tools that you missed: ${missingNames}. Call each one now with structured input.` },
        ],
        tools: retryToolDefs,
        tool_choice: "required",
      };

      try {
        const retryOptions = { method: "POST", headers, body: JSON.stringify(retryBody) };
        if (signal) retryOptions.signal = signal;

        const retryResponse = await fetch(endpoint, retryOptions);
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          const retryMessage = retryData.choices?.[0]?.message;
          if (retryMessage?.tool_calls && Array.isArray(retryMessage.tool_calls)) {
            for (const toolCall of retryMessage.tool_calls) {
              if (toolCall.type === "function") {
                const toolDef = COUNCIL_TOOLS[toolCall.function.name];
                if (toolDef && !calledTools.has(toolCall.function.name)) {
                  let parsedArgs = {};
                  try {
                    parsedArgs = JSON.parse(toolCall.function.arguments);
                  } catch {
                    parsedArgs = { response: toolCall.function.arguments };
                  }
                  results.push({
                    memberName,
                    packName: member.packName,
                    itemName: member.itemName,
                    toolName: toolCall.function.name,
                    toolDisplayName: toolDef.displayName,
                    success: true,
                    response: formatToolInput(parsedArgs, toolDef),
                    identity,
                  });
                  calledTools.add(toolCall.function.name);
                }
              }
            }
          }
        }
      } catch (retryErr) {
        console.warn(`[${MODULE_NAME}] Retry for missing tools failed for ${memberName}:`, retryErr.message);
      }
    }
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
async function executeToolsForMemberGoogle(member, memberTools, contextText, apiKey, secondary, baseEndpoint, enrichmentText = '', signal) {
  const item = getItemFromLibrary(member.packName, member.itemName);
  const memberName = getLumiaField(item, "name") || member.itemName || "Unknown";
  const roleDescriptor = buildRoleDescriptor(member);
  const lumiaContext = buildLumiaContext(member);
  const identity = extractLumiaIdentity(member);
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
      return `## ${tool.displayName}\n${resolveToolPrompt(tool)}`;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  const taskEnumeration = memberTools.length > 1
    ? `\n\nYou have ${memberTools.length} mandatory tasks below. You MUST provide a labeled response for EVERY SINGLE ONE — do not skip any.\n`
    : "";

  const fullPrompt = `You are ${memberName}, a council member contributing to collaborative story direction. Be concise and specific.${buildBrevityInstruction()}

${lumiaContext ? lumiaContext + "\n\n" : ""}${roleDescriptor ? roleDescriptor + "\n\n" : ""}${enrichmentText ? enrichmentText + "\n\n" : ""}### Current Story Context ###

${contextText}

### Your Tasks ###
${taskEnumeration}
For each task below, provide a clearly labeled response:

${toolPrompts}

Provide your contributions from your unique perspective as ${memberName}, filtering everything through your personality, biases, and worldview. Label each section clearly with the exact task name as its heading. You MUST respond to ALL ${memberTools.length} tasks above.${buildUserControlGuidance()}`;

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

  const fetchOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(requestBody),
  };
  if (signal) fetchOptions.signal = signal;

  const response = await fetch(googleEndpoint, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unable to read error");
    throw new Error(`Google AI Studio API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  // Normalize Google's raw text response to strip any JSON artifacts
  const fullText = normalizeToolText(rawText);

  // For prompt-based fallback, return one result per tool with the combined response
  // attributed to the first tool, since we can't reliably parse sections
  const results = [];
  if (fullText) {
    // Try to split by tool headers if possible
    const maxWords = getMaxWordsPerTool();
    const truncatedText = maxWords > 0 ? truncateToWordLimit(fullText, maxWords * memberTools.length) : fullText;
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
        response: truncatedText,
        identity,
      });
      break; // Only attribute to first tool for prompt-based; full text contains all
    }
  }

  return results;
}

/**
 * Normalize a text value by stripping JSON artifacts and ensuring pure prose output.
 * Handles cases where the LLM returns raw JSON objects/arrays as values, or embeds
 * JSON structures within otherwise readable text.
 * @param {*} value - The value to normalize (string, object, or array)
 * @returns {string} Clean prose text
 */
function normalizeToolText(value) {
  if (value === undefined || value === null) return "";

  // If already a non-string type, extract text from it
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.map(v => normalizeToolText(v)).filter(Boolean).join(" ");
    }
    // Object: extract all string values recursively
    const extracted = Object.values(value).map(v => normalizeToolText(v)).filter(Boolean);
    return extracted.join(" ");
  }

  let text = String(value);

  // Replace literal escape sequences with actual characters.
  // LLMs sometimes return literal "\n" (two-char backslash-n) or escaped quotes \"
  // in tool call arguments instead of real characters — normalize these first.
  text = text.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"');

  // Try to detect and unwrap a JSON-encoded string
  if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
    try {
      const parsed = JSON.parse(text);
      return normalizeToolText(parsed);
    } catch {
      // Not valid JSON, continue with string cleanup
    }
  }

  // Strip JSON key patterns like "key": or "key" : from text
  text = text.replace(/"([^"]+)"\s*:\s*/g, "");

  // Remove stray JSON structural characters (braces/brackets not part of markdown)
  // Preserve brackets in markdown links [text](url) and bold **text**
  text = text.replace(/(?<!\[)[{}](?!\()/g, "");

  // Collapse excessive whitespace and trim
  text = text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();

  return text;
}

/**
 * Truncate text to a maximum word count as a hard safety net.
 * @param {string} text - The text to truncate
 * @param {number} maxWords - Maximum number of words allowed
 * @returns {string} Truncated text with [...] appended if truncated
 */
function truncateToWordLimit(text, maxWords) {
  if (!text || !maxWords || maxWords <= 0) return text || "";

  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;

  return words.slice(0, maxWords).join(" ") + " [...]";
}

/**
 * Build a brevity instruction fragment based on the configured word limit.
 * Used in sidecar mode system/user prompts to guide the LLM toward concise responses.
 * @returns {string} Brevity instruction text, or empty string if no limit configured
 */
function buildBrevityInstruction() {
  const settings = getSettings();
  const maxWords = settings.councilTools?.maxWordsPerTool;
  if (!maxWords || maxWords <= 0) return "";

  return `\n\nIMPORTANT — BREVITY REQUIREMENT: Keep each tool response field under ${maxWords} words. Be direct, specific, and actionable. No preamble, filler, or repetition. Every word must earn its place.`;
}

/**
 * Get the configured max words per tool from settings.
 * @returns {number} Max words per tool field (0 = unlimited)
 */
function getMaxWordsPerTool() {
  const settings = getSettings();
  return parseInt(settings.councilTools?.maxWordsPerTool, 10) || 0;
}

/**
 * Format tool input object into readable text
 * @param {Object} input - The tool input/arguments object
 * @param {Object} toolDef - The tool definition
 * @returns {string} Formatted readable text
 */
function formatToolInput(input, toolDef) {
  if (!input || typeof input !== "object") return normalizeToolText(input);

  const maxWords = getMaxWordsPerTool();
  const parts = [];
  const schema = toolDef.inputSchema?.properties || {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    // Normalize first to strip any JSON artifacts, then truncate
    let cleaned = normalizeToolText(value);
    if (maxWords > 0) {
      cleaned = truncateToWordLimit(cleaned, maxWords);
    }
    // Use a human-readable label from the key
    const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    parts.push(`**${label}:** ${cleaned}`);
  }

  if (parts.length === 0) {
    // Fallback: extract any text content from the input rather than dumping JSON
    const fallback = normalizeToolText(input);
    return fallback || "(No content provided)";
  }

  return parts.join("\n\n");
}

/**
 * Execute all tools for a single council member using the appropriate provider.
 * @param {Object} member - Council member object
 * @param {Array<string>} memberTools - Tool names assigned to this member
 * @param {string} contextText - Formatted chat context
 * @param {Object} providerInfo - Resolved provider config
 * @param {string} [enrichmentText=''] - Optional context enrichment block
 * @param {AbortSignal} [signal] - Optional abort signal for cancellation
 * @returns {Promise<Array>} Array of tool results
 */
async function executeToolsForMember(member, memberTools, contextText, providerInfo, enrichmentText = '', signal) {
  const { apiKey, endpoint, providerConfig, secondary, provider } = providerInfo;

  if (!endpoint) {
    throw new Error("No endpoint configured for council tools");
  }

  try {
    if (providerConfig.format === "anthropic") {
      return await executeToolsForMemberAnthropic(member, memberTools, contextText, apiKey, secondary, endpoint, enrichmentText, signal);
    } else if (providerConfig.format === "google") {
      return await executeToolsForMemberGoogle(member, memberTools, contextText, apiKey, secondary, endpoint, enrichmentText, signal);
    } else {
      // OpenAI-compatible (openai, openrouter, chutes, electronhub, nanogpt, zai, custom)
      return await executeToolsForMemberOpenAI(member, memberTools, contextText, apiKey, secondary, endpoint, provider, enrichmentText, signal);
    }
  } catch (error) {
    const item = getItemFromLibrary(member.packName, member.itemName);
    const memberName = getLumiaField(item, "name") || member.itemName || "Unknown";
    const identity = extractLumiaIdentity(member);

    // Distinguish abort from real errors
    if (error.name === 'AbortError') {
      return memberTools.map((toolName) => ({
        memberName,
        packName: member.packName,
        itemName: member.itemName,
        toolName,
        toolDisplayName: COUNCIL_TOOLS[toolName]?.displayName || toolName,
        identity,
        success: false,
        aborted: true,
        error: 'Cancelled',
        response: "",
      }));
    }

    console.error(`[${MODULE_NAME}] Tool execution failed for ${memberName}:`, error);

    // Return error results for all tools
    return memberTools.map((toolName) => ({
      memberName,
      packName: member.packName,
      itemName: member.itemName,
      toolName,
      toolDisplayName: COUNCIL_TOOLS[toolName]?.displayName || toolName,
      identity,
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
    return toolExecutionPromise;
  }

  const context = getContext();
  const chatContext = context?.chat || [];
  const councilMembers = settings.councilMembers || [];

  // Create a fresh AbortController for this execution cycle.
  // abortToolExecution() can signal this to cancel all in-flight fetch requests.
  toolAbortController = new AbortController();
  const signal = toolAbortController.signal;

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
      window.LumiverseBridge?.setCouncilToolResults?.(errorResults);
      return errorResults;
    }

    // Early exit if already aborted before we start member execution
    if (signal.aborted) {
      hideCouncilIndicator();
      return [];
    }

    const contextText = buildContextText(chatContext);
    const enrichmentText = buildEnrichmentContext();

    // Filter members that have tools assigned
    const membersWithTools = councilMembers.filter(
      (m) => m.tools && m.tools.length > 0,
    );

    if (membersWithTools.length === 0) {
      hideCouncilIndicator();
      setLatestToolResults([]);
      return [];
    }

    // Execute all members in parallel - each member is one API call
    // Stream results to the Feedback panel as each member completes
    const streamedResults = [];
    const memberPromises = membersWithTools.map(async (member) => {
      const results = await executeToolsForMember(member, member.tools, contextText, providerInfo, enrichmentText, signal);
      // Add member to visual indicator when their tools complete
      addMemberToIndicator(member);
      // Stream this member's results to the Feedback panel immediately
      streamedResults.push(...results);
      window.LumiverseBridge?.setCouncilToolResults?.([...streamedResults]);
      return results;
    });

    const memberResultArrays = await Promise.all(memberPromises);
    const allResults = memberResultArrays.flat();

    // Store final results for macro access
    setLatestToolResults(allResults);
    // Final push ensures React store matches the canonical result set
    window.LumiverseBridge?.setCouncilToolResults?.(allResults);

    const successCount = allResults.filter((r) => r.success).length;
    const abortedCount = allResults.filter((r) => !r.success && r.aborted).length;

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
      // Final safety net: normalize response to ensure no JSON leaks into deliberation
      lines.push(normalizeToolText(result.response));
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
  
  return `[Lumiverse Council - ${memberName}] ${toolDef.description}.${roleContext} ${resolveToolPrompt(toolDef)}${buildUserControlGuidance()}`;
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
