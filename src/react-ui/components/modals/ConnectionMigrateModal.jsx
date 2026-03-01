/**
 * ConnectionMigrateModal — Import ST Connection Manager profiles into Lumiverse
 *
 * Detects existing ST connection profiles, lets the user select which ones to import,
 * and migrates them using the connection service.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Download, Check, X, Loader2, AlertTriangle, Plug } from 'lucide-react';
import { useConnectionManager } from '../../hooks/useConnectionManager';

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '70vh',
        color: 'var(--lumiverse-text)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '16px 20px',
        borderBottom: '1px solid var(--lumiverse-border)',
    },
    headerIcon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.1))',
    },
    headerText: {
        flex: 1,
    },
    headerTitle: {
        fontSize: '15px',
        fontWeight: 600,
    },
    headerSub: {
        fontSize: '12px',
        opacity: 0.6,
        marginTop: '2px',
    },
    body: {
        flex: '1 1 auto',
        overflowY: 'auto',
        padding: '16px 20px',
    },
    loading: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '40px',
        fontSize: '13px',
        opacity: 0.6,
    },
    empty: {
        textAlign: 'center',
        padding: '40px 20px',
        fontSize: '13px',
        opacity: 0.5,
    },
    profileRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        marginBottom: '6px',
        borderRadius: '8px',
        border: '1px solid var(--lumiverse-border)',
        background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.1))',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
    },
    profileRowSelected: {
        borderColor: 'var(--lumiverse-primary)',
    },
    checkbox: {
        width: '18px',
        height: '18px',
        borderRadius: '4px',
        border: '2px solid var(--lumiverse-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'background 0.15s, border-color 0.15s',
    },
    checkboxChecked: {
        background: 'var(--lumiverse-primary)',
        borderColor: 'var(--lumiverse-primary)',
    },
    profileInfo: {
        flex: 1,
        minWidth: 0,
    },
    profileName: {
        fontSize: '13px',
        fontWeight: 600,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    profileMeta: {
        fontSize: '11px',
        opacity: 0.6,
        marginTop: '2px',
    },
    importedBadge: {
        fontSize: '10px',
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: '4px',
        background: 'var(--lumiverse-success, #22c55e)',
        color: '#fff',
    },
    footer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 20px',
        borderTop: '1px solid var(--lumiverse-border)',
    },
    footerCount: {
        flex: 1,
        fontSize: '12px',
        opacity: 0.6,
    },
    btn: {
        padding: '8px 16px',
        borderRadius: '6px',
        border: '1px solid var(--lumiverse-border)',
        background: 'transparent',
        color: 'var(--lumiverse-text)',
        fontSize: '13px',
        cursor: 'pointer',
    },
    btnPrimary: {
        padding: '8px 16px',
        borderRadius: '6px',
        border: 'none',
        background: 'var(--lumiverse-primary)',
        color: '#fff',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
    },
    summary: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px',
        borderRadius: '8px',
        background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.1))',
        marginTop: '12px',
        fontSize: '13px',
    },
};

export default function ConnectionMigrateModal({ onClose }) {
    const { migrateSTProfile, refreshRegistry } = useConnectionManager();

    const [stProfiles, setSTProfiles] = useState(null);
    const [selected, setSelected] = useState(new Set());
    const [importing, setImporting] = useState(false);
    const [imported, setImported] = useState(new Set());
    const [failed, setFailed] = useState([]);

    // Detect ST profiles on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { detectSTProfiles } = await import('../../../lib/connectionService');
            const profiles = await detectSTProfiles();
            if (!cancelled) {
                setSTProfiles(profiles);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const toggleSelect = useCallback((idx) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        if (stProfiles) {
            if (selected.size === stProfiles.length) {
                setSelected(new Set());
            } else {
                setSelected(new Set(stProfiles.map((_, i) => i)));
            }
        }
    }, [stProfiles, selected]);

    const handleImport = useCallback(async () => {
        if (!stProfiles || selected.size === 0) return;
        setImporting(true);
        const newImported = new Set(imported);
        const newFailed = [...failed];

        for (const idx of selected) {
            try {
                await migrateSTProfile(stProfiles[idx]);
                newImported.add(idx);
            } catch (err) {
                console.warn('[ConnectionMigrate] Failed to import:', err);
                newFailed.push(stProfiles[idx].stName);
            }
        }

        setImported(newImported);
        setFailed(newFailed);
        setImporting(false);
        setSelected(new Set());
        refreshRegistry();
    }, [stProfiles, selected, imported, failed, migrateSTProfile, refreshRegistry]);

    const isLoading = stProfiles === null;
    const hasProfiles = stProfiles && stProfiles.length > 0;
    const allDone = imported.size > 0 && selected.size === 0;

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerIcon}>
                    <Download size={18} />
                </div>
                <div style={styles.headerText}>
                    <div style={styles.headerTitle}>Import from SillyTavern</div>
                    <div style={styles.headerSub}>
                        Import existing ST Connection Manager profiles
                    </div>
                </div>
                <button
                    style={{ ...styles.btn, padding: '4px 8px' }}
                    onClick={onClose}
                >
                    <X size={16} />
                </button>
            </div>

            {/* Body */}
            <div style={styles.body}>
                {isLoading && (
                    <div style={styles.loading}>
                        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                        Scanning for ST profiles...
                    </div>
                )}

                {!isLoading && !hasProfiles && (
                    <div style={styles.empty}>
                        <Plug size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                        <div>No SillyTavern connection profiles found.</div>
                        <div style={{ marginTop: '6px', fontSize: '11px' }}>
                            Create profiles in ST&apos;s Connection Manager first, then import them here.
                        </div>
                    </div>
                )}

                {hasProfiles && stProfiles.map((p, idx) => {
                    const isSelected = selected.has(idx);
                    const isImported = imported.has(idx);
                    return (
                        <div
                            key={idx}
                            style={{
                                ...styles.profileRow,
                                ...(isSelected ? styles.profileRowSelected : {}),
                                ...(isImported ? { opacity: 0.5 } : {}),
                            }}
                            onClick={() => !isImported && toggleSelect(idx)}
                        >
                            <div style={{
                                ...styles.checkbox,
                                ...(isSelected ? styles.checkboxChecked : {}),
                            }}>
                                {isSelected && <Check size={12} color="#fff" />}
                            </div>
                            <div style={styles.profileInfo}>
                                <div style={styles.profileName}>{p.stName}</div>
                                <div style={styles.profileMeta}>
                                    {p.provider || 'Unknown'}{p.model ? ` \u00B7 ${p.model}` : ''}
                                </div>
                            </div>
                            {isImported && <span style={styles.importedBadge}>Imported</span>}
                        </div>
                    );
                })}

                {failed.length > 0 && (
                    <div style={{ ...styles.summary, color: 'var(--lumiverse-danger, #ef4444)' }}>
                        <AlertTriangle size={16} />
                        Failed to import: {failed.join(', ')}
                    </div>
                )}

                {allDone && failed.length === 0 && (
                    <div style={{ ...styles.summary, color: 'var(--lumiverse-success, #22c55e)' }}>
                        <Check size={16} />
                        {imported.size} profile{imported.size !== 1 ? 's' : ''} imported successfully.
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={styles.footer}>
                <span style={styles.footerCount}>
                    {hasProfiles
                        ? `${selected.size} of ${stProfiles.length} selected`
                        : ''
                    }
                </span>
                {hasProfiles && (
                    <button style={styles.btn} onClick={selectAll}>
                        {selected.size === stProfiles.length ? 'Deselect All' : 'Select All'}
                    </button>
                )}
                <button
                    style={{
                        ...styles.btnPrimary,
                        ...(selected.size === 0 || importing ? { opacity: 0.5, pointerEvents: 'none' } : {}),
                    }}
                    onClick={handleImport}
                    disabled={selected.size === 0 || importing}
                >
                    {importing ? 'Importing...' : `Import${selected.size > 0 ? ` (${selected.size})` : ''}`}
                </button>
            </div>
        </div>
    );
}
