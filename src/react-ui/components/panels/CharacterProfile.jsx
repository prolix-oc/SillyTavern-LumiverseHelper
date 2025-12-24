import React, { useMemo, forwardRef } from 'react';
import { useSelections, useLoomSelections, usePacks } from '../../store/LumiverseContext';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { User, FileText, Zap, Heart, Sparkles, Star, X } from 'lucide-react';

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
 */
function useCurrentCharacter() {
    // This would ideally subscribe to ST events, but for now we'll read on render
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
}

/**
 * Trait card component
 * Note: Removed expensive `layout` prop to improve performance on ARM devices.
 * Using simple opacity/scale animations instead of layout animations.
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
            transition={{ duration: 0.15 }}
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
 */
function CharacterProfile() {
    const character = useCurrentCharacter();
    const selections = useSelections();
    const { allPacks } = usePacks();

    // Count stats
    const stats = useMemo(() => ({
        behaviors: selections.behaviors?.length || 0,
        personalities: selections.personalities?.length || 0,
        hasDefinition: !!selections.definition,
        totalPacks: allPacks.length,
    }), [selections, allPacks]);

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
                        <span className="lumiverse-stat">
                            <span className="lumiverse-stat-value">{stats.behaviors}</span>
                            <span className="lumiverse-stat-label">Behaviors</span>
                        </span>
                        <span className="lumiverse-stat">
                            <span className="lumiverse-stat-value">{stats.personalities}</span>
                            <span className="lumiverse-stat-label">Personalities</span>
                        </span>
                        <span className="lumiverse-stat">
                            <span className="lumiverse-stat-value">{stats.totalPacks}</span>
                            <span className="lumiverse-stat-label">Packs</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Definition Section */}
            <div className="lumiverse-profile-section">
                <SectionHeader Icon={FileText} title="Definition" count={stats.hasDefinition ? 1 : 0} />
                {/* Removed mode="popLayout" for better ARM performance */}
                <AnimatePresence>
                    {selections.definition ? (
                        <TraitCard
                            key={getTraitId(selections.definition) || 'def'}
                            trait={selections.definition}
                            type="definition"
                        />
                    ) : (
                        <EmptySection message="No definition selected" />
                    )}
                </AnimatePresence>
            </div>

            {/* Behaviors Section */}
            <div className="lumiverse-profile-section">
                <SectionHeader Icon={Zap} title="Behaviors" count={stats.behaviors} />
                <div className="lumiverse-traits-list">
                    {/* Removed mode="popLayout" for better ARM performance */}
                    <AnimatePresence>
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
                    <AnimatePresence>
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

            {/* Loom Section */}
            <LoomSection />
        </div>
    );
}

export default CharacterProfile;
