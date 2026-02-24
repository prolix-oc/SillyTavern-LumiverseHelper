import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    GripVertical,
    ChevronDown,
    ChevronRight,
    Plus,
    Trash2,
    X,
    Edit2,
    Eye,
    EyeOff,
    Check,
    ArrowLeft,
    Download,
    Upload,
    Copy,
    Layers,
    Hash,
    Lock,
    MoreVertical,
    Search,
    FileText,
    Zap,
    MessageCircle,
    Settings2,
    RotateCcw,
    Wifi,
    Code2,
    AlertTriangle,
    MessageSquare,
    Bot,
    Wrench,
    Dice1,
    StopCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { useLoomBuilder } from '../../hooks/useLoomBuilder';
import { createBlock, createMarkerBlock, MARKER_NAMES, DEFAULT_SAMPLER_OVERRIDES as _DEFAULT_SAMPLER_OVERRIDES, DEFAULT_PROMPT_BEHAVIOR as _DEFAULT_PROMPT_BEHAVIOR, DEFAULT_COMPLETION_SETTINGS as _DEFAULT_COMPLETION_SETTINGS, DEFAULT_ADVANCED_SETTINGS as _DEFAULT_ADVANCED_SETTINGS } from '../../../lib/lucidLoomService';
import ConfirmationModal from '../shared/ConfirmationModal';

// ============================================================================
// PROVIDER DISPLAY NAMES — pretty-print API source identifiers
// ============================================================================

const PROVIDER_DISPLAY_NAMES = {
    openai: 'OpenAI',
    azure_openai: 'Azure OpenAI',
    claude: 'Claude',
    makersuite: 'Google AI Studio',
    vertexai: 'Vertex AI',
    openrouter: 'OpenRouter',
    custom: 'Custom',
    mistralai: 'Mistral',
    cohere: 'Cohere',
    perplexity: 'Perplexity',
    groq: 'Groq',
    deepseek: 'DeepSeek',
    xai: 'xAI',
    chutes: 'Chutes',
    nanogpt: 'NanoGPT',
    electronhub: 'ElectronHub',
    ai21: 'AI21',
    textgenerationwebui: 'Text Gen WebUI',
    kobold: 'KoboldAI',
    novel: 'NovelAI',
};

function formatProfileLabel(connectionProfile) {
    const sourceName = PROVIDER_DISPLAY_NAMES[connectionProfile?.source]
        || connectionProfile?.source
        || connectionProfile?.mainApi
        || 'Unknown';
    const modelName = connectionProfile?.model?.split('/').pop() || null;
    return { sourceName, modelName };
}

// ============================================================================
// PROMPT TEMPLATES — pre-filled blocks for "Add Prompt" dropdown
// ============================================================================

const PROMPT_TEMPLATES = [
    { name: 'Blank Prompt', content: '', role: 'system', description: 'Empty prompt block' },
    { section: 'Lumiverse Lumia' },
    { name: 'Lumia Definition(s)', content: '{{lumiaDef}}', role: 'system', description: 'Physical definition of selected Lumia(e)' },
    { name: 'Lumia Personality + Behaviors', content: '{{lumiaPersonality}}\n\n{{lumiaBehavior}}', role: 'system', description: 'Combined personality and behavioral traits' },
    { name: 'Lumia Quirks', content: '{{lumiaQuirks}}', role: 'system', description: 'Behavioral quirks' },
    { name: 'Lumia OOC', content: '{{lumiaOOC}}', role: 'system', description: 'OOC commentary trigger' },
    { section: 'Lumiverse Loom' },
    { name: 'Loom Narrative Style', content: '{{loomStyle}}', role: 'system', description: 'Prose style guidance' },
    { name: 'Loom Utilities', content: '{{loomUtils}}', role: 'system', description: 'All utility prompts' },
    { name: 'Loom Retrofits', content: '{{loomRetrofits}}', role: 'system', description: 'Character/story retrofits' },
    { name: 'Sovereign Hand', content: '{{loomSovHand}}', role: 'system', description: 'Co-pilot mode prompt' },
    { name: 'Story Summary', content: '{{loomSummary}}', role: 'system', description: 'Current story summary' },
    { section: 'Lumiverse Council' },
    { name: 'Council Instructions', content: '{{lumiaCouncilInst}}', role: 'system', description: 'Council mode instructions' },
    { name: 'Council Deliberation', content: '{{lumiaCouncilDeliberation}}', role: 'system', description: 'Tool execution results' },
    { name: 'State Synthesis', content: '{{lumiaStateSynthesis}}', role: 'system', description: 'Member state synthesis' },
    { section: 'SillyTavern' },
    { name: 'Scenario', content: '{{scenario}}', role: 'system', description: 'Character scenario' },
    { name: 'Character Description', content: '{{description}}', role: 'system', description: 'Physical description' },
    { name: 'Personality', content: '{{personality}}', role: 'system', description: 'Character personality' },
    { name: 'User Persona', content: '{{persona}}', role: 'system', description: 'User persona description' },
    { name: 'Example Messages', content: '{{mesExamples}}', role: 'system', description: 'Example dialogue' },
];

// ============================================================================
// STYLES
// ============================================================================

const styles = {
    // Base layout — extended by getLayoutStyle(compact) below
    layoutBase: {
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--lumiverse-bg)',
        color: 'var(--lumiverse-text)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        background: 'var(--lumiverse-bg-elevated)',
        borderBottom: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
    },
    title: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
    },
    toolbar: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        borderBottom: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
        background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.1))',
        position: 'relative',
        zIndex: 10,
        flexWrap: 'wrap',
    },
    scrollArea: {
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        padding: '12px',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%',
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    label: {
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--lumiverse-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    input: {
        padding: '10px 12px',
        background: 'var(--lumiverse-input-bg, rgba(0, 0, 0, 0.2))',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        color: 'var(--lumiverse-text)',
        fontSize: '14px',
        outline: 'none',
        fontFamily: 'inherit',
    },
    textarea: {
        padding: '12px',
        background: 'var(--lumiverse-input-bg, rgba(0, 0, 0, 0.2))',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        color: 'var(--lumiverse-text)',
        fontSize: '14px',
        fontFamily: 'var(--lumiverse-font-mono, monospace)',
        minHeight: '200px',
        resize: 'vertical',
        outline: 'none',
        lineHeight: '1.5',
    },
    select: {
        padding: '10px 12px',
        background: 'var(--lumiverse-input-bg, rgba(0, 0, 0, 0.2))',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        color: 'var(--lumiverse-text)',
        fontSize: '14px',
        outline: 'none',
        cursor: 'pointer',
    },
    item: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        background: 'var(--lumiverse-bg-elevated)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        marginBottom: '4px',
        transition: 'all 0.15s ease',
        touchAction: 'none',
        gap: '8px',
    },
    itemDragging: {
        opacity: 0.5,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        borderColor: 'var(--lumiverse-primary)',
    },
    itemIndented: {
        marginLeft: '16px',
        borderLeft: '2px solid var(--lumiverse-primary-hover, rgba(147, 112, 219, 0.25))',
        borderTopLeftRadius: '0',
        borderBottomLeftRadius: '0',
    },
    marker: {
        background: 'var(--lumiverse-fill-subtle, rgba(147, 112, 219, 0.08))',
        borderColor: 'var(--lumiverse-primary-hover, rgba(147, 112, 219, 0.25))',
        borderStyle: 'dashed',
    },
    categoryHeader: {
        background: 'var(--lumiverse-fill-moderate, rgba(0, 0, 0, 0.15))',
        borderColor: 'var(--lumiverse-border-neutral, rgba(128, 128, 128, 0.3))',
        cursor: 'pointer',
        userSelect: 'none',
        marginBottom: '2px',
        marginTop: '8px',
        borderRadius: '8px',
    },
    categoryName: {
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: 'var(--lumiverse-text-muted)',
    },
    categoryCount: {
        fontSize: '10px',
        color: 'var(--lumiverse-text-dim)',
        marginLeft: '4px',
    },
    badge: {
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '4px',
        textTransform: 'uppercase',
        fontWeight: 600,
        flexShrink: 0,
    },
    badgeSystem: { background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' },
    badgeUser: { background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' },
    badgeAssistant: { background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' },
    badgeMarker: { background: 'rgba(147, 112, 219, 0.2)', color: '#a78bfa' },
    iconBtn: {
        padding: '6px',
        borderRadius: '6px',
        background: 'transparent',
        border: 'none',
        color: 'var(--lumiverse-text-muted)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    btn: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid var(--lumiverse-border)',
        background: 'var(--lumiverse-bg-elevated)',
        color: 'var(--lumiverse-text)',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    btnPrimary: {
        background: 'var(--lumiverse-primary)',
        color: 'white',
        borderColor: 'var(--lumiverse-primary)',
    },
    btnDanger: {
        background: 'var(--lumiverse-danger, #ef4444)',
        color: 'white',
        borderColor: 'var(--lumiverse-danger, #ef4444)',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center',
        color: 'var(--lumiverse-text-muted)',
        gap: '12px',
    },
    macroGroup: {
        padding: '8px 0',
    },
    macroGroupTitle: {
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--lumiverse-text-dim)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        padding: '4px 12px',
    },
    macroItem: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        cursor: 'pointer',
        borderRadius: '4px',
        fontSize: '13px',
        transition: 'background 0.1s',
    },
    dropdownMenu: {
        position: 'absolute',
        background: 'var(--lumiverse-bg-elevated)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        padding: '4px',
        minWidth: '220px',
        zIndex: 100,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        maxHeight: '320px',
        overflowY: 'auto',
    },
    sectionLabel: {
        fontSize: '10px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: 'var(--lumiverse-text-dim)',
        padding: '6px 12px 2px',
    },
    postHistoryNote: {
        fontSize: '11px',
        color: 'var(--lumiverse-warning, #f59e0b)',
        padding: '4px 8px',
        background: 'rgba(245, 158, 11, 0.1)',
        borderRadius: '4px',
        marginTop: '4px',
    },
};

/**
 * Compute layout style based on mode.
 * Compact (sidebar): absolute positioning to fill .lumiverse-vp-content
 * (which has position: relative + overflow-y: auto). This takes the
 * LoomBuilder out of the parent scroll flow so it manages its own
 * internal scrolling and keeps the action bar pinned.
 * Modal: normal flex child with height constraint from the modal's max-height.
 */
function getLayoutStyle(compact) {
    if (compact) {
        return {
            ...styles.layoutBase,
            position: 'absolute',
            inset: 0,
        };
    }
    return {
        ...styles.layoutBase,
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
    };
}

const ROLE_BADGES = {
    system: styles.badgeSystem,
    user: styles.badgeUser,
    assistant: styles.badgeAssistant,
};

// Use MARKER_NAMES from service for display labels
const MARKER_LABELS = MARKER_NAMES;

// Marker types available in the "Add Marker" dropdown (excludes category, which has its own button)
const ADDABLE_MARKERS = [
    { section: 'Structural' },
    'chat_history',
    'world_info_before',
    'world_info_after',
    { section: 'Character' },
    'char_description',
    'char_personality',
    'persona_description',
    'scenario',
    'dialogue_examples',
    { section: 'Prompts' },
    'main_prompt',
    'enhance_definitions',
    'jailbreak',
    'nsfw_prompt',
];

// ============================================================================
// HELPERS — category group computation
// ============================================================================

/**
 * Compute category groups from a flat block array.
 * Each group has an optional categoryBlock and an array of child blocks.
 * Blocks before any category are "ungrouped" (categoryBlock = null).
 */
function computeGroups(blocks) {
    if (!blocks?.length) return [];
    const result = [];
    let currentGroup = { categoryBlock: null, children: [] };

    for (const block of blocks) {
        if (block.marker === 'category') {
            if (currentGroup.categoryBlock || currentGroup.children.length > 0) {
                result.push(currentGroup);
            }
            currentGroup = { categoryBlock: block, children: [] };
        } else {
            currentGroup.children.push(block);
        }
    }
    if (currentGroup.categoryBlock || currentGroup.children.length > 0) {
        result.push(currentGroup);
    }
    return result;
}

// ============================================================================
// SORTABLE CATEGORY ITEM (accordion header)
// ============================================================================

function SortableCategoryItem({ block, isCollapsed, onToggleCollapse, onEdit, onDelete, onToggle, childCount }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: block.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const isDisabled = !block.enabled;
    const displayName = block.name.replace(/^━\s*/, '');

    const itemStyle = {
        ...styles.item,
        ...styles.categoryHeader,
        ...(isDragging ? styles.itemDragging : {}),
        ...(isDisabled ? { opacity: 0.45, filter: 'grayscale(0.5)' } : {}),
    };

    return (
        <div ref={setNodeRef} style={{ ...itemStyle, ...style }} {...attributes}>
            {/* Drag handle */}
            <span
                {...listeners}
                style={{ ...styles.iconBtn, cursor: 'grab', touchAction: 'none' }}
                title="Drag to reorder (moves all items in this category)"
            >
                <GripVertical size={14} />
            </span>

            {/* Collapse toggle */}
            <button
                style={styles.iconBtn}
                onClick={onToggleCollapse}
                title={isCollapsed ? 'Expand category' : 'Collapse category'}
                type="button"
            >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Category name */}
            <div
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                onClick={onToggleCollapse}
            >
                <span style={styles.categoryName}>
                    {displayName}
                </span>
                <span style={styles.categoryCount}>
                    ({childCount})
                </span>
            </div>

            {/* Actions */}
            <button
                style={styles.iconBtn}
                onClick={() => onToggle(block.id)}
                title={block.enabled ? 'Disable category' : 'Enable category'}
                type="button"
            >
                {block.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <button
                style={styles.iconBtn}
                onClick={() => onEdit(block)}
                title="Rename"
                type="button"
            >
                <Edit2 size={14} />
            </button>
            <button
                style={{ ...styles.iconBtn, color: 'var(--lumiverse-danger, #ef4444)' }}
                onClick={() => onDelete(block.id)}
                title="Delete category"
                type="button"
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
}

// ============================================================================
// SORTABLE BLOCK ITEM
// ============================================================================

function SortableBlockItem({ block, onEdit, onDelete, onToggle, indented }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: block.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const isMarker = block.marker && block.marker !== 'category';
    const isDisabled = !block.enabled;

    const itemStyle = {
        ...styles.item,
        ...(isDragging ? styles.itemDragging : {}),
        ...(isMarker ? styles.marker : {}),
        ...(indented ? styles.itemIndented : {}),
        ...(isDisabled ? { opacity: 0.45, filter: 'grayscale(0.5)' } : {}),
    };

    const preview = block.content
        ? block.content.substring(0, 50) + (block.content.length > 50 ? '...' : '')
        : '';

    return (
        <div ref={setNodeRef} style={{ ...itemStyle, ...style }} {...attributes}>
            {/* Drag handle */}
            <span
                {...listeners}
                style={{ ...styles.iconBtn, cursor: 'grab', touchAction: 'none' }}
                title="Drag to reorder"
            >
                <GripVertical size={14} />
            </span>

            {/* Content area */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isMarker && <Hash size={12} style={{ marginRight: '4px', opacity: 0.6 }} />}
                        {block.isLocked && <Lock size={10} style={{ marginRight: '4px', opacity: 0.4 }} />}
                        {block.name}
                    </span>
                    {!isMarker && (
                        <span style={{ ...styles.badge, ...(ROLE_BADGES[block.role] || styles.badgeSystem) }}>
                            {block.role}
                        </span>
                    )}
                    {isMarker && (
                        <span style={{ ...styles.badge, ...styles.badgeMarker }}>marker</span>
                    )}
                    {/* Injection trigger badges */}
                    {block.injectionTrigger?.length > 0 && (
                        <span style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                            {block.injectionTrigger.map(t => {
                                const meta = INJECTION_TRIGGER_TYPES.find(tt => tt.value === t);
                                return meta ? (
                                    <span key={t} style={{
                                        fontSize: '8px', fontWeight: 700, padding: '1px 3px',
                                        borderRadius: '3px', background: 'rgba(147, 112, 219, 0.15)',
                                        color: 'var(--lumiverse-primary)', lineHeight: 1,
                                    }}>
                                        {meta.shortLabel}
                                    </span>
                                ) : null;
                            })}
                        </span>
                    )}
                </div>
                {preview && !isMarker && (
                    <span style={{ fontSize: '11px', color: 'var(--lumiverse-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {preview}
                    </span>
                )}
            </div>

            {/* Actions */}
            <button
                style={styles.iconBtn}
                onClick={() => onToggle(block.id)}
                title={block.enabled ? 'Disable' : 'Enable'}
                type="button"
            >
                {block.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            {!block.isLocked && (
                <>
                    <button
                        style={styles.iconBtn}
                        onClick={() => onEdit(block)}
                        title="Edit"
                        type="button"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        style={{ ...styles.iconBtn, color: 'var(--lumiverse-danger, #ef4444)' }}
                        onClick={() => onDelete(block.id)}
                        title="Delete"
                        type="button"
                    >
                        <Trash2 size={14} />
                    </button>
                </>
            )}
        </div>
    );
}

// ============================================================================
// BLOCK EDITOR (slide-in panel)
// ============================================================================

function BlockEditor({ block, onSave, onBack, availableMacros, compact }) {
    const [name, setName] = useState(block.name);
    const [role, setRole] = useState(block.role || 'system');
    const [content, setContent] = useState(block.content || '');
    const [position, setPosition] = useState(block.position || 'pre_history');
    const [depth, setDepth] = useState(block.depth || 0);
    const [isLocked, setIsLocked] = useState(block.isLocked || false);
    const [injectionTrigger, setInjectionTrigger] = useState(block.injectionTrigger || []);
    const [showMacros, setShowMacros] = useState(false);
    const [macroSearch, setMacroSearch] = useState('');
    const textareaRef = useRef(null);

    const handlePositionChange = (newPosition) => {
        setPosition(newPosition);
        // Auto-set role based on position
        if (newPosition === 'post_history') {
            setRole('assistant');
        } else if (newPosition === 'pre_history' && role === 'assistant') {
            setRole('system');
        }
    };

    const handleSave = () => {
        onSave({
            name,
            role,
            content,
            position,
            depth: position === 'in_history' ? depth : 0,
            isLocked,
            injectionTrigger,
        });
    };

    const toggleTrigger = (value) => {
        setInjectionTrigger(prev => {
            if (prev.includes(value)) return prev.filter(v => v !== value);
            return [...prev, value];
        });
    };

    const insertMacro = (syntax) => {
        const ta = textareaRef.current;
        if (!ta) {
            setContent(prev => prev + syntax);
            return;
        }
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newContent = content.substring(0, start) + syntax + content.substring(end);
        setContent(newContent);
        setShowMacros(false);
        requestAnimationFrame(() => {
            ta.focus();
            ta.selectionStart = ta.selectionEnd = start + syntax.length;
        });
    };

    const filteredMacros = useMemo(() => {
        if (!macroSearch.trim()) return availableMacros;
        const q = macroSearch.toLowerCase();
        return availableMacros.map(group => ({
            ...group,
            macros: group.macros.filter(m =>
                m.name.toLowerCase().includes(q) ||
                m.syntax.toLowerCase().includes(q) ||
                m.description.toLowerCase().includes(q)
            ),
        })).filter(g => g.macros.length > 0);
    }, [availableMacros, macroSearch]);

    return (
        <div style={getLayoutStyle(compact)}>
            {/* Only show header in non-compact mode (modal) */}
            {!compact && (
                <div style={styles.header}>
                    <button style={styles.iconBtn} onClick={onBack} title="Back to list" type="button">
                        <ArrowLeft size={18} />
                    </button>
                    <h3 style={styles.title}>Edit Block</h3>
                    <div style={{ flex: 1 }} />
                    <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleSave} type="button">
                        <Check size={14} /> Save
                    </button>
                </div>
            )}
            {/* In compact mode, show back + save as a toolbar */}
            {compact && (
                <div style={{ ...styles.toolbar, justifyContent: 'space-between' }}>
                    <button style={styles.iconBtn} onClick={onBack} title="Back to list" type="button">
                        <ArrowLeft size={18} />
                    </button>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Edit Block</span>
                    <button style={{ ...styles.btn, ...styles.btnPrimary, padding: '6px 10px', fontSize: '12px' }} onClick={handleSave} type="button">
                        <Check size={12} /> Save
                    </button>
                </div>
            )}

            <div style={styles.scrollArea}>
                <div style={styles.form}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Name</label>
                        <input
                            style={styles.input}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Block name"
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ ...styles.formGroup, flex: 1, minWidth: '120px' }}>
                            <label style={styles.label}>Role</label>
                            <select style={styles.select} value={role} onChange={e => setRole(e.target.value)}>
                                <option value="system">System</option>
                                <option value="user">User</option>
                                <option value="assistant">Assistant</option>
                            </select>
                            {position === 'post_history' && (
                                <div style={styles.postHistoryNote}>
                                    Post-history blocks are sent as assistant messages.
                                </div>
                            )}
                        </div>

                        <div style={{ ...styles.formGroup, flex: 1, minWidth: '140px' }}>
                            <label style={styles.label}>Position</label>
                            <select style={styles.select} value={position} onChange={e => handlePositionChange(e.target.value)}>
                                <option value="pre_history">Before Chat History</option>
                                <option value="post_history">After Chat History</option>
                                <option value="in_history">Within Chat History</option>
                            </select>
                        </div>

                        {position === 'in_history' && (
                            <div style={{ ...styles.formGroup, width: '100px' }}>
                                <label style={styles.label}>Depth</label>
                                <input
                                    style={styles.input}
                                    type="number"
                                    min="0"
                                    value={depth}
                                    onChange={e => setDepth(parseInt(e.target.value) || 0)}
                                />
                            </div>
                        )}
                    </div>

                    <div style={styles.formGroup}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <label style={styles.label}>Content</label>
                            <button
                                style={{ ...styles.btn, padding: '4px 8px', fontSize: '11px' }}
                                onClick={() => setShowMacros(!showMacros)}
                                type="button"
                            >
                                <Hash size={12} /> {showMacros ? 'Hide Macros' : 'Insert Macro'}
                            </button>
                        </div>

                        {showMacros && (
                            <div style={{
                                border: '1px solid var(--lumiverse-border)',
                                borderRadius: '8px',
                                background: 'var(--lumiverse-bg-elevated)',
                                maxHeight: '200px',
                                overflowY: 'auto',
                            }}>
                                <div style={{ padding: '8px', borderBottom: '1px solid var(--lumiverse-border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'var(--lumiverse-input-bg, rgba(0,0,0,0.2))', borderRadius: '6px' }}>
                                        <Search size={12} style={{ color: 'var(--lumiverse-text-dim)', flexShrink: 0 }} />
                                        <input
                                            style={{ ...styles.input, border: 'none', padding: '2px', background: 'transparent', fontSize: '12px', width: '100%' }}
                                            placeholder="Search macros..."
                                            value={macroSearch}
                                            onChange={e => setMacroSearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                                {filteredMacros.map(group => (
                                    <div key={group.category} style={styles.macroGroup}>
                                        <div style={styles.macroGroupTitle}>{group.category}</div>
                                        {group.macros.map(macro => (
                                            <div
                                                key={macro.syntax}
                                                style={styles.macroItem}
                                                onClick={() => insertMacro(macro.syntax)}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--lumiverse-fill-subtle, rgba(255,255,255,0.05))'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <span style={{ fontFamily: 'var(--lumiverse-font-mono, monospace)', fontSize: '12px', color: 'var(--lumiverse-primary)' }}>
                                                    {macro.syntax}
                                                </span>
                                                <span style={{ fontSize: '11px', color: 'var(--lumiverse-text-dim)', marginLeft: '8px', textAlign: 'right' }}>
                                                    {macro.description}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}

                        <textarea
                            ref={textareaRef}
                            style={styles.textarea}
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="Enter prompt content... Use {{macros}} for dynamic content."
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={isLocked}
                                onChange={e => setIsLocked(e.target.checked)}
                            />
                            <Lock size={14} /> Lock block (prevent accidental edits)
                        </label>
                    </div>

                    {/* Injection Triggers */}
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Injection Triggers</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {INJECTION_TRIGGER_TYPES.map(trigger => (
                                <label
                                    key={trigger.value}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '5px',
                                        fontSize: '12px', cursor: 'pointer',
                                        color: injectionTrigger.includes(trigger.value)
                                            ? 'var(--lumiverse-text)'
                                            : 'var(--lumiverse-text-muted)',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={injectionTrigger.includes(trigger.value)}
                                        onChange={() => toggleTrigger(trigger.value)}
                                        style={{ accentColor: 'var(--lumiverse-primary)' }}
                                    />
                                    {trigger.label}
                                </label>
                            ))}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--lumiverse-text-dim)' }}>
                            {injectionTrigger.length === 0
                                ? 'No triggers selected — block fires on all generation types'
                                : `Block only fires on: ${injectionTrigger.join(', ')}`}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// PRESET SELECTOR
// ============================================================================

function PresetSelector({ registry, activePresetId, onSelect, onCreate, onDuplicate, onDelete, onImport, onExport }) {
    const [showMenu, setShowMenu] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');

    const registryEntries = Object.entries(registry);
    const activeEntry = activePresetId ? registry[activePresetId] : null;

    const handleCreate = () => {
        if (!newName.trim()) return;
        onCreate(newName.trim());
        setNewName('');
        setShowCreate(false);
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            <select
                style={{ ...styles.select, flex: 1, minWidth: 0 }}
                value={activePresetId || ''}
                onChange={e => onSelect(e.target.value || null)}
            >
                <option value="">-- Select Preset --</option>
                {registryEntries.map(([id, entry]) => (
                    <option key={id} value={id}>{entry.name} ({entry.blockCount} blocks)</option>
                ))}
            </select>

            <div style={{ position: 'relative' }}>
                <button
                    style={styles.iconBtn}
                    onClick={() => setShowMenu(!showMenu)}
                    title="More options"
                    type="button"
                >
                    <MoreVertical size={16} />
                </button>
                {showMenu && (
                    <div style={{ ...styles.dropdownMenu, top: '100%', right: 0, minWidth: '160px' }}>
                        <MenuButton icon={<Plus size={14} />} label="New Preset" onClick={() => { setShowCreate(true); setShowMenu(false); }} />
                        {activePresetId && (
                            <>
                                <MenuButton icon={<Copy size={14} />} label="Duplicate" onClick={() => { onDuplicate(); setShowMenu(false); }} />
                                <MenuButton icon={<Download size={14} />} label="Export" onClick={() => { onExport(); setShowMenu(false); }} />
                                <hr style={{ border: 'none', borderTop: '1px solid var(--lumiverse-border)', margin: '4px 0' }} />
                                <MenuButton icon={<Trash2 size={14} />} label="Delete" danger onClick={() => { onDelete(); setShowMenu(false); }} />
                            </>
                        )}
                        <hr style={{ border: 'none', borderTop: '1px solid var(--lumiverse-border)', margin: '4px 0' }} />
                        <MenuButton icon={<Upload size={14} />} label="Import ST Preset" onClick={() => { onImport('st'); setShowMenu(false); }} />
                        <MenuButton icon={<Upload size={14} />} label="Import Loom JSON" onClick={() => { onImport('json'); setShowMenu(false); }} />
                    </div>
                )}
            </div>

            {showCreate && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                }}
                    onClick={() => setShowCreate(false)}
                >
                    <div
                        style={{
                            background: 'var(--lumiverse-bg-elevated)',
                            border: '1px solid var(--lumiverse-border)',
                            borderRadius: '12px',
                            padding: '20px',
                            width: '320px',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h4 style={{ margin: '0 0 12px', fontSize: '15px' }}>New Loom Preset</h4>
                        <input
                            style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }}
                            placeholder="Preset name"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                            autoFocus
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                            <button style={styles.btn} onClick={() => setShowCreate(false)} type="button">Cancel</button>
                            <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleCreate} type="button">Create</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MenuButton({ icon, label, onClick, danger }) {
    return (
        <button
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                color: danger ? 'var(--lumiverse-danger, #ef4444)' : 'var(--lumiverse-text)',
                fontSize: '13px',
                cursor: 'pointer',
                borderRadius: '6px',
                textAlign: 'left',
            }}
            onClick={onClick}
            type="button"
            onMouseEnter={e => e.currentTarget.style.background = 'var(--lumiverse-fill-subtle, rgba(255,255,255,0.05))'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
            {icon}
            {label}
        </button>
    );
}

// ============================================================================
// GENERATION SETTINGS PANEL
// ============================================================================

/**
 * A single sampler parameter — label above a themed div-based slider + numeric input.
 * Uses pure <div> elements instead of <input type="range"> to avoid global CSS
 * overrides from ST or other extensions.
 *
 * Performance: The slider tracks local visual state during drag and only commits
 * onChange on pointer release. The numeric input debounces commits by 1s with
 * immediate flush on blur. This prevents file I/O on every frame of interaction.
 *
 * Null value = not overridden (slider shows at default hint, input is empty).
 */
function SamplerSlider({ param, value, onChange }) {
    const isSet = value !== null && value !== undefined;
    const trackRef = useRef(null);
    const dragging = useRef(false);
    const dragValueRef = useRef(null);

    // Local visual value during drag — null means "use prop"
    const [localValue, setLocalValue] = useState(null);
    const currentValue = localValue !== null ? localValue : (isSet ? value : param.defaultHint);

    // Local input state with debounced commit
    const [localInput, setLocalInput] = useState(isSet ? String(value) : '');
    const inputTimerRef = useRef(null);
    const inputEditingRef = useRef(false);

    // Sync local input from prop when not actively editing
    useEffect(() => {
        if (!inputEditingRef.current) {
            setLocalInput(isSet ? String(value) : '');
        }
    }, [value, isSet]);

    // Cleanup input timer on unmount
    useEffect(() => () => clearTimeout(inputTimerRef.current), []);

    // Snap a raw number to the nearest step, clamped to [min, max]
    const snap = useCallback((raw) => {
        const clamped = Math.min(param.max, Math.max(param.min, raw));
        const stepped = Math.round((clamped - param.min) / param.step) * param.step + param.min;
        const decimals = (String(param.step).split('.')[1] || '').length;
        return param.type === 'int' ? Math.round(stepped) : parseFloat(stepped.toFixed(decimals));
    }, [param.min, param.max, param.step, param.type]);

    // Convert a clientX position to a value
    const posToValue = useCallback((clientX) => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0) return currentValue;
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        return snap(param.min + ratio * (param.max - param.min));
    }, [param.min, param.max, currentValue, snap]);

    // --- Slider pointer handlers: local-only during drag, commit on release ---

    const handlePointerDown = useCallback((e) => {
        e.preventDefault();
        dragging.current = true;
        trackRef.current?.setPointerCapture(e.pointerId);
        const val = posToValue(e.clientX);
        dragValueRef.current = val;
        setLocalValue(val);
    }, [posToValue]);

    const handlePointerMove = useCallback((e) => {
        if (!dragging.current) return;
        const val = posToValue(e.clientX);
        dragValueRef.current = val;
        setLocalValue(val);
    }, [posToValue]);

    const handlePointerUp = useCallback((e) => {
        if (!dragging.current) return;
        dragging.current = false;
        trackRef.current?.releasePointerCapture(e.pointerId);
        const final = dragValueRef.current;
        dragValueRef.current = null;
        setLocalValue(null);
        if (final !== null) onChange(param.key, final);
    }, [param.key, onChange]);

    // --- Numeric input: 1s debounce, flush on blur ---

    const commitInput = useCallback((raw) => {
        inputEditingRef.current = false;
        if (raw === '') { onChange(param.key, null); return; }
        const num = param.type === 'int' ? parseInt(raw) : parseFloat(raw);
        if (!isNaN(num)) onChange(param.key, Math.min(param.max, Math.max(param.min, num)));
    }, [param, onChange]);

    const handleInputChange = useCallback((e) => {
        const raw = e.target.value;
        inputEditingRef.current = true;
        setLocalInput(raw);
        clearTimeout(inputTimerRef.current);
        inputTimerRef.current = setTimeout(() => commitInput(raw), 1000);
    }, [commitInput]);

    const handleInputBlur = useCallback(() => {
        clearTimeout(inputTimerRef.current);
        commitInput(localInput);
    }, [localInput, commitInput]);

    // Fill percentage
    const pct = ((currentValue - param.min) / (param.max - param.min)) * 100;

    return (
        <div style={{ padding: '6px 0 2px' }}>
            {/* Label row: name + numeric value */}
            <div style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: '4px',
            }}>
                <span style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: isSet ? 'var(--lumiverse-text)' : 'var(--lumiverse-text-muted)',
                    letterSpacing: '0.2px',
                }}>
                    {param.label}
                </span>
                <input
                    type="number"
                    value={localInput}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    style={{
                        width: '72px',
                        padding: '2px 6px',
                        background: isSet ? 'var(--lumiverse-input-bg, rgba(0,0,0,0.2))' : 'transparent',
                        border: isSet ? '1px solid var(--lumiverse-border)' : '1px solid transparent',
                        borderRadius: '4px',
                        color: isSet ? 'var(--lumiverse-text)' : 'var(--lumiverse-text-dim)',
                        fontSize: '11px',
                        fontFamily: 'var(--lumiverse-font-mono, monospace)',
                        textAlign: 'right',
                        outline: 'none',
                    }}
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    placeholder={String(param.defaultHint)}
                />
            </div>
            {/* Div-based slider — immune to global input[type="range"] CSS */}
            <div
                ref={trackRef}
                className="lumiverse-slider-track"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onDoubleClick={() => onChange(param.key, null)}
                title="Double-click to reset"
                style={{ opacity: isSet ? 1 : 0.4 }}
            >
                {/* Fill */}
                <div className="lumiverse-slider-fill" style={{ width: `${pct}%` }} />
                {/* Thumb */}
                <div className="lumiverse-slider-thumb" style={{ left: `${pct}%` }} />
            </div>
        </div>
    );
}

/**
 * Generation Settings panel — collapsible section for sampler overrides
 * and custom body JSON. Only shows params supported by the current provider.
 */
function GenerationSettings({
    samplerOverrides,
    customBody,
    connectionProfile,
    samplerParams,
    onSaveSamplers,
    onSaveCustomBody,
    onRefreshProfile,
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [jsonError, setJsonError] = useState(null);
    const [localJson, setLocalJson] = useState(customBody?.rawJson || '{}');

    // Sync localJson when preset changes
    const prevJsonRef = useRef(customBody?.rawJson);
    if (customBody?.rawJson !== prevJsonRef.current) {
        prevJsonRef.current = customBody?.rawJson;
        setLocalJson(customBody?.rawJson || '{}');
        setJsonError(null);
    }

    const overrides = samplerOverrides || {};
    const body = customBody || {};
    const supported = connectionProfile?.supportedParams || new Set();

    // Filter to only show supported params
    const visibleParams = samplerParams.filter(p => supported.has(p.key));

    // Count active overrides for the badge
    const activeCount = visibleParams.filter(p => {
        const v = overrides[p.key];
        return v !== null && v !== undefined;
    }).length;

    // Change param value — auto-enables overrides
    const handleChangeParam = (key, value) => {
        onSaveSamplers({ ...overrides, enabled: true, [key]: value });
    };

    // Reset all overrides
    const handleResetSamplers = () => {
        onSaveSamplers({ ..._DEFAULT_SAMPLER_OVERRIDES });
    };

    // Custom body enabled toggle
    const handleToggleCustomBody = () => {
        onSaveCustomBody({ ...body, enabled: !body.enabled });
    };

    // Custom body JSON change (debounced save)
    const handleJsonChange = (raw) => {
        setLocalJson(raw);
        try {
            JSON.parse(raw);
            setJsonError(null);
            onSaveCustomBody({ ...body, rawJson: raw });
        } catch (e) {
            setJsonError(e.message);
        }
    };

    const isActive = overrides.enabled || body.enabled;

    return (
        <div style={{
            borderBottom: '1px solid var(--lumiverse-border)',
            flexShrink: 0,
        }}>
            {/* Collapsed header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '7px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: isActive
                        ? 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.06))'
                        : 'transparent',
                    transition: 'background 0.15s',
                }}
                onClick={() => {
                    setIsExpanded(!isExpanded);
                    if (!isExpanded) onRefreshProfile();
                }}
            >
                <Settings2
                    size={12}
                    style={{
                        color: isActive ? 'var(--lumiverse-primary)' : 'var(--lumiverse-text-dim)',
                        flexShrink: 0,
                    }}
                />
                <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: 'var(--lumiverse-text-muted)',
                    flex: 1,
                }}>
                    Generation
                </span>
                {activeCount > 0 && (
                    <span style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '8px',
                        background: 'var(--lumiverse-primary)',
                        color: 'white',
                        minWidth: '14px',
                        textAlign: 'center',
                    }}>
                        {activeCount}
                    </span>
                )}
                {body.enabled && (
                    <Code2 size={10} style={{ color: 'var(--lumiverse-primary)', flexShrink: 0 }} />
                )}
                {isExpanded
                    ? <ChevronDown size={11} style={{ color: 'var(--lumiverse-text-dim)', flexShrink: 0 }} />
                    : <ChevronRight size={11} style={{ color: 'var(--lumiverse-text-dim)', flexShrink: 0 }} />
                }
            </div>

            {/* Expanded body */}
            {isExpanded && (
                <div style={{
                    padding: '4px 16px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.04))',
                }}>
                    {/* Sampler section header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 0 2px',
                    }}>
                        <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            color: 'var(--lumiverse-text-dim)',
                            flex: 1,
                        }}>
                            Samplers
                        </span>
                        <button
                            style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'transparent',
                                border: '1px solid var(--lumiverse-border)',
                                color: 'var(--lumiverse-text-dim)',
                                fontSize: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                            }}
                            onClick={handleResetSamplers}
                            title="Reset all sampler overrides to defaults (double-click individual sliders to reset one)"
                            type="button"
                        >
                            <RotateCcw size={8} /> Reset
                        </button>
                    </div>

                    {/* Sampler sliders — only supported params shown */}
                    {visibleParams.map(param => (
                        <SamplerSlider
                            key={param.key}
                            param={param}
                            value={overrides[param.key]}
                            onChange={handleChangeParam}
                        />
                    ))}

                    {visibleParams.length === 0 && (
                        <div style={{
                            fontSize: '11px',
                            color: 'var(--lumiverse-text-dim)',
                            padding: '8px 0',
                            textAlign: 'center',
                        }}>
                            No sampler overrides available for this provider.
                        </div>
                    )}

                    {/* Divider */}
                    <hr style={{
                        border: 'none',
                        borderTop: '1px solid var(--lumiverse-border)',
                        margin: '8px 0 4px',
                    }} />

                    {/* Custom body section */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '2px 0 4px',
                    }}>
                        <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            color: 'var(--lumiverse-text-dim)',
                            flex: 1,
                        }}>
                            Custom Body
                        </span>
                        <label style={{
                            fontSize: '10px',
                            color: 'var(--lumiverse-text-dim)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                        }}>
                            <input
                                type="checkbox"
                                checked={!!body.enabled}
                                onChange={handleToggleCustomBody}
                                style={{
                                    width: '12px', height: '12px', margin: 0,
                                    accentColor: 'var(--lumiverse-primary)',
                                    cursor: 'pointer',
                                }}
                            />
                            Enabled
                        </label>
                    </div>

                    <div style={body.enabled ? {} : { opacity: 0.35, pointerEvents: 'none' }}>
                        <textarea
                            style={{
                                width: '100%',
                                minHeight: '64px',
                                padding: '8px 10px',
                                background: 'var(--lumiverse-input-bg, rgba(0,0,0,0.2))',
                                border: '1px solid var(--lumiverse-border)',
                                borderRadius: '6px',
                                color: 'var(--lumiverse-text)',
                                fontSize: '11px',
                                fontFamily: 'var(--lumiverse-font-mono, monospace)',
                                lineHeight: '1.5',
                                resize: 'vertical',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                            value={localJson}
                            onChange={e => handleJsonChange(e.target.value)}
                            placeholder={'{\n  "thinking": { "type": "enabled" }\n}'}
                            spellCheck={false}
                        />
                        {jsonError && (
                            <div style={{
                                fontSize: '10px',
                                color: 'var(--lumiverse-danger, #ef4444)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 0',
                            }}>
                                <AlertTriangle size={10} /> {jsonError}
                            </div>
                        )}
                        <div style={{ fontSize: '9px', color: 'var(--lumiverse-text-dim)', marginTop: '3px', lineHeight: '1.4' }}>
                            Keys are spread onto the request body.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// INJECTION TRIGGER TYPES
// ============================================================================

const INJECTION_TRIGGER_TYPES = [
    { value: 'normal', label: 'Normal', shortLabel: 'N' },
    { value: 'continue', label: 'Continue', shortLabel: 'C' },
    { value: 'impersonate', label: 'Impersonate', shortLabel: 'I' },
    { value: 'quiet', label: 'Quiet', shortLabel: 'Q' },
    { value: 'swipe', label: 'Swipe', shortLabel: 'S' },
    { value: 'regenerate', label: 'Regenerate', shortLabel: 'R' },
];

// ============================================================================
// PROMPT BEHAVIOR SETTINGS
// ============================================================================

/**
 * Accordion section for utility prompts that vary by generation type.
 */
function PromptBehaviorSettings({ promptBehavior, onSave }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const behavior = promptBehavior || {};
    const defaults = _DEFAULT_PROMPT_BEHAVIOR;

    // Count non-default fields for the badge
    const activeCount = Object.keys(defaults).filter(key => {
        const current = behavior[key] ?? defaults[key];
        return current !== defaults[key];
    }).length;

    const handleChange = (key, value) => {
        onSave({ [key]: value });
    };

    const handleRestore = (key) => {
        onSave({ [key]: defaults[key] });
    };

    const Field = ({ fieldKey, label, hint, multiline }) => {
        const value = behavior[fieldKey] ?? defaults[fieldKey];
        const isDefault = value === defaults[fieldKey];
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                        fontSize: '11px', fontWeight: 500,
                        color: isDefault ? 'var(--lumiverse-text-muted)' : 'var(--lumiverse-text)',
                    }}>{label}</span>
                    {!isDefault && (
                        <button
                            style={{
                                padding: '1px 5px', borderRadius: '3px', background: 'transparent',
                                border: '1px solid var(--lumiverse-border)', color: 'var(--lumiverse-text-dim)',
                                fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px',
                            }}
                            onClick={() => handleRestore(fieldKey)}
                            title="Restore default"
                            type="button"
                        >
                            <RotateCcw size={7} /> Default
                        </button>
                    )}
                </div>
                {multiline ? (
                    <textarea
                        style={{
                            width: '100%', minHeight: '48px', padding: '6px 8px', boxSizing: 'border-box',
                            background: 'var(--lumiverse-input-bg, rgba(0,0,0,0.2))',
                            border: '1px solid var(--lumiverse-border)', borderRadius: '6px',
                            color: 'var(--lumiverse-text)', fontSize: '11px',
                            fontFamily: 'var(--lumiverse-font-mono, monospace)',
                            lineHeight: '1.5', resize: 'vertical', outline: 'none',
                        }}
                        value={value}
                        onChange={e => handleChange(fieldKey, e.target.value)}
                        spellCheck={false}
                    />
                ) : (
                    <input
                        style={{
                            width: '100%', padding: '5px 8px', boxSizing: 'border-box',
                            background: 'var(--lumiverse-input-bg, rgba(0,0,0,0.2))',
                            border: '1px solid var(--lumiverse-border)', borderRadius: '6px',
                            color: 'var(--lumiverse-text)', fontSize: '11px', outline: 'none',
                        }}
                        value={value}
                        onChange={e => handleChange(fieldKey, e.target.value)}
                    />
                )}
                {hint && <span style={{ fontSize: '9px', color: 'var(--lumiverse-text-dim)' }}>{hint}</span>}
            </div>
        );
    };

    return (
        <div style={{ borderBottom: '1px solid var(--lumiverse-border)', flexShrink: 0 }}>
            <div
                style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 16px', cursor: 'pointer', userSelect: 'none',
                    background: activeCount > 0 ? 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.06))' : 'transparent',
                    transition: 'background 0.15s',
                }}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <MessageSquare size={12} style={{
                    color: activeCount > 0 ? 'var(--lumiverse-primary)' : 'var(--lumiverse-text-dim)',
                    flexShrink: 0,
                }} />
                <span style={{
                    fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.6px', color: 'var(--lumiverse-text-muted)', flex: 1,
                }}>Prompt Behavior</span>
                {activeCount > 0 && (
                    <span style={{
                        fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '8px',
                        background: 'var(--lumiverse-primary)', color: 'white',
                        minWidth: '14px', textAlign: 'center',
                    }}>{activeCount}</span>
                )}
                {isExpanded
                    ? <ChevronDown size={11} style={{ color: 'var(--lumiverse-text-dim)', flexShrink: 0 }} />
                    : <ChevronRight size={11} style={{ color: 'var(--lumiverse-text-dim)', flexShrink: 0 }} />
                }
            </div>
            {isExpanded && (
                <div style={{
                    padding: '8px 16px 14px', display: 'flex', flexDirection: 'column', gap: '10px',
                    background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.04))',
                }}>
                    <Field fieldKey="continueNudge" label="Continue Nudge" hint="Injected when continuing a response" multiline />
                    <Field fieldKey="impersonationPrompt" label="Impersonation Prompt" hint="Injected when impersonating the user" multiline />
                    <Field fieldKey="groupNudge" label="Group Nudge" hint="Injected in group chats" multiline />
                    <Field fieldKey="newChatPrompt" label="New Chat Separator" hint="Inserted at conversation start" />
                    <Field fieldKey="newGroupChatPrompt" label="New Group Chat Separator" hint="Inserted at group conversation start" />
                    <Field fieldKey="sendIfEmpty" label="Send If Empty" hint="Sent as user message when input is empty" />
                </div>
            )}
        </div>
    );
}

// ============================================================================
// COMPLETION SETTINGS
// ============================================================================

const CONTINUE_POSTFIX_OPTIONS = [
    { value: '', label: 'None' },
    { value: ' ', label: 'Space' },
    { value: '\n', label: 'Newline' },
    { value: '\n\n', label: 'Double Newline' },
];

const NAMES_BEHAVIOR_OPTIONS = [
    { value: -1, label: 'None' },
    { value: 0, label: 'Default' },
    { value: 1, label: 'In Completion' },
    { value: 2, label: 'In Content' },
];

/**
 * Accordion section for completion-related settings:
 * prefill, names, squash, continue postfix.
 */
function CompletionSettingsPanel({ completionSettings, onSave }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const settings = completionSettings || {};
    const defaults = _DEFAULT_COMPLETION_SETTINGS;

    const activeCount = Object.keys(defaults).filter(key => {
        const current = settings[key] ?? defaults[key];
        return current !== defaults[key];
    }).length;

    const handleChange = (key, value) => {
        onSave({ [key]: value });
    };

    return (
        <div style={{ borderBottom: '1px solid var(--lumiverse-border)', flexShrink: 0 }}>
            <div
                style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 16px', cursor: 'pointer', userSelect: 'none',
                    background: activeCount > 0 ? 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.06))' : 'transparent',
                    transition: 'background 0.15s',
                }}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <Bot size={12} style={{
                    color: activeCount > 0 ? 'var(--lumiverse-primary)' : 'var(--lumiverse-text-dim)',
                    flexShrink: 0,
                }} />
                <span style={{
                    fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.6px', color: 'var(--lumiverse-text-muted)', flex: 1,
                }}>Completion</span>
                {activeCount > 0 && (
                    <span style={{
                        fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '8px',
                        background: 'var(--lumiverse-primary)', color: 'white',
                        minWidth: '14px', textAlign: 'center',
                    }}>{activeCount}</span>
                )}
                {isExpanded
                    ? <ChevronDown size={11} style={{ color: 'var(--lumiverse-text-dim)', flexShrink: 0 }} />
                    : <ChevronRight size={11} style={{ color: 'var(--lumiverse-text-dim)', flexShrink: 0 }} />
                }
            </div>
            {isExpanded && (
                <div style={{
                    padding: '8px 16px 14px', display: 'flex', flexDirection: 'column', gap: '10px',
                    background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.04))',
                }}>
                    {/* Assistant Prefill */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--lumiverse-text-muted)' }}>
                            Assistant Prefill
                        </span>
                        <textarea
                            style={{
                                width: '100%', minHeight: '40px', padding: '6px 8px', boxSizing: 'border-box',
                                background: 'var(--lumiverse-input-bg, rgba(0,0,0,0.2))',
                                border: '1px solid var(--lumiverse-border)', borderRadius: '6px',
                                color: 'var(--lumiverse-text)', fontSize: '11px',
                                fontFamily: 'var(--lumiverse-font-mono, monospace)',
                                lineHeight: '1.5', resize: 'vertical', outline: 'none',
                            }}
                            value={settings.assistantPrefill ?? defaults.assistantPrefill}
                            onChange={e => handleChange('assistantPrefill', e.target.value)}
                            placeholder="Claude only — prepended to response"
                            spellCheck={false}
                        />
                        <span style={{ fontSize: '9px', color: 'var(--lumiverse-text-dim)' }}>Claude only — prepended to assistant response</span>
                    </div>

                    {/* Impersonation Prefill */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--lumiverse-text-muted)' }}>
                            Impersonation Prefill
                        </span>
                        <textarea
                            style={{
                                width: '100%', minHeight: '40px', padding: '6px 8px', boxSizing: 'border-box',
                                background: 'var(--lumiverse-input-bg, rgba(0,0,0,0.2))',
                                border: '1px solid var(--lumiverse-border)', borderRadius: '6px',
                                color: 'var(--lumiverse-text)', fontSize: '11px',
                                fontFamily: 'var(--lumiverse-font-mono, monospace)',
                                lineHeight: '1.5', resize: 'vertical', outline: 'none',
                            }}
                            value={settings.assistantImpersonation ?? defaults.assistantImpersonation}
                            onChange={e => handleChange('assistantImpersonation', e.target.value)}
                            placeholder="Claude only — prefill when impersonating"
                            spellCheck={false}
                        />
                        <span style={{ fontSize: '9px', color: 'var(--lumiverse-text-dim)' }}>Claude only — prefill when impersonating</span>
                    </div>

                    {/* Toggles row */}
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        {/* Continue Prefill toggle */}
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '11px', cursor: 'pointer', color: 'var(--lumiverse-text-muted)',
                        }}>
                            <input
                                type="checkbox"
                                checked={!!(settings.continuePrefill ?? defaults.continuePrefill)}
                                onChange={e => handleChange('continuePrefill', e.target.checked)}
                                style={{ width: '12px', height: '12px', margin: 0, accentColor: 'var(--lumiverse-primary)', cursor: 'pointer' }}
                            />
                            Continue Prefill
                        </label>

                        {/* Squash System Messages toggle */}
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '11px', cursor: 'pointer', color: 'var(--lumiverse-text-muted)',
                        }}>
                            <input
                                type="checkbox"
                                checked={!!(settings.squashSystemMessages ?? defaults.squashSystemMessages)}
                                onChange={e => handleChange('squashSystemMessages', e.target.checked)}
                                style={{ width: '12px', height: '12px', margin: 0, accentColor: 'var(--lumiverse-primary)', cursor: 'pointer' }}
                            />
                            Squash System Messages
                        </label>
                    </div>

                    {/* Selects row */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {/* Continue Postfix */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1 1 140px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--lumiverse-text-muted)' }}>
                                Continue Postfix
                            </span>
                            <select
                                style={{
                                    padding: '5px 8px', background: 'var(--lumiverse-input-bg, rgba(0,0,0,0.2))',
                                    border: '1px solid var(--lumiverse-border)', borderRadius: '6px',
                                    color: 'var(--lumiverse-text)', fontSize: '11px', outline: 'none', cursor: 'pointer',
                                }}
                                value={settings.continuePostfix ?? defaults.continuePostfix}
                                onChange={e => handleChange('continuePostfix', e.target.value)}
                            >
                                {CONTINUE_POSTFIX_OPTIONS.map(opt => (
                                    <option key={opt.label} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Names Behavior */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1 1 140px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--lumiverse-text-muted)' }}>
                                Names in Messages
                            </span>
                            <select
                                style={{
                                    padding: '5px 8px', background: 'var(--lumiverse-input-bg, rgba(0,0,0,0.2))',
                                    border: '1px solid var(--lumiverse-border)', borderRadius: '6px',
                                    color: 'var(--lumiverse-text)', fontSize: '11px', outline: 'none', cursor: 'pointer',
                                }}
                                value={settings.namesBehavior ?? defaults.namesBehavior}
                                onChange={e => handleChange('namesBehavior', parseInt(e.target.value))}
                            >
                                {NAMES_BEHAVIOR_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Divider */}
                    <hr style={{ border: 'none', borderTop: '1px solid var(--lumiverse-border)', margin: '4px 0' }} />

                    {/* Feature toggles */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '11px', cursor: 'pointer', color: 'var(--lumiverse-text-muted)',
                        }}>
                            <input
                                type="checkbox"
                                checked={!!(settings.useSystemPrompt ?? defaults.useSystemPrompt)}
                                onChange={e => handleChange('useSystemPrompt', e.target.checked)}
                                style={{ width: '12px', height: '12px', margin: 0, accentColor: 'var(--lumiverse-primary)', cursor: 'pointer' }}
                            />
                            Use System Prompt
                        </label>
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '11px', cursor: 'pointer', color: 'var(--lumiverse-text-muted)',
                        }}>
                            <input
                                type="checkbox"
                                checked={!!(settings.enableWebSearch ?? defaults.enableWebSearch)}
                                onChange={e => handleChange('enableWebSearch', e.target.checked)}
                                style={{ width: '12px', height: '12px', margin: 0, accentColor: 'var(--lumiverse-primary)', cursor: 'pointer' }}
                            />
                            Enable Web Search
                        </label>
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '11px', cursor: 'pointer', color: 'var(--lumiverse-text-muted)',
                        }}>
                            <input
                                type="checkbox"
                                checked={!!(settings.sendInlineMedia ?? defaults.sendInlineMedia)}
                                onChange={e => handleChange('sendInlineMedia', e.target.checked)}
                                style={{ width: '12px', height: '12px', margin: 0, accentColor: 'var(--lumiverse-primary)', cursor: 'pointer' }}
                            />
                            Send Inline Media
                        </label>
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '11px', cursor: 'pointer', color: 'var(--lumiverse-text-muted)',
                        }}>
                            <input
                                type="checkbox"
                                checked={!!(settings.enableFunctionCalling ?? defaults.enableFunctionCalling)}
                                onChange={e => handleChange('enableFunctionCalling', e.target.checked)}
                                style={{ width: '12px', height: '12px', margin: 0, accentColor: 'var(--lumiverse-primary)', cursor: 'pointer' }}
                            />
                            Enable Function Calling
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// ADVANCED SETTINGS
// ============================================================================

/**
 * Accordion section for seed and custom stop strings.
 */
function AdvancedSettingsPanel({ advancedSettings, onSave }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [stopInput, setStopInput] = useState('');
    const settings = advancedSettings || {};
    const defaults = _DEFAULT_ADVANCED_SETTINGS;

    const seed = settings.seed ?? defaults.seed;
    const stopStrings = settings.customStopStrings ?? defaults.customStopStrings;

    const isActive = seed >= 0 || stopStrings.length > 0;

    const handleSeedChange = (value) => {
        const num = parseInt(value);
        onSave({ seed: isNaN(num) ? -1 : num });
    };

    const handleAddStopString = () => {
        const trimmed = stopInput.trim();
        if (!trimmed) return;
        if (stopStrings.includes(trimmed)) return;
        onSave({ customStopStrings: [...stopStrings, trimmed] });
        setStopInput('');
    };

    const handleRemoveStopString = (index) => {
        const updated = stopStrings.filter((_, i) => i !== index);
        onSave({ customStopStrings: updated });
    };

    return (
        <div style={{ borderBottom: '1px solid var(--lumiverse-border)', flexShrink: 0 }}>
            <div
                style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 16px', cursor: 'pointer', userSelect: 'none',
                    background: isActive ? 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.06))' : 'transparent',
                    transition: 'background 0.15s',
                }}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <Wrench size={12} style={{
                    color: isActive ? 'var(--lumiverse-primary)' : 'var(--lumiverse-text-dim)',
                    flexShrink: 0,
                }} />
                <span style={{
                    fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.6px', color: 'var(--lumiverse-text-muted)', flex: 1,
                }}>Advanced</span>
                {isActive && (
                    <span style={{
                        fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '8px',
                        background: 'var(--lumiverse-primary)', color: 'white',
                        minWidth: '14px', textAlign: 'center',
                    }}>{(seed >= 0 ? 1 : 0) + (stopStrings.length > 0 ? 1 : 0)}</span>
                )}
                {isExpanded
                    ? <ChevronDown size={11} style={{ color: 'var(--lumiverse-text-dim)', flexShrink: 0 }} />
                    : <ChevronRight size={11} style={{ color: 'var(--lumiverse-text-dim)', flexShrink: 0 }} />
                }
            </div>
            {isExpanded && (
                <div style={{
                    padding: '8px 16px 14px', display: 'flex', flexDirection: 'column', gap: '10px',
                    background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.04))',
                }}>
                    {/* Seed */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--lumiverse-text-muted)' }}>
                                Seed
                            </span>
                            <button
                                style={{
                                    padding: '1px 5px', borderRadius: '3px', background: 'transparent',
                                    border: '1px solid var(--lumiverse-border)', color: 'var(--lumiverse-text-dim)',
                                    fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px',
                                }}
                                onClick={() => onSave({ seed: -1 })}
                                title="Set to random (-1)"
                                type="button"
                            >
                                <Dice1 size={7} /> Random
                            </button>
                        </div>
                        <input
                            type="number"
                            style={{
                                width: '120px', padding: '5px 8px',
                                background: 'var(--lumiverse-input-bg, rgba(0,0,0,0.2))',
                                border: '1px solid var(--lumiverse-border)', borderRadius: '6px',
                                color: 'var(--lumiverse-text)', fontSize: '11px',
                                fontFamily: 'var(--lumiverse-font-mono, monospace)',
                                outline: 'none',
                            }}
                            value={seed}
                            onChange={e => handleSeedChange(e.target.value)}
                            min={-1}
                            placeholder="-1 (random)"
                        />
                        <span style={{ fontSize: '9px', color: 'var(--lumiverse-text-dim)' }}>-1 = random seed</span>
                    </div>

                    {/* Custom Stop Strings */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--lumiverse-text-muted)' }}>
                            Custom Stop Strings
                        </span>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <input
                                style={{
                                    flex: 1, padding: '5px 8px',
                                    background: 'var(--lumiverse-input-bg, rgba(0,0,0,0.2))',
                                    border: '1px solid var(--lumiverse-border)', borderRadius: '6px',
                                    color: 'var(--lumiverse-text)', fontSize: '11px', outline: 'none',
                                }}
                                value={stopInput}
                                onChange={e => setStopInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddStopString(); } }}
                                placeholder="Type and press Enter"
                            />
                            <button
                                style={{
                                    padding: '4px 8px', borderRadius: '6px',
                                    background: 'var(--lumiverse-bg-elevated)',
                                    border: '1px solid var(--lumiverse-border)',
                                    color: 'var(--lumiverse-text)', fontSize: '11px', cursor: 'pointer',
                                }}
                                onClick={handleAddStopString}
                                type="button"
                            >
                                <Plus size={10} />
                            </button>
                        </div>
                        {stopStrings.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                {stopStrings.map((s, i) => (
                                    <span
                                        key={i}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            padding: '2px 8px', borderRadius: '12px',
                                            background: 'var(--lumiverse-fill-moderate, rgba(0,0,0,0.15))',
                                            color: 'var(--lumiverse-text)', fontSize: '10px',
                                            fontFamily: 'var(--lumiverse-font-mono, monospace)',
                                        }}
                                    >
                                        {JSON.stringify(s)}
                                        <button
                                            style={{
                                                background: 'none', border: 'none', padding: '0', cursor: 'pointer',
                                                color: 'var(--lumiverse-text-dim)', display: 'flex',
                                            }}
                                            onClick={() => handleRemoveStopString(i)}
                                            type="button"
                                        >
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <span style={{ fontSize: '9px', color: 'var(--lumiverse-text-dim)' }}>Appended to the request stop sequences</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// CONTEXT TOKEN METER
// ============================================================================

/**
 * Compact token usage meter — shows how much context the assembled prompt uses.
 * Renders a single-line display with a thin fill bar.
 * Shows live estimates (chat-only) between generations and accurate counts
 * (full prompt) after each generation.
 */
function ContextMeter({ tokenUsage }) {
    if (!tokenUsage) return null;

    const { promptTokens, maxContext, maxTokens, isEstimate } = tokenUsage;
    if (maxContext <= 0) return null;

    const pct = Math.min(100, (promptTokens / maxContext) * 100);

    // Color thresholds based on full context window
    // Warn when prompt + response tokens would overfill context
    const effectiveBudget = maxContext - (maxTokens || 0);
    const isOverBudget = effectiveBudget > 0 && promptTokens > effectiveBudget;

    let fillColor;
    if (isOverBudget) fillColor = 'var(--lumiverse-danger, #ef4444)';
    else if (pct < 60) fillColor = 'var(--lumiverse-success, #22c55e)';
    else if (pct < 85) fillColor = 'var(--lumiverse-warning, #f59e0b)';
    else fillColor = 'var(--lumiverse-danger, #ef4444)';

    // Stale after 5 minutes
    const isStale = Date.now() - tokenUsage.timestamp > 300_000;

    return (
        <div
            className="lumiverse-context-meter"
            style={isStale ? { opacity: 0.45 } : undefined}
            title={isEstimate
                ? 'Estimate from chat history only — system prompts not included. Accurate count shown after generation.'
                : isOverBudget
                    ? `Prompt exceeds available budget (${maxContext.toLocaleString()} context − ${maxTokens.toLocaleString()} response = ${effectiveBudget.toLocaleString()} available)`
                    : 'Token count from last assembled prompt'}
        >
            <div className="lumiverse-context-meter-labels">
                <span className="lumiverse-context-meter-value">
                    {isEstimate ? '~' : ''}{promptTokens.toLocaleString()} tokens
                </span>
                <span className="lumiverse-context-meter-budget">
                    / {maxContext.toLocaleString()}
                </span>
            </div>
            <div className="lumiverse-context-meter-track">
                <div
                    className="lumiverse-context-meter-fill"
                    style={{ width: `${pct}%`, background: fillColor }}
                />
            </div>
        </div>
    );
}

// ============================================================================
// MAIN LOOM BUILDER COMPONENT
// ============================================================================

export default function LoomBuilder({ compact, onClose }) {
    const {
        registry,
        activePresetId,
        activePreset,
        isLoading,
        availableMacros,
        connectionProfile,
        refreshConnectionProfile,
        SAMPLER_PARAMS: samplerParams,
        createPreset,
        selectPreset,
        saveBlocks,
        deletePreset,
        duplicatePreset,
        addBlock,
        removeBlock,
        updateBlock,
        toggleBlock,
        reorderBlocks,
        saveSamplerOverrides,
        saveCustomBody,
        savePromptBehavior,
        saveCompletionSettings,
        saveAdvancedSettings,
        importFromST,
        importFromFile,
        exportToST,
        exportInternal,
        tokenUsage,
    } = useLoomBuilder();

    const [view, setView] = useState('list'); // 'list' | 'edit'
    const [editingBlock, setEditingBlock] = useState(null);
    const [promptMenuOpen, setPromptMenuOpen] = useState(false);
    const [markerMenuOpen, setMarkerMenuOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [collapsedCategories, setCollapsedCategories] = useState(new Set());
    const fileInputRef = useRef(null);
    const importTypeRef = useRef('st');
    const lastCollapsedPresetRef = useRef(null);

    // DnD setup
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    // Compute category groups
    const groups = useMemo(
        () => computeGroups(activePreset?.blocks),
        [activePreset?.blocks],
    );

    // Default-collapse all categories when a new preset loads
    useEffect(() => {
        if (activePreset?.blocks && activePresetId && activePresetId !== lastCollapsedPresetRef.current) {
            lastCollapsedPresetRef.current = activePresetId;
            const categoryIds = activePreset.blocks
                .filter(b => b.marker === 'category')
                .map(b => b.id);
            setCollapsedCategories(new Set(categoryIds));
        }
    }, [activePresetId, activePreset]);

    // Compute visible block IDs for SortableContext (respects collapsed categories)
    const visibleBlockIds = useMemo(() => {
        const ids = [];
        for (const group of groups) {
            if (group.categoryBlock) {
                ids.push(group.categoryBlock.id);
                if (!collapsedCategories.has(group.categoryBlock.id)) {
                    for (const child of group.children) {
                        ids.push(child.id);
                    }
                }
            } else {
                for (const child of group.children) {
                    ids.push(child.id);
                }
            }
        }
        return ids;
    }, [groups, collapsedCategories]);

    const toggleCollapse = useCallback((categoryId) => {
        setCollapsedCategories(prev => {
            const next = new Set(prev);
            if (next.has(categoryId)) {
                next.delete(categoryId);
            } else {
                next.add(categoryId);
            }
            return next;
        });
    }, []);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !activePreset) return;

        const blocks = activePreset.blocks;
        const draggedBlock = blocks.find(b => b.id === active.id);
        if (!draggedBlock) return;

        if (draggedBlock.marker === 'category') {
            // Category drag: move the entire group (category + children until next category)
            const catIdx = blocks.findIndex(b => b.id === active.id);
            let endIdx = blocks.length;
            for (let i = catIdx + 1; i < blocks.length; i++) {
                if (blocks[i].marker === 'category') {
                    endIdx = i;
                    break;
                }
            }

            const group = blocks.slice(catIdx, endIdx);
            const remaining = [...blocks.slice(0, catIdx), ...blocks.slice(endIdx)];

            // Find where to insert in the remaining array
            const overIdx = remaining.findIndex(b => b.id === over.id);
            if (overIdx === -1) return;

            remaining.splice(overIdx, 0, ...group);
            saveBlocks(remaining);
        } else {
            // Normal single-block reorder
            const oldIndex = blocks.findIndex(b => b.id === active.id);
            const newIndex = blocks.findIndex(b => b.id === over.id);
            if (oldIndex === -1 || newIndex === -1) return;

            const newBlocks = arrayMove(blocks, oldIndex, newIndex);
            saveBlocks(newBlocks);
        }
    }, [activePreset, saveBlocks]);

    const handleEdit = useCallback((block) => {
        setEditingBlock(block);
        setView('edit');
    }, []);

    const handleEditSave = useCallback((updates) => {
        if (editingBlock) {
            updateBlock(editingBlock.id, updates);
        }
        setView('list');
        setEditingBlock(null);
    }, [editingBlock, updateBlock]);

    const handleAddTemplate = useCallback((template) => {
        addBlock(createBlock({
            name: template.name,
            content: template.content,
            role: template.role || 'system',
        }));
        setPromptMenuOpen(false);
    }, [addBlock]);

    const handleAddCategory = useCallback(() => {
        addBlock(createMarkerBlock('category', 'New Category'));
    }, [addBlock]);

    const handleAddMarker = useCallback((type) => {
        addBlock(createMarkerBlock(type));
        setMarkerMenuOpen(false);
    }, [addBlock]);

    const handleDelete = useCallback((blockId) => {
        setConfirmDelete(blockId);
    }, []);

    const confirmDeleteBlock = useCallback(() => {
        if (confirmDelete) {
            removeBlock(confirmDelete);
            setConfirmDelete(null);
        }
    }, [confirmDelete, removeBlock]);

    const handleDuplicatePreset = useCallback(async () => {
        if (!activePreset) return;
        const name = `${activePreset.name} (Copy)`;
        await duplicatePreset(activePresetId, name);
    }, [activePreset, activePresetId, duplicatePreset]);

    const handleDeletePreset = useCallback(async () => {
        if (!activePresetId) return;
        await deletePreset(activePresetId);
    }, [activePresetId, deletePreset]);

    const handleExport = useCallback(() => {
        const data = exportInternal();
        if (!data) return;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.name || 'loom-preset'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [exportInternal]);

    const handleImport = useCallback((type) => {
        importTypeRef.current = type;
        fileInputRef.current?.click();
    }, []);

    const handleFileSelect = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            const name = file.name.replace(/\.json$/i, '');

            if (importTypeRef.current === 'st') {
                await importFromST(json, name);
            } else {
                await importFromFile(json);
            }
        } catch (err) {
            console.error('[LoomBuilder] Import failed:', err);
        }
        e.target.value = '';
    }, [importFromST, importFromFile]);

    // Edit view
    if (view === 'edit' && editingBlock) {
        return (
            <BlockEditor
                block={editingBlock}
                onSave={handleEditSave}
                onBack={() => { setView('list'); setEditingBlock(null); }}
                availableMacros={availableMacros}
                compact={compact}
            />
        );
    }

    // List view
    return (
        <div style={getLayoutStyle(compact)}>
            {/* Header — only in modal mode. Sidebar already has PanelHeader from ViewportPanel. */}
            {!compact && (
                <div style={styles.header}>
                    {onClose && (
                        <button style={styles.iconBtn} onClick={onClose} title="Close" type="button">
                            <X size={18} />
                        </button>
                    )}
                    <Layers size={18} style={{ color: 'var(--lumiverse-primary)', flexShrink: 0 }} />
                    <h3 style={styles.title}>Loom Builder</h3>
                </div>
            )}

            {/* Preset Selector */}
            <div style={styles.toolbar}>
                <PresetSelector
                    registry={registry}
                    activePresetId={activePresetId}
                    onSelect={selectPreset}
                    onCreate={createPreset}
                    onDuplicate={handleDuplicatePreset}
                    onDelete={handleDeletePreset}
                    onImport={handleImport}
                    onExport={handleExport}
                />
            </div>

            {/* Connection profile — provider & model info */}
            {activePreset && connectionProfile && (() => {
                const { sourceName, modelName } = formatProfileLabel(connectionProfile);
                return (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 16px 8px',
                        }}
                        title={connectionProfile.model
                            ? `${sourceName} \u2022 ${connectionProfile.model}`
                            : sourceName}
                    >
                        <Wifi size={10} style={{ color: 'var(--lumiverse-text-dim)', flexShrink: 0, opacity: 0.7 }} />
                        <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--lumiverse-text-muted)',
                        }}>
                            {sourceName}
                        </span>
                        {modelName && (
                            <>
                                <span style={{
                                    fontSize: '11px',
                                    color: 'var(--lumiverse-text-dim)',
                                    opacity: 0.5,
                                }}>{'\u2022'}</span>
                                <span style={{
                                    fontSize: '11px',
                                    color: 'var(--lumiverse-text-dim)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {modelName}
                                </span>
                            </>
                        )}
                    </div>
                );
            })()}

            {/* Generation Settings — collapsible sampler overrides & custom body */}
            {activePreset && (
                <GenerationSettings
                    samplerOverrides={activePreset.samplerOverrides}
                    customBody={activePreset.customBody}
                    connectionProfile={connectionProfile}
                    samplerParams={samplerParams}
                    onSaveSamplers={saveSamplerOverrides}
                    onSaveCustomBody={saveCustomBody}
                    onRefreshProfile={refreshConnectionProfile}
                />
            )}

            {/* Prompt Behavior — utility prompts by generation type */}
            {activePreset && (
                <PromptBehaviorSettings
                    promptBehavior={activePreset.promptBehavior}
                    onSave={savePromptBehavior}
                />
            )}

            {/* Completion — prefill, names, squash, continue postfix */}
            {activePreset && (
                <CompletionSettingsPanel
                    completionSettings={activePreset.completionSettings}
                    onSave={saveCompletionSettings}
                />
            )}

            {/* Advanced — seed, custom stop strings */}
            {activePreset && (
                <AdvancedSettingsPanel
                    advancedSettings={activePreset.advancedSettings}
                    onSave={saveAdvancedSettings}
                />
            )}

            {/* Context token meter — shows prompt size vs budget after generation */}
            {activePreset && <ContextMeter tokenUsage={tokenUsage} />}

            {/* Block list or empty state */}
            <div style={styles.scrollArea}>
                {isLoading ? (
                    <div style={styles.emptyState}>Loading...</div>
                ) : !activePreset ? (
                    <div style={styles.emptyState}>
                        <Layers size={40} style={{ opacity: 0.3 }} />
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>No Preset Selected</div>
                        <div style={{ fontSize: '12px' }}>Create a new preset or select an existing one to start building.</div>
                    </div>
                ) : activePreset.blocks.length === 0 ? (
                    <div style={styles.emptyState}>
                        <div style={{ fontSize: '14px' }}>No blocks yet</div>
                        <div style={{ fontSize: '12px' }}>Add a prompt block or marker to get started.</div>
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={visibleBlockIds} strategy={verticalListSortingStrategy}>
                            {groups.map(group => (
                                <React.Fragment key={group.categoryBlock?.id || 'ungrouped'}>
                                    {/* Category header (accordion) */}
                                    {group.categoryBlock && (
                                        <SortableCategoryItem
                                            block={group.categoryBlock}
                                            isCollapsed={collapsedCategories.has(group.categoryBlock.id)}
                                            onToggleCollapse={() => toggleCollapse(group.categoryBlock.id)}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                            onToggle={toggleBlock}
                                            childCount={group.children.length}
                                        />
                                    )}
                                    {/* Children (hidden when category is collapsed) */}
                                    {(!group.categoryBlock || !collapsedCategories.has(group.categoryBlock.id)) &&
                                        group.children.map(block => (
                                            <SortableBlockItem
                                                key={block.id}
                                                block={block}
                                                onEdit={handleEdit}
                                                onDelete={handleDelete}
                                                onToggle={toggleBlock}
                                                indented={!!group.categoryBlock}
                                            />
                                        ))
                                    }
                                </React.Fragment>
                            ))}
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            {/* Action bar — sticky at bottom */}
            {activePreset && (
                <div style={{
                    ...styles.toolbar,
                    borderBottom: 'none',
                    borderTop: '1px solid var(--lumiverse-border)',
                    justifyContent: 'center',
                    flexShrink: 0,
                    background: 'var(--lumiverse-bg-elevated)',
                }}>
                    {/* Add Prompt — dropdown with templates */}
                    <div style={{ position: 'relative' }}>
                        <button
                            style={{ ...styles.btn, ...styles.btnPrimary }}
                            onClick={() => { setPromptMenuOpen(!promptMenuOpen); setMarkerMenuOpen(false); }}
                            type="button"
                        >
                            <Plus size={14} /> Add Prompt
                            <ChevronDown size={12} />
                        </button>
                        {promptMenuOpen && (
                            <div style={{ ...styles.dropdownMenu, bottom: '100%', left: 0, marginBottom: '4px' }}>
                                {PROMPT_TEMPLATES.map((item, i) => {
                                    if (item.section) {
                                        return (
                                            <div key={item.section} style={styles.sectionLabel}>
                                                {i > 0 && <hr style={{ border: 'none', borderTop: '1px solid var(--lumiverse-border)', margin: '4px 0 6px' }} />}
                                                {item.section}
                                            </div>
                                        );
                                    }
                                    return (
                                        <MenuButton
                                            key={item.name}
                                            icon={item.content ? <Zap size={14} style={{ opacity: 0.5 }} /> : <FileText size={14} style={{ opacity: 0.5 }} />}
                                            label={item.name}
                                            onClick={() => handleAddTemplate(item)}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <button
                        style={styles.btn}
                        onClick={handleAddCategory}
                        type="button"
                    >
                        <ChevronRight size={14} /> Add Category
                    </button>

                    <div style={{ position: 'relative' }}>
                        <button
                            style={styles.btn}
                            onClick={() => { setMarkerMenuOpen(!markerMenuOpen); setPromptMenuOpen(false); }}
                            type="button"
                        >
                            <Hash size={14} /> Add Marker
                            <ChevronDown size={12} />
                        </button>
                        {markerMenuOpen && (
                            <div style={{ ...styles.dropdownMenu, bottom: '100%', left: 0, marginBottom: '4px', minWidth: '200px' }}>
                                {ADDABLE_MARKERS.map((item, i) => {
                                    if (typeof item === 'object' && item.section) {
                                        return (
                                            <div key={item.section} style={styles.sectionLabel}>
                                                {i > 0 && <hr style={{ border: 'none', borderTop: '1px solid var(--lumiverse-border)', margin: '4px 0 6px' }} />}
                                                {item.section}
                                            </div>
                                        );
                                    }
                                    return (
                                        <MenuButton
                                            key={item}
                                            icon={<Hash size={14} />}
                                            label={MARKER_LABELS[item] || item}
                                            onClick={() => handleAddMarker(item)}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Hidden file input for import */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
            />

            {/* Confirm delete dialog */}
            <ConfirmationModal
                isOpen={!!confirmDelete}
                title="Delete Block"
                message="Are you sure you want to delete this block? This action cannot be undone."
                variant="danger"
                confirmText="Delete"
                onConfirm={confirmDeleteBlock}
                onCancel={() => setConfirmDelete(null)}
            />
        </div>
    );
}
