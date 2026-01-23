import React, { useState, useMemo, useSyncExternalStore, useCallback } from 'react';
import clsx from 'clsx';
import { Users, Plus, Trash2, Search, X, Edit2, Check, Zap, Heart } from 'lucide-react';
import {
    useLumiverseStore,
    useLumiverseActions,
    usePacks,
    saveToExtension,
} from '../../store/LumiverseContext';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';

// Get store for direct state access
const store = useLumiverseStore;

// Stable fallback constants for useSyncExternalStore
const EMPTY_ARRAY = [];

// Stable selector functions
const selectCouncilMembers = () => store.getState().councilMembers || EMPTY_ARRAY;

/**
 * Find a Lumia item in a pack - supports both new and legacy formats
 */
function findLumiaInPack(pack, itemName) {
    if (!pack) return null;
    // New format: lumiaItems array
    if (pack.lumiaItems && pack.lumiaItems.length > 0) {
        return pack.lumiaItems.find(i =>
            i.lumiaName === itemName || i.lumiaDefName === itemName
        );
    }
    // Legacy format: items array
    if (pack.items) {
        return pack.items.find(i => i.lumiaDefName === itemName);
    }
    return null;
}

/**
 * Get display name for a Lumia item from pack data
 */
function getLumiaName(packs, packName, itemName) {
    const packsObj = Array.isArray(packs)
        ? packs.reduce((acc, p) => ({ ...acc, [p.name || p.packName]: p }), {})
        : packs;
    const pack = packsObj[packName];
    if (!pack) return itemName;
    const item = findLumiaInPack(pack, itemName);
    return item?.lumiaName || item?.lumiaDefName || itemName;
}

/**
 * Get Lumia image URL from pack data
 */
function getLumiaImage(packs, packName, itemName) {
    const packsObj = Array.isArray(packs)
        ? packs.reduce((acc, p) => ({ ...acc, [p.name || p.packName]: p }), {})
        : packs;
    const pack = packsObj[packName];
    if (!pack) return null;
    const item = findLumiaInPack(pack, itemName);
    return item?.avatarUrl || item?.lumia_img || null;
}

/**
 * Get a Lumia field with fallback for old/new format
 */
function getLumiaFieldLocal(item, field) {
    if (!item) return null;
    const fieldMap = {
        name: ['lumiaName', 'lumiaDefName'],
        def: ['lumiaDefinition', 'lumiaDef'],
        img: ['avatarUrl', 'lumia_img'],
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
 * Card for a selectable Lumia (not yet in council)
 * Supports both new and legacy field names
 */
function SelectableLumiaCard({ item, packName, onAdd, animationIndex }) {
    const itemImg = getLumiaFieldLocal(item, 'img');
    const itemName = getLumiaFieldLocal(item, 'name') || 'Unknown';

    const { objectPosition } = useAdaptiveImagePosition(itemImg);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    // Staggered animation delay
    const animationDelay = Math.min(animationIndex * 30, 300);

    // Handler for adding member - supports both click and touch
    const handleAdd = () => {
        onAdd({ packName, itemName });
    };

    return (
        <button
            type="button"
            className="lumiverse-council-select-card lumia-card-appear"
            style={{ animationDelay: `${animationDelay}ms` }}
            onPointerUp={(e) => {
                e.preventDefault();
                handleAdd();
            }}
        >
            <div className="lumiverse-council-select-card-image">
                {itemImg && !imageError ? (
                    <>
                        <img
                            src={itemImg}
                            alt={itemName}
                            loading="lazy"
                            className={imageLoaded ? 'lumia-img-loaded' : ''}
                            style={{ objectPosition }}
                            onLoad={() => setImageLoaded(true)}
                            onError={() => setImageError(true)}
                        />
                        {!imageLoaded && <div className="lumia-img-spinner" />}
                    </>
                ) : (
                    <div className="lumiverse-council-select-card-placeholder">
                        <Users size={24} strokeWidth={1.5} />
                    </div>
                )}
                <div className="lumiverse-council-select-card-add">
                    <Plus size={16} strokeWidth={2} />
                </div>
            </div>
            <div className="lumiverse-council-select-card-info">
                <span className="lumiverse-council-select-card-name">{itemName}</span>
                <span className="lumiverse-council-select-card-pack">{packName}</span>
            </div>
        </button>
    );
}

/**
 * Card for an existing council member
 */
function CouncilMemberCard({ member, packs, onRemove, onUpdateRole }) {
    const [isEditingRole, setIsEditingRole] = useState(false);
    const [roleValue, setRoleValue] = useState(member.role || '');

    const memberName = getLumiaName(packs, member.packName, member.itemName);
    const memberImage = getLumiaImage(packs, member.packName, member.itemName);
    const { objectPosition } = useAdaptiveImagePosition(memberImage);

    const handleRoleSave = () => {
        onUpdateRole(member.id, { role: roleValue });
        setIsEditingRole(false);
    };

    const handleRoleKeyDown = (e) => {
        if (e.key === 'Enter') handleRoleSave();
        if (e.key === 'Escape') {
            setRoleValue(member.role || '');
            setIsEditingRole(false);
        }
    };

    const handleRoleCancel = () => {
        setRoleValue(member.role || '');
        setIsEditingRole(false);
    };

    const handleStartEdit = () => {
        setIsEditingRole(true);
    };

    const handleRemove = () => {
        onRemove(member.id);
    };

    const behaviorsCount = member.behaviors?.length || 0;
    const personalitiesCount = member.personalities?.length || 0;

    return (
        <div className="lumiverse-council-member-card">
            <div className="lumiverse-council-member-card-avatar">
                {memberImage ? (
                    <img
                        src={memberImage}
                        alt={memberName}
                        style={{ objectPosition }}
                    />
                ) : (
                    <Users size={20} strokeWidth={1.5} />
                )}
            </div>
            <div className="lumiverse-council-member-card-content">
                <span className="lumiverse-council-member-card-name">{memberName}</span>
                {isEditingRole ? (
                    <div className="lumiverse-council-member-role-edit">
                        <input
                            type="text"
                            className="lumiverse-council-input-sm"
                            placeholder="Role/title..."
                            value={roleValue}
                            onChange={(e) => setRoleValue(e.target.value)}
                            onKeyDown={handleRoleKeyDown}
                            autoFocus
                        />
                        <button
                            className="lumiverse-council-btn-sm lumiverse-council-btn-sm--primary"
                            onPointerUp={(e) => {
                                e.preventDefault();
                                handleRoleSave();
                            }}
                            type="button"
                        >
                            <Check size={12} strokeWidth={2} />
                        </button>
                        <button
                            className="lumiverse-council-btn-sm"
                            onPointerUp={(e) => {
                                e.preventDefault();
                                handleRoleCancel();
                            }}
                            type="button"
                        >
                            <X size={12} strokeWidth={2} />
                        </button>
                    </div>
                ) : (
                    <div className="lumiverse-council-member-card-meta">
                        {member.role ? (
                            <span
                                className="lumiverse-council-member-card-role"
                                onPointerUp={(e) => {
                                    e.preventDefault();
                                    handleStartEdit();
                                }}
                                title="Tap to edit role"
                            >
                                {member.role}
                            </span>
                        ) : (
                            <button
                                className="lumiverse-council-add-role-btn"
                                onPointerUp={(e) => {
                                    e.preventDefault();
                                    handleStartEdit();
                                }}
                                type="button"
                            >
                                <Edit2 size={10} /> Add role
                            </button>
                        )}
                        <span className="lumiverse-council-member-card-stats">
                            <span title="Behaviors"><Zap size={10} /> {behaviorsCount}</span>
                            <span title="Personalities"><Heart size={10} /> {personalitiesCount}</span>
                        </span>
                    </div>
                )}
            </div>
            <button
                className="lumiverse-council-btn-sm lumiverse-council-btn-sm--danger"
                onPointerUp={(e) => {
                    e.preventDefault();
                    handleRemove();
                }}
                title="Remove from council"
                type="button"
            >
                <Trash2 size={14} strokeWidth={1.5} />
            </button>
        </div>
    );
}

/**
 * Empty state for no members
 */
function EmptyMembers() {
    return (
        <div className="lumiverse-council-select-empty">
            <Users size={24} strokeWidth={1.5} />
            <span>No council members yet</span>
            <p>Select Lumias from below to add them to your council.</p>
        </div>
    );
}

/**
 * Empty state for no available Lumias
 */
function EmptyAvailable({ hasSearch }) {
    return (
        <div className="lumiverse-council-select-empty lumiverse-council-select-empty--muted">
            {hasSearch ? (
                <>
                    <Search size={24} strokeWidth={1.5} />
                    <span>No matching Lumias</span>
                    <p>Try a different search term.</p>
                </>
            ) : (
                <>
                    <Users size={24} strokeWidth={1.5} />
                    <span>No Lumias available</span>
                    <p>All Lumias are already in the council, or no packs are loaded.</p>
                </>
            )}
        </div>
    );
}

/**
 * Council Select Modal
 * Two-section layout:
 * 1. Current council members (horizontal scrolling on mobile)
 * 2. Available Lumias to add (card grid)
 */
function CouncilSelectModal({ onClose }) {
    const actions = useLumiverseActions();
    const { allPacks } = usePacks();
    const [searchTerm, setSearchTerm] = useState('');

    // Subscribe to council state
    const councilMembers = useSyncExternalStore(
        store.subscribe,
        selectCouncilMembers,
        selectCouncilMembers
    );

    // Build packs object for lookups - support both name and packName
    const packsObj = useMemo(() => {
        if (Array.isArray(allPacks)) {
            return allPacks.reduce((acc, p) => ({ ...acc, [p.name || p.packName]: p }), {});
        }
        return allPacks || {};
    }, [allPacks]);

    // Get all available Lumia items not already in council
    const availableItems = useMemo(() => {
        const existing = new Set(councilMembers.map(m => `${m.packName}:${m.itemName}`));
        const items = [];

        const packsArray = Array.isArray(allPacks) ? allPacks : Object.values(allPacks || {});
        packsArray.forEach(pack => {
            const packName = pack.name || pack.packName;

            // New format: lumiaItems array
            if (pack.lumiaItems && pack.lumiaItems.length > 0) {
                pack.lumiaItems.forEach(item => {
                    const itemName = item.lumiaName || item.lumiaDefName;
                    const itemDef = item.lumiaDefinition || item.lumiaDef;
                    if (!itemName || !itemDef) return;
                    const key = `${packName}:${itemName}`;
                    if (existing.has(key)) return;
                    items.push({ packName, item });
                });
            }
            // Legacy format: items array
            else if (pack.items) {
                pack.items.forEach(item => {
                    // Only include Lumia items with definitions
                    if (!item.lumiaDefName || !item.lumiaDef) return;
                    const key = `${packName}:${item.lumiaDefName}`;
                    if (existing.has(key)) return;
                    items.push({ packName, item });
                });
            }
        });

        // Filter by search term - supports both new and legacy field names
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            return items.filter(({ item, packName }) => {
                const itemName = getLumiaFieldLocal(item, 'name') || '';
                return itemName.toLowerCase().includes(term) ||
                    packName.toLowerCase().includes(term);
            });
        }

        return items;
    }, [allPacks, councilMembers, searchTerm]);

    // Handlers
    const handleAddMember = useCallback((member) => {
        actions.addCouncilMember(member);
        saveToExtension();
    }, [actions]);

    const handleRemoveMember = useCallback((memberId) => {
        actions.removeCouncilMember(memberId);
        saveToExtension();
    }, [actions]);

    const handleUpdateRole = useCallback((memberId, updates) => {
        actions.updateCouncilMember(memberId, updates);
        saveToExtension();
    }, [actions]);

    return (
        <div className="lumiverse-council-select-modal">
            {/* Header */}
            <div className="lumiverse-council-select-header">
                <div className="lumiverse-council-select-header-icon">
                    <Users size={20} strokeWidth={1.5} />
                </div>
                <div className="lumiverse-council-select-header-text">
                    <h3>Configure Council</h3>
                    <p>Select Lumias to join your council of independent characters.</p>
                </div>
            </div>

            {/* Current Members Section */}
            <div className="lumiverse-council-select-section">
                <div className="lumiverse-council-select-section-header">
                    <span>Council Members</span>
                    <span className="lumiverse-council-select-count">{councilMembers.length}</span>
                </div>
                <div className="lumiverse-council-select-members">
                    {councilMembers.length === 0 ? (
                        <EmptyMembers />
                    ) : (
                        <div className="lumiverse-council-member-list">
                            {councilMembers.map((member) => (
                                <CouncilMemberCard
                                    key={member.id}
                                    member={member}
                                    packs={packsObj}
                                    onRemove={handleRemoveMember}
                                    onUpdateRole={handleUpdateRole}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Available Lumias Section */}
            <div className="lumiverse-council-select-section lumiverse-council-select-section--available">
                <div className="lumiverse-council-select-section-header">
                    <span>Add Lumias</span>
                    <div className="lumiverse-council-search-wrapper">
                        <Search size={14} strokeWidth={1.5} />
                        <input
                            type="text"
                            className="lumiverse-council-search-input"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                className="lumiverse-council-search-clear"
                                onClick={() => setSearchTerm('')}
                                type="button"
                            >
                                <X size={12} strokeWidth={2} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="lumiverse-council-select-grid-wrapper">
                    {availableItems.length === 0 ? (
                        <EmptyAvailable hasSearch={!!searchTerm.trim()} />
                    ) : (
                        <div className="lumiverse-council-select-grid">
                            {availableItems.map(({ item, packName }, index) => (
                                <SelectableLumiaCard
                                    key={`${packName}:${getLumiaFieldLocal(item, 'name')}`}
                                    item={item}
                                    packName={packName}
                                    onAdd={handleAddMember}
                                    animationIndex={index}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="lumiverse-council-select-footer">
                <button
                    className="lumia-modal-btn lumia-modal-btn-primary"
                    onClick={onClose}
                    type="button"
                >
                    Done
                </button>
            </div>
        </div>
    );
}

export default CouncilSelectModal;
