/**
 * quickReplyService — Thin wrapper around SillyTavern's Quick Replies v2 API
 *
 * All access goes through `globalThis.quickReplyApi` with null-safety.
 * Provides Lumiverse-friendly data shaping for both the Chat Sheld popover
 * and the settings editor.
 */

// ─── Availability ────────────────────────────────────────────────────

/** @returns {boolean} Whether the QR2 extension is loaded */
export function isQRAvailable() {
    return !!globalThis.quickReplyApi;
}

/** @returns {object|null} The raw API handle, or null */
function api() {
    return globalThis.quickReplyApi ?? null;
}

// ─── Popover (active sets + execute) ─────────────────────────────────

/**
 * Returns the currently active QR sets (global + chat) with their entries,
 * filtered to exclude hidden entries.
 *
 * @returns {{ name: string, color: string, onlyBorderColor: boolean, disableSend: boolean, qrs: Array }[]}
 */
export function getActiveQRSets() {
    const qr = api();
    if (!qr) return [];

    try {
        const globalNames = qr.listGlobalSets?.() ?? [];
        const chatNames = qr.listChatSets?.() ?? [];
        const allNames = [...new Set([...globalNames, ...chatNames])];

        return allNames.map(name => {
            const set = qr.getSetByName?.(name);
            if (!set) return null;

            const entries = (set.qrList ?? [])
                .filter(entry => !entry.isHidden)
                .map(entry => ({
                    id: entry.id,
                    label: entry.label ?? '',
                    message: entry.message ?? '',
                    icon: entry.icon ?? '',
                    title: entry.title ?? '',
                    automationId: entry.automationId ?? '',
                }));

            if (entries.length === 0) return null;

            return {
                name: set.name ?? name,
                color: set.color ?? '',
                onlyBorderColor: set.onlyBorderColor ?? false,
                disableSend: set.disableSend ?? false,
                isGlobal: globalNames.includes(name),
                isChat: chatNames.includes(name),
                qrs: entries,
            };
        }).filter(Boolean);
    } catch (err) {
        console.warn('[Lumiverse] Failed to read active QR sets:', err);
        return [];
    }
}

/**
 * Execute a quick reply by set name and entry ID.
 */
export async function executeQR(setName, id) {
    const qr = api();
    if (!qr) return;

    try {
        await qr.executeQuickReply?.(setName, id);
    } catch (err) {
        console.error('[Lumiverse] Failed to execute QR:', err);
    }
}

// ─── Editor (full CRUD) ─────────────────────────────────────────────

/**
 * Returns all QR sets with full metadata + entries.
 */
export function getAllSets() {
    const qr = api();
    if (!qr) return [];

    try {
        const names = qr.listSets?.() ?? [];
        const globalNames = qr.listGlobalSets?.() ?? [];
        const chatNames = qr.listChatSets?.() ?? [];

        return names.map(name => {
            const set = qr.getSetByName?.(name);
            if (!set) return null;

            return {
                name: set.name ?? name,
                color: set.color ?? '',
                onlyBorderColor: set.onlyBorderColor ?? false,
                disableSend: set.disableSend ?? false,
                placeBeforeInput: set.placeBeforeInput ?? false,
                injectInput: set.injectInput ?? false,
                isGlobal: globalNames.includes(name),
                isChat: chatNames.includes(name),
                qrs: (set.qrList ?? []).map(entry => ({
                    id: entry.id,
                    label: entry.label ?? '',
                    message: entry.message ?? '',
                    icon: entry.icon ?? '',
                    title: entry.title ?? '',
                    isHidden: entry.isHidden ?? false,
                    automationId: entry.automationId ?? '',
                    executeOnStartup: entry.executeOnStartup ?? false,
                    executeOnUser: entry.executeOnUser ?? false,
                    executeOnAi: entry.executeOnAi ?? false,
                    executeOnChatChange: entry.executeOnChatChange ?? false,
                    executeOnNewChat: entry.executeOnNewChat ?? false,
                    executeOnGroupMemberDraft: entry.executeOnGroupMemberDraft ?? false,
                    preventAutoExecute: entry.preventAutoExecute ?? false,
                    contextList: entry.contextList ?? [],
                })),
            };
        }).filter(Boolean);
    } catch (err) {
        console.warn('[Lumiverse] Failed to list QR sets:', err);
        return [];
    }
}

/**
 * Create a new QR set.
 */
export async function createSet(name, props = {}) {
    const qr = api();
    if (!qr) return;

    try {
        await qr.createSet?.(name, props);
    } catch (err) {
        console.error('[Lumiverse] Failed to create QR set:', err);
    }
}

/**
 * Delete a QR set by name.
 */
export async function deleteSet(name) {
    const qr = api();
    if (!qr) return;

    try {
        await qr.deleteSet?.(name);
    } catch (err) {
        console.error('[Lumiverse] Failed to delete QR set:', err);
    }
}

/**
 * Create a new quick reply entry in a set.
 */
export async function createQR(setName, label, props = {}) {
    const qr = api();
    if (!qr) return;

    try {
        await qr.createQuickReply?.(setName, label, props);
    } catch (err) {
        console.error('[Lumiverse] Failed to create QR:', err);
    }
}

/**
 * Update an existing quick reply entry.
 */
export async function updateQR(setName, id, props) {
    const qr = api();
    if (!qr) return;

    try {
        await qr.updateQuickReply?.(setName, id, props);
    } catch (err) {
        console.error('[Lumiverse] Failed to update QR:', err);
    }
}

/**
 * Delete a quick reply entry.
 */
export async function deleteQR(setName, id) {
    const qr = api();
    if (!qr) return;

    try {
        await qr.deleteQuickReply?.(setName, id);
    } catch (err) {
        console.error('[Lumiverse] Failed to delete QR:', err);
    }
}

/**
 * Toggle a set's global activation state.
 */
export async function toggleGlobalSet(name, active) {
    const qr = api();
    if (!qr) return;

    try {
        if (active) {
            await qr.addGlobalSet?.(name);
        } else {
            await qr.removeGlobalSet?.(name);
        }
    } catch (err) {
        console.error('[Lumiverse] Failed to toggle global set:', err);
    }
}

/**
 * Toggle a set's chat activation state.
 */
export async function toggleChatSet(name, active) {
    const qr = api();
    if (!qr) return;

    try {
        if (active) {
            await qr.addChatSet?.(name);
        } else {
            await qr.removeChatSet?.(name);
        }
    } catch (err) {
        console.error('[Lumiverse] Failed to toggle chat set:', err);
    }
}
