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
 * Clean OOC content by removing lumia_ooc tags, font tags, and normalizing whitespace/breaks
 * Preserves inner content of removed tags (like <em>, <strong>, etc.)
 *
 * CRITICAL: When Range API extracts content spanning multiple <p> elements,
 * we can end up with excessive <br> tags and empty block elements causing spacing issues.
 * This function aggressively normalizes to prevent layout problems in OOC wrappers.
 *
 * @param {string} html - The raw innerHTML content
 * @returns {string} Cleaned content with tags stripped and whitespace normalized
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

  // Remove empty <p> and <div> tags entirely (they add unwanted margins)
  cleaned = cleaned.replace(/<(p|div)>\s*<\/\1>/gi, "");

  // Convert <p> and <div> tags to simple line breaks to flatten structure
  // Opening tag becomes nothing, closing tag becomes <br> (will be normalized below)
  cleaned = cleaned.replace(/<(p|div)(?:\s+[^>]*)?>/gi, "");
  cleaned = cleaned.replace(/<\/(p|div)>/gi, "<br>");

  // Normalize all whitespace around <br> tags
  // This handles cases like: text<br>   <br>text or text<br>\n<br>text
  cleaned = cleaned.replace(/\s*<br\s*\/?>\s*/gi, "<br>");

  // Collapse multiple consecutive <br> tags (now that whitespace is normalized)
  cleaned = cleaned.replace(/(<br>){2,}/gi, "<br>");

  // Collapse multiple newlines into single ones
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
 * Supports both new (avatarUrl) and legacy (lumia_img) field names
 * @returns {string|null} Avatar image URL or null
 */
export function getLumiaAvatarImg() {
  const settings = getSettings();
  if (settings.selectedDefinition) {
    const item = getItemFromLibrary(
      settings.selectedDefinition.packName,
      settings.selectedDefinition.itemName,
    );
    // Support both new (avatarUrl) and legacy (lumia_img) field names
    const avatarUrl = item?.avatarUrl || item?.lumia_img;
    if (avatarUrl) {
      return avatarUrl;
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
 * Decode HTML entities in a string
 * Handles common entities that might appear in raw message content
 * @param {string} text - Text that may contain HTML entities
 * @returns {string} Decoded text
 */
function decodeHtmlEntities(text) {
  if (!text) return "";
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Extract name attribute from a tag's attribute string
 * Handles various quote styles and HTML-encoded quotes
 * @param {string} attrString - The attributes portion of the opening tag
 * @returns {string|null} The extracted name or null
 */
function extractNameFromAttributes(attrString) {
  if (!attrString) return null;

  // Try various patterns for name attribute
  // Pattern 1: name="value" (double quotes)
  let nameMatch = attrString.match(/name\s*=\s*"([^"]*)"/i);
  if (nameMatch) return decodeHtmlEntities(nameMatch[1]);

  // Pattern 2: name='value' (single quotes)
  nameMatch = attrString.match(/name\s*=\s*'([^']*)'/i);
  if (nameMatch) return decodeHtmlEntities(nameMatch[1]);

  // Pattern 3: name=&quot;value&quot; (HTML-encoded quotes)
  nameMatch = attrString.match(/name\s*=\s*&quot;([^&]*)&quot;/i);
  if (nameMatch) return decodeHtmlEntities(nameMatch[1]);

  // Pattern 4: name=value (unquoted, single word)
  nameMatch = attrString.match(/name\s*=\s*(\w+)/i);
  if (nameMatch) return decodeHtmlEntities(nameMatch[1]);

  return null;
}

/**
 * Extract OOC comments from raw message text using <lumia_ooc> or <lumiaooc> tags
 * Supports both normal and council mode formats
 *
 * ROBUST TWO-STAGE PARSING:
 * Stage 1: Find all opening/closing tag pairs using a flexible regex
 * Stage 2: Extract name attribute from opening tag separately
 *
 * This approach is resilient to:
 * - HTML-encoded quotes (&quot;)
 * - Single vs double quotes
 * - Extra whitespace in attributes
 * - Missing name attribute
 *
 * @param {string} rawText - The raw message text
 * @returns {Array<{name: string|null, content: string, fullMatch: string}>} Array of OOC matches
 */
function extractOOCFromRawMessage(rawText) {
  if (!rawText) return [];

  const matches = [];

  // Stage 1: Find all tag pairs with a flexible regex
  // Group 1: Tag variant (lumia_ooc, lumiaooc, lumio_ooc, lumioooc)
  // Group 2: All attributes (will parse name from this separately)
  // Group 3: Content between tags
  // Uses backreference \1 to ensure closing tag matches opening tag
  const tagRegex = /<(lumi[ao]_?ooc)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = tagRegex.exec(rawText)) !== null) {
    const tagVariant = match[1];
    const attrString = match[2];
    const content = match[3];

    // Stage 2: Extract name from attributes
    const rawName = extractNameFromAttributes(attrString);
    const sanitizedName = sanitizeLumiaName(rawName);

    console.log(`[${MODULE_NAME}] Extracted OOC: tag=${tagVariant}, attrs="${attrString.trim()}", name="${rawName}" → "${sanitizedName}", content length=${content.length}`);

    matches.push({
      name: sanitizedName,
      content: content.trim(),
      fullMatch: match[0],
    });
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

  // Normalize ellipses: convert Unicode ellipsis to three periods
  result = result.replace(/…/g, "...");

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
 * Find and wrap ONLY the exact OOC content in the DOM using Range API
 *
 * SURGICAL MATCHING STRATEGY:
 * 1. Walk through text nodes to find the start of the OOC content
 * 2. Use Range API to select exactly the matching text span
 * 3. Wrap only that range in our OOC box, leaving surrounding content untouched
 *
 * This prevents the bug where a paragraph containing both regular dialogue
 * AND OOC content would have the entire paragraph wrapped.
 *
 * @param {HTMLElement} container - Container element to search within
 * @param {string} searchText - Text to find (will be normalized)
 * @param {string} rawOOCContent - The raw OOC content (may contain HTML) for innerHTML extraction
 * @returns {{wrapperCreated: boolean, innerHTML: string}|null} Result or null if not found
 */
function findAndWrapOOCContent(container, searchText, rawOOCContent) {
  if (!container || !searchText) return null;

  // Normalize search text - collapse whitespace for matching
  const normalizedSearch = searchText.replace(/\s+/g, " ").trim();
  if (!normalizedSearch) return null;

  // Get a substantial prefix for initial matching (more reliable than full text)
  const searchPrefix = normalizedSearch.substring(0, Math.min(40, normalizedSearch.length)).toLowerCase();
  const searchSuffix = normalizedSearch.length > 20
    ? normalizedSearch.substring(normalizedSearch.length - 20).toLowerCase()
    : normalizedSearch.toLowerCase();

  // Walk through all text nodes to find where the OOC content starts
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node;
  let startNode = null;
  let startOffset = 0;
  let endNode = null;
  let endOffset = 0;

  // Accumulate text as we walk to find the match position
  let accumulatedText = "";
  const textNodes = [];
  let lastBlockElement = null;

  while ((node = walker.nextNode())) {
    // Skip nodes inside already-wrapped OOC boxes
    if (node.parentElement?.closest("[data-lumia-ooc]")) {
      continue;
    }

    // Check if we're in a new block element - add space between blocks
    // This ensures "paragraph1.paragraph2" becomes "paragraph1. paragraph2" for matching
    const currentBlock = node.parentElement?.closest("p, div, li, blockquote, h1, h2, h3, h4, h5, h6");
    if (lastBlockElement && currentBlock && currentBlock !== lastBlockElement) {
      // Add a space if accumulated text doesn't end with whitespace
      if (accumulatedText.length > 0 && !/\s$/.test(accumulatedText)) {
        accumulatedText += " ";
      }
    }
    lastBlockElement = currentBlock;

    textNodes.push({
      node: node,
      start: accumulatedText.length,
      text: node.nodeValue || "",
    });
    accumulatedText += node.nodeValue || "";
  }

  // Normalize accumulated text for matching
  // Also normalize ellipses and quotes to match search text normalization
  const normalizedAccumulated = accumulatedText
    .replace(/\s+/g, " ")
    .replace(/…/g, "...")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");
  const normalizedAccumulatedLower = normalizedAccumulated.toLowerCase();

  // Find where the OOC content starts in the accumulated text
  const matchStart = normalizedAccumulatedLower.indexOf(searchPrefix);
  if (matchStart === -1) {
    console.log(`[${MODULE_NAME}] findAndWrapOOCContent: Could not find prefix "${searchPrefix.substring(0, 30)}..." in DOM text`);
    return null;
  }

  // Verify this is the right match by checking the suffix too
  const potentialEnd = matchStart + normalizedSearch.length;
  if (normalizedSearch.length > 40) {
    const actualSuffix = normalizedAccumulatedLower.substring(
      Math.max(matchStart, potentialEnd - 20),
      potentialEnd
    );
    if (!actualSuffix.includes(searchSuffix.substring(0, 10))) {
      console.log(`[${MODULE_NAME}] findAndWrapOOCContent: Suffix mismatch, skipping false positive`);
      return null;
    }
  }

  // Map the match position back to original text (accounting for normalization)
  // IMPORTANT: Must use the SAME normalization as above (whitespace, ellipsis, quotes)
  // Otherwise position mapping will be off when characters change length (e.g., … → ...)
  // Use -1 as sentinel since 0 is a valid position for content at the start
  let originalMatchStart = -1;
  let originalMatchEnd = -1;

  for (let i = 0; i < accumulatedText.length; i++) {
    const normalizedUpToHere = accumulatedText.substring(0, i + 1)
      .replace(/\s+/g, " ")
      .replace(/…/g, "...")
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'");
    if (normalizedUpToHere.length >= matchStart + 1 && originalMatchStart === -1) {
      originalMatchStart = i;
    }
    if (normalizedUpToHere.length >= potentialEnd) {
      originalMatchEnd = i + 1;
      break;
    }
  }
  // Handle edge cases
  if (originalMatchStart === -1) originalMatchStart = 0;
  if (originalMatchEnd === -1) originalMatchEnd = accumulatedText.length;

  // Find which text nodes contain our match
  for (const tn of textNodes) {
    const tnEnd = tn.start + tn.text.length;

    // Check if this node contains the start
    if (!startNode && tn.start <= originalMatchStart && tnEnd > originalMatchStart) {
      startNode = tn.node;
      startOffset = originalMatchStart - tn.start;
    }

    // Check if this node contains the end
    if (tn.start < originalMatchEnd && tnEnd >= originalMatchEnd) {
      endNode = tn.node;
      endOffset = originalMatchEnd - tn.start;
      break;
    }
  }

  if (!startNode || !endNode) {
    console.log(`[${MODULE_NAME}] findAndWrapOOCContent: Could not map match to text nodes`);
    return null;
  }

  // Create a Range to select exactly the OOC content
  try {
    const range = document.createRange();
    range.setStart(startNode, Math.min(startOffset, startNode.length));
    range.setEnd(endNode, Math.min(endOffset, endNode.length));

    // Extract the HTML content from the range for formatting preservation
    const fragment = range.cloneContents();
    const tempDiv = document.createElement("div");
    tempDiv.appendChild(fragment);
    const innerHTML = tempDiv.innerHTML || range.toString();

    // Delete the range content and return info for replacement
    range.deleteContents();

    console.log(`[${MODULE_NAME}] findAndWrapOOCContent: Successfully isolated OOC content (${innerHTML.length} chars)`);

    return {
      range: range,
      innerHTML: cleanOOCContent(innerHTML) || cleanOOCContent(rawOOCContent),
      wrapperCreated: true,
    };
  } catch (error) {
    console.error(`[${MODULE_NAME}] findAndWrapOOCContent: Range error:`, error);
    return null;
  }
}

/**
 * Legacy: Find text in a container and return the matching element
 * Used as fallback when surgical Range-based matching fails
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

  // Use longer prefix for matching
  const matchPrefix = normalizedSearch.substring(0, Math.min(50, normalizedSearch.length));

  // Check all <p> tags - ST wraps content in paragraphs
  const paragraphs = queryAll("p", container);

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const p = paragraphs[pIdx];

    // Skip paragraphs already inside a wrapped OOC box
    if (p.closest("[data-lumia-ooc]")) {
      continue;
    }

    // Normalize DOM text - apply same normalization as search text
    const pText = stripMarkdownFormatting(
      (p.textContent || "")
        .replace(/\s+/g, " ")
        .replace(/…/g, "...")
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        .trim()
    );
    const pTextLower = pText.toLowerCase();

    // Check if this paragraph contains our search prefix
    if (!pTextLower.includes(matchPrefix)) {
      continue;
    }

    // CRITICAL: Only match if paragraph content is PRIMARILY the OOC content
    // If OOC is less than 70% of paragraph, skip (there's other content mixed in)
    const oocRatio = normalizedSearch.length / pTextLower.length;
    if (oocRatio < 0.7) {
      console.log(`[${MODULE_NAME}] findMatchingElement: Skipping paragraph ${pIdx} - OOC is only ${Math.round(oocRatio * 100)}% of content`);
      continue;
    }

    console.log(`[${MODULE_NAME}] findMatchingElement: Matched paragraph ${pIdx} (${Math.round(oocRatio * 100)}% OOC content)`);
    return {
      element: p,
      innerHTML: p.innerHTML,
    };
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

  // Sanitize the input name to handle "Lumia Serena" → "Serena" variations
  const sanitizedName = sanitizeLumiaName(lumiaName);
  if (!sanitizedName) return null;

  const settings = getSettings();
  let bestMatch = { score: 0, avatar: null };

  /**
   * Helper to update best match if this candidate scores higher
   * Supports both new (avatarUrl) and legacy (lumia_img) field names
   */
  const checkCandidate = (item, nameToCheck) => {
    // Support both new (avatarUrl) and legacy (lumia_img) field names
    const avatarUrl = item?.avatarUrl || item?.lumia_img;
    if (!avatarUrl) return;
    const score = getNameMatchScore(sanitizedName, nameToCheck);
    if (score > bestMatch.score) {
      bestMatch = { score, avatar: avatarUrl };
    }
  };

  // In council mode, check council members (highest priority)
  if (settings.councilMode && settings.councilMembers?.length) {
    for (const member of settings.councilMembers) {
      const item = getItemFromLibrary(member.packName, member.itemName);
      if (!item) continue;

      // Check against both new (lumiaName) and legacy (lumiaDefName) field names
      const itemName = item.lumiaName || item.lumiaDefName || member.itemName;
      checkCandidate(item, itemName);
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
      // Check against both new (lumiaName) and legacy (lumiaDefName) field names
      const itemName = item.lumiaName || item.lumiaDefName || settings.selectedDefinition.itemName;
      checkCandidate(item, itemName);
      checkCandidate(item, settings.selectedDefinition.itemName);

      if (bestMatch.score === 100) return bestMatch.avatar;
    }
  }

  // Check chimera mode definitions
  if (settings.chimeraMode && settings.selectedDefinitions?.length) {
    for (const sel of settings.selectedDefinitions) {
      const item = getItemFromLibrary(sel.packName, sel.itemName);
      if (!item) continue;

      // Check against both new (lumiaName) and legacy (lumiaDefName) field names
      const itemName = item.lumiaName || item.lumiaDefName || sel.itemName;
      checkCandidate(item, itemName);
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
  // Supports both new (lumiaItems) and legacy (items) arrays
  if (settings.packs) {
    for (const pack of Object.values(settings.packs)) {
      // New format: lumiaItems array
      if (pack.lumiaItems && pack.lumiaItems.length > 0) {
        for (const item of pack.lumiaItems) {
          const itemName = item.lumiaName || item.lumiaDefName || "";
          checkCandidate(item, itemName);
          if (bestMatch.score === 100) return bestMatch.avatar;
        }
      }
      // Legacy format: items array
      else if (pack.items) {
        for (const item of pack.items) {
          const itemName = item.lumiaDefName || item.lumiaName || "";
          checkCandidate(item, itemName);
          if (bestMatch.score === 100) return bestMatch.avatar;
        }
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
 * Clean up DOM structure surrounding an OOC comment box after insertion
 *
 * When the Range API extracts and replaces content, it can leave behind:
 * 1. Legacy <font color="#9370DB"> wrappers from old OOC format
 * 2. Empty <p>, <div> elements that had their content removed
 * 3. Stray <br> tags that were between content sections
 *
 * This function cleans all of these to ensure proper rendering.
 *
 * @param {HTMLElement} commentBox - The OOC comment box that was just inserted
 */
function cleanupOOCBoxSurroundings(commentBox) {
  if (!commentBox) return;

  let currentElement = commentBox;
  let parent = currentElement.parentElement;

  // Walk up the tree, unwrapping legacy font tags and cleaning empty wrappers
  while (parent && !parent.classList?.contains("mes_text")) {
    const nextParent = parent.parentElement;

    // Check if parent is a legacy Lumia OOC font tag
    if (parent.tagName === "FONT") {
      const color = parent.getAttribute("color")?.toLowerCase();
      if (color === LUMIA_OOC_COLOR_LOWER || color === "rgb(147, 112, 219)") {
        // This is a legacy OOC font wrapper - unwrap it
        // First, remove any sibling <br> tags inside the font
        const siblings = Array.from(parent.childNodes);
        siblings.forEach((sibling) => {
          if (sibling === currentElement) return;
          if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === "BR") {
            sibling.remove();
          } else if (sibling.nodeType === Node.TEXT_NODE && !sibling.textContent?.trim()) {
            sibling.remove();
          }
        });

        // Now unwrap: move our box out, then remove the empty font tag
        if (parent.parentNode) {
          parent.parentNode.insertBefore(currentElement, parent);
          // If font tag is now empty or only has whitespace, remove it
          if (!parent.textContent?.trim() && !parent.querySelector("[data-lumia-ooc]")) {
            parent.remove();
          }
        }
        // Update current element reference for next iteration
        parent = nextParent;
        continue;
      }
    }

    // Check if parent is an empty <p> or <div> that should be unwrapped
    if (parent.matches?.("p, div")) {
      // Check if parent only contains our box (and possibly whitespace/br)
      const meaningfulChildren = Array.from(parent.childNodes).filter((child) => {
        if (child === currentElement) return true;
        if (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) return false;
        if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "BR") return false;
        return true;
      });

      if (meaningfulChildren.length === 1 && meaningfulChildren[0] === currentElement) {
        // Parent only contains our box - unwrap it
        if (parent.parentNode) {
          parent.parentNode.insertBefore(currentElement, parent);
          parent.remove();
        }
        parent = nextParent;
        continue;
      }
    }

    // Move to next parent
    currentElement = parent;
    parent = nextParent;
  }

  // Clean up siblings at the final position
  parent = commentBox.parentElement;
  if (parent) {
    // Remove adjacent <br> tags and empty elements
    const removeIfEmpty = (element) => {
      if (!element || element === commentBox) return;
      if (element.nodeType === Node.ELEMENT_NODE) {
        if (element.tagName === "BR") {
          element.remove();
        } else if (element.matches?.("p, div, font") &&
                   !element.textContent?.trim() &&
                   !element.querySelector("img, [data-lumia-ooc]")) {
          element.remove();
        }
      }
    };

    // Check previous and next siblings
    removeIfEmpty(commentBox.previousElementSibling);
    removeIfEmpty(commentBox.nextElementSibling);

    // Also check for text nodes that are just whitespace with <br>
    const prevSibling = commentBox.previousSibling;
    const nextSibling = commentBox.nextSibling;
    if (prevSibling?.nodeType === Node.TEXT_NODE && !prevSibling.textContent?.trim()) {
      prevSibling.remove();
    }
    if (nextSibling?.nodeType === Node.TEXT_NODE && !nextSibling.textContent?.trim()) {
      nextSibling.remove();
    }
  }
}

/**
 * Internal: Perform the actual DOM updates for OOC comments in a message
 * Called by the RAF batch renderer - does not handle scroll preservation
 *
 * TAG-ONLY APPROACH:
 * 1. Parse raw message content for <lumia_ooc> tags (ST strips custom tags from DOM)
 * 2. Use Range API to surgically locate and wrap text content in the rendered DOM
 * 3. Replace matched text with styled OOC comment box
 *
 * NOTE: Legacy font-based detection has been removed. Only <lumiaooc>/<lumia_ooc> tags
 * are processed. Any font tags inside OOC content are stripped during cleaning.
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

    // Extract OOC matches from raw content - ONLY tag-based detection
    const oocMatches = extractOOCFromRawMessage(rawContent);
    const existingBoxes = queryAll("[data-lumia-ooc]", messageElement);

    // Skip if we've already wrapped all expected OOCs
    if (existingBoxes.length > 0 && existingBoxes.length >= oocMatches.length && !force) {
      return; // All OOCs already processed
    }

    let processedCount = 0;

    // Process <lumia_ooc> tags found in raw content
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

        // Get avatar: look up by name if provided, fallback to default Lumia avatar
        // Uses fuzzy matching to handle name variations (e.g., "Lumia Serena" → "Serena")
        const avatarImg = ooc.name
          ? (getLumiaAvatarByName(ooc.name) || getLumiaAvatarImg())
          : getLumiaAvatarImg();

        // TRY 1: Use surgical Range-based wrapping to isolate ONLY the OOC content
        // This prevents grabbing surrounding non-OOC text in the same paragraph
        const surgicalMatch = findAndWrapOOCContent(messageElement, plainText, ooc.content);

        if (surgicalMatch && surgicalMatch.wrapperCreated) {
          // Create styled box and insert at the range position
          const commentBox = createOOCCommentBox(surgicalMatch.innerHTML, avatarImg, processedCount, ooc.name);
          surgicalMatch.range.insertNode(commentBox);

          // Clean up surrounding DOM structure left behind after content extraction
          // This handles: empty elements, legacy font tags, stray <br> tags
          cleanupOOCBoxSurroundings(commentBox);

          markTextProcessed(mesId, plainText);
          processedCount++;
          console.log(
            `[${MODULE_NAME}] Replaced OOC #${index + 1} with styled box (surgical Range method)`,
          );
          return;
        }

        // TRY 2: Fallback to element replacement if surgical method fails
        // Only matches paragraphs that are >70% OOC content
        const match = findMatchingElement(messageElement, plainText);

        if (!match) {
          console.log(
            `[${MODULE_NAME}] Could not find OOC #${index + 1} text in DOM (tried surgical and element methods)`,
          );
          return;
        }

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
            `[${MODULE_NAME}] Replaced OOC #${index + 1} with styled box (element fallback method)`,
          );
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
 * Uses RAF batching for optimal timing with proper DOM sync verification
 *
 * CRITICAL: When CHAT_CHANGED fires, the old chat's DOM may still be present.
 * We must wait for SillyTavern to finish replacing the DOM before processing.
 * Strategy:
 * 1. Add initial delay to let ST start the DOM transition
 * 2. Wait until DOM message count matches context chat length
 * 3. Only then process OOC comments
 */
export function scheduleOOCProcessingAfterRender() {
  // Clear any pending timers
  if (oocProcessingTimer) clearTimeout(oocProcessingTimer);
  if (oocRenderWaitTimer) clearTimeout(oocRenderWaitTimer);

  // Clear all processed text tracking on chat change - fresh start for new chat
  clearAllProcessedTexts();

  const maxWaitTime = 2000; // Allow time for complex chats to render
  const checkInterval = 50; // Check every 50ms for DOM stability
  const initialDelay = 100; // Wait 100ms for ST to start DOM transition

  function checkAndProcess() {
    const startTime = Date.now();

    function doCheck() {
      const chatElement = document.getElementById("chat");
      const context = getContext();

      const contextMessageCount = context?.chat?.length || 0;
      const messageElements = chatElement
        ? queryAll(".mes_text", chatElement)
        : [];
      const domMessageCount = messageElements.length;

      // Timeout check
      if (Date.now() - startTime > maxWaitTime) {
        console.log(
          `[${MODULE_NAME}] Max wait time reached (context: ${contextMessageCount}, DOM: ${domMessageCount}), processing OOCs now`,
        );
        processAllLumiaOOCComments();
        return;
      }

      // Empty chat case - process immediately (nothing to do)
      if (contextMessageCount === 0) {
        console.log(`[${MODULE_NAME}] Empty chat detected, no OOC processing needed`);
        return;
      }

      // DOM not ready yet - keep waiting
      if (domMessageCount === 0) {
        oocRenderWaitTimer = setTimeout(doCheck, checkInterval);
        return;
      }

      // DOM has messages - verify it matches context count (allows for some mismatch from system messages)
      // Consider DOM ready if it has at least 80% of expected messages or exact match
      const readyThreshold = Math.max(1, Math.floor(contextMessageCount * 0.8));
      if (domMessageCount >= readyThreshold) {
        // Additional check: verify the last message element exists and has content
        const lastMesId = contextMessageCount - 1;
        const lastMessageElement = query(`div[mesid="${lastMesId}"] .mes_text`);

        if (lastMessageElement && lastMessageElement.textContent?.trim()) {
          console.log(
            `[${MODULE_NAME}] DOM ready with ${domMessageCount}/${contextMessageCount} messages, scheduling OOC processing`,
          );
          processAllLumiaOOCComments();
          return;
        }
      }

      // Not ready yet, keep checking
      oocRenderWaitTimer = setTimeout(doCheck, checkInterval);
    }

    doCheck();
  }

  // Add initial delay to let SillyTavern start the DOM transition
  // This prevents us from seeing stale DOM from the previous chat
  oocProcessingTimer = setTimeout(() => {
    requestAnimationFrame(checkAndProcess);
  }, initialDelay);
}

/**
 * Process OOC comments after streaming completes
 * Legacy font-based hiding has been removed - this now just triggers OOC processing
 * @param {HTMLElement} messageElement - The message element to process
 */
export function unhideAndProcessOOCMarkers(messageElement) {
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

        // NOTE: Legacy font-based OOC detection has been removed.
        // Only <lumiaooc>/<lumia_ooc> tags in raw content trigger OOC processing.

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

          // Check for OOC tags in raw content - ONLY tag-based detection
          const context = getContext();
          const chatMessage = context?.chat?.[mesId];
          const rawContent = chatMessage?.mes || chatMessage?.content || "";

          const hasOOCTags = /<lumi[ao]_?ooc[^>]*>/i.test(rawContent);

          if (hasOOCTags) {
            console.log(
              `[${MODULE_NAME}] Observer: Processing OOC tags in message ${mesId}`,
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

/**
 * Reset RAF scheduler state for fresh processing
 * Call this when switching chats
 */
export { resetRAFState } from "./rafBatchRenderer.js";
