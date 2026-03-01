import React, { useState, useCallback, useRef } from 'react';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { User, Smile, Wrench, Trash2, X, Sparkles, Image as ImageIcon } from 'lucide-react';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';
import ConfirmationModal from '../shared/ConfirmationModal';
import LazyImage from '../shared/LazyImage';

/**
 * Lumia Item Structure (new v2 format):
 * {
 *   lumiaName: string,
 *   avatarUrl: string | null,
 *   authorName: string | null,
 *   lumiaDefinition: string | null,
 *   lumiaPersonality: string | null,
 *   lumiaBehavior: string | null,
 *   genderIdentity: number,
 *   version: number
 * }
 */

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

/* ============================================
   Avatar Preview
   ============================================ */
function AvatarPreview({ url }) {
    const { objectPosition } = useAdaptiveImagePosition(url || '');

    return (
        <div className="lumiverse-editor-image-preview">
            <LazyImage
                src={url}
                alt="Avatar"
                objectPosition={objectPosition}
                spinnerSize={16}
                fallback={
                    <div className="lumiverse-editor-image-placeholder">
                        <ImageIcon size={18} />
                    </div>
                }
            />
        </div>
    );
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
   Main Component
   ============================================ */
function LumiaEditorModal({ packName, editingItem = null, onClose, onSaved }) {
    const { allPacks } = usePacks();
    const actions = useLumiverseActions();
    const isEditing = editingItem !== null;

    const pack = allPacks.find(p => (p.name || p.packName) === packName);

    // Form state
    const [name, setName] = useState(getLumiaField(editingItem, 'name') || '');
    const [avatarUrl, setAvatarUrl] = useState(getLumiaField(editingItem, 'img') || '');
    const [author, setAuthor] = useState(getLumiaField(editingItem, 'author') || '');
    const [physicality, setPhysicality] = useState(getLumiaField(editingItem, 'def') || '');
    const [personality, setPersonality] = useState(getLumiaField(editingItem, 'personality') || '');
    const [behavior, setBehavior] = useState(getLumiaField(editingItem, 'behavior') || '');
    const [gender, setGender] = useState(getLumiaField(editingItem, 'gender') ?? GENDER.SHE_HER);
    const [errors, setErrors] = useState({});

    // Confirmation modals
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    // Track initial values for dirty checking
    const initialRef = useRef({
        name: getLumiaField(editingItem, 'name') || '',
        avatarUrl: getLumiaField(editingItem, 'img') || '',
        author: getLumiaField(editingItem, 'author') || '',
        physicality: getLumiaField(editingItem, 'def') || '',
        personality: getLumiaField(editingItem, 'personality') || '',
        behavior: getLumiaField(editingItem, 'behavior') || '',
        gender: getLumiaField(editingItem, 'gender') ?? GENDER.SHE_HER,
    });

    const isDirty = useCallback(() => {
        const init = initialRef.current;
        return name !== init.name ||
            avatarUrl !== init.avatarUrl ||
            author !== init.author ||
            physicality !== init.physicality ||
            personality !== init.personality ||
            behavior !== init.behavior ||
            Number(gender) !== Number(init.gender);
    }, [name, avatarUrl, author, physicality, personality, behavior, gender]);

    const handleClose = useCallback(() => {
        if (isDirty()) {
            setShowDiscardConfirm(true);
        } else {
            onClose();
        }
    }, [isDirty, onClose]);

    const validate = useCallback(() => {
        const newErrors = {};
        if (!name.trim()) {
            newErrors.name = 'Lumia name is required';
        }
        if (pack && name.trim()) {
            const itemsToCheck = pack.lumiaItems || pack.items || [];
            const editingName = getLumiaField(editingItem, 'name');
            const existingItem = itemsToCheck.find(item => {
                const itemName = getLumiaField(item, 'name');
                return itemName === name.trim() && (!isEditing || itemName !== editingName);
            });
            if (existingItem) {
                newErrors.name = `A Lumia named "${name.trim()}" already exists`;
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [name, pack, isEditing, editingItem]);

    const handleSave = useCallback(() => {
        if (!validate()) return;

        const lumiaItem = {
            lumiaName: name.trim(),
            avatarUrl: avatarUrl.trim() || null,
            authorName: author.trim() || null,
            lumiaDefinition: physicality.trim() || null,
            lumiaPersonality: personality.trim() || null,
            lumiaBehavior: behavior.trim() || null,
            genderIdentity: Number(gender),
            version: 1,
        };

        if (pack) {
            const currentItems = [...(pack.lumiaItems || pack.items || [])];
            const editingName = getLumiaField(editingItem, 'name');

            if (isEditing) {
                const index = currentItems.findIndex(item =>
                    getLumiaField(item, 'name') === editingName
                );
                if (index >= 0) {
                    currentItems[index] = lumiaItem;
                } else {
                    currentItems.push(lumiaItem);
                }
            } else {
                currentItems.push(lumiaItem);
            }

            const updatedPack = {
                ...pack,
                lumiaItems: currentItems,
                items: undefined,
            };

            const packKey = pack.id || pack.name || pack.packName;
            if (pack.isCustom) {
                actions.updateCustomPack(packKey, updatedPack);
            } else {
                actions.updateCustomPack(packKey, { ...updatedPack, isCustom: true });
            }

            saveToExtension();
            if (onSaved) onSaved(lumiaItem, packName);
        }
        onClose();
    }, [
        validate, name, avatarUrl, author, physicality, personality, behavior, gender,
        pack, isEditing, editingItem, actions, packName, onClose, onSaved
    ]);

    const handleDelete = useCallback(() => {
        if (!isEditing || !editingItem) return;
        setShowDeleteConfirm(true);
    }, [isEditing, editingItem]);

    const confirmDelete = useCallback(() => {
        const editingName = getLumiaField(editingItem, 'name');
        if (pack) {
            const currentItems = pack.lumiaItems || pack.items || [];
            const updatedItems = currentItems.filter(item =>
                getLumiaField(item, 'name') !== editingName
            );
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

    return (
        <div className="lumiverse-editor-layout">
            {/* Mobile swipe handle */}
            <div className="lumiverse-editor-swipe-handle" />

            {/* Header */}
            <div className="lumiverse-editor-header">
                <div className="lumiverse-editor-header-icon">
                    <Sparkles size={18} />
                </div>
                <div className="lumiverse-editor-header-text">
                    <h2 className="lumiverse-editor-header-title">
                        {isEditing ? 'Edit Lumia' : 'Create New Lumia'}
                    </h2>
                    <div className="lumiverse-editor-header-subtitle">
                        {pack.packName || pack.name}
                    </div>
                </div>
                <button className="lumiverse-editor-close-btn" onClick={handleClose}>
                    <X size={18} />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="lumiverse-editor-scroll">
                {/* Basic Info Section */}
                <div className="lumiverse-editor-section">
                    <div className="lumiverse-editor-section-header">
                        <div className="lumiverse-editor-section-icon"><User size={15} /></div>
                        <span className="lumiverse-editor-section-title">Basic Info</span>
                    </div>

                    {/* Name */}
                    <div className="lumiverse-editor-field">
                        <label className="lumiverse-editor-label">
                            Lumia Name <span className="lumiverse-editor-required">*</span>
                        </label>
                        <input
                            type="text"
                            className="lumiverse-editor-input"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                if (errors.name) setErrors(prev => ({ ...prev, name: null }));
                            }}
                            placeholder="e.g., Aria, Luna, Sage"
                            autoFocus
                        />
                        <div className="lumiverse-editor-hint">Referenced as 'Lumia' in World Books</div>
                        {errors.name && <div className="lumiverse-editor-error">{errors.name}</div>}
                    </div>

                    {/* Gender + Author */}
                    <div className="lumiverse-editor-grid-2col">
                        <div className="lumiverse-editor-field">
                            <label className="lumiverse-editor-label">Gender Identity</label>
                            <div className="lumiverse-editor-select-wrapper">
                                <select
                                    className="lumiverse-editor-select"
                                    value={gender}
                                    onChange={(e) => setGender(e.target.value)}
                                >
                                    {GENDER_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <div className="lumiverse-editor-select-chevron">&#x25BC;</div>
                            </div>
                            <div className="lumiverse-editor-hint">For pronouns macro</div>
                        </div>

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
                    </div>

                    {/* Avatar URL */}
                    <div className="lumiverse-editor-field">
                        <label className="lumiverse-editor-label">Avatar URL</label>
                        <div className="lumiverse-editor-image-row">
                            <div style={{ flex: 1 }}>
                                <input
                                    type="text"
                                    className="lumiverse-editor-input"
                                    value={avatarUrl}
                                    onChange={(e) => setAvatarUrl(e.target.value)}
                                    placeholder="https://..."
                                />
                            </div>
                            <AvatarPreview url={avatarUrl} />
                        </div>
                    </div>
                </div>

                {/* Physicality Section */}
                <div className="lumiverse-editor-section">
                    <div className="lumiverse-editor-section-header">
                        <div className="lumiverse-editor-section-icon"><User size={15} /></div>
                        <span className="lumiverse-editor-section-title">Physical Definition</span>
                    </div>
                    <div className="lumiverse-editor-field">
                        <label className="lumiverse-editor-label">
                            Physicality
                            <CharCount text={physicality} />
                        </label>
                        <textarea
                            className="lumiverse-editor-textarea"
                            value={physicality}
                            onChange={(e) => setPhysicality(e.target.value)}
                            placeholder="Describe Lumia's physical appearance, form, and presence..."
                            rows={6}
                        />
                        <div className="lumiverse-editor-hint">Injected via {'{{lumiaDef}}'} macro</div>
                    </div>
                </div>

                {/* Personality Section */}
                <div className="lumiverse-editor-section">
                    <div className="lumiverse-editor-section-header">
                        <div className="lumiverse-editor-section-icon"><Smile size={15} /></div>
                        <span className="lumiverse-editor-section-title">Personality Traits</span>
                    </div>
                    <div className="lumiverse-editor-field">
                        <label className="lumiverse-editor-label">
                            Personality
                            <CharCount text={personality} />
                        </label>
                        <textarea
                            className="lumiverse-editor-textarea"
                            value={personality}
                            onChange={(e) => setPersonality(e.target.value)}
                            placeholder="Describe Lumia's personality, disposition, and inner nature..."
                            rows={6}
                        />
                        <div className="lumiverse-editor-hint">Injected via {'{{lumiaPersonality}}'} macro</div>
                    </div>
                </div>

                {/* Behavior Section */}
                <div className="lumiverse-editor-section">
                    <div className="lumiverse-editor-section-header">
                        <div className="lumiverse-editor-section-icon"><Wrench size={15} /></div>
                        <span className="lumiverse-editor-section-title">Behavioral Patterns</span>
                    </div>
                    <div className="lumiverse-editor-field">
                        <label className="lumiverse-editor-label">
                            Behavior
                            <CharCount text={behavior} />
                        </label>
                        <textarea
                            className="lumiverse-editor-textarea"
                            value={behavior}
                            onChange={(e) => setBehavior(e.target.value)}
                            placeholder="Describe Lumia's behavioral patterns, habits, and tendencies..."
                            rows={6}
                        />
                        <div className="lumiverse-editor-hint">Injected via {'{{lumiaBehavior}}'} macro</div>
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
                <button className="lumiverse-editor-btn-secondary" onClick={handleClose}>
                    Cancel
                </button>
                <button className="lumiverse-editor-btn-primary" onClick={handleSave}>
                    {isEditing ? 'Save Changes' : 'Create Lumia'}
                </button>
            </div>

            {/* Delete confirmation */}
            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onConfirm={confirmDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                title={`Delete "${getLumiaField(editingItem, 'name')}"?`}
                message="This will permanently remove this Lumia. This cannot be undone."
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

export default LumiaEditorModal;
