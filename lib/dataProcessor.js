/**
 * Data Processing Module
 * Handles world book loading, parsing, and library management
 */

import { getSettings, saveSettings, MODULE_NAME } from "./settingsManager.js";

/**
 * Extract metadata from content (images, authors)
 * @param {string} content - The content to extract metadata from
 * @returns {Object} Object containing image, author, and cleaned content
 */
export function extractMetadata(content) {
  let cleanContent = content;
  let image = null;
  let author = null;

  const imgMatch = content.match(/\[lumia_img=(.+?)\]/);
  if (imgMatch) {
    image = imgMatch[1].trim();
    cleanContent = cleanContent.replace(imgMatch[0], "").trim();
  }

  const authMatch = content.match(/\[lumia_author=(.+?)\]/);
  if (authMatch) {
    author = authMatch[1].trim();
    cleanContent = cleanContent.replace(authMatch[0], "").trim();
  }

  return { image, author, content: cleanContent };
}

/**
 * Process a world book JSON into categorized items
 * @param {Array|Object} data - World book data (array or object with entries)
 * @returns {Array} Array of processed Lumia and Loom items
 */
export function processWorldBook(data) {
  // data can be Array (raw entries) or Object (World Info format)
  let entries = [];
  if (Array.isArray(data)) {
    entries = data;
  } else if (data && data.entries) {
    entries = Object.values(data.entries);
  } else {
    return [];
  }

  const lumiaMap = new Map(); // Key: Lumia Name
  const loomItems = []; // Array of Loom items (no merging needed)

  for (const entry of entries) {
    if (!entry.content || typeof entry.content !== "string") continue;

    const comment = (entry.comment || "").trim();

    // Check if this is a Loom entry first (needs different name extraction)
    const categoryMatch = comment.match(/^(.+?)\s*\(/);
    if (categoryMatch) {
      const category = categoryMatch[1].trim();

      // Check for Loom categories
      if (
        category === "Loom Utilities" ||
        category === "Retrofits" ||
        category === "Narrative Style"
      ) {
        // For Loom items, extract everything after category up to final closing paren
        // This handles nested parentheses like "Narrative Style (Kafka (Whatever Kafka Does))"
        const loomNameMatch = comment.match(
          /^(?:Loom Utilities|Retrofits|Narrative Style)\s*\((.+)\)\s*$/,
        );
        if (!loomNameMatch) continue;

        const loomName = loomNameMatch[1].trim();
        loomItems.push({
          loomName: loomName,
          loomCategory: category,
          loomContent: entry.content.trim(),
        });
        continue; // Skip Lumia processing
      }
    }

    // Extract name from parenthesis for Lumia items (simple extraction)
    const nameMatch = comment.match(/\((.+?)\)/);
    if (!nameMatch) continue; // IGNORE if no parenthesis name

    const name = nameMatch[1].trim();

    // Lumia processing (existing logic)
    let lumia = lumiaMap.get(name);
    if (!lumia) {
      lumia = {
        lumiaDefName: name,
        lumia_img: null,
        lumia_personality: null,
        lumia_behavior: null,
        lumiaDef: null,
        defAuthor: null,
      };
      lumiaMap.set(name, lumia);
    }

    const commentLower = comment.toLowerCase();
    let type = null;

    // Determine entry type based on outletName or comment structure
    if (
      entry.outletName === "Lumia_Description" ||
      commentLower.includes("definition")
    ) {
      type = "definition";
    } else if (
      entry.outletName === "Lumia_Behavior" ||
      commentLower.includes("behavior")
    ) {
      type = "behavior";
    } else if (
      entry.outletName === "Lumia_Personality" ||
      commentLower.includes("personality")
    ) {
      type = "personality";
    } else if (
      categoryMatch &&
      categoryMatch[1].trim().toLowerCase() === "lumia"
    ) {
      // "Lumia (Name)" format - exactly "Lumia" before parenthesis means physical definition
      type = "definition";
    }

    if (type === "definition") {
      const meta = extractMetadata(entry.content);
      lumia.lumiaDef = meta.content;
      if (meta.image) lumia.lumia_img = meta.image;
      if (meta.author) lumia.defAuthor = meta.author;
    } else if (type === "behavior") {
      lumia.lumia_behavior = entry.content;
    } else if (type === "personality") {
      // Check for legacy split within personality
      const behaviorMatch = entry.content.match(
        /{{setvar::lumia_behavior_\w+::([\s\S]*?)}}/,
      );
      const personalityMatch = entry.content.match(
        /{{setglobalvar::lumia_personality_\w+::([\s\S]*?)}}/,
      );

      if (behaviorMatch && !lumia.lumia_behavior) {
        lumia.lumia_behavior = behaviorMatch[1].trim();
      }

      if (personalityMatch) {
        lumia.lumia_personality = personalityMatch[1].trim();
      } else {
        // Fallback if not using setglobalvar but tagged as personality
        lumia.lumia_personality = entry.content;
      }
    }
  }

  // Combine Lumia items and Loom items
  return [...Array.from(lumiaMap.values()), ...loomItems];
}

/**
 * Get an item from the library by pack name and item name
 * @param {string} packName - The pack name
 * @param {string} itemName - The item name
 * @returns {Object|null} The item or null if not found
 */
export function getItemFromLibrary(packName, itemName) {
  const settings = getSettings();
  const pack = settings.packs[packName];
  if (!pack) return null;
  return pack.items.find(
    (i) => i.lumiaDefName === itemName || i.loomName === itemName,
  );
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
  if (!text) return text;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Handle a newly loaded world book
 * @param {Object} data - The world book data
 * @param {string} sourceName - Name/identifier for the source
 * @param {boolean} isURL - Whether the source was a URL
 */
export function handleNewBook(data, sourceName, isURL = false) {
  const settings = getSettings();
  const library = processWorldBook(data);

  if (library.length === 0) {
    toastr.error("No valid Lumia entries found in this World Book.");
    return;
  }

  // Check if pack exists
  if (settings.packs[sourceName]) {
    if (!confirm(`Pack "${sourceName}" already exists. Overwrite?`)) {
      return;
    }
  }

  settings.packs[sourceName] = {
    name: sourceName,
    items: library,
    url: isURL ? sourceName : "",
  };

  saveSettings();
  toastr.success(
    `Lumia Book "${sourceName}" loaded! Found ${library.length} entries.`,
  );

  return library;
}

/**
 * Fetch a world book from a URL
 * @param {string} url - The URL to fetch from
 */
export async function fetchWorldBook(url) {
  if (!url) return;

  try {
    const statusDiv = document.getElementById("lumia-book-status");
    if (statusDiv) statusDiv.textContent = "Fetching...";

    const response = await fetch(url);
    if (!response.ok) throw new Error("Network response was not ok");

    const data = await response.json();

    // Use filename from URL or just URL as name
    const name = url.split("/").pop() || url;

    handleNewBook(data, name, true);
  } catch (error) {
    console.error("Lumia Injector Error:", error);
    const statusDiv = document.getElementById("lumia-book-status");
    if (statusDiv) statusDiv.textContent = "Error";
    toastr.error("Failed to load book: " + error.message);
  }
}
