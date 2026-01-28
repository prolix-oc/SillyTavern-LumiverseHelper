import React, { useState, useMemo, useSyncExternalStore, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
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
        border: 'rgba(147, 112, 219, 0.3)',
        storeField: 'styles',
        toggleAction: 'toggleLoomStyle',
    },
    'Loom Utilities': {
        Icon: Wrench,
        color: 'rgba(100, 200, 255, 0.15)',
        border: 'rgba(100, 200, 255, 0.3)',
        storeField: 'utilities',
        toggleAction: 'toggleLoomUtility',
    },
    'Retrofits': {
        Icon: Layers,
        color: 'rgba(255, 180, 100, 0.15)',
        border: 'rgba(255, 180, 100, 0.3)',
        storeField: 'retrofits',
        toggleAction: 'toggleLoomRetrofit',
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
        <div className="lumiverse-loom-detail-content-preview">
            <button
                className={clsx('lumiverse-loom-detail-content-toggle', isOpen && 'lumiverse-loom-detail-content-toggle--open')}
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span>Preview</span>
                <span className="lumiverse-loom-detail-content-chevron">
                    {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </span>
            </button>
            {isOpen && (
                <div className="lumiverse-loom-detail-content-text">
                    <p>{truncateText(content, 500)}</p>
                </div>
            )}
        </div>
    );
}

/**
 * Loom item card
 */
function LoomItemCard({ item, packName, category, isSelected, onToggle }) {
    const config = LOOM_CATEGORIES[category] || LOOM_CATEGORIES['Narrative Style'];
    const { Icon } = config;
    const itemName = item.loomName || item.itemName || item.name || 'Unknown';

    return (
        <div
            className={clsx(
                'lumiverse-loom-detail-item',
                isSelected && 'lumiverse-loom-detail-item--selected'
            )}
            style={{
                background: isSelected ? config.color.replace('0.15', '0.25') : config.color,
                borderColor: isSelected ? config.border.replace('0.3', '0.6') : config.border,
            }}
        >
            <div className="lumiverse-loom-detail-item-header">
                <span className="lumiverse-loom-detail-item-icon">
                    <Icon size={14} strokeWidth={1.5} />
                </span>
                <span className="lumiverse-loom-detail-item-name">{itemName}</span>
                <button
                    className={clsx(
                        'lumiverse-loom-detail-item-toggle',
                        isSelected && 'lumiverse-loom-detail-item-toggle--selected'
                    )}
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
        <div className="lumiverse-loom-detail-category">
            <button
                className={clsx(
                    'lumiverse-loom-detail-category-header',
                    isExpanded && 'lumiverse-loom-detail-category-header--expanded'
                )}
                onClick={() => setIsExpanded(!isExpanded)}
                type="button"
            >
                <span className="lumiverse-loom-detail-category-icon">
                    <Icon size={16} strokeWidth={1.5} />
                </span>
                <span className="lumiverse-loom-detail-category-title">{category}</span>
                <span className="lumiverse-loom-detail-category-count">{items.length}</span>
                <span className="lumiverse-loom-detail-category-chevron">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
            </button>
            {isExpanded && (
                <div className="lumiverse-loom-detail-category-items">
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
    // Use lumia-modal-backdrop + lumia-modal for consistent centering with other modals
    return createPortal(
        <div
            className="lumia-modal-backdrop"
            onClick={handleBackdropClick}
            onMouseDown={stopAllPropagation}
            onMouseUp={stopAllPropagation}
            onPointerDown={stopAllPropagation}
            onPointerUp={stopAllPropagation}
            onTouchStart={stopAllPropagation}
            onTouchEnd={stopAllPropagation}
        >
            <div
                className="lumia-modal lumiverse-pack-detail-modal lumiverse-loom-detail-modal"
                onClick={stopAllPropagation}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="lumiverse-pack-detail-header">
                    <div className="lumiverse-pack-detail-header-info">
                        <span className="lumiverse-pack-detail-header-icon">
                            {pack.packCover ? (
                                <img src={pack.packCover} alt={viewingLoomPack} />
                            ) : (
                                <Layers size={24} strokeWidth={1.5} />
                            )}
                        </span>
                        <div className="lumiverse-pack-detail-header-text">
                            <h3 className="lumiverse-pack-detail-title">{viewingLoomPack}</h3>
                            <div className="lumiverse-pack-detail-stats">
                                <span>
                                    <Sparkles size={12} /> {stats.styles} Style{stats.styles !== 1 ? 's' : ''}
                                </span>
                                <span>
                                    <Wrench size={12} /> {stats.utilities} Utilit{stats.utilities !== 1 ? 'ies' : 'y'}
                                </span>
                                <span>
                                    <Layers size={12} /> {stats.retrofits} Retrofit{stats.retrofits !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        className="lumiverse-pack-detail-close"
                        onClick={handleClose}
                        title="Close"
                        type="button"
                    >
                        <X size={20} strokeWidth={2} />
                    </button>
                </div>

                {/* Content */}
                <div className="lumiverse-pack-detail-content">
                    {totalItems === 0 ? (
                        <div className="lumiverse-pack-detail-empty">
                            <Layers size={32} strokeWidth={1.5} />
                            <p>No Loom items found in this pack</p>
                        </div>
                    ) : (
                        <div className="lumiverse-loom-detail-categories">
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
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

export default LoomPackDetailModal;
