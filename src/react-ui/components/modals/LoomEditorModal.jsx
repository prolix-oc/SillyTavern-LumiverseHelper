import React, { useState, useCallback } from 'react';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { ScrollText, Palette, Wrench, Settings, Trash2, X } from 'lucide-react';

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
    // Category grid styles
    categoryGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
    },
    categoryBtn: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 4px',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '8px',
        background: 'rgba(0, 0, 0, 0.2)',
        color: 'var(--lumiverse-text-muted)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
    },
    categoryBtnSelected: {
        background: 'rgba(147, 112, 219, 0.15)',
        borderColor: 'var(--lumiverse-primary)',
        color: 'var(--lumiverse-primary)',
    },
    categoryLabel: {
        fontSize: '11px',
        fontWeight: 500,
    }
};

/* ============================================
   Main Component
   ============================================ */
function LoomEditorModal({ packName, editingItem = null, onClose, onSaved }) {
    const { allPacks } = usePacks();
    const actions = useLumiverseActions();
    const isEditing = editingItem !== null;

    const pack = allPacks.find(p => (p.name || p.packName) === packName);

    const [name, setName] = useState(getLoomField(editingItem, 'name') || '');
    const [content, setContent] = useState(getLoomField(editingItem, 'content') || '');
    const [category, setCategory] = useState(getLoomField(editingItem, 'category') || 'Narrative Style');
    const [author, setAuthor] = useState(getLoomField(editingItem, 'author') || '');
    const [errors, setErrors] = useState({});

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
        const editingName = getLoomField(editingItem, 'name');
        if (!window.confirm(`Delete "${editingName}"? This cannot be undone.`)) return;

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

    const CategoryIcon = LOOM_CATEGORIES.find(c => c.value === category)?.Icon || ScrollText;

    return (
        <div style={styles.modalLayout}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerIcon}>
                    <ScrollText size={18} />
                </div>
                <div style={{ flex: 1 }}>
                    <h2 style={styles.headerTitle}>{isEditing ? 'Edit Loom' : 'Create New Loom'}</h2>
                    <div style={styles.headerSubtitle}>{pack.packName || pack.name}</div>
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
                        <div style={styles.sectionIcon}><ScrollText size={15} /></div>
                        <span style={styles.sectionTitle}>Loom Details</span>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>Loom Name <span style={styles.required}>*</span></label>
                        <input
                            type="text"
                            style={styles.input}
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                if (errors.name) setErrors(prev => ({ ...prev, name: null }));
                            }}
                            placeholder="e.g., Gothic Horror, Scene Helper"
                            autoFocus
                        />
                        {errors.name && <div style={styles.error}>{errors.name}</div>}
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

                    <div style={styles.field}>
                        <label style={styles.label}>Category <span style={styles.required}>*</span></label>
                        <div style={styles.categoryGrid}>
                            {LOOM_CATEGORIES.map(cat => {
                                const isSelected = category === cat.value;
                                return (
                                    <button
                                        key={cat.value}
                                        type="button"
                                        style={{
                                            ...styles.categoryBtn,
                                            ...(isSelected ? styles.categoryBtnSelected : {})
                                        }}
                                        onClick={() => setCategory(cat.value)}
                                        title={cat.description}
                                    >
                                        <cat.Icon size={16} strokeWidth={1.5} />
                                        <span style={styles.categoryLabel}>{cat.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <div style={styles.sectionIcon}><CategoryIcon size={15} /></div>
                        <span style={styles.sectionTitle}>Content</span>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>Loom Content <span style={styles.required}>*</span></label>
                        <textarea
                            style={styles.textarea}
                            value={content}
                            onChange={(e) => {
                                setContent(e.target.value);
                                if (errors.content) setErrors(prev => ({ ...prev, content: null }));
                            }}
                            placeholder={getContentPlaceholder(category)}
                            rows={12}
                        />
                        <div style={styles.hint}>{getCategoryHint(category)}</div>
                        {errors.content && <div style={styles.error}>{errors.content}</div>}
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
                <button style={styles.btnSecondary} onClick={onClose}>Cancel</button>
                <button style={styles.btnPrimary} onClick={handleSave}>
                    {isEditing ? 'Save Changes' : 'Create Loom'}
                </button>
            </div>
        </div>
    );
}

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

export default LoomEditorModal;
