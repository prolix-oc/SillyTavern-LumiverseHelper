/**
 * Character Browser Service
 *
 * Reads ST character/group/tag data via stContext.js accessors, transforms it
 * into a normalized format, subscribes to ST events for live updates, and
 * pushes state to the vanilla JS store.
 */

import {
  getContext,
  getCharacters,
  getGroups,
  getTags,
  getTagMap,
  getCharacterId,
  getGroupId,
  getEventSource,
  getEventTypes,
} from "../stContext.js";

/** Accepted file types for character import */
export const IMPORT_ACCEPTED_TYPES = '.json,.png,.yaml,.yml,.charx,.byaf,image/png';

/** @type {ReturnType<typeof import('../react-ui/store/LumiverseContext.jsx').useLumiverseStore> | null} */
let storeRef = null;

/** Debounce timer for character sync */
let syncTimer = null;
const SYNC_DEBOUNCE = 250;

/** Cached getThumbnailUrl function (lazy-loaded) */
let cachedGetThumbnailUrl = null;

/**
 * Resolve a thumbnail URL for a character avatar.
 * Uses ST's getThumbnailUrl with fallback to direct path.
 * @param {string} avatar - Avatar filename
 * @returns {Promise<string>} Resolved thumbnail URL
 */
export async function resolveThumbnailUrl(avatar) {
  if (!avatar) return "/img/fa-solid-user.svg";

  // Try loading ST's optimized thumbnail function once
  if (cachedGetThumbnailUrl === null) {
    try {
      const mod = await import(
        /* webpackIgnore: true */ "../../../../script.js"
      );
      cachedGetThumbnailUrl = mod.getThumbnailUrl || false;
    } catch {
      cachedGetThumbnailUrl = false;
    }
  }

  if (cachedGetThumbnailUrl) {
    try {
      return cachedGetThumbnailUrl("avatar", avatar);
    } catch {
      // fall through
    }
  }

  return `/characters/${encodeURIComponent(avatar)}`;
}

/**
 * Resolve thumbnail URL synchronously (best-effort, uses cached function).
 * Falls back to direct path if the cached function isn't loaded yet.
 * @param {string} avatar - Avatar filename
 * @returns {string} Thumbnail URL
 */
function resolveThumbnailUrlSync(avatar) {
  if (!avatar) return "/img/fa-solid-user.svg";

  if (cachedGetThumbnailUrl) {
    try {
      return cachedGetThumbnailUrl("avatar", avatar);
    } catch {
      // fall through
    }
  }

  return `/characters/${encodeURIComponent(avatar)}`;
}

/**
 * Build a normalized character item from an ST character object.
 * @param {Object} char - ST character object
 * @param {number} index - Index in ctx.characters array
 * @param {Object} tagMap - Tag map for resolving tags
 * @param {Array} tags - All tags
 * @param {string|undefined} activeAvatar - Currently active character avatar
 * @param {string|undefined} activeGroupId - Currently active group ID
 * @returns {Object} Normalized item
 */
function normalizeCharacter(char, index, tagMap, tags, activeAvatar, activeGroupId) {
  const avatar = char.avatar || "";
  const charTags = [];
  const charTagNames = [];
  const charTagColors = [];

  // tagMap keys are entity IDs (avatar filenames), values are arrays of tag IDs
  const entityTagIds = tagMap[avatar];
  if (entityTagIds && entityTagIds.length > 0) {
    for (const tagId of entityTagIds) {
      const tag = tags.find((t) => t.id === tagId);
      if (tag) {
        charTags.push(tag.id);
        charTagNames.push(tag.name);
        charTagColors.push({
          bg: tag.color || null,
          fg: tag.color2 || null,
        });
      }
    }
  }

  return {
    id: avatar || `char_${index}`,
    name: char.name || "Unknown",
    avatar,
    avatarUrl: resolveThumbnailUrlSync(avatar),
    isGroup: false,
    isFavorite: false, // Set by consumer from favorites list
    tags: charTags,
    tagNames: charTagNames,
    tagColors: charTagColors,
    dateAdded: char.date_added ? new Date(char.date_added).getTime() : 0,
    dateLastChat: char.date_last_chat ? new Date(char.date_last_chat).getTime() : 0,
    chatSize: char.chat_size || 0,
    creator: char.data?.creator || "",
    creatorNotes: char.data?.creator_notes || "",
    members: [],
    memberCount: 0,
    isActive: !activeGroupId && activeAvatar === avatar,
    _index: index,
  };
}

/**
 * Build a normalized group item from an ST group object.
 * @param {Object} group - ST group object
 * @param {Array} characters - Full characters array (for member resolution)
 * @param {Object} tagMap - Tag map for resolving tags
 * @param {Array} tags - All tags
 * @param {string|undefined} activeGroupId - Currently active group ID
 * @returns {Object} Normalized item
 */
function normalizeGroup(group, characters, tagMap, tags, activeGroupId) {
  const groupTags = [];
  const groupTagNames = [];
  const groupTagColors = [];
  const groupKey = `group:${group.id}`;

  // tagMap keys are entity IDs (group:id), values are arrays of tag IDs
  const entityTagIds = tagMap[groupKey];
  if (entityTagIds && entityTagIds.length > 0) {
    for (const tagId of entityTagIds) {
      const tag = tags.find((t) => t.id === tagId);
      if (tag) {
        groupTags.push(tag.id);
        groupTagNames.push(tag.name);
        groupTagColors.push({
          bg: tag.color || null,
          fg: tag.color2 || null,
        });
      }
    }
  }

  // Resolve member info
  const members = (group.members || []).map((memberId) => {
    const charIdx = characters.findIndex((c) => c.avatar === memberId);
    if (charIdx === -1) return { name: memberId, avatar: memberId };
    const c = characters[charIdx];
    return {
      name: c.name || memberId,
      avatar: memberId,
      avatarUrl: resolveThumbnailUrlSync(memberId),
    };
  });

  return {
    id: groupKey,
    name: group.name || "Unnamed Group",
    avatar: group.avatar_url || "",
    avatarUrl: group.avatar_url
      ? `/img/avatars/groups/${encodeURIComponent(group.avatar_url)}`
      : "",
    isGroup: true,
    isFavorite: false,
    tags: groupTags,
    tagNames: groupTagNames,
    tagColors: groupTagColors,
    dateAdded: group.date_added ? new Date(group.date_added).getTime() : 0,
    dateLastChat: group.date_last_chat
      ? new Date(group.date_last_chat).getTime()
      : 0,
    chatSize: group.chat_size || 0,
    creator: "",
    creatorNotes: "",
    members,
    memberCount: members.length,
    isActive: activeGroupId === group.id,
    _index: -1,
  };
}

/**
 * Sync characters and groups from ST context into the store.
 */
function syncCharacters() {
  if (!storeRef) return;

  const characters = getCharacters();
  const groups = getGroups();
  const tags = getTags();
  const tagMap = getTagMap();
  const activeCharId = getCharacterId();
  const activeGroupId = getGroupId();
  const activeAvatar =
    activeCharId !== undefined ? characters[activeCharId]?.avatar : undefined;

  const items = [];

  // Normalize characters
  for (let i = 0; i < characters.length; i++) {
    items.push(
      normalizeCharacter(
        characters[i],
        i,
        tagMap,
        tags,
        activeAvatar,
        activeGroupId
      )
    );
  }

  // Normalize groups
  for (const group of groups) {
    items.push(normalizeGroup(group, characters, tagMap, tags, activeGroupId));
  }

  // Guard: don't replace a populated list with empty (transient ST state)
  if (items.length === 0) {
    const existing = storeRef.getState().characterBrowser?.characters;
    if (existing && existing.length > 0) return;
  }

  // Determine active character ID for store
  let activeId = null;
  if (activeGroupId) {
    activeId = `group:${activeGroupId}`;
  } else if (activeAvatar) {
    activeId = activeAvatar;
  }

  storeRef.setState((prev) => ({
    characterBrowser: {
      ...prev.characterBrowser,
      characters: items,
      activeCharacterId: activeId,
      lastSyncTimestamp: Date.now(),
    },
  }));
}

/**
 * Lightweight sync — only updates activeCharacterId without rebuilding the list.
 * Used for CHAT_CHANGED where the character data hasn't changed, just which chat is open.
 * Falls back to a full sync if the list is empty (defensive recovery).
 */
function syncActiveCharacter() {
  if (!storeRef) return;

  // If the character list is empty, fall back to a full rebuild
  const existing = storeRef.getState().characterBrowser?.characters;
  if (!existing || existing.length === 0) {
    syncCharacters();
    return;
  }

  const characters = getCharacters();
  const activeCharId = getCharacterId();
  const activeGroupId = getGroupId();
  const activeAvatar =
    activeCharId !== undefined ? characters[activeCharId]?.avatar : undefined;

  let activeId = null;
  if (activeGroupId) {
    activeId = `group:${activeGroupId}`;
  } else if (activeAvatar) {
    activeId = activeAvatar;
  }

  storeRef.setState((prev) => ({
    characterBrowser: {
      ...prev.characterBrowser,
      activeCharacterId: activeId,
    },
  }));
}

/**
 * Debounced sync — used for character edit/delete/rename events.
 */
function debouncedSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(syncCharacters, SYNC_DEBOUNCE);
}

/**
 * Select a character or group by navigating to their chat.
 * Uses double-rAF yield pattern for smooth loading state.
 * @param {Object} item - Normalized character/group item
 */
export async function selectCharacter(item) {
  if (!item) return;

  // Double-rAF yield: let React paint loading state before heavy ST work
  await new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))
  );

  try {
    if (item.isGroup) {
      const groupId = item.id.replace("group:", "");
      const { openGroupById } = await import(
        /* webpackIgnore: true */ "../../../../group-chats.js"
      );
      if (openGroupById) {
        await openGroupById(groupId);
      }
    } else {
      const { selectCharacterById } = await import(
        /* webpackIgnore: true */ "../../../../../script.js"
      );
      if (selectCharacterById && item._index !== undefined) {
        await selectCharacterById(String(item._index));
      }
    }
  } catch (err) {
    console.error("[Lumiverse] Error selecting character:", err);
  }
}

/**
 * Import character files via ST's processDroppedFiles.
 * @param {FileList|File[]} fileList - Files to import
 * @returns {Promise<void>}
 */
export async function importCharacterFiles(fileList) {
  if (!fileList || fileList.length === 0) return;

  try {
    const { processDroppedFiles } = await import(
      /* webpackIgnore: true */ "../../../../../script.js"
    );
    if (processDroppedFiles) {
      await processDroppedFiles(fileList);
    } else {
      throw new Error("processDroppedFiles not available");
    }
  } catch (err) {
    console.error("[Lumiverse] Error importing character files:", err);
    throw err;
  }

  // Refresh the gallery after import
  setTimeout(syncCharacters, 500);
}

/**
 * Import characters from external URLs via ST's importFromExternalUrl.
 * @param {string} textBlock - Newline-separated URLs/UUIDs
 * @returns {Promise<Array<{input: string, success: boolean, error?: string}>>}
 */
export async function importFromExternalUrls(textBlock) {
  const lines = textBlock
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  let importFn;
  try {
    const mod = await import(
      /* webpackIgnore: true */ "../../../../utils.js"
    );
    importFn = mod.importFromExternalUrl;
  } catch {
    // Fallback: try from script.js
    try {
      const mod2 = await import(
        /* webpackIgnore: true */ "../../../../../script.js"
      );
      importFn = mod2.importFromExternalUrl;
    } catch {
      // noop
    }
  }

  if (!importFn) {
    return lines.map((input) => ({
      input,
      success: false,
      error: "Import function not available in this ST version",
    }));
  }

  const results = [];
  for (const input of lines) {
    try {
      await importFn(input);
      results.push({ input, success: true });
    } catch (err) {
      results.push({ input, success: false, error: err?.message || "Unknown error" });
    }
  }

  // Refresh the gallery after all imports
  setTimeout(syncCharacters, 500);
  return results;
}

/**
 * Trigger ST's "Create New Character" form.
 * Clicks the DOM button and signals drawer close.
 */
export function triggerCreateCharacter() {
  const btn = document.getElementById("rm_button_create");
  if (btn) {
    btn.click();
  }
  // Signal Lumiverse to close the drawer/modal so the user sees ST's form
  if (storeRef) {
    storeRef.setState({ _closeDrawer: Date.now() });
  }
}

/**
 * Initialize the character browser service.
 * Subscribes to ST events for live updates.
 * @param {Object} store - Lumiverse vanilla JS store instance
 */
export function initCharacterBrowser(store) {
  storeRef = store;

  const eventSource = getEventSource();
  const eventTypes = getEventTypes();

  if (!eventSource || !eventTypes) {
    console.warn(
      "[Lumiverse] CharacterBrowser: Event system not available, will sync on demand"
    );
    return;
  }

  // Initial sync on app ready
  eventSource.on(eventTypes.APP_READY, () => {
    // Pre-warm the thumbnail URL resolver
    resolveThumbnailUrl("").catch(() => {});
    syncCharacters();
  });

  // Live updates — debounced for bulk operations
  const syncEvents = [
    "CHARACTER_EDITED",
    "CHARACTER_DELETED",
    "CHARACTER_DUPLICATED",
  ];
  for (const evt of syncEvents) {
    if (eventTypes[evt]) {
      eventSource.on(eventTypes[evt], debouncedSync);
    }
  }

  // Chat changed — only update active character, don't rebuild the list
  // (character data hasn't changed, just which chat is open)
  if (eventTypes.CHAT_CHANGED) {
    eventSource.on(eventTypes.CHAT_CHANGED, syncActiveCharacter);
  }

  // Intercept ST's character panel button to open Lumiverse Character Browser instead
  const rightNavIcon = document.getElementById("rightNavDrawerIcon");
  if (rightNavIcon) {
    rightNavIcon.addEventListener(
      "click",
      (e) => {
        if (!storeRef.getState().enableCharacterBrowser) {
            return; // Let ST handle it natively
        }

        e.stopImmediatePropagation();
        e.preventDefault();

        // Close ST's native panel if it was open
        const panel = document.getElementById("right-nav-panel");
        if (panel?.classList.contains("openDrawer")) {
          panel.classList.remove("openDrawer");
          panel.classList.add("closedDrawer");
          rightNavIcon.classList.remove("openIcon");
          rightNavIcon.classList.add("closedIcon");
        }

        // Signal Lumiverse to open Character Browser tab
        storeRef.setState({ _openToTab: "characters" });
      },
      true // capture phase — fires before ST's jQuery handler
    );
  }
}
