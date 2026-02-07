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
import { generateCouncilHandles } from "./lumiaContent.js";
import { toLeetSpeak, fromLeetSpeak } from "../sthelpers/stringUtils.js";
import {
  setOOCProcessingCallbacks,
  setStreamingState,
  scheduleOOCUpdate,
  scheduleFullReprocess,
  flushPendingUpdates,
  cancelAllPendingUpdates,
  yieldToBrowser,
  OOC_PROCESSING_CHUNK_SIZE,
} from "./rafBatchRenderer.js";

// Lumia OOC color constant - the specific purple color used for Lumia's OOC comments
export const LUMIA_OOC_COLOR = "#9370DB";
export const LUMIA_OOC_COLOR_LOWER = "#9370db";

// Debounce timers for OOC processing
let oocProcessingTimer = null;
let oocRenderWaitTimer = null;

// Flag to track if generation is in progress (prevents observer interference)
let isGenerating = false;

// Guard to prevent concurrent full OOC processing
let isProcessingAllOOC = false;

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

  // Strip invisible Unicode characters that browsers may add to emojis
  result = result.replace(/[\uFE00-\uFE0F]/g, "");  // Variation selectors
  result = result.replace(/\u200D/g, "");          // Zero-width joiners

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
 * Detect and calculate expanded bounds to include OOC tag fragments in the DOM
 *
 * When SillyTavern partially renders or escapes OOC tags, fragments like:
 * - Opening: `<lumiaooc name="...">`, `<lumia_ooc>`, etc.
 * - Closing: `</lumiaooc>`, `</lumia_ooc>`, etc.
 * may appear as literal text in the DOM surrounding the actual OOC content.
 *
 * This function detects these fragments and returns expanded positions that
 * include them, so the Range deletion captures the ENTIRE tag, not just the content.
 *
 * SAFETY: This function only expands when it finds DEFINITE tag patterns.
 * It will NOT expand for ambiguous or partial matches that could be legitimate content.
 *
 * @param {string} accumulatedText - The full accumulated text from DOM walking
 * @param {number} contentStart - Start position of the OOC content match (in original text)
 * @param {number} contentEnd - End position of the OOC content match (in original text)
 * @returns {{expandedStart: number, expandedEnd: number}} Expanded positions including tag fragments
 */
function expandRangeForTagFragments(accumulatedText, contentStart, contentEnd) {
  let expandedStart = contentStart;
  let expandedEnd = contentEnd;

  // Safety: validate inputs
  if (!accumulatedText || contentStart < 0 || contentEnd < 0) {
    return { expandedStart, expandedEnd };
  }

  // PART 1: Look backwards from contentStart for opening tag fragments
  // Pattern: `<lumiaooc...>` or `<lumia_ooc...>` or `<lumioooc...>` or `<lumio_ooc...>`
  // The `>` would be right before our content, so look for `<lumi...>` pattern before that
  if (contentStart > 0) {
    // Get up to 100 chars before content start to search for opening tag
    const lookBehindStart = Math.max(0, contentStart - 100);
    const textBefore = accumulatedText.substring(lookBehindStart, contentStart);

    // Find the last occurrence of an opening OOC tag pattern ending at or near contentStart
    // Match: <lumiaooc...>, <lumia_ooc...>, <lumioooc...>, <lumio_ooc...>
    // CRITICAL FIX: Allow up to 5 characters gap after the opening tag
    // This handles cases where content start position is off by 1-2 chars
    // Group 1: The actual opening tag
    // Group 2: Gap characters (0-5 chars, non-greedy)
    const openTagRegex = /(<lumi[ao]_?ooc(?:\s+[^>]*)?>)(.{0,5}?)$/i;
    const openTagMatch = textBefore.match(openTagRegex);

    if (openTagMatch) {
      // Found opening tag fragment - expand start to include BOTH the tag AND any gap
      // openTagMatch[0] = full match (tag + gap)
      // openTagMatch[1] = the actual opening tag
      // openTagMatch[2] = gap characters (may be empty)
      const fullMatchLength = openTagMatch[0].length;
      const proposedStart = contentStart - fullMatchLength;
      // Safety: ensure we don't go negative
      if (proposedStart >= 0) {
        expandedStart = proposedStart;
        if (openTagMatch[2]) {
          console.log(`[${MODULE_NAME}] expandRangeForTagFragments: Found opening tag "${openTagMatch[1]}" with ${openTagMatch[2].length} gap chars "${openTagMatch[2]}", expanding start by ${fullMatchLength}`);
        } else {
          console.log(`[${MODULE_NAME}] expandRangeForTagFragments: Found opening tag "${openTagMatch[1]}", expanding start by ${fullMatchLength}`);
        }
      }
    }
  }

  // PART 2: Look forwards from contentEnd for closing tag fragments
  // Pattern: `</lumiaooc>` or `</lumia_ooc>` or `</lumioooc>` or `</lumio_ooc>`
  if (contentEnd < accumulatedText.length) {
    // Get up to 30 chars after content end to search for closing tag
    const lookAheadEnd = Math.min(accumulatedText.length, contentEnd + 30);
    const textAfter = accumulatedText.substring(contentEnd, lookAheadEnd);

    // Find closing OOC tag pattern starting at or near contentEnd
    // Match: </lumiaooc>, </lumia_ooc>, </lumioooc>, </lumio_ooc>
    // CRITICAL FIX: Allow up to 5 characters gap before the closing tag
    // This handles cases where content end position is off by 1-2 chars (e.g., "e." left behind)
    // Group 1: Gap characters (0-5 chars, non-greedy)
    // Group 2: The actual closing tag
    const closeTagRegex = /^(.{0,5}?)(<\/lumi[ao]_?ooc\s*>)/i;
    const closeTagMatch = textAfter.match(closeTagRegex);

    if (closeTagMatch) {
      // Found closing tag fragment - expand end to include BOTH the gap AND the tag
      // closeTagMatch[0] = full match (gap + tag)
      // closeTagMatch[1] = gap characters (may be empty)
      // closeTagMatch[2] = the actual closing tag
      const fullMatchLength = closeTagMatch[0].length;
      const proposedEnd = contentEnd + fullMatchLength;
      // Safety: ensure we don't exceed text length
      if (proposedEnd <= accumulatedText.length) {
        expandedEnd = proposedEnd;
        if (closeTagMatch[1]) {
          console.log(`[${MODULE_NAME}] expandRangeForTagFragments: Found closing tag "${closeTagMatch[2]}" with ${closeTagMatch[1].length} gap chars "${closeTagMatch[1]}", expanding end by ${fullMatchLength}`);
        } else {
          console.log(`[${MODULE_NAME}] expandRangeForTagFragments: Found closing tag "${closeTagMatch[2]}", expanding end by ${fullMatchLength}`);
        }
      }
    } else {
      // Also check for PARTIAL closing tag fragments that might be left
      // These are remnants from ST's partial tag rendering
      // IMPORTANT: Be specific - don't match standalone ">" as that's too aggressive
      // Only match patterns that are DEFINITELY closing tag remnants
      const partialCloseRegex = /^(?:lumiaooc>|lumia_ooc>|lumioooc>|lumio_ooc>|miaooc>|mia_ooc>|iaooc>|ia_ooc>|aooc>|a_ooc>|_ooc>|ooc>|oc>|c>)/i;
      const partialMatch = textAfter.match(partialCloseRegex);

      if (partialMatch) {
        const tagLength = partialMatch[0].length;
        const proposedEnd = contentEnd + tagLength;
        // Safety: ensure we don't exceed text length
        if (proposedEnd <= accumulatedText.length) {
          expandedEnd = proposedEnd;
          console.log(`[${MODULE_NAME}] expandRangeForTagFragments: Found PARTIAL closing tag "${partialMatch[0]}", expanding end by ${tagLength}`);
        }
      }
    }
  }

  // Final safety: clamp to valid range
  expandedStart = Math.max(0, expandedStart);
  expandedEnd = Math.min(accumulatedText.length, expandedEnd);

  return { expandedStart, expandedEnd };
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
 * @returns {{wrapperCreated: boolean, innerHTML: string, range?: Range}|null} Result or null if not found
 */
function findAndWrapOOCContent(container, searchText, rawOOCContent) {
  if (!container || !searchText) return null;

  // Normalize search text - collapse whitespace for matching
  // NOTE: We normalize but preserve the original for length calculation
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

  // Track virtual space positions (spaces added between blocks that don't exist in DOM)
  const virtualSpacePositions = new Set();

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
        // Track this as a virtual space position (doesn't exist in actual DOM)
        virtualSpacePositions.add(accumulatedText.length);
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
  // IMPORTANT: Apply same normalizations as stripMarkdownFormatting for consistency
  // Also strip invisible Unicode characters that browsers may add (variation selectors, ZWJ, etc.)
  const normalizedAccumulated = accumulatedText
    .replace(/\s+/g, " ")
    .replace(/…/g, "...")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[\uFE00-\uFE0F]/g, "")  // Strip variation selectors
    .replace(/\u200D/g, "");          // Strip zero-width joiners
  const normalizedAccumulatedLower = normalizedAccumulated.toLowerCase();

  // Find where the OOC content starts in the accumulated text
  const matchStart = normalizedAccumulatedLower.indexOf(searchPrefix);
  if (matchStart === -1) {
    // Prefix not found - this is expected when using DOM-first matching as primary method
    // The surgical method is now a fallback, so silent return is appropriate
    return null;
  }

  // Calculate potential end position
  const potentialEnd = matchStart + normalizedSearch.length;
  
  // Clamp potentialEnd to the actual DOM text length to prevent over-running
  // This handles cases where search text might be slightly longer than DOM text
  const clampedPotentialEnd = Math.min(potentialEnd, normalizedAccumulated.length);

  // Verify this is the right match by checking the suffix too
  if (normalizedSearch.length > 40) {
    const actualSuffix = normalizedAccumulatedLower.substring(
      Math.max(matchStart, clampedPotentialEnd - 20),
      clampedPotentialEnd
    );
    if (!actualSuffix.includes(searchSuffix.substring(0, 10))) {
      // Suffix mismatch - likely a false positive match, skip silently
      // The DOM-first matching approach should handle these cases
      return null;
    }
  }

  // Map the match position back to original text (accounting for normalization)
  // Build a mapping of normalized position -> original position in ONE pass (O(n))
  // This replaces the previous O(n²) approach that created substrings for each character
  // IMPORTANT: Must use the SAME normalization rules (whitespace, ellipsis, quotes)
  const positionMap = []; // positionMap[normalizedPos] = originalPos
  let prevWasWhitespace = false;

  for (let i = 0; i < accumulatedText.length; i++) {
    const char = accumulatedText[i];
    const charCode = char.charCodeAt(0);

    // Apply same normalization rules as the regex-based normalization above
    if (/\s/.test(char)) {
      // Whitespace collapse: only output one space for consecutive whitespace
      if (!prevWasWhitespace) {
        positionMap.push(i);
        prevWasWhitespace = true;
      }
      // Skip additional consecutive whitespace (don't add to map)
    } else if (char === "\u2026") {
      // Ellipsis (…) expands to 3 characters "..."
      positionMap.push(i);
      positionMap.push(i);
      positionMap.push(i);
      prevWasWhitespace = false;
    } else if (char === "\u201C" || char === "\u201D") {
      // Smart double quotes ("") normalize to regular quote (1:1 mapping)
      positionMap.push(i);
      prevWasWhitespace = false;
    } else if (char === "\u2018" || char === "\u2019") {
      // Smart single quotes ('') normalize to regular apostrophe (1:1 mapping)
      positionMap.push(i);
      prevWasWhitespace = false;
    } else if (charCode >= 0xFE00 && charCode <= 0xFE0F) {
      // Variation selectors - skip (they're stripped from normalized text)
      // Don't add to map, don't change prevWasWhitespace
    } else if (char === "\u200D") {
      // Zero-width joiner - skip (stripped from normalized text)
      // Don't add to map, don't change prevWasWhitespace
    } else {
      // Regular character (1:1 mapping)
      positionMap.push(i);
      prevWasWhitespace = false;
    }
  }

  // Map normalized positions back to original positions
  // Handle edge cases where positions may be at or beyond the map bounds
  let originalMatchStart =
    matchStart < positionMap.length ? positionMap[matchStart] : 0;
  
  // For end position, use clamped value and handle edge cases carefully
  // The -1 is because we want the position OF the last character, then +1 for AFTER it
  let originalMatchEnd;
  if (clampedPotentialEnd <= 0) {
    originalMatchEnd = 0;
  } else if (clampedPotentialEnd > positionMap.length) {
    // If beyond the map, use the full accumulated text length
    originalMatchEnd = accumulatedText.length;
  } else {
    // Normal case: get position of last matched character, then add 1 for end
    originalMatchEnd = positionMap[clampedPotentialEnd - 1] + 1;
  }

  // CRITICAL FIX: Expand match range to include any OOC tag fragments
  // When SillyTavern partially renders/escapes OOC tags, fragments like
  // "<lumiaooc...>" or "</lumiaooc>" may appear as literal text in the DOM.
  // If we only delete the content and not the tag fragments, we get orphan
  // characters left behind (the "random 2 characters" bug in IRC mode).
  const { expandedStart, expandedEnd } = expandRangeForTagFragments(
    accumulatedText,
    originalMatchStart,
    originalMatchEnd
  );
  originalMatchStart = expandedStart;
  originalMatchEnd = expandedEnd;

  // Find which text nodes contain our match
  // Also track the last text node that ends before our target end position
  // This is needed to handle virtual spaces between blocks
  let lastNodeBeforeEnd = null;
  
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
    
    // Track the last text node that ends before our target
    // This is our fallback if the end position falls in a virtual space
    if (tnEnd <= originalMatchEnd) {
      lastNodeBeforeEnd = tn;
    }
  }

  // FALLBACK: If endNode is null but we found the start, the match end might be
  // falling in a virtual space between text nodes. Use the last text node before that position.
  if (startNode && !endNode && lastNodeBeforeEnd) {
    console.log(`[${MODULE_NAME}] findAndWrapOOCContent: End position in virtual space, using fallback to last text node`);
    endNode = lastNodeBeforeEnd.node;
    endOffset = lastNodeBeforeEnd.text.length; // End at the end of this node
  }

  if (!startNode || !endNode) {
    console.log(`[${MODULE_NAME}] findAndWrapOOCContent: Could not map match to text nodes (start: ${!!startNode}, end: ${!!endNode})`);
    return null;
  }

  // Create a Range to select exactly the OOC content
  try {
    const range = document.createRange();
    
    // Safely clamp offsets to node lengths (Text nodes have nodeValue.length for character count)
    const startNodeLength = startNode.nodeValue?.length || 0;
    const endNodeLength = endNode.nodeValue?.length || 0;
    const safeStartOffset = Math.max(0, Math.min(startOffset, startNodeLength));
    const safeEndOffset = Math.max(0, Math.min(endOffset, endNodeLength));
    
    // DEBUG: Log detailed match info to help diagnose orphan punctuation issues
    console.log(`[${MODULE_NAME}] findAndWrapOOCContent DEBUG:`, {
      searchTextLength: searchText.length,
      normalizedSearchLength: normalizedSearch.length,
      matchStart,
      potentialEnd,
      clampedPotentialEnd,
      originalMatchStart,
      originalMatchEnd,
      accumulatedTextLength: accumulatedText.length,
      positionMapLength: positionMap.length,
      startNodeText: startNode.nodeValue?.substring(0, 50),
      startOffset: safeStartOffset,
      endNodeText: endNode.nodeValue?.substring(Math.max(0, safeEndOffset - 20)),
      endOffset: safeEndOffset,
      endNodeLength,
    });
    
    range.setStart(startNode, safeStartOffset);
    range.setEnd(endNode, safeEndOffset);

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
 * Normalize text for OOC fingerprint matching
 * Applies consistent normalization for both DOM text and OOC content
 * @param {string} text - Text to normalize
 * @returns {string} Normalized lowercase text
 */
function normalizeForMatching(text) {
  if (!text) return "";
  return stripMarkdownFormatting(
    text
      .replace(/\s+/g, " ")
      .replace(/…/g, "...")
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .trim()
  ).toLowerCase();
}

/**
 * DOM-first OOC matching: Find paragraph elements that contain OOC content
 * This approach iterates through DOM paragraphs and matches them to OOC patterns,
 * rather than searching for OOC patterns in the DOM (which can fail due to mesId mismatches)
 * 
 * @param {HTMLElement} container - The message container (.mes_text)
 * @param {Array<{name: string|null, content: string}>} oocMatches - Extracted OOC matches from raw content
 * @returns {Array<{element: HTMLElement, oocMatch: {name: string|null, content: string}, plainText: string}>}
 */
function findOOCParagraphs(container, oocMatches) {
  if (!container || !oocMatches || oocMatches.length === 0) return [];

  const results = [];
  
  // Pre-compute normalized fingerprints for all OOC matches (first 50 chars for matching)
  const oocFingerprints = oocMatches.map(ooc => {
    const plainText = htmlToPlainText(ooc.content);
    const normalized = normalizeForMatching(plainText);
    const fingerprint = normalized.substring(0, Math.min(50, normalized.length));
    return {
      ooc,
      plainText,
      normalized,
      fingerprint,
      matched: false, // Track which OOCs have been matched
    };
  });

  // Get all paragraph elements in the container
  const paragraphs = queryAll("p", container);
  
  console.log(`[${MODULE_NAME}] findOOCParagraphs: Scanning ${paragraphs.length} paragraphs for ${oocFingerprints.length} OOC patterns`);

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const p = paragraphs[pIdx];
    
    // Skip paragraphs already inside a wrapped OOC box
    if (p.closest("[data-lumia-ooc]")) {
      continue;
    }

    // Normalize paragraph text
    const pText = normalizeForMatching(p.textContent || "");
    if (!pText) continue;

    // Try to match against unmatched OOC fingerprints
    for (let fpIdx = 0; fpIdx < oocFingerprints.length; fpIdx++) {
      const fp = oocFingerprints[fpIdx];
      if (fp.matched) continue; // Already matched to another paragraph
      
      // Check if paragraph starts with or contains the OOC fingerprint
      const hasFingerprint = pText.startsWith(fp.fingerprint) || pText.includes(fp.fingerprint);
      
      if (hasFingerprint) {
        // Calculate overlap ratio - OOC should be at least 50% of paragraph (lowered from 60%)
        const oocRatio = fp.normalized.length / pText.length;
        
        console.log(`[${MODULE_NAME}] findOOCParagraphs: Para ${pIdx} matches OOC ${fpIdx} (${fp.ooc.name || "unnamed"}), ratio=${(oocRatio * 100).toFixed(0)}%`);
        
        if (oocRatio >= 0.5) {
          results.push({
            element: p,
            oocMatch: fp.ooc,
            plainText: fp.plainText,
          });
          fp.matched = true;
          break; // This paragraph matched, move to next paragraph
        } else {
          console.log(`[${MODULE_NAME}] findOOCParagraphs: Skipped - ratio too low (need 50%)`);
        }
      }
    }
  }
  
  // Log unmatched OOCs for debugging
  const unmatchedOOCs = oocFingerprints.filter(fp => !fp.matched);
  if (unmatchedOOCs.length > 0) {
    console.log(`[${MODULE_NAME}] findOOCParagraphs: ${unmatchedOOCs.length} OOCs could not be matched to paragraphs:`,
      unmatchedOOCs.map(fp => ({ name: fp.ooc.name, fingerprint: fp.fingerprint.substring(0, 30) }))
    );
  }

  return results;
}

/**
 * Track which text has been replaced to avoid duplicate replacements
 * Keyed by message ID
 * @type {Map<number, Set<string>>}
 */
const processedOOCTexts = new Map();

/**
 * Create an IRC-style chat room display for council OOC comments
 * Uses inline styles with !important to guarantee layout regardless of external CSS
 * @param {Array<{handle: string, content: string, avatarUrl: string|null}>} oocEntries - Array of OOC entries
 * @returns {HTMLElement} The IRC chat room container element
 */
function createIRCChatRoom(oocEntries) {
  const settings = getSettings();
  const showTimestamps = settings.councilChatStyle?.showTimestamps !== false;

  // Generate a fake timestamp for chat messages (current time)
  const now = new Date();
  const baseMinute = now.getMinutes();

  // Create the channel header
  const header = document.createElement("div");
  header.className = "lumia-irc-header";
  header.textContent = "#LumiaCouncil";
  // Apply styles with !important priority
  const headerStyles = {
    display: "block",
    background: "linear-gradient(180deg, #252540 0%, #1e1e35 100%)",
    color: "#888",
    fontSize: "10px",
    fontWeight: "bold",
    letterSpacing: "0.5px",
    padding: "4px 10px",
    borderBottom: "1px solid #333",
    textTransform: "uppercase",
    fontFamily: "'Courier New', Consolas, monospace",
  };
  Object.entries(headerStyles).forEach(([prop, val]) => {
    header.style.setProperty(prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`), val, "important");
  });

  // Create chat lines for each OOC entry - classic IRC format
  const chatLines = oocEntries.map((entry, index) => {
    // Stagger timestamps by 1 minute each for realism
    const msgMinute = (baseMinute + index) % 60;
    const msgHour = now.getHours() + Math.floor((baseMinute + index) / 60);
    const timestamp = `${String(msgHour % 24).padStart(2, "0")}:${String(msgMinute).padStart(2, "0")}`;

    // Create the line container - NO FLEX, just inline text flow
    const lineDiv = document.createElement("div");
    lineDiv.className = index % 2 === 1 ? "lumia-irc-msg lumia-irc-alt" : "lumia-irc-msg";
    lineDiv.setAttribute("data-lumia-speaker", entry.handle);

    // Apply line styles with !important - use BLOCK display, not flex
    const lineStyles = {
      display: "block",
      padding: "3px 10px",
      lineHeight: "1.5",
      fontSize: "12px",
      fontFamily: "'Courier New', Consolas, monospace",
      background: index % 2 === 1 ? "rgba(147, 112, 219, 0.03)" : "transparent",
      borderBottom: "1px solid rgba(26, 26, 46, 0.5)",
    };
    Object.entries(lineStyles).forEach(([prop, val]) => {
      lineDiv.style.setProperty(prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`), val, "important");
    });

    // Build content as pure inline HTML - everything on one line
    // Format: [HH:MM] <nick> message text here
    const contentHtml = highlightIRCMentions(entry.content);
    let lineHtml = "";

    // Timestamp (inline span)
    if (showTimestamps) {
      lineHtml += `<span style="color:#555 !important;font-size:11px !important;margin-right:6px !important;">[${timestamp}]</span>`;
    }

    // Handle/nick in <nick> format (inline span)
    lineHtml += `<span style="color:#9370DB !important;font-weight:bold !important;margin-right:6px !important;white-space:nowrap !important;">&lt;${entry.handle}&gt;</span>`;

    // Message content (inline span that wraps naturally)
    lineHtml += `<span style="color:#00ff00 !important;word-break:break-word !important;">${contentHtml}</span>`;

    lineDiv.innerHTML = lineHtml;

    return lineDiv;
  });

  // Create the main IRC container
  const container = document.createElement("div");
  container.className = "lumia-irc-container";
  container.setAttribute("data-lumia-ooc", "true");
  container.setAttribute("data-lumia-irc", "true");

  // Apply container styles with !important
  const containerStyles = {
    display: "block",
    position: "relative",
    fontFamily: "'Courier New', Consolas, 'Lucida Console', monospace",
    background: "linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)",
    border: "1px solid #333",
    borderLeft: "3px solid #9370DB",
    borderRadius: "4px",
    margin: "12px 0",
    padding: "0",
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
    width: "100%",
    maxWidth: "100%",
  };
  Object.entries(containerStyles).forEach(([prop, val]) => {
    container.style.setProperty(prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`), val, "important");
  });

  // Append header and chat lines
  container.appendChild(header);
  chatLines.forEach(line => container.appendChild(line));

  return container;
}

/**
 * Clear ALL processed texts (used when style changes require full reprocessing)
 */
function clearAllProcessedTexts() {
  processedOOCTexts.clear();
}

/**
 * Clear processed texts for a specific message (used when message is edited/swiped)
 * @param {number} mesId - Message ID to clear
 */
export function clearProcessedTexts(mesId) {
  processedOOCTexts.delete(mesId);
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
 * Also supports l33t handle lookup for IRC chat style (when enabled)
 * @param {string} lumiaName - The Lumia's name from the OOC tag (can be regular name, l33t handle, or underscore handle)
 * @returns {string|null} Avatar image URL or null
 */
function getLumiaAvatarByName(lumiaName) {
  if (!lumiaName) return null;

  const settings = getSettings();

  // If IRC chat style is enabled, try to resolve handle to original name
  if (settings.councilChatStyle?.enabled && settings.councilMode && settings.councilMembers?.length) {
    // Build list of council member names for reverse lookup
    const memberNames = settings.councilMembers.map((member) => {
      const item = getItemFromLibrary(member.packName, member.itemName);
      return item?.lumiaName || item?.lumiaDefName || member.itemName || "Unknown";
    });

    const useLeet = settings.councilChatStyle?.useLeetHandles !== false;
    
    if (useLeet) {
      // Try to find original name from l33t handle
      const originalName = fromLeetSpeak(lumiaName, memberNames);
      if (originalName) {
        // Found a match - use the original name for avatar lookup
        return getLumiaAvatarByOriginalName(originalName);
      }
    } else {
      // Non-leet mode: handle is just name with underscores for spaces
      // Try to find matching name by replacing underscores back to spaces
      const nameWithSpaces = lumiaName.replace(/_/g, " ");
      for (const name of memberNames) {
        if (name.toLowerCase() === nameWithSpaces.toLowerCase() ||
            name.replace(/\s+/g, "_").toLowerCase() === lumiaName.toLowerCase()) {
          return getLumiaAvatarByOriginalName(name);
        }
      }
    }
  }

  // Sanitize the input name to handle "Lumia Serena" → "Serena" variations
  const sanitizedName = sanitizeLumiaName(lumiaName);
  if (!sanitizedName) return null;

  return getLumiaAvatarByOriginalName(sanitizedName);
}

/**
 * Internal: Get avatar by original (non-l33t) name
 * @param {string} name - The original Lumia name
 * @returns {string|null} Avatar image URL or null
 */
function getLumiaAvatarByOriginalName(name) {
  if (!name) return null;

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
    const score = getNameMatchScore(name, nameToCheck);
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
  const settings = getSettings();
  const isCouncil = settings.councilMode && settings.councilMembers?.length > 0;

  const displayName = memberName || "Lumia";
  // Only show "speaks from the Council" if actually in council mode
  const threadText = isCouncil ? "speaks from the Council" : "weaving through the Loom";
  const placeholderLetter = (memberName || "Lumia").charAt(0).toUpperCase();

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
  const placeholderLetter = (memberName || "Lumia").charAt(0).toUpperCase();

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
  const placeholderLetter = (memberName || "Lumia").charAt(0).toUpperCase();

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
 * Highlight @mentions in IRC message content
 * Wraps @Handle patterns in a styled span
 * @param {string} content - The message content
 * @returns {string} Content with highlighted mentions
 */
function highlightIRCMentions(content) {
  if (!content) return "";
  // Match @Handle patterns (alphanumeric, underscore, numbers from l33t)
  return content.replace(/@([A-Za-z0-9_]+)/g, '<span class="lumia-irc-mention">@$1</span>');
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
 * Clean up DOM artifacts after OOC content extraction
 * Handles empty elements, orphaned <br> tags, and orphaned punctuation
 * 
 * @param {Range} range - The Range where content was deleted
 */
function cleanupRangeSurroundings(range) {
  if (!range) return;

  try {
    // Get the container node where the range is positioned
    const container = range.commonAncestorContainer;
    if (!container) return;

    // Get the parent element (if container is a text node, get its parent)
    const parent = container.nodeType === Node.TEXT_NODE 
      ? container.parentElement 
      : container;
    
    if (!parent) return;

    // Regex to identify "orphan" text nodes - only punctuation, symbols, or whitespace
    // These are likely leftover artifacts from imperfect OOC matching
    const orphanPunctuationRegex = /^[\s\p{P}\p{S}]*$/u;

    // Clean up adjacent <br> tags, empty elements, and orphan punctuation
    const cleanSiblings = (node) => {
      if (!node) return;
      
      // Check previous siblings
      let prev = node.previousSibling;
      while (prev) {
        const toCheck = prev;
        prev = prev.previousSibling;
        
        if (toCheck.nodeType === Node.ELEMENT_NODE && toCheck.tagName === "BR") {
          toCheck.remove();
        } else if (toCheck.nodeType === Node.TEXT_NODE && !toCheck.textContent?.trim()) {
          // Empty or whitespace-only text node
          toCheck.remove();
        } else if (toCheck.nodeType === Node.TEXT_NODE && 
                   orphanPunctuationRegex.test(toCheck.textContent)) {
          // Orphan punctuation-only text node (like "!!" or "..." left behind)
          console.log(`[${MODULE_NAME}] cleanupRangeSurroundings: Removing orphan punctuation: "${toCheck.textContent}"`);
          toCheck.remove();
        } else if (toCheck.nodeType === Node.ELEMENT_NODE && 
                   toCheck.matches?.("p, div, font") && 
                   !toCheck.textContent?.trim() &&
                   !toCheck.querySelector?.("img, [data-lumia-ooc]")) {
          toCheck.remove();
        } else {
          break; // Stop when we hit actual content
        }
      }

      // Check next siblings
      let next = node.nextSibling;
      while (next) {
        const toCheck = next;
        next = next.nextSibling;
        
        if (toCheck.nodeType === Node.ELEMENT_NODE && toCheck.tagName === "BR") {
          toCheck.remove();
        } else if (toCheck.nodeType === Node.TEXT_NODE && !toCheck.textContent?.trim()) {
          // Empty or whitespace-only text node
          toCheck.remove();
        } else if (toCheck.nodeType === Node.TEXT_NODE && 
                   orphanPunctuationRegex.test(toCheck.textContent)) {
          // Orphan punctuation-only text node (like "!!" or "..." left behind)
          console.log(`[${MODULE_NAME}] cleanupRangeSurroundings: Removing orphan punctuation: "${toCheck.textContent}"`);
          toCheck.remove();
        } else if (toCheck.nodeType === Node.ELEMENT_NODE && 
                   toCheck.matches?.("p, div, font") && 
                   !toCheck.textContent?.trim() &&
                   !toCheck.querySelector?.("img, [data-lumia-ooc]")) {
          toCheck.remove();
        } else {
          break; // Stop when we hit actual content
        }
      }
    };

    // Clean siblings around the range position
    if (container.nodeType === Node.TEXT_NODE) {
      cleanSiblings(container);
    } else {
      // If range is inside an element, check children at range position
      const childNodes = Array.from(parent.childNodes);
      childNodes.forEach((child, idx) => {
        if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "BR") {
          // Check if this BR is isolated (no text content before/after within parent)
          const prevHasContent = childNodes.slice(0, idx).some(n => n.textContent?.trim());
          const nextHasContent = childNodes.slice(idx + 1).some(n => n.textContent?.trim());
          if (!prevHasContent || !nextHasContent) {
            child.remove();
          }
        }
      });
    }

    // Also check if parent is now empty and should be cleaned
    if (parent.matches?.("p, div") && !parent.textContent?.trim() && 
        !parent.querySelector?.("img, [data-lumia-ooc]")) {
      parent.remove();
    }
  } catch (err) {
    console.warn(`[${MODULE_NAME}] cleanupRangeSurroundings: Error during cleanup:`, err);
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
 * IRC MODE (Council Chat Style):
 * When councilChatStyle.enabled is true and in council mode, all OOC comments
 * are batched into a single IRC chatroom-style container.
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

    // Check if IRC chat style mode should be used
    const settings = getSettings();
    const useIRCMode = settings.councilChatStyle?.enabled &&
                       settings.councilMode &&
                       settings.councilMembers?.length > 0 &&
                       oocMatches.length > 0;

    if (useIRCMode) {
      // IRC MODE: Batch all OOC comments into a single chatroom container
      performIRCOOCProcessing(mesId, messageElement, oocMatches);
      return;
    }

    // STANDARD MODE: Process OOC comments individually
    let processedCount = 0;

    // Process <lumia_ooc> tags found in raw content
    if (oocMatches.length > 0) {
      console.log(
        `[${MODULE_NAME}] Found ${oocMatches.length} <lumia_ooc> tag(s) in raw content for message ${mesId}`,
      );

      // DOM-FIRST MATCHING: Scan DOM paragraphs and match to OOC patterns
      // This is more robust than searching for OOC content in DOM, as it avoids
      // mesId/array index mismatches that can occur in SillyTavern
      const matchedParagraphs = findOOCParagraphs(messageElement, oocMatches);
      
      console.log(
        `[${MODULE_NAME}] DOM-first matching found ${matchedParagraphs.length} paragraph(s) matching OOC patterns`,
      );

      for (const { element, oocMatch, plainText } of matchedParagraphs) {
        // Check if this text was already processed
        if (isTextProcessed(mesId, plainText)) {
          console.log(
            `[${MODULE_NAME}] Skipping OOC (${oocMatch.name || "unnamed"}): already processed`,
          );
          continue;
        }

        console.log(
          `[${MODULE_NAME}] Processing OOC${oocMatch.name ? ` (${oocMatch.name})` : ""}: "${plainText.substring(0, 60)}..."`,
        );

        // Get avatar: look up by name if provided, fallback to default Lumia avatar
        const avatarImg = oocMatch.name
          ? (getLumiaAvatarByName(oocMatch.name) || getLumiaAvatarImg())
          : getLumiaAvatarImg();

        // Use the DOM's innerHTML (preserves ST's formatting like <em>, <strong>, etc.)
        const formattedContent = cleanOOCContent(element.innerHTML);
        if (!formattedContent) continue;

        // Create styled box with member name and formatted content
        const commentBox = createOOCCommentBox(formattedContent, avatarImg, processedCount, oocMatch.name);

        // Replace the matched paragraph element with our styled box
        if (element.parentNode) {
          element.parentNode.replaceChild(commentBox, element);
          markTextProcessed(mesId, plainText);
          processedCount++;
          console.log(
            `[${MODULE_NAME}] Replaced OOC with styled box (DOM-first method)`,
          );
        }
      }

      // FALLBACK: If DOM-first matching found nothing, try the legacy surgical method
      // This handles edge cases where OOC content is not in a clean <p> element
      if (matchedParagraphs.length === 0) {
        console.log(
          `[${MODULE_NAME}] DOM-first matching found no matches, falling back to surgical method`,
        );
        
        oocMatches.forEach((ooc, index) => {
          const plainText = htmlToPlainText(ooc.content);
          if (!plainText) return;
          if (isTextProcessed(mesId, plainText)) return;

          const avatarImg = ooc.name
            ? (getLumiaAvatarByName(ooc.name) || getLumiaAvatarImg())
            : getLumiaAvatarImg();

          // Try surgical Range-based wrapping
          const surgicalMatch = findAndWrapOOCContent(messageElement, plainText, ooc.content);

          if (surgicalMatch && surgicalMatch.wrapperCreated) {
            const commentBox = createOOCCommentBox(surgicalMatch.innerHTML, avatarImg, processedCount, ooc.name);
            surgicalMatch.range.insertNode(commentBox);
            cleanupOOCBoxSurroundings(commentBox);
            markTextProcessed(mesId, plainText);
            processedCount++;
            console.log(
              `[${MODULE_NAME}] Replaced OOC #${index + 1} with styled box (surgical fallback)`,
            );
            return;
          }

          // Try element replacement fallback
          const match = findMatchingElement(messageElement, plainText);
          if (match && match.element.parentNode) {
            const formattedContent = cleanOOCContent(match.innerHTML);
            if (!formattedContent) return;
            const commentBox = createOOCCommentBox(formattedContent, avatarImg, processedCount, ooc.name);
            match.element.parentNode.replaceChild(commentBox, match.element);
            markTextProcessed(mesId, plainText);
            processedCount++;
            console.log(
              `[${MODULE_NAME}] Replaced OOC #${index + 1} with styled box (element fallback)`,
            );
          }
        });
      }
    }

    if (processedCount > 0) {
      // Styles are applied automatically on next paint via RAF batching
      // Removed forced reflow (offsetHeight) as it's a synchronous blocking operation
      console.log(
        `[${MODULE_NAME}] Finished processing ${processedCount} OOC comment(s) in message ${mesId}`,
      );
    }
  } catch (error) {
    console.error(`[${MODULE_NAME}] Error processing OOC comments:`, error);
  }
}

/**
 * Find OOC content in DOM and return info for removal without modifying DOM
 * Used for IRC mode to collect all locations first before any modifications
 * @param {HTMLElement} container - Container element to search within
 * @param {string} searchText - Text to find (will be normalized)
 * @returns {{startNode: Node, startOffset: number, endNode: Node, endOffset: number}|null}
 */
function findOOCContentLocation(container, searchText) {
  if (!container || !searchText) return null;

  // Normalize search text - collapse whitespace for matching
  const normalizedSearch = searchText.replace(/\s+/g, " ").trim();
  if (!normalizedSearch) return null;

  // Get a substantial prefix for initial matching
  const searchPrefix = normalizedSearch.substring(0, Math.min(40, normalizedSearch.length)).toLowerCase();

  // Walk through all text nodes to find where the OOC content starts
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node;
  let accumulatedText = "";
  const textNodes = [];
  let lastBlockElement = null;

  while ((node = walker.nextNode())) {
    // Skip nodes inside already-wrapped OOC boxes
    if (node.parentElement?.closest("[data-lumia-ooc]")) {
      continue;
    }

    const currentBlock = node.parentElement?.closest("p, div, li, blockquote, h1, h2, h3, h4, h5, h6");
    if (lastBlockElement && currentBlock && currentBlock !== lastBlockElement) {
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
  const normalizedAccumulated = accumulatedText
    .replace(/\s+/g, " ")
    .replace(/…/g, "...")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");
  const normalizedAccumulatedLower = normalizedAccumulated.toLowerCase();

  // Find where the OOC content starts
  const matchStart = normalizedAccumulatedLower.indexOf(searchPrefix);
  if (matchStart === -1) {
    return null;
  }

  // Calculate potential end position, clamped to actual DOM text length
  const potentialEnd = matchStart + normalizedSearch.length;
  const clampedPotentialEnd = Math.min(potentialEnd, normalizedAccumulated.length);

  // Build position map
  const positionMap = [];
  let prevWasWhitespace = false;

  for (let i = 0; i < accumulatedText.length; i++) {
    const char = accumulatedText[i];
    if (/\s/.test(char)) {
      if (!prevWasWhitespace) {
        positionMap.push(i);
        prevWasWhitespace = true;
      }
    } else if (char === "\u2026") {
      positionMap.push(i);
      positionMap.push(i);
      positionMap.push(i);
      prevWasWhitespace = false;
    } else if (char === "\u201C" || char === "\u201D" || char === "\u2018" || char === "\u2019") {
      positionMap.push(i);
      prevWasWhitespace = false;
    } else {
      positionMap.push(i);
      prevWasWhitespace = false;
    }
  }

  let originalMatchStart = matchStart < positionMap.length ? positionMap[matchStart] : 0;
  
  // For end position, use clamped value and handle edge cases
  let originalMatchEnd;
  if (clampedPotentialEnd <= 0) {
    originalMatchEnd = 0;
  } else if (clampedPotentialEnd > positionMap.length) {
    originalMatchEnd = accumulatedText.length;
  } else {
    originalMatchEnd = positionMap[clampedPotentialEnd - 1] + 1;
  }

  // CRITICAL FIX: Expand match range to include any OOC tag fragments
  // When SillyTavern partially renders/escapes OOC tags, fragments like
  // "<lumiaooc...>" or "</lumiaooc>" may appear as literal text in the DOM.
  // If we only delete the content and not the tag fragments, we get orphan
  // characters left behind (the "random 2 characters" bug in IRC mode).
  const { expandedStart, expandedEnd } = expandRangeForTagFragments(
    accumulatedText,
    originalMatchStart,
    originalMatchEnd
  );
  originalMatchStart = expandedStart;
  originalMatchEnd = expandedEnd;

  // Find which text nodes contain our match
  let startNode = null;
  let startOffset = 0;
  let endNode = null;
  let endOffset = 0;
  let lastNodeBeforeEnd = null;

  for (const tn of textNodes) {
    const tnEnd = tn.start + tn.text.length;

    if (!startNode && tn.start <= originalMatchStart && tnEnd > originalMatchStart) {
      startNode = tn.node;
      startOffset = originalMatchStart - tn.start;
    }

    if (tn.start < originalMatchEnd && tnEnd >= originalMatchEnd) {
      endNode = tn.node;
      endOffset = originalMatchEnd - tn.start;
      break;
    }
    
    // Track last node before end position for fallback
    if (tnEnd <= originalMatchEnd) {
      lastNodeBeforeEnd = tn;
    }
  }

  // FALLBACK: If endNode is null but we found the start, use the last text node before the end position
  if (startNode && !endNode && lastNodeBeforeEnd) {
    endNode = lastNodeBeforeEnd.node;
    endOffset = lastNodeBeforeEnd.text.length;
  }

  if (!startNode || !endNode) {
    return null;
  }

  return { startNode, startOffset, endNode, endOffset };
}

/**
 * Find elements containing escaped OOC tags in the DOM
 * When SillyTavern escapes <lumiaooc> tags, they appear as literal text
 * @param {HTMLElement} container - Container to search
 * @param {Array} oocMatches - OOC matches to look for
 * @returns {Array<{element: Element, oocIndices: number[]}>} Elements containing OOC content
 */
function findEscapedOOCElements(container, oocMatches) {
  const results = [];
  if (!container || !oocMatches.length) return results;

  // Get all paragraphs and direct text containers
  const candidates = Array.from(container.querySelectorAll("p, div:not([data-lumia-ooc])"));
  if (candidates.length === 0) {
    // Try the container itself
    candidates.push(container);
  }

  for (const element of candidates) {
    // Skip if already processed
    if (element.closest("[data-lumia-ooc]")) continue;

    const textContent = element.textContent || "";

    // Check if this element contains escaped OOC tags
    // Match patterns like: <lumiaooc name="..."> or &lt;lumiaooc
    const hasEscapedTags = /<lumi[ao]_?ooc[^>]*>/i.test(textContent) ||
                          /&lt;lumi[ao]_?ooc/i.test(element.innerHTML);

    if (hasEscapedTags) {
      // Find which OOC matches are in this element
      const oocIndices = [];
      oocMatches.forEach((ooc, idx) => {
        const plainText = htmlToPlainText(ooc.content);
        if (plainText && textContent.includes(plainText.substring(0, Math.min(30, plainText.length)))) {
          oocIndices.push(idx);
        }
      });

      if (oocIndices.length > 0) {
        results.push({ element, oocIndices });
      }
    }
  }

  return results;
}

/**
 * Perform IRC-style OOC processing - batches all OOC comments into single chatroom container
 *
 * SIMPLIFIED APPROACH - mirrors the working social/whisper flow:
 * 1. Collect all OOC entries first
 * 2. Use the SAME findAndWrapOOCContent that works for other styles
 * 3. Insert IRC container at first match position, delete others
 *
 * @param {number} mesId - The message ID
 * @param {HTMLElement} messageElement - The message element
 * @param {Array} oocMatches - Array of OOC matches from extractOOCFromRawMessage
 */
function performIRCOOCProcessing(mesId, messageElement, oocMatches) {
  console.log(
    `[${MODULE_NAME}] IRC MODE: Processing ${oocMatches.length} OOC comments as chatroom for message ${mesId}`,
  );

  // Check if already processed (look for IRC container)
  const existingIRC = messageElement.querySelector("[data-lumia-irc]");
  if (existingIRC) {
    console.log(`[${MODULE_NAME}] IRC container already exists for message ${mesId}`);
    return;
  }

  // PHASE 1: Collect all OOC entries and find their DOM positions
  const ircEntries = [];
  let firstInsertionRange = null;

  for (let index = 0; index < oocMatches.length; index++) {
    const ooc = oocMatches[index];
    const plainText = htmlToPlainText(ooc.content);
    if (!plainText) continue;

    // Check if already processed in a previous render
    if (isTextProcessed(mesId, plainText)) continue;

    // Get the handle (name from tag, which should be l33t format in IRC mode)
    const handle = ooc.name || "Unknown";

    // Get avatar by looking up the l33t handle
    const avatarUrl = getLumiaAvatarByName(handle) || getLumiaAvatarImg();

    // Clean the content
    const cleanContent = cleanOOCContent(ooc.content) || plainText;

    // Use the SAME method that works for social/whisper styles
    // This finds the content, deletes it, and returns the range for insertion
    const surgicalMatch = findAndWrapOOCContent(messageElement, plainText, ooc.content);

    if (surgicalMatch && surgicalMatch.wrapperCreated) {
      console.log(`[${MODULE_NAME}] IRC MODE: Found and removed OOC #${index + 1} from DOM`);

      // Clean up <br> tags and empty elements around the deleted content
      cleanupRangeSurroundings(surgicalMatch.range);

      // Save the first range for IRC container insertion
      if (!firstInsertionRange) {
        firstInsertionRange = surgicalMatch.range;
      }

      ircEntries.push({
        handle: handle,
        content: cleanContent,
        avatarUrl: avatarUrl,
      });

      markTextProcessed(mesId, plainText);
    } else {
      // Try element-based fallback
      const match = findMatchingElement(messageElement, plainText);
      if (match && match.element) {
        console.log(`[${MODULE_NAME}] IRC MODE: Found OOC #${index + 1} via element match`);

        // Get the parent to clean up after removal
        const parentToClean = match.element.parentNode;

        // Save element for first insertion point if we don't have one yet
        if (!firstInsertionRange) {
          // Create a marker for insertion
          const marker = document.createTextNode("");
          match.element.parentNode.insertBefore(marker, match.element);
          match.element.remove();

          // Create a range at the marker position
          firstInsertionRange = document.createRange();
          firstInsertionRange.setStartBefore(marker);
          firstInsertionRange.setEndAfter(marker);
          
          // Clean up <br> tags around the marker before removing it
          cleanupRangeSurroundings(firstInsertionRange);
          
          marker.remove();
        } else {
          // Just remove this element
          match.element.remove();
          
          // Clean up surrounding <br> tags and empty elements in the parent
          if (parentToClean) {
            const children = Array.from(parentToClean.childNodes);
            children.forEach(child => {
              if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "BR") {
                // Remove isolated <br> tags
                const prevHasContent = child.previousSibling?.textContent?.trim();
                const nextHasContent = child.nextSibling?.textContent?.trim();
                if (!prevHasContent || !nextHasContent) {
                  child.remove();
                }
              }
            });
          }
        }

        ircEntries.push({
          handle: handle,
          content: cleanContent,
          avatarUrl: avatarUrl,
        });

        markTextProcessed(mesId, plainText);
      } else {
        console.log(`[${MODULE_NAME}] IRC MODE: Could not find OOC #${index + 1} in DOM`);
      }
    }
  }

  if (ircEntries.length === 0) {
    console.log(`[${MODULE_NAME}] No valid IRC entries to display for message ${mesId}`);
    return;
  }

  // PHASE 2: Create the IRC chat room container with all entries
  const ircContainer = createIRCChatRoom(ircEntries);

  // PHASE 3: Insert the IRC container at the first OOC position
  if (firstInsertionRange) {
    try {
      firstInsertionRange.insertNode(ircContainer);
      console.log(`[${MODULE_NAME}] IRC MODE: Inserted container at first OOC position`);
    } catch (err) {
      console.error(`[${MODULE_NAME}] IRC MODE: Range insertion failed, using fallback:`, err);
      messageElement.appendChild(ircContainer);
    }
  } else {
    // Fallback: append to message element
    console.log(`[${MODULE_NAME}] IRC MODE: Using fallback append for message ${mesId}`);
    messageElement.appendChild(ircContainer);
  }

  // Clean up surrounding DOM structure
  cleanupOOCBoxSurroundings(ircContainer);

  console.log(
    `[${MODULE_NAME}] IRC MODE: Created chatroom with ${ircEntries.length} messages for message ${mesId}`,
  );
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
 * Internal: Perform full chat OOC processing with chunked yielding
 * Called by the RAF batch renderer - supports async chunked processing to prevent UI freeze
 * @param {boolean} clearExisting - Whether to clear existing OOC boxes first
 * @returns {Promise<void>}
 */
async function performAllOOCProcessing(clearExisting = false) {
  // Guard against concurrent processing
  if (isProcessingAllOOC) {
    console.log(`[${MODULE_NAME}] Skipping concurrent full OOC processing`);
    return;
  }

  const context = getContext();
  if (!context || !context.chat) return;

  isProcessingAllOOC = true;

  try {
    const chatLength = context.chat.length;
    console.log(
      `[${MODULE_NAME}] Processing all OOC comments in chat (${chatLength} messages)${clearExisting ? " [clearing existing]" : ""} [chunked]`,
    );

    // PHASE 1: Synchronous atomic unwrap (must NOT yield to avoid race conditions)
    // If clearing existing OOC boxes (e.g., style change), remove them all first
    if (clearExisting) {
      // STEP 1: Unwrap ALL existing OOC boxes FIRST (restore font tags)
      // This must happen BEFORE clearing tracking to ensure DOM state is consistent
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

      // STEP 2: Clear tracking AFTER DOM is unwrapped
      // Now that all boxes are back to font elements, clear tracking for fresh re-wrap
      clearAllProcessedTexts();
    }

    // PHASE 2: Chunked re-wrap with browser yielding to prevent UI freeze
    // Process each message in the chat - both OOC comments and loom_sum hiding
    for (let i = 0; i < chatLength; i++) {
      // Hide loom_sum blocks in the DOM
      const messageElement = query(`div[mesid="${i}"] .mes_text`);
      if (messageElement) {
        hideLoomSumBlocks(messageElement);
      }
      // Process OOC comments for this message
      performOOCProcessing(i);

      // Yield every chunk to prevent page freeze
      if ((i + 1) % OOC_PROCESSING_CHUNK_SIZE === 0 && i < chatLength - 1) {
        await yieldToBrowser();
      }
    }
  } finally {
    isProcessingAllOOC = false;
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
 * Reprocess all OOC comments for style changes with chunked processing
 * The unwrap phase is synchronous/atomic to prevent race conditions.
 * The re-wrap phase is chunked to prevent UI freezing.
 * Bypasses RAF batching to ensure immediate start without competing operations.
 * @returns {Promise<void>}
 */
export async function processAllOOCCommentsSynchronous() {
  // Cancel any pending RAF updates to prevent competing operations
  cancelAllPendingUpdates();

  // Save scroll position before DOM changes
  const scrollY = window.scrollY;

  // Perform chunked full reprocess with clearing
  // The unwrap inside is atomic, re-wrap yields to browser
  await performAllOOCProcessing(true);

  // Restore scroll position after DOM changes
  window.scrollTo(window.scrollX, scrollY);

  console.log(`[${MODULE_NAME}] Chunked OOC reprocessing complete`);
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
    // Performance optimization: Skip all expensive processing during active generation
    // to prevent UI stalls on Firefox/Safari. Only handle essential loom_sum hiding.
    if (isGenerating) {
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData") {
          const mesText = mutation.target.parentElement?.closest(".mes_text");
          if (mesText) hideLoomSumBlocks(mesText);
        } else if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const mesText = node.classList?.contains("mes_text")
                ? node
                : node.querySelector?.(".mes_text");
              if (mesText) hideLoomSumBlocks(mesText);
            }
          });
        }
      });
      return; // Skip all OOC processing during streaming
    }

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
