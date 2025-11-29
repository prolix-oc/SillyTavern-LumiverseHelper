import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types, messageFormatting } from "../../../../script.js";
import { MacrosParser } from "../../../macros.js";
import DOMUtils, { query, queryAll, createElement } from "./sthelpers/domUtils.js";
import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";

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
    lumiaOOCInterval: null, // Number of messages between OOC comments (null = disabled)
    lumiaOOCStyle: 'social', // OOC comment display style: 'social', 'margin', 'whisper'
    // Summarization settings
    summarization: {
        mode: 'disabled', // 'disabled', 'auto', 'manual'
        apiSource: 'main', // 'main' (SillyTavern's generateRaw) or 'secondary' (custom endpoint)
        autoInterval: 10, // Number of messages between auto-summarizations
        messageContext: 10, // Number of messages to include in summarization context
        // Secondary LLM settings (when apiSource === 'secondary')
        secondary: {
            provider: 'openai', // 'openai', 'anthropic', 'openrouter', 'custom'
            model: '',
            endpoint: '',
            apiKey: '',
            temperature: 0.7,
            maxTokens: 2048
        }
    }
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

    // Process loomIf conditionals in all chat messages
    // This runs AFTER SillyTavern's MacrosParser has resolved all STScript macros
    // We need to use a late-binding function reference since processLoomConditionals is defined later
    if (typeof processLoomConditionals === 'function') {
        for (let i = 0; i < chat.length; i++) {
            if (chat[i] && typeof chat[i].content === 'string') {
                chat[i].content = processLoomConditionals(chat[i].content);
            }
            // Also process 'mes' field which some contexts use
            if (chat[i] && typeof chat[i].mes === 'string') {
                chat[i].mes = processLoomConditionals(chat[i].mes);
            }
        }
    }

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
    if (!settings.lumiaOOCStyle) settings.lumiaOOCStyle = 'social';

    // Ensure summarization defaults
    if (!settings.summarization) {
        settings.summarization = {
            mode: 'disabled',
            apiSource: 'main',
            autoInterval: 10,
            messageContext: 10,
            secondary: {
                provider: 'openai',
                model: '',
                endpoint: '',
                apiKey: '',
                temperature: 0.7,
                maxTokens: 2048
            }
        };
    }
    if (!settings.summarization.secondary) {
        settings.summarization.secondary = {
            provider: 'openai',
            model: '',
            endpoint: '',
            apiKey: '',
            temperature: 0.7,
            maxTokens: 2048
        };
    }

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

        // Determine entry type based on outletName or comment structure
        // Physical definitions use format "Lumia (Name)" - just "Lumia" before the parenthesis
        // Behavior uses "Lumia Behavior (Name)" or contains "behavior"
        // Personality uses "Lumia Personality (Name)" or contains "personality"
        if (entry.outletName === "Lumia_Description" || commentLower.includes("definition")) {
            type = "definition";
        } else if (entry.outletName === "Lumia_Behavior" || commentLower.includes("behavior")) {
            type = "behavior";
        } else if (entry.outletName === "Lumia_Personality" || commentLower.includes("personality")) {
            type = "personality";
        } else if (categoryMatch && categoryMatch[1].trim().toLowerCase() === "lumia") {
            // "Lumia (Name)" format - exactly "Lumia" before parenthesis means physical definition
            type = "definition";
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
    const currentStyle = settings.lumiaOOCStyle || 'social';

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

                <div class="lumia-misc-section">
                    <h4>OOC Comment Style</h4>
                    <p>Choose how Lumia's out-of-character comments are displayed in the chat.</p>

                    <div class="lumia-item" style="margin-top: 10px;">
                        <label for="lumia-ooc-style-select">Display Style:</label>
                        <select id="lumia-ooc-style-select" class="text_pole">
                            <option value="social" ${currentStyle === 'social' ? 'selected' : ''}>Social Card — Full card with avatar and ethereal animations</option>
                            <option value="margin" ${currentStyle === 'margin' ? 'selected' : ''}>Margin Note — Minimal Apple-esque hanging tag</option>
                            <option value="whisper" ${currentStyle === 'whisper' ? 'selected' : ''}>Whisper Bubble — Soft ethereal thought bubble</option>
                        </select>
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
        const styleValue = $("#lumia-ooc-style-select").val();
        const oldStyle = settings.lumiaOOCStyle;

        settings.lumiaOOCInterval = intervalValue ? parseInt(intervalValue, 10) : null;
        settings.lumiaOOCStyle = styleValue;

        saveSettings();
        toastr.success("Miscellaneous features saved!");
        closeModal();

        // If style changed, reprocess all OOC comments to apply new style
        if (oldStyle !== styleValue) {
            setTimeout(() => processAllLumiaOOCComments(true), 100);
        }
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

// --- SUMMARIZATION SYSTEM ---

/**
 * Get default endpoints for known providers
 */
function getProviderDefaults(provider) {
    const defaults = {
        openai: {
            endpoint: 'https://api.openai.com/v1/chat/completions',
            placeholder: 'gpt-4o-mini'
        },
        anthropic: {
            endpoint: 'https://api.anthropic.com/v1/messages',
            placeholder: 'claude-sonnet-4-5-20250929'
        },
        openrouter: {
            endpoint: 'https://openrouter.ai/api/v1/chat/completions',
            placeholder: 'openai/gpt-4o-mini'
        },
        custom: {
            endpoint: '',
            placeholder: 'your-model-id'
        }
    };
    return defaults[provider] || defaults.custom;
}

/**
 * Show the summarization settings modal
 */
function showSummarizationModal() {
    $("#lumia-summarization-modal").remove();

    const sumSettings = settings.summarization || {};
    const secondary = sumSettings.secondary || {};

    const currentMode = sumSettings.mode || 'disabled';
    const currentSource = sumSettings.apiSource || 'main';
    const currentInterval = sumSettings.autoInterval || 10;
    const currentContext = sumSettings.messageContext || 10;
    const currentProvider = secondary.provider || 'openai';
    const currentModel = secondary.model || '';
    const currentEndpoint = secondary.endpoint || '';
    const currentApiKey = secondary.apiKey || '';
    const currentTemp = secondary.temperature || 0.7;
    const currentMaxTokens = secondary.maxTokens || 2048;

    const providerDefaults = getProviderDefaults(currentProvider);

    const modalHtml = `
        <dialog id="lumia-summarization-modal" class="popup wide_dialogue_popup large_dialogue_popup vertical_scrolling_dialogue_popup popup--animation-fast">
            <div class="popup-header">
                <h3 style="margin: 0; padding: 10px 0;">Summarization Settings</h3>
            </div>
            <div class="popup-content" style="padding: 15px; flex: 1; display: flex; flex-direction: column; gap: 20px;">

                <div class="lumia-misc-section">
                    <h4>Summarization Mode</h4>
                    <p>Choose how summarization is triggered:</p>
                    <div class="lumia-item" style="margin-top: 10px;">
                        <select id="lumia-sum-mode-select" class="text_pole">
                            <option value="disabled" ${currentMode === 'disabled' ? 'selected' : ''}>Disabled</option>
                            <option value="auto" ${currentMode === 'auto' ? 'selected' : ''}>Automatic (interval-based)</option>
                            <option value="manual" ${currentMode === 'manual' ? 'selected' : ''}>Manual only (slash command)</option>
                        </select>
                    </div>
                </div>

                <div class="lumia-misc-section" id="lumia-sum-auto-section" style="${currentMode === 'auto' ? '' : 'display: none;'}">
                    <h4>Auto-Summarization Interval</h4>
                    <p>Generate a summary every N messages:</p>
                    <div class="lumia-item" style="margin-top: 10px;">
                        <input type="number" id="lumia-sum-interval-input" class="text_pole" min="1" value="${currentInterval}" />
                    </div>
                </div>

                <div class="lumia-misc-section">
                    <h4>Message Context</h4>
                    <p>Number of recent messages to include when generating summaries:</p>
                    <div class="lumia-item" style="margin-top: 10px;">
                        <input type="number" id="lumia-sum-context-input" class="text_pole" min="1" max="100" value="${currentContext}" />
                    </div>
                </div>

                <div class="lumia-misc-section">
                    <h4>API Source</h4>
                    <p>Choose which API to use for summarization:</p>
                    <div class="lumia-item" style="margin-top: 10px;">
                        <select id="lumia-sum-source-select" class="text_pole">
                            <option value="main" ${currentSource === 'main' ? 'selected' : ''}>Main API (SillyTavern's current connection)</option>
                            <option value="secondary" ${currentSource === 'secondary' ? 'selected' : ''}>Secondary LLM (custom endpoint)</option>
                        </select>
                    </div>
                </div>

                <div class="lumia-misc-section" id="lumia-sum-secondary-section" style="${currentSource === 'secondary' ? '' : 'display: none;'}">
                    <h4>Secondary LLM Configuration</h4>

                    <div class="lumia-item" style="margin-top: 10px;">
                        <label for="lumia-sum-provider-select">Provider:</label>
                        <select id="lumia-sum-provider-select" class="text_pole">
                            <option value="openai" ${currentProvider === 'openai' ? 'selected' : ''}>OpenAI</option>
                            <option value="anthropic" ${currentProvider === 'anthropic' ? 'selected' : ''}>Anthropic (Claude)</option>
                            <option value="openrouter" ${currentProvider === 'openrouter' ? 'selected' : ''}>OpenRouter</option>
                            <option value="custom" ${currentProvider === 'custom' ? 'selected' : ''}>Custom OpenAI-Compatible</option>
                        </select>
                    </div>

                    <div class="lumia-item" style="margin-top: 10px;">
                        <label for="lumia-sum-model-input">Model:</label>
                        <input type="text" id="lumia-sum-model-input" class="text_pole"
                               placeholder="${providerDefaults.placeholder}"
                               value="${escapeHtml(currentModel)}" />
                    </div>

                    <div class="lumia-item" style="margin-top: 10px;">
                        <label for="lumia-sum-endpoint-input">Endpoint URL:</label>
                        <input type="text" id="lumia-sum-endpoint-input" class="text_pole"
                               placeholder="${providerDefaults.endpoint}"
                               value="${escapeHtml(currentEndpoint)}" />
                        <small style="color: #888;">Leave empty to use provider's default endpoint</small>
                    </div>

                    <div class="lumia-item" style="margin-top: 10px;">
                        <label for="lumia-sum-apikey-input">API Key:</label>
                        <input type="password" id="lumia-sum-apikey-input" class="text_pole"
                               placeholder="Your API key"
                               value="${escapeHtml(currentApiKey)}" />
                    </div>

                    <div class="lumia-item" style="margin-top: 10px;">
                        <label for="lumia-sum-temp-input">Temperature:</label>
                        <input type="number" id="lumia-sum-temp-input" class="text_pole"
                               min="0" max="2" step="0.1" value="${currentTemp}" />
                    </div>

                    <div class="lumia-item" style="margin-top: 10px;">
                        <label for="lumia-sum-maxtokens-input">Max Tokens:</label>
                        <input type="number" id="lumia-sum-maxtokens-input" class="text_pole"
                               min="256" max="16384" value="${currentMaxTokens}" />
                    </div>
                </div>

                <div class="lumia-misc-section">
                    <h4>Test Summarization</h4>
                    <p>Generate a summary now to test your configuration:</p>
                    <button id="lumia-sum-test-btn" class="menu_button">Generate Summary Now</button>
                    <div id="lumia-sum-test-status" style="margin-top: 10px; font-style: italic; color: #888;"></div>
                </div>

            </div>
            <div class="popup-footer" style="display: flex; justify-content: center; padding: 15px; gap: 10px;">
                <button class="menu_button lumia-sum-save-btn">Save</button>
                <button class="menu_button lumia-sum-cancel-btn">Cancel</button>
            </div>
        </dialog>
    `;

    $("body").append(modalHtml);
    const $modal = $("#lumia-summarization-modal");

    const closeModal = () => {
        $modal[0].close();
        $modal.remove();
    };

    // Show/hide auto interval section based on mode
    $modal.find("#lumia-sum-mode-select").change(function() {
        const mode = $(this).val();
        if (mode === 'auto') {
            $modal.find("#lumia-sum-auto-section").show();
        } else {
            $modal.find("#lumia-sum-auto-section").hide();
        }
    });

    // Show/hide secondary LLM section based on source
    $modal.find("#lumia-sum-source-select").change(function() {
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

    // Test button
    $modal.find("#lumia-sum-test-btn").click(async function() {
        const $status = $modal.find("#lumia-sum-test-status");
        $status.text("Generating summary...");

        try {
            // Temporarily apply current form values
            const tempSettings = {
                mode: $modal.find("#lumia-sum-mode-select").val(),
                apiSource: $modal.find("#lumia-sum-source-select").val(),
                autoInterval: parseInt($modal.find("#lumia-sum-interval-input").val()) || 10,
                messageContext: parseInt($modal.find("#lumia-sum-context-input").val()) || 10,
                secondary: {
                    provider: $modal.find("#lumia-sum-provider-select").val(),
                    model: $modal.find("#lumia-sum-model-input").val(),
                    endpoint: $modal.find("#lumia-sum-endpoint-input").val(),
                    apiKey: $modal.find("#lumia-sum-apikey-input").val(),
                    temperature: parseFloat($modal.find("#lumia-sum-temp-input").val()) || 0.7,
                    maxTokens: parseInt($modal.find("#lumia-sum-maxtokens-input").val()) || 2048
                }
            };

            const result = await generateLoomSummary(tempSettings);
            if (result) {
                $status.html(`<span style="color: #4CAF50;">✓ Summary generated successfully!</span><br><small>Check your chat metadata.</small>`);
                toastr.success("Summary generated and saved to chat metadata!");
            } else {
                $status.html(`<span style="color: #f44336;">✗ No summary generated. Check console for details.</span>`);
            }
        } catch (error) {
            console.error(`[${MODULE_NAME}] Summarization error:`, error);
            $status.html(`<span style="color: #f44336;">✗ Error: ${error.message}</span>`);
        }
    });

    // Save button
    $modal.find(".lumia-sum-save-btn").click(() => {
        settings.summarization = {
            mode: $modal.find("#lumia-sum-mode-select").val(),
            apiSource: $modal.find("#lumia-sum-source-select").val(),
            autoInterval: parseInt($modal.find("#lumia-sum-interval-input").val()) || 10,
            messageContext: parseInt($modal.find("#lumia-sum-context-input").val()) || 10,
            secondary: {
                provider: $modal.find("#lumia-sum-provider-select").val(),
                model: $modal.find("#lumia-sum-model-input").val(),
                endpoint: $modal.find("#lumia-sum-endpoint-input").val(),
                apiKey: $modal.find("#lumia-sum-apikey-input").val(),
                temperature: parseFloat($modal.find("#lumia-sum-temp-input").val()) || 0.7,
                maxTokens: parseInt($modal.find("#lumia-sum-maxtokens-input").val()) || 2048
            }
        };

        saveSettings();
        toastr.success("Summarization settings saved!");
        closeModal();
    });

    $modal.find(".lumia-sum-cancel-btn").click(closeModal);

    $modal.on("click", function (e) {
        if (e.target === this) closeModal();
    });

    $modal.on("keydown", function (e) {
        if (e.key === "Escape") closeModal();
    });

    $modal[0].showModal();
}

/**
 * Build the summarization prompt with chat context
 */
function buildSummarizationPrompt(messageContext) {
    const context = getContext();
    if (!context || !context.chat) return null;

    const chat = context.chat;
    const recentMessages = chat.slice(-messageContext);

    if (recentMessages.length === 0) {
        return null;
    }

    // Get existing summary if any
    const existingSummary = context.chatMetadata?.[LOOM_SUMMARY_KEY] || '';

    // Build conversation text
    let conversationText = "";
    recentMessages.forEach(msg => {
        const role = msg.is_user ? (msg.name || "User") : (msg.name || "Character");
        let content = msg.mes || msg.content || "";

        // Strip any existing loom_sum blocks from the content
        content = content.replace(/<loom_sum>[\s\S]*?<\/loom_sum>/gi, '').trim();

        if (content) {
            conversationText += `${role}: ${content}\n\n`;
        }
    });

    const systemPrompt = `You are a narrative summarization assistant for interactive fiction and roleplay. Your task is to create comprehensive story summaries that maintain narrative continuity.

When summarizing, capture:
1. **Completed Story Beats** - Major plot points that have concluded, character arcs resolved, conflicts addressed
2. **Ongoing Story Beats** - Active plot threads, unresolved tensions, goals being pursued
3. **Looming Elements** - Foreshadowed events, building complications, story seeds planted
4. **Current Scene Context** - Location, time, atmosphere, recent environmental changes
5. **Character Status** - What each character is doing, their emotional state, recent significant actions

Format your summary as dense but readable prose. Prioritize information essential for maintaining story continuity.`;

    const userPrompt = `${existingSummary ? `Previous summary for context:\n${existingSummary}\n\n` : ''}Recent conversation to summarize:

${conversationText}

Please provide an updated comprehensive summary of the story so far, incorporating the new events. Output ONLY the summary content - no tags, labels, or formatting markers.`;

    return { systemPrompt, userPrompt };
}

/**
 * Generate summary using Main API (SillyTavern's generateRaw)
 */
async function generateSummaryWithMainAPI(sumSettings) {
    const { generateRaw } = getContext();

    if (!generateRaw) {
        throw new Error("generateRaw not available - is SillyTavern properly loaded?");
    }

    const prompts = buildSummarizationPrompt(sumSettings.messageContext || 10);
    if (!prompts) {
        throw new Error("No chat messages to summarize");
    }

    console.log(`[${MODULE_NAME}] 📜 Generating summary with Main API...`);

    const result = await generateRaw({
        systemPrompt: prompts.systemPrompt,
        prompt: prompts.userPrompt,
        prefill: ''
    });

    return result;
}

/**
 * Generate summary using Secondary LLM (custom endpoint)
 */
async function generateSummaryWithSecondaryLLM(sumSettings) {
    const secondary = sumSettings.secondary || {};
    const provider = secondary.provider || 'openai';
    const model = secondary.model;
    const apiKey = secondary.apiKey;
    const temperature = secondary.temperature || 0.7;
    const maxTokens = secondary.maxTokens || 2048;

    if (!model) {
        throw new Error("No model specified for secondary LLM");
    }

    if (!apiKey) {
        throw new Error("No API key specified for secondary LLM");
    }

    const prompts = buildSummarizationPrompt(sumSettings.messageContext || 10);
    if (!prompts) {
        throw new Error("No chat messages to summarize");
    }

    // Get endpoint (use default if not specified)
    const defaults = getProviderDefaults(provider);
    const endpoint = secondary.endpoint || defaults.endpoint;

    if (!endpoint) {
        throw new Error("No endpoint specified for secondary LLM");
    }

    console.log(`[${MODULE_NAME}] 📜 Generating summary with Secondary LLM (${provider})...`);

    let response;

    if (provider === 'anthropic') {
        // Anthropic uses a different API format
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: maxTokens,
                system: prompts.systemPrompt,
                messages: [
                    { role: 'user', content: prompts.userPrompt }
                ],
                temperature: temperature
            })
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unable to read error');
            throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Anthropic returns content as an array of blocks
        if (data.content && Array.isArray(data.content)) {
            const textBlock = data.content.find(block => block.type === 'text');
            return textBlock?.text || '';
        }
        return '';

    } else {
        // OpenAI-compatible format (OpenAI, OpenRouter, Custom)
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };

        // OpenRouter requires additional headers
        if (provider === 'openrouter') {
            headers['HTTP-Referer'] = window.location.origin;
            headers['X-Title'] = 'Lumia Injector';
        }

        response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: prompts.systemPrompt },
                    { role: 'user', content: prompts.userPrompt }
                ],
                temperature: temperature,
                max_tokens: maxTokens
            })
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unable to read error');
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Standard OpenAI format
        if (data.choices?.[0]?.message?.content) {
            return data.choices[0].message.content;
        }
        return '';
    }
}

/**
 * Main function to generate a loom summary
 * @param {Object} overrideSettings - Optional settings override for testing
 */
async function generateLoomSummary(overrideSettings = null) {
    const sumSettings = overrideSettings || settings.summarization;

    if (!sumSettings) {
        console.log(`[${MODULE_NAME}] 📜 Summarization not configured`);
        return null;
    }

    const context = getContext();
    if (!context || !context.chat || context.chat.length === 0) {
        console.log(`[${MODULE_NAME}] 📜 No chat to summarize`);
        return null;
    }

    try {
        let summaryText;

        if (sumSettings.apiSource === 'main') {
            summaryText = await generateSummaryWithMainAPI(sumSettings);
        } else if (sumSettings.apiSource === 'secondary') {
            summaryText = await generateSummaryWithSecondaryLLM(sumSettings);
        } else {
            throw new Error(`Unknown API source: ${sumSettings.apiSource}`);
        }

        if (summaryText && summaryText.trim()) {
            // Store the summary in chat metadata
            context.chatMetadata[LOOM_SUMMARY_KEY] = summaryText.trim();
            await context.saveMetadata();
            console.log(`[${MODULE_NAME}] 📜 Summary saved to chat metadata`);
            return summaryText.trim();
        }

        return null;
    } catch (error) {
        console.error(`[${MODULE_NAME}] 📜 Summary generation failed:`, error);
        throw error;
    }
}

/**
 * Check if auto-summarization should trigger
 */
function checkAutoSummarization() {
    const sumSettings = settings.summarization;
    if (!sumSettings || sumSettings.mode !== 'auto') return;

    const context = getContext();
    if (!context || !context.chat) return;

    const interval = sumSettings.autoInterval || 10;
    const messageCount = context.chat.length;

    // Trigger when message count is divisible by interval
    if (messageCount > 0 && messageCount % interval === 0) {
        console.log(`[${MODULE_NAME}] 📜 Auto-summarization triggered at message ${messageCount}`);
        generateLoomSummary().then(result => {
            if (result) {
                toastr.info("Loom summary updated automatically");
            }
        }).catch(error => {
            console.error(`[${MODULE_NAME}] 📜 Auto-summarization failed:`, error);
        });
    }
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

// --- LOOM CONDITIONAL PROCESSING ---
// Processes {{loomIf}}...{{loomElse}}...{{/loomIf}} blocks
// This runs AFTER SillyTavern's MacrosParser, so all STScript macros are already resolved

/**
 * Process loomIf conditional blocks in content
 * Supports:
 *   - Truthiness: {{loomIf condition="value"}} - true if non-empty
 *   - Equality: {{loomIf condition="a" equals="b"}} - true if a === b
 *   - Not equals: {{loomIf condition="a" notEquals="b"}} - true if a !== b
 *   - Contains: {{loomIf condition="haystack" contains="needle"}} - true if haystack includes needle
 *   - Greater than: {{loomIf condition="5" gt="3"}} - true if 5 > 3 (numeric)
 *   - Less than: {{loomIf condition="3" lt="5"}} - true if 3 < 5 (numeric)
 *
 * @param {string} content - The content to process
 * @returns {string} - Content with conditionals evaluated
 */
function processLoomConditionals(content) {
    if (!content || typeof content !== 'string') return content;

    // Quick check - if no loomIf, skip processing
    if (!content.includes('{{loomIf')) return content;

    let processed = content;
    let iterations = 0;
    const maxIterations = 50; // Prevent infinite loops, allow for nested conditionals

    // Regex to match loomIf blocks (non-greedy, handles nested by processing innermost first)
    // This pattern matches the innermost {{loomIf}}...{{/loomIf}} blocks first
    const loomIfRegex = /\{\{loomIf\s+condition="([^"]*)"(?:\s+(equals|notEquals|contains|gt|lt|gte|lte)="([^"]*)")?\s*\}\}([\s\S]*?)\{\{\/loomIf\}\}/;

    while (loomIfRegex.test(processed) && iterations < maxIterations) {
        processed = processed.replace(loomIfRegex, (match, condition, operator, compareValue, innerContent) => {
            // Split inner content into if/else parts
            const elseSplit = innerContent.split(/\{\{loomElse\}\}/);
            const ifContent = elseSplit[0] || '';
            const elseContent = elseSplit[1] || '';

            // Evaluate the condition
            let result = false;
            const conditionTrimmed = condition.trim();

            if (!operator) {
                // Truthiness check - non-empty string is true
                result = conditionTrimmed.length > 0;
            } else {
                const compareTrimmed = (compareValue || '').trim();

                switch (operator) {
                    case 'equals':
                        result = conditionTrimmed === compareTrimmed;
                        break;
                    case 'notEquals':
                        result = conditionTrimmed !== compareTrimmed;
                        break;
                    case 'contains':
                        result = conditionTrimmed.includes(compareTrimmed);
                        break;
                    case 'gt':
                        result = parseFloat(conditionTrimmed) > parseFloat(compareTrimmed);
                        break;
                    case 'lt':
                        result = parseFloat(conditionTrimmed) < parseFloat(compareTrimmed);
                        break;
                    case 'gte':
                        result = parseFloat(conditionTrimmed) >= parseFloat(compareTrimmed);
                        break;
                    case 'lte':
                        result = parseFloat(conditionTrimmed) <= parseFloat(compareTrimmed);
                        break;
                    default:
                        result = false;
                }
            }

            // Return the appropriate content based on result
            return result ? ifContent : elseContent;
        });

        iterations++;
    }

    if (iterations >= maxIterations) {
        console.warn(`[${MODULE_NAME}] loomIf processing hit max iterations - possible malformed conditionals`);
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

// --- LOOM SUMMARY SYSTEM ---
// Captures <loom_sum>...</loom_sum> blocks from messages and stores in chat metadata
// Hidden from display, retrievable via {{loomSummary}} macro

const LOOM_SUMMARY_KEY = "loom_summary";

/**
 * Extract loom_sum content from a message string
 * @param {string} content - The message content to search
 * @returns {string|null} The extracted summary content, or null if not found
 */
function extractLoomSummary(content) {
    if (!content || typeof content !== 'string') return null;

    const match = content.match(/<loom_sum>([\s\S]*?)<\/loom_sum>/);
    return match ? match[1].trim() : null;
}

/**
 * Scan chat messages for the most recent loom_sum and save to chat metadata
 * Searches from newest to oldest, saves the first (most recent) found
 */
async function captureLoomSummary() {
    const context = getContext();
    if (!context || !context.chat || !context.chatMetadata) return;

    // Search from newest message to oldest
    for (let i = context.chat.length - 1; i >= 0; i--) {
        const message = context.chat[i];
        const content = message.mes || message.content || "";
        const summary = extractLoomSummary(content);

        if (summary) {
            // Only update if different from current
            if (context.chatMetadata[LOOM_SUMMARY_KEY] !== summary) {
                context.chatMetadata[LOOM_SUMMARY_KEY] = summary;
                await context.saveMetadata();
                console.log(`[${MODULE_NAME}] 📜 Captured loom summary from message ${i}`);
            }
            return; // Found most recent, stop searching
        }
    }
}

/**
 * Get the stored loom summary from chat metadata
 * @returns {string} The stored summary, or empty string if none
 */
function getLoomSummary() {
    const context = getContext();
    if (!context || !context.chatMetadata) return "";
    return context.chatMetadata[LOOM_SUMMARY_KEY] || "";
}

/**
 * Hide loom_sum blocks in a message element
 * @param {HTMLElement} messageElement - The .mes_text element to process
 */
function hideLoomSumBlocks(messageElement) {
    if (!messageElement) return;

    const html = messageElement.innerHTML;
    if (!html.includes('<loom_sum>') && !html.includes('&lt;loom_sum&gt;')) return;

    // Handle both raw tags and HTML-escaped tags
    const updatedHtml = html
        .replace(/<loom_sum>[\s\S]*?<\/loom_sum>/gi, '<span class="loom-sum-hidden" style="display:none;"></span>')
        .replace(/&lt;loom_sum&gt;[\s\S]*?&lt;\/loom_sum&gt;/gi, '<span class="loom-sum-hidden" style="display:none;"></span>');

    if (updatedHtml !== html) {
        messageElement.innerHTML = updatedHtml;
        console.log(`[${MODULE_NAME}] 📜 Hidden loom_sum block in message`);
    }
}

// Register loomSummary macro - injects the stored summary
MacrosParser.registerMacro("loomSummary", () => {
    return getLoomSummary();
});

// Register loomSummaryPrompt macro - injects the summarization directive
MacrosParser.registerMacro("loomSummaryPrompt", () => {
    return `<loom_summary_directive>
When the current narrative segment reaches a natural pause or transition point, provide a comprehensive summary wrapped in <loom_sum></loom_sum> tags. This summary serves as persistent story memory and must capture:

**COMPLETED STORY BEATS:**
- Major plot points that have concluded
- Character arcs or development moments that have resolved
- Conflicts or tensions that have been addressed
- Discoveries, revelations, or turning points that occurred

**ONGOING STORY BEATS:**
- Active plot threads currently in motion
- Unresolved tensions or conflicts
- Character goals being actively pursued
- Relationships in states of change or development

**LOOMING ELEMENTS:**
- Foreshadowed events or approaching complications
- Potential "shake ups" building in the narrative
- Unaddressed threats or opportunities
- Story seeds planted but not yet sprouted

**CURRENT SCENE CONTEXT:**
- Physical location and environment details
- Time of day and approximate date/timeframe
- Atmosphere, mood, and ambient conditions
- Recent environmental changes or notable features

**CHARACTER STATUS:**
- What {{user}} is currently doing/saying and their apparent emotional state
- What {{char}} is currently doing/saying and their apparent emotional state
- Other present NPCs: their actions, positions, and relevance to the scene
- Recent significant actions or dialogue from each party

Format the summary as dense but readable prose, preserving enough detail that the narrative could be resumed naturally from this point. Prioritize information that would be essential for maintaining story continuity.
</loom_summary_directive>`;
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
 * Supports multiple styles: 'social', 'margin', 'whisper'
 * @param {string} content - The text content for the OOC box
 * @param {string|null} avatarImg - URL to avatar image, or null for placeholder
 * @param {number} index - Index of this OOC in the message (for alternating styles)
 * @returns {HTMLElement} The created OOC comment box element
 */
function createOOCCommentBox(content, avatarImg, index = 0) {
    const style = settings.lumiaOOCStyle || 'social';
    const isAlt = index % 2 === 1; // Alternate on odd indices

    switch (style) {
        case 'margin':
            return createOOCMarginNote(content, avatarImg, isAlt);
        case 'whisper':
            return createOOCWhisperBubble(content, avatarImg, isAlt);
        case 'social':
        default:
            return createOOCSocialCard(content, avatarImg);
    }
}

/**
 * Create Social Card style OOC box (original design)
 * Full card with avatar, name, thread indicator, and ethereal animations
 */
function createOOCSocialCard(content, avatarImg) {
    // Create avatar container with ethereal glow ring
    const avatarElement = avatarImg
        ? createElement('img', {
            attrs: { src: avatarImg, alt: 'Lumia', class: 'lumia-ooc-avatar' }
        })
        : createElement('div', {
            attrs: { class: 'lumia-ooc-avatar lumia-ooc-avatar-placeholder' },
            text: 'L'
        });

    // Wrap avatar in a glow container for the ethereal effect
    const avatarContainer = createElement('div', {
        attrs: { class: 'lumia-ooc-avatar-container' },
        children: [avatarElement]
    });

    // Create the name/handle area (like a social media username)
    const nameElement = createElement('span', {
        attrs: { class: 'lumia-ooc-name' },
        text: 'Lumia'
    });

    // Create the "thread" indicator - weaving motif
    const threadIndicator = createElement('span', {
        attrs: { class: 'lumia-ooc-thread' },
        text: 'weaving through the Loom'
    });

    // Create header row with name and thread indicator
    const headerRow = createElement('div', {
        attrs: { class: 'lumia-ooc-header-row' },
        children: [nameElement, threadIndicator]
    });

    // Create content element - the actual OOC message
    const contentElement = createElement('div', {
        attrs: { class: 'lumia-ooc-content' },
        html: content
    });

    // Create the content column (header + content stacked)
    const contentColumn = createElement('div', {
        attrs: { class: 'lumia-ooc-content-column' },
        children: [headerRow, contentElement]
    });

    // Create the main comment box with horizontal layout
    const commentBox = createElement('div', {
        attrs: { class: 'lumia-ooc-comment-box', 'data-lumia-ooc': 'true' },
        children: [avatarContainer, contentColumn]
    });

    return commentBox;
}

/**
 * Create Margin Note style OOC box
 * Apple-esque minimal hanging tag design
 * @param {boolean} isAlt - Whether to use alternate (right-aligned) orientation
 */
function createOOCMarginNote(content, avatarImg, isAlt = false) {
    // Create the hanging tag with avatar or letter
    const tagContent = avatarImg
        ? createElement('img', {
            attrs: {
                src: avatarImg,
                alt: 'L',
                class: 'lumia-ooc-margin-tag-avatar'
            }
        })
        : createElement('span', {
            attrs: { class: 'lumia-ooc-margin-tag-letter' },
            text: 'L'
        });

    const tag = createElement('div', {
        attrs: { class: 'lumia-ooc-margin-tag' },
        children: [tagContent]
    });

    // Create the subtle label
    const label = createElement('div', {
        attrs: { class: 'lumia-ooc-margin-label' },
        text: 'Lumia'
    });

    // Create the content text
    const text = createElement('div', {
        attrs: { class: 'lumia-ooc-margin-text' },
        html: content
    });

    // Create the content area
    const contentArea = createElement('div', {
        attrs: { class: 'lumia-ooc-margin-content-area' },
        children: [label, text]
    });

    // Create the main container with alternating class
    const containerClass = isAlt ? 'lumia-ooc-margin lumia-ooc-alt' : 'lumia-ooc-margin';
    const container = createElement('div', {
        attrs: { class: containerClass, 'data-lumia-ooc': 'true' },
        children: [tag, contentArea]
    });

    return container;
}

/**
 * Create Whisper Bubble style OOC box
 * Soft ethereal thought bubble design with prominent avatar
 * @param {boolean} isAlt - Whether to use alternate (right-aligned) orientation
 */
function createOOCWhisperBubble(content, avatarImg, isAlt = false) {
    // Create the avatar element (outside the bubble, prominent)
    const avatar = avatarImg
        ? createElement('img', {
            attrs: {
                src: avatarImg,
                alt: 'Lumia',
                class: 'lumia-ooc-whisper-avatar'
            }
        })
        : createElement('div', {
            attrs: { class: 'lumia-ooc-whisper-avatar-placeholder' },
            text: 'L'
        });

    // Wrap avatar in container
    const avatarWrap = createElement('div', {
        attrs: { class: 'lumia-ooc-whisper-avatar-wrap' },
        children: [avatar]
    });

    // Create the name
    const name = createElement('span', {
        attrs: { class: 'lumia-ooc-whisper-name' },
        text: 'Lumia whispers...'
    });

    // Create header
    const header = createElement('div', {
        attrs: { class: 'lumia-ooc-whisper-header' },
        children: [name]
    });

    // Create the content text
    const text = createElement('div', {
        attrs: { class: 'lumia-ooc-whisper-text' },
        html: content
    });

    // Create the bubble (now just contains header and text)
    const bubble = createElement('div', {
        attrs: { class: 'lumia-ooc-whisper-bubble' },
        children: [header, text]
    });

    // Create the main container with alternating class
    const containerClass = isAlt ? 'lumia-ooc-whisper lumia-ooc-alt' : 'lumia-ooc-whisper';
    const container = createElement('div', {
        attrs: { class: containerClass, 'data-lumia-ooc': 'true' },
        children: [avatarWrap, bubble]
    });

    return container;
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

        // Process each OOC font element - insert comment box exactly where the OOC was located
        // (SimTracker inline template pattern: in-place replacement)
        oocFonts.forEach((fontElement, index) => {
            // Get the content from the font element
            const content = fontElement.innerHTML;

            console.log(`[${MODULE_NAME}] 🔮 Processing OOC #${index + 1}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);

            // Create the styled comment box (pass index for alternating orientation)
            const commentBox = createOOCCommentBox(content, avatarImg, index);

            // Find the outermost OOC-related element to replace
            // Walk up the DOM tree to find <lumia_ooc> wrapper if it exists
            let elementToReplace = fontElement;
            let current = fontElement.parentElement;

            // Walk up to find the lumia_ooc tag (might be nested in <p> or other formatting tags)
            while (current && current !== messageElement) {
                const tagName = current.tagName?.toLowerCase();
                if (tagName === 'lumia_ooc') {
                    elementToReplace = current;
                    break;
                }
                // Stop if we hit a block-level element that contains other content
                // (we don't want to replace an entire paragraph that has other text)
                if (tagName === 'p' || tagName === 'div') {
                    // Check if this element ONLY contains our OOC content
                    const textContent = current.textContent?.trim();
                    const fontContent = fontElement.textContent?.trim();
                    if (textContent === fontContent) {
                        // The paragraph only contains the OOC, safe to replace the whole thing
                        elementToReplace = current;
                    }
                    break;
                }
                current = current.parentElement;
            }

            // Perform in-place replacement (SimTracker pattern)
            if (elementToReplace.parentNode) {
                elementToReplace.parentNode.replaceChild(commentBox, elementToReplace);
                console.log(`[${MODULE_NAME}] 🔮 Inserted OOC #${index + 1} in-place (replaced ${elementToReplace.tagName || 'text'})`);
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
 * Process all Lumia OOC comments and hide loom_sum blocks in the chat
 * Called on CHAT_CHANGED and initial load to ensure all messages are processed
 */
function processAllLumiaOOCComments(clearExisting = false) {
    const context = getContext();
    if (!context || !context.chat) return;

    console.log(`[${MODULE_NAME}] 🔮 Processing all OOC comments in chat (${context.chat.length} messages)${clearExisting ? ' [clearing existing]' : ''}`);

    // If clearing existing OOC boxes (e.g., style change), remove them all first
    // We need to restore the original font elements from the stored content
    if (clearExisting) {
        const allOOCBoxes = queryAll('[data-lumia-ooc]');
        allOOCBoxes.forEach(box => {
            // Get the text content from the appropriate element based on style
            let content = '';
            const marginText = box.querySelector('.lumia-ooc-margin-text');
            const whisperText = box.querySelector('.lumia-ooc-whisper-text');
            const socialContent = box.querySelector('.lumia-ooc-content');

            if (marginText) content = marginText.innerHTML;
            else if (whisperText) content = whisperText.innerHTML;
            else if (socialContent) content = socialContent.innerHTML;

            // Recreate the original font element structure
            const fontElement = document.createElement('font');
            fontElement.setAttribute('color', LUMIA_OOC_COLOR);
            fontElement.innerHTML = content;

            // Replace the box with the font element
            if (box.parentNode) {
                box.parentNode.replaceChild(fontElement, box);
            }
        });
    }

    // Process each message in the chat - both OOC comments and loom_sum hiding
    for (let i = 0; i < context.chat.length; i++) {
        // Hide loom_sum blocks in the DOM
        const messageElement = query(`div[mesid="${i}"] .mes_text`);
        if (messageElement) {
            hideLoomSumBlocks(messageElement);
        }
        processLumiaOOCComments(i);
    }
}

// Debounce timer for OOC processing after chat switch
let oocProcessingTimer = null;
let oocRenderWaitTimer = null;

// Flag to track if generation is in progress (prevents observer interference)
let isGenerating = false;

/**
 * Schedule OOC processing after chat render completes
 * Uses a multi-stage approach:
 * 1. Wait for initial DOM to be ready
 * 2. Watch for message elements to appear
 * 3. Process once DOM stabilizes
 */
function scheduleOOCProcessingAfterRender() {
    // Clear any pending timers
    if (oocProcessingTimer) clearTimeout(oocProcessingTimer);
    if (oocRenderWaitTimer) clearTimeout(oocRenderWaitTimer);

    const maxWaitTime = 3000; // Maximum time to wait for render
    const checkInterval = 100; // How often to check for messages
    const stabilityDelay = 150; // Wait after messages appear before processing
    const startTime = Date.now();

    function checkAndProcess() {
        const chatElement = document.getElementById("chat");
        const context = getContext();

        // Check if we have messages in context and DOM
        const hasContextMessages = context?.chat?.length > 0;
        const messageElements = chatElement ? queryAll('.mes_text', chatElement) : [];
        const hasDOMMessages = messageElements.length > 0;

        // If we've waited too long, just try processing anyway
        if (Date.now() - startTime > maxWaitTime) {
            console.log(`[${MODULE_NAME}] 🔮 Max wait time reached, processing OOCs now`);
            processAllLumiaOOCComments();
            return;
        }

        // If context has messages but DOM doesn't yet, keep waiting
        if (hasContextMessages && !hasDOMMessages) {
            oocRenderWaitTimer = setTimeout(checkAndProcess, checkInterval);
            return;
        }

        // If both context and DOM have messages (or context is empty), wait for stability then process
        if (hasDOMMessages || !hasContextMessages) {
            console.log(`[${MODULE_NAME}] 🔮 DOM ready with ${messageElements.length} messages, waiting for stability`);
            oocProcessingTimer = setTimeout(() => {
                console.log(`[${MODULE_NAME}] 🔮 Processing all OOC comments after render`);
                processAllLumiaOOCComments();
            }, stabilityDelay);
            return;
        }

        // Keep checking
        oocRenderWaitTimer = setTimeout(checkAndProcess, checkInterval);
    }

    // Start checking after a brief initial delay
    oocRenderWaitTimer = setTimeout(checkAndProcess, 50);
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
 * Observes chat for new messages, font elements with OOC color, and loom_sum blocks
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

                // Check for text nodes that might contain loom_sum tags
                if (node.nodeType === Node.TEXT_NODE || (node.innerHTML && (node.innerHTML.includes('<loom_sum>') || node.innerHTML.includes('&lt;loom_sum&gt;')))) {
                    const mesText = node.closest ? node.closest('.mes_text') : null;
                    if (mesText && !messageElements.includes(mesText)) {
                        messageElements.push(mesText);
                    }
                }

                messageElements.forEach((messageElement) => {
                    // Always hide loom_sum blocks immediately when detected
                    hideLoomSumBlocks(messageElement);

                    // Skip OOC processing during active generation - let CHARACTER_MESSAGE_RENDERED handle it
                    if (isGenerating) {
                        return;
                    }

                    // Skip if this message already has OOC boxes (already processed)
                    const existingBoxes = queryAll('[data-lumia-ooc]', messageElement);
                    if (existingBoxes.length > 0) {
                        return;
                    }

                    // Check for OOC fonts and process them
                    const oocFonts = queryAll('font', messageElement).filter(isLumiaOOCFont);
                    if (oocFonts.length > 0) {
                        const mesBlock = messageElement.closest('div[mesid]');
                        if (mesBlock) {
                            const mesId = parseInt(mesBlock.getAttribute('mesid'), 10);
                            console.log(`[${MODULE_NAME}] 🔮 Observer: Processing OOC in message ${mesId}`);
                            processLumiaOOCComments(mesId);
                        }
                    }
                });
            });

            // Also check characterData mutations for streaming text updates
            if (mutation.type === 'characterData') {
                const mesText = mutation.target.parentElement?.closest('.mes_text');
                if (mesText) {
                    hideLoomSumBlocks(mesText);
                }
            }
        });
    });

    const targetElement = chatElement || document.body;
    observer.observe(targetElement, {
        childList: true,
        subtree: true,
        characterData: true
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

    $("#lumia-open-summarization-btn").click(() => {
        showSummarizationModal();
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

    // Hook into CHARACTER_MESSAGE_RENDERED to process OOC comments and loom summaries
    // This is the primary handler - fires after message is fully rendered to DOM
    // NOTE: SimTracker also listens to this event and may re-render message content
    // SimTracker has a 150ms delayed re-render for sidebar templates, so we delay 200ms to run after
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mesId) => {
        const eventTime = Date.now();
        console.log(`[${MODULE_NAME}] 🔮 CHARACTER_MESSAGE_RENDERED event for mesId ${mesId} at ${eventTime}`);

        // Reset generation flag - successful render means generation completed
        isGenerating = false;

        // Capture loom summary from chat messages (reads from chat data, not DOM)
        captureLoomSummary();

        // Check if auto-summarization should trigger
        checkAutoSummarization();

        // Delay 200ms to ensure we run AFTER SimTracker's 150ms delayed re-render
        // This prevents SimTracker from overwriting our OOC boxes
        setTimeout(() => {
            const processTime = Date.now();
            console.log(`[${MODULE_NAME}] 🔮 Processing callback fired for mesId ${mesId} at ${processTime} (${processTime - eventTime}ms after event)`);

            const messageElement = query(`div[mesid="${mesId}"] .mes_text`);
            if (messageElement) {
                // Hide any loom_sum blocks in the DOM
                hideLoomSumBlocks(messageElement);

                // Unhide any markers that were hidden during streaming
                unhideAndProcessOOCMarkers(messageElement);

                // Check for any unprocessed OOC fonts and process them
                const fontElements = queryAll('font', messageElement);
                const oocFonts = fontElements.filter(isLumiaOOCFont);

                if (oocFonts.length > 0) {
                    console.log(`[${MODULE_NAME}] 🔮 Found ${oocFonts.length} OOC font(s), processing message ${mesId}`);
                    processLumiaOOCComments(mesId);
                } else {
                    console.log(`[${MODULE_NAME}] 🔮 No OOC fonts found in message ${mesId}`);
                }
            } else {
                console.log(`[${MODULE_NAME}] 🔮 Message element not found for mesId ${mesId}`);
            }
        }, 200);
    });

    // Handle message edits - reprocess OOC comments (SimTracker pattern)
    // Need to force reprocess by clearing the existing OOC box first
    eventSource.on(event_types.MESSAGE_EDITED, (mesId) => {
        console.log(`[${MODULE_NAME}] 🔮 MESSAGE_EDITED event for mesId ${mesId}`);
        // Remove existing OOC boxes before reprocessing (any style)
        const messageElement = query(`div[mesid="${mesId}"] .mes_text`);
        if (messageElement) {
            const existingBoxes = queryAll('[data-lumia-ooc]', messageElement);
            existingBoxes.forEach(box => box.remove());
        }
        setTimeout(() => processLumiaOOCComments(mesId), 50);
    });

    // Handle swipes - reprocess OOC comments (SimTracker pattern)
    eventSource.on(event_types.MESSAGE_SWIPED, (mesId) => {
        console.log(`[${MODULE_NAME}] 🔮 MESSAGE_SWIPED event for mesId ${mesId}`);
        setTimeout(() => processLumiaOOCComments(mesId), 50);
    });

    // Handle chat changes - reprocess all OOC comments and loom summaries (SimTracker pattern)
    // Use a debounced approach: wait for DOM to stabilize after chat switch
    eventSource.on(event_types.CHAT_CHANGED, () => {
        console.log(`[${MODULE_NAME}] 🔮 CHAT_CHANGED event - scheduling OOC reprocessing and loom summary capture`);
        // Capture loom summary from newly loaded chat
        captureLoomSummary();
        scheduleOOCProcessingAfterRender();
    });

    // Track generation start to prevent observer interference
    eventSource.on(event_types.GENERATION_STARTED, () => {
        console.log(`[${MODULE_NAME}] 🔮 GENERATION_STARTED - disabling OOC observer processing`);
        isGenerating = true;
    });

    // GENERATION_ENDED fires on errors - just reset state
    eventSource.on(event_types.GENERATION_ENDED, () => {
        console.log(`[${MODULE_NAME}] 🔮 GENERATION_ENDED (error case) - resetting state`);
        isGenerating = false;
    });

    // GENERATION_STOPPED fires when user cancels - just reset state
    eventSource.on(event_types.GENERATION_STOPPED, () => {
        console.log(`[${MODULE_NAME}] 🔮 GENERATION_STOPPED (user cancel) - resetting state`);
        isGenerating = false;
    });

    // Set up MutationObserver for streaming support (SimTracker pattern)
    // This hides partial OOC markers during generation
    setupLumiaOOCObserver();

    // Process any existing OOC comments on initial load
    // Use the same render-aware scheduling as chat changes
    console.log(`[${MODULE_NAME}] 🔮 Initial load - scheduling OOC processing`);
    scheduleOOCProcessingAfterRender();

    // Register slash command for manual summarization
    SlashCommandParser.addCommandObject(
        SlashCommand.fromProps({
            name: "loom-summarize",
            callback: async () => {
                const sumSettings = settings.summarization;
                if (!sumSettings || sumSettings.mode === 'disabled') {
                    toastr.warning("Summarization is disabled. Enable it in Lumia Injector settings.");
                    return "Summarization is disabled.";
                }

                try {
                    toastr.info("Generating loom summary...");
                    const result = await generateLoomSummary();
                    if (result) {
                        toastr.success("Loom summary generated and saved!");
                        return "Summary generated successfully.";
                    } else {
                        toastr.warning("No summary generated. Check if there are messages to summarize.");
                        return "No summary generated.";
                    }
                } catch (error) {
                    toastr.error(`Summarization failed: ${error.message}`);
                    return `Error: ${error.message}`;
                }
            },
            aliases: ["loom-sum", "summarize"],
            helpString: "Manually generate a loom summary of the current chat using your configured summarization settings."
        })
    );

    console.log(`${MODULE_NAME} initialized`);
});
