/**
 * WorldBookSelector — Book picker dropdown + CRUD actions + global book toggles.
 *
 * [Book dropdown] [+ New] [Import] [Export] [More ...]
 * [Globe dropdown: searchable checklist] → [enabled pill] [enabled pill] ...
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Upload, Download, MoreVertical, Pencil, Copy, Trash2, Globe, ChevronDown, X, Search } from 'lucide-react';
import ConfirmationModal from '../shared/ConfirmationModal';

const s = {
    container: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0 0 12px',
        flexWrap: 'wrap',
    },
    select: {
        flex: 1,
        minWidth: '120px',
        padding: '8px 12px',
        background: 'var(--lumiverse-bg, rgba(0,0,0,0.2))',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        color: 'var(--lumiverse-text)',
        fontSize: '13px',
        fontFamily: 'inherit',
        appearance: 'none',
        cursor: 'pointer',
    },
    btn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '7px',
        background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.15))',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        color: 'var(--lumiverse-text-muted)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        flexShrink: 0,
    },
    moreMenu: {
        position: 'absolute',
        right: 0,
        top: '100%',
        marginTop: '4px',
        background: 'var(--lumiverse-bg-elevated)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        boxShadow: 'var(--lumiverse-shadow-lg)',
        overflow: 'hidden',
        zIndex: 100,
        minWidth: '140px',
    },
    menuItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '8px 12px',
        background: 'none',
        border: 'none',
        color: 'var(--lumiverse-text)',
        fontSize: '12px',
        cursor: 'pointer',
        textAlign: 'left',
    },
    menuItemDanger: {
        color: 'var(--lumiverse-danger)',
    },
    // Global books section
    globalRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0 0 10px',
        flexWrap: 'wrap',
    },
    globalTrigger: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '5px 10px',
        background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.15))',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        color: 'var(--lumiverse-text-muted)',
        fontSize: '11px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        flexShrink: 0,
        userSelect: 'none',
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
    },
    globalTriggerActive: {
        borderColor: 'var(--lumiverse-primary)',
        color: 'var(--lumiverse-primary)',
        background: 'var(--lumiverse-primary-010, rgba(100,80,200,0.1))',
    },
    // Dropdown popover
    dropdownPopover: {
        position: 'fixed',
        zIndex: 10020,
        width: '280px',
        maxHeight: '340px',
        background: 'var(--lumiverse-bg-elevated)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    dropdownSearch: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 10px',
        borderBottom: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
    },
    dropdownSearchInput: {
        flex: 1,
        background: 'none',
        border: 'none',
        outline: 'none',
        color: 'var(--lumiverse-text)',
        fontSize: '12px',
        fontFamily: 'inherit',
    },
    dropdownList: {
        flex: 1,
        overflowY: 'auto',
        padding: '4px 0',
    },
    dropdownItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '6px 12px',
        background: 'none',
        border: 'none',
        color: 'var(--lumiverse-text)',
        fontSize: '12px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s ease',
    },
    dropdownCheckbox: {
        width: '14px',
        height: '14px',
        borderRadius: '3px',
        border: '1.5px solid var(--lumiverse-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.15s ease',
    },
    dropdownCheckboxChecked: {
        background: 'var(--lumiverse-primary)',
        borderColor: 'var(--lumiverse-primary)',
    },
    dropdownEmpty: {
        padding: '16px 12px',
        textAlign: 'center',
        color: 'var(--lumiverse-text-dim)',
        fontSize: '12px',
    },
    // Enabled pills (only for active books)
    pillsWrap: {
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        flexWrap: 'wrap',
        flex: 1,
        minWidth: 0,
    },
    enabledPill: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: '3px 6px 3px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 500,
        background: 'var(--lumiverse-primary-010, rgba(100,80,200,0.1))',
        border: '1px solid var(--lumiverse-primary)',
        color: 'var(--lumiverse-primary)',
        userSelect: 'none',
        maxWidth: '180px',
        overflow: 'hidden',
    },
    pillName: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    pillX: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        opacity: 0.6,
        transition: 'opacity 0.1s ease',
        flexShrink: 0,
        padding: '1px',
        borderRadius: '50%',
    },
    noPills: {
        fontSize: '11px',
        color: 'var(--lumiverse-text-dim)',
        fontStyle: 'italic',
    },
};

export default function WorldBookSelector({
    bookList,
    activeBookName,
    isDirty,
    onSwitchBook,
    onCreateBook,
    onDeleteBook,
    onRenameBook,
    onDuplicateBook,
    onImportBook,
    onExportBook,
    globalBooks = [],
    onToggleGlobalBook,
}) {
    const [showMore, setShowMore] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [promptMode, setPromptMode] = useState(null); // 'create' | 'rename' | 'duplicate'
    const [promptValue, setPromptValue] = useState('');
    const [showGlobalDropdown, setShowGlobalDropdown] = useState(false);
    const [globalSearch, setGlobalSearch] = useState('');
    const [dropdownPos, setDropdownPos] = useState(null);
    const fileInputRef = useRef(null);
    const moreRef = useRef(null);
    const globalBtnRef = useRef(null);
    const dropdownRef = useRef(null);

    // Close "more" menu on outside click
    React.useEffect(() => {
        if (!showMore) return;
        const handler = (e) => {
            if (moreRef.current && !moreRef.current.contains(e.target)) {
                setShowMore(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showMore]);

    // Close global dropdown on outside click
    React.useEffect(() => {
        if (!showGlobalDropdown) return;
        const handler = (e) => {
            if (
                dropdownRef.current && !dropdownRef.current.contains(e.target) &&
                globalBtnRef.current && !globalBtnRef.current.contains(e.target)
            ) {
                setShowGlobalDropdown(false);
                setGlobalSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showGlobalDropdown]);

    const handleBookChange = useCallback((e) => {
        onSwitchBook(e.target.value);
    }, [onSwitchBook]);

    const handleCreate = useCallback(() => {
        setPromptMode('create');
        setPromptValue('');
        setShowMore(false);
    }, []);

    const handleRename = useCallback(() => {
        setPromptMode('rename');
        setPromptValue(activeBookName);
        setShowMore(false);
    }, [activeBookName]);

    const handleDuplicate = useCallback(() => {
        setPromptMode('duplicate');
        setPromptValue(`${activeBookName} (copy)`);
        setShowMore(false);
    }, [activeBookName]);

    const handlePromptSubmit = useCallback(() => {
        const name = promptValue.trim();
        if (!name) return;

        if (promptMode === 'create') {
            onCreateBook(name);
        } else if (promptMode === 'rename') {
            onRenameBook(activeBookName, name);
        } else if (promptMode === 'duplicate') {
            onDuplicateBook(activeBookName, name);
        }
        setPromptMode(null);
        setPromptValue('');
    }, [promptMode, promptValue, activeBookName, onCreateBook, onRenameBook, onDuplicateBook]);

    const handlePromptKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handlePromptSubmit();
        } else if (e.key === 'Escape') {
            setPromptMode(null);
        }
    }, [handlePromptSubmit]);

    const handleImportClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (file) {
            onImportBook(file);
            e.target.value = ''; // Reset for re-import
        }
    }, [onImportBook]);

    const handleExport = useCallback(() => {
        if (activeBookName) {
            onExportBook(activeBookName);
        }
    }, [activeBookName, onExportBook]);

    const handleDeleteConfirm = useCallback(() => {
        if (activeBookName) {
            onDeleteBook(activeBookName);
        }
        setShowDeleteConfirm(false);
    }, [activeBookName, onDeleteBook]);

    const handleToggleGlobalDropdown = useCallback(() => {
        if (showGlobalDropdown) {
            setShowGlobalDropdown(false);
            setGlobalSearch('');
            return;
        }
        // Position dropdown below the trigger button
        if (globalBtnRef.current) {
            const rect = globalBtnRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 4,
                left: Math.min(rect.left, window.innerWidth - 290),
            });
        }
        setShowGlobalDropdown(true);
        setGlobalSearch('');
    }, [showGlobalDropdown]);

    // Filtered book list for dropdown search
    const filteredBooks = useMemo(() => {
        if (!globalSearch.trim()) return bookList;
        const q = globalSearch.toLowerCase();
        return bookList.filter(b => b.name.toLowerCase().includes(q));
    }, [bookList, globalSearch]);

    const enabledCount = globalBooks.length;

    return (
        <>
            <div style={s.container}>
                <select
                    style={s.select}
                    value={activeBookName}
                    onChange={handleBookChange}
                >
                    <option value="">Select a World Book...</option>
                    {bookList.map(book => (
                        <option key={book.name} value={book.name}>
                            {book.name}{isDirty && book.name === activeBookName ? ' *' : ''}
                        </option>
                    ))}
                </select>

                <button
                    style={s.btn}
                    onClick={handleCreate}
                    title="New Book"
                    type="button"
                >
                    <Plus size={16} />
                </button>

                <button
                    style={s.btn}
                    onClick={handleImportClick}
                    title="Import Book"
                    type="button"
                >
                    <Upload size={16} />
                </button>

                <button
                    style={{
                        ...s.btn,
                        opacity: activeBookName ? 1 : 0.4,
                        pointerEvents: activeBookName ? 'auto' : 'none',
                    }}
                    onClick={handleExport}
                    title="Export Book"
                    type="button"
                >
                    <Download size={16} />
                </button>

                <div style={{ position: 'relative' }} ref={moreRef}>
                    <button
                        style={{
                            ...s.btn,
                            opacity: activeBookName ? 1 : 0.4,
                            pointerEvents: activeBookName ? 'auto' : 'none',
                        }}
                        onClick={() => setShowMore(!showMore)}
                        title="More actions"
                        type="button"
                    >
                        <MoreVertical size={16} />
                    </button>

                    {showMore && (
                        <div style={s.moreMenu}>
                            <button
                                style={s.menuItem}
                                onClick={handleRename}
                                type="button"
                            >
                                <Pencil size={14} /> Rename
                            </button>
                            <button
                                style={s.menuItem}
                                onClick={handleDuplicate}
                                type="button"
                            >
                                <Copy size={14} /> Duplicate
                            </button>
                            <button
                                style={{ ...s.menuItem, ...s.menuItemDanger }}
                                onClick={() => { setShowDeleteConfirm(true); setShowMore(false); }}
                                type="button"
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.lorebook"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />
            </div>

            {/* Global world books: dropdown trigger + enabled pills */}
            {bookList.length > 0 && onToggleGlobalBook && (
                <div style={s.globalRow}>
                    <button
                        ref={globalBtnRef}
                        style={{
                            ...s.globalTrigger,
                            ...(showGlobalDropdown ? s.globalTriggerActive : {}),
                        }}
                        onClick={handleToggleGlobalDropdown}
                        title="Manage globally active world books"
                        type="button"
                    >
                        <Globe size={12} />
                        Active{enabledCount > 0 ? ` (${enabledCount})` : ''}
                        <ChevronDown size={11} style={{
                            transition: 'transform 0.15s ease',
                            transform: showGlobalDropdown ? 'rotate(180deg)' : 'none',
                        }} />
                    </button>

                    <div style={s.pillsWrap}>
                        {globalBooks.length === 0 && (
                            <span style={s.noPills}>No global books enabled</span>
                        )}
                        {globalBooks.map(name => (
                            <span key={name} style={s.enabledPill} title={name}>
                                <span style={s.pillName}>{name}</span>
                                <span
                                    style={s.pillX}
                                    onClick={() => onToggleGlobalBook(name)}
                                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
                                    title={`Disable "${name}"`}
                                >
                                    <X size={10} />
                                </span>
                            </span>
                        ))}
                    </div>

                    {/* Searchable checklist dropdown — portaled */}
                    {showGlobalDropdown && dropdownPos && createPortal(
                        <div
                            ref={dropdownRef}
                            style={{
                                ...s.dropdownPopover,
                                top: dropdownPos.top,
                                left: dropdownPos.left,
                            }}
                        >
                            <div style={s.dropdownSearch}>
                                <Search size={13} style={{ color: 'var(--lumiverse-text-dim)', flexShrink: 0 }} />
                                <input
                                    style={s.dropdownSearchInput}
                                    type="text"
                                    placeholder="Search books..."
                                    value={globalSearch}
                                    onChange={(e) => setGlobalSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div style={s.dropdownList}>
                                {filteredBooks.length === 0 && (
                                    <div style={s.dropdownEmpty}>No matching books</div>
                                )}
                                {filteredBooks.map(book => {
                                    const checked = globalBooks.includes(book.name);
                                    return (
                                        <button
                                            key={book.name}
                                            style={s.dropdownItem}
                                            onClick={() => onToggleGlobalBook(book.name)}
                                            type="button"
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'var(--lumiverse-fill-subtle, rgba(255,255,255,0.05))';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'none';
                                            }}
                                        >
                                            <span style={{
                                                ...s.dropdownCheckbox,
                                                ...(checked ? s.dropdownCheckboxChecked : {}),
                                            }}>
                                                {checked && (
                                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                        <path d="M2 5L4.5 7.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                )}
                                            </span>
                                            <span style={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                color: checked ? 'var(--lumiverse-primary)' : undefined,
                                            }}>
                                                {book.name}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>,
                        document.body
                    )}
                </div>
            )}

            {/* Inline prompt for create/rename/duplicate */}
            {promptMode && (
                <div style={{
                    display: 'flex',
                    gap: '6px',
                    padding: '0 0 12px',
                    alignItems: 'center',
                }}>
                    <input
                        type="text"
                        value={promptValue}
                        onChange={(e) => setPromptValue(e.target.value)}
                        onKeyDown={handlePromptKeyDown}
                        autoFocus
                        placeholder={
                            promptMode === 'create' ? 'New book name...' :
                            promptMode === 'rename' ? 'New name...' :
                            'Copy name...'
                        }
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: 'var(--lumiverse-bg, rgba(0,0,0,0.2))',
                            border: '1px solid var(--lumiverse-primary)',
                            borderRadius: '8px',
                            color: 'var(--lumiverse-text)',
                            fontSize: '13px',
                            fontFamily: 'inherit',
                        }}
                    />
                    <button
                        style={{
                            ...s.btn,
                            background: 'var(--lumiverse-primary)',
                            color: '#fff',
                            border: 'none',
                            padding: '7px 14px',
                            fontSize: '12px',
                            fontWeight: 600,
                        }}
                        onClick={handlePromptSubmit}
                        type="button"
                    >
                        {promptMode === 'create' ? 'Create' : promptMode === 'rename' ? 'Rename' : 'Duplicate'}
                    </button>
                    <button
                        style={s.btn}
                        onClick={() => setPromptMode(null)}
                        type="button"
                        title="Cancel"
                    >
                        &times;
                    </button>
                </div>
            )}

            {/* Delete confirmation */}
            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onCancel={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete World Book"
                message={`Are you sure you want to delete "${activeBookName}"? This cannot be undone.`}
                confirmText="Delete"
                variant="danger"
            />
        </>
    );
}
