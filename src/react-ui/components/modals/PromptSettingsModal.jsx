import React, { useState, useCallback } from 'react';
import { useLumiverseStore, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { 
    Edit3, Grid3X3, Filter, Info, ChevronDown, ChevronUp 
} from 'lucide-react';

/**
 * Prompt Settings Modal
 * 
 * Configures:
 * - Sovereign Hand features (advanced prompt manipulation)
 * - Context Filters (strip HTML, details blocks, loom tags)
 * 
 * Replaces the old jQuery showPromptSettingsModal()
 */

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
    scrollArea: {
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        padding: '16px 20px',
    },
    section: {
        marginBottom: '16px',
        background: 'rgba(0, 0, 0, 0.15)',
        borderRadius: '10px',
        border: '1px solid var(--lumiverse-border)',
        overflow: 'hidden',
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
    },
    sectionHeaderIcon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        background: 'rgba(147, 112, 219, 0.15)',
        color: 'var(--lumiverse-primary)',
    },
    sectionHeaderText: {
        flex: 1,
        fontSize: '14px',
        fontWeight: 500,
        color: 'var(--lumiverse-text)',
    },
    statusBadge: {
        fontSize: '10px',
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    statusActive: {
        background: 'rgba(76, 175, 80, 0.15)',
        color: '#4caf50',
    },
    statusInactive: {
        background: 'rgba(158, 158, 158, 0.15)',
        color: '#9e9e9e',
    },
    collapseIcon: {
        color: 'var(--lumiverse-text-muted)',
        transition: 'transform 0.2s ease',
    },
    sectionContent: {
        padding: '0 14px 14px',
    },
    description: {
        fontSize: '12px',
        color: 'var(--lumiverse-text-muted)',
        marginBottom: '12px',
        lineHeight: 1.5,
    },
    toggleRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: '1px solid var(--lumiverse-border)',
    },
    toggleRowLast: {
        borderBottom: 'none',
    },
    toggleRowDisabled: {
        opacity: 0.5,
    },
    toggleLabel: {
        flex: 1,
    },
    toggleText: {
        display: 'block',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--lumiverse-text)',
    },
    toggleHint: {
        display: 'block',
        fontSize: '11px',
        color: 'var(--lumiverse-text-muted)',
        marginTop: '2px',
    },
    toggle: {
        position: 'relative',
        width: '44px',
        height: '24px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        flexShrink: 0,
    },
    toggleActive: {
        background: 'var(--lumiverse-primary)',
    },
    toggleThumb: {
        position: 'absolute',
        top: '2px',
        left: '2px',
        width: '20px',
        height: '20px',
        background: 'white',
        borderRadius: '50%',
        transition: 'transform 0.2s ease',
    },
    toggleThumbActive: {
        transform: 'translateX(20px)',
    },
    infoBox: {
        background: 'rgba(147, 112, 219, 0.08)',
        border: '1px solid rgba(147, 112, 219, 0.2)',
        borderRadius: '8px',
        padding: '12px',
        marginTop: '12px',
    },
    infoBoxMuted: {
        opacity: 0.6,
    },
    infoBoxHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--lumiverse-primary)',
        marginBottom: '8px',
    },
    infoBoxList: {
        margin: 0,
        padding: '0 0 0 16px',
        fontSize: '11px',
        color: 'var(--lumiverse-text-muted)',
        lineHeight: 1.6,
    },
    infoBoxCode: {
        fontFamily: 'monospace',
        background: 'rgba(0, 0, 0, 0.2)',
        padding: '1px 4px',
        borderRadius: '3px',
        fontSize: '10px',
    },
    filterItem: {
        marginBottom: '12px',
    },
    filterOptions: {
        marginTop: '10px',
        padding: '10px 12px',
        background: 'rgba(0, 0, 0, 0.1)',
        borderRadius: '6px',
    },
    filterOptionsHidden: {
        display: 'none',
    },
    subFilterItem: {
        marginTop: '10px',
        paddingTop: '10px',
        borderTop: '1px dashed var(--lumiverse-border)',
    },
    field: {
        marginBottom: '8px',
    },
    label: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--lumiverse-text)',
        marginBottom: '6px',
    },
    input: {
        width: '80px',
        padding: '8px 10px',
        fontSize: '13px',
        background: 'var(--lumiverse-input-bg)',
        border: '1px solid var(--lumiverse-border)',
        borderRadius: '6px',
        color: 'var(--lumiverse-text)',
        outline: 'none',
    },
    hint: {
        fontSize: '10px',
        color: 'var(--lumiverse-text-muted)',
        marginTop: '4px',
    },
    footer: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        padding: '12px 20px',
        borderTop: '1px solid var(--lumiverse-border)',
        flexShrink: 0,
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
        background: 'var(--lumiverse-primary)',
        color: 'white',
    },
};

function Toggle({ checked, onChange, disabled }) {
    return (
        <div
            style={{
                ...styles.toggle,
                ...(checked ? styles.toggleActive : {}),
                ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
            }}
            onClick={() => !disabled && onChange(!checked)}
        >
            <div style={{
                ...styles.toggleThumb,
                ...(checked ? styles.toggleThumbActive : {}),
            }} />
        </div>
    );
}

function PromptSettingsModal({ onClose }) {
    const store = useLumiverseStore;
    const actions = useLumiverseActions();
    
    // Get current settings
    const currentSettings = store.getState();
    const sovereignHand = currentSettings.sovereignHand || {};
    const contextFilters = currentSettings.contextFilters || {};
    const htmlTags = contextFilters.htmlTags || {};
    const detailsBlocks = contextFilters.detailsBlocks || {};
    const loomItems = contextFilters.loomItems || {};
    
    // Collapsible state
    const [sovereignExpanded, setSovereignExpanded] = useState(true);
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    
    // Sovereign Hand settings
    const [sovereignEnabled, setSovereignEnabled] = useState(sovereignHand.enabled || false);
    const [excludeLastMessage, setExcludeLastMessage] = useState(sovereignHand.excludeLastMessage !== false);
    const [includeMessageInPrompt, setIncludeMessageInPrompt] = useState(sovereignHand.includeMessageInPrompt !== false);
    
    // Context Filter settings
    const [htmlEnabled, setHtmlEnabled] = useState(htmlTags.enabled || false);
    const [htmlKeepDepth, setHtmlKeepDepth] = useState(htmlTags.keepDepth || 3);
    const [stripFonts, setStripFonts] = useState(htmlTags.stripFonts || false);
    const [fontKeepDepth, setFontKeepDepth] = useState(htmlTags.fontKeepDepth || 3);
    
    const [detailsEnabled, setDetailsEnabled] = useState(detailsBlocks.enabled || false);
    const [detailsKeepDepth, setDetailsKeepDepth] = useState(detailsBlocks.keepDepth || 3);
    
    const [loomEnabled, setLoomEnabled] = useState(loomItems.enabled || false);
    const [loomKeepDepth, setLoomKeepDepth] = useState(loomItems.keepDepth || 5);

    const handleSave = useCallback(() => {
        const newSettings = {
            sovereignHand: {
                enabled: sovereignEnabled,
                excludeLastMessage,
                includeMessageInPrompt,
            },
            contextFilters: {
                htmlTags: {
                    enabled: htmlEnabled,
                    keepDepth: parseInt(htmlKeepDepth, 10) || 3,
                    stripFonts,
                    fontKeepDepth: parseInt(fontKeepDepth, 10) || 3,
                },
                detailsBlocks: {
                    enabled: detailsEnabled,
                    keepDepth: parseInt(detailsKeepDepth, 10) || 3,
                },
                loomItems: {
                    enabled: loomEnabled,
                    keepDepth: parseInt(loomKeepDepth, 10) || 5,
                },
            },
        };
        
        actions.setSettings(newSettings);
        saveToExtension();
        
        if (window.toastr) {
            window.toastr.success('Prompt settings saved!');
        }
        
        onClose();
    }, [
        sovereignEnabled, excludeLastMessage, includeMessageInPrompt,
        htmlEnabled, htmlKeepDepth, stripFonts, fontKeepDepth,
        detailsEnabled, detailsKeepDepth,
        loomEnabled, loomKeepDepth,
        actions, onClose
    ]);

    const hasActiveFilters = htmlEnabled || detailsEnabled || loomEnabled;

    return (
        <div style={styles.layout}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerIcon}>
                    <Edit3 size={20} strokeWidth={1.5} />
                </div>
                <div style={styles.headerText}>
                    <h3 style={styles.title}>Prompt Settings</h3>
                    <p style={styles.subtitle}>Configure advanced prompt features</p>
                </div>
            </div>

            {/* Scrollable Content */}
            <div style={styles.scrollArea}>
                {/* Sovereign Hand Section */}
                <div style={styles.section}>
                    <div 
                        style={styles.sectionHeader}
                        onClick={() => setSovereignExpanded(!sovereignExpanded)}
                    >
                        <div style={styles.sectionHeaderIcon}>
                            <Grid3X3 size={16} strokeWidth={1.5} />
                        </div>
                        <span style={styles.sectionHeaderText}>Sovereign Hand</span>
                        <span style={{
                            ...styles.statusBadge,
                            ...(sovereignEnabled ? styles.statusActive : styles.statusInactive),
                        }}>
                            {sovereignEnabled ? 'Active' : 'Inactive'}
                        </span>
                        {sovereignExpanded ? (
                            <ChevronUp size={16} style={styles.collapseIcon} />
                        ) : (
                            <ChevronDown size={16} style={styles.collapseIcon} />
                        )}
                    </div>
                    
                    {sovereignExpanded && (
                        <div style={styles.sectionContent}>
                            <p style={styles.description}>
                                Enable Sovereign Hand integration to use advanced prompt manipulation features.
                            </p>
                            
                            <div style={styles.toggleRow}>
                                <div style={styles.toggleLabel}>
                                    <span style={styles.toggleText}>Use Sovereign Hand Features</span>
                                    <span style={styles.toggleHint}>Enables Sovereign Hand macros for advanced prompt control</span>
                                </div>
                                <Toggle
                                    checked={sovereignEnabled}
                                    onChange={setSovereignEnabled}
                                />
                            </div>
                            
                            <div style={{
                                ...styles.toggleRow,
                                ...(sovereignEnabled ? {} : styles.toggleRowDisabled),
                            }}>
                                <div style={styles.toggleLabel}>
                                    <span style={styles.toggleText}>Exclude Last Message from Context</span>
                                    <span style={styles.toggleHint}>When enabled, removes the last user message from the outgoing context</span>
                                </div>
                                <Toggle
                                    checked={excludeLastMessage}
                                    onChange={setExcludeLastMessage}
                                    disabled={!sovereignEnabled}
                                />
                            </div>
                            
                            <div style={{
                                ...styles.toggleRow,
                                ...styles.toggleRowLast,
                                ...(sovereignEnabled ? {} : styles.toggleRowDisabled),
                            }}>
                                <div style={styles.toggleLabel}>
                                    <span style={styles.toggleText}>Include Message in Master Prompt</span>
                                    <span style={styles.toggleHint}>When enabled, includes the user message in the {'{{loomSovHand}}'} macro output</span>
                                </div>
                                <Toggle
                                    checked={includeMessageInPrompt}
                                    onChange={setIncludeMessageInPrompt}
                                    disabled={!sovereignEnabled}
                                />
                            </div>
                            
                            <div style={{
                                ...styles.infoBox,
                                ...(sovereignEnabled ? {} : styles.infoBoxMuted),
                            }}>
                                <div style={styles.infoBoxHeader}>
                                    <Info size={14} />
                                    <span>Available macros:</span>
                                </div>
                                <ul style={styles.infoBoxList}>
                                    <li><code style={styles.infoBoxCode}>{'{{loomLastUserMessage}}'}</code> returns the last user message content</li>
                                    <li><code style={styles.infoBoxCode}>{'{{loomLastCharMessage}}'}</code> returns the last character message content</li>
                                    <li><code style={styles.infoBoxCode}>{'{{lastMessageName}}'}</code> returns the name of whoever sent the last message</li>
                                    <li><code style={styles.infoBoxCode}>{'{{loomContinuePrompt}}'}</code> adds continuation instructions when character spoke last</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Context Filters Section */}
                <div style={styles.section}>
                    <div 
                        style={styles.sectionHeader}
                        onClick={() => setFiltersExpanded(!filtersExpanded)}
                    >
                        <div style={styles.sectionHeaderIcon}>
                            <Filter size={16} strokeWidth={1.5} />
                        </div>
                        <span style={styles.sectionHeaderText}>Context Filters</span>
                        <span style={{
                            ...styles.statusBadge,
                            ...(hasActiveFilters ? styles.statusActive : styles.statusInactive),
                        }}>
                            {hasActiveFilters ? 'Active' : 'Inactive'}
                        </span>
                        {filtersExpanded ? (
                            <ChevronUp size={16} style={styles.collapseIcon} />
                        ) : (
                            <ChevronDown size={16} style={styles.collapseIcon} />
                        )}
                    </div>
                    
                    {filtersExpanded && (
                        <div style={styles.sectionContent}>
                            <p style={styles.description}>
                                Filter out specific content from the chat context before sending to the AI. 
                                Helps reduce token usage and keep prompts clean.
                            </p>
                            
                            {/* HTML Tags Filter */}
                            <div style={styles.filterItem}>
                                <div style={styles.toggleRow}>
                                    <div style={styles.toggleLabel}>
                                        <span style={styles.toggleText}>Strip HTML Tags</span>
                                        <span style={styles.toggleHint}>Removes formatting tags: &lt;div&gt;, &lt;span&gt;, &lt;b&gt;, &lt;i&gt;, &lt;u&gt;, &lt;em&gt;, &lt;strong&gt;</span>
                                    </div>
                                    <Toggle
                                        checked={htmlEnabled}
                                        onChange={setHtmlEnabled}
                                    />
                                </div>
                                
                                {htmlEnabled && (
                                    <div style={styles.filterOptions}>
                                        <div style={styles.field}>
                                            <label style={styles.label}>
                                                <span>Keep HTML in last N messages:</span>
                                                <input
                                                    type="number"
                                                    style={styles.input}
                                                    min="0"
                                                    max="100"
                                                    value={htmlKeepDepth}
                                                    onChange={(e) => setHtmlKeepDepth(e.target.value)}
                                                />
                                            </label>
                                            <div style={styles.hint}>HTML tags in older messages will be stripped to save tokens</div>
                                        </div>
                                        
                                        {/* Strip Fonts Sub-toggle */}
                                        <div style={styles.subFilterItem}>
                                            <div style={styles.toggleRow}>
                                                <div style={styles.toggleLabel}>
                                                    <span style={styles.toggleText}>Also Strip Fonts</span>
                                                    <span style={styles.toggleHint}>Remove &lt;font&gt; tags (used by some presets for colored dialogue)</span>
                                                </div>
                                                <Toggle
                                                    checked={stripFonts}
                                                    onChange={setStripFonts}
                                                />
                                            </div>
                                            
                                            {stripFonts && (
                                                <div style={{ marginTop: '8px' }}>
                                                    <label style={styles.label}>
                                                        <span>Keep fonts in last N messages:</span>
                                                        <input
                                                            type="number"
                                                            style={styles.input}
                                                            min="0"
                                                            max="100"
                                                            value={fontKeepDepth}
                                                            onChange={(e) => setFontKeepDepth(e.target.value)}
                                                        />
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Details Blocks Filter */}
                            <div style={styles.filterItem}>
                                <div style={styles.toggleRow}>
                                    <div style={styles.toggleLabel}>
                                        <span style={styles.toggleText}>Filter Details Blocks</span>
                                        <span style={styles.toggleHint}>Removes &lt;details&gt; blocks from older messages to save context</span>
                                    </div>
                                    <Toggle
                                        checked={detailsEnabled}
                                        onChange={setDetailsEnabled}
                                    />
                                </div>
                                
                                {detailsEnabled && (
                                    <div style={styles.filterOptions}>
                                        <div style={styles.field}>
                                            <label style={styles.label}>
                                                <span>Keep in last N messages:</span>
                                                <input
                                                    type="number"
                                                    style={styles.input}
                                                    min="0"
                                                    max="100"
                                                    value={detailsKeepDepth}
                                                    onChange={(e) => setDetailsKeepDepth(e.target.value)}
                                                />
                                            </label>
                                            <div style={styles.hint}>Messages beyond this depth will have &lt;details&gt; blocks removed</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Loom Items Filter */}
                            <div style={styles.filterItem}>
                                <div style={{ ...styles.toggleRow, ...styles.toggleRowLast }}>
                                    <div style={styles.toggleLabel}>
                                        <span style={styles.toggleText}>Filter Loom Tags</span>
                                        <span style={styles.toggleHint}>Removes Lucid Loom-related tags from older messages</span>
                                    </div>
                                    <Toggle
                                        checked={loomEnabled}
                                        onChange={setLoomEnabled}
                                    />
                                </div>
                                
                                {loomEnabled && (
                                    <div style={styles.filterOptions}>
                                        <div style={styles.field}>
                                            <label style={styles.label}>
                                                <span>Keep in last N messages:</span>
                                                <input
                                                    type="number"
                                                    style={styles.input}
                                                    min="0"
                                                    max="100"
                                                    value={loomKeepDepth}
                                                    onChange={(e) => setLoomKeepDepth(e.target.value)}
                                                />
                                            </label>
                                            <div style={styles.hint}>Loom tags in older messages will be stripped to save tokens</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div style={styles.footer}>
                <button
                    type="button"
                    style={{ ...styles.button, ...styles.buttonSecondary }}
                    onClick={onClose}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    style={{ ...styles.button, ...styles.buttonPrimary }}
                    onClick={handleSave}
                >
                    Save Changes
                </button>
            </div>
        </div>
    );
}

export default PromptSettingsModal;
