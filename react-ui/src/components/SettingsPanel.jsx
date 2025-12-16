import React, { useState, useMemo, useCallback, useSyncExternalStore } from 'react';
import { useSettings, useSelections, useLoomSelections, useLumiverseActions, usePacks, saveToExtension, useLumiverseStore } from '../store/LumiverseContext';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';

/* global LumiverseBridge, toastr */

// Get the store for direct access
const store = useLumiverseStore;

/**
 * SVG Icons - matching the old HTML design exactly
 */
const Icons = {
    book: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
    ),
    settings: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
    ),
    layers: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
        </svg>
    ),
    tools: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
    ),
    terminal: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
    ),
    upload: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
    ),
    box: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
    ),
    plus: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    ),
    dots: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="19" cy="12" r="1"></circle>
            <circle cx="5" cy="12" r="1"></circle>
        </svg>
    ),
    lines: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="21" y1="10" x2="3" y2="10"></line>
            <line x1="21" y1="6" x2="3" y2="6"></line>
            <line x1="21" y1="14" x2="3" y2="14"></line>
            <line x1="21" y1="18" x2="3" y2="18"></line>
        </svg>
    ),
    edit: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
    ),
    chevronDown: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
    ),
    package: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
    ),
};

/**
 * Panel component - static panel with header (non-collapsible)
 */
function Panel({ title, icon, children }) {
    return (
        <div className="lumia-panel">
            <div className="lumia-panel-header">
                <span className="lumia-panel-icon">{icon}</span>
                <span className="lumia-panel-title">{title}</span>
            </div>
            <div className="lumia-panel-content">
                {children}
            </div>
        </div>
    );
}

/**
 * Collapsible Panel - for macro reference (using details/summary like old design)
 */
function CollapsiblePanel({ title, icon, children }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <details
            className="lumia-panel lumia-panel-collapsible"
            open={isOpen}
            onToggle={(e) => setIsOpen(e.target.open)}
        >
            <summary className="lumia-panel-header lumia-panel-header-clickable">
                <span className="lumia-panel-icon">{icon}</span>
                <span className="lumia-panel-title">{title}</span>
                <span className="lumia-panel-chevron">
                    {Icons.chevronDown}
                </span>
            </summary>
            <div className="lumia-panel-content lumia-macro-reference">
                {children}
            </div>
        </details>
    );
}

/**
 * Selection button that shows current selections and opens a modal
 * Displays all selections as a comma-separated list with ★ prefix for dominant
 */
function SelectionButton({ label, hint, selections, dominant, modalName }) {
    const actions = useLumiverseActions();
    const count = selections?.length || 0;

    // Build display text as comma-separated list with star for dominant
    const displayText = useMemo(() => {
        if (count === 0) return `No ${label.toLowerCase()} selected`;

        // Get dominant item ID for comparison - check multiple possible ID fields
        const dominantId = dominant?.id;
        const dominantName = dominant?.name || dominant?.itemName || dominant?.lumiaDefName;

        // Build list with star prefix for dominant item
        const names = selections.map(item => {
            const name = item?.name || item?.itemName || item?.lumiaDefName || 'Unknown';
            const itemId = item?.id;

            // Match by ID first, fall back to name matching
            const isDominant = dominant && (
                (dominantId && itemId && dominantId === itemId) ||
                (dominantName && name && dominantName === name)
            );

            return isDominant ? `★ ${name}` : name;
        });

        return names.join(', ');
    }, [count, selections, label, dominant]);

    return (
        <div className="lumia-selector">
            <div className="lumia-selector-header">
                <span className="lumia-selector-label">{label}</span>
                <span className="lumia-selector-hint">{hint}</span>
            </div>
            <div className="lumia-selector-row">
                <div className="lumia-selector-value">
                    {displayText}
                </div>
                <button
                    className="lumia-btn lumia-btn-sm"
                    onClick={() => actions.openModal(modalName)}
                    type="button"
                >
                    Select
                </button>
            </div>
        </div>
    );
}

/**
 * Tool button component - matching old design exactly
 */
function ToolButton({ icon, label, onClick, accent = false }) {
    return (
        <button
            className={clsx('lumia-tool-btn', accent && 'lumia-tool-btn-accent')}
            onClick={onClick}
            type="button"
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

/**
 * Macro reference item
 */
function MacroItem({ code, description }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, [code]);

    return (
        <div
            className={clsx('lumia-macro', copied && 'lumia-macro--copied')}
            onClick={handleCopy}
            title="Click to copy"
        >
            <code>{code}</code>
            <span>{copied ? 'Copied!' : description}</span>
        </div>
    );
}

/**
 * Main Settings Panel component - matching old HTML structure exactly
 */
function SettingsPanel() {
    const settings = useSettings();
    const selections = useSelections();
    const loomSelections = useLoomSelections();
    const actions = useLumiverseActions();
    const { packs, customPacks, allPacks } = usePacks();

    // Track which custom pack is expanded to show Lumia items
    const [expandedPackId, setExpandedPackId] = useState(null);

    // Toggle pack expansion
    const togglePackExpansion = useCallback((packId) => {
        setExpandedPackId(prev => prev === packId ? null : packId);
    }, []);

    // Calculate stats
    const totalPacks = allPacks.length;
    const totalItems = useMemo(() => {
        return allPacks.reduce((sum, pack) => sum + (pack.items?.length || 0), 0);
    }, [allPacks]);

    // Call extension callbacks if available
    const callExtensionCallback = useCallback((name, ...args) => {
        if (typeof LumiverseBridge !== 'undefined') {
            const callbacks = LumiverseBridge.getCallbacks();
            if (callbacks && callbacks[name]) {
                callbacks[name](...args);
            }
        }
    }, []);

    // Handle JSON file upload
    const handleFileUpload = useCallback((event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        console.log('[SettingsPanel] File selected for upload:', file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                console.log('[SettingsPanel] JSON parsed successfully, entries:', data.entries ? Object.keys(data.entries).length : 'no entries field');

                // Call the extension's handleNewBook callback
                if (typeof LumiverseBridge !== 'undefined') {
                    const callbacks = LumiverseBridge.getCallbacks();
                    console.log('[SettingsPanel] Available callbacks:', callbacks ? Object.keys(callbacks).filter(k => callbacks[k]) : 'none');

                    if (callbacks && callbacks.handleNewBook) {
                        console.log('[SettingsPanel] Calling handleNewBook...');
                        callbacks.handleNewBook(data, file.name, false);
                        // Refresh the UI after import
                        if (callbacks.refreshUIDisplay) {
                            callbacks.refreshUIDisplay();
                        }
                        console.log('[SettingsPanel] Import complete');
                    } else {
                        console.error('[SettingsPanel] handleNewBook callback not registered');
                        if (typeof toastr !== 'undefined') {
                            toastr.error('Import function not available. Please reload the page.');
                        }
                    }
                } else {
                    console.error('[SettingsPanel] LumiverseBridge not available');
                    if (typeof toastr !== 'undefined') {
                        toastr.error('Bridge not available. Please reload the page.');
                    }
                }
            } catch (error) {
                console.error('[SettingsPanel] Failed to parse JSON:', error);
                if (typeof toastr !== 'undefined') {
                    toastr.error('Failed to parse JSON: ' + error.message);
                }
            }
        };
        reader.onerror = () => {
            console.error('[SettingsPanel] Failed to read file');
            if (typeof toastr !== 'undefined') {
                toastr.error('Failed to read file');
            }
        };
        reader.readAsText(file);

        // Reset the input so the same file can be selected again
        event.target.value = '';
    }, []);

    // Get drawer visibility setting from store
    const showDrawer = useSyncExternalStore(
        store.subscribe,
        () => store.getState().showLumiverseDrawer ?? true,
        () => store.getState().showLumiverseDrawer ?? true
    );

    // Handle drawer toggle
    const handleDrawerToggle = useCallback((enabled) => {
        store.setState({ showLumiverseDrawer: enabled });
        saveToExtension();
    }, []);

    return (
        <div className="lumia-injector-settings">
            {/* Drawer Toggle */}
            <div className="lumia-drawer-toggle-container">
                <label className="lumiverse-toggle-wrapper">
                    <div className="lumiverse-toggle-text">
                        <span className="lumiverse-toggle-label">Show Lumiverse Drawer</span>
                        <span className="lumiverse-toggle-description">
                            Access quick settings from a slide-out panel
                        </span>
                    </div>
                    <div className={clsx('lumiverse-toggle', showDrawer && 'lumiverse-toggle--on')}>
                        <input
                            type="checkbox"
                            className="lumiverse-toggle-input"
                            checked={showDrawer}
                            onChange={(e) => handleDrawerToggle(e.target.checked)}
                        />
                        <span className="lumiverse-toggle-slider"></span>
                    </div>
                </label>
            </div>

            {/* World Book Source Section */}
            <Panel title="World Book Source" icon={Icons.book}>
                <div className="lumia-status-badge">
                    {totalPacks > 0
                        ? `${totalPacks} pack${totalPacks !== 1 ? 's' : ''} loaded (${totalItems} items)`
                        : 'No packs loaded'}
                </div>

                <div className="lumia-input-row">
                    <input
                        type="text"
                        className="lumia-input"
                        placeholder="Enter World Book URL (JSON)"
                        id="lumia-url-input-react"
                    />
                    <button
                        className="lumia-btn lumia-btn-primary"
                        onClick={() => callExtensionCallback('fetchWorldBook')}
                        type="button"
                    >
                        Fetch
                    </button>
                </div>

                <div className="lumia-source-actions">
                    <div className="lumia-divider-text">or</div>

                    <button
                        className="lumia-btn lumia-btn-secondary lumia-btn-full"
                        onClick={() => document.getElementById('lumia-file-input-react')?.click()}
                        type="button"
                    >
                        {Icons.upload}
                        Upload JSON File
                    </button>
                    <input
                        type="file"
                        id="lumia-file-input-react"
                        accept=".json"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                    />

                    <div className="lumia-divider-text">or</div>

                    <button
                        className="lumia-btn lumia-btn-primary lumia-btn-full"
                        onClick={() => callExtensionCallback('showLucidCardsModal')}
                        type="button"
                    >
                        {Icons.box}
                        Browse Lucid Cards
                    </button>
                </div>
            </Panel>

            {/* Lumia Configuration Section */}
            <Panel title="Lumia Configuration" icon={Icons.settings}>
                <div className="lumia-selector-group">
                    <SelectionButton
                        label="Definition"
                        hint="Select One"
                        selections={selections.definition ? [selections.definition] : []}
                        modalName="definitions"
                    />

                    <SelectionButton
                        label="Behaviors"
                        hint="Select Multiple"
                        selections={selections.behaviors}
                        dominant={selections.dominantBehavior}
                        modalName="behaviors"
                    />

                    <SelectionButton
                        label="Personalities"
                        hint="Select Multiple"
                        selections={selections.personalities}
                        dominant={selections.dominantPersonality}
                        modalName="personalities"
                    />
                </div>
            </Panel>

            {/* Loom Configuration Section */}
            <Panel title="Loom Configuration" icon={Icons.layers}>
                <div className="lumia-selector-group">
                    <SelectionButton
                        label="Narrative Style"
                        hint="Select Multiple"
                        selections={loomSelections.styles}
                        modalName="loomStyles"
                    />

                    <SelectionButton
                        label="Loom Utilities"
                        hint="Select Multiple"
                        selections={loomSelections.utilities}
                        modalName="loomUtilities"
                    />

                    <SelectionButton
                        label="Retrofits"
                        hint="Select Multiple"
                        selections={loomSelections.retrofits}
                        modalName="loomRetrofits"
                    />
                </div>
            </Panel>

            {/* Tools Section */}
            <Panel title="Tools" icon={Icons.tools}>
                <div className="lumia-tools-row">
                    <ToolButton
                        icon={Icons.plus}
                        label="Create Lumia"
                        onClick={() => actions.openModal('packSelector')}
                        accent
                    />
                    <ToolButton
                        icon={Icons.dots}
                        label="OOC Settings"
                        onClick={() => callExtensionCallback('showMiscFeaturesModal')}
                    />
                    <ToolButton
                        icon={Icons.lines}
                        label="Summarization"
                        onClick={() => callExtensionCallback('showSummarizationModal')}
                    />
                    <ToolButton
                        icon={Icons.edit}
                        label="Prompt Settings"
                        onClick={() => callExtensionCallback('showPromptSettingsModal')}
                    />
                </div>
            </Panel>

            {/* Macro Reference (Collapsible) */}
            <CollapsiblePanel title="Macro Reference" icon={Icons.terminal}>
                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Lumia Content</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{lumiaDef}}" description="Physical Definition" />
                        <MacroItem code="{{lumiaBehavior}}" description="Behavior(s)" />
                        <MacroItem code="{{lumiaPersonality}}" description="Personality(s)" />
                    </div>
                </div>

                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Loom Content</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{loomStyle}}" description="Narrative Style" />
                        <MacroItem code="{{loomUtils}}" description="Loom Utilities" />
                        <MacroItem code="{{loomRetrofits}}" description="Retrofits" />
                    </div>
                </div>

                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Random Lumia</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{randomLumia}}" description="Random definition" />
                        <MacroItem code="{{randomLumia.pers}}" description="Random personality" />
                        <MacroItem code="{{randomLumia.behav}}" description="Random behavior" />
                        <MacroItem code="{{randomLumia.name}}" description="Random name" />
                    </div>
                </div>

                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Tracking & OOC</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{lumiaMessageCount}}" description="Message count" />
                        <MacroItem code="{{lumiaOOCTrigger}}" description="OOC trigger/countdown" />
                    </div>
                </div>

                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Summarization</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{loomSummary}}" description="Stored summary" />
                        <MacroItem code="{{loomSummaryPrompt}}" description="Summary directive" />
                        <MacroItem code="/loom-summarize" description="Manual trigger" />
                    </div>
                </div>

                <div className="lumia-macro-group">
                    <div className="lumia-macro-group-title">Sovereign Hand</div>
                    <div className="lumia-macro-list">
                        <MacroItem code="{{loomSovHand}}" description="Full Sovereign Hand prompt (with user message)" />
                        <MacroItem code="{{loomSovHandActive}}" description="Yes/No status indicator" />
                        <MacroItem code="{{loomLastUserMessage}}" description="Last user message (excluded from context)" />
                    </div>
                </div>
            </CollapsiblePanel>

            {/* Custom Packs Section (only if custom packs exist) */}
            {customPacks.length > 0 && (
                <Panel title="Custom Packs" icon={Icons.package}>
                    <div className="lumia-custom-packs">
                        {customPacks.map((pack) => {
                            const isExpanded = expandedPackId === pack.id;
                            const lumiaItems = pack.items?.filter(item => item.lumiaDefName) || [];

                            return (
                                <motion.div
                                    key={pack.id}
                                    className={clsx('lumia-pack-item-container', isExpanded && 'lumia-pack-item-container--expanded')}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    {/* Pack header row */}
                                    <div className="lumia-pack-item">
                                        <button
                                            className="lumia-pack-expand-btn"
                                            onClick={() => togglePackExpansion(pack.id)}
                                            type="button"
                                            title={isExpanded ? 'Collapse' : 'Expand to see Lumias'}
                                        >
                                            <span className={clsx('lumia-pack-chevron', isExpanded && 'lumia-pack-chevron--expanded')}>
                                                {Icons.chevronDown}
                                            </span>
                                        </button>
                                        <span
                                            className="lumia-pack-name"
                                            onClick={() => togglePackExpansion(pack.id)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            {pack.name}
                                        </span>
                                        <span className="lumia-pack-count">
                                            {lumiaItems.length} Lumia{lumiaItems.length !== 1 ? 's' : ''}
                                        </span>
                                        <button
                                            className="lumia-btn lumia-btn-icon"
                                            onClick={() => actions.openModal('packEditor', { packId: pack.id })}
                                            title="Edit pack"
                                            type="button"
                                        >
                                            {Icons.edit}
                                        </button>
                                    </div>

                                    {/* Expanded Lumia items list */}
                                    <AnimatePresence>
                                        {isExpanded && lumiaItems.length > 0 && (
                                            <motion.div
                                                className="lumia-pack-items-list"
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                {lumiaItems.map((item, index) => (
                                                    <div
                                                        key={item.lumiaDefName || index}
                                                        className="lumia-pack-lumia-item"
                                                    >
                                                        {item.lumia_img && (
                                                            <img
                                                                src={item.lumia_img}
                                                                alt=""
                                                                className="lumia-pack-lumia-avatar"
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                        )}
                                                        <span className="lumia-pack-lumia-name">
                                                            {item.lumiaDefName}
                                                        </span>
                                                        <button
                                                            className="lumia-btn lumia-btn-icon lumia-btn-icon-sm"
                                                            onClick={() => actions.openModal('lumiaEditor', {
                                                                packName: pack.name,
                                                                editingItem: item
                                                            })}
                                                            title="Edit Lumia"
                                                            type="button"
                                                        >
                                                            {Icons.edit}
                                                        </button>
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}
                                        {isExpanded && lumiaItems.length === 0 && (
                                            <motion.div
                                                className="lumia-pack-items-empty"
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                            >
                                                <span>No Lumias in this pack yet</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>
                </Panel>
            )}
        </div>
    );
}

export default SettingsPanel;
