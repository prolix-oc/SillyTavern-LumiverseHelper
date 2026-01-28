import React, { useState, useCallback, useEffect } from 'react';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';
import clsx from 'clsx';
import { User, Smile, Wrench, Trash2 } from 'lucide-react';

/**
 * Lumia Item Structure (new v2 format):
 * {
 *   lumiaName: string,           // Required - the Lumia name
 *   avatarUrl: string | null,    // Avatar URL
 *   authorName: string | null,   // Creator attribution
 *   lumiaDefinition: string | null,   // Physical definition → {{lumiaDef}} macro
 *   lumiaPersonality: string | null,  // → {{lumiaPersonality}} macro
 *   lumiaBehavior: string | null,     // → {{lumiaBehavior}} macro
 *   genderIdentity: number,      // 0=she/her, 1=he/him, 2=they/them
 *   version: number
 * }
 */

// Gender identity constants
const GENDER = {
    SHE_HER: 0,
    HE_HIM: 1,
    THEY_THEM: 2,
};

const GENDER_OPTIONS = [
    { value: GENDER.SHE_HER, label: 'She/Her' },
    { value: GENDER.HE_HIM, label: 'He/Him' },
    { value: GENDER.THEY_THEM, label: 'They/Them' },
];

/**
 * Get Lumia field with fallback for old/new format
 */
function getLumiaField(item, field) {
    if (!item) return null;
    const fieldMap = {
        name: ['lumiaName', 'lumiaDefName'],
        def: ['lumiaDefinition', 'lumiaDef'],
        personality: ['lumiaPersonality', 'lumia_personality'],
        behavior: ['lumiaBehavior', 'lumia_behavior'],
        img: ['avatarUrl', 'lumia_img'],
        author: ['authorName', 'defAuthor'],
        gender: ['genderIdentity'],
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
 * Form field component
 */
function FormField({ label, required, hint, children, error }) {
    return (
        <div className={clsx('lumiverse-editor-field', error && 'lumiverse-editor-field--error')}>
            <label className="lumiverse-editor-label">
                {label}
                {required && <span className="lumiverse-required">*</span>}
            </label>
            {children}
            {hint && <span className="lumiverse-editor-hint">{hint}</span>}
            {error && <span className="lumiverse-editor-error">{error}</span>}
        </div>
    );
}

/**
 * Section with icon header
 */
function EditorSection({ Icon, title, children }) {
    return (
        <div className="lumiverse-editor-section">
            <div className="lumiverse-editor-section-header">
                <Icon size={16} strokeWidth={1.5} />
                <span>{title}</span>
            </div>
            <div className="lumiverse-editor-section-content">
                {children}
            </div>
        </div>
    );
}

/**
 * Avatar preview component
 */
function AvatarPreview({ url }) {
    const [error, setError] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const { objectPosition } = useAdaptiveImagePosition(url);

    useEffect(() => {
        setError(false);
        setLoaded(false);
    }, [url]);

    if (!url || error) return null;

    return (
        <div className={clsx('lumiverse-editor-avatar-preview', loaded && 'loaded')}>
            <img
                src={url}
                alt="Avatar preview"
                style={{ objectPosition }}
                onLoad={() => setLoaded(true)}
                onError={() => setError(true)}
            />
            {!loaded && <div className="lumiverse-editor-avatar-spinner" />}
        </div>
    );
}

/**
 * Lumia Editor Modal
 *
 * For creating or editing a single Lumia item.
 * Matches the old lumiaEditor.js showLumiaEditorModal() functionality.
 *
 * Props:
 * - packName: The pack to add/edit the Lumia in
 * - editingItem: Optional existing item to edit (null for new)
 * - onClose: Close callback
 * - onSaved: Optional callback after save
 */
function LumiaEditorModal({ packName, editingItem = null, onClose, onSaved }) {
    const { allPacks } = usePacks();
    const actions = useLumiverseActions();

    const isEditing = editingItem !== null;

    // Find the pack - support both name and packName
    const pack = allPacks.find(p => (p.name || p.packName) === packName);

    // Form state - use getLumiaField for backwards compatibility
    const [name, setName] = useState(getLumiaField(editingItem, 'name') || '');
    const [avatarUrl, setAvatarUrl] = useState(getLumiaField(editingItem, 'img') || '');
    const [author, setAuthor] = useState(getLumiaField(editingItem, 'author') || '');
    const [physicality, setPhysicality] = useState(getLumiaField(editingItem, 'def') || '');
    const [personality, setPersonality] = useState(getLumiaField(editingItem, 'personality') || '');
    const [behavior, setBehavior] = useState(getLumiaField(editingItem, 'behavior') || '');
    const [gender, setGender] = useState(getLumiaField(editingItem, 'gender') ?? GENDER.SHE_HER);
    const [errors, setErrors] = useState({});

    // Validate form
    const validate = useCallback(() => {
        const newErrors = {};

        if (!name.trim()) {
            newErrors.name = 'Lumia name is required';
        }

        // Check for duplicate name (if creating new or renaming)
        if (pack && name.trim()) {
            // Support both new (lumiaItems) and legacy (items) format
            const itemsToCheck = pack.lumiaItems || pack.items || [];
            const editingName = getLumiaField(editingItem, 'name');

            const existingItem = itemsToCheck.find(item => {
                const itemName = getLumiaField(item, 'name');
                return itemName === name.trim() &&
                    (!isEditing || itemName !== editingName);
            });
            if (existingItem) {
                newErrors.name = `A Lumia named "${name.trim()}" already exists in this pack`;
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [name, pack, isEditing, editingItem]);

    // Save the Lumia
    const handleSave = useCallback(() => {
        if (!validate()) return;

        // Build the Lumia item (new v2 format)
        const lumiaItem = {
            lumiaName: name.trim(),
            avatarUrl: avatarUrl.trim() || null,
            authorName: author.trim() || null,
            lumiaDefinition: physicality.trim() || null,
            lumiaPersonality: personality.trim() || null,
            lumiaBehavior: behavior.trim() || null,
            genderIdentity: gender,
            version: 1,
        };

        // Find and update the pack
        if (pack) {
            // Use lumiaItems array (new format), fall back to items for migration
            const currentItems = [...(pack.lumiaItems || pack.items || [])];
            const editingName = getLumiaField(editingItem, 'name');

            if (isEditing) {
                // Find and replace the existing item
                const index = currentItems.findIndex(item =>
                    getLumiaField(item, 'name') === editingName
                );
                if (index >= 0) {
                    currentItems[index] = lumiaItem;
                } else {
                    currentItems.push(lumiaItem);
                }
            } else {
                // Add new item
                currentItems.push(lumiaItem);
            }

            // Update the pack with new format
            const updatedPack = {
                ...pack,
                lumiaItems: currentItems,
                // Remove legacy items array if we're updating lumiaItems
                items: undefined,
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
                onSaved(lumiaItem, packName);
            }
        }

        onClose();
    }, [
        validate, name, avatarUrl, author, physicality, personality, behavior, gender,
        pack, isEditing, editingItem, actions, packName, onClose, onSaved
    ]);

    // Delete the Lumia
    const handleDelete = useCallback(() => {
        if (!isEditing || !editingItem) return;

        const editingName = getLumiaField(editingItem, 'name');
        if (!window.confirm(`Are you sure you want to delete "${editingName}"? This cannot be undone.`)) {
            return;
        }

        if (pack) {
            // Support both new (lumiaItems) and legacy (items) format
            const currentItems = pack.lumiaItems || pack.items || [];
            const updatedItems = currentItems.filter(item =>
                getLumiaField(item, 'name') !== editingName
            );

            // Update with new format
            const updatedPack = {
                ...pack,
                lumiaItems: updatedItems,
                items: undefined,
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
        <div className="lumiverse-editor-modal" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
            <div className="lumiverse-editor-content" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
                {/* Basic Info Section */}
                <EditorSection Icon={User} title="Basic Info">
                    <FormField label="Lumia Name" required error={errors.name}>
                        <input
                            type="text"
                            className="lumiverse-input"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                if (errors.name) setErrors(prev => ({ ...prev, name: null }));
                            }}
                            placeholder="e.g., Aria, Luna, Sage"
                            autoFocus
                        />
                        <span className="lumiverse-editor-hint">
                            Will be referenced as "Lumia ({name || 'Name'})" in World Books
                        </span>
                    </FormField>

                    <div className="lumiverse-editor-row">
                        <FormField label="Avatar URL">
                            <input
                                type="text"
                                className="lumiverse-input"
                                value={avatarUrl}
                                onChange={(e) => setAvatarUrl(e.target.value)}
                                placeholder="https://..."
                            />
                        </FormField>
                        <FormField label="Author">
                            <input
                                type="text"
                                className="lumiverse-input"
                                value={author}
                                onChange={(e) => setAuthor(e.target.value)}
                                placeholder="Your name"
                            />
                        </FormField>
                    </div>

                    <div className="lumiverse-editor-row" style={{ display: 'block', marginTop: '12px' }}>
                        <FormField label="Gender Identity" hint="Used for pronoun macros like {{lumiaPn subject}}">
                            <select
                                className="lumiverse-input lumiverse-select"
                                value={gender}
                                onChange={(e) => setGender(Number(e.target.value))}
                                style={{ width: '100%', display: 'block' }}
                            >
                                {GENDER_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                    </div>

                    <AvatarPreview url={avatarUrl} />
                </EditorSection>

                {/* Physicality Section */}
                <EditorSection Icon={User} title="Lumia Physicality">
                    <FormField label="Physical Definition" hint="Injected via {{lumiaDef}} macro">
                        <textarea
                            className="lumiverse-textarea"
                            value={physicality}
                            onChange={(e) => setPhysicality(e.target.value)}
                            placeholder="Describe Lumia's physical appearance, form, and presence..."
                            rows={5}
                        />
                    </FormField>
                </EditorSection>

                {/* Personality Section */}
                <EditorSection Icon={Smile} title="Lumia Personality">
                    <FormField label="Personality Traits" hint="Injected via {{lumiaPersonality}} macro">
                        <textarea
                            className="lumiverse-textarea"
                            value={personality}
                            onChange={(e) => setPersonality(e.target.value)}
                            placeholder="Describe Lumia's personality, disposition, and inner nature..."
                            rows={5}
                        />
                    </FormField>
                </EditorSection>

                {/* Behavior Section */}
                <EditorSection Icon={Wrench} title="Lumia Behavior Traits">
                    <FormField label="Behavioral Patterns" hint="Injected via {{lumiaBehavior}} macro">
                        <textarea
                            className="lumiverse-textarea"
                            value={behavior}
                            onChange={(e) => setBehavior(e.target.value)}
                            placeholder="Describe Lumia's behavioral patterns, habits, and tendencies..."
                            rows={5}
                        />
                    </FormField>
                </EditorSection>
            </div>

            {/* Footer */}
            <div className="lumiverse-editor-footer">
                {isEditing && (
                    <button
                        className="lumiverse-btn lumiverse-btn--danger"
                        onClick={handleDelete}
                        type="button"
                    >
                        <Trash2 size={14} />
                        Delete
                    </button>
                )}
                <div className="lumiverse-editor-footer-spacer" />
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
                    {isEditing ? 'Save Changes' : 'Create Lumia'}
                </button>
            </div>
        </div>
    );
}

export default LumiaEditorModal;
