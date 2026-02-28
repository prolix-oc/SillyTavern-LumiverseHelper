/**
 * WorldBookEntry — Collapsible entry card with header + expanded editor.
 *
 * Layout: header (collapsed) → primary zone (content/keywords) → advanced accordion (2-col grid).
 * Desktop: position/order inline with title, keywords side-by-side, advanced sections in 2 columns.
 * Mobile: single-column fallback via CSS grid.
 */

import React, { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    ChevronRight, ChevronDown, Eye, EyeOff, Copy, Trash2,
    GripVertical, MoreVertical, ArrowRightLeft, ClipboardCopy,
    Zap, MapPin, Scan, Users, GitBranch,
    Layers, Clock, Filter, Terminal, Settings, Maximize2
} from 'lucide-react';
import { EditorSection, FormField, TextInput, TextArea, Select } from '../shared/FormComponents';
import TagPillInput from '../shared/TagPillInput';
import NullableInput from '../shared/NullableInput';
import TextExpanderModal from '../shared/TextExpanderModal';
import ConfirmationModal from '../shared/ConfirmationModal';
import {
    POSITION_LABELS,
    SELECTIVE_LOGIC_OPTIONS,
    ROLE_OPTIONS,
    TRIGGER_OPTIONS,
} from '@lib/worldBookService';
import { getTokenCountAsync } from '../../../stContext';

// Position badge colors
const POSITION_COLORS = {
    0: '#5b8def', // Before Char = blue
    1: '#4caf7c', // After Char = green
    2: '#9c6ce0', // Before EM = purple
    3: '#9c6ce0', // After EM = purple
    4: '#e89940', // @Depth = orange
    5: '#45b8b8', // Before AT = teal
    6: '#45b8b8', // After AT = teal
    7: '#d86098', // Outlet = pink
};

// Compact position options for inline select
const POSITION_OPTIONS = POSITION_LABELS.map(p => ({ value: p.value, label: p.short || p.label }));
const POSITION_OPTIONS_FULL = POSITION_LABELS.map(p => ({ value: p.value, label: p.label }));

// ---------------------------------------------------------------------------
// Styles — themed around primary/secondary/text, not raw fills
// ---------------------------------------------------------------------------

const s = {
    card: {
        marginBottom: '4px',
        borderRadius: '8px',
        border: '1px solid var(--lumiverse-border)',
        background: 'var(--lumiverse-bg-elevated)',
        overflow: 'hidden',
        transition: 'opacity 0.15s ease',
    },
    cardDisabled: {
        opacity: 0.5,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 10px',
        cursor: 'pointer',
        userSelect: 'none',
    },
    chevron: {
        color: 'var(--lumiverse-text-dim)',
        flexShrink: 0,
    },
    titleArea: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
    },
    title: {
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--lumiverse-text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    keywords: {
        fontSize: '11px',
        color: 'var(--lumiverse-text-dim)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    badge: {
        fontSize: '10px',
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: '4px',
        color: '#fff',
        flexShrink: 0,
        whiteSpace: 'nowrap',
    },
    indicators: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexShrink: 0,
    },
    indicator: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        flexShrink: 0,
    },
    headerBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px',
        background: 'none',
        border: 'none',
        borderRadius: '4px',
        color: 'var(--lumiverse-text-muted)',
        cursor: 'pointer',
        flexShrink: 0,
    },
    body: {
        padding: '12px',
        borderTop: '1px solid var(--lumiverse-border)',
    },
    toggleRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '8px',
    },
    toggle: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: 'var(--lumiverse-text-muted)',
        cursor: 'pointer',
        userSelect: 'none',
    },
    checkbox: {
        width: '14px',
        height: '14px',
        accentColor: 'var(--lumiverse-primary)',
        cursor: 'pointer',
    },
    numberInput: {
        width: '80px',
        padding: '6px 8px',
        background: 'var(--lumiverse-bg, rgba(0,0,0,0.2))',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '6px',
        color: 'var(--lumiverse-text)',
        fontSize: '13px',
        fontFamily: 'inherit',
    },
    tokenBadge: {
        fontSize: '11px',
        color: 'var(--lumiverse-text-dim)',
        padding: '2px 6px',
        background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.1))',
        borderRadius: '4px',
    },
    expanderBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        background: 'var(--lumiverse-bg, rgba(0,0,0,0.15))',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '6px',
        color: 'var(--lumiverse-text-muted)',
        fontSize: '11px',
        cursor: 'pointer',
    },
    depthRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '8px',
    },
    moreMenu: {
        position: 'fixed',
        background: 'var(--lumiverse-bg-elevated)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        boxShadow: 'var(--lumiverse-shadow-lg)',
        overflow: 'hidden',
        zIndex: 10010,
        minWidth: '150px',
        maxHeight: '60vh',
        overflowY: 'auto',
    },
    menuItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '8px 12px',
        background: 'none',
        border: 'none',
        color: 'var(--lumiverse-text)',
        fontSize: '12px',
        cursor: 'pointer',
        textAlign: 'left',
    },
    // Inline compact select (for position in primary row)
    inlineSelect: {
        padding: '6px 28px 6px 8px',
        background: 'var(--lumiverse-bg, rgba(0,0,0,0.15))',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '6px',
        color: 'var(--lumiverse-text)',
        fontSize: '12px',
        fontFamily: 'inherit',
        appearance: 'none',
        cursor: 'pointer',
        minWidth: '120px',
    },
    // Selective row
    selectiveRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
    },
};

// ---------------------------------------------------------------------------
// Toggle component
// ---------------------------------------------------------------------------

function Toggle({ label, checked, onChange }) {
    return (
        <label style={s.toggle}>
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                style={s.checkbox}
            />
            {label}
        </label>
    );
}

// ---------------------------------------------------------------------------
// Number input for inline use
// ---------------------------------------------------------------------------

function NumberField({ label, value, onChange, min, max, step = 1, width = '80px' }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {label && <span style={{ fontSize: '12px', color: 'var(--lumiverse-text-muted)', whiteSpace: 'nowrap' }}>{label}</span>}
            <input
                type="number"
                value={value ?? 0}
                onChange={(e) => {
                    const num = parseInt(e.target.value, 10);
                    onChange(isNaN(num) ? 0 : num);
                }}
                min={min}
                max={max}
                step={step}
                style={{ ...s.numberInput, width }}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Inline position select (compact, no FormField wrapper)
// ---------------------------------------------------------------------------

function InlinePositionSelect({ value, onChange }) {
    return (
        <div style={{ position: 'relative', flexShrink: 0 }}>
            <select
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                style={s.inlineSelect}
            >
                {POSITION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            <div style={{
                position: 'absolute', right: '8px', top: '50%',
                transform: 'translateY(-50%)', pointerEvents: 'none',
                color: 'var(--lumiverse-text-dim)',
            }}>
                <ChevronDown size={12} />
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main entry component
// ---------------------------------------------------------------------------

function WorldBookEntry({
    entry,
    isExpanded,
    onToggleExpand,
    onUpdate,
    onUpdateMulti,
    onDelete,
    onDuplicate,
    onToggleDisable,
    bookList,
    activeBookName,
    onMoveToBook,
    onCopyToBook,
    isDragging = false,
    dragHandleProps,
}) {
    const [showExpander, setShowExpander] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [menuMode, setMenuMode] = useState(null); // null | 'main' | 'moveTo' | 'copyTo'
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [tokenCount, setTokenCount] = useState(null);
    const [menuPos, setMenuPos] = useState(null);
    const moreBtnRef = useRef(null);
    const menuRef = useRef(null);
    const tokenTimerRef = useRef(null);

    // Close more menu on outside click
    useEffect(() => {
        if (!menuMode) return;
        const handler = (e) => {
            if (menuRef.current && menuRef.current.contains(e.target)) return;
            if (moreBtnRef.current && moreBtnRef.current.contains(e.target)) return;
            setMenuMode(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuMode]);

    // Token count (debounced, only when expanded)
    useEffect(() => {
        if (!isExpanded) return;
        if (tokenTimerRef.current) clearTimeout(tokenTimerRef.current);
        tokenTimerRef.current = setTimeout(async () => {
            const counter = getTokenCountAsync();
            if (counter && entry.content) {
                try {
                    const count = await counter(entry.content);
                    setTokenCount(count);
                } catch {
                    setTokenCount(null);
                }
            } else {
                setTokenCount(entry.content ? null : 0);
            }
        }, 500);
        return () => {
            if (tokenTimerRef.current) clearTimeout(tokenTimerRef.current);
        };
    }, [isExpanded, entry.content]);

    const handleHeaderClick = useCallback((e) => {
        // Don't expand if clicking a button
        if (e.target.closest('button')) return;
        onToggleExpand(entry.uid);
    }, [entry.uid, onToggleExpand]);

    const field = useCallback((name, value) => {
        onUpdate(entry.uid, name, value);
    }, [entry.uid, onUpdate]);

    const positionLabel = POSITION_LABELS.find(p => p.value === entry.position);
    const positionColor = POSITION_COLORS[entry.position] || '#888';
    const keyPreview = (entry.key || []).slice(0, 3).join(', ');
    const displayTitle = entry.comment || keyPreview || `Entry #${entry.uid}`;

    // Trigger options as select values (multi-checkbox)
    const handleTriggerToggle = useCallback((trigValue, checked) => {
        const current = entry.triggers || [];
        if (checked) {
            field('triggers', [...current, trigValue]);
        } else {
            field('triggers', current.filter(t => t !== trigValue));
        }
    }, [entry.triggers, field]);

    // Character filter helpers
    const charFilter = entry.characterFilter || { names: [], tags: [], isExclude: false };

    const handleCharFilterField = useCallback((filterField, value) => {
        const current = entry.characterFilter || { names: [], tags: [], isExclude: false };
        onUpdate(entry.uid, 'characterFilter', { ...current, [filterField]: value });
    }, [entry.uid, entry.characterFilter, onUpdate]);

    // Other books for move/copy
    const otherBooks = useMemo(() =>
        bookList.filter(b => b.name !== activeBookName),
        [bookList, activeBookName]
    );

    return (
        <>
            <div
                style={{
                    ...s.card,
                    ...(entry.disable ? s.cardDisabled : {}),
                    ...(isDragging ? { opacity: 0.5 } : {}),
                }}
            >
                {/* Header */}
                <div style={s.header} onClick={handleHeaderClick}>
                    {dragHandleProps && (
                        <div {...dragHandleProps} style={{ cursor: 'grab', color: 'var(--lumiverse-text-dim)' }}>
                            <GripVertical size={14} />
                        </div>
                    )}

                    <div style={s.chevron}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>

                    <div style={s.titleArea}>
                        <div style={{
                            ...s.title,
                            ...(entry.disable ? { textDecoration: 'line-through' } : {}),
                        }}>
                            {displayTitle}
                        </div>
                        {!isExpanded && keyPreview && entry.comment && (
                            <div style={s.keywords}>{keyPreview}</div>
                        )}
                    </div>

                    {/* Indicators */}
                    <div style={s.indicators}>
                        {entry.constant && <div style={{ ...s.indicator, background: '#5b8def' }} title="Constant" />}
                        {entry.vectorized && <div style={{ ...s.indicator, background: '#9c6ce0' }} title="Vectorized" />}
                    </div>

                    {/* Position badge */}
                    <span style={{ ...s.badge, background: positionColor }}>
                        {positionLabel?.short || '?'}
                    </span>

                    {/* Enable/disable */}
                    <button
                        style={s.headerBtn}
                        onClick={(e) => { e.stopPropagation(); onToggleDisable(entry.uid); }}
                        title={entry.disable ? 'Enable' : 'Disable'}
                        type="button"
                    >
                        {entry.disable ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>

                    {/* Actions */}
                    <button
                        style={s.headerBtn}
                        onClick={(e) => { e.stopPropagation(); onDuplicate(entry.uid); }}
                        title="Duplicate"
                        type="button"
                    >
                        <Copy size={14} />
                    </button>

                    <button
                        ref={moreBtnRef}
                        style={s.headerBtn}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!menuMode && moreBtnRef.current) {
                                const rect = moreBtnRef.current.getBoundingClientRect();
                                setMenuPos({ top: rect.bottom + 2, right: window.innerWidth - rect.right });
                                setMenuMode('main');
                            } else {
                                setMenuMode(null);
                            }
                        }}
                        title="More"
                        type="button"
                    >
                        <MoreVertical size={14} />
                    </button>
                </div>

                {/* ==================== Expanded body ==================== */}
                {isExpanded && (
                    <div style={s.body}>

                        {/* ---- Primary zone: Title + Position + Order ---- */}
                        <div className="lumiverse-wb-primary-row">
                            <div>
                                <TextInput
                                    value={entry.comment || ''}
                                    onChange={(v) => field('comment', v)}
                                    placeholder="Title / Memo..."
                                />
                            </div>
                            <InlinePositionSelect
                                value={entry.position}
                                onChange={(v) => field('position', v)}
                            />
                            <NumberField label="Order" value={entry.order} onChange={(v) => field('order', v)} width="64px" />
                        </div>

                        {/* Depth + Role (shown when position is @Depth) */}
                        {entry.position === 4 && (
                            <div style={s.depthRow}>
                                <NumberField label="Depth" value={entry.depth} onChange={(v) => field('depth', v)} min={0} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--lumiverse-text-muted)' }}>Role</span>
                                    <select
                                        value={entry.role}
                                        onChange={(e) => field('role', Number(e.target.value))}
                                        style={{ ...s.inlineSelect, minWidth: '100px' }}
                                    >
                                        {ROLE_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Outlet name (shown when position is Outlet) */}
                        {entry.position === 7 && (
                            <div style={{ marginBottom: '12px' }}>
                                <TextInput
                                    value={entry.outletName || ''}
                                    onChange={(v) => field('outletName', v)}
                                    placeholder="Outlet name..."
                                />
                            </div>
                        )}

                        {/* ---- Content textarea ---- */}
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <div style={{ flex: 1 }}>
                                <TextArea
                                    value={entry.content || ''}
                                    onChange={(v) => field('content', v)}
                                    placeholder="Entry content..."
                                    rows={5}
                                />
                            </div>
                            <button
                                style={s.expanderBtn}
                                onClick={() => setShowExpander(true)}
                                type="button"
                                title="Expand editor"
                            >
                                <Maximize2 size={12} />
                            </button>
                        </div>
                        {tokenCount !== null && (
                            <div style={{ marginBottom: '12px' }}>
                                <span style={s.tokenBadge}>{tokenCount} tokens</span>
                            </div>
                        )}

                        {/* ---- Keywords (side-by-side on desktop) ---- */}
                        <div className="lumiverse-wb-keywords-row">
                            <div>
                                <span className="lumiverse-wb-kw-label">Primary Keywords</span>
                                <TagPillInput
                                    value={entry.key || []}
                                    onChange={(v) => field('key', v)}
                                    placeholder="Add keyword..."
                                />
                            </div>
                            <div>
                                <span className="lumiverse-wb-kw-label">Secondary Keywords</span>
                                <TagPillInput
                                    value={entry.keysecondary || []}
                                    onChange={(v) => field('keysecondary', v)}
                                    placeholder="Add secondary keyword..."
                                />
                            </div>
                        </div>

                        {/* Selective + Logic inline */}
                        <div style={s.selectiveRow}>
                            <Toggle label="Selective" checked={entry.selective} onChange={(v) => field('selective', v)} />
                            {entry.selective && (
                                <div style={{ minWidth: '140px' }}>
                                    <select
                                        value={entry.selectiveLogic}
                                        onChange={(e) => field('selectiveLogic', Number(e.target.value))}
                                        style={{ ...s.inlineSelect, width: '100%' }}
                                    >
                                        {SELECTIVE_LOGIC_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* ============ Advanced settings accordion ============ */}
                        <div
                            className="lumiverse-wb-advanced-toggle"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                        >
                            <div style={{ color: 'var(--lumiverse-primary)' }}>
                                {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>
                            <span>Entry Settings</span>
                        </div>

                        {showAdvanced && (
                            <div className="lumiverse-wb-advanced-grid">
                                {/* Activation */}
                                <EditorSection Icon={Zap} title="Activation" defaultExpanded>
                                    <div style={s.toggleRow}>
                                        <Toggle label="Constant" checked={entry.constant} onChange={(v) => field('constant', v)} />
                                        <Toggle label="Vectorized" checked={entry.vectorized} onChange={(v) => field('vectorized', v)} />
                                        <Toggle label="Disabled" checked={entry.disable} onChange={(v) => field('disable', v)} />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <Toggle label="Use Probability" checked={entry.useProbability} onChange={(v) => field('useProbability', v)} />
                                        {entry.useProbability && (
                                            <NumberField label="Trigger%" value={entry.probability} onChange={(v) => field('probability', v)} min={0} max={100} />
                                        )}
                                    </div>
                                </EditorSection>

                                {/* Scan Overrides */}
                                <EditorSection Icon={Scan} title="Scan Overrides" defaultExpanded>
                                    <FormField label="Scan Depth">
                                        <NullableInput value={entry.scanDepth} onChange={(v) => field('scanDepth', v)} label="Override" type="number" min={0} max={100} />
                                    </FormField>
                                    <FormField label="Case Sensitive">
                                        <NullableInput value={entry.caseSensitive} onChange={(v) => field('caseSensitive', v)} label="Override" type="toggle" />
                                    </FormField>
                                    <FormField label="Match Whole Words">
                                        <NullableInput value={entry.matchWholeWords} onChange={(v) => field('matchWholeWords', v)} label="Override" type="toggle" />
                                    </FormField>
                                    <FormField label="Group Scoring">
                                        <NullableInput value={entry.useGroupScoring} onChange={(v) => field('useGroupScoring', v)} label="Override" type="toggle" />
                                    </FormField>
                                </EditorSection>

                                {/* Matching Sources */}
                                <EditorSection Icon={Users} title="Matching Sources" defaultExpanded>
                                    <div style={s.toggleRow}>
                                        <Toggle label="Persona Description" checked={entry.matchPersonaDescription} onChange={(v) => field('matchPersonaDescription', v)} />
                                        <Toggle label="Character Description" checked={entry.matchCharacterDescription} onChange={(v) => field('matchCharacterDescription', v)} />
                                        <Toggle label="Character Personality" checked={entry.matchCharacterPersonality} onChange={(v) => field('matchCharacterPersonality', v)} />
                                        <Toggle label="Depth Prompt" checked={entry.matchCharacterDepthPrompt} onChange={(v) => field('matchCharacterDepthPrompt', v)} />
                                        <Toggle label="Scenario" checked={entry.matchScenario} onChange={(v) => field('matchScenario', v)} />
                                        <Toggle label="Creator Notes" checked={entry.matchCreatorNotes} onChange={(v) => field('matchCreatorNotes', v)} />
                                    </div>
                                </EditorSection>

                                {/* Recursion */}
                                <EditorSection Icon={GitBranch} title="Recursion" defaultExpanded>
                                    <div style={s.toggleRow}>
                                        <Toggle label="Exclude Recursion" checked={entry.excludeRecursion} onChange={(v) => field('excludeRecursion', v)} />
                                        <Toggle label="Prevent Recursion" checked={entry.preventRecursion} onChange={(v) => field('preventRecursion', v)} />
                                        <Toggle label="Delay Until Recursion" checked={entry.delayUntilRecursion} onChange={(v) => field('delayUntilRecursion', v)} />
                                    </div>
                                </EditorSection>

                                {/* Grouping */}
                                <EditorSection Icon={Layers} title="Grouping" defaultExpanded>
                                    <FormField label="Group">
                                        <TextInput
                                            value={entry.group || ''}
                                            onChange={(v) => field('group', v)}
                                            placeholder="Group name..."
                                        />
                                    </FormField>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <Toggle label="Group Override" checked={entry.groupOverride} onChange={(v) => field('groupOverride', v)} />
                                        <NumberField label="Weight" value={entry.groupWeight} onChange={(v) => field('groupWeight', v)} min={1} max={10000} />
                                    </div>
                                </EditorSection>

                                {/* Timed Effects */}
                                <EditorSection Icon={Clock} title="Timed Effects" defaultExpanded>
                                    <FormField label="Sticky">
                                        <NullableInput value={entry.sticky} onChange={(v) => field('sticky', v)} label="Enable" type="number" min={0} />
                                    </FormField>
                                    <FormField label="Cooldown">
                                        <NullableInput value={entry.cooldown} onChange={(v) => field('cooldown', v)} label="Enable" type="number" min={0} />
                                    </FormField>
                                    <FormField label="Delay">
                                        <NullableInput value={entry.delay} onChange={(v) => field('delay', v)} label="Enable" type="number" min={0} />
                                    </FormField>
                                </EditorSection>

                                {/* Character Filter */}
                                <EditorSection Icon={Filter} title="Character Filter" defaultExpanded={false}>
                                    <FormField label="Character Names">
                                        <TagPillInput
                                            value={charFilter.names || []}
                                            onChange={(v) => handleCharFilterField('names', v)}
                                            placeholder="Add character name..."
                                        />
                                    </FormField>
                                    <FormField label="Character Tags">
                                        <TagPillInput
                                            value={charFilter.tags || []}
                                            onChange={(v) => handleCharFilterField('tags', v)}
                                            placeholder="Add tag..."
                                        />
                                    </FormField>
                                    <div style={s.toggleRow}>
                                        <Toggle
                                            label={charFilter.isExclude ? 'Exclude (filter out)' : 'Include (filter in)'}
                                            checked={charFilter.isExclude}
                                            onChange={(v) => handleCharFilterField('isExclude', v)}
                                        />
                                    </div>
                                </EditorSection>

                                {/* Triggers */}
                                <EditorSection Icon={Terminal} title="Triggers" defaultExpanded={false}>
                                    <div style={s.toggleRow}>
                                        {TRIGGER_OPTIONS.map(opt => (
                                            <Toggle
                                                key={opt.value}
                                                label={opt.label}
                                                checked={(entry.triggers || []).includes(opt.value)}
                                                onChange={(checked) => handleTriggerToggle(opt.value, checked)}
                                            />
                                        ))}
                                    </div>
                                </EditorSection>

                                {/* Advanced */}
                                <EditorSection Icon={Settings} title="Advanced" defaultExpanded={false}>
                                    <div style={s.toggleRow}>
                                        <Toggle label="Add Memo" checked={entry.addMemo} onChange={(v) => field('addMemo', v)} />
                                        <Toggle label="Ignore Budget" checked={entry.ignoreBudget} onChange={(v) => field('ignoreBudget', v)} />
                                    </div>
                                    <FormField label="Automation ID">
                                        <TextInput
                                            value={entry.automationId || ''}
                                            onChange={(v) => field('automationId', v)}
                                            placeholder="Automation ID..."
                                        />
                                    </FormField>
                                </EditorSection>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* More menu — portaled to body so it isn't clipped by overflow:hidden */}
            {menuMode && menuPos && createPortal(
                <div
                    ref={menuRef}
                    style={{ ...s.moreMenu, top: menuPos.top, right: menuPos.right }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {menuMode === 'main' && (
                        <>
                            {otherBooks.length > 0 && (
                                <>
                                    <button
                                        style={s.menuItem}
                                        onClick={() => setMenuMode('moveTo')}
                                        type="button"
                                    >
                                        <ArrowRightLeft size={12} /> Move to...
                                    </button>
                                    <button
                                        style={s.menuItem}
                                        onClick={() => setMenuMode('copyTo')}
                                        type="button"
                                    >
                                        <ClipboardCopy size={12} /> Copy to...
                                    </button>
                                </>
                            )}
                            <button
                                style={{ ...s.menuItem, color: 'var(--lumiverse-danger)' }}
                                onClick={() => { setShowDeleteConfirm(true); setMenuMode(null); }}
                                type="button"
                            >
                                <Trash2 size={12} /> Delete
                            </button>
                        </>
                    )}
                    {menuMode === 'moveTo' && (
                        <>
                            <button
                                style={{ ...s.menuItem, color: 'var(--lumiverse-text-dim)', fontSize: '11px' }}
                                onClick={() => setMenuMode('main')}
                                type="button"
                            >
                                <ChevronRight size={12} style={{ transform: 'rotate(180deg)' }} /> Back
                            </button>
                            <div style={{ borderTop: '1px solid var(--lumiverse-border)' }} />
                            {otherBooks.map(b => (
                                <button
                                    key={b.name}
                                    style={s.menuItem}
                                    onClick={() => { onMoveToBook(entry.uid, b.name); setMenuMode(null); }}
                                    type="button"
                                >
                                    {b.name}
                                </button>
                            ))}
                        </>
                    )}
                    {menuMode === 'copyTo' && (
                        <>
                            <button
                                style={{ ...s.menuItem, color: 'var(--lumiverse-text-dim)', fontSize: '11px' }}
                                onClick={() => setMenuMode('main')}
                                type="button"
                            >
                                <ChevronRight size={12} style={{ transform: 'rotate(180deg)' }} /> Back
                            </button>
                            <div style={{ borderTop: '1px solid var(--lumiverse-border)' }} />
                            {otherBooks.map(b => (
                                <button
                                    key={b.name}
                                    style={s.menuItem}
                                    onClick={() => { onCopyToBook(entry.uid, b.name); setMenuMode(null); }}
                                    type="button"
                                >
                                    {b.name}
                                </button>
                            ))}
                        </>
                    )}
                </div>,
                document.body
            )}

            {/* Text Expander */}
            <TextExpanderModal
                isOpen={showExpander}
                onClose={() => setShowExpander(false)}
                value={entry.content || ''}
                onChange={(v) => field('content', v)}
                title={`Edit: ${displayTitle}`}
            />

            {/* Delete confirmation */}
            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onCancel={() => setShowDeleteConfirm(false)}
                onConfirm={() => { onDelete(entry.uid); setShowDeleteConfirm(false); }}
                title="Delete Entry"
                message={`Delete "${displayTitle}"? This cannot be undone.`}
                confirmText="Delete"
                variant="danger"
            />
        </>
    );
}

// Custom memo comparator — only re-render when entry data or expansion state changes
function arePropsEqual(prev, next) {
    if (prev.isExpanded !== next.isExpanded) return false;
    if (prev.isDragging !== next.isDragging) return false;

    const pe = prev.entry;
    const ne = next.entry;
    if (pe === ne) return true;
    if (pe.uid !== ne.uid) return false;
    if (pe.comment !== ne.comment) return false;
    if (pe.content !== ne.content) return false;
    if (pe.disable !== ne.disable) return false;
    if (pe.position !== ne.position) return false;
    if (pe.constant !== ne.constant) return false;
    if (pe.vectorized !== ne.vectorized) return false;
    if (pe.selective !== ne.selective) return false;
    if (pe.probability !== ne.probability) return false;
    if (pe.depth !== ne.depth) return false;
    if (pe.order !== ne.order) return false;

    // Deep compare arrays only when expanded (performance)
    if (next.isExpanded) {
        const pKeys = (pe.key || []).join(',');
        const nKeys = (ne.key || []).join(',');
        if (pKeys !== nKeys) return false;
    }

    return true;
}

export default memo(WorldBookEntry, arePropsEqual);
