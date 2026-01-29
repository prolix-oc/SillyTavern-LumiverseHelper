import React, { useState, useMemo, useSyncExternalStore, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, Layers, Wrench, Sparkles, ChevronDown, ChevronUp, Check, Plus } from 'lucide-react';
import { useLumiverseStore, useLumiverseActions, useLoomSelections, saveToExtension } from '../../store/LumiverseContext';

/* global toastr */

// Get store for direct access
const store = useLumiverseStore;

// Stable fallback constants for useSyncExternalStore
const EMPTY_OBJECT = {};

// Stable selector functions
const selectViewingLoomPack = () => store.getState().ui?.viewingLoomPack;
const selectPacks = () => store.getState().packs || EMPTY_OBJECT;

/**
 * Loom category configuration
 */
const LOOM_CATEGORIES = {
    'Narrative Style': {
        Icon: Sparkles,
        color: 'rgba(147, 112, 219, 0.15)',
        colorActive: 'rgba(147, 112, 219, 0.25)',
        border: 'rgba(147, 112, 219, 0.3)',
        borderActive: 'rgba(147, 112, 219, 0.6)',
        storeField: 'styles',
        toggleAction: 'toggleLoomStyle',
    },
    'Loom Utilities': {
        Icon: Wrench,
        color: 'rgba(100, 200, 255, 0.15)',
        colorActive: 'rgba(100, 200, 255, 0.25)',
        border: 'rgba(100, 200, 255, 0.3)',
        borderActive: 'rgba(100, 200, 255, 0.6)',
        storeField: 'utilities',
        toggleAction: 'toggleLoomUtility',
    },
    'Retrofits': {
        Icon: Layers,
        color: 'rgba(255, 180, 100, 0.15)',
        colorActive: 'rgba(255, 180, 100, 0.25)',
        border: 'rgba(255, 180, 100, 0.3)',
        borderActive: 'rgba(255, 180, 100, 0.6)',
        storeField: 'retrofits',
        toggleAction: 'toggleLoomRetrofit',
    },
};

/**
 * Self-contained styles matching the new modal design pattern
 */
const styles = {
    backdrop: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
    },
    modal: {
        background: 'var(--lumiverse-bg, #1a1a2e)',
        borderRadius: '16px',
        border: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.1))',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        width: '100%',
        maxWidth: '600px',
        maxHeight: 'calc(100vh - 40px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
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
        width: '44px',
        height: '44px',
        borderRadius: '10px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(147, 112, 219, 0.2), rgba(147, 112, 219, 0.1))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--lumiverse-primary, #9370db)',
        flexShrink: 0,
    },
    headerIconImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    headerText: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 600,
        color: 'var(--lumiverse-text, #e0e0e0)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    stats: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginTop: '4px',
        fontSize: '12px',
        color: 'var(--lumiverse-text-muted, #999)',
    },
    statItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
    },
    closeBtn: {
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        border: 'none',
        background: 'transparent',
        color: 'var(--lumiverse-text-muted, #999)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        flexShrink: 0,
    },
    scrollArea: {
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        padding: '16px 20px',
    },
    empty: {
        textAlign: 'center',
        padding: '40px 20px',
        color: 'var(--lumiverse-text-muted, #999)',
    },
    emptyIcon: {
        marginBottom: '12px',
        opacity: 0.5,
    },
    categorySection: {
        marginBottom: '16px',
    },
    categoryHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        background: 'transparent',
        border: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.1))',
        borderRadius: '10px',
        width: '100%',
        color: 'var(--lumiverse-text, #e0e0e0)',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background 0.15s ease',
    },
    categoryHeaderExpanded: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        background: 'rgba(0, 0, 0, 0.2)',
    },
    categoryIcon: {
        width: '24px',
        height: '24px',
        borderRadius: '6px',
        background: 'rgba(147, 112, 219, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--lumiverse-primary, #9370db)',
    },
    categoryTitle: {
        flex: 1,
        textAlign: 'left',
    },
    categoryCount: {
        fontSize: '11px',
        color: 'var(--lumiverse-text-muted, #999)',
        background: 'rgba(0, 0, 0, 0.3)',
        padding: '2px 8px',
        borderRadius: '10px',
    },
    categoryChevron: {
        color: 'var(--lumiverse-text-muted, #999)',
        transition: 'transform 0.2s ease',
    },
    categoryItems: {
        border: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.1))',
        borderTop: 'none',
        borderBottomLeftRadius: '10px',
        borderBottomRightRadius: '10px',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    itemCard: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid',
        transition: 'all 0.15s ease',
    },
    itemHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    itemIcon: {
        width: '20px',
        height: '20px',
        borderRadius: '5px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemName: {
        flex: 1,
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--lumiverse-text, #e0e0e0)',
    },
    itemToggle: {
        width: '24px',
        height: '24px',
        borderRadius: '6px',
        border: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.15))',
        background: 'rgba(0, 0, 0, 0.2)',
        color: 'var(--lumiverse-text-muted, #999)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
    },
    itemToggleSelected: {
        background: 'var(--lumiverse-primary, #9370db)',
        borderColor: 'var(--lumiverse-primary, #9370db)',
        color: '#fff',
    },
    contentToggle: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        background: 'rgba(0, 0, 0, 0.2)',
        border: 'none',
        borderRadius: '6px',
        width: 'fit-content',
        color: 'var(--lumiverse-text-muted, #999)',
        fontSize: '11px',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
    },
    contentText: {
        fontSize: '12px',
        lineHeight: 1.6,
        color: 'var(--lumiverse-text-muted, #999)',
        padding: '8px 10px',
        background: 'rgba(0, 0, 0, 0.15)',
        borderRadius: '6px',
        margin: 0,
    },
};

/**
 * Truncate text to a maximum length with ellipsis
 */
function truncateText(text, maxLength = 200) {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}

/**
 * Collapsible content preview component
 */
function ContentPreview({ content, defaultOpen = false }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    if (!content) return null;

    return (
        <>
            <button
                style={styles.contentToggle}
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span>Preview</span>
                <span>
                    {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </span>
            </button>
            {isOpen && (
                <p style={styles.contentText}>{truncateText(content, 500)}</p>
            )}
        </>
    );
}

/**
 * Loom item card
 */
function LoomItemCard({ item, packName, category, isSelected, onToggle }) {
    const config = LOOM_CATEGORIES[category] || LOOM_CATEGORIES['Narrative Style'];
    const { Icon, color, colorActive, border, borderActive } = config;
    const itemName = item.loomName || item.itemName || item.name || 'Unknown';

    return (
        <div
            style={{
                ...styles.itemCard,
                background: isSelected ? colorActive : color,
                borderColor: isSelected ? borderActive : border,
            }}
        >
            <div style={styles.itemHeader}>
                <span style={{ ...styles.itemIcon, background: isSelected ? colorActive : color }}>
                    <Icon size={12} strokeWidth={1.5} />
                </span>
                <span style={styles.itemName}>{itemName}</span>
                <button
                    style={{
                        ...styles.itemToggle,
                        ...(isSelected ? styles.itemToggleSelected : {}),
                    }}
                    onClick={() => onToggle(packName, itemName)}
                    title={isSelected ? 'Remove from selection' : 'Add to selection'}
                    type="button"
                >
                    {isSelected ? <Check size={12} strokeWidth={2} /> : <Plus size={12} strokeWidth={2} />}
                </button>
            </div>
            <ContentPreview content={item.loomContent || item.content} />
        </div>
    );
}

/**
 * Category section within the modal
 */
function CategorySection({ category, items, packName, selections, actions }) {
    const [isExpanded, setIsExpanded] = useState(true);
    const config = LOOM_CATEGORIES[category];
    const { Icon, storeField, toggleAction } = config;

    // Check if an item is selected
    const isSelected = useCallback((itemName) => {
        const categorySelections = selections[storeField] || [];
        return categorySelections.some(
            s => s.packName === packName && s.itemName === itemName
        );
    }, [selections, storeField, packName]);

    // Handle toggle
    const handleToggle = useCallback((pn, itemName) => {
        if (actions[toggleAction]) {
            actions[toggleAction]({ packName: pn, itemName });
            saveToExtension();
            if (typeof toastr !== 'undefined') {
                const wasSelected = isSelected(itemName);
                toastr.success(wasSelected ? `Removed "${itemName}"` : `Added "${itemName}"`);
            }
        }
    }, [actions, toggleAction, isSelected]);

    if (!items || items.length === 0) return null;

    return (
        <div style={styles.categorySection}>
            <button
                style={{
                    ...styles.categoryHeader,
                    ...(isExpanded ? styles.categoryHeaderExpanded : {}),
                }}
                onClick={() => setIsExpanded(!isExpanded)}
                type="button"
            >
                <span style={styles.categoryIcon}>
                    <Icon size={14} strokeWidth={1.5} />
                </span>
                <span style={styles.categoryTitle}>{category}</span>
                <span style={styles.categoryCount}>{items.length}</span>
                <span style={styles.categoryChevron}>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
            </button>
            {isExpanded && (
                <div style={styles.categoryItems}>
                    {items.map((item, index) => {
                        const itemName = item.loomName || item.itemName || item.name;
                        return (
                            <LoomItemCard
                                key={itemName || index}
                                item={item}
                                packName={packName}
                                category={category}
                                isSelected={isSelected(itemName)}
                                onToggle={handleToggle}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/**
 * Helper to get Loom items from a pack, grouped by category
 * Supports multiple schema formats:
 * - v2 schema: pack.loomItems[] with loomCategory field
 * - Legacy separate arrays: pack.loomStyles, pack.loomUtils, pack.loomRetrofits
 * - Legacy mixed items: pack.items[] with loomCategory field
 */
function getLoomItemsByCategory(pack) {
    const categories = {
        'Narrative Style': [],
        'Loom Utilities': [],
        'Retrofits': [],
    };

    // Helper to categorize a loom item
    const categorizeItem = (item) => {
        const cat = item.loomCategory || item.category;
        if (cat === 'Narrative Style' || cat === 'loomStyles') {
            categories['Narrative Style'].push(item);
        } else if (cat === 'Loom Utilities' || cat === 'loomUtils') {
            categories['Loom Utilities'].push(item);
        } else if (cat === 'Retrofits' || cat === 'loomRetrofits') {
            categories['Retrofits'].push(item);
        }
    };

    // v2 schema: separate loomItems array
    if (pack.loomItems && Array.isArray(pack.loomItems)) {
        pack.loomItems.forEach(categorizeItem);
    }

    // Legacy separate arrays
    if (pack.loomStyles && Array.isArray(pack.loomStyles)) {
        categories['Narrative Style'].push(...pack.loomStyles);
    }
    if (pack.loomUtils && Array.isArray(pack.loomUtils)) {
        categories['Loom Utilities'].push(...pack.loomUtils);
    }
    if (pack.loomRetrofits && Array.isArray(pack.loomRetrofits)) {
        categories['Retrofits'].push(...pack.loomRetrofits);
    }

    // Legacy mixed items array (check for loomCategory to identify loom items)
    if (pack.items && Array.isArray(pack.items)) {
        pack.items.forEach(item => {
            // Only process items that have a loomCategory (i.e., are loom items, not lumia items)
            if (item.loomCategory || item.category) {
                categorizeItem(item);
            }
        });
    }

    return categories;
}

/**
 * Loom Pack Detail Modal - shows all Loom items in a pack with quick-add actions
 * Uses createPortal to render at document.body level for proper event handling
 */
function LoomPackDetailModal() {
    const actions = useLumiverseActions();
    const loomSelections = useLoomSelections();

    // Subscribe to viewingLoomPack and packs
    const viewingLoomPack = useSyncExternalStore(
        store.subscribe,
        selectViewingLoomPack,
        selectViewingLoomPack
    );

    const packs = useSyncExternalStore(
        store.subscribe,
        selectPacks,
        selectPacks
    );

    // Get the pack data
    const pack = useMemo(() => {
        if (!viewingLoomPack) return null;
        return packs[viewingLoomPack] || null;
    }, [viewingLoomPack, packs]);

    // Get Loom items grouped by category
    const loomCategories = useMemo(() => {
        if (!pack) return null;
        return getLoomItemsByCategory(pack);
    }, [pack]);

    // Calculate stats
    const stats = useMemo(() => {
        if (!loomCategories) return { styles: 0, utilities: 0, retrofits: 0 };
        return {
            styles: loomCategories['Narrative Style'].length,
            utilities: loomCategories['Loom Utilities'].length,
            retrofits: loomCategories['Retrofits'].length,
        };
    }, [loomCategories]);

    const totalItems = stats.styles + stats.utilities + stats.retrofits;

    const handleClose = useCallback(() => {
        actions.closeLoomPackDetail();
    }, [actions]);

    // Handle escape key and body scroll lock
    useEffect(() => {
        if (!viewingLoomPack || !pack) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [viewingLoomPack, pack, handleClose]);

    // Stop all pointer/mouse/touch events from propagating to ST's drawer handlers
    const stopAllPropagation = useCallback((e) => {
        e.stopPropagation();
    }, []);

    // Handle backdrop click - close only if clicking backdrop itself
    const handleBackdropClick = useCallback((e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) {
            handleClose();
        }
    }, [handleClose]);

    // Don't render if no pack is being viewed
    if (!viewingLoomPack || !pack) return null;

    // Use createPortal to render at document.body level
    return createPortal(
        <div
            style={styles.backdrop}
            onClick={handleBackdropClick}
            onMouseDown={stopAllPropagation}
            onMouseUp={stopAllPropagation}
            onPointerDown={stopAllPropagation}
            onPointerUp={stopAllPropagation}
            onTouchStart={stopAllPropagation}
            onTouchEnd={stopAllPropagation}
        >
            <div
                style={styles.modal}
                onClick={stopAllPropagation}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.headerIcon}>
                        {pack.packCover ? (
                            <img src={pack.packCover} alt={viewingLoomPack} style={styles.headerIconImg} />
                        ) : (
                            <Layers size={24} strokeWidth={1.5} />
                        )}
                    </div>
                    <div style={styles.headerText}>
                        <h3 style={styles.title}>{viewingLoomPack}</h3>
                        <div style={styles.stats}>
                            <span style={styles.statItem}>
                                <Sparkles size={12} /> {stats.styles} Style{stats.styles !== 1 ? 's' : ''}
                            </span>
                            <span style={styles.statItem}>
                                <Wrench size={12} /> {stats.utilities} Utilit{stats.utilities !== 1 ? 'ies' : 'y'}
                            </span>
                            <span style={styles.statItem}>
                                <Layers size={12} /> {stats.retrofits} Retrofit{stats.retrofits !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    <button
                        style={styles.closeBtn}
                        onClick={handleClose}
                        title="Close"
                        type="button"
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <X size={20} strokeWidth={2} />
                    </button>
                </div>

                {/* Content */}
                <div style={styles.scrollArea}>
                    {totalItems === 0 ? (
                        <div style={styles.empty}>
                            <div style={styles.emptyIcon}>
                                <Layers size={32} strokeWidth={1.5} />
                            </div>
                            <p style={{ margin: 0 }}>No Loom items found in this pack</p>
                        </div>
                    ) : (
                        <>
                            <CategorySection
                                category="Narrative Style"
                                items={loomCategories['Narrative Style']}
                                packName={viewingLoomPack}
                                selections={loomSelections}
                                actions={actions}
                            />
                            <CategorySection
                                category="Loom Utilities"
                                items={loomCategories['Loom Utilities']}
                                packName={viewingLoomPack}
                                selections={loomSelections}
                                actions={actions}
                            />
                            <CategorySection
                                category="Retrofits"
                                items={loomCategories['Retrofits']}
                                packName={viewingLoomPack}
                                selections={loomSelections}
                                actions={actions}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

export default LoomPackDetailModal;
