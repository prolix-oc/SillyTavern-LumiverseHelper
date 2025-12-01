/**
 * Lumia Editor Module
 * Handles creation, editing, and export of custom Lumia definitions and packs
 */

import { getSettings, saveSettings, MODULE_NAME } from "./settingsManager.js";
import { escapeHtml } from "./dataProcessor.js";

// SVG icons used in the editor
const SVG_ICONS = {
  chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
  folderPlus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
};

// Default World Book entry template with all required fields
const DEFAULT_WB_ENTRY = {
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
};

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
  const settings = getSettings();
  const pack = settings.packs[packName];
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
 * @returns {Object} The created pack object
 */
export function createCustomPack(name, author = "", coverUrl = "") {
  const settings = getSettings();

  if (settings.packs[name]) {
    throw new Error(`Pack "${name}" already exists`);
  }

  const pack = {
    name: name,
    items: [],
    url: "", // Empty URL indicates local/custom pack
    isCustom: true,
    author: author,
    coverUrl: coverUrl,
  };

  settings.packs[name] = pack;
  saveSettings();

  return pack;
}

/**
 * Update a custom pack's metadata
 * @param {string} packName - The pack name
 * @param {Object} updates - Fields to update (author, coverUrl)
 */
export function updatePackMetadata(packName, updates) {
  const settings = getSettings();
  const pack = settings.packs[packName];

  if (!pack) {
    throw new Error(`Pack "${packName}" not found`);
  }

  if (!canEditPack(packName)) {
    throw new Error(`Pack "${packName}" is not editable`);
  }

  if (updates.author !== undefined) {
    pack.author = updates.author;
  }
  if (updates.coverUrl !== undefined) {
    pack.coverUrl = updates.coverUrl;
  }

  saveSettings();
}

/**
 * Add or update a Lumia item in a pack
 * @param {string} packName - The pack name
 * @param {Object} lumiaItem - The Lumia item to add/update
 * @param {string} originalName - Original name if editing (for rename detection)
 * @returns {Object} The added/updated item
 */
export function addLumiaToPackItems(packName, lumiaItem, originalName = null) {
  const settings = getSettings();
  const pack = settings.packs[packName];

  if (!pack) {
    throw new Error(`Pack "${packName}" not found`);
  }

  if (!canEditPack(packName)) {
    throw new Error(`Pack "${packName}" is not editable`);
  }

  // Check if we're editing an existing item
  const searchName = originalName || lumiaItem.lumiaDefName;
  const existingIndex = pack.items.findIndex(
    (item) => item.lumiaDefName === searchName
  );

  if (existingIndex >= 0) {
    // Update existing
    pack.items[existingIndex] = { ...pack.items[existingIndex], ...lumiaItem };
  } else {
    // Add new
    pack.items.push(lumiaItem);
  }

  saveSettings();
  return lumiaItem;
}

/**
 * Delete a Lumia from a pack
 * @param {string} packName - The pack name
 * @param {string} itemName - The Lumia name to delete
 */
export function deleteLumiaFromPack(packName, itemName) {
  const settings = getSettings();
  const pack = settings.packs[packName];

  if (!pack) {
    throw new Error(`Pack "${packName}" not found`);
  }

  if (!canEditPack(packName)) {
    throw new Error(`Pack "${packName}" is not editable`);
  }

  const index = pack.items.findIndex((item) => item.lumiaDefName === itemName);
  if (index >= 0) {
    pack.items.splice(index, 1);

    // Clean up any selections referencing this item
    if (
      settings.selectedDefinition &&
      settings.selectedDefinition.packName === packName &&
      settings.selectedDefinition.itemName === itemName
    ) {
      settings.selectedDefinition = null;
    }

    settings.selectedBehaviors = settings.selectedBehaviors.filter(
      (s) => !(s.packName === packName && s.itemName === itemName)
    );

    settings.selectedPersonalities = settings.selectedPersonalities.filter(
      (s) => !(s.packName === packName && s.itemName === itemName)
    );

    if (
      settings.dominantBehavior &&
      settings.dominantBehavior.packName === packName &&
      settings.dominantBehavior.itemName === itemName
    ) {
      settings.dominantBehavior = null;
    }

    if (
      settings.dominantPersonality &&
      settings.dominantPersonality.packName === packName &&
      settings.dominantPersonality.itemName === itemName
    ) {
      settings.dominantPersonality = null;
    }

    saveSettings();
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
  const name = lumiaItem.lumiaDefName;
  let comment = "";
  let content = "";

  if (entryType === "definition") {
    comment = `Lumia (${name})`;
    // Build content with metadata tags
    let contentParts = [];
    if (lumiaItem.lumia_img) {
      contentParts.push(`[lumia_img=${lumiaItem.lumia_img}]`);
    }
    if (lumiaItem.defAuthor) {
      contentParts.push(`[lumia_author=${lumiaItem.defAuthor}]`);
    }
    if (lumiaItem.lumiaDef) {
      contentParts.push(lumiaItem.lumiaDef);
    }
    content = contentParts.join("\n");
  } else if (entryType === "behavior") {
    comment = `Behavior (${name})`;
    content = lumiaItem.lumia_behavior || "";
  } else if (entryType === "personality") {
    comment = `Personality (${name})`;
    content = lumiaItem.lumia_personality || "";
  }

  return {
    ...DEFAULT_WB_ENTRY,
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
  const settings = getSettings();
  const pack = settings.packs[packName];

  if (!pack) {
    throw new Error(`Pack "${packName}" not found`);
  }

  const entries = {};
  let uid = 0;

  for (const item of pack.items) {
    // Skip non-Lumia items (Loom items)
    if (!item.lumiaDefName) continue;

    // Always add definition entry
    if (item.lumiaDef) {
      entries[uid] = serializeLumiaToWorldBookEntry(item, "definition", uid);
      uid++;
    }

    // Add behavior entry if present
    if (item.lumia_behavior) {
      entries[uid] = serializeLumiaToWorldBookEntry(item, "behavior", uid);
      uid++;
    }

    // Add personality entry if present
    if (item.lumia_personality) {
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
  const settings = getSettings();
  return Object.values(settings.packs).filter(
    (pack) => pack.isCustom || !pack.url
  );
}

/**
 * Apply viewport-aware height constraints to a modal
 * @param {jQuery} $modal - The modal jQuery element
 */
function applyModalHeightConstraints($modal) {
  const modal = $modal[0];
  if (!modal) return;

  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth;

  const isMobile = viewportWidth <= 600;
  const verticalMargin = isMobile ? 24 : 48;
  const maxModalHeight = viewportHeight - verticalMargin;

  modal.style.maxHeight = `${maxModalHeight}px`;

  const $header = $modal.find(".lumia-modal-header");
  const $footer = $modal.find(".lumia-modal-footer");
  const $content = $modal.find(".lumia-modal-content");

  requestAnimationFrame(() => {
    const headerHeight = $header.length ? $header[0].offsetHeight : 0;
    const footerHeight = $footer.length ? $footer[0].offsetHeight : 0;
    const maxContentHeight = maxModalHeight - headerHeight - footerHeight;

    if ($content.length) {
      $content[0].style.maxHeight = `${maxContentHeight}px`;
      $content[0].style.overflowY = "auto";
    }
  });

  const resizeHandler = () => {
    const newViewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const newMaxHeight = newViewportHeight - verticalMargin;
    modal.style.maxHeight = `${newMaxHeight}px`;

    const headerHeight = $header.length ? $header[0].offsetHeight : 0;
    const footerHeight = $footer.length ? $footer[0].offsetHeight : 0;
    const newMaxContentHeight = newMaxHeight - headerHeight - footerHeight;

    if ($content.length) {
      $content[0].style.maxHeight = `${newMaxContentHeight}px`;
    }
  };

  window.addEventListener("resize", resizeHandler);
  modal._resizeCleanup = () =>
    window.removeEventListener("resize", resizeHandler);
}

/**
 * Show the pack selector modal
 * @param {Function} onSelect - Callback when pack is selected: (packName, isNew) => void
 */
export function showPackSelectorModal(onSelect) {
  const settings = getSettings();
  const customPacks = getCustomPacks();

  $("#lumia-pack-selector-modal").remove();

  let packsHtml = "";

  if (customPacks.length > 0) {
    packsHtml = customPacks
      .map(
        (pack) => `
      <div class="lumia-pack-option" data-pack="${escapeHtml(pack.name)}">
        <div class="lumia-pack-option-icon">
          ${SVG_ICONS.folder}
        </div>
        <div class="lumia-pack-option-info">
          <div class="lumia-pack-option-name">${escapeHtml(pack.name)}</div>
          <div class="lumia-pack-option-meta">${pack.items.filter((i) => i.lumiaDefName).length} Lumias${pack.author ? ` • by ${escapeHtml(pack.author)}` : ""}</div>
        </div>
        <div class="lumia-pack-option-check">
          ${SVG_ICONS.check}
        </div>
      </div>
    `
      )
      .join("");
  } else {
    packsHtml = `
      <div class="lumia-pack-empty">
        <p>No custom packs yet. Create your first one!</p>
      </div>
    `;
  }

  const modalHtml = `
    <dialog id="lumia-pack-selector-modal" class="popup popup--animation-fast lumia-modal lumia-modal-pack-selector">
      <div class="lumia-modal-header">
        <div class="lumia-modal-header-icon">
          ${SVG_ICONS.folder}
        </div>
        <div class="lumia-modal-header-text">
          <h3 class="lumia-modal-title">Select Pack</h3>
          <p class="lumia-modal-subtitle">Choose a pack to add your Lumia to</p>
        </div>
      </div>
      <div class="lumia-modal-content">
        <div class="lumia-pack-options">
          ${packsHtml}
        </div>

        <div class="lumia-divider-text">or</div>

        <div class="lumia-new-pack-section">
          <div class="lumia-new-pack-header">
            <span class="lumia-new-pack-icon">${SVG_ICONS.folderPlus}</span>
            <span>Create New Pack</span>
          </div>
          <div class="lumia-new-pack-form">
            <input type="text" id="lumia-new-pack-name" class="lumia-input" placeholder="Pack name (required)" />
            <input type="text" id="lumia-new-pack-author" class="lumia-input" placeholder="Author name (optional)" />
            <input type="text" id="lumia-new-pack-cover" class="lumia-input" placeholder="Cover image URL (optional)" />
            <button class="lumia-btn lumia-btn-primary lumia-btn-full lumia-create-pack-btn">
              ${SVG_ICONS.plus}
              <span>Create Pack</span>
            </button>
          </div>
        </div>
      </div>
      <div class="lumia-modal-footer">
        <button class="lumia-modal-btn lumia-modal-btn-secondary lumia-modal-close-btn">Cancel</button>
      </div>
    </dialog>
  `;

  $("body").append(modalHtml);
  const $modal = $("#lumia-pack-selector-modal");

  applyModalHeightConstraints($modal);

  const closeModal = () => {
    if ($modal[0]._resizeCleanup) {
      $modal[0]._resizeCleanup();
    }
    $modal[0].close();
    $modal.remove();
  };

  // Stop propagation
  $modal.on("click mousedown mouseup", function (e) {
    e.stopPropagation();
    if (e.type === "click" && e.target === this) closeModal();
  });

  $modal.find(".lumia-modal-close-btn").click(closeModal);

  $modal.on("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  // Handle pack selection
  $modal.find(".lumia-pack-option").click(function () {
    const packName = $(this).data("pack");
    closeModal();
    onSelect(packName, false);
  });

  // Handle new pack creation
  $modal.find(".lumia-create-pack-btn").click(function () {
    const name = $("#lumia-new-pack-name").val().trim();
    const author = $("#lumia-new-pack-author").val().trim();
    const coverUrl = $("#lumia-new-pack-cover").val().trim();

    if (!name) {
      toastr.error("Pack name is required");
      return;
    }

    if (settings.packs[name]) {
      toastr.error(`Pack "${name}" already exists`);
      return;
    }

    try {
      createCustomPack(name, author, coverUrl);
      toastr.success(`Pack "${name}" created!`);
      closeModal();
      onSelect(name, true);
    } catch (error) {
      toastr.error(error.message);
    }
  });

  $modal[0].showModal();
}

/**
 * Show the Lumia Editor modal
 * @param {Object} editingItem - Optional existing item to edit
 * @param {string} packName - Optional pack name (required if editing)
 */
export function showLumiaEditorModal(editingItem = null, packName = null) {
  const isEditing = editingItem !== null;

  // If creating new and no pack specified, show pack selector first
  if (!isEditing && !packName) {
    showPackSelectorModal((selectedPack, isNew) => {
      showLumiaEditorModal(null, selectedPack);
    });
    return;
  }

  $("#lumia-editor-modal").remove();

  // Pre-fill values if editing
  const name = isEditing ? editingItem.lumiaDefName || "" : "";
  const avatarUrl = isEditing ? editingItem.lumia_img || "" : "";
  const author = isEditing ? editingItem.defAuthor || "" : "";
  const physicality = isEditing ? editingItem.lumiaDef || "" : "";
  const personality = isEditing ? editingItem.lumia_personality || "" : "";
  const behavior = isEditing ? editingItem.lumia_behavior || "" : "";

  const modalHtml = `
    <dialog id="lumia-editor-modal" class="popup popup--animation-fast lumia-modal lumia-modal-editor">
      <div class="lumia-modal-header">
        <div class="lumia-modal-header-icon">
          ${isEditing ? SVG_ICONS.edit : SVG_ICONS.plus}
        </div>
        <div class="lumia-modal-header-text">
          <h3 class="lumia-modal-title">${isEditing ? "Edit Lumia" : "Create Lumia"}</h3>
          <p class="lumia-modal-subtitle">Pack: ${escapeHtml(packName)}</p>
        </div>
      </div>
      <div class="lumia-modal-content">
        <div class="lumia-editor-form">
          <!-- Basic Info Section -->
          <div class="lumia-editor-section">
            <div class="lumia-editor-section-header">
              <span class="lumia-editor-section-icon">${SVG_ICONS.user}</span>
              <span>Basic Info</span>
            </div>
            <div class="lumia-editor-section-content">
              <div class="lumia-editor-field">
                <label class="lumia-editor-label" for="lumia-edit-name">
                  Lumia Name <span class="lumia-required">*</span>
                </label>
                <input type="text" id="lumia-edit-name" class="lumia-input"
                       placeholder="e.g., Aria, Luna, Sage"
                       value="${escapeHtml(name)}" />
                <span class="lumia-editor-hint">Will be saved as "Lumia (Name)"</span>
              </div>

              <div class="lumia-editor-row">
                <div class="lumia-editor-field lumia-editor-field-half">
                  <label class="lumia-editor-label" for="lumia-edit-avatar">
                    Avatar URL
                  </label>
                  <input type="text" id="lumia-edit-avatar" class="lumia-input"
                         placeholder="https://..."
                         value="${escapeHtml(avatarUrl)}" />
                </div>
                <div class="lumia-editor-field lumia-editor-field-half">
                  <label class="lumia-editor-label" for="lumia-edit-author">
                    Author
                  </label>
                  <input type="text" id="lumia-edit-author" class="lumia-input"
                         placeholder="Your name"
                         value="${escapeHtml(author)}" />
                </div>
              </div>

              ${avatarUrl ? `<div class="lumia-editor-preview"><img src="${escapeHtml(avatarUrl)}" alt="Avatar preview" /></div>` : ""}
            </div>
          </div>

          <!-- Physicality Section -->
          <div class="lumia-editor-section">
            <div class="lumia-editor-section-header">
              <span class="lumia-editor-section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </span>
              <span>Lumia Physicality</span>
            </div>
            <div class="lumia-editor-section-content">
              <div class="lumia-editor-field">
                <label class="lumia-editor-label" for="lumia-edit-physicality">
                  Physical Definition
                </label>
                <textarea id="lumia-edit-physicality" class="lumia-textarea"
                          placeholder="Describe Lumia's physical appearance, form, and presence..."
                          rows="6">${escapeHtml(physicality)}</textarea>
                <span class="lumia-editor-hint">Injected via {{lumiaDef}} macro</span>
              </div>
            </div>
          </div>

          <!-- Personality Section -->
          <div class="lumia-editor-section">
            <div class="lumia-editor-section-header">
              <span class="lumia-editor-section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                  <line x1="9" y1="9" x2="9.01" y2="9"></line>
                  <line x1="15" y1="9" x2="15.01" y2="9"></line>
                </svg>
              </span>
              <span>Lumia Personality</span>
            </div>
            <div class="lumia-editor-section-content">
              <div class="lumia-editor-field">
                <label class="lumia-editor-label" for="lumia-edit-personality">
                  Personality Traits
                </label>
                <textarea id="lumia-edit-personality" class="lumia-textarea"
                          placeholder="Describe Lumia's personality, disposition, and inner nature..."
                          rows="6">${escapeHtml(personality)}</textarea>
                <span class="lumia-editor-hint">Injected via {{lumiaPersonality}} macro</span>
              </div>
            </div>
          </div>

          <!-- Behavior Section -->
          <div class="lumia-editor-section">
            <div class="lumia-editor-section-header">
              <span class="lumia-editor-section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                </svg>
              </span>
              <span>Lumia Behavior Traits</span>
            </div>
            <div class="lumia-editor-section-content">
              <div class="lumia-editor-field">
                <label class="lumia-editor-label" for="lumia-edit-behavior">
                  Behavioral Patterns
                </label>
                <textarea id="lumia-edit-behavior" class="lumia-textarea"
                          placeholder="Describe Lumia's behavioral patterns, habits, and tendencies..."
                          rows="6">${escapeHtml(behavior)}</textarea>
                <span class="lumia-editor-hint">Injected via {{lumiaBehavior}} macro</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="lumia-modal-footer">
        ${isEditing ? `<button class="lumia-modal-btn lumia-modal-btn-danger lumia-editor-delete-btn">${SVG_ICONS.trash} Delete</button>` : ""}
        <div class="lumia-modal-footer-spacer"></div>
        <button class="lumia-modal-btn lumia-modal-btn-secondary lumia-modal-close-btn">Cancel</button>
        <button class="lumia-modal-btn lumia-modal-btn-primary lumia-editor-save-btn">
          ${isEditing ? "Save Changes" : "Create Lumia"}
        </button>
      </div>
    </dialog>
  `;

  $("body").append(modalHtml);
  const $modal = $("#lumia-editor-modal");

  applyModalHeightConstraints($modal);

  const closeModal = () => {
    if ($modal[0]._resizeCleanup) {
      $modal[0]._resizeCleanup();
    }
    $modal[0].close();
    $modal.remove();
  };

  // Stop propagation
  $modal.on("click mousedown mouseup", function (e) {
    e.stopPropagation();
    if (e.type === "click" && e.target === this) closeModal();
  });

  $modal.find(".lumia-modal-close-btn").click(closeModal);

  $modal.on("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  // Avatar preview on URL change
  $("#lumia-edit-avatar").on("input", function () {
    const url = $(this).val().trim();
    const $preview = $modal.find(".lumia-editor-preview");

    if (url) {
      if ($preview.length) {
        $preview.find("img").attr("src", url);
      } else {
        $(this)
          .closest(".lumia-editor-row")
          .after(
            `<div class="lumia-editor-preview"><img src="${escapeHtml(url)}" alt="Avatar preview" /></div>`
          );
      }
    } else {
      $preview.remove();
    }
  });

  // Save handler
  $modal.find(".lumia-editor-save-btn").click(function () {
    const newName = $("#lumia-edit-name").val().trim();
    const newAvatarUrl = $("#lumia-edit-avatar").val().trim();
    const newAuthor = $("#lumia-edit-author").val().trim();
    const newPhysicality = $("#lumia-edit-physicality").val().trim();
    const newPersonality = $("#lumia-edit-personality").val().trim();
    const newBehavior = $("#lumia-edit-behavior").val().trim();

    // Validation
    if (!newName) {
      toastr.error("Lumia name is required");
      return;
    }

    // Check for duplicate name (if creating new or renaming)
    const settings = getSettings();
    const pack = settings.packs[packName];
    if (pack) {
      const existingItem = pack.items.find(
        (item) =>
          item.lumiaDefName === newName &&
          (!isEditing || item.lumiaDefName !== editingItem.lumiaDefName)
      );
      if (existingItem) {
        toastr.error(`A Lumia named "${newName}" already exists in this pack`);
        return;
      }
    }

    // Build the Lumia item
    const lumiaItem = {
      lumiaDefName: newName,
      lumia_img: newAvatarUrl || null,
      defAuthor: newAuthor || null,
      lumiaDef: newPhysicality || null,
      lumia_personality: newPersonality || null,
      lumia_behavior: newBehavior || null,
    };

    try {
      addLumiaToPackItems(
        packName,
        lumiaItem,
        isEditing ? editingItem.lumiaDefName : null
      );
      toastr.success(
        isEditing
          ? `Lumia "${newName}" updated!`
          : `Lumia "${newName}" created!`
      );
      closeModal();
      refreshUI();
    } catch (error) {
      toastr.error(error.message);
    }
  });

  // Delete handler
  if (isEditing) {
    $modal.find(".lumia-editor-delete-btn").click(function () {
      if (
        confirm(
          `Are you sure you want to delete "${editingItem.lumiaDefName}"? This cannot be undone.`
        )
      ) {
        try {
          deleteLumiaFromPack(packName, editingItem.lumiaDefName);
          toastr.success(`Lumia "${editingItem.lumiaDefName}" deleted`);
          closeModal();
          refreshUI();
        } catch (error) {
          toastr.error(error.message);
        }
      }
    });
  }

  $modal[0].showModal();
}

/**
 * Show the pack editor modal for editing pack metadata
 * @param {string} packName - The pack name to edit
 */
export function showPackEditorModal(packName) {
  const settings = getSettings();
  const pack = settings.packs[packName];

  if (!pack) {
    toastr.error(`Pack "${packName}" not found`);
    return;
  }

  if (!canEditPack(packName)) {
    toastr.error(`Pack "${packName}" cannot be edited`);
    return;
  }

  $("#lumia-pack-editor-modal").remove();

  const modalHtml = `
    <dialog id="lumia-pack-editor-modal" class="popup popup--animation-fast lumia-modal lumia-modal-pack-editor">
      <div class="lumia-modal-header">
        <div class="lumia-modal-header-icon">
          ${SVG_ICONS.edit}
        </div>
        <div class="lumia-modal-header-text">
          <h3 class="lumia-modal-title">Edit Pack</h3>
          <p class="lumia-modal-subtitle">${escapeHtml(packName)}</p>
        </div>
      </div>
      <div class="lumia-modal-content">
        <div class="lumia-editor-form">
          <div class="lumia-editor-field">
            <label class="lumia-editor-label" for="lumia-pack-author">
              Author Name
            </label>
            <input type="text" id="lumia-pack-author" class="lumia-input"
                   placeholder="Your name"
                   value="${escapeHtml(pack.author || "")}" />
          </div>

          <div class="lumia-editor-field">
            <label class="lumia-editor-label" for="lumia-pack-cover">
              Cover Image URL
            </label>
            <input type="text" id="lumia-pack-cover" class="lumia-input"
                   placeholder="https://..."
                   value="${escapeHtml(pack.coverUrl || "")}" />
          </div>

          ${pack.coverUrl ? `<div class="lumia-editor-preview lumia-pack-cover-preview"><img src="${escapeHtml(pack.coverUrl)}" alt="Cover preview" /></div>` : ""}

          <div class="lumia-divider-text">Export</div>

          <button class="lumia-btn lumia-btn-secondary lumia-btn-full lumia-export-pack-btn">
            ${SVG_ICONS.download}
            <span>Export as World Book</span>
          </button>
          <span class="lumia-editor-hint">Download this pack in SillyTavern World Book format</span>
        </div>
      </div>
      <div class="lumia-modal-footer">
        <button class="lumia-modal-btn lumia-modal-btn-secondary lumia-modal-close-btn">Cancel</button>
        <button class="lumia-modal-btn lumia-modal-btn-primary lumia-pack-save-btn">Save Changes</button>
      </div>
    </dialog>
  `;

  $("body").append(modalHtml);
  const $modal = $("#lumia-pack-editor-modal");

  applyModalHeightConstraints($modal);

  const closeModal = () => {
    if ($modal[0]._resizeCleanup) {
      $modal[0]._resizeCleanup();
    }
    $modal[0].close();
    $modal.remove();
  };

  $modal.on("click mousedown mouseup", function (e) {
    e.stopPropagation();
    if (e.type === "click" && e.target === this) closeModal();
  });

  $modal.find(".lumia-modal-close-btn").click(closeModal);

  $modal.on("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  // Cover preview on URL change
  $("#lumia-pack-cover").on("input", function () {
    const url = $(this).val().trim();
    const $preview = $modal.find(".lumia-pack-cover-preview");

    if (url) {
      if ($preview.length) {
        $preview.find("img").attr("src", url);
      } else {
        $(this)
          .closest(".lumia-editor-field")
          .after(
            `<div class="lumia-editor-preview lumia-pack-cover-preview"><img src="${escapeHtml(url)}" alt="Cover preview" /></div>`
          );
      }
    } else {
      $preview.remove();
    }
  });

  // Export handler
  $modal.find(".lumia-export-pack-btn").click(function () {
    exportPackAsWorldBook(packName);
  });

  // Save handler
  $modal.find(".lumia-pack-save-btn").click(function () {
    const newAuthor = $("#lumia-pack-author").val().trim();
    const newCoverUrl = $("#lumia-pack-cover").val().trim();

    try {
      updatePackMetadata(packName, {
        author: newAuthor,
        coverUrl: newCoverUrl,
      });
      toastr.success("Pack updated!");
      closeModal();
      refreshUI();
    } catch (error) {
      toastr.error(error.message);
    }
  });

  $modal[0].showModal();
}
