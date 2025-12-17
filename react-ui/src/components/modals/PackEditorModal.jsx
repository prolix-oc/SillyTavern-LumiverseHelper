import React, { useState, useCallback } from 'react';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';
import clsx from 'clsx';
import { Package, User, Image, Trash2, Download, Edit2 } from 'lucide-react';

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
 * Image URL input with preview
 */
function ImageInput({ value, onChange, placeholder }) {
    const [previewError, setPreviewError] = useState(false);
    const { objectPosition } = useAdaptiveImagePosition(value);

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
                        style={{ objectPosition }}
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
 * Generate a unique ID for internal tracking
 */
function generateId() {
    return `pack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    if (pack.author || pack.coverUrl) {
        let metadataContent = '';
        if (pack.coverUrl) {
            metadataContent += `[cover_img=${pack.coverUrl}]`;
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

    for (const item of (pack.items || [])) {
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
export function exportPackAsWorldBook(pack) {
    const worldBook = generateWorldBookJson(pack);
    const jsonString = JSON.stringify(worldBook, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${(pack.name || 'pack').replace(/[^a-z0-9]/gi, '_')}_worldbook.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Pack Editor Modal component
 *
 * For editing pack-level settings: name, author, cover image.
 * Individual Lumia items are managed via PackSelectorModal → LumiaEditorModal.
 *
 * OLD CODE pack structure:
 * {
 *   name: string,          // Pack identifier
 *   items: [...],          // Array of Lumia items
 *   url: '',               // Empty string for custom packs
 *   isCustom: true,        // Marks as user-created
 *   author: string,        // Pack author
 *   coverUrl: string       // Cover image URL
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
    const [pack, setPack] = useState(() => {
        if (existingPack) {
            return { ...existingPack };
        }
        return {
            id: generateId(),
            name: '',
            author: '',
            coverUrl: '',
            url: '',
            isCustom: true,
            items: [],
        };
    });

    const [errors, setErrors] = useState({});

    // Update pack field
    const updatePack = useCallback((field, value) => {
        setPack((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: null }));
        }
    }, [errors]);

    // Validate pack
    const validate = () => {
        const newErrors = {};

        if (!pack.name.trim()) {
            newErrors.name = 'Pack name is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Save pack
    const handleSave = () => {
        if (!validate()) {
            return;
        }

        if (existingPack) {
            actions.updateCustomPack(pack.id || pack.name, pack);
        } else {
            actions.addCustomPack(pack);
        }

        saveToExtension();
        onClose();
    };

    // Delete pack
    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete "${pack.name}"? This will remove all Lumias in this pack.`)) {
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

    // Open pack selector to manage Lumias
    const handleManageLumias = () => {
        // Save current pack state first
        if (pack.name.trim()) {
            if (existingPack) {
                actions.updateCustomPack(pack.id || pack.name, pack);
            } else {
                actions.addCustomPack(pack);
            }
            saveToExtension();
        }
        // Open pack selector
        actions.openModal('packSelector');
        onClose();
    };

    // Get Lumia count
    const lumiaCount = (pack.items || []).filter(item => item.lumiaDefName).length;

    return (
        <div className="lumiverse-pack-editor-modal">
            <div className="lumiverse-pack-editor-content">
                {/* Pack Details Section */}
                <div className="lumiverse-pack-metadata">
                    <div className="lumiverse-pack-editor-title">
                        <Package size={20} strokeWidth={1.5} />
                        <h3>{existingPack ? 'Edit Pack' : 'New Pack'}</h3>
                    </div>

                    <FormField label="Pack Name" required error={errors.name}>
                        <TextInput
                            value={pack.name}
                            onChange={(val) => updatePack('name', val)}
                            placeholder="My Custom Pack"
                        />
                    </FormField>

                    <FormField label="Author">
                        <TextInput
                            value={pack.author || ''}
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

                {/* Lumia Management Section */}
                <div className="lumiverse-pack-lumias-info">
                    <div className="lumiverse-pack-lumias-header">
                        <span className="lumiverse-pack-lumias-count">
                            {lumiaCount} Lumia{lumiaCount !== 1 ? 's' : ''} in this pack
                        </span>
                    </div>
                    <p className="lumiverse-pack-lumias-hint">
                        Use the Pack Selector to add, edit, or remove individual Lumias.
                    </p>
                    <button
                        className="lumiverse-btn lumiverse-btn--secondary lumiverse-btn--full"
                        onClick={handleManageLumias}
                        type="button"
                    >
                        <Edit2 size={14} strokeWidth={1.5} />
                        Manage Lumias
                    </button>
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
                            <Trash2 size={14} />
                            Delete Pack
                        </button>
                    )}
                    <button
                        className="lumiverse-btn lumiverse-btn--secondary"
                        onClick={handleExport}
                        type="button"
                        title="Export as SillyTavern World Book JSON"
                    >
                        <Download size={14} />
                        Export
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
