import React, { useMemo, useSyncExternalStore, useState, useCallback } from 'react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart2, CheckCircle, XCircle, Users, ChevronDown, ChevronUp, Briefcase, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useLumiverseStore, usePacks } from '../../store/LumiverseContext';
import LazyImage from '../shared/LazyImage';

// Get store for direct access
const store = useLumiverseStore;

// Stable fallback constants
const EMPTY_ARRAY = [];

/**
 * User-friendly error descriptions keyed by HTTP status code.
 */
const HTTP_ERROR_MAP = {
  400: "The request contained an invalid parameter. This usually means a model name, setting, or tool schema was rejected by the provider.",
  401: "Authentication failed. Please check that your API key is correct and active in the Council Tools LLM settings.",
  403: "Access denied. Your API key may have been revoked, expired, or your account may be restricted by the provider.",
  429: "Rate limited by the provider. Too many requests were sent in a short period — please wait a moment and try again.",
  500: "The provider experienced an internal error. The service may be temporarily unavailable.",
  501: "The provider does not support this request type. The model or feature you selected may not be available on this endpoint.",
  502: "The provider is not responding. The upstream service may be down or experiencing connectivity issues.",
  503: "The provider is not accepting connections. The model you specified may be temporarily unavailable or the service is under maintenance.",
};

/**
 * Parse a raw error string from council tool execution into a user-friendly message.
 * Handles HTTP status codes, JSON parse failures, and generic errors.
 * @param {string} rawError - The raw error message from the tool execution
 * @returns {{ statusCode: number|null, friendlyMessage: string, rawDetail: string|null }}
 */
function parseToolError(rawError) {
  if (!rawError) return { statusCode: null, friendlyMessage: "An unknown error occurred.", rawDetail: null };

  // Detect JSON parse failures (truncated or malformed responses)
  const jsonParsePatterns = [
    /unexpected end of json/i,
    /unexpected token/i,
    /json\.parse/i,
    /syntaxerror/i,
    /unterminated string/i,
    /not valid json/i,
  ];
  for (const pattern of jsonParsePatterns) {
    if (pattern.test(rawError)) {
      return {
        statusCode: null,
        friendlyMessage: "The provider returned a malformed or truncated response that could not be parsed. This typically happens when the model's output was cut off mid-stream. Try again, or reduce the number of tools assigned to this member.",
        rawDetail: rawError,
      };
    }
  }

  // Extract HTTP status code from common error formats:
  // "Anthropic API error: 429 - {...}"
  // "openai API error: 401 - Unauthorized"
  // "Google AI Studio API error: 500 - ..."
  const statusMatch = rawError.match(/(?:API error|error):\s*(\d{3})\b/i);
  if (statusMatch) {
    const code = parseInt(statusMatch[1], 10);
    const friendly = HTTP_ERROR_MAP[code];
    if (friendly) {
      return { statusCode: code, friendlyMessage: friendly, rawDetail: null };
    }
    // Known HTTP error but no specific mapping
    return {
      statusCode: code,
      friendlyMessage: `The provider returned an error (HTTP ${code}).`,
      rawDetail: rawError,
    };
  }

  // Check for network-level failures
  if (/failed to fetch|networkerror|net::err/i.test(rawError)) {
    return {
      statusCode: null,
      friendlyMessage: "Could not reach the provider. Check your internet connection and verify the API endpoint is correct.",
      rawDetail: null,
    };
  }

  // Check for timeout / abort
  if (/abort|cancel|timeout/i.test(rawError)) {
    return { statusCode: null, friendlyMessage: "The request was cancelled or timed out.", rawDetail: null };
  }

  // Fallback: return the raw message
  return { statusCode: null, friendlyMessage: rawError, rawDetail: null };
}

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
 * Parsed, user-friendly error display for tool failures
 */
function ToolError({ error }) {
    const parsed = useMemo(() => parseToolError(error), [error]);

    return (
        <div className="lumiverse-feedback-tool-error">
            <div className="lumiverse-feedback-tool-error-header">
                <AlertTriangle size={13} />
                {parsed.statusCode
                    ? <strong>{parsed.statusCode}</strong>
                    : <strong>Error</strong>
                }
            </div>
            <div className="lumiverse-feedback-tool-error-message">
                {parsed.friendlyMessage}
            </div>
            {parsed.rawDetail && (
                <details className="lumiverse-feedback-tool-error-details">
                    <summary>Raw error detail</summary>
                    <pre>{parsed.rawDetail}</pre>
                </details>
            )}
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
                            <ToolError error={result.error} />
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
                    <LazyImage
                        src={memberImage}
                        alt={memberName}
                        spinnerSize={14}
                        fallback={<Users size={20} strokeWidth={1.5} />}
                    />
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
