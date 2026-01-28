import React, { useState, useCallback, useSyncExternalStore } from 'react';
import { CollapsibleContent } from '../Collapsible';
import clsx from 'clsx';
import { Hand, Filter, ChevronDown, Info, Layers, Users, Edit2, Check, X, Brain } from 'lucide-react';
import { useLumiverseStore, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';
import { useChatPresetSettings } from '../../hooks/useChatPresetSettings';
import { ReasoningSettingsContent } from '../shared/ReasoningSettings';

// Get the store for direct access (old code uses root-level settings)
const store = useLumiverseStore;

// Stable fallback constants for useSyncExternalStore
const EMPTY_OBJECT = {};
const DEFAULT_SOVEREIGN_HAND = { enabled: false, excludeLastMessage: true, includeMessageInPrompt: true };

// Stable selector functions
const selectSovereignHand = () => store.getState().sovereignHand || DEFAULT_SOVEREIGN_HAND;
const selectContextFilters = () => store.getState().contextFilters || EMPTY_OBJECT;
const selectChimeraMode = () => store.getState().chimeraMode || false;
const selectCouncilMode = () => store.getState().councilMode || false;
const selectSelectedDefinitionsCount = () => store.getState().selectedDefinitions?.length || 0;
const selectCouncilMembersCount = () => store.getState().councilMembers?.length || 0;
const selectLumiaQuirks = () => store.getState().lumiaQuirks || '';
const selectLumiaQuirksEnabled = () => store.getState().lumiaQuirksEnabled !== false;

/**
 * Toggle switch component
 */
function Toggle({ id, checked, onChange, label, hint, disabled = false }) {
    return (
        <div className={clsx('lumiverse-vp-toggle-row', disabled && 'lumiverse-vp-toggle-row--disabled')}>
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
                    disabled={disabled}
                />
                <label htmlFor={id} className="lumiverse-vp-toggle-switch-label">
                    <div className={clsx(
                        'lumiverse-vp-toggle-track',
                        checked && 'lumiverse-vp-toggle-track--on',
                        disabled && 'lumiverse-vp-toggle-track--disabled'
                    )}>
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
 * Collapsible section - uses CSS grid for smooth, performant animation
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
            <CollapsibleContent
                isOpen={isOpen}
                className="lumiverse-vp-collapsible-content"
                duration={200}
            >
                <div className="lumiverse-vp-collapsible-inner">
                    {children}
                </div>
            </CollapsibleContent>
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
 * Uses CSS grid for smooth, performant animation
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
            <CollapsibleContent
                isOpen={enabled && depthValue !== undefined}
                className="lumiverse-vp-filter-options"
                duration={150}
            >
                <NumberField
                    id={`${id}-depth`}
                    label={depthLabel || 'Keep in last N messages'}
                    hint={depthHint}
                    value={depthValue}
                    onChange={onDepthChange}
                />
            </CollapsibleContent>
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
    const actions = useLumiverseActions();

    // Get settings directly from store (old code uses root-level fields)
    const sovereignHand = useSyncExternalStore(
        store.subscribe,
        selectSovereignHand,
        selectSovereignHand
    );
    const contextFilters = useSyncExternalStore(
        store.subscribe,
        selectContextFilters,
        selectContextFilters
    );

    // Chimera and Council mode states
    const chimeraMode = useSyncExternalStore(
        store.subscribe,
        selectChimeraMode,
        selectChimeraMode
    );
    const councilMode = useSyncExternalStore(
        store.subscribe,
        selectCouncilMode,
        selectCouncilMode
    );
    const selectedDefinitionsCount = useSyncExternalStore(
        store.subscribe,
        selectSelectedDefinitionsCount,
        selectSelectedDefinitionsCount
    );
    const councilMembersCount = useSyncExternalStore(
        store.subscribe,
        selectCouncilMembersCount,
        selectCouncilMembersCount
    );
    const lumiaQuirks = useSyncExternalStore(
        store.subscribe,
        selectLumiaQuirks,
        selectLumiaQuirks
    );
    const lumiaQuirksEnabled = useSyncExternalStore(
        store.subscribe,
        selectLumiaQuirksEnabled,
        selectLumiaQuirksEnabled
    );

    // Local state for editing quirks (non-council mode)
    const [quirksValue, setQuirksValue] = useState(lumiaQuirks);
    const [isEditingQuirks, setIsEditingQuirks] = useState(false);

    // Shared reasoning settings (synced with modal)
    const {
        reasoningSettings,
        startReplyWith,
        apiReasoning,
        handleApplyReasoningPreset,
        handleStartReplyWithChange,
        handleReasoningToggle,
        handleAPIReasoningToggle,
        handleReasoningEffortChange,
        REASONING_EFFORT_LEVELS
    } = useChatPresetSettings();

    const sovereignEnabled = sovereignHand.enabled ?? false;
    const htmlTagsEnabled = contextFilters.htmlTags?.enabled ?? false;
    const htmlKeepDepth = contextFilters.htmlTags?.keepDepth ?? 3;
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

    // Handlers for Chimera/Council modes
    const handleChimeraModeChange = useCallback((enabled) => {
        actions.setChimeraMode(enabled);
        saveToExtension();
    }, [actions]);

    const handleCouncilModeChange = useCallback((enabled) => {
        actions.setCouncilMode(enabled);
        saveToExtension();
    }, [actions]);

    const handleQuirksSave = useCallback(() => {
        actions.setLumiaQuirks(quirksValue);
        saveToExtension();
        setIsEditingQuirks(false);
    }, [actions, quirksValue]);

    const handleQuirksCancel = useCallback(() => {
        setQuirksValue(lumiaQuirks);
        setIsEditingQuirks(false);
    }, [lumiaQuirks]);

    const handleQuirksEnabledChange = useCallback((enabled) => {
        actions.setLumiaQuirksEnabled(enabled);
        saveToExtension();
    }, [actions]);

    // Determine which mode is active for status display
    const lumiaModeActive = chimeraMode || councilMode;

    return (
        <div className="lumiverse-vp-settings-panel">
            {/* Lumia Modes Section */}
            <CollapsibleSection
                Icon={Layers}
                title="Lumia Modes"
                status={lumiaModeActive}
                defaultOpen={true}
            >
                <p className="lumiverse-vp-settings-desc">
                    Configure special Lumia modes for unique character setups. These modes are mutually exclusive.
                </p>

                {/* Chimera Mode */}
                <div className="lumiverse-vp-mode-option">
                    <Toggle
                        id="chimera-mode-toggle"
                        checked={chimeraMode}
                        onChange={handleChimeraModeChange}
                        label="Chimera Mode"
                        hint="Fuse multiple physical definitions into one hybrid form"
                    />
                    <CollapsibleContent
                        isOpen={chimeraMode}
                        className="lumiverse-vp-mode-details"
                        duration={150}
                    >
                        <InfoBox
                            items={[
                                'Select multiple definitions in the Definition modal',
                                'All selected forms will be fused into one Chimera',
                                `Currently ${selectedDefinitionsCount} definition${selectedDefinitionsCount !== 1 ? 's' : ''} selected`,
                            ]}
                        />
                    </CollapsibleContent>
                </div>

                {/* Council Mode - Placeholder for Feature 4 */}
                <div className="lumiverse-vp-mode-option">
                    <Toggle
                        id="council-mode-toggle"
                        checked={councilMode}
                        onChange={handleCouncilModeChange}
                        label="Council Mode"
                        hint="Multiple independent Lumias that collaborate"
                    />
                    <CollapsibleContent
                        isOpen={councilMode}
                        className="lumiverse-vp-mode-details"
                        duration={150}
                    >
                        <InfoBox
                            items={[
                                'Each council member has independent traits',
                                'Members can converse and collaborate',
                                `Currently ${councilMembersCount} council member${councilMembersCount !== 1 ? 's' : ''}`,
                            ]}
                        />
                        <p className="lumiverse-vp-mode-note">
                            Configure council members in the Council tab.
                        </p>
                    </CollapsibleContent>
                </div>

                {/* Behavioral Quirks - Universal, works in all modes */}
                <div className={clsx('lumiverse-vp-quirks-section', !lumiaQuirksEnabled && 'lumiverse-vp-quirks-section--disabled')}>
                        <div className="lumiverse-vp-quirks-header">
                            <div className="lumiverse-vp-quirks-header-left">
                                <span className="lumiverse-vp-quirks-label">Behavioral Quirks</span>
                                <button
                                    className={clsx('lumiverse-vp-quirks-toggle', lumiaQuirksEnabled && 'lumiverse-vp-quirks-toggle--on')}
                                    onClick={() => handleQuirksEnabledChange(!lumiaQuirksEnabled)}
                                    title={lumiaQuirksEnabled ? 'Disable quirks' : 'Enable quirks'}
                                    type="button"
                                    aria-pressed={lumiaQuirksEnabled}
                                >
                                    <span className="lumiverse-vp-quirks-toggle-track">
                                        <span className="lumiverse-vp-quirks-toggle-thumb" />
                                    </span>
                                </button>
                            </div>
                            {!isEditingQuirks && lumiaQuirksEnabled && (
                                <button
                                    className="lumiverse-vp-quirks-edit-btn"
                                    onClick={() => setIsEditingQuirks(true)}
                                    title="Edit quirks"
                                    type="button"
                                >
                                    <Edit2 size={12} strokeWidth={1.5} />
                                </button>
                            )}
                        </div>
                        <p className="lumiverse-vp-quirks-hint">
                            Extra behavioral modifications. Use <code>{'{{lumiaQuirks}}'}</code>
                        </p>

                        {isEditingQuirks && lumiaQuirksEnabled ? (
                            <div className="lumiverse-vp-quirks-edit">
                                <textarea
                                    className="lumiverse-vp-quirks-textarea"
                                    placeholder="Enter behavioral quirks..."
                                    value={quirksValue}
                                    onChange={(e) => setQuirksValue(e.target.value)}
                                    rows={3}
                                />
                                <div className="lumiverse-vp-quirks-actions">
                                    <button
                                        className="lumiverse-vp-quirks-btn lumiverse-vp-quirks-btn--primary"
                                        onClick={handleQuirksSave}
                                        type="button"
                                    >
                                        <Check size={12} strokeWidth={2} /> Save
                                    </button>
                                    <button
                                        className="lumiverse-vp-quirks-btn"
                                        onClick={handleQuirksCancel}
                                        type="button"
                                    >
                                        <X size={12} strokeWidth={2} /> Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="lumiverse-vp-quirks-preview">
                                {lumiaQuirks?.trim() ? (
                                    <span className="lumiverse-vp-quirks-text">{lumiaQuirks}</span>
                                ) : (
                                    <span className="lumiverse-vp-quirks-empty">No quirks set</span>
                                )}
                            </div>
                        )}
                </div>
            </CollapsibleSection>

            {/* Reasoning / Chain of Thought Section */}
            <CollapsibleSection
                Icon={Brain}
                title="Reasoning / CoT"
                status={reasoningSettings?.auto_parse || apiReasoning.enabled}
                defaultOpen={false}
            >
                <p className="lumiverse-vp-settings-desc">
                    Configure reasoning/chain-of-thought settings for AI models. Changes sync with the Chat Presets modal.
                </p>
                <ReasoningSettingsContent
                    reasoningSettings={reasoningSettings}
                    startReplyWith={startReplyWith}
                    apiReasoning={apiReasoning}
                    onApplyReasoningPreset={handleApplyReasoningPreset}
                    onStartReplyWithChange={handleStartReplyWithChange}
                    onReasoningToggle={handleReasoningToggle}
                    onAPIReasoningToggle={handleAPIReasoningToggle}
                    onReasoningEffortChange={handleReasoningEffortChange}
                    effortLevels={REASONING_EFFORT_LEVELS}
                    compact={true}
                />
            </CollapsibleSection>

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
                <Toggle
                    id="sovereign-hand-include-in-prompt-toggle"
                    checked={sovereignHand.includeMessageInPrompt ?? true}
                    onChange={(v) => updateSetting('sovereignHand.includeMessageInPrompt', v)}
                    label="Include Message in Master Prompt"
                    hint="When enabled, includes the user message in the {{loomSovHand}} macro output"
                    disabled={!sovereignEnabled}
                />
                <InfoBox
                    muted={!sovereignEnabled}
                    items={[
                        <><code>{'{{loomLastUserMessage}}'}</code> returns the last user message</>,
                        <><code>{'{{loomLastCharMessage}}'}</code> returns the last character message</>,
                        <><code>{'{{lastMessageName}}'}</code> returns the name of whoever sent the last message</>,
                        <><code>{'{{loomContinuePrompt}}'}</code> adds continuation instructions when character spoke last</>,
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
                    depthValue={htmlKeepDepth}
                    onDepthChange={(v) => updateSetting('contextFilters.htmlTags.keepDepth', v)}
                    depthLabel="Keep HTML in last N messages"
                    depthHint="HTML tags in older messages will be stripped"
                />

                {/* Strip Fonts Sub-option - uses CSS grid for smooth animation */}
                <CollapsibleContent
                    isOpen={htmlTagsEnabled}
                    className="lumiverse-vp-filter-sub"
                    duration={200}
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
                </CollapsibleContent>

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
