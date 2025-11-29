/**
 * Lumia Injector Extension - Main Entry Point
 *
 * This file handles SillyTavern initialization and registration only.
 * All functionality is delegated to sub-modules in the lib/ directory.
 */

import { getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";
import { MacrosParser } from "../../../macros.js";
import { query, queryAll } from "./sthelpers/domUtils.js";
import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";

// Import modules
import {
    MODULE_NAME,
    getSettings,
    loadSettings,
    loadSettingsHtml,
    resetRandomLumia
} from './lib/settingsManager.js';

import {
    handleNewBook,
    fetchWorldBook
} from './lib/dataProcessor.js';

import {
    showSelectionModal,
    showMiscFeaturesModal,
    showLoomSelectionModal,
    showSummarizationModal,
    showPromptSettingsModal,
    showLucidCardsModal,
    refreshUIDisplay,
    setRefreshUICallback,
    setProcessAllLumiaOOCCommentsRef
} from './lib/uiModals.js';

import {
    generateLoomSummary,
    checkAutoSummarization
} from './lib/summarization.js';

import {
    registerLumiaMacros
} from './lib/lumiaContent.js';

import {
    processLoomConditionals,
    captureLoomSummary,
    hideLoomSumBlocks,
    registerLoomMacros,
    setLastUserMessageContent,
    findLastUserMessage
} from './lib/loomSystem.js';

import {
    processLumiaOOCComments,
    processAllLumiaOOCComments,
    scheduleOOCProcessingAfterRender,
    unhideAndProcessOOCMarkers,
    setupLumiaOOCObserver,
    isLumiaOOCFont,
    setIsGenerating
} from './lib/oocComments.js';

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
    resetRandomLumia();

    const settings = getSettings();
    const sovereignHandEnabled = settings.sovereignHand?.enabled || false;

    // Sovereign Hand: Capture and exclude last user message
    if (sovereignHandEnabled) {
        // Find and capture the last user message content before any modifications
        // Search from the end of the chat array for the last user message
        let lastUserIndex = -1;
        for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i] && chat[i].is_user) {
                lastUserIndex = i;
                break;
            }
        }

        if (lastUserIndex !== -1) {
            const lastUserMsg = chat[lastUserIndex];
            const messageContent = lastUserMsg.mes || lastUserMsg.content || "";

            // Store the content for the {{loomLastUserMessage}} macro
            setLastUserMessageContent(messageContent);
            console.log(`[${MODULE_NAME}] Sovereign Hand: Captured last user message at index ${lastUserIndex}`);

            // Remove the last user message entirely from the outgoing context
            chat.splice(lastUserIndex, 1);
            console.log(`[${MODULE_NAME}] Sovereign Hand: Removed last user message from context array`);
        } else {
            // No user message found, clear the stored content
            setLastUserMessageContent("");
        }
    } else {
        // Clear stored content when feature is disabled
        setLastUserMessageContent("");
    }

    // Process loomIf conditionals in all chat messages
    for (let i = 0; i < chat.length; i++) {
        if (chat[i] && typeof chat[i].content === 'string') {
            chat[i].content = processLoomConditionals(chat[i].content);
        }
        // Also process 'mes' field which some contexts use
        if (chat[i] && typeof chat[i].mes === 'string') {
            chat[i].mes = processLoomConditionals(chat[i].mes);
        }
    }

    return { chat, contextSize, abort };
};

// Register macros
registerLumiaMacros(MacrosParser);
registerLoomMacros(MacrosParser);

// Message count macro
MacrosParser.registerMacro("lumiaMessageCount", () => {
    const context = getContext();
    if (!context || !context.chat) return "0";
    return context.chat.length.toString();
});

// OOC trigger countdown/trigger macro
MacrosParser.registerMacro("lumiaOOCTrigger", () => {
    const context = getContext();
    if (!context || !context.chat) return "";

    const settings = getSettings();
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

// --- INITIALIZATION ---
jQuery(async () => {
    // Load settings
    loadSettings();

    // Set up UI refresh callback for modals
    setRefreshUICallback(refreshUIDisplay);

    // Set up OOC processing reference for modals
    setProcessAllLumiaOOCCommentsRef(processAllLumiaOOCComments);

    // Load and append settings HTML
    const settingsHtml = await loadSettingsHtml();
    $("#extensions_settings").append(settingsHtml);

    // Initial UI refresh
    refreshUIDisplay();

    // --- UI EVENT LISTENERS ---

    // Fetch world book from URL
    $("#lumia-fetch-btn").click(() => {
        const url = $("#lumia-url-input").val();
        fetchWorldBook(url).then(() => refreshUIDisplay());
    });

    // Open selection modals
    $("#lumia-open-definitions-btn").click(() => {
        showSelectionModal('definition');
    });

    $("#lumia-open-behaviors-btn").click(() => {
        showSelectionModal('behavior');
    });

    $("#lumia-open-personalities-btn").click(() => {
        showSelectionModal('personality');
    });

    // Open misc features modal
    $("#lumia-open-misc-btn").click(() => {
        showMiscFeaturesModal();
    });

    // Open summarization modal
    $("#lumia-open-summarization-btn").click(() => {
        showSummarizationModal();
    });

    // Open prompt settings modal
    $("#lumia-open-prompt-settings-btn").click(() => {
        showPromptSettingsModal();
    });

    // Open Loom selection modals
    $("#loom-open-style-btn").click(() => {
        showLoomSelectionModal('Narrative Style');
    });

    $("#loom-open-utils-btn").click(() => {
        showLoomSelectionModal('Loom Utilities');
    });

    $("#loom-open-retrofits-btn").click(() => {
        showLoomSelectionModal('Retrofits');
    });

    // Open Lucid Cards browser modal
    $("#lumia-browse-lucid-btn").click(() => {
        showLucidCardsModal();
    });

    // File upload handling
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
                refreshUIDisplay();
            } catch (error) {
                console.error("Lumia Injector Error:", error);
                toastr.error("Failed to parse: " + error.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    });

    // --- SILLYTAVERN EVENT HANDLERS ---

    // Handle character message rendered - primary OOC processing trigger
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mesId) => {
        const eventTime = Date.now();
        console.log(`[${MODULE_NAME}] CHARACTER_MESSAGE_RENDERED event for mesId ${mesId} at ${eventTime}`);

        // Reset generation flag - successful render means generation completed
        setIsGenerating(false);

        // Capture loom summary from chat messages
        captureLoomSummary();

        // Check if auto-summarization should trigger
        checkAutoSummarization();

        // Delay to run after SimTracker's 150ms delayed re-render
        setTimeout(() => {
            const processTime = Date.now();
            console.log(`[${MODULE_NAME}] Processing callback fired for mesId ${mesId} at ${processTime} (${processTime - eventTime}ms after event)`);

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
                    console.log(`[${MODULE_NAME}] Found ${oocFonts.length} OOC font(s), processing message ${mesId}`);
                    processLumiaOOCComments(mesId);
                } else {
                    console.log(`[${MODULE_NAME}] No OOC fonts found in message ${mesId}`);
                }
            } else {
                console.log(`[${MODULE_NAME}] Message element not found for mesId ${mesId}`);
            }
        }, 200);
    });

    // Handle message edits - reprocess OOC comments
    eventSource.on(event_types.MESSAGE_EDITED, (mesId) => {
        console.log(`[${MODULE_NAME}] MESSAGE_EDITED event for mesId ${mesId}`);
        const messageElement = query(`div[mesid="${mesId}"] .mes_text`);
        if (messageElement) {
            const existingBoxes = queryAll('[data-lumia-ooc]', messageElement);
            existingBoxes.forEach(box => box.remove());
        }
        setTimeout(() => processLumiaOOCComments(mesId), 50);
    });

    // Handle swipes - reprocess OOC comments
    eventSource.on(event_types.MESSAGE_SWIPED, (mesId) => {
        console.log(`[${MODULE_NAME}] MESSAGE_SWIPED event for mesId ${mesId}`);
        setTimeout(() => processLumiaOOCComments(mesId), 50);
    });

    // Handle chat changes - reprocess all OOC comments and capture summaries
    eventSource.on(event_types.CHAT_CHANGED, () => {
        console.log(`[${MODULE_NAME}] CHAT_CHANGED event - scheduling OOC reprocessing and loom summary capture`);
        captureLoomSummary();
        scheduleOOCProcessingAfterRender();
    });

    // Track generation start to prevent observer interference
    eventSource.on(event_types.GENERATION_STARTED, () => {
        console.log(`[${MODULE_NAME}] GENERATION_STARTED - disabling OOC observer processing`);
        setIsGenerating(true);
    });

    // GENERATION_ENDED fires on errors - reset state
    eventSource.on(event_types.GENERATION_ENDED, () => {
        console.log(`[${MODULE_NAME}] GENERATION_ENDED (error case) - resetting state`);
        setIsGenerating(false);
    });

    // GENERATION_STOPPED fires when user cancels - reset state
    eventSource.on(event_types.GENERATION_STOPPED, () => {
        console.log(`[${MODULE_NAME}] GENERATION_STOPPED (user cancel) - resetting state`);
        setIsGenerating(false);
    });

    // Set up MutationObserver for streaming support
    setupLumiaOOCObserver();

    // Process any existing OOC comments on initial load
    console.log(`[${MODULE_NAME}] Initial load - scheduling OOC processing`);
    scheduleOOCProcessingAfterRender();

    // --- SLASH COMMANDS ---

    SlashCommandParser.addCommandObject(
        SlashCommand.fromProps({
            name: "loom-summarize",
            callback: async () => {
                const settings = getSettings();
                const sumSettings = settings.summarization;
                if (!sumSettings || sumSettings.mode === 'disabled') {
                    toastr.warning("Summarization is disabled. Enable it in Lumia Injector settings.");
                    return "Summarization is disabled.";
                }

                try {
                    toastr.info("Generating loom summary...");
                    const result = await generateLoomSummary(null, true);
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
            helpString: "Manually generate a loom summary of the current chat using your configured summarization settings (uses Manual Message Context)."
        })
    );

    console.log(`${MODULE_NAME} initialized`);
});
