import React, { useState, useCallback } from 'react';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import clsx from 'clsx';
import { Folder, FolderPlus, Check, ChevronRight } from 'lucide-react';

/**
 * Pack Selector Modal
 *
 * Shows list of existing custom packs to select from,
 * plus option to create a new pack.
 *
 * Used as first step in "Create Lumia" flow from old code.
 *
 * Props:
 * - onSelect: Optional callback(packName, pack) - if not provided, opens lumiaEditor modal
 * - onClose: Close callback
 */
function PackSelectorModal({ onSelect, onClose }) {
    const { customPacks, allPacks } = usePacks();
    const actions = useLumiverseActions();

    // Default behavior: open lumiaEditor modal with selected pack
    const defaultOnSelect = (packName, pack) => {
        actions.openModal('lumiaEditor', { packName });
    };

    const handleSelect = onSelect || defaultOnSelect;

    // State for new pack form
    const [showNewPackForm, setShowNewPackForm] = useState(false);
    const [newPackName, setNewPackName] = useState('');
    const [newPackAuthor, setNewPackAuthor] = useState('');
    const [newPackCover, setNewPackCover] = useState('');
    const [error, setError] = useState('');

    // Get editable packs (custom packs or packs with no URL)
    const editablePacks = allPacks.filter(pack => pack.isCustom || !pack.url);

    // Handle selecting an existing pack
    const handleSelectPack = useCallback((pack) => {
        handleSelect(pack.name, pack);
    }, [handleSelect]);

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

        // Select the newly created pack
        handleSelect(name, newPack);
    }, [newPackName, newPackAuthor, newPackCover, allPacks, actions, handleSelect]);

    // Count Lumias in a pack
    const getLumiaCount = (pack) => {
        if (!pack.items) return 0;
        return pack.items.filter(item => item.lumiaDefName).length;
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
                            {editablePacks.map((pack) => (
                                <button
                                    key={pack.id || pack.name}
                                    className="lumiverse-pack-selector-item"
                                    onClick={() => handleSelectPack(pack)}
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
                                    <ChevronRight size={16} className="lumiverse-pack-selector-item-arrow" />
                                </button>
                            ))}
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
