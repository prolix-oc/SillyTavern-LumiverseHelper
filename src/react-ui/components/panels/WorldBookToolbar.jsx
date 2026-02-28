/**
 * WorldBookToolbar — Search, sort, pagination, and bulk actions for the World Book editor.
 */

import React, { useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronsUpDown, Maximize2, Minimize2, FileText, ArrowDownUp } from 'lucide-react';

const SORT_OPTIONS = [
    { value: 'displayIndex', label: 'Custom Order' },
    { value: 'titleAZ', label: 'Title A\u2192Z' },
    { value: 'titleZA', label: 'Title Z\u2192A' },
    { value: 'uidAsc', label: 'UID Asc' },
    { value: 'uidDesc', label: 'UID Desc' },
    { value: 'orderAsc', label: 'Order Asc' },
    { value: 'orderDesc', label: 'Order Desc' },
    { value: 'depthAsc', label: 'Depth Asc' },
    { value: 'depthDesc', label: 'Depth Desc' },
    { value: 'probAsc', label: 'Trigger% Asc' },
    { value: 'probDesc', label: 'Trigger% Desc' },
];

const PAGE_SIZES = [
    { value: 25, label: '25' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
    { value: 0, label: 'All' },
];

const s = {
    toolbar: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '0 0 12px',
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap',
    },
    searchWrap: {
        flex: 1,
        minWidth: '120px',
        position: 'relative',
    },
    searchIcon: {
        position: 'absolute',
        left: '10px',
        top: '50%',
        transform: 'translateY(-50%)',
        color: 'var(--lumiverse-text-dim)',
        pointerEvents: 'none',
    },
    searchInput: {
        width: '100%',
        padding: '7px 10px 7px 32px',
        background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.2))',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        color: 'var(--lumiverse-text)',
        fontSize: '12px',
        fontFamily: 'inherit',
    },
    smallSelect: {
        padding: '7px 8px',
        background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.2))',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        color: 'var(--lumiverse-text)',
        fontSize: '12px',
        fontFamily: 'inherit',
        cursor: 'pointer',
    },
    btn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '6px 10px',
        background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.2))',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '6px',
        color: 'var(--lumiverse-text-muted)',
        fontSize: '11px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
    },
    pageInfo: {
        fontSize: '11px',
        color: 'var(--lumiverse-text-dim)',
        whiteSpace: 'nowrap',
        padding: '0 4px',
    },
    navBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5px',
        background: 'none',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '6px',
        color: 'var(--lumiverse-text-muted)',
        cursor: 'pointer',
        flexShrink: 0,
    },
};

export default function WorldBookToolbar({
    searchQuery,
    onSearchChange,
    sortBy,
    onSortChange,
    page,
    onPageChange,
    pageSize,
    onPageSizeChange,
    totalPages,
    totalFiltered,
    totalEntries,
    onExpandAll,
    onCollapseAll,
    onBackfillMemos,
    onApplySortOrder,
    compact = false,
}) {
    const handleSearchChange = useCallback((e) => {
        onSearchChange(e.target.value);
    }, [onSearchChange]);

    return (
        <div style={s.toolbar}>
            {/* Search + Sort row */}
            <div style={s.row}>
                <div style={s.searchWrap}>
                    <div style={s.searchIcon}>
                        <Search size={14} />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        placeholder="Search entries..."
                        style={s.searchInput}
                    />
                </div>
                <select
                    value={sortBy}
                    onChange={(e) => onSortChange(e.target.value)}
                    style={s.smallSelect}
                    title="Sort by"
                >
                    {SORT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>

            {/* Pagination + Actions row */}
            <div style={s.row}>
                <span style={s.pageInfo}>
                    {totalFiltered} / {totalEntries} entries
                </span>

                <div style={{ flex: 1 }} />

                {/* Page size */}
                <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    style={{ ...s.smallSelect, width: '55px' }}
                    title="Page size"
                >
                    {PAGE_SIZES.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

                {/* Pagination nav */}
                {pageSize > 0 && totalPages > 1 && (
                    <>
                        <button
                            style={{
                                ...s.navBtn,
                                opacity: page > 0 ? 1 : 0.3,
                                pointerEvents: page > 0 ? 'auto' : 'none',
                            }}
                            onClick={() => onPageChange(page - 1)}
                            type="button"
                            title="Previous page"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span style={s.pageInfo}>
                            {page + 1}/{totalPages}
                        </span>
                        <button
                            style={{
                                ...s.navBtn,
                                opacity: page < totalPages - 1 ? 1 : 0.3,
                                pointerEvents: page < totalPages - 1 ? 'auto' : 'none',
                            }}
                            onClick={() => onPageChange(page + 1)}
                            type="button"
                            title="Next page"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </>
                )}
            </div>

            {/* Bulk actions row */}
            {!compact && (
                <div style={s.row}>
                    <button style={s.btn} onClick={onExpandAll} type="button" title="Expand all visible entries">
                        <Maximize2 size={12} /> Expand All
                    </button>
                    <button style={s.btn} onClick={onCollapseAll} type="button" title="Collapse all entries">
                        <Minimize2 size={12} /> Collapse All
                    </button>
                    <button style={s.btn} onClick={onBackfillMemos} type="button" title="Auto-fill empty titles from first keyword">
                        <FileText size={12} /> Backfill Memos
                    </button>
                    <button style={s.btn} onClick={onApplySortOrder} type="button" title="Bake current sort into display order">
                        <ArrowDownUp size={12} /> Apply Sort
                    </button>
                </div>
            )}
        </div>
    );
}
