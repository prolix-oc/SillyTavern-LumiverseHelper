/**
 * Image Generation Providers
 *
 * Provider abstraction for image generation APIs.
 * Supports Google Gemini and Nano-GPT via direct REST API calls.
 */

import { decodeMulti } from '@msgpack/msgpack';
import { MODULE_NAME } from "./settingsManager.js";
import { fetchSecretKey } from "./summarization.js";
import { getRequestHeaders } from "../stContext.js";
import { decryptValue } from "./cryptoUtils.js";
import { loadProfileSync } from "./connectionService.js";

// Provider configuration constants
export const IMAGEGEN_PROVIDERS = {
  google_gemini: {
    name: "Google Gemini",
    models: [
      { id: "gemini-3.1-flash-image", label: "Nano Banana 2 (Flash)" },
      { id: "gemini-3-pro-image-preview", label: "Nano Banana Pro" },
    ],
    aspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    resolutions: ["1K", "2K", "4K"],
    promptStyle: "natural_language",
    secretKey: "api_key_makersuite",
  },
  nanogpt: {
    name: "Nano-GPT",
    models: [
      { id: "hidream", label: "HiDream" },
      { id: "hidream_fast", label: "HiDream Fast" },
      { id: "hidream_dev", label: "HiDream Dev" },
      { id: "hidream_full", label: "HiDream Full" },
      { id: "flux-pro", label: "Flux Pro" },
      { id: "flux_pro_ultra", label: "Flux Pro Ultra" },
      { id: "flux-kontext", label: "Flux Kontext" },
      { id: "flux_schnell", label: "Flux Schnell" },
      { id: "dall-e-3", label: "DALL-E 3" },
      { id: "gpt_image_1", label: "GPT Image 1" },
      { id: "imagen4_preview", label: "Imagen 4 Preview" },
      { id: "midjourney", label: "Midjourney" },
      { id: "recraft", label: "Recraft" },
      { id: "sdxl", label: "SDXL" },
      { id: "sd35_large", label: "SD 3.5 Large" },
      { id: "reve-v1", label: "Reve v1" },
    ],
    sizes: ["256x256", "512x512", "1024x1024"],
    promptStyle: "natural_language",
  },
  novelai: {
    name: "NovelAI",
    models: [
      { id: "nai-diffusion-4-5-full", label: "NAI Diffusion V4.5 (Full)" },
      { id: "nai-diffusion-4-5-curated", label: "NAI Diffusion V4.5 (Curated)" },
      { id: "nai-diffusion-4-full", label: "NAI Diffusion V4 (Full)" },
      { id: "nai-diffusion-4-curated-preview", label: "NAI Diffusion V4 (Curated)" },
      { id: "nai-diffusion-3", label: "NAI Diffusion Anime V3" },
      { id: "nai-diffusion-furry-3", label: "NAI Diffusion Furry V3" },
    ],
    samplers: [
      { id: "k_euler_ancestral", label: "Euler Ancestral" },
      { id: "k_euler", label: "Euler" },
      { id: "k_dpmpp_2m", label: "DPM++ 2M" },
      { id: "k_dpmpp_2s_ancestral", label: "DPM++ 2S Ancestral" },
      { id: "k_dpmpp_sde", label: "DPM++ SDE" },
      { id: "ddim_v3", label: "DDIM" },
    ],
    resolutions: [
      { id: "832x1216", label: "832x1216 (Portrait)" },
      { id: "1216x832", label: "1216x832 (Landscape)" },
      { id: "1024x1024", label: "1024x1024 (Square)" },
      { id: "512x768", label: "512x768 (Small Portrait)" },
      { id: "768x512", label: "768x512 (Small Landscape)" },
      { id: "640x640", label: "640x640 (Small Square)" },
      { id: "1024x1536", label: "1024x1536 (Large Portrait)" },
      { id: "1536x1024", label: "1536x1024 (Large Landscape)" },
      { id: "1088x1920", label: "1088x1920 (Wallpaper Portrait)" },
      { id: "1920x1088", label: "1920x1088 (Wallpaper Landscape)" },
    ],
    promptStyle: "tags",
  },
};

/**
 * Get provider configuration by name.
 * @param {string} providerName - The provider key (e.g., "google_gemini")
 * @returns {Object|null} Provider config object or null
 */
export function getProviderConfig(providerName) {
  return IMAGEGEN_PROVIDERS[providerName] || null;
}

/**
 * Resolve the API key and endpoint for Google Gemini based on user settings.
 * Supports ST secret key or connection profile (which provides its own key + optional endpoint).
 * @param {Object} settings - The imageGeneration settings object
 * @param {string} model - The model ID to use for endpoint construction
 * @returns {Promise<{apiKey: string|null, endpoint: string}>}
 */
async function resolveGeminiProvider(settings, model) {
  const defaultEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  if (settings.provider !== "google_gemini") {
    return { apiKey: null, endpoint: defaultEndpoint };
  }

  const googleSettings = settings.google || {};

  // Connection profile mode — use the profile's API key and optional endpoint
  if (googleSettings.apiKeyMode === "profile" && googleSettings.connectionProfileId) {
    const profile = loadProfileSync(googleSettings.connectionProfileId);
    if (profile) {
      let apiKey;
      if (profile.secretMode === "own" && profile.apiKey) {
        apiKey = decryptValue(profile.apiKey);
      } else {
        apiKey = await fetchSecretKey(IMAGEGEN_PROVIDERS.google_gemini.secretKey);
      }

      // If profile has a custom endpoint, use it as the base URL
      let endpoint = defaultEndpoint;
      if (profile.endpointUrl) {
        // Strip trailing slash, append model path
        const base = profile.endpointUrl.replace(/\/+$/, '');
        endpoint = `${base}/models/${model}:generateContent`;
      }

      return { apiKey, endpoint };
    }
  }

  // Default: ST's stored Makersuite key with standard endpoint
  const apiKey = await fetchSecretKey(IMAGEGEN_PROVIDERS.google_gemini.secretKey);
  return { apiKey, endpoint: defaultEndpoint };
}

/**
 * Generate an image using Google Gemini's REST API.
 * Uses direct fetch() to the generativelanguage.googleapis.com endpoint.
 *
 * @param {string} prompt - The text prompt for image generation
 * @param {Object} config - Generation configuration
 * @param {string} config.model - Model ID (e.g., "gemini-3.1-flash-image")
 * @param {string} config.aspectRatio - Aspect ratio (e.g., "16:9")
 * @param {string} config.imageSize - Resolution string (e.g., "1K", "2K", "4K")
 * @param {Object} settings - The full imageGeneration settings object (for API key resolution)
 * @param {Array<{data: string, mimeType: string}>} [referenceImages] - Optional reference images as base64
 * @returns {Promise<{success: boolean, imageData?: string, mimeType?: string, text?: string, error?: string}>}
 */
export async function generateImageGemini(prompt, config, settings, referenceImages) {
  const model = config.model || "gemini-3.1-flash-image";
  const { apiKey, endpoint } = await resolveGeminiProvider(settings, model);
  if (!apiKey) {
    return { success: false, error: "No Google AI API key configured. Set one in SillyTavern or select a connection profile." };
  }

  // Build the content parts array
  const parts = [];

  // Add reference images first if provided
  if (referenceImages && referenceImages.length > 0) {
    for (const ref of referenceImages) {
      parts.push({
        inlineData: {
          mimeType: ref.mimeType || "image/png",
          data: ref.data,
        },
      });
    }
  }

  // Add the text prompt
  parts.push({ text: prompt });

  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      temperature: 1,
      topP: 0.95,
    },
  };

  // Add image generation config if aspect ratio is specified
  if (config.aspectRatio) {
    requestBody.generationConfig.imageGenerationConfig = {
      aspectRatio: config.aspectRatio,
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[${MODULE_NAME}] Gemini image generation failed:`, response.status, errorText);
      return { success: false, error: `Gemini API error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate?.content?.parts) {
      return { success: false, error: "No content in Gemini response" };
    }

    // Extract image and text from response parts
    let imageData = null;
    let mimeType = null;
    let textResponse = "";

    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        imageData = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
      }
      if (part.text) {
        textResponse += part.text;
      }
    }

    if (!imageData) {
      return { success: false, error: textResponse || "Gemini returned no image data" };
    }

    return { success: true, imageData, mimeType, text: textResponse };
  } catch (error) {
    console.error(`[${MODULE_NAME}] Gemini image generation error:`, error);
    return { success: false, error: error.message || "Network error during image generation" };
  }
}

/**
 * Generate an image using Nano-GPT's OpenAI-compatible REST API.
 *
 * @param {string} prompt - The text prompt for image generation
 * @param {Object} config - Generation configuration
 * @param {string} config.model - Model ID (e.g., "hidream")
 * @param {string} config.size - Image size (e.g., "1024x1024")
 * @param {Object} settings - The full imageGeneration settings object
 * @param {Array<{data: string, mimeType: string}>} [referenceImages] - Optional reference images as base64
 * @returns {Promise<{success: boolean, imageData?: string, mimeType?: string, error?: string}>}
 */
export async function generateImageNanoGpt(prompt, config, settings, referenceImages) {
  const nanoSettings = settings.nanogpt || {};
  const apiKey = nanoSettings.apiKey;
  if (!apiKey) {
    return { success: false, error: "No Nano-GPT API key configured. Enter your key in the Nano-GPT settings." };
  }

  const model = config.model || "hidream";
  const size = config.size || "1024x1024";

  const requestBody = {
    model,
    prompt,
    n: 1,
    size,
    response_format: "b64_json",
  };

  // Add reference images as data URLs if provided
  if (referenceImages && referenceImages.length > 0) {
    requestBody.imageDataUrls = referenceImages.map(
      ref => `data:${ref.mimeType || "image/png"};base64,${ref.data}`
    );

    // Include image-to-image parameters when reference images are present
    if (nanoSettings.strength != null) {
      requestBody.strength = nanoSettings.strength;
    }
    if (nanoSettings.guidanceScale != null) {
      requestBody.guidance_scale = nanoSettings.guidanceScale;
    }
    if (nanoSettings.numInferenceSteps != null) {
      requestBody.num_inference_steps = nanoSettings.numInferenceSteps;
    }
    if (nanoSettings.seed != null) {
      requestBody.seed = nanoSettings.seed;
    }
  }

  try {
    const response = await fetch("https://nano-gpt.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[${MODULE_NAME}] Nano-GPT image generation failed:`, response.status, errorText);
      return { success: false, error: `Nano-GPT API error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const imageEntry = data.data?.[0];
    if (!imageEntry?.b64_json) {
      return { success: false, error: "Nano-GPT returned no image data" };
    }

    return { success: true, imageData: imageEntry.b64_json, mimeType: "image/png" };
  } catch (error) {
    console.error(`[${MODULE_NAME}] Nano-GPT image generation error:`, error);
    return { success: false, error: error.message || "Network error during image generation" };
  }
}

/**
 * Check whether a model ID is a V4+ model (requires v4_prompt structure).
 * @param {string} model
 * @returns {boolean}
 */
function isNovelAIV4Model(model) {
  return model.startsWith("nai-diffusion-4");
}

/**
 * Extract the first PNG image from a binary buffer by scanning for PNG
 * signature bytes. The NovelAI streaming endpoint returns msgpack-encoded
 * binary data that embeds raw PNG bytes.
 *
 * PNG signature: 89 50 4E 47 0D 0A 1A 0A
 * PNG end (IEND chunk type + CRC): 49 45 4E 44 AE 42 60 82
 *
 * @param {ArrayBuffer} buffer - Raw response buffer
 * @returns {Uint8Array|null} PNG bytes or null if not found
 */
function extractPngFromBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  const PNG_SIG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  const IEND_CRC = [0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82];

  // Find PNG header
  let start = -1;
  for (let i = 0; i <= bytes.length - 8; i++) {
    if (PNG_SIG.every((b, j) => bytes[i + j] === b)) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  // Find IEND chunk type + CRC (last 8 bytes of any valid PNG)
  let end = -1;
  for (let i = start + 8; i <= bytes.length - 8; i++) {
    if (IEND_CRC.every((b, j) => bytes[i + j] === b)) {
      end = i + 8; // include the IEND type + CRC bytes
      break;
    }
  }
  if (end === -1) return null;

  return bytes.slice(start, end);
}

/**
 * Find the first occurrence of a byte sequence in a Uint8Array.
 * @param {Uint8Array} haystack
 * @param {number[]} needle - Byte sequence to find
 * @returns {number} Index of first match, or -1
 */
function findBytes(haystack, needle) {
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    if (needle.every((b, j) => haystack[i + j] === b)) return i;
  }
  return -1;
}

/**
 * Convert a Uint8Array to a base64 string.
 * Uses chunked btoa to avoid call-stack limits on large buffers.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function uint8ToBase64(bytes) {
  const CHUNK = 0x8000;
  const parts = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(""));
}

// Accepted canvas sizes for NovelAI director reference images.
// The API rejects images that aren't one of these dimensions.
const DIRECTOR_REF_CANVASES = [
  [1024, 1536], // portrait
  [1536, 1024], // landscape
  [1472, 1472], // square
];

/**
 * Resize and letterbox-pad a base64 image to one of the accepted director
 * reference canvas sizes. Picks the canvas whose aspect ratio is closest
 * to the source image, then fits the image inside with black padding.
 *
 * @param {string} base64Data - Raw base64 PNG/JPEG image data
 * @returns {Promise<string>} Base64-encoded PNG at an accepted canvas size
 */
function padDirectorRefImage(base64Data) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Pick the best canvas based on aspect ratio proximity
      const srcAr = img.width / img.height;
      let best = DIRECTOR_REF_CANVASES[0];
      let bestDiff = Infinity;
      for (const [cw, ch] of DIRECTOR_REF_CANVASES) {
        const diff = Math.abs(srcAr - cw / ch);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = [cw, ch];
        }
      }
      const [canvasW, canvasH] = best;

      // Fit image within canvas preserving aspect ratio
      const scale = Math.min(canvasW / img.width, canvasH / img.height);
      const drawW = Math.round(img.width * scale);
      const drawH = Math.round(img.height * scale);
      const offsetX = Math.round((canvasW - drawW) / 2);
      const offsetY = Math.round((canvasH - drawH) / 2);

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');

      // Black background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Draw centered
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

      // Extract base64 PNG (strip data URI prefix)
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = () => reject(new Error('Failed to load director reference image'));
    img.src = `data:image/png;base64,${base64Data}`;
  });
}

/**
 * Generate an image using NovelAI's streaming diffusion API.
 * Uses the generate-image-stream endpoint with msgpack response format.
 * Builds V4 prompt structures for V4/V4.5 models, simpler payload for V3.
 *
 * @param {string} prompt - Tag-based prompt for image generation
 * @param {Object} config - Generation configuration
 * @param {Object} settings - The full imageGeneration settings object
 * @returns {Promise<{success: boolean, imageData?: string, mimeType?: string, error?: string}>}
 */
export async function generateImageNovelAI(prompt, config, settings) {
  const naiSettings = settings.novelai || {};
  const apiKey = naiSettings.apiKey;
  if (!apiKey) {
    return { success: false, error: "No NovelAI API key configured. Enter your Persistent API Token in the NovelAI settings." };
  }

  const model = config.model || "nai-diffusion-4-5-full";
  const [width, height] = (config.resolution || "1216x832").split("x").map(Number);
  const negativePrompt = config.negativePrompt || "lowres, bad anatomy, blurry, text, watermark";
  const seed = config.seed ?? Math.floor(Math.random() * 2147483647);
  const isV4 = isNovelAIV4Model(model);

  const parameters = {
    params_version: 3,
    width,
    height,
    scale: config.guidance ?? 5,
    sampler: config.sampler || "k_euler_ancestral",
    steps: config.steps ?? 28,
    n_samples: 1,
    seed,
    ucPreset: 0,
    qualityToggle: true,
    dynamic_thresholding: false,
    controlnet_strength: 1,
    legacy: false,
    add_original_image: true,
    cfg_rescale: 0,
    noise_schedule: "karras",
    legacy_v3_extend: false,
    skip_cfg_above_sigma: null,
    use_coords: false,
    legacy_uc: false,
    normalize_reference_strength_multiple: true,
    inpaintImg2ImgStrength: 1,
    negative_prompt: negativePrompt,
    deliberate_euler_ancestral_bug: false,
    prefer_brownian: true,
    image_format: "png",
    stream: "msgpack",
  };

  if (isV4) {
    // V4/V4.5 models use autoSmea and require v4_prompt/v4_negative_prompt
    parameters.autoSmea = config.smea ?? false;

    const charTags = config.characterTags || [];
    parameters.characterPrompts = charTags.map(char => ({
      prompt: char.tags,
      uc: negativePrompt,
      center: { x: 0, y: 0 },
      enabled: true,
    }));
    parameters.v4_prompt = {
      caption: {
        base_caption: prompt,
        char_captions: charTags.map(char => ({
          char_caption: char.tags,
          centers: [{ x: 0, y: 0 }],
        })),
      },
      use_coords: false,
      use_order: true,
    };
    parameters.v4_negative_prompt = {
      caption: {
        base_caption: negativePrompt,
        char_captions: charTags.map(() => ({
          char_caption: negativePrompt,
          centers: [{ x: 0, y: 0 }],
        })),
      },
      legacy_uc: false,
    };
  } else {
    // V3 models use sm/sm_dyn
    parameters.sm = config.smea ?? false;
    parameters.sm_dyn = config.smeaDyn ?? false;
  }

  // Director references — raw base64 images resized/padded to accepted canvas sizes
  if (config.directorImages && config.directorImages.length > 0) {
    const fidelity = config.referenceFidelity ?? 1.0;

    console.log(`[${MODULE_NAME}] Preprocessing ${config.directorImages.length} director reference(s)...`);
    const paddedImages = [];
    for (const ref of config.directorImages) {
      try {
        const padded = await padDirectorRefImage(ref.data);
        paddedImages.push(padded);
      } catch (err) {
        console.warn(`[${MODULE_NAME}] Skipping director ref — preprocessing failed:`, err);
        paddedImages.push(ref.data); // fallback to raw if padding fails
      }
    }

    parameters.director_reference_images = paddedImages;
    parameters.director_reference_strength_values = config.directorImages.map(r => r.strength ?? 0.5);
    parameters.director_reference_secondary_strength_values = config.directorImages.map(() => 1 - fidelity);
    parameters.director_reference_information_extracted = config.directorImages.map(() => 1.0);
    parameters.director_reference_descriptions = config.directorImages.map(r => ({
      caption: {
        base_caption: r.refType || 'character&style',
        char_captions: [],
      },
      legacy_uc: false,
    }));

    console.log(`[${MODULE_NAME}] Director refs (${config.directorImages.length}):`, config.directorImages.map(r => ({
      type: r.refType, strength: r.strength, fidelity,
    })));
  }

  const requestBody = {
    input: prompt,
    model,
    action: "generate",
    parameters,
  };

  console.log(`[${MODULE_NAME}] NovelAI request:`, {
    model, width, height, steps: parameters.steps, sampler: parameters.sampler,
    hasRefImages: !!(parameters.reference_image || parameters.reference_image_multiple),
    refCount: parameters.reference_image_multiple?.length ?? (parameters.reference_image ? 1 : 0),
  });

  try {
    const response = await fetch("https://image.novelai.net/ai/generate-image-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[${MODULE_NAME}] NovelAI image generation failed:`, response.status, errorText);
      return { success: false, error: `NovelAI API error ${response.status}: ${errorText}` };
    }

    // Log response headers for diagnostics
    const contentType = response.headers.get("Content-Type");
    const contentLength = response.headers.get("Content-Length");
    const transferEncoding = response.headers.get("Transfer-Encoding");
    console.log(`[${MODULE_NAME}] NovelAI response headers — Content-Type: ${contentType}, Content-Length: ${contentLength}, Transfer-Encoding: ${transferEncoding}`);

    // Manually read the full stream, accumulating ALL chunks.
    // NovelAI's streaming endpoint sends binary data in chunks —
    // we must read every chunk until the connection truly closes.
    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length > 0) {
        chunks.push(value);
        totalBytes += value.length;
        console.log(`[${MODULE_NAME}] Stream chunk #${chunks.length}: ${value.length}B (total: ${totalBytes}B)`);
      }
    }

    console.log(`[${MODULE_NAME}] Stream complete: ${chunks.length} chunks, ${totalBytes} bytes`);

    if (totalBytes < 1000) {
      return { success: false, error: `NovelAI response too small (${totalBytes} bytes) — generation may have failed` };
    }

    // Concatenate all chunks into a single buffer
    const fullBuffer = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      fullBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Log the first 32 bytes as hex for format identification
    const headerHex = Array.from(fullBuffer.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`[${MODULE_NAME}] Response starts with: ${headerHex}`);

    // Strategy 1: Direct PNG scan on the raw buffer — skip msgpack entirely.
    // The stream likely contains raw PNG bytes embedded in a thin wrapper.
    let imageBytes = extractPngFromBuffer(fullBuffer.buffer);
    if (imageBytes) {
      console.log(`[${MODULE_NAME}] PNG scan: found ${imageBytes.length} byte image`);
      const imageData = uint8ToBase64(imageBytes);
      return { success: true, imageData, mimeType: "image/png" };
    }

    // Strategy 2: Look for ZIP (PK header) containing the PNG
    const pkIndex = findBytes(fullBuffer, [0x50, 0x4B, 0x03, 0x04]);
    if (pkIndex !== -1) {
      console.log(`[${MODULE_NAME}] ZIP detected at offset ${pkIndex} — scanning inside for PNG...`);
      const zipSlice = fullBuffer.slice(pkIndex);
      imageBytes = extractPngFromBuffer(zipSlice.buffer);
      if (imageBytes) {
        console.log(`[${MODULE_NAME}] PNG extracted from ZIP: ${imageBytes.length} bytes`);
        const imageData = uint8ToBase64(imageBytes);
        return { success: true, imageData, mimeType: "image/png" };
      }
    }

    // Strategy 3: Try msgpack decode as last resort
    console.log(`[${MODULE_NAME}] No raw PNG/ZIP found — trying msgpack decode...`);
    let largestBinary = null;
    let largestSize = 0;
    try {
      for (const obj of decodeMulti(fullBuffer)) {
        if (obj instanceof Uint8Array && obj.length > largestSize) {
          largestSize = obj.length;
          largestBinary = obj;
          console.log(`[${MODULE_NAME}] msgpack: binary ${obj.length}B`);
        } else if (obj && typeof obj === 'object' && !(obj instanceof Uint8Array)) {
          for (const [key, val] of Object.entries(obj)) {
            if (val instanceof Uint8Array && val.length > largestSize) {
              largestSize = val.length;
              largestBinary = val;
              console.log(`[${MODULE_NAME}] msgpack key "${key}": binary ${val.length}B`);
            }
          }
        }
      }
    } catch (decodeErr) {
      console.warn(`[${MODULE_NAME}] msgpack decode error:`, decodeErr.message);
    }

    if (largestBinary) {
      // Check if the decoded blob is a PNG
      if (largestBinary[0] === 0x89 && largestBinary[1] === 0x50) {
        console.log(`[${MODULE_NAME}] msgpack yielded PNG: ${largestBinary.length} bytes`);
        return { success: true, imageData: uint8ToBase64(largestBinary), mimeType: "image/png" };
      }
      // Check if it's a ZIP containing a PNG
      if (largestBinary[0] === 0x50 && largestBinary[1] === 0x4B) {
        const innerPng = extractPngFromBuffer(largestBinary.buffer.slice(largestBinary.byteOffset, largestBinary.byteOffset + largestBinary.byteLength));
        if (innerPng) {
          console.log(`[${MODULE_NAME}] msgpack yielded ZIP→PNG: ${innerPng.length} bytes`);
          return { success: true, imageData: uint8ToBase64(innerPng), mimeType: "image/png" };
        }
      }
      // Last resort: just use the largest binary blob as-is
      console.log(`[${MODULE_NAME}] Using largest msgpack binary as image: ${largestBinary.length} bytes`);
      return { success: true, imageData: uint8ToBase64(largestBinary), mimeType: "image/png" };
    }

    return { success: false, error: `Could not extract image from ${totalBytes} byte NovelAI response` };
  } catch (error) {
    console.error(`[${MODULE_NAME}] NovelAI image generation error:`, error);
    return { success: false, error: error.message || "Network error during image generation" };
  }
}

/**
 * Route image generation to the correct provider function.
 *
 * @param {string} provider - Provider key (e.g., "google_gemini", "nanogpt", "novelai")
 * @param {string} prompt - The text prompt
 * @param {Object} config - Provider-specific generation config
 * @param {Object} settings - The full imageGeneration settings object
 * @param {Array<{data: string, mimeType: string}>} [referenceImages] - Optional reference images
 * @returns {Promise<{success: boolean, imageData?: string, mimeType?: string, text?: string, error?: string}>}
 */
export async function generateImage(provider, prompt, config, settings, referenceImages) {
  switch (provider) {
    case "google_gemini":
      return generateImageGemini(prompt, config, settings, referenceImages);
    case "nanogpt":
      return generateImageNanoGpt(prompt, config, settings, referenceImages);
    case "novelai":
      return generateImageNovelAI(prompt, config, settings);
    default:
      return { success: false, error: `Unknown image generation provider: ${provider}` };
  }
}

/**
 * Fetch available image models from Nano-GPT's API.
 * @param {string} apiKey - Nano-GPT API key
 * @returns {Promise<{success: boolean, models?: Array<{id: string, label: string}>, error?: string}>}
 */
export async function fetchNanoGptModels(apiKey) {
  if (!apiKey) {
    return { success: false, error: "No API key provided" };
  }

  try {
    const response = await fetch("https://nano-gpt.com/api/v1/image-models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return { success: false, error: `Nano-GPT API error ${response.status}: ${errorText}` };
    }

    const data = await response.json();

    // Normalize response — API may return an array or { data: [...] }
    const modelList = Array.isArray(data) ? data : (data.data || data.models || []);
    const models = modelList.map(m => ({
      id: m.id || m.model || m,
      label: m.name || m.label || m.id || m.model || String(m),
    }));

    return { success: true, models };
  } catch (error) {
    console.error(`[${MODULE_NAME}] Nano-GPT model fetch error:`, error);
    return { success: false, error: error.message || "Network error fetching models" };
  }
}
