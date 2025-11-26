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

async function loadSettingsHtml() {
    const response = await fetch(`${getContext().extensionFolderPath}/${MODULE_NAME}/settings.html`);
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
    
    return { definitions, behaviors, personalities };
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
    if (!settings.worldBookData || !settings.worldBookData.entries) return "";
    const entry = settings.worldBookData.entries[uid];
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
    // Add Style
    const styleLink = document.createElement("link");
    styleLink.rel = "stylesheet";
    styleLink.href = `${getContext().extensionFolderPath}/${MODULE_NAME}/style.css`;
    document.head.appendChild(styleLink);

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

    console.log(`${MODULE_NAME} initialized`);
});
