import React, { useState, useCallback, useMemo } from 'react';
import { User, ScrollText, Wrench, Plus, ChevronRight, Pencil, Trash2, Download, Upload, Package } from 'lucide-react';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import PackDropdown from './PackDropdown';
import ConfirmationModal from '../shared/ConfirmationModal';
import { importPack } from '@lib/dataProcessor';
import { exportPack } from '../modals/PackEditorModal';

/**
 * Helper to get Lumia name with field fallback
 */
function getLumiaName(item) {
    return item.lumiaName || item.lumiaDefName || 'Unknown';
}

/**
 * Helper to get Loom name with field fallback
 */
function getLoomName(item) {
    return item.loomName || item.itemName || item.name || 'Unknown';
}

/**
 * Content Workshop — Create Tab Dashboard
 *
 * Three sections:
 * A) Quick Create — two cards for new Lumia/Loom with inline pack dropdown
 * B) My Packs — expandable list of custom packs with item management
 * C) Import — file picker for JSON pack import
 */
function ContentWorkshop() {
    const { customPacks, allPacks } = usePacks();
    const actions = useLumiverseActions();

    const [lumiaPackName, setLumiaPackName] = useState('');
    const [loomPackName, setLoomPackName] = useState('');
    const [toolPackName, setToolPackName] = useState('');
    const [expandedPacks, setExpandedPacks] = useState({});
    const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'pack'|'item', packName, itemName?, itemType? }

    // Auto-set default pack if user has exactly one custom pack
    const defaultPackName = useMemo(() => {
        if (customPacks.length === 1) {
            return customPacks[0].packName || customPacks[0].name || '';
        }
        return '';
    }, [customPacks]);

    const effectiveLumiaPackName = lumiaPackName || defaultPackName;
    const effectiveLoomPackName = loomPackName || defaultPackName;
    const effectiveToolPackName = toolPackName || defaultPackName;

    // --- Quick Create ---

    const ensurePack = useCallback((packName) => {
        if (!packName) return null;
        const existing = allPacks.find(p => (p.packName || p.name) === packName);
        if (existing) return packName;

        // Auto-create pack
        const newPack = {
            id: `pack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            packName,
            name: packName,
            packAuthor: null,
            coverUrl: null,
            url: '',
            isCustom: true,
            version: 1,
            packExtras: [],
            lumiaItems: [],
            loomItems: [],
            loomTools: [],
        };
        actions.addCustomPack(newPack);
        saveToExtension();
        return packName;
    }, [allPacks, actions]);

    const handleCreateLumia = useCallback(() => {
        let packName = effectiveLumiaPackName;

        // If no packs at all, auto-create "My Pack"
        if (!packName && customPacks.length === 0) {
            packName = 'My Pack';
            ensurePack(packName);
            setLumiaPackName(packName);
        }

        if (!packName) return;
        ensurePack(packName);
        actions.openModal('lumiaEditor', { packName });
    }, [effectiveLumiaPackName, customPacks.length, ensurePack, actions]);

    const handleCreateLoom = useCallback(() => {
        let packName = effectiveLoomPackName;

        if (!packName && customPacks.length === 0) {
            packName = 'My Pack';
            ensurePack(packName);
            setLoomPackName(packName);
        }

        if (!packName) return;
        ensurePack(packName);
        actions.openModal('loomEditor', { packName });
    }, [effectiveLoomPackName, customPacks.length, ensurePack, actions]);

    const handleCreateTool = useCallback(() => {
        let packName = effectiveToolPackName;

        if (!packName && customPacks.length === 0) {
            packName = 'My Pack';
            ensurePack(packName);
            setToolPackName(packName);
        }

        if (!packName) return;
        ensurePack(packName);
        actions.openModal('toolEditor', { packName });
    }, [effectiveToolPackName, customPacks.length, ensurePack, actions]);

    // --- Pack Management ---

    const togglePack = useCallback((name) => {
        setExpandedPacks(prev => ({ ...prev, [name]: !prev[name] }));
    }, []);

    const handleEditItem = useCallback((packName, item, type) => {
        if (type === 'lumia') {
            actions.openModal('lumiaEditor', { packName, editingItem: item });
        } else if (type === 'tool') {
            actions.openModal('toolEditor', { packName, editingItem: item });
        } else {
            actions.openModal('loomEditor', { packName, editingItem: item });
        }
    }, [actions]);

    const handleDeleteItem = useCallback((packName, itemName, itemType) => {
        setDeleteConfirm({ type: 'item', packName, itemName, itemType });
    }, []);

    const handleDeletePack = useCallback((packName) => {
        setDeleteConfirm({ type: 'pack', packName });
    }, []);

    const confirmDelete = useCallback(() => {
        if (!deleteConfirm) return;
        const { type, packName, itemName, itemType } = deleteConfirm;

        if (type === 'pack') {
            actions.removeCustomPack(packName);
            saveToExtension();
        } else if (type === 'item') {
            const pack = allPacks.find(p => (p.packName || p.name) === packName);
            if (!pack) return;

            let updatedPack;
            if (itemType === 'lumia') {
                const items = (pack.lumiaItems || pack.items || []).filter(
                    i => getLumiaName(i) !== itemName
                );
                updatedPack = { ...pack, lumiaItems: items, items: undefined };
            } else if (itemType === 'tool') {
                const items = (pack.loomTools || []).filter(
                    i => i.toolName !== itemName
                );
                updatedPack = { ...pack, loomTools: items };
            } else {
                const items = (pack.loomItems || []).filter(
                    i => getLoomName(i) !== itemName
                );
                updatedPack = { ...pack, loomItems: items };
            }

            const packKey = pack.id || pack.name || pack.packName;
            actions.updateCustomPack(packKey, updatedPack);
            saveToExtension();
        }
        setDeleteConfirm(null);
    }, [deleteConfirm, allPacks, actions]);

    const handleExportPack = useCallback((pack) => {
        exportPack(pack);
    }, []);

    // --- Import ---

    const handleImportFile = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                await importPack(data, file.name.replace(/\.json$/i, ''));
                saveToExtension();
            } catch (err) {
                console.error('[Lumiverse] Import failed:', err);
            }
        };
        input.click();
    }, []);

    // --- Render ---

    return (
        <div className="lumiverse-workshop">
            {/* Section A: Quick Create */}
            <div className="lumiverse-workshop-section">
                <div className="lumiverse-workshop-section-title">Quick Create</div>
                <div className="lumiverse-workshop-quick-create">
                    {/* New Lumia row */}
                    <div className={`lumiverse-workshop-create-card ${customPacks.length > 1 ? 'lumiverse-workshop-create-card--has-dropdown' : ''}`}>
                        <div className="lumiverse-workshop-create-card-icon">
                            <User size={16} strokeWidth={1.5} />
                        </div>
                        <div className="lumiverse-workshop-create-card-body">
                            <div className="lumiverse-workshop-create-card-label">New Lumia</div>
                            <div className="lumiverse-workshop-create-card-desc">Character definition</div>
                        </div>
                        <button
                            className="lumiverse-workshop-create-card-action"
                            type="button"
                            onClick={handleCreateLumia}
                        >
                            <Plus size={13} /> Create
                        </button>
                        {customPacks.length > 1 && (
                            <PackDropdown
                                value={effectiveLumiaPackName}
                                onChange={setLumiaPackName}
                                placeholder="Pick a pack..."
                            />
                        )}
                    </div>

                    {/* New Loom row */}
                    <div className={`lumiverse-workshop-create-card ${customPacks.length > 1 ? 'lumiverse-workshop-create-card--has-dropdown' : ''}`}>
                        <div className="lumiverse-workshop-create-card-icon">
                            <ScrollText size={16} strokeWidth={1.5} />
                        </div>
                        <div className="lumiverse-workshop-create-card-body">
                            <div className="lumiverse-workshop-create-card-label">New Loom</div>
                            <div className="lumiverse-workshop-create-card-desc">Style, utility, or retrofit</div>
                        </div>
                        <button
                            className="lumiverse-workshop-create-card-action"
                            type="button"
                            onClick={handleCreateLoom}
                        >
                            <Plus size={13} /> Create
                        </button>
                        {customPacks.length > 1 && (
                            <PackDropdown
                                value={effectiveLoomPackName}
                                onChange={setLoomPackName}
                                placeholder="Pick a pack..."
                            />
                        )}
                    </div>

                    {/* New Tool row */}
                    <div className={`lumiverse-workshop-create-card ${customPacks.length > 1 ? 'lumiverse-workshop-create-card--has-dropdown' : ''}`}>
                        <div className="lumiverse-workshop-create-card-icon">
                            <Wrench size={16} strokeWidth={1.5} />
                        </div>
                        <div className="lumiverse-workshop-create-card-body">
                            <div className="lumiverse-workshop-create-card-label">New Tool</div>
                            <div className="lumiverse-workshop-create-card-desc">Council tool definition</div>
                        </div>
                        <button
                            className="lumiverse-workshop-create-card-action"
                            type="button"
                            onClick={handleCreateTool}
                        >
                            <Plus size={13} /> Create
                        </button>
                        {customPacks.length > 1 && (
                            <PackDropdown
                                value={effectiveToolPackName}
                                onChange={setToolPackName}
                                placeholder="Pick a pack..."
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Section B: My Packs */}
            <div className="lumiverse-workshop-section">
                <div className="lumiverse-workshop-section-title">
                    <Package size={12} /> My Packs
                </div>
                <div className="lumiverse-workshop-packs">
                    {customPacks.length === 0 && (
                        <div className="lumiverse-workshop-pack-empty">
                            No custom packs yet. Create one to get started.
                        </div>
                    )}
                    {customPacks.map(pack => {
                        const packName = pack.packName || pack.name || '';
                        const lumiaItems = pack.lumiaItems || pack.items || [];
                        const loomItems = pack.loomItems || [];
                        const toolItems = pack.loomTools || [];
                        const isExpanded = expandedPacks[packName] || false;
                        const lumiaCount = lumiaItems.length;
                        const loomCount = loomItems.length;
                        const toolCount = toolItems.length;

                        return (
                            <div key={packName} className="lumiverse-workshop-pack-row">
                                <div
                                    className="lumiverse-workshop-pack-header"
                                    onClick={() => togglePack(packName)}
                                >
                                    <span className={`lumiverse-workshop-pack-chevron ${isExpanded ? 'lumiverse-workshop-pack-chevron--expanded' : ''}`}>
                                        <ChevronRight size={14} />
                                    </span>
                                    <span className="lumiverse-workshop-pack-name">{packName}</span>
                                    <div className="lumiverse-workshop-pack-badges">
                                        {lumiaCount > 0 && (
                                            <span className="lumiverse-workshop-pack-badge lumiverse-workshop-pack-badge--lumia">
                                                {lumiaCount} Lumia
                                            </span>
                                        )}
                                        {loomCount > 0 && (
                                            <span className="lumiverse-workshop-pack-badge lumiverse-workshop-pack-badge--loom">
                                                {loomCount} Loom
                                            </span>
                                        )}
                                        {toolCount > 0 && (
                                            <span className="lumiverse-workshop-pack-badge lumiverse-workshop-pack-badge--tool">
                                                {toolCount} Tool{toolCount !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <>
                                        <div className="lumiverse-workshop-pack-items">
                                            {lumiaItems.map(item => {
                                                const name = getLumiaName(item);
                                                return (
                                                    <div key={`lumia-${name}`} className="lumiverse-workshop-item-row">
                                                        <span className="lumiverse-workshop-item-type lumiverse-workshop-item-type--lumia">Lumia</span>
                                                        <span className="lumiverse-workshop-item-name">{name}</span>
                                                        <button
                                                            className="lumiverse-workshop-item-btn"
                                                            type="button"
                                                            title="Edit"
                                                            onClick={() => handleEditItem(packName, item, 'lumia')}
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                        <button
                                                            className="lumiverse-workshop-item-btn lumiverse-workshop-item-btn--danger"
                                                            type="button"
                                                            title="Delete"
                                                            onClick={() => handleDeleteItem(packName, name, 'lumia')}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                            {loomItems.map(item => {
                                                const name = getLoomName(item);
                                                return (
                                                    <div key={`loom-${name}`} className="lumiverse-workshop-item-row">
                                                        <span className="lumiverse-workshop-item-type lumiverse-workshop-item-type--loom">Loom</span>
                                                        <span className="lumiverse-workshop-item-name">{name}</span>
                                                        <button
                                                            className="lumiverse-workshop-item-btn"
                                                            type="button"
                                                            title="Edit"
                                                            onClick={() => handleEditItem(packName, item, 'loom')}
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                        <button
                                                            className="lumiverse-workshop-item-btn lumiverse-workshop-item-btn--danger"
                                                            type="button"
                                                            title="Delete"
                                                            onClick={() => handleDeleteItem(packName, name, 'loom')}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                            {toolItems.map(item => {
                                                const name = item.displayName || item.toolName || 'Unknown';
                                                return (
                                                    <div key={`tool-${item.toolName}`} className="lumiverse-workshop-item-row">
                                                        <span className="lumiverse-workshop-item-type lumiverse-workshop-item-type--tool">Tool</span>
                                                        <span className="lumiverse-workshop-item-name">{name}</span>
                                                        <button
                                                            className="lumiverse-workshop-item-btn"
                                                            type="button"
                                                            title="Edit"
                                                            onClick={() => handleEditItem(packName, item, 'tool')}
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                        <button
                                                            className="lumiverse-workshop-item-btn lumiverse-workshop-item-btn--danger"
                                                            type="button"
                                                            title="Delete"
                                                            onClick={() => handleDeleteItem(packName, item.toolName, 'tool')}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                            {lumiaCount === 0 && loomCount === 0 && toolCount === 0 && (
                                                <div className="lumiverse-workshop-pack-empty">
                                                    No items yet
                                                </div>
                                            )}
                                        </div>

                                        {/* Pack-level actions */}
                                        <div className="lumiverse-workshop-pack-actions">
                                            <button
                                                className="lumiverse-workshop-pack-action-btn"
                                                type="button"
                                                title="Edit pack metadata"
                                                onClick={() => actions.openModal('packEditor', { packName })}
                                            >
                                                <Pencil size={13} />
                                            </button>
                                            <button
                                                className="lumiverse-workshop-pack-action-btn"
                                                type="button"
                                                title="Export pack"
                                                onClick={() => handleExportPack(pack)}
                                            >
                                                <Download size={13} />
                                            </button>
                                            <div className="lumiverse-workshop-pack-actions-spacer" />
                                            <button
                                                className="lumiverse-workshop-pack-action-btn lumiverse-workshop-pack-action-btn--danger"
                                                type="button"
                                                title="Delete pack"
                                                onClick={() => handleDeletePack(packName)}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}

                    <button
                        className="lumiverse-workshop-new-pack-btn"
                        type="button"
                        onClick={() => actions.openModal('packEditor')}
                    >
                        <Plus size={14} /> New Pack
                    </button>
                </div>
            </div>

            {/* Section C: Import */}
            <div className="lumiverse-workshop-section">
                <div className="lumiverse-workshop-section-title">
                    <Upload size={12} /> Import
                </div>
                <div className="lumiverse-workshop-import">
                    <button
                        className="lumiverse-workshop-import-btn"
                        type="button"
                        onClick={handleImportFile}
                    >
                        <Upload size={14} /> Import Pack JSON
                    </button>
                </div>
            </div>

            {/* Delete confirmation */}
            <ConfirmationModal
                isOpen={!!deleteConfirm}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirm(null)}
                title={
                    deleteConfirm?.type === 'pack'
                        ? `Delete "${deleteConfirm?.packName}"?`
                        : `Delete "${deleteConfirm?.itemName}"?`
                }
                message={
                    deleteConfirm?.type === 'pack'
                        ? 'This will permanently remove the pack and all its items. This cannot be undone.'
                        : 'This will permanently remove this item from the pack. This cannot be undone.'
                }
                variant="danger"
                confirmText="Delete"
            />
        </div>
    );
}

export default ContentWorkshop;
