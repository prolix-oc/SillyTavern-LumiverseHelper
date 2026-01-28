import React, { useState, useCallback } from 'react';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { Package, Trash2, Download, Edit2 } from 'lucide-react';
import {
    EditorLayout,
    EditorContent,
    EditorFooter,
    EditorSection,
    FormField,
    TextInput,
    ImageInput
} from '../shared/FormComponents';

/**
 * Generate a unique ID for internal tracking
 */
function generateId() {
    return `pack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate native Lumiverse pack JSON from pack data
 * Uses the new v2 schema with lumiaItems and loomItems arrays
 */
function generateNativePackJson(pack) {
    // Get pack metadata (support both old and new field names)
    const packName = pack.packName || pack.name || 'Unnamed Pack';
    const packAuthor = pack.packAuthor || pack.author || null;
    const coverUrl = pack.coverUrl || null;
    const version = pack.version || 1;

    // Get lumiaItems - support both new format (lumiaItems) and legacy format (items)
    let lumiaItems = [];
    if (pack.lumiaItems && pack.lumiaItems.length > 0) {
        // Already in new format
        lumiaItems = pack.lumiaItems.map(item => ({
            lumiaName: item.lumiaName || item.lumiaDefName || 'Unknown',
            lumiaDefinition: item.lumiaDefinition || item.lumiaDef || '',
            lumiaPersonality: item.lumiaPersonality || item.lumia_personality || '',
            lumiaBehavior: item.lumiaBehavior || item.lumia_behavior || '',
            avatarUrl: item.avatarUrl || item.lumia_img || null,
            genderIdentity: item.genderIdentity ?? 0,
            authorName: item.authorName || packAuthor || null,
            version: item.version || 1,
        }));
    } else if (pack.items && pack.items.length > 0) {
        // Convert from legacy format
        lumiaItems = pack.items
            .filter(item => item.lumiaDefName || item.lumiaDef)
            .map(item => ({
                lumiaName: item.lumiaDefName || item.lumiaName || 'Unknown',
                lumiaDefinition: item.lumiaDef || item.lumiaDefinition || '',
                lumiaPersonality: item.lumia_personality || item.lumiaPersonality || '',
                lumiaBehavior: item.lumia_behavior || item.lumiaBehavior || '',
                avatarUrl: item.lumia_img || item.avatarUrl || null,
                genderIdentity: item.genderIdentity ?? 0,
                authorName: item.authorName || packAuthor || null,
                version: item.version || 1,
            }));
    }

    // Get loomItems - support both new format (loomItems) and legacy format (items with loomCategory)
    let loomItems = [];
    if (pack.loomItems && pack.loomItems.length > 0) {
        // Already in new format
        loomItems = pack.loomItems.map(item => ({
            loomName: item.loomName || item.name || 'Unknown',
            loomContent: item.loomContent || item.content || '',
            loomCategory: item.loomCategory || item.category || 'Loom Utilities',
            authorName: item.authorName || packAuthor || null,
            version: item.version || 1,
        }));
    } else if (pack.items && pack.items.length > 0) {
        // Convert from legacy format - Loom items have loomCategory or loomName (and lack lumiaDefName/lumiaDef)
        loomItems = pack.items
            .filter(item => (item.loomCategory || item.loomName) && !item.lumiaDefName && !item.lumiaDef)
            .map(item => ({
                loomName: item.loomName || item.name || 'Unknown',
                loomContent: item.loomContent || item.content || '',
                loomCategory: item.loomCategory || item.category || 'Loom Utilities',
                authorName: item.authorName || packAuthor || null,
                version: item.version || 1,
            }));
    }

    return {
        packName,
        packAuthor,
        coverUrl,
        version,
        packExtras: pack.packExtras || [],
        lumiaItems,
        loomItems,
    };
}

/**
 * Download pack as native Lumiverse JSON file (v2 format)
 */
export function exportPack(pack) {
    const nativePack = generateNativePackJson(pack);
    const jsonString = JSON.stringify(nativePack, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const packName = pack.packName || pack.name || 'pack';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${packName.replace(/[^a-z0-9]/gi, '_')}_lumiverse.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Helper to get pack name (v2: packName, v1: name)
 */
function getPackName(pack) {
    return pack.packName || pack.name || '';
}

/**
 * Helper to get pack author (v2: packAuthor, v1: author)
 */
function getPackAuthor(pack) {
    return pack.packAuthor || pack.author || '';
}

/**
 * Helper to get Lumia items count (v2: lumiaItems, v1: items with lumiaDefName)
 */
function getLumiaCount(pack) {
    if (pack.lumiaItems && pack.lumiaItems.length > 0) {
        return pack.lumiaItems.length;
    }
    if (pack.items && pack.items.length > 0) {
        return pack.items.filter(item => item.lumiaDefName || item.lumiaName || item.lumiaDef).length;
    }
    return 0;
}

/**
 * Helper to get Loom items count (v2: loomItems, v1: items with loomCategory)
 */
function getLoomCount(pack) {
    if (pack.loomItems && pack.loomItems.length > 0) {
        return pack.loomItems.length;
    }
    if (pack.items && pack.items.length > 0) {
        return pack.items.filter(item => (item.loomCategory || item.loomName) && !item.lumiaDefName && !item.lumiaDef).length;
    }
    return 0;
}

/**
 * Pack Editor Modal component
 *
 * For editing pack-level settings: name, author, cover image.
 * Individual Lumia items are managed via PackSelectorModal → LumiaEditorModal.
 */
function PackEditorModal({ packId, packName, onClose }) {
    const { customPacks } = usePacks();
    const actions = useLumiverseActions();

    // Resolve the identifier (support both packId and packName props)
    const identifier = packId || packName;

    // Find existing pack if editing - support both name and packName
    const existingPack = identifier
        ? customPacks.find((p) => p.id === identifier || p.name === identifier || p.packName === identifier)
        : null;

    // Local state for the pack being edited (normalize to v2 schema for editing)
    const [pack, setPack] = useState(() => {
        if (existingPack) {
            // Keep the original pack but ensure we have both old and new field names for compatibility
            return {
                ...existingPack,
                // Ensure v2 fields exist (if they don't, copy from v1)
                packName: existingPack.packName || existingPack.name || '',
                packAuthor: existingPack.packAuthor || existingPack.author || '',
            };
        }
        // New pack in v2 schema
        return {
            id: generateId(),
            packName: '',
            name: '', // Keep legacy field for compatibility
            packAuthor: '',
            coverUrl: '',
            url: '',
            isCustom: true,
            version: 1,
            packExtras: [],
            lumiaItems: [],
            loomItems: [],
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
        const packName = getPackName(pack);

        if (!packName.trim()) {
            newErrors.packName = 'Pack name is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Save pack
    const handleSave = () => {
        if (!validate()) {
            return;
        }

        // Ensure both packName and name are synced for compatibility
        const packToSave = {
            ...pack,
            name: getPackName(pack), // Sync legacy field
        };

        if (existingPack) {
            actions.updateCustomPack(pack.id || getPackName(existingPack), packToSave);
        } else {
            actions.addCustomPack(packToSave);
        }

        saveToExtension();
        onClose();
    };

    // Delete pack
    const handleDelete = () => {
        const packName = getPackName(pack);
        if (window.confirm(`Are you sure you want to delete "${packName}"? This will remove all Lumias in this pack.`)) {
            actions.removeCustomPack(pack.id || packName);
            saveToExtension();
            onClose();
        }
    };

    // Export pack as native Lumiverse JSON
    const handleExport = () => {
        const packName = getPackName(pack);
        if (!packName.trim()) {
            alert('Please enter a pack name before exporting.');
            return;
        }
        exportPack(pack);
    };

    // Open pack selector to manage Lumias
    const handleManageLumias = () => {
        const packName = getPackName(pack);
        // Save current pack state first
        if (packName.trim()) {
            const packToSave = {
                ...pack,
                name: packName, // Sync legacy field
            };

            if (existingPack) {
                actions.updateCustomPack(pack.id || getPackName(existingPack), packToSave);
            } else {
                actions.addCustomPack(packToSave);
            }
            saveToExtension();
        }
        // Open pack selector
        actions.openModal('packSelector');
        onClose();
    };

    // Get item counts using helper functions
    const lumiaCount = getLumiaCount(pack);
    const loomCount = getLoomCount(pack);

    return (
        <EditorLayout>
            <EditorContent>
                {/* Pack Details Section */}
                <EditorSection Icon={Package} title={existingPack ? 'Edit Pack' : 'New Pack'}>
                    <FormField label="Pack Name" required error={errors.packName}>
                        <TextInput
                            value={getPackName(pack)}
                            onChange={(val) => {
                                // Update both packName and name for compatibility
                                setPack(prev => ({ ...prev, packName: val, name: val }));
                                if (errors.packName) setErrors(prev => ({ ...prev, packName: null }));
                            }}
                            placeholder="My Custom Pack"
                            autoFocus
                        />
                    </FormField>

                    <FormField label="Author">
                        <TextInput
                            value={getPackAuthor(pack)}
                            onChange={(val) => {
                                // Update both packAuthor and author for compatibility
                                setPack(prev => ({ ...prev, packAuthor: val, author: val }));
                            }}
                            placeholder="Your name"
                        />
                    </FormField>

                    <FormField label="Cover Image" hint="URL for pack cover image">
                        <ImageInput
                            value={pack.coverUrl || ''}
                            onChange={(val) => updatePack('coverUrl', val)}
                            placeholder="https://..."
                        />
                    </FormField>
                </EditorSection>

                {/* Pack Contents Section */}
                <EditorSection Icon={Edit2} title="Pack Contents">
                    <div style={{
                        padding: '12px',
                        background: 'rgba(147, 112, 219, 0.05)',
                        border: '1px solid var(--lumiverse-border)',
                        borderRadius: '8px',
                        marginBottom: '12px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '13px', color: 'var(--lumiverse-text)', marginBottom: '8px' }}>
                            {lumiaCount} Lumia{lumiaCount !== 1 ? 's' : ''}{loomCount > 0 ? `, ${loomCount} Loom item${loomCount !== 1 ? 's' : ''}` : ''} in this pack
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--lumiverse-text-muted)' }}>
                            Use the Pack Selector to add, edit, or remove individual items.
                        </div>
                    </div>
                    
                    <button
                        className="lumiverse-btn lumiverse-btn--secondary lumiverse-btn--full"
                        onClick={handleManageLumias}
                        type="button"
                    >
                        <Edit2 size={14} strokeWidth={1.5} />
                        Manage Lumias & Looms
                    </button>
                </EditorSection>
            </EditorContent>

            {/* Footer Actions */}
            <EditorFooter>
                <div style={{ display: 'flex', gap: '8px', marginRight: 'auto' }}>
                    {existingPack && (
                        <button
                            className="lumiverse-btn lumiverse-btn--danger"
                            onClick={handleDelete}
                            type="button"
                        >
                            <Trash2 size={14} />
                            Delete
                        </button>
                    )}
                    <button
                        className="lumiverse-btn lumiverse-btn--secondary"
                        onClick={handleExport}
                        type="button"
                        title="Export as Lumiverse Pack"
                    >
                        <Download size={14} />
                        Export
                    </button>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
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
            </EditorFooter>
        </EditorLayout>
    );
}

export default PackEditorModal;
