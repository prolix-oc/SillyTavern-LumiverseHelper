/**
 * RAF Batch Rendering Module
 * Implements requestAnimationFrame-based batch rendering for optimized DOM updates
 * Based on SimTracker's RAF batch rendering strategy
 */

import { MODULE_NAME } from "./settingsManager.js";

// --- STATE ---

/** @type {Map<string, {mesId: number, force: boolean}>} Pending OOC update queue keyed by mesId */
const pendingOOCUpdates = new Map();

/** @type {number|null} Current RAF request ID */
let rafId = null;

/** @type {number|null} Current debounce timer ID */
let debounceTimer = null;

/** @type {boolean} Whether streaming/generation is in progress */
let isStreamingActive = false;

/** @type {boolean} Whether the first render after an event is pending (should be immediate) */
let isFirstRenderPending = true;

/** @type {boolean} Whether a full chat reprocess is pending */
let pendingFullReprocess = false;

/** @type {boolean} Whether to clear existing OOC boxes on full reprocess */
let pendingClearExisting = false;

// --- CONFIGURATION ---

/** Debounce delay during streaming (ms) */
const STREAMING_DEBOUNCE_MS = 100;

/** Minimum time between RAF flushes during streaming (ms) */
const MIN_FLUSH_INTERVAL_MS = 50;

/** Chunk size for batch processing - messages per chunk before yielding */
export const OOC_PROCESSING_CHUNK_SIZE = 15;

/** Whether chunked processing is currently active */
let isChunkedProcessingActive = false;

/** @type {number} Last flush timestamp */
let lastFlushTime = 0;

// --- CALLBACKS ---

/** @type {Function|null} Callback to process a single message's OOC comments */
let processOOCCallback = null;

/** @type {Function|null} Callback to process all OOC comments in chat */
let processAllOOCCallback = null;

/**
 * Set the callback functions for OOC processing
 * @param {Function} processSingle - Function to process single message OOC: (mesId, force) => void
 * @param {Function} processAll - Function to process all OOC: (clearExisting) => void
 */
export function setOOCProcessingCallbacks(processSingle, processAll) {
  processOOCCallback = processSingle;
  processAllOOCCallback = processAll;
}

// --- STREAMING STATE ---

/**
 * Set the streaming state (affects debouncing behavior)
 * @param {boolean} isStreaming - Whether streaming/generation is active
 */
export function setStreamingState(isStreaming) {
  const wasStreaming = isStreamingActive;
  isStreamingActive = isStreaming;

  // Reset first-render flag when streaming starts
  // This ensures the first update gets immediate rendering
  if (isStreaming && !wasStreaming) {
    isFirstRenderPending = true;
    console.log(
      `[${MODULE_NAME}] RAF: Streaming started, first render will be immediate`,
    );
  }

  if (wasStreaming && !isStreaming) {
    // Streaming ended - flush any pending updates immediately
    console.log(
      `[${MODULE_NAME}] RAF: Streaming ended, flushing pending updates`,
    );
    flushPendingUpdates();
  }
}

/**
 * Get the current streaming state
 * @returns {boolean} Whether streaming is active
 */
export function getStreamingState() {
  return isStreamingActive;
}

// --- SCHEDULING ---

/**
 * Schedule an OOC update for a specific message
 * Updates are batched and processed in the next animation frame
 * @param {number} mesId - The message ID to process
 * @param {boolean} force - Whether to force reprocessing
 */
export function scheduleOOCUpdate(mesId, force = false) {
  const key = `ooc-${mesId}`;

  // Store/overwrite update (latest wins for same message)
  const existing = pendingOOCUpdates.get(key);
  pendingOOCUpdates.set(key, {
    mesId,
    force: force || existing?.force || false,
  });

  scheduleFlush();
}

/**
 * Schedule a full chat OOC reprocess
 * @param {boolean} clearExisting - Whether to clear existing OOC boxes first
 */
export function scheduleFullReprocess(clearExisting = false) {
  pendingFullReprocess = true;
  pendingClearExisting = clearExisting || pendingClearExisting;

  // Clear individual message updates since we're doing a full reprocess
  pendingOOCUpdates.clear();

  scheduleFlush();
}

/**
 * Internal: Schedule the RAF flush with optional debouncing
 * First render is always immediate for responsiveness, subsequent streaming updates are debounced
 */
function scheduleFlush() {
  // First render should always be immediate for responsiveness
  if (isFirstRenderPending) {
    isFirstRenderPending = false;
    if (rafId === null) {
      rafId = requestAnimationFrame(flushUpdates);
    }
    return;
  }

  if (isStreamingActive) {
    // During streaming, debounce subsequent updates to avoid excessive renders
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null;

      // Check minimum flush interval
      const now = performance.now();
      const timeSinceLastFlush = now - lastFlushTime;

      if (timeSinceLastFlush < MIN_FLUSH_INTERVAL_MS) {
        // Too soon, schedule for later
        const delay = MIN_FLUSH_INTERVAL_MS - timeSinceLastFlush;
        setTimeout(() => {
          if (rafId === null) {
            rafId = requestAnimationFrame(flushUpdates);
          }
        }, delay);
      } else if (rafId === null) {
        rafId = requestAnimationFrame(flushUpdates);
      }
    }, STREAMING_DEBOUNCE_MS);
  } else {
    // Not streaming - schedule immediate RAF
    if (rafId === null) {
      rafId = requestAnimationFrame(flushUpdates);
    }
  }
}

// --- FLUSHING ---

/**
 * Yield control to the browser's event loop
 * Prevents page freezing during long batch operations
 * @returns {Promise<void>}
 */
export function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Process all pending updates in a single batch with chunked yielding
 * Called by requestAnimationFrame - runs async but doesn't block
 */
async function flushUpdates() {
  rafId = null;
  lastFlushTime = performance.now();

  const hasIndividualUpdates = pendingOOCUpdates.size > 0;
  const hasFullReprocess = pendingFullReprocess;

  if (!hasIndividualUpdates && !hasFullReprocess) {
    return;
  }

  // Guard against concurrent chunked processing
  if (isChunkedProcessingActive) {
    console.log(`[${MODULE_NAME}] RAF: Skipping flush - chunked processing active`);
    return;
  }

  isChunkedProcessingActive = true;

  // Save scroll position BEFORE any DOM changes
  const scrollY = window.scrollY;

  const updateCount = hasFullReprocess ? "full" : pendingOOCUpdates.size;
  console.log(`[${MODULE_NAME}] RAF: Flushing ${updateCount} update(s) [chunked]`);

  const startTime = performance.now();

  try {
    if (hasFullReprocess) {
      // Full reprocess takes precedence - callback handles chunking internally
      if (processAllOOCCallback) {
        await processAllOOCCallback(pendingClearExisting);
      }
      pendingFullReprocess = false;
      pendingClearExisting = false;
    } else {
      // Process individual message updates in chunks with yielding
      const updates = Array.from(pendingOOCUpdates.values());
      pendingOOCUpdates.clear();

      for (let i = 0; i < updates.length; i++) {
        if (processOOCCallback) {
          processOOCCallback(updates[i].mesId, updates[i].force);
        }

        // Yield every chunk to prevent page freeze
        if (
          (i + 1) % OOC_PROCESSING_CHUNK_SIZE === 0 &&
          i < updates.length - 1
        ) {
          await yieldToBrowser();
        }
      }
    }
  } catch (error) {
    console.error(`[${MODULE_NAME}] RAF: Error during flush:`, error);
  } finally {
    isChunkedProcessingActive = false;
  }

  // Restore scroll position AFTER all DOM changes
  window.scrollTo(window.scrollX, scrollY);

  const duration = performance.now() - startTime;
  console.log(`[${MODULE_NAME}] RAF: Flush completed in ${duration.toFixed(2)}ms`);
}

/**
 * Force immediate processing of all pending updates
 * Call this when updates need to be visible immediately (e.g., after streaming ends)
 * Now async to prevent blocking the main thread on Firefox/Safari
 */
export async function flushPendingUpdates() {
  // Clear any pending timers
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Yield to browser before flushing to prevent blocking
  // This allows the UI to remain responsive while we process updates
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Flush with yielding (flushUpdates is already async)
  await flushUpdates();
}

// --- BATCH UTILITIES ---

/**
 * Schedule multiple message updates at once
 * @param {number[]} mesIds - Array of message IDs to process
 * @param {boolean} force - Whether to force reprocessing
 */
export function scheduleMultipleOOCUpdates(mesIds, force = false) {
  for (const mesId of mesIds) {
    const key = `ooc-${mesId}`;
    const existing = pendingOOCUpdates.get(key);
    pendingOOCUpdates.set(key, {
      mesId,
      force: force || existing?.force || false,
    });
  }

  scheduleFlush();
}

/**
 * Cancel a pending update for a specific message
 * @param {number} mesId - The message ID to cancel
 */
export function cancelOOCUpdate(mesId) {
  pendingOOCUpdates.delete(`ooc-${mesId}`);
}

/**
 * Cancel all pending updates
 */
export function cancelAllPendingUpdates() {
  pendingOOCUpdates.clear();
  pendingFullReprocess = false;
  pendingClearExisting = false;
  isChunkedProcessingActive = false;

  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}


/**
 * Check if there are any pending updates
 * @returns {boolean} True if updates are pending
 */
export function hasPendingUpdates() {
  return pendingOOCUpdates.size > 0 || pendingFullReprocess;
}

/**
 * Reset the RAF scheduler state for a fresh start
 * Call this when switching chats to ensure clean processing
 */
export function resetRAFState() {
  // Cancel any pending operations
  cancelAllPendingUpdates();

  // Reset first render flag so next update is immediate
  isFirstRenderPending = true;

  console.log(`[${MODULE_NAME}] RAF: State reset for fresh processing`);
}

/**
 * Get the count of pending individual message updates
 * @returns {number} Number of pending message updates
 */
export function getPendingUpdateCount() {
  return pendingOOCUpdates.size;
}
