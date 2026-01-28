import React, { useState, useMemo, useSyncExternalStore, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X, Package, FileText, Zap, Heart, ChevronDown, ChevronUp, Check, Plus, User } from 'lucide-react';
import { useLumiverseStore, useLumiverseActions, useSelections, saveToExtension } from '../../store/LumiverseContext';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';

/* global toastr */

// Get store for direct access
const store = useLumiverseStore;

// Stable fallback constants for useSyncExternalStore
const EMPTY_OBJECT = {};

// Stable selector functions
const selectViewingPack = () => store.getState().ui?.viewingPack;
const selectPacks = () => store.getState().packs || EMPTY_OBJECT;

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
        author: ['authorName', 'defAuthor'],
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
 * Get Lumia items from a pack - supports both new and legacy formats
 */
function getLumiaItemsFromPack(pack) {
    // New format: separate lumiaItems array
    if (pack.lumiaItems && Array.isArray(pack.lumiaItems)) {
        return pack.lumiaItems;
    }

    // Legacy format: mixed items array
    if (pack.items && Array.isArray(pack.items)) {
        return pack.items.filter(item => {
            // Skip Loom items
            if (item.loomCategory) return false;
            // Must have lumiaDefName to be a Lumia item
            if (!item.lumiaDefName) return false;
            return true;
        });
    }

    return [];
}

/**
 * Truncate text to a maximum length with ellipsis
 */
function truncateText(text, maxLength = 200) {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}

/**
 * Collapsible trait preview component
 */
function TraitPreview({ title, Icon, content, defaultOpen = false }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    if (!content) return null;

    return (
        <div className="lumiverse-pack-detail-trait">
            <button
                className={clsx('lumiverse-pack-detail-trait-header', isOpen && 'lumiverse-pack-detail-trait-header--open')}
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span className="lumiverse-pack-detail-trait-icon">
                    <Icon size={14} strokeWidth={1.5} />
                </span>
                <span className="lumiverse-pack-detail-trait-title">{title}</span>
                <span className="lumiverse-pack-detail-trait-chevron">
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
            </button>
            {isOpen && (
                <div className="lumiverse-pack-detail-trait-content">
                    <p>{truncateText(content, 500)}</p>
                </div>
            )}
        </div>
    );
}

/**
 * Quick-add action button
 */
function QuickAddButton({ label, Icon, isSelected, onClick, disabled }) {
    return (
        <button
            className={clsx(
                'lumiverse-pack-detail-action',
                isSelected && 'lumiverse-pack-detail-action--selected'
            )}
            onClick={onClick}
            disabled={disabled}
            title={isSelected ? 'Already selected' : label}
            type="button"
        >
            {isSelected ? <Check size={12} strokeWidth={2} /> : <Plus size={12} strokeWidth={2} />}
            <span>{label}</span>
        </button>
    );
}

/**
 * Lumia detail card within the pack viewer
 */
function LumiaDetailCard({ item, packName, selections, actions }) {
    // Get field values with fallback for old/new format
    const itemName = getLumiaField(item, 'name');
    const itemImg = getLumiaField(item, 'img');
    const itemDef = getLumiaField(item, 'def');
    const itemBehavior = getLumiaField(item, 'behavior');
    const itemPersonality = getLumiaField(item, 'personality');
    const itemAuthor = getLumiaField(item, 'author');

    const { objectPosition } = useAdaptiveImagePosition(itemImg);

    // Check if this item's traits are selected
    const isDefSelected = useMemo(() => {
        if (!selections.definition) return false;
        return selections.definition.packName === packName &&
               selections.definition.itemName === itemName;
    }, [selections.definition, packName, itemName]);

    const isBehaviorSelected = useMemo(() => {
        return (selections.behaviors || []).some(
            b => b.packName === packName && b.itemName === itemName
        );
    }, [selections.behaviors, packName, itemName]);

    const isPersonalitySelected = useMemo(() => {
        return (selections.personalities || []).some(
            p => p.packName === packName && p.itemName === itemName
        );
    }, [selections.personalities, packName, itemName]);

    const handleSetDefinition = useCallback(() => {
        if (isDefSelected) return;
        actions.setSelectedDefinition({ packName, itemName });
        saveToExtension();
        if (typeof toastr !== 'undefined') {
            toastr.success(`Set "${itemName}" as definition`);
        }
    }, [isDefSelected, actions, packName, itemName]);

    const handleAddBehavior = useCallback(() => {
        if (isBehaviorSelected) return;
        actions.toggleBehavior({ packName, itemName });
        saveToExtension();
        if (typeof toastr !== 'undefined') {
            toastr.success(`Added "${itemName}" behavior`);
        }
    }, [isBehaviorSelected, actions, packName, itemName]);

    const handleAddPersonality = useCallback(() => {
        if (isPersonalitySelected) return;
        actions.togglePersonality({ packName, itemName });
        saveToExtension();
        if (typeof toastr !== 'undefined') {
            toastr.success(`Added "${itemName}" personality`);
        }
    }, [isPersonalitySelected, actions, packName, itemName]);

    const hasDefinition = !!itemDef;
    const hasBehavior = !!itemBehavior;
    const hasPersonality = !!itemPersonality;

    // Check if all traits are enabled (for toggle behavior)
    const hasMultipleContentTypes = [hasDefinition, hasBehavior, hasPersonality].filter(Boolean).length > 1;
    const isAllEnabled = hasMultipleContentTypes && actions.areAllTraitsEnabledForLumia(packName, itemName);

    const handleToggleAll = useCallback(() => {
        const enabled = actions.toggleAllTraitsForLumia(packName, itemName);
        saveToExtension();
        if (typeof toastr !== 'undefined') {
            if (enabled) {
                toastr.success(`Enabled all traits for "${itemName}"`);
            } else {
                toastr.info(`Disabled all traits for "${itemName}"`);
            }
        }
    }, [actions, packName, itemName]);

    return (
        <div className="lumiverse-pack-detail-lumia">
            <div className="lumiverse-pack-detail-lumia-header">
                <div className="lumiverse-pack-detail-lumia-avatar">
                    {itemImg ? (
                        <img
                            src={itemImg}
                            alt={itemName}
                            style={{ objectPosition }}
                        />
                    ) : (
                        <User size={24} strokeWidth={1.5} />
                    )}
                </div>
                <div className="lumiverse-pack-detail-lumia-info">
                    <h4 className="lumiverse-pack-detail-lumia-name">{itemName}</h4>
                    {itemAuthor && (
                        <span className="lumiverse-pack-detail-lumia-author">by {itemAuthor}</span>
                    )}
                </div>
            </div>

            {/* Trait previews */}
            <div className="lumiverse-pack-detail-traits">
                <TraitPreview
                    title="Definition"
                    Icon={FileText}
                    content={itemDef}
                    defaultOpen={false}
                />
                <TraitPreview
                    title="Behavior"
                    Icon={Zap}
                    content={itemBehavior}
                    defaultOpen={false}
                />
                <TraitPreview
                    title="Personality"
                    Icon={Heart}
                    content={itemPersonality}
                    defaultOpen={false}
                />
            </div>

            {/* Quick-add actions */}
            <div className="lumiverse-pack-detail-actions">
                {hasDefinition && (
                    <QuickAddButton
                        label="Set Def"
                        Icon={FileText}
                        isSelected={isDefSelected}
                        onClick={handleSetDefinition}
                    />
                )}
                {hasBehavior && (
                    <QuickAddButton
                        label="Add Behavior"
                        Icon={Zap}
                        isSelected={isBehaviorSelected}
                        onClick={handleAddBehavior}
                    />
                )}
                {hasPersonality && (
                    <QuickAddButton
                        label="Add Personality"
                        Icon={Heart}
                        isSelected={isPersonalitySelected}
                        onClick={handleAddPersonality}
                    />
                )}
                {hasMultipleContentTypes && (
                    <button
                        className={`lumiverse-pack-detail-action lumiverse-pack-detail-action--enable-all${isAllEnabled ? ' all-enabled' : ''}`}
                        onClick={handleToggleAll}
                        title={isAllEnabled ? "Disable all traits for this Lumia" : "Enable all traits for this Lumia"}
                        type="button"
                    >
                        {isAllEnabled ? 'Disable All' : 'Enable All'}
                    </button>
                )}
            </div>
        </div>
    );
}

/**
 * Pack Detail Modal - shows all Lumias in a pack with quick-add actions
 * Uses createPortal to render at document.body level for proper event handling
 */
function PackDetailModal() {
    const actions = useLumiverseActions();
    const selections = useSelections();

    // Subscribe to viewingPack and packs
    const viewingPack = useSyncExternalStore(
        store.subscribe,
        selectViewingPack,
        selectViewingPack
    );

    const packs = useSyncExternalStore(
        store.subscribe,
        selectPacks,
        selectPacks
    );

    // Get the pack data
    const pack = useMemo(() => {
        if (!viewingPack) return null;
        return packs[viewingPack] || null;
    }, [viewingPack, packs]);

    // Get Lumia items from the pack (supports both formats)
    const lumiaItems = useMemo(() => {
        if (!pack) return [];
        const items = getLumiaItemsFromPack(pack);
        // Filter to items with definitions
        return items.filter(item => getLumiaField(item, 'def'));
    }, [pack]);

    // Calculate stats
    const stats = useMemo(() => {
        if (!pack) return { lumias: 0, behaviors: 0, personalities: 0 };

        const items = getLumiaItemsFromPack(pack);
        return {
            lumias: items.filter(i => getLumiaField(i, 'def')).length,
            behaviors: items.filter(i => getLumiaField(i, 'behavior')).length,
            personalities: items.filter(i => getLumiaField(i, 'personality')).length,
        };
    }, [pack]);

    const handleClose = useCallback(() => {
        actions.closePackDetail();
    }, [actions]);

    // Handle escape key and body scroll lock
    useEffect(() => {
        if (!viewingPack || !pack) return;

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
    }, [viewingPack, pack, handleClose]);

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
    if (!viewingPack || !pack) return null;

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
                className="lumia-modal lumiverse-pack-detail-modal"
                onClick={stopAllPropagation}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="lumiverse-pack-detail-header">
                    <div className="lumiverse-pack-detail-header-info">
                        <span className="lumiverse-pack-detail-header-icon">
                            {pack.packCover ? (
                                <img src={pack.packCover} alt={viewingPack} />
                            ) : (
                                <Package size={24} strokeWidth={1.5} />
                            )}
                        </span>
                        <div className="lumiverse-pack-detail-header-text">
                            <h3 className="lumiverse-pack-detail-title">{viewingPack}</h3>
                            <div className="lumiverse-pack-detail-stats">
                                <span>
                                    <FileText size={12} /> {stats.lumias} Lumia{stats.lumias !== 1 ? 's' : ''}
                                </span>
                                <span>
                                    <Zap size={12} /> {stats.behaviors} Behavior{stats.behaviors !== 1 ? 's' : ''}
                                </span>
                                <span>
                                    <Heart size={12} /> {stats.personalities} Personalit{stats.personalities !== 1 ? 'ies' : 'y'}
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
                    {lumiaItems.length === 0 ? (
                        <div className="lumiverse-pack-detail-empty">
                            <Package size={32} strokeWidth={1.5} />
                            <p>No Lumias found in this pack</p>
                        </div>
                    ) : (
                        <div className="lumiverse-pack-detail-list">
                            {lumiaItems.map((item, index) => (
                                <LumiaDetailCard
                                    key={getLumiaField(item, 'name') || index}
                                    item={item}
                                    packName={viewingPack}
                                    selections={selections}
                                    actions={actions}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

export default PackDetailModal;
