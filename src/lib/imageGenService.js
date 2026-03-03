/**
 * Image Generation Service
 *
 * Orchestration layer for scene-aware image generation:
 * - Scene change detection (field-diff based)
 * - Provider-aware prompt building
 * - Image storage via User Files API
 * - Background application with fade transitions
 */

import { MODULE_NAME, getSettings, GENDER } from "./settingsManager.js";
import { getContext, getRequestHeaders, getCurrentCharacter } from "../stContext.js";
import { generateImage, getProviderConfig } from "./imageProviders.js";
import { getLumiaField } from "./lumiaContent.js";
import { getItemFromLibrary } from "./dataProcessor.js";
import { hashString, getSceneImageFileKey } from "./fileStorage.js";
import { executeSingleTool, getNamedResultRaw, abortToolExecution } from "./councilTools.js";
import { getCurrentPersonaAvatar } from "./personaService.js";

// Debounce tracking — minimum 15s between generation requests
let lastGenerationTime = 0;
const GENERATION_DEBOUNCE_MS = 15000;

// Abort controller for the current image generation pipeline (LLM + provider API)
let imageGenAbortController = null;

// In-memory cache of last scene per chat (also persisted in chatMetadata)
const sceneCache = new Map();

// Fields used for scene change comparison
const SCENE_FIELDS = ["environment", "time_of_day", "weather", "mood", "focal_detail"];

/**
 * Check whether the scene has meaningfully changed from the previous one.
 * @param {Object} newScene - New scene parameters from the council tool
 * @param {Object} oldScene - Previous scene parameters
 * @param {number} threshold - Number of fields that must differ (default: 2)
 * @returns {boolean}
 */
export function hasSceneChanged(newScene, oldScene, threshold = 2) {
  if (!oldScene) return true;
  let changed = 0;
  for (const f of SCENE_FIELDS) {
    if (normalizeField(newScene[f]) !== normalizeField(oldScene[f])) {
      changed++;
    }
  }
  return changed >= threshold;
}

function normalizeField(val) {
  return (val || "").trim().toLowerCase();
}

/**
 * Get the last scene parameters for a chat.
 * @param {string} chatId - The chat identifier
 * @returns {Object|null}
 */
export function getLastScene(chatId) {
  return sceneCache.get(chatId) || null;
}

/**
 * Build an image generation prompt from scene data.
 * @param {Object} scene - Scene parameters (environment, time_of_day, weather, mood, focal_detail, palette_override)
 * @param {string} provider - Provider key (e.g., "google_gemini")
 * @param {boolean} includeCharacters - Whether to include character descriptions
 * @returns {string} The assembled prompt
 */
export function buildImagePrompt(scene, provider, includeCharacters = false) {
  const settings = getSettings().imageGeneration || {};

  // For NovelAI — build danbooru-style tag prompt
  if (provider === "novelai") {
    const tags = [];

    // Art style tags at the start — NAI weights earlier tags more heavily.
    // These guide the model toward crisp anime illustration with defined shading.
    // Quality/aesthetic tags (masterpiece, very aesthetic, absurdres, etc.) are
    // handled automatically by the qualityToggle API parameter.
    tags.push("illustration", "anime coloring");

    // Composition tags
    if (includeCharacters) {
      if (scene.composition_rating?.length) tags.push(...scene.composition_rating);
      if (scene.composition_subjects) tags.push(scene.composition_subjects);
      if (scene.composition_shot) tags.push(scene.composition_shot);
      if (scene.composition_camera) tags.push(scene.composition_camera);
    }

    // Scene content tags
    if (scene.environment) tags.push(scene.environment);
    if (scene.time_of_day) tags.push(scene.time_of_day);
    if (scene.weather && scene.weather !== "clear") tags.push(scene.weather);
    if (scene.mood) tags.push(scene.mood);
    if (scene.focal_detail) tags.push(scene.focal_detail);
    if (scene.palette_override) tags.push(scene.palette_override);

    if (includeCharacters) {
      // Fandom character names as lowercase Danbooru tags — provided by the LLM
      // scene analyzer which identifies canonical names from story context
      if (scene.character_names) {
        const names = scene.character_names.split(",").map(n => n.trim().toLowerCase()).filter(Boolean);
        tags.push(...names);
      }

      // Per-character appearance tags (body, hair, outfit, expression) from the LLM.
      // These reinforce reference images with explicit Danbooru tags.
      if (scene.character_appearances?.length) {
        for (const char of scene.character_appearances) {
          if (char.tags) tags.push(char.tags);
        }
      } else {
        // Fallback to Lumia definition descriptions when the LLM didn't provide appearances
        const charDesc = gatherCharacterDescriptions();
        if (charDesc) tags.push(charDesc);
      }
    } else {
      tags.push("no humans", "scenery", "background", "detailed background");
    }

    // Detail enhancement suffix
    tags.push("detailed", "depth of field");
    return tags.join(", ");
  }

  let prompt = "";

  // For Google Gemini, include resolution/aspect-ratio prefix (those are prompt hints)
  // For Nano-GPT, skip — size is sent as an API parameter
  if (provider !== "nanogpt") {
    const providerSettings = settings.google || {};
    const ar = providerSettings.aspectRatio || "16:9";
    const res = providerSettings.imageSize || "1K";
    prompt += `Generate a ${ar} aspect ratio image at ${res} resolution.\n`;
  }

  // Scene description
  prompt += `${scene.environment || "A neutral setting"}`;
  if (scene.time_of_day) prompt += ` during ${scene.time_of_day}`;
  prompt += ".";
  if (scene.weather) prompt += ` Weather: ${scene.weather}.`;
  if (scene.mood) prompt += ` Mood: ${scene.mood}.`;
  if (scene.focal_detail) prompt += ` Focus: ${scene.focal_detail}.`;
  if (scene.palette_override) prompt += ` Colors: ${scene.palette_override}.`;

  // Include character descriptions when toggled on
  if (includeCharacters) {
    const characterDesc = gatherCharacterDescriptions();
    if (characterDesc) {
      prompt += `\nCharacters in scene: ${characterDesc}`;
    }
  } else {
    prompt += "\nThis is a background/environment image ONLY. Do NOT include any people, characters, or humanoid figures in the image.";
  }

  // Style suffix
  prompt += "\nStyle: anime, detailed, high quality, vibrant colors.";

  return prompt;
}

/**
 * Gather character descriptions from current Lumia selections for image prompts.
 * Includes ALL characters — does not exclude any.
 * @returns {string} Combined character descriptions or empty string
 */
function gatherCharacterDescriptions() {
  try {
    const settings = getSettings();
    const descriptions = [];

    // Get selected definition(s) — handles both single and chimera/council modes
    const selectedDefs = settings.councilMode
      ? (settings.councilMembers || []).map(m => m.definition).filter(Boolean)
      : settings.chimeraMode
        ? (settings.selectedDefinitions || [])
        : settings.selectedDefinition
          ? [settings.selectedDefinition]
          : [];

    for (const sel of selectedDefs) {
      const item = getItemFromLibrary(sel.packName, sel.itemName);
      if (item) {
        const name = getLumiaField(item, "name") || "Unknown";
        const def = getLumiaField(item, "def") || "";
        if (def) {
          descriptions.push(`${name}: ${def.substring(0, 200)}`);
        }
      }
    }

    return descriptions.join(". ");
  } catch (err) {
    console.warn(`[${MODULE_NAME}] Could not gather character descriptions:`, err);
    return "";
  }
}

/**
 * Gather structured character tag descriptions for NovelAI V4 char_captions.
 * Same selection logic as gatherCharacterDescriptions but returns per-character
 * objects with danbooru-style tags and gender info.
 * @returns {Array<{name: string, tags: string, gender: string}>}
 */
function gatherCharacterTagDescriptions() {
  try {
    const settings = getSettings();
    const results = [];

    const selectedDefs = settings.councilMode
      ? (settings.councilMembers || []).map(m => m.definition).filter(Boolean)
      : settings.chimeraMode
        ? (settings.selectedDefinitions || [])
        : settings.selectedDefinition
          ? [settings.selectedDefinition]
          : [];

    for (const sel of selectedDefs) {
      const item = getItemFromLibrary(sel.packName, sel.itemName);
      if (!item) continue;

      const name = getLumiaField(item, "name") || "Unknown";
      const def = getLumiaField(item, "def") || "";
      const genderVal = getLumiaField(item, "gender") ?? GENDER.SHE_HER;

      const genderTag = genderVal === GENDER.HE_HIM ? "boy"
        : genderVal === GENDER.THEY_THEM ? "other"
        : "girl";

      // Build tag string from definition (truncated for token efficiency)
      const tags = def ? def.substring(0, 200) : name;

      results.push({ name, tags, gender: genderTag });
    }

    return results;
  } catch (err) {
    console.warn(`[${MODULE_NAME}] Could not gather character tag descriptions:`, err);
    return [];
  }
}

/**
 * Fetch an image from a URL and return it as a base64 string.
 * @param {string} url - Image URL (relative or absolute)
 * @returns {Promise<string|null>} Base64-encoded image data or null on failure
 */
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result?.split(',')[1] || null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Gather director reference images for NovelAI from manual uploads
 * and optionally from the current character/persona avatars.
 * Each image carries its own refType ("character", "style", "character&style")
 * for the director reference description system.
 * @param {Object} naiSettings - The novelai settings object
 * @returns {Promise<Array<{data: string, strength: number, infoExtracted: number, refType: string}>>}
 */
async function gatherDirectorImages(naiSettings) {
  const images = [];
  const strength = naiSettings.referenceStrength ?? 0.5;
  const infoExtracted = naiSettings.referenceInfoExtracted ?? 1;
  const manualRefType = naiSettings.referenceType || 'character&style';
  const avatarRefType = naiSettings.avatarReferenceType || 'character';

  // Manual reference uploads
  const refs = naiSettings.referenceImages || [];
  for (const ref of refs) {
    if (ref.data) {
      images.push({ data: ref.data, strength, infoExtracted, refType: manualRefType });
    }
  }

  // Character avatar
  if (naiSettings.includeCharacterAvatar) {
    try {
      const character = getCurrentCharacter();
      if (character?.avatar) {
        const avatarUrl = `/characters/${encodeURIComponent(character.avatar)}`;
        const avatarData = await fetchImageAsBase64(avatarUrl);
        if (avatarData) {
          images.push({ data: avatarData, strength, infoExtracted, refType: avatarRefType });
        }
      }
    } catch (err) {
      console.warn(`[${MODULE_NAME}] Could not fetch character avatar:`, err);
    }
  }

  // Persona avatar
  if (naiSettings.includePersonaAvatar) {
    try {
      const personaAvatarId = getCurrentPersonaAvatar();
      if (personaAvatarId) {
        const avatarUrl = `User Avatars/${personaAvatarId}`;
        const avatarData = await fetchImageAsBase64(avatarUrl);
        if (avatarData) {
          images.push({ data: avatarData, strength, infoExtracted, refType: avatarRefType });
        }
      }
    } catch (err) {
      console.warn(`[${MODULE_NAME}] Could not fetch persona avatar:`, err);
    }
  }

  return images;
}

/**
 * Upload an image to the User Files API as a raw file.
 * @param {string} chatId - Chat identifier for file naming
 * @param {string} base64Data - Base64-encoded image data
 * @param {string} mimeType - Image MIME type
 * @returns {Promise<string|null>} The accessible URL or null on failure
 */
async function uploadSceneImage(chatId, base64Data, mimeType) {
  const filename = getSceneImageFileKey(chatId);

  try {
    const response = await fetch("/api/files/upload", {
      method: "POST",
      headers: getRequestHeaders(),
      body: JSON.stringify({
        name: filename,
        data: base64Data,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    // Return the accessible URL with cache buster
    return `/user/files/${filename}?t=${Date.now()}`;
  } catch (err) {
    console.error(`[${MODULE_NAME}] Scene image upload failed:`, err);
    return null;
  }
}

/**
 * Shared background styling for crossfade layers.
 */
const BG_LAYER_CSS = `
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-size: cover; background-position: center; background-repeat: no-repeat;
  pointer-events: none;
`;

/**
 * Apply a scene image as the chat background with a true crossfade.
 * Uses two stacked layers so the new image fades in over the old one
 * with no gap or flash.
 * @param {string} imageUrl - URL of the image to apply
 * @param {number} opacity - Background opacity (0-1)
 * @param {number} fadeMs - Crossfade transition duration in ms
 */
function applyBackground(imageUrl, opacity, fadeMs) {
  const bgElement = document.querySelector("#bg_custom") || document.querySelector("#bg1");
  if (!bgElement) {
    console.warn(`[${MODULE_NAME}] No background element found`);
    return;
  }

  // Ensure the container can hold absolutely-positioned children
  if (getComputedStyle(bgElement).position === "static") {
    bgElement.style.position = "relative";
  }

  // --- Back layer: holds the current (old) image ---
  let backLayer = document.querySelector("#lumiverse-bg-back");
  if (!backLayer) {
    backLayer = document.createElement("div");
    backLayer.id = "lumiverse-bg-back";
    backLayer.style.cssText = `${BG_LAYER_CSS} z-index: 0; opacity: 1;`;
    bgElement.prepend(backLayer);
  }

  // --- Front layer: fades in the new image ---
  let frontLayer = document.querySelector("#lumiverse-bg-front");
  if (!frontLayer) {
    frontLayer = document.createElement("div");
    frontLayer.id = "lumiverse-bg-front";
    frontLayer.style.cssText = `${BG_LAYER_CSS} z-index: 1; opacity: 0;`;
    bgElement.prepend(frontLayer);
  }

  // Promote the current front image to the back layer (if any)
  if (frontLayer.style.backgroundImage && frontLayer.style.backgroundImage !== "none") {
    backLayer.style.backgroundImage = frontLayer.style.backgroundImage;
  }

  // Set the new image on the front layer, starting invisible
  frontLayer.style.transition = "none";
  frontLayer.style.opacity = "0";
  frontLayer.style.backgroundImage = `url('${imageUrl}')`;

  // Force reflow so the opacity: 0 is committed before we transition
  void frontLayer.offsetHeight;

  // Crossfade in
  frontLayer.style.transition = `opacity ${fadeMs}ms ease`;
  frontLayer.style.opacity = "1";

  // After the fade completes, promote front to back for next transition
  setTimeout(() => {
    backLayer.style.backgroundImage = `url('${imageUrl}')`;
  }, fadeMs + 50);

  // --- Opacity overlay ---
  let overlay = document.querySelector("#lumiverse-bg-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "lumiverse-bg-overlay";
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none; z-index: 2;
      transition: background-color ${fadeMs}ms ease;
    `;
    bgElement.appendChild(overlay);
  }
  overlay.style.backgroundColor = `rgba(0, 0, 0, ${1 - opacity})`;

  // Push to React store for Chat Sheld awareness
  try {
    const store = window.LumiverseUI?.getStore?.();
    if (store) {
      store.setState({ sceneBackground: imageUrl });
    }
  } catch { /* non-critical */ }
}

/**
 * Main entry point — process scene data from the council tool.
 * Called after executeAllCouncilTools completes.
 * @param {Object|string} sceneData - Scene parameters from generate_scene tool result
 * @param {Object} [options] - Processing options
 * @param {boolean} [options.force=false] - Skip scene change detection and debounce checks
 * @param {AbortSignal} [options.signal] - Optional abort signal to cancel in-flight generation
 * @returns {Promise<{success: boolean, error?: string, skipped?: boolean}>}
 */
export async function processSceneResult(sceneData, { force = false, signal } = {}) {
  const settings = getSettings().imageGeneration;
  if (!settings?.enabled) return { success: false, error: "Image generation is not enabled" };

  // Force generation also available via settings toggle (for auto-generation path)
  const skipSceneChecks = force || settings.forceGeneration === true;

  // Parse scene data if it's a JSON string
  let scene;
  try {
    scene = typeof sceneData === "string" ? JSON.parse(sceneData) : sceneData;
  } catch (err) {
    console.warn(`[${MODULE_NAME}] Could not parse scene data:`, err);
    return { success: false, error: "Could not parse scene data" };
  }

  if (!scene || !scene.environment) {
    console.warn(`[${MODULE_NAME}] Scene data missing required fields`);
    return { success: false, error: "Scene data missing required fields" };
  }

  // Get current chat ID
  const ctx = getContext();
  const chatId = getChatIdentifier(ctx);
  if (!chatId) return { success: false, error: "No active chat" };

  if (!skipSceneChecks) {
    // Check if the LLM itself flagged that the scene hasn't changed
    if (scene.scene_changed === false) {
      sceneCache.set(chatId, scene);
      return { success: false, skipped: true, error: "LLM determined the scene has not changed" };
    }

    // Check scene change threshold
    const oldScene = getLastScene(chatId);
    const threshold = settings.sceneChangeThreshold || 2;
    if (!hasSceneChanged(scene, oldScene, threshold)) {
      sceneCache.set(chatId, scene);
      return { success: false, skipped: true, error: "Scene change below threshold" };
    }
  }

  // Debounce — enforce minimum time between generations (skipped for force/manual)
  const now = Date.now();
  if (!force) {
    if (now - lastGenerationTime < GENERATION_DEBOUNCE_MS) {
      console.log(`[${MODULE_NAME}] Scene generation debounced (${GENERATION_DEBOUNCE_MS}ms minimum)`);
      sceneCache.set(chatId, scene);
      return { success: false, skipped: true, error: "Generation debounced — try again shortly" };
    }
  }

  // Signal generating state to React
  try {
    const store = window.LumiverseUI?.getStore?.();
    if (store) {
      store.setState({ sceneGenerating: true, lastSceneParams: scene });
    }
  } catch { /* non-critical */ }

  try {
    lastGenerationTime = now;

    // Build prompt
    const provider = settings.provider || "google_gemini";
    const includeCharacters = settings.includeCharacters || false;
    const prompt = buildImagePrompt(scene, provider, includeCharacters);

    // Get provider-specific settings and build config
    const providerSettingsKey = provider === "nanogpt" ? "nanogpt" : provider === "novelai" ? "novelai" : "google";
    const providerSettings = settings[providerSettingsKey] || {};
    const referenceImages = (providerSettings.referenceImages || [])
      .filter(ref => ref.data)
      .map(ref => ({ data: ref.data, mimeType: ref.mimeType || "image/png" }));

    let config;
    if (provider === "novelai") {
      const naiSettings = settings.novelai || {};
      const directorImages = await gatherDirectorImages(naiSettings);
      config = {
        model: naiSettings.model || "nai-diffusion-4-5-full",
        resolution: naiSettings.resolution || "1216x832",
        sampler: naiSettings.sampler || "k_euler_ancestral",
        steps: naiSettings.steps ?? 28,
        guidance: naiSettings.guidance ?? 5,
        negativePrompt: naiSettings.negativePrompt || "lowres, artistic error, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, blurry, bad anatomy, bad hands, missing fingers, extra digits, fewer digits, text, watermark, username, logo, signature, dithering, halftone, screentone, scan artifacts, multiple views, blank page",
        smea: naiSettings.smea ?? false,
        smeaDyn: naiSettings.smeaDyn ?? false,
        seed: naiSettings.seed ?? null,
        directorImages,
        referenceFidelity: naiSettings.referenceFidelity ?? 1.0,
        characterTags: includeCharacters ? gatherCharacterTagDescriptions() : [],
      };
    } else if (provider === "nanogpt") {
      config = {
        model: providerSettings.model || "hidream",
        size: providerSettings.size || "1024x1024",
      };
    } else {
      config = {
        model: providerSettings.model || "gemini-3.1-flash-image",
        aspectRatio: providerSettings.aspectRatio || "16:9",
        imageSize: providerSettings.imageSize || "1K",
      };
    }

    // Check abort before starting the expensive image generation call
    if (signal?.aborted) return { success: false, error: "Generation cancelled" };

    const result = await generateImage(provider, prompt, config, settings, referenceImages.length > 0 ? referenceImages : undefined, signal);

    if (!result.success) {
      if (signal?.aborted) return { success: false, error: "Generation cancelled" };
      console.error(`[${MODULE_NAME}] Image generation failed:`, result.error);
      return { success: false, error: result.error };
    }

    // Upload image to User Files
    const imageUrl = await uploadSceneImage(chatId, result.imageData, result.mimeType);
    if (!imageUrl) return { success: false, error: "Failed to upload scene image" };

    // Apply as background
    const opacity = settings.backgroundOpacity ?? 0.35;
    const fadeMs = settings.fadeTransitionMs ?? 800;
    applyBackground(imageUrl, opacity, fadeMs);

    // Cache scene params
    sceneCache.set(chatId, scene);

    console.log(`[${MODULE_NAME}] Scene background applied for chat ${chatId}`);
    return { success: true };
  } catch (err) {
    console.error(`[${MODULE_NAME}] Scene image processing failed:`, err);
    return { success: false, error: err.message || "Scene image processing failed" };
  } finally {
    try {
      const store = window.LumiverseUI?.getStore?.();
      if (store) {
        store.setState({ sceneGenerating: false });
      }
    } catch { /* non-critical */ }
  }
}

/**
 * Restore the scene background when switching back to a chat.
 * Loads the previously saved scene image from User Files.
 * @param {string} [chatId] - Chat identifier, resolved from context if omitted
 */
export async function applySceneBackground(chatId) {
  const settings = getSettings().imageGeneration;
  if (!settings?.enabled) return;

  const ctx = getContext();
  const resolvedChatId = chatId || getChatIdentifier(ctx);
  if (!resolvedChatId) return;

  const filename = getSceneImageFileKey(resolvedChatId);
  const imageUrl = `/user/files/${filename}?t=${Date.now()}`;

  // Check if the file exists by doing a HEAD request
  try {
    const response = await fetch(imageUrl, { method: "HEAD" });
    if (!response.ok) {
      clearSceneBackground();
      return;
    }

    const opacity = settings.backgroundOpacity ?? 0.35;
    const fadeMs = settings.fadeTransitionMs ?? 800;
    applyBackground(imageUrl, opacity, fadeMs);
  } catch {
    clearSceneBackground();
  }
}

/**
 * Remove the scene background visuals (DOM layers + store state).
 * This is the internal cleanup — does NOT delete the file from storage.
 */
function clearSceneBackgroundVisuals() {
  // Remove all three crossfade layers injected by applyBackground()
  const backLayer = document.querySelector("#lumiverse-bg-back");
  if (backLayer) backLayer.remove();

  const frontLayer = document.querySelector("#lumiverse-bg-front");
  if (frontLayer) frontLayer.remove();

  const overlay = document.querySelector("#lumiverse-bg-overlay");
  if (overlay) overlay.remove();

  try {
    const store = window.LumiverseUI?.getStore?.();
    if (store) {
      store.setState({ sceneBackground: null });
    }
  } catch { /* non-critical */ }
}

/**
 * Remove the scene background.
 * When called with deleteFile=true (user-initiated clear), deletes the image
 * from the User Files API first, then clears the DOM/store reference.
 * @param {boolean} [deleteFile=false] - Whether to delete the stored image file
 */
export async function clearSceneBackground(deleteFile = false) {
  if (deleteFile) {
    try {
      const ctx = getContext();
      const chatId = getChatIdentifier(ctx);
      if (chatId) {
        const filename = getSceneImageFileKey(chatId);
        await fetch("/api/files/delete", {
          method: "POST",
          headers: getRequestHeaders(),
          body: JSON.stringify({ path: `user/files/${filename}` }),
        });
      }
    } catch (err) {
      console.warn(`[${MODULE_NAME}] Failed to delete scene image file:`, err);
    }
  }

  clearSceneBackgroundVisuals();
}

/**
 * Generate a scene image manually (triggered from UI).
 * Executes the generate_scene council tool to get LLM scene analysis,
 * then processes the result through the image generation pipeline.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function generateManually() {
  const settings = getSettings().imageGeneration;
  if (!settings?.enabled) {
    return { success: false, error: "Image generation is not enabled" };
  }

  const ctx = getContext();
  const chatId = getChatIdentifier(ctx);
  if (!chatId) {
    return { success: false, error: "No active chat" };
  }

  // Create a fresh abort controller for this generation pipeline
  imageGenAbortController = new AbortController();
  const signal = imageGenAbortController.signal;

  // Signal generating state immediately so the UI shows the spinner
  // during the tool execution phase (before processSceneResult is reached)
  try {
    const store = window.LumiverseUI?.getStore?.();
    if (store) store.setState({ sceneGenerating: true });
  } catch { /* non-critical */ }

  try {
    // Execute the generate_scene tool via the council tools LLM
    const toolResult = await executeSingleTool('generate_scene', signal);
    if (signal.aborted) return { success: false, error: "Generation cancelled" };
    if (!toolResult.success) {
      return { success: false, error: toolResult.error || "Scene analysis failed" };
    }

    // Use the raw structured input (JSON object) from the tool call,
    // falling back to the named result raw store
    const sceneData = toolResult.rawInput || getNamedResultRaw('scene_data');
    if (!sceneData) {
      return { success: false, error: "No scene data returned from tool" };
    }

    try {
      const result = await processSceneResult(sceneData, { force: true, signal });
      return result || { success: false, error: "No result from scene processing" };
    } catch (err) {
      if (signal.aborted) return { success: false, error: "Generation cancelled" };
      return { success: false, error: err.message };
    }
  } finally {
    imageGenAbortController = null;
    // Always reset generating state — covers tool failure, early returns,
    // and the case where processSceneResult already reset it
    try {
      const store = window.LumiverseUI?.getStore?.();
      if (store) store.setState({ sceneGenerating: false });
    } catch { /* non-critical */ }
  }
}

/**
 * Abort the current image generation pipeline.
 * Cancels both the LLM scene analysis and the provider image API call,
 * and immediately resets the UI generating state so the button unblocks.
 * Safe to call at any time — no-ops if nothing is in flight.
 */
export function abortImageGeneration() {
  // Abort our own pipeline signal
  if (imageGenAbortController) {
    imageGenAbortController.abort();
    imageGenAbortController = null;
  }

  // Also abort the council tool execution controller (covers the LLM fetch phase)
  abortToolExecution();

  // Immediately clear the generating state so the UI unblocks —
  // don't wait for the promise chain's finally block which may be delayed.
  try {
    const store = window.LumiverseUI?.getStore?.();
    if (store) store.setState({ sceneGenerating: false });
  } catch { /* non-critical */ }
}

/**
 * Get a stable chat identifier from the context.
 * @param {Object} ctx - SillyTavern context
 * @returns {string|null}
 */
function getChatIdentifier(ctx) {
  if (!ctx) return null;
  // Use chat file name, group ID, or character ID as fallback
  const chatMetadata = ctx.chatMetadata;
  if (chatMetadata?.chat_file_name) return chatMetadata.chat_file_name;
  if (ctx.groupId) return `group_${ctx.groupId}`;
  if (ctx.characterId !== undefined) return `char_${ctx.characterId}`;
  return null;
}
