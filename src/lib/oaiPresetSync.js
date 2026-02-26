/**
 * OAI Preset Sync
 *
 * Manages the bridge between Loom Builder presets and SillyTavern's OAI settings.
 * When a Loom preset is active, this module:
 * 1. Switches ST to the "Default" OAI preset for a clean sampler baseline
 * 2. Syncs the Loom preset's contextSize into oai_settings.openai_max_context
 *    so that World Info / Lore Books calculate correct token budgets during
 *    prompt assembly (before CHAT_COMPLETION_SETTINGS_READY fires)
 * 3. Restores the original ST preset when the Loom preset is deactivated
 *
 * Key fact: ctx.chatCompletionSettings IS oai_settings (same object reference,
 * confirmed at st-context.js:217). Setting openai_max_context on it directly
 * updates the value World Info reads.
 */

import { getContext, getEventSource, getEventTypes } from "../stContext.js";
import { MODULE_NAME } from "./settingsManager.js";
import { getProfileKey, resolveActivePreset, savePreset } from "./lucidLoomService.js";
import { applyReasoningSnapshot, captureReasoningSnapshot } from "./presetsService.js";

// ============================================================================
// MODULE STATE
// ============================================================================

/** Whether we've taken control of ST's OAI preset */
let _isLoomControlActive = false;

/** Original ST preset name before we switched to Default */
let _savedSTPresetName = null;

/** Guard flag to prevent circular event loops during preset switching */
let _isSwitchingPreset = false;

/**
 * Guard: suppress reasoning reapply during Lumiverse-initiated updates.
 * When the user changes reasoning settings from the Lumiverse UI, the
 * presetsService functions update ST globals → SETTINGS_UPDATED fires →
 * this module's handler would call reapplyLoomReasoningSettings(), overwriting
 * the user's changes with the saved model profile. This flag prevents that.
 */
let _suppressReasoningReapply = false;
let _suppressTimer = null;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Main entry point — called on every Loom preset transition.
 *
 * @param {string|null} presetId - The resolved Loom preset ID, or null if deactivated
 * @param {Object|null} preset - The full Loom preset object, or null
 */
export function handleLoomPresetTransition(presetId, preset) {
    const ctx = getContext();
    if (!ctx) return;

    // Only sync OAI settings when using the OpenAI API path
    if (ctx.mainApi !== 'openai') return;

    if (presetId && !_isLoomControlActive) {
        // === ACTIVATE: Loom preset becoming active ===
        activateLoomControl(preset);
    } else if (presetId && _isLoomControlActive) {
        // === RE-SYNC: Already active, just update context size ===
        // Handles model profile switches, sampler edits, etc.
        syncContextSize(preset);
    } else if (!presetId && _isLoomControlActive) {
        // === DEACTIVATE: Loom preset removed ===
        deactivateLoomControl();
    }
}

/**
 * Sync the Loom preset's contextSize into ST's oai_settings.openai_max_context.
 * Also updates the #openai_max_context UI slider to reflect the change.
 * Skips if contextSize is null/disabled.
 *
 * @param {Object} preset - The active Loom preset
 */
export function syncContextSize(preset) {
    if (!preset?.samplerOverrides?.enabled) return;

    const contextSize = preset.samplerOverrides.contextSize;
    if (contextSize === null || contextSize === undefined) return;

    const ctx = getContext();
    if (!ctx?.chatCompletionSettings) return;

    const numValue = Number(contextSize);
    if (isNaN(numValue) || numValue <= 0) return;

    // Write directly to oai_settings (same object ref as chatCompletionSettings)
    ctx.chatCompletionSettings.openai_max_context = numValue;

    // Update the UI slider so the user can see the synced value
    try {
        const slider = document.getElementById('openai_max_context');
        if (slider) {
            slider.value = numValue;
            // Trigger input event so ST updates associated counter/label
            slider.dispatchEvent(new Event('input', { bubbles: true }));
        }
    } catch (e) {
        // UI update is best-effort
    }

}

/**
 * Returns whether Loom control is currently active.
 * @returns {boolean}
 */
export function isLoomControlActive() {
    return _isLoomControlActive;
}

/**
 * Re-apply reasoning/CoT settings from the active Loom model profile.
 * Called after any OAI preset switch that may have overwritten ST globals.
 * Safe to call when Loom control is inactive (no-ops).
 *
 * IMPORTANT: Suppresses the SETTINGS_UPDATED / OAI_PRESET_CHANGED_AFTER
 * handlers before applying. applyReasoningSnapshot() calls saveSettingsDebounced()
 * up to 5 times, each of which eventually fires settings_updated. Without
 * suppression, this creates a feedback loop that repeats 2-3 iterations at
 * debounce intervals (~200-400ms each), causing a visible 1-2s UI stall.
 */
export function reapplyLoomReasoningSettings() {
    if (!_isLoomControlActive) return;

    const preset = resolveActivePreset();
    if (!preset) return;

    const profileKey = getProfileKey();
    if (!profileKey) return;

    const profile = preset.modelProfiles?.[profileKey];
    if (!profile) return;

    // Break the feedback loop: applyReasoningSnapshot → saveSettingsDebounced (×5)
    // → settings_updated → this function again. ST's saveSettingsDebounced has a
    // ~1000ms debounce delay, so the suppress window must exceed that. 1500ms
    // covers the debounce (1000ms) + our handler debounce (150ms) + margin.
    suppressReasoningReapply(1500);
    applyReasoningSnapshot(profile);
}

/**
 * Temporarily suppress reasoning reapply for Lumiverse-initiated changes.
 * Call this BEFORE modifying reasoning settings from the Lumiverse UI.
 * Prevents the SETTINGS_UPDATED / OAI_PRESET_CHANGED_AFTER event handlers
 * from overwriting the user's changes with the saved model profile values.
 * Auto-clears after the specified duration.
 * @param {number} [durationMs=700] - Duration to suppress in milliseconds
 */
export function suppressReasoningReapply(durationMs = 700) {
    _suppressReasoningReapply = true;
    if (_suppressTimer) clearTimeout(_suppressTimer);
    _suppressTimer = setTimeout(() => {
        _suppressReasoningReapply = false;
        _suppressTimer = null;
    }, durationMs);
}

/**
 * Save the current reasoning state to the active Loom model profile.
 * Call this after the user finishes editing reasoning settings in the UI
 * (typically via debounce) to persist the changes to the Loom preset file.
 */
export function saveReasoningToModelProfile() {
    if (!_isLoomControlActive) return;

    const preset = resolveActivePreset();
    if (!preset) return;

    const profileKey = getProfileKey();
    if (!profileKey) return;

    const snapshot = captureReasoningSnapshot();
    if (!preset.modelProfiles) preset.modelProfiles = {};

    preset.modelProfiles[profileKey] = {
        ...(preset.modelProfiles[profileKey] || {}),
        ...snapshot,
    };
    preset.lastProfileKey = profileKey;
    savePreset(preset);

}

/**
 * Subscribe to OAI_PRESET_CHANGED_AFTER persistently so that any time ST
 * applies a preset (user-initiated or otherwise), we restore Loom's reasoning
 * settings if Loom control is active.
 */
export function subscribeToOAIPresetEvents() {
    const eventSource = getEventSource();
    const eventTypes = getEventTypes();

    if (eventSource && eventTypes?.OAI_PRESET_CHANGED_AFTER) {
        eventSource.on(eventTypes.OAI_PRESET_CHANGED_AFTER, () => {
            if (_isLoomControlActive && !_isSwitchingPreset && !_suppressReasoningReapply) {
                // ST just applied an OAI preset — re-apply our reasoning
                reapplyLoomReasoningSettings();
            }
        });
    }

    // Also listen for SETTINGS_UPDATED if available (catches preset tab edits).
    // Debounced to 150ms because ST fires this event very frequently (any
    // saveSettingsDebounced call), and reapplyLoomReasoningSettings itself
    // triggers up to 5 more saves. The debounce coalesces rapid fires and
    // yields to the browser so the handler never blocks the event emitter.
    if (eventSource && eventTypes?.SETTINGS_UPDATED) {
        let _settingsUpdatedTimer = null;
        eventSource.on(eventTypes.SETTINGS_UPDATED, () => {
            if (!_isLoomControlActive || _isSwitchingPreset || _suppressReasoningReapply) return;
            if (_settingsUpdatedTimer) clearTimeout(_settingsUpdatedTimer);
            _settingsUpdatedTimer = setTimeout(() => {
                _settingsUpdatedTimer = null;
                if (_isLoomControlActive && !_isSwitchingPreset && !_suppressReasoningReapply) {
                    reapplyLoomReasoningSettings();
                }
            }, 150);
        });
    }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Activate Loom control: save current ST preset, switch to Default, sync context.
 * @param {Object} preset - The Loom preset being activated
 */
function activateLoomControl(preset) {
    if (_isSwitchingPreset) return;

    // Save the current ST preset name so we can restore it later
    _savedSTPresetName = getCurrentSTPresetName();
    _isLoomControlActive = true;

    // Switch ST to "Default" OAI preset for a clean baseline
    const switched = switchSTPresetTo('Default');

    if (switched) {
        // The preset change is async — ST applies values in a .finally() block.
        // Subscribe to OAI_PRESET_CHANGED_AFTER (one-shot) to sync context size
        // AFTER the Default preset's values are written.
        const eventSource = getEventSource();
        const eventTypes = getEventTypes();

        if (eventSource && eventTypes?.OAI_PRESET_CHANGED_AFTER) {
            // One-shot pattern: use a flag guard since ST's event emitter has no .off()
            let fired = false;
            const onPresetChanged = () => {
                if (fired) return;
                fired = true;
                if (_isLoomControlActive) {
                    syncContextSize(preset);
                    // Re-apply reasoning from the model profile — the Default preset
                    // just overwrote all reasoning/CoT settings in ST globals
                    reapplyLoomReasoningSettings();
                }
            };
            eventSource.on(eventTypes.OAI_PRESET_CHANGED_AFTER, onPresetChanged);

            // Fallback timeout in case the event doesn't fire
            setTimeout(() => {
                if (!fired && _isLoomControlActive) {
                    fired = true;
                    syncContextSize(preset);
                    reapplyLoomReasoningSettings();
                }
            }, 500);
        } else {
            // No event available — use fallback timeout
            setTimeout(() => {
                if (_isLoomControlActive) {
                    syncContextSize(preset);
                    reapplyLoomReasoningSettings();
                }
            }, 300);
        }
    } else {
        // Default preset not found — still sync context size directly
        console.warn(`[${MODULE_NAME}] OAI Sync: "Default" preset not found, syncing context size directly`);
        syncContextSize(preset);
    }
}

/**
 * Deactivate Loom control: restore the saved ST preset, clear state.
 */
function deactivateLoomControl() {
    if (_isSwitchingPreset) return;

    _isLoomControlActive = false;

    if (_savedSTPresetName) {
        switchSTPresetTo(_savedSTPresetName);
    }

    _savedSTPresetName = null;
}

/**
 * Get the currently selected ST OAI preset name from the dropdown.
 * @returns {string|null}
 */
function getCurrentSTPresetName() {
    try {
        const select = document.getElementById('settings_preset_openai');
        if (!select) return null;
        const option = select.options[select.selectedIndex];
        return option?.textContent?.trim() || null;
    } catch (e) {
        return null;
    }
}

/**
 * Search the OAI preset dropdown for an option matching the given name.
 * @param {string} name - The preset name to find
 * @returns {string|null} The option value, or null if not found
 */
function findPresetOptionByName(name) {
    if (!name) return null;
    try {
        const select = document.getElementById('settings_preset_openai');
        if (!select) return null;
        const target = name.toLowerCase().trim();
        for (const option of select.options) {
            if (option.textContent.trim().toLowerCase() === target) {
                return option.value;
            }
        }
    } catch (e) {
        // DOM access may fail
    }
    return null;
}

/**
 * Switch ST to the named OAI preset by selecting it in the dropdown and triggering change.
 * Uses the _isSwitchingPreset guard to prevent circular event loops.
 *
 * @param {string} name - The preset name to switch to
 * @returns {boolean} Whether the switch was initiated
 */
function switchSTPresetTo(name) {
    const optionValue = findPresetOptionByName(name);
    if (optionValue === null) {
        console.warn(`[${MODULE_NAME}] OAI Sync: Preset "${name}" not found in dropdown`);
        return false;
    }

    try {
        _isSwitchingPreset = true;

        const select = document.getElementById('settings_preset_openai');
        if (!select) {
            _isSwitchingPreset = false;
            return false;
        }

        select.value = optionValue;
        // Use jQuery trigger since ST's change handler is bound via jQuery
        jQuery(select).trigger('change');

        // Clear guard after a tick to allow the async handler to complete
        setTimeout(() => { _isSwitchingPreset = false; }, 100);
        return true;
    } catch (e) {
        _isSwitchingPreset = false;
        console.warn(`[${MODULE_NAME}] OAI Sync: Failed to switch preset:`, e);
        return false;
    }
}
