/**
 * ImportUrlModal — Modal for importing characters from external URLs/UUIDs.
 *
 * Supports Chub, JanitorAI, Pygmalion, AICharacterCards, RisuRealm,
 * Perchance, and direct PNG URLs.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Globe, X, Loader2, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import { importFromExternalUrls } from '../../../lib/characterBrowserService';

const SUPPORTED_SOURCES = [
    'Chub.ai (chub.ai/characters/...)',
    'JanitorAI (janitorai.com/characters/...)',
    'Pygmalion (pygmalion.chat/...)',
    'AICharacterCards (aicharactercards.com/...)',
    'RisuRealm (realm.risuai.net/...)',
    'Perchance (perchance.org/...)',
    'Direct PNG URL (any .png character card)',
];

/** Inline styles using var(--lumiverse-*) */
const S = {
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '16px 20px',
        borderBottom: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
    },
    headerIcon: {
        color: 'var(--lumiverse-primary, #9370db)',
        flexShrink: 0,
    },
    headerTitle: {
        flex: 1,
        fontSize: '15px',
        fontWeight: 600,
        color: 'var(--lumiverse-text, #e0e0e0)',
    },
    closeBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        border: 'none',
        borderRadius: '6px',
        background: 'transparent',
        color: 'var(--lumiverse-text-muted, rgba(255,255,255,0.5))',
        cursor: 'pointer',
    },
    body: {
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        overflowY: 'auto',
        flex: 1,
    },
    description: {
        fontSize: '12px',
        color: 'var(--lumiverse-text-muted, rgba(255,255,255,0.5))',
        lineHeight: 1.5,
    },
    textarea: {
        width: '100%',
        minHeight: '120px',
        padding: '10px 12px',
        borderRadius: '8px',
        border: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
        background: 'var(--lumiverse-fill-subtle, rgba(0,0,0,0.15))',
        color: 'var(--lumiverse-text, #e0e0e0)',
        fontSize: '12px',
        fontFamily: 'monospace',
        resize: 'vertical',
        outline: 'none',
    },
    details: {
        fontSize: '11px',
        color: 'var(--lumiverse-text-dim, rgba(255,255,255,0.35))',
    },
    summary: {
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        color: 'var(--lumiverse-text-muted, rgba(255,255,255,0.5))',
        userSelect: 'none',
    },
    sourceList: {
        margin: '6px 0 0 6px',
        padding: 0,
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
    },
    sourceItem: {
        fontSize: '11px',
        color: 'var(--lumiverse-text-dim, rgba(255,255,255,0.35))',
        paddingLeft: '8px',
        borderLeft: '2px solid var(--lumiverse-border, rgba(255,255,255,0.06))',
    },
    resultsArea: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        maxHeight: '160px',
        overflowY: 'auto',
    },
    resultRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        borderRadius: '6px',
        fontSize: '11px',
        fontFamily: 'monospace',
    },
    resultSuccess: {
        background: 'rgba(34,197,94,0.08)',
        color: 'var(--lumiverse-success, #22c55e)',
    },
    resultError: {
        background: 'rgba(239,68,68,0.08)',
        color: 'var(--lumiverse-danger, #ef4444)',
    },
    resultText: {
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    footer: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        padding: '12px 20px',
        borderTop: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
    },
    btn: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '7px 16px',
        borderRadius: '8px',
        border: '1px solid var(--lumiverse-border, rgba(255,255,255,0.08))',
        background: 'transparent',
        color: 'var(--lumiverse-text-muted, rgba(255,255,255,0.5))',
        fontSize: '12px',
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
    },
    btnPrimary: {
        background: 'var(--lumiverse-primary, #9370db)',
        color: '#fff',
        border: '1px solid transparent',
    },
    btnDisabled: {
        opacity: 0.5,
        cursor: 'not-allowed',
    },
};

export default function ImportUrlModal({ onClose }) {
    const [text, setText] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [results, setResults] = useState(null);
    const textareaRef = useRef(null);

    const lineCount = text.split('\n').filter((l) => l.trim()).length;
    const canImport = lineCount > 0 && !isImporting;

    const handleImport = useCallback(async () => {
        if (!canImport) return;
        setIsImporting(true);
        setResults(null);
        try {
            const res = await importFromExternalUrls(text);
            setResults(res);
            // If all succeeded, clear the textarea
            if (res.every((r) => r.success)) {
                setText('');
            }
        } catch (err) {
            setResults([{ input: '(all)', success: false, error: err?.message || 'Import failed' }]);
        } finally {
            setIsImporting(false);
        }
    }, [text, canImport]);

    return (
        <>
            {/* Header */}
            <div style={S.header}>
                <Globe size={18} strokeWidth={1.5} style={S.headerIcon} />
                <span style={S.headerTitle}>Import from URL</span>
                <button style={S.closeBtn} onClick={onClose} type="button" title="Close">
                    <X size={16} strokeWidth={2} />
                </button>
            </div>

            {/* Body */}
            <div style={S.body}>
                <p style={S.description}>
                    Paste one or more character URLs or UUIDs, one per line.
                    Supported sources include Chub, JanitorAI, Pygmalion, and direct PNG links.
                </p>

                <textarea
                    ref={textareaRef}
                    style={S.textarea}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={'https://chub.ai/characters/...\nhttps://janitorai.com/characters/...\nor a direct .png URL'}
                    disabled={isImporting}
                    autoFocus
                />

                <details style={S.details}>
                    <summary style={S.summary}>
                        <ChevronDown size={12} strokeWidth={2} />
                        Supported sources
                    </summary>
                    <ul style={S.sourceList}>
                        {SUPPORTED_SOURCES.map((src) => (
                            <li key={src} style={S.sourceItem}>{src}</li>
                        ))}
                    </ul>
                </details>

                {/* Results */}
                {results && results.length > 0 && (
                    <div style={S.resultsArea}>
                        {results.map((r, i) => (
                            <div
                                key={i}
                                style={{
                                    ...S.resultRow,
                                    ...(r.success ? S.resultSuccess : S.resultError),
                                }}
                            >
                                {r.success ? (
                                    <CheckCircle size={14} strokeWidth={2} />
                                ) : (
                                    <XCircle size={14} strokeWidth={2} />
                                )}
                                <span style={S.resultText} title={r.input}>{r.input}</span>
                                {!r.success && r.error && (
                                    <span style={{ fontSize: '10px', opacity: 0.7 }}>{r.error}</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={S.footer}>
                <button style={S.btn} onClick={onClose} type="button">
                    Cancel
                </button>
                <button
                    style={{
                        ...S.btn,
                        ...S.btnPrimary,
                        ...(!canImport ? S.btnDisabled : {}),
                    }}
                    onClick={handleImport}
                    disabled={!canImport}
                    type="button"
                >
                    {isImporting && <Loader2 size={14} strokeWidth={2} className="lumiverse-cb-spinner" />}
                    {isImporting ? 'Importing...' : `Import${lineCount > 1 ? ` (${lineCount})` : ''}`}
                </button>
            </div>
        </>
    );
}
