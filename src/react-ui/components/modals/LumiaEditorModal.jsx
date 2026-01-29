import React, { useState, useCallback } from 'react';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { User, Smile, Wrench, Trash2, X, Sparkles, Image as ImageIcon } from 'lucide-react';
import { useAdaptiveImagePosition } from '../../hooks/useAdaptiveImagePosition';
import clsx from 'clsx';

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
   Inline Styled Components (no external deps)
   ============================================ */

const styles = {
    modalLayout: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        overflow: 'hidden',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 20px',
        background: 'var(--lumiverse-bg-elevated)',
        borderBottom: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
    },
    headerIcon: {
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(147, 112, 219, 0.2), rgba(186, 85, 211, 0.15))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--lumiverse-primary)',
        flexShrink: 0,
    },
    headerTitle: {
        flex: 1,
        fontSize: '15px',
        fontWeight: 600,
        color: 'var(--lumiverse-text)',
        margin: 0,
    },
    headerSubtitle: {
        fontSize: '12px',
        color: 'var(--lumiverse-text-muted)',
        marginTop: '2px',
    },
    closeBtn: {
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        border: 'none',
        background: 'transparent',
        color: 'var(--lumiverse-text-muted)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        flexShrink: 0,
    },
    scrollArea: {
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '20px',
    },
    section: {
        marginBottom: '24px',
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px',
        paddingBottom: '10px',
        borderBottom: '1px solid var(--lumiverse-border)',
    },
    sectionIcon: {
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        background: 'rgba(147, 112, 219, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--lumiverse-primary)',
    },
    sectionTitle: {
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--lumiverse-text)',
    },
    field: {
        marginBottom: '16px',
    },
    label: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '8px',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--lumiverse-text-muted)',
    },
    required: {
        color: 'var(--lumiverse-danger)',
    },
    hint: {
        marginTop: '6px',
        fontSize: '11px',
        color: 'var(--lumiverse-text-dim)',
        lineHeight: 1.4,
    },
    error: {
        marginTop: '4px',
        fontSize: '12px',
        color: 'var(--lumiverse-danger)',
    },
    input: {
        width: '100%',
        padding: '10px 12px',
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        color: 'var(--lumiverse-text)',
        fontSize: '13px',
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        boxSizing: 'border-box',
    },
    textarea: {
        width: '100%',
        padding: '12px',
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        color: 'var(--lumiverse-text)',
        fontSize: '13px',
        fontFamily: 'inherit',
        lineHeight: 1.6,
        resize: 'vertical',
        outline: 'none',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        boxSizing: 'border-box',
        minHeight: '120px',
    },
    select: {
        width: '100%',
        padding: '10px 32px 10px 12px',
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        color: 'var(--lumiverse-text)',
        fontSize: '13px',
        fontFamily: 'inherit',
        appearance: 'none',
        cursor: 'pointer',
        outline: 'none',
        boxSizing: 'border-box',
    },
    selectWrapper: {
        position: 'relative',
    },
    selectChevron: {
        position: 'absolute',
        right: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
        color: 'var(--lumiverse-text-muted)',
    },
    grid2Col: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
    },
    imageRow: {
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
    },
    imagePreview: {
        width: '44px',
        height: '44px',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
        background: 'rgba(0, 0, 0, 0.2)',
    },
    imagePlaceholder: {
        width: '44px',
        height: '44px',
        borderRadius: '8px',
        border: '1px dashed var(--lumiverse-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: 'var(--lumiverse-text-dim)',
        background: 'rgba(0, 0, 0, 0.1)',
    },
    footer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '16px 20px',
        background: 'var(--lumiverse-bg-elevated)',
        borderTop: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
    },
    btnPrimary: {
        padding: '10px 20px',
        borderRadius: '8px',
        border: 'none',
        background: 'var(--lumiverse-primary)',
        color: '#fff',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    },
    btnSecondary: {
        padding: '10px 16px',
        borderRadius: '8px',
        border: '1px solid var(--lumiverse-border)',
        background: 'transparent',
        color: 'var(--lumiverse-text)',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
    },
    btnDanger: {
        padding: '10px 16px',
        borderRadius: '8px',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginRight: 'auto',
    },
    spacer: {
        marginRight: 'auto',
    },
};

/* ============================================
   Image Preview Component
   ============================================ */
function AvatarPreview({ url }) {
    const [hasError, setHasError] = useState(false);
    const { objectPosition } = useAdaptiveImagePosition(url || '');

    React.useEffect(() => {
        setHasError(false);
    }, [url]);

    if (!url || hasError) {
        return (
            <div style={styles.imagePlaceholder}>
                <ImageIcon size={18} />
            </div>
        );
    }

    return (
        <div style={styles.imagePreview}>
            <img
                src={url}
                alt="Avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition }}
                onError={() => setHasError(true)}
            />
        </div>
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

    const [name, setName] = useState(getLumiaField(editingItem, 'name') || '');
    const [avatarUrl, setAvatarUrl] = useState(getLumiaField(editingItem, 'img') || '');
    const [author, setAuthor] = useState(getLumiaField(editingItem, 'author') || '');
    const [physicality, setPhysicality] = useState(getLumiaField(editingItem, 'def') || '');
    const [personality, setPersonality] = useState(getLumiaField(editingItem, 'personality') || '');
    const [behavior, setBehavior] = useState(getLumiaField(editingItem, 'behavior') || '');
    const [gender, setGender] = useState(getLumiaField(editingItem, 'gender') ?? GENDER.SHE_HER);
    const [errors, setErrors] = useState({});

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
        const editingName = getLumiaField(editingItem, 'name');
        if (!window.confirm(`Delete "${editingName}"? This cannot be undone.`)) return;

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
        onClose();
    }, [isEditing, editingItem, pack, actions, onClose]);

    if (!pack) {
        return (
            <div style={styles.modalLayout}>
                <div style={{ ...styles.scrollArea, textAlign: 'center', paddingTop: '40px' }}>
                    <p style={{ color: 'var(--lumiverse-text-muted)' }}>Pack "{packName}" not found.</p>
                    <button style={styles.btnSecondary} onClick={onClose}>Close</button>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.modalLayout}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerIcon}>
                    <Sparkles size={18} />
                </div>
                <div style={{ flex: 1 }}>
                    <h2 style={styles.headerTitle}>
                        {isEditing ? 'Edit Lumia' : 'Create New Lumia'}
                    </h2>
                    <div style={styles.headerSubtitle}>
                        {pack.packName || pack.name}
                    </div>
                </div>
                <button
                    style={styles.closeBtn}
                    onClick={onClose}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--lumiverse-bg-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <X size={18} />
                </button>
            </div>

            {/* Scrollable Content */}
            <div style={styles.scrollArea}>
                {/* Basic Info Section */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <div style={styles.sectionIcon}><User size={15} /></div>
                        <span style={styles.sectionTitle}>Basic Info</span>
                    </div>

                    {/* Name Field */}
                    <div style={styles.field}>
                        <label style={styles.label}>
                            Lumia Name <span style={styles.required}>*</span>
                        </label>
                        <input
                            type="text"
                            style={styles.input}
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                if (errors.name) setErrors(prev => ({ ...prev, name: null }));
                            }}
                            placeholder="e.g., Aria, Luna, Sage"
                            autoFocus
                        />
                        <div style={styles.hint}>Referenced as 'Lumia' in World Books</div>
                        {errors.name && <div style={styles.error}>{errors.name}</div>}
                    </div>

                    {/* Gender + Author Row */}
                    <div style={styles.grid2Col}>
                        <div style={styles.field}>
                            <label style={styles.label}>Gender Identity</label>
                            <div style={styles.selectWrapper}>
                                <select
                                    style={styles.select}
                                    value={gender}
                                    onChange={(e) => setGender(e.target.value)}
                                >
                                    {GENDER_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <div style={styles.selectChevron}>▼</div>
                            </div>
                            <div style={styles.hint}>For pronouns macro</div>
                        </div>

                        <div style={styles.field}>
                            <label style={styles.label}>Author</label>
                            <input
                                type="text"
                                style={styles.input}
                                value={author}
                                onChange={(e) => setAuthor(e.target.value)}
                                placeholder="Your name"
                            />
                        </div>
                    </div>

                    {/* Avatar URL */}
                    <div style={styles.field}>
                        <label style={styles.label}>Avatar URL</label>
                        <div style={styles.imageRow}>
                            <div style={{ flex: 1 }}>
                                <input
                                    type="text"
                                    style={styles.input}
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
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <div style={styles.sectionIcon}><User size={15} /></div>
                        <span style={styles.sectionTitle}>Physical Definition</span>
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>Physicality</label>
                        <textarea
                            style={styles.textarea}
                            value={physicality}
                            onChange={(e) => setPhysicality(e.target.value)}
                            placeholder="Describe Lumia's physical appearance, form, and presence..."
                            rows={6}
                        />
                        <div style={styles.hint}>Injected via {'{{lumiaDef}}'} macro</div>
                    </div>
                </div>

                {/* Personality Section */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <div style={styles.sectionIcon}><Smile size={15} /></div>
                        <span style={styles.sectionTitle}>Personality Traits</span>
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>Personality</label>
                        <textarea
                            style={styles.textarea}
                            value={personality}
                            onChange={(e) => setPersonality(e.target.value)}
                            placeholder="Describe Lumia's personality, disposition, and inner nature..."
                            rows={6}
                        />
                        <div style={styles.hint}>Injected via {'{{lumiaPersonality}}'} macro</div>
                    </div>
                </div>

                {/* Behavior Section */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <div style={styles.sectionIcon}><Wrench size={15} /></div>
                        <span style={styles.sectionTitle}>Behavioral Patterns</span>
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>Behavior</label>
                        <textarea
                            style={styles.textarea}
                            value={behavior}
                            onChange={(e) => setBehavior(e.target.value)}
                            placeholder="Describe Lumia's behavioral patterns, habits, and tendencies..."
                            rows={6}
                        />
                        <div style={styles.hint}>Injected via {'{{lumiaBehavior}}'} macro</div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={styles.footer}>
                {isEditing ? (
                    <button style={styles.btnDanger} onClick={handleDelete}>
                        <Trash2 size={14} /> Delete
                    </button>
                ) : (
                    <div style={styles.spacer} />
                )}
                <button style={styles.btnSecondary} onClick={onClose}>
                    Cancel
                </button>
                <button style={styles.btnPrimary} onClick={handleSave}>
                    {isEditing ? 'Save Changes' : 'Create Lumia'}
                </button>
            </div>
        </div>
    );
}

export default LumiaEditorModal;
