import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePacks, useSelections, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';
import { CollapsibleContent } from '../Collapsible';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { Search, X, Package, FileText, Zap, Heart, ChevronDown, Sparkles, Check, Eye, Filter, Trash2 } from 'lucide-react';

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
 * Search input component
 */
function SearchInput({ value, onChange, placeholder }) {
    return (
        <div className="lumiverse-pack-search">
            <span className="lumiverse-pack-search-icon">
                <Search size={16} strokeWidth={1.5} />
            </span>
            <input
                type="text"
                className="lumiverse-pack-search-input"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {value && (
                <button
                    className="lumiverse-pack-search-clear"
                    onClick={() => onChange('')}
                    type="button"
                >
                    <X size={14} strokeWidth={2} />
                </button>
            )}
        </div>
    );
}

/**
 * Filter tabs component - icon-only for compact display
 */
function FilterTabs({ activeFilter, onFilterChange, showSelectedOnly, onToggleSelectedOnly, selectedCount }) {
    const filters = [
        { id: 'all', label: 'All', Icon: Package },
        { id: 'definition', label: 'Definitions', Icon: FileText },
        { id: 'behavior', label: 'Behaviors', Icon: Zap },
        { id: 'personality', label: 'Personalities', Icon: Heart },
    ];

    return (
        <div className="lumiverse-pack-filters-container">
            <div className="lumiverse-pack-filters">
                {filters.map(filter => {
                    const { Icon } = filter;
                    return (
                        <button
                            key={filter.id}
                            className={clsx(
                                'lumiverse-pack-filter',
                                activeFilter === filter.id && 'lumiverse-pack-filter--active'
                            )}
                            onClick={() => onFilterChange(filter.id)}
                            title={filter.label}
                            type="button"
                        >
                            <Icon size={16} strokeWidth={1.5} />
                        </button>
                    );
                })}
            </div>
            <button
                className={clsx(
                    'lumiverse-pack-filter-selected-toggle',
                    showSelectedOnly && 'lumiverse-pack-filter-selected-toggle--active'
                )}
                onClick={onToggleSelectedOnly}
                title={showSelectedOnly ? 'Show all items' : 'Show selected only'}
                type="button"
            >
                <Filter size={14} strokeWidth={1.5} />
                {selectedCount > 0 && (
                    <span className="lumiverse-pack-filter-selected-count">{selectedCount}</span>
                )}
            </button>
        </div>
    );
}

/**
 * Pack header (collapsible)
 * OLD CODE: pack.name is the primary field, not pack.packName
 */
function PackHeader({ pack, isExpanded, onToggle, onViewPack, itemCount }) {
    // Old code uses pack.name, not pack.packName
    const packName = pack.name || pack.packName || 'Unknown Pack';

    const handleViewClick = (e) => {
        e.stopPropagation();
        onViewPack?.(packName);
    };

    return (
        <button
            className={clsx(
                'lumiverse-browser-pack-header',
                isExpanded && 'lumiverse-browser-pack-header--expanded'
            )}
            onClick={onToggle}
            type="button"
        >
            {pack.packCover ? (
                <img
                    src={pack.packCover}
                    alt={packName}
                    className="lumiverse-browser-pack-cover"
                />
            ) : (
                <div className="lumiverse-browser-pack-cover-placeholder">
                    {pack.isCustom ? <Sparkles size={20} strokeWidth={1.5} /> : <Package size={20} strokeWidth={1.5} />}
                </div>
            )}
            <div className="lumiverse-browser-pack-info">
                <span className="lumiverse-browser-pack-name">{packName}</span>
                <span className="lumiverse-browser-pack-meta">
                    {itemCount} items
                    {pack.isCustom && (
                        <span className="lumiverse-browser-pack-custom-badge">Custom</span>
                    )}
                </span>
            </div>
            {/* View pack details button */}
            <span
                className="lumiverse-browser-pack-view-btn"
                onClick={handleViewClick}
                title="View pack contents"
                role="button"
                tabIndex={0}
            >
                <Eye size={16} strokeWidth={1.5} />
            </span>
            <span className={clsx(
                'lumiverse-browser-pack-chevron',
                isExpanded && 'lumiverse-browser-pack-chevron--rotated'
            )}>
                <ChevronDown size={16} strokeWidth={2} />
            </span>
        </button>
    );
}

/**
 * Lumia item card
 * Supports both new format (lumiaName, avatarUrl, etc.) and legacy format (lumiaDefName, lumia_img, etc.)
 */
function LumiaItemCard({ item, type, onSelect, isSelected }) {
    const typeInfo = {
        definition: { Icon: FileText, color: 'rgba(100, 200, 255, 0.15)', border: 'rgba(100, 200, 255, 0.3)', selectedBorder: 'rgba(100, 200, 255, 0.7)' },
        behavior: { Icon: Zap, color: 'rgba(255, 180, 100, 0.15)', border: 'rgba(255, 180, 100, 0.3)', selectedBorder: 'rgba(255, 180, 100, 0.7)' },
        personality: { Icon: Heart, color: 'rgba(200, 100, 255, 0.15)', border: 'rgba(200, 100, 255, 0.3)', selectedBorder: 'rgba(200, 100, 255, 0.7)' },
    };

    // Get field values with fallback for old/new format
    const itemImg = getLumiaField(item, 'img');
    const itemName = getLumiaField(item, 'name') || 'Unknown';

    // Adaptive image positioning based on aspect ratio
    const { objectPosition } = useAdaptiveImagePosition(itemImg);

    const info = typeInfo[type] || typeInfo.definition;
    const { Icon } = info;

    // Get content preview based on type - supports both formats
    const getContentPreview = () => {
        if (type === 'definition') {
            const def = getLumiaField(item, 'def');
            return def ? def.slice(0, 100) : '';
        } else if (type === 'behavior') {
            const beh = getLumiaField(item, 'behavior');
            return beh ? beh.slice(0, 100) : '';
        } else if (type === 'personality') {
            const pers = getLumiaField(item, 'personality');
            return pers ? pers.slice(0, 100) : '';
        }
        return '';
    };
    const description = getContentPreview();

    return (
        <motion.div
            className={clsx('lumiverse-browser-item', isSelected && 'lumiverse-browser-item--selected')}
            style={{
                background: isSelected ? info.color.replace('0.15', '0.25') : info.color,
                borderColor: isSelected ? info.selectedBorder : info.border,
            }}
            onClick={() => onSelect?.(item, type)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
        >
            {itemImg && (
                <img
                    src={itemImg}
                    alt={itemName}
                    className="lumiverse-browser-item-image"
                    style={{ objectPosition }}
                />
            )}
            <div className="lumiverse-browser-item-content">
                <div className="lumiverse-browser-item-header">
                    <span className="lumiverse-browser-item-icon">
                        <Icon size={14} strokeWidth={1.5} />
                    </span>
                    <span className="lumiverse-browser-item-name">{itemName}</span>
                    {isSelected && (
                        <span className="lumiverse-browser-item-check">
                            <Check size={14} strokeWidth={2.5} />
                        </span>
                    )}
                </div>
                {description && (
                    <p className="lumiverse-browser-item-desc">{description}</p>
                )}
            </div>
        </motion.div>
    );
}

/**
 * Check if an item is selected based on type and selections
 * Supports both new and legacy field names
 */
function isItemSelected(item, type, selections) {
    const itemName = getLumiaField(item, 'name');
    const packName = item.packName;

    if (type === 'definition') {
        // Definition is selected if it matches the current definition
        const def = selections.definition;
        return def?.itemName === itemName && def?.packName === packName;
    } else if (type === 'behavior') {
        // Behavior is selected if it's in the behaviors array
        return selections.behaviors?.some(b => b.itemName === itemName && b.packName === packName) ?? false;
    } else if (type === 'personality') {
        // Personality is selected if it's in the personalities array
        return selections.personalities?.some(p => p.itemName === itemName && p.packName === packName) ?? false;
    }
    return false;
}

/**
 * Virtualized item list for a pack
 */
function VirtualizedPackItems({ items, filter, onSelectItem, selections }) {
    const parentRef = useRef(null);

    // Filter items by type
    const filteredItems = useMemo(() => {
        if (filter === 'all') return items;
        return items.filter(item => item.type === filter);
    }, [items, filter]);

    const virtualizer = useVirtualizer({
        count: filteredItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 80,
        overscan: 5,
    });

    if (filteredItems.length === 0) {
        return (
            <div className="lumiverse-browser-empty-items">
                No items match the current filter
            </div>
        );
    }

    return (
        <div
            ref={parentRef}
            className="lumiverse-browser-items-container"
            style={{ maxHeight: '300px', overflow: 'auto' }}
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                    const item = filteredItems[virtualRow.index];
                    return (
                        <div
                            key={virtualRow.key}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                                padding: '4px 0',
                            }}
                        >
                            <LumiaItemCard
                                item={item}
                                type={item.type}
                                onSelect={onSelectItem}
                                isSelected={isItemSelected(item, item.type, selections)}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Pack section with expandable items
 *
 * Supports both new format (lumiaItems array) and legacy format (items array)
 * New format: lumiaName, lumiaDefinition, lumiaBehavior, lumiaPersonality
 * Legacy format: lumiaDefName, lumiaDef, lumia_behavior, lumia_personality
 */
function PackSection({ pack, filter, searchQuery, showSelectedOnly, onSelectItem, onViewPack, selections }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const packName = pack.name || pack.packName || 'Unknown Pack';

    // Get all items from pack and determine type based on content
    const allItems = useMemo(() => {
        const items = [];

        // Helper to get field value supporting both formats
        const getField = (item, newField, legacyField) => item[newField] || item[legacyField];
        const getName = (item) => item.lumiaName || item.lumiaDefName;
        const getDef = (item) => item.lumiaDefinition || item.lumiaDef;
        const getBehavior = (item) => item.lumiaBehavior || item.lumia_behavior;
        const getPersonality = (item) => item.lumiaPersonality || item.lumia_personality;

        // Get source items - new format or legacy
        const packItems = (pack.lumiaItems && pack.lumiaItems.length > 0)
            ? pack.lumiaItems
            : (pack.items || []).filter(i => !i.loomCategory && (i.lumiaDefName || i.lumiaName));

        packItems.forEach((item, index) => {
            const itemName = getName(item);
            if (!itemName) return;

            // Determine type based on what content the item has
            const hasDefinition = !!getDef(item);
            const hasBehavior = !!getBehavior(item);
            const hasPersonality = !!getPersonality(item);

            // If item has a definition, show as definition type
            if (hasDefinition) {
                items.push({
                    ...item,
                    lumiaDefName: itemName, // Normalize for compatibility
                    type: 'definition',
                    packName: packName,
                    id: `def-${packName}-${itemName}-${index}`,
                });
            }
            // If item has behavior content, also add as behavior
            if (hasBehavior) {
                items.push({
                    ...item,
                    lumiaDefName: itemName,
                    type: 'behavior',
                    packName: packName,
                    id: `beh-${packName}-${itemName}-${index}`,
                });
            }
            // If item has personality content, also add as personality
            if (hasPersonality) {
                items.push({
                    ...item,
                    lumiaDefName: itemName,
                    type: 'personality',
                    packName: packName,
                    id: `per-${packName}-${itemName}-${index}`,
                });
            }
        });

        return items;
    }, [pack, packName]);

    // Filter items based on search, type filter, and selection status
    const filteredItems = useMemo(() => {
        let items = allItems;

        // Apply type filter
        if (filter !== 'all') {
            items = items.filter(item => item.type === filter);
        }

        // Apply search filter - supports both new and legacy field names
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            items = items.filter(item => {
                const name = (getLumiaField(item, 'name') || '').toLowerCase();
                const def = (getLumiaField(item, 'def') || '').toLowerCase();
                const beh = (getLumiaField(item, 'behavior') || '').toLowerCase();
                const per = (getLumiaField(item, 'personality') || '').toLowerCase();
                return name.includes(query) || def.includes(query) || beh.includes(query) || per.includes(query);
            });
        }

        // Apply "show selected only" filter
        if (showSelectedOnly) {
            items = items.filter(item => isItemSelected(item, item.type, selections));
        }

        return items;
    }, [allItems, filter, searchQuery, showSelectedOnly, selections]);

    // Don't show packs with no matching items
    if (filteredItems.length === 0) {
        return null;
    }

    return (
        <div className="lumiverse-browser-pack">
            <PackHeader
                pack={pack}
                isExpanded={isExpanded}
                onToggle={() => setIsExpanded(!isExpanded)}
                onViewPack={onViewPack}
                itemCount={filteredItems.length}
            />
            {/* Uses CSS grid for smooth, performant animation */}
            <CollapsibleContent
                isOpen={isExpanded}
                className="lumiverse-browser-pack-items"
                duration={200}
            >
                <VirtualizedPackItems
                    items={filteredItems}
                    filter={filter}
                    onSelectItem={onSelectItem}
                    selections={selections}
                />
            </CollapsibleContent>
        </div>
    );
}

/**
 * Stats bar showing current counts
 * Supports both new format (lumiaItems) and legacy format (items)
 */
function StatsBar({ packs, customPacks }) {
    const stats = useMemo(() => {
        let definitions = 0;
        let behaviors = 0;
        let personalities = 0;

        [...packs, ...customPacks].forEach(pack => {
            // Get items from new or legacy format
            const items = (pack.lumiaItems && pack.lumiaItems.length > 0)
                ? pack.lumiaItems
                : (pack.items || []).filter(i => !i.loomCategory);

            // Count based on what content each item has
            items.forEach(item => {
                const itemName = item.lumiaName || item.lumiaDefName;
                if (!itemName) return;

                // Support both new and legacy field names
                if (item.lumiaDefinition || item.lumiaDef) definitions++;
                if (item.lumiaBehavior || item.lumia_behavior) behaviors++;
                if (item.lumiaPersonality || item.lumia_personality) personalities++;
            });
        });

        return { definitions, behaviors, personalities, total: packs.length + customPacks.length };
    }, [packs, customPacks]);

    return (
        <div className="lumiverse-browser-stats">
            <div className="lumiverse-browser-stat">
                <span className="lumiverse-browser-stat-value">{stats.total}</span>
                <span className="lumiverse-browser-stat-label">PACKS</span>
            </div>
            <div className="lumiverse-browser-stat">
                <span className="lumiverse-browser-stat-value">{stats.definitions}</span>
                <span className="lumiverse-browser-stat-label">DEFS</span>
            </div>
            <div className="lumiverse-browser-stat">
                <span className="lumiverse-browser-stat-value">{stats.behaviors}</span>
                <span className="lumiverse-browser-stat-label">BEHAV</span>
            </div>
            <div className="lumiverse-browser-stat">
                <span className="lumiverse-browser-stat-value">{stats.personalities}</span>
                <span className="lumiverse-browser-stat-label">PERS</span>
            </div>
        </div>
    );
}

/**
 * Main Pack Browser component
 */
function PackBrowser() {
    const { packs, customPacks } = usePacks();
    const selections = useSelections();
    const actions = useLumiverseActions();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [showSelectedOnly, setShowSelectedOnly] = useState(false);

    // Calculate total selected count
    const selectedCount = useMemo(() => {
        let count = 0;
        if (selections.definition) count += 1;
        count += (selections.behaviors || []).length;
        count += (selections.personalities || []).length;
        return count;
    }, [selections]);

    // Mark custom packs
    const allPacks = useMemo(() => {
        const officialPacks = packs.map(p => ({ ...p, isCustom: false }));
        const userPacks = customPacks.map(p => ({ ...p, isCustom: true }));
        return [...officialPacks, ...userPacks];
    }, [packs, customPacks]);

    const handleSelectItem = useCallback((item, type) => {
        // Handle item selection - could open a detail modal or add to selections
        console.log('[PackBrowser] Selected item:', item, type);

        // Selections use itemName - get from both new and legacy field names
        const selection = {
            packName: item.packName,
            itemName: getLumiaField(item, 'name'),
        };

        // Depending on type, toggle selection
        if (type === 'definition') {
            actions.setSelectedDefinition(selection);
        } else if (type === 'behavior') {
            actions.toggleBehavior(selection);
        } else if (type === 'personality') {
            actions.togglePersonality(selection);
        }

        // Save to extension so changes persist and macros see updated selections
        saveToExtension();
    }, [actions]);

    const handleViewPack = useCallback((packName) => {
        actions.openPackDetail(packName);
    }, [actions]);

    const handleClearAll = useCallback(() => {
        actions.clearAllSelections();
        saveToExtension();
    }, [actions]);

    return (
        <div className="lumiverse-pack-browser">
            {/* Stats */}
            <StatsBar packs={packs} customPacks={customPacks} />

            {/* Search */}
            <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search packs and items..."
            />

            {/* Filters */}
            <FilterTabs
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                showSelectedOnly={showSelectedOnly}
                onToggleSelectedOnly={() => setShowSelectedOnly(!showSelectedOnly)}
                selectedCount={selectedCount}
            />

            {/* Pack list */}
            <div className="lumiverse-browser-packs">
                {allPacks.length === 0 ? (
                    <div className="lumiverse-browser-empty">
                        <span className="lumiverse-browser-empty-icon">
                            <Package size={32} strokeWidth={1.5} />
                        </span>
                        <p>No packs loaded</p>
                        <span className="lumiverse-browser-empty-hint">
                            Add packs in the Settings panel
                        </span>
                    </div>
                ) : showSelectedOnly && selectedCount === 0 ? (
                    <div className="lumiverse-browser-empty">
                        <span className="lumiverse-browser-empty-icon">
                            <Filter size={32} strokeWidth={1.5} />
                        </span>
                        <p>No items selected</p>
                        <span className="lumiverse-browser-empty-hint">
                            Select items to see them here, or disable the filter
                        </span>
                    </div>
                ) : (
                    allPacks.map((pack, index) => (
                        <PackSection
                            key={pack.name || pack.packName || `pack-${index}`}
                            pack={pack}
                            filter={activeFilter}
                            searchQuery={searchQuery}
                            showSelectedOnly={showSelectedOnly}
                            onSelectItem={handleSelectItem}
                            onViewPack={handleViewPack}
                            selections={selections}
                        />
                    ))
                )}
            </div>

            {/* Clear All Selections */}
            <AnimatePresence>
                {selectedCount > 0 && (
                    <motion.button
                        className="lumiverse-browser-clear-all"
                        onClick={handleClearAll}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.2 }}
                        type="button"
                    >
                        <Trash2 size={14} strokeWidth={1.5} />
                        <span>Clear All Selections</span>
                        <span className="lumiverse-browser-clear-count">{selectedCount}</span>
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}

export default PackBrowser;
