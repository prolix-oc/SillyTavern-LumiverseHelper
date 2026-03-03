import React, { useState, useCallback, useRef, useMemo } from 'react';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { Wrench, Trash2, X, Plus, ChevronDown } from 'lucide-react';
import ConfirmationModal from '../shared/ConfirmationModal';
import { getToolNames } from '@lib/councilTools';

/**
 * DLC Tool Item Structure:
 * {
 *   toolName: string,           // Creator-defined, unique across built-in tools
 *   displayName: string,
 *   description: string,
 *   prompt: string,
 *   inputSchema: { type: "object", properties: {...}, required: [...] },
 *   resultVariable: string|null,
 *   storeInDeliberation: boolean,
 *   authorName: string|null,
 *   version: 1
 * }
 */

const PROPERTY_TYPES = [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
];

function CharCount({ text }) {
    if (!text) return null;
    return (
        <span className="lumiverse-editor-char-count">
            {text.length} chars
        </span>
    );
}

function createEmptyProperty() {
    return {
        id: Date.now() + Math.random(),
        name: '',
        type: 'string',
        description: '',
        required: false,
        enumValues: '',
    };
}

/**
 * Convert inputSchema object to editable property rows
 */
function schemaToProperties(inputSchema) {
    if (!inputSchema?.properties) return [];
    const required = inputSchema.required || [];
    return Object.entries(inputSchema.properties).map(([name, prop]) => ({
        id: Date.now() + Math.random(),
        name,
        type: prop.type || 'string',
        description: prop.description || '',
        required: required.includes(name),
        enumValues: prop.enum ? prop.enum.join(', ') : '',
    }));
}

/**
 * Convert property rows back to inputSchema object
 */
function propertiesToSchema(properties) {
    const schema = { type: 'object', properties: {}, required: [] };
    for (const prop of properties) {
        if (!prop.name.trim()) continue;
        const propDef = {
            type: prop.type,
            description: prop.description || `The ${prop.name} value`,
        };
        if (prop.type === 'string' && prop.enumValues.trim()) {
            propDef.enum = prop.enumValues.split(',').map(v => v.trim()).filter(Boolean);
        }
        schema.properties[prop.name.trim()] = propDef;
        if (prop.required) {
            schema.required.push(prop.name.trim());
        }
    }
    return schema;
}

/* ============================================
   Schema Property Row
   ============================================ */
function SchemaPropertyRow({ property, onChange, onRemove }) {
    const update = (field, value) => onChange({ ...property, [field]: value });

    return (
        <div className="lumiverse-tool-schema-row">
            <div className="lumiverse-tool-schema-row-fields">
                <input
                    type="text"
                    className="lumiverse-editor-input lumiverse-tool-schema-name"
                    value={property.name}
                    onChange={(e) => update('name', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="property_name"
                />
                <div className="lumiverse-tool-schema-type-wrap">
                    <select
                        className="lumiverse-editor-input lumiverse-tool-schema-type"
                        value={property.type}
                        onChange={(e) => update('type', e.target.value)}
                    >
                        {PROPERTY_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                    <ChevronDown size={12} className="lumiverse-tool-schema-type-chevron" />
                </div>
                <label className="lumiverse-tool-schema-required">
                    <input
                        type="checkbox"
                        checked={property.required}
                        onChange={(e) => update('required', e.target.checked)}
                    />
                    <span>Req</span>
                </label>
                <button
                    type="button"
                    className="lumiverse-tool-schema-remove"
                    onClick={onRemove}
                    title="Remove property"
                >
                    <X size={13} />
                </button>
            </div>
            <input
                type="text"
                className="lumiverse-editor-input lumiverse-tool-schema-desc"
                value={property.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Description of this property"
            />
            {property.type === 'string' && (
                <input
                    type="text"
                    className="lumiverse-editor-input lumiverse-tool-schema-enum"
                    value={property.enumValues}
                    onChange={(e) => update('enumValues', e.target.value)}
                    placeholder="Enum values (comma-separated, optional)"
                />
            )}
        </div>
    );
}

/* ============================================
   Main Component
   ============================================ */
function ToolEditorModal({ packName, editingItem = null, onClose, onSaved }) {
    const { allPacks } = usePacks();
    const actions = useLumiverseActions();
    const isEditing = editingItem !== null;

    const pack = allPacks.find(p => (p.name || p.packName) === packName);

    // Get built-in tool names for collision checking
    const builtInToolNames = useMemo(() => getToolNames(), []);

    // Form state
    const [toolName, setToolName] = useState(editingItem?.toolName || '');
    const [displayName, setDisplayName] = useState(editingItem?.displayName || '');
    const [description, setDescription] = useState(editingItem?.description || '');
    const [prompt, setPrompt] = useState(editingItem?.prompt || '');
    const [authorName, setAuthorName] = useState(editingItem?.authorName || '');
    const [resultVariable, setResultVariable] = useState(editingItem?.resultVariable || '');
    const [storeInDeliberation, setStoreInDeliberation] = useState(editingItem?.storeInDeliberation === true);
    const [properties, setProperties] = useState(() =>
        editingItem?.inputSchema ? schemaToProperties(editingItem.inputSchema) : [createEmptyProperty()]
    );
    const [errors, setErrors] = useState({});

    // Confirmation modals
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    // Track initial values for dirty checking
    const initialRef = useRef({
        toolName: editingItem?.toolName || '',
        displayName: editingItem?.displayName || '',
        description: editingItem?.description || '',
        prompt: editingItem?.prompt || '',
        authorName: editingItem?.authorName || '',
        resultVariable: editingItem?.resultVariable || '',
        storeInDeliberation: editingItem?.storeInDeliberation === true,
    });

    const isDirty = useCallback(() => {
        const init = initialRef.current;
        return toolName !== init.toolName ||
            displayName !== init.displayName ||
            description !== init.description ||
            prompt !== init.prompt ||
            authorName !== init.authorName ||
            resultVariable !== init.resultVariable ||
            storeInDeliberation !== init.storeInDeliberation;
    }, [toolName, displayName, description, prompt, authorName, resultVariable, storeInDeliberation]);

    const handleClose = useCallback(() => {
        if (isDirty()) {
            setShowDiscardConfirm(true);
        } else {
            onClose();
        }
    }, [isDirty, onClose]);

    const validate = useCallback(() => {
        const newErrors = {};
        const trimmedName = toolName.trim();

        if (!trimmedName) {
            newErrors.toolName = 'Tool name is required';
        } else if (!/^[a-zA-Z0-9_]+$/.test(trimmedName)) {
            newErrors.toolName = 'Tool name must be alphanumeric (a-z, 0-9, _)';
        } else if (builtInToolNames.includes(trimmedName)) {
            newErrors.toolName = `"${trimmedName}" is a built-in tool name`;
        } else if (pack) {
            // Check for duplicate in same pack (exclude current when editing)
            const loomTools = pack.loomTools || [];
            const existing = loomTools.find(t =>
                t.toolName === trimmedName && (!isEditing || t.toolName !== editingItem?.toolName)
            );
            if (existing) {
                newErrors.toolName = `A tool named "${trimmedName}" already exists in this pack`;
            }
        }

        if (!displayName.trim()) newErrors.displayName = 'Display name is required';
        if (!prompt.trim()) newErrors.prompt = 'Tool prompt is required';

        if (resultVariable && !/^[a-zA-Z0-9_]+$/.test(resultVariable)) {
            newErrors.resultVariable = 'Variable name must be alphanumeric (a-z, 0-9, _)';
        }

        // Validate properties
        const propNames = new Set();
        for (const prop of properties) {
            if (prop.name.trim()) {
                if (propNames.has(prop.name.trim())) {
                    newErrors.properties = 'Duplicate property names detected';
                    break;
                }
                propNames.add(prop.name.trim());
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [toolName, displayName, prompt, resultVariable, properties, builtInToolNames, pack, isEditing, editingItem]);

    const handleSave = useCallback(() => {
        if (!validate()) return;

        const toolItem = {
            toolName: toolName.trim(),
            displayName: displayName.trim(),
            description: description.trim(),
            prompt: prompt.trim(),
            inputSchema: propertiesToSchema(properties.filter(p => p.name.trim())),
            resultVariable: resultVariable.trim() || null,
            storeInDeliberation: resultVariable.trim() ? storeInDeliberation : false,
            authorName: authorName.trim() || null,
            version: 1,
        };

        if (pack) {
            const currentItems = [...(pack.loomTools || [])];

            if (isEditing && editingItem?.toolName) {
                const index = currentItems.findIndex(t => t.toolName === editingItem.toolName);
                if (index >= 0) currentItems[index] = toolItem;
                else currentItems.push(toolItem);
            } else {
                currentItems.push(toolItem);
            }

            const updatedPack = { ...pack, loomTools: currentItems };
            const packKey = pack.id || pack.name || pack.packName;

            if (pack.isCustom) {
                actions.updateCustomPack(packKey, updatedPack);
            } else {
                actions.updateCustomPack(packKey, { ...updatedPack, isCustom: true });
            }

            saveToExtension();
            if (onSaved) onSaved(toolItem, packName);
        }
        onClose();
    }, [validate, toolName, displayName, description, prompt, properties, resultVariable, storeInDeliberation, authorName, pack, isEditing, editingItem, actions, packName, onClose, onSaved]);

    const handleDelete = useCallback(() => {
        if (!isEditing || !editingItem) return;
        setShowDeleteConfirm(true);
    }, [isEditing, editingItem]);

    const confirmDelete = useCallback(() => {
        if (pack && editingItem?.toolName) {
            const currentItems = pack.loomTools || [];
            const updatedItems = currentItems.filter(t => t.toolName !== editingItem.toolName);
            const updatedPack = { ...pack, loomTools: updatedItems };
            const packKey = pack.id || pack.name || pack.packName;

            if (pack.isCustom) {
                actions.updateCustomPack(packKey, updatedPack);
            } else {
                actions.updateCustomPack(packKey, { ...updatedPack, isCustom: true });
            }
            saveToExtension();
        }
        setShowDeleteConfirm(false);
        onClose();
    }, [editingItem, pack, actions, onClose]);

    // Schema property handlers
    const handlePropertyChange = useCallback((index, updated) => {
        setProperties(prev => {
            const next = [...prev];
            next[index] = updated;
            return next;
        });
    }, []);

    const handleAddProperty = useCallback(() => {
        setProperties(prev => [...prev, createEmptyProperty()]);
    }, []);

    const handleRemoveProperty = useCallback((index) => {
        setProperties(prev => prev.filter((_, i) => i !== index));
    }, []);

    if (!pack) {
        return (
            <div className="lumiverse-editor-layout">
                <div className="lumiverse-editor-scroll" style={{ textAlign: 'center', paddingTop: '40px' }}>
                    <p style={{ color: 'var(--lumiverse-text-muted)' }}>Pack "{packName}" not found.</p>
                    <button className="lumiverse-editor-btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        );
    }

    return (
        <div className="lumiverse-editor-layout">
            {/* Mobile swipe handle */}
            <div className="lumiverse-editor-swipe-handle" />

            {/* Header */}
            <div className="lumiverse-editor-header">
                <div className="lumiverse-editor-header-icon">
                    <Wrench size={18} />
                </div>
                <div className="lumiverse-editor-header-text">
                    <h2 className="lumiverse-editor-header-title">{isEditing ? 'Edit Tool' : 'Create New Tool'}</h2>
                    <div className="lumiverse-editor-header-subtitle">{pack.packName || pack.name}</div>
                </div>
                <button className="lumiverse-editor-close-btn" onClick={handleClose}>
                    <X size={18} />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="lumiverse-editor-scroll">
                {/* Tool Details Section */}
                <div className="lumiverse-editor-section">
                    <div className="lumiverse-editor-section-header">
                        <div className="lumiverse-editor-section-icon"><Wrench size={15} /></div>
                        <span className="lumiverse-editor-section-title">Tool Details</span>
                    </div>

                    {/* Tool Name */}
                    <div className="lumiverse-editor-field">
                        <label className="lumiverse-editor-label">
                            Tool Name <span className="lumiverse-editor-required">*</span>
                        </label>
                        <input
                            type="text"
                            className="lumiverse-editor-input"
                            value={toolName}
                            onChange={(e) => {
                                setToolName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''));
                                if (errors.toolName) setErrors(prev => ({ ...prev, toolName: null }));
                            }}
                            placeholder="e.g., analyze_mood"
                            autoFocus
                        />
                        <div className="lumiverse-editor-hint">Alphanumeric + underscore only. Must not match a built-in tool name.</div>
                        {errors.toolName && <div className="lumiverse-editor-error">{errors.toolName}</div>}
                    </div>

                    {/* Display Name */}
                    <div className="lumiverse-editor-field">
                        <label className="lumiverse-editor-label">
                            Display Name <span className="lumiverse-editor-required">*</span>
                        </label>
                        <input
                            type="text"
                            className="lumiverse-editor-input"
                            value={displayName}
                            onChange={(e) => {
                                setDisplayName(e.target.value);
                                if (errors.displayName) setErrors(prev => ({ ...prev, displayName: null }));
                            }}
                            placeholder="e.g., Mood Analyzer"
                        />
                        {errors.displayName && <div className="lumiverse-editor-error">{errors.displayName}</div>}
                    </div>

                    {/* Description */}
                    <div className="lumiverse-editor-field">
                        <label className="lumiverse-editor-label">Description</label>
                        <input
                            type="text"
                            className="lumiverse-editor-input"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of what this tool does"
                        />
                    </div>

                    {/* Author */}
                    <div className="lumiverse-editor-field">
                        <label className="lumiverse-editor-label">Author</label>
                        <input
                            type="text"
                            className="lumiverse-editor-input"
                            value={authorName}
                            onChange={(e) => setAuthorName(e.target.value)}
                            placeholder="Your name"
                        />
                    </div>
                </div>

                {/* Tool Prompt Section */}
                <div className="lumiverse-editor-section">
                    <div className="lumiverse-editor-section-header">
                        <div className="lumiverse-editor-section-icon"><Wrench size={15} /></div>
                        <span className="lumiverse-editor-section-title">Tool Prompt</span>
                        <CharCount text={prompt} />
                    </div>

                    <div className="lumiverse-editor-field">
                        <label className="lumiverse-editor-label">
                            Prompt <span className="lumiverse-editor-required">*</span>
                        </label>
                        <textarea
                            className="lumiverse-editor-textarea lumiverse-tool-prompt-textarea"
                            value={prompt}
                            onChange={(e) => {
                                setPrompt(e.target.value);
                                if (errors.prompt) setErrors(prev => ({ ...prev, prompt: null }));
                            }}
                            placeholder="Describe what this tool should analyze, produce, or evaluate. This is the instruction sent to the council member's LLM when this tool is invoked."
                            rows={8}
                        />
                        {errors.prompt && <div className="lumiverse-editor-error">{errors.prompt}</div>}
                    </div>
                </div>

                {/* Input Schema Builder */}
                <div className="lumiverse-editor-section">
                    <div className="lumiverse-editor-section-header">
                        <div className="lumiverse-editor-section-icon"><Wrench size={15} /></div>
                        <span className="lumiverse-editor-section-title">Input Schema</span>
                    </div>
                    <div className="lumiverse-editor-hint" style={{ marginBottom: '8px' }}>
                        Define the structured output properties the LLM should return when calling this tool.
                    </div>

                    {properties.map((prop, index) => (
                        <SchemaPropertyRow
                            key={prop.id}
                            property={prop}
                            onChange={(updated) => handlePropertyChange(index, updated)}
                            onRemove={() => handleRemoveProperty(index)}
                        />
                    ))}

                    <button
                        type="button"
                        className="lumiverse-editor-btn-secondary lumiverse-tool-add-property"
                        onClick={handleAddProperty}
                    >
                        <Plus size={14} /> Add Property
                    </button>
                    {errors.properties && <div className="lumiverse-editor-error">{errors.properties}</div>}
                </div>

                {/* Result Routing Section */}
                <div className="lumiverse-editor-section">
                    <div className="lumiverse-editor-section-header">
                        <div className="lumiverse-editor-section-icon"><Wrench size={15} /></div>
                        <span className="lumiverse-editor-section-title">Result Routing</span>
                    </div>
                    <div className="lumiverse-editor-hint" style={{ marginBottom: '8px' }}>
                        Optionally store tool results in a named variable accessible via {'{{loomCouncilResult::variable_name}}'}.
                    </div>

                    <div className="lumiverse-editor-field">
                        <label className="lumiverse-editor-label">Result Variable</label>
                        <input
                            type="text"
                            className="lumiverse-editor-input"
                            value={resultVariable}
                            onChange={(e) => {
                                setResultVariable(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''));
                                if (errors.resultVariable) setErrors(prev => ({ ...prev, resultVariable: null }));
                            }}
                            placeholder="e.g., story_direction"
                        />
                        <div className="lumiverse-editor-hint">
                            When set, results go to this variable only (excluded from deliberation by default).
                        </div>
                        {errors.resultVariable && <div className="lumiverse-editor-error">{errors.resultVariable}</div>}
                    </div>

                    {resultVariable.trim() && (
                        <div className="lumiverse-editor-field">
                            <label className="lumiverse-tool-toggle-label">
                                <input
                                    type="checkbox"
                                    checked={storeInDeliberation}
                                    onChange={(e) => setStoreInDeliberation(e.target.checked)}
                                />
                                <span>Also include in deliberation</span>
                            </label>
                            <div className="lumiverse-editor-hint">
                                When enabled, results appear in both the named variable and {'{{lumiaCouncilDeliberation}}'}.
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="lumiverse-editor-footer">
                {isEditing && (
                    <button
                        className="lumiverse-editor-btn-danger"
                        onClick={handleDelete}
                    >
                        <Trash2 size={14} /> Delete
                    </button>
                )}
                <div className="lumiverse-editor-footer-spacer" />
                <button className="lumiverse-editor-btn-secondary" onClick={handleClose}>Cancel</button>
                <button className="lumiverse-editor-btn-primary" onClick={handleSave}>
                    {isEditing ? 'Save Changes' : 'Create Tool'}
                </button>
            </div>

            {/* Confirmation Modals */}
            {showDeleteConfirm && (
                <ConfirmationModal
                    title="Delete Tool"
                    message={`Are you sure you want to delete "${displayName || toolName}"? This cannot be undone.`}
                    confirmText="Delete"
                    confirmVariant="danger"
                    onConfirm={confirmDelete}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
            {showDiscardConfirm && (
                <ConfirmationModal
                    title="Discard Changes"
                    message="You have unsaved changes. Are you sure you want to discard them?"
                    confirmText="Discard"
                    confirmVariant="danger"
                    onConfirm={onClose}
                    onCancel={() => setShowDiscardConfirm(false)}
                />
            )}
        </div>
    );
}

export default ToolEditorModal;
