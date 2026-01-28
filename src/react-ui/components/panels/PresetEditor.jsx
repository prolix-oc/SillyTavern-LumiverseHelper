
import React, { useState, useMemo } from 'react';
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
    MoreVertical,
    Eye,
    EyeOff,
    Check
} from 'lucide-react';
import clsx from 'clsx';
import { usePresetEditor } from '../../hooks/usePresetEditor';

const CATEGORY_MARKER = '\u2501';

/**
 * Sortable Prompt Item
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
        opacity: isDragging ? 0.5 : 1,
    };

    const isCategory = prompt.name.startsWith(CATEGORY_MARKER);
    const displayName = isCategory ? prompt.name.substring(1).trim() : prompt.name;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={clsx(
                'lumiverse-prompt-item',
                isCategory && 'lumiverse-prompt-category',
                !prompt.enabled && 'lumiverse-prompt-disabled'
            )}
        >
            <div className="lumiverse-prompt-drag-handle" {...attributes} {...listeners}>
                <GripVertical size={16} />
            </div>

            <div className="lumiverse-prompt-content">
                <div className="lumiverse-prompt-header">
                    {isCategory && (
                        <button 
                            className="lumiverse-icon-btn" 
                            onClick={() => onToggleCollapse(prompt.identifier || prompt._uiId)}
                            style={{ marginRight: 4 }}
                        >
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </button>
                    )}
                    <span className="lumiverse-prompt-name">{displayName}</span>
                    <div className="lumiverse-prompt-badges">
                         <span className={clsx('lumiverse-badge', `lumiverse-badge-${prompt.role}`)}>
                            {prompt.role}
                         </span>
                    </div>
                </div>
                {!isCategory && (
                    <div className="lumiverse-prompt-preview">
                        {prompt.content.substring(0, 60)}
                        {prompt.content.length > 60 && '...'}
                    </div>
                )}
            </div>

            <div className="lumiverse-prompt-actions">
                <button
                    className="lumiverse-icon-btn"
                    onClick={() => onToggleEnabled(index)}
                    title={prompt.enabled ? "Disable" : "Enable"}
                >
                    {prompt.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                    className="lumiverse-icon-btn"
                    onClick={() => onEdit(index)}
                    title="Edit"
                >
                    <Edit2 size={16} />
                </button>
                <button
                    className="lumiverse-icon-btn lumiverse-btn-danger"
                    onClick={() => onDelete(index)}
                    title="Delete"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
}

/**
 * Prompt Editor Modal
 */
export default function PresetEditor({ onClose }) {
    const {
        currentPreset,
        prompts,
        savePrompts,
        isLoading,
        error
    } = usePresetEditor();

    const [editingIndex, setEditingIndex] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [collapsedCategories, setCollapsedCategories] = useState(new Set());

    const toggleCategory = (id) => {
        const newCollapsed = new Set(collapsedCategories);
        if (newCollapsed.has(id)) {
            newCollapsed.delete(id);
        } else {
            newCollapsed.add(id);
        }
        setCollapsedCategories(newCollapsed);
    };

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

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            const oldIndex = prompts.findIndex(p => (p.identifier || p._uiId) === active.id);
            const newIndex = prompts.findIndex(p => (p.identifier || p._uiId) === over.id);
            
            savePrompts(arrayMove(prompts, oldIndex, newIndex));
        }
    };

    const handleEdit = (index) => {
        // Find the actual prompt in the full list
        // The index passed from SortablePromptItem might be from visiblePrompts if I mapped index there?
        // Wait, SortablePromptItem receives `index`. If I map `visiblePrompts`, index is index in `visiblePrompts`.
        // But I need index in `prompts` for editing.
        // Better to pass prompt object or ID to handleEdit
        
        // I'll fix this below in the render loop
        setEditingIndex(index); 
        setEditForm({ ...prompts[index] });
    };
    
    // ... helper functions need to use ID or find index
    
    const findRealIndex = (prompt) => {
        return prompts.findIndex(p => (p.identifier || p._uiId) === (prompt.identifier || prompt._uiId));
    };

    // Refactored handlers to use prompt object/ID
    const handleEditPrompt = (prompt) => {
        const realIndex = findRealIndex(prompt);
        setEditingIndex(realIndex);
        setEditForm({ ...prompts[realIndex] });
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

    const handleSaveEdit = () => {
        const newPrompts = [...prompts];
        newPrompts[editingIndex] = editForm;
        savePrompts(newPrompts);
        setEditingIndex(null);
        setEditForm(null);
    };

    const handleCancelEdit = () => {
        setEditingIndex(null);
        setEditForm(null);
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
        savePrompts([...prompts, newPrompt]);
    };

    if (isLoading && !currentPreset) {
        return <div className="lumiverse-loading">Loading...</div>;
    }

    return (
        <div className="lumiverse-preset-editor">
            <div className="lumiverse-modal-header">
                <h3>Preset Editor: {currentPreset?.name}</h3>
                <button className="lumiverse-close-btn" onClick={onClose}>
                    <X size={20} />
                </button>
            </div>

            <div className="lumiverse-editor-content">
                {/* Toolbar */}
                <div className="lumiverse-toolbar">
                    <button className="lumiverse-btn" onClick={() => handleAddPrompt(false)}>
                        <Plus size={16} /> Add Prompt
                    </button>
                    <button className="lumiverse-btn" onClick={() => handleAddPrompt(true)}>
                        <Plus size={16} /> Add Category
                    </button>
                </div>

                {/* Edit Form Overlay */}
                {editingIndex !== null && (
                    <div className="lumiverse-edit-form">
                        <h4>Edit Prompt</h4>
                        <div className="lumiverse-form-group">
                            <label>Name</label>
                            <input
                                type="text"
                                value={editForm.name}
                                onChange={e => setEditForm({...editForm, name: e.target.value})}
                            />
                        </div>
                        <div className="lumiverse-form-group">
                            <label>Role</label>
                            <select
                                value={editForm.role}
                                onChange={e => setEditForm({...editForm, role: e.target.value})}
                            >
                                <option value="system">System</option>
                                <option value="user">User</option>
                                <option value="assistant">Assistant</option>
                            </select>
                        </div>
                        <div className="lumiverse-form-group">
                            <label>Content</label>
                            <textarea
                                value={editForm.content}
                                onChange={e => setEditForm({...editForm, content: e.target.value})}
                                rows={10}
                            />
                        </div>
                        <div className="lumiverse-form-actions">
                            <button className="lumiverse-btn lumiverse-btn-primary" onClick={handleSaveEdit}>
                                <Check size={16} /> Save
                            </button>
                            <button className="lumiverse-btn" onClick={handleCancelEdit}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Draggable List */}
                <div className="lumiverse-prompt-list">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
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
                                    index={0} // Not used for actions anymore
                                    onEdit={() => handleEditPrompt(prompt)}
                                    onDelete={() => handleDeletePrompt(prompt)}
                                    onToggleEnabled={() => handleToggleEnabledPrompt(prompt)}
                                    onToggleCollapse={toggleCategory}
                                    isCollapsed={collapsedCategories.has(prompt.identifier || prompt._uiId)}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>
            </div>
        </div>
    );
}
