/**
 * WorldBookEditor — Main World Book editor component.
 *
 * Dual-mode: compact (sidebar) and wide (modal).
 * Renders book selector, toolbar, and scrollable entry list.
 * Supports drag-and-drop reorder in custom sort mode.
 */

import React, { useCallback, useMemo } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Save, BookOpen } from 'lucide-react';
import useWorldBookEditor from '../../hooks/useWorldBookEditor';
import WorldBookSelector from './WorldBookSelector';
import WorldBookToolbar from './WorldBookToolbar';
import WorldBookEntry from './WorldBookEntry';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
    },
    header: {
        padding: '12px',
        flexShrink: 0,
    },
    headerActions: {
        display: 'flex',
        gap: '6px',
        marginTop: '8px',
    },
    actionBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '7px 12px',
        background: 'var(--lumiverse-primary)',
        border: 'none',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    saveBtn: {
        background: 'var(--lumiverse-success, #4caf7c)',
    },
    entryList: {
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '0 12px 12px',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
    },
    emptyIcon: {
        color: 'var(--lumiverse-text-dim)',
        marginBottom: '12px',
        opacity: 0.5,
    },
    emptyTitle: {
        fontSize: '15px',
        fontWeight: 600,
        color: 'var(--lumiverse-text)',
        marginBottom: '6px',
    },
    emptyDesc: {
        fontSize: '12px',
        color: 'var(--lumiverse-text-dim)',
        lineHeight: 1.5,
    },
    loadingWrap: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        color: 'var(--lumiverse-text-dim)',
        fontSize: '13px',
    },
    errorWrap: {
        padding: '12px',
        margin: '12px',
        background: 'var(--lumiverse-danger-bg, rgba(220,60,60,0.1))',
        border: '1px solid var(--lumiverse-danger, #dc3c3c)',
        borderRadius: '8px',
        color: 'var(--lumiverse-danger, #dc3c3c)',
        fontSize: '12px',
    },
};

// ---------------------------------------------------------------------------
// Sortable wrapper for entries
// ---------------------------------------------------------------------------

function SortableEntry({ entry, ...props }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: String(entry.uid) });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <WorldBookEntry
                entry={entry}
                isDragging={isDragging}
                dragHandleProps={listeners}
                {...props}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function WorldBookEditor({ wideMode = false, compact = false }) {
    const editor = useWorldBookEditor();

    const {
        bookList,
        activeBookName,
        switchBook,
        isLoadingList,
        isLoadingBook,
        error,
        entries,
        paginatedEntries,
        filteredEntries,
        expandedEntries,
        isDirty,
        // Entry CRUD
        createEntry,
        updateEntry,
        updateEntryMulti,
        deleteEntry,
        duplicateEntry,
        toggleEntry,
        toggleExpanded,
        expandAll,
        collapseAll,
        // Save
        saveCurrentBook,
        // Book CRUD
        handleCreateBook,
        handleDeleteBook,
        handleRenameBook,
        handleDuplicateBook,
        handleImportBook,
        handleExportBook,
        // Search / sort / pagination
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
    } = editor;

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(KeyboardSensor)
    );

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        reorderEntries(Number(active.id), Number(over.id));
    }, [reorderEntries]);

    const isCustomSort = sortBy === 'displayIndex';

    // Entry uid list for SortableContext
    const entryIds = useMemo(() =>
        paginatedEntries.map(e => String(e.uid)),
        [paginatedEntries]
    );

    // No book selected
    if (!activeBookName && !isLoadingList) {
        return (
            <div style={s.container}>
                <div style={s.header}>
                    <WorldBookSelector
                        bookList={bookList}
                        activeBookName={activeBookName}
                        isDirty={isDirty}
                        onSwitchBook={switchBook}
                        onCreateBook={handleCreateBook}
                        onDeleteBook={handleDeleteBook}
                        onRenameBook={handleRenameBook}
                        onDuplicateBook={handleDuplicateBook}
                        onImportBook={handleImportBook}
                        onExportBook={handleExportBook}
                        globalBooks={globalBooks}
                        onToggleGlobalBook={toggleGlobalBook}
                    />
                </div>
                <div style={s.emptyState}>
                    <div style={s.emptyIcon}>
                        <BookOpen size={40} strokeWidth={1} />
                    </div>
                    <div style={s.emptyTitle}>No Book Selected</div>
                    <div style={s.emptyDesc}>
                        Select a world book from the dropdown above,<br />
                        or create a new one to get started.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={s.container}>
            <div style={s.header}>
                <WorldBookSelector
                    bookList={bookList}
                    activeBookName={activeBookName}
                    isDirty={isDirty}
                    onSwitchBook={switchBook}
                    onCreateBook={handleCreateBook}
                    onDeleteBook={handleDeleteBook}
                    onRenameBook={handleRenameBook}
                    onDuplicateBook={handleDuplicateBook}
                    onImportBook={handleImportBook}
                    onExportBook={handleExportBook}
                    globalBooks={globalBooks}
                    onToggleGlobalBook={toggleGlobalBook}
                />

                {activeBookName && !isLoadingBook && (
                    <>
                        <WorldBookToolbar
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            sortBy={sortBy}
                            onSortChange={setSortBy}
                            page={page}
                            onPageChange={setPage}
                            pageSize={pageSize}
                            onPageSizeChange={setPageSize}
                            totalPages={totalPages}
                            totalFiltered={totalFiltered}
                            totalEntries={entries.length}
                            onExpandAll={expandAll}
                            onCollapseAll={collapseAll}
                            onBackfillMemos={handleBackfillMemos}
                            onApplySortOrder={handleApplySortOrder}
                            compact={compact}
                        />

                        <div style={s.headerActions}>
                            <button
                                style={s.actionBtn}
                                onClick={createEntry}
                                type="button"
                                title="Add new entry"
                            >
                                <Plus size={14} /> New Entry
                            </button>
                            {isDirty && (
                                <button
                                    style={{ ...s.actionBtn, ...s.saveBtn }}
                                    onClick={saveCurrentBook}
                                    type="button"
                                    title="Save changes (Ctrl+S)"
                                >
                                    <Save size={14} /> Save
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Error */}
            {error && <div style={s.errorWrap}>{error}</div>}

            {/* Loading */}
            {(isLoadingList || isLoadingBook) && (
                <div style={s.loadingWrap}>Loading...</div>
            )}

            {/* Entry list */}
            {activeBookName && !isLoadingBook && !error && (
                <div style={s.entryList}>
                    {paginatedEntries.length === 0 && (
                        <div style={s.emptyState}>
                            <div style={s.emptyTitle}>
                                {entries.length === 0 ? 'No Entries' : 'No Matching Entries'}
                            </div>
                            <div style={s.emptyDesc}>
                                {entries.length === 0
                                    ? 'Click "New Entry" to add your first entry.'
                                    : 'Try adjusting your search query.'}
                            </div>
                        </div>
                    )}

                    {paginatedEntries.length > 0 && isCustomSort ? (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={entryIds}
                                strategy={verticalListSortingStrategy}
                            >
                                {paginatedEntries.map(entry => (
                                    <SortableEntry
                                        key={entry.uid}
                                        entry={entry}
                                        isExpanded={expandedEntries.has(entry.uid)}
                                        onToggleExpand={toggleExpanded}
                                        onUpdate={updateEntry}
                                        onUpdateMulti={updateEntryMulti}
                                        onDelete={deleteEntry}
                                        onDuplicate={duplicateEntry}
                                        onToggleDisable={toggleEntry}
                                        bookList={bookList}
                                        activeBookName={activeBookName}
                                        onMoveToBook={moveEntryToBook}
                                        onCopyToBook={copyEntryToBook}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    ) : (
                        paginatedEntries.map(entry => (
                            <WorldBookEntry
                                key={entry.uid}
                                entry={entry}
                                isExpanded={expandedEntries.has(entry.uid)}
                                onToggleExpand={toggleExpanded}
                                onUpdate={updateEntry}
                                onUpdateMulti={updateEntryMulti}
                                onDelete={deleteEntry}
                                onDuplicate={duplicateEntry}
                                onToggleDisable={toggleEntry}
                                bookList={bookList}
                                activeBookName={activeBookName}
                                onMoveToBook={moveEntryToBook}
                                onCopyToBook={copyEntryToBook}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
