/**
 * PromptItemizationModal — Per-message prompt breakdown with token counts,
 * stacked bar visualization, and raw prompt preview.
 *
 * Supports two data formats:
 * - ST native: Fixed categories (System Info, Prompt Tokens, World Info, etc.)
 * - Loom preset: Dynamic block-level breakdown from Lucid Loom assembly
 *
 * Uses self-contained inline styles with var(--lumiverse-*) variables.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, Eye, EyeOff, Loader2, AlertCircle, Layers } from 'lucide-react';
import { getPromptItemization } from '../../../lib/chatSheldService';

// Fixed category colors for ST native view
const ST_CATEGORIES = [
    { key: 'systemInfo', label: 'System Info', color: '#5b8ca8' },
    { key: 'promptTokens', label: 'Prompt Tokens', color: '#e07a7a' },
    { key: 'worldInfo', label: 'World Info', color: '#68b87a' },
    { key: 'chatHistory', label: 'Chat History', color: '#d4a842' },
    { key: 'extensions', label: 'Extensions', color: '#5bc0c0' },
    { key: 'bias', label: 'Bias', color: '#8a7fb0' },
];

// Color palette for Loom blocks without a user-assigned color
const BLOCK_PALETTE = [
    '#5b8ca8', '#e07a7a', '#68b87a', '#d4a842', '#5bc0c0', '#8a7fb0',
    '#c76fa1', '#7db87d', '#b88650', '#6a8fd4', '#c9c45e', '#8ec4c4',
];

// Role badge colors
const ROLE_COLORS = {
    system: { bg: 'rgba(91,140,168,0.2)', text: '#5b8ca8' },
    user: { bg: 'rgba(104,184,122,0.2)', text: '#68b87a' },
    assistant: { bg: 'rgba(212,168,66,0.2)', text: '#d4a842' },
    mixed: { bg: 'rgba(138,127,176,0.2)', text: '#8a7fb0' },
};

const s = {
    header: {
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '20px 24px 16px', borderBottom: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
        flexShrink: 0,
    },
    headerLeft: { display: 'flex', flexDirection: 'column', gap: '6px' },
    title: { fontSize: '18px', fontWeight: 600, color: 'var(--lumiverse-text, #e6e6f0)', margin: 0 },
    apiInfo: {
        display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px',
    },
    badge: {
        padding: '2px 7px', borderRadius: '4px',
        background: 'var(--lumiverse-fill, rgba(255,255,255,0.06))',
        border: '1px solid var(--lumiverse-border, rgba(255,255,255,0.06))',
        color: 'var(--lumiverse-text-muted, rgba(230,230,240,0.6))',
        fontSize: '10px', fontWeight: 500, letterSpacing: '0.02em',
    },
    loomBadge: {
        padding: '2px 7px', borderRadius: '4px',
        background: 'rgba(138,127,176,0.15)',
        border: '1px solid rgba(138,127,176,0.3)',
        color: '#b0a4d8',
        fontSize: '10px', fontWeight: 600, letterSpacing: '0.02em',
        display: 'flex', alignItems: 'center', gap: '4px',
    },
    closeBtn: {
        width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--lumiverse-fill-subtle, rgba(255,255,255,0.04))',
        border: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
        borderRadius: '8px', color: 'var(--lumiverse-text-muted, rgba(230,230,240,0.6))',
        cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
    },
    body: {
        flex: 1, overflowY: 'auto', padding: '16px 24px 20px',
        display: 'flex', flexDirection: 'column', gap: '18px',
        minHeight: 0,
    },
    barContainer: {
        display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden',
        border: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
    },
    barSegment: {
        height: '100%', transition: 'width 0.3s ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,0.85)',
        overflow: 'hidden', whiteSpace: 'nowrap',
    },
    legend: {
        display: 'flex', flexWrap: 'wrap', gap: '8px 14px', fontSize: '11px',
        color: 'var(--lumiverse-text-muted, rgba(230,230,240,0.6))',
    },
    legendItem: { display: 'flex', alignItems: 'center', gap: '5px' },
    legendDot: { width: '8px', height: '8px', borderRadius: '2px', flexShrink: 0 },
    table: { width: '100%', borderCollapse: 'collapse' },
    tableSection: {
        fontSize: '13px', fontWeight: 600, padding: '10px 8px 6px',
        color: 'var(--lumiverse-text, #e6e6f0)',
        borderBottom: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
    },
    tableRow: {
        fontSize: '13px', color: 'var(--lumiverse-text-muted, rgba(230,230,240,0.7))',
    },
    tableCell: { padding: '5px 8px' },
    tableCellRight: { padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
    tableCellSub: { padding: '4px 8px 4px 24px', fontSize: '12px' },
    tableCellZero: { color: 'var(--lumiverse-text-dim, rgba(230,230,240,0.25))' },
    roleBadge: {
        display: 'inline-block', padding: '1px 5px', borderRadius: '3px',
        fontSize: '9px', fontWeight: 600, letterSpacing: '0.03em',
        textTransform: 'uppercase', marginLeft: '6px', verticalAlign: 'middle',
    },
    footer: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', borderTop: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
        flexShrink: 0, gap: '12px', flexWrap: 'wrap',
    },
    footerTotal: {
        fontSize: '14px', fontWeight: 600, color: 'var(--lumiverse-text, #e6e6f0)',
        fontVariantNumeric: 'tabular-nums',
    },
    footerActions: { display: 'flex', gap: '8px' },
    footerBtn: {
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
        background: 'var(--lumiverse-fill, rgba(255,255,255,0.06))',
        border: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
        color: 'var(--lumiverse-text-muted, rgba(230,230,240,0.6))',
        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
    },
    rawBlock: {
        marginTop: '8px', padding: '14px', borderRadius: '10px',
        background: 'var(--lumiverse-bg-deep, rgba(10,8,18,0.9))',
        border: '1px solid var(--lumiverse-border, rgba(255,255,255,0.06))',
        maxHeight: '350px', overflowY: 'auto', fontSize: '12px', lineHeight: 1.5,
        fontFamily: "'SF Mono', 'Fira Code', Menlo, Consolas, monospace",
        color: 'var(--lumiverse-text-muted, rgba(230,230,240,0.65))',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    },
    loading: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '14px', padding: '60px 20px', color: 'var(--lumiverse-text-dim, rgba(230,230,240,0.4))',
        fontSize: '13px',
    },
    unavailable: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '12px', padding: '60px 20px', color: 'var(--lumiverse-text-dim, rgba(230,230,240,0.35))',
        fontSize: '14px', textAlign: 'center',
    },
};

function TokenRow({ label, tokens, total, isSub = false, color = null, roleBadge = null }) {
    const isZero = tokens === 0;
    const pct = total > 0 ? ((tokens / total) * 100).toFixed(1) : '0.0';

    return (
        <tr style={s.tableRow}>
            <td style={{
                ...(isSub ? s.tableCellSub : s.tableCell),
                ...(isZero ? s.tableCellZero : {}),
            }}>
                {color && <span style={{ ...s.legendDot, background: color, display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} />}
                {label}
                {roleBadge && (
                    <span style={{
                        ...s.roleBadge,
                        background: ROLE_COLORS[roleBadge]?.bg || 'rgba(255,255,255,0.06)',
                        color: ROLE_COLORS[roleBadge]?.text || '#999',
                    }}>
                        {roleBadge}
                    </span>
                )}
            </td>
            <td style={{ ...s.tableCellRight, ...(isZero ? s.tableCellZero : {}) }}>
                {tokens.toLocaleString()}
            </td>
            <td style={{ ...s.tableCellRight, ...(isZero ? s.tableCellZero : {}), fontSize: '11px' }}>
                {pct}%
            </td>
        </tr>
    );
}

// ── Loom Preset View ────────────────────────────────────────────────────

function LoomView({ data, barTotal, showRaw, setShowRaw, copied, handleCopy, onClose }) {
    // Assign colors to blocks: use block.color if set, otherwise cycle through palette
    const coloredBlocks = data.blocks.map((block, i) => ({
        ...block,
        displayColor: block.color || BLOCK_PALETTE[i % BLOCK_PALETTE.length],
    }));

    const barItems = coloredBlocks.filter(b => b.tokens > 0);

    return (
        <>
            {/* Header */}
            <div style={s.header}>
                <div style={s.headerLeft}>
                    <h3 style={s.title}>Prompt Breakdown</h3>
                    <div style={s.apiInfo}>
                        <span style={s.loomBadge}>
                            <Layers size={10} />
                            Loom Preset
                        </span>
                        {data.presetName && <span style={s.badge}>{data.presetName}</span>}
                        {data.api && <span style={s.badge}>{data.api}</span>}
                        {data.model && <span style={s.badge}>{data.model}</span>}
                        {data.tokenizer && <span style={s.badge}>Tokenizer: {data.tokenizer}</span>}
                    </div>
                </div>
                <button style={s.closeBtn} onClick={onClose} type="button"><X size={16} /></button>
            </div>

            {/* Body */}
            <div style={s.body}>
                {/* Stacked bar */}
                <div>
                    <div style={s.barContainer}>
                        {barItems.map((block, i) => (
                            <div
                                key={i}
                                style={{
                                    ...s.barSegment,
                                    width: `${Math.max((block.tokens / barTotal) * 100, 1.5)}%`,
                                    background: block.displayColor,
                                }}
                                title={`${block.name}: ${block.tokens.toLocaleString()} tokens (${((block.tokens / barTotal) * 100).toFixed(1)}%)`}
                            >
                                {(block.tokens / barTotal) > 0.08 ? block.tokens.toLocaleString() : ''}
                            </div>
                        ))}
                    </div>
                    <div style={{ ...s.legend, marginTop: '8px' }}>
                        {coloredBlocks.filter(b => b.tokens > 0).map((block, i) => (
                            <span key={i} style={s.legendItem}>
                                <span style={{ ...s.legendDot, background: block.displayColor }} />
                                {block.name}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Block table */}
                <table style={s.table}>
                    <thead>
                        <tr>
                            <th style={{ ...s.tableCell, textAlign: 'left', fontSize: '11px', color: 'var(--lumiverse-text-dim)', fontWeight: 500, padding: '6px 8px' }}>Block</th>
                            <th style={{ ...s.tableCellRight, fontSize: '11px', color: 'var(--lumiverse-text-dim)', fontWeight: 500, padding: '6px 8px' }}>Tokens</th>
                            <th style={{ ...s.tableCellRight, fontSize: '11px', color: 'var(--lumiverse-text-dim)', fontWeight: 500, padding: '6px 8px' }}>%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {coloredBlocks.map((block, i) => (
                            <TokenRow
                                key={i}
                                label={block.messageCount != null
                                    ? `${block.name} (${block.messageCount} msgs)`
                                    : block.name
                                }
                                tokens={block.tokens}
                                total={barTotal}
                                color={block.displayColor}
                                roleBadge={block.role}
                            />
                        ))}
                    </tbody>
                </table>

                {/* Raw prompt */}
                {showRaw && data.rawPrompt && (
                    <div style={s.rawBlock}>{data.rawPrompt}</div>
                )}
            </div>

            {/* Footer */}
            <div style={s.footer}>
                <div style={s.footerTotal}>
                    {barTotal.toLocaleString()} tokens
                    {data.maxContext > 0 && (
                        <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--lumiverse-text-dim)', marginLeft: '8px' }}>
                            / {data.maxContext.toLocaleString()} max context
                        </span>
                    )}
                </div>
                <div style={s.footerActions}>
                    {data.rawPrompt && (
                        <>
                            <button
                                style={s.footerBtn}
                                onClick={(e) => { e.stopPropagation(); setShowRaw(prev => !prev); }}
                                type="button"
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--lumiverse-fill-hover, rgba(255,255,255,0.1))'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'var(--lumiverse-fill, rgba(255,255,255,0.06))'; }}
                            >
                                {showRaw ? <EyeOff size={13} /> : <Eye size={13} />}
                                {showRaw ? 'Hide Raw' : 'View Raw'}
                            </button>
                            <button
                                style={s.footerBtn}
                                onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                                type="button"
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--lumiverse-fill-hover, rgba(255,255,255,0.1))'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'var(--lumiverse-fill, rgba(255,255,255,0.06))'; }}
                            >
                                {copied ? <Check size={13} /> : <Copy size={13} />}
                                {copied ? 'Copied!' : 'Copy Prompt'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

// ── ST Native View ──────────────────────────────────────────────────────

function STView({ data, barTotal, barItems, showRaw, setShowRaw, copied, handleCopy, onClose }) {
    return (
        <>
            {/* Header */}
            <div style={s.header}>
                <div style={s.headerLeft}>
                    <h3 style={s.title}>Prompt Breakdown</h3>
                    <div style={s.apiInfo}>
                        {data.api && <span style={s.badge}>{data.api}</span>}
                        {data.model && <span style={s.badge}>{data.model}</span>}
                        {data.presetName && <span style={s.badge}>{data.presetName}</span>}
                        {data.tokenizer && <span style={s.badge}>Tokenizer: {data.tokenizer}</span>}
                    </div>
                </div>
                <button style={s.closeBtn} onClick={onClose} type="button"><X size={16} /></button>
            </div>

            {/* Body */}
            <div style={s.body}>
                {/* Stacked bar */}
                <div>
                    <div style={s.barContainer}>
                        {barItems.map(item => (
                            <div
                                key={item.key}
                                style={{
                                    ...s.barSegment,
                                    width: `${Math.max((item.tokens / barTotal) * 100, 1.5)}%`,
                                    background: item.color,
                                }}
                                title={`${item.label}: ${item.tokens.toLocaleString()} tokens (${((item.tokens / barTotal) * 100).toFixed(1)}%)`}
                            >
                                {(item.tokens / barTotal) > 0.08 ? item.tokens.toLocaleString() : ''}
                            </div>
                        ))}
                    </div>
                    <div style={{ ...s.legend, marginTop: '8px' }}>
                        {ST_CATEGORIES.map(cat => (
                            <span key={cat.key} style={s.legendItem}>
                                <span style={{ ...s.legendDot, background: cat.color }} />
                                {cat.label}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Token table */}
                <table style={s.table}>
                    <thead>
                        <tr>
                            <th style={{ ...s.tableCell, textAlign: 'left', fontSize: '11px', color: 'var(--lumiverse-text-dim)', fontWeight: 500, padding: '6px 8px' }}>Category</th>
                            <th style={{ ...s.tableCellRight, fontSize: '11px', color: 'var(--lumiverse-text-dim)', fontWeight: 500, padding: '6px 8px' }}>Tokens</th>
                            <th style={{ ...s.tableCellRight, fontSize: '11px', color: 'var(--lumiverse-text-dim)', fontWeight: 500, padding: '6px 8px' }}>%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* System Info */}
                        <tr><td colSpan={3} style={{ ...s.tableSection }}><span style={{ ...s.legendDot, background: ST_CATEGORIES[0].color, display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} />System Info</td></tr>
                        <TokenRow label="Main" tokens={data.systemInfo.main} total={barTotal} isSub />
                        <TokenRow label="Chat Start" tokens={data.systemInfo.start} total={barTotal} isSub />
                        <TokenRow label="Nudge" tokens={data.systemInfo.nudge} total={barTotal} isSub />
                        <TokenRow label="Jailbreak" tokens={data.systemInfo.jailbreak} total={barTotal} isSub />

                        {/* Prompt Tokens */}
                        <tr><td colSpan={3} style={{ ...s.tableSection }}><span style={{ ...s.legendDot, background: ST_CATEGORIES[1].color, display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} />Prompt Tokens</td></tr>
                        <TokenRow label="Description" tokens={data.promptTokens.description} total={barTotal} isSub />
                        <TokenRow label="Personality" tokens={data.promptTokens.personality} total={barTotal} isSub />
                        <TokenRow label="Scenario" tokens={data.promptTokens.scenario} total={barTotal} isSub />
                        <TokenRow label="Examples" tokens={data.promptTokens.examples} total={barTotal} isSub />
                        <TokenRow label="User Persona" tokens={data.promptTokens.persona} total={barTotal} isSub />

                        {/* World Info */}
                        <tr><td colSpan={3} style={{ ...s.tableSection }}><span style={{ ...s.legendDot, background: ST_CATEGORIES[2].color, display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} />World Info</td></tr>
                        <TokenRow label="World Info" tokens={data.worldInfo} total={barTotal} isSub />

                        {/* Chat History */}
                        <tr><td colSpan={3} style={{ ...s.tableSection }}><span style={{ ...s.legendDot, background: ST_CATEGORIES[3].color, display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} />Chat History</td></tr>
                        <TokenRow label={`Conversation (${data.chatHistory.messagesCount} msgs)`} tokens={data.chatHistory.total} total={barTotal} isSub />

                        {/* Extensions */}
                        <tr><td colSpan={3} style={{ ...s.tableSection }}><span style={{ ...s.legendDot, background: ST_CATEGORIES[4].color, display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} />Extensions</td></tr>
                        <TokenRow label="Summarize" tokens={data.extensions.summarize} total={barTotal} isSub />
                        <TokenRow label="Author's Note" tokens={data.extensions.authorsNote} total={barTotal} isSub />
                        <TokenRow label="Smart Context" tokens={data.extensions.smartContext} total={barTotal} isSub />
                        <TokenRow label="Vector Storage" tokens={data.extensions.vectors} total={barTotal} isSub />

                        {/* Bias */}
                        <tr><td colSpan={3} style={{ ...s.tableSection }}><span style={{ ...s.legendDot, background: ST_CATEGORIES[5].color, display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} />Bias</td></tr>
                        <TokenRow label="Bias" tokens={data.bias} total={barTotal} isSub />
                    </tbody>
                </table>

                {/* Raw prompt */}
                {showRaw && data.rawPrompt && (
                    <div style={s.rawBlock}>{data.rawPrompt}</div>
                )}
            </div>

            {/* Footer */}
            <div style={s.footer}>
                <div style={s.footerTotal}>
                    {barTotal.toLocaleString()} tokens counted
                    {data.totalTokens > 0 && data.totalTokens !== barTotal && (
                        <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--lumiverse-text-dim)', marginLeft: '8px' }}>
                            ({data.totalTokens.toLocaleString()} sent to API)
                        </span>
                    )}
                    {data.maxContext > 0 && (
                        <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--lumiverse-text-dim)', marginLeft: '8px' }}>
                            / {data.maxContext.toLocaleString()} max context
                        </span>
                    )}
                </div>
                <div style={s.footerActions}>
                    {data.rawPrompt && (
                        <>
                            <button
                                style={s.footerBtn}
                                onClick={(e) => { e.stopPropagation(); setShowRaw(prev => !prev); }}
                                type="button"
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--lumiverse-fill-hover, rgba(255,255,255,0.1))'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'var(--lumiverse-fill, rgba(255,255,255,0.06))'; }}
                            >
                                {showRaw ? <EyeOff size={13} /> : <Eye size={13} />}
                                {showRaw ? 'Hide Raw' : 'View Raw'}
                            </button>
                            <button
                                style={s.footerBtn}
                                onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                                type="button"
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--lumiverse-fill-hover, rgba(255,255,255,0.1))'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'var(--lumiverse-fill, rgba(255,255,255,0.06))'; }}
                            >
                                {copied ? <Check size={13} /> : <Copy size={13} />}
                                {copied ? 'Copied!' : 'Copy Prompt'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

// ── Main Modal ──────────────────────────────────────────────────────────

export default function PromptItemizationModal({ onClose, mesId }) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showRaw, setShowRaw] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        getPromptItemization(mesId).then(result => {
            if (!cancelled) {
                setData(result);
                setIsLoading(false);
            }
        });
        return () => { cancelled = true; };
    }, [mesId]);

    const handleCopy = useCallback(async () => {
        if (!data?.rawPrompt) return;
        try {
            await navigator.clipboard.writeText(data.rawPrompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* ignore */ }
    }, [data]);

    if (isLoading) {
        return (
            <>
                <div style={s.header}>
                    <div style={s.headerLeft}>
                        <h3 style={s.title}>Prompt Breakdown</h3>
                    </div>
                    <button style={s.closeBtn} onClick={onClose} type="button"><X size={16} /></button>
                </div>
                <div style={s.loading}>
                    <Loader2 size={24} style={{ animation: 'lcs-spin 0.75s linear infinite' }} />
                    Computing token counts...
                </div>
            </>
        );
    }

    if (!data) {
        return (
            <>
                <div style={s.header}>
                    <div style={s.headerLeft}>
                        <h3 style={s.title}>Prompt Breakdown</h3>
                    </div>
                    <button style={s.closeBtn} onClick={onClose} type="button"><X size={16} /></button>
                </div>
                <div style={s.unavailable}>
                    <AlertCircle size={28} style={{ opacity: 0.4 }} />
                    <div>Prompt data not available for this message.</div>
                    <div style={{ fontSize: '12px', maxWidth: '320px' }}>
                        Prompt itemization data is generated during message creation and may not be available for older messages or those generated before this feature was enabled.
                    </div>
                </div>
            </>
        );
    }

    // Branch: Loom preset vs ST native
    if (data.isLoomPreset) {
        const loomBarTotal = data.blocks.reduce((sum, b) => sum + b.tokens, 0) || 1;
        return (
            <LoomView
                data={data}
                barTotal={loomBarTotal}
                showRaw={showRaw}
                setShowRaw={setShowRaw}
                copied={copied}
                handleCopy={handleCopy}
                onClose={onClose}
            />
        );
    }

    // ST native view — build bar segments from fixed categories
    const barItems = ST_CATEGORIES.map(cat => {
        let tokens;
        if (cat.key === 'worldInfo' || cat.key === 'bias') {
            tokens = typeof data[cat.key] === 'number' ? data[cat.key] : 0;
        } else {
            tokens = data[cat.key]?.total || 0;
        }
        return { ...cat, tokens };
    }).filter(item => item.tokens > 0);

    const barTotal = barItems.reduce((sum, item) => sum + item.tokens, 0) || 1;

    return (
        <STView
            data={data}
            barTotal={barTotal}
            barItems={barItems}
            showRaw={showRaw}
            setShowRaw={setShowRaw}
            copied={copied}
            handleCopy={handleCopy}
            onClose={onClose}
        />
    );
}
