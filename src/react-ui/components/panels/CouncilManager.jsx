import React, { useState, useMemo, useSyncExternalStore, useCallback } from 'react';
import clsx from 'clsx';
import { Users, Plus, Trash2, ChevronDown, ChevronUp, Edit2, X, Check, Zap, Heart, Star, Package } from 'lucide-react';
import { useLumiverseStore, useLumiverseActions, usePacks, saveToExtension } from '../../store/LumiverseContext';

/* global toastr */

// Get store for direct state access
const store = useLumiverseStore;

// Stable fallback constants for useSyncExternalStore
const EMPTY_ARRAY = [];

// Stable selector functions
const selectCouncilMode = () => store.getState().councilMode || false;
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
 * Collapsible member card
 */
function CouncilMemberCard({ member, packs, onUpdate, onRemove }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditingRole, setIsEditingRole] = useState(false);
    const [roleValue, setRoleValue] = useState(member.role || '');

    const memberName = getLumiaName(packs, member.packName, member.itemName);
    const memberImage = getLumiaImage(packs, member.packName, member.itemName);

    const handleRoleSave = () => {
        onUpdate(member.id, { role: roleValue });
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
        <div className="lumiverse-council-member">
            <div className="lumiverse-council-member-header" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="lumiverse-council-member-avatar">
                    {memberImage ? (
                        <img src={memberImage} alt={memberName} />
                    ) : (
                        <Users size={20} strokeWidth={1.5} />
                    )}
                </div>
                <div className="lumiverse-council-member-info">
                    <span className="lumiverse-council-member-name">{memberName}</span>
                    {member.role && !isEditingRole && (
                        <span className="lumiverse-council-member-role">{member.role}</span>
                    )}
                    <div className="lumiverse-council-member-stats">
                        <span className="lumiverse-council-stat">
                            <Zap size={12} /> {behaviorsCount}
                        </span>
                        <span className="lumiverse-council-stat">
                            <Heart size={12} /> {personalitiesCount}
                        </span>
                    </div>
                </div>
                <div className="lumiverse-council-member-actions">
                    <button
                        className="lumiverse-council-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsEditingRole(true);
                            setIsExpanded(true);
                        }}
                        title="Edit role"
                        type="button"
                    >
                        <Edit2 size={14} strokeWidth={1.5} />
                    </button>
                    <button
                        className="lumiverse-council-btn lumiverse-council-btn--danger"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove(member.id);
                        }}
                        title="Remove from council"
                        type="button"
                    >
                        <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                    <span className={clsx('lumiverse-council-expand', isExpanded && 'lumiverse-council-expand--open')}>
                        <ChevronDown size={16} strokeWidth={2} />
                    </span>
                </div>
            </div>

            {isExpanded && (
                <div className="lumiverse-council-member-body">
                    {/* Role editor */}
                    {isEditingRole ? (
                        <div className="lumiverse-council-role-edit">
                            <label>Role/Title:</label>
                            <div className="lumiverse-council-role-input-row">
                                <input
                                    type="text"
                                    className="lumiverse-council-input"
                                    placeholder="e.g., Leader, Advisor, Wildcard..."
                                    value={roleValue}
                                    onChange={(e) => setRoleValue(e.target.value)}
                                    onKeyDown={handleRoleKeyDown}
                                    autoFocus
                                />
                                <button
                                    className="lumiverse-council-btn lumiverse-council-btn--primary"
                                    onClick={handleRoleSave}
                                    type="button"
                                >
                                    <Check size={14} strokeWidth={2} />
                                </button>
                                <button
                                    className="lumiverse-council-btn"
                                    onClick={() => {
                                        setRoleValue(member.role || '');
                                        setIsEditingRole(false);
                                    }}
                                    type="button"
                                >
                                    <X size={14} strokeWidth={2} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="lumiverse-council-role-display">
                            <span className="lumiverse-council-role-label">Role:</span>
                            <span className="lumiverse-council-role-value">
                                {member.role || <em>No role set</em>}
                            </span>
                        </div>
                    )}

                    {/* Traits summary */}
                    <div className="lumiverse-council-traits-section">
                        <div className="lumiverse-council-traits-group">
                            <span className="lumiverse-council-traits-label">
                                <Zap size={14} strokeWidth={1.5} /> Behaviors:
                            </span>
                            {behaviorsCount > 0 ? (
                                <span className="lumiverse-council-traits-list">
                                    {member.behaviors.map(b =>
                                        getLumiaName(packs, b.packName, b.itemName)
                                    ).join(', ')}
                                </span>
                            ) : (
                                <span className="lumiverse-council-traits-empty">None selected</span>
                            )}
                        </div>
                        <div className="lumiverse-council-traits-group">
                            <span className="lumiverse-council-traits-label">
                                <Heart size={14} strokeWidth={1.5} /> Personalities:
                            </span>
                            {personalitiesCount > 0 ? (
                                <span className="lumiverse-council-traits-list">
                                    {member.personalities.map(p =>
                                        getLumiaName(packs, p.packName, p.itemName)
                                    ).join(', ')}
                                </span>
                            ) : (
                                <span className="lumiverse-council-traits-empty">None selected</span>
                            )}
                        </div>
                    </div>

                    <p className="lumiverse-council-help-text">
                        Each member's inherent traits are auto-attached when added.
                        Additional trait configuration coming soon.
                    </p>
                </div>
            )}
        </div>
    );
}

/**
 * Add member dropdown/modal
 */
function AddMemberDropdown({ packs, existingMembers, onAdd, onClose }) {
    const [searchTerm, setSearchTerm] = useState('');
    // Disable autoFocus on mobile to prevent keyboard from auto-opening
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;

    // Get all Lumia items that aren't already council members
    const availableItems = useMemo(() => {
        const existing = new Set(existingMembers.map(m => `${m.packName}:${m.itemName}`));
        const items = [];

        const packsArray = Array.isArray(packs) ? packs : Object.values(packs || {});
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
                    items.push({
                        packName,
                        itemName,
                        displayName: itemName,
                        image: item.avatarUrl || item.lumia_img,
                    });
                });
            }
            // Legacy format: items array
            else if (pack.items) {
                pack.items.forEach(item => {
                    // Only include Lumia items with definitions
                    if (!item.lumiaDefName || !item.lumiaDef) return;
                    const key = `${packName}:${item.lumiaDefName}`;
                    if (existing.has(key)) return;
                    items.push({
                        packName,
                        itemName: item.lumiaDefName,
                        displayName: item.lumiaDefName,
                        image: item.lumia_img,
                    });
                });
            }
        });

        // Filter by search term
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            return items.filter(item =>
                item.displayName.toLowerCase().includes(term) ||
                item.packName.toLowerCase().includes(term)
            );
        }

        return items;
    }, [packs, existingMembers, searchTerm]);

    // Handle item selection
    const handleItemSelect = useCallback((item) => {
        onAdd({ packName: item.packName, itemName: item.itemName });
        onClose();
    }, [onAdd, onClose]);

    return (
        <div 
            className="lumiverse-council-add-dropdown"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="lumiverse-council-add-header">
                <input
                    type="text"
                    className="lumiverse-council-search"
                    placeholder="Search Lumias..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus={!isMobile}
                />
                <button
                    className="lumiverse-council-btn"
                    onClick={onClose}
                    title="Close"
                    type="button"
                >
                    <X size={16} strokeWidth={2} />
                </button>
            </div>
            <div className="lumiverse-council-add-list">
                {availableItems.length === 0 ? (
                    <div className="lumiverse-council-add-empty">
                        {searchTerm ? 'No matching Lumias found' : 'All Lumias are already in the council'}
                    </div>
                ) : (
                    availableItems.map((item, index) => (
                        <button
                            key={`${item.packName}:${item.itemName}`}
                            className="lumiverse-council-add-item"
                            onClick={() => handleItemSelect(item)}
                            type="button"
                        >
                            <div className="lumiverse-council-add-item-avatar">
                                {item.image ? (
                                    <img src={item.image} alt={item.displayName} />
                                ) : (
                                    <Users size={16} />
                                )}
                            </div>
                            <div className="lumiverse-council-add-item-info">
                                <span className="lumiverse-council-add-item-name">{item.displayName}</span>
                                <span className="lumiverse-council-add-item-pack">{item.packName}</span>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}

/**
 * Quick add pack dropdown - add all Lumias from a pack at once
 */
function QuickAddPackDropdown({ packs, existingMembers, onAddPack, onClose }) {
    const [searchTerm, setSearchTerm] = useState('');
    // Disable autoFocus on mobile to prevent keyboard from auto-opening
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;

    // Get packs with available (not-yet-added) Lumias and their counts
    const availablePacks = useMemo(() => {
        const existing = new Set(existingMembers.map(m => `${m.packName}:${m.itemName}`));
        const packList = [];

        const packsArray = Array.isArray(packs) ? packs : Object.values(packs || {});
        packsArray.forEach(pack => {
            const packName = pack.name || pack.packName;
            let availableCount = 0;

            // New format: lumiaItems array
            if (pack.lumiaItems && pack.lumiaItems.length > 0) {
                pack.lumiaItems.forEach(item => {
                    const itemName = item.lumiaName || item.lumiaDefName;
                    const itemDef = item.lumiaDefinition || item.lumiaDef;
                    if (!itemName || !itemDef) return;
                    const key = `${packName}:${itemName}`;
                    if (!existing.has(key)) availableCount++;
                });
            }
            // Legacy format: items array
            else if (pack.items) {
                pack.items.forEach(item => {
                    if (!item.lumiaDefName || !item.lumiaDef) return;
                    const key = `${packName}:${item.lumiaDefName}`;
                    if (!existing.has(key)) availableCount++;
                });
            }

            // Only include packs with available Lumias
            if (availableCount > 0) {
                packList.push({
                    packName,
                    availableCount,
                    coverUrl: pack.coverUrl,
                });
            }
        });

        // Filter by search term
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            return packList.filter(pack =>
                pack.packName.toLowerCase().includes(term)
            );
        }

        return packList;
    }, [packs, existingMembers, searchTerm]);

    // Handle pack selection
    const handlePackSelect = useCallback((packName) => {
        onAddPack(packName);
        onClose();
    }, [onAddPack, onClose]);

    return (
        <div 
            className="lumiverse-council-add-dropdown lumiverse-council-pack-dropdown"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="lumiverse-council-add-header">
                <input
                    type="text"
                    className="lumiverse-council-search"
                    placeholder="Search packs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus={!isMobile}
                />
                <button
                    className="lumiverse-council-btn"
                    onClick={onClose}
                    title="Close"
                    type="button"
                >
                    <X size={16} strokeWidth={2} />
                </button>
            </div>
            <div className="lumiverse-council-add-list">
                {availablePacks.length === 0 ? (
                    <div className="lumiverse-council-add-empty">
                        {searchTerm ? 'No matching packs found' : 'All Lumias from all packs are already in the council'}
                    </div>
                ) : (
                    availablePacks.map((pack) => (
                        <button
                            key={pack.packName}
                            className="lumiverse-council-add-item lumiverse-council-pack-item"
                            onClick={() => handlePackSelect(pack.packName)}
                            type="button"
                        >
                            <div className="lumiverse-council-add-item-avatar lumiverse-council-pack-icon">
                                {pack.coverUrl ? (
                                    <img src={pack.coverUrl} alt={pack.packName} />
                                ) : (
                                    <Package size={18} strokeWidth={1.5} />
                                )}
                            </div>
                            <div className="lumiverse-council-add-item-info">
                                <span className="lumiverse-council-add-item-name">{pack.packName}</span>
                                <span className="lumiverse-council-add-item-pack">
                                    {pack.availableCount} Lumia{pack.availableCount !== 1 ? 's' : ''} available
                                </span>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}

/**
 * Empty state component
 */
function EmptyState() {
    return (
        <div className="lumiverse-council-empty">
            <span className="lumiverse-council-empty-icon">
                <Users size={32} strokeWidth={1.5} />
            </span>
            <h4>No Council Members</h4>
            <p>Add Lumias to your council to create a collaborative group of independent characters.</p>
        </div>
    );
}

/**
 * Main Council Manager component
 */
function CouncilManager() {
    const actions = useLumiverseActions();
    const { allPacks } = usePacks();
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [isAddingPack, setIsAddingPack] = useState(false);

    // Subscribe to council state
    const councilMode = useSyncExternalStore(
        store.subscribe,
        selectCouncilMode,
        selectCouncilMode
    );
    const councilMembers = useSyncExternalStore(
        store.subscribe,
        selectCouncilMembers,
        selectCouncilMembers
    );
    const handleAddMember = useCallback((member) => {
        actions.addCouncilMember(member);
        saveToExtension();
    }, [actions]);

    const handleAddPack = useCallback((packName) => {
        const addedCount = actions.addCouncilMembersFromPack(packName);
        saveToExtension();
        // Show feedback
        if (typeof toastr !== 'undefined') {
            if (addedCount > 0) {
                toastr.success(`Added ${addedCount} Lumia${addedCount !== 1 ? 's' : ''} from "${packName}" to the council`);
            } else {
                toastr.info('No new Lumias to add from this pack');
            }
        }
    }, [actions]);

    const handleUpdateMember = useCallback((memberId, updates) => {
        actions.updateCouncilMember(memberId, updates);
        saveToExtension();
    }, [actions]);

    const handleRemoveMember = useCallback((memberId) => {
        actions.removeCouncilMember(memberId);
        saveToExtension();
    }, [actions]);

    const handleToggleCouncilMode = useCallback((enabled) => {
        actions.setCouncilMode(enabled);
        saveToExtension();
    }, [actions]);

    // Build packs object for lookups - support both name and packName
    const packsObj = useMemo(() => {
        if (Array.isArray(allPacks)) {
            return allPacks.reduce((acc, p) => ({ ...acc, [p.name || p.packName]: p }), {});
        }
        return allPacks || {};
    }, [allPacks]);

    return (
        <div className="lumiverse-council-manager">
            {/* Header with mode toggle */}
            <div className="lumiverse-council-header">
                <h3 className="lumiverse-council-title">
                    <Users size={18} strokeWidth={1.5} />
                    Council of Lumiae
                </h3>
                <label className="lumiverse-council-mode-toggle">
                    <input
                        type="checkbox"
                        checked={councilMode}
                        onChange={(e) => handleToggleCouncilMode(e.target.checked)}
                    />
                    <span className={clsx('lumiverse-council-mode-switch', councilMode && 'lumiverse-council-mode-switch--on')}>
                        <span className="lumiverse-council-mode-thumb" />
                    </span>
                    <span className="lumiverse-council-mode-label">
                        {councilMode ? 'Active' : 'Inactive'}
                    </span>
                </label>
            </div>

            {/* Mode description */}
            <p className="lumiverse-council-desc">
                Create a council of independent Lumias that collaborate, each with their own identity, behaviors, and personalities.
            </p>

            {/* Add member button / dropdown */}
            <div className="lumiverse-council-add-section">
                {isAddingMember ? (
                    <AddMemberDropdown
                        packs={packsObj}
                        existingMembers={councilMembers}
                        onAdd={handleAddMember}
                        onClose={() => setIsAddingMember(false)}
                    />
                ) : isAddingPack ? (
                    <QuickAddPackDropdown
                        packs={packsObj}
                        existingMembers={councilMembers}
                        onAddPack={handleAddPack}
                        onClose={() => setIsAddingPack(false)}
                    />
                ) : (
                    <div className="lumiverse-council-add-buttons">
                        <button
                            className="lumiverse-council-add-btn"
                            onClick={() => {
                                if (!councilMode) return;
                                setIsAddingMember(true);
                            }}
                            disabled={!councilMode}
                            title={councilMode ? 'Add a council member' : 'Enable Council Mode first'}
                            type="button"
                        >
                            <Plus size={16} strokeWidth={2} />
                            <span>Add Member</span>
                        </button>
                        <button
                            className="lumiverse-council-add-btn lumiverse-council-add-btn--secondary"
                            onClick={() => {
                                if (!councilMode) return;
                                setIsAddingPack(true);
                            }}
                            disabled={!councilMode}
                            title={councilMode ? 'Add all Lumias from a pack' : 'Enable Council Mode first'}
                            type="button"
                        >
                            <Package size={16} strokeWidth={2} />
                            <span>Quick Add Pack</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Council members list */}
            <div className="lumiverse-council-members">
                {councilMembers.length === 0 ? (
                    <EmptyState />
                ) : (
                    councilMembers.map((member) => (
                        <CouncilMemberCard
                            key={member.id}
                            member={member}
                            packs={packsObj}
                            onUpdate={handleUpdateMember}
                            onRemove={handleRemoveMember}
                        />
                    ))
                )}
            </div>

            {/* Help text */}
            {councilMembers.length > 0 && (
                <div className="lumiverse-council-help">
                    <p>
                        Council members will each appear with their definition in the <code>{'{{lumiaDef}}'}</code> macro output.
                        Their behaviors and personalities will be grouped per member.
                    </p>
                </div>
            )}
        </div>
    );
}

export default CouncilManager;
