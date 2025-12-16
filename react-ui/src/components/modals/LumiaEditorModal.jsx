import React, { useState, useCallback, useEffect } from 'react';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';
import clsx from 'clsx';
import { User, Smile, Wrench, Trash2 } from 'lucide-react';

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
 */

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

    // Find the pack
    const pack = allPacks.find(p => p.name === packName);

    // Form state
    const [name, setName] = useState(editingItem?.lumiaDefName || '');
    const [avatarUrl, setAvatarUrl] = useState(editingItem?.lumia_img || '');
    const [author, setAuthor] = useState(editingItem?.defAuthor || '');
    const [physicality, setPhysicality] = useState(editingItem?.lumiaDef || '');
    const [personality, setPersonality] = useState(editingItem?.lumia_personality || '');
    const [behavior, setBehavior] = useState(editingItem?.lumia_behavior || '');
    const [errors, setErrors] = useState({});

    // Validate form
    const validate = useCallback(() => {
        const newErrors = {};

        if (!name.trim()) {
            newErrors.name = 'Lumia name is required';
        }

        // Check for duplicate name (if creating new or renaming)
        if (pack && name.trim()) {
            const existingItem = pack.items?.find(
                item => item.lumiaDefName === name.trim() &&
                    (!isEditing || item.lumiaDefName !== editingItem?.lumiaDefName)
            );
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

        // Build the Lumia item (OLD CODE structure)
        const lumiaItem = {
            lumiaDefName: name.trim(),
            lumia_img: avatarUrl.trim() || null,
            defAuthor: author.trim() || null,
            lumiaDef: physicality.trim() || null,
            lumia_personality: personality.trim() || null,
            lumia_behavior: behavior.trim() || null,
        };

        // Get current packs from store
        const currentPacks = actions.getPacks ? actions.getPacks() : {};

        // Find and update the pack
        // This works with packs stored as object (keyed by name)
        if (pack) {
            const updatedItems = [...(pack.items || [])];

            if (isEditing) {
                // Find and replace the existing item
                const index = updatedItems.findIndex(
                    item => item.lumiaDefName === editingItem.lumiaDefName
                );
                if (index >= 0) {
                    updatedItems[index] = lumiaItem;
                } else {
                    updatedItems.push(lumiaItem);
                }
            } else {
                // Add new item
                updatedItems.push(lumiaItem);
            }

            // Update the pack
            const updatedPack = { ...pack, items: updatedItems };

            // Use the appropriate action based on pack type
            if (pack.isCustom) {
                actions.updateCustomPack(pack.id || pack.name, updatedPack);
            } else {
                // For non-custom packs, we need to update via setPacks
                // This is a simplified approach - in production, you might need
                // more sophisticated pack management
                actions.updateCustomPack(pack.name, { ...updatedPack, isCustom: true });
            }

            saveToExtension();

            if (onSaved) {
                onSaved(lumiaItem, packName);
            }
        }

        onClose();
    }, [
        validate, name, avatarUrl, author, physicality, personality, behavior,
        pack, isEditing, editingItem, actions, packName, onClose, onSaved
    ]);

    // Delete the Lumia
    const handleDelete = useCallback(() => {
        if (!isEditing || !editingItem) return;

        if (!window.confirm(`Are you sure you want to delete "${editingItem.lumiaDefName}"? This cannot be undone.`)) {
            return;
        }

        if (pack) {
            const updatedItems = (pack.items || []).filter(
                item => item.lumiaDefName !== editingItem.lumiaDefName
            );

            const updatedPack = { ...pack, items: updatedItems };

            if (pack.isCustom) {
                actions.updateCustomPack(pack.id || pack.name, updatedPack);
            } else {
                actions.updateCustomPack(pack.name, { ...updatedPack, isCustom: true });
            }

            // Also clean up any selections referencing this item
            // (The store actions should handle this, but we can be explicit)

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
        <div className="lumiverse-editor-modal">
            <div className="lumiverse-editor-content">
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
