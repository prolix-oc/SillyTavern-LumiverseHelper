import React, { useState, useCallback, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { Hand, Filter, ChevronDown, Info } from 'lucide-react';
import { useLumiverseStore, saveToExtension } from '../../store/LumiverseContext';

// Get the store for direct access (old code uses root-level settings)
const store = useLumiverseStore;

/**
 * Toggle switch component
 */
function Toggle({ id, checked, onChange, label, hint }) {
    return (
        <div className="lumiverse-vp-toggle-row">
            <label className="lumiverse-vp-toggle-label" htmlFor={id}>
                <span className="lumiverse-vp-toggle-text">{label}</span>
                {hint && <span className="lumiverse-vp-toggle-hint">{hint}</span>}
            </label>
            <div className="lumiverse-vp-toggle-switch-wrapper">
                <input
                    type="checkbox"
                    id={id}
                    className="lumiverse-vp-toggle-input"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <label htmlFor={id} className="lumiverse-vp-toggle-switch-label">
                    <div className={clsx('lumiverse-vp-toggle-track', checked && 'lumiverse-vp-toggle-track--on')}>
                        <div className="lumiverse-vp-toggle-thumb" />
                    </div>
                </label>
            </div>
        </div>
    );
}

/**
 * Number input field
 */
function NumberField({ id, label, hint, value, onChange, min = 0, max = 100 }) {
    return (
        <div className="lumiverse-vp-field lumiverse-vp-field--inline">
            <label className="lumiverse-vp-field-label" htmlFor={id}>{label}</label>
            <input
                type="number"
                id={id}
                className="lumiverse-vp-field-input lumiverse-vp-field-input--small"
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
                min={min}
                max={max}
            />
            {hint && <span className="lumiverse-vp-field-hint">{hint}</span>}
        </div>
    );
}

/**
 * Collapsible section
 */
function CollapsibleSection({ Icon, title, status, children, defaultOpen = false }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={clsx('lumiverse-vp-collapsible', isOpen && 'lumiverse-vp-collapsible--open')}>
            <button
                className="lumiverse-vp-collapsible-header"
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span className={clsx('lumiverse-vp-collapsible-chevron', isOpen && 'lumiverse-vp-collapsible-chevron--open')}>
                    <ChevronDown size={14} strokeWidth={2} />
                </span>
                <span className="lumiverse-vp-collapsible-icon">
                    <Icon size={16} strokeWidth={1.5} />
                </span>
                <span className="lumiverse-vp-collapsible-title">{title}</span>
                {status !== undefined && (
                    <span className={clsx('lumiverse-vp-collapsible-status', status && 'lumiverse-vp-collapsible-status--active')}>
                        {status ? 'Active' : 'Inactive'}
                    </span>
                )}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="lumiverse-vp-collapsible-content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="lumiverse-vp-collapsible-inner">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/**
 * Info box component
 */
function InfoBox({ items, muted = false }) {
    return (
        <div className={clsx('lumiverse-vp-info-box', muted && 'lumiverse-vp-info-box--muted')}>
            <div className="lumiverse-vp-info-box-header">
                <Info size={14} strokeWidth={2} />
                <span>When enabled:</span>
            </div>
            <ul className="lumiverse-vp-info-box-list">
                {items.map((item, i) => (
                    <li key={i}>{item}</li>
                ))}
            </ul>
        </div>
    );
}

/**
 * Filter item with toggle and optional depth setting
 */
function FilterItem({ id, label, hint, enabled, onToggle, depthValue, onDepthChange, depthLabel, depthHint }) {
    return (
        <div className="lumiverse-vp-filter-item">
            <Toggle
                id={id}
                checked={enabled}
                onChange={onToggle}
                label={label}
                hint={hint}
            />
            <AnimatePresence>
                {enabled && depthValue !== undefined && (
                    <motion.div
                        className="lumiverse-vp-filter-options"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <NumberField
                            id={`${id}-depth`}
                            label={depthLabel || 'Keep in last N messages'}
                            hint={depthHint}
                            value={depthValue}
                            onChange={onDepthChange}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/**
 * Prompt Settings Panel
 * Controls for Sovereign Hand and Context Filters
 * Uses global store for settings sync between ViewportApp and settings panel
 *
 * OLD CODE: sovereignHand and contextFilters are at root level of settings
 */
function PromptSettings() {
    // Get settings directly from store (old code uses root-level fields)
    const sovereignHand = useSyncExternalStore(
        store.subscribe,
        () => store.getState().sovereignHand || { enabled: false, excludeLastMessage: true },
        () => store.getState().sovereignHand || { enabled: false, excludeLastMessage: true }
    );
    const contextFilters = useSyncExternalStore(
        store.subscribe,
        () => store.getState().contextFilters || {},
        () => store.getState().contextFilters || {}
    );

    const sovereignEnabled = sovereignHand.enabled ?? false;
    const htmlTagsEnabled = contextFilters.htmlTags?.enabled ?? false;
    const stripFonts = contextFilters.htmlTags?.stripFonts ?? false;
    const fontKeepDepth = contextFilters.htmlTags?.fontKeepDepth ?? 3;
    const detailsEnabled = contextFilters.detailsBlocks?.enabled ?? false;
    const detailsKeepDepth = contextFilters.detailsBlocks?.keepDepth ?? 3;
    const loomEnabled = contextFilters.loomItems?.enabled ?? false;
    const loomKeepDepth = contextFilters.loomItems?.keepDepth ?? 5;

    // Handlers that update store and save using nested path updates
    const updateSetting = useCallback((path, value) => {
        const state = store.getState();
        const parts = path.split('.');

        if (parts[0] === 'sovereignHand') {
            store.setState({
                sovereignHand: { ...state.sovereignHand, [parts[1]]: value }
            });
        } else if (parts[0] === 'contextFilters') {
            const filterType = parts[1]; // e.g., 'htmlTags', 'detailsBlocks', 'loomItems'
            const filterKey = parts[2];  // e.g., 'enabled', 'keepDepth'
            store.setState({
                contextFilters: {
                    ...state.contextFilters,
                    [filterType]: {
                        ...(state.contextFilters?.[filterType] || {}),
                        [filterKey]: value
                    }
                }
            });
        }
        saveToExtension();
    }, []);

    const filtersActive = htmlTagsEnabled || detailsEnabled || loomEnabled;

    return (
        <div className="lumiverse-vp-settings-panel">
            {/* Sovereign Hand Section */}
            <CollapsibleSection
                Icon={Hand}
                title="Sovereign Hand"
                status={sovereignEnabled}
                defaultOpen={true}
            >
                <p className="lumiverse-vp-settings-desc">
                    Enable Sovereign Hand integration to use advanced prompt manipulation features.
                </p>
                <Toggle
                    id="sovereign-hand-toggle"
                    checked={sovereignEnabled}
                    onChange={(v) => updateSetting('sovereignHand.enabled', v)}
                    label="Use Sovereign Hand Features"
                    hint="Enables Sovereign Hand macros for advanced prompt control"
                />
                <Toggle
                    id="sovereign-hand-exclude-toggle"
                    checked={sovereignHand.excludeLastMessage ?? true}
                    onChange={(v) => updateSetting('sovereignHand.excludeLastMessage', v)}
                    label="Exclude Last Message from Context"
                    hint="When enabled, removes the last user message from the outgoing context"
                    disabled={!sovereignEnabled}
                />
                <InfoBox
                    muted={!sovereignEnabled}
                    items={[
                        <><code>{'{{loomLastUserMessage}}'}</code> returns the last user message</>,
                        <><code>{'{{lastMessageName}}'}</code> returns the name of whoever sent the last message</>,
                        <><code>{'{{loomContinuePrompt}}'}</code> adds continuation instructions when character spoke last</>,
                        'Use these macros to provide instructions with the user\'s input to specific prompt locations',
                    ]}
                />
            </CollapsibleSection>

            {/* Context Filters Section */}
            <CollapsibleSection
                Icon={Filter}
                title="Context Filters"
                status={filtersActive}
            >
                <p className="lumiverse-vp-settings-desc">
                    Filter out specific content from the chat context before sending to the AI.
                </p>

                {/* HTML Tags Filter */}
                <FilterItem
                    id="filter-html"
                    label="Strip HTML Tags"
                    hint="Removes formatting tags: <div>, <span>, <b>, <i>, etc."
                    enabled={htmlTagsEnabled}
                    onToggle={(v) => updateSetting('contextFilters.htmlTags.enabled', v)}
                />

                {/* Strip Fonts Sub-option */}
                <AnimatePresence>
                    {htmlTagsEnabled && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="lumiverse-vp-filter-sub"
                        >
                            <FilterItem
                                id="filter-fonts"
                                label="Also Strip Fonts"
                                hint="Remove <font> tags (used by some presets)"
                                enabled={stripFonts}
                                onToggle={(v) => updateSetting('contextFilters.htmlTags.stripFonts', v)}
                                depthValue={fontKeepDepth}
                                onDepthChange={(v) => updateSetting('contextFilters.htmlTags.fontKeepDepth', v)}
                                depthLabel="Keep fonts in last N messages"
                                depthHint="Font tags in older messages will be stripped"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Details Blocks Filter */}
                <FilterItem
                    id="filter-details"
                    label="Filter Details Blocks"
                    hint="Removes <details> blocks from older messages"
                    enabled={detailsEnabled}
                    onToggle={(v) => updateSetting('contextFilters.detailsBlocks.enabled', v)}
                    depthValue={detailsKeepDepth}
                    onDepthChange={(v) => updateSetting('contextFilters.detailsBlocks.keepDepth', v)}
                    depthHint="Messages beyond this depth will have <details> removed"
                />

                {/* Loom Items Filter */}
                <FilterItem
                    id="filter-loom"
                    label="Filter Loom Tags"
                    hint="Removes Lucid Loom-related tags from older messages"
                    enabled={loomEnabled}
                    onToggle={(v) => updateSetting('contextFilters.loomItems.enabled', v)}
                    depthValue={loomKeepDepth}
                    onDepthChange={(v) => updateSetting('contextFilters.loomItems.keepDepth', v)}
                    depthHint="Loom tags in older messages will be stripped"
                />
            </CollapsibleSection>
        </div>
    );
}

export default PromptSettings;
