import React, { useState, useMemo, useEffect } from 'react';
import {
    usePacks,
    useSelections,
    useLumiverseActions,
} from '../../store/LumiverseContext';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';
import clsx from 'clsx';

// SVG icons matching the old design exactly
const SVG_ICONS = {
    star: `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    check: `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
    clear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    definition: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    behavior: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
    personality: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 2a10 10 0 0 1 10 10"></path><circle cx="12" cy="12" r="6"></circle></svg>`,
};

/**
 * Render SVG icon from string
 */
function Icon({ name, className }) {
    const svg = SVG_ICONS[name];
    if (!svg) return null;
    return (
        <span
            className={className}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}

/**
 * Individual card component matching old design
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

    // Get display values - OLD CODE FORMAT
    // item.lumiaDefName is the name field for Lumia items
    // item.lumia_img is the image URL
    const displayName = item.lumiaDefName || 'Unknown';
    const imgToShow = item.lumia_img;

    // Adaptive image positioning based on aspect ratio
    const { objectPosition } = useAdaptiveImagePosition(imgToShow);

    const handleCardClick = (e) => {
        // Don't trigger if clicking dominant icon or edit button
        if (e.target.closest('.lumia-dominant-icon')) return;
        if (e.target.closest('.lumia-edit-icon')) return;
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

    // Staggered animation delay
    const animationDelay = Math.min(animationIndex * 30, 300);

    return (
        <div
            className={clsx(
                'lumia-card',
                'lumia-card-appear',
                isDefinition && 'definition-card',
                isSelected && 'selected'
            )}
            style={{ animationDelay: `${animationDelay}ms` }}
            onClick={handleCardClick}
            data-pack={packName}
            data-item={displayName}
        >
            <div className="lumia-card-image">
                {imgToShow && !imageError ? (
                    <>
                        <img
                            src={imgToShow}
                            alt={displayName}
                            loading="lazy"
                            className={imageLoaded ? 'lumia-img-loaded' : ''}
                            style={{ objectPosition }}
                            onLoad={() => setImageLoaded(true)}
                            onError={() => setImageError(true)}
                        />
                        {!imageLoaded && <div className="lumia-img-spinner" />}
                    </>
                ) : (
                    <div className="lumia-card-placeholder">?</div>
                )}

                {/* Edit Icon for custom pack items */}
                {isEditable && onEdit && (
                    <div
                        className="lumia-edit-icon"
                        onClick={handleEditClick}
                        title="Edit this Lumia"
                    >
                        <Icon name="edit" />
                    </div>
                )}

                {/* Dominant Star Icon */}
                {showDominant && (
                    <div
                        className={clsx(
                            'lumia-dominant-icon',
                            isDominant && 'dominant'
                        )}
                        onClick={handleDominantClick}
                        title={isDominant ? 'Remove as dominant' : 'Set as dominant trait'}
                    >
                        <Icon name="star" />
                    </div>
                )}

                {/* Selection Checkmark */}
                <div className="lumia-card-check">
                    <Icon name="check" />
                </div>
            </div>

            <div className="lumia-card-info">
                <div className="lumia-card-name">{displayName}</div>
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
}) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const packName = pack.name || pack.packName || 'Unknown Pack';

    const handleHeaderClick = (e) => {
        // Don't collapse if clicking remove button
        if (e.target.closest('.lumia-remove-pack-btn')) return;
        setIsCollapsed(!isCollapsed);
    };

    return (
        <div className={clsx('lumia-modal-panel', 'lumia-collapsible', 'lumia-pack-section', isCollapsed && 'collapsed')}>
            <div className="lumia-modal-panel-header lumia-collapsible-trigger" onClick={handleHeaderClick}>
                <span className="lumia-panel-collapse-icon">
                    <Icon name="chevron" />
                </span>
                <span className="lumia-modal-panel-icon">
                    <Icon name="folder" />
                </span>
                <span className="lumia-modal-panel-title">{packName}</span>
                {isEditable && <span className="lumia-pack-badge-custom">Custom</span>}
                <span className="lumia-modal-panel-count">{items.length} items</span>
                <button
                    className="lumia-icon-btn-sm lumia-remove-pack-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemovePack(packName);
                    }}
                    title="Remove Pack"
                >
                    <Icon name="trash" />
                </button>
            </div>
            <div className="lumia-modal-panel-content lumia-modal-panel-content-cards lumia-collapsible-content">
                <div className="lumia-card-grid">
                    {items.map((item, index) => (
                        <LumiaCard
                            key={item.lumiaDefName || item.id || index}
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
            </div>
        </div>
    );
}

/**
 * Get Lumia items from a pack (filtering out Loom/Narrative Style items)
 *
 * OLD CODE FORMAT:
 * - Lumia items have: lumiaDefName, lumia_img, lumiaDef, lumia_behavior, lumia_personality
 * - Loom items have: loomName, loomCategory, loomContent
 *
 * In the old code, the selection modal shows ALL items with lumiaDefName,
 * regardless of whether they're definitions, behaviors, or personalities.
 * The same items appear in all three selection modals.
 *
 * This matches the old code: packItems.filter((item) => item.lumiaDefName)
 */
function getLumiaItemsFromPack(pack, type) {
    const packItems = pack.items || [];

    // Filter to only Lumia items (have lumiaDefName, not loomCategory)
    return packItems.filter(item => {
        // Skip Loom items
        if (item.loomCategory) return false;
        // Must have lumiaDefName to be a Lumia item
        if (!item.lumiaDefName) return false;
        return true;
    });
}

/**
 * Get header icon based on type
 */
function getHeaderIcon(type) {
    switch (type) {
        case 'definitions': return 'definition';
        case 'behaviors': return 'behavior';
        case 'personalities': return 'personality';
        default: return 'definition';
    }
}

/**
 * Get modal config based on type
 */
function getModalConfig(type) {
    switch (type) {
        case 'definitions':
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
 * Main selection modal component - card-based design matching old UI
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

    const config = getModalConfig(type);
    const headerIcon = getHeaderIcon(type);

    /**
     * Get the appropriate selection data based on type
     *
     * OLD CODE FORMAT:
     * - Selections are stored as: { packName: string, itemName: string }
     * - selectedItems is an array of { packName, itemName }
     * - dominantItem is { packName, itemName } or null
     */
    const {
        selectedItems,
        dominantItem,
        toggleAction,
        setDominantAction,
        clearAction,
    } = useMemo(() => {
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
                return {
                    selectedItems: selections.definition ? [selections.definition] : [],
                    dominantItem: null,
                    toggleAction: (selection) => {
                        // selection = { packName, itemName }
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
    }, [type, selections, actions]);

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

    /**
     * Check if an item is selected
     * Comparisons use packName + itemName (old code format)
     *
     * @param {Object} item - The item from pack.items
     * @param {string} packName - The pack this item belongs to
     */
    const isSelected = (item, packName) => {
        const itemName = item.lumiaDefName;
        return selectedItems.some((selected) =>
            selected.packName === packName && selected.itemName === itemName
        );
    };

    /**
     * Check if an item is the dominant trait
     */
    const isDominant = (item, packName) => {
        if (!dominantItem) return false;
        const itemName = item.lumiaDefName;
        return dominantItem.packName === packName && dominantItem.itemName === itemName;
    };

    /**
     * Handle item selection
     * Converts item + packName to { packName, itemName } format for storage
     */
    const handleSelect = (item, packName) => {
        const selection = {
            packName: packName,
            itemName: item.lumiaDefName,
        };
        toggleAction(selection);
    };

    /**
     * Handle setting dominant trait
     */
    const handleSetDominant = (item, packName) => {
        if (!setDominantAction) return;

        const selection = {
            packName: packName,
            itemName: item.lumiaDefName,
        };

        // If item isn't selected, select it first
        if (!isSelected(item, packName)) {
            toggleAction(selection);
        }

        // Toggle dominant - use selection format { packName, itemName }
        if (isDominant(item, packName)) {
            setDominantAction(null);
        } else {
            setDominantAction(selection);
        }
    };

    const handleClearAll = () => {
        clearAction();
    };

    const handleRemovePack = (packName) => {
        // This would need to call an action to remove the pack
        // For now just log - the actual implementation depends on the context
        console.log('Remove pack:', packName);
        // actions.removePack?.(packName);
    };

    /**
     * Handle editing a Lumia item from a custom pack
     * Opens the LumiaEditorModal with the item for editing
     */
    const handleEditItem = (item, packName) => {
        actions.openModal('lumiaEditor', {
            packName: packName,
            editingItem: item,
        });
    };

    return (
        <div className="lumia-modal-selection-content">
            {/* Header with icon, title, subtitle, and clear button */}
            <div className="lumia-modal-header-inner">
                <div className="lumia-modal-header-icon">
                    <Icon name={headerIcon} />
                </div>
                <div className="lumia-modal-header-text">
                    <h3 className="lumia-modal-title">{config.title}</h3>
                    <p className="lumia-modal-subtitle">{config.subtitle}</p>
                </div>
                <button className="lumia-clear-btn" onClick={handleClearAll} title="Clear all selections">
                    <Icon name="clear" />
                    <span>Clear</span>
                </button>
            </div>

            {/* Content - pack sections with cards */}
            <div className="lumia-modal-content">
                {packsWithItems.length === 0 ? (
                    <div className="lumia-modal-empty">
                        No Lumia Packs loaded. Add one in settings!
                    </div>
                ) : (
                    packsWithItems.map((pack) => (
                        <PackSection
                            key={pack.id || pack.name || pack.packName}
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
                        />
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="lumia-modal-footer">
                <button className="lumia-modal-btn lumia-modal-btn-secondary lumia-modal-close-btn" onClick={onClose}>
                    Close
                </button>
                {config.isMulti && (
                    <button className="lumia-modal-btn lumia-modal-btn-primary lumia-modal-done" onClick={onClose}>
                        Done
                    </button>
                )}
            </div>
        </div>
    );
}

export default SelectionModal;
