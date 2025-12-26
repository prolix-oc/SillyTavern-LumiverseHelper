import React, { useMemo, forwardRef, useSyncExternalStore } from 'react';
import { useSelections, useLoomSelections, usePacks, useLumiverseStore } from '../../store/LumiverseContext';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { User, FileText, Zap, Heart, Sparkles, Star, X, Layers, Users, ArrowRight, Package } from 'lucide-react';

// Get store for direct state access
const store = useLumiverseStore;

/* global SillyTavern */

/**
 * Helper to get a unique identifier for a trait
 */
function getTraitId(trait) {
    return trait?.id || trait?.itemName || trait?.lumiaDefName || null;
}

/**
 * Check if two traits match by comparing their IDs
 */
function traitsMatch(a, b) {
    if (!a || !b) return false;
    const idA = getTraitId(a);
    const idB = getTraitId(b);
    return idA && idB && idA === idB;
}

/**
 * Get current character info from SillyTavern
 * Re-evaluates when chatChangeCounter changes (on CHAT_CHANGED events)
 */
function useCurrentCharacter() {
    // Subscribe to chat change counter to force re-render when chat changes
    const chatChangeCounter = useSyncExternalStore(
        store.subscribe,
        () => store.getState().chatChangeCounter || 0,
        () => 0
    );

    // useMemo ensures we re-read from SillyTavern when chatChangeCounter changes
    return useMemo(() => {
        if (typeof SillyTavern !== 'undefined') {
            try {
                const context = SillyTavern.getContext();
                if (context?.characters && context?.characterId !== undefined) {
                    const char = context.characters[context.characterId];
                    return {
                        name: char?.name || 'Unknown',
                        avatar: char?.avatar ? `/characters/${encodeURIComponent(char.avatar)}` : null,
                        description: char?.description || '',
                    };
                }
            } catch (e) {
                console.warn('[LumiverseUI] Could not get character:', e);
            }
        }
        return { name: 'No Character', avatar: null, description: '' };
    }, [chatChangeCounter]);
}

/**
 * Trait card component
 * Note: Removed expensive `layout` prop to improve performance on ARM devices.
 * Uses simple opacity animation for add/remove - tab transition handles entrance.
 */
const TraitCard = forwardRef(function TraitCard({ trait, type, isDominant, onRemove }, ref) {
    const typeConfig = {
        definition: { bg: 'rgba(100, 200, 255, 0.15)', border: 'rgba(100, 200, 255, 0.3)', Icon: FileText },
        behavior: { bg: 'rgba(255, 180, 100, 0.15)', border: 'rgba(255, 180, 100, 0.3)', Icon: Zap },
        personality: { bg: 'rgba(200, 100, 255, 0.15)', border: 'rgba(200, 100, 255, 0.3)', Icon: Heart },
    };

    const config = typeConfig[type] || typeConfig.definition;
    const { Icon } = config;

    return (
        <motion.div
            ref={ref}
            className={clsx('lumiverse-trait-card', isDominant && 'lumiverse-trait-card--dominant')}
            style={{ background: config.bg, borderColor: config.border }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
        >
            <span className="lumiverse-trait-icon">
                <Icon size={16} strokeWidth={1.5} />
            </span>
            <div className="lumiverse-trait-info">
                <span className="lumiverse-trait-name">
                    {trait.name || trait.itemName || trait.lumiaDefName || 'Unknown'}
                </span>
                {isDominant && (
                    <span className="lumiverse-trait-dominant-badge">
                        <Star size={12} strokeWidth={2} /> Dominant
                    </span>
                )}
            </div>
            {onRemove && (
                <button
                    className="lumiverse-trait-remove"
                    onClick={() => onRemove(trait)}
                    title="Remove trait"
                    type="button"
                >
                    <X size={14} strokeWidth={2} />
                </button>
            )}
        </motion.div>
    );
});

/**
 * Section header
 */
function SectionHeader({ Icon, title, count }) {
    return (
        <div className="lumiverse-profile-section-header">
            <span className="lumiverse-profile-section-icon">
                <Icon size={16} strokeWidth={1.5} />
            </span>
            <span className="lumiverse-profile-section-title">{title}</span>
            {count !== undefined && (
                <span className="lumiverse-profile-section-count">{count}</span>
            )}
        </div>
    );
}

/**
 * Empty state for sections
 */
function EmptySection({ message }) {
    return (
        <div className="lumiverse-profile-empty">
            <span>{message}</span>
        </div>
    );
}

/**
 * Get Lumia image URL from pack data
 */
function getLumiaImage(packs, packName, itemName) {
    const packsArray = Array.isArray(packs) ? packs : Object.values(packs || {});
    const pack = packsArray.find(p => p.name === packName);
    if (!pack) return null;
    const item = pack.items?.find(i => i.lumiaDefName === itemName);
    return item?.lumia_img || null;
}

/**
 * Council Mode Banner - replaces normal trait display when Council is active
 */
function CouncilBanner({ councilMembers, allPacks, onManageCouncil }) {
    const memberCount = councilMembers.length;

    // Get behavior and personality counts across all members
    const totalBehaviors = councilMembers.reduce((sum, m) => sum + (m.behaviors?.length || 0), 0);
    const totalPersonalities = councilMembers.reduce((sum, m) => sum + (m.personalities?.length || 0), 0);

    // Get first few member avatars for preview
    const previewMembers = councilMembers.slice(0, 4);
    const moreCount = memberCount - 4;

    return (
        <div className="lumiverse-council-banner">
            <div className="lumiverse-council-banner-icon">
                <Users size={28} strokeWidth={1.5} />
            </div>
            <div className="lumiverse-council-banner-content">
                <h4 className="lumiverse-council-banner-title">Council of Lumiae Active</h4>
                <div className="lumiverse-council-banner-stats">
                    <span className="lumiverse-council-banner-stat">
                        <Users size={14} /> {memberCount} member{memberCount !== 1 ? 's' : ''}
                    </span>
                    <span className="lumiverse-council-banner-stat">
                        <Zap size={14} /> {totalBehaviors} behavior{totalBehaviors !== 1 ? 's' : ''}
                    </span>
                    <span className="lumiverse-council-banner-stat">
                        <Heart size={14} /> {totalPersonalities} personalit{totalPersonalities !== 1 ? 'ies' : 'y'}
                    </span>
                </div>
                {previewMembers.length > 0 && (
                    <div className="lumiverse-council-banner-avatars">
                        {previewMembers.map((member, index) => {
                            const img = getLumiaImage(allPacks, member.packName, member.itemName);
                            return (
                                <div
                                    key={member.id}
                                    className="lumiverse-council-banner-avatar"
                                    style={{ zIndex: previewMembers.length - index }}
                                    title={member.itemName}
                                >
                                    {img ? (
                                        <img src={img} alt={member.itemName} />
                                    ) : (
                                        <Users size={14} />
                                    )}
                                </div>
                            );
                        })}
                        {moreCount > 0 && (
                            <div className="lumiverse-council-banner-more">+{moreCount}</div>
                        )}
                    </div>
                )}
            </div>
            {onManageCouncil && (
                <button
                    className="lumiverse-council-banner-btn"
                    onClick={onManageCouncil}
                    type="button"
                >
                    Manage Council <ArrowRight size={16} />
                </button>
            )}
        </div>
    );
}

/**
 * Loom selections display - uses useLoomSelections hook for proper data separation
 */
function LoomSection() {
    const loomSelections = useLoomSelections();
    const { styles, utilities, retrofits } = loomSelections;

    const hasSelections = styles.length > 0 || utilities.length > 0 || retrofits.length > 0;

    if (!hasSelections) {
        return (
            <div className="lumiverse-profile-section">
                <SectionHeader Icon={Sparkles} title="Loom Configuration" />
                <EmptySection message="No Loom items selected" />
            </div>
        );
    }

    return (
        <div className="lumiverse-profile-section">
            <SectionHeader Icon={Sparkles} title="Loom Configuration" />
            <div className="lumiverse-loom-summary">
                {styles.length > 0 && (
                    <div className="lumiverse-loom-group">
                        <span className="lumiverse-loom-label">Styles:</span>
                        <span className="lumiverse-loom-items">
                            {styles.map(s => s.name || s.itemName || 'Unknown').join(', ')}
                        </span>
                    </div>
                )}
                {utilities.length > 0 && (
                    <div className="lumiverse-loom-group">
                        <span className="lumiverse-loom-label">Utilities:</span>
                        <span className="lumiverse-loom-items">
                            {utilities.map(u => u.name || u.itemName || 'Unknown').join(', ')}
                        </span>
                    </div>
                )}
                {retrofits.length > 0 && (
                    <div className="lumiverse-loom-group">
                        <span className="lumiverse-loom-label">Retrofits:</span>
                        <span className="lumiverse-loom-items">
                            {retrofits.map(r => r.name || r.itemName || 'Unknown').join(', ')}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Character Lumia Profile component
 * Shows all Lumia traits assigned to the current character
 * @param {Object} props
 * @param {function} props.onTabChange - Callback to change tabs (e.g., to Council tab)
 */
function CharacterProfile({ onTabChange }) {
    const character = useCurrentCharacter();
    const selections = useSelections();
    const { allPacks } = usePacks();

    // Subscribe to Chimera mode state
    const chimeraMode = useSyncExternalStore(
        store.subscribe,
        () => store.getState().chimeraMode || false,
        () => store.getState().chimeraMode || false
    );
    const selectedDefinitions = useSyncExternalStore(
        store.subscribe,
        () => store.getState().selectedDefinitions || [],
        () => store.getState().selectedDefinitions || []
    );

    // Subscribe to Council mode state
    const councilMode = useSyncExternalStore(
        store.subscribe,
        () => store.getState().councilMode || false,
        () => store.getState().councilMode || false
    );
    const councilMembers = useSyncExternalStore(
        store.subscribe,
        () => store.getState().councilMembers || [],
        () => store.getState().councilMembers || []
    );

    // Check if council mode is active with members
    const isCouncilActive = councilMode && councilMembers.length > 0;

    // Count stats
    const definitionCount = chimeraMode
        ? selectedDefinitions.length
        : (selections.definition ? 1 : 0);

    const stats = useMemo(() => ({
        behaviors: selections.behaviors?.length || 0,
        personalities: selections.personalities?.length || 0,
        hasDefinition: !!selections.definition,
        definitionCount: definitionCount,
        totalPacks: allPacks.length,
    }), [selections, allPacks, definitionCount]);

    // Handle navigate to council tab
    const handleManageCouncil = () => {
        if (onTabChange) {
            onTabChange('council');
        }
    };

    return (
        <div className="lumiverse-character-profile">
            {/* Character Header */}
            <div className="lumiverse-profile-header">
                <div className="lumiverse-profile-avatar">
                    {character.avatar ? (
                        <img src={character.avatar} alt={character.name} />
                    ) : (
                        <span className="lumiverse-profile-avatar-placeholder">
                            <User size={32} strokeWidth={1.5} />
                        </span>
                    )}
                </div>
                <div className="lumiverse-profile-info">
                    <h3 className="lumiverse-profile-name">{character.name}</h3>
                    <div className="lumiverse-profile-stats">
                        <span className="lumiverse-stat" title="Behaviors">
                            <Zap size={14} strokeWidth={1.5} className="lumiverse-stat-icon" />
                            <span className="lumiverse-stat-value">{stats.behaviors}</span>
                        </span>
                        <span className="lumiverse-stat" title="Personalities">
                            <Heart size={14} strokeWidth={1.5} className="lumiverse-stat-icon" />
                            <span className="lumiverse-stat-value">{stats.personalities}</span>
                        </span>
                        <span className="lumiverse-stat" title="Packs">
                            <Package size={14} strokeWidth={1.5} className="lumiverse-stat-icon" />
                            <span className="lumiverse-stat-value">{stats.totalPacks}</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Council Mode Banner - replaces trait sections when active */}
            {isCouncilActive ? (
                <CouncilBanner
                    councilMembers={councilMembers}
                    allPacks={allPacks}
                    onManageCouncil={handleManageCouncil}
                />
            ) : (
                <>
                    {/* Definition Section */}
                    <div className="lumiverse-profile-section">
                        <SectionHeader
                            Icon={chimeraMode ? Layers : FileText}
                            title={chimeraMode ? "Chimera Definitions" : "Definition"}
                            count={stats.definitionCount}
                        />
                        {/* Removed mode="popLayout" for better ARM performance */}
                        <div className="lumiverse-traits-list">
                            <AnimatePresence initial={false}>
                                {chimeraMode ? (
                                    // Chimera mode: show multiple definitions
                                    selectedDefinitions.length > 0 ? (
                                        selectedDefinitions.map((def, index) => (
                                            <TraitCard
                                                key={getTraitId(def) || `def-${index}`}
                                                trait={def}
                                                type="definition"
                                            />
                                        ))
                                    ) : (
                                        <EmptySection message="No Chimera forms selected" />
                                    )
                                ) : (
                                    // Normal mode: single definition
                                    selections.definition ? (
                                        <TraitCard
                                            key={getTraitId(selections.definition) || 'def'}
                                            trait={selections.definition}
                                            type="definition"
                                        />
                                    ) : (
                                        <EmptySection message="No definition selected" />
                                    )
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Behaviors Section */}
                    <div className="lumiverse-profile-section">
                        <SectionHeader Icon={Zap} title="Behaviors" count={stats.behaviors} />
                        <div className="lumiverse-traits-list">
                            {/* Removed mode="popLayout" for better ARM performance */}
                            <AnimatePresence initial={false}>
                                {selections.behaviors?.length > 0 ? (
                                    selections.behaviors.map(behavior => (
                                        <TraitCard
                                            key={getTraitId(behavior)}
                                            trait={behavior}
                                            type="behavior"
                                            isDominant={traitsMatch(selections.dominantBehavior, behavior)}
                                        />
                                    ))
                                ) : (
                                    <EmptySection message="No behaviors selected" />
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Personalities Section */}
                    <div className="lumiverse-profile-section">
                        <SectionHeader Icon={Heart} title="Personalities" count={stats.personalities} />
                        <div className="lumiverse-traits-list">
                            {/* Removed mode="popLayout" for better ARM performance */}
                            <AnimatePresence initial={false}>
                                {selections.personalities?.length > 0 ? (
                                    selections.personalities.map(personality => (
                                        <TraitCard
                                            key={getTraitId(personality)}
                                            trait={personality}
                                            type="personality"
                                            isDominant={traitsMatch(selections.dominantPersonality, personality)}
                                        />
                                    ))
                                ) : (
                                    <EmptySection message="No personalities selected" />
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </>
            )}

            {/* Loom Section */}
            <LoomSection />
        </div>
    );
}

export default CharacterProfile;
