import React, { useMemo, useSyncExternalStore, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, FileText, Zap, Heart, Check, Plus, User } from 'lucide-react';
import { useLumiverseStore, useLumiverseActions, useSelections, saveToExtension } from '../../store/LumiverseContext';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';
import LazyImage from '../shared/LazyImage';

/* global toastr */

// Get store for direct access
const store = useLumiverseStore;

// Stable fallback constants for useSyncExternalStore
const EMPTY_OBJECT = {};

// Stable selector functions
const selectViewingPack = () => store.getState().ui?.viewingPack;
const selectPacks = () => store.getState().packs || EMPTY_OBJECT;

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
        maxWidth: '900px',
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
    lumiaGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '16px',
    },
    lumiaCard: {
        background: 'rgba(0, 0, 0, 0.2)',
        border: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.1))',
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'border-color 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
    },
    lumiaImageContainer: {
        position: 'relative',
        aspectRatio: '3 / 4',
        background: 'rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    lumiaImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    lumiaPlaceholder: {
        color: 'var(--lumiverse-text-muted, #999)',
        opacity: 0.5,
    },
    lumiaInfo: {
        padding: '12px',
    },
    lumiaName: {
        margin: 0,
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--lumiverse-text, #e0e0e0)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    lumiaAuthor: {
        fontSize: '12px',
        color: 'var(--lumiverse-text-muted, #999)',
        marginTop: '4px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    traitBadges: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        marginTop: '8px',
    },
    traitBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        fontSize: '10px',
        fontWeight: 500,
        borderRadius: '4px',
        background: 'rgba(147, 112, 219, 0.15)',
        color: 'var(--lumiverse-primary, #9370db)',
    },
    actions: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        padding: '0 12px 12px',
    },
    actionBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 10px',
        fontSize: '11px',
        fontWeight: 500,
        borderRadius: '6px',
        border: '1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.1))',
        background: 'rgba(0, 0, 0, 0.2)',
        color: 'var(--lumiverse-text, #e0e0e0)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
    },
    actionBtnSelected: {
        background: 'rgba(147, 112, 219, 0.2)',
        borderColor: 'var(--lumiverse-primary, #9370db)',
        color: 'var(--lumiverse-primary, #9370db)',
    },
    actionBtnEnableAll: {
        background: 'rgba(147, 112, 219, 0.1)',
        borderColor: 'rgba(147, 112, 219, 0.3)',
    },
    actionBtnAllEnabled: {
        background: 'rgba(147, 112, 219, 0.25)',
        borderColor: 'var(--lumiverse-primary, #9370db)',
        color: 'var(--lumiverse-primary, #9370db)',
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
 * Quick-add action button
 */
function QuickAddButton({ label, Icon, isSelected, onClick, disabled }) {
    return (
        <button
            style={{
                ...styles.actionBtn,
                ...(isSelected ? styles.actionBtnSelected : {}),
            }}
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
        <div style={styles.lumiaCard}>
            {/* Large image */}
            <div style={styles.lumiaImageContainer}>
                {itemImg ? (
                    <LazyImage
                        src={itemImg}
                        alt={itemName}
                        style={styles.lumiaImage}
                        objectPosition={objectPosition}
                    />
                ) : (
                    <User size={48} strokeWidth={1.5} style={styles.lumiaPlaceholder} />
                )}
            </div>
            
            {/* Info section */}
            <div style={styles.lumiaInfo}>
                <h4 style={styles.lumiaName}>{itemName}</h4>
                {itemAuthor && (
                    <span style={styles.lumiaAuthor}>by {itemAuthor}</span>
                )}
                
                {/* Trait badges */}
                <div style={styles.traitBadges}>
                    {hasDefinition && (
                        <span style={styles.traitBadge}>
                            <FileText size={10} /> Def
                        </span>
                    )}
                    {hasBehavior && (
                        <span style={styles.traitBadge}>
                            <Zap size={10} /> Behav
                        </span>
                    )}
                    {hasPersonality && (
                        <span style={styles.traitBadge}>
                            <Heart size={10} /> Pers
                        </span>
                    )}
                </div>
            </div>

            {/* Quick-add actions */}
            <div style={styles.actions}>
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
                        style={{
                            ...styles.actionBtn,
                            ...styles.actionBtnEnableAll,
                            ...(isAllEnabled ? styles.actionBtnAllEnabled : {}),
                        }}
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
                            <img src={pack.packCover} alt={viewingPack} style={styles.headerIconImg} />
                        ) : (
                            <Package size={24} strokeWidth={1.5} />
                        )}
                    </div>
                    <div style={styles.headerText}>
                        <h3 style={styles.title}>{viewingPack}</h3>
                        <div style={styles.stats}>
                            <span style={styles.statItem}>
                                <FileText size={12} /> {stats.lumias} Lumia{stats.lumias !== 1 ? 's' : ''}
                            </span>
                            <span style={styles.statItem}>
                                <Zap size={12} /> {stats.behaviors} Behavior{stats.behaviors !== 1 ? 's' : ''}
                            </span>
                            <span style={styles.statItem}>
                                <Heart size={12} /> {stats.personalities} Personalit{stats.personalities !== 1 ? 'ies' : 'y'}
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
                    {lumiaItems.length === 0 ? (
                        <div style={styles.empty}>
                            <div style={styles.emptyIcon}>
                                <Package size={32} strokeWidth={1.5} />
                            </div>
                            <p style={{ margin: 0 }}>No Lumias found in this pack</p>
                        </div>
                    ) : (
                        <div className="lumiverse-responsive-card-grid">
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
