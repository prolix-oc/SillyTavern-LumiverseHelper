import React, { useState, useCallback } from 'react';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';
import clsx from 'clsx';
import { Folder, FolderPlus, Check, ChevronRight, ChevronDown, Plus, Edit2 } from 'lucide-react';

/**
 * Individual Lumia item row with adaptive image positioning
 */
function LumiaItemRow({ item, packName, onEdit }) {
    const { objectPosition } = useAdaptiveImagePosition(item.lumia_img);

    return (
        <div className="lumiverse-pack-selector-lumia-item">
            {item.lumia_img && (
                <img
                    src={item.lumia_img}
                    alt=""
                    className="lumiverse-pack-selector-lumia-avatar"
                    style={{ objectPosition }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                />
            )}
            <span className="lumiverse-pack-selector-lumia-name">
                {item.lumiaDefName}
            </span>
            <button
                className="lumiverse-pack-selector-lumia-edit"
                onClick={() => onEdit(packName, item)}
                title="Edit this Lumia"
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
        setExpandedPackName(prev => prev === pack.name ? null : pack.name);
    }, []);

    // Handle adding a new Lumia to a pack
    const handleAddNewLumia = useCallback((packName) => {
        actions.openModal('lumiaEditor', { packName });
    }, [actions]);

    // Handle editing an existing Lumia
    const handleEditLumia = useCallback((packName, item) => {
        actions.openModal('lumiaEditor', { packName, editingItem: item });
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

        // Create the new pack
        const newPack = {
            id: `pack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name,
            author: newPackAuthor.trim() || '',
            coverUrl: newPackCover.trim() || '',
            url: '',
            isCustom: true,
            items: [],
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

    // Get Lumia items from a pack
    const getLumiaItems = (pack) => {
        if (!pack.items) return [];
        return pack.items.filter(item => item.lumiaDefName);
    };

    // Count Lumias in a pack
    const getLumiaCount = (pack) => {
        return getLumiaItems(pack).length;
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
                                const isExpanded = expandedPackName === pack.name;
                                const lumiaItems = getLumiaItems(pack);

                                return (
                                    <div
                                        key={pack.id || pack.name}
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
                                                <span className="lumiverse-pack-selector-item-name">
                                                    {pack.name}
                                                </span>
                                                <span className="lumiverse-pack-selector-item-meta">
                                                    {getLumiaCount(pack)} Lumias
                                                    {pack.author && ` • by ${pack.author}`}
                                                </span>
                                            </div>
                                            {isExpanded ? (
                                                <ChevronDown size={16} className="lumiverse-pack-selector-item-arrow" />
                                            ) : (
                                                <ChevronRight size={16} className="lumiverse-pack-selector-item-arrow" />
                                            )}
                                        </button>

                                        {/* Expanded Lumias List */}
                                        {isExpanded && (
                                            <div className="lumiverse-pack-selector-lumias">
                                                {/* Add New Lumia Button */}
                                                <button
                                                    className="lumiverse-pack-selector-add-lumia"
                                                    onClick={() => handleAddNewLumia(pack.name)}
                                                    type="button"
                                                >
                                                    <Plus size={14} strokeWidth={2} />
                                                    <span>Add New Lumia</span>
                                                </button>

                                                {/* Existing Lumias */}
                                                {lumiaItems.length > 0 ? (
                                                    <div className="lumiverse-pack-selector-lumia-list">
                                                        {lumiaItems.map((item, index) => (
                                                            <LumiaItemRow
                                                                key={item.lumiaDefName || index}
                                                                item={item}
                                                                packName={pack.name}
                                                                onEdit={handleEditLumia}
                                                            />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="lumiverse-pack-selector-lumia-empty">
                                                        No Lumias yet. Add your first one!
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
