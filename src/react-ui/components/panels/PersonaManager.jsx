/**
 * PersonaManager — Glassmorphic persona management panel for the Lumiverse viewport.
 *
 * Avatar-first card grid with inline editor expansion, lock badges,
 * search/filter, grid/list toggle, and streamlined create flow.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react';
import clsx from 'clsx';
import {
    Search, X, Plus, Grid3x3, List, ArrowUpDown, ChevronDown, User,
    Crown, Lock, Link2, Upload, Copy, Trash2, RefreshCw, Check,
    FileText, Shield, BookOpen, UserCheck,
} from 'lucide-react';
import usePersonaManager from '../../hooks/usePersonaManager';
import { fetchBookList } from '../../../lib/worldBookService';
import { personaManagerStyles } from './PersonaManagerStyles';
import LazyImage from '../shared/LazyImage';

// ─── Style Injection ────────────────────────────────────────────
let stylesInjected = false;
function ensureStyles() {
    if (stylesInjected) return;
    const style = document.createElement('style');
    style.id = 'lumiverse-persona-manager-styles';
    style.textContent = personaManagerStyles;
    document.head.appendChild(style);
    stylesInjected = true;
}

// ─── Position / Role Label Helpers ──────────────────────────────
const POSITION_OPTIONS = [
    { value: 0, label: 'In Prompt' },
    { value: 2, label: 'Top A/N' },
    { value: 3, label: 'Bottom A/N' },
    { value: 4, label: 'At Depth' },
    { value: 9, label: 'Disabled' },
];

const ROLE_OPTIONS = [
    { value: 0, label: 'System' },
    { value: 1, label: 'User' },
    { value: 2, label: 'Assistant' },
];

// ─── Filter Options ─────────────────────────────────────────────
const FILTER_OPTIONS = [
    { id: 'all', label: 'All' },
    { id: 'default', label: 'Default' },
    { id: 'chatLocked', label: 'Chat Lock' },
    { id: 'connected', label: 'Connected' },
];

const SORT_OPTIONS = [
    { id: 'name', label: 'Name' },
];

// ─── Search Input ───────────────────────────────────────────────
function SearchInput({ value, onChange, placeholder }) {
    return (
        <div className="lumiverse-pm-search">
            <span className="lumiverse-pm-search-icon">
                <Search size={15} strokeWidth={1.5} />
            </span>
            <input
                type="text"
                className="lumiverse-pm-search-input"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {value && (
                <button
                    className="lumiverse-pm-search-clear"
                    onClick={() => onChange('')}
                    type="button"
                >
                    <X size={13} strokeWidth={2} />
                </button>
            )}
        </div>
    );
}

// ─── Filter Pills ───────────────────────────────────────────────
function FilterPills({ active, onChange }) {
    return (
        <div className="lumiverse-pm-filters">
            {FILTER_OPTIONS.map(f => (
                <button
                    key={f.id}
                    className={clsx('lumiverse-pm-filter-btn', active === f.id && 'lumiverse-pm-filter-btn--active')}
                    onClick={() => onChange(f.id)}
                    type="button"
                >
                    {f.label}
                </button>
            ))}
        </div>
    );
}

// ─── Sort Dropdown ──────────────────────────────────────────────
function SortDropdown({ sortBy, onSortChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen]);

    return (
        <div className="lumiverse-pm-sort" ref={ref}>
            <button
                className="lumiverse-pm-sort-btn"
                onClick={() => setIsOpen(!isOpen)}
                type="button"
                title="Sort by"
            >
                <ArrowUpDown size={13} strokeWidth={1.5} />
                <span>{SORT_OPTIONS.find(s => s.id === sortBy)?.label}</span>
                <ChevronDown size={11} strokeWidth={2} style={{ transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
            {isOpen && (
                <div className="lumiverse-pm-sort-dropdown">
                    {SORT_OPTIONS.map(opt => (
                        <button
                            key={opt.id}
                            className={clsx('lumiverse-pm-sort-option', sortBy === opt.id && 'lumiverse-pm-sort-option--active')}
                            onClick={() => { onSortChange(opt.id); setIsOpen(false); }}
                            type="button"
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── View Toggle ────────────────────────────────────────────────
function ViewToggle({ viewMode, onToggle }) {
    return (
        <button
            className="lumiverse-pm-icon-btn"
            onClick={() => onToggle(viewMode === 'grid' ? 'list' : 'grid')}
            type="button"
            title={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
        >
            {viewMode === 'grid' ? <List size={15} strokeWidth={1.5} /> : <Grid3x3 size={15} strokeWidth={1.5} />}
        </button>
    );
}

// ─── Lock Badges ────────────────────────────────────────────────
function LockBadges({ isDefault, isChatLocked, hasConnections, isActive }) {
    if (!isDefault && !isChatLocked && !hasConnections && !isActive) return null;
    return (
        <div className="lumiverse-pm-badges">
            {isActive && (
                <span className="lumiverse-pm-badge lumiverse-pm-badge--locked" title="Active">
                    <UserCheck size={10} strokeWidth={2.5} />
                </span>
            )}
            {isDefault && (
                <span className="lumiverse-pm-badge lumiverse-pm-badge--default" title="Default persona">
                    <Crown size={10} strokeWidth={2.5} />
                </span>
            )}
            {isChatLocked && (
                <span className="lumiverse-pm-badge lumiverse-pm-badge--locked" title="Chat locked">
                    <Lock size={10} strokeWidth={2.5} />
                </span>
            )}
            {hasConnections && (
                <span className="lumiverse-pm-badge lumiverse-pm-badge--connected" title="Has connections">
                    <Link2 size={10} strokeWidth={2.5} />
                </span>
            )}
        </div>
    );
}

// ─── Persona Card (Grid) ────────────────────────────────────────
const PersonaCardGrid = memo(function PersonaCardGrid({ persona, isSelected, onSelect, onDoubleClick }) {
    return (
        <div
            className={clsx(
                'lumiverse-pm-card',
                isSelected && 'lumiverse-pm-card--selected',
                persona.isActive && 'lumiverse-pm-card--active',
            )}
            onClick={() => onSelect(persona.avatarId)}
            onDoubleClick={() => onDoubleClick(persona.avatarId)}
            title={`${persona.name}${persona.title ? ` — ${persona.title}` : ''}`}
        >
            <LockBadges
                isDefault={persona.isDefault}
                isChatLocked={persona.isChatLocked}
                hasConnections={persona.hasConnections}
                isActive={persona.isActive}
            />
            <div className="lumiverse-pm-card-avatar">
                <LazyImage
                    src={persona.avatarUrl}
                    alt={persona.name}
                    spinnerSize={16}
                    fallback={
                        <div className="lumiverse-pm-card-avatar--placeholder" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={28} strokeWidth={1.5} />
                        </div>
                    }
                />
            </div>
            <span className="lumiverse-pm-card-name">{persona.name}</span>
        </div>
    );
});

// ─── Persona Card (List) ────────────────────────────────────────
const PersonaCardList = memo(function PersonaCardList({ persona, isSelected, onSelect, onDoubleClick }) {
    return (
        <div
            className={clsx(
                'lumiverse-pm-list-card',
                isSelected && 'lumiverse-pm-list-card--selected',
                persona.isActive && 'lumiverse-pm-list-card--active',
            )}
            onClick={() => onSelect(persona.avatarId)}
            onDoubleClick={() => onDoubleClick(persona.avatarId)}
        >
            <div className="lumiverse-pm-list-avatar">
                <LazyImage
                    src={persona.avatarUrl}
                    alt={persona.name}
                    spinnerSize={12}
                    fallback={<User size={18} strokeWidth={1.5} />}
                />
            </div>
            <div className="lumiverse-pm-list-info">
                <div className="lumiverse-pm-list-name">{persona.name}</div>
                {persona.title && <div className="lumiverse-pm-list-title">{persona.title}</div>}
            </div>
            <div className="lumiverse-pm-list-badges">
                <LockBadges
                    isDefault={persona.isDefault}
                    isChatLocked={persona.isChatLocked}
                    hasConnections={persona.hasConnections}
                    isActive={persona.isActive}
                />
            </div>
        </div>
    );
});

// ─── Create Persona Form ────────────────────────────────────────
function CreatePersonaForm({ onCreate, onCancel }) {
    const [name, setName] = useState('');
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = useCallback((e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        const reader = new FileReader();
        reader.onload = (ev) => setPreview(ev.target.result);
        reader.readAsDataURL(f);
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!name.trim() || !file) return;
        setIsSubmitting(true);
        await onCreate(name.trim(), file);
        setIsSubmitting(false);
    }, [name, file, onCreate]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') handleSubmit();
        if (e.key === 'Escape') onCancel();
    }, [handleSubmit, onCancel]);

    return (
        <div className="lumiverse-pm-create">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
            <div
                className="lumiverse-pm-create-avatar"
                onClick={() => fileInputRef.current?.click()}
                title="Choose avatar image"
            >
                {preview ? (
                    <LazyImage src={preview} alt="Avatar preview" spinnerSize={12} fallback={<Upload size={16} strokeWidth={1.5} />} />
                ) : (
                    <Upload size={16} strokeWidth={1.5} />
                )}
            </div>
            <input
                className="lumiverse-pm-create-input"
                placeholder="Persona name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
            />
            <div className="lumiverse-pm-create-actions">
                <button
                    className="lumiverse-pm-icon-btn lumiverse-pm-icon-btn--primary"
                    onClick={handleSubmit}
                    disabled={!name.trim() || !file || isSubmitting}
                    title="Create persona"
                    type="button"
                >
                    <Check size={15} strokeWidth={2} />
                </button>
                <button
                    className="lumiverse-pm-icon-btn"
                    onClick={onCancel}
                    title="Cancel"
                    type="button"
                >
                    <X size={15} strokeWidth={2} />
                </button>
            </div>
        </div>
    );
}

// ─── Toggle Switch ──────────────────────────────────────────────
function ToggleSwitch({ label, icon: Icon, isOn, onToggle }) {
    return (
        <div className="lumiverse-pm-toggle-row">
            <span className="lumiverse-pm-toggle-label">
                {Icon && <Icon size={14} strokeWidth={1.5} />}
                {label}
            </span>
            <div
                className={clsx('lumiverse-pm-toggle', isOn && 'lumiverse-pm-toggle--on')}
                onClick={onToggle}
                role="switch"
                aria-checked={isOn}
            >
                <div className="lumiverse-pm-toggle-knob" />
            </div>
        </div>
    );
}

// ─── Persona Editor (Inline) ────────────────────────────────────
function PersonaEditor({
    persona,
    onRename,
    onUpdateDescription,
    onUploadAvatar,
    onToggleDefault,
    onToggleChatLock,
    onDuplicate,
    onDelete,
    onSwitch,
    onSetLorebook,
    onAddConnection,
    onRemoveConnection,
}) {
    const [localName, setLocalName] = useState(persona.name);
    const [localTitle, setLocalTitle] = useState(persona.title);
    const [localDesc, setLocalDesc] = useState(persona.description);
    const [localPosition, setLocalPosition] = useState(persona.position);
    const [localDepth, setLocalDepth] = useState(persona.depth);
    const [localRole, setLocalRole] = useState(persona.role);
    const [localLorebook, setLocalLorebook] = useState(persona.lorebook);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [worldBookNames, setWorldBookNames] = useState(/** @type {string[]} */ ([]));
    const fileInputRef = useRef(null);

    // Fetch available world book names on mount / when persona changes
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const books = await fetchBookList();
                if (!cancelled) {
                    setWorldBookNames(books.map(b => b.name).sort());
                }
            } catch { /* ignore */ }
        })();
        return () => { cancelled = true; };
    }, [persona.avatarId]);

    // Re-sync locals when persona changes
    useEffect(() => {
        setLocalName(persona.name);
        setLocalTitle(persona.title);
        setLocalDesc(persona.description);
        setLocalPosition(persona.position);
        setLocalDepth(persona.depth);
        setLocalRole(persona.role);
        setLocalLorebook(persona.lorebook);
        setConfirmDelete(false);
    }, [persona.avatarId]);

    // Debounced save for text fields
    const saveTimerRef = useRef(null);
    const debouncedSave = useCallback((field, value) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            if (field === 'name') {
                onRename(persona.avatarId, value);
            } else {
                onUpdateDescription(persona.avatarId, { [field]: value });
            }
        }, 400);
    }, [persona.avatarId, onRename, onUpdateDescription]);

    const handleNameChange = useCallback((e) => {
        const v = e.target.value;
        setLocalName(v);
        debouncedSave('name', v);
    }, [debouncedSave]);

    const handleTitleChange = useCallback((e) => {
        const v = e.target.value;
        setLocalTitle(v);
        debouncedSave('title', v);
    }, [debouncedSave]);

    const handleDescChange = useCallback((e) => {
        const v = e.target.value;
        setLocalDesc(v);
        debouncedSave('description', v);
    }, [debouncedSave]);

    const handlePositionChange = useCallback((e) => {
        const v = Number(e.target.value);
        setLocalPosition(v);
        onUpdateDescription(persona.avatarId, { position: v });
    }, [persona.avatarId, onUpdateDescription]);

    const handleDepthChange = useCallback((e) => {
        const v = Number(e.target.value);
        setLocalDepth(v);
        onUpdateDescription(persona.avatarId, { depth: v });
    }, [persona.avatarId, onUpdateDescription]);

    const handleRoleChange = useCallback((e) => {
        const v = Number(e.target.value);
        setLocalRole(v);
        onUpdateDescription(persona.avatarId, { role: v });
    }, [persona.avatarId, onUpdateDescription]);

    const handleLorebookChange = useCallback((e) => {
        const v = e.target.value;
        setLocalLorebook(v);
        onSetLorebook(persona.avatarId, v);
    }, [persona.avatarId, onSetLorebook]);

    const handleAvatarUpload = useCallback(async (e) => {
        const f = e.target.files?.[0];
        if (f) await onUploadAvatar(persona.avatarId, f);
    }, [persona.avatarId, onUploadAvatar]);

    const handleDelete = useCallback(async () => {
        setIsDeleting(true);
        await onDelete(persona.avatarId);
        setIsDeleting(false);
    }, [persona.avatarId, onDelete]);

    // Avatar drop support
    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const f = e.dataTransfer?.files?.[0];
        if (f && f.type.startsWith('image/')) {
            await onUploadAvatar(persona.avatarId, f);
        }
    }, [persona.avatarId, onUploadAvatar]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    return (
        <div className="lumiverse-pm-editor">
            <div className="lumiverse-pm-editor-inner">
                {/* Identity Section */}
                <div className="lumiverse-pm-avatar-zone">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleAvatarUpload}
                    />
                    <div
                        className="lumiverse-pm-avatar-preview"
                        onClick={() => fileInputRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        title="Click or drop to change avatar"
                    >
                        <LazyImage
                            src={persona.avatarUrl}
                            alt={persona.name}
                            spinnerSize={16}
                            fallback={
                                <div className="lumiverse-pm-card-avatar--placeholder" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <User size={24} strokeWidth={1.5} />
                                </div>
                            }
                        />
                        <div className="lumiverse-pm-avatar-overlay">
                            <Upload size={18} strokeWidth={2} />
                        </div>
                    </div>
                    <div className="lumiverse-pm-avatar-fields">
                        <input
                            className="lumiverse-pm-input"
                            value={localName}
                            onChange={handleNameChange}
                            placeholder="Name"
                        />
                        <input
                            className="lumiverse-pm-input"
                            value={localTitle}
                            onChange={handleTitleChange}
                            placeholder="Title (optional)"
                        />
                    </div>
                </div>

                {/* Description Section */}
                <div>
                    <div className="lumiverse-pm-section-title">Description</div>
                    <textarea
                        className="lumiverse-pm-textarea"
                        value={localDesc}
                        onChange={handleDescChange}
                        placeholder="Persona description..."
                        rows={3}
                    />
                    <div className="lumiverse-pm-desc-controls" style={{ marginTop: '8px' }}>
                        <select
                            className="lumiverse-pm-desc-select"
                            value={localPosition}
                            onChange={handlePositionChange}
                            title="Injection position"
                        >
                            {POSITION_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        {localPosition === 4 && (
                            <input
                                className="lumiverse-pm-input"
                                type="number"
                                value={localDepth}
                                onChange={handleDepthChange}
                                placeholder="Depth"
                                style={{ width: '60px' }}
                                min={0}
                            />
                        )}
                        <select
                            className="lumiverse-pm-desc-select"
                            value={localRole}
                            onChange={handleRoleChange}
                            title="Message role"
                        >
                            {ROLE_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Locks Section */}
                <div>
                    <div className="lumiverse-pm-section-title">Locks</div>
                    <ToggleSwitch
                        label="Default Persona"
                        icon={Crown}
                        isOn={persona.isDefault}
                        onToggle={() => onToggleDefault(persona.avatarId)}
                    />
                    <ToggleSwitch
                        label="Lock to Chat"
                        icon={Lock}
                        isOn={persona.isChatLocked}
                        onToggle={() => onToggleChatLock(persona.avatarId, !persona.isChatLocked)}
                    />
                </div>

                {/* Persona Lore Section */}
                <div>
                    <div className="lumiverse-pm-section-title">
                        <BookOpen size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '4px' }} />
                        Persona Lore
                    </div>
                    <select
                        className="lumiverse-pm-desc-select"
                        value={localLorebook}
                        onChange={handleLorebookChange}
                        title="Attach a World Book to this persona"
                        style={{ width: '100%' }}
                    >
                        <option value="">None</option>
                        {worldBookNames.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                    {localLorebook && (
                        <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--lumiverse-text-dim)', lineHeight: 1.4 }}>
                            Lorebook entries from "{localLorebook}" will activate when this persona is selected.
                        </div>
                    )}
                </div>

                {/* Connections Section */}
                {persona.connections.length > 0 && (
                    <div>
                        <div className="lumiverse-pm-section-title">Connections</div>
                        <div className="lumiverse-pm-connections">
                            {persona.connections.map((conn, idx) => (
                                <div key={idx} className="lumiverse-pm-connection">
                                    <Link2 size={12} strokeWidth={1.5} />
                                    <span className="lumiverse-pm-connection-name">
                                        {conn.type}: {conn.id}
                                    </span>
                                    <button
                                        className="lumiverse-pm-connection-remove"
                                        onClick={() => onRemoveConnection(persona.avatarId, idx)}
                                        title="Remove connection"
                                        type="button"
                                    >
                                        <X size={12} strokeWidth={2} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="lumiverse-pm-actions">
                    <button
                        className="lumiverse-pm-btn lumiverse-pm-btn--primary"
                        onClick={() => onSwitch(persona.avatarId)}
                        type="button"
                    >
                        <UserCheck size={13} strokeWidth={2} /> Switch To
                    </button>
                    <button
                        className="lumiverse-pm-btn"
                        onClick={() => onDuplicate(persona.avatarId)}
                        type="button"
                    >
                        <Copy size={13} strokeWidth={1.5} /> Duplicate
                    </button>
                    {!confirmDelete ? (
                        <button
                            className="lumiverse-pm-btn lumiverse-pm-btn--danger"
                            onClick={() => setConfirmDelete(true)}
                            type="button"
                        >
                            <Trash2 size={13} strokeWidth={1.5} /> Delete
                        </button>
                    ) : (
                        <div className="lumiverse-pm-confirm">
                            <div className="lumiverse-pm-confirm-text">Delete "{persona.name}"?</div>
                            <div className="lumiverse-pm-confirm-actions">
                                <button
                                    className="lumiverse-pm-btn lumiverse-pm-btn--danger"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    type="button"
                                >
                                    {isDeleting ? 'Deleting...' : 'Confirm'}
                                </button>
                                <button
                                    className="lumiverse-pm-btn"
                                    onClick={() => setConfirmDelete(false)}
                                    type="button"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main PersonaManager Panel ──────────────────────────────────
export default function PersonaManager() {
    useEffect(() => { ensureStyles(); }, []);

    const {
        personas,
        totalCount,
        activePersonaId,
        selectedPersona,
        searchQuery,
        setSearchQuery,
        sortBy,
        setSortBy,
        filterLock,
        setFilterLock,
        viewMode,
        setViewMode,
        selectedPersonaId,
        setSelectedPersonaId,
        isCreating,
        setIsCreating,
        switchPersona: handleSwitch,
        createPersona: handleCreate,
        uploadAvatar,
        renamePersona: handleRename,
        updateDescription,
        deletePersona: handleDelete,
        duplicatePersona: handleDuplicate,
        toggleDefault,
        toggleChatLock,
        addConnection,
        removeConnection,
        setLorebook,
        refresh,
    } = usePersonaManager();

    const handleCardSelect = useCallback((avatarId) => {
        setSelectedPersonaId(prev => prev === avatarId ? null : avatarId);
    }, [setSelectedPersonaId]);

    const handleCardDoubleClick = useCallback((avatarId) => {
        handleSwitch(avatarId);
    }, [handleSwitch]);

    return (
        <div className="lumiverse-pm-root">
            {/* Toolbar */}
            <div className="lumiverse-pm-toolbar">
                <div className="lumiverse-pm-toolbar-row">
                    <SearchInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search personas..."
                    />
                    <ViewToggle viewMode={viewMode} onToggle={setViewMode} />
                    <SortDropdown sortBy={sortBy} onSortChange={setSortBy} />
                    <button
                        className={clsx('lumiverse-pm-icon-btn', isCreating && 'lumiverse-pm-icon-btn--primary')}
                        onClick={() => setIsCreating(!isCreating)}
                        title="Create new persona"
                        type="button"
                    >
                        <Plus size={16} strokeWidth={2} />
                    </button>
                    <button
                        className="lumiverse-pm-icon-btn"
                        onClick={refresh}
                        title="Refresh"
                        type="button"
                    >
                        <RefreshCw size={14} strokeWidth={1.5} />
                    </button>
                </div>
                <div className="lumiverse-pm-toolbar-row">
                    <FilterPills active={filterLock} onChange={setFilterLock} />
                    <span className="lumiverse-pm-count">{personas.length}/{totalCount}</span>
                </div>
            </div>

            {/* Create Form */}
            {isCreating && (
                <CreatePersonaForm
                    onCreate={handleCreate}
                    onCancel={() => setIsCreating(false)}
                />
            )}

            {/* Content */}
            <div className="lumiverse-pm-content">
                {personas.length === 0 ? (
                    <div className="lumiverse-pm-empty">
                        <div className="lumiverse-pm-empty-icon">
                            <User size={40} strokeWidth={1} />
                        </div>
                        <div className="lumiverse-pm-empty-title">
                            {totalCount === 0 ? 'No personas yet' : 'No matches'}
                        </div>
                        <div className="lumiverse-pm-empty-subtitle">
                            {totalCount === 0
                                ? 'Create your first persona with the + button above.'
                                : 'Try adjusting your search or filter.'}
                        </div>
                    </div>
                ) : viewMode === 'grid' ? (
                    <>
                        <div className="lumiverse-pm-grid">
                            {personas.map(p => (
                                <PersonaCardGrid
                                    key={p.avatarId}
                                    persona={p}
                                    isSelected={selectedPersonaId === p.avatarId}
                                    onSelect={handleCardSelect}
                                    onDoubleClick={handleCardDoubleClick}
                                />
                            ))}
                        </div>
                        {selectedPersona && (
                            <PersonaEditor
                                persona={selectedPersona}
                                onRename={handleRename}
                                onUpdateDescription={updateDescription}
                                onUploadAvatar={uploadAvatar}
                                onToggleDefault={toggleDefault}
                                onToggleChatLock={toggleChatLock}
                                onDuplicate={handleDuplicate}
                                onDelete={handleDelete}
                                onSwitch={handleSwitch}
                                onSetLorebook={setLorebook}
                                onAddConnection={addConnection}
                                onRemoveConnection={removeConnection}
                            />
                        )}
                    </>
                ) : (
                    <>
                        <div className="lumiverse-pm-list">
                            {personas.map(p => (
                                <PersonaCardList
                                    key={p.avatarId}
                                    persona={p}
                                    isSelected={selectedPersonaId === p.avatarId}
                                    onSelect={handleCardSelect}
                                    onDoubleClick={handleCardDoubleClick}
                                />
                            ))}
                        </div>
                        {selectedPersona && (
                            <PersonaEditor
                                persona={selectedPersona}
                                onRename={handleRename}
                                onUpdateDescription={updateDescription}
                                onUploadAvatar={uploadAvatar}
                                onToggleDefault={toggleDefault}
                                onToggleChatLock={toggleChatLock}
                                onDuplicate={handleDuplicate}
                                onDelete={handleDelete}
                                onSwitch={handleSwitch}
                                onSetLorebook={setLorebook}
                                onAddConnection={addConnection}
                                onRemoveConnection={removeConnection}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
