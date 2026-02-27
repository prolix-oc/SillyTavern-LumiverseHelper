/**
 * ManageChatsModal — Chat file manager for the current character/group
 *
 * Lists all chats with switch, rename, export, delete, and search.
 * Uses self-contained inline styles with var(--lumiverse-*) variables.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo, useSyncExternalStore } from 'react';
import {
    X, Search, FolderOpen, MessageSquare, Pencil, Download, Trash2,
    ArrowRight, Check, SortAsc, Clock, FileText, HardDrive, Loader2,
} from 'lucide-react';
import {
    fetchCharacterChats,
    switchToChat,
    renameChat,
    deleteChatFile,
    exportChat,
    getCharacterInfo,
} from '../../../lib/chatSheldService';
import { getContext } from '../../../stContext';
import { useLumiverseStore } from '../../store/LumiverseContext';
import ConfirmationModal from '../shared/ConfirmationModal';

const store = useLumiverseStore;
const selectActiveChat = () => store.getState().chatSheld?.activeChat || null;

/**
 * Inject scoped hover styles for ManageChatsModal action buttons.
 * Uses a <style> tag so hover states work without broken inline JS handlers.
 */
const MANAGE_CHATS_STYLE_ID = 'lcs-manage-chats-styles';
const manageChatsCss = `
.lcs-mcm-action-btn {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-radius: 6px;
  color: var(--lumiverse-text-muted, rgba(230,230,240,0.5));
  cursor: pointer; padding: 0;
}
.lcs-mcm-action-btn:hover {
  color: var(--lumiverse-text, rgba(230,230,240,0.92));
  background: var(--lumiverse-fill, rgba(255,255,255,0.06));
}
.lcs-mcm-action-btn--danger:hover {
  color: var(--lumiverse-danger, #ef4444);
  background: var(--lumiverse-danger-010, rgba(239,68,68,0.1));
}
.lcs-mcm-action-btn--primary:hover {
  color: var(--lumiverse-primary-text, rgba(160,150,255,0.95));
  background: var(--lumiverse-fill, rgba(255,255,255,0.06));
}
.lcs-mcm-sort-btn {
  display: flex; align-items: center; gap: 4px; padding: 6px 10px;
  border-radius: 8px; background: var(--lumiverse-fill-subtle, rgba(255,255,255,0.04));
  border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.08));
  color: var(--lumiverse-text-muted, rgba(230,230,240,0.6));
  cursor: pointer; font-size: 11px; font-family: inherit;
}
.lcs-mcm-sort-btn:hover {
  color: var(--lumiverse-text, rgba(230,230,240,0.92));
  background: var(--lumiverse-fill, rgba(255,255,255,0.06));
}
`;

function ensureManageChatsStyles() {
    if (!document.getElementById(MANAGE_CHATS_STYLE_ID)) {
        const tag = document.createElement('style');
        tag.id = MANAGE_CHATS_STYLE_ID;
        tag.textContent = manageChatsCss;
        document.head.appendChild(tag);
    }
}

const s = {
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px 16px', borderBottom: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
    },
    headerLeft: { display: 'flex', flexDirection: 'column', gap: '4px' },
    title: { fontSize: '18px', fontWeight: 600, color: 'var(--lumiverse-text, #e6e6f0)', margin: 0 },
    subtitle: { fontSize: '12px', color: 'var(--lumiverse-text-dim, rgba(230,230,240,0.4))' },
    closeBtn: {
        width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--lumiverse-fill-subtle, rgba(255,255,255,0.04))',
        border: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
        borderRadius: '8px', color: 'var(--lumiverse-text-muted, rgba(230,230,240,0.6))',
        cursor: 'pointer', transition: 'all 0.15s',
    },
    toolbar: {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 24px', borderBottom: '1px solid var(--lumiverse-border, rgba(255,255,255,0.06))',
    },
    searchWrap: {
        flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 12px', borderRadius: '10px',
        background: 'var(--lumiverse-fill-subtle, rgba(255,255,255,0.04))',
        border: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
    },
    searchInput: {
        flex: 1, background: 'transparent', border: 'none', outline: 'none',
        fontSize: '13px', color: 'var(--lumiverse-text, #e6e6f0)', fontFamily: 'inherit',
    },
    body: {
        flex: 1, overflowY: 'auto', padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: '6px',
    },
    card: {
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 14px', borderRadius: '12px',
        background: 'var(--lumiverse-fill-subtle, rgba(255,255,255,0.03))',
        border: '1px solid var(--lumiverse-border, rgba(255,255,255,0.06))',
        transition: 'all 0.15s', cursor: 'default',
    },
    cardActive: {
        borderColor: 'var(--lumiverse-primary-030, rgba(140,130,255,0.3))',
        background: 'var(--lumiverse-primary-005, rgba(140,130,255,0.05))',
    },
    cardInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 },
    cardName: {
        fontSize: '14px', fontWeight: 500, color: 'var(--lumiverse-text, #e6e6f0)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    },
    cardMeta: {
        display: 'flex', alignItems: 'center', gap: '10px',
        fontSize: '11px', color: 'var(--lumiverse-text-dim, rgba(230,230,240,0.4))',
    },
    cardMetaItem: { display: 'flex', alignItems: 'center', gap: '3px' },
    cardSnippet: {
        fontSize: '12px', color: 'var(--lumiverse-text-dim, rgba(230,230,240,0.35))',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px',
    },
    cardActions: { display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 },
    actionBtn: {
        width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', borderRadius: '6px',
        color: 'var(--lumiverse-text-muted, rgba(230,230,240,0.5))',
        cursor: 'pointer', padding: 0,
    },
    editInput: {
        flex: 1, background: 'var(--lumiverse-fill, rgba(255,255,255,0.06))',
        border: '1px solid var(--lumiverse-primary-040, rgba(140,130,255,0.4))',
        borderRadius: '6px', padding: '4px 8px', fontSize: '13px',
        color: 'var(--lumiverse-text, #e6e6f0)', outline: 'none', fontFamily: 'inherit',
    },
    activeBadge: {
        fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
        background: 'var(--lumiverse-primary-015, rgba(140,130,255,0.15))',
        color: 'var(--lumiverse-primary-text, rgba(160,150,255,0.95))',
        letterSpacing: '0.03em', textTransform: 'uppercase',
    },
    loading: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '12px', padding: '60px 20px', color: 'var(--lumiverse-text-dim, rgba(230,230,240,0.4))',
        fontSize: '13px',
    },
    empty: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '10px', padding: '60px 20px', color: 'var(--lumiverse-text-dim, rgba(230,230,240,0.35))',
        fontSize: '14px', textAlign: 'center',
    },
};

const SORT_OPTIONS = [
    { key: 'date', label: 'Date' },
    { key: 'name', label: 'Name' },
    { key: 'size', label: 'Size' },
];

export default function ManageChatsModal({ onClose }) {
    const [chats, setChats] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('date');
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [deleteTarget, setDeleteTarget] = useState(null);
    const editRef = useRef(null);

    const charInfo = getCharacterInfo();
    const activeChat = useSyncExternalStore(store.subscribe, selectActiveChat, selectActiveChat);
    const currentChatId = getContext()?.chatId || null;

    // Inject CSS hover styles on mount
    useEffect(() => { ensureManageChatsStyles(); }, []);

    // Fetch chats on mount and re-fetch when active chat changes (fork, switch, etc.)
    const loadChats = useCallback(async () => {
        setIsLoading(true);
        const result = await fetchCharacterChats();
        setChats(result || []);
        setIsLoading(false);
    }, []);

    useEffect(() => { loadChats(); }, [loadChats, activeChat]);

    // Focus edit input when entering rename mode
    useEffect(() => {
        if (editingId !== null && editRef.current) {
            editRef.current.focus();
            editRef.current.select();
        }
    }, [editingId]);

    // Parse pre-formatted size string to bytes for sorting (e.g. "2.5MB" → 2621440)
    const parseSizeToBytes = (sizeStr) => {
        if (!sizeStr || typeof sizeStr !== 'string') return 0;
        const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)?$/i);
        if (!match) return 0;
        const num = parseFloat(match[1]);
        const unit = (match[2] || 'B').toUpperCase();
        const multipliers = { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 };
        return num * (multipliers[unit] || 1);
    };

    // Filter and sort
    const filteredChats = chats
        .filter(c => {
            if (!search) return true;
            const q = search.toLowerCase();
            const name = (c.file_name || '').toLowerCase();
            const lastMsg = (c.last_mes || c.mes || '').toLowerCase();
            return name.includes(q) || lastMsg.includes(q);
        })
        .sort((a, b) => {
            if (sortBy === 'name') return (a.file_name || '').localeCompare(b.file_name || '');
            if (sortBy === 'size') return parseSizeToBytes(b.file_size) - parseSizeToBytes(a.file_size);
            // Default: date (newest first) — file_name often contains timestamp
            return (b.file_name || '').localeCompare(a.file_name || '');
        });

    const handleSwitch = useCallback(async (fileName) => {
        await switchToChat(fileName);
    }, []);

    const handleStartRename = useCallback((fileName) => {
        // Strip extension for editing
        const baseName = fileName.replace(/\.jsonl$/, '');
        setEditingId(fileName);
        setEditName(baseName);
    }, []);

    const handleConfirmRename = useCallback(async () => {
        if (!editingId || !editName.trim()) {
            setEditingId(null);
            return;
        }
        const newName = editName.trim();
        const ok = await renameChat(editingId, newName);
        if (ok) {
            await loadChats();
        }
        setEditingId(null);
    }, [editingId, editName, loadChats]);

    const handleDelete = useCallback(async () => {
        if (!deleteTarget) return;
        const ok = await deleteChatFile(deleteTarget);
        if (ok) {
            setChats(prev => prev.filter(c => c.file_name !== deleteTarget));
        }
        setDeleteTarget(null);
    }, [deleteTarget]);

    const handleExport = useCallback(async (fileName) => {
        await exportChat(fileName);
    }, []);

    const cycleSortBy = useCallback(() => {
        setSortBy(prev => {
            const idx = SORT_OPTIONS.findIndex(o => o.key === prev);
            return SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].key;
        });
    }, []);

    const formatSize = (size) => {
        if (!size) return '—';
        // ST API returns file_size as a pre-formatted string (e.g. "2.5MB")
        return String(size);
    };

    const isCurrentChat = (fileName) => {
        if (!currentChatId) return false;
        return fileName === currentChatId || fileName === `${currentChatId}.jsonl`;
    };

    return (
        <>
            {/* Header */}
            <div style={s.header}>
                <div style={s.headerLeft}>
                    <h3 style={s.title}>Manage Chats</h3>
                    <span style={s.subtitle}>
                        {charInfo?.name || 'Character'} — {chats.length} chat{chats.length !== 1 ? 's' : ''}
                    </span>
                </div>
                <button style={s.closeBtn} onClick={onClose} type="button" aria-label="Close">
                    <X size={16} />
                </button>
            </div>

            {/* Toolbar */}
            <div style={s.toolbar}>
                <div style={s.searchWrap}>
                    <Search size={14} style={{ color: 'var(--lumiverse-text-dim)', flexShrink: 0 }} />
                    <input
                        style={s.searchInput}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search chats..."
                    />
                </div>
                <button className="lcs-mcm-sort-btn" onClick={cycleSortBy} type="button" title={`Sort by ${sortBy}`}>
                    <SortAsc size={12} />
                    {SORT_OPTIONS.find(o => o.key === sortBy)?.label}
                </button>
            </div>

            {/* Chat list */}
            <div style={s.body}>
                {isLoading ? (
                    <div style={s.loading}>
                        <Loader2 size={24} style={{ animation: 'lcs-spin 0.75s linear infinite' }} />
                        Loading chats...
                    </div>
                ) : filteredChats.length === 0 ? (
                    <div style={s.empty}>
                        <FolderOpen size={28} style={{ opacity: 0.4 }} />
                        {search ? 'No chats match your search.' : 'No chats found.'}
                    </div>
                ) : (
                    filteredChats.map((chat) => {
                        const isCurrent = isCurrentChat(chat.file_name);
                        return (
                            <div
                                key={chat.file_name}
                                style={{ ...s.card, ...(isCurrent ? s.cardActive : {}) }}
                            >
                                <MessageSquare size={16} style={{
                                    color: isCurrent
                                        ? 'var(--lumiverse-primary-text, rgba(160,150,255,0.95))'
                                        : 'var(--lumiverse-text-dim, rgba(230,230,240,0.35))',
                                    flexShrink: 0,
                                }} />

                                <div style={s.cardInfo}>
                                    {editingId === chat.file_name ? (
                                        <input
                                            ref={editRef}
                                            style={s.editInput}
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleConfirmRename();
                                                if (e.key === 'Escape') setEditingId(null);
                                            }}
                                            onBlur={handleConfirmRename}
                                        />
                                    ) : (
                                        <div style={s.cardName}>
                                            {chat.file_name?.replace(/\.jsonl$/, '') || 'Unnamed'}
                                        </div>
                                    )}

                                    <div style={s.cardMeta}>
                                        <span style={s.cardMetaItem}>
                                            <FileText size={10} />
                                            {chat.chat_items || chat.message_count || '—'} msgs
                                        </span>
                                        <span style={s.cardMetaItem}>
                                            <HardDrive size={10} />
                                            {formatSize(chat.file_size)}
                                        </span>
                                        {isCurrent && (
                                            <span style={s.activeBadge}>Active</span>
                                        )}
                                    </div>

                                    {(chat.last_mes || chat.mes) && (
                                        <div style={s.cardSnippet}>
                                            {(chat.last_mes || chat.mes || '').slice(0, 100)}
                                        </div>
                                    )}
                                </div>

                                <div style={s.cardActions}>
                                    {!isCurrent && editingId !== chat.file_name && (
                                        <button
                                            className="lcs-mcm-action-btn lcs-mcm-action-btn--primary"
                                            onClick={() => handleSwitch(chat.file_name)}
                                            title="Switch to chat"
                                            type="button"
                                        >
                                            <ArrowRight size={14} />
                                        </button>
                                    )}

                                    {editingId === chat.file_name ? (
                                        <button
                                            className="lcs-mcm-action-btn"
                                            onClick={handleConfirmRename}
                                            title="Confirm rename"
                                            type="button"
                                        >
                                            <Check size={14} style={{ color: 'var(--lumiverse-success, #22c55e)' }} />
                                        </button>
                                    ) : (
                                        <button
                                            className="lcs-mcm-action-btn"
                                            onClick={() => handleStartRename(chat.file_name)}
                                            title="Rename"
                                            type="button"
                                        >
                                            <Pencil size={13} />
                                        </button>
                                    )}

                                    <button
                                        className="lcs-mcm-action-btn"
                                        onClick={() => handleExport(chat.file_name)}
                                        title="Export as .jsonl"
                                        type="button"
                                    >
                                        <Download size={13} />
                                    </button>

                                    {!isCurrent && (
                                        <button
                                            className="lcs-mcm-action-btn lcs-mcm-action-btn--danger"
                                            onClick={() => setDeleteTarget(chat.file_name)}
                                            title="Delete chat"
                                            type="button"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Delete confirmation */}
            <ConfirmationModal
                isOpen={!!deleteTarget}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
                title="Delete Chat"
                message={`Permanently delete "${deleteTarget?.replace(/\.jsonl$/, '')}"? This cannot be undone.`}
                variant="danger"
                confirmText="Delete"
            />
        </>
    );
}
