/**
 * guidedGenerationService — Guided Generations CRUD and injection logic.
 *
 * User-configurable custom prompts that attach to sends/regens/continues.
 * Supports persistent toggle and one-shot firing modes, with configurable
 * injection position per guide.
 */

import { useLumiverseStore, saveToExtension } from '../react-ui/store/LumiverseContext';

const store = useLumiverseStore;

/**
 * Generate a unique ID for a new guide.
 * @returns {string}
 */
function generateId() {
    return 'guide_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

/**
 * Get all guided generations from the store.
 * @returns {Array}
 */
export function getGuides() {
    return store.getState().guidedGenerations || [];
}

/**
 * Get only the currently enabled/active guides.
 * @returns {Array}
 */
export function getActiveGuides() {
    return getGuides().filter(g => g.enabled);
}

/**
 * Save a guide (create or update).
 * @param {Object} guide - Guide object to save. If guide.id exists, updates; otherwise creates.
 * @returns {Object} The saved guide
 */
export function saveGuide(guide) {
    const guides = [...getGuides()];
    const existing = guides.findIndex(g => g.id === guide.id);

    const saved = {
        id: guide.id || generateId(),
        name: guide.name || 'Untitled Guide',
        content: guide.content || '',
        position: guide.position || 'system',
        mode: guide.mode || 'persistent',
        enabled: guide.enabled ?? false,
        color: guide.color || null,
    };

    if (existing >= 0) {
        guides[existing] = saved;
    } else {
        guides.push(saved);
    }

    store.setState({ guidedGenerations: guides });
    saveToExtension();
    return saved;
}

/**
 * Delete a guide by ID.
 * @param {string} id
 */
export function deleteGuide(id) {
    const guides = getGuides().filter(g => g.id !== id);
    store.setState({ guidedGenerations: guides });
    saveToExtension();
}

/**
 * Toggle a guide's enabled state.
 * @param {string} id
 * @returns {boolean} New enabled state
 */
export function toggleGuide(id) {
    const guides = getGuides().map(g => {
        if (g.id === id) return { ...g, enabled: !g.enabled };
        return g;
    });
    store.setState({ guidedGenerations: guides });
    saveToExtension();
    const guide = guides.find(g => g.id === id);
    return guide?.enabled ?? false;
}

/**
 * Deactivate all one-shot guides that are currently enabled.
 * Called after guides have been applied to a generation.
 */
export function deactivateOneshotGuides() {
    const guides = getGuides();
    let changed = false;
    const updated = guides.map(g => {
        if (g.mode === 'oneshot' && g.enabled) {
            changed = true;
            return { ...g, enabled: false };
        }
        return g;
    });
    if (changed) {
        store.setState({ guidedGenerations: updated });
        saveToExtension();
    }
}

/**
 * Apply active guides to a generateData object.
 * Called from the CHAT_COMPLETION_SETTINGS_READY handler.
 *
 * - `system` position: inserts a system message before the first user/assistant message
 * - `user_prefix`: prepends content to the last user message
 * - `user_suffix`: appends content to the last user message
 *
 * @param {Object} generateData - The generate_data object from ST (mutated in place)
 */
export function applyGuidesToGeneration(generateData) {
    const active = getActiveGuides();
    if (active.length === 0) return;

    const messages = generateData?.messages;
    if (!Array.isArray(messages) || messages.length === 0) return;

    // Collect system injections
    const systemInjections = [];
    const prefixes = [];
    const suffixes = [];

    for (const guide of active) {
        const content = guide.content?.trim();
        if (!content) continue;

        switch (guide.position) {
            case 'system':
                systemInjections.push(content);
                break;
            case 'user_prefix':
                prefixes.push(content);
                break;
            case 'user_suffix':
                suffixes.push(content);
                break;
        }
    }

    // Insert system messages before the first non-system message
    if (systemInjections.length > 0) {
        const systemContent = systemInjections.join('\n\n');
        // Find first non-system message index
        let insertIdx = 0;
        for (let i = 0; i < messages.length; i++) {
            if (messages[i].role !== 'system') {
                insertIdx = i;
                break;
            }
            insertIdx = i + 1;
        }
        messages.splice(insertIdx, 0, {
            role: 'system',
            content: systemContent,
        });
    }

    // Modify the last user message for prefix/suffix
    if (prefixes.length > 0 || suffixes.length > 0) {
        // Find last user message (scan backward)
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                let text = messages[i].content || '';
                if (prefixes.length > 0) {
                    text = prefixes.join('\n') + '\n' + text;
                }
                if (suffixes.length > 0) {
                    text = text + '\n' + suffixes.join('\n');
                }
                messages[i].content = text;
                break;
            }
        }
    }

    // Deactivate one-shot guides after application
    deactivateOneshotGuides();
}
