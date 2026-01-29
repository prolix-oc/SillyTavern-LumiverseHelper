import React, { useState, useCallback } from 'react';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import clsx from 'clsx';
import { ScrollText, Palette, Wrench, Settings, Trash2 } from 'lucide-react';
import { 
    EditorLayout, 
    EditorContent, 
    EditorFooter, 
    EditorSection, 
    FormField, 
    TextInput, 
    TextArea 
} from '../shared/FormComponents';

/**
 * Loom Item Structure (v2 format):
 * {
 *   loomName: string,           // Required - display name
 *   loomContent: string,        // Required - the actual content/instructions
 *   loomCategory: string,       // Required - category type
 *   authorName: string | null,  // Creator attribution
 *   version: number
 * }
 */

// Loom category constants
const LOOM_CATEGORIES = [
    {
        value: 'Narrative Style',
        label: 'Narrative Style',
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

/**
 * Get Loom field with fallback for old/new format
 */
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

/**
 * Loom Editor Modal
 *
 * For creating or editing a single Loom item.
 *
 * Props:
 * - packName: The pack to add/edit the Loom in
 * - editingItem: Optional existing item to edit (null for new)
 * - onClose: Close callback
 * - onSaved: Optional callback after save
 */
function LoomEditorModal({ packName, editingItem = null, onClose, onSaved }) {
    const { allPacks } = usePacks();
    const actions = useLumiverseActions();

    const isEditing = editingItem !== null;

    // Find the pack - support both name and packName
    const pack = allPacks.find(p => (p.name || p.packName) === packName);

    // Form state - use getLoomField for backwards compatibility
    const [name, setName] = useState(getLoomField(editingItem, 'name') || '');
    const [content, setContent] = useState(getLoomField(editingItem, 'content') || '');
    const [category, setCategory] = useState(getLoomField(editingItem, 'category') || 'Narrative Style');
    const [author, setAuthor] = useState(getLoomField(editingItem, 'author') || '');
    const [errors, setErrors] = useState({});

    // Validate form
    const validate = useCallback(() => {
        const newErrors = {};

        if (!name.trim()) {
            newErrors.name = 'Loom name is required';
        }

        if (!content.trim()) {
            newErrors.content = 'Content is required';
        }

        // Check for duplicate name (if creating new or renaming)
        if (pack && name.trim()) {
            const loomItems = pack.loomItems || [];
            const editingName = getLoomField(editingItem, 'name');

            const existingItem = loomItems.find(item => {
                const itemName = getLoomField(item, 'name');
                return itemName === name.trim() &&
                    (!isEditing || itemName !== editingName);
            });
            if (existingItem) {
                newErrors.name = `A Loom item named "${name.trim()}" already exists in this pack`;
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [name, content, pack, isEditing, editingItem]);

    // Save the Loom item
    const handleSave = useCallback(() => {
        if (!validate()) return;

        // Build the Loom item (v2 format)
        const loomItem = {
            loomName: name.trim(),
            loomContent: content.trim(),
            loomCategory: category,
            authorName: author.trim() || null,
            version: 1,
        };

        // Find and update the pack
        if (pack) {
            // Use loomItems array (new format)
            const currentItems = [...(pack.loomItems || [])];
            const editingName = getLoomField(editingItem, 'name');

            if (isEditing) {
                // Find and replace the existing item
                const index = currentItems.findIndex(item =>
                    getLoomField(item, 'name') === editingName
                );
                if (index >= 0) {
                    currentItems[index] = loomItem;
                } else {
                    currentItems.push(loomItem);
                }
            } else {
                // Add new item
                currentItems.push(loomItem);
            }

            // Update the pack with new format
            const updatedPack = {
                ...pack,
                loomItems: currentItems,
            };

            // Use the appropriate action based on pack type
            const packKey = pack.id || pack.name || pack.packName;
            if (pack.isCustom) {
                actions.updateCustomPack(packKey, updatedPack);
            } else {
                // For non-custom packs, we need to update via setPacks
                actions.updateCustomPack(packKey, { ...updatedPack, isCustom: true });
            }

            saveToExtension();

            if (onSaved) {
                onSaved(loomItem, packName);
            }
        }

        onClose();
    }, [
        validate, name, content, category, author,
        pack, isEditing, editingItem, actions, packName, onClose, onSaved
    ]);

    // Delete the Loom item
    const handleDelete = useCallback(() => {
        if (!isEditing || !editingItem) return;

        const editingName = getLoomField(editingItem, 'name');
        if (!window.confirm(`Are you sure you want to delete "${editingName}"? This cannot be undone.`)) {
            return;
        }

        if (pack) {
            const currentItems = pack.loomItems || [];
            const updatedItems = currentItems.filter(item =>
                getLoomField(item, 'name') !== editingName
            );

            // Update with new format
            const updatedPack = {
                ...pack,
                loomItems: updatedItems,
            };

            const packKey = pack.id || pack.name || pack.packName;
            if (pack.isCustom) {
                actions.updateCustomPack(packKey, updatedPack);
            } else {
                actions.updateCustomPack(packKey, { ...updatedPack, isCustom: true });
            }

            saveToExtension();
        }

        onClose();
    }, [isEditing, editingItem, pack, actions, onClose]);

    if (!pack) {
        return (
            <div className="lumiverse-editor-modal lumiverse-editor-error">
                <p>Pack "{packName}" not found.</p>
                <button className="lumiverse-btn lumiverse-btn--secondary" onClick={onClose}>
                    Close
                </button>
            </div>
        );
    }

    return (
        <EditorLayout>
            <EditorContent>
                {/* Basic Info Section */}
                <EditorSection Icon={ScrollText} title="Loom Details">
                    <FormField label="Loom Name" required error={errors.name}>
                        <TextInput
                            value={name}
                            onChange={(val) => {
                                setName(val);
                                if (errors.name) setErrors(prev => ({ ...prev, name: null }));
                            }}
                            placeholder="e.g., Gothic Horror, Scene Helper"
                            autoFocus
                        />
                    </FormField>

                    <FormField label="Author">
                        <TextInput
                            value={author}
                            onChange={(val) => setAuthor(val)}
                            placeholder="Your name"
                        />
                    </FormField>

                    <FormField label="Category" required>
                        <div className="lumiverse-loom-category-options" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                            {LOOM_CATEGORIES.map(cat => (
                                <button
                                    key={cat.value}
                                    type="button"
                                    className={clsx(
                                        'lumiverse-loom-category-btn',
                                        category === cat.value && 'lumiverse-loom-category-btn--selected'
                                    )}
                                    onClick={() => setCategory(cat.value)}
                                    title={cat.description}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '10px 4px',
                                        background: category === cat.value ? 'rgba(147, 112, 219, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                                        border: `1px solid ${category === cat.value ? 'var(--lumiverse-primary)' : 'var(--lumiverse-border)'}`,
                                        borderRadius: '8px',
                                        color: category === cat.value ? 'var(--lumiverse-primary)' : 'var(--lumiverse-text-muted)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <cat.Icon size={16} strokeWidth={1.5} />
                                    <span style={{ fontSize: '11px', fontWeight: 500 }}>{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </FormField>
                </EditorSection>

                {/* Content Section */}
                <EditorSection Icon={LOOM_CATEGORIES.find(c => c.value === category)?.Icon || ScrollText} title="Content">
                    <FormField
                        label="Loom Content"
                        required
                        error={errors.content}
                        hint={getCategoryHint(category)}
                    >
                        <TextArea
                            value={content}
                            onChange={(val) => {
                                setContent(val);
                                if (errors.content) setErrors(prev => ({ ...prev, content: null }));
                            }}
                            placeholder={getContentPlaceholder(category)}
                            rows={12}
                        />
                    </FormField>
                </EditorSection>
            </EditorContent>

            {/* Footer */}
            <EditorFooter>
                {isEditing && (
                    <button
                        className="lumiverse-btn lumiverse-btn--danger"
                        onClick={handleDelete}
                        type="button"
                        style={{ marginRight: 'auto' }}
                    >
                        <Trash2 size={14} style={{ marginRight: '6px' }} />
                        Delete
                    </button>
                )}
                {!isEditing && <div style={{ marginRight: 'auto' }} />}
                
                <button
                    className="lumiverse-btn lumiverse-btn--secondary"
                    onClick={onClose}
                    type="button"
                    style={{ marginRight: '8px' }}
                >
                    Cancel
                </button>
                <button
                    className="lumiverse-btn lumiverse-btn--primary"
                    onClick={handleSave}
                    type="button"
                >
                    {isEditing ? 'Save Changes' : 'Create Loom'}
                </button>
            </EditorFooter>
        </EditorLayout>
    );
}

/**
 * Get hint text based on category
 */
function getCategoryHint(category) {
    switch (category) {
        case 'Narrative Style':
            return 'Injected via {{loomStyle}} macro. Describe prose style, tone, and writing approach.';
        case 'Loom Utilities':
            return 'Injected via {{loomUtils}} macro. Define helper techniques or utility functions.';
        case 'Retrofits':
            return 'Injected via {{loomRetrofits}} macro. System modifications and enhancements.';
        default:
            return '';
    }
}

/**
 * Get placeholder text based on category
 */
function getContentPlaceholder(category) {
    switch (category) {
        case 'Narrative Style':
            return 'Write in a dark, atmospheric style. Use vivid sensory descriptions emphasizing shadows, decay, and unease...';
        case 'Loom Utilities':
            return 'When transitioning between scenes, use a brief temporal or spatial marker followed by sensory grounding...';
        case 'Retrofits':
            return 'Track and reference previous conversations, character states, and plot points. Maintain consistency...';
        default:
            return 'Enter the content for this Loom item...';
    }
}

export default LoomEditorModal;
