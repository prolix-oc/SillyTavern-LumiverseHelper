import React, { useMemo, useSyncExternalStore, useState, useCallback } from 'react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart2, CheckCircle, XCircle, Users, ChevronDown, ChevronUp, Briefcase, Eye, EyeOff } from 'lucide-react';
import { useLumiverseStore, usePacks } from '../../store/LumiverseContext';

// Get store for direct access
const store = useLumiverseStore;

// Stable fallback constants
const EMPTY_ARRAY = [];

// Stable selector for council tool results
const selectCouncilToolResults = () => store.getState().councilToolResults || EMPTY_ARRAY;

/**
 * Find a Lumia item in a pack - supports both new and legacy formats
 */
function findLumiaInPack(pack, itemName) {
    if (!pack) return null;
    if (pack.lumiaItems && pack.lumiaItems.length > 0) {
        return pack.lumiaItems.find(i =>
            i.lumiaName === itemName || i.lumiaDefName === itemName
        );
    }
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
 * Collapsible identity context section showing what was sent to the LLM
 */
function IdentityContext({ identity }) {
    const [isVisible, setIsVisible] = useState(false);

    if (!identity) return null;

    const hasContent = identity.definition || identity.personality || identity.behavior;
    if (!hasContent) return null;

    return (
        <div className="lumiverse-feedback-identity">
            <button
                className="lumiverse-feedback-identity-toggle"
                onClick={() => setIsVisible(prev => !prev)}
                type="button"
            >
                {isVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>Identity Context</span>
                {identity.role && (
                    <span className="lumiverse-feedback-identity-role">{identity.role}</span>
                )}
            </button>
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        className="lumiverse-feedback-identity-content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        style={{ overflow: 'hidden' }}
                    >
                        {identity.definition && (
                            <div className="lumiverse-feedback-identity-field">
                                <span className="lumiverse-feedback-identity-label">Definition</span>
                                <div className="lumiverse-feedback-identity-text">{identity.definition}</div>
                            </div>
                        )}
                        {identity.personality && (
                            <div className="lumiverse-feedback-identity-field">
                                <span className="lumiverse-feedback-identity-label">Personality</span>
                                <div className="lumiverse-feedback-identity-text">{identity.personality}</div>
                            </div>
                        )}
                        {identity.behavior && (
                            <div className="lumiverse-feedback-identity-field">
                                <span className="lumiverse-feedback-identity-label">Behavior</span>
                                <div className="lumiverse-feedback-identity-text">{identity.behavior}</div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/**
 * Individual tool result display
 */
function ToolResult({ result, isLast }) {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleExpanded = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    return (
        <div className={clsx('lumiverse-feedback-tool', isLast && 'lumiverse-feedback-tool--last')}>
            <div className="lumiverse-feedback-tool-header" onClick={toggleExpanded}>
                <Briefcase size={12} strokeWidth={1.5} className="lumiverse-feedback-tool-icon" />
                <span className="lumiverse-feedback-tool-name">{result.toolDisplayName}</span>
                <span className={clsx(
                    'lumiverse-feedback-tool-badge',
                    result.success ? 'lumiverse-feedback-tool-badge--success' : 'lumiverse-feedback-tool-badge--error'
                )}>
                    {result.success ? (
                        <><CheckCircle size={10} /> OK</>
                    ) : (
                        <><XCircle size={10} /> Error</>
                    )}
                </span>
                <span className="lumiverse-feedback-tool-chevron">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
            </div>
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        className="lumiverse-feedback-tool-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        style={{ overflow: 'hidden' }}
                    >
                        {result.success ? (
                            <div className="lumiverse-feedback-tool-response">
                                {result.response || '(No response content)'}
                            </div>
                        ) : (
                            <div className="lumiverse-feedback-tool-error">
                                {result.error || 'Unknown error'}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/**
 * Card for a single council member showing their tool results
 */
function FeedbackMemberCard({ group, packs }) {
    const memberImage = getLumiaImage(packs, group.packName, group.itemName);
    const memberName = getLumiaName(packs, group.packName, group.itemName) || group.memberName;
    const successCount = group.tools.filter(t => t.success).length;
    const totalCount = group.tools.length;

    // Get identity from the first tool result (same for all tools of this member)
    const identity = group.tools[0]?.identity || null;

    return (
        <motion.div
            className="lumiverse-feedback-member"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            layout
        >
            <div className="lumiverse-feedback-member-header">
                <div className="lumiverse-feedback-member-avatar">
                    {memberImage ? (
                        <img src={memberImage} alt={memberName} />
                    ) : (
                        <Users size={20} strokeWidth={1.5} />
                    )}
                </div>
                <div className="lumiverse-feedback-member-info">
                    <span className="lumiverse-feedback-member-name">{memberName}</span>
                    <span className="lumiverse-feedback-member-stats">
                        {successCount}/{totalCount} tools succeeded
                    </span>
                </div>
            </div>
            <IdentityContext identity={identity} />
            <div className="lumiverse-feedback-member-tools">
                {group.tools.map((result, idx) => (
                    <ToolResult
                        key={`${result.toolName}-${idx}`}
                        result={result}
                        isLast={idx === group.tools.length - 1}
                    />
                ))}
            </div>
        </motion.div>
    );
}

/**
 * Empty state when no tool results are available
 */
function EmptyFeedbackState() {
    return (
        <div className="lumiverse-feedback-empty">
            <span className="lumiverse-feedback-empty-icon">
                <BarChart2 size={36} strokeWidth={1.5} />
            </span>
            <h4>No feedback yet</h4>
            <p>Council tool results will appear here after the next generation. Make sure council tools are enabled and members have tools assigned.</p>
        </div>
    );
}

/**
 * Main Feedback Panel component
 * Displays council tool results grouped by member, streaming in as they arrive
 */
function FeedbackPanel() {
    const toolResults = useSyncExternalStore(
        store.subscribe,
        selectCouncilToolResults,
        selectCouncilToolResults
    );
    const { allPacks } = usePacks();

    // Group results by member
    const groupedResults = useMemo(() => {
        const groups = {};
        for (const result of toolResults) {
            const key = `${result.packName}:${result.itemName || result.memberName}`;
            if (!groups[key]) {
                groups[key] = {
                    memberName: result.memberName,
                    packName: result.packName,
                    itemName: result.itemName,
                    tools: [],
                };
            }
            groups[key].tools.push(result);
        }
        return Object.values(groups);
    }, [toolResults]);

    if (toolResults.length === 0) {
        return <EmptyFeedbackState />;
    }

    return (
        <div className="lumiverse-feedback-panel">
            <motion.div
                className="lumiverse-feedback-summary"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
            >
                <span className="lumiverse-feedback-count">
                    {toolResults.filter(r => r.success).length}/{toolResults.length} tools succeeded
                </span>
            </motion.div>
            <div className="lumiverse-feedback-members">
                <AnimatePresence initial={false}>
                    {groupedResults.map((group) => (
                        <FeedbackMemberCard
                            key={`${group.packName}:${group.itemName}`}
                            group={group}
                            packs={allPacks}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default FeedbackPanel;
