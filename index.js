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
                // We modify a clone or the object itself? The object is from settings reference.
                // We should only affect the rendering/macro usage, so updating the property here is okay
                // as parseWorldBook returns lists for rendering. 
                // The 'entry' here is a reference to the object in `values`.
                // If we modify 'content' here, it modifies the loaded object in memory settings.
                // This is desirable so macros use the extracted content.
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

function renderList(containerId, items, type, currentSelection) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";
    if (items.length === 0) {
        container.innerHTML = `<div class="lumia-empty">No items found</div>`;
        return;
    }

    items.forEach(item => {
        const div = document.createElement("div");
        div.className = "lumia-item";
        
        const input = document.createElement("input");
        const isMultiple = type !== "definition";
        input.type = isMultiple ? "checkbox" : "radio";
        input.name = `lumia-${type}`;
        input.value = item.uid;
        input.id = `lumia-${type}-${item.uid}`;

        // Checked state
        if (isMultiple) {
            if (Array.isArray(currentSelection) && currentSelection.includes(item.uid)) {
                input.checked = true;
            }
        } else {
            if (currentSelection === item.uid) {
                input.checked = true;
            }
        }

        input.addEventListener("change", () => {
            if (type === "definition") {
                settings.selectedDefinition = Number(item.uid);
            } else if (type === "behavior") {
                if (input.checked) {
                    if (!settings.selectedBehaviors.includes(Number(item.uid))) {
                        settings.selectedBehaviors.push(Number(item.uid));
                    }
                } else {
                    settings.selectedBehaviors = settings.selectedBehaviors.filter(id => id !== Number(item.uid));
                }
            } else if (type === "personality") {
                if (input.checked) {
                    if (!settings.selectedPersonalities.includes(Number(item.uid))) {
                        settings.selectedPersonalities.push(Number(item.uid));
                    }
                } else {
                    settings.selectedPersonalities = settings.selectedPersonalities.filter(id => id !== Number(item.uid));
                }
            }
            saveSettings();
        });

        const label = document.createElement("label");
        label.htmlFor = `lumia-${type}-${item.uid}`;
        label.textContent = item.displayName || item.comment || `Item ${item.uid}`;

        div.appendChild(input);
        div.appendChild(label);
        container.appendChild(div);
    });
}

function refreshUI() {
    const statusDiv = document.getElementById("lumia-book-status");
    const urlInput = document.getElementById("lumia-url-input");
    
    if (urlInput) urlInput.value = settings.worldBookUrl || "";

    if (settings.worldBookData && settings.worldBookData.entries) {
        if (statusDiv) statusDiv.textContent = `Loaded: ${settings.worldBookData.name || "Unknown World Book"}`;
        
        const { definitions, behaviors, personalities } = parseWorldBook(settings.worldBookData);
        updateParsedEntries(definitions, behaviors, personalities);
        
        renderList("lumia-list-definitions", definitions, "definition", settings.selectedDefinition);
        renderList("lumia-list-behaviors", behaviors, "behavior", settings.selectedBehaviors);
        renderList("lumia-list-personalities", personalities, "personality", settings.selectedPersonalities);
    } else {
        if (statusDiv) statusDiv.textContent = "No World Book loaded";
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
