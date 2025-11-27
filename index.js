import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";
import { MacrosParser } from "../../../macros.js";

const MODULE_NAME = "lumia-injector";
const SETTINGS_KEY = "lumia_injector_settings";

let settings = {
    worldBookUrl: "",
    worldBookData: null, // Keep raw data if needed, or just use library
    lumiaLibrary: [], // The processed library
    selectedDefinition: null, // Index in library
    selectedBehaviors: [], // Array of indices
    selectedPersonalities: [] // Array of indices
};

function loadSettings() {
    if (extension_settings[SETTINGS_KEY]) {
        settings = { ...settings, ...extension_settings[SETTINGS_KEY] };
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
    // Check if already in Lumia format (Array check)
    if (Array.isArray(data)) {
        // Validate basic structure? Assume it's correct if array for now.
        return data;
    }
    // Also check if it's an object with a key holding the array
    // But instructions say "store books as a JSON object: { [ ... ] }" which is invalid JSON syntax usually meaning top level array or list.
    // Assuming if data.entries exists, it's World Book.
    if (!data.entries) return [];

    const map = new Map(); // Key: Lumia Name

    const entries = Object.values(data.entries).map(e => ({ ...e }));

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

function showSelectionModal(type) {
    // type: 'definition' | 'behavior' | 'personality'
    // We use the processed library now
    const library = settings.lumiaLibrary || [];
    let items = []; // Will be indices of library? Or objects?
    // Let's map library items to display objects with index as ID
    
    items = library.map((lumia, index) => ({
        uid: index,
        displayName: lumia.lumiaDefName,
        image: lumia.lumia_img
    }));

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

    const modalHtml = `
        <dialog id="lumia-selection-modal" class="popup wide_dialogue_popup large_dialogue_popup vertical_scrolling_dialogue_popup popup--animation-fast">
            <div class="popup-header">
                <h3 style="margin: 0; padding: 10px 0;">${title}</h3>
            </div>
            <div class="popup-content" style="padding: 15px; flex: 1; display: flex; flex-direction: column;">
                <div class="lumia-grid">
                    ${items.length > 0 ? items.map(item => {
                        const collection = isMulti 
                            ? (type === 'behavior' ? settings.selectedBehaviors : settings.selectedPersonalities) 
                            : null;
                        
                        let isSelected = false;
                        if (isMulti) {
                            isSelected = collection.includes(item.uid);
                        } else {
                            isSelected = settings.selectedDefinition === item.uid;
                        }
                        
                        // Use the image derived from the Lumia object itself (for all types)
                        // This ensures behaviors/personalities display their character's image
                        const imgToShow = item.image;

                        return `
                        <div class="lumia-grid-item ${isSelected ? 'selected' : ''}" data-index="${item.uid}">
                            <div class="lumia-item-image">
                                ${imgToShow ? `<img src="${imgToShow}" alt="${item.displayName}">` : '<div class="lumia-placeholder-img">?</div>'}
                            </div>
                            <div class="lumia-item-name">${item.displayName || "Unknown"}</div>
                        </div>
                        `;
                    }).join("") : '<div class="lumia-empty">No items found</div>'}
                </div>
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

    $modal.find(".lumia-grid-item").click(function() {
        const index = Number($(this).data("index"));
        
        if (!isMulti) {
            settings.selectedDefinition = index;
            saveSettings();
            closeModal();
        } else {
            const $this = $(this);
            let collection;
            if (type === 'behavior') {
                collection = settings.selectedBehaviors;
            } else {
                collection = settings.selectedPersonalities;
            }

            if (collection.includes(index)) {
                collection = collection.filter(id => id !== index);
                $this.removeClass('selected');
            } else {
                collection.push(index);
                $this.addClass('selected');
            }

            if (type === 'behavior') {
                settings.selectedBehaviors = collection;
            } else {
                settings.selectedPersonalities = collection;
            }
            
            saveSettings();
        }
    });
    
    $modal[0].showModal();
}

function refreshUI() {
    const statusDiv = document.getElementById("lumia-book-status");
    const urlInput = document.getElementById("lumia-url-input");
    
    if (urlInput) urlInput.value = settings.worldBookUrl || "";

    if (settings.lumiaLibrary && settings.lumiaLibrary.length > 0) {
        if (statusDiv) statusDiv.textContent = `Loaded Library (${settings.lumiaLibrary.length} items)`;
        
        // Update Definition Selector Label
        const currentDefDiv = document.getElementById("lumia-current-definition");
        if (currentDefDiv) {
            const selectedDef = settings.lumiaLibrary[settings.selectedDefinition];
            currentDefDiv.textContent = selectedDef ? 
                (selectedDef.lumiaDefName || "Unnamed Definition") : 
                "No definition selected";
        }
        
        // Update Behaviors List
        const currentBehaviorsDiv = document.getElementById("lumia-current-behaviors");
        if (currentBehaviorsDiv) {
            const selectedList = settings.selectedBehaviors
                .map(idx => settings.lumiaLibrary[idx]?.lumiaDefName)
                .filter(name => name);
            
            currentBehaviorsDiv.textContent = selectedList.length > 0 
                ? selectedList.join(", ") 
                : "No behaviors selected";
        }

        // Update Personalities List
        const currentPersonalitiesDiv = document.getElementById("lumia-current-personalities");
        if (currentPersonalitiesDiv) {
            const selectedList = settings.selectedPersonalities
                .map(idx => settings.lumiaLibrary[idx]?.lumiaDefName)
                .filter(name => name);
            
            currentPersonalitiesDiv.textContent = selectedList.length > 0 
                ? selectedList.join(", ") 
                : "No personalities selected";
        }

    } else {
        if (settings.worldBookData) {
             // If data exists but library empty, maybe trigger processing? 
             // Assuming upload/fetch triggers processing.
             if (statusDiv) statusDiv.textContent = "Processing...";
             settings.lumiaLibrary = processWorldBook(settings.worldBookData);
             // Retry refresh
             if (settings.lumiaLibrary.length > 0) {
                 refreshUI();
                 return;
             }
        }
        if (statusDiv) statusDiv.textContent = "No Lumia Book loaded";
        const elems = ["lumia-current-definition", "lumia-current-behaviors", "lumia-current-personalities"];
        elems.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "No selection possible (Load book first)";
        });
    }
}

async function fetchWorldBook(url) {
    if (!url) return;
    try {
        const statusDiv = document.getElementById("lumia-book-status");
        if (statusDiv) statusDiv.textContent = "Fetching...";
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not ok");
        
        const data = await response.json();
        
        // Process immediately
        const library = processWorldBook(data);
        if (library.length === 0) throw new Error("No valid Lumia entries found in World Book.");

        settings.worldBookData = data;
        settings.lumiaLibrary = library;
        settings.worldBookUrl = url;
        
        // Reset selections implicitly? Or clean them up.
        settings.selectedDefinition = null;
        settings.selectedBehaviors = [];
        settings.selectedPersonalities = [];
        
        saveSettings();
        refreshUI();
        toastr.success(`Lumia Book loaded! Found ${library.length} entries.`);
    } catch (error) {
        console.error("Lumia Injector Error:", error);
        const statusDiv = document.getElementById("lumia-book-status");
        if (statusDiv) statusDiv.textContent = "Error";
        toastr.error("Failed to load book: " + error.message);
    }
}

// Macro Registration
function getLumiaContent(type, indices) {
    // indices can be single int or array
    const library = settings.lumiaLibrary || [];
    
    if (Array.isArray(indices)) {
        return indices.map(idx => {
            const item = library[idx];
            if (!item) return "";
            if (type === 'behavior') return item.lumia_behavior || "";
            if (type === 'personality') return item.lumia_personality || "";
            return "";
        }).filter(s => s).join("\n\n");
    } else {
        // Single index
        const item = library[indices];
        if (!item) return "";
        if (type === 'def') return item.lumiaDef || "";
        return "";
    }
}

MacrosParser.registerMacro("lumiaDef", () => {
    if (settings.selectedDefinition === null) return "";
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
                
                const library = processWorldBook(data);
                if (library.length === 0) throw new Error("No valid Lumia entries found.");

                settings.worldBookData = data;
                settings.lumiaLibrary = library;
                settings.worldBookUrl = "Uploaded File: " + file.name;
                
                // Reset selections
                settings.selectedDefinition = null;
                settings.selectedBehaviors = [];
                settings.selectedPersonalities = [];

                saveSettings();
                refreshUI();
                toastr.success(`Lumia Book uploaded! Found ${library.length} entries.`);
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
