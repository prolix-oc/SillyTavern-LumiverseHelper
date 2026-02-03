import React, { useCallback, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { Clock, LayoutGrid, MessageCircle, FileText, Quote, Type, Hash, Users } from 'lucide-react';
import { useLumiverseActions, saveToExtensionImmediate, useLumiverseStore } from '../../store/LumiverseContext';

/* global LumiverseBridge */

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
 * Style option card
 */
function StyleOption({ id, Icon, title, description, selected, onChange }) {
    return (
        <label className={clsx('lumiverse-vp-style-option', selected && 'lumiverse-vp-style-option--selected')}>
            <input
                type="radio"
                name="ooc-style"
                value={id}
                checked={selected}
                onChange={() => onChange(id)}
            />
            <span className="lumiverse-vp-style-option-icon">
                <Icon size={20} strokeWidth={1.5} />
            </span>
            <div className="lumiverse-vp-style-option-text">
                <span className="lumiverse-vp-style-option-title">{title}</span>
                <span className="lumiverse-vp-style-option-desc">{description}</span>
            </div>
        </label>
    );
}

/**
 * Number input field
 */
function NumberField({ id, label, hint, value, onChange, placeholder, min = 1 }) {
    return (
        <div className="lumiverse-vp-field">
            <label className="lumiverse-vp-field-label" htmlFor={id}>{label}</label>
            <input
                type="number"
                id={id}
                className="lumiverse-vp-field-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                min={min}
            />
            {hint && <span className="lumiverse-vp-field-hint">{hint}</span>}
        </div>
    );
}

/**
 * OOC Settings Panel
 * Controls for out-of-character comment behavior and triggers
 * Uses global store for settings sync between ViewportApp and settings panel
 *
 * OLD CODE FIELD NAMES (root level, not nested):
 * - lumiaOOCInterval: number | null
 * - lumiaOOCStyle: 'social' | 'margin' | 'whisper'
 * - councilChatStyle: { enabled: boolean, showTimestamps: boolean }
 */
function OOCSettings() {
    const actions = useLumiverseActions();

    // Get OOC settings directly from store (old code uses root-level fields)
    const interval = useSyncExternalStore(
        store.subscribe,
        () => store.getState().lumiaOOCInterval,
        () => store.getState().lumiaOOCInterval
    );
    const style = useSyncExternalStore(
        store.subscribe,
        () => store.getState().lumiaOOCStyle || 'social',
        () => store.getState().lumiaOOCStyle || 'social'
    );

    // Council mode state
    const councilMode = useSyncExternalStore(
        store.subscribe,
        () => store.getState().councilMode || false,
        () => store.getState().councilMode || false
    );
    const councilMembers = useSyncExternalStore(
        store.subscribe,
        () => store.getState().councilMembers || [],
        () => store.getState().councilMembers || []
    );

    // IRC chat style settings for council mode
    const councilChatStyle = useSyncExternalStore(
        store.subscribe,
        () => store.getState().councilChatStyle || { enabled: false, showTimestamps: true },
        () => store.getState().councilChatStyle || { enabled: false, showTimestamps: true }
    );

    const isCouncilActive = councilMode && councilMembers.length > 0;

    const handleIntervalChange = useCallback((value) => {
        const intervalNum = value ? parseInt(value, 10) : null;
        store.setState({ lumiaOOCInterval: intervalNum });
        saveToExtensionImmediate();
    }, []);

    const handleStyleChange = useCallback((value) => {
        store.setState({ lumiaOOCStyle: value });
        saveToExtensionImmediate();

        // Re-render existing OOC comments with the new style
        if (typeof LumiverseBridge !== 'undefined') {
            const callbacks = LumiverseBridge.getCallbacks();
            if (callbacks?.refreshOOCComments) {
                // Pass true to clear existing OOC boxes and re-render
                callbacks.refreshOOCComments(true);
            }
        }
    }, []);

    const handleIRCStyleToggle = useCallback((enabled) => {
        const newStyle = { ...councilChatStyle, enabled };
        store.setState({ councilChatStyle: newStyle });
        saveToExtensionImmediate();

        // Re-render existing OOC comments with the new style
        if (typeof LumiverseBridge !== 'undefined') {
            const callbacks = LumiverseBridge.getCallbacks();
            if (callbacks?.refreshOOCComments) {
                callbacks.refreshOOCComments(true);
            }
        }
    }, [councilChatStyle]);

    const handleIRCTimestampToggle = useCallback((showTimestamps) => {
        const newStyle = { ...councilChatStyle, showTimestamps };
        store.setState({ councilChatStyle: newStyle });
        saveToExtensionImmediate();

        // Re-render existing OOC comments with the new style
        if (typeof LumiverseBridge !== 'undefined') {
            const callbacks = LumiverseBridge.getCallbacks();
            if (callbacks?.refreshOOCComments) {
                callbacks.refreshOOCComments(true);
            }
        }
    }, [councilChatStyle]);

    const styleOptions = [
        {
            id: 'none',
            Icon: Type,
            title: 'None',
            description: 'Raw text with no formatting',
        },
        {
            id: 'social',
            Icon: LayoutGrid,
            title: 'Social Card',
            description: 'Full card with avatar & animations',
        },
        {
            id: 'margin',
            Icon: FileText,
            title: 'Margin Note',
            description: 'Minimal hanging tag style',
        },
        {
            id: 'whisper',
            Icon: Quote,
            title: 'Whisper Bubble',
            description: 'Soft ethereal thought bubble',
        },
    ];

    return (
        <div className="lumiverse-vp-settings-panel">
            {/* Comment Trigger Section */}
            <div className="lumiverse-vp-settings-section">
                <div className="lumiverse-vp-settings-section-header">
                    <Clock size={16} strokeWidth={1.5} />
                    <span>Comment Trigger</span>
                </div>
                <p className="lumiverse-vp-settings-desc">
                    Automatically inject OOC instructions at message intervals.
                </p>
                <NumberField
                    id="ooc-interval"
                    label="Message Interval"
                    hint="Triggers when message count is divisible by this number"
                    value={interval?.toString() || ''}
                    onChange={handleIntervalChange}
                    placeholder="e.g., 10 (empty = disabled)"
                />
            </div>

            {/* Display Style Section */}
            <div className="lumiverse-vp-settings-section">
                <div className="lumiverse-vp-settings-section-header">
                    <MessageCircle size={16} strokeWidth={1.5} />
                    <span>Display Style</span>
                </div>
                <p className="lumiverse-vp-settings-desc">
                    Choose how OOC comments appear in chat.
                </p>
                <div className="lumiverse-vp-style-options">
                    {styleOptions.map(option => (
                        <StyleOption
                            key={option.id}
                            {...option}
                            selected={style === option.id}
                            onChange={handleStyleChange}
                        />
                    ))}
                </div>
            </div>

            {/* Council IRC Chat Style Section */}
            {isCouncilActive && (
                <div className="lumiverse-vp-settings-section">
                    <div className="lumiverse-vp-settings-section-header">
                        <Hash size={16} strokeWidth={1.5} />
                        <span>Council IRC Mode</span>
                        <Users size={14} strokeWidth={1.5} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                    </div>
                    <p className="lumiverse-vp-settings-desc">
                        Display council OOC as a retro internet chatroom. Members get l33tspeak handles and can @mention each other.
                    </p>
                    <Toggle
                        id="irc-style-enabled"
                        checked={councilChatStyle.enabled}
                        onChange={handleIRCStyleToggle}
                        label="Enable IRC Chat Style"
                        hint="Council members appear in a shared #LumiaCouncil channel"
                    />
                    {councilChatStyle.enabled && (
                        <Toggle
                            id="irc-timestamps"
                            checked={councilChatStyle.showTimestamps}
                            onChange={handleIRCTimestampToggle}
                            label="Show Timestamps"
                            hint="Display [HH:MM] before each message"
                        />
                    )}
                </div>
            )}
        </div>
    );
}

export default OOCSettings;
