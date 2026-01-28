/**
 * Lumia Editor Module
 * Handles creation, editing, and export of custom Lumia definitions and packs
 */

import {
  getSettings,
  saveSettings,
  MODULE_NAME,
  bumpLumiaConfigVersion,
  savePack,
  getPackByName,
  getPacks,
  saveSelections,
} from "./settingsManager.js";
import { escapeHtml } from "./dataProcessor.js";
import { getLumiaField } from "./lumiaContent.js";

// Callback for UI refresh - set by index.js
let refreshUICallback = null;

/**
 * Set the refresh UI callback
 * @param {Function} callback - The callback function to call when UI needs refresh
 */
export function setEditorRefreshUICallback(callback) {
  refreshUICallback = callback;
}

/**
 * Refresh the UI using the registered callback
 */
function refreshUI() {
  if (refreshUICallback) {
    refreshUICallback();
  }
}

/**
 * Check if a pack can be edited (is custom/user-created)
 * @param {string} packName - The pack name to check
 * @returns {boolean} True if pack is editable
 */
export function canEditPack(packName) {
  const pack = getPackByName(packName);
  if (!pack) return false;

  // Pack is editable if:
  // 1. It's explicitly marked as custom, OR
  // 2. It has no URL (was created locally, not fetched)
  return pack.isCustom === true || !pack.url;
}

/**
 * Create a new custom pack
 * @param {string} name - Pack name
 * @param {string} author - Optional author name
 * @param {string} coverUrl - Optional cover image URL
 * @returns {Promise<Object>} The created pack object
 */
export async function createCustomPack(name, author = "", coverUrl = "") {
  const existingPack = getPackByName(name);
  if (existingPack) {
    throw new Error(`Pack "${name}" already exists`);
  }

  // Create pack in new v2 format
  const pack = {
    packName: name,
    packAuthor: author || null,
    coverUrl: coverUrl || null,
    version: 1,
    packExtras: [],
    lumiaItems: [],
    loomItems: [],
    // Internal tracking
    isCustom: true,
    url: "", // Empty URL indicates local/custom pack
  };

  await savePack(pack);

  return pack;
}

/**
 * Update a custom pack's metadata
 * @param {string} packName - The pack name
 * @param {Object} updates - Fields to update (author, coverUrl)
 * @returns {Promise<void>}
 */
export async function updatePackMetadata(packName, updates) {
  const pack = getPackByName(packName);

  if (!pack) {
    throw new Error(`Pack "${packName}" not found`);
  }

  if (!canEditPack(packName)) {
    throw new Error(`Pack "${packName}" is not editable`);
  }

  if (updates.author !== undefined) {
    pack.packAuthor = updates.author;
  }
  if (updates.coverUrl !== undefined) {
    pack.coverUrl = updates.coverUrl;
  }

  await savePack(pack);
}

/**
 * Add or update a Lumia item in a pack
 * @param {string} packName - The pack name
 * @param {Object} lumiaItem - The Lumia item to add/update
 * @param {string} originalName - Original name if editing (for rename detection)
 * @returns {Promise<Object>} The added/updated item
 */
export async function addLumiaToPackItems(packName, lumiaItem, originalName = null) {
  const pack = getPackByName(packName);

  if (!pack) {
    throw new Error(`Pack "${packName}" not found`);
  }

  if (!canEditPack(packName)) {
    throw new Error(`Pack "${packName}" is not editable`);
  }

  // Ensure lumiaItems array exists (handles both new and legacy format packs)
  if (!pack.lumiaItems) {
    pack.lumiaItems = [];
  }

  // Get the name to search for (supports both old and new field names)
  const itemName = lumiaItem.lumiaName || lumiaItem.lumiaDefName;
  const searchName = originalName || itemName;

  const existingIndex = pack.lumiaItems.findIndex(
    (item) => (item.lumiaName || item.lumiaDefName) === searchName
  );

  if (existingIndex >= 0) {
    // Update existing
    pack.lumiaItems[existingIndex] = { ...pack.lumiaItems[existingIndex], ...lumiaItem };
  } else {
    // Add new
    pack.lumiaItems.push(lumiaItem);
  }

  await savePack(pack);
  bumpLumiaConfigVersion(); // Invalidate Claude cache when Lumia definitions change
  return lumiaItem;
}

/**
 * Delete a Lumia from a pack
 * @param {string} packName - The pack name
 * @param {string} itemName - The Lumia name to delete
 * @returns {Promise<void>}
 */
export async function deleteLumiaFromPack(packName, itemName) {
  const settings = getSettings();
  const pack = getPackByName(packName);

  if (!pack) {
    throw new Error(`Pack "${packName}" not found`);
  }

  if (!canEditPack(packName)) {
    throw new Error(`Pack "${packName}" is not editable`);
  }

  // Support both new format (lumiaItems) and legacy format (items)
  const items = pack.lumiaItems || pack.items || [];
  const index = items.findIndex((item) => (item.lumiaName || item.lumiaDefName) === itemName);
  if (index >= 0) {
    items.splice(index, 1);

    // Save the updated pack
    await savePack(pack);

    // Clean up any selections referencing this item
    const selectionUpdates = {};
    let needsSelectionUpdate = false;

    if (
      settings.selectedDefinition &&
      settings.selectedDefinition.packName === packName &&
      settings.selectedDefinition.itemName === itemName
    ) {
      selectionUpdates.selectedDefinition = null;
      settings.selectedDefinition = null;
      needsSelectionUpdate = true;
    }

    const filteredBehaviors = (settings.selectedBehaviors || []).filter(
      (s) => !(s.packName === packName && s.itemName === itemName)
    );
    if (filteredBehaviors.length !== (settings.selectedBehaviors || []).length) {
      selectionUpdates.selectedBehaviors = filteredBehaviors;
      settings.selectedBehaviors = filteredBehaviors;
      needsSelectionUpdate = true;
    }

    const filteredPersonalities = (settings.selectedPersonalities || []).filter(
      (s) => !(s.packName === packName && s.itemName === itemName)
    );
    if (filteredPersonalities.length !== (settings.selectedPersonalities || []).length) {
      selectionUpdates.selectedPersonalities = filteredPersonalities;
      settings.selectedPersonalities = filteredPersonalities;
      needsSelectionUpdate = true;
    }

    if (
      settings.dominantBehavior &&
      settings.dominantBehavior.packName === packName &&
      settings.dominantBehavior.itemName === itemName
    ) {
      selectionUpdates.dominantBehavior = null;
      settings.dominantBehavior = null;
      needsSelectionUpdate = true;
    }

    if (
      settings.dominantPersonality &&
      settings.dominantPersonality.packName === packName &&
      settings.dominantPersonality.itemName === itemName
    ) {
      selectionUpdates.dominantPersonality = null;
      settings.dominantPersonality = null;
      needsSelectionUpdate = true;
    }

    // Save selection changes
    if (needsSelectionUpdate) {
      saveSelections(selectionUpdates);
    }
    saveSettings();
    bumpLumiaConfigVersion(); // Invalidate Claude cache when Lumia definitions change
  }
}

/**
 * Serialize a Lumia item to World Book entry format
 * @param {Object} lumiaItem - The Lumia item
 * @param {string} entryType - 'definition' | 'behavior' | 'personality'
 * @param {number} uid - Unique ID for the entry
 * @returns {Object} World Book entry object
 */
function serializeLumiaToWorldBookEntry(lumiaItem, entryType, uid) {
  const name = getLumiaField(lumiaItem, "name");
  let comment = "";
  let content = "";

  if (entryType === "definition") {
    comment = `Lumia (${name})`;
    // Build content with metadata tags
    let contentParts = [];
    const imgUrl = getLumiaField(lumiaItem, "img");
    const author = getLumiaField(lumiaItem, "author");
    const defContent = getLumiaField(lumiaItem, "def");

    if (imgUrl) {
      contentParts.push(`[lumia_img=${imgUrl}]`);
    }
    if (author) {
      contentParts.push(`[lumia_author=${author}]`);
    }
    if (defContent) {
      contentParts.push(defContent);
    }
    content = contentParts.join("\n");
  } else if (entryType === "behavior") {
    comment = `Behavior (${name})`;
    content = getLumiaField(lumiaItem, "behavior") || "";
  } else if (entryType === "personality") {
    comment = `Personality (${name})`;
    content = getLumiaField(lumiaItem, "personality") || "";
  }

  return {
    // Basic defaults
    key: [],
    keysecondary: [],
    constant: false,
    vectorized: false,
    selective: false,
    selectiveLogic: 0,
    addMemo: true,
    order: 100,
    position: 0,
    disable: false,
    excludeRecursion: false,
    preventRecursion: false,
    delayUntilRecursion: false,
    probability: 100,
    useProbability: true,
    depth: 4,
    group: "",
    groupOverride: false,
    groupWeight: 100,
    scanDepth: null,
    caseSensitive: null,
    matchWholeWords: null,
    useGroupScoring: null,
    automationId: "",
    role: null,
    sticky: 0,
    cooldown: 0,
    delay: 0,
    // Dynamic fields
    uid: uid,
    comment: comment,
    content: content,
  };
}

/**
 * Export a pack as SillyTavern World Book JSON
 * @param {string} packName - The pack name to export
 * @returns {Object} World Book JSON object
 */
export function generateWorldBookJson(packName) {
  const pack = getPackByName(packName);

  if (!pack) {
    throw new Error(`Pack "${packName}" not found`);
  }

  const entries = {};
  let uid = 0;

  // Get pack metadata (support both old and new field names)
  const packAuthor = pack.packAuthor || pack.author;
  const packCover = pack.coverUrl;

  // Add metadata entry first if pack has author or cover
  if (packAuthor || packCover) {
    let metadataContent = "";
    if (packCover) {
      metadataContent += `[cover_img=${packCover}]`;
    }
    if (packAuthor) {
      metadataContent += `[author_name=${packAuthor}]`;
    }

    entries[uid] = {
      // Basic defaults
      key: [],
      keysecondary: [],
      constant: false,
      vectorized: false,
      selective: false,
      selectiveLogic: 0,
      addMemo: true,
      order: 100,
      position: 0,
      disable: false,
      excludeRecursion: false,
      preventRecursion: false,
      delayUntilRecursion: false,
      probability: 100,
      useProbability: true,
      depth: 4,
      group: "",
      groupOverride: false,
      groupWeight: 100,
      scanDepth: null,
      caseSensitive: null,
      matchWholeWords: null,
      useGroupScoring: null,
      automationId: "",
      role: null,
      sticky: 0,
      cooldown: 0,
      delay: 0,
      // Dynamic fields
      uid: uid,
      comment: "Metadata",
      content: metadataContent,
    };
    uid++;
  }

  // Support both new format (lumiaItems) and legacy format (items)
  const lumiaItems = pack.lumiaItems || (pack.items || []).filter(i => i.lumiaDefName);

  for (const item of lumiaItems) {
    const defContent = getLumiaField(item, "def");
    const behaviorContent = getLumiaField(item, "behavior");
    const personalityContent = getLumiaField(item, "personality");

    // Always add definition entry
    if (defContent) {
      entries[uid] = serializeLumiaToWorldBookEntry(item, "definition", uid);
      uid++;
    }

    // Add behavior entry if present
    if (behaviorContent) {
      entries[uid] = serializeLumiaToWorldBookEntry(item, "behavior", uid);
      uid++;
    }

    // Add personality entry if present
    if (personalityContent) {
      entries[uid] = serializeLumiaToWorldBookEntry(item, "personality", uid);
      uid++;
    }
  }

  return { entries };
}

/**
 * Download a pack as a World Book JSON file
 * @param {string} packName - The pack name to export
 */
export function exportPackAsWorldBook(packName) {
  const worldBook = generateWorldBookJson(packName);
  const jsonString = JSON.stringify(worldBook, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${packName.replace(/[^a-z0-9]/gi, "_")}_worldbook.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toastr.success(`Pack "${packName}" exported successfully!`);
}

/**
 * Get list of custom (editable) packs
 * @returns {Array} Array of custom pack objects
 */
export function getCustomPacks() {
  const packs = getPacks();
  return Object.values(packs).filter(
    (pack) => pack.isCustom || !pack.url
  );
}

/**
 * Show the pack selector modal
 * @param {Function} onSelect - Legacy callback (unused in React version)
 */
export function showPackSelectorModal(onSelect) {
  // Use React UI
  if (window.LumiverseUI && window.LumiverseUI.getStore) {
    const store = window.LumiverseUI.getStore();
    store.setState({
      ui: {
        ...store.getState().ui,
        activeModal: { name: 'packSelector', props: {} }
      }
    });
    return;
  }
  
  console.error("[Lumiverse] React UI not ready");
  if (typeof toastr !== 'undefined') toastr.error("UI not ready, please refresh");
}

/**
 * Show the Lumia Editor modal
 * @param {Object} editingItem - Optional existing item to edit
 * @param {string} packName - Optional pack name (required if editing)
 */
export function showLumiaEditorModal(editingItem = null, packName = null) {
  // Use React UI
  if (window.LumiverseUI && window.LumiverseUI.getStore) {
    const store = window.LumiverseUI.getStore();
    const isEditing = editingItem !== null;

    if (!isEditing && !packName) {
      // Show pack selector (manager) if no pack specified for new item
      store.setState({
        ui: {
          ...store.getState().ui,
          activeModal: { name: 'packSelector', props: {} }
        }
      });
    } else {
      // Show Lumia editor directly
      store.setState({
        ui: {
          ...store.getState().ui,
          activeModal: { 
            name: 'lumiaEditor', 
            props: { editingItem, packName } 
          }
        }
      });
    }
    return;
  }
  
  console.error("[Lumiverse] React UI not ready");
  if (typeof toastr !== 'undefined') toastr.error("UI not ready, please refresh");
}

/**
 * Show the pack editor modal for editing pack metadata
 * @param {string} packName - The pack name to edit
 */
export function showPackEditorModal(packName) {
  // Use React UI
  if (window.LumiverseUI && window.LumiverseUI.getStore) {
    const store = window.LumiverseUI.getStore();
    store.setState({
      ui: {
        ...store.getState().ui,
        activeModal: { name: 'packEditor', props: { packName } }
      }
    });
    return;
  }

  console.error("[Lumiverse] React UI not ready");
  if (typeof toastr !== 'undefined') toastr.error("UI not ready, please refresh");
}

/**
 * Generate native Lumiverse pack JSON format
 * Converts from legacy format if needed
 * @param {string} packName - The pack name to export
 * @returns {Object} Native pack JSON object
 */
export function generateNativePackJson(packName) {
  const pack = getPackByName(packName);

  if (!pack) {
    throw new Error(`Pack "${packName}" not found`);
  }

  const packAuthor = pack.packAuthor || pack.author || null;

  // Get lumiaItems - support both new format (lumiaItems) and legacy format (items)
  let lumiaItems = [];
  if (pack.lumiaItems && pack.lumiaItems.length > 0) {
    // Already in new format - normalize field names
    lumiaItems = pack.lumiaItems.map(item => ({
      lumiaName: item.lumiaName || item.lumiaDefName || "Unknown",
      lumiaDefinition: item.lumiaDefinition || item.lumiaDef || "",
      lumiaPersonality: item.lumiaPersonality || item.lumia_personality || "",
      lumiaBehavior: item.lumiaBehavior || item.lumia_behavior || "",
      avatarUrl: item.avatarUrl || item.lumia_img || null,
      genderIdentity: item.genderIdentity ?? 0,
      authorName: item.authorName || packAuthor || null,
      version: item.version || 1,
    }));
  } else if (pack.items && pack.items.length > 0) {
    // Convert from legacy format
    lumiaItems = pack.items
      .filter(item => item.lumiaDefName || item.lumiaDef)
      .map(item => ({
        lumiaName: item.lumiaDefName || item.lumiaName || "Unknown",
        lumiaDefinition: item.lumiaDef || item.lumiaDefinition || "",
        lumiaPersonality: item.lumia_personality || item.lumiaPersonality || "",
        lumiaBehavior: item.lumia_behavior || item.lumiaBehavior || "",
        avatarUrl: item.lumia_img || item.avatarUrl || null,
        genderIdentity: item.genderIdentity ?? 0,
        authorName: item.authorName || packAuthor || null,
        version: item.version || 1,
      }));
  }

  // Get loomItems - support both new format and legacy format
  let loomItems = [];
  if (pack.loomItems && pack.loomItems.length > 0) {
    loomItems = pack.loomItems.map(item => ({
      loomName: item.loomName || item.name || "Unknown",
      loomContent: item.loomContent || item.content || "",
      loomCategory: item.loomCategory || item.category || "Loom Utilities",
      authorName: item.authorName || packAuthor || null,
      version: item.version || 1,
    }));
  }

  return {
    packName: pack.packName || pack.name || packName,
    packAuthor,
    coverUrl: pack.coverUrl || null,
    version: pack.version || 1,
    packExtras: pack.packExtras || [],
    lumiaItems,
    loomItems,
  };
}

/**
 * Download a pack as a native Lumiverse JSON file
 * @param {string} packName - The pack name to export
 */
export function exportPackAsNative(packName) {
  const nativePack = generateNativePackJson(packName);
  const jsonString = JSON.stringify(nativePack, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${packName.replace(/[^a-z0-9]/gi, "_")}_lumiverse.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toastr.success(`Pack "${packName}" exported in Lumiverse format!`);
}
