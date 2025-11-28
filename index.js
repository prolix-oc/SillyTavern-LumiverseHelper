import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types, messageFormatting } from "../../../../script.js";
import { MacrosParser } from "../../../macros.js";
import DOMUtils, { query, queryAll, createElement } from "./sthelpers/domUtils.js";

const MODULE_NAME = "lumia-injector";
const SETTINGS_KEY = "lumia_injector_settings";

let settings = {
    packs: {}, // Dictionary of packs: { "PackName": { name: "PackName", items: [], url: "" } }
    selectedDefinition: null, // { packName: string, itemName: string }
    selectedBehaviors: [], // Array of { packName: string, itemName: string }
    selectedPersonalities: [], // Array of { packName: string, itemName: string }
    selectedLoomStyle: null, // { packName: string, itemName: string }
    selectedLoomUtils: [], // Array of { packName: string, itemName: string }
    selectedLoomRetrofits: [], // Array of { packName: string, itemName: string }
    lumiaOOCInterval: null // Number of messages between OOC comments (null = disabled)
};

// Lumia Randomization State
let currentRandomLumia = null;

// --- GENERATION INTERCEPTOR ---
// This interceptor is called before each generation (send, regenerate, swipe, continue, impersonate)
// It ensures that randomLumia is reset on every generation, including swipes
globalThis.lumiverseHelperGenInterceptor = async function (
    chat,
    contextSize,
    abort,
    type
) {
    console.log(`[${MODULE_NAME}] Generation interceptor called with type: ${type}`);

    // Reset random Lumia on every generation type
    // This ensures a new random Lumia is selected for each message, swipe, or regenerate
    currentRandomLumia = null;

    // Return unmodified context - we don't need to modify the chat array
    return { chat, contextSize, abort };
};

function migrateSettings() {
    // Migration from v1 (flat library) to v2 (packs)
    let migrated = false;

    // If old keys exist and packs is empty
    if ((settings.lumiaLibrary || settings.worldBookData) && Object.keys(settings.packs).length === 0) {
        console.log("Lumia Injector: Migrating legacy settings...");
        const legacyItems = settings.lumiaLibrary || [];
        // Re-process if needed, but assuming lumiaLibrary is already processed
        // If empty but worldBookData exists, process it
        let items = legacyItems;
        if (items.length === 0 && settings.worldBookData) {
            items = processWorldBook(settings.worldBookData);
        }

        if (items.length > 0) {
            const packName = "Default (Legacy)";
            settings.packs[packName] = {
                name: packName,
                items: items,
                url: settings.worldBookUrl || "Legacy"
            };
            
            // Migrating selections is tricky if we used indices.
            // v1 used indices. We need to map indices to names.
            // We try to preserve selections if possible.
            
            // Helper to get name from index
            const getName = (idx) => items[idx]?.lumiaDefName;

            if (typeof settings.selectedDefinition === 'number') {
                const name = getName(settings.selectedDefinition);
                if (name) settings.selectedDefinition = { packName, itemName: name };
                else settings.selectedDefinition = null;
            }

            if (Array.isArray(settings.selectedBehaviors) && settings.selectedBehaviors.length > 0 && typeof settings.selectedBehaviors[0] === 'number') {
                 settings.selectedBehaviors = settings.selectedBehaviors
                    .map(idx => {
                        const name = getName(idx);
                        return name ? { packName, itemName: name } : null;
                    }).filter(x => x);
            } else {
                settings.selectedBehaviors = [];
            }

            if (Array.isArray(settings.selectedPersonalities) && settings.selectedPersonalities.length > 0 && typeof settings.selectedPersonalities[0] === 'number') {
                settings.selectedPersonalities = settings.selectedPersonalities
                   .map(idx => {
                       const name = getName(idx);
                       return name ? { packName, itemName: name } : null;
                   }).filter(x => x);
           } else {
               settings.selectedPersonalities = [];
           }

           // Clean up old keys
           delete settings.lumiaLibrary;
           delete settings.worldBookData;
           delete settings.worldBookUrl;
           migrated = true;
        }
    }
    
    // Ensure defaults
    if (!settings.packs) settings.packs = {};
    if (!settings.selectedBehaviors) settings.selectedBehaviors = [];
    if (!settings.selectedPersonalities) settings.selectedPersonalities = [];
    if (!settings.selectedLoomUtils) settings.selectedLoomUtils = [];
    if (!settings.selectedLoomRetrofits) settings.selectedLoomRetrofits = [];
    if (settings.lumiaOOCInterval === undefined) settings.lumiaOOCInterval = null;

    return migrated;
}

function loadSettings() {
    if (extension_settings[SETTINGS_KEY]) {
        // Merge basics, but handle nested objects carefully if needed
        settings = { ...settings, ...extension_settings[SETTINGS_KEY] };
        
        // Run migration
        if (migrateSettings()) {
            saveSettings();
        }
    } else {
        extension_settings[SETTINGS_KEY] = settings;
    }
}

function saveSettings() {
    extension_settings[SETTINGS_KEY] = settings;
    saveSettingsDebounced();
}

const get_extension_directory = () => {
    const index_path = new URL(import.meta.url).pathname;
    return index_path.substring(0, index_path.lastIndexOf("/"));
};

async function loadSettingsHtml() {
    const response = await fetch(`${get_extension_directory()}/settings.html`);
    const html = await response.text();
    return html;
}

function extractMetadata(content) {
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

function processWorldBook(data) {
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
        if (!entry.content || typeof entry.content !== 'string') continue;

        const comment = (entry.comment || "").trim();

        // Extract name from parenthesis
        const nameMatch = comment.match(/\((.+?)\)/);
        if (!nameMatch) continue; // IGNORE if no parenthesis name

        const name = nameMatch[1].trim();

        // Check if this is a Loom entry
        const categoryMatch = comment.match(/^(.+?)\s*\(/);
        if (categoryMatch) {
            const category = categoryMatch[1].trim();

            // Check for Loom categories
            if (category === "Loom Utilities" || category === "Retrofits" || category === "Narrative Style") {
                loomItems.push({
                    loomName: name,
                    loomCategory: category,
                    loomContent: entry.content.trim()
                });
                continue; // Skip Lumia processing
            }
        }

        // Lumia processing (existing logic)
        let lumia = lumiaMap.get(name);
        if (!lumia) {
            lumia = {
                lumiaDefName: name,
                lumia_img: null,
                lumia_personality: null,
                lumia_behavior: null,
                lumiaDef: null,
                defAuthor: null
            };
            lumiaMap.set(name, lumia);
        }

        const commentLower = comment.toLowerCase();
        let type = null;
        if (entry.outletName === "Lumia_Description" || commentLower.includes("definition")) {
            type = "definition";
        } else if (entry.outletName === "Lumia_Behavior" || commentLower.includes("behavior")) {
            type = "behavior";
        } else if (entry.outletName === "Lumia_Personality" || commentLower.includes("personality")) {
            type = "personality";
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
            const behaviorMatch = entry.content.match(/{{setvar::lumia_behavior_\w+::([\s\S]*?)}}/);
            const personalityMatch = entry.content.match(/{{setglobalvar::lumia_personality_\w+::([\s\S]*?)}}/);

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

function getItemFromLibrary(packName, itemName) {
    const pack = settings.packs[packName];
    if (!pack) return null;
    return pack.items.find(i => i.lumiaDefName === itemName || i.loomName === itemName);
}

function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showSelectionModal(type) {
    // type: 'definition' | 'behavior' | 'personality'
    const packs = Object.values(settings.packs);
    
    let title = "";
    let isMulti = false;

    if (type === 'definition') {
        title = "Select Definition";
        isMulti = false;
    } else if (type === 'behavior') {
        title = "Select Behaviors";
        isMulti = true;
    } else if (type === 'personality') {
        title = "Select Personalities";
        isMulti = true;
    }

    $("#lumia-selection-modal").remove();

    // Build HTML for each pack
    let contentHtml = "";
    
    if (packs.length === 0) {
        contentHtml = '<div class="lumia-empty">No Lumia Packs loaded. Add one in settings!</div>';
    } else {
        packs.forEach(pack => {
            const packItems = pack.items;
            if (!packItems || packItems.length === 0) return;

            // Render Items Grid
            const itemsHtml = packItems.map(item => {
                // Check selection
                let isSelected = false;
                const currentDefName = item.lumiaDefName;
                
                if (isMulti) {
                    const collection = type === 'behavior' ? settings.selectedBehaviors : settings.selectedPersonalities;
                    isSelected = collection.some(s => s.packName === pack.name && s.itemName === currentDefName);
                } else {
                    const sel = settings.selectedDefinition;
                    isSelected = sel && sel.packName === pack.name && sel.itemName === currentDefName;
                }

                const imgToShow = item.lumia_img;
                const escapedPackName = escapeHtml(pack.name);
                const escapedItemName = escapeHtml(currentDefName);

                return `
                <div class="lumia-grid-item ${isSelected ? 'selected' : ''}" 
                     data-pack="${escapedPackName}" 
                     data-item="${escapedItemName}">
                    <div class="lumia-item-image">
                        ${imgToShow ? `<img src="${imgToShow}" alt="${escapedItemName}">` : '<div class="lumia-placeholder-img">?</div>'}
                    </div>
                    <div class="lumia-item-name">${currentDefName || "Unknown"}</div>
                </div>
                `;
            }).join("");

            contentHtml += `
            <div class="lumia-pack-section">
                <div class="lumia-pack-header">
                    <h4>${pack.name} (${packItems.length})</h4>
                    <button class="menu_button red lumia-remove-pack-btn" data-pack="${escapeHtml(pack.name)}">Remove Pack</button>
                </div>
                <div class="lumia-grid">
                    ${itemsHtml}
                </div>
            </div>
            `;
        });
    }

    const modalHtml = `
        <dialog id="lumia-selection-modal" class="popup wide_dialogue_popup large_dialogue_popup vertical_scrolling_dialogue_popup popup--animation-fast">
            <div class="popup-header">
                <h3 style="margin: 0; padding: 10px 0;">${title}</h3>
            </div>
            <div class="popup-content" style="padding: 15px; flex: 1; display: flex; flex-direction: column;">
                ${contentHtml}
            </div>
            <div class="popup-footer" style="display: flex; justify-content: center; padding: 15px; gap: 10px;">
                ${isMulti ? '<button class="menu_button lumia-modal-done">Done</button>' : '<button class="menu_button lumia-modal-close-btn">Close</button>'}
            </div>
        </dialog>
    `;

    $("body").append(modalHtml);
    const $modal = $("#lumia-selection-modal");

    const closeModal = () => {
        $modal[0].close();
        $modal.remove();
        refreshUI();
    };

    $modal.find(".lumia-modal-close-btn, .lumia-modal-done").click(closeModal);
    
    $modal.on("click", function (e) {
        if (e.target === this) closeModal();
    });
    
    $modal.on("keydown", function (e) {
        if (e.key === "Escape") closeModal();
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
            
            saveSettings();
            
            // Re-render modal (simple way: close and reopen)
            // Or just remove element
             $(this).closest(".lumia-pack-section").remove();
             
             // If no packs left, show empty message? easier to just close and refreshUI will handle status
             if (Object.keys(settings.packs).length === 0) {
                 closeModal();
             }
        }
    });

    // Handle Item Selection
    $modal.find(".lumia-grid-item").click(function() {
        const packName = $(this).data("pack");
        const itemName = $(this).data("item");
        
        if (!isMulti) {
            settings.selectedDefinition = { packName, itemName };
            saveSettings();
            closeModal();
        } else {
            const $this = $(this);
            let collection = (type === 'behavior') ? settings.selectedBehaviors : settings.selectedPersonalities;
            
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

            if (type === 'behavior') settings.selectedBehaviors = collection;
            else settings.selectedPersonalities = collection;
            
            saveSettings();
        }
    });
    
    $modal[0].showModal();
}

function showMiscFeaturesModal() {
    $("#lumia-misc-modal").remove();

    const currentInterval = settings.lumiaOOCInterval || "";

    const modalHtml = `
        <dialog id="lumia-misc-modal" class="popup wide_dialogue_popup large_dialogue_popup popup--animation-fast">
            <div class="popup-header">
                <h3 style="margin: 0; padding: 10px 0;">Miscellaneous Features</h3>
            </div>
            <div class="popup-content" style="padding: 15px; flex: 1; display: flex; flex-direction: column; gap: 20px;">

                <div class="lumia-misc-section">
                    <h4>OOC Comment Trigger</h4>
                    <p>Automatically inject OOC instructions when the chat reaches certain message intervals.</p>

                    <div class="lumia-item" style="margin-top: 10px;">
                        <label for="lumia-ooc-interval-input">Message Interval (leave empty to disable):</label>
                        <input type="number"
                               id="lumia-ooc-interval-input"
                               class="text_pole"
                               placeholder="e.g., 10"
                               min="1"
                               value="${escapeHtml(currentInterval.toString())}" />
                        <small>When the current message count is divisible by this number, the OOC instruction will trigger.</small>
                    </div>
                </div>

            </div>
            <div class="popup-footer" style="display: flex; justify-content: center; padding: 15px; gap: 10px;">
                <button class="menu_button lumia-misc-save-btn">Save</button>
                <button class="menu_button lumia-misc-cancel-btn">Cancel</button>
            </div>
        </dialog>
    `;

    $("body").append(modalHtml);
    const $modal = $("#lumia-misc-modal");

    const closeModal = () => {
        $modal[0].close();
        $modal.remove();
    };

    $modal.find(".lumia-misc-save-btn").click(() => {
        const intervalValue = $("#lumia-ooc-interval-input").val().trim();

        settings.lumiaOOCInterval = intervalValue ? parseInt(intervalValue, 10) : null;

        saveSettings();
        toastr.success("Miscellaneous features saved!");
        closeModal();
    });

    $modal.find(".lumia-misc-cancel-btn").click(closeModal);

    $modal.on("click", function (e) {
        if (e.target === this) closeModal();
    });

    $modal.on("keydown", function (e) {
        if (e.key === "Escape") closeModal();
    });

    $modal[0].showModal();
}

function showLoomSelectionModal(category) {
    // category: 'Narrative Style' | 'Loom Utilities' | 'Retrofits'
    const packs = Object.values(settings.packs);

    let title = "";
    let isMulti = false;
    let settingsKey = null;

    if (category === 'Narrative Style') {
        title = "Select Narrative Style";
        isMulti = false;
        settingsKey = 'selectedLoomStyle';
    } else if (category === 'Loom Utilities') {
        title = "Select Loom Utilities";
        isMulti = true;
        settingsKey = 'selectedLoomUtils';
    } else if (category === 'Retrofits') {
        title = "Select Retrofits";
        isMulti = true;
        settingsKey = 'selectedLoomRetrofits';
    }

    $("#loom-selection-modal").remove();

    // Build HTML for each pack
    let contentHtml = "";

    if (packs.length === 0) {
        contentHtml = '<div class="lumia-empty">No Packs loaded. Add one in settings!</div>';
    } else {
        packs.forEach(pack => {
            const packItems = pack.items;
            if (!packItems || packItems.length === 0) return;

            // Filter items by category
            const categoryItems = packItems.filter(item => item.loomCategory === category);
            if (categoryItems.length === 0) return;

            // Render Items Grid (simpler for Loom - no images)
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
                <div class="lumia-grid-item ${isSelected ? 'selected' : ''}"
                     data-pack="${escapedPackName}"
                     data-item="${escapedItemName}">
                    <div class="lumia-item-name">${currentItemName || "Unknown"}</div>
                </div>
                `;
            }).join("");

            if (itemsHtml) {
                contentHtml += `
                <div class="lumia-pack-section">
                    <div class="lumia-pack-header">
                        <h4>${pack.name} - ${category} (${categoryItems.length})</h4>
                    </div>
                    <div class="lumia-grid">
                        ${itemsHtml}
                    </div>
                </div>
                `;
            }
        });

        if (!contentHtml) {
            contentHtml = `<div class="lumia-empty">No "${category}" items found in loaded packs.</div>`;
        }
    }

    const modalHtml = `
        <dialog id="loom-selection-modal" class="popup wide_dialogue_popup large_dialogue_popup vertical_scrolling_dialogue_popup popup--animation-fast">
            <div class="popup-header">
                <h3 style="margin: 0; padding: 10px 0;">${title}</h3>
            </div>
            <div class="popup-content" style="padding: 15px; flex: 1; display: flex; flex-direction: column;">
                ${contentHtml}
            </div>
            <div class="popup-footer" style="display: flex; justify-content: center; padding: 15px; gap: 10px;">
                ${isMulti ? '<button class="menu_button loom-modal-done">Done</button>' : '<button class="menu_button loom-modal-close-btn">Close</button>'}
            </div>
        </dialog>
    `;

    $("body").append(modalHtml);
    const $modal = $("#loom-selection-modal");

    const closeModal = () => {
        $modal[0].close();
        $modal.remove();
        refreshUI();
    };

    $modal.find(".loom-modal-close-btn, .loom-modal-done").click(closeModal);

    $modal.on("click", function (e) {
        if (e.target === this) closeModal();
    });

    $modal.on("keydown", function (e) {
        if (e.key === "Escape") closeModal();
    });

    // Handle Item Selection
    $modal.find(".lumia-grid-item").click(function() {
        const packName = $(this).data("pack");
        const itemName = $(this).data("item");

        if (!isMulti) {
            settings[settingsKey] = { packName, itemName };
            saveSettings();
            closeModal();
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

function refreshUI() {
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
        
        // Update Behaviors List
        const currentBehaviorsDiv = document.getElementById("lumia-current-behaviors");
        if (currentBehaviorsDiv) {
            const names = settings.selectedBehaviors.map(sel => {
                 const item = getItemFromLibrary(sel.packName, sel.itemName);
                 return item ? item.lumiaDefName : null;
            }).filter(n => n);
            
            currentBehaviorsDiv.textContent = names.length > 0 ? names.join(", ") : "No behaviors selected";
        }

        // Update Personalities List
        const currentPersonalitiesDiv = document.getElementById("lumia-current-personalities");
        if (currentPersonalitiesDiv) {
             const names = settings.selectedPersonalities.map(sel => {
                 const item = getItemFromLibrary(sel.packName, sel.itemName);
                 return item ? item.lumiaDefName : null;
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

function handleNewBook(data, sourceName, isURL = false) {
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
        url: isURL ? sourceName : ""
    };
    
    saveSettings();
    refreshUI();
    toastr.success(`Lumia Book "${sourceName}" loaded! Found ${library.length} entries.`);
}

async function fetchWorldBook(url) {
    if (!url) return;
    try {
        const statusDiv = document.getElementById("lumia-book-status");
        if (statusDiv) statusDiv.textContent = "Fetching...";
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not ok");
        
        const data = await response.json();
        
        // Use filename from URL or just URL as name
        const name = url.split('/').pop() || url;
        
        handleNewBook(data, name, true);
        
    } catch (error) {
        console.error("Lumia Injector Error:", error);
        const statusDiv = document.getElementById("lumia-book-status");
        if (statusDiv) statusDiv.textContent = "Error";
        toastr.error("Failed to load book: " + error.message);
    }
}

// Lumia Randomization Logic
function ensureRandomLumia() {
    if (currentRandomLumia) return;
    
    const allItems = [];
    if (settings.packs) {
        Object.values(settings.packs).forEach(pack => {
            if (pack.items && pack.items.length > 0) {
                allItems.push(...pack.items);
            }
        });
    }

    if (allItems.length === 0) return;

    const randomIndex = Math.floor(Math.random() * allItems.length);
    currentRandomLumia = allItems[randomIndex];
}

MacrosParser.registerMacro("randomLumia", () => {
    ensureRandomLumia();
    return currentRandomLumia ? (currentRandomLumia.lumiaDef || "") : "";
});

MacrosParser.registerMacro("randomLumia.phys", () => {
    ensureRandomLumia();
    return currentRandomLumia ? (currentRandomLumia.lumiaDef || "") : "";
});

MacrosParser.registerMacro("randomLumia.pers", () => {
    ensureRandomLumia();
    return currentRandomLumia ? (currentRandomLumia.lumia_personality || "") : "";
});

MacrosParser.registerMacro("randomLumia.behav", () => {
    ensureRandomLumia();
    return currentRandomLumia ? (currentRandomLumia.lumia_behavior || "") : "";
});

MacrosParser.registerMacro("randomLumia.name", () => {
    ensureRandomLumia();
    return currentRandomLumia ? (currentRandomLumia.lumiaDefName || "") : "";
});

// Helper function to process nested {{randomLumia}} macros in content
function processNestedRandomLumiaMacros(content) {
    if (!content || typeof content !== 'string') return content;

    // Check if content contains any randomLumia macros
    if (!content.includes('{{randomLumia')) return content;

    // Ensure we have a random Lumia selected
    ensureRandomLumia();

    if (!currentRandomLumia) return content;

    let processed = content;
    let iterations = 0;
    const maxIterations = 10; // Prevent infinite loops

    // Keep processing until no more randomLumia macros are found
    while (processed.includes('{{randomLumia') && iterations < maxIterations) {
        let previousContent = processed;

        // Order matters: replace specific variants before generic ones
        processed = processed.replace(/\{\{randomLumia\.name\}\}/g, currentRandomLumia.lumiaDefName || "");
        processed = processed.replace(/\{\{randomLumia\.pers\}\}/g, currentRandomLumia.lumia_personality || "");
        processed = processed.replace(/\{\{randomLumia\.behav\}\}/g, currentRandomLumia.lumia_behavior || "");
        processed = processed.replace(/\{\{randomLumia\.phys\}\}/g, currentRandomLumia.lumiaDef || "");
        processed = processed.replace(/\{\{randomLumia\}\}/g, currentRandomLumia.lumiaDef || "");

        // If no changes were made, break to prevent infinite loop
        if (previousContent === processed) break;

        iterations++;
    }

    return processed;
}

// Macro Registration
function getLumiaContent(type, selection) {
    if (!selection) return "";

    // Handle array (Multi-select)
    if (Array.isArray(selection)) {
         const contents = selection.map(sel => {
             const item = getItemFromLibrary(sel.packName, sel.itemName);
             if (!item) return "";
             let content = "";
             if (type === 'behavior') content = item.lumia_behavior || "";
             if (type === 'personality') content = item.lumia_personality || "";
             // Process nested randomLumia macros
             return processNestedRandomLumiaMacros(content);
         }).filter(s => s).map(s => s.trim());

         if (type === 'behavior') {
             return contents.join("\n").trim();
         } else if (type === 'personality') {
             return contents.join("\n\n").trim();
         }
         return contents.join("\n").trim();
    }

    // Single Item
    const item = getItemFromLibrary(selection.packName, selection.itemName);
    if (!item) return "";

    let content = "";
    if (type === 'def') content = item.lumiaDef || "";

    // Process nested randomLumia macros before returning
    return processNestedRandomLumiaMacros(content).trim();
}

MacrosParser.registerMacro("lumiaDef", () => {
    if (!settings.selectedDefinition) return "";
    return getLumiaContent('def', settings.selectedDefinition);
});

MacrosParser.registerMacro("lumiaBehavior", () => {
    return getLumiaContent('behavior', settings.selectedBehaviors);
});

MacrosParser.registerMacro("lumiaPersonality", () => {
    return getLumiaContent('personality', settings.selectedPersonalities);
});

// Loom Content Macros
function getLoomContent(selection) {
    if (!selection) return "";

    // Handle array (Multi-select) or single selection
    const selections = Array.isArray(selection) ? selection : [selection];

    const contents = selections.map(sel => {
        const item = getItemFromLibrary(sel.packName, sel.itemName);
        if (!item || !item.loomContent) return null;
        // Process nested randomLumia macros
        return processNestedRandomLumiaMacros(item.loomContent);
    }).filter(c => c);

    // Join with double newlines, but not after the last entry
    return contents.join("\n\n").trim();
}

MacrosParser.registerMacro("loomStyle", () => {
    if (!settings.selectedLoomStyle) return "";
    return getLoomContent(settings.selectedLoomStyle);
});

MacrosParser.registerMacro("loomUtils", () => {
    if (!settings.selectedLoomUtils || settings.selectedLoomUtils.length === 0) return "";
    return getLoomContent(settings.selectedLoomUtils);
});

MacrosParser.registerMacro("loomRetrofits", () => {
    if (!settings.selectedLoomRetrofits || settings.selectedLoomRetrofits.length === 0) return "";
    return getLoomContent(settings.selectedLoomRetrofits);
});

// Message tracking and OOC trigger macros
// --- OOC COMMENT INLINE DISPLAY ---
// Lumia OOC color constant - the specific purple color used for Lumia's OOC comments
const LUMIA_OOC_COLOR = "#9370DB";
const LUMIA_OOC_COLOR_LOWER = "#9370db";

/**
 * Check if a font element has the Lumia OOC color
 * @param {HTMLElement} fontElement - The font element to check
 * @returns {boolean} True if the font has the Lumia OOC color
 */
function isLumiaOOCFont(fontElement) {
    const color = fontElement.getAttribute('color');
    if (!color) return false;
    const normalizedColor = color.toLowerCase().trim();
    return normalizedColor === LUMIA_OOC_COLOR_LOWER || normalizedColor === 'rgb(147, 112, 219)';
}

/**
 * Create the styled OOC comment box element
 * @param {string} content - The text content for the OOC box
 * @param {string|null} avatarImg - URL to avatar image, or null for placeholder
 * @returns {HTMLElement} The created OOC comment box element
 */
function createOOCCommentBox(content, avatarImg) {
    // Create avatar element
    const avatarElement = avatarImg
        ? createElement('img', {
            attrs: { src: avatarImg, alt: 'Lumia Avatar', class: 'lumia-ooc-avatar' }
        })
        : createElement('div', {
            attrs: { class: 'lumia-ooc-avatar lumia-ooc-avatar-placeholder' },
            text: '?'
        });

    // Create title element
    const titleElement = createElement('div', {
        attrs: { class: 'lumia-ooc-title' },
        text: 'Out-of-Context Commentary'
    });

    // Create header with avatar and title
    const headerElement = createElement('div', {
        attrs: { class: 'lumia-ooc-header' },
        children: [avatarElement, titleElement]
    });

    // Create content element
    const contentElement = createElement('div', {
        attrs: { class: 'lumia-ooc-content' },
        html: content // Use html to preserve any formatting
    });

    // Create the main comment box
    const commentBox = createElement('div', {
        attrs: { class: 'lumia-ooc-comment-box', 'data-lumia-ooc': 'true' },
        children: [headerElement, contentElement]
    });

    return commentBox;
}

/**
 * Get avatar image URL from selected Lumia definition
 * @returns {string|null} Avatar image URL or null
 */
function getLumiaAvatarImg() {
    if (settings.selectedDefinition) {
        const item = getItemFromLibrary(settings.selectedDefinition.packName, settings.selectedDefinition.itemName);
        if (item && item.lumia_img) {
            return item.lumia_img;
        }
    }
    return null;
}

/**
 * Process Lumia OOC comments in a message by finding <font> elements with the OOC color
 * This approach works regardless of "Show Tags" setting
 * Following SimTracker's renderer.js pattern for DOM manipulation
 * @param {number} mesId - The message ID to process
 * @param {boolean} force - Force reprocessing even if OOC boxes exist
 */
function processLumiaOOCComments(mesId, force = false) {
    try {
        // Get the message element from DOM (SimTracker pattern)
        const messageElement = query(`div[mesid="${mesId}"] .mes_text`);

        if (!messageElement) {
            return; // Silent return - element may not be rendered yet
        }

        // Find all <font> elements with the Lumia OOC color
        const fontElements = queryAll('font', messageElement);
        const oocFonts = fontElements.filter(isLumiaOOCFont);

        if (oocFonts.length === 0) {
            return; // No Lumia OOC fonts found
        }

        console.log(`[${MODULE_NAME}] 🔮 Found ${oocFonts.length} Lumia OOC comment(s) in message ${mesId}`);

        // Get avatar image
        const avatarImg = getLumiaAvatarImg();

        // Save scroll position (SimTracker pattern)
        const scrollY = window.scrollY || window.pageYOffset;

        // Process each OOC font element
        oocFonts.forEach((fontElement, index) => {
            // Get the content from the font element
            const content = fontElement.innerHTML;

            console.log(`[${MODULE_NAME}] 🔮 Processing OOC #${index + 1}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);

            // Create the styled comment box
            const commentBox = createOOCCommentBox(content, avatarImg);

            // Find the parent element to replace
            // The font might be inside a <lumia_ooc> tag or standalone
            let elementToReplace = fontElement;
            const parent = fontElement.parentElement;

            // Check if parent is a <lumia_ooc> element (custom tag)
            if (parent && parent.tagName && parent.tagName.toLowerCase() === 'lumia_ooc') {
                elementToReplace = parent;
            }

            // Replace the element with the comment box
            if (elementToReplace.parentNode) {
                elementToReplace.parentNode.replaceChild(commentBox, elementToReplace);
                console.log(`[${MODULE_NAME}] 🔮 Replaced OOC #${index + 1} with styled comment box`);
            }
        });

        // Force reflow to ensure styles are applied (SimTracker renderer.js pattern)
        messageElement.offsetHeight;

        // Restore scroll position (SimTracker pattern)
        window.scrollTo(0, scrollY);

        console.log(`[${MODULE_NAME}] 🔮 Finished processing OOC comments in message ${mesId}`);

    } catch (error) {
        console.error(`[${MODULE_NAME}] Error processing OOC comments:`, error);
    }
}

/**
 * Process all Lumia OOC comments in the chat
 * Called on CHAT_CHANGED and initial load to ensure all messages are processed
 */
function processAllLumiaOOCComments() {
    const context = getContext();
    if (!context || !context.chat) return;

    console.log(`[${MODULE_NAME}] 🔮 Processing all OOC comments in chat (${context.chat.length} messages)`);

    // Process each message in the chat
    for (let i = 0; i < context.chat.length; i++) {
        processLumiaOOCComments(i);
    }
}

/**
 * Check if a font element is a partial/incomplete OOC marker during streaming
 * @param {HTMLElement} fontElement - The font element to check
 * @returns {boolean} True if it appears to be a partial OOC marker
 */
function isPartialOOCMarker(fontElement) {
    if (!isLumiaOOCFont(fontElement)) return false;

    // Check if the font element is still being streamed (incomplete content)
    const parent = fontElement.parentElement;
    if (!parent) return true; // No parent means it's likely incomplete

    // Check if inside a complete lumia_ooc structure
    const lumiaOocParent = fontElement.closest('lumia_ooc');
    if (!lumiaOocParent) {
        // Font exists but no lumia_ooc wrapper - might be incomplete
        // Check if the message is still streaming by looking for common streaming indicators
        const mesText = fontElement.closest('.mes_text');
        if (mesText) {
            // Look for the typing indicator or other streaming signs
            const isStreaming = mesText.closest('.mes')?.classList.contains('last_mes');
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
    // Find font elements with Lumia OOC color
    const fontElements = queryAll('font', messageElement);
    const oocFonts = fontElements.filter(isLumiaOOCFont);

    oocFonts.forEach(fontElement => {
        // Check if this is a partial marker
        if (isPartialOOCMarker(fontElement)) {
            // Hide the font element during streaming
            if (!fontElement.classList.contains('lumia-ooc-marker-hidden')) {
                fontElement.classList.add('lumia-ooc-marker-hidden');
                fontElement.style.display = 'none';
                console.log(`[${MODULE_NAME}] 🔮 Hiding partial OOC marker during streaming`);
            }
        }
    });
}

/**
 * Unhide and process OOC markers after streaming completes
 * @param {HTMLElement} messageElement - The message element to process
 */
function unhideAndProcessOOCMarkers(messageElement) {
    // Find hidden OOC markers
    const hiddenMarkers = queryAll('.lumia-ooc-marker-hidden', messageElement);

    if (hiddenMarkers.length === 0) return;

    console.log(`[${MODULE_NAME}] 🔮 Unhiding ${hiddenMarkers.length} OOC markers`);

    // Unhide the markers
    hiddenMarkers.forEach(marker => {
        marker.classList.remove('lumia-ooc-marker-hidden');
        marker.style.display = '';
    });

    // Get mesId from parent element and process
    const mesBlock = messageElement.closest('div[mesid]');
    if (mesBlock) {
        const mesId = parseInt(mesBlock.getAttribute('mesid'), 10);
        processLumiaOOCComments(mesId);
    }
}

/**
 * Set up MutationObserver for streaming support and dynamic content
 * Observes chat for new messages and font elements with OOC color
 */
function setupLumiaOOCObserver() {
    const chatElement = document.getElementById("chat");

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Handle added nodes
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType !== Node.ELEMENT_NODE) return;

                // Check if this is a message text element or contains one
                let messageElements = [];
                if (node.classList && node.classList.contains('mes_text')) {
                    messageElements = [node];
                } else if (node.querySelectorAll) {
                    messageElements = Array.from(node.querySelectorAll('.mes_text'));
                }

                // Also check if a font element was added directly
                if (node.tagName === 'FONT' && isLumiaOOCFont(node)) {
                    const mesText = node.closest('.mes_text');
                    if (mesText && !messageElements.includes(mesText)) {
                        messageElements.push(mesText);
                    }
                }

                messageElements.forEach((messageElement) => {
                    // Check for OOC fonts and process or hide them
                    const oocFonts = queryAll('font', messageElement).filter(isLumiaOOCFont);
                    if (oocFonts.length > 0) {
                        // Check if streaming (last message)
                        const isLastMessage = messageElement.closest('.mes')?.classList.contains('last_mes');
                        if (isLastMessage) {
                            hideStreamingOOCMarkers(messageElement);
                        } else {
                            // Not streaming, process immediately
                            const mesBlock = messageElement.closest('div[mesid]');
                            if (mesBlock) {
                                const mesId = parseInt(mesBlock.getAttribute('mesid'), 10);
                                processLumiaOOCComments(mesId);
                            }
                        }
                    }
                });
            });
        });
    });

    const targetElement = chatElement || document.body;
    observer.observe(targetElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['color'] // Watch for color attribute changes on font elements
    });

    console.log(`[${MODULE_NAME}] 🔮 OOC observer started on ${chatElement ? 'chat element' : 'body (fallback)'}`);

    return observer;
}

MacrosParser.registerMacro("lumiaMessageCount", () => {
    const context = getContext();
    if (!context || !context.chat) return "0";
    return context.chat.length.toString();
});

MacrosParser.registerMacro("lumiaOOCTrigger", () => {
    const context = getContext();
    if (!context || !context.chat) return "";

    const interval = settings.lumiaOOCInterval;
    if (!interval || interval <= 0) return "";

    const messageCount = context.chat.length;
    const nextTrigger = Math.ceil(messageCount / interval) * interval;
    const messagesUntil = nextTrigger - messageCount;

    // Check if current message count is divisible by interval (trigger time!)
    if (messagesUntil === 0) {
        return "**OOC Commentary Time!** The Gods' want me to speak up to the Human right now, in the out-of-context comments for the Loom! Perfect! I've got a *lot* I want to say and I want them to hear my voice loud and clear!";
    }

    // Otherwise, show countdown
    return `Looks like I've got ${messagesUntil} message${messagesUntil !== 1 ? 's' : ''} left until it's time to speak to the Human directly! The Gods' are anticipating me to be breathless, I cannot wait for my turn!`;
});


jQuery(async () => {
    // Initialize
    loadSettings();

    const settingsHtml = await loadSettingsHtml();
    $("#extensions_settings").append(settingsHtml);

    // Initial Refresh
    refreshUI();

    // Listeners
    $("#lumia-fetch-btn").click(() => {
        const url = $("#lumia-url-input").val();
        fetchWorldBook(url);
    });

    $("#lumia-open-definitions-btn").click(() => {
        showSelectionModal('definition');
    });

    $("#lumia-open-behaviors-btn").click(() => {
        showSelectionModal('behavior');
    });

    $("#lumia-open-personalities-btn").click(() => {
        showSelectionModal('personality');
    });

    $("#lumia-open-misc-btn").click(() => {
        showMiscFeaturesModal();
    });

    $("#loom-open-style-btn").click(() => {
        showLoomSelectionModal('Narrative Style');
    });

    $("#loom-open-utils-btn").click(() => {
        showLoomSelectionModal('Loom Utilities');
    });

    $("#loom-open-retrofits-btn").click(() => {
        showLoomSelectionModal('Retrofits');
    });

    $("#lumia-upload-btn").click(() => {
        $("#lumia-file-input").click();
    });

    $("#lumia-file-input").change((event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                handleNewBook(data, file.name, false);
            } catch (error) {
                console.error("Lumia Injector Error:", error);
                toastr.error("Failed to parse: " + error.message);
            }
        };
        reader.readAsText(file);
        // Reset so same file can be selected again if needed
        event.target.value = '';
    });

    // Hook into CHARACTER_MESSAGE_RENDERED to process OOC comments
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mesId) => {
        console.log(`[${MODULE_NAME}] 🔮 CHARACTER_MESSAGE_RENDERED event for mesId ${mesId}`);
        // Small delay to ensure DOM is fully rendered
        setTimeout(() => processLumiaOOCComments(mesId), 50);
    });

    // Handle message edits - reprocess OOC comments (SimTracker pattern)
    // Need to force reprocess by clearing the existing OOC box first
    eventSource.on(event_types.MESSAGE_EDITED, (mesId) => {
        console.log(`[${MODULE_NAME}] 🔮 MESSAGE_EDITED event for mesId ${mesId}`);
        // Remove existing OOC boxes before reprocessing
        const messageElement = query(`div[mesid="${mesId}"] .mes_text`);
        if (messageElement) {
            const existingBoxes = queryAll('.lumia-ooc-comment-box', messageElement);
            existingBoxes.forEach(box => box.remove());
        }
        setTimeout(() => processLumiaOOCComments(mesId), 50);
    });

    // Handle swipes - reprocess OOC comments (SimTracker pattern)
    eventSource.on(event_types.MESSAGE_SWIPED, (mesId) => {
        console.log(`[${MODULE_NAME}] 🔮 MESSAGE_SWIPED event for mesId ${mesId}`);
        setTimeout(() => processLumiaOOCComments(mesId), 50);
    });

    // Handle chat changes - reprocess all OOC comments (SimTracker pattern)
    eventSource.on(event_types.CHAT_CHANGED, () => {
        console.log(`[${MODULE_NAME}] 🔮 CHAT_CHANGED event - reprocessing all OOC comments`);
        // Delay to ensure chat DOM is fully loaded
        setTimeout(() => processAllLumiaOOCComments(), 100);
    });

    // Handle generation end - unhide and process any hidden OOC markers (SimTracker pattern)
    eventSource.on(event_types.GENERATION_ENDED, () => {
        console.log(`[${MODULE_NAME}] 🔮 GENERATION_ENDED event - processing OOC markers`);
        // Find all message elements and unhide any hidden markers
        const chatElement = document.getElementById("chat");
        if (chatElement) {
            const messageElements = queryAll('.mes_text', chatElement);
            messageElements.forEach(messageElement => {
                unhideAndProcessOOCMarkers(messageElement);
            });
        }
    });

    // Set up MutationObserver for streaming support (SimTracker pattern)
    // This hides partial OOC markers during generation
    setupLumiaOOCObserver();

    // Process any existing OOC comments on initial load
    setTimeout(() => {
        console.log(`[${MODULE_NAME}] 🔮 Initial load - processing existing OOC comments`);
        processAllLumiaOOCComments();
    }, 500);

    console.log(`${MODULE_NAME} initialized`);
});
