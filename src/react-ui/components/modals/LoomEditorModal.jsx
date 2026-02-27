import React, { useState, useCallback, useRef } from 'react';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { ScrollText, Palette, Wrench, Settings, Trash2, X } from 'lucide-react';
import ConfirmationModal from '../shared/ConfirmationModal';

/**
 * Loom Item Structure (v2 format):
 * {
 *   loomName: string,
 *   loomContent: string,
 *   loomCategory: string,
 *   authorName: string | null,
 *   version: number
 * }
 */

const LOOM_CATEGORIES = [
    {
        value: 'Narrative Style',
        label: 'Style',
        description: 'Writing style and prose guidance',
        Icon: Palette,
    },
    {
        value: 'Loom Utilities',
        label: 'Utility',
        description: 'Helper functions and techniques',
        Icon: Wrench,
    },
    {
        value: 'Retrofits',
        label: 'Retrofit',
        description: 'System modifications and enhancements',
        Icon: Settings,
    },
];

function getLoomField(item, field) {
    if (!item) return null;
    const fieldMap = {
        name: ['loomName', 'itemName', 'name'],
        content: ['loomContent', 'content'],
        category: ['loomCategory', 'category', 'type'],
        author: ['authorName', 'author'],
    };
    const fields = fieldMap[field];
    if (!fields) return null;
    for (const fieldName of fields) {
        if (item[fieldName] !== undefined && item[fieldName] !== null) {
            return item[fieldName];
        }
    }
    return null;
}

/* ============================================
   Character Count Badge
   ============================================ */
function CharCount({ text }) {
    if (!text) return null;
    return (
        <span className="lumiverse-editor-char-count">
            {text.length} chars
        </span>
    );
}

/* ============================================
   Content placeholder/hint helpers
   ============================================ */
function getCategoryHint(category) {
    switch (category) {
        case 'Narrative Style': return 'Injected via {{loomStyle}} macro. Describe prose style, tone, and writing approach.';
        case 'Loom Utilities': return 'Injected via {{loomUtils}} macro. Define helper techniques or utility functions.';
        case 'Retrofits': return 'Injected via {{loomRetrofits}} macro. System modifications and enhancements.';
        default: return '';
    }
}

function getContentPlaceholder(category) {
    switch (category) {
        case 'Narrative Style': return 'Write in a dark, atmospheric style. Use vivid sensory descriptions emphasizing shadows, decay, and unease...';
        case 'Loom Utilities': return 'When transitioning between scenes, use a brief temporal or spatial marker followed by sensory grounding...';
        case 'Retrofits': return 'Track and reference previous conversations, character states, and plot points. Maintain consistency...';
        default: return 'Enter the content for this Loom item...';
    }
}

/* ============================================
   Main Component
   ============================================ */
function LoomEditorModal({ packName, editingItem = null, onClose, onSaved }) {
    const { allPacks } = usePacks();
    const actions = useLumiverseActions();
    const isEditing = editingItem !== null;

    const pack = allPacks.find(p => (p.name || p.packName) === packName);

    // Form state
    const [name, setName] = useState(getLoomField(editingItem, 'name') || '');
    const [content, setContent] = useState(getLoomField(editingItem, 'content') || '');
    const [category, setCategory] = useState(getLoomField(editingItem, 'category') || 'Narrative Style');
    const [author, setAuthor] = useState(getLoomField(editingItem, 'author') || '');
    const [errors, setErrors] = useState({});

    // Confirmation modals
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    // Track initial values for dirty checking
    const initialRef = useRef({
        name: getLoomField(editingItem, 'name') || '',
        content: getLoomField(editingItem, 'content') || '',
        category: getLoomField(editingItem, 'category') || 'Narrative Style',
        author: getLoomField(editingItem, 'author') || '',
    });

    const isDirty = useCallback(() => {
        const init = initialRef.current;
        return name !== init.name ||
            content !== init.content ||
            category !== init.category ||
            author !== init.author;
    }, [name, content, category, author]);

    const handleClose = useCallback(() => {
        if (isDirty()) {
            setShowDiscardConfirm(true);
        } else {
            onClose();
        }
    }, [isDirty, onClose]);

    const validate = useCallback(() => {
        const newErrors = {};
        if (!name.trim()) newErrors.name = 'Loom name is required';
        if (!content.trim()) newErrors.content = 'Content is required';

        if (pack && name.trim()) {
            const loomItems = pack.loomItems || [];
            const editingName = getLoomField(editingItem, 'name');
            const existingItem = loomItems.find(item => {
                const itemName = getLoomField(item, 'name');
                return itemName === name.trim() && (!isEditing || itemName !== editingName);
            });
            if (existingItem) {
                newErrors.name = `A Loom named "${name.trim()}" already exists in this pack`;
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [name, content, pack, isEditing, editingItem]);

    const handleSave = useCallback(() => {
        if (!validate()) return;

        const loomItem = {
            loomName: name.trim(),
            loomContent: content.trim(),
            loomCategory: category,
            authorName: author.trim() || null,
            version: 1,
        };

        if (pack) {
            const currentItems = [...(pack.loomItems || [])];
            const editingName = getLoomField(editingItem, 'name');

            if (isEditing) {
                const index = currentItems.findIndex(item => getLoomField(item, 'name') === editingName);
                if (index >= 0) currentItems[index] = loomItem;
                else currentItems.push(loomItem);
            } else {
                currentItems.push(loomItem);
            }

            const updatedPack = { ...pack, loomItems: currentItems };
            const packKey = pack.id || pack.name || pack.packName;

            if (pack.isCustom) {
                actions.updateCustomPack(packKey, updatedPack);
            } else {
                actions.updateCustomPack(packKey, { ...updatedPack, isCustom: true });
            }

            saveToExtension();
            if (onSaved) onSaved(loomItem, packName);
        }
        onClose();
    }, [validate, name, content, category, author, pack, isEditing, editingItem, actions, packName, onClose, onSaved]);

    const handleDelete = useCallback(() => {
        if (!isEditing || !editingItem) return;
        setShowDeleteConfirm(true);
    }, [isEditing, editingItem]);

    const confirmDelete = useCallback(() => {
        const editingName = getLoomField(editingItem, 'name');
        if (pack) {
            const currentItems = pack.loomItems || [];
            const updatedItems = currentItems.filter(item => getLoomField(item, 'name') !== editingName);
            const updatedPack = { ...pack, loomItems: updatedItems };
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

    const CategoryIcon = LOOM_CATEGORIES.find(c => c.value === category)?.Icon || ScrollText;

    return (
        <div className="lumiverse-editor-layout">
            {/* Mobile swipe handle */}
            <div className="lumiverse-editor-swipe-handle" />

            {/* Header */}
            <div className="lumiverse-editor-header">
                <div className="lumiverse-editor-header-icon">
                    <ScrollText size={18} />
                </div>
                <div className="lumiverse-editor-header-text">
                    <h2 className="lumiverse-editor-header-title">{isEditing ? 'Edit Loom' : 'Create New Loom'}</h2>
                    <div className="lumiverse-editor-header-subtitle">{pack.packName || pack.name}</div>
                </div>
                <button className="lumiverse-editor-close-btn" onClick={handleClose}>
                    <X size={18} />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="lumiverse-editor-scroll">
                {/* Details Section */}
                <div className="lumiverse-editor-section">
                    <div className="lumiverse-editor-section-header">
                        <div className="lumiverse-editor-section-icon"><ScrollText size={15} /></div>
                        <span className="lumiverse-editor-section-title">Loom Details</span>
                    </div>

                    {/* Name */}
                    <div className="lumiverse-editor-field">
                        <label className="lumiverse-editor-label">
                            Loom Name <span className="lumiverse-editor-required">*</span>
                        </label>
                        <input
                            type="text"
                            className="lumiverse-editor-input"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                if (errors.name) setErrors(prev => ({ ...prev, name: null }));
                            }}
                            placeholder="e.g., Gothic Horror, Scene Helper"
                            autoFocus
                        />
                        {errors.name && <div className="lumiverse-editor-error">{errors.name}</div>}
                    </div>

                    {/* Author */}
                    <div className="lumiverse-editor-field">
                        <label className="lumiverse-editor-label">Author</label>
                        <input
                            type="text"
                            className="lumiverse-editor-input"
                            value={author}
                            onChange={(e) => setAuthor(e.target.value)}
                            placeholder="Your name"
                        />
                    </div>

                    {/* Category — segmented control */}
                    <div className="lumiverse-editor-field">
                        <label className="lumiverse-editor-label">
                            Category <span className="lumiverse-editor-required">*</span>
                        </label>
                        <div className="lumiverse-editor-category-tabs">
                            {LOOM_CATEGORIES.map(cat => (
                                <button
                                    key={cat.value}
                                    type="button"
                                    className={`lumiverse-editor-category-tab ${category === cat.value ? 'lumiverse-editor-category-tab--active' : ''}`}
                                    onClick={() => setCategory(cat.value)}
                                    title={cat.description}
                                >
                                    <cat.Icon size={14} strokeWidth={1.5} />
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="lumiverse-editor-section">
                    <div className="lumiverse-editor-section-header">
                        <div className="lumiverse-editor-section-icon"><CategoryIcon size={15} /></div>
                        <span className="lumiverse-editor-section-title">Content</span>
                    </div>

                    <div className="lumiverse-editor-field">
                        <label className="lumiverse-editor-label">
                            Loom Content <span className="lumiverse-editor-required">*</span>
                            <CharCount text={content} />
                        </label>
                        <textarea
                            className="lumiverse-editor-textarea"
                            style={{ minHeight: '200px' }}
                            value={content}
                            onChange={(e) => {
                                setContent(e.target.value);
                                if (errors.content) setErrors(prev => ({ ...prev, content: null }));
                            }}
                            placeholder={getContentPlaceholder(category)}
                            rows={12}
                        />
                        <div className="lumiverse-editor-hint">{getCategoryHint(category)}</div>
                        {errors.content && <div className="lumiverse-editor-error">{errors.content}</div>}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="lumiverse-editor-footer">
                {isEditing ? (
                    <button className="lumiverse-editor-btn-danger" onClick={handleDelete}>
                        <Trash2 size={14} /> Delete
                    </button>
                ) : (
                    <div className="lumiverse-editor-spacer" />
                )}
                <button className="lumiverse-editor-btn-secondary" onClick={handleClose}>Cancel</button>
                <button className="lumiverse-editor-btn-primary" onClick={handleSave}>
                    {isEditing ? 'Save Changes' : 'Create Loom'}
                </button>
            </div>

            {/* Delete confirmation */}
            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onConfirm={confirmDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                title={`Delete "${getLoomField(editingItem, 'name')}"?`}
                message="This will permanently remove this Loom item. This cannot be undone."
                variant="danger"
                confirmText="Delete"
            />

            {/* Discard unsaved changes confirmation */}
            <ConfirmationModal
                isOpen={showDiscardConfirm}
                onConfirm={onClose}
                onCancel={() => setShowDiscardConfirm(false)}
                title="Discard unsaved changes?"
                message="You have unsaved changes that will be lost if you close this editor."
                variant="warning"
                confirmText="Discard"
            />
        </div>
    );
}

export default LoomEditorModal;
