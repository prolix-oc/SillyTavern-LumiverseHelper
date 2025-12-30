/**
 * OOC Comments Module
 * Handles out-of-character comment rendering, streaming support, and DOM observation
 * Uses RAF batch rendering for optimized DOM updates
 *
 * Detection Strategy:
 * 1. Parse raw message content for <lumia_ooc> tags (ST strips custom tags from DOM)
 * 2. Use findAndReplaceDOMText to locate text content in the rendered DOM
 * 3. Replace matched text with styled OOC comment box
 * 4. Fall back to <font> element detection for backwards compatibility
 */

import { getContext } from "../stContext.js";
import { query, queryAll, createElement } from "../sthelpers/domUtils.js";
import { getSettings, MODULE_NAME } from "./settingsManager.js";
import { getItemFromLibrary } from "./dataProcessor.js";
import { hideLoomSumBlocks } from "./loomSystem.js";
import {
  setOOCProcessingCallbacks,
  setStreamingState,
  scheduleOOCUpdate,
  scheduleFullReprocess,
  flushPendingUpdates,
} from "./rafBatchRenderer.js";

// Lumia OOC color constant - the specific purple color used for Lumia's OOC comments
export const LUMIA_OOC_COLOR = "#9370DB";
export const LUMIA_OOC_COLOR_LOWER = "#9370db";

// Debounce timers for OOC processing
let oocProcessingTimer = null;
let oocRenderWaitTimer = null;

// Flag to track if generation is in progress (prevents observer interference)
let isGenerating = false;

/**
 * Set the generation state flag
 * @param {boolean} state - Whether generation is in progress
 */
export function setIsGenerating(state) {
  isGenerating = state;
  // Sync with RAF batch renderer for streaming-aware debouncing
  setStreamingState(state);
}

/**
 * Get the current generation state
 * @returns {boolean} Whether generation is in progress
 */
export function getIsGenerating() {
  return isGenerating;
}

/**
 * Clean OOC content by removing lumia_ooc tags, font tags, and trimming whitespace
 * Preserves inner content of removed tags (like <em>, <strong>, etc.)
 * @param {string} html - The raw innerHTML content
 * @returns {string} Cleaned content with tags stripped and whitespace trimmed
 */
function cleanOOCContent(html) {
  if (!html) return "";

  // Remove <lumia_ooc>, <lumiaooc>, <lumio_ooc>, <lumioooc> tags (all formats, case insensitive), keeping inner content
  let cleaned = html.replace(/<\/?lumi[ao]_?ooc(?:\s+[^>]*)?>/gi, "");

  // Remove any other custom Lumia/Lumio tags that might slip through
  cleaned = cleaned.replace(/<\/?lumi[ao]_[a-z_]+(?:\s+[^>]*)?>/gi, "");

  // Remove <font> tags but keep their inner content
  // This strips the legacy OOC detection method (purple font color)
  cleaned = cleaned.replace(/<\/?font(?:\s+[^>]*)?>/gi, "");

  // Collapse multiple newlines/breaks into single ones
  cleaned = cleaned.replace(/(<br\s*\/?>\s*){2,}/gi, "<br>");
  cleaned = cleaned.replace(/(\n\s*){2,}/g, "\n");

  // Trim leading/trailing whitespace and line breaks
  cleaned = cleaned.replace(/^(\s|<br\s*\/?>)+/gi, "");
  cleaned = cleaned.replace(/(\s|<br\s*\/?>)+$/gi, "");

  return cleaned.trim();
}

/**
 * Check if a font element has the Lumia OOC color
 * @param {HTMLElement} fontElement - The font element to check
 * @returns {boolean} True if the font has the Lumia OOC color
 */
export function isLumiaOOCFont(fontElement) {
  const color = fontElement.getAttribute("color");
  if (!color) return false;
  const normalizedColor = color.toLowerCase().trim();
  return (
    normalizedColor === LUMIA_OOC_COLOR_LOWER ||
    normalizedColor === "rgb(147, 112, 219)"
  );
}

/**
 * Get avatar image URL from selected Lumia definition
 * @returns {string|null} Avatar image URL or null
 */
export function getLumiaAvatarImg() {
  const settings = getSettings();
  if (settings.selectedDefinition) {
    const item = getItemFromLibrary(
      settings.selectedDefinition.packName,
      settings.selectedDefinition.itemName,
    );
    if (item && item.lumia_img) {
      return item.lumia_img;
    }
  }
  return null;
}

/**
 * Sanitize the Lumia name by removing "Lumia" prefix if present
 * LLMs sometimes include "Lumia" in the name field which breaks avatar lookup
 * @param {string|null} name - The raw name from the tag
 * @returns {string|null} Sanitized name without "Lumia" prefix
 */
function sanitizeLumiaName(name) {
  if (!name) return null;

  // Trim whitespace
  let sanitized = name.trim();

  // Remove "Lumia" or "Lumio" prefix (case insensitive) if present
  // Handles: "Lumia Serena", "Lumio Marcus", "lumia serena", etc.
  sanitized = sanitized.replace(/^lumi[ao]\s+/i, "");

  // Also handle if someone wrote it as "LumiaSerena" or "LumioMarcus" (no space)
  const lowerSanitized = sanitized.toLowerCase();
  if ((lowerSanitized.startsWith("lumia") || lowerSanitized.startsWith("lumio")) && sanitized.length > 5) {
    // Check if it looks like "LumiaSomething" or "LumioSomething" (camelCase)
    const afterPrefix = sanitized.substring(5);
    if (afterPrefix[0] === afterPrefix[0].toUpperCase()) {
      sanitized = afterPrefix;
    }
  }

  return sanitized || null;
}

/**
 * Extract OOC comments from raw message text using <lumia_ooc> or <lumiaooc> tags
 * Supports both normal and council mode formats
 *
 * PRECISE MATCHING STRUCTURE:
 * 1. Opening tag with name attribute: <lumia_ooc name="Name"> or <lumiaooc name="Name">
 * 2. Whitespace/newline
 * 3. Content (narrative comments)
 * 4. Whitespace/newline
 * 5. Closing tag that MATCHES the opening: </lumia_ooc> or </lumiaooc>
 *
 * Uses backreference to ensure opening/closing tags use same variant.
 *
 * @param {string} rawText - The raw message text
 * @returns {Array<{name: string|null, content: string, fullMatch: string}>} Array of OOC matches
 */
function extractOOCFromRawMessage(rawText) {
  if (!rawText) return [];

  // Precise regex with backreference to ensure matching open/close tags
  // Group 1: Tag variant (lumia_ooc, lumiaooc, lumio_ooc, lumioooc)
  // Group 2: Name attribute value (required)
  // Group 3: Content between tags
  // \1 backreference ensures closing tag matches opening tag exactly
  const oocRegex = /<(lumi[ao]_?ooc)\s+name="([^"]*)">\s*([\s\S]*?)\s*<\/\1>/gi;
  const matches = [];
  let match;

  while ((match = oocRegex.exec(rawText)) !== null) {
    const tagVariant = match[1];
    const rawName = match[2];
    const content = match[3];

    // Sanitize the name to remove "Lumia" prefix if present
    const sanitizedName = sanitizeLumiaName(rawName);

    console.log(`[${MODULE_NAME}] Extracted OOC: tag=${tagVariant}, name="${rawName}" → "${sanitizedName}", content length=${content.length}`);

    matches.push({
      name: sanitizedName,
      content: content.trim(),
      fullMatch: match[0],
    });
  }

  // Fallback: Also try matching OOC tags without name attribute (legacy/simple format)
  // Only if we found no matches with the precise regex
  if (matches.length === 0) {
    const fallbackRegex = /<(lumi[ao]_?ooc)(?:\s+name="([^"]*)")?>\s*([\s\S]*?)\s*<\/\1>/gi;
    while ((match = fallbackRegex.exec(rawText)) !== null) {
      const sanitizedName = sanitizeLumiaName(match[2]);
      matches.push({
        name: sanitizedName,
        content: match[3].trim(),
        fullMatch: match[0],
      });
    }
  }

  return matches;
}

/**
 * Strip markdown formatting characters from text
 * SillyTavern renders markdown, so *text* becomes <em>text</em> in DOM
 * We need to strip these from search text to match the rendered DOM content
 * @param {string} text - Text that may contain markdown
 * @returns {string} Text with markdown formatting stripped
 */
function stripMarkdownFormatting(text) {
  if (!text) return "";

  let result = text;

  // Remove bold/italic markers: **text**, *text*, __text__, _text_
  // Process longer patterns first to avoid partial matches
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, "$1"); // ***bold italic***
  result = result.replace(/\*\*(.+?)\*\*/g, "$1");     // **bold**
  result = result.replace(/\*(.+?)\*/g, "$1");         // *italic*
  result = result.replace(/___(.+?)___/g, "$1");       // ___bold italic___
  result = result.replace(/__(.+?)__/g, "$1");         // __bold__
  result = result.replace(/_(.+?)_/g, "$1");           // _italic_

  // Handle standalone asterisks at start (like "*sighs*" action markers)
  // These often appear as *action* at the start of OOC content
  result = result.replace(/^\*([^*]+)\*/g, "$1");

  // Normalize quotes: smart quotes to straight quotes for matching
  result = result.replace(/[""]/g, '"');
  result = result.replace(/['']/g, "'");

  return result;
}

/**
 * Strip HTML tags and convert to plain text for matching
 * Also strips markdown formatting since ST renders it to HTML
 * @param {string} html - HTML content
 * @returns {string} Plain text content ready for DOM matching
 */
function htmlToPlainText(html) {
  if (!html) return "";

  // Create a temporary element to parse HTML
  const temp = document.createElement("div");
  temp.innerHTML = html;

  // Get text content (browser handles entity decoding)
  let text = temp.textContent || temp.innerText || "";

  // Strip markdown formatting (ST renders *text* as <em>, so DOM won't have asterisks)
  text = stripMarkdownFormatting(text);

  // Normalize whitespace: collapse multiple spaces/newlines to single space
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Find text in a container and return the matching element's formatted content
 *
 * IMPROVED MATCHING STRATEGY:
 * 1. Skip elements already wrapped in [data-lumia-ooc] (already processed)
 * 2. Use longer prefix matching (min 50 chars or full text if shorter)
 * 3. Verify substantial content overlap, not just prefix
 * 4. For council mode with multiple OOCs, this prevents cross-matching
 *
 * @param {HTMLElement} container - Container element to search within
 * @param {string} searchText - Text to find (will be normalized)
 * @returns {{element: HTMLElement, innerHTML: string}|null} Matched element and its innerHTML, or null
 */
function findMatchingElement(container, searchText) {
  if (!container || !searchText) return null;

  // Normalize search text - collapse whitespace
  const normalizedSearch = searchText.replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalizedSearch) return null;

  // Use longer prefix for matching to avoid cross-matching similar OOCs
  // Use at least 50 chars or full text if shorter
  const matchPrefix = normalizedSearch.substring(0, Math.min(50, normalizedSearch.length));

  // First, check all <p> tags - ST wraps content in paragraphs
  const paragraphs = queryAll("p", container);

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const p = paragraphs[pIdx];

    // Skip paragraphs already inside a wrapped OOC box
    if (p.closest("[data-lumia-ooc]")) {
      continue;
    }

    // Normalize DOM text: strip any remaining markdown and normalize quotes
    const pText = stripMarkdownFormatting((p.textContent || "").replace(/\s+/g, " ").trim());
    const pTextLower = pText.toLowerCase();

    // Check if this paragraph contains our search prefix
    if (!pTextLower.includes(matchPrefix)) {
      continue;
    }

    // Additional verification: Check for substantial content overlap
    // The paragraph text should contain most of the search text (at least 80%)
    const overlapThreshold = Math.min(normalizedSearch.length, pTextLower.length) * 0.8;
    let overlapCount = 0;

    // Count how many characters from search text appear in paragraph
    for (let i = 0; i < normalizedSearch.length && i < pTextLower.length; i++) {
      if (pTextLower.includes(normalizedSearch.substring(i, i + 10))) {
        overlapCount += 10;
        i += 9; // Skip ahead
      }
    }

    if (overlapCount < overlapThreshold && normalizedSearch.length > 50) {
      // Not enough overlap for longer texts, try next paragraph
      continue;
    }

    // Found a match - return the element and its formatted innerHTML
    console.log(`[${MODULE_NAME}] findMatchingElement: Matched paragraph ${pIdx} with ${overlapCount}/${normalizedSearch.length} char overlap`);
    return {
      element: p,
      innerHTML: p.innerHTML,
    };
  }

  // Fallback: If not in <p> tags, try direct text node search
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node;

  while ((node = walker.nextNode())) {
    // Skip nodes inside already-wrapped OOC boxes
    if (node.parentElement?.closest("[data-lumia-ooc]")) {
      continue;
    }

    // Normalize node text for comparison
    const nodeText = stripMarkdownFormatting(node.nodeValue || "");
    const nodeTextLower = nodeText.toLowerCase();

    if (nodeTextLower.includes(matchPrefix)) {
      // Find the parent element
      let target = node.parentElement;
      while (target && target !== container && target.tagName !== "P" && target.tagName !== "DIV") {
        target = target.parentElement;
      }

      if (target && target !== container && !target.closest("[data-lumia-ooc]")) {
        console.log(`[${MODULE_NAME}] findMatchingElement: Matched via text walker fallback`);
        return {
          element: target,
          innerHTML: target.innerHTML,
        };
      }
    }
  }

  return null;
}

/**
 * Track which text has been replaced to avoid duplicate replacements
 * Keyed by message ID
 * @type {Map<number, Set<string>>}
 */
const processedOOCTexts = new Map();

/**
 * Clear processed texts for a message (used when reprocessing)
 * Call this before reprocessing a message to avoid stuck states
 * @param {number} mesId - Message ID
 */
export function clearProcessedTexts(mesId) {
  processedOOCTexts.delete(mesId);
}

/**
 * Clear ALL processed texts (used when style changes require full reprocessing)
 */
function clearAllProcessedTexts() {
  processedOOCTexts.clear();
}

/**
 * Check if text has already been processed for a message
 * @param {number} mesId - Message ID
 * @param {string} text - Text to check
 * @returns {boolean} True if already processed
 */
function isTextProcessed(mesId, text) {
  const normalizedText = text.toLowerCase().trim();
  const processed = processedOOCTexts.get(mesId);
  return processed?.has(normalizedText) || false;
}

/**
 * Mark text as processed for a message
 * @param {number} mesId - Message ID
 * @param {string} text - Text to mark
 */
function markTextProcessed(mesId, text) {
  const normalizedText = text.toLowerCase().trim();
  if (!processedOOCTexts.has(mesId)) {
    processedOOCTexts.set(mesId, new Set());
  }
  processedOOCTexts.get(mesId).add(normalizedText);
}

/**
 * Calculate a match score between two names
 * Higher score = better match. 0 = no match.
 * Uses strict matching to avoid similar names colliding.
 * @param {string} searchName - The name we're looking for
 * @param {string} targetName - The name to compare against
 * @returns {number} Match score (0 = no match, 100 = exact match)
 */
function getNameMatchScore(searchName, targetName) {
  if (!searchName || !targetName) return 0;

  const search = searchName.toLowerCase().trim();
  const target = targetName.toLowerCase().trim();

  // Exact match - highest score
  if (search === target) return 100;

  // Split into words for word-level matching
  const searchWords = search.split(/\s+/).filter(w => w.length >= 2);
  const targetWords = target.split(/\s+/).filter(w => w.length >= 2);

  // Check for exact word matches (not substring matches)
  let exactWordMatches = 0;
  for (const sw of searchWords) {
    if (targetWords.includes(sw)) {
      exactWordMatches++;
    }
  }

  // If we have exact word matches, score based on how complete the match is
  if (exactWordMatches > 0) {
    // Score based on proportion of words matched
    const searchCoverage = exactWordMatches / searchWords.length;
    const targetCoverage = exactWordMatches / targetWords.length;
    // Average of both coverages, scaled to 50-90 range
    return 50 + Math.round((searchCoverage + targetCoverage) / 2 * 40);
  }

  // No match - don't use loose substring matching as it causes collisions
  // e.g., "Serena" vs "Serenity" should NOT match
  return 0;
}

/**
 * Check if two names match (wrapper for score-based matching)
 * @param {string} searchName - The name we're looking for
 * @param {string} targetName - The name to compare against
 * @returns {boolean} True if names match with sufficient confidence
 */
function namesMatch(searchName, targetName) {
  return getNameMatchScore(searchName, targetName) >= 50;
}

/**
 * Get avatar image URL for a Lumia by name
 * Works in both council mode and normal mode
 * Uses score-based matching to find the best match and avoid similar name collisions
 * @param {string} lumiaName - The Lumia's name from the OOC tag
 * @returns {string|null} Avatar image URL or null
 */
function getLumiaAvatarByName(lumiaName) {
  if (!lumiaName) return null;

  const settings = getSettings();
  let bestMatch = { score: 0, avatar: null };

  /**
   * Helper to update best match if this candidate scores higher
   */
  const checkCandidate = (item, nameToCheck) => {
    if (!item?.lumia_img) return;
    const score = getNameMatchScore(lumiaName, nameToCheck);
    if (score > bestMatch.score) {
      bestMatch = { score, avatar: item.lumia_img };
    }
  };

  // In council mode, check council members (highest priority)
  if (settings.councilMode && settings.councilMembers?.length) {
    for (const member of settings.councilMembers) {
      const item = getItemFromLibrary(member.packName, member.itemName);
      if (!item) continue;

      // Check against both itemName and lumiaDefName
      checkCandidate(item, item.lumiaDefName || member.itemName);
      checkCandidate(item, member.itemName);

      // If we found an exact match (score 100), return immediately
      if (bestMatch.score === 100) return bestMatch.avatar;
    }
  }

  // Check selected definition in normal mode
  if (settings.selectedDefinition) {
    const item = getItemFromLibrary(
      settings.selectedDefinition.packName,
      settings.selectedDefinition.itemName
    );
    if (item) {
      checkCandidate(item, item.lumiaDefName || settings.selectedDefinition.itemName);
      checkCandidate(item, settings.selectedDefinition.itemName);

      if (bestMatch.score === 100) return bestMatch.avatar;
    }
  }

  // Check chimera mode definitions
  if (settings.chimeraMode && settings.selectedDefinitions?.length) {
    for (const sel of settings.selectedDefinitions) {
      const item = getItemFromLibrary(sel.packName, sel.itemName);
      if (!item) continue;

      checkCandidate(item, item.lumiaDefName || sel.itemName);
      checkCandidate(item, sel.itemName);

      if (bestMatch.score === 100) return bestMatch.avatar;
    }
  }

  // If we have a good match from active selections, use it
  // (Prefer active selections over searching all packs)
  if (bestMatch.score >= 50) {
    return bestMatch.avatar;
  }

  // Fallback: search all packs for matching Lumia
  if (settings.packs) {
    for (const pack of Object.values(settings.packs)) {
      if (!pack.items) continue;
      for (const item of pack.items) {
        const itemName = item.lumiaDefName || "";
        checkCandidate(item, itemName);

        if (bestMatch.score === 100) return bestMatch.avatar;
      }
    }
  }

  // Return best match if score is sufficient, otherwise null
  return bestMatch.score >= 50 ? bestMatch.avatar : null;
}

/**
 * Get avatar image URL for a council member by name
 * @deprecated Use getLumiaAvatarByName instead
 * @param {string} memberName - The council member's name (itemName)
 * @returns {string|null} Avatar image URL or null
 */
function getCouncilMemberAvatar(memberName) {
  // Delegate to the new unified function
  return getLumiaAvatarByName(memberName);
}

/**
 * Create the styled OOC comment box element
 * Supports multiple styles: 'social', 'margin', 'whisper'
 * @param {string} content - The text content for the OOC box
 * @param {string|null} avatarImg - URL to avatar image, or null for placeholder
 * @param {number} index - Index of this OOC in the message (for alternating styles)
 * @param {string|null} memberName - Council member name (for council mode), or null for normal mode
 * @returns {HTMLElement} The created OOC comment box element
 */
export function createOOCCommentBox(content, avatarImg, index = 0, memberName = null) {
  const settings = getSettings();
  const style = settings.lumiaOOCStyle || "social";
  const isAlt = index % 2 === 1; // Alternate on odd indices

  switch (style) {
    case "none":
      return createOOCRawText(content, memberName);
    case "margin":
      return createOOCMarginNote(content, avatarImg, isAlt, memberName);
    case "whisper":
      return createOOCWhisperBubble(content, avatarImg, isAlt, memberName);
    case "social":
    default:
      return createOOCSocialCard(content, avatarImg, memberName);
  }
}

/**
 * Create raw text OOC display (no special formatting)
 * Simple inline text without any wrapper styling
 * @param {string} content - The OOC message content
 * @param {string|null} memberName - Council member name, or null for default "Lumia"
 */
function createOOCRawText(content, memberName = null) {
  const displayName = memberName || "Lumia";

  // Create a simple span wrapper for the raw text
  const container = createElement("span", {
    attrs: {
      class: "lumia-ooc-raw",
      "data-lumia-ooc": "true",
      "data-lumia-speaker": displayName,
    },
    html: content,
  });

  return container;
}

/**
 * Create Social Card style OOC box (original design)
 * Full card with avatar, name, thread indicator, and ethereal animations
 * @param {string} content - The OOC message content
 * @param {string|null} avatarImg - Avatar image URL
 * @param {string|null} memberName - Council member name, or null for default "Lumia"
 */
function createOOCSocialCard(content, avatarImg, memberName = null) {
  const displayName = memberName || "Lumia";
  const threadText = memberName ? "speaks from the Council" : "weaving through the Loom";
  const placeholderLetter = memberName ? memberName.charAt(0).toUpperCase() : "L";

  // Create avatar container with ethereal glow ring
  const avatarElement = avatarImg
    ? createElement("img", {
        attrs: { src: avatarImg, alt: displayName, class: "lumia-ooc-avatar" },
      })
    : createElement("div", {
        attrs: { class: "lumia-ooc-avatar lumia-ooc-avatar-placeholder" },
        text: placeholderLetter,
      });

  // Wrap avatar in a glow container for the ethereal effect
  const avatarContainer = createElement("div", {
    attrs: { class: "lumia-ooc-avatar-container" },
    children: [avatarElement],
  });

  // Create the name/handle area (like a social media username)
  const nameElement = createElement("span", {
    attrs: { class: "lumia-ooc-name" },
    text: displayName,
  });

  // Create the "thread" indicator - weaving motif
  const threadIndicator = createElement("span", {
    attrs: { class: "lumia-ooc-thread" },
    text: threadText,
  });

  // Create header row with name and thread indicator
  const headerRow = createElement("div", {
    attrs: { class: "lumia-ooc-header-row" },
    children: [nameElement, threadIndicator],
  });

  // Create content element - the actual OOC message
  const contentElement = createElement("div", {
    attrs: { class: "lumia-ooc-content" },
    html: content,
  });

  // Create the content column (header + content stacked)
  const contentColumn = createElement("div", {
    attrs: { class: "lumia-ooc-content-column" },
    children: [headerRow, contentElement],
  });

  // Create the main comment box with horizontal layout
  const commentBox = createElement("div", {
    attrs: { class: "lumia-ooc-comment-box", "data-lumia-ooc": "true" },
    children: [avatarContainer, contentColumn],
  });

  return commentBox;
}

/**
 * Create Margin Note style OOC box
 * Apple-esque minimal hanging tag design
 * @param {string} content - The OOC message content
 * @param {string|null} avatarImg - Avatar image URL
 * @param {boolean} isAlt - Whether to use alternate (right-aligned) orientation
 * @param {string|null} memberName - Council member name, or null for default "Lumia"
 */
function createOOCMarginNote(content, avatarImg, isAlt = false, memberName = null) {
  const displayName = memberName || "Lumia";
  const placeholderLetter = memberName ? memberName.charAt(0).toUpperCase() : "L";

  // Create the hanging tag with avatar or letter
  const tagContent = avatarImg
    ? createElement("img", {
        attrs: {
          src: avatarImg,
          alt: placeholderLetter,
          class: "lumia-ooc-margin-tag-avatar",
        },
      })
    : createElement("span", {
        attrs: { class: "lumia-ooc-margin-tag-letter" },
        text: placeholderLetter,
      });

  const tag = createElement("div", {
    attrs: { class: "lumia-ooc-margin-tag" },
    children: [tagContent],
  });

  // Create the subtle label
  const label = createElement("div", {
    attrs: { class: "lumia-ooc-margin-label" },
    text: displayName,
  });

  // Create the content text
  const text = createElement("div", {
    attrs: { class: "lumia-ooc-margin-text" },
    html: content,
  });

  // Create the content area
  const contentArea = createElement("div", {
    attrs: { class: "lumia-ooc-margin-content-area" },
    children: [label, text],
  });

  // Create the main container with alternating class
  const containerClass = isAlt
    ? "lumia-ooc-margin lumia-ooc-alt"
    : "lumia-ooc-margin";
  const container = createElement("div", {
    attrs: { class: containerClass, "data-lumia-ooc": "true" },
    children: [tag, contentArea],
  });

  return container;
}

/**
 * Create Whisper Bubble style OOC box
 * Soft ethereal thought bubble design with prominent avatar
 * @param {string} content - The OOC message content
 * @param {string|null} avatarImg - Avatar image URL
 * @param {boolean} isAlt - Whether to use alternate (right-aligned) orientation
 * @param {string|null} memberName - Council member name, or null for default "Lumia"
 */
function createOOCWhisperBubble(content, avatarImg, isAlt = false, memberName = null) {
  const displayName = memberName || "Lumia";
  const whisperText = `${displayName} whispers...`;
  const placeholderLetter = memberName ? memberName.charAt(0).toUpperCase() : "L";

  // Create the avatar element (outside the bubble, prominent)
  const avatar = avatarImg
    ? createElement("img", {
        attrs: {
          src: avatarImg,
          alt: displayName,
          class: "lumia-ooc-whisper-avatar",
        },
      })
    : createElement("div", {
        attrs: { class: "lumia-ooc-whisper-avatar-placeholder" },
        text: placeholderLetter,
      });

  // Wrap avatar in container
  const avatarWrap = createElement("div", {
    attrs: { class: "lumia-ooc-whisper-avatar-wrap" },
    children: [avatar],
  });

  // Create the name
  const name = createElement("span", {
    attrs: { class: "lumia-ooc-whisper-name" },
    text: whisperText,
  });

  // Create header
  const header = createElement("div", {
    attrs: { class: "lumia-ooc-whisper-header" },
    children: [name],
  });

  // Create the content text
  const text = createElement("div", {
    attrs: { class: "lumia-ooc-whisper-text" },
    html: content,
  });

  // Create the bubble (now just contains header and text)
  const bubble = createElement("div", {
    attrs: { class: "lumia-ooc-whisper-bubble" },
    children: [header, text],
  });

  // Create the main container with alternating class
  const containerClass = isAlt
    ? "lumia-ooc-whisper lumia-ooc-alt"
    : "lumia-ooc-whisper";
  const container = createElement("div", {
    attrs: { class: containerClass, "data-lumia-ooc": "true" },
    children: [avatarWrap, bubble],
  });

  return container;
}

/**
 * Internal: Perform the actual DOM updates for OOC comments in a message
 * Called by the RAF batch renderer - does not handle scroll preservation
 *
 * HYBRID APPROACH:
 * 1. Parse raw message content for <lumia_ooc> tags (ST strips custom tags from DOM)
 * 2. Use findAndReplaceDOMText to locate text content in the rendered DOM
 * 3. Replace matched text with styled OOC comment box
 * 4. Fall back to <font> element detection for backwards compatibility
 *
 * @param {number} mesId - The message ID to process
 * @param {boolean} force - Force reprocessing even if OOC boxes exist
 */
function performOOCProcessing(mesId, force = false) {
  try {
    // Get the message element from DOM
    const messageElement = query(`div[mesid="${mesId}"] .mes_text`);

    if (!messageElement) {
      return; // Silent return - element may not be rendered yet
    }

    // Clear tracking for this message if forcing reprocess
    if (force) {
      clearProcessedTexts(mesId);
    }

    // Get raw message content for tag-based detection
    const context = getContext();
    const chatMessage = context?.chat?.[mesId];
    const rawContent = chatMessage?.mes || chatMessage?.content || "";

    // Count OOCs from both sources: tags in raw content AND font elements in DOM
    const oocMatches = extractOOCFromRawMessage(rawContent);
    const existingBoxes = queryAll("[data-lumia-ooc]", messageElement);
    const fontOOCs = queryAll("font", messageElement).filter(isLumiaOOCFont);

    // Total expected OOCs = tag-based + font-based (that aren't already in boxes)
    const unprocessedFontOOCs = fontOOCs.filter(f => !f.closest("[data-lumia-ooc]"));
    const totalExpectedOOCs = oocMatches.length + unprocessedFontOOCs.length;

    // Skip only if we've already wrapped ALL OOCs (not just some)
    // This fixes the bug where partial renders caused later OOCs to be missed
    if (existingBoxes.length > 0 && existingBoxes.length >= totalExpectedOOCs && !force) {
      return; // All OOCs already processed
    }

    let processedCount = 0;

    // STEP 1: Process <lumia_ooc> tags found in raw content
    // (oocMatches was already extracted above for the early-exit check)
    if (oocMatches.length > 0) {
      console.log(
        `[${MODULE_NAME}] Found ${oocMatches.length} <lumia_ooc> tag(s) in raw content for message ${mesId}`,
      );

      oocMatches.forEach((ooc, index) => {
        // Get plain text version for matching in DOM
        const plainText = htmlToPlainText(ooc.content);

        if (!plainText) {
          console.log(
            `[${MODULE_NAME}] Skipping OOC #${index + 1}: empty after text extraction`,
          );
          return;
        }

        // Check if this text was already processed
        if (isTextProcessed(mesId, plainText)) {
          console.log(
            `[${MODULE_NAME}] Skipping OOC #${index + 1}: already processed`,
          );
          return;
        }

        console.log(
          `[${MODULE_NAME}] Processing OOC #${index + 1}${ooc.name ? ` (${ooc.name})` : ""}: "${plainText.substring(0, 60)}..."`,
        );

        // Find the matching element in the DOM - this gives us the formatted content
        const match = findMatchingElement(messageElement, plainText);

        if (!match) {
          console.log(
            `[${MODULE_NAME}] Could not find OOC #${index + 1} text in DOM`,
          );
          return;
        }

        // Get avatar: look up by name if provided, fallback to default Lumia avatar
        // Uses fuzzy matching to handle name variations (e.g., "Lumia Serena" → "Serena")
        const avatarImg = ooc.name
          ? (getLumiaAvatarByName(ooc.name) || getLumiaAvatarImg())
          : getLumiaAvatarImg();

        // Use the DOM's innerHTML (preserves ST's formatting like <em>, <strong>, etc.)
        // but clean out any lumia-specific tags
        const formattedContent = cleanOOCContent(match.innerHTML);
        if (!formattedContent) return;

        // Create styled box with member name and formatted content
        const commentBox = createOOCCommentBox(formattedContent, avatarImg, processedCount, ooc.name);

        // Replace the matched element with our styled box
        if (match.element.parentNode) {
          match.element.parentNode.replaceChild(commentBox, match.element);
          markTextProcessed(mesId, plainText);
          processedCount++;
          console.log(
            `[${MODULE_NAME}] Replaced OOC #${index + 1} with styled box (preserved formatting)`,
          );
        }
      });
    }

    // STEP 2: Process <font> elements with OOC color
    // This is a fallback for messages that don't use <lumia_ooc> tags
    const fontElements = queryAll("font", messageElement).filter(isLumiaOOCFont);

    if (fontElements.length > 0) {
      console.log(
        `[${MODULE_NAME}] Found ${fontElements.length} OOC font element(s) in DOM for message ${mesId}`,
      );

      fontElements.forEach((fontElement, index) => {
        // Skip if inside an already-processed OOC box
        if (fontElement.closest("[data-lumia-ooc]")) {
          console.log(`[${MODULE_NAME}] Skipping font #${index + 1}: already inside processed box`);
          return;
        }

        // Get content from font element
        const rawFontContent = fontElement.innerHTML;
        const cleanContent = cleanOOCContent(rawFontContent);

        if (!cleanContent) {
          console.log(
            `[${MODULE_NAME}] Skipping font #${index + 1}: empty after cleaning`,
          );
          return;
        }

        // Check if this text was already processed (by tag-based detection)
        const plainText = htmlToPlainText(rawFontContent);
        if (isTextProcessed(mesId, plainText)) {
          console.log(`[${MODULE_NAME}] Skipping font #${index + 1}: already processed by tag detection`);
          return;
        }

        console.log(
          `[${MODULE_NAME}] Processing font #${index + 1}: "${cleanContent.substring(0, 50)}${cleanContent.length > 50 ? "..." : ""}"`,
        );

        // Mark as processed
        markTextProcessed(mesId, plainText);

        // Get default Lumia avatar (no member name available from font-only format)
        const avatarImg = getLumiaAvatarImg();

        // Create styled box
        const commentBox = createOOCCommentBox(cleanContent, avatarImg, processedCount);

        // Find the outermost element to replace
        // Walk up to find any containing block element that only contains this OOC
        let elementToReplace = fontElement;
        let current = fontElement.parentElement;

        while (current && current !== messageElement) {
          const tagName = current.tagName?.toLowerCase();

          // Stop at block-level elements
          if (tagName === "p" || tagName === "div") {
            // Only replace the block if it contains just this OOC content
            const blockText = current.textContent?.trim();
            const fontText = fontElement.textContent?.trim();
            if (blockText === fontText) {
              elementToReplace = current;
            }
            break;
          }
          current = current.parentElement;
        }

        // Replace the element
        if (elementToReplace.parentNode) {
          elementToReplace.parentNode.replaceChild(commentBox, elementToReplace);
          console.log(
            `[${MODULE_NAME}] Replaced font #${index + 1} (${elementToReplace.tagName}) with styled box`,
          );
          processedCount++;
        }
      });
    }

    if (processedCount > 0) {
      // Force reflow to ensure styles are applied
      messageElement.offsetHeight;
      console.log(
        `[${MODULE_NAME}] Finished processing ${processedCount} OOC comment(s) in message ${mesId}`,
      );
    }
  } catch (error) {
    console.error(`[${MODULE_NAME}] Error processing OOC comments:`, error);
  }
}

/**
 * Schedule OOC comment processing for a message via RAF batching
 * This is the public API - use this instead of direct DOM manipulation
 * @param {number} mesId - The message ID to process
 * @param {boolean} force - Force reprocessing even if OOC boxes exist
 */
export function processLumiaOOCComments(mesId, force = false) {
  scheduleOOCUpdate(mesId, force);
}

/**
 * Internal: Perform full chat OOC processing
 * Called by the RAF batch renderer - does not handle scroll preservation
 * @param {boolean} clearExisting - Whether to clear existing OOC boxes first
 */
function performAllOOCProcessing(clearExisting = false) {
  const context = getContext();
  if (!context || !context.chat) return;

  console.log(
    `[${MODULE_NAME}] Processing all OOC comments in chat (${context.chat.length} messages)${clearExisting ? " [clearing existing]" : ""}`,
  );

  // If clearing existing OOC boxes (e.g., style change), remove them all first
  if (clearExisting) {
    // Clear ALL tracking so texts can be reprocessed with new style
    clearAllProcessedTexts();

    const allOOCBoxes = queryAll("[data-lumia-ooc]");
    allOOCBoxes.forEach((box) => {
      // Get the text content from the appropriate element based on style
      let content = "";
      const marginText = box.querySelector(".lumia-ooc-margin-text");
      const whisperText = box.querySelector(".lumia-ooc-whisper-text");
      const socialContent = box.querySelector(".lumia-ooc-content");

      if (marginText) content = marginText.innerHTML;
      else if (whisperText) content = whisperText.innerHTML;
      else if (socialContent) content = socialContent.innerHTML;

      // Recreate the original font element structure
      const fontElement = document.createElement("font");
      fontElement.setAttribute("color", LUMIA_OOC_COLOR);
      fontElement.innerHTML = content;

      // Replace the box with the font element
      if (box.parentNode) {
        box.parentNode.replaceChild(fontElement, box);
      }
    });
  }

  // Process each message in the chat - both OOC comments and loom_sum hiding
  for (let i = 0; i < context.chat.length; i++) {
    // Hide loom_sum blocks in the DOM
    const messageElement = query(`div[mesid="${i}"] .mes_text`);
    if (messageElement) {
      hideLoomSumBlocks(messageElement);
    }
    // Directly process - we're already in RAF context
    performOOCProcessing(i);
  }
}

/**
 * Schedule processing of all Lumia OOC comments and hide loom_sum blocks in the chat
 * Called on CHAT_CHANGED and initial load to ensure all messages are processed
 * Uses RAF batching for optimized rendering
 * @param {boolean} clearExisting - Whether to clear existing OOC boxes first
 */
export function processAllLumiaOOCComments(clearExisting = false) {
  scheduleFullReprocess(clearExisting);
}

/**
 * Schedule OOC processing after chat render completes
 * Uses RAF batching for optimal timing - no artificial delays
 */
export function scheduleOOCProcessingAfterRender() {
  // Clear any pending timers
  if (oocProcessingTimer) clearTimeout(oocProcessingTimer);
  if (oocRenderWaitTimer) clearTimeout(oocRenderWaitTimer);

  const maxWaitTime = 1000; // Reduced from 3000ms
  const checkInterval = 16; // One frame at 60fps
  const startTime = Date.now();

  function checkAndProcess() {
    const chatElement = document.getElementById("chat");
    const context = getContext();

    const hasContextMessages = context?.chat?.length > 0;
    const messageElements = chatElement
      ? queryAll(".mes_text", chatElement)
      : [];
    const hasDOMMessages = messageElements.length > 0;

    if (Date.now() - startTime > maxWaitTime) {
      console.log(
        `[${MODULE_NAME}] Max wait time reached, processing OOCs now`,
      );
      processAllLumiaOOCComments();
      return;
    }

    if (hasContextMessages && !hasDOMMessages) {
      // DOM not ready yet, check again next frame
      oocRenderWaitTimer = setTimeout(checkAndProcess, checkInterval);
      return;
    }

    if (hasDOMMessages || !hasContextMessages) {
      // DOM ready - process immediately via RAF batching
      console.log(
        `[${MODULE_NAME}] DOM ready with ${messageElements.length} messages, scheduling OOC processing`,
      );
      processAllLumiaOOCComments();
      return;
    }

    oocRenderWaitTimer = setTimeout(checkAndProcess, checkInterval);
  }

  // Start checking immediately via RAF for optimal timing
  requestAnimationFrame(checkAndProcess);
}

/**
 * Check if a font element is a partial/incomplete OOC marker during streaming
 * @param {HTMLElement} fontElement - The font element to check
 * @returns {boolean} True if it appears to be a partial OOC marker
 */
function isPartialOOCMarker(fontElement) {
  if (!isLumiaOOCFont(fontElement)) return false;

  const parent = fontElement.parentElement;
  if (!parent) return true;

  const lumiaOocParent = fontElement.closest("lumia_ooc, lumiaooc, lumio_ooc, lumioooc");
  if (!lumiaOocParent) {
    const mesText = fontElement.closest(".mes_text");
    if (mesText) {
      const isStreaming = mesText
        .closest(".mes")
        ?.classList.contains("last_mes");
      return isStreaming;
    }
  }

  return false;
}

/**
 * Hide partial OOC markers during streaming
 * @param {HTMLElement} messageElement - The message element to process
 */
function hideStreamingOOCMarkers(messageElement) {
  const fontElements = queryAll("font", messageElement);
  const oocFonts = fontElements.filter(isLumiaOOCFont);

  oocFonts.forEach((fontElement) => {
    if (isPartialOOCMarker(fontElement)) {
      if (!fontElement.classList.contains("lumia-ooc-marker-hidden")) {
        fontElement.classList.add("lumia-ooc-marker-hidden");
        fontElement.style.display = "none";
        console.log(
          `[${MODULE_NAME}] Hiding partial OOC marker during streaming`,
        );
      }
    }
  });
}

/**
 * Unhide and process OOC markers after streaming completes
 * @param {HTMLElement} messageElement - The message element to process
 */
export function unhideAndProcessOOCMarkers(messageElement) {
  const hiddenMarkers = queryAll(".lumia-ooc-marker-hidden", messageElement);

  if (hiddenMarkers.length === 0) return;

  console.log(`[${MODULE_NAME}] Unhiding ${hiddenMarkers.length} OOC markers`);

  hiddenMarkers.forEach((marker) => {
    marker.classList.remove("lumia-ooc-marker-hidden");
    marker.style.display = "";
  });

  const mesBlock = messageElement.closest("div[mesid]");
  if (mesBlock) {
    const mesId = parseInt(mesBlock.getAttribute("mesid"), 10);
    processLumiaOOCComments(mesId);
  }
}

/**
 * Set up MutationObserver for streaming support and dynamic content
 * @returns {MutationObserver} The observer instance
 */
export function setupLumiaOOCObserver() {
  const chatElement = document.getElementById("chat");

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        let messageElements = [];
        if (node.classList && node.classList.contains("mes_text")) {
          messageElements = [node];
        } else if (node.querySelectorAll) {
          messageElements = Array.from(node.querySelectorAll(".mes_text"));
        }

        // Check for OOC font elements (fallback method - fonts remain visible in DOM)
        // Tag-based detection via raw content is handled by CHARACTER_MESSAGE_RENDERED
        if (node.tagName === "FONT" && isLumiaOOCFont(node)) {
          const mesText = node.closest(".mes_text");
          if (mesText && !messageElements.includes(mesText)) {
            messageElements.push(mesText);
          }
        }

        if (
          node.nodeType === Node.TEXT_NODE ||
          (node.innerHTML &&
            (node.innerHTML.includes("<loom_sum>") ||
              node.innerHTML.includes("&lt;loom_sum&gt;")))
        ) {
          const mesText = node.closest ? node.closest(".mes_text") : null;
          if (mesText && !messageElements.includes(mesText)) {
            messageElements.push(mesText);
          }
        }

        messageElements.forEach((messageElement) => {
          hideLoomSumBlocks(messageElement);

          if (isGenerating) {
            return;
          }

          const existingBoxes = queryAll("[data-lumia-ooc]", messageElement);
          if (existingBoxes.length > 0) {
            return;
          }

          const mesBlock = messageElement.closest("div[mesid]");
          if (!mesBlock) return;

          const mesId = parseInt(mesBlock.getAttribute("mesid"), 10);

          // Check for OOC content: tags in raw content, or font elements in DOM (fallback)
          // DOM-based tag detection is unreliable as ST hides custom tags by default
          const context = getContext();
          const chatMessage = context?.chat?.[mesId];
          const rawContent = chatMessage?.mes || chatMessage?.content || "";

          const hasOOCTags = /<lumi[ao]_?ooc(?:\s+name="[^"]*")?>/i.test(rawContent);
          const oocFonts = queryAll("font", messageElement).filter(
            isLumiaOOCFont,
          );

          if (hasOOCTags || oocFonts.length > 0) {
            console.log(
              `[${MODULE_NAME}] Observer: Processing OOC in message ${mesId} (tags in raw: ${hasOOCTags}, fonts in DOM: ${oocFonts.length})`,
            );
            processLumiaOOCComments(mesId);
          }
        });
      });

      if (mutation.type === "characterData") {
        const mesText = mutation.target.parentElement?.closest(".mes_text");
        if (mesText) {
          hideLoomSumBlocks(mesText);
        }
      }
    });
  });

  const targetElement = chatElement || document.body;
  observer.observe(targetElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  console.log(
    `[${MODULE_NAME}] OOC observer started on ${chatElement ? "chat element" : "body (fallback)"}`,
  );

  return observer;
}

/**
 * Initialize RAF batch rendering for OOC comments
 * Must be called during module initialization to register callbacks
 */
export function initializeRAFBatchRenderer() {
  console.log(`[${MODULE_NAME}] Initializing RAF batch renderer for OOC comments`);
  setOOCProcessingCallbacks(performOOCProcessing, performAllOOCProcessing);
}

/**
 * Force immediate flush of any pending OOC updates
 * Useful when updates need to be visible immediately
 */
export { flushPendingUpdates } from "./rafBatchRenderer.js";
