/**
 * useCharacterEditor — React hook for the character card editor.
 *
 * Manages form state, dirty tracking, save/revert, alternate greetings CRUD,
 * and avatar upload preview.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  fetchFullCharacter,
  fetchWorldBookNames,
  saveCharacterChanges,
  uploadAvatar,
  saveCharacterFull,
  reloadCharacterInST,
} from "../../lib/characterEditorService.js";

/**
 * Extract flat form state from a full ST character object.
 * @param {Object} char - Full character V2 object
 * @returns {Object} Flat form state
 */
function extractFormState(char) {
  const data = char.data || {};
  const ext = data.extensions || {};
  const dp = ext.depth_prompt || {};

  return {
    name: char.name || "",
    description: data.description || char.description || "",
    personality: data.personality || char.personality || "",
    scenario: data.scenario || char.scenario || "",
    first_mes: data.first_mes || char.first_mes || "",
    mes_example: data.mes_example || char.mes_example || "",
    system_prompt: data.system_prompt || "",
    post_history_instructions: data.post_history_instructions || "",
    creator: data.creator || "",
    creator_notes: data.creator_notes || "",
    character_version: data.character_version || "",
    tags: Array.isArray(data.tags) ? data.tags : (Array.isArray(char.tags) ? char.tags : []),
    talkativeness: typeof ext.talkativeness === "number" ? ext.talkativeness : 0.5,
    fav: !!(char.fav || ext.fav),
    world: ext.world || "",
    depth_prompt_prompt: dp.prompt || "",
    depth_prompt_depth: typeof dp.depth === "number" ? dp.depth : 4,
    depth_prompt_role: dp.role || "system",
    alternate_greetings: Array.isArray(data.alternate_greetings) ? [...data.alternate_greetings] : [],
  };
}

/**
 * Build a merge-attributes payload from changed fields only.
 * @param {Object} form - Current form state
 * @param {Object} original - Original form state
 * @returns {Object} Partial V2 structure for merge-attributes API
 */
function buildMergePayload(form, original) {
  const changes = { data: {} };
  let hasChanges = false;

  // V1+V2 core fields
  for (const field of ["description", "personality", "scenario", "first_mes", "mes_example"]) {
    if (form[field] !== original[field]) {
      changes[field] = form[field];
      changes.data[field] = form[field];
      hasChanges = true;
    }
  }

  // V2-only fields
  for (const field of [
    "system_prompt", "post_history_instructions",
    "creator", "creator_notes", "character_version", "alternate_greetings",
  ]) {
    if (JSON.stringify(form[field]) !== JSON.stringify(original[field])) {
      changes.data[field] = form[field];
      hasChanges = true;
    }
  }

  // Tags (V1 + V2)
  if (JSON.stringify(form.tags) !== JSON.stringify(original.tags)) {
    changes.tags = form.tags;
    changes.data.tags = form.tags;
    hasChanges = true;
  }

  // Extension fields
  const extChanges = {};
  if (form.talkativeness !== original.talkativeness) extChanges.talkativeness = form.talkativeness;
  if (form.fav !== original.fav) extChanges.fav = form.fav;
  if (form.world !== original.world) extChanges.world = form.world;

  // Depth prompt
  const dp = { prompt: form.depth_prompt_prompt, depth: form.depth_prompt_depth, role: form.depth_prompt_role };
  const origDp = { prompt: original.depth_prompt_prompt, depth: original.depth_prompt_depth, role: original.depth_prompt_role };
  if (JSON.stringify(dp) !== JSON.stringify(origDp)) {
    extChanges.depth_prompt = dp;
  }

  if (Object.keys(extChanges).length > 0) {
    changes.data.extensions = extChanges;
    hasChanges = true;
  }

  // fav also lives at top level
  if (form.fav !== original.fav) {
    changes.fav = form.fav;
    hasChanges = true;
  }

  return hasChanges ? changes : null;
}

/**
 * @param {Object} item - Normalized character item from the browser (must have .avatar)
 * @returns {Object} Hook state and actions
 */
export default function useCharacterEditor(item) {
  const [formState, setFormState] = useState(null);
  const [originalState, setOriginalState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [worldBookNames, setWorldBookNames] = useState([]);

  // Keep a ref to the raw character data for name-change saves
  const rawCharRef = useRef(null);

  // Load character data + world book names on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [char, worlds] = await Promise.all([
          fetchFullCharacter(item.avatar),
          fetchWorldBookNames(),
        ]);
        if (cancelled) return;
        rawCharRef.current = char;
        const state = extractFormState(char);
        setFormState(state);
        setOriginalState(state);
        setWorldBookNames(worlds);
      } catch (err) {
        if (!cancelled) {
          console.error("[Lumiverse] Failed to load character:", err);
          setLoadError(err.message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [item.avatar]);

  // Clean up avatar preview URL on unmount
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  // Dirty check
  const isDirty = useMemo(() => {
    if (!formState || !originalState) return false;
    if (pendingAvatarFile) return true;
    return JSON.stringify(formState) !== JSON.stringify(originalState);
  }, [formState, originalState, pendingAvatarFile]);

  // Update a single form field
  const updateField = useCallback((field, value) => {
    setFormState((prev) => prev ? { ...prev, [field]: value } : prev);
  }, []);

  // Alternate greetings CRUD
  const addGreeting = useCallback(() => {
    setFormState((prev) => {
      if (!prev) return prev;
      return { ...prev, alternate_greetings: [...prev.alternate_greetings, ""] };
    });
  }, []);

  const updateGreeting = useCallback((index, value) => {
    setFormState((prev) => {
      if (!prev) return prev;
      const greetings = [...prev.alternate_greetings];
      greetings[index] = value;
      return { ...prev, alternate_greetings: greetings };
    });
  }, []);

  const removeGreeting = useCallback((index) => {
    setFormState((prev) => {
      if (!prev) return prev;
      const greetings = prev.alternate_greetings.filter((_, i) => i !== index);
      return { ...prev, alternate_greetings: greetings };
    });
  }, []);

  // Avatar file selection
  const setAvatarFile = useCallback((file) => {
    setPendingAvatarFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } else {
      setAvatarPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, []);

  // Save
  const save = useCallback(async () => {
    if (!formState || !originalState) return false;
    setIsSaving(true);

    try {
      const avatarUrl = item.avatar;
      const nameChanged = formState.name !== originalState.name;

      // 1. Upload avatar if changed
      if (pendingAvatarFile) {
        await uploadAvatar(avatarUrl, pendingAvatarFile);
        setPendingAvatarFile(null);
        setAvatarPreview(null);
      }

      // 2. Name change requires full save (file rename on server)
      if (nameChanged) {
        // Build full character object from raw + form overrides
        const fullChar = { ...rawCharRef.current };
        fullChar.name = formState.name;
        fullChar.description = formState.description;
        fullChar.personality = formState.personality;
        fullChar.scenario = formState.scenario;
        fullChar.first_mes = formState.first_mes;
        fullChar.mes_example = formState.mes_example;
        fullChar.fav = formState.fav;
        fullChar.tags = formState.tags;

        if (!fullChar.data) fullChar.data = {};
        Object.assign(fullChar.data, {
          name: formState.name,
          description: formState.description,
          personality: formState.personality,
          scenario: formState.scenario,
          first_mes: formState.first_mes,
          mes_example: formState.mes_example,
          system_prompt: formState.system_prompt,
          post_history_instructions: formState.post_history_instructions,
          creator: formState.creator,
          creator_notes: formState.creator_notes,
          character_version: formState.character_version,
          tags: formState.tags,
          alternate_greetings: formState.alternate_greetings,
        });

        if (!fullChar.data.extensions) fullChar.data.extensions = {};
        Object.assign(fullChar.data.extensions, {
          talkativeness: formState.talkativeness,
          fav: formState.fav,
          world: formState.world,
          depth_prompt: {
            prompt: formState.depth_prompt_prompt,
            depth: formState.depth_prompt_depth,
            role: formState.depth_prompt_role,
          },
        });

        await saveCharacterFull(fullChar);
      } else {
        // 3. Partial merge save (no name change)
        const payload = buildMergePayload(formState, originalState);
        if (payload) {
          await saveCharacterChanges(avatarUrl, payload);
        }
      }

      // 4. Reload in ST's memory
      const freshChar = await reloadCharacterInST(avatarUrl);
      if (freshChar) {
        rawCharRef.current = freshChar;
        const newState = extractFormState(freshChar);
        setFormState(newState);
        setOriginalState(newState);
      } else {
        // No reload possible — just snapshot current state
        setOriginalState({ ...formState });
      }

      return true;
    } catch (err) {
      console.error("[Lumiverse] Save failed:", err);
      if (typeof toastr !== "undefined") {
        toastr.error(`Save failed: ${err.message}`);
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [formState, originalState, item.avatar, pendingAvatarFile]);

  // Revert
  const revert = useCallback(() => {
    if (originalState) {
      setFormState({ ...originalState });
    }
    setPendingAvatarFile(null);
    setAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [originalState]);

  return {
    formState,
    originalState,
    isLoading,
    isSaving,
    loadError,
    isDirty,
    pendingAvatarFile,
    avatarPreview,
    worldBookNames,

    updateField,
    save,
    revert,
    setAvatarFile,

    addGreeting,
    updateGreeting,
    removeGreeting,
  };
}
