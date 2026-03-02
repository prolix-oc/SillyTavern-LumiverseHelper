/**
 * Character Editor Service
 *
 * ST API calls for character card editing — fetch, save, avatar upload, reload.
 * All access goes through stContext.js.
 */

import {
  getContext,
  getRequestHeaders,
  getCharacters,
  getEventSource,
  getEventTypes,
} from "../stContext.js";

/**
 * Fetch the list of available world book names from ST settings.
 * @returns {Promise<string[]>} Array of world book name strings
 */
export async function fetchWorldBookNames() {
  try {
    const response = await fetch("/api/settings/get", {
      method: "POST",
      headers: getRequestHeaders(),
      body: JSON.stringify({}),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.world_names || [];
  } catch {
    return [];
  }
}

/**
 * Fetch the full character V2 object from the server.
 * @param {string} avatarUrl - The character's avatar filename (e.g. "character.png")
 * @returns {Promise<Object>} Full character object
 */
export async function fetchFullCharacter(avatarUrl) {
  const response = await fetch("/api/characters/get", {
    method: "POST",
    headers: getRequestHeaders(),
    body: JSON.stringify({ avatar_url: avatarUrl }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch character: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Save changed character fields via deep merge.
 * Only sends fields that actually changed — server deep-merges into existing data.
 * @param {string} avatarUrl - The character's avatar filename
 * @param {Object} changes - Partial V2 structure of changed fields
 * @returns {Promise<void>}
 */
export async function saveCharacterChanges(avatarUrl, changes) {
  const payload = {
    avatar: avatarUrl,
    ...changes,
  };

  const response = await fetch("/api/characters/merge-attributes", {
    method: "POST",
    headers: getRequestHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to save character: ${text}`);
  }
}

/**
 * Upload a new avatar image for a character.
 * @param {string} avatarUrl - Current avatar filename
 * @param {File} file - The new avatar image file
 * @returns {Promise<void>}
 */
export async function uploadAvatar(avatarUrl, file) {
  const formData = new FormData();
  formData.append("avatar", file);
  formData.append("avatar_url", avatarUrl);

  // FormData requests — don't set Content-Type header (browser sets boundary)
  const ctx = getContext();
  const headers = {};
  const reqHeaders = ctx?.getRequestHeaders?.();
  if (reqHeaders) {
    // Copy all headers except Content-Type
    for (const [key, val] of Object.entries(reqHeaders)) {
      if (key.toLowerCase() !== "content-type") {
        headers[key] = val;
      }
    }
  }

  const response = await fetch("/api/characters/edit-avatar", {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload avatar: ${response.statusText}`);
  }
}

/**
 * Save character via the full /edit endpoint (required for name changes which involve file renames).
 * Builds a FormData payload with the complete character data.
 * @param {Object} charData - The full character object with updated fields
 * @param {File|null} avatarFile - Optional new avatar file
 * @returns {Promise<void>}
 */
export async function saveCharacterFull(charData, avatarFile = null) {
  const formData = new FormData();

  if (avatarFile) {
    formData.append("avatar", avatarFile);
  }

  // Map character data fields to FormData keys expected by ST backend
  formData.append("avatar_url", charData.avatar || "");
  formData.append("ch_name", charData.name || "");
  formData.append("description", charData.description || charData.data?.description || "");
  formData.append("personality", charData.personality || charData.data?.personality || "");
  formData.append("scenario", charData.scenario || charData.data?.scenario || "");
  formData.append("first_mes", charData.first_mes || charData.data?.first_mes || "");
  formData.append("mes_example", charData.mes_example || charData.data?.mes_example || "");
  formData.append("creator_notes", charData.data?.creator_notes || "");
  formData.append("system_prompt", charData.data?.system_prompt || "");
  formData.append("post_history_instructions", charData.data?.post_history_instructions || "");
  formData.append("creator", charData.data?.creator || "");
  formData.append("character_version", charData.data?.character_version || "");
  formData.append("tags", JSON.stringify(charData.tags || charData.data?.tags || []));
  formData.append("talkativeness", String(charData.data?.extensions?.talkativeness ?? 0.5));
  formData.append("fav", String(charData.fav ?? charData.data?.extensions?.fav ?? false));
  formData.append("world", charData.data?.extensions?.world || "");
  formData.append("alternate_greetings", JSON.stringify(charData.data?.alternate_greetings || []));

  // Depth prompt
  const dp = charData.data?.extensions?.depth_prompt;
  if (dp) {
    formData.append("depth_prompt_prompt", dp.prompt || "");
    formData.append("depth_prompt_depth", String(dp.depth ?? 4));
    formData.append("depth_prompt_role", dp.role || "system");
  }

  const ctx = getContext();
  const headers = {};
  const reqHeaders = ctx?.getRequestHeaders?.();
  if (reqHeaders) {
    for (const [key, val] of Object.entries(reqHeaders)) {
      if (key.toLowerCase() !== "content-type") {
        headers[key] = val;
      }
    }
  }

  const response = await fetch("/api/characters/edit", {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to save character (full): ${response.statusText}`);
  }
}

/**
 * Create a new character via ST's /api/characters/create endpoint.
 * @param {Object} formState - Flat form state from the editor
 * @param {File|null} avatarFile - Optional avatar file
 * @returns {Promise<string>} The avatar filename of the created character
 */
export async function createCharacter(formState, avatarFile = null) {
  const formData = new FormData();

  if (avatarFile) {
    formData.append("avatar", avatarFile);
  }

  formData.append("ch_name", formState.name || "New Character");
  formData.append("description", formState.description || "");
  formData.append("personality", formState.personality || "");
  formData.append("scenario", formState.scenario || "");
  formData.append("first_mes", formState.first_mes || "");
  formData.append("mes_example", formState.mes_example || "");
  formData.append("creator_notes", formState.creator_notes || "");
  formData.append("system_prompt", formState.system_prompt || "");
  formData.append("post_history_instructions", formState.post_history_instructions || "");
  formData.append("creator", formState.creator || "");
  formData.append("character_version", formState.character_version || "");
  formData.append("tags", JSON.stringify(formState.tags || []));
  formData.append("talkativeness", String(formState.talkativeness ?? 0.5));
  formData.append("fav", String(formState.fav ?? false));
  formData.append("world", formState.world || "");
  formData.append("alternate_greetings", JSON.stringify(formState.alternate_greetings || []));
  formData.append("depth_prompt_prompt", formState.depth_prompt_prompt || "");
  formData.append("depth_prompt_depth", String(formState.depth_prompt_depth ?? 4));
  formData.append("depth_prompt_role", formState.depth_prompt_role || "system");

  const ctx = getContext();
  const headers = {};
  const reqHeaders = ctx?.getRequestHeaders?.();
  if (reqHeaders) {
    for (const [key, val] of Object.entries(reqHeaders)) {
      if (key.toLowerCase() !== "content-type") {
        headers[key] = val;
      }
    }
  }

  const response = await fetch("/api/characters/create", {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to create character: ${text}`);
  }

  const data = await response.json();

  // ST returns { file_name: "avatar.png" } on success
  const avatarUrl = data.file_name || data.avatar_url || "";

  // Ask ST to refresh its internal character list
  try {
    const { getCharacters: refreshCharacters } = await import(
      /* webpackIgnore: true */ "../../../../../script.js"
    );
    if (typeof refreshCharacters === "function") {
      await refreshCharacters();
    }
  } catch { /* non-fatal */ }

  return avatarUrl;
}

/**
 * Reload a character in ST's in-memory state after saving.
 * Fetches fresh data, patches the characters array, and emits CHARACTER_EDITED.
 * @param {string} avatarUrl - The character's avatar filename
 * @returns {Promise<Object|null>} The refreshed character object, or null on failure
 */
export async function reloadCharacterInST(avatarUrl) {
  try {
    const freshChar = await fetchFullCharacter(avatarUrl);
    if (!freshChar) return null;

    // Update in-memory characters array
    const characters = getCharacters();
    const idx = characters.findIndex((c) => c.avatar === avatarUrl);
    if (idx !== -1) {
      // Patch in-place so references update
      Object.assign(characters[idx], freshChar);
    }

    // Emit CHARACTER_EDITED so browser service re-syncs
    const eventSource = getEventSource();
    const eventTypes = getEventTypes();
    if (eventSource && eventTypes?.CHARACTER_EDITED) {
      eventSource.emit(eventTypes.CHARACTER_EDITED, { detail: { id: idx, character: freshChar } });
    }

    return freshChar;
  } catch (err) {
    console.error("[Lumiverse] Failed to reload character in ST:", err);
    return null;
  }
}
