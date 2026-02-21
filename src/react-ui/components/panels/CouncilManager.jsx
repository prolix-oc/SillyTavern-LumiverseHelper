import React, { useState, useMemo, useSyncExternalStore, useCallback, useRef } from 'react';
import clsx from 'clsx';
import { Users, Plus, Trash2, ChevronDown, ChevronUp, Edit2, X, Check, Zap, Heart, Star, Package, Briefcase, Cpu, Eye, EyeOff, Radio, Plug, BookOpen } from 'lucide-react';
import { useLumiverseStore, useLumiverseActions, usePacks, saveToExtension, saveToExtensionImmediate } from '../../store/LumiverseContext';
import { getToolsForUI, isInlineModeAvailable } from '../../../lib/councilTools';

// Provider configurations for council tools LLM
const COUNCIL_PROVIDER_CONFIG = {
    openai: { name: 'OpenAI', placeholder: 'gpt-4o-mini' },
    anthropic: { name: 'Anthropic', placeholder: 'claude-sonnet-4-5-20250929' },
    google: { name: 'Google AI', placeholder: 'gemini-2.0-flash' },
    openrouter: { name: 'OpenRouter', placeholder: 'openai/gpt-4o-mini' },
    chutes: { name: 'Chutes', placeholder: 'deepseek-ai/DeepSeek-V3' },
    electronhub: { name: 'ElectronHub', placeholder: 'gpt-4o-mini' },
    nanogpt: { name: 'NanoGPT', placeholder: 'chatgpt-4o-latest' },
    zai: { name: 'Z.AI', placeholder: 'gpt-4o-mini' },
    custom: { name: 'Custom', placeholder: 'your-model-id' },
};

/* global toastr */

// Get store for direct state access
const store = useLumiverseStore;

// Stable fallback constants for useSyncExternalStore
const EMPTY_ARRAY = [];

/**
 * Create mobile-safe tap handlers that work on all browsers including Samsung Internet.
 * Uses touch tracking to differentiate between taps and scroll gestures.
 * Only fires the handler for stationary taps, allowing scrolling to work normally.
 * 
 * @param {Function} handler - The function to call on tap/click
 * @returns {Object} Props to spread onto the element: { onClick, onTouchStart, onTouchEnd }
 */
function useMobileTapHandler(handler) {
    const touchedRef = useRef(false);
    const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
    
    // Track touch start position
    const handleTouchStart = useCallback((e) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            touchStartRef.current = {
                x: touch.clientX,
                y: touch.clientY,
                time: Date.now(),
            };
        }
    }, []);
    
    const handleTouchEnd = useCallback((e) => {
        // Calculate movement distance
        if (e.changedTouches.length === 1) {
            const touch = e.changedTouches[0];
            const dx = Math.abs(touch.clientX - touchStartRef.current.x);
            const dy = Math.abs(touch.clientY - touchStartRef.current.y);
            const dt = Date.now() - touchStartRef.current.time;
            
            // Only trigger if it was a tap (small movement, short duration)
            // Allow 10px tolerance for finger wobble, 500ms max tap duration
            const isTap = dx < 10 && dy < 10 && dt < 500;
            
            if (isTap) {
                e.preventDefault();
                e.stopPropagation();
                touchedRef.current = true;
                handler(e);
                // Reset after a short delay to allow for subsequent interactions
                setTimeout(() => { touchedRef.current = false; }, 300);
            }
            // If not a tap (was a scroll), do nothing - let the scroll happen
        }
    }, [handler]);
    
    const handleClick = useCallback((e) => {
        e.stopPropagation();
        // Only fire if this wasn't triggered by a touch event
        if (!touchedRef.current) {
            handler(e);
        }
    }, [handler]);
    
    return { onClick: handleClick, onTouchStart: handleTouchStart, onTouchEnd: handleTouchEnd };
}

// Stable selector functions
const selectCouncilMode = () => store.getState().councilMode || false;
const selectCouncilMembers = () => store.getState().councilMembers || EMPTY_ARRAY;
const selectCouncilTools = () => store.getState().councilTools || { enabled: false, timeoutMs: 30000 };

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
 * Tool selector dropdown
 */
function ToolSelector({ selectedTools, onToggle, onClose }) {
    const tools = useMemo(() => getToolsForUI(), []);

    return (
        <div className="lumiverse-council-tool-selector">
            <div className="lumiverse-council-tool-header">
                <span>Assign Tools</span>
                <button className="lumiverse-council-btn" onClick={onClose} type="button">
                    <X size={14} />
                </button>
            </div>
            <div className="lumiverse-council-tool-list">
                {tools.map((tool) => (
                    <label key={tool.name} className="lumiverse-council-tool-item">
                        <input
                            type="checkbox"
                            checked={selectedTools.includes(tool.name)}
                            onChange={() => onToggle(tool.name)}
                        />
                        <div className="lumiverse-council-tool-info">
                            <span className="lumiverse-council-tool-name">{tool.displayName}</span>
                            <span className="lumiverse-council-tool-desc">{tool.description}</span>
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );
}

/**
 * Collapsible member card
 */
function CouncilMemberCard({ member, packs, onUpdate, onRemove }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditingRole, setIsEditingRole] = useState(false);
    const [showToolSelector, setShowToolSelector] = useState(false);
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

    const handleToolToggle = (toolName) => {
        const currentTools = member.tools || [];
        const newTools = currentTools.includes(toolName)
            ? currentTools.filter(t => t !== toolName)
            : [...currentTools, toolName];
        onUpdate(member.id, { tools: newTools });
    };

    const behaviorsCount = member.behaviors?.length || 0;
    const personalitiesCount = member.personalities?.length || 0;
    const toolsCount = member.tools?.length || 0;

    return (
        <div className="lumiverse-council-member">
            <div className="lumiverse-council-member-header" onPointerUp={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsExpanded(!isExpanded);
            }}>
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
                        {toolsCount > 0 && (
                            <span className="lumiverse-council-stat lumiverse-council-stat--tools">
                                <Briefcase size={12} /> {toolsCount}
                            </span>
                        )}
                    </div>
                </div>
                <div className="lumiverse-council-member-actions">
                    <button
                        className="lumiverse-council-btn"
                        onPointerUp={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
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
                        onPointerUp={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
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
                                    onPointerUp={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleRoleSave();
                                    }}
                                    type="button"
                                >
                                    <Check size={14} strokeWidth={2} />
                                </button>
                                <button
                                    className="lumiverse-council-btn"
                                    onPointerUp={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
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

                    {/* Tools section */}
                    <div className="lumiverse-council-tools-section">
                        <div className="lumiverse-council-tools-header">
                            <span className="lumiverse-council-tools-label">
                                <Briefcase size={14} strokeWidth={1.5} /> Tools:
                            </span>
                            <button
                                className="lumiverse-council-btn lumiverse-council-btn--small"
                                onClick={() => setShowToolSelector(!showToolSelector)}
                                type="button"
                            >
                                {showToolSelector ? 'Done' : 'Assign Tools'}
                            </button>
                        </div>
                        {showToolSelector ? (
                            <ToolSelector
                                selectedTools={member.tools || []}
                                onToggle={handleToolToggle}
                                onClose={() => setShowToolSelector(false)}
                            />
                        ) : toolsCount > 0 ? (
                            <div className="lumiverse-council-tools-list">
                                {(member.tools || []).map(toolName => {
                                    const toolInfo = getToolsForUI().find(t => t.name === toolName);
                                    return (
                                        <span key={toolName} className="lumiverse-council-tool-tag">
                                            {toolInfo?.displayName || toolName}
                                        </span>
                                    );
                                })}
                            </div>
                        ) : (
                            <span className="lumiverse-council-tools-empty">
                                No tools assigned. Tools allow this member to contribute suggestions before generation.
                            </span>
                        )}
                    </div>

                    <p className="lumiverse-council-help-text">
                        Each member's inherent traits are auto-attached when added.
                        Use the role field to define their expertise, which enhances tool contributions.
                    </p>
                </div>
            )}
        </div>
    );
}

/**
 * Individual item - uses mobile-safe tap handler for Samsung compatibility
 */
function AddMemberItem({ item, onSelect }) {
    const handleTap = useCallback(() => {
        onSelect(item);
    }, [item, onSelect]);
    
    const tapProps = useMobileTapHandler(handleTap);
    
    return (
        <div
            className="lumiverse-council-add-item"
            {...tapProps}
            role="button"
            tabIndex={0}
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
                    availableItems.map((item) => (
                        <AddMemberItem
                            key={`${item.packName}:${item.itemName}`}
                            item={item}
                            onSelect={handleItemSelect}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

/**
 * Individual pack item - uses mobile-safe tap handler for Samsung compatibility
 */
function AddPackItem({ pack, onSelect }) {
    const handleTap = useCallback(() => {
        onSelect(pack.packName);
    }, [pack.packName, onSelect]);
    
    const tapProps = useMobileTapHandler(handleTap);
    
    return (
        <div
            className="lumiverse-council-add-item lumiverse-council-pack-item"
            {...tapProps}
            role="button"
            tabIndex={0}
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
                        <AddPackItem
                            key={pack.packName}
                            pack={pack}
                            onSelect={handlePackSelect}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

/**
 * Council Tools LLM Configuration panel
 * Provides provider/model/params selection dedicated to council tool execution
 */
function CouncilToolsConfig() {
    const [showApiKey, setShowApiKey] = useState(false);
    const actions = useLumiverseActions();

    const councilTools = useSyncExternalStore(
        store.subscribe,
        selectCouncilTools,
        selectCouncilTools
    );

    const llm = councilTools.llm || {};
    const mode = councilTools.mode || 'sidecar';
    const sidecarContextWindow = councilTools.sidecarContextWindow ?? 25;
    const inlineAvailable = useMemo(() => isInlineModeAvailable(), []);

    const updateLLM = useCallback((updates) => {
        actions.updateCouncilToolsLLM(updates);
        saveToExtension();
    }, [actions]);

    const handleModeChange = useCallback((newMode) => {
        actions.setCouncilToolsMode(newMode);
        saveToExtension();
    }, [actions]);

    const handleContextWindowChange = useCallback((value) => {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue) && numValue >= 5 && numValue <= 100) {
            actions.setSidecarContextWindow(numValue);
            saveToExtension();
        }
    }, [actions]);

    const handleToggleUserPersona = useCallback((checked) => {
        actions.setCouncilToolsIncludeUserPersona(checked);
        saveToExtension();
    }, [actions]);

    const handleToggleCharacterInfo = useCallback((checked) => {
        actions.setCouncilToolsIncludeCharacterInfo(checked);
        saveToExtension();
    }, [actions]);

    const handleToggleWorldInfo = useCallback((checked) => {
        actions.setCouncilToolsIncludeWorldInfo(checked);
        saveToExtension();
    }, [actions]);

    const handleToggleAllowUserControl = useCallback((checked) => {
        actions.setCouncilToolsAllowUserControl(checked);
        saveToExtension();
    }, [actions]);

    const providerConfig = COUNCIL_PROVIDER_CONFIG[llm.provider] || COUNCIL_PROVIDER_CONFIG.custom;
    const isCustom = llm.provider === 'custom';

    return (
        <div className="lumiverse-council-llm-config">
            {/* Mode selector: Sidecar vs Inline */}
            <div className="lumiverse-council-tools-mode">
                <div className="lumiverse-council-llm-header">
                    <Radio size={14} strokeWidth={1.5} />
                    <span>Execution Mode</span>
                </div>
                <div className="lumiverse-council-mode-selector">
                    <button
                        type="button"
                        className={clsx(
                            'lumiverse-council-mode-option',
                            mode === 'sidecar' && 'lumiverse-council-mode-option--active'
                        )}
                        onClick={() => handleModeChange('sidecar')}
                    >
                        <Cpu size={13} strokeWidth={1.5} />
                        <span>Sidecar</span>
                    </button>
                    <button
                        type="button"
                        className={clsx(
                            'lumiverse-council-mode-option',
                            mode === 'inline' && 'lumiverse-council-mode-option--active',
                            !inlineAvailable && 'lumiverse-council-mode-option--disabled'
                        )}
                        onClick={() => inlineAvailable && handleModeChange('inline')}
                        title={!inlineAvailable ? 'Requires function calling enabled in SillyTavern API settings' : ''}
                    >
                        <Plug size={13} strokeWidth={1.5} />
                        <span>Inline</span>
                    </button>
                </div>
                <p className="lumiverse-council-mode-desc-text">
                    {mode === 'sidecar'
                        ? 'Dedicated LLM executes tools in parallel before generation. Independent model, no ST function calling required.'
                        : 'Tools registered with SillyTavern\'s ToolManager. Main model decides when to invoke tools during generation.'
                    }
                </p>
                {mode === 'inline' && !inlineAvailable && (
                    <p className="lumiverse-council-mode-warning">
                        Function calling is not enabled. Enable it in SillyTavern API settings or switch to Sidecar mode.
                    </p>
                )}
            </div>

            {/* Sidecar Context Window — only shown in sidecar mode */}
            {mode === 'sidecar' && (
                <div className="lumiverse-council-llm-field lumiverse-council-context-window-field">
                    <label className="lumiverse-council-llm-label">Context Window (messages)</label>
                    <input
                        type="number"
                        className="lumiverse-council-llm-input lumiverse-council-llm-input--num"
                        value={sidecarContextWindow}
                        onChange={(e) => handleContextWindowChange(e.target.value)}
                        min={5}
                        max={100}
                        step={1}
                    />
                    <span className="lumiverse-council-llm-hint">Number of recent chat messages to include in council tool context (5-100)</span>
                </div>
            )}

            {/* Context Enrichment — only shown in sidecar mode */}
            {mode === 'sidecar' && (
                <div className="lumiverse-council-enrichment-section">
                    <div className="lumiverse-council-llm-header">
                        <BookOpen size={14} strokeWidth={1.5} />
                        <span>Context Enrichment</span>
                    </div>
                    <span className="lumiverse-council-llm-hint">
                        Embed additional context into sidecar tool prompts. Increases token usage per tool call.
                    </span>
                    <label className="lumiverse-council-enrichment-toggle">
                        <input
                            type="checkbox"
                            checked={councilTools.includeUserPersona || false}
                            onChange={(e) => handleToggleUserPersona(e.target.checked)}
                        />
                        <span>User Persona</span>
                    </label>
                    <label className="lumiverse-council-enrichment-toggle">
                        <input
                            type="checkbox"
                            checked={councilTools.includeCharacterInfo || false}
                            onChange={(e) => handleToggleCharacterInfo(e.target.checked)}
                        />
                        <span>Character Description &amp; Personality</span>
                    </label>
                    <label className="lumiverse-council-enrichment-toggle">
                        <input
                            type="checkbox"
                            checked={councilTools.includeWorldInfo || false}
                            onChange={(e) => handleToggleWorldInfo(e.target.checked)}
                        />
                        <span>Active World Book Entries</span>
                    </label>
                </div>
            )}

            {/* Allow User Control — applies to both sidecar and inline modes */}
            <div className="lumiverse-council-enrichment-section">
                <label className="lumiverse-council-enrichment-toggle">
                    <input
                        type="checkbox"
                        checked={councilTools.allowUserControl || false}
                        onChange={(e) => handleToggleAllowUserControl(e.target.checked)}
                    />
                    <span>Allow User Control</span>
                </label>
                <span className="lumiverse-council-llm-hint">
                    When enabled, tools can plan and speak for your character. When disabled, tools focus only on NPCs reacting to your input.
                </span>
            </div>

            {/* Sidecar LLM config — only shown in sidecar mode */}
            {mode === 'sidecar' && (
                <>
                    <div className="lumiverse-council-llm-header">
                        <Cpu size={14} strokeWidth={1.5} />
                        <span>Tools Model</span>
                    </div>

                    {/* Provider */}
                    <div className="lumiverse-council-llm-field">
                        <label className="lumiverse-council-llm-label">Provider</label>
                        <select
                            className="lumiverse-council-llm-select"
                            value={llm.provider || 'anthropic'}
                            onChange={(e) => updateLLM({ provider: e.target.value })}
                        >
                            {Object.entries(COUNCIL_PROVIDER_CONFIG).map(([key, config]) => (
                                <option key={key} value={key}>{config.name}</option>
                            ))}
                        </select>
                        {!isCustom && (
                            <span className="lumiverse-council-llm-hint">Uses API key from SillyTavern settings</span>
                        )}
                    </div>

                    {/* Model */}
                    <div className="lumiverse-council-llm-field">
                        <label className="lumiverse-council-llm-label">Model</label>
                        <input
                            type="text"
                            className="lumiverse-council-llm-input"
                            placeholder={providerConfig.placeholder}
                            value={llm.model || ''}
                            onChange={(e) => updateLLM({ model: e.target.value })}
                        />
                    </div>

                    {/* Custom endpoint + API key */}
                    {isCustom && (
                        <>
                            <div className="lumiverse-council-llm-field">
                                <label className="lumiverse-council-llm-label">Endpoint</label>
                                <input
                                    type="text"
                                    className="lumiverse-council-llm-input"
                                    placeholder="https://your-api.com/v1/chat/completions"
                                    value={llm.endpoint || ''}
                                    onChange={(e) => updateLLM({ endpoint: e.target.value })}
                                />
                            </div>
                            <div className="lumiverse-council-llm-field">
                                <label className="lumiverse-council-llm-label">API Key</label>
                                <div className="lumiverse-council-llm-password-row">
                                    <input
                                        type={showApiKey ? 'text' : 'password'}
                                        className="lumiverse-council-llm-input"
                                        placeholder="Your API key"
                                        value={llm.apiKey || ''}
                                        onChange={(e) => updateLLM({ apiKey: e.target.value })}
                                    />
                                    <button
                                        className="lumiverse-council-btn"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        title={showApiKey ? 'Hide' : 'Show'}
                                        type="button"
                                    >
                                        {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Temperature / Top-P / Max Tokens */}
                    <div className="lumiverse-council-llm-params">
                        <div className="lumiverse-council-llm-param">
                            <label className="lumiverse-council-llm-label">Temp</label>
                            <input
                                type="number"
                                className="lumiverse-council-llm-input lumiverse-council-llm-input--num"
                                value={llm.temperature ?? 0.7}
                                onChange={(e) => updateLLM({ temperature: parseFloat(e.target.value) || 0 })}
                                min={0}
                                max={2}
                                step={0.1}
                            />
                        </div>
                        <div className="lumiverse-council-llm-param">
                            <label className="lumiverse-council-llm-label">Top-P</label>
                            <input
                                type="number"
                                className="lumiverse-council-llm-input lumiverse-council-llm-input--num"
                                value={llm.topP ?? 1.0}
                                onChange={(e) => updateLLM({ topP: parseFloat(e.target.value) || 0 })}
                                min={0}
                                max={1}
                                step={0.05}
                            />
                        </div>
                        <div className="lumiverse-council-llm-param">
                            <label className="lumiverse-council-llm-label">Max Tokens</label>
                            <input
                                type="number"
                                className="lumiverse-council-llm-input lumiverse-council-llm-input--num"
                                value={llm.maxTokens || 4096}
                                onChange={(e) => updateLLM({ maxTokens: parseInt(e.target.value, 10) || 4096 })}
                                min={256}
                                max={128000}
                            />
                        </div>
                    </div>
                </>
            )}

            {/* Inline mode info */}
            {mode === 'inline' && (
                <div className="lumiverse-council-inline-info">
                    <p>Tools use the main model configured in SillyTavern. The model decides when and how to invoke council tools based on their descriptions.</p>
                </div>
            )}
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
    const councilTools = useSyncExternalStore(
        store.subscribe,
        selectCouncilTools,
        selectCouncilTools
    );

    const handleAddMember = useCallback((member) => {
        actions.addCouncilMember(member);
        // Use immediate save for member changes - critical state
        saveToExtensionImmediate();
    }, [actions]);

    const handleAddPack = useCallback((packName) => {
        const addedCount = actions.addCouncilMembersFromPack(packName);
        // Use immediate save for member changes - critical state
        saveToExtensionImmediate();
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
        // Use immediate save for member changes - critical state
        saveToExtensionImmediate();
    }, [actions]);

    const handleToggleCouncilMode = useCallback((enabled) => {
        actions.setCouncilMode(enabled);
        // Use immediate save for mode toggle - critical state
        saveToExtensionImmediate();
    }, [actions]);

    const handleToggleCouncilTools = useCallback((enabled) => {
        actions.setCouncilToolsEnabled(enabled);
        // Use immediate save for tools toggle - critical state
        saveToExtensionImmediate();
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

            {/* Tools toggle - only show when council mode is active */}
            {councilMode && (
                <div className="lumiverse-council-tools-toggle">
                    <label className="lumiverse-council-mode-toggle lumiverse-council-tools-label">
                        <input
                            type="checkbox"
                            checked={councilTools.enabled}
                            onChange={(e) => handleToggleCouncilTools(e.target.checked)}
                        />
                        <span className={clsx('lumiverse-council-mode-switch', councilTools.enabled && 'lumiverse-council-mode-switch--on')}>
                            <span className="lumiverse-council-mode-thumb" />
                        </span>
                        <span className="lumiverse-council-mode-label">
                            <Briefcase size={14} /> Council Tools {councilTools.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                    </label>
                    <p className="lumiverse-council-tools-desc">
                        When enabled, council members with assigned tools contribute suggestions via their chosen execution mode.
                        Use the {'{{lumiaCouncilDeliberation}}'} macro to include their contributions in the prompt.
                    </p>
                    {councilTools.enabled && <CouncilToolsConfig />}
                </div>
            )}

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
                            onClick={() => councilMode && setIsAddingMember(true)}
                            disabled={!councilMode}
                            title={councilMode ? 'Add a council member' : 'Enable Council Mode first'}
                            type="button"
                        >
                            <Plus size={16} strokeWidth={2} />
                            <span>Add Member</span>
                        </button>
                        <button
                            className="lumiverse-council-add-btn lumiverse-council-add-btn--secondary"
                            onClick={() => councilMode && setIsAddingPack(true)}
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
