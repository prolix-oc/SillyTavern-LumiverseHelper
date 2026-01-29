import React, { useState, useEffect, useCallback } from 'react';
import { useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { 
    Box, User, Wrench, Settings, Palette, 
    Check, X, Download, Loader2, RefreshCw 
} from 'lucide-react';

/**
 * Lucid Cards Browser Modal
 * 
 * Fetches and displays available DLC packs from lucid.cards API.
 * Supports:
 * - Category tabs (Lumia DLCs, Utilities, Retrofits, Narratives)
 * - Multi-select for batch import
 * - Skip-existing logic
 * 
 * Replaces the old jQuery showLucidCardsModal()
 */

// Category tabs configuration
const TABS = [
    { id: 'Lumia DLCs', label: 'Lumia DLCs', Icon: User },
    { id: 'Loom Utilities', label: 'Utilities', Icon: Wrench },
    { id: 'Loom Retrofits', label: 'Retrofits', Icon: Settings },
    { id: 'Loom Narratives', label: 'Narratives', Icon: Palette },
];

// Self-contained styles
const styles = {
    layout: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 20px',
        borderBottom: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
    },
    headerIcon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(147, 112, 219, 0.2), rgba(147, 112, 219, 0.1))',
        color: 'var(--lumiverse-primary)',
    },
    headerText: {
        flex: 1,
    },
    title: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 600,
        color: 'var(--lumiverse-text)',
    },
    subtitle: {
        margin: '4px 0 0',
        fontSize: '12px',
        color: 'var(--lumiverse-text-muted)',
    },
    tabs: {
        display: 'flex',
        gap: '2px',
        padding: '0 16px',
        borderBottom: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
        overflowX: 'auto',
    },
    tab: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '12px 14px',
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--lumiverse-text-muted)',
        background: 'transparent',
        border: 'none',
        borderBottom: '2px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap',
    },
    tabActive: {
        color: 'var(--lumiverse-primary)',
        borderBottomColor: 'var(--lumiverse-primary)',
    },
    scrollArea: {
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        padding: '16px',
    },
    loading: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '40px',
        color: 'var(--lumiverse-text-muted)',
    },
    spinner: {
        animation: 'spin 1s linear infinite',
    },
    error: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        padding: '40px',
        textAlign: 'center',
    },
    errorIcon: {
        color: '#f44336',
    },
    errorText: {
        fontSize: '13px',
        color: 'var(--lumiverse-text-muted)',
    },
    retryButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        fontSize: '13px',
        fontWeight: 500,
        background: 'var(--lumiverse-surface)',
        color: 'var(--lumiverse-text)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '6px',
        cursor: 'pointer',
    },
    empty: {
        textAlign: 'center',
        padding: '40px 20px',
        fontSize: '13px',
        color: 'var(--lumiverse-text-muted)',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '12px',
    },
    card: {
        position: 'relative',
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '10px',
        border: '1px solid var(--lumiverse-border)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    cardSelected: {
        borderColor: 'var(--lumiverse-primary)',
        boxShadow: '0 0 0 1px var(--lumiverse-primary)',
    },
    cardImported: {
        opacity: 0.5,
    },
    cardImage: {
        position: 'relative',
        aspectRatio: '1',
        background: 'rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    cardPlaceholder: {
        color: 'var(--lumiverse-text-muted)',
    },
    cardCheck: {
        position: 'absolute',
        top: '8px',
        right: '8px',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: 'var(--lumiverse-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        opacity: 0,
        transform: 'scale(0.8)',
        transition: 'all 0.2s ease',
    },
    cardCheckVisible: {
        opacity: 1,
        transform: 'scale(1)',
    },
    cardInfo: {
        padding: '10px',
    },
    cardTitle: {
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--lumiverse-text)',
        marginBottom: '2px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    cardAuthor: {
        fontSize: '10px',
        color: 'var(--lumiverse-text-muted)',
        marginBottom: '4px',
    },
    cardCounts: {
        fontSize: '10px',
        color: 'var(--lumiverse-primary)',
    },
    footer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 16px',
        borderTop: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
    },
    footerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    footerButton: {
        padding: '6px 12px',
        fontSize: '12px',
        fontWeight: 500,
        background: 'transparent',
        color: 'var(--lumiverse-text-muted)',
        border: 'none',
        cursor: 'pointer',
        transition: 'color 0.2s ease',
    },
    footerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    selectedCount: {
        fontSize: '12px',
        color: 'var(--lumiverse-text-muted)',
    },
    button: {
        padding: '10px 16px',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    buttonSecondary: {
        background: 'var(--lumiverse-surface)',
        color: 'var(--lumiverse-text)',
        border: '1px solid var(--lumiverse-border)',
    },
    buttonPrimary: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'var(--lumiverse-primary)',
        color: 'white',
    },
    buttonDisabled: {
        opacity: 0.5,
        cursor: 'not-allowed',
    },
};

function LucidCardsModal({ onClose }) {
    const actions = useLumiverseActions();
    
    // State
    const [activeTab, setActiveTab] = useState('Lumia DLCs');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [packs, setPacks] = useState([]);
    const [selectedPacks, setSelectedPacks] = useState([]);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
    
    // Fetch packs from API
    const fetchPacks = useCallback(async () => {
        setLoading(true);
        setError(null);
        setSelectedPacks([]);
        
        try {
            const response = await fetch('https://lucid.cards/api/lumia-dlc');
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const data = await response.json();
            setPacks(data.packs || []);
        } catch (err) {
            console.error('[LucidCardsModal] Fetch error:', err);
            setError(err.message || 'Failed to load content');
        } finally {
            setLoading(false);
        }
    }, []);
    
    // Initial fetch
    useEffect(() => {
        fetchPacks();
    }, [fetchPacks]);
    
    // Filter packs by current tab
    const filteredPacks = packs.filter(pack => {
        if (activeTab === 'Lumia DLCs') {
            return pack.packType === 'lumia' || (pack.lumiaCount && pack.lumiaCount > 0);
        }
        // All loom categories show loom-type packs
        return pack.packType === 'loom' || (pack.loomCount && pack.loomCount > 0);
    });
    
    // Toggle pack selection
    const toggleSelection = useCallback((pack) => {
        const slug = pack.slug;
        setSelectedPacks(prev => {
            const exists = prev.find(p => p.slug === slug);
            if (exists) {
                return prev.filter(p => p.slug !== slug);
            }
            return [...prev, pack];
        });
    }, []);
    
    // Select all visible packs
    const selectAll = useCallback(() => {
        setSelectedPacks(filteredPacks);
    }, [filteredPacks]);
    
    // Clear selection
    const clearSelection = useCallback(() => {
        setSelectedPacks([]);
    }, []);
    
    // Check if pack is selected
    const isSelected = useCallback((pack) => {
        return selectedPacks.some(p => p.slug === pack.slug);
    }, [selectedPacks]);
    
    // Import selected packs
    const handleImport = useCallback(async () => {
        if (selectedPacks.length === 0 || importing) return;
        
        setImporting(true);
        const total = selectedPacks.length;
        let imported = 0;
        let skipped = 0;
        let failed = 0;
        
        // Get current packs from store to check for duplicates
        const currentPacks = window.LumiverseBridge?.getSettings?.()?.packs || {};
        
        for (let i = 0; i < selectedPacks.length; i++) {
            const pack = selectedPacks[i];
            setImportProgress({ current: i + 1, total });
            
            // Check if pack already exists
            if (currentPacks[pack.packName]) {
                skipped++;
                continue;
            }
            
            try {
                const response = await fetch(`https://lucid.cards/api/lumia-dlc/${pack.slug}`);
                if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
                
                const data = await response.json();
                
                if (data.success === false) {
                    throw new Error(data.error || 'Failed to fetch pack');
                }
                
                // Extract the pack data
                const packData = data.pack || data;
                
                // Import via actions
                actions.addPack(packData);
                imported++;
            } catch (err) {
                console.error(`[LucidCardsModal] Import failed for "${pack.packName}":`, err);
                failed++;
            }
        }
        
        // Save to extension
        saveToExtension();
        
        // Show summary toast
        const parts = [];
        if (imported > 0) parts.push(`${imported} imported`);
        if (skipped > 0) parts.push(`${skipped} skipped (already exist)`);
        if (failed > 0) parts.push(`${failed} failed`);
        
        if (window.toastr) {
            if (imported > 0) {
                window.toastr.success(`Import complete: ${parts.join(', ')}`);
            } else if (skipped > 0 && failed === 0) {
                window.toastr.info(`All ${skipped} packs already exist`);
            } else {
                window.toastr.error(`Import failed: ${parts.join(', ')}`);
            }
        }
        
        setImporting(false);
        setSelectedPacks([]);
        setImportProgress({ current: 0, total: 0 });
    }, [selectedPacks, importing, actions]);

    return (
        <div style={styles.layout}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerIcon}>
                    <Box size={20} strokeWidth={1.5} />
                </div>
                <div style={styles.headerText}>
                    <h3 style={styles.title}>Lucid Cards Browser</h3>
                    <p style={styles.subtitle}>Browse and import official Lumiverse content</p>
                </div>
            </div>

            {/* Tabs */}
            <div style={styles.tabs}>
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        style={{
                            ...styles.tab,
                            ...(activeTab === tab.id ? styles.tabActive : {}),
                        }}
                        onClick={() => {
                            setActiveTab(tab.id);
                            setSelectedPacks([]);
                        }}
                    >
                        <tab.Icon size={14} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={styles.scrollArea}>
                {loading ? (
                    <div style={styles.loading}>
                        <Loader2 size={24} style={styles.spinner} />
                        <span>Loading content from Lucid.cards...</span>
                    </div>
                ) : error ? (
                    <div style={styles.error}>
                        <X size={32} style={styles.errorIcon} />
                        <span style={styles.errorText}>{error}</span>
                        <button 
                            type="button"
                            style={styles.retryButton} 
                            onClick={fetchPacks}
                        >
                            <RefreshCw size={14} />
                            <span>Retry</span>
                        </button>
                    </div>
                ) : filteredPacks.length === 0 ? (
                    <div style={styles.empty}>
                        No items available in this category.
                    </div>
                ) : (
                    <div style={styles.grid}>
                        {filteredPacks.map((pack) => {
                            const selected = isSelected(pack);
                            const counts = [];
                            if (pack.lumiaCount > 0) counts.push(`${pack.lumiaCount} Lumia`);
                            if (pack.loomCount > 0) counts.push(`${pack.loomCount} Loom`);
                            if (pack.extrasCount > 0) counts.push(`${pack.extrasCount} Extra`);
                            
                            return (
                                <div
                                    key={pack.slug}
                                    style={{
                                        ...styles.card,
                                        ...(selected ? styles.cardSelected : {}),
                                    }}
                                    onClick={() => toggleSelection(pack)}
                                >
                                    <div style={styles.cardImage}>
                                        {pack.coverUrl ? (
                                            <img
                                                src={pack.coverUrl}
                                                alt=""
                                                style={styles.cardImg}
                                                loading="lazy"
                                            />
                                        ) : (
                                            <Box size={32} style={styles.cardPlaceholder} />
                                        )}
                                        <div style={{
                                            ...styles.cardCheck,
                                            ...(selected ? styles.cardCheckVisible : {}),
                                        }}>
                                            <Check size={14} />
                                        </div>
                                    </div>
                                    <div style={styles.cardInfo}>
                                        <div style={styles.cardTitle}>{pack.packName || 'Unknown'}</div>
                                        <div style={styles.cardAuthor}>{pack.packAuthor || 'Unknown Author'}</div>
                                        {counts.length > 0 && (
                                            <div style={styles.cardCounts}>{counts.join(', ')}</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={styles.footer}>
                <button
                    type="button"
                    style={{ ...styles.button, ...styles.buttonSecondary }}
                    onClick={onClose}
                >
                    Close
                </button>
                
                <div style={styles.footerRight}>
                    {selectedPacks.length > 0 && (
                        <>
                            <div style={styles.footerLeft}>
                                <button
                                    type="button"
                                    style={styles.footerButton}
                                    onClick={selectAll}
                                >
                                    Select All
                                </button>
                                <button
                                    type="button"
                                    style={styles.footerButton}
                                    onClick={clearSelection}
                                >
                                    Clear
                                </button>
                            </div>
                            <span style={styles.selectedCount}>
                                {selectedPacks.length} selected
                            </span>
                        </>
                    )}
                    
                    {selectedPacks.length > 0 && (
                        <button
                            type="button"
                            style={{
                                ...styles.button,
                                ...styles.buttonPrimary,
                                ...(importing ? styles.buttonDisabled : {}),
                            }}
                            onClick={handleImport}
                            disabled={importing}
                        >
                            {importing ? (
                                <>
                                    <Loader2 size={14} style={styles.spinner} />
                                    <span>Importing {importProgress.current} of {importProgress.total}...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={14} />
                                    <span>
                                        Import {selectedPacks.length === 1 ? 'Pack' : `${selectedPacks.length} Packs`}
                                    </span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
            
            {/* Keyframe for spinner */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default LucidCardsModal;
