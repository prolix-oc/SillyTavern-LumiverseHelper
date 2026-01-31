import React, { useState, useMemo, useCallback } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
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
    Save,
    X,
    Edit2,
    Eye,
    EyeOff,
    Bookmark,
    BookmarkCheck,
    Check,
    ArrowLeft,
    MoreVertical,
    FileText,
    Settings2,
    Download
} from 'lucide-react';
import clsx from 'clsx';
import { usePresetEditor } from '../../hooks/usePresetEditor';

const CATEGORY_MARKER = '\u2501';

// Shared styles (could be extracted, but keeping self-contained for now)
const styles = {
    layout: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
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
    headerContent: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minWidth: 0, // Allow flex shrinking
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
        // overflowX: 'auto', // Removed to allow dropdowns to overflow visibly
        flexShrink: 0,
        background: 'rgba(0,0,0,0.1)',
        position: 'relative',
        zIndex: 10,
    },
    scrollArea: {
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        padding: '16px',
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
        fontFamily: 'var(--lumiverse-font-mono)',
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
        marginBottom: '8px',
        transition: 'all 0.2s ease',
        touchAction: 'none', // Critical for drag on touch
    },
    itemDragging: {
        opacity: 0.5,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        borderColor: 'var(--lumiverse-primary)',
    },
    category: {
        background: 'rgba(147, 112, 219, 0.1)',
        borderColor: 'rgba(147, 112, 219, 0.2)',
    },
    badge: {
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '4px',
        textTransform: 'uppercase',
        fontWeight: 600,
        marginLeft: '8px',
    },
    badgeSystem: { background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' },
    badgeUser: { background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' },
    badgeAssistant: { background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' },
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
    }
};

/**
 * Sortable Prompt Item Component
 */
function SortablePromptItem({ prompt, index, onEdit, onDelete, onToggleEnabled, onToggleCollapse, isCollapsed }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: prompt.identifier || prompt._uiId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
    };

    const isCategory = prompt.name.startsWith(CATEGORY_MARKER);
    const displayName = isCategory ? prompt.name.substring(1).trim() : prompt.name;

    const getRoleBadgeStyle = (role) => {
        switch(role) {
            case 'user': return styles.badgeUser;
            case 'assistant': return styles.badgeAssistant;
            default: return styles.badgeSystem;
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={{ ...styles.item, ...(isCategory ? styles.category : {}), ...style }}
            className={clsx(
                'lumiverse-prompt-item',
                !prompt.enabled && 'opacity-50 grayscale'
            )}
        >
            <div 
                {...attributes} 
                {...listeners} 
                style={{ cursor: 'grab', padding: '4px', color: 'var(--lumiverse-text-dim)', marginRight: '8px' }}
            >
                <GripVertical size={16} />
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0, gap: '8px' }}>
                {isCategory && (
                    <button 
                        style={styles.iconBtn} 
                        onClick={() => onToggleCollapse(prompt.identifier || prompt._uiId)}
                    >
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                    </button>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {displayName}
                        </span>
                        {!isCategory && (
                            <span style={{ ...styles.badge, ...getRoleBadgeStyle(prompt.role) }}>
                                {prompt.role}
                            </span>
                        )}
                    </div>
                    {!isCategory && (
                        <div style={{ fontSize: '11px', color: 'var(--lumiverse-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {prompt.content.substring(0, 80)}
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <button
                    style={styles.iconBtn}
                    onClick={() => onToggleEnabled(prompt)}
                    title={prompt.enabled ? "Disable" : "Enable"}
                >
                    {prompt.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                    style={styles.iconBtn}
                    onClick={() => onEdit(prompt)}
                    title="Edit"
                >
                    <Edit2 size={16} />
                </button>
                <button
                    style={{ ...styles.iconBtn, color: 'var(--lumiverse-danger)' }}
                    onClick={() => onDelete(prompt)}
                    title="Delete"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
}

/**
 * Edit Prompt Form View
 * Replaces the main view when editing
 */
function EditPromptView({ form, setForm, onSave, onCancel }) {
    return (
        <div style={styles.layout}>
            {/* Header */}
            <div style={styles.header}>
                <button style={styles.iconBtn} onClick={onCancel}>
                    <ArrowLeft size={20} />
                </button>
                <div style={{ ...styles.title, flex: 1 }}>
                    {form.name.startsWith(CATEGORY_MARKER) ? 'Edit Category' : 'Edit Prompt'}
                </div>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={onSave}>
                    <Check size={16} /> Save
                </button>
            </div>

            {/* Content */}
            <div style={styles.scrollArea}>
                <div style={styles.form}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Name</label>
                        <input
                            style={styles.input}
                            type="text"
                            value={form.name.startsWith(CATEGORY_MARKER) ? form.name.substring(1).trim() : form.name}
                            onChange={e => {
                                const val = e.target.value;
                                if (form.name.startsWith(CATEGORY_MARKER)) {
                                    setForm({...form, name: `${CATEGORY_MARKER} ${val}`});
                                } else {
                                    setForm({...form, name: val});
                                }
                            }}
                            placeholder="Enter name..."
                        />
                    </div>

                    {!form.name.startsWith(CATEGORY_MARKER) && (
                        <>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Role</label>
                                <select
                                    style={styles.select}
                                    value={form.role}
                                    onChange={e => setForm({...form, role: e.target.value})}
                                >
                                    <option value="system">System</option>
                                    <option value="user">User</option>
                                    <option value="assistant">Assistant</option>
                                </select>
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.label}>Content (Supports Macros)</label>
                                <textarea
                                    style={styles.textarea}
                                    value={form.content}
                                    onChange={e => setForm({...form, content: e.target.value})}
                                    placeholder="Enter prompt content..."
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Injection Position</label>
                                    <select
                                        style={styles.select}
                                        value={form.injection_position || 0}
                                        onChange={e => setForm({...form, injection_position: parseInt(e.target.value)})}
                                    >
                                        <option value={0}>Relative (Depth)</option>
                                        <option value={1}>Absolute (Index)</option>
                                    </select>
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>
                                        {form.injection_position === 1 ? 'Index' : 'Depth'}
                                    </label>
                                    <input
                                        style={styles.input}
                                        type="number"
                                        value={form.injection_depth || 4}
                                        onChange={e => setForm({...form, injection_depth: parseInt(e.target.value)})}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Main Preset Editor Component
 */
export default function PresetEditor({ onClose }) {
    const {
        currentPreset,
        prompts,
        availablePresets,
        toggleStateNames,
        savePrompts,
        selectPreset,
        exportPreset,
        saveToggleState,
        applyToggleState,
        deleteToggleState,
        isLoading,
    } = usePresetEditor();

    const [view, setView] = useState('list'); // 'list' | 'edit'
    const [editForm, setEditForm] = useState(null);
    const [editingIndex, setEditingIndex] = useState(null); // Keep track of index for saving
    const [collapsedCategories, setCollapsedCategories] = useState(new Set());
    const [activeId, setActiveId] = useState(null);
    
    // Toggle state UI
    const [showToggleMenu, setShowToggleMenu] = useState(false);
    const [newStateName, setNewStateName] = useState('');
    const [toggleMsg, setToggleMsg] = useState(null);

    // Helpers
    const toggleCategory = (id) => {
        const newCollapsed = new Set(collapsedCategories);
        if (newCollapsed.has(id)) newCollapsed.delete(id);
        else newCollapsed.add(id);
        setCollapsedCategories(newCollapsed);
    };

    const findRealIndex = (prompt) => {
        return prompts.findIndex(p => (p.identifier || p._uiId) === (prompt.identifier || prompt._uiId));
    };

    // Filter prompts for display
    const visiblePrompts = useMemo(() => {
        const result = [];
        let isHidden = false;
        
        for (const prompt of prompts) {
            const isCategory = prompt.name.startsWith(CATEGORY_MARKER);
            if (isCategory) {
                const id = prompt.identifier || prompt._uiId;
                isHidden = collapsedCategories.has(id);
                result.push(prompt);
            } else {
                if (!isHidden) {
                    result.push(prompt);
                }
            }
        }
        return result;
    }, [prompts, collapsedCategories]);

    // Handlers
    const handleEditPrompt = (prompt) => {
        const realIndex = findRealIndex(prompt);
        setEditingIndex(realIndex);
        setEditForm({ ...prompts[realIndex] });
        setView('edit');
    };

    const handleSaveEdit = () => {
        if (editingIndex !== null && editForm) {
            const newPrompts = [...prompts];
            newPrompts[editingIndex] = editForm;
            savePrompts(newPrompts);
        }
        setView('list');
        setEditingIndex(null);
        setEditForm(null);
    };

    const handleCancelEdit = () => {
        setView('list');
        setEditingIndex(null);
        setEditForm(null);
    };

    const handleDeletePrompt = (prompt) => {
        if (confirm('Are you sure you want to delete this prompt?')) {
            const realIndex = findRealIndex(prompt);
            const newPrompts = [...prompts];
            newPrompts.splice(realIndex, 1);
            savePrompts(newPrompts);
        }
    };

    const handleToggleEnabledPrompt = (prompt) => {
        const realIndex = findRealIndex(prompt);
        const newPrompts = [...prompts];
        newPrompts[realIndex].enabled = !newPrompts[realIndex].enabled;
        savePrompts(newPrompts);
    };

    const handleAddPrompt = (isCategory = false) => {
        const newPrompt = {
            identifier: crypto.randomUUID(),
            name: isCategory ? `${CATEGORY_MARKER} New Category` : 'New Prompt',
            content: '',
            role: 'system',
            enabled: true,
            injection_position: 0,
            injection_depth: 4,
            _uiId: crypto.randomUUID()
        };
        const newPrompts = [...prompts, newPrompt];
        savePrompts(newPrompts);
        
        // Immediately edit new prompt
        setEditingIndex(newPrompts.length - 1);
        setEditForm(newPrompt);
        setView('edit');
    };

    // Toggle State Logic
    const handleSaveState = async () => {
        if (!newStateName.trim()) return;
        await saveToggleState(newStateName.trim());
        setNewStateName('');
        setToggleMsg('Saved!');
        setTimeout(() => setToggleMsg(null), 2000);
    };

    // Drag & Drop
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragStart = (e) => setActiveId(e.active.id);
    const handleDragEnd = (e) => {
        const { active, over } = e;
        setActiveId(null);
        if (over && active.id !== over.id) {
            const oldIndex = prompts.findIndex(p => (p.identifier || p._uiId) === active.id);
            const newIndex = prompts.findIndex(p => (p.identifier || p._uiId) === over.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                savePrompts(arrayMove(prompts, oldIndex, newIndex));
            }
        }
    };

    // If editing, show edit view
    if (view === 'edit' && editForm) {
        return (
            <EditPromptView 
                form={editForm} 
                setForm={setEditForm} 
                onSave={handleSaveEdit} 
                onCancel={handleCancelEdit} 
            />
        );
    }

    if (isLoading && !currentPreset) {
        return (
            <div style={{ ...styles.layout, alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: 'var(--lumiverse-text-muted)' }}>Loading Preset...</div>
            </div>
        );
    }

    return (
        <div style={styles.layout}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerContent}>
                    <Settings2 size={20} color="var(--lumiverse-primary)" />
                    <select 
                        style={{ ...styles.select, flex: 1, minWidth: '0' }}
                        value={currentPreset?.name || ''}
                        onChange={(e) => selectPreset(e.target.value)}
                    >
                        {availablePresets.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                </div>
                <button style={styles.iconBtn} onClick={onClose}>
                    <X size={20} />
                </button>
            </div>

            {/* Toolbar */}
            <div style={styles.toolbar}>
                <button style={styles.btn} onClick={() => handleAddPrompt(false)}>
                    <Plus size={16} /> <span className="hidden-sm">Prompt</span>
                </button>
                <button style={styles.btn} onClick={() => handleAddPrompt(true)}>
                    <Plus size={16} /> <span className="hidden-sm">Category</span>
                </button>
                
                <div style={{ width: '1px', height: '20px', background: 'var(--lumiverse-border)', margin: '0 4px' }}></div>
                
                <div style={{ position: 'relative' }}>
                    <button 
                        style={{ ...styles.btn, ...(showToggleMenu ? styles.btnPrimary : {}) }}
                        onClick={() => setShowToggleMenu(!showToggleMenu)}
                        title="Manage States"
                    >
                        {toggleStateNames.length > 0 ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                        <span className="hidden-sm">States</span>
                    </button>

                    {/* Dropdown Menu for States */}
                    {showToggleMenu && (
                        <>
                            <div className="lumiverse-states-backdrop" onClick={() => setShowToggleMenu(false)} />
                            <div 
                                className="lumiverse-states-menu"
                                style={{
                                    position: 'absolute',
                                    top: '100%',
                                    bottom: 'auto',
                                    left: '0',
                                    marginTop: '4px',
                                    transform: 'none'
                                }}
                            >
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--lumiverse-text-muted)' }}>
                                    SAVE CURRENT STATE
                                </div>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <input 
                                    style={{ ...styles.input, flex: 1, padding: '6px' }}
                                    placeholder="State name..."
                                    value={newStateName}
                                    onChange={e => setNewStateName(e.target.value)}
                                />
                                <button style={{ ...styles.btn, ...styles.btnPrimary, padding: '6px', flexShrink: 0 }} onClick={handleSaveState}>
                                    <Save size={14} />
                                </button>
                            </div>
                            {toggleMsg && <div style={{ fontSize: '11px', color: 'var(--lumiverse-success)' }}>{toggleMsg}</div>}

                            {toggleStateNames.length > 0 && (
                                <>
                                    <div style={{ height: '1px', background: 'var(--lumiverse-border)', margin: '4px 0' }}></div>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--lumiverse-text-muted)' }}>
                                        LOAD STATE
                                    </div>
                                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                        {toggleStateNames.map(name => (
                                            <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px', borderRadius: '4px', hover: { background: 'rgba(255,255,255,0.05)' } }}>
                                                <span 
                                                    style={{ fontSize: '13px', cursor: 'pointer', flex: 1 }}
                                                    onClick={() => { applyToggleState(name); setShowToggleMenu(false); }}
                                                >
                                                    {name}
                                                </span>
                                                <button 
                                                    style={{ ...styles.iconBtn, color: 'var(--lumiverse-danger)', padding: '2px' }}
                                                    onClick={(e) => { e.stopPropagation(); deleteToggleState(name); }}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        </>
                    )}
                </div>

                <div style={{ flex: 1 }}></div>

                <button style={styles.btn} onClick={exportPreset} title="Export Preset">
                    <Download size={16} />
                </button>
            </div>

            {/* Content List */}
            <div style={styles.scrollArea}>
                {visiblePrompts.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--lumiverse-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <FileText size={48} strokeWidth={1} style={{ opacity: 0.3 }} />
                        <div>
                            {prompts.length === 0 
                                ? "This preset is empty." 
                                : "All prompts are hidden in collapsed categories."}
                        </div>
                        {prompts.length === 0 && (
                            <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => handleAddPrompt(false)}>
                                Create First Prompt
                            </button>
                        )}
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={visiblePrompts.map(p => p.identifier || p._uiId)}
                            strategy={verticalListSortingStrategy}
                        >
                            {visiblePrompts.map((prompt) => (
                                <SortablePromptItem
                                    key={prompt.identifier || prompt._uiId}
                                    prompt={prompt}
                                    index={0}
                                    onEdit={handleEditPrompt}
                                    onDelete={handleDeletePrompt}
                                    onToggleEnabled={handleToggleEnabledPrompt}
                                    onToggleCollapse={toggleCategory}
                                    isCollapsed={collapsedCategories.has(prompt.identifier || prompt._uiId)}
                                />
                            ))}
                        </SortableContext>
                        <DragOverlay>
                            {activeId ? (
                                <div style={{ ...styles.item, ...styles.itemDragging }}>
                                    Drag Item...
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                )}
            </div>
        </div>
    );
}
