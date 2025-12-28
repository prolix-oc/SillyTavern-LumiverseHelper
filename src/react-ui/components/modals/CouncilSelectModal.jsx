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
 * Get display name for a Lumia item from pack data
 */
function getLumiaName(packs, packName, itemName) {
    const packsObj = Array.isArray(packs)
        ? packs.reduce((acc, p) => ({ ...acc, [p.name]: p }), {})
        : packs;
    const pack = packsObj[packName];
    if (!pack) return itemName;
    const item = pack.items?.find(i => i.lumiaDefName === itemName);
    return item?.lumiaDefName || itemName;
}

/**
 * Get Lumia image URL from pack data
 */
function getLumiaImage(packs, packName, itemName) {
    const packsObj = Array.isArray(packs)
        ? packs.reduce((acc, p) => ({ ...acc, [p.name]: p }), {})
        : packs;
    const pack = packsObj[packName];
    if (!pack) return null;
    const item = pack.items?.find(i => i.lumiaDefName === itemName);
    return item?.lumia_img || null;
}

/**
 * Card for a selectable Lumia (not yet in council)
 */
function SelectableLumiaCard({ item, packName, onAdd, animationIndex }) {
    const { objectPosition } = useAdaptiveImagePosition(item.lumia_img);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    const displayName = item.lumiaDefName || 'Unknown';
    const imgToShow = item.lumia_img;

    // Staggered animation delay
    const animationDelay = Math.min(animationIndex * 30, 300);

    return (
        <button
            type="button"
            className="lumiverse-council-select-card lumia-card-appear"
            style={{ animationDelay: `${animationDelay}ms` }}
            onClick={() => onAdd({ packName, itemName: item.lumiaDefName })}
        >
            <div className="lumiverse-council-select-card-image">
                {imgToShow && !imageError ? (
                    <>
                        <img
                            src={imgToShow}
                            alt={displayName}
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
                <span className="lumiverse-council-select-card-name">{displayName}</span>
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
                            onClick={handleRoleSave}
                            type="button"
                        >
                            <Check size={12} strokeWidth={2} />
                        </button>
                        <button
                            className="lumiverse-council-btn-sm"
                            onClick={() => {
                                setRoleValue(member.role || '');
                                setIsEditingRole(false);
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
                                onClick={() => setIsEditingRole(true)}
                                title="Click to edit role"
                            >
                                {member.role}
                            </span>
                        ) : (
                            <button
                                className="lumiverse-council-add-role-btn"
                                onClick={() => setIsEditingRole(true)}
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
                onClick={() => onRemove(member.id)}
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

    // Build packs object for lookups
    const packsObj = useMemo(() => {
        if (Array.isArray(allPacks)) {
            return allPacks.reduce((acc, p) => ({ ...acc, [p.name]: p }), {});
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
            (pack.items || []).forEach(item => {
                // Only include Lumia items with definitions
                if (!item.lumiaDefName || !item.lumiaDef) return;
                const key = `${packName}:${item.lumiaDefName}`;
                if (existing.has(key)) return;

                items.push({
                    packName,
                    item,
                });
            });
        });

        // Filter by search term
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            return items.filter(({ item, packName }) =>
                item.lumiaDefName.toLowerCase().includes(term) ||
                packName.toLowerCase().includes(term)
            );
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
                                    key={`${packName}:${item.lumiaDefName}`}
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
