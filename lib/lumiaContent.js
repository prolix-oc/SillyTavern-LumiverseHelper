/**
 * Lumia Content Module
 * Handles Lumia definition, behavior, and personality content retrieval and macro processing
 */

import { getSettings, getCurrentRandomLumia, setCurrentRandomLumia } from './settingsManager.js';
import { getItemFromLibrary } from './dataProcessor.js';

/**
 * Ensure a random Lumia is selected for macro expansion
 * Selects a random item from all available packs if not already selected
 */
export function ensureRandomLumia() {
    if (getCurrentRandomLumia()) return;

    const settings = getSettings();
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
    setCurrentRandomLumia(allItems[randomIndex]);
}

/**
 * Process nested {{randomLumia}} macros in content
 * Expands all randomLumia macro variants using the current random selection
 * @param {string} content - The content to process
 * @returns {string} Content with randomLumia macros expanded
 */
export function processNestedRandomLumiaMacros(content) {
    if (!content || typeof content !== 'string') return content;

    // Check if content contains any randomLumia macros
    if (!content.includes('{{randomLumia')) return content;

    // Ensure we have a random Lumia selected
    ensureRandomLumia();

    const currentRandomLumia = getCurrentRandomLumia();
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

/**
 * Append a dominant tag to the first markdown header line in content
 * For behaviors: Looks for **Header** pattern and appends before the closing **
 * For personalities: Looks for markdown header (# or **) and appends before closing
 * @param {string} content - The content to modify
 * @param {string} tag - The tag to append (e.g., "(My STRONGEST Trait)")
 * @returns {string} Modified content with tag appended to first header
 */
function appendDominantTag(content, tag) {
    if (!content || !tag) return content;

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        // Check for **Bold Header** pattern (common in behaviors)
        // Match: **Something** or **Something**:
        const boldMatch = line.match(/^(\*\*)(.+?)(\*\*)(.*)?$/);
        if (boldMatch) {
            // Insert tag before the closing **
            // e.g., **Trait Name** -> **Trait Name (My MOST PREVALENT Traits)**
            lines[i] = lines[i].replace(
                /^(\s*)(\*\*)(.+?)(\*\*)/,
                `$1$2$3 ${tag}$4`
            );
            break;
        }

        // Check for # Markdown Header pattern (common in personalities)
        const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
            // Append tag to the end of the header
            // e.g., ## Personality Name -> ## Personality Name (My MOST PREVALENT Personality)
            lines[i] = lines[i].replace(
                /^(\s*)(#{1,6})\s+(.+)$/,
                `$1$2 $3 ${tag}`
            );
            break;
        }

        // If first non-empty line isn't a recognized header format,
        // just append to that line (fallback)
        lines[i] = lines[i] + ` ${tag}`;
        break;
    }

    return lines.join('\n');
}

/**
 * Get Lumia content (definition, behavior, or personality) for a selection
 * @param {string} type - 'def' | 'behavior' | 'personality'
 * @param {Object|Array} selection - Single selection or array of selections
 * @returns {string} The content for the selection(s)
 */
export function getLumiaContent(type, selection) {
    if (!selection) return "";

    // Get current settings for dominant trait info
    const settings = getSettings();

    // Handle array (Multi-select)
    if (Array.isArray(selection)) {
        const contents = selection.map(sel => {
            const item = getItemFromLibrary(sel.packName, sel.itemName);
            if (!item) return null;

            let content = "";
            if (type === 'behavior') content = item.lumia_behavior || "";
            if (type === 'personality') content = item.lumia_personality || "";

            if (!content) return null;

            // Process nested randomLumia macros
            content = processNestedRandomLumiaMacros(content);

            // Check if this is the dominant trait and append tag
            if (type === 'behavior' && settings.dominantBehavior) {
                if (settings.dominantBehavior.packName === sel.packName &&
                    settings.dominantBehavior.itemName === sel.itemName) {
                    content = appendDominantTag(content, "(My MOST PREVALENT Trait)");
                }
            } else if (type === 'personality' && settings.dominantPersonality) {
                if (settings.dominantPersonality.packName === sel.packName &&
                    settings.dominantPersonality.itemName === sel.itemName) {
                    content = appendDominantTag(content, "(My MOST PREVALENT Personality)");
                }
            }

            return content;
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

/**
 * Get Loom content for a selection
 * @param {Object|Array} selection - Single selection or array of selections
 * @returns {string} The Loom content for the selection(s)
 */
export function getLoomContent(selection) {
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

/**
 * Register all Lumia-related macros with MacrosParser
 * @param {Object} MacrosParser - The SillyTavern MacrosParser instance
 */
export function registerLumiaMacros(MacrosParser) {
    const settings = getSettings();

    // Random Lumia macros
    MacrosParser.registerMacro("randomLumia", () => {
        ensureRandomLumia();
        const currentRandomLumia = getCurrentRandomLumia();
        return currentRandomLumia ? (currentRandomLumia.lumiaDef || "") : "";
    });

    MacrosParser.registerMacro("randomLumia.phys", () => {
        ensureRandomLumia();
        const currentRandomLumia = getCurrentRandomLumia();
        return currentRandomLumia ? (currentRandomLumia.lumiaDef || "") : "";
    });

    MacrosParser.registerMacro("randomLumia.pers", () => {
        ensureRandomLumia();
        const currentRandomLumia = getCurrentRandomLumia();
        return currentRandomLumia ? (currentRandomLumia.lumia_personality || "") : "";
    });

    MacrosParser.registerMacro("randomLumia.behav", () => {
        ensureRandomLumia();
        const currentRandomLumia = getCurrentRandomLumia();
        return currentRandomLumia ? (currentRandomLumia.lumia_behavior || "") : "";
    });

    MacrosParser.registerMacro("randomLumia.name", () => {
        ensureRandomLumia();
        const currentRandomLumia = getCurrentRandomLumia();
        return currentRandomLumia ? (currentRandomLumia.lumiaDefName || "") : "";
    });

    // Selected Lumia macros
    MacrosParser.registerMacro("lumiaDef", () => {
        const currentSettings = getSettings();
        if (!currentSettings.selectedDefinition) return "";
        return getLumiaContent('def', currentSettings.selectedDefinition);
    });

    MacrosParser.registerMacro("lumiaDef.len", () => {
        const currentSettings = getSettings();
        return currentSettings.selectedDefinition ? "1" : "0";
    });

    MacrosParser.registerMacro("lumiaBehavior", () => {
        const currentSettings = getSettings();
        return getLumiaContent('behavior', currentSettings.selectedBehaviors);
    });

    MacrosParser.registerMacro("lumiaBehavior.len", () => {
        const currentSettings = getSettings();
        return String(currentSettings.selectedBehaviors?.length || 0);
    });

    MacrosParser.registerMacro("lumiaPersonality", () => {
        const currentSettings = getSettings();
        return getLumiaContent('personality', currentSettings.selectedPersonalities);
    });

    MacrosParser.registerMacro("lumiaPersonality.len", () => {
        const currentSettings = getSettings();
        return String(currentSettings.selectedPersonalities?.length || 0);
    });

    // Loom content macros
    MacrosParser.registerMacro("loomStyle", () => {
        const currentSettings = getSettings();
        if (!currentSettings.selectedLoomStyle) return "";
        return getLoomContent(currentSettings.selectedLoomStyle);
    });

    MacrosParser.registerMacro("loomStyle.len", () => {
        const currentSettings = getSettings();
        return currentSettings.selectedLoomStyle ? "1" : "0";
    });

    MacrosParser.registerMacro("loomUtils", () => {
        const currentSettings = getSettings();
        if (!currentSettings.selectedLoomUtils || currentSettings.selectedLoomUtils.length === 0) return "";
        return getLoomContent(currentSettings.selectedLoomUtils);
    });

    MacrosParser.registerMacro("loomUtils.len", () => {
        const currentSettings = getSettings();
        return String(currentSettings.selectedLoomUtils?.length || 0);
    });

    MacrosParser.registerMacro("loomRetrofits", () => {
        const currentSettings = getSettings();
        if (!currentSettings.selectedLoomRetrofits || currentSettings.selectedLoomRetrofits.length === 0) return "";
        return getLoomContent(currentSettings.selectedLoomRetrofits);
    });

    MacrosParser.registerMacro("loomRetrofits.len", () => {
        const currentSettings = getSettings();
        return String(currentSettings.selectedLoomRetrofits?.length || 0);
    });
}
