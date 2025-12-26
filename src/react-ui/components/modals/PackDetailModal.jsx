import React, { useState, useMemo, useSyncExternalStore, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X, Package, FileText, Zap, Heart, ChevronDown, ChevronUp, Check, Plus, User } from 'lucide-react';
import { useLumiverseStore, useLumiverseActions, useSelections, saveToExtension } from '../../store/LumiverseContext';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';

/* global toastr */

// Get store for direct access
const store = useLumiverseStore;

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
    const { objectPosition } = useAdaptiveImagePosition(item.lumia_img);

    // Check if this item's traits are selected
    const isDefSelected = useMemo(() => {
        if (!selections.definition) return false;
        return selections.definition.packName === packName &&
               selections.definition.itemName === item.lumiaDefName;
    }, [selections.definition, packName, item.lumiaDefName]);

    const isBehaviorSelected = useMemo(() => {
        return (selections.behaviors || []).some(
            b => b.packName === packName && b.itemName === item.lumiaDefName
        );
    }, [selections.behaviors, packName, item.lumiaDefName]);

    const isPersonalitySelected = useMemo(() => {
        return (selections.personalities || []).some(
            p => p.packName === packName && p.itemName === item.lumiaDefName
        );
    }, [selections.personalities, packName, item.lumiaDefName]);

    const handleSetDefinition = useCallback(() => {
        if (isDefSelected) return;
        actions.setSelectedDefinition({ packName, itemName: item.lumiaDefName });
        saveToExtension();
        if (typeof toastr !== 'undefined') {
            toastr.success(`Set "${item.lumiaDefName}" as definition`);
        }
    }, [isDefSelected, actions, packName, item.lumiaDefName]);

    const handleAddBehavior = useCallback(() => {
        if (isBehaviorSelected) return;
        actions.toggleBehavior({ packName, itemName: item.lumiaDefName });
        saveToExtension();
        if (typeof toastr !== 'undefined') {
            toastr.success(`Added "${item.lumiaDefName}" behavior`);
        }
    }, [isBehaviorSelected, actions, packName, item.lumiaDefName]);

    const handleAddPersonality = useCallback(() => {
        if (isPersonalitySelected) return;
        actions.togglePersonality({ packName, itemName: item.lumiaDefName });
        saveToExtension();
        if (typeof toastr !== 'undefined') {
            toastr.success(`Added "${item.lumiaDefName}" personality`);
        }
    }, [isPersonalitySelected, actions, packName, item.lumiaDefName]);

    const handleEnableAll = useCallback(() => {
        actions.enableAllTraitsForLumia(packName, item.lumiaDefName);
        saveToExtension();
        if (typeof toastr !== 'undefined') {
            toastr.success(`Enabled all traits for "${item.lumiaDefName}"`);
        }
    }, [actions, packName, item.lumiaDefName]);

    const hasDefinition = !!item.lumiaDef;
    const hasBehavior = !!item.lumia_behavior;
    const hasPersonality = !!item.lumia_personality;

    return (
        <div className="lumiverse-pack-detail-lumia">
            <div className="lumiverse-pack-detail-lumia-header">
                <div className="lumiverse-pack-detail-lumia-avatar">
                    {item.lumia_img ? (
                        <img
                            src={item.lumia_img}
                            alt={item.lumiaDefName}
                            style={{ objectPosition }}
                        />
                    ) : (
                        <User size={24} strokeWidth={1.5} />
                    )}
                </div>
                <div className="lumiverse-pack-detail-lumia-info">
                    <h4 className="lumiverse-pack-detail-lumia-name">{item.lumiaDefName}</h4>
                    {item.defAuthor && (
                        <span className="lumiverse-pack-detail-lumia-author">by {item.defAuthor}</span>
                    )}
                </div>
            </div>

            {/* Trait previews */}
            <div className="lumiverse-pack-detail-traits">
                <TraitPreview
                    title="Definition"
                    Icon={FileText}
                    content={item.lumiaDef}
                    defaultOpen={false}
                />
                <TraitPreview
                    title="Behavior"
                    Icon={Zap}
                    content={item.lumia_behavior}
                    defaultOpen={false}
                />
                <TraitPreview
                    title="Personality"
                    Icon={Heart}
                    content={item.lumia_personality}
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
                {(hasDefinition || hasBehavior || hasPersonality) && (
                    <button
                        className="lumiverse-pack-detail-action lumiverse-pack-detail-action--enable-all"
                        onClick={handleEnableAll}
                        title="Enable all traits for this Lumia"
                        type="button"
                    >
                        Enable All
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
        () => store.getState().ui?.viewingPack,
        () => store.getState().ui?.viewingPack
    );

    const packs = useSyncExternalStore(
        store.subscribe,
        () => store.getState().packs || {},
        () => store.getState().packs || {}
    );

    // Get the pack data
    const pack = useMemo(() => {
        if (!viewingPack) return null;
        return packs[viewingPack] || null;
    }, [viewingPack, packs]);

    // Get Lumia items from the pack
    const lumiaItems = useMemo(() => {
        if (!pack?.items) return [];
        return pack.items.filter(item => item.lumiaDefName && item.lumiaDef);
    }, [pack]);

    // Calculate stats
    const stats = useMemo(() => {
        if (!pack?.items) return { lumias: 0, behaviors: 0, personalities: 0 };

        const items = pack.items;
        return {
            lumias: items.filter(i => i.lumiaDefName && i.lumiaDef).length,
            behaviors: items.filter(i => i.lumia_behavior).length,
            personalities: items.filter(i => i.lumia_personality).length,
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

    // Handle backdrop click
    const handleBackdropClick = useCallback((e) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    }, [handleClose]);

    // Stop propagation to prevent ST from closing the drawer
    const handleModalClick = useCallback((e) => {
        e.stopPropagation();
    }, []);

    // Don't render if no pack is being viewed
    if (!viewingPack || !pack) return null;

    // Use createPortal to render at document.body level
    // Use lumia-modal-backdrop for consistent centering with other modals
    return createPortal(
        <div
            className="lumia-modal-backdrop"
            onClick={handleBackdropClick}
            onMouseDown={handleModalClick}
            onMouseUp={handleModalClick}
        >
            <div
                className="lumiverse-pack-detail-modal"
                onClick={handleModalClick}
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
                                    key={item.lumiaDefName || index}
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
