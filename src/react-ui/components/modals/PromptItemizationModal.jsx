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
import { X, Copy, Check, Eye, EyeOff, Loader2, AlertCircle, Layers, ChevronDown } from 'lucide-react';
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
    accordion: {
        borderRadius: '10px',
        border: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
        background: 'var(--lumiverse-fill-subtle, rgba(255,255,255,0.02))',
        overflow: 'hidden',
        flexShrink: 0, // Prevent flex column from shrinking this — let the body scroll instead
    },
    accordionHeader: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', cursor: 'pointer', userSelect: 'none',
        background: 'transparent', border: 'none', width: '100%',
        fontFamily: 'inherit', transition: 'background 0.15s',
    },
    accordionHeaderLeft: {
        display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: '13px', fontWeight: 600, color: 'var(--lumiverse-text, #e6e6f0)',
    },
    accordionChevron: {
        transition: 'transform 0.2s ease',
        color: 'var(--lumiverse-text-muted, rgba(230,230,240,0.5))',
        flexShrink: 0,
    },
    accordionTokenSummary: {
        fontSize: '12px', fontWeight: 500, color: 'var(--lumiverse-text-muted, rgba(230,230,240,0.55))',
        fontVariantNumeric: 'tabular-nums',
        display: 'flex', alignItems: 'center', gap: '8px',
    },
    accordionBody: {
        overflow: 'hidden', transition: 'max-height 0.25s ease, opacity 0.2s ease',
    },
    accordionInner: {
        padding: '0 14px 12px',
        borderTop: '1px solid var(--lumiverse-border, rgba(255,255,255,0.06))',
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

// Group color constants for summary bar
const GROUP_COLORS = {
    lumiverse: '#8a7fb0',
    chatHistory: '#d4a842',
    worldInfo: '#68b87a',
    extensions: '#5bc0c0',
    system: '#5b8ca8',
};

// World info marker/type check (covers both explicit WI blocks and auto-injected WI)
const isWorldInfoBlock = (b) =>
    b.marker === 'world_info_before' || b.marker === 'world_info_after' || b._type === 'world_info';

// ── Loom Preset View ────────────────────────────────────────────────────

function LoomView({ data, barTotal, showRaw, setShowRaw, copied, handleCopy, onClose }) {
    const [blocksOpen, setBlocksOpen] = useState(false);
    const [extensionsOpen, setExtensionsOpen] = useState(false);

    // Separate blocks into groups
    const chatHistoryBlocks = data.blocks.filter(b => b.marker === 'chat_history');
    const worldInfoBlocks = data.blocks.filter(b => isWorldInfoBlock(b));
    const extensionBlocks = data.blocks.filter(b => b._type === 'extension');
    const systemBlocks = data.blocks.filter(b =>
        b.marker !== 'chat_history' && !isWorldInfoBlock(b)
        && b._type !== 'extension'
        && (b._type === 'separator' || b._type === 'utility')
    );
    const lumiverseBlocks = data.blocks.filter(b =>
        b.marker !== 'chat_history' && !isWorldInfoBlock(b)
        && b._type !== 'separator' && b._type !== 'utility' && b._type !== 'extension'
    );

    const chatHistoryTokens = chatHistoryBlocks.reduce((sum, b) => sum + b.tokens, 0);
    const worldInfoTokens = worldInfoBlocks.reduce((sum, b) => sum + b.tokens, 0);
    const extensionTokens = extensionBlocks.reduce((sum, b) => sum + b.tokens, 0);
    const systemTokens = systemBlocks.reduce((sum, b) => sum + b.tokens, 0);
    const lumiverseTokens = lumiverseBlocks.reduce((sum, b) => sum + b.tokens, 0);

    // Assign display colors to individual lumiverse blocks for the detail view
    const coloredLoomBlocks = lumiverseBlocks.map((block, i) => ({
        ...block,
        displayColor: block.color || BLOCK_PALETTE[i % BLOCK_PALETTE.length],
    }));

    // Summary groups for the overview bar
    const groups = [];
    if (lumiverseTokens > 0) groups.push({ key: 'lumiverse', label: 'Lumiverse Prompts', tokens: lumiverseTokens, color: GROUP_COLORS.lumiverse });
    if (chatHistoryTokens > 0) {
        const msgCount = chatHistoryBlocks.reduce((sum, b) => sum + (b.messageCount || 0), 0);
        groups.push({ key: 'chatHistory', label: msgCount > 0 ? `Chat History (${msgCount} msgs)` : 'Chat History', tokens: chatHistoryTokens, color: GROUP_COLORS.chatHistory });
    }
    if (worldInfoTokens > 0) groups.push({ key: 'worldInfo', label: 'World Info', tokens: worldInfoTokens, color: GROUP_COLORS.worldInfo });
    if (extensionTokens > 0) groups.push({ key: 'extensions', label: 'Extensions', tokens: extensionTokens, color: GROUP_COLORS.extensions });
    if (systemTokens > 0) groups.push({ key: 'system', label: 'System', tokens: systemTokens, color: GROUP_COLORS.system });

    // Mini-bar items: individual lumiverse blocks with tokens > 0
    const miniBarItems = coloredLoomBlocks.filter(b => b.tokens > 0);
    const miniBarTotal = lumiverseTokens || 1;

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
                    </div>
                </div>
                <button style={s.closeBtn} onClick={onClose} type="button"><X size={16} /></button>
            </div>

            {/* Body */}
            <div style={s.body}>
                {/* Overview stacked bar — grouped */}
                <div>
                    <div style={s.barContainer}>
                        {groups.map(g => (
                            <div
                                key={g.key}
                                style={{
                                    ...s.barSegment,
                                    width: `${Math.max((g.tokens / barTotal) * 100, 1.5)}%`,
                                    background: g.color,
                                }}
                                title={`${g.label}: ${g.tokens.toLocaleString()} tokens (${((g.tokens / barTotal) * 100).toFixed(1)}%)`}
                            >
                                {(g.tokens / barTotal) > 0.06 ? g.tokens.toLocaleString() : ''}
                            </div>
                        ))}
                    </div>
                    <div style={{ ...s.legend, marginTop: '8px' }}>
                        {groups.map(g => (
                            <span key={g.key} style={s.legendItem}>
                                <span style={{ ...s.legendDot, background: g.color }} />
                                {g.label}
                                <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.65 }}>
                                    {g.tokens.toLocaleString()}
                                </span>
                            </span>
                        ))}
                    </div>
                </div>

                {/* Collapsible: Lumiverse Prompts detail */}
                {lumiverseBlocks.length > 0 && (
                    <div style={s.accordion}>
                        <button
                            style={s.accordionHeader}
                            onClick={() => setBlocksOpen(prev => !prev)}
                            type="button"
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--lumiverse-fill, rgba(255,255,255,0.04))'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            <div style={s.accordionHeaderLeft}>
                                <ChevronDown
                                    size={14}
                                    style={{
                                        ...s.accordionChevron,
                                        transform: blocksOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                                    }}
                                />
                                Lumiverse Prompts
                                <span style={{
                                    fontSize: '11px', fontWeight: 400,
                                    color: 'var(--lumiverse-text-dim, rgba(230,230,240,0.4))',
                                }}>
                                    ({lumiverseBlocks.length} block{lumiverseBlocks.length !== 1 ? 's' : ''})
                                </span>
                            </div>
                            <div style={s.accordionTokenSummary}>
                                {lumiverseTokens.toLocaleString()} tokens
                            </div>
                        </button>
                        {/* Conditionally rendered body — no nested scroll container,
                            the modal body handles all scrolling */}
                        {blocksOpen && (
                            <div style={s.accordionInner}>
                                {/* Mini stacked bar for individual blocks */}
                                {miniBarItems.length > 1 && (
                                    <div style={{ ...s.barContainer, height: '14px', marginBottom: '10px', marginTop: '8px' }}>
                                        {miniBarItems.map((block, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    ...s.barSegment,
                                                    height: '100%',
                                                    fontSize: '8px',
                                                    width: `${Math.max((block.tokens / miniBarTotal) * 100, 0.5)}%`,
                                                    background: block.displayColor,
                                                }}
                                                title={`${block.name}: ${block.tokens.toLocaleString()} tokens (${((block.tokens / miniBarTotal) * 100).toFixed(1)}%)`}
                                            />
                                        ))}
                                    </div>
                                )}
                                <table style={{ ...s.table, marginTop: '4px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...s.tableCell, textAlign: 'left', fontSize: '11px', color: 'var(--lumiverse-text-dim)', fontWeight: 500, padding: '6px 8px' }}>Block</th>
                                            <th style={{ ...s.tableCellRight, fontSize: '11px', color: 'var(--lumiverse-text-dim)', fontWeight: 500, padding: '6px 8px' }}>Tokens</th>
                                            <th style={{ ...s.tableCellRight, fontSize: '11px', color: 'var(--lumiverse-text-dim)', fontWeight: 500, padding: '6px 8px' }}>%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {coloredLoomBlocks.map((block, i) => (
                                            <TokenRow
                                                key={i}
                                                label={block.name}
                                                tokens={block.tokens}
                                                total={barTotal}
                                                color={block.displayColor}
                                                roleBadge={block.role}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Extensions accordion (Summary, Author's Note, Vectors, etc.) */}
                {extensionBlocks.length > 0 && (
                    <div style={s.accordion}>
                        <button
                            style={s.accordionHeader}
                            onClick={() => setExtensionsOpen(prev => !prev)}
                            type="button"
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--lumiverse-fill, rgba(255,255,255,0.04))'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            <div style={s.accordionHeaderLeft}>
                                <ChevronDown
                                    size={14}
                                    style={{
                                        ...s.accordionChevron,
                                        transform: extensionsOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                                    }}
                                />
                                Extensions
                                <span style={{
                                    fontSize: '11px', fontWeight: 400,
                                    color: 'var(--lumiverse-text-dim, rgba(230,230,240,0.4))',
                                }}>
                                    ({extensionBlocks.length} item{extensionBlocks.length !== 1 ? 's' : ''})
                                </span>
                            </div>
                            <div style={s.accordionTokenSummary}>
                                {extensionTokens.toLocaleString()} tokens
                            </div>
                        </button>
                        {extensionsOpen && (
                            <div style={s.accordionInner}>
                                <table style={{ ...s.table, marginTop: '4px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...s.tableCell, textAlign: 'left', fontSize: '11px', color: 'var(--lumiverse-text-dim)', fontWeight: 500, padding: '6px 8px' }}>Extension</th>
                                            <th style={{ ...s.tableCellRight, fontSize: '11px', color: 'var(--lumiverse-text-dim)', fontWeight: 500, padding: '6px 8px' }}>Tokens</th>
                                            <th style={{ ...s.tableCellRight, fontSize: '11px', color: 'var(--lumiverse-text-dim)', fontWeight: 500, padding: '6px 8px' }}>%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {extensionBlocks.map((block, i) => (
                                            <TokenRow
                                                key={i}
                                                label={block.name}
                                                tokens={block.tokens}
                                                total={barTotal}
                                                color={GROUP_COLORS.extensions}
                                                roleBadge={block.role}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* World Info detail — shown as rows if present (from explicit blocks or auto-inject) */}
                {worldInfoBlocks.length > 0 && worldInfoBlocks.some(b => b.tokens > 0) && (
                    <div style={{ fontSize: '12px', color: 'var(--lumiverse-text-dim, rgba(230,230,240,0.4))' }}>
                        <table style={s.table}>
                            <tbody>
                                {worldInfoBlocks.map((block, i) => (
                                    <TokenRow
                                        key={i}
                                        label={block.name}
                                        tokens={block.tokens}
                                        total={barTotal}
                                        color={GROUP_COLORS.worldInfo}
                                        isSub
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* System blocks detail (separators, utilities) — shown inline if present */}
                {systemBlocks.length > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--lumiverse-text-dim, rgba(230,230,240,0.4))' }}>
                        <table style={s.table}>
                            <tbody>
                                {systemBlocks.map((block, i) => (
                                    <TokenRow
                                        key={i}
                                        label={block.name}
                                        tokens={block.tokens}
                                        total={barTotal}
                                        isSub
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

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
