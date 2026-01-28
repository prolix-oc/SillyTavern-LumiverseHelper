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

  // Match lumia_img tag - use [^\]] to match any character except closing bracket
  const imgMatch = content.match(/\[lumia_img=([^\]]+)\]/);
  if (imgMatch) {
    image = imgMatch[1].trim();
    cleanContent = cleanContent.replace(imgMatch[0], "").trim();
  }

  // Match lumia_author tag
  const authMatch = content.match(/\[lumia_author=([^\]]+)\]/);
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
    } else if (entry.content.includes("[lumia_img=")) {
      // Content contains lumia_img tag - this is a definition entry
      type = "definition";
    }

    if (type === "definition") {
      const meta = extractMetadata(entry.content);
      console.log(`[Lumia Debug] Processing definition for "${name}":`, {
        comment: comment,
        type: type,
        extractedImage: meta.image,
        contentPreview: entry.content.substring(0, 100),
      });
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
  const result = [...Array.from(lumiaMap.values()), ...loomItems];
  console.log(
    "[Lumia Debug] Final processed items:",
    result.map((item) => ({
      name: item.lumiaDefName || item.loomName,
      hasImage: !!item.lumia_img,
      image: item.lumia_img,
    })),
  );
  return result;
}

/**
 * Get an item from the library by pack name and item name
 * Supports both new format (separate lumiaItems/loomItems) and legacy format (mixed items[])
 * @param {string} packName - The pack name
 * @param {string} itemName - The item name
 * @returns {Object|null} The item or null if not found
 */
export function getItemFromLibrary(packName, itemName) {
  const settings = getSettings();
  const pack = settings.packs[packName];
  if (!pack) return null;

  // New format: separate arrays
  // Check both new and legacy field names for compatibility with mixed references
  if (pack.lumiaItems) {
    const lumia = pack.lumiaItems.find(
      (i) => i.lumiaName === itemName || i.lumiaDefName === itemName
    );
    if (lumia) return lumia;
  }
  if (pack.loomItems) {
    const loom = pack.loomItems.find(
      (i) => i.loomName === itemName || i.name === itemName
    );
    if (loom) return loom;
  }

  // Legacy fallback: mixed items array with old field names
  if (pack.items) {
    return pack.items.find(
      (i) => i.lumiaDefName === itemName || i.lumiaName === itemName || i.loomName === itemName,
    );
  }

  return null;
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
 * Convert old-format items to new-format Lumia item
 * @param {Object} oldItem - Item with old field names
 * @returns {Object} Item with new field names
 */
function convertToNewLumiaFormat(oldItem) {
  return {
    lumiaName: oldItem.lumiaDefName,
    lumiaDefinition: oldItem.lumiaDef || null,
    lumiaPersonality: oldItem.lumia_personality || null,
    lumiaBehavior: oldItem.lumia_behavior || null,
    avatarUrl: oldItem.lumia_img || null,
    genderIdentity: 0, // Default: she/her
    authorName: oldItem.defAuthor || null,
    version: 1,
  };
}

/**
 * Convert old-format items to new-format Loom item
 * @param {Object} oldItem - Item with old field names
 * @returns {Object} Item with new field names
 */
function convertToNewLoomFormat(oldItem) {
  return {
    loomName: oldItem.loomName,
    loomContent: oldItem.loomContent,
    loomCategory: oldItem.loomCategory,
    authorName: null,
    version: 1,
  };
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

  // Use the World Book's name if available, otherwise fall back to sourceName (filename/URL)
  // This ensures the storage key matches what the UI uses for selections
  const packKey = data.name || sourceName;

  // Check if pack exists
  if (settings.packs[packKey]) {
    if (!confirm(`Pack "${packKey}" already exists. Overwrite?`)) {
      return;
    }
  }

  // Separate and convert items to new format
  const lumiaItems = [];
  const loomItems = [];

  for (const item of library) {
    if (item.lumiaDefName) {
      lumiaItems.push(convertToNewLumiaFormat(item));
    } else if (item.loomCategory) {
      loomItems.push(convertToNewLoomFormat(item));
    }
  }

  // Store in new pack format
  settings.packs[packKey] = {
    packName: packKey,
    packAuthor: null,
    coverUrl: null,
    version: 1,
    packExtras: [],
    lumiaItems,
    loomItems,
    // Internal tracking - local uploads are custom (editable), URL imports are not
    isCustom: !isURL,
    url: isURL ? sourceName : "",
  };

  saveSettings();

  const totalItems = lumiaItems.length + loomItems.length;
  toastr.success(
    `Lumia Book "${packKey}" loaded! Found ${totalItems} entries (${lumiaItems.length} Lumia, ${loomItems.length} Loom).`,
  );

  return { lumiaItems, loomItems };
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

    // Use importPack which handles both native Lumiverse format and World Book format
    importPack(data, name, true);
  } catch (error) {
    console.error("Lumia Injector Error:", error);
    const statusDiv = document.getElementById("lumia-book-status");
    if (statusDiv) statusDiv.textContent = "Error";
    toastr.error("Failed to load book: " + error.message);
  }
}

/**
 * Import a pack from data, automatically detecting format
 * Supports both native Lumiverse format and World Book format
 * @param {Object} data - The pack/world book data
 * @param {string} sourceName - Name/identifier for the source
 * @param {boolean} isURL - Whether the source was a URL
 * @returns {Object|null} The imported pack or null on failure
 */
export function importPack(data, sourceName, isURL = false) {
  const settings = getSettings();

  // Detect format: native Lumiverse format has lumiaItems or loomItems arrays
  if (data.lumiaItems || data.loomItems) {
    // Native Lumiverse format - import directly
    // Use packName from data if available, otherwise fall back to sourceName (filename/URL)
    // This ensures the storage key matches what the UI uses for selections
    const packKey = data.packName || sourceName;
    console.log(`[${MODULE_NAME}] Importing native format pack: ${packKey} (source: ${sourceName})`);

    // Check if pack exists
    if (settings.packs[packKey]) {
      if (!confirm(`Pack "${packKey}" already exists. Overwrite?`)) {
        return null;
      }
    }

    settings.packs[packKey] = {
      packName: packKey,
      packAuthor: data.packAuthor || null,
      coverUrl: data.coverUrl || null,
      version: data.version || 1,
      packExtras: data.packExtras || [],
      lumiaItems: data.lumiaItems || [],
      loomItems: data.loomItems || [],
      // Internal tracking - local uploads are custom (editable), URL imports are not
      isCustom: !isURL,
      url: isURL ? sourceName : "",
    };

    saveSettings();

    const totalItems = (data.lumiaItems?.length || 0) + (data.loomItems?.length || 0);
    toastr.success(
      `Pack "${packKey}" imported! Found ${totalItems} entries.`,
    );

    return settings.packs[packKey];
  }

  // World Book format or raw entries array - use existing handler
  return handleNewBook(data, sourceName, isURL);
}
