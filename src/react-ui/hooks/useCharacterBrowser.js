/**
 * useCharacterBrowser — React hook for the character browser panel.
 *
 * Reads from the vanilla JS store via useSyncExternalStore,
 * applies client-side filtering/sorting/grouping, and returns
 * processed data + UI state setters.
 */

import { useState, useMemo, useCallback, useSyncExternalStore, useRef, useEffect } from "react";
import { useLumiverseStore, saveToExtension } from "../store/LumiverseContext";
import {
  selectCharacter,
  importCharacterFiles,
  importFromExternalUrls,
  triggerCreateCharacter,
  deleteCharacterFromST,
  batchDeleteCharacters,
} from "../../lib/characterBrowserService.js";

const store = useLumiverseStore;
const MAX_FAVORITES = 15;

// Stable selectors
const selectCharacterBrowser = () => store.getState().characterBrowser;
const selectEnableResortableTagFolders = () => store.getState().enableResortableTagFolders ?? false;
const selectTagFolderOrder = () => store.getState().tagFolderOrder ?? [];
const EMPTY_CB = { characters: [], favorites: [], activeCharacterId: null, lastSyncTimestamp: 0 };
const EMPTY_ORDER = [];

/**
 * Reconcile folder array with a saved ordering.
 * - Folders in savedOrder appear first, in that order (dead IDs silently dropped).
 * - Folders not in savedOrder are appended at the end (new tags).
 */
function reconcileAndOrderFolders(folders, savedOrder) {
    const folderMap = new Map(folders.map(f => [f.id, f]));
    const ordered = [];
    const placed = new Set();
    for (const id of savedOrder) {
        const folder = folderMap.get(id);
        if (folder) { ordered.push(folder); placed.add(id); }
    }
    for (const folder of folders) {
        if (!placed.has(folder.id)) ordered.push(folder);
    }
    return ordered;
}

/**
 * @typedef {'name'|'recent'|'created'|'size'} SortField
 * @typedef {'all'|'characters'|'groups'|'favorites'} FilterType
 * @typedef {'grid'|'list'} ViewMode
 */

export default function useCharacterBrowser() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState(/** @type {SortField} */ ("name"));
  const [sortDirection, setSortDirection] = useState(/** @type {'asc'|'desc'} */ ("asc"));
  const [filterType, setFilterType] = useState(/** @type {FilterType} */ ("all"));
  const [selectedTags, setSelectedTags] = useState(/** @type {Set<string>} */ (new Set()));
  const [viewMode, setViewMode] = useState(/** @type {ViewMode} */ ("grid"));
  const [expandedFolders, setExpandedFolders] = useState(/** @type {Set<string>} */ (new Set()));

  // Debounce search input (150ms)
  const searchTimerRef = useRef(null);
  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 150);
  }, []);

  // Read from store
  const cb = useSyncExternalStore(
    store.subscribe,
    selectCharacterBrowser,
    () => EMPTY_CB
  );
  const enableResortableTagFolders = useSyncExternalStore(store.subscribe, selectEnableResortableTagFolders, () => false);
  const tagFolderOrder = useSyncExternalStore(store.subscribe, selectTagFolderOrder, () => EMPTY_ORDER);

  const { characters: rawCharacters, favorites, activeCharacterId } = cb;

  // Build favorites Set for O(1) lookup
  const favoritesSet = useMemo(() => new Set(favorites || []), [favorites]);

  // Mark favorites on items
  const charactersWithFav = useMemo(
    () =>
      rawCharacters.map((item) => ({
        ...item,
        isFavorite: favoritesSet.has(item.id),
      })),
    [rawCharacters, favoritesSet]
  );

  // All unique tags across characters (with color data from ST)
  const allTags = useMemo(() => {
    const tagMap = new Map();
    for (const item of rawCharacters) {
      for (let i = 0; i < item.tags.length; i++) {
        if (!tagMap.has(item.tags[i])) {
          const colors = item.tagColors?.[i];
          tagMap.set(item.tags[i], {
            name: item.tagNames[i] || item.tags[i],
            bg: colors?.bg || null,
            fg: colors?.fg || null,
          });
        }
      }
    }
    return Array.from(tagMap, ([id, { name, bg, fg }]) => ({ id, name, bg, fg })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [rawCharacters]);

  // Filtering + Sorting + Grouping pipeline
  const { filtered, folderGroups } = useMemo(() => {
    let items = charactersWithFav;

    // 1. Filter by type
    if (filterType === "characters") {
      items = items.filter((i) => !i.isGroup);
    } else if (filterType === "groups") {
      items = items.filter((i) => i.isGroup);
    } else if (filterType === "favorites") {
      items = items.filter((i) => i.isFavorite);
    }

    // 2. Filter by selected tags (AND logic)
    if (selectedTags.size > 0) {
      items = items.filter((item) => {
        for (const tagId of selectedTags) {
          if (!item.tags.includes(tagId)) return false;
        }
        return true;
      });
    }

    // 3. Search filter
    const query = debouncedSearch.toLowerCase().trim();
    if (query) {
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.creator.toLowerCase().includes(query) ||
          item.creatorNotes.toLowerCase().includes(query)
      );
    }

    // 4. Sort
    const dir = sortDirection === "asc" ? 1 : -1;
    items = [...items].sort((a, b) => {
      switch (sortBy) {
        case "recent":
          return (b.dateLastChat - a.dateLastChat) * dir;
        case "created":
          return (b.dateAdded - a.dateAdded) * dir;
        case "size":
          return (b.chatSize - a.chatSize) * dir;
        case "name":
        default:
          return a.name.localeCompare(b.name) * dir;
      }
    });

    // 5. Group by folder tags (only when no search/tag filter active)
    let folders = null;
    if (!query && selectedTags.size === 0 && filterType === "all") {
      // Find tags that are folder-type
      const folderTags = allTags.filter((t) => {
        // Check if any raw tag has folder_type set
        const ctx = window.SillyTavern?.getContext?.();
        const stTag = ctx?.tags?.find?.((st) => st.id === t.id);
        return stTag?.folder_type;
      });

      if (folderTags.length > 0) {
        folders = [];
        const assigned = new Set();

        for (const ft of folderTags) {
          const ctx = window.SillyTavern?.getContext?.();
          const stTag = ctx?.tags?.find?.((st) => st.id === ft.id);
          const folderItems = items.filter((item) => item.tags.includes(ft.id));
          folderItems.forEach((item) => assigned.add(item.id));
          folders.push({
            id: ft.id,
            name: ft.name,
            defaultOpen: stTag?.folder_type === "open",
            items: folderItems,
            count: folderItems.length,
          });
        }

        // Unassigned items go into "Untagged Characters" section
        const unassigned = items.filter((item) => !assigned.has(item.id));
        if (unassigned.length > 0) {
          folders.unshift({
            id: "__all__",
            name: "Untagged Characters",
            defaultOpen: true,
            items: unassigned,
            count: unassigned.length,
          });
        }
      }
    }

    // Apply custom folder ordering if enabled
    if (folders && enableResortableTagFolders && tagFolderOrder.length > 0) {
      folders = reconcileAndOrderFolders(folders, tagFolderOrder);
    }

    return { filtered: items, folderGroups: folders };
  }, [
    charactersWithFav,
    filterType,
    selectedTags,
    debouncedSearch,
    sortBy,
    sortDirection,
    allTags,
    enableResortableTagFolders,
    tagFolderOrder,
  ]);

  // Favorites list for the slider (up to 15, preserving order)
  const favoriteItems = useMemo(
    () =>
      (favorites || [])
        .map((favId) => charactersWithFav.find((c) => c.id === favId))
        .filter(Boolean),
    [favorites, charactersWithFav]
  );

  // Toggle favorite
  const toggleFavorite = useCallback(
    (itemId) => {
      const current = store.getState().characterBrowser?.favorites || [];
      let next;
      if (current.includes(itemId)) {
        next = current.filter((id) => id !== itemId);
      } else {
        if (current.length >= MAX_FAVORITES) {
          if (typeof toastr !== "undefined") {
            toastr.warning(`Maximum ${MAX_FAVORITES} favorites reached`);
          }
          return;
        }
        next = [...current, itemId];
      }

      store.setState((prev) => ({
        characterBrowser: {
          ...prev.characterBrowser,
          favorites: next,
        },
        characterBrowserFavorites: next,
      }));
      saveToExtension();
    },
    []
  );

  // Toggle tag selection
  const toggleTag = useCallback((tagId) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }, []);

  // Clear all tag filters
  const clearTags = useCallback(() => setSelectedTags(new Set()), []);

  // Toggle folder expansion
  const toggleFolder = useCallback((folderId) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  // Folder order persistence
  const setTagFolderOrder = useCallback((newOrder) => {
    store.setState({ tagFolderOrder: newOrder });
    saveToExtension();
  }, []);

  const resetTagFolderOrder = useCallback(() => {
    store.setState({ tagFolderOrder: [] });
    saveToExtension();
  }, []);

  // ─── Delete State & Handlers ────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = useCallback(async (deleteChats = true) => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteCharacterFromST(deleteTarget.avatar, deleteChats);
      if (typeof toastr !== "undefined") {
        toastr.success(`Deleted "${deleteTarget.name}"`);
      }
    } catch (err) {
      if (typeof toastr !== "undefined") {
        toastr.error(`Failed to delete: ${err?.message || "Unknown error"}`);
      }
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  // ─── Batch Delete State & Handlers ─────────────────────
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState(/** @type {Set<string>} */ (new Set()));
  const [batchProgress, setBatchProgress] = useState(/** @type {{ current: number, total: number, name: string } | null} */ (null));
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);

  const toggleBatchMode = useCallback(() => {
    setBatchMode((prev) => {
      if (prev) setBatchSelected(new Set()); // Clear selection on exit
      return !prev;
    });
  }, []);

  const toggleBatchItem = useCallback((itemId) => {
    setBatchSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const clearBatchSelection = useCallback(() => {
    setBatchSelected(new Set());
    setBatchMode(false);
    setBatchConfirmOpen(false);
  }, []);

  const executeBatchDelete = useCallback(async (deleteChats = true) => {
    if (batchSelected.size === 0) return;

    // Resolve selected items (only non-group characters)
    const items = [];
    for (const id of batchSelected) {
      const item = rawCharacters.find((c) => c.id === id);
      if (item && !item.isGroup) items.push({ avatar: item.avatar, name: item.name });
    }
    if (items.length === 0) return;

    setBatchConfirmOpen(false);
    setBatchProgress({ current: 0, total: items.length, name: items[0]?.name || "" });

    const { succeeded, failed } = await batchDeleteCharacters(
      items,
      deleteChats,
      (completed, total, currentName) => {
        setBatchProgress({ current: completed, total, name: currentName });
      }
    );

    setBatchProgress(null);
    setBatchSelected(new Set());
    setBatchMode(false);

    // Summary toast
    if (typeof toastr !== "undefined") {
      if (failed.length === 0) {
        toastr.success(`Deleted ${succeeded.length} character${succeeded.length !== 1 ? "s" : ""}`);
      } else {
        toastr.warning(
          `Deleted ${succeeded.length} character${succeeded.length !== 1 ? "s" : ""} (${failed.length} failed)`
        );
      }
    }
  }, [batchSelected, rawCharacters]);

  // ─── Import State & Handlers ────────────────────────────
  const [importState, setImportState] = useState({ isImporting: false, lastImportResult: null });

  const handleImportFiles = useCallback(async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setImportState({ isImporting: true, lastImportResult: null });
    try {
      await importCharacterFiles(fileList);
      setImportState({ isImporting: false, lastImportResult: { success: true, count: fileList.length } });
    } catch (err) {
      setImportState({ isImporting: false, lastImportResult: { success: false, error: err?.message } });
    }
  }, []);

  const handleCreateCharacter = useCallback(() => {
    triggerCreateCharacter();
  }, []);

  // Handle character selection
  const handleSelect = useCallback(
    async (item) => {
      await selectCharacter(item);
    },
    []
  );

  // Toggle sort direction
  const toggleSortDirection = useCallback(() => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  }, []);

  return {
    // Data
    characters: filtered,
    favoriteItems,
    favorites,
    tags: allTags,
    folderGroups,
    activeCharacterId,
    totalCount: rawCharacters.length,

    // Search
    searchQuery,
    setSearchQuery: handleSearchChange,

    // Sort
    sortBy,
    setSortBy,
    sortDirection,
    toggleSortDirection,

    // Filter
    filterType,
    setFilterType,
    selectedTags,
    toggleTag,
    clearTags,

    // View
    viewMode,
    setViewMode,
    expandedFolders,
    toggleFolder,

    // Actions
    selectCharacter: handleSelect,
    toggleFavorite,

    // Resortable folders
    enableResortableTagFolders,
    tagFolderOrder,
    setTagFolderOrder,
    resetTagFolderOrder,

    // Import
    importState,
    handleImportFiles,
    handleCreateCharacter,

    // Delete
    deleteTarget,
    setDeleteTarget,
    confirmDelete,
    isDeleting,

    // Batch Delete
    batchMode,
    toggleBatchMode,
    batchSelected,
    toggleBatchItem,
    clearBatchSelection,
    batchProgress,
    batchConfirmOpen,
    setBatchConfirmOpen,
    executeBatchDelete,
  };
}
