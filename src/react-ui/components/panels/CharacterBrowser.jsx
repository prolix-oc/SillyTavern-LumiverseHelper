import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import {
    Search, X, User, UsersRound, Star, ChevronDown, ArrowUpDown,
    Grid3x3, List, Tag, FolderOpen, Loader2, Pencil, ChevronRight, Check,
    GripVertical, RotateCcw, Maximize2, Plus, UserPlus, FileUp, Globe, Upload,
} from 'lucide-react';
import {
    DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import useCharacterBrowser from '../../hooks/useCharacterBrowser';
import useIsMobile from '../../hooks/useIsMobile';
import LazyImage from '../shared/LazyImage';
import CharacterCardEditor from './CharacterCardEditor';
import { useLumiverseStore, useLumiverseActions } from '../../store/LumiverseContext';
import { IMPORT_ACCEPTED_TYPES } from '../../../lib/characterBrowserService';

const store = useLumiverseStore;

// ─── Search Input ──────────────────────────────────────────────
function SearchInput({ value, onChange, placeholder }) {
    return (
        <div className="lumiverse-cb-search">
            <span className="lumiverse-cb-search-icon">
                <Search size={16} strokeWidth={1.5} />
            </span>
            <input
                type="text"
                className="lumiverse-cb-search-input"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {value && (
                <button
                    className="lumiverse-cb-search-clear"
                    onClick={() => onChange('')}
                    type="button"
                >
                    <X size={14} strokeWidth={2} />
                </button>
            )}
        </div>
    );
}

// ─── Filter Tabs ───────────────────────────────────────────────
const FILTER_OPTIONS = [
    { id: 'all', label: 'All' },
    { id: 'characters', label: 'Chars' },
    { id: 'groups', label: 'Groups' },
    { id: 'favorites', label: 'Favs' },
];

function FilterTabs({ activeFilter, onFilterChange }) {
    return (
        <div className="lumiverse-cb-filters">
            {FILTER_OPTIONS.map((f) => (
                <button
                    key={f.id}
                    className={clsx('lumiverse-cb-filter-btn', activeFilter === f.id && 'lumiverse-cb-filter-btn--active')}
                    onClick={() => onFilterChange(f.id)}
                    type="button"
                >
                    {f.label}
                </button>
            ))}
        </div>
    );
}

// ─── Sort Dropdown ─────────────────────────────────────────────
const SORT_OPTIONS = [
    { id: 'name', label: 'Name' },
    { id: 'recent', label: 'Recent' },
    { id: 'created', label: 'Created' },
    { id: 'size', label: 'Size' },
];

function SortDropdown({ sortBy, onSortChange, sortDirection, onToggleDirection, isOpen, onToggle }) {
    const ref = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onToggle(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen, onToggle]);

    return (
        <div className="lumiverse-cb-sort" ref={ref}>
            <button
                className="lumiverse-cb-sort-btn"
                onClick={() => onToggle(!isOpen)}
                type="button"
                title="Sort by"
            >
                <ArrowUpDown size={14} strokeWidth={1.5} />
                <span className="lumiverse-cb-sort-label">{SORT_OPTIONS.find(s => s.id === sortBy)?.label}</span>
                <ChevronDown size={12} strokeWidth={2} className={clsx('lumiverse-cb-sort-chevron', isOpen && 'lumiverse-cb-sort-chevron--open')} />
            </button>
            {isOpen && (
                <div className="lumiverse-cb-sort-dropdown">
                    {SORT_OPTIONS.map((opt) => (
                        <button
                            key={opt.id}
                            className={clsx('lumiverse-cb-sort-option', sortBy === opt.id && 'lumiverse-cb-sort-option--active')}
                            onClick={() => { onSortChange(opt.id); onToggle(false); }}
                            type="button"
                        >
                            {opt.label}
                        </button>
                    ))}
                    <div className="lumiverse-cb-sort-divider" />
                    <button
                        className="lumiverse-cb-sort-option"
                        onClick={() => { onToggleDirection(); onToggle(false); }}
                        type="button"
                    >
                        {sortDirection === 'asc' ? 'Descending' : 'Ascending'}
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── View Toggle ───────────────────────────────────────────────
function ViewToggle({ viewMode, onToggle }) {
    return (
        <button
            className="lumiverse-cb-view-toggle"
            onClick={() => onToggle(viewMode === 'grid' ? 'list' : 'grid')}
            type="button"
            title={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
        >
            {viewMode === 'grid' ? <List size={15} strokeWidth={1.5} /> : <Grid3x3 size={15} strokeWidth={1.5} />}
        </button>
    );
}

// ─── Add (Import) Menu ──────────────────────────────────────────
function AddMenu({ isOpen, onToggle, onCreateNew, onImportFile, onImportUrl }) {
    const ref = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onToggle(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen, onToggle]);

    return (
        <div className="lumiverse-cb-add" ref={ref}>
            <button
                className="lumiverse-cb-add-btn"
                onClick={() => onToggle(!isOpen)}
                type="button"
                title="Add character"
            >
                <Plus size={15} strokeWidth={2} />
            </button>
            {isOpen && (
                <div className="lumiverse-cb-add-dropdown">
                    <button
                        className="lumiverse-cb-add-option"
                        onClick={() => { onCreateNew(); onToggle(false); }}
                        type="button"
                    >
                        <UserPlus size={14} strokeWidth={1.5} />
                        <span>Create New</span>
                    </button>
                    <button
                        className="lumiverse-cb-add-option"
                        onClick={() => { onImportFile(); onToggle(false); }}
                        type="button"
                    >
                        <FileUp size={14} strokeWidth={1.5} />
                        <span>Import File</span>
                    </button>
                    <button
                        className="lumiverse-cb-add-option"
                        onClick={() => { onImportUrl(); onToggle(false); }}
                        type="button"
                    >
                        <Globe size={14} strokeWidth={1.5} />
                        <span>Import URL</span>
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Tag Multi-Select Dropdown ─────────────────────────────────
function TagMultiSelect({ tags, selectedTags, onToggleTag, onClear, isOpen, onToggle }) {
    const ref = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onToggle(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen, onToggle]);

    if (tags.length === 0) return null;

    const count = selectedTags.size;

    return (
        <div className="lumiverse-cb-tag-select" ref={ref}>
            <button
                className={clsx('lumiverse-cb-tag-select-btn', count > 0 && 'lumiverse-cb-tag-select-btn--active')}
                onClick={() => onToggle(!isOpen)}
                type="button"
                title="Filter by tags"
            >
                <Tag size={14} strokeWidth={1.5} />
                <span className="lumiverse-cb-tag-select-label">Tags</span>
                {count > 0 && <span className="lumiverse-cb-tag-select-badge">{count}</span>}
                <ChevronDown size={12} strokeWidth={2} className={clsx('lumiverse-cb-sort-chevron', isOpen && 'lumiverse-cb-sort-chevron--open')} />
            </button>
            {isOpen && (
                <div className="lumiverse-cb-tag-select-dropdown">
                    {count > 0 && (
                        <>
                            <button
                                className="lumiverse-cb-tag-select-item lumiverse-cb-tag-select-clear"
                                onClick={() => { onClear(); onToggle(false); }}
                                type="button"
                            >
                                <X size={12} strokeWidth={2} />
                                <span>Clear all</span>
                            </button>
                            <div className="lumiverse-cb-sort-divider" />
                        </>
                    )}
                    <div className="lumiverse-cb-tag-select-list">
                        {tags.map((tag) => {
                            const isSelected = selectedTags.has(tag.id);
                            return (
                                <button
                                    key={tag.id}
                                    className={clsx('lumiverse-cb-tag-select-item', isSelected && 'lumiverse-cb-tag-select-item--active')}
                                    onClick={() => onToggleTag(tag.id)}
                                    type="button"
                                >
                                    {tag.bg ? (
                                        <span className="lumiverse-cb-tag-select-dot" style={{ background: tag.bg }} />
                                    ) : (
                                        <span className="lumiverse-cb-tag-select-dot lumiverse-cb-tag-select-dot--neutral" />
                                    )}
                                    <span className="lumiverse-cb-tag-select-name">{tag.name}</span>
                                    {isSelected && <Check size={13} strokeWidth={2.5} className="lumiverse-cb-tag-select-check" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Favorites Slider ──────────────────────────────────────────
function FavoritesSlider({ items, activeCharacterId, onSelect }) {
    if (!items || items.length === 0) return null;
    return (
        <div className="lumiverse-cb-favorites">
            <div className="lumiverse-cb-favorites-scroll">
                {items.map((item) => (
                    <button
                        key={item.id}
                        className={clsx('lumiverse-cb-fav-item', item.id === activeCharacterId && 'lumiverse-cb-fav-item--active')}
                        onClick={() => onSelect(item)}
                        type="button"
                        title={item.name}
                    >
                        <div className="lumiverse-cb-fav-avatar">
                            {item.avatarUrl ? (
                                <img src={item.avatarUrl} alt="" loading="lazy" />
                            ) : (
                                <User size={20} strokeWidth={1.5} />
                            )}
                        </div>
                        <span className="lumiverse-cb-fav-name">{item.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Group Avatar Stack ────────────────────────────────────────
// Mirrors the Landing Page's GroupAvatarStack layout: 2/3/4/5+ member grids
function GroupAvatarStack({ members }) {
    const totalMembers = (members || []).length;
    if (totalMembers === 0) return <UsersRound size={28} strokeWidth={1} />;

    const maxAvatars = totalMembers >= 5 ? 3 : 4;
    const shown = members.slice(0, maxAvatars);
    const overflow = totalMembers > maxAvatars ? totalMembers - maxAvatars : 0;
    const countAttr = totalMembers >= 5 ? '5+' : String(totalMembers);

    return (
        <div className="lumiverse-cb-group-stack" data-count={countAttr}>
            {shown.map((m, i) => (
                <div
                    key={`${m.avatar || i}`}
                    className="lumiverse-cb-group-avatar"
                    style={{ zIndex: maxAvatars - i }}
                >
                    {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt="" loading="lazy" />
                    ) : (
                        <User size={14} strokeWidth={1.5} />
                    )}
                </div>
            ))}
            {overflow > 0 && (
                <div className="lumiverse-cb-group-overflow">
                    <span>+{overflow}</span>
                </div>
            )}
        </div>
    );
}

// ─── Character Card (Grid) ─────────────────────────────────────
const CharacterCardGrid = memo(function CharacterCardGrid({
    item, isActive, onSelect, onToggleFavorite,
}) {
    const showGroupStack = item.isGroup && item.members?.length > 0;
    return (
        <button
            className={clsx('lumiverse-cb-card', isActive && 'lumiverse-cb-card--active')}
            onClick={() => onSelect(item)}
            type="button"
        >
            <div className="lumiverse-cb-card-avatar">
                {showGroupStack ? (
                    <GroupAvatarStack members={item.members} />
                ) : item.avatarUrl ? (
                    <LazyImage src={item.avatarUrl} alt={item.name} />
                ) : (
                    <div className="lumiverse-cb-card-placeholder">
                        {item.isGroup ? <UsersRound size={28} strokeWidth={1} /> : <User size={28} strokeWidth={1} />}
                    </div>
                )}
                {item.isGroup && (
                    <span className="lumiverse-cb-card-group-badge" title="Group">
                        <UsersRound size={10} strokeWidth={2} />
                        <span>{item.memberCount}</span>
                    </span>
                )}
            </div>
            <div className="lumiverse-cb-card-info">
                <span className="lumiverse-cb-card-name" title={item.name}>{item.name}</span>
                {item.creator && <span className="lumiverse-cb-card-creator">{item.creator}</span>}
                {item.tagNames.length > 0 && (
                    <div className="lumiverse-cb-card-tags">
                        {item.tagNames.slice(0, 2).map((tag, i) => {
                            const tc = item.tagColors?.[i];
                            const pillStyle = tc?.bg ? { background: tc.bg, color: tc.fg || '#fff', borderColor: 'transparent' } : undefined;
                            return (
                                <span key={i} className="lumiverse-cb-card-tag-pill" style={pillStyle}>{tag}</span>
                            );
                        })}
                        {item.tagNames.length > 2 && (
                            <span className="lumiverse-cb-card-tag-pill lumiverse-cb-card-tag-more">+{item.tagNames.length - 2}</span>
                        )}
                    </div>
                )}
            </div>
            <button
                className={clsx('lumiverse-cb-card-star', item.isFavorite && 'lumiverse-cb-card-star--active')}
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
                type="button"
                title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
                <Star size={13} strokeWidth={item.isFavorite ? 0 : 1.5} fill={item.isFavorite ? 'currentColor' : 'none'} />
            </button>
        </button>
    );
}, areCardPropsEqual);

// ─── Character Card (List) ─────────────────────────────────────
const CharacterCardList = memo(function CharacterCardList({
    item, isActive, onSelect, onToggleFavorite,
}) {
    return (
        <button
            className={clsx('lumiverse-cb-list-row', isActive && 'lumiverse-cb-list-row--active')}
            onClick={() => onSelect(item)}
            type="button"
        >
            <div className="lumiverse-cb-list-avatar">
                {item.avatarUrl ? (
                    <img src={item.avatarUrl} alt="" loading="lazy" />
                ) : item.isGroup ? (
                    <UsersRound size={18} strokeWidth={1.5} />
                ) : (
                    <User size={18} strokeWidth={1.5} />
                )}
            </div>
            <span className="lumiverse-cb-list-name" title={item.name}>{item.name}</span>
            {item.creator && <span className="lumiverse-cb-list-creator">{item.creator}</span>}
            {item.tagNames.length > 0 && (
                <span className="lumiverse-cb-list-tags" title={item.tagNames.join(', ')}>
                    <Tag size={10} strokeWidth={1.5} />
                    {item.tagNames.length}
                </span>
            )}
            <button
                className={clsx('lumiverse-cb-card-star', item.isFavorite && 'lumiverse-cb-card-star--active')}
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
                type="button"
                title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
                <Star size={12} strokeWidth={item.isFavorite ? 0 : 1.5} fill={item.isFavorite ? 'currentColor' : 'none'} />
            </button>
        </button>
    );
}, areCardPropsEqual);

/** Custom memo comparator for character cards */
function areCardPropsEqual(prev, next) {
    return (
        prev.item.id === next.item.id &&
        prev.item.name === next.item.name &&
        prev.item.avatarUrl === next.item.avatarUrl &&
        prev.item.isFavorite === next.item.isFavorite &&
        prev.item.isGroup === next.item.isGroup &&
        prev.item.memberCount === next.item.memberCount &&
        prev.item.creator === next.item.creator &&
        prev.item.tagNames === next.item.tagNames &&
        prev.item.tagColors === next.item.tagColors &&
        prev.isActive === next.isActive &&
        prev.onSelect === next.onSelect &&
        prev.onToggleFavorite === next.onToggleFavorite
    );
}

// ─── Folder Header Button (shared between static and sortable) ──
function FolderHeaderButton({ folder, effectiveOpen, onToggle }) {
    return (
        <button
            className="lumiverse-cb-folder-header"
            onClick={onToggle}
            type="button"
        >
            <ChevronDown
                size={14}
                strokeWidth={2}
                className={clsx('lumiverse-cb-folder-chevron', effectiveOpen && 'lumiverse-cb-folder-chevron--open')}
            />
            <FolderOpen size={14} strokeWidth={1.5} />
            <span className="lumiverse-cb-folder-name">{folder.name}</span>
            <span className="lumiverse-cb-folder-count">{folder.count}</span>
        </button>
    );
}

// ─── Folder Section (static, no DnD) ───────────────────────────
function FolderSection({ folder, expandedFolders, onToggle, children }) {
    const handleToggle = useCallback(() => {
        onToggle(folder.defaultOpen ? `__closed_${folder.id}` : folder.id);
    }, [folder, onToggle]);

    const effectiveOpen = folder.defaultOpen
        ? !expandedFolders.has(`__closed_${folder.id}`)
        : expandedFolders.has(folder.id);

    return (
        <div className="lumiverse-cb-folder">
            <FolderHeaderButton folder={folder} effectiveOpen={effectiveOpen} onToggle={handleToggle} />
            {effectiveOpen && (
                <div className="lumiverse-cb-folder-content">
                    {children}
                </div>
            )}
        </div>
    );
}

// ─── Sortable Folder Section (DnD-enabled) ─────────────────────
function SortableFolderSection({ folder, expandedFolders, onToggle, children }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: folder.id });

    const handleToggle = useCallback(() => {
        onToggle(folder.defaultOpen ? `__closed_${folder.id}` : folder.id);
    }, [folder, onToggle]);

    const effectiveOpen = folder.defaultOpen
        ? !expandedFolders.has(`__closed_${folder.id}`)
        : expandedFolders.has(folder.id);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
    };

    return (
        <div className="lumiverse-cb-folder" ref={setNodeRef} style={style} {...attributes}>
            <div className="lumiverse-cb-folder-header-row">
                <span className="lumiverse-cb-folder-drag-handle" {...listeners}>
                    <GripVertical size={14} strokeWidth={1.5} />
                </span>
                <FolderHeaderButton folder={folder} effectiveOpen={effectiveOpen} onToggle={handleToggle} />
            </div>
            {effectiveOpen && (
                <div className="lumiverse-cb-folder-content">
                    {children}
                </div>
            )}
        </div>
    );
}

// ─── Active Character Bar ─────────────────────────────────────
function ActiveCharacterBar({ item, onClick }) {
    if (!item) return null;
    return (
        <button
            className="lumiverse-cb-active-bar"
            onClick={() => onClick(item)}
            type="button"
        >
            <div className="lumiverse-cb-active-bar-avatar">
                {item.avatarUrl ? (
                    <img src={item.avatarUrl} alt="" loading="lazy" />
                ) : (
                    <User size={14} strokeWidth={1.5} />
                )}
            </div>
            <span className="lumiverse-cb-active-bar-name">{item.name}</span>
            <span className="lumiverse-cb-active-bar-action">
                <Pencil size={11} strokeWidth={2} />
                <span>Edit</span>
                <ChevronRight size={12} strokeWidth={2} />
            </span>
        </button>
    );
}

// ─── Virtualized Character List ────────────────────────────────
function VirtualizedGrid({ items, activeCharacterId, onSelect, onToggleFavorite, containerRef }) {
    const isMobile = useIsMobile();
    const [cols, setCols] = useState(isMobile ? 2 : 3);

    // Compute columns from container width
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const observer = new ResizeObserver((entries) => {
            const w = entries[0].contentRect.width;
            const minCard = isMobile ? 120 : 140;
            setCols(Math.max(2, Math.floor(w / minCard)));
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [containerRef, isMobile]);

    const rows = useMemo(() => {
        const result = [];
        for (let i = 0; i < items.length; i += cols) {
            result.push(items.slice(i, i + cols));
        }
        return result;
    }, [items, cols]);

    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => 240,
        overscan: 5,
        measureElement: (el) => el?.getBoundingClientRect().height ?? 240,
    });

    return (
        <div
            style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
        >
            {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                    <div
                        key={virtualRow.key}
                        ref={virtualizer.measureElement}
                        data-index={virtualRow.index}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                        }}
                    >
                        <div className="lumiverse-cb-grid-row" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                            {row.map((item) => (
                                <CharacterCardGrid
                                    key={item.id}
                                    item={item}
                                    isActive={item.id === activeCharacterId}
                                    onSelect={onSelect}
                                    onToggleFavorite={onToggleFavorite}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function VirtualizedList({ items, activeCharacterId, onSelect, onToggleFavorite, containerRef }) {
    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => 48,
        overscan: 10,
    });

    return (
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
                const item = items[virtualRow.index];
                return (
                    <div
                        key={virtualRow.key}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                        }}
                    >
                        <CharacterCardList
                            item={item}
                            isActive={item.id === activeCharacterId}
                            onSelect={onSelect}
                            onToggleFavorite={onToggleFavorite}
                        />
                    </div>
                );
            })}
        </div>
    );
}

// ─── Main Character Browser Panel ──────────────────────────────
function CharacterBrowser({ wideMode = false, onDismiss } = {}) {
    const {
        characters, favoriteItems, tags, folderGroups, activeCharacterId, totalCount,
        searchQuery, setSearchQuery,
        sortBy, setSortBy, sortDirection, toggleSortDirection,
        filterType, setFilterType,
        selectedTags, toggleTag, clearTags,
        viewMode, setViewMode,
        expandedFolders, toggleFolder,
        selectCharacter: handleSelect, toggleFavorite,
        enableResortableTagFolders, tagFolderOrder, setTagFolderOrder, resetTagFolderOrder,
        importState, handleImportFiles, handleCreateCharacter,
    } = useCharacterBrowser();

    const isMobile = useIsMobile();
    const actions = useLumiverseActions();

    // DnD sensors (only instantiated when feature is enabled)
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
        useSensor(KeyboardSensor),
    );

    const handleFolderDragEnd = useCallback((event) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !folderGroups) return;
        const oldIndex = folderGroups.findIndex(f => f.id === active.id);
        const newIndex = folderGroups.findIndex(f => f.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        const reordered = arrayMove(folderGroups, oldIndex, newIndex);
        setTagFolderOrder(reordered.map(f => f.id));
    }, [folderGroups, setTagFolderOrder]);
    const scrollRef = useRef(null);
    const [isNavigating, setIsNavigating] = useState(false);

    // ─── Dropdown coordination (only one open at a time) ──
    const [openDropdown, setOpenDropdown] = useState(null); // 'sort' | 'tags' | 'add' | null
    const toggleSortDropdown = useCallback((open) => setOpenDropdown(open ? 'sort' : null), []);
    const toggleTagDropdown = useCallback((open) => setOpenDropdown(open ? 'tags' : null), []);
    const toggleAddDropdown = useCallback((open) => setOpenDropdown(open ? 'add' : null), []);

    // ─── File Import ─────────────────────────────────────────
    const fileInputRef = useRef(null);
    const handleFileInputChange = useCallback((e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleImportFiles(files);
        }
        // Reset input so the same file can be selected again
        e.target.value = '';
    }, [handleImportFiles]);

    const triggerFileInput = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    // ─── Drag and Drop ──────────────────────────────────────
    const [isDragOver, setIsDragOver] = useState(false);
    const dragCounterRef = useRef(0);

    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        if (e.dataTransfer?.types?.includes('Files')) {
            setIsDragOver(true);
        }
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0;
            setIsDragOver(false);
        }
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragOver(false);
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            handleImportFiles(files);
        }
    }, [handleImportFiles]);

    // ─── Editor View State ────────────────────────────────
    const [editorItem, setEditorItem] = useState(null);
    const savedScrollRef = useRef(0);

    // Restore scroll position when returning from editor
    useLayoutEffect(() => {
        if (!editorItem && scrollRef.current && savedScrollRef.current > 0) {
            scrollRef.current.scrollTop = savedScrollRef.current;
            savedScrollRef.current = 0;
        }
    }, [editorItem]);

    // Card click:
    //   - Groups → navigate to chat, stay on gallery
    //   - Characters (active) → open editor immediately
    //   - Characters (not active) → navigate to chat, then open editor
    const handleCardSelect = useCallback(async (item) => {
        if (!item.isGroup && item.id === activeCharacterId) {
            // Already in this character's chat — open editor directly
            if (scrollRef.current) {
                savedScrollRef.current = scrollRef.current.scrollTop;
            }
            setEditorItem(item);
            return;
        }

        if (isNavigating) return;
        setIsNavigating(true);
        try {
            await handleSelect(item);
            // Re-assert panel visibility — ST may close panels during navigation
            store.setState({ _ensureTab: 'characters' });
            // For characters, transition to editor after navigation
            if (!item.isGroup) {
                if (scrollRef.current) {
                    savedScrollRef.current = scrollRef.current.scrollTop;
                }
                setEditorItem(item);
            }
        } finally {
            setIsNavigating(false);
        }
    }, [handleSelect, isNavigating, activeCharacterId]);

    // Wide mode: navigate to chat + dismiss modal (no editor)
    const handleCardSelectWide = useCallback(async (item) => {
        if (isNavigating) return;
        setIsNavigating(true);
        try {
            await handleSelect(item);
            onDismiss?.();
        } finally {
            setIsNavigating(false);
        }
    }, [handleSelect, isNavigating, onDismiss]);

    const cardSelectHandler = wideMode ? handleCardSelectWide : handleCardSelect;

    // Open chat from editor
    const handleOpenChat = useCallback(async () => {
        if (!editorItem || isNavigating) return;
        setIsNavigating(true);
        try {
            await handleSelect(editorItem);
        } finally {
            setIsNavigating(false);
            setEditorItem(null);
        }
    }, [editorItem, handleSelect, isNavigating]);

    // Render folder-grouped content
    const renderFolderContent = useCallback((folderItems) => {
        if (viewMode === 'grid') {
            const minCard = wideMode ? 200 : isMobile ? 120 : 140;
            return (
                <div className="lumiverse-cb-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minCard}px, 1fr))` }}>
                    {folderItems.map((item) => (
                        <CharacterCardGrid
                            key={item.id}
                            item={item}
                            isActive={item.id === activeCharacterId}
                            onSelect={cardSelectHandler}
                            onToggleFavorite={toggleFavorite}
                        />
                    ))}
                </div>
            );
        }
        return folderItems.map((item) => (
            <CharacterCardList
                key={item.id}
                item={item}
                isActive={item.id === activeCharacterId}
                onSelect={cardSelectHandler}
                onToggleFavorite={toggleFavorite}
            />
        ));
    }, [viewMode, wideMode, isMobile, activeCharacterId, cardSelectHandler, toggleFavorite]);

    const hasCharacters = totalCount > 0;

    // Resolve the active character item for the "Edit" bar
    const activeCharItem = useMemo(() => {
        if (!activeCharacterId || activeCharacterId.startsWith('group:')) return null;
        return characters.find((c) => c.id === activeCharacterId)
            || favoriteItems.find((c) => c.id === activeCharacterId)
            || null;
    }, [activeCharacterId, characters, favoriteItems]);

    // Open editor for the active character
    const handleEditActive = useCallback((item) => {
        if (scrollRef.current) {
            savedScrollRef.current = scrollRef.current.scrollTop;
        }
        setEditorItem(item);
    }, []);

    // Editor view — rendered instead of gallery when a character is selected
    if (editorItem && !wideMode) {
        return (
            <CharacterCardEditor
                item={editorItem}
                onBack={() => setEditorItem(null)}
                onOpenChat={handleOpenChat}
            />
        );
    }

    return (
        <div className={clsx('lumiverse-cb-panel', wideMode && 'lumiverse-cb-panel--wide')}>
            {/* Active Character Edit Bar */}
            {!wideMode && <ActiveCharacterBar item={activeCharItem} onClick={handleEditActive} />}

            {/* Favorites Slider */}
            <FavoritesSlider
                items={favoriteItems}
                activeCharacterId={activeCharacterId}
                onSelect={cardSelectHandler}
            />

            {/* Hidden file input for import */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={IMPORT_ACCEPTED_TYPES}
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
            />

            {/* Toolbar */}
            <div className="lumiverse-cb-toolbar">
                <div className="lumiverse-cb-search-row">
                    <SearchInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search characters..."
                    />
                    <AddMenu
                        isOpen={openDropdown === 'add'}
                        onToggle={toggleAddDropdown}
                        onCreateNew={handleCreateCharacter}
                        onImportFile={triggerFileInput}
                        onImportUrl={() => actions.openModal('importUrl')}
                    />
                </div>
                <FilterTabs activeFilter={filterType} onFilterChange={setFilterType} />
                <div className="lumiverse-cb-toolbar-actions">
                    <TagMultiSelect
                        tags={tags}
                        selectedTags={selectedTags}
                        onToggleTag={toggleTag}
                        onClear={clearTags}
                        isOpen={openDropdown === 'tags'}
                        onToggle={toggleTagDropdown}
                    />
                    <SortDropdown
                        sortBy={sortBy}
                        onSortChange={setSortBy}
                        sortDirection={sortDirection}
                        onToggleDirection={toggleSortDirection}
                        isOpen={openDropdown === 'sort'}
                        onToggle={toggleSortDropdown}
                    />
                    <ViewToggle viewMode={viewMode} onToggle={setViewMode} />
                    {!isMobile && !wideMode && (
                        <button
                            className="lumiverse-cb-expand-btn"
                            onClick={() => {
                                store.setState({ _closeDrawer: Date.now() });
                                actions.openModal('characterGallery');
                            }}
                            type="button"
                            title="Open wide gallery view"
                        >
                            <Maximize2 size={15} strokeWidth={1.5} />
                        </button>
                    )}
                </div>
            </div>

            {/* Character List */}
            <div
                className="lumiverse-cb-list-container"
                ref={scrollRef}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {!hasCharacters ? (
                    <div className="lumiverse-cb-empty">
                        <User size={32} strokeWidth={1} />
                        <span>No characters found</span>
                        <span className="lumiverse-cb-empty-sub">Characters will appear here once SillyTavern loads</span>
                    </div>
                ) : characters.length === 0 ? (
                    <div className="lumiverse-cb-empty">
                        <Search size={24} strokeWidth={1} />
                        <span>No matches</span>
                        <span className="lumiverse-cb-empty-sub">Try adjusting your search or filters</span>
                    </div>
                ) : folderGroups && enableResortableTagFolders && !wideMode ? (
                    // Sortable folder view with DnD (sidebar only)
                    <>
                        {tagFolderOrder.length > 0 && (
                            <div className="lumiverse-cb-folder-reset-row">
                                <button
                                    className="lumiverse-cb-folder-reset-btn"
                                    onClick={resetTagFolderOrder}
                                    type="button"
                                    title="Reset to default folder order"
                                >
                                    <RotateCcw size={11} strokeWidth={2} />
                                    <span>Reset Order</span>
                                </button>
                            </div>
                        )}
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFolderDragEnd}>
                            <SortableContext items={folderGroups.map(f => f.id)} strategy={verticalListSortingStrategy}>
                                {folderGroups.map((folder) => (
                                    <SortableFolderSection
                                        key={folder.id}
                                        folder={folder}
                                        expandedFolders={expandedFolders}
                                        onToggle={toggleFolder}
                                    >
                                        {renderFolderContent(folder.items)}
                                    </SortableFolderSection>
                                ))}
                            </SortableContext>
                        </DndContext>
                    </>
                ) : folderGroups ? (
                    // Static folder view (no DnD overhead)
                    folderGroups.map((folder) => (
                        <FolderSection
                            key={folder.id}
                            folder={folder}
                            expandedFolders={expandedFolders}
                            onToggle={toggleFolder}
                        >
                            {renderFolderContent(folder.items)}
                        </FolderSection>
                    ))
                ) : viewMode === 'grid' ? (
                    <VirtualizedGrid
                        items={characters}
                        activeCharacterId={activeCharacterId}
                        onSelect={cardSelectHandler}
                        onToggleFavorite={toggleFavorite}
                        containerRef={scrollRef}
                    />
                ) : (
                    <VirtualizedList
                        items={characters}
                        activeCharacterId={activeCharacterId}
                        onSelect={cardSelectHandler}
                        onToggleFavorite={toggleFavorite}
                        containerRef={scrollRef}
                    />
                )}

                {/* Drag-and-drop overlay */}
                {isDragOver && (
                    <div className="lumiverse-cb-drop-overlay">
                        <Upload size={28} strokeWidth={1.5} />
                        <span>Drop to import</span>
                    </div>
                )}
            </div>

            {/* Status bar */}
            <div className="lumiverse-cb-status">
                <span>{characters.length} of {totalCount}</span>
            </div>

            {/* Loading overlay — navigation */}
            {isNavigating && (
                <div className="lumiverse-cb-loading-overlay">
                    <Loader2 size={24} strokeWidth={1.5} className="lumiverse-cb-spinner" />
                    <span>Loading chat&hellip;</span>
                </div>
            )}

            {/* Loading overlay — import */}
            {importState.isImporting && (
                <div className="lumiverse-cb-loading-overlay">
                    <Loader2 size={24} strokeWidth={1.5} className="lumiverse-cb-spinner" />
                    <span>Importing&hellip;</span>
                </div>
            )}
        </div>
    );
}

export default CharacterBrowser;
