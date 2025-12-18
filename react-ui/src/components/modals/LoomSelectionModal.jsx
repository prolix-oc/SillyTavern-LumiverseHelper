import React, { useState, useMemo, useCallback } from 'react';
import { usePacks, useLumiverseActions, useLoomSelections, saveToExtension } from '../../store/LumiverseContext';
import clsx from 'clsx';

// SVG icons matching SelectionModal design - all with explicit width/height for visibility
const SVG_ICONS = {
    trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
    chevronDown: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    chevronUp: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`,
    chevron: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    folder: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    sort: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="14" y2="6"></line><line x1="4" y1="12" x2="11" y2="12"></line><line x1="4" y1="18" x2="8" y2="18"></line><polyline points="15 15 18 18 21 15"></polyline><line x1="18" y1="9" x2="18" y2="18"></line></svg>`,
    clear: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
};

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
 * Category mapping for Loom types
 * Maps modal type to the pack field name and store action
 *
 * OLD CODE: Selections are stored at root level, NOT nested under settings.loom
 * - selectedLoomStyle: [] (not settings.loom.selectedStyle)
 * - selectedLoomUtils: [] (not settings.loom.selectedUtility)
 * - selectedLoomRetrofits: []
 */
const LOOM_CATEGORIES = {
    loomStyles: {
        category: 'Narrative Style',
        packField: 'loomStyles',           // Field in pack structure (legacy)
        storeField: 'styles',              // Field name in useLoomSelections() return value
        toggleAction: 'toggleLoomStyle',   // Action name in store
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
        <div className="lumia-search-box">
            <Icon name="search" className="lumia-search-icon" />
            <input
                type="text"
                className="lumia-search-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
            {value && (
                <button
                    className="lumia-search-clear"
                    onClick={() => onChange('')}
                    type="button"
                    aria-label="Clear search"
                >
                    <Icon name="clear" className="lumia-search-clear-icon" />
                </button>
            )}
        </div>
    );
}

/**
 * Individual Loom item row
 */
function LoomItem({ item, packName, isSelected, onToggle, isMulti }) {
    // Handle different field names for item name
    const itemName = item.loomName || item.itemName || item.name || 'Unknown';

    return (
        <div
            className={clsx(
                'lumiverse-loom-item',
                isSelected && 'lumiverse-loom-item--selected'
            )}
            onClick={() => onToggle(packName, itemName)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onToggle(packName, itemName)}
        >
            <div className="lumiverse-loom-item-content">
                <span className="lumiverse-loom-item-name">{itemName}</span>
            </div>
            <div className="lumiverse-loom-item-toggle">
                {isMulti ? (
                    <div className={clsx('lumiverse-toggle-switch', isSelected && 'checked')}>
                        <div className="lumiverse-toggle-track">
                            <div className="lumiverse-toggle-thumb" />
                        </div>
                    </div>
                ) : (
                    <span className={clsx('lumiverse-radio-dot', isSelected && 'checked')} />
                )}
            </div>
        </div>
    );
}

/**
 * Collapsible pack section for Loom items
 * Can be controlled (via isCollapsed + onToggleCollapse props) or uncontrolled
 */
function PackSection({
    pack,
    children,
    defaultOpen = true,
    isEditable,
    onRemovePack,
    // Optional controlled mode props
    isCollapsed: controlledCollapsed,
    onToggleCollapse,
}) {
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const itemCount = React.Children.count(children);
    const packName = pack.name || pack.packName || 'Unknown Pack';

    // Use controlled or uncontrolled state
    const isControlled = controlledCollapsed !== undefined;
    const isOpen = isControlled ? !controlledCollapsed : internalOpen;

    if (itemCount === 0) return null;

    const handleHeaderClick = (e) => {
        // Don't collapse if clicking remove button
        if (e.target.closest('.lumiverse-remove-pack-btn')) return;

        if (isControlled && onToggleCollapse) {
            onToggleCollapse(packName);
        } else {
            setInternalOpen(!internalOpen);
        }
    };

    return (
        <div className={clsx('lumia-modal-panel', 'lumia-collapsible', 'lumia-pack-section', !isOpen && 'collapsed')}>
            <div className="lumia-modal-panel-header lumia-collapsible-trigger" onClick={handleHeaderClick}>
                <span className="lumia-panel-collapse-icon">
                    <Icon name="chevron" />
                </span>
                <span className="lumia-modal-panel-icon">
                    <Icon name="folder" />
                </span>
                <span className="lumia-modal-panel-title">{packName}</span>
                {isEditable && <span className="lumia-pack-badge-custom">Custom</span>}
                <span className="lumia-modal-panel-count">{itemCount} items</span>
                <button
                    className="lumia-icon-btn-sm lumia-remove-pack-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemovePack(packName);
                    }}
                    title="Remove Pack"
                    type="button"
                >
                    <Icon name="trash" />
                </button>
            </div>
            {isOpen && <div className="lumia-modal-panel-content lumia-loom-items lumia-collapsible-content">{children}</div>}
        </div>
    );
}

/**
 * Helper to get Loom items from a pack
 * Handles multiple possible pack structures:
 * - pack.loomStyles, pack.loomUtils, pack.loomRetrofits (legacy)
 * - pack.items with loomCategory field (new)
 */
function getLoomItemsFromPack(pack, config) {
    const items = [];
    const { category, packField } = config;

    // First, try the legacy structure (pack.loomStyles, pack.loomUtils, pack.loomRetrofits)
    if (pack[packField] && Array.isArray(pack[packField])) {
        pack[packField].forEach(item => {
            items.push({
                ...item,
                // Normalize the name field
                loomName: item.loomName || item.itemName || item.name,
            });
        });
    }

    // Then, try pack.items with loomCategory field
    if (pack.items && Array.isArray(pack.items)) {
        pack.items.forEach(item => {
            // Check multiple possible category field names
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
 * Used for selecting Narrative Styles, Loom Utilities, and Retrofits
 *
 * OLD CODE: Selections stored at root level as arrays of { packName, itemName }
 */
function LoomSelectionModal({ type, onClose }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedPacks, setCollapsedPacks] = useState(new Set());
    const [sortBy, setSortBy] = useState('default'); // 'default', 'name', 'author'
    const { allPacks } = usePacks();
    const actions = useLumiverseActions();
    const loomSelections = useLoomSelections();  // { styles, utilities, retrofits }

    const config = LOOM_CATEGORIES[type];
    if (!config) {
        return <div className="lumiverse-error">Unknown Loom type: {type}</div>;
    }

    const { category, storeField, toggleAction, isMulti } = config;

    // Get current selections from the correct store field
    // useLoomSelections returns: { styles: [...], utilities: [...], retrofits: [...] }
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
        // Use the appropriate toggle action from the store
        // toggleLoomStyle, toggleLoomUtility, or toggleLoomRetrofit
        if (actions[toggleAction]) {
            actions[toggleAction](selection);
            saveToExtension();
        } else {
            console.error(`[LoomSelectionModal] Unknown toggle action: ${toggleAction}`);
        }
    }, [actions, toggleAction]);

    // Clear all selections using the appropriate setter action
    const handleClear = useCallback(() => {
        // Map storeField to the setter action
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
                // Get Loom items from pack
                const loomItems = getLoomItemsFromPack(pack, config);

                // Filter by search query
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

    const totalItems = sortedPacks.reduce((sum, pack) => sum + pack.loomItems.length, 0);
    const selectedCount = currentSelections.length;

    // Get pack name helper
    const getPackName = (pack) => pack.name || pack.packName || 'Unknown Pack';

    return (
        <div className="lumia-modal-selection-content">
            {/* Header with search and clear */}
            <div className="lumia-modal-header-inner">
                <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder={`Search ${category}...`}
                />
                <div className="lumia-selection-actions">
                    <span className="lumia-selection-count">
                        {selectedCount} selected
                    </span>
                    {selectedCount > 0 && (
                        <button className="lumia-clear-btn" onClick={handleClear} title="Clear all selections">
                            <Icon name="clear" />
                            <span>Clear</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Controls - Collapse/Expand and Sort */}
            {sortedPacks.length > 0 && (
                <div className="lumia-modal-controls">
                    {/* Collapse/Expand controls */}
                    <div className="lumia-modal-controls-group">
                        <button
                            className="lumia-modal-control-btn"
                            onClick={expandAll}
                            title="Expand all packs"
                            type="button"
                        >
                            <Icon name="chevronDown" className="lumia-control-icon" />
                            <span>Expand All</span>
                        </button>
                        <button
                            className="lumia-modal-control-btn"
                            onClick={collapseAll}
                            title="Collapse all packs"
                            type="button"
                        >
                            <Icon name="chevronUp" className="lumia-control-icon" />
                            <span>Collapse All</span>
                        </button>
                    </div>

                    {/* Sort dropdown */}
                    <div className="lumia-modal-sort">
                        <Icon name="sort" className="lumia-sort-icon" />
                        <span className="lumia-modal-sort-label">Sort:</span>
                        <select
                            className="lumia-select"
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

            {/* Content - pack sections */}
            <div className="lumia-modal-content">
                {totalItems === 0 ? (
                    <div className="lumia-modal-empty">
                        No "{category}" items found in loaded packs.
                        {searchQuery && (
                            <button
                                className="lumia-modal-btn lumia-modal-btn-secondary"
                                onClick={() => setSearchQuery('')}
                                type="button"
                                style={{ marginTop: '12px' }}
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
                                        />
                                    );
                                })}
                            </PackSection>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div className="lumia-modal-footer">
                <button className="lumia-modal-btn lumia-modal-btn-primary lumia-modal-done" onClick={onClose}>
                    Done
                </button>
            </div>
        </div>
    );
}

export default LoomSelectionModal;
