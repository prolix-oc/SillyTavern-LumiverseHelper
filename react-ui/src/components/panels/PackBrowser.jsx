import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { Search, X, Package, FileText, Zap, Heart, ChevronDown, Sparkles } from 'lucide-react';

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
 * Filter tabs component
 */
function FilterTabs({ activeFilter, onFilterChange }) {
    const filters = [
        { id: 'all', label: 'All', Icon: Package },
        { id: 'definition', label: 'Defs', Icon: FileText },
        { id: 'behavior', label: 'Behaviors', Icon: Zap },
        { id: 'personality', label: 'Personalities', Icon: Heart },
    ];

    return (
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
                        type="button"
                    >
                        <span className="lumiverse-pack-filter-icon">
                            <Icon size={14} strokeWidth={1.5} />
                        </span>
                        <span className="lumiverse-pack-filter-label">{filter.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Pack header (collapsible)
 * OLD CODE: pack.name is the primary field, not pack.packName
 */
function PackHeader({ pack, isExpanded, onToggle, itemCount }) {
    // Old code uses pack.name, not pack.packName
    const packName = pack.name || pack.packName || 'Unknown Pack';

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
 * OLD CODE FIELD NAMES: lumiaDefName, lumia_img, lumiaDef
 */
function LumiaItemCard({ item, type, onSelect }) {
    const typeInfo = {
        definition: { Icon: FileText, color: 'rgba(100, 200, 255, 0.15)', border: 'rgba(100, 200, 255, 0.3)' },
        behavior: { Icon: Zap, color: 'rgba(255, 180, 100, 0.15)', border: 'rgba(255, 180, 100, 0.3)' },
        personality: { Icon: Heart, color: 'rgba(200, 100, 255, 0.15)', border: 'rgba(200, 100, 255, 0.3)' },
    };

    // Adaptive image positioning based on aspect ratio
    const { objectPosition } = useAdaptiveImagePosition(item.lumia_img);

    const info = typeInfo[type] || typeInfo.definition;
    const { Icon } = info;
    // OLD CODE: uses lumiaDefName, not name
    const name = item.lumiaDefName || 'Unknown';
    // Get content preview based on type
    const getContentPreview = () => {
        if (type === 'definition' && item.lumiaDef) {
            return item.lumiaDef.slice(0, 100);
        } else if (type === 'behavior' && item.lumia_behavior) {
            return item.lumia_behavior.slice(0, 100);
        } else if (type === 'personality' && item.lumia_personality) {
            return item.lumia_personality.slice(0, 100);
        }
        return '';
    };
    const description = getContentPreview();

    return (
        <motion.div
            className="lumiverse-browser-item"
            style={{ background: info.color, borderColor: info.border }}
            onClick={() => onSelect?.(item, type)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
        >
            {/* OLD CODE: uses lumia_img, not itemImage */}
            {item.lumia_img && (
                <img
                    src={item.lumia_img}
                    alt={name}
                    className="lumiverse-browser-item-image"
                    style={{ objectPosition }}
                />
            )}
            <div className="lumiverse-browser-item-content">
                <div className="lumiverse-browser-item-header">
                    <span className="lumiverse-browser-item-icon">
                        <Icon size={14} strokeWidth={1.5} />
                    </span>
                    <span className="lumiverse-browser-item-name">{name}</span>
                </div>
                {description && (
                    <p className="lumiverse-browser-item-desc">{description}</p>
                )}
            </div>
        </motion.div>
    );
}

/**
 * Virtualized item list for a pack
 */
function VirtualizedPackItems({ items, filter, onSelectItem }) {
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
 * OLD CODE: pack.items is the single array containing ALL items (definitions, behaviors, personalities)
 * Each item has: lumiaDefName, lumiaDef, lumia_behavior, lumia_personality
 * NOT separate arrays like lumiaDefinitions, lumiaBehaviors, etc.
 */
function PackSection({ pack, filter, searchQuery, onSelectItem }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const packName = pack.name || pack.packName || 'Unknown Pack';

    // Get all items from pack.items and determine type based on content
    const allItems = useMemo(() => {
        const packItems = pack.items || [];
        const items = [];

        packItems.forEach((item, index) => {
            // Skip loom items (they have loomCategory)
            if (item.loomCategory) return;

            // Skip items without lumiaDefName
            if (!item.lumiaDefName) return;

            // Determine type based on what content the item has
            // An item can have definition (lumiaDef), behavior (lumia_behavior), and/or personality (lumia_personality)
            // For browsing, we show them as definition type if they have lumiaDef
            const hasDefinition = !!item.lumiaDef;
            const hasBehavior = !!item.lumia_behavior;
            const hasPersonality = !!item.lumia_personality;

            // If item has a definition, show as definition type
            if (hasDefinition) {
                items.push({
                    ...item,
                    type: 'definition',
                    packName: packName,
                    id: `def-${packName}-${item.lumiaDefName}-${index}`,
                });
            }
            // If item has behavior content, also add as behavior
            if (hasBehavior) {
                items.push({
                    ...item,
                    type: 'behavior',
                    packName: packName,
                    id: `beh-${packName}-${item.lumiaDefName}-${index}`,
                });
            }
            // If item has personality content, also add as personality
            if (hasPersonality) {
                items.push({
                    ...item,
                    type: 'personality',
                    packName: packName,
                    id: `per-${packName}-${item.lumiaDefName}-${index}`,
                });
            }
        });

        return items;
    }, [pack, packName]);

    // Filter items based on search and type filter
    const filteredItems = useMemo(() => {
        let items = allItems;

        // Apply type filter
        if (filter !== 'all') {
            items = items.filter(item => item.type === filter);
        }

        // Apply search filter
        // OLD CODE: uses lumiaDefName, lumiaDef, lumia_behavior, lumia_personality
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            items = items.filter(item => {
                const name = (item.lumiaDefName || '').toLowerCase();
                const def = (item.lumiaDef || '').toLowerCase();
                const beh = (item.lumia_behavior || '').toLowerCase();
                const per = (item.lumia_personality || '').toLowerCase();
                return name.includes(query) || def.includes(query) || beh.includes(query) || per.includes(query);
            });
        }

        return items;
    }, [allItems, filter, searchQuery]);

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
                itemCount={filteredItems.length}
            />
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        className="lumiverse-browser-pack-items"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <VirtualizedPackItems
                            items={filteredItems}
                            filter={filter}
                            onSelectItem={onSelectItem}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/**
 * Stats bar showing current counts
 * OLD CODE: Uses pack.items, not separate lumiaDefinitions/lumiaBehaviors/lumiaPersonalities arrays
 */
function StatsBar({ packs, customPacks }) {
    const stats = useMemo(() => {
        let definitions = 0;
        let behaviors = 0;
        let personalities = 0;

        [...packs, ...customPacks].forEach(pack => {
            const items = pack.items || [];
            // Count based on what content each item has
            items.forEach(item => {
                // Skip loom items
                if (item.loomCategory) return;
                if (!item.lumiaDefName) return;

                if (item.lumiaDef) definitions++;
                if (item.lumia_behavior) behaviors++;
                if (item.lumia_personality) personalities++;
            });
        });

        return { definitions, behaviors, personalities, total: packs.length + customPacks.length };
    }, [packs, customPacks]);

    return (
        <div className="lumiverse-browser-stats">
            <div className="lumiverse-browser-stat">
                <span className="lumiverse-browser-stat-value">{stats.total}</span>
                <span className="lumiverse-browser-stat-label">Packs</span>
            </div>
            <div className="lumiverse-browser-stat">
                <span className="lumiverse-browser-stat-value">{stats.definitions}</span>
                <span className="lumiverse-browser-stat-label">Defs</span>
            </div>
            <div className="lumiverse-browser-stat">
                <span className="lumiverse-browser-stat-value">{stats.behaviors}</span>
                <span className="lumiverse-browser-stat-label">Behaviors</span>
            </div>
            <div className="lumiverse-browser-stat">
                <span className="lumiverse-browser-stat-value">{stats.personalities}</span>
                <span className="lumiverse-browser-stat-label">Personalities</span>
            </div>
        </div>
    );
}

/**
 * Main Pack Browser component
 */
function PackBrowser() {
    const { packs, customPacks } = usePacks();
    const actions = useLumiverseActions();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    // Mark custom packs
    const allPacks = useMemo(() => {
        const officialPacks = packs.map(p => ({ ...p, isCustom: false }));
        const userPacks = customPacks.map(p => ({ ...p, isCustom: true }));
        return [...officialPacks, ...userPacks];
    }, [packs, customPacks]);

    const handleSelectItem = useCallback((item, type) => {
        // Handle item selection - could open a detail modal or add to selections
        console.log('[PackBrowser] Selected item:', item, type);

        // OLD CODE FORMAT: selections are { packName, itemName }
        const selection = {
            packName: item.packName,
            itemName: item.lumiaDefName,
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
                ) : (
                    allPacks.map((pack, index) => (
                        <PackSection
                            key={pack.name || pack.packName || `pack-${index}`}
                            pack={pack}
                            filter={activeFilter}
                            searchQuery={searchQuery}
                            onSelectItem={handleSelectItem}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

export default PackBrowser;
