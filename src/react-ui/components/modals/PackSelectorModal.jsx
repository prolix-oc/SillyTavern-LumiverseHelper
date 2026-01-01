import React, { useState, useCallback } from 'react';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';
import clsx from 'clsx';
import { Folder, FolderPlus, Check, ChevronRight, ChevronDown, Plus, Edit2, User, ScrollText } from 'lucide-react';

/**
 * Get pack name with fallback for different formats (v2: packName, v1: name)
 */
function getPackName(pack) {
    return pack.packName || pack.name || 'Unknown Pack';
}

/**
 * Get pack author with fallback for different formats
 */
function getPackAuthor(pack) {
    return pack.packAuthor || pack.author || null;
}

/**
 * Get Lumia name with fallback for different formats
 */
function getLumiaName(item) {
    return item.lumiaName || item.lumiaDefName || 'Unknown';
}

/**
 * Get Lumia avatar with fallback for different formats
 */
function getLumiaAvatar(item) {
    return item.avatarUrl || item.lumia_img || null;
}

/**
 * Get Loom name with fallback
 */
function getLoomName(item) {
    return item.loomName || item.itemName || item.name || 'Unknown';
}

/**
 * Individual Lumia item row with adaptive image positioning
 */
function LumiaItemRow({ item, packName, onEdit }) {
    const avatarUrl = getLumiaAvatar(item);
    const { objectPosition } = useAdaptiveImagePosition(avatarUrl);
    const name = getLumiaName(item);

    return (
        <div className="lumiverse-pack-selector-item-row">
            <div className="lumiverse-pack-selector-item-icon-sm lumiverse-pack-selector-item-icon--lumia">
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt=""
                        className="lumiverse-pack-selector-item-avatar"
                        style={{ objectPosition }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                ) : (
                    <User size={14} strokeWidth={1.5} />
                )}
            </div>
            <span className="lumiverse-pack-selector-item-name">{name}</span>
            <span className="lumiverse-pack-selector-item-type">Lumia</span>
            <button
                className="lumiverse-pack-selector-item-edit"
                onClick={() => onEdit(packName, item, 'lumia')}
                title="Edit this Lumia"
                type="button"
            >
                <Edit2 size={14} strokeWidth={1.5} />
            </button>
        </div>
    );
}

/**
 * Individual Loom item row
 */
function LoomItemRow({ item, packName, onEdit }) {
    const name = getLoomName(item);
    const category = item.loomCategory || item.category || 'Unknown';

    // Shorten category for display
    const shortCategory = category === 'Narrative Style' ? 'Style'
        : category === 'Loom Utilities' ? 'Utility'
        : category === 'Retrofits' ? 'Retrofit'
        : category;

    return (
        <div className="lumiverse-pack-selector-item-row lumiverse-pack-selector-item-row--loom">
            <div className="lumiverse-pack-selector-item-icon-sm lumiverse-pack-selector-item-icon--loom">
                <ScrollText size={14} strokeWidth={1.5} />
            </div>
            <span className="lumiverse-pack-selector-item-name">{name}</span>
            <span className="lumiverse-pack-selector-item-type lumiverse-pack-selector-item-type--loom">
                {shortCategory}
            </span>
            <button
                className="lumiverse-pack-selector-item-edit"
                onClick={() => onEdit(packName, item, 'loom')}
                title="Edit this Loom item"
                type="button"
            >
                <Edit2 size={14} strokeWidth={1.5} />
            </button>
        </div>
    );
}

/**
 * Pack Selector Modal
 *
 * Shows list of existing custom packs to select from,
 * plus option to create a new pack.
 *
 * When a pack is selected, shows existing Lumias with edit buttons
 * and option to add new Lumia.
 *
 * Props:
 * - onSelect: Optional callback(packName, pack) - if not provided, opens lumiaEditor modal
 * - onClose: Close callback
 */
function PackSelectorModal({ onSelect, onClose }) {
    const { customPacks, allPacks } = usePacks();
    const actions = useLumiverseActions();

    // State for expanded pack (to show Lumias)
    const [expandedPackName, setExpandedPackName] = useState(null);

    // State for new pack form
    const [showNewPackForm, setShowNewPackForm] = useState(false);
    const [newPackName, setNewPackName] = useState('');
    const [newPackAuthor, setNewPackAuthor] = useState('');
    const [newPackCover, setNewPackCover] = useState('');
    const [error, setError] = useState('');

    // Get editable packs (custom packs or packs with no URL)
    const editablePacks = allPacks.filter(pack => pack.isCustom || !pack.url);

    // Handle clicking on a pack - toggle expansion
    const handlePackClick = useCallback((pack) => {
        const packName = getPackName(pack);
        setExpandedPackName(prev => prev === packName ? null : packName);
    }, []);

    // Handle adding a new item - opens type selector
    const handleAddNewItem = useCallback((packName) => {
        actions.openModal('itemTypeSelector', { packName });
    }, [actions]);

    // Handle editing an existing item (Lumia or Loom)
    const handleEditItem = useCallback((packName, item, itemType) => {
        if (itemType === 'loom') {
            actions.openModal('loomEditor', { packName, editingItem: item });
        } else {
            actions.openModal('lumiaEditor', { packName, editingItem: item });
        }
    }, [actions]);

    // Handle creating a new pack
    const handleCreatePack = useCallback(() => {
        const name = newPackName.trim();
        if (!name) {
            setError('Pack name is required');
            return;
        }

        // Check if pack already exists
        const exists = allPacks.some(p => p.name === name);
        if (exists) {
            setError(`Pack "${name}" already exists`);
            return;
        }

        // Create the new pack (v2 schema)
        const newPack = {
            id: `pack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            packName: name,
            name: name, // Keep legacy field for compatibility
            packAuthor: newPackAuthor.trim() || null,
            coverUrl: newPackCover.trim() || null,
            url: '',
            isCustom: true,
            version: 1,
            packExtras: [],
            lumiaItems: [],
            loomItems: [],
        };

        actions.addCustomPack(newPack);
        saveToExtension();

        // Reset form and expand the newly created pack
        setShowNewPackForm(false);
        setNewPackName('');
        setNewPackAuthor('');
        setNewPackCover('');
        setError('');
        setExpandedPackName(name);
    }, [newPackName, newPackAuthor, newPackCover, allPacks, actions]);

    // Get Lumia items from a pack - supports both new and legacy formats
    const getLumiaItems = (pack) => {
        // New format: lumiaItems array
        if (pack.lumiaItems && pack.lumiaItems.length > 0) {
            return pack.lumiaItems;
        }
        // Legacy format: items array
        if (!pack.items) return [];
        return pack.items.filter(item => item.lumiaDefName || item.lumiaName);
    };

    // Get Loom items from a pack
    const getLoomItems = (pack) => {
        if (pack.loomItems && pack.loomItems.length > 0) {
            return pack.loomItems;
        }
        return [];
    };

    // Count total items in a pack
    const getItemCount = (pack) => {
        const lumiaCount = getLumiaItems(pack).length;
        const loomCount = getLoomItems(pack).length;
        return { lumiaCount, loomCount, total: lumiaCount + loomCount };
    };

    return (
        <div className="lumiverse-pack-selector-modal">
            <div className="lumiverse-pack-selector-content">
                {/* Existing Packs Section */}
                <div className="lumiverse-pack-selector-section">
                    <h4 className="lumiverse-pack-selector-heading">Select a Pack</h4>

                    {editablePacks.length === 0 ? (
                        <div className="lumiverse-pack-selector-empty">
                            <p>No custom packs yet. Create your first one below!</p>
                        </div>
                    ) : (
                        <div className="lumiverse-pack-selector-list">
                            {editablePacks.map((pack) => {
                                const packName = getPackName(pack);
                                const packAuthor = getPackAuthor(pack);
                                const isExpanded = expandedPackName === packName;
                                const lumiaItems = getLumiaItems(pack);
                                const loomItems = getLoomItems(pack);
                                const counts = getItemCount(pack);

                                return (
                                    <div
                                        key={pack.id || packName}
                                        className={clsx(
                                            'lumiverse-pack-selector-item-wrapper',
                                            isExpanded && 'lumiverse-pack-selector-item-wrapper--expanded'
                                        )}
                                    >
                                        {/* Pack Header */}
                                        <button
                                            className="lumiverse-pack-selector-item"
                                            onClick={() => handlePackClick(pack)}
                                            type="button"
                                        >
                                            <div className="lumiverse-pack-selector-item-icon">
                                                <Folder size={20} strokeWidth={1.5} />
                                            </div>
                                            <div className="lumiverse-pack-selector-item-info">
                                                <span className="lumiverse-pack-selector-pack-name">
                                                    {packName}
                                                </span>
                                                <span className="lumiverse-pack-selector-item-meta">
                                                    {counts.lumiaCount > 0 && `${counts.lumiaCount} Lumia${counts.lumiaCount !== 1 ? 's' : ''}`}
                                                    {counts.lumiaCount > 0 && counts.loomCount > 0 && ' • '}
                                                    {counts.loomCount > 0 && `${counts.loomCount} Loom${counts.loomCount !== 1 ? 's' : ''}`}
                                                    {counts.total === 0 && 'Empty'}
                                                    {packAuthor && ` • by ${packAuthor}`}
                                                </span>
                                            </div>
                                            {isExpanded ? (
                                                <ChevronDown size={16} className="lumiverse-pack-selector-item-arrow" />
                                            ) : (
                                                <ChevronRight size={16} className="lumiverse-pack-selector-item-arrow" />
                                            )}
                                        </button>

                                        {/* Expanded Items List */}
                                        {isExpanded && (
                                            <div className="lumiverse-pack-selector-items">
                                                {/* Add New Item Button */}
                                                <button
                                                    className="lumiverse-pack-selector-add-item"
                                                    onClick={() => handleAddNewItem(packName)}
                                                    type="button"
                                                >
                                                    <Plus size={14} strokeWidth={2} />
                                                    <span>Add New Item</span>
                                                </button>

                                                {/* Existing Items */}
                                                {(lumiaItems.length > 0 || loomItems.length > 0) ? (
                                                    <div className="lumiverse-pack-selector-item-list">
                                                        {/* Lumia items first */}
                                                        {lumiaItems.map((item, index) => (
                                                            <LumiaItemRow
                                                                key={getLumiaName(item) || `lumia-${index}`}
                                                                item={item}
                                                                packName={packName}
                                                                onEdit={handleEditItem}
                                                            />
                                                        ))}
                                                        {/* Then Loom items */}
                                                        {loomItems.map((item, index) => (
                                                            <LoomItemRow
                                                                key={getLoomName(item) || `loom-${index}`}
                                                                item={item}
                                                                packName={packName}
                                                                onEdit={handleEditItem}
                                                            />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="lumiverse-pack-selector-items-empty">
                                                        No items yet. Add your first one!
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="lumiverse-pack-selector-divider">
                    <span>or</span>
                </div>

                {/* Create New Pack Section */}
                <div className="lumiverse-pack-selector-section">
                    {!showNewPackForm ? (
                        <button
                            className="lumiverse-pack-selector-create-btn"
                            onClick={() => setShowNewPackForm(true)}
                            type="button"
                        >
                            <FolderPlus size={18} strokeWidth={1.5} />
                            <span>Create New Pack</span>
                        </button>
                    ) : (
                        <div className="lumiverse-pack-selector-form">
                            <h4 className="lumiverse-pack-selector-heading">
                                <FolderPlus size={16} strokeWidth={1.5} />
                                Create New Pack
                            </h4>

                            <div className="lumiverse-pack-selector-field">
                                <input
                                    type="text"
                                    className="lumiverse-input"
                                    placeholder="Pack name (required)"
                                    value={newPackName}
                                    onChange={(e) => {
                                        setNewPackName(e.target.value);
                                        setError('');
                                    }}
                                    autoFocus
                                />
                            </div>

                            <div className="lumiverse-pack-selector-field">
                                <input
                                    type="text"
                                    className="lumiverse-input"
                                    placeholder="Author name (optional)"
                                    value={newPackAuthor}
                                    onChange={(e) => setNewPackAuthor(e.target.value)}
                                />
                            </div>

                            <div className="lumiverse-pack-selector-field">
                                <input
                                    type="text"
                                    className="lumiverse-input"
                                    placeholder="Cover image URL (optional)"
                                    value={newPackCover}
                                    onChange={(e) => setNewPackCover(e.target.value)}
                                />
                            </div>

                            {error && (
                                <div className="lumiverse-pack-selector-error">{error}</div>
                            )}

                            <div className="lumiverse-pack-selector-form-actions">
                                <button
                                    className="lumiverse-btn lumiverse-btn--secondary"
                                    onClick={() => {
                                        setShowNewPackForm(false);
                                        setNewPackName('');
                                        setNewPackAuthor('');
                                        setNewPackCover('');
                                        setError('');
                                    }}
                                    type="button"
                                >
                                    Cancel
                                </button>
                                <button
                                    className="lumiverse-btn lumiverse-btn--primary"
                                    onClick={handleCreatePack}
                                    type="button"
                                >
                                    <FolderPlus size={14} />
                                    Create & Continue
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="lumiverse-pack-selector-footer">
                <button
                    className="lumiverse-btn lumiverse-btn--secondary"
                    onClick={onClose}
                    type="button"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

export default PackSelectorModal;
