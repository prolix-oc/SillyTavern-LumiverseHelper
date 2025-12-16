import React, { useState, useCallback } from 'react';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import clsx from 'clsx';

/**
 * OLD CODE Lumia Item Structure (from lumiaEditor.js):
 * {
 *   lumiaDefName: string,         // Required - the Lumia name
 *   lumia_img: string | null,     // Avatar URL
 *   defAuthor: string | null,     // Creator attribution
 *   lumiaDef: string | null,      // Physical definition → {{lumiaDef}} macro
 *   lumia_personality: string | null,  // → {{lumiaPersonality}} macro
 *   lumia_behavior: string | null      // → {{lumiaBehavior}} macro
 * }
 *
 * Selection format: { packName, itemName } where itemName === lumiaDefName
 */

/**
 * Form input with label
 */
function FormField({ label, required, children, error, hint }) {
    return (
        <div className={clsx('lumiverse-form-field', error && 'lumiverse-form-field--error')}>
            <label className="lumiverse-form-label">
                {label}
                {required && <span className="lumiverse-required">*</span>}
            </label>
            {children}
            {hint && <span className="lumiverse-form-hint">{hint}</span>}
            {error && <span className="lumiverse-form-error">{error}</span>}
        </div>
    );
}

/**
 * Text input component
 */
function TextInput({ value, onChange, placeholder, maxLength }) {
    return (
        <input
            type="text"
            className="lumiverse-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
        />
    );
}

/**
 * Textarea component
 */
function TextArea({ value, onChange, placeholder, rows = 3 }) {
    return (
        <textarea
            className="lumiverse-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
        />
    );
}

/**
 * Image URL input with preview
 */
function ImageInput({ value, onChange, placeholder }) {
    const [previewError, setPreviewError] = useState(false);

    const handleChange = (newValue) => {
        setPreviewError(false);
        onChange(newValue);
    };

    return (
        <div className="lumiverse-image-input">
            <input
                type="text"
                className="lumiverse-input"
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                placeholder={placeholder || 'Enter image URL...'}
            />
            {value && !previewError && (
                <div className="lumiverse-image-preview">
                    <img
                        src={value}
                        alt="Preview"
                        onError={() => setPreviewError(true)}
                    />
                </div>
            )}
            {previewError && (
                <span className="lumiverse-image-error">Failed to load image</span>
            )}
        </div>
    );
}

/**
 * Lumia item editor within pack
 *
 * OLD CODE structure has 3 separate content fields:
 * - lumiaDef: Physical definition ({{lumiaDef}})
 * - lumia_personality: Personality traits ({{lumiaPersonality}})
 * - lumia_behavior: Behavioral patterns ({{lumiaBehavior}})
 */
function LumiaItemEditor({ item, onUpdate, onRemove, onEditFull }) {
    return (
        <div className="lumiverse-lumia-editor">
            <div className="lumiverse-lumia-header">
                <span
                    className={clsx('lumiverse-lumia-name', onEditFull && 'lumiverse-lumia-name--clickable')}
                    onClick={onEditFull}
                    title={onEditFull ? 'Click to open full editor' : undefined}
                >
                    {item.lumiaDefName || 'New Lumia'}
                </span>
                <div className="lumiverse-lumia-header-actions">
                    {onEditFull && (
                        <button
                            className="lumiverse-btn lumiverse-btn--icon lumiverse-btn--expand"
                            onClick={onEditFull}
                            title="Open in full editor"
                            type="button"
                        >
                            ↗️
                        </button>
                    )}
                    <button
                        className="lumiverse-btn lumiverse-btn--danger lumiverse-btn--icon"
                        onClick={onRemove}
                        title="Remove Lumia"
                        type="button"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            <div className="lumiverse-lumia-fields">
                {/* Basic Info */}
                <FormField label="Lumia Name" required>
                    <TextInput
                        value={item.lumiaDefName || ''}
                        onChange={(val) => onUpdate({ ...item, lumiaDefName: val })}
                        placeholder="e.g., Aria, Luna, Sage"
                    />
                </FormField>

                <div className="lumiverse-lumia-row">
                    <FormField label="Avatar URL">
                        <ImageInput
                            value={item.lumia_img || ''}
                            onChange={(val) => onUpdate({ ...item, lumia_img: val || null })}
                            placeholder="https://..."
                        />
                    </FormField>

                    <FormField label="Author">
                        <TextInput
                            value={item.defAuthor || ''}
                            onChange={(val) => onUpdate({ ...item, defAuthor: val || null })}
                            placeholder="Creator name"
                        />
                    </FormField>
                </div>

                {/* Physicality - {{lumiaDef}} */}
                <FormField label="Physical Definition" hint="Injected via {{lumiaDef}} macro">
                    <TextArea
                        value={item.lumiaDef || ''}
                        onChange={(val) => onUpdate({ ...item, lumiaDef: val || null })}
                        placeholder="Describe Lumia's physical appearance, form, and presence..."
                        rows={4}
                    />
                </FormField>

                {/* Personality - {{lumiaPersonality}} */}
                <FormField label="Personality Traits" hint="Injected via {{lumiaPersonality}} macro">
                    <TextArea
                        value={item.lumia_personality || ''}
                        onChange={(val) => onUpdate({ ...item, lumia_personality: val || null })}
                        placeholder="Describe Lumia's personality, disposition, and inner nature..."
                        rows={4}
                    />
                </FormField>

                {/* Behavior - {{lumiaBehavior}} */}
                <FormField label="Behavioral Patterns" hint="Injected via {{lumiaBehavior}} macro">
                    <TextArea
                        value={item.lumia_behavior || ''}
                        onChange={(val) => onUpdate({ ...item, lumia_behavior: val || null })}
                        placeholder="Describe Lumia's behavioral patterns, habits, and tendencies..."
                        rows={4}
                    />
                </FormField>
            </div>
        </div>
    );
}

/**
 * Generate a unique ID for internal tracking
 */
function generateId() {
    return `lumia_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new empty Lumia item with the correct OLD CODE structure
 */
function createEmptyLumiaItem() {
    return {
        _id: generateId(),       // Internal ID for React key (not saved to old code)
        lumiaDefName: '',        // Required - the Lumia name
        lumia_img: null,         // Avatar URL
        defAuthor: null,         // Creator attribution
        lumiaDef: null,          // Physical definition → {{lumiaDef}} macro
        lumia_personality: null, // → {{lumiaPersonality}} macro
        lumia_behavior: null,    // → {{lumiaBehavior}} macro
    };
}

/**
 * Default World Book entry template (from old lumiaEditor.js)
 */
const DEFAULT_WB_ENTRY = {
    key: [],
    keysecondary: [],
    constant: false,
    vectorized: false,
    selective: false,
    selectiveLogic: 0,
    addMemo: true,
    order: 100,
    position: 0,
    disable: false,
    excludeRecursion: false,
    preventRecursion: false,
    delayUntilRecursion: false,
    probability: 100,
    useProbability: true,
    depth: 4,
    group: '',
    groupOverride: false,
    groupWeight: 100,
    scanDepth: null,
    caseSensitive: null,
    matchWholeWords: null,
    useGroupScoring: null,
    automationId: '',
    role: null,
    sticky: 0,
    cooldown: 0,
    delay: 0,
};

/**
 * Serialize a Lumia item to World Book entry format
 */
function serializeLumiaToWorldBookEntry(lumiaItem, entryType, uid) {
    const name = lumiaItem.lumiaDefName;
    let comment = '';
    let content = '';

    if (entryType === 'definition') {
        comment = `Lumia (${name})`;
        const contentParts = [];
        if (lumiaItem.lumia_img) {
            contentParts.push(`[lumia_img=${lumiaItem.lumia_img}]`);
        }
        if (lumiaItem.defAuthor) {
            contentParts.push(`[lumia_author=${lumiaItem.defAuthor}]`);
        }
        if (lumiaItem.lumiaDef) {
            contentParts.push(lumiaItem.lumiaDef);
        }
        content = contentParts.join('\n');
    } else if (entryType === 'behavior') {
        comment = `Behavior (${name})`;
        content = lumiaItem.lumia_behavior || '';
    } else if (entryType === 'personality') {
        comment = `Personality (${name})`;
        content = lumiaItem.lumia_personality || '';
    }

    return {
        ...DEFAULT_WB_ENTRY,
        uid: uid,
        comment: comment,
        content: content,
    };
}

/**
 * Generate World Book JSON from pack data
 */
function generateWorldBookJson(pack) {
    const entries = {};
    let uid = 0;

    // Add metadata entry first if pack has author or cover
    if (pack.author || pack.coverImage) {
        let metadataContent = '';
        if (pack.coverImage) {
            metadataContent += `[cover_img=${pack.coverImage}]`;
        }
        if (pack.author) {
            metadataContent += `[author_name=${pack.author}]`;
        }

        entries[uid] = {
            ...DEFAULT_WB_ENTRY,
            uid: uid,
            comment: 'Metadata',
            content: metadataContent,
        };
        uid++;
    }

    for (const item of pack.items) {
        // Skip non-Lumia items
        if (!item.lumiaDefName) continue;

        // Add definition entry if present
        if (item.lumiaDef) {
            entries[uid] = serializeLumiaToWorldBookEntry(item, 'definition', uid);
            uid++;
        }

        // Add behavior entry if present
        if (item.lumia_behavior) {
            entries[uid] = serializeLumiaToWorldBookEntry(item, 'behavior', uid);
            uid++;
        }

        // Add personality entry if present
        if (item.lumia_personality) {
            entries[uid] = serializeLumiaToWorldBookEntry(item, 'personality', uid);
            uid++;
        }
    }

    return { entries };
}

/**
 * Download pack as World Book JSON file
 */
function exportPackAsWorldBook(pack) {
    const worldBook = generateWorldBookJson(pack);
    const jsonString = JSON.stringify(worldBook, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${pack.name.replace(/[^a-z0-9]/gi, '_')}_worldbook.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Pack Editor Modal component
 * For creating and editing custom packs
 *
 * OLD CODE pack structure:
 * {
 *   name: string,          // Pack identifier (used as key in settings.packs object)
 *   items: [...],          // Array of Lumia items
 *   url: '',               // Empty string for custom packs
 *   isCustom: true,        // Marks as user-created
 *   author: string,        // Pack author
 *   coverUrl: string       // Cover image URL (note: old code uses coverUrl, not coverImage)
 * }
 */
function PackEditorModal({ packId, onClose }) {
    const { customPacks } = usePacks();
    const actions = useLumiverseActions();

    // Find existing pack if editing
    const existingPack = packId
        ? customPacks.find((p) => p.id === packId || p.name === packId)
        : null;

    // Local state for the pack being edited
    // Map existing items to include _id for React keys
    const [pack, setPack] = useState(() => {
        if (existingPack) {
            return {
                ...existingPack,
                // Ensure items have _id for React keys
                items: (existingPack.items || []).map(item => ({
                    ...item,
                    _id: item._id || generateId(),
                })),
            };
        }
        return {
            id: generateId(),
            name: '',
            author: '',
            coverUrl: '',       // OLD CODE field name (not coverImage)
            url: '',            // Empty for custom packs
            isCustom: true,
            items: [],
        };
    });

    const [errors, setErrors] = useState({});

    // Update pack field
    const updatePack = useCallback((field, value) => {
        setPack((prev) => ({ ...prev, [field]: value }));
        // Clear error when field is updated
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: null }));
        }
    }, [errors]);

    // Add new Lumia item with correct structure
    const addItem = useCallback(() => {
        setPack((prev) => ({
            ...prev,
            items: [...prev.items, createEmptyLumiaItem()],
        }));
    }, []);

    // Update specific item
    const updateItem = useCallback((index, updatedItem) => {
        setPack((prev) => ({
            ...prev,
            items: prev.items.map((item, i) => (i === index ? updatedItem : item)),
        }));
    }, []);

    // Remove item
    const removeItem = useCallback((index) => {
        setPack((prev) => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
        }));
    }, []);

    // Validate pack
    const validate = () => {
        const newErrors = {};

        if (!pack.name.trim()) {
            newErrors.name = 'Pack name is required';
        }

        // Validate items - check lumiaDefName (not name)
        pack.items.forEach((item, index) => {
            if (!item.lumiaDefName || !item.lumiaDefName.trim()) {
                newErrors[`item_${index}_name`] = 'Lumia name is required';
            }
            // At least one content field should be filled
            const hasContent = item.lumiaDef || item.lumia_personality || item.lumia_behavior;
            if (!hasContent) {
                newErrors[`item_${index}_content`] = 'At least one definition field is required';
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Prepare pack for saving (remove internal _id from items)
    const preparePackForSave = () => {
        return {
            ...pack,
            items: pack.items.map(({ _id, ...item }) => item),
        };
    };

    // Save pack
    const handleSave = () => {
        if (!validate()) {
            return;
        }

        const packToSave = preparePackForSave();

        if (existingPack) {
            actions.updateCustomPack(pack.id || pack.name, packToSave);
        } else {
            actions.addCustomPack(packToSave);
        }

        saveToExtension();
        onClose();
    };

    // Delete pack
    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete "${pack.name}"?`)) {
            actions.removeCustomPack(pack.id || pack.name);
            saveToExtension();
            onClose();
        }
    };

    // Export pack as World Book JSON
    const handleExport = () => {
        if (!pack.name.trim()) {
            alert('Please enter a pack name before exporting.');
            return;
        }
        exportPackAsWorldBook(pack);
    };

    return (
        <div className="lumiverse-pack-editor-modal">
            <div className="lumiverse-pack-editor-content">
                {/* Pack Metadata Section */}
                <div className="lumiverse-pack-metadata">
                    <h3>Pack Details</h3>

                    <FormField label="Pack Name" required error={errors.name}>
                        <TextInput
                            value={pack.name}
                            onChange={(val) => updatePack('name', val)}
                            placeholder="My Custom Pack"
                        />
                    </FormField>

                    <FormField label="Author">
                        <TextInput
                            value={pack.author}
                            onChange={(val) => updatePack('author', val)}
                            placeholder="Your name"
                        />
                    </FormField>

                    <FormField label="Cover Image" hint="URL for pack cover image">
                        <ImageInput
                            value={pack.coverUrl || ''}
                            onChange={(val) => updatePack('coverUrl', val)}
                        />
                    </FormField>
                </div>

                {/* Lumia Items Section */}
                <div className="lumiverse-pack-items-section">
                    <div className="lumiverse-pack-items-header">
                        <h3>Lumia Items ({pack.items.length})</h3>
                        <button
                            className="lumiverse-btn lumiverse-btn--primary"
                            onClick={addItem}
                            type="button"
                        >
                            + Add Item
                        </button>
                    </div>

                    {pack.items.length === 0 ? (
                        <div className="lumiverse-empty-state">
                            <span className="lumiverse-empty-icon">📝</span>
                            <p>No Lumias yet</p>
                            <p className="lumiverse-empty-hint">
                                Add Lumia definitions with physicality, personality, and behavior
                            </p>
                        </div>
                    ) : (
                        <div className="lumiverse-pack-items-list">
                            {pack.items.map((item, index) => (
                                <LumiaItemEditor
                                    key={item._id || index}
                                    item={item}
                                    onUpdate={(updated) => updateItem(index, updated)}
                                    onRemove={() => removeItem(index)}
                                    onEditFull={item.lumiaDefName ? () => {
                                        // Save current pack state first, then open full editor
                                        const packToSave = preparePackForSave();
                                        if (existingPack) {
                                            actions.updateCustomPack(pack.id || pack.name, packToSave);
                                        } else if (pack.name.trim()) {
                                            actions.addCustomPack(packToSave);
                                        }
                                        saveToExtension();
                                        // Open full editor for this item
                                        actions.openModal('lumiaEditor', {
                                            packName: pack.name,
                                            editingItem: item
                                        });
                                    } : undefined}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Actions */}
            <div className="lumiverse-pack-editor-footer">
                <div className="lumiverse-pack-editor-footer-left">
                    {existingPack && (
                        <button
                            className="lumiverse-btn lumiverse-btn--danger"
                            onClick={handleDelete}
                            type="button"
                        >
                            Delete Pack
                        </button>
                    )}
                    {/* Export button - available for both new and existing packs */}
                    <button
                        className="lumiverse-btn lumiverse-btn--secondary"
                        onClick={handleExport}
                        type="button"
                        title="Export as SillyTavern World Book JSON"
                    >
                        Export as World Book
                    </button>
                </div>
                <div className="lumiverse-pack-editor-actions">
                    <button
                        className="lumiverse-btn lumiverse-btn--secondary"
                        onClick={onClose}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="lumiverse-btn lumiverse-btn--primary"
                        onClick={handleSave}
                        type="button"
                    >
                        {existingPack ? 'Save Changes' : 'Create Pack'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PackEditorModal;
