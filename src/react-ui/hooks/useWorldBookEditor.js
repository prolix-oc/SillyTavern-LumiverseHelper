/**
 * useWorldBookEditor — Hook for all World Book editor state and operations.
 *
 * Manages: book list, active book, entries CRUD, search/sort/filter/pagination,
 * dirty tracking, expand/collapse state, and bulk operations.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    fetchBookList,
    fetchBook,
    saveBook as saveBookApi,
    deleteBook as deleteBookApi,
    createNewBook,
    importBookFromFile,
    exportBookToFile,
    renameBook as renameBookApi,
    duplicateBook as duplicateBookApi,
    normalizeEntries,
    denormalizeEntries,
    getNextUid,
    createDefaultEntry,
    backfillMemos as backfillMemosUtil,
    applySortOrder as applySortOrderUtil,
    getGloballyEnabledBooks,
    setGlobalBookEnabled,
} from '@lib/worldBookService';

// ---------------------------------------------------------------------------
// Sort utilities
// ---------------------------------------------------------------------------

const SORT_FUNCTIONS = {
    displayIndex: (a, b) => (a.displayIndex ?? 0) - (b.displayIndex ?? 0),
    titleAZ: (a, b) => (a.comment || '').localeCompare(b.comment || ''),
    titleZA: (a, b) => (b.comment || '').localeCompare(a.comment || ''),
    uidAsc: (a, b) => a.uid - b.uid,
    uidDesc: (a, b) => b.uid - a.uid,
    orderAsc: (a, b) => (a.order ?? 0) - (b.order ?? 0),
    orderDesc: (a, b) => (b.order ?? 0) - (a.order ?? 0),
    depthAsc: (a, b) => (a.depth ?? 0) - (b.depth ?? 0),
    depthDesc: (a, b) => (b.depth ?? 0) - (a.depth ?? 0),
    probAsc: (a, b) => (a.probability ?? 100) - (b.probability ?? 100),
    probDesc: (a, b) => (b.probability ?? 100) - (a.probability ?? 100),
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export default function useWorldBookEditor() {
    // Book list & selection
    const [bookList, setBookList] = useState([]);
    const [activeBookName, setActiveBookName] = useState('');
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [isLoadingBook, setIsLoadingBook] = useState(false);
    const [error, setError] = useState(null);

    // Entries for the active book
    const [entries, setEntries] = useState([]);
    const [originalData, setOriginalData] = useState(null);

    // Dirty tracking
    const [dirtyBooks, setDirtyBooks] = useState(new Set());

    // UI state
    const [expandedEntries, setExpandedEntries] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('displayIndex');
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(50);

    // Global world books
    const [globalBooks, setGlobalBooks] = useState([]);

    // Debounced search
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const searchTimerRef = useRef(null);

    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(0); // Reset to first page on search change
        }, 200);
        return () => {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        };
    }, [searchQuery]);

    // ---------------------------------------------------------------------------
    // Load book list on mount
    // ---------------------------------------------------------------------------

    const refreshBookList = useCallback(async () => {
        setIsLoadingList(true);
        setError(null);
        try {
            const list = await fetchBookList();
            setBookList(list);
        } catch (err) {
            setError('Failed to load book list');
        } finally {
            setIsLoadingList(false);
        }
    }, []);

    useEffect(() => {
        refreshBookList();
    }, [refreshBookList]);

    // Refresh global book selection whenever the book list loads
    const refreshGlobalBooks = useCallback(() => {
        setGlobalBooks(getGloballyEnabledBooks());
    }, []);

    useEffect(() => {
        if (bookList.length > 0) refreshGlobalBooks();
    }, [bookList, refreshGlobalBooks]);

    const toggleGlobalBook = useCallback((bookName) => {
        const isEnabled = globalBooks.includes(bookName);
        if (setGlobalBookEnabled(bookName, !isEnabled)) {
            setGlobalBooks(getGloballyEnabledBooks());
        }
    }, [globalBooks]);

    // ---------------------------------------------------------------------------
    // Load active book
    // ---------------------------------------------------------------------------

    const loadBook = useCallback(async (name) => {
        if (!name) {
            setEntries([]);
            setOriginalData(null);
            return;
        }

        setIsLoadingBook(true);
        setError(null);
        try {
            const result = await fetchBook(name);
            if (result) {
                setEntries(result.entries);
                setOriginalData(result.originalData);
            } else {
                setEntries([]);
                setOriginalData(null);
                setError(`Failed to load book "${name}"`);
            }
        } catch (err) {
            setError(`Failed to load book "${name}"`);
        } finally {
            setIsLoadingBook(false);
        }
    }, []);

    // Load book when active book changes
    useEffect(() => {
        if (activeBookName) {
            loadBook(activeBookName);
            setExpandedEntries(new Set());
            setSearchQuery('');
            setPage(0);
        } else {
            setEntries([]);
            setOriginalData(null);
        }
    }, [activeBookName, loadBook]);

    // ---------------------------------------------------------------------------
    // Dirty tracking
    // ---------------------------------------------------------------------------

    const markDirty = useCallback(() => {
        if (!activeBookName) return;
        setDirtyBooks(prev => {
            const next = new Set(prev);
            next.add(activeBookName);
            return next;
        });
    }, [activeBookName]);

    const clearDirty = useCallback((name) => {
        setDirtyBooks(prev => {
            const next = new Set(prev);
            next.delete(name || activeBookName);
            return next;
        });
    }, [activeBookName]);

    const isDirty = activeBookName ? dirtyBooks.has(activeBookName) : false;

    // ---------------------------------------------------------------------------
    // Entry CRUD
    // ---------------------------------------------------------------------------

    const updateEntry = useCallback((uid, field, value) => {
        setEntries(prev => prev.map(e =>
            e.uid === uid ? { ...e, [field]: value } : e
        ));
        markDirty();
    }, [markDirty]);

    const updateEntryMulti = useCallback((uid, updates) => {
        setEntries(prev => prev.map(e =>
            e.uid === uid ? { ...e, ...updates } : e
        ));
        markDirty();
    }, [markDirty]);

    const createEntry = useCallback(() => {
        const newUid = getNextUid(entries);
        const newEntry = createDefaultEntry(newUid);
        setEntries(prev => [newEntry, ...prev]);
        setExpandedEntries(prev => {
            const next = new Set(prev);
            next.add(newUid);
            return next;
        });
        markDirty();
        return newUid;
    }, [entries, markDirty]);

    const deleteEntry = useCallback((uid) => {
        setEntries(prev => prev.filter(e => e.uid !== uid));
        setExpandedEntries(prev => {
            const next = new Set(prev);
            next.delete(uid);
            return next;
        });
        markDirty();
    }, [markDirty]);

    const duplicateEntry = useCallback((uid) => {
        const source = entries.find(e => e.uid === uid);
        if (!source) return;
        const newUid = getNextUid(entries);
        const clone = { ...source, uid: newUid, displayIndex: newUid, comment: `${source.comment || 'Entry'} (copy)` };
        setEntries(prev => {
            const idx = prev.findIndex(e => e.uid === uid);
            const next = [...prev];
            next.splice(idx + 1, 0, clone);
            return next;
        });
        markDirty();
    }, [entries, markDirty]);

    const toggleEntry = useCallback((uid) => {
        setEntries(prev => prev.map(e =>
            e.uid === uid ? { ...e, disable: !e.disable } : e
        ));
        markDirty();
    }, [markDirty]);

    // ---------------------------------------------------------------------------
    // Expand/Collapse
    // ---------------------------------------------------------------------------

    const toggleExpanded = useCallback((uid) => {
        setExpandedEntries(prev => {
            const next = new Set(prev);
            if (next.has(uid)) next.delete(uid);
            else next.add(uid);
            return next;
        });
    }, []);

    const expandAll = useCallback(() => {
        setExpandedEntries(new Set(entries.map(e => e.uid)));
    }, [entries]);

    const collapseAll = useCallback(() => {
        setExpandedEntries(new Set());
    }, []);

    // ---------------------------------------------------------------------------
    // Save
    // ---------------------------------------------------------------------------

    const saveCurrentBook = useCallback(async () => {
        if (!activeBookName) return false;
        const denormalized = denormalizeEntries(entries);
        const data = {
            ...(originalData || {}),
            entries: denormalized,
        };
        const success = await saveBookApi(activeBookName, data);
        if (success) {
            clearDirty(activeBookName);
        }
        return success;
    }, [activeBookName, entries, originalData, clearDirty]);

    // ---------------------------------------------------------------------------
    // Book CRUD
    // ---------------------------------------------------------------------------

    const handleCreateBook = useCallback(async (name) => {
        const success = await createNewBook(name);
        if (success) {
            await refreshBookList();
            setActiveBookName(name);
        }
        return success;
    }, [refreshBookList]);

    const handleDeleteBook = useCallback(async (name) => {
        const success = await deleteBookApi(name);
        if (success) {
            if (activeBookName === name) {
                setActiveBookName('');
                setEntries([]);
            }
            clearDirty(name);
            await refreshBookList();
        }
        return success;
    }, [activeBookName, clearDirty, refreshBookList]);

    const handleRenameBook = useCallback(async (oldName, newName) => {
        const success = await renameBookApi(oldName, newName);
        if (success) {
            if (activeBookName === oldName) {
                setActiveBookName(newName);
            }
            // Transfer dirty state
            setDirtyBooks(prev => {
                const next = new Set(prev);
                if (next.has(oldName)) {
                    next.delete(oldName);
                    next.add(newName);
                }
                return next;
            });
            await refreshBookList();
        }
        return success;
    }, [activeBookName, refreshBookList]);

    const handleDuplicateBook = useCallback(async (sourceName, newName) => {
        const success = await duplicateBookApi(sourceName, newName);
        if (success) {
            await refreshBookList();
            setActiveBookName(newName);
        }
        return success;
    }, [refreshBookList]);

    const handleImportBook = useCallback(async (file) => {
        const name = await importBookFromFile(file);
        if (name) {
            await refreshBookList();
            setActiveBookName(name);
        }
        return name;
    }, [refreshBookList]);

    const handleExportBook = useCallback(async (name) => {
        await exportBookToFile(name || activeBookName);
    }, [activeBookName]);

    // ---------------------------------------------------------------------------
    // Switching books with dirty check
    // ---------------------------------------------------------------------------

    const switchBook = useCallback((name) => {
        // Caller is responsible for confirming if dirty
        setActiveBookName(name);
    }, []);

    // ---------------------------------------------------------------------------
    // Filter → Sort → Paginate pipeline
    // ---------------------------------------------------------------------------

    const filteredEntries = useMemo(() => {
        let result = entries;

        // Search filter
        if (debouncedSearch) {
            const q = debouncedSearch.toLowerCase();
            result = result.filter(e => {
                const comment = (e.comment || '').toLowerCase();
                const content = (e.content || '').toLowerCase();
                const keys = (e.key || []).join(' ').toLowerCase();
                const secKeys = (e.keysecondary || []).join(' ').toLowerCase();
                return comment.includes(q) || content.includes(q) || keys.includes(q) || secKeys.includes(q);
            });
        }

        // Sort
        const sortFn = SORT_FUNCTIONS[sortBy] || SORT_FUNCTIONS.displayIndex;
        result = [...result].sort(sortFn);

        return result;
    }, [entries, debouncedSearch, sortBy]);

    const totalFiltered = filteredEntries.length;
    const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalFiltered / pageSize));

    // Clamp page
    const clampedPage = Math.min(page, totalPages - 1);
    useEffect(() => {
        if (page !== clampedPage) setPage(clampedPage);
    }, [page, clampedPage]);

    const paginatedEntries = useMemo(() => {
        if (pageSize === 0) return filteredEntries; // "All" mode
        const start = clampedPage * pageSize;
        return filteredEntries.slice(start, start + pageSize);
    }, [filteredEntries, clampedPage, pageSize]);

    // ---------------------------------------------------------------------------
    // Bulk operations
    // ---------------------------------------------------------------------------

    const handleBackfillMemos = useCallback(() => {
        setEntries(prev => backfillMemosUtil(prev));
        markDirty();
    }, [markDirty]);

    const handleApplySortOrder = useCallback(() => {
        setEntries(prev => {
            const sortFn = SORT_FUNCTIONS[sortBy] || SORT_FUNCTIONS.displayIndex;
            const sorted = [...prev].sort(sortFn);
            return applySortOrderUtil(sorted);
        });
        markDirty();
    }, [sortBy, markDirty]);

    // ---------------------------------------------------------------------------
    // Drag & drop reorder
    // ---------------------------------------------------------------------------

    const reorderEntries = useCallback((fromUid, toUid) => {
        setEntries(prev => {
            const arr = [...prev];
            const fromIdx = arr.findIndex(e => e.uid === fromUid);
            const toIdx = arr.findIndex(e => e.uid === toUid);
            if (fromIdx === -1 || toIdx === -1) return prev;

            const [moved] = arr.splice(fromIdx, 1);
            arr.splice(toIdx, 0, moved);

            // Update displayIndex values
            return arr.map((e, i) => ({ ...e, displayIndex: i }));
        });
        markDirty();
    }, [markDirty]);

    // ---------------------------------------------------------------------------
    // Move/Copy entry between books
    // ---------------------------------------------------------------------------

    const moveEntryToBook = useCallback(async (uid, targetBookName) => {
        const entry = entries.find(e => e.uid === uid);
        if (!entry) return false;

        // Fetch target book
        const target = await fetchBook(targetBookName);
        if (!target) return false;

        // Add to target with new UID
        const newUid = getNextUid(target.entries);
        const movedEntry = { ...entry, uid: newUid };
        const targetEntries = [...target.entries, movedEntry];

        // Save target
        const targetData = {
            ...(target.originalData || {}),
            entries: denormalizeEntries(targetEntries),
        };
        const saved = await saveBookApi(targetBookName, targetData);
        if (!saved) return false;

        // Remove from current
        deleteEntry(uid);
        return true;
    }, [entries, deleteEntry]);

    const copyEntryToBook = useCallback(async (uid, targetBookName) => {
        const entry = entries.find(e => e.uid === uid);
        if (!entry) return false;

        // Fetch target book
        const target = await fetchBook(targetBookName);
        if (!target) return false;

        // Add to target with new UID
        const newUid = getNextUid(target.entries);
        const copiedEntry = { ...entry, uid: newUid };
        const targetEntries = [...target.entries, copiedEntry];

        // Save target
        const targetData = {
            ...(target.originalData || {}),
            entries: denormalizeEntries(targetEntries),
        };
        return await saveBookApi(targetBookName, targetData);
    }, [entries]);

    // ---------------------------------------------------------------------------
    // Keyboard shortcuts
    // ---------------------------------------------------------------------------

    useEffect(() => {
        const handler = (e) => {
            // Ctrl/Cmd+S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (isDirty && activeBookName) {
                    saveCurrentBook();
                }
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isDirty, activeBookName, saveCurrentBook]);

    // ---------------------------------------------------------------------------
    // Return value
    // ---------------------------------------------------------------------------

    return {
        // Book list
        bookList,
        activeBookName,
        switchBook,
        refreshBookList,
        isLoadingList,

        // Active book
        entries,
        paginatedEntries,
        filteredEntries,
        isLoadingBook,
        error,

        // Entry CRUD
        createEntry,
        updateEntry,
        updateEntryMulti,
        deleteEntry,
        duplicateEntry,
        toggleEntry,

        // Expand/collapse
        expandedEntries,
        toggleExpanded,
        expandAll,
        collapseAll,

        // Save
        saveCurrentBook,
        isDirty,
        dirtyBooks,

        // Book CRUD
        handleCreateBook,
        handleDeleteBook,
        handleRenameBook,
        handleDuplicateBook,
        handleImportBook,
        handleExportBook,

        // Search, sort, pagination
        searchQuery,
        setSearchQuery,
        sortBy,
        setSortBy,
        page,
        setPage,
        pageSize,
        setPageSize,
        totalPages,
        totalFiltered,

        // Bulk
        handleBackfillMemos,
        handleApplySortOrder,

        // DnD
        reorderEntries,

        // Cross-book
        moveEntryToBook,
        copyEntryToBook,

        // Global world books
        globalBooks,
        toggleGlobalBook,
    };
}
