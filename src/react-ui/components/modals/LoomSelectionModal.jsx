import React, { useState, useMemo, useCallback } from 'react';
import { usePacks, useLumiverseActions, useLoomSelections, saveToExtension } from '../../store/LumiverseContext';
import { 
    Search, XCircle, ChevronDown, ChevronUp, Folder, 
    Trash2, Pencil, ArrowDownAZ, Check, Plus 
} from 'lucide-react';

/**
 * Self-contained styles matching the new modal design pattern
 */
const styles = {
    layout: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 20px',
        borderBottom: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.1))',
        flexShrink: 0,
    },
    searchBox: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.1))',
        borderRadius: '8px',
    },
    searchIcon: {
        color: 'var(--lumiverse-text-muted, #999)',
        flexShrink: 0,
    },
    searchInput: {
        flex: 1,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        color: 'var(--lumiverse-text, #e0e0e0)',
        fontSize: '13px',
    },
    searchClear: {
        width: '20px',
        height: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        color: 'var(--lumiverse-text-muted, #999)',
        cursor: 'pointer',
        borderRadius: '4px',
        transition: 'background 0.15s ease',
    },
    selectionInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0,
    },
    selectionCount: {
        fontSize: '12px',
        color: 'var(--lumiverse-text-muted, #999)',
        whiteSpace: 'nowrap',
    },
    clearBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        fontSize: '12px',
        fontWeight: 500,
        borderRadius: '6px',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
    },
    controls: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        background: 'rgba(0, 0, 0, 0.15)',
        borderBottom: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.1))',
        flexShrink: 0,
    },
    controlsGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    controlBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 10px',
        fontSize: '11px',
        fontWeight: 500,
        borderRadius: '6px',
        border: 'none',
        background: 'rgba(0, 0, 0, 0.2)',
        color: 'var(--lumiverse-text-muted, #999)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
    },
    sortContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        color: 'var(--lumiverse-text-muted, #999)',
    },
    select: {
        padding: '5px 24px 5px 8px',
        fontSize: '11px',
        borderRadius: '6px',
        border: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.1))',
        background: 'rgba(0, 0, 0, 0.3)',
        color: 'var(--lumiverse-text, #e0e0e0)',
        cursor: 'pointer',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 6px center',
    },
    scrollArea: {
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        padding: '12px 20px',
    },
    empty: {
        textAlign: 'center',
        padding: '40px 20px',
        color: 'var(--lumiverse-text-muted, #999)',
        fontSize: '14px',
    },
    emptyBtn: {
        marginTop: '12px',
        padding: '8px 16px',
        fontSize: '12px',
        borderRadius: '6px',
        border: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.1))',
        background: 'rgba(0, 0, 0, 0.2)',
        color: 'var(--lumiverse-text, #e0e0e0)',
        cursor: 'pointer',
    },
    packSection: {
        marginBottom: '16px',
        border: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.1))',
        borderRadius: '10px',
        overflow: 'hidden',
    },
    packHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        background: 'rgba(0, 0, 0, 0.2)',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
        width: '100%',
        border: 'none',
        color: 'inherit',
        textAlign: 'left',
        fontFamily: 'inherit',
    },
    packCollapseIcon: {
        color: 'var(--lumiverse-text-muted, #999)',
        transition: 'transform 0.2s ease',
    },
    packFolderIcon: {
        color: 'var(--lumiverse-primary, #9370db)',
    },
    packTitle: {
        flex: 1,
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--lumiverse-text, #e0e0e0)',
    },
    packBadge: {
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '4px',
        background: 'rgba(147, 112, 219, 0.2)',
        color: 'var(--lumiverse-primary, #9370db)',
    },
    packCount: {
        fontSize: '11px',
        color: 'var(--lumiverse-text-muted, #999)',
    },
    packRemoveBtn: {
        width: '24px',
        height: '24px',
        borderRadius: '6px',
        border: 'none',
        background: 'transparent',
        color: 'var(--lumiverse-text-muted, #999)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
    },
    itemsList: {
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    item: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        background: 'rgba(0, 0, 0, 0.15)',
        border: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.1))',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
    },
    itemSelected: {
        background: 'rgba(147, 112, 219, 0.15)',
        borderColor: 'rgba(147, 112, 219, 0.4)',
    },
    itemContent: {
        flex: 1,
        minWidth: 0,
    },
    itemName: {
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--lumiverse-text, #e0e0e0)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    itemActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
    },
    itemEditBtn: {
        width: '24px',
        height: '24px',
        borderRadius: '6px',
        border: 'none',
        background: 'rgba(0, 0, 0, 0.2)',
        color: 'var(--lumiverse-text-muted, #999)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
    },
    toggleSwitch: {
        width: '36px',
        height: '20px',
        borderRadius: '10px',
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.15))',
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
    },
    toggleSwitchChecked: {
        background: 'var(--lumiverse-primary, #9370db)',
        borderColor: 'var(--lumiverse-primary, #9370db)',
    },
    toggleThumb: {
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: '#fff',
        position: 'absolute',
        top: '1px',
        left: '1px',
        transition: 'transform 0.15s ease',
    },
    toggleThumbChecked: {
        transform: 'translateX(16px)',
    },
    footer: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        padding: '12px 20px',
        borderTop: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.1))',
        flexShrink: 0,
    },
    btn: {
        padding: '10px 16px',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
    },
    btnPrimary: {
        background: 'var(--lumiverse-primary, #9370db)',
        color: '#fff',
    },
};

/**
 * Category mapping for Loom types
 */
const LOOM_CATEGORIES = {
    loomStyles: {
        category: 'Narrative Style',
        packField: 'loomStyles',
        storeField: 'styles',
        toggleAction: 'toggleLoomStyle',
        isMulti: true,
    },
    loomUtilities: {
        category: 'Loom Utilities',
        packField: 'loomUtils',
        storeField: 'utilities',
        toggleAction: 'toggleLoomUtility',
        isMulti: true,
    },
    loomRetrofits: {
        category: 'Retrofits',
        packField: 'loomRetrofits',
        storeField: 'retrofits',
        toggleAction: 'toggleLoomRetrofit',
        isMulti: true,
    },
};

/**
 * Search input component
 */
function SearchInput({ value, onChange, placeholder }) {
    return (
        <div style={styles.searchBox}>
            <Search size={14} style={styles.searchIcon} />
            <input
                type="text"
                style={styles.searchInput}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
            {value && (
                <button
                    style={styles.searchClear}
                    onClick={() => onChange('')}
                    type="button"
                    aria-label="Clear search"
                >
                    <XCircle size={14} />
                </button>
            )}
        </div>
    );
}

/**
 * Individual Loom item row
 */
function LoomItem({ item, packName, isSelected, onToggle, isMulti, isEditable, onEdit }) {
    const itemName = item.loomName || item.itemName || item.name || 'Unknown';

    const handleEditClick = (e) => {
        e.stopPropagation();
        if (onEdit) onEdit(packName, item);
    };

    return (
        <div
            style={{
                ...styles.item,
                ...(isSelected ? styles.itemSelected : {}),
            }}
            onClick={() => onToggle(packName, itemName)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onToggle(packName, itemName)}
        >
            <div style={styles.itemContent}>
                <span style={styles.itemName}>{itemName}</span>
            </div>
            <div style={styles.itemActions}>
                {isEditable && onEdit && (
                    <button
                        style={styles.itemEditBtn}
                        onClick={handleEditClick}
                        title="Edit this Loom item"
                        type="button"
                    >
                        <Pencil size={12} />
                    </button>
                )}
                <div
                    style={{
                        ...styles.toggleSwitch,
                        ...(isSelected ? styles.toggleSwitchChecked : {}),
                    }}
                >
                    <div
                        style={{
                            ...styles.toggleThumb,
                            ...(isSelected ? styles.toggleThumbChecked : {}),
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

/**
 * Collapsible pack section for Loom items
 */
function PackSection({
    pack,
    children,
    defaultOpen = true,
    isEditable,
    onRemovePack,
    isCollapsed: controlledCollapsed,
    onToggleCollapse,
}) {
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const itemCount = React.Children.count(children);
    const packName = pack.name || pack.packName || 'Unknown Pack';

    const isControlled = controlledCollapsed !== undefined;
    const isOpen = isControlled ? !controlledCollapsed : internalOpen;

    if (itemCount === 0) return null;

    const handleHeaderClick = (e) => {
        if (e.target.closest('[data-action]')) return;

        if (isControlled && onToggleCollapse) {
            onToggleCollapse(packName);
        } else {
            setInternalOpen(!internalOpen);
        }
    };

    return (
        <div style={styles.packSection}>
            <div style={styles.packHeader} onClick={handleHeaderClick}>
                <span style={{
                    ...styles.packCollapseIcon,
                    transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                }}>
                    <ChevronDown size={14} />
                </span>
                <Folder size={14} style={styles.packFolderIcon} />
                <span style={styles.packTitle}>{packName}</span>
                {isEditable && <span style={styles.packBadge}>Custom</span>}
                <span style={styles.packCount}>{itemCount} items</span>
                <button
                    data-action="remove"
                    style={styles.packRemoveBtn}
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemovePack(packName);
                    }}
                    title="Remove Pack"
                    type="button"
                >
                    <Trash2 size={14} />
                </button>
            </div>
            {isOpen && <div style={styles.itemsList}>{children}</div>}
        </div>
    );
}

/**
 * Helper to get Loom items from a pack
 */
function getLoomItemsFromPack(pack, config) {
    const items = [];
    const { category, packField } = config;

    // New format (v2): separate loomItems array with loomCategory field
    if (pack.loomItems && Array.isArray(pack.loomItems)) {
        pack.loomItems.forEach(item => {
            if (item.loomCategory === category) {
                items.push({
                    ...item,
                    loomName: item.loomName || item.itemName || item.name,
                });
            }
        });
    }

    // Legacy structure (pack.loomStyles, pack.loomUtils, pack.loomRetrofits)
    if (pack[packField] && Array.isArray(pack[packField])) {
        pack[packField].forEach(item => {
            items.push({
                ...item,
                loomName: item.loomName || item.itemName || item.name,
            });
        });
    }

    // Legacy: pack.items with loomCategory field
    if (pack.items && Array.isArray(pack.items)) {
        pack.items.forEach(item => {
            const itemCategory = item.loomCategory || item.category || item.type;
            if (itemCategory === category || itemCategory === packField) {
                items.push({
                    ...item,
                    loomName: item.loomName || item.itemName || item.name,
                });
            }
        });
    }

    return items;
}

/**
 * Loom Selection Modal
 */
function LoomSelectionModal({ type, onClose }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedPacks, setCollapsedPacks] = useState(new Set());
    const [sortBy, setSortBy] = useState('default');
    const { allPacks } = usePacks();
    const actions = useLumiverseActions();
    const loomSelections = useLoomSelections();

    const config = LOOM_CATEGORIES[type];
    if (!config) {
        return <div style={styles.empty}>Unknown Loom type: {type}</div>;
    }

    const { category, storeField, toggleAction, isMulti } = config;

    // Get current selections from the correct store field
    const currentSelections = useMemo(() => {
        const selection = loomSelections[storeField];
        if (!selection) return [];
        return Array.isArray(selection) ? selection : [selection];
    }, [loomSelections, storeField]);

    // Check if an item is selected
    const isSelected = useCallback((packName, itemName) => {
        return currentSelections.some(
            (s) => s.packName === packName && s.itemName === itemName
        );
    }, [currentSelections]);

    // Toggle selection using the store's toggle actions
    const handleToggle = useCallback((packName, itemName) => {
        const selection = { packName, itemName };
        if (actions[toggleAction]) {
            actions[toggleAction](selection);
            saveToExtension();
        } else {
            console.error(`[LoomSelectionModal] Unknown toggle action: ${toggleAction}`);
        }
    }, [actions, toggleAction]);

    // Clear all selections
    const handleClear = useCallback(() => {
        const setterMap = {
            styles: 'setSelectedLoomStyles',
            utilities: 'setSelectedLoomUtilities',
            retrofits: 'setSelectedLoomRetrofits',
        };
        const setterAction = setterMap[storeField];
        if (actions[setterAction]) {
            actions[setterAction]([]);
            saveToExtension();
        }
    }, [actions, storeField]);

    // Filter packs and get Loom items
    const filteredPacks = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();

        return allPacks
            .map((pack) => {
                const loomItems = getLoomItemsFromPack(pack, config);

                const filteredItems = query
                    ? loomItems.filter(item => {
                        const name = (item.loomName || item.itemName || item.name || '').toLowerCase();
                        return name.includes(query);
                    })
                    : loomItems;

                return {
                    ...pack,
                    loomItems: filteredItems,
                    isEditable: pack.isCustom || pack.isEditable || false,
                };
            })
            .filter((pack) => pack.loomItems.length > 0);
    }, [allPacks, config, searchQuery]);

    // Sorted packs
    const sortedPacks = useMemo(() => {
        if (sortBy === 'default') return filteredPacks;

        return [...filteredPacks].sort((a, b) => {
            if (sortBy === 'name') {
                const nameA = (a.name || a.packName || '').toLowerCase();
                const nameB = (b.name || b.packName || '').toLowerCase();
                return nameA.localeCompare(nameB);
            }
            if (sortBy === 'author') {
                const authorA = (a.author || '').toLowerCase();
                const authorB = (b.author || '').toLowerCase();
                return authorA.localeCompare(authorB);
            }
            return 0;
        });
    }, [filteredPacks, sortBy]);

    // Collapse/Expand all functions
    const collapseAll = useCallback(() => {
        const allPackNames = filteredPacks.map(p => p.name || p.packName);
        setCollapsedPacks(new Set(allPackNames));
    }, [filteredPacks]);

    const expandAll = useCallback(() => {
        setCollapsedPacks(new Set());
    }, []);

    const togglePackCollapse = useCallback((packName) => {
        setCollapsedPacks(prev => {
            const next = new Set(prev);
            if (next.has(packName)) {
                next.delete(packName);
            } else {
                next.add(packName);
            }
            return next;
        });
    }, []);

    const isPackCollapsed = (packName) => collapsedPacks.has(packName);

    // Handle removing a pack
    const handleRemovePack = useCallback((packName) => {
        if (!window.confirm(`Delete pack "${packName}"? This action cannot be undone.`)) {
            return;
        }
        actions.removeCustomPack(packName);
        saveToExtension();
    }, [actions]);

    // Handle editing a Loom item
    const handleEditItem = useCallback((packName, item) => {
        actions.openModal('loomEditor', { packName, editingItem: item });
    }, [actions]);

    const totalItems = sortedPacks.reduce((sum, pack) => sum + pack.loomItems.length, 0);
    const selectedCount = currentSelections.length;

    const getPackName = (pack) => pack.name || pack.packName || 'Unknown Pack';

    return (
        <div style={styles.layout}>
            {/* Header with search and clear */}
            <div style={styles.header}>
                <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder={`Search ${category}...`}
                />
                <div style={styles.selectionInfo}>
                    <span style={styles.selectionCount}>
                        {selectedCount} selected
                    </span>
                    {selectedCount > 0 && (
                        <button style={styles.clearBtn} onClick={handleClear} title="Clear all selections">
                            <XCircle size={14} />
                            <span>Clear</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Controls */}
            {sortedPacks.length > 0 && (
                <div style={styles.controls}>
                    <div style={styles.controlsGroup}>
                        <button
                            style={styles.controlBtn}
                            onClick={expandAll}
                            title="Expand all packs"
                            type="button"
                        >
                            <ChevronDown size={12} />
                            <span>Expand All</span>
                        </button>
                        <button
                            style={styles.controlBtn}
                            onClick={collapseAll}
                            title="Collapse all packs"
                            type="button"
                        >
                            <ChevronUp size={12} />
                            <span>Collapse All</span>
                        </button>
                    </div>

                    <div style={styles.sortContainer}>
                        <ArrowDownAZ size={12} />
                        <span>Sort:</span>
                        <select
                            style={styles.select}
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="default">Default</option>
                            <option value="name">Pack Name</option>
                            <option value="author">Author</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Content */}
            <div style={styles.scrollArea}>
                {totalItems === 0 ? (
                    <div style={styles.empty}>
                        No "{category}" items found in loaded packs.
                        {searchQuery && (
                            <button
                                style={styles.emptyBtn}
                                onClick={() => setSearchQuery('')}
                                type="button"
                            >
                                Clear search
                            </button>
                        )}
                    </div>
                ) : (
                    sortedPacks.map((pack) => {
                        const packName = getPackName(pack);
                        return (
                            <PackSection
                                key={pack.id || packName}
                                pack={pack}
                                isEditable={pack.isEditable}
                                onRemovePack={handleRemovePack}
                                isCollapsed={isPackCollapsed(packName)}
                                onToggleCollapse={togglePackCollapse}
                            >
                                {pack.loomItems.map((item) => {
                                    const itemName = item.loomName || item.itemName || item.name;
                                    return (
                                        <LoomItem
                                            key={`${packName}-${itemName}`}
                                            item={item}
                                            packName={packName}
                                            isSelected={isSelected(packName, itemName)}
                                            onToggle={handleToggle}
                                            isMulti={isMulti}
                                            isEditable={pack.isEditable}
                                            onEdit={handleEditItem}
                                        />
                                    );
                                })}
                            </PackSection>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div style={styles.footer}>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={onClose}>
                    Done
                </button>
            </div>
        </div>
    );
}

export default LoomSelectionModal;
