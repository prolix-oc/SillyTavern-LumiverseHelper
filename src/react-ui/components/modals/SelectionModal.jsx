import React, { useState, useMemo, useEffect, useSyncExternalStore, useCallback } from 'react';
import {
    usePacks,
    useSelections,
    useLumiverseActions,
    useLumiverseStore,
    saveToExtension,
} from '../../store/LumiverseContext';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';
import { 
    Star, Check, Trash2, XCircle, ChevronDown, ChevronUp, X,
    Pencil, Folder, User, Wrench, PieChart, ArrowDownAZ, Sparkles 
} from 'lucide-react';

// Get store for direct state access
const store = useLumiverseStore;

// Stable fallback constants for useSyncExternalStore
const EMPTY_ARRAY = [];

// Stable selector functions
const selectChimeraMode = () => store.getState().chimeraMode || false;
const selectSelectedDefinitions = () => store.getState().selectedDefinitions || EMPTY_ARRAY;

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
    headerIcon: {
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(147, 112, 219, 0.2), rgba(147, 112, 219, 0.1))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--lumiverse-primary, #9370db)',
    },
    headerText: {
        flex: 1,
    },
    title: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 600,
        color: 'var(--lumiverse-text, #e0e0e0)',
    },
    subtitle: {
        margin: '4px 0 0',
        fontSize: '12px',
        color: 'var(--lumiverse-text-muted, #999)',
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
    cardGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: '10px',
        padding: '12px',
    },
    card: {
        position: 'relative',
        borderRadius: '10px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: '2px solid transparent',
        background: 'rgba(0, 0, 0, 0.2)',
    },
    cardSelected: {
        borderColor: 'var(--lumiverse-primary, #9370db)',
        boxShadow: '0 0 0 1px var(--lumiverse-primary, #9370db)',
    },
    cardImage: {
        position: 'relative',
        aspectRatio: '1',
        background: 'rgba(0, 0, 0, 0.3)',
    },
    cardImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transition: 'opacity 0.2s ease',
    },
    cardPlaceholder: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        color: 'var(--lumiverse-text-muted, #999)',
        background: 'linear-gradient(135deg, rgba(147, 112, 219, 0.1), rgba(147, 112, 219, 0.05))',
    },
    cardCheck: {
        position: 'absolute',
        top: '6px',
        right: '6px',
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        background: 'var(--lumiverse-primary, #9370db)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0,
        transform: 'scale(0.8)',
        transition: 'all 0.15s ease',
    },
    cardCheckVisible: {
        opacity: 1,
        transform: 'scale(1)',
    },
    cardIconOverlay: {
        position: 'absolute',
        width: '26px',
        height: '26px',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
    },
    cardDominant: {
        top: '6px',
        left: '6px',
        background: 'rgba(0, 0, 0, 0.6)',
        color: 'var(--lumiverse-text-muted, #999)',
    },
    cardDominantActive: {
        background: 'rgba(255, 193, 7, 0.9)',
        color: '#fff',
    },
    cardEnableAll: {
        bottom: '6px',
        left: '6px',
        background: 'rgba(0, 0, 0, 0.6)',
        color: 'var(--lumiverse-text-muted, #999)',
    },
    cardEnableAllActive: {
        background: 'rgba(147, 112, 219, 0.9)',
        color: '#fff',
    },
    cardEdit: {
        bottom: '6px',
        right: '6px',
        background: 'rgba(0, 0, 0, 0.6)',
        color: 'var(--lumiverse-text-muted, #999)',
    },
    cardInfo: {
        padding: '8px 10px',
    },
    cardName: {
        fontSize: '11px',
        fontWeight: 500,
        color: 'var(--lumiverse-text, #e0e0e0)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
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
    btnSecondary: {
        background: 'rgba(0, 0, 0, 0.3)',
        color: 'var(--lumiverse-text, #e0e0e0)',
        border: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.1))',
    },
    btnPrimary: {
        background: 'var(--lumiverse-primary, #9370db)',
        color: '#fff',
    },
    headerCloseBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        border: 'none',
        background: 'transparent',
        color: 'var(--lumiverse-text-muted, #999)',
        cursor: 'pointer',
        marginLeft: '4px',
        transition: 'all 0.15s ease',
    },
};

/**
 * Get a Lumia field with fallback for old/new format
 */
function getLumiaField(item, field) {
    if (!item) return null;
    const fieldMap = {
        name: ['lumiaName', 'lumiaDefName'],
        def: ['lumiaDefinition', 'lumiaDef'],
        personality: ['lumiaPersonality', 'lumia_personality'],
        behavior: ['lumiaBehavior', 'lumia_behavior'],
        img: ['avatarUrl', 'lumia_img'],
    };
    const fields = fieldMap[field];
    if (!fields) return null;
    for (const fieldName of fields) {
        if (item[fieldName] !== undefined && item[fieldName] !== null) {
            return item[fieldName];
        }
    }
    return null;
}

/**
 * Check if an item has multiple content types (for showing "Enable All" button)
 */
function hasMultipleContentTypes(item) {
    const contentTypes = [
        !!getLumiaField(item, 'def'),
        !!getLumiaField(item, 'behavior'),
        !!getLumiaField(item, 'personality'),
    ].filter(Boolean);
    return contentTypes.length > 1;
}

/**
 * Individual card component
 */
function LumiaCard({
    item,
    packName,
    isSelected,
    isDominant,
    onSelect,
    onSetDominant,
    showDominant,
    isDefinition,
    animationIndex,
    isEditable,
    onEdit,
}) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const actions = useLumiverseActions();

    // Get display values - supports both new and legacy format
    const displayName = getLumiaField(item, 'name') || 'Unknown';
    const imgToShow = getLumiaField(item, 'img');

    // Check if this item has multiple content types
    const showEnableAll = hasMultipleContentTypes(item);

    // Check if all traits are currently enabled (for toggle visual state)
    const isAllEnabled = showEnableAll && actions.areAllTraitsEnabledForLumia(packName, displayName);

    // Adaptive image positioning based on aspect ratio
    const { objectPosition } = useAdaptiveImagePosition(imgToShow);

    const handleCardClick = (e) => {
        // Don't trigger if clicking action icons
        if (e.target.closest('[data-action]')) return;
        onSelect(item);
    };

    const handleDominantClick = (e) => {
        e.stopPropagation();
        onSetDominant(item);
    };

    const handleEditClick = (e) => {
        e.stopPropagation();
        if (onEdit) onEdit(item);
    };

    const handleEnableAllClick = (e) => {
        e.stopPropagation();
        actions.toggleAllTraitsForLumia(packName, displayName);
        saveToExtension();
    };

    return (
        <div
            style={{
                ...styles.card,
                ...(isSelected ? styles.cardSelected : {}),
            }}
            onClick={handleCardClick}
            data-pack={packName}
            data-item={displayName}
        >
            <div style={styles.cardImage}>
                {imgToShow && !imageError ? (
                    <img
                        src={imgToShow}
                        alt={displayName}
                        loading="lazy"
                        style={{ ...styles.cardImg, objectPosition, opacity: imageLoaded ? 1 : 0 }}
                        onLoad={() => setImageLoaded(true)}
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div style={styles.cardPlaceholder}>?</div>
                )}

                {/* Enable All Icon - shows when item has multiple content types */}
                {showEnableAll && (
                    <div
                        data-action="enable-all"
                        style={{
                            ...styles.cardIconOverlay,
                            ...styles.cardEnableAll,
                            ...(isAllEnabled ? styles.cardEnableAllActive : {}),
                        }}
                        onClick={handleEnableAllClick}
                        title={isAllEnabled ? "Disable all traits" : "Enable all traits"}
                    >
                        <Sparkles size={12} />
                    </div>
                )}

                {/* Edit Icon for custom pack items */}
                {isEditable && onEdit && (
                    <div
                        data-action="edit"
                        style={{
                            ...styles.cardIconOverlay,
                            ...styles.cardEdit,
                        }}
                        onClick={handleEditClick}
                        title="Edit this Lumia"
                    >
                        <Pencil size={12} />
                    </div>
                )}

                {/* Dominant Star Icon */}
                {showDominant && (
                    <div
                        data-action="dominant"
                        style={{
                            ...styles.cardIconOverlay,
                            ...styles.cardDominant,
                            ...(isDominant ? styles.cardDominantActive : {}),
                        }}
                        onClick={handleDominantClick}
                        title={isDominant ? 'Remove as dominant' : 'Set as dominant trait'}
                    >
                        <Star size={12} fill={isDominant ? 'currentColor' : 'none'} />
                    </div>
                )}

                {/* Selection Checkmark */}
                <div style={{
                    ...styles.cardCheck,
                    ...(isSelected ? styles.cardCheckVisible : {}),
                }}>
                    <Check size={12} strokeWidth={3} />
                </div>
            </div>

            <div style={styles.cardInfo}>
                <div style={styles.cardName}>{displayName}</div>
            </div>
        </div>
    );
}

/**
 * Collapsible pack section
 */
function PackSection({
    pack,
    items,
    isEditable,
    type,
    isSelected,
    isDominant,
    onSelect,
    onSetDominant,
    showDominant,
    onRemovePack,
    onEditItem,
    isCollapsed: controlledCollapsed,
    onToggleCollapse,
}) {
    const [internalCollapsed, setInternalCollapsed] = useState(false);

    const isControlled = controlledCollapsed !== undefined;
    const isCollapsed = isControlled ? controlledCollapsed : internalCollapsed;

    const packName = pack.name || pack.packName || 'Unknown Pack';

    const handleHeaderClick = (e) => {
        if (e.target.closest('[data-action]')) return;

        if (isControlled && onToggleCollapse) {
            onToggleCollapse(packName);
        } else {
            setInternalCollapsed(!internalCollapsed);
        }
    };

    return (
        <div style={styles.packSection}>
            <div
                style={styles.packHeader}
                onClick={handleHeaderClick}
            >
                <span style={{
                    ...styles.packCollapseIcon,
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                }}>
                    <ChevronDown size={14} />
                </span>
                <Folder size={14} style={styles.packFolderIcon} />
                <span style={styles.packTitle}>{packName}</span>
                {isEditable && <span style={styles.packBadge}>Custom</span>}
                <span style={styles.packCount}>{items.length} items</span>
                <button
                    data-action="remove"
                    style={styles.packRemoveBtn}
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemovePack(packName);
                    }}
                    title="Remove Pack"
                >
                    <Trash2 size={14} />
                </button>
            </div>
            {!isCollapsed && (
                <div className="lumiverse-responsive-small-grid">
                    {items.map((item, index) => (
                        <LumiaCard
                            key={getLumiaField(item, 'name') || item.id || index}
                            item={item}
                            packName={packName}
                            isSelected={isSelected(item, packName)}
                            isDominant={isDominant(item, packName)}
                            onSelect={(item) => onSelect(item, packName)}
                            onSetDominant={(item) => onSetDominant(item, packName)}
                            showDominant={showDominant}
                            isDefinition={type === 'definitions'}
                            animationIndex={index}
                            isEditable={isEditable}
                            onEdit={isEditable ? (item) => onEditItem(item, packName) : undefined}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Get Lumia items from a pack (filtering out Loom/Narrative Style items)
 */
function getLumiaItemsFromPack(pack, type) {
    // New format: separate lumiaItems array
    if (pack.lumiaItems && Array.isArray(pack.lumiaItems)) {
        return pack.lumiaItems;
    }

    // Legacy format: mixed items array
    const packItems = pack.items || [];

    // Filter to only Lumia items (have lumiaDefName, not loomCategory)
    return packItems.filter(item => {
        if (item.loomCategory) return false;
        if (!item.lumiaDefName) return false;
        return true;
    });
}

/**
 * Get header icon based on type
 */
function getHeaderIcon(type) {
    switch (type) {
        case 'definitions': return User;
        case 'behaviors': return Wrench;
        case 'personalities': return PieChart;
        default: return User;
    }
}

/**
 * Get modal config based on type
 */
function getModalConfig(type, chimeraMode = false) {
    switch (type) {
        case 'definitions':
            if (chimeraMode) {
                return {
                    title: 'Select Chimera Forms',
                    subtitle: 'Choose multiple physical forms to fuse into a Chimera',
                    isMulti: true,
                    dominantKey: null,
                };
            }
            return {
                title: 'Select Definition',
                subtitle: 'Choose the physical form for your Lumia',
                isMulti: false,
                dominantKey: null,
            };
        case 'behaviors':
            return {
                title: 'Select Behaviors',
                subtitle: 'Choose behavioral traits (tap star for dominant)',
                isMulti: true,
                dominantKey: 'dominantBehavior',
            };
        case 'personalities':
            return {
                title: 'Select Personalities',
                subtitle: 'Choose personality traits (tap star for dominant)',
                isMulti: true,
                dominantKey: 'dominantPersonality',
            };
        default:
            return {
                title: 'Select Items',
                subtitle: '',
                isMulti: true,
                dominantKey: null,
            };
    }
}

/**
 * Main selection modal component
 */
function SelectionModal({
    type,
    multiSelect = true,
    allowDominant = false,
    onClose,
}) {
    const { allPacks } = usePacks();
    const selections = useSelections();
    const actions = useLumiverseActions();

    // Subscribe to Chimera mode for multi-select definitions
    const chimeraMode = useSyncExternalStore(
        store.subscribe,
        selectChimeraMode,
        selectChimeraMode
    );
    const selectedDefinitions = useSyncExternalStore(
        store.subscribe,
        selectSelectedDefinitions,
        selectSelectedDefinitions
    );

    const config = getModalConfig(type, chimeraMode);
    const HeaderIcon = getHeaderIcon(type);

    // Get the appropriate selection data based on type
    const selectionData = useMemo(() => {
        switch (type) {
            case 'behaviors':
                return {
                    selectedItems: selections.behaviors || [],
                    dominantItem: selections.dominantBehavior,
                    toggleAction: actions.toggleBehavior,
                    setDominantAction: actions.setDominantBehavior,
                    clearAction: () => {
                        actions.setSelectedBehaviors([]);
                        actions.setDominantBehavior(null);
                    },
                };
            case 'personalities':
                return {
                    selectedItems: selections.personalities || [],
                    dominantItem: selections.dominantPersonality,
                    toggleAction: actions.togglePersonality,
                    setDominantAction: actions.setDominantPersonality,
                    clearAction: () => {
                        actions.setSelectedPersonalities([]);
                        actions.setDominantPersonality(null);
                    },
                };
            case 'definitions':
                if (chimeraMode) {
                    return {
                        selectedItems: selectedDefinitions,
                        dominantItem: null,
                        toggleAction: actions.toggleChimeraDefinition,
                        setDominantAction: null,
                        clearAction: actions.clearChimeraDefinitions,
                    };
                }
                return {
                    selectedItems: selections.definition ? [selections.definition] : [],
                    dominantItem: null,
                    toggleAction: (selection) => {
                        const current = selections.definition;
                        if (current &&
                            current.packName === selection.packName &&
                            current.itemName === selection.itemName) {
                            actions.setSelectedDefinition(null);
                        } else {
                            actions.setSelectedDefinition(selection);
                        }
                    },
                    setDominantAction: null,
                    clearAction: () => actions.setSelectedDefinition(null),
                };
            default:
                return {
                    selectedItems: [],
                    dominantItem: null,
                    toggleAction: () => {},
                    setDominantAction: null,
                    clearAction: () => {},
                };
        }
    }, [type, selections, actions, chimeraMode, selectedDefinitions]);

    const {
        selectedItems,
        dominantItem,
        toggleAction,
        setDominantAction,
        clearAction,
    } = selectionData;

    // Save to extension whenever selections change
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            saveToExtension();
        }, 100);
        return () => clearTimeout(timeoutId);
    }, [selectedItems, dominantItem]);

    // State for collapse/expand all
    const [collapsedPacks, setCollapsedPacks] = useState(new Set());

    // State for sorting
    const [sortBy, setSortBy] = useState('default');

    // Filter packs to get Lumia items of the correct type
    const packsWithItems = useMemo(() => {
        return allPacks
            .map((pack) => {
                const lumiaItems = getLumiaItemsFromPack(pack, type);
                return {
                    ...pack,
                    lumiaItems,
                    isEditable: pack.isCustom || pack.isEditable || false,
                };
            })
            .filter((pack) => pack.lumiaItems.length > 0);
    }, [allPacks, type]);

    // Sorted packs
    const sortedPacks = useMemo(() => {
        if (sortBy === 'default') return packsWithItems;

        return [...packsWithItems].sort((a, b) => {
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
    }, [packsWithItems, sortBy]);

    // Collapse/Expand all functions
    const collapseAll = () => {
        const allPackNames = packsWithItems.map(p => p.name || p.packName);
        setCollapsedPacks(new Set(allPackNames));
    };

    const expandAll = () => {
        setCollapsedPacks(new Set());
    };

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

    const isPackCollapsed = useCallback((packName) => collapsedPacks.has(packName), [collapsedPacks]);

    // Check if an item is selected
    const isSelected = useCallback((item, packName) => {
        const itemName = getLumiaField(item, 'name');
        return selectedItems.some((selected) =>
            selected.packName === packName && selected.itemName === itemName
        );
    }, [selectedItems]);

    // Check if an item is the dominant trait
    const isDominant = useCallback((item, packName) => {
        if (!dominantItem) return false;
        const itemName = getLumiaField(item, 'name');
        return dominantItem.packName === packName && dominantItem.itemName === itemName;
    }, [dominantItem]);

    // Handle item selection
    const handleSelect = useCallback((item, packName) => {
        const selection = {
            packName: packName,
            itemName: getLumiaField(item, 'name'),
        };
        toggleAction(selection);
    }, [toggleAction]);

    // Handle setting dominant trait
    const handleSetDominant = useCallback((item, packName) => {
        if (!setDominantAction) return;

        const selection = {
            packName: packName,
            itemName: getLumiaField(item, 'name'),
        };

        if (!isSelected(item, packName)) {
            toggleAction(selection);
        }

        if (isDominant(item, packName)) {
            setDominantAction(null);
        } else {
            setDominantAction(selection);
        }
    }, [setDominantAction, toggleAction, isSelected, isDominant]);

    const handleClearAll = useCallback(() => {
        clearAction();
    }, [clearAction]);

    const handleRemovePack = useCallback((packName) => {
        if (!window.confirm(`Delete pack "${packName}"? This action cannot be undone.`)) {
            return;
        }
        actions.removeCustomPack(packName);
        saveToExtension();
    }, [actions]);

    // Handle editing a Lumia item from a custom pack
    const handleEditItem = useCallback((item, packName) => {
        actions.openModal('lumiaEditor', {
            packName: packName,
            editingItem: item,
        });
    }, [actions]);

    return (
        <div style={styles.layout}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerIcon}>
                    <HeaderIcon size={20} />
                </div>
                <div style={styles.headerText}>
                    <h3 style={styles.title}>{config.title}</h3>
                    <p style={styles.subtitle}>{config.subtitle}</p>
                </div>
                <button style={styles.clearBtn} onClick={handleClearAll} title="Clear all selections">
                    <XCircle size={14} />
                    <span>Clear</span>
                </button>
                <button 
                    style={styles.headerCloseBtn} 
                    onClick={onClose}
                    title="Close modal"
                >
                    <X size={20} />
                </button>
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
                {sortedPacks.length === 0 ? (
                    <div style={styles.empty}>
                        No Lumia Packs loaded. Add one in settings!
                    </div>
                ) : (
                    sortedPacks.map((pack) => {
                        const packName = pack.name || pack.packName;
                        return (
                            <PackSection
                                key={pack.id || packName}
                                pack={pack}
                                items={pack.lumiaItems}
                                isEditable={pack.isEditable}
                                type={type}
                                isSelected={isSelected}
                                isDominant={isDominant}
                                onSelect={handleSelect}
                                onSetDominant={handleSetDominant}
                                showDominant={allowDominant && config.isMulti}
                                onRemovePack={handleRemovePack}
                                onEditItem={handleEditItem}
                                isCollapsed={isPackCollapsed(packName)}
                                onToggleCollapse={togglePackCollapse}
                            />
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div style={styles.footer}>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={onClose}>
                    Close
                </button>
                {config.isMulti && (
                    <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={onClose}>
                        Done
                    </button>
                )}
            </div>
        </div>
    );
}

export default SelectionModal;
