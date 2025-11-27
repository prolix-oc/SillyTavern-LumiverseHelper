import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";
import { MacrosParser } from "../../../macros.js";

const MODULE_NAME = "lumia-injector";
const SETTINGS_KEY = "lumia_injector_settings";

let settings = {
    packs: {}, // Dictionary of packs: { "PackName": { name: "PackName", items: [], url: "" } }
    selectedDefinition: null, // { packName: string, itemName: string }
    selectedBehaviors: [], // Array of { packName: string, itemName: string }
    selectedPersonalities: [] // Array of { packName: string, itemName: string }
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

    const map = new Map(); // Key: Lumia Name

    for (const entry of entries) {
        if (!entry.content || typeof entry.content !== 'string') continue;

        const comment = (entry.comment || "").trim();
        
        // Extract name from parenthesis
        const nameMatch = comment.match(/\((.+?)\)/);
        if (!nameMatch) continue; // IGNORE if no parenthesis name
        
        const name = nameMatch[1].trim();
        let lumia = map.get(name);
        if (!lumia) {
            lumia = {
                lumiaDefName: name,
                lumia_img: null,
                lumia_personality: null,
                lumia_behavior: null,
                lumiaDef: null,
                defAuthor: null
            };
            map.set(name, lumia);
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

    return Array.from(map.values());
}

function getItemFromLibrary(packName, itemName) {
    const pack = settings.packs[packName];
    if (!pack) return null;
    return pack.items.find(i => i.lumiaDefName === itemName);
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

    } else {
        if (statusDiv) statusDiv.textContent = "No Lumia Definitions loaded";
        
        ["lumia-current-definition", "lumia-current-behaviors", "lumia-current-personalities"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "No selection possible (Load definitions first)";
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

// Macro Registration
function getLumiaContent(type, selection) {
    if (!selection) return "";
    
    // Handle array (Multi-select)
    if (Array.isArray(selection)) {
         const contents = selection.map(sel => {
             const item = getItemFromLibrary(sel.packName, sel.itemName);
             if (!item) return "";
             if (type === 'behavior') return item.lumia_behavior || "";
             if (type === 'personality') return item.lumia_personality || "";
             return "";
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
    
    return content.trim();
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

    console.log(`${MODULE_NAME} initialized`);
});
