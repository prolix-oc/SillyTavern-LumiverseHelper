import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";
import { MacrosParser } from "../../../macros.js";

const MODULE_NAME = "lumia-injector";
const SETTINGS_KEY = "lumia_injector_settings";

let settings = {
    worldBookUrl: "",
    worldBookData: null,
    selectedDefinition: null, // uid as string/number
    selectedBehaviors: [], // array of uids
    selectedPersonalities: [] // array of uids
};

let parsedEntries = {};

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

function parseWorldBook(data) {
    if (!data || !data.entries) return { definitions: [], behaviors: [], personalities: [] };

    const entries = Object.values(data.entries);
    const definitions = [];
    const behaviors = [];
    const personalities = [];

    for (const entry of entries) {
        if (!entry.content || (typeof entry.content === 'string' && !entry.content.trim())) continue;
        
        const comment = (entry.comment || "").trim();
        const commentLower = comment.toLowerCase();
        let type = null;

        // Determine type based on outletName or keywords in comment
        if (entry.outletName === "Lumia_Description" || commentLower.includes("definition")) {
            type = "definition";
        } else if (entry.outletName === "Lumia_Behavior" || commentLower.includes("behavior")) {
            type = "behavior";
        } else if (entry.outletName === "Lumia_Personality" || commentLower.includes("personality")) {
            type = "personality";
        }

        if (type) {
            // Extract display name from parenthesis: "Lumia Behavior (Name)" -> "Name"
            const nameMatch = comment.match(/\((.+?)\)/);
            entry.displayName = nameMatch ? nameMatch[1].trim() : comment.replace(/~~/g, "").trim();

            if (type === "definition") {
                // Image extraction logic ONLY for definitions
                if (entry.image === undefined) {
                    const imgMatch = entry.content.match(/\[lumia_img=(.+?)\]/);
                    if (imgMatch) {
                        entry.image = imgMatch[1].trim();
                        entry.content = entry.content.replace(imgMatch[0], "").trim();
                    } else {
                        entry.image = null;
                    }
                }
                definitions.push(entry);
            } else if (type === "behavior") {
                behaviors.push(entry);
            } else if (type === "personality") {
                personalities.push(entry);
            }
        }
    }

    // Legacy Format Handling: Check personalities for fused behavior/personality content
    personalities.forEach(entry => {
        // Check if we already have a behavior with this name
        const hasBehavior = behaviors.some(b => b.displayName === entry.displayName);
        
        if (!hasBehavior && entry.content && typeof entry.content === 'string') {
            // Regex to find setvar/setglobalvar blocks
            const behaviorMatch = entry.content.match(/{{setvar::lumia_behavior_\w+::([\s\S]*?)}}/);
            const personalityMatch = entry.content.match(/{{setglobalvar::lumia_personality_\w+::([\s\S]*?)}}/);

            if (behaviorMatch) {
                // Synthesize a new Behavior entry
                const extractedBehavior = behaviorMatch[1].trim();
                const newBehavior = {
                    uid: `legacy-behavior-${entry.uid}`, // Pseudo-UID
                    displayName: entry.displayName,
                    comment: `Lumia Behavior (${entry.displayName}) [Extracted]`,
                    content: extractedBehavior
                };
                behaviors.push(newBehavior);
            }

            if (personalityMatch) {
                // Update the personality entry to use only the extracted content
                entry.content = personalityMatch[1].trim();
            }
        }
    });
    
    return { definitions, behaviors, personalities };
}

function updateParsedEntries(definitions, behaviors, personalities) {
    parsedEntries = {};
    [...definitions, ...behaviors, ...personalities].forEach(entry => {
        parsedEntries[entry.uid] = entry;
    });
}

function showSelectionModal(type) {
    // type: 'definition' | 'behavior' | 'personality'
    const parsed = parseWorldBook(settings.worldBookData || {});
    let items = [];
    let title = "";
    let isMulti = false;
    let displayImage = null; // Image to use for grid items (if applicable)

    // Find selected definition to get its image
    const selectedDef = parsed.definitions.find(d => Number(d.uid) === settings.selectedDefinition);
    const defImage = selectedDef ? selectedDef.image : null;

    if (type === 'definition') {
        items = parsed.definitions;
        title = "Select Definition";
        isMulti = false;
        // For definition mode, we use each item's own image
    } else if (type === 'behavior') {
        items = parsed.behaviors;
        title = "Select Behaviors";
        isMulti = true;
        displayImage = defImage;
    } else if (type === 'personality') {
        items = parsed.personalities;
        title = "Select Personalities";
        isMulti = true;
        displayImage = defImage;
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
                        // Handle selection logic (handle both string and number UIDs for legacy/legacy-mixed support)
                        const itemUid = item.uid; // Keep original type
                        const collection = isMulti 
                            ? (type === 'behavior' ? settings.selectedBehaviors : settings.selectedPersonalities) 
                            : null;
                        
                        let isSelected = false;
                        if (isMulti) {
                            // Check properly regardless of type mismatch if possible
                            isSelected = collection.some(id => id == itemUid); // loose equality for legacy string vs number safety
                        } else {
                            isSelected = settings.selectedDefinition == itemUid;
                        }
                        
                        // Determine which image to show
                        // If we are in definition mode, show item's image
                        // If behavior/personality, show the SELECTED DEFINITION's image (displayImage)
                        const imgToShow = (type === 'definition') ? item.image : displayImage;

                        return `
                        <div class="lumia-grid-item ${isSelected ? 'selected' : ''}" data-uid="${item.uid}">
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
        refreshUI(); // Refresh after closing to show updated lists
    };

    $modal.find(".lumia-modal-close-btn, .lumia-modal-done").click(closeModal);
    
    // Close on clicking outside (native dialog behavior needs helper or manual check)
    $modal.on("click", function (e) {
        if (e.target === this) {
          closeModal();
        }
    });
    
    // Close on ESC
    $modal.on("keydown", function (e) {
        if (e.key === "Escape") {
          closeModal();
        }
    });

    $modal.find(".lumia-grid-item").click(function() {
        // Retrieve UID. jQuery .data() attempts to infer type (int, float, string). 
        // For "legacy-behavior-123", it stays string. For "123", it becomes number.
        const uid = $(this).data("uid");
        
        if (!isMulti) {
            // Single Select (Definition)
            settings.selectedDefinition = uid;
            saveSettings();
            closeModal();
        } else {
            // Multi Select (Behavior/Personality)
            const $this = $(this);
            let collection;
            
            if (type === 'behavior') {
                collection = settings.selectedBehaviors;
            } else {
                collection = settings.selectedPersonalities;
            }

            // Toggle logic using loose equality for safety
            const index = collection.findIndex(id => id == uid);
            
            if (index !== -1) {
                collection.splice(index, 1);
                $this.removeClass('selected');
            } else {
                collection.push(uid);
                $this.addClass('selected');
            }

            // Update reference in settings
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

    if (settings.worldBookData && settings.worldBookData.entries) {
        if (statusDiv) statusDiv.textContent = `Loaded: ${settings.worldBookData.name || "Unknown World Book"}`;
        
        const { definitions, behaviors, personalities } = parseWorldBook(settings.worldBookData);
        updateParsedEntries(definitions, behaviors, personalities);
        
        // Update Definition Selector Label
        const currentDefDiv = document.getElementById("lumia-current-definition");
        if (currentDefDiv) {
            const selectedDef = definitions.find(d => d.uid == settings.selectedDefinition);
            currentDefDiv.textContent = selectedDef ? 
                (selectedDef.displayName || "Unnamed Definition") : 
                "No definition selected";
        }
        
        // Update Behaviors List
        const currentBehaviorsDiv = document.getElementById("lumia-current-behaviors");
        if (currentBehaviorsDiv) {
            const selectedBehaviors = settings.selectedBehaviors
                .map(uid => behaviors.find(b => b.uid == uid)?.displayName)
                .filter(name => name);
            
            currentBehaviorsDiv.textContent = selectedBehaviors.length > 0 
                ? selectedBehaviors.join(", ") 
                : "No behaviors selected";
        }

        // Update Personalities List
        const currentPersonalitiesDiv = document.getElementById("lumia-current-personalities");
        if (currentPersonalitiesDiv) {
            const selectedPersonalities = settings.selectedPersonalities
                .map(uid => personalities.find(p => p.uid == uid)?.displayName)
                .filter(name => name);
            
            currentPersonalitiesDiv.textContent = selectedPersonalities.length > 0 
                ? selectedPersonalities.join(", ") 
                : "No personalities selected";
        }

    } else {
        if (statusDiv) statusDiv.textContent = "No World Book loaded";
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
        
        if (!data.entries) throw new Error("Invalid World Book format (no entries)");

        settings.worldBookData = data;
        settings.worldBookUrl = url;
        
        // Reset selections on new book? Or try to keep if IDs match? For safety, maybe keep if they exist.
        // For now, let's keep and if they don't exist they won't render checked.
        
        saveSettings();
        refreshUI();
        toastr.success("World Book fetched successfully!");
    } catch (error) {
        console.error("Lumia Injector Error:", error);
        const statusDiv = document.getElementById("lumia-book-status");
        if (statusDiv) statusDiv.textContent = "Error fetching World Book";
        toastr.error("Failed to fetch World Book: " + error.message);
    }
}

// Macro Registration
function getEntryContent(uid) {
    // Ensure parsed entries are available if not yet parsed (e.g. on first load before UI open? No, init calls refreshUI)
    // But refreshUI requires DOM?
    // Safer to check parsedEntries.
    if (!parsedEntries[uid] && settings.worldBookData) {
       // Force parse if missing
       const { definitions, behaviors, personalities } = parseWorldBook(settings.worldBookData);
       updateParsedEntries(definitions, behaviors, personalities);
    }

    const entry = parsedEntries[uid];
    return entry ? entry.content : "";
}

MacrosParser.registerMacro("lumiaDef", () => {
    if (settings.selectedDefinition === null) return "";
    return getEntryContent(settings.selectedDefinition);
});

MacrosParser.registerMacro("lumiaBehavior", () => {
    return settings.selectedBehaviors
        .map(uid => getEntryContent(uid))
        .join("\n\n");
});

MacrosParser.registerMacro("lumiaPersonality", () => {
    return settings.selectedPersonalities
        .map(uid => getEntryContent(uid))
        .join("\n\n");
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
                if (!data.entries) throw new Error("Invalid World Book format (no entries)");

                settings.worldBookData = data;
                settings.worldBookUrl = "Uploaded File: " + file.name;
                saveSettings();
                refreshUI();
                toastr.success("World Book uploaded successfully!");
            } catch (error) {
                console.error("Lumia Injector Error:", error);
                toastr.error("Failed to parse World Book: " + error.message);
            }
        };
        reader.readAsText(file);
        // Reset so same file can be selected again if needed
        event.target.value = '';
    });

    console.log(`${MODULE_NAME} initialized`);
});
