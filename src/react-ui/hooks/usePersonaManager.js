/**
 * usePersonaManager — React hook for the Persona Manager panel.
 *
 * Reads from the vanilla JS store via useSyncExternalStore,
 * applies client-side filtering/sorting, and returns
 * processed data + UI state setters + mutation callbacks.
 */

import { useState, useMemo, useCallback, useSyncExternalStore, useRef } from 'react';
import { useLumiverseStore } from '../store/LumiverseContext';
import {
    switchPersona,
    createPersona,
    uploadPersonaAvatar,
    renamePersona,
    updatePersonaDescription,
    deletePersona,
    duplicatePersona,
    toggleDefaultPersona,
    toggleChatLock,
    addConnection,
    removeConnection,
    setPersonaLorebook,
    syncPersonas,
} from '../../lib/personaManagerService.js';

const store = useLumiverseStore;

// Stable selectors
const selectPersonaManager = () => store.getState().personaManager;
const EMPTY_PM = { personas: [], activePersonaId: null, defaultPersonaId: null, chatLockedPersonaId: null, lastSyncTimestamp: 0 };

/**
 * @typedef {'name'|'recent'} SortField
 * @typedef {'all'|'default'|'chatLocked'|'connected'} FilterLock
 * @typedef {'grid'|'list'} ViewMode
 */

export default function usePersonaManager() {
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortBy, setSortBy] = useState(/** @type {SortField} */ ('name'));
    const [filterLock, setFilterLock] = useState(/** @type {FilterLock} */ ('all'));
    const [selectedPersonaId, setSelectedPersonaId] = useState(/** @type {string|null} */ (null));
    const [isCreating, setIsCreating] = useState(false);
    const [viewMode, setViewMode] = useState(/** @type {ViewMode} */ ('grid'));

    // Debounce search (150ms)
    const searchTimerRef = useRef(null);
    const handleSearchChange = useCallback((value) => {
        setSearchQuery(value);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 150);
    }, []);

    // Read from store
    const pm = useSyncExternalStore(store.subscribe, selectPersonaManager, () => EMPTY_PM);
    const { personas: rawPersonas, activePersonaId, defaultPersonaId, chatLockedPersonaId } = pm;

    // Filter + sort pipeline
    const filtered = useMemo(() => {
        let items = rawPersonas;

        // 1. Filter by lock state
        switch (filterLock) {
            case 'default':
                items = items.filter(p => p.isDefault);
                break;
            case 'chatLocked':
                items = items.filter(p => p.isChatLocked);
                break;
            case 'connected':
                items = items.filter(p => p.hasConnections);
                break;
            // 'all' — no filter
        }

        // 2. Search filter
        const query = debouncedSearch.toLowerCase().trim();
        if (query) {
            items = items.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.title.toLowerCase().includes(query) ||
                p.description.toLowerCase().includes(query)
            );
        }

        // 3. Sort
        items = [...items].sort((a, b) => {
            switch (sortBy) {
                case 'name':
                default:
                    return a.name.localeCompare(b.name);
            }
        });

        return items;
    }, [rawPersonas, filterLock, debouncedSearch, sortBy]);

    // Selected persona object
    const selectedPersona = useMemo(
        () => rawPersonas.find(p => p.avatarId === selectedPersonaId) || null,
        [rawPersonas, selectedPersonaId]
    );

    // ─── Mutation Callbacks ─────────────────────────────────

    const handleSwitchPersona = useCallback(async (avatarId) => {
        await switchPersona(avatarId);
    }, []);

    const handleCreate = useCallback(async (name, avatarFile) => {
        const newId = await createPersona(name, avatarFile);
        if (newId) {
            setSelectedPersonaId(newId);
            setIsCreating(false);
        }
        return newId;
    }, []);

    const handleUploadAvatar = useCallback(async (avatarId, file) => {
        return uploadPersonaAvatar(avatarId, file);
    }, []);

    const handleRename = useCallback((avatarId, newName) => {
        renamePersona(avatarId, newName);
    }, []);

    const handleUpdateDescription = useCallback((avatarId, changes) => {
        updatePersonaDescription(avatarId, changes);
    }, []);

    const handleDelete = useCallback(async (avatarId) => {
        const ok = await deletePersona(avatarId);
        if (ok && selectedPersonaId === avatarId) {
            setSelectedPersonaId(null);
        }
        return ok;
    }, [selectedPersonaId]);

    const handleDuplicate = useCallback(async (avatarId) => {
        const newId = await duplicatePersona(avatarId);
        if (newId) setSelectedPersonaId(newId);
        return newId;
    }, []);

    const handleToggleDefault = useCallback((avatarId) => {
        toggleDefaultPersona(avatarId);
    }, []);

    const handleToggleChatLock = useCallback((avatarId, lock) => {
        toggleChatLock(avatarId, lock);
    }, []);

    const handleAddConnection = useCallback((avatarId, connection) => {
        addConnection(avatarId, connection);
    }, []);

    const handleRemoveConnection = useCallback((avatarId, idx) => {
        removeConnection(avatarId, idx);
    }, []);

    const handleSetLorebook = useCallback((avatarId, bookName) => {
        setPersonaLorebook(avatarId, bookName);
    }, []);

    const handleRefresh = useCallback(() => {
        syncPersonas();
    }, []);

    return {
        // Data
        personas: filtered,
        totalCount: rawPersonas.length,
        activePersonaId,
        defaultPersonaId,
        chatLockedPersonaId,
        selectedPersona,

        // Search
        searchQuery,
        setSearchQuery: handleSearchChange,

        // Sort
        sortBy,
        setSortBy,

        // Filter
        filterLock,
        setFilterLock,

        // View
        viewMode,
        setViewMode,

        // Selection
        selectedPersonaId,
        setSelectedPersonaId,

        // Create
        isCreating,
        setIsCreating,

        // Mutations
        switchPersona: handleSwitchPersona,
        createPersona: handleCreate,
        uploadAvatar: handleUploadAvatar,
        renamePersona: handleRename,
        updateDescription: handleUpdateDescription,
        deletePersona: handleDelete,
        duplicatePersona: handleDuplicate,
        toggleDefault: handleToggleDefault,
        toggleChatLock: handleToggleChatLock,
        addConnection: handleAddConnection,
        removeConnection: handleRemoveConnection,
        setLorebook: handleSetLorebook,
        refresh: handleRefresh,
    };
}
