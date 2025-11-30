/**
 * OOC Comments Module
 * Handles out-of-character comment rendering, streaming support, and DOM observation
 */

import { getContext } from "../../../../extensions.js";
import { query, queryAll, createElement } from "../sthelpers/domUtils.js";
import { getSettings, MODULE_NAME } from "./settingsManager.js";
import { getItemFromLibrary } from "./dataProcessor.js";
import { hideLoomSumBlocks } from "./loomSystem.js";

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
}

/**
 * Get the current generation state
 * @returns {boolean} Whether generation is in progress
 */
export function getIsGenerating() {
  return isGenerating;
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
 * Create the styled OOC comment box element
 * Supports multiple styles: 'social', 'margin', 'whisper'
 * @param {string} content - The text content for the OOC box
 * @param {string|null} avatarImg - URL to avatar image, or null for placeholder
 * @param {number} index - Index of this OOC in the message (for alternating styles)
 * @returns {HTMLElement} The created OOC comment box element
 */
export function createOOCCommentBox(content, avatarImg, index = 0) {
  const settings = getSettings();
  const style = settings.lumiaOOCStyle || "social";
  const isAlt = index % 2 === 1; // Alternate on odd indices

  switch (style) {
    case "margin":
      return createOOCMarginNote(content, avatarImg, isAlt);
    case "whisper":
      return createOOCWhisperBubble(content, avatarImg, isAlt);
    case "social":
    default:
      return createOOCSocialCard(content, avatarImg);
  }
}

/**
 * Create Social Card style OOC box (original design)
 * Full card with avatar, name, thread indicator, and ethereal animations
 */
function createOOCSocialCard(content, avatarImg) {
  // Create avatar container with ethereal glow ring
  const avatarElement = avatarImg
    ? createElement("img", {
        attrs: { src: avatarImg, alt: "Lumia", class: "lumia-ooc-avatar" },
      })
    : createElement("div", {
        attrs: { class: "lumia-ooc-avatar lumia-ooc-avatar-placeholder" },
        text: "L",
      });

  // Wrap avatar in a glow container for the ethereal effect
  const avatarContainer = createElement("div", {
    attrs: { class: "lumia-ooc-avatar-container" },
    children: [avatarElement],
  });

  // Create the name/handle area (like a social media username)
  const nameElement = createElement("span", {
    attrs: { class: "lumia-ooc-name" },
    text: "Lumia",
  });

  // Create the "thread" indicator - weaving motif
  const threadIndicator = createElement("span", {
    attrs: { class: "lumia-ooc-thread" },
    text: "weaving through the Loom",
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
 * @param {boolean} isAlt - Whether to use alternate (right-aligned) orientation
 */
function createOOCMarginNote(content, avatarImg, isAlt = false) {
  // Create the hanging tag with avatar or letter
  const tagContent = avatarImg
    ? createElement("img", {
        attrs: {
          src: avatarImg,
          alt: "L",
          class: "lumia-ooc-margin-tag-avatar",
        },
      })
    : createElement("span", {
        attrs: { class: "lumia-ooc-margin-tag-letter" },
        text: "L",
      });

  const tag = createElement("div", {
    attrs: { class: "lumia-ooc-margin-tag" },
    children: [tagContent],
  });

  // Create the subtle label
  const label = createElement("div", {
    attrs: { class: "lumia-ooc-margin-label" },
    text: "Lumia",
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
 * @param {boolean} isAlt - Whether to use alternate (right-aligned) orientation
 */
function createOOCWhisperBubble(content, avatarImg, isAlt = false) {
  // Create the avatar element (outside the bubble, prominent)
  const avatar = avatarImg
    ? createElement("img", {
        attrs: {
          src: avatarImg,
          alt: "Lumia",
          class: "lumia-ooc-whisper-avatar",
        },
      })
    : createElement("div", {
        attrs: { class: "lumia-ooc-whisper-avatar-placeholder" },
        text: "L",
      });

  // Wrap avatar in container
  const avatarWrap = createElement("div", {
    attrs: { class: "lumia-ooc-whisper-avatar-wrap" },
    children: [avatar],
  });

  // Create the name
  const name = createElement("span", {
    attrs: { class: "lumia-ooc-whisper-name" },
    text: "Lumia whispers...",
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
 * Process Lumia OOC comments in a message by finding <font> elements with the OOC color
 * @param {number} mesId - The message ID to process
 * @param {boolean} force - Force reprocessing even if OOC boxes exist
 */
export function processLumiaOOCComments(mesId, force = false) {
  try {
    // Get the message element from DOM (SimTracker pattern)
    const messageElement = query(`div[mesid="${mesId}"] .mes_text`);

    if (!messageElement) {
      return; // Silent return - element may not be rendered yet
    }

    // Find all <font> elements with the Lumia OOC color
    const fontElements = queryAll("font", messageElement);
    const oocFonts = fontElements.filter(isLumiaOOCFont);

    if (oocFonts.length === 0) {
      return; // No Lumia OOC fonts found
    }

    console.log(
      `[${MODULE_NAME}] Found ${oocFonts.length} Lumia OOC comment(s) in message ${mesId}`,
    );

    // Get avatar image
    const avatarImg = getLumiaAvatarImg();

    // Save scroll position (SimTracker pattern)
    const scrollY = window.scrollY || window.pageYOffset;

    // Process each OOC font element - insert comment box exactly where the OOC was located
    oocFonts.forEach((fontElement, index) => {
      // Get the content from the font element
      const content = fontElement.innerHTML;

      console.log(
        `[${MODULE_NAME}] Processing OOC #${index + 1}: "${content.substring(0, 50)}${content.length > 50 ? "..." : ""}"`,
      );

      // Create the styled comment box (pass index for alternating orientation)
      const commentBox = createOOCCommentBox(content, avatarImg, index);

      // Find the outermost OOC-related element to replace
      let elementToReplace = fontElement;
      let current = fontElement.parentElement;

      // Walk up to find the lumia_ooc tag (might be nested in <p> or other formatting tags)
      while (current && current !== messageElement) {
        const tagName = current.tagName?.toLowerCase();
        if (tagName === "lumia_ooc") {
          elementToReplace = current;
          break;
        }
        // Stop if we hit a block-level element that contains other content
        if (tagName === "p" || tagName === "div") {
          const textContent = current.textContent?.trim();
          const fontContent = fontElement.textContent?.trim();
          if (textContent === fontContent) {
            elementToReplace = current;
          }
          break;
        }
        current = current.parentElement;
      }

      // Perform in-place replacement (SimTracker pattern)
      if (elementToReplace.parentNode) {
        elementToReplace.parentNode.replaceChild(commentBox, elementToReplace);
        console.log(
          `[${MODULE_NAME}] Inserted OOC #${index + 1} in-place (replaced ${elementToReplace.tagName || "text"})`,
        );
      }
    });

    // Force reflow to ensure styles are applied
    messageElement.offsetHeight;

    // Restore scroll position
    window.scrollTo(0, scrollY);

    console.log(
      `[${MODULE_NAME}] Finished processing OOC comments in message ${mesId}`,
    );
  } catch (error) {
    console.error(`[${MODULE_NAME}] Error processing OOC comments:`, error);
  }
}

/**
 * Process all Lumia OOC comments and hide loom_sum blocks in the chat
 * Called on CHAT_CHANGED and initial load to ensure all messages are processed
 * @param {boolean} clearExisting - Whether to clear existing OOC boxes first
 */
export function processAllLumiaOOCComments(clearExisting = false) {
  const context = getContext();
  if (!context || !context.chat) return;

  console.log(
    `[${MODULE_NAME}] Processing all OOC comments in chat (${context.chat.length} messages)${clearExisting ? " [clearing existing]" : ""}`,
  );

  // If clearing existing OOC boxes (e.g., style change), remove them all first
  if (clearExisting) {
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
    processLumiaOOCComments(i);
  }
}

/**
 * Schedule OOC processing after chat render completes
 * Uses a multi-stage approach for reliability
 */
export function scheduleOOCProcessingAfterRender() {
  // Clear any pending timers
  if (oocProcessingTimer) clearTimeout(oocProcessingTimer);
  if (oocRenderWaitTimer) clearTimeout(oocRenderWaitTimer);

  const maxWaitTime = 3000;
  const checkInterval = 100;
  const stabilityDelay = 150;
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
      oocRenderWaitTimer = setTimeout(checkAndProcess, checkInterval);
      return;
    }

    if (hasDOMMessages || !hasContextMessages) {
      console.log(
        `[${MODULE_NAME}] DOM ready with ${messageElements.length} messages, waiting for stability`,
      );
      oocProcessingTimer = setTimeout(() => {
        console.log(
          `[${MODULE_NAME}] Processing all OOC comments after render`,
        );
        processAllLumiaOOCComments();
      }, stabilityDelay);
      return;
    }

    oocRenderWaitTimer = setTimeout(checkAndProcess, checkInterval);
  }

  oocRenderWaitTimer = setTimeout(checkAndProcess, 50);
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

  const lumiaOocParent = fontElement.closest("lumia_ooc");
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

          const oocFonts = queryAll("font", messageElement).filter(
            isLumiaOOCFont,
          );
          if (oocFonts.length > 0) {
            const mesBlock = messageElement.closest("div[mesid]");
            if (mesBlock) {
              const mesId = parseInt(mesBlock.getAttribute("mesid"), 10);
              console.log(
                `[${MODULE_NAME}] Observer: Processing OOC in message ${mesId}`,
              );
              processLumiaOOCComments(mesId);
            }
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
