/**
 * UI Modals Module
 * Handles all modal dialog rendering and interaction for Lumia Injector
 */

import { getSettings, saveSettings, MODULE_NAME } from './settingsManager.js';
import { getItemFromLibrary, escapeHtml } from './dataProcessor.js';
import { generateLoomSummary, getProviderDefaults } from './summarization.js';

// Note: processAllLumiaOOCComments is imported dynamically to avoid circular dependency
let processAllLumiaOOCCommentsRef = null;

/**
 * Set the processAllLumiaOOCComments function reference
 * Called by index.js after all modules and stuff are loaded
 * @param {Function} fn - The function reference
 */
export function setProcessAllLumiaOOCCommentsRef(fn) {
    processAllLumiaOOCCommentsRef = fn;
}

// Callback for UI refresh - set by index.js
let refreshUICallback = null;

/**
 * Set the refresh UI callback
 * @param {Function} callback - The callback function to call when UI needs refresh
 */
export function setRefreshUICallback(callback) {
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

// SVG icons for card UI (inline to avoid external dependencies)
const SVG_ICONS = {
    star: `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    check: `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
    clear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`
};

/**
 * Apply viewport-aware height constraints to a modal
 * Ensures the modal fits within the viewport with footer visible
 * @param {jQuery} $modal - The modal jQuery element
 */
function applyModalHeightConstraints($modal) {
    const modal = $modal[0];
    if (!modal) return;

    // Get viewport dimensions
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

    // Calculate safe margins (more margin on mobile)
    const isMobile = viewportWidth <= 600;
    const verticalMargin = isMobile ? 24 : 48; // Total vertical margin (top + bottom)

    // Calculate max height for the modal
    const maxModalHeight = viewportHeight - verticalMargin;

    // Apply height constraints via inline style (overrides CSS)
    modal.style.maxHeight = `${maxModalHeight}px`;

    // Get the modal's internal elements
    const $header = $modal.find('.lumia-modal-header');
    const $footer = $modal.find('.lumia-modal-footer');
    const $content = $modal.find('.lumia-modal-content');

    // Calculate header and footer heights after modal is rendered
    // Use requestAnimationFrame to ensure DOM is painted
    requestAnimationFrame(() => {
        const headerHeight = $header.length ? $header[0].offsetHeight : 0;
        const footerHeight = $footer.length ? $footer[0].offsetHeight : 0;

        // Calculate max content height
        const maxContentHeight = maxModalHeight - headerHeight - footerHeight;

        // Apply to content area
        if ($content.length) {
            $content[0].style.maxHeight = `${maxContentHeight}px`;
            $content[0].style.overflowY = 'auto';
        }
    });

    // Also handle window resize
    const resizeHandler = () => {
        const newViewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const newMaxHeight = newViewportHeight - verticalMargin;
        modal.style.maxHeight = `${newMaxHeight}px`;

        const headerHeight = $header.length ? $header[0].offsetHeight : 0;
        const footerHeight = $footer.length ? $footer[0].offsetHeight : 0;
        const newMaxContentHeight = newMaxHeight - headerHeight - footerHeight;

        if ($content.length) {
            $content[0].style.maxHeight = `${newMaxContentHeight}px`;
        }
    };

    // Attach resize listener and store cleanup reference
    window.addEventListener('resize', resizeHandler);

    // Store cleanup function on the modal element for later removal
    modal._resizeCleanup = () => window.removeEventListener('resize', resizeHandler);
}

/**
 * Show the selection modal for definitions, behaviors, or personalities
 * @param {string} type - 'definition' | 'behavior' | 'personality'
 */
export function showSelectionModal(type) {
    const settings = getSettings();
    const packs = Object.values(settings.packs);

    let title = "";
    let subtitle = "";
    let isMulti = false;
    let dominantKey = null;
    let headerIcon = "";

    if (type === 'definition') {
        title = "Select Definition";
        subtitle = "Choose the physical form for your Lumia";
        isMulti = false;
        headerIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
        </svg>`;
    } else if (type === 'behavior') {
        title = "Select Behaviors";
        subtitle = "Choose behavioral traits (tap star for dominant)";
        isMulti = true;
        dominantKey = 'dominantBehavior';
        headerIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>`;
    } else if (type === 'personality') {
        title = "Select Personalities";
        subtitle = "Choose personality traits (tap star for dominant)";
        isMulti = true;
        dominantKey = 'dominantPersonality';
        headerIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
            <path d="M12 2a10 10 0 0 1 10 10"></path>
            <circle cx="12" cy="12" r="6"></circle>
        </svg>`;
    }

    $("#lumia-selection-modal").remove();

    // Build HTML for each pack
    let contentHtml = "";

    if (packs.length === 0) {
        contentHtml = '<div class="lumia-modal-empty">No Lumia Packs loaded. Add one in settings!</div>';
    } else {
        packs.forEach(pack => {
            const packItems = pack.items;
            if (!packItems || packItems.length === 0) return;

            // Render Items as cards with images
            const itemsHtml = packItems.map(item => {
                const currentDefName = item.lumiaDefName;
                const escapedPackName = escapeHtml(pack.name);
                const escapedItemName = escapeHtml(currentDefName);
                const imgToShow = item.lumia_img;

                // Check selection
                let isSelected = false;
                if (isMulti) {
                    const collection = type === 'behavior' ? settings.selectedBehaviors : settings.selectedPersonalities;
                    isSelected = collection.some(s => s.packName === pack.name && s.itemName === currentDefName);
                } else {
                    const sel = settings.selectedDefinition;
                    isSelected = sel && sel.packName === pack.name && sel.itemName === currentDefName;
                }

                // Check if this is the dominant trait (only for behaviors/personalities)
                let isDominant = false;
                if (dominantKey && settings[dominantKey]) {
                    isDominant = settings[dominantKey].packName === pack.name &&
                                 settings[dominantKey].itemName === currentDefName;
                }

                const cardClass = type === 'definition' ? 'definition-card' : '';
                const showDominant = dominantKey !== null;

                return `
                <div class="lumia-card ${cardClass} ${isSelected ? 'selected' : ''}"
                     data-pack="${escapedPackName}"
                     data-item="${escapedItemName}">
                    <div class="lumia-card-image">
                        ${imgToShow ? `<img src="${imgToShow}" alt="${escapedItemName}">` : `<div class="lumia-card-placeholder">?</div>`}
                        ${showDominant ? `
                        <div class="lumia-dominant-icon ${isDominant ? 'dominant' : ''}"
                             data-pack="${escapedPackName}"
                             data-item="${escapedItemName}"
                             title="${isDominant ? 'Remove as dominant' : 'Set as dominant trait'}">
                            ${SVG_ICONS.star}
                        </div>
                        ` : ''}
                        <div class="lumia-card-check">
                            ${SVG_ICONS.check}
                        </div>
                    </div>
                    <div class="lumia-card-info">
                        <div class="lumia-card-name">${currentDefName || "Unknown"}</div>
                    </div>
                </div>
                `;
            }).join("");

            contentHtml += `
            <div class="lumia-modal-panel lumia-collapsible">
                <div class="lumia-modal-panel-header lumia-collapsible-trigger">
                    <span class="lumia-panel-collapse-icon">
                        ${SVG_ICONS.chevron}
                    </span>
                    <span class="lumia-modal-panel-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </span>
                    <span class="lumia-modal-panel-title">${pack.name}</span>
                    <span class="lumia-modal-panel-count">${packItems.length} items</span>
                    <button class="lumia-icon-btn-sm lumia-remove-pack-btn" data-pack="${escapeHtml(pack.name)}" title="Remove Pack">
                        ${SVG_ICONS.trash}
                    </button>
                </div>
                <div class="lumia-modal-panel-content lumia-modal-panel-content-cards lumia-collapsible-content">
                    <div class="lumia-card-grid">
                        ${itemsHtml}
                    </div>
                </div>
            </div>
            `;
        });
    }

    const modalHtml = `
        <dialog id="lumia-selection-modal" class="popup popup--animation-fast lumia-modal lumia-modal-selection">
            <div class="lumia-modal-header">
                <div class="lumia-modal-header-icon">
                    ${headerIcon}
                </div>
                <div class="lumia-modal-header-text">
                    <h3 class="lumia-modal-title">${title}</h3>
                    <p class="lumia-modal-subtitle">${subtitle}</p>
                </div>
                <button class="lumia-clear-btn" title="Clear all selections">
                    ${SVG_ICONS.clear}
                    <span>Clear</span>
                </button>
            </div>
            <div class="lumia-modal-content">
                ${contentHtml}
            </div>
            <div class="lumia-modal-footer">
                <button class="lumia-modal-btn lumia-modal-btn-secondary lumia-modal-close-btn">Close</button>
                ${isMulti ? '<button class="lumia-modal-btn lumia-modal-btn-primary lumia-modal-done">Done</button>' : ''}
            </div>
        </dialog>
    `;

    $("body").append(modalHtml);
    const $modal = $("#lumia-selection-modal");

    // Calculate and apply proper height constraints
    applyModalHeightConstraints($modal);

    const closeModal = () => {
        // Clean up resize listener
        if ($modal[0]._resizeCleanup) {
            $modal[0]._resizeCleanup();
        }
        $modal[0].close();
        $modal.remove();
        refreshUI();
    };

    // Stop propagation on modal to prevent ST from closing the drawer
    $modal.on("click mousedown mouseup", function(e) {
        e.stopPropagation();
        // Close if clicking the dialog backdrop (outside modal content)
        if (e.type === "click" && e.target === this) closeModal();
    });

    $modal.find(".lumia-modal-close-btn, .lumia-modal-done").click(closeModal);

    $modal.on("keydown", function (e) {
        if (e.key === "Escape") closeModal();
    });

    // Handle Collapsible Panels
    $modal.find(".lumia-collapsible-trigger").click(function(e) {
        // Don't collapse if clicking on remove button
        if ($(e.target).closest('.lumia-remove-pack-btn').length > 0) {
            return;
        }
        $(this).closest('.lumia-collapsible').toggleClass('collapsed');
    });

    // Handle Clear Selection
    $modal.find(".lumia-clear-btn").click(function(e) {
        e.stopPropagation();

        // Clear selections based on type
        if (type === 'definition') {
            settings.selectedDefinition = null;
        } else if (type === 'behavior') {
            settings.selectedBehaviors = [];
            settings.dominantBehavior = null;
        } else if (type === 'personality') {
            settings.selectedPersonalities = [];
            settings.dominantPersonality = null;
        }

        saveSettings();

        // Update UI - remove selected state from all cards
        $modal.find('.lumia-card').removeClass('selected');
        $modal.find('.lumia-dominant-icon').removeClass('dominant');

        toastr.info(`${title.replace('Select ', '')} cleared`);
    });

    // Handle Remove Pack
    $modal.find(".lumia-remove-pack-btn").click(function(e) {
        e.stopPropagation();
        const packName = $(this).data("pack");
        if (confirm(`Are you sure you want to remove the pack "${packName}"?`)) {
            delete settings.packs[packName];

            // Clean up selections
            if (settings.selectedDefinition && settings.selectedDefinition.packName === packName) {
                settings.selectedDefinition = null;
            }
            settings.selectedBehaviors = settings.selectedBehaviors.filter(s => s.packName !== packName);
            settings.selectedPersonalities = settings.selectedPersonalities.filter(s => s.packName !== packName);

            // Clean up dominant selections
            if (settings.dominantBehavior && settings.dominantBehavior.packName === packName) {
                settings.dominantBehavior = null;
            }
            if (settings.dominantPersonality && settings.dominantPersonality.packName === packName) {
                settings.dominantPersonality = null;
            }

            saveSettings();

            $(this).closest(".lumia-modal-panel").remove();

            if (Object.keys(settings.packs).length === 0) {
                closeModal();
            }
        }
    });

    // Handle Dominant Icon Click (for behaviors/personalities)
    if (dominantKey) {
        $modal.find(".lumia-dominant-icon").click(function(e) {
            e.stopPropagation(); // Don't trigger card selection

            const packName = $(this).data("pack");
            const itemName = $(this).data("item");
            const $icon = $(this);

            // Check if this item is currently selected
            const collection = type === 'behavior' ? settings.selectedBehaviors : settings.selectedPersonalities;
            const isItemSelected = collection.some(s => s.packName === packName && s.itemName === itemName);

            // If the item isn't selected, select it first
            if (!isItemSelected) {
                collection.push({ packName, itemName });
                if (type === 'behavior') settings.selectedBehaviors = collection;
                else settings.selectedPersonalities = collection;

                // Update card UI to show selected
                $icon.closest('.lumia-card').addClass('selected');
            }

            // Toggle dominant status
            const currentDominant = settings[dominantKey];
            const isCurrentlyDominant = currentDominant &&
                                        currentDominant.packName === packName &&
                                        currentDominant.itemName === itemName;

            if (isCurrentlyDominant) {
                // Remove dominant status
                settings[dominantKey] = null;
                $icon.removeClass('dominant');
            } else {
                // Set as new dominant (remove from previous)
                $modal.find(".lumia-dominant-icon").removeClass('dominant');
                settings[dominantKey] = { packName, itemName };
                $icon.addClass('dominant');
            }

            saveSettings();
        });
    }

    // Handle Item/Card Selection
    $modal.find(".lumia-card").click(function(e) {
        // Don't trigger if clicking on dominant icon
        if ($(e.target).closest('.lumia-dominant-icon').length > 0) {
            return;
        }

        const packName = $(this).data("pack");
        const itemName = $(this).data("item");

        if (!isMulti) {
            // Single select (Definition) - deselect all others first, keep modal open
            $modal.find('.lumia-card').removeClass('selected');
            $(this).addClass('selected');
            settings.selectedDefinition = { packName, itemName };
            saveSettings();
        } else {
            const $this = $(this);
            let collection = (type === 'behavior') ? settings.selectedBehaviors : settings.selectedPersonalities;

            const existsIdx = collection.findIndex(s => s.packName === packName && s.itemName === itemName);

            if (existsIdx !== -1) {
                // Remove from selection
                collection.splice(existsIdx, 1);
                $this.removeClass('selected');

                // If this was the dominant, clear dominant status
                if (dominantKey && settings[dominantKey]) {
                    if (settings[dominantKey].packName === packName &&
                        settings[dominantKey].itemName === itemName) {
                        settings[dominantKey] = null;
                        $this.find('.lumia-dominant-icon').removeClass('dominant');
                    }
                }
            } else {
                // Add to selection
                collection.push({ packName, itemName });
                $this.addClass('selected');
            }

            if (type === 'behavior') settings.selectedBehaviors = collection;
            else settings.selectedPersonalities = collection;

            saveSettings();
        }
    });

    $modal[0].showModal();
}

/**
 * Show the miscellaneous features modal (OOC settings)
 */
export function showMiscFeaturesModal() {
    const settings = getSettings();

    $("#lumia-misc-modal").remove();

    const currentInterval = settings.lumiaOOCInterval || "";
    const currentStyle = settings.lumiaOOCStyle || 'social';

    const modalHtml = `
        <dialog id="lumia-misc-modal" class="popup popup--animation-fast lumia-modal lumia-modal-settings">
            <div class="lumia-modal-header">
                <div class="lumia-modal-header-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </div>
                <h3 class="lumia-modal-title">OOC Settings</h3>
            </div>
            <div class="lumia-modal-content">

                <div class="lumia-modal-panel">
                    <div class="lumia-modal-panel-header">
                        <span class="lumia-modal-panel-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </span>
                        <span class="lumia-modal-panel-title">Comment Trigger</span>
                    </div>
                    <div class="lumia-modal-panel-content">
                        <p class="lumia-modal-description">Automatically inject OOC instructions at message intervals.</p>
                        <div class="lumia-modal-field">
                            <label class="lumia-modal-label" for="lumia-ooc-interval-input">Message Interval</label>
                            <input type="number"
                                   id="lumia-ooc-interval-input"
                                   class="lumia-modal-input"
                                   placeholder="e.g., 10 (empty = disabled)"
                                   min="1"
                                   value="${escapeHtml(currentInterval.toString())}" />
                            <span class="lumia-modal-hint">Triggers when message count is divisible by this number</span>
                        </div>
                    </div>
                </div>

                <div class="lumia-modal-panel">
                    <div class="lumia-modal-panel-header">
                        <span class="lumia-modal-panel-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="3" y1="9" x2="21" y2="9"></line>
                                <line x1="9" y1="21" x2="9" y2="9"></line>
                            </svg>
                        </span>
                        <span class="lumia-modal-panel-title">Display Style</span>
                    </div>
                    <div class="lumia-modal-panel-content">
                        <p class="lumia-modal-description">Choose how OOC comments appear in chat.</p>
                        <div class="lumia-style-options">
                            <label class="lumia-style-option ${currentStyle === 'social' ? 'selected' : ''}">
                                <input type="radio" name="ooc-style" value="social" ${currentStyle === 'social' ? 'checked' : ''} />
                                <div class="lumia-style-option-content">
                                    <span class="lumia-style-option-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                            <path d="M21 15l-5-5L5 21"></path>
                                        </svg>
                                    </span>
                                    <div class="lumia-style-option-text">
                                        <span class="lumia-style-option-title">Social Card</span>
                                        <span class="lumia-style-option-desc">Full card with avatar & animations</span>
                                    </div>
                                </div>
                            </label>
                            <label class="lumia-style-option ${currentStyle === 'margin' ? 'selected' : ''}">
                                <input type="radio" name="ooc-style" value="margin" ${currentStyle === 'margin' ? 'checked' : ''} />
                                <div class="lumia-style-option-content">
                                    <span class="lumia-style-option-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14 2 14 8 20 8"></polyline>
                                        </svg>
                                    </span>
                                    <div class="lumia-style-option-text">
                                        <span class="lumia-style-option-title">Margin Note</span>
                                        <span class="lumia-style-option-desc">Minimal hanging tag style</span>
                                    </div>
                                </div>
                            </label>
                            <label class="lumia-style-option ${currentStyle === 'whisper' ? 'selected' : ''}">
                                <input type="radio" name="ooc-style" value="whisper" ${currentStyle === 'whisper' ? 'checked' : ''} />
                                <div class="lumia-style-option-content">
                                    <span class="lumia-style-option-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                                        </svg>
                                    </span>
                                    <div class="lumia-style-option-text">
                                        <span class="lumia-style-option-title">Whisper Bubble</span>
                                        <span class="lumia-style-option-desc">Soft ethereal thought bubble</span>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

            </div>
            <div class="lumia-modal-footer">
                <button class="lumia-modal-btn lumia-modal-btn-secondary lumia-misc-cancel-btn">Cancel</button>
                <button class="lumia-modal-btn lumia-modal-btn-primary lumia-misc-save-btn">Save Changes</button>
            </div>
        </dialog>
    `;

    $("body").append(modalHtml);
    const $modal = $("#lumia-misc-modal");

    // Calculate and apply proper height constraints
    applyModalHeightConstraints($modal);

    const closeModal = () => {
        // Clean up resize listener
        if ($modal[0]._resizeCleanup) {
            $modal[0]._resizeCleanup();
        }
        $modal[0].close();
        $modal.remove();
    };

    // Stop propagation on modal to prevent ST from closing the drawer
    $modal.on("click mousedown mouseup", function(e) {
        e.stopPropagation();
        // Close if clicking the dialog backdrop (outside modal content)
        if (e.type === "click" && e.target === this) closeModal();
    });

    // Handle style option selection UI
    $modal.find('.lumia-style-option input[type="radio"]').change(function() {
        $modal.find('.lumia-style-option').removeClass('selected');
        $(this).closest('.lumia-style-option').addClass('selected');
    });

    $modal.find(".lumia-misc-save-btn").click(() => {
        const intervalValue = $("#lumia-ooc-interval-input").val().trim();
        const styleValue = $modal.find('input[name="ooc-style"]:checked').val();
        const oldStyle = settings.lumiaOOCStyle;

        settings.lumiaOOCInterval = intervalValue ? parseInt(intervalValue, 10) : null;
        settings.lumiaOOCStyle = styleValue;

        saveSettings();
        toastr.success("OOC settings saved!");
        closeModal();

        // If style changed, reprocess all OOC comments to apply new style
        if (oldStyle !== styleValue && processAllLumiaOOCCommentsRef) {
            setTimeout(() => processAllLumiaOOCCommentsRef(true), 100);
        }
    });

    $modal.find(".lumia-misc-cancel-btn").click(closeModal);

    $modal.on("keydown", function (e) {
        if (e.key === "Escape") closeModal();
    });

    $modal[0].showModal();
}

/**
 * Show the Loom selection modal
 * @param {string} category - 'Narrative Style' | 'Loom Utilities' | 'Retrofits'
 */
export function showLoomSelectionModal(category) {
    const settings = getSettings();
    const packs = Object.values(settings.packs);

    let title = "";
    let subtitle = "";
    let isMulti = false;
    let settingsKey = null;
    let headerIcon = "";

    if (category === 'Narrative Style') {
        title = "Select Narrative Style";
        subtitle = "Choose how the story is told";
        isMulti = false;
        settingsKey = 'selectedLoomStyle';
        headerIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
            <path d="M2 2l7.586 7.586"></path>
            <circle cx="11" cy="11" r="2"></circle>
        </svg>`;
    } else if (category === 'Loom Utilities') {
        title = "Select Loom Utilities";
        subtitle = "Toggle utilities to enhance generation";
        isMulti = true;
        settingsKey = 'selectedLoomUtils';
        headerIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>`;
    } else if (category === 'Retrofits') {
        title = "Select Retrofits";
        subtitle = "Choose retrofit modifications";
        isMulti = true;
        settingsKey = 'selectedLoomRetrofits';
        headerIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>`;
    }

    $("#loom-selection-modal").remove();

    // Build HTML for each pack
    let contentHtml = "";

    if (packs.length === 0) {
        contentHtml = '<div class="lumia-modal-empty">No Packs loaded. Add one in settings!</div>';
    } else {
        packs.forEach(pack => {
            const packItems = pack.items;
            if (!packItems || packItems.length === 0) return;

            // Filter items by category
            const categoryItems = packItems.filter(item => item.loomCategory === category);
            if (categoryItems.length === 0) return;

            // Render Items as toggleable list items
            const itemsHtml = categoryItems.map(item => {
                // Check selection
                let isSelected = false;
                const currentItemName = item.loomName;

                if (isMulti) {
                    const collection = settings[settingsKey];
                    isSelected = collection.some(s => s.packName === pack.name && s.itemName === currentItemName);
                } else {
                    const sel = settings[settingsKey];
                    isSelected = sel && sel.packName === pack.name && sel.itemName === currentItemName;
                }

                const escapedPackName = escapeHtml(pack.name);
                const escapedItemName = escapeHtml(currentItemName);

                return `
                <div class="lumia-list-item ${isSelected ? 'selected' : ''}"
                     data-pack="${escapedPackName}"
                     data-item="${escapedItemName}">
                    <div class="lumia-list-item-content">
                        <span class="lumia-list-item-name">${currentItemName || "Unknown"}</span>
                    </div>
                    <div class="lumia-list-item-toggle">
                        ${isMulti ? `
                        <div class="lumia-toggle-switch">
                            <div class="lumia-toggle-track">
                                <div class="lumia-toggle-thumb"></div>
                            </div>
                        </div>
                        ` : `
                        <div class="lumia-radio-indicator"></div>
                        `}
                    </div>
                </div>
                `;
            }).join("");

            if (itemsHtml) {
                contentHtml += `
                <div class="lumia-modal-panel lumia-collapsible">
                    <div class="lumia-modal-panel-header lumia-collapsible-trigger">
                        <span class="lumia-panel-collapse-icon">
                            ${SVG_ICONS.chevron}
                        </span>
                        <span class="lumia-modal-panel-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </span>
                        <span class="lumia-modal-panel-title">${pack.name}</span>
                        <span class="lumia-modal-panel-count">${categoryItems.length} items</span>
                    </div>
                    <div class="lumia-modal-panel-content lumia-modal-panel-content-list lumia-collapsible-content">
                        <div class="lumia-list-group">
                            ${itemsHtml}
                        </div>
                    </div>
                </div>
                `;
            }
        });

        if (!contentHtml) {
            contentHtml = `<div class="lumia-modal-empty">No "${category}" items found in loaded packs.</div>`;
        }
    }

    const modalHtml = `
        <dialog id="loom-selection-modal" class="popup popup--animation-fast lumia-modal lumia-modal-selection">
            <div class="lumia-modal-header">
                <div class="lumia-modal-header-icon">
                    ${headerIcon}
                </div>
                <div class="lumia-modal-header-text">
                    <h3 class="lumia-modal-title">${title}</h3>
                    <p class="lumia-modal-subtitle">${subtitle}</p>
                </div>
                <button class="lumia-clear-btn" title="Clear selection">
                    ${SVG_ICONS.clear}
                    <span>Clear</span>
                </button>
            </div>
            <div class="lumia-modal-content">
                ${contentHtml}
            </div>
            <div class="lumia-modal-footer">
                <button class="lumia-modal-btn lumia-modal-btn-secondary lumia-modal-close-btn">Close</button>
                ${isMulti ? '<button class="lumia-modal-btn lumia-modal-btn-primary lumia-modal-done">Done</button>' : ''}
            </div>
        </dialog>
    `;

    $("body").append(modalHtml);
    const $modal = $("#loom-selection-modal");

    // Calculate and apply proper height constraints
    applyModalHeightConstraints($modal);

    const closeModal = () => {
        // Clean up resize listener
        if ($modal[0]._resizeCleanup) {
            $modal[0]._resizeCleanup();
        }
        $modal[0].close();
        $modal.remove();
        refreshUI();
    };

    // Stop propagation on modal to prevent ST from closing the drawer
    $modal.on("click mousedown mouseup", function(e) {
        e.stopPropagation();
        // Close if clicking the dialog backdrop (outside modal content)
        if (e.type === "click" && e.target === this) closeModal();
    });

    $modal.find(".lumia-modal-close-btn, .lumia-modal-done").click(closeModal);

    $modal.on("keydown", function (e) {
        if (e.key === "Escape") closeModal();
    });

    // Handle Collapsible Panels
    $modal.find(".lumia-collapsible-trigger").click(function(e) {
        // Don't collapse if clicking on an interactive element
        if ($(e.target).closest('.lumia-list-item').length > 0) {
            return;
        }
        $(this).closest('.lumia-collapsible').toggleClass('collapsed');
    });

    // Handle Clear Selection
    $modal.find(".lumia-clear-btn").click(function(e) {
        e.stopPropagation();

        // Clear selection based on settings key
        if (isMulti) {
            settings[settingsKey] = [];
        } else {
            settings[settingsKey] = null;
        }

        saveSettings();

        // Update UI - remove selected state from all items
        $modal.find('.lumia-list-item').removeClass('selected');

        toastr.info(`${title.replace('Select ', '')} cleared`);
    });

    // Handle Item Selection
    $modal.find(".lumia-list-item").click(function() {
        const packName = $(this).data("pack");
        const itemName = $(this).data("item");

        if (!isMulti) {
            // Single select - deselect all others first
            $modal.find('.lumia-list-item').removeClass('selected');
            $(this).addClass('selected');
            settings[settingsKey] = { packName, itemName };
            saveSettings();
            // Close after a brief delay for visual feedback
            setTimeout(closeModal, 150);
        } else {
            const $this = $(this);
            let collection = settings[settingsKey];

            const existsIdx = collection.findIndex(s => s.packName === packName && s.itemName === itemName);

            if (existsIdx !== -1) {
                // Remove
                collection.splice(existsIdx, 1);
                $this.removeClass('selected');
            } else {
                // Add
                collection.push({ packName, itemName });
                $this.addClass('selected');
            }

            settings[settingsKey] = collection;
            saveSettings();
        }
    });

    $modal[0].showModal();
}

/**
 * Show the summarization settings modal
 */
export function showSummarizationModal() {
    const settings = getSettings();

    $("#lumia-summarization-modal").remove();

    const sumSettings = settings.summarization || {};
    const secondary = sumSettings.secondary || {};

    const currentMode = sumSettings.mode || 'disabled';
    const currentSource = sumSettings.apiSource || 'main';
    const currentInterval = sumSettings.autoInterval || 10;
    const currentAutoContext = sumSettings.autoMessageContext || 10;
    const currentManualContext = sumSettings.manualMessageContext || 10;
    const currentProvider = secondary.provider || 'openai';
    const currentModel = secondary.model || '';
    const currentEndpoint = secondary.endpoint || '';
    const currentApiKey = secondary.apiKey || '';
    const currentTemp = secondary.temperature || 0.7;
    const currentTopP = secondary.topP !== undefined ? secondary.topP : 1.0;
    const currentMaxTokens = secondary.maxTokens || 8192;

    const providerDefaults = getProviderDefaults(currentProvider);

    const modalHtml = `
        <dialog id="lumia-summarization-modal" class="popup popup--animation-fast lumia-modal lumia-modal-settings">
            <div class="lumia-modal-header">
                <div class="lumia-modal-header-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="21" y1="10" x2="3" y2="10"></line>
                        <line x1="21" y1="6" x2="3" y2="6"></line>
                        <line x1="21" y1="14" x2="3" y2="14"></line>
                        <line x1="21" y1="18" x2="3" y2="18"></line>
                    </svg>
                </div>
                <h3 class="lumia-modal-title">Summarization</h3>
            </div>
            <div class="lumia-modal-content">

                <!-- Mode Selection -->
                <div class="lumia-modal-panel">
                    <div class="lumia-modal-panel-header">
                        <span class="lumia-modal-panel-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                        </span>
                        <span class="lumia-modal-panel-title">Mode</span>
                    </div>
                    <div class="lumia-modal-panel-content">
                        <div class="lumia-mode-options">
                            <label class="lumia-mode-option ${currentMode === 'disabled' ? 'selected' : ''}">
                                <input type="radio" name="sum-mode" value="disabled" ${currentMode === 'disabled' ? 'checked' : ''} />
                                <span class="lumia-mode-option-label">Disabled</span>
                            </label>
                            <label class="lumia-mode-option ${currentMode === 'auto' ? 'selected' : ''}">
                                <input type="radio" name="sum-mode" value="auto" ${currentMode === 'auto' ? 'checked' : ''} />
                                <span class="lumia-mode-option-label">Automatic</span>
                            </label>
                            <label class="lumia-mode-option ${currentMode === 'manual' ? 'selected' : ''}">
                                <input type="radio" name="sum-mode" value="manual" ${currentMode === 'manual' ? 'checked' : ''} />
                                <span class="lumia-mode-option-label">Manual</span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Auto Settings (conditional) -->
                <div class="lumia-modal-panel" id="lumia-sum-auto-section" style="${currentMode === 'auto' ? '' : 'display: none;'}">
                    <div class="lumia-modal-panel-header">
                        <span class="lumia-modal-panel-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </span>
                        <span class="lumia-modal-panel-title">Auto Settings</span>
                    </div>
                    <div class="lumia-modal-panel-content">
                        <div class="lumia-modal-field-row">
                            <div class="lumia-modal-field">
                                <label class="lumia-modal-label" for="lumia-sum-interval-input">Interval</label>
                                <input type="number" id="lumia-sum-interval-input" class="lumia-modal-input" min="1" value="${currentInterval}" />
                                <span class="lumia-modal-hint">Every N messages</span>
                            </div>
                            <div class="lumia-modal-field">
                                <label class="lumia-modal-label" for="lumia-sum-auto-context-input">Context</label>
                                <input type="number" id="lumia-sum-auto-context-input" class="lumia-modal-input" min="1" max="100" value="${currentAutoContext}" />
                                <span class="lumia-modal-hint">Messages to include</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Manual Context (conditional) -->
                <div class="lumia-modal-panel" id="lumia-sum-manual-section" style="${currentMode === 'manual' || currentMode === 'auto' ? '' : 'display: none;'}">
                    <div class="lumia-modal-panel-header">
                        <span class="lumia-modal-panel-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </span>
                        <span class="lumia-modal-panel-title">Manual Context</span>
                    </div>
                    <div class="lumia-modal-panel-content">
                        <div class="lumia-modal-field">
                            <label class="lumia-modal-label" for="lumia-sum-manual-context-input">Messages to include</label>
                            <input type="number" id="lumia-sum-manual-context-input" class="lumia-modal-input" min="1" max="100" value="${currentManualContext}" />
                            <span class="lumia-modal-hint">When using /loom-summarize command</span>
                        </div>
                    </div>
                </div>

                <!-- API Source -->
                <div class="lumia-modal-panel">
                    <div class="lumia-modal-panel-header">
                        <span class="lumia-modal-panel-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
                            </svg>
                        </span>
                        <span class="lumia-modal-panel-title">API Source</span>
                    </div>
                    <div class="lumia-modal-panel-content">
                        <div class="lumia-mode-options">
                            <label class="lumia-mode-option lumia-mode-option-wide ${currentSource === 'main' ? 'selected' : ''}">
                                <input type="radio" name="sum-source" value="main" ${currentSource === 'main' ? 'checked' : ''} />
                                <span class="lumia-mode-option-label">Main API</span>
                            </label>
                            <label class="lumia-mode-option lumia-mode-option-wide ${currentSource === 'secondary' ? 'selected' : ''}">
                                <input type="radio" name="sum-source" value="secondary" ${currentSource === 'secondary' ? 'checked' : ''} />
                                <span class="lumia-mode-option-label">Secondary LLM</span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Secondary LLM Config (conditional) -->
                <div class="lumia-modal-panel" id="lumia-sum-secondary-section" style="${currentSource === 'secondary' ? '' : 'display: none;'}">
                    <div class="lumia-modal-panel-header">
                        <span class="lumia-modal-panel-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                <line x1="8" y1="21" x2="16" y2="21"></line>
                                <line x1="12" y1="17" x2="12" y2="21"></line>
                            </svg>
                        </span>
                        <span class="lumia-modal-panel-title">Secondary LLM</span>
                    </div>
                    <div class="lumia-modal-panel-content">
                        <div class="lumia-modal-field">
                            <label class="lumia-modal-label" for="lumia-sum-provider-select">Provider</label>
                            <select id="lumia-sum-provider-select" class="lumia-modal-select">
                                <option value="openai" ${currentProvider === 'openai' ? 'selected' : ''}>OpenAI</option>
                                <option value="anthropic" ${currentProvider === 'anthropic' ? 'selected' : ''}>Anthropic (Claude)</option>
                                <option value="openrouter" ${currentProvider === 'openrouter' ? 'selected' : ''}>OpenRouter</option>
                                <option value="custom" ${currentProvider === 'custom' ? 'selected' : ''}>Custom OpenAI-Compatible</option>
                            </select>
                        </div>

                        <div class="lumia-modal-field-row">
                            <div class="lumia-modal-field">
                                <label class="lumia-modal-label" for="lumia-sum-model-input">Model</label>
                                <input type="text" id="lumia-sum-model-input" class="lumia-modal-input"
                                       placeholder="${providerDefaults.placeholder}"
                                       value="${escapeHtml(currentModel)}" />
                            </div>
                        </div>

                        <div class="lumia-modal-field">
                            <label class="lumia-modal-label" for="lumia-sum-endpoint-input">Endpoint URL</label>
                            <input type="text" id="lumia-sum-endpoint-input" class="lumia-modal-input"
                                   placeholder="${providerDefaults.endpoint}"
                                   value="${escapeHtml(currentEndpoint)}" />
                            <span class="lumia-modal-hint">Leave empty for default</span>
                        </div>

                        <div class="lumia-modal-field">
                            <label class="lumia-modal-label" for="lumia-sum-apikey-input">API Key</label>
                            <input type="password" id="lumia-sum-apikey-input" class="lumia-modal-input"
                                   placeholder="Your API key"
                                   value="${escapeHtml(currentApiKey)}" />
                        </div>

                        <div class="lumia-modal-field-row lumia-modal-field-row-3">
                            <div class="lumia-modal-field">
                                <label class="lumia-modal-label" for="lumia-sum-temp-input">Temp</label>
                                <input type="number" id="lumia-sum-temp-input" class="lumia-modal-input"
                                       min="0" max="2" step="0.1" value="${currentTemp}" />
                            </div>
                            <div class="lumia-modal-field">
                                <label class="lumia-modal-label" for="lumia-sum-topp-input">Top-P</label>
                                <input type="number" id="lumia-sum-topp-input" class="lumia-modal-input"
                                       min="0" max="1" step="0.05" value="${currentTopP}" />
                            </div>
                            <div class="lumia-modal-field">
                                <label class="lumia-modal-label" for="lumia-sum-maxtokens-input">Max Tokens</label>
                                <input type="text" id="lumia-sum-maxtokens-input" class="lumia-modal-input"
                                       value="${currentMaxTokens}" />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Test Section -->
                <div class="lumia-modal-panel lumia-modal-panel-accent">
                    <div class="lumia-modal-panel-header">
                        <span class="lumia-modal-panel-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        </span>
                        <span class="lumia-modal-panel-title">Test</span>
                    </div>
                    <div class="lumia-modal-panel-content">
                        <button id="lumia-sum-test-btn" class="lumia-modal-btn lumia-modal-btn-primary lumia-modal-btn-full">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Generate Summary Now
                        </button>
                        <div id="lumia-sum-test-status" class="lumia-modal-status"></div>
                    </div>
                </div>

            </div>
            <div class="lumia-modal-footer">
                <button class="lumia-modal-btn lumia-modal-btn-secondary lumia-sum-cancel-btn">Cancel</button>
                <button class="lumia-modal-btn lumia-modal-btn-primary lumia-sum-save-btn">Save Changes</button>
            </div>
        </dialog>
    `;

    $("body").append(modalHtml);
    const $modal = $("#lumia-summarization-modal");

    // Calculate and apply proper height constraints
    applyModalHeightConstraints($modal);

    const closeModal = () => {
        // Clean up resize listener
        if ($modal[0]._resizeCleanup) {
            $modal[0]._resizeCleanup();
        }
        $modal[0].close();
        $modal.remove();
    };

    // Stop propagation on modal to prevent ST from closing the drawer
    $modal.on("click mousedown mouseup", function(e) {
        e.stopPropagation();
        // Close if clicking the dialog backdrop (outside modal content)
        if (e.type === "click" && e.target === this) closeModal();
    });

    // Handle mode option selection UI
    $modal.find('input[name="sum-mode"]').change(function() {
        $modal.find('.lumia-mode-option').each(function() {
            const $input = $(this).find('input[name="sum-mode"]');
            if ($input.is(':checked')) {
                $(this).addClass('selected');
            } else {
                $(this).removeClass('selected');
            }
        });

        const mode = $(this).val();
        if (mode === 'auto') {
            $modal.find("#lumia-sum-auto-section").show();
            $modal.find("#lumia-sum-manual-section").show();
        } else if (mode === 'manual') {
            $modal.find("#lumia-sum-auto-section").hide();
            $modal.find("#lumia-sum-manual-section").show();
        } else {
            $modal.find("#lumia-sum-auto-section").hide();
            $modal.find("#lumia-sum-manual-section").hide();
        }
    });

    // Handle source option selection UI
    $modal.find('input[name="sum-source"]').change(function() {
        $modal.find('.lumia-mode-option').each(function() {
            const $input = $(this).find('input[name="sum-source"]');
            if ($input.length && $input.is(':checked')) {
                $(this).addClass('selected');
            } else if ($(this).find('input[name="sum-source"]').length) {
                $(this).removeClass('selected');
            }
        });

        const source = $(this).val();
        if (source === 'secondary') {
            $modal.find("#lumia-sum-secondary-section").show();
        } else {
            $modal.find("#lumia-sum-secondary-section").hide();
        }
    });

    // Update placeholders when provider changes
    $modal.find("#lumia-sum-provider-select").change(function() {
        const provider = $(this).val();
        const defaults = getProviderDefaults(provider);
        $modal.find("#lumia-sum-model-input").attr("placeholder", defaults.placeholder);
        $modal.find("#lumia-sum-endpoint-input").attr("placeholder", defaults.endpoint);
    });

    // Helper to parse and validate maxTokens
    const parseMaxTokens = (val) => {
        const parsed = parseInt(val, 10);
        if (isNaN(parsed) || !/^\d+$/.test(String(val).trim())) {
            return 8192;
        }
        return Math.max(256, parsed);
    };

    // Test button
    $modal.find("#lumia-sum-test-btn").click(async function() {
        const $status = $modal.find("#lumia-sum-test-status");
        $status.html('<span class="lumia-modal-status-loading">Generating summary...</span>');

        try {
            // Temporarily apply current form values (test uses manual context since it's a manual action)
            const tempSettings = {
                mode: $modal.find('input[name="sum-mode"]:checked').val(),
                apiSource: $modal.find('input[name="sum-source"]:checked').val(),
                autoInterval: parseInt($modal.find("#lumia-sum-interval-input").val()) || 10,
                autoMessageContext: parseInt($modal.find("#lumia-sum-auto-context-input").val()) || 10,
                manualMessageContext: parseInt($modal.find("#lumia-sum-manual-context-input").val()) || 10,
                secondary: {
                    provider: $modal.find("#lumia-sum-provider-select").val(),
                    model: $modal.find("#lumia-sum-model-input").val(),
                    endpoint: $modal.find("#lumia-sum-endpoint-input").val(),
                    apiKey: $modal.find("#lumia-sum-apikey-input").val(),
                    temperature: parseFloat($modal.find("#lumia-sum-temp-input").val()) || 0.7,
                    topP: parseFloat($modal.find("#lumia-sum-topp-input").val()) || 1.0,
                    maxTokens: parseMaxTokens($modal.find("#lumia-sum-maxtokens-input").val())
                }
            };

            const result = await generateLoomSummary(tempSettings, true);
            if (result) {
                $status.html(`<span style="color: #4CAF50;">Summary generated successfully!</span><br><small>Check your chat metadata.</small>`);
                toastr.success("Summary generated and saved to chat metadata!");
            } else {
                $status.html(`<span style="color: #f44336;">No summary generated. Check console for details.</span>`);
            }
        } catch (error) {
            console.error(`[${MODULE_NAME}] Summarization error:`, error);
            $status.html(`<span style="color: #f44336;">Error: ${error.message}</span>`);
        }
    });

    // Save button
    $modal.find(".lumia-sum-save-btn").click(() => {
        const maxTokensVal = parseMaxTokens($modal.find("#lumia-sum-maxtokens-input").val());

        $modal.find("#lumia-sum-maxtokens-input").val(maxTokensVal);

        settings.summarization = {
            mode: $modal.find('input[name="sum-mode"]:checked').val(),
            apiSource: $modal.find('input[name="sum-source"]:checked').val(),
            autoInterval: parseInt($modal.find("#lumia-sum-interval-input").val()) || 10,
            autoMessageContext: parseInt($modal.find("#lumia-sum-auto-context-input").val()) || 10,
            manualMessageContext: parseInt($modal.find("#lumia-sum-manual-context-input").val()) || 10,
            secondary: {
                provider: $modal.find("#lumia-sum-provider-select").val(),
                model: $modal.find("#lumia-sum-model-input").val(),
                endpoint: $modal.find("#lumia-sum-endpoint-input").val(),
                apiKey: $modal.find("#lumia-sum-apikey-input").val(),
                temperature: parseFloat($modal.find("#lumia-sum-temp-input").val()) || 0.7,
                topP: parseFloat($modal.find("#lumia-sum-topp-input").val()) || 1.0,
                maxTokens: maxTokensVal
            }
        };

        saveSettings();
        toastr.success("Summarization settings saved!");
        closeModal();
    });

    $modal.find(".lumia-sum-cancel-btn").click(closeModal);

    $modal.on("keydown", function (e) {
        if (e.key === "Escape") closeModal();
    });

    $modal[0].showModal();
}

/**
 * Show the prompt settings modal (Sovereign Hand features)
 */
export function showPromptSettingsModal() {
    const settings = getSettings();

    $("#lumia-prompt-settings-modal").remove();

    const sovereignHand = settings.sovereignHand || {};
    const isEnabled = sovereignHand.enabled || false;

    const modalHtml = `
        <dialog id="lumia-prompt-settings-modal" class="popup popup--animation-fast lumia-modal lumia-modal-settings">
            <div class="lumia-modal-header">
                <div class="lumia-modal-header-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </div>
                <h3 class="lumia-modal-title">Prompt Settings</h3>
            </div>
            <div class="lumia-modal-content">

                <div class="lumia-modal-panel">
                    <div class="lumia-modal-panel-header">
                        <span class="lumia-modal-panel-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"></path>
                            </svg>
                        </span>
                        <span class="lumia-modal-panel-title">Sovereign Hand Features</span>
                    </div>
                    <div class="lumia-modal-panel-content">
                        <p class="lumia-modal-description">Enable Sovereign Hand integration to use advanced prompt manipulation features.</p>

                        <div class="lumia-toggle-row">
                            <label class="lumia-toggle-label" for="lumia-sovereign-hand-toggle">
                                <span class="lumia-toggle-text">Use Sovereign Hand Features</span>
                                <span class="lumia-toggle-hint">Enables {{loomLastUserMessage}} macro and context exclusion</span>
                            </label>
                            <div class="lumia-toggle-switch-wrapper">
                                <input type="checkbox" id="lumia-sovereign-hand-toggle" class="lumia-toggle-input" ${isEnabled ? 'checked' : ''} />
                                <label for="lumia-sovereign-hand-toggle" class="lumia-toggle-switch-label">
                                    <div class="lumia-toggle-track">
                                        <div class="lumia-toggle-thumb"></div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div class="lumia-info-box ${isEnabled ? '' : 'lumia-info-box-muted'}">
                            <div class="lumia-info-box-header">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="16" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                </svg>
                                <span>When enabled:</span>
                            </div>
                            <ul class="lumia-info-box-list">
                                <li><code>{{loomLastUserMessage}}</code> returns the last user message content</li>
                                <li>The last user message is excluded from the outgoing prompt context</li>
                                <li>Use this to provide instructions with the user's input to specific prompt locations</li>
                            </ul>
                        </div>
                    </div>
                </div>

            </div>
            <div class="lumia-modal-footer">
                <button class="lumia-modal-btn lumia-modal-btn-secondary lumia-prompt-settings-cancel-btn">Cancel</button>
                <button class="lumia-modal-btn lumia-modal-btn-primary lumia-prompt-settings-save-btn">Save Changes</button>
            </div>
        </dialog>
    `;

    $("body").append(modalHtml);
    const $modal = $("#lumia-prompt-settings-modal");

    // Calculate and apply proper height constraints
    applyModalHeightConstraints($modal);

    const closeModal = () => {
        // Clean up resize listener
        if ($modal[0]._resizeCleanup) {
            $modal[0]._resizeCleanup();
        }
        $modal[0].close();
        $modal.remove();
    };

    // Stop propagation on modal to prevent ST from closing the drawer
    $modal.on("click mousedown mouseup", function(e) {
        e.stopPropagation();
        // Close if clicking the dialog backdrop (outside modal content)
        if (e.type === "click" && e.target === this) closeModal();
    });

    // Handle toggle visual feedback for info box
    $modal.find("#lumia-sovereign-hand-toggle").change(function() {
        const $infoBox = $modal.find(".lumia-info-box");
        if ($(this).is(':checked')) {
            $infoBox.removeClass('lumia-info-box-muted');
        } else {
            $infoBox.addClass('lumia-info-box-muted');
        }
    });

    $modal.find(".lumia-prompt-settings-save-btn").click(() => {
        const isEnabled = $modal.find("#lumia-sovereign-hand-toggle").is(':checked');

        if (!settings.sovereignHand) {
            settings.sovereignHand = {};
        }
        settings.sovereignHand.enabled = isEnabled;

        saveSettings();
        toastr.success("Prompt settings saved!");
        closeModal();
    });

    $modal.find(".lumia-prompt-settings-cancel-btn").click(closeModal);

    $modal.on("keydown", function (e) {
        if (e.key === "Escape") closeModal();
    });

    $modal[0].showModal();
}

/**
 * Show the Lucid Cards browser modal
 * Fetches and displays available DLCs from lucid.cards
 */
export async function showLucidCardsModal() {
    const settings = getSettings();

    $("#lucid-cards-modal").remove();

    const modalHtml = `
        <dialog id="lucid-cards-modal" class="popup popup--animation-fast lumia-modal lumia-modal-lucid-cards">
            <div class="lumia-modal-header">
                <div class="lumia-modal-header-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                        <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                </div>
                <div class="lumia-modal-header-text">
                    <h3 class="lumia-modal-title">Lucid Cards Browser</h3>
                    <p class="lumia-modal-subtitle">Browse and import official Lumiverse content</p>
                </div>
            </div>
            <div class="lucid-cards-tabs">
                <button class="lucid-cards-tab active" data-category="Lumia DLCs">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span>Lumia DLCs</span>
                </button>
                <button class="lucid-cards-tab" data-category="Loom Utilities">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                    </svg>
                    <span>Utilities</span>
                </button>
                <button class="lucid-cards-tab" data-category="Loom Retrofits">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                    <span>Retrofits</span>
                </button>
                <button class="lucid-cards-tab" data-category="Loom Narratives">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                        <path d="M2 2l7.586 7.586"></path>
                        <circle cx="11" cy="11" r="2"></circle>
                    </svg>
                    <span>Narratives</span>
                </button>
            </div>
            <div class="lumia-modal-content">
                <div class="lucid-cards-loading">
                    <div class="lucid-cards-spinner"></div>
                    <span>Loading content from Lucid.cards...</span>
                </div>
                <div class="lucid-cards-error" style="display: none;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <span class="lucid-cards-error-message">Failed to load content</span>
                    <button class="lumia-modal-btn lumia-modal-btn-secondary lucid-cards-retry-btn">Retry</button>
                </div>
                <div class="lucid-cards-content" style="display: none;"></div>
            </div>
            <div class="lumia-modal-footer lucid-cards-footer">
                <button class="lumia-modal-btn lumia-modal-btn-secondary lucid-cards-close-btn">Close</button>
                <div class="lucid-cards-selected-info" style="display: none;">
                    <span class="lucid-cards-selected-name"></span>
                    <span class="lucid-cards-selected-author"></span>
                </div>
                <button class="lumia-modal-btn lumia-modal-btn-primary lucid-cards-import-btn" style="display: none;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Add to Lumiverse
                </button>
            </div>
        </dialog>
    `;

    $("body").append(modalHtml);
    const $modal = $("#lucid-cards-modal");

    // State management
    let currentCategory = "Lumia DLCs";
    let selectedBook = null;
    let cachedData = null;

    // Calculate and apply proper height constraints (custom for this modal due to tabs)
    const applyLucidCardsHeightConstraints = () => {
        const modal = $modal[0];
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const isMobile = viewportWidth <= 600;
        const verticalMargin = isMobile ? 24 : 48;
        const maxModalHeight = viewportHeight - verticalMargin;

        modal.style.maxHeight = `${maxModalHeight}px`;

        requestAnimationFrame(() => {
            const $header = $modal.find('.lumia-modal-header');
            const $tabs = $modal.find('.lucid-cards-tabs');
            const $footer = $modal.find('.lumia-modal-footer');
            const $content = $modal.find('.lumia-modal-content');

            const headerHeight = $header.length ? $header[0].offsetHeight : 0;
            const tabsHeight = $tabs.length ? $tabs[0].offsetHeight : 0;
            const footerHeight = $footer.length ? $footer[0].offsetHeight : 0;

            const maxContentHeight = maxModalHeight - headerHeight - tabsHeight - footerHeight;

            if ($content.length) {
                $content[0].style.maxHeight = `${maxContentHeight}px`;
                $content[0].style.overflowY = 'auto';
            }
        });
    };

    applyLucidCardsHeightConstraints();

    // Handle resize
    const resizeHandler = () => applyLucidCardsHeightConstraints();
    window.addEventListener('resize', resizeHandler);
    $modal[0]._resizeCleanup = () => window.removeEventListener('resize', resizeHandler);

    const closeModal = () => {
        if ($modal[0]._resizeCleanup) {
            $modal[0]._resizeCleanup();
        }
        $modal[0].close();
        $modal.remove();
        refreshUI();
    };

    // Stop propagation on modal to prevent ST from closing the drawer
    $modal.on("click mousedown mouseup", function(e) {
        e.stopPropagation();
        if (e.type === "click" && e.target === this) closeModal();
    });

    $modal.on("keydown", function (e) {
        if (e.key === "Escape") closeModal();
    });

    // Fetch data from Lucid.cards API
    const fetchLucidCards = async () => {
        $modal.find(".lucid-cards-loading").show();
        $modal.find(".lucid-cards-error").hide();
        $modal.find(".lucid-cards-content").hide();
        $modal.find(".lucid-cards-selected-info, .lucid-cards-import-btn").hide();
        selectedBook = null;

        try {
            const response = await fetch("https://lucid.cards/api/raw/world-books?lumiverse=true");
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            cachedData = await response.json();
            renderContent();
        } catch (error) {
            console.error(`[${MODULE_NAME}] Failed to fetch Lucid.cards:`, error);
            $modal.find(".lucid-cards-loading").hide();
            $modal.find(".lucid-cards-error-message").text(`Failed to load: ${error.message}`);
            $modal.find(".lucid-cards-error").show();
        }
    };

    // Render content based on current category
    const renderContent = () => {
        if (!cachedData || !cachedData.categories) {
            $modal.find(".lucid-cards-loading").hide();
            $modal.find(".lucid-cards-error-message").text("No content available");
            $modal.find(".lucid-cards-error").show();
            return;
        }

        $modal.find(".lucid-cards-loading").hide();
        $modal.find(".lucid-cards-error").hide();

        const $content = $modal.find(".lucid-cards-content");
        $content.empty();

        // Find the category
        const category = cachedData.categories.find(c => c.displayName === currentCategory || c.name === currentCategory);

        if (!category || !category.books || category.books.length === 0) {
            $content.html('<div class="lucid-cards-empty">No items available in this category.</div>');
            $content.show();
            return;
        }

        // Determine layout based on category
        const isLumiaDLC = currentCategory === "Lumia DLCs";

        if (isLumiaDLC) {
            // Card grid layout for Lumia DLCs
            const cardsHtml = category.books.map(book => {
                const escapedName = escapeHtml(book.prettyName);
                const escapedPath = escapeHtml(book.path);
                // We'll fetch metadata when displaying - for now show placeholder
                return `
                    <div class="lucid-dlc-card" data-path="${escapedPath}" data-name="${escapedName}">
                        <div class="lucid-dlc-card-image">
                            <div class="lucid-dlc-card-placeholder">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                    <polyline points="21 15 16 10 5 21"></polyline>
                                </svg>
                            </div>
                        </div>
                        <div class="lucid-dlc-card-info">
                            <div class="lucid-dlc-card-title">${escapedName}</div>
                            <div class="lucid-dlc-card-author">Loading...</div>
                        </div>
                    </div>
                `;
            }).join("");

            $content.html(`<div class="lucid-dlc-grid">${cardsHtml}</div>`);

            // Fetch metadata for each card asynchronously
            category.books.forEach(book => {
                fetchBookMetadata(book.path, $content);
            });
        } else {
            // List layout for Loom items
            const listHtml = category.books.map(book => {
                const escapedName = escapeHtml(book.prettyName);
                const escapedPath = escapeHtml(book.path);
                return `
                    <div class="lucid-loom-item" data-path="${escapedPath}" data-name="${escapedName}">
                        <div class="lucid-loom-item-content">
                            <span class="lucid-loom-item-name">${escapedName}</span>
                            <span class="lucid-loom-item-author">Loading...</span>
                        </div>
                        <div class="lucid-loom-item-action">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>
                `;
            }).join("");

            $content.html(`<div class="lucid-loom-list">${listHtml}</div>`);

            // Fetch metadata for each item asynchronously
            category.books.forEach(book => {
                fetchBookMetadata(book.path, $content);
            });
        }

        $content.show();

        // Deselect when switching categories
        selectedBook = null;
        $modal.find(".lucid-cards-footer").hide();
    };

    // Fetch metadata for a specific book
    const fetchBookMetadata = async (path, $content) => {
        try {
            const response = await fetch(`https://lucid.cards${path}`);
            if (!response.ok) return;

            const data = await response.json();

            // Find metadata entry
            let entries = Array.isArray(data) ? data : (data.entries ? Object.values(data.entries) : []);
            const metadataEntry = entries.find(e => {
                const comment = (e.comment || "").toLowerCase();
                return comment.includes("(metadata)") || comment === "metadata";
            });

            let coverImg = null;
            let authorName = null;

            if (metadataEntry && metadataEntry.content) {
                const coverMatch = metadataEntry.content.match(/\[cover_img=(.+?)\]/);
                if (coverMatch) coverImg = coverMatch[1].trim();

                const authorMatch = metadataEntry.content.match(/\[author_name=(.+?)\]/);
                if (authorMatch) authorName = authorMatch[1].trim();
            }

            // Update the card/item
            const escapedPath = escapeHtml(path);
            const $card = $content.find(`[data-path="${escapedPath}"]`);

            if ($card.length) {
                // Store metadata on the element
                $card.data("cover-img", coverImg);
                $card.data("author", authorName);

                // Update display
                if (coverImg) {
                    $card.find(".lucid-dlc-card-placeholder").replaceWith(
                        `<img src="${escapeHtml(coverImg)}" alt="" loading="lazy">`
                    );
                }
                $card.find(".lucid-dlc-card-author, .lucid-loom-item-author").text(authorName || "Unknown Author");
            }
        } catch (error) {
            console.error(`[${MODULE_NAME}] Failed to fetch metadata for ${path}:`, error);
            const escapedPath = escapeHtml(path);
            const $card = $content.find(`[data-path="${escapedPath}"]`);
            if ($card.length) {
                $card.find(".lucid-dlc-card-author, .lucid-loom-item-author").text("Unknown Author");
            }
        }
    };

    // Handle tab switching
    $modal.find(".lucid-cards-tab").click(function() {
        $modal.find(".lucid-cards-tab").removeClass("active");
        $(this).addClass("active");
        currentCategory = $(this).data("category");
        selectedBook = null;
        $modal.find(".lucid-cards-selected-info, .lucid-cards-import-btn").hide();
        renderContent();
    });

    // Handle card/item selection
    $modal.on("click", ".lucid-dlc-card, .lucid-loom-item", function() {
        const $this = $(this);
        const wasSelected = $this.hasClass("selected");

        // Deselect all
        $modal.find(".lucid-dlc-card, .lucid-loom-item").removeClass("selected");

        if (wasSelected) {
            selectedBook = null;
            $modal.find(".lucid-cards-selected-info, .lucid-cards-import-btn").hide();
        } else {
            $this.addClass("selected");
            selectedBook = {
                path: $this.data("path"),
                name: $this.data("name"),
                author: $this.data("author") || "Unknown Author"
            };

            // Show selected info and import button
            $modal.find(".lucid-cards-selected-name").text(selectedBook.name);
            $modal.find(".lucid-cards-selected-author").text(`by ${selectedBook.author}`);
            $modal.find(".lucid-cards-selected-info, .lucid-cards-import-btn").show();
        }
    });

    // Handle close button
    $modal.find(".lucid-cards-close-btn").click(closeModal);

    // Handle retry button
    $modal.find(".lucid-cards-retry-btn").click(fetchLucidCards);

    // Handle import button
    $modal.find(".lucid-cards-import-btn").click(async function() {
        if (!selectedBook) return;

        const $btn = $(this);
        const originalHtml = $btn.html();
        $btn.prop("disabled", true).html(`
            <svg class="lucid-cards-btn-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
            </svg>
            Importing...
        `);

        try {
            const response = await fetch(`https://lucid.cards${selectedBook.path}`);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

            const data = await response.json();

            // Use existing handleNewBook from dataProcessor
            const { handleNewBook } = await import('./dataProcessor.js');
            handleNewBook(data, selectedBook.name, true);

            toastr.success(`Successfully imported "${selectedBook.name}"!`);

            // Deselect after import
            $modal.find(".lucid-dlc-card, .lucid-loom-item").removeClass("selected");
            selectedBook = null;
            $modal.find(".lucid-cards-selected-info, .lucid-cards-import-btn").hide();

        } catch (error) {
            console.error(`[${MODULE_NAME}] Import failed:`, error);
            toastr.error(`Failed to import: ${error.message}`);
        } finally {
            $btn.prop("disabled", false).html(originalHtml);
        }
    });

    $modal[0].showModal();

    // Fetch data after modal opens
    fetchLucidCards();
}

/**
 * Refresh the UI to reflect current settings state
 */
export function refreshUIDisplay() {
    const settings = getSettings();
    const statusDiv = document.getElementById("lumia-book-status");
    const packs = Object.values(settings.packs);

    if (packs.length > 0) {
        if (statusDiv) {
            const totalItems = packs.reduce((acc, p) => acc + p.items.length, 0);
            statusDiv.textContent = `Loaded ${packs.length} packs (${totalItems} items total)`;
        }

        // Update Definition Selector Label
        const currentDefDiv = document.getElementById("lumia-current-definition");
        if (currentDefDiv) {
            const sel = settings.selectedDefinition;
            if (sel) {
                const item = getItemFromLibrary(sel.packName, sel.itemName);
                currentDefDiv.textContent = item ? `${item.lumiaDefName} (${sel.packName})` : "Item not found (Maybe pack removed?)";
            } else {
                currentDefDiv.textContent = "No definition selected";
            }
        }

        // Update Behaviors List (with dominant indicator)
        const currentBehaviorsDiv = document.getElementById("lumia-current-behaviors");
        if (currentBehaviorsDiv) {
            const names = settings.selectedBehaviors.map(sel => {
                const item = getItemFromLibrary(sel.packName, sel.itemName);
                if (!item) return null;
                const name = item.lumiaDefName;
                // Check if this is the dominant behavior
                const isDominant = settings.dominantBehavior &&
                                   settings.dominantBehavior.packName === sel.packName &&
                                   settings.dominantBehavior.itemName === sel.itemName;
                return isDominant ? `★ ${name}` : name;
            }).filter(n => n);

            currentBehaviorsDiv.textContent = names.length > 0 ? names.join(", ") : "No behaviors selected";
        }

        // Update Personalities List (with dominant indicator)
        const currentPersonalitiesDiv = document.getElementById("lumia-current-personalities");
        if (currentPersonalitiesDiv) {
            const names = settings.selectedPersonalities.map(sel => {
                const item = getItemFromLibrary(sel.packName, sel.itemName);
                if (!item) return null;
                const name = item.lumiaDefName;
                // Check if this is the dominant personality
                const isDominant = settings.dominantPersonality &&
                                   settings.dominantPersonality.packName === sel.packName &&
                                   settings.dominantPersonality.itemName === sel.itemName;
                return isDominant ? `★ ${name}` : name;
            }).filter(n => n);

            currentPersonalitiesDiv.textContent = names.length > 0 ? names.join(", ") : "No personalities selected";
        }

        // Update Loom Style
        const currentLoomStyleDiv = document.getElementById("loom-current-style");
        if (currentLoomStyleDiv) {
            const sel = settings.selectedLoomStyle;
            if (sel) {
                const item = getItemFromLibrary(sel.packName, sel.itemName);
                currentLoomStyleDiv.textContent = item ? `${item.loomName} (${sel.packName})` : "Item not found (Maybe pack removed?)";
            } else {
                currentLoomStyleDiv.textContent = "No style selected";
            }
        }

        // Update Loom Utilities List
        const currentLoomUtilsDiv = document.getElementById("loom-current-utils");
        if (currentLoomUtilsDiv) {
            const names = settings.selectedLoomUtils.map(sel => {
                const item = getItemFromLibrary(sel.packName, sel.itemName);
                return item ? item.loomName : null;
            }).filter(n => n);

            currentLoomUtilsDiv.textContent = names.length > 0 ? names.join(", ") : "No utilities selected";
        }

        // Update Loom Retrofits List
        const currentLoomRetrofitsDiv = document.getElementById("loom-current-retrofits");
        if (currentLoomRetrofitsDiv) {
            const names = settings.selectedLoomRetrofits.map(sel => {
                const item = getItemFromLibrary(sel.packName, sel.itemName);
                return item ? item.loomName : null;
            }).filter(n => n);

            currentLoomRetrofitsDiv.textContent = names.length > 0 ? names.join(", ") : "No retrofits selected";
        }

    } else {
        if (statusDiv) statusDiv.textContent = "No Packs loaded";

        ["lumia-current-definition", "lumia-current-behaviors", "lumia-current-personalities",
         "loom-current-style", "loom-current-utils", "loom-current-retrofits"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "No selection possible (Load packs first)";
        });
    }
}
