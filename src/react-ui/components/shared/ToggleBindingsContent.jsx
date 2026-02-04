/**
 * ToggleBindingsContent - Shared component for managing prompt toggle bindings
 * Used by both PresetBindingsModal and PresetManager sidebar
 */
import React, { useCallback } from 'react';
import {
    MessageSquare,
    User,
    Trash2,
    ToggleLeft,
    ToggleRight,
    RefreshCw,
    Settings,
} from 'lucide-react';
import { usePresetBindings } from '../../hooks/usePresetBindings';

/* global toastr */

/**
 * Toggle Bindings Settings Content Component
 * Renders the toggle binding configuration UI for chat and character
 * 
 * @param {Object} props
 * @param {boolean} [props.compact=false] - Use compact layout for sidebar
 */
export function ToggleBindingsContent({ compact = false }) {
    const {
        contextInfo,
        hasChatToggleBinding,
        hasCharacterToggleBinding,
        saveTogglesToChat,
        clearChatToggleBinding,
        saveTogglesToCharacter,
        clearCharacterToggleBinding,
        // New: default state restoration settings
        disableDefaultStateRestore,
        hasDefaultToggles,
        setDisableDefaultStateRestore,
        recaptureDefaultToggleState,
    } = usePresetBindings();

    const hasContext = contextInfo.characterAvatar || contextInfo.chatId;

    // Toggle state binding handlers
    const handleSaveTogglesToChat = useCallback(async () => {
        const success = await saveTogglesToChat();
        if (success) {
            toastr?.success('Prompt toggles bound to current chat');
        } else {
            toastr?.error('Failed to save prompt toggles');
        }
    }, [saveTogglesToChat]);

    const handleClearChatToggleBinding = useCallback(() => {
        clearChatToggleBinding();
        toastr?.info('Chat toggle binding cleared');
    }, [clearChatToggleBinding]);

    const handleSaveTogglesToCharacter = useCallback(async () => {
        const success = await saveTogglesToCharacter();
        if (success) {
            toastr?.success(`Prompt toggles bound to ${contextInfo.characterName || 'character'}`);
        } else {
            toastr?.error('Failed to save prompt toggles');
        }
    }, [saveTogglesToCharacter, contextInfo.characterName]);

    const handleClearCharacterToggleBinding = useCallback(() => {
        clearCharacterToggleBinding();
        toastr?.info('Character toggle binding cleared');
    }, [clearCharacterToggleBinding]);

    // Handler for toggling auto-restore defaults
    const handleToggleAutoRestore = useCallback(() => {
        const newValue = !disableDefaultStateRestore;
        setDisableDefaultStateRestore(newValue);
        if (newValue) {
            toastr?.info('Auto-restore defaults disabled');
        } else {
            toastr?.success('Auto-restore defaults enabled');
        }
    }, [disableDefaultStateRestore, setDisableDefaultStateRestore]);

    // Handler for recapturing default toggle state
    const handleRecaptureDefaults = useCallback(() => {
        const success = recaptureDefaultToggleState();
        if (success) {
            toastr?.success('Current toggle states captured as defaults');
        } else {
            toastr?.error('Failed to capture toggle states - no toggles available');
        }
    }, [recaptureDefaultToggleState]);

    // Default State Settings - always shown, doesn't require chat context
    const defaultStateSettingsSection = (
        <div className="lumiverse-bindings-defaults-section">
            <div className="lumiverse-bindings-defaults-header">
                <Settings size={14} strokeWidth={1.5} />
                <span>Default State Settings</span>
            </div>
            
            {/* Auto-restore toggle */}
            <div className="lumiverse-bindings-toggle-row">
                <div className="lumiverse-bindings-toggle-label">
                    <span>Restore defaults automatically</span>
                </div>
                <div className="lumiverse-bindings-toggle-actions">
                    <button
                        className={`lumia-btn lumia-btn-sm ${disableDefaultStateRestore ? 'lumia-btn-secondary' : 'lumia-btn-primary'}`}
                        onClick={handleToggleAutoRestore}
                        type="button"
                        title={disableDefaultStateRestore 
                            ? 'Defaults will NOT be restored when switching to unbound chats' 
                            : 'Defaults will be restored when switching to unbound chats'}
                    >
                        {disableDefaultStateRestore ? (
                            <>
                                <ToggleLeft size={12} strokeWidth={2} />
                                Off
                            </>
                        ) : (
                            <>
                                <ToggleRight size={12} strokeWidth={2} />
                                On
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Capture current as defaults button */}
            <div className="lumiverse-bindings-toggle-row">
                <div className="lumiverse-bindings-toggle-label">
                    <span>Capture current as defaults</span>
                    {hasDefaultToggles && (
                        <span className="lumiverse-bindings-toggle-badge">Captured</span>
                    )}
                </div>
                <div className="lumiverse-bindings-toggle-actions">
                    <button
                        className="lumia-btn lumia-btn-secondary lumia-btn-sm"
                        onClick={handleRecaptureDefaults}
                        type="button"
                        title="Save current toggle states as the defaults to restore for unbound chats"
                    >
                        <RefreshCw size={12} strokeWidth={2} />
                        {compact ? 'Capture' : 'Capture Now'}
                    </button>
                </div>
            </div>

            <div className="lumiverse-bindings-defaults-info">
                <span>When auto-restore is on, unbound chats will revert to captured default toggles.</span>
            </div>
        </div>
    );

    // If no chat context, only show default state settings
    if (!hasContext) {
        return (
            <div className="lumiverse-bindings-toggles">
                <div className="lumiverse-bindings-no-context">
                    <ToggleLeft size={20} strokeWidth={1.5} />
                    <span>Select a character to bind prompt toggles</span>
                </div>
                {defaultStateSettingsSection}
            </div>
        );
    }

    return (
        <div className="lumiverse-bindings-toggles">
            <div className="lumiverse-bindings-toggles-info">
                <span>Save which prompts are enabled/disabled to auto-apply when switching to this chat or character.</span>
            </div>

            {/* Chat Toggle Binding */}
            <div className="lumiverse-bindings-toggle-row">
                <div className="lumiverse-bindings-toggle-label">
                    <MessageSquare size={14} strokeWidth={1.5} />
                    <span>This Chat</span>
                    {hasChatToggleBinding && (
                        <span className="lumiverse-bindings-toggle-badge">Bound</span>
                    )}
                </div>
                <div className="lumiverse-bindings-toggle-actions">
                    {hasChatToggleBinding ? (
                        <button
                            className="lumia-btn lumia-btn-danger lumia-btn-sm"
                            onClick={handleClearChatToggleBinding}
                            type="button"
                        >
                            <Trash2 size={12} strokeWidth={2} />
                            Clear
                        </button>
                    ) : (
                        <button
                            className="lumia-btn lumia-btn-primary lumia-btn-sm"
                            onClick={handleSaveTogglesToChat}
                            disabled={!contextInfo.chatId}
                            type="button"
                        >
                            <ToggleRight size={12} strokeWidth={2} />
                            {compact ? 'Bind' : 'Bind Toggles'}
                        </button>
                    )}
                </div>
            </div>

            {/* Character Toggle Binding */}
            <div className="lumiverse-bindings-toggle-row">
                <div className="lumiverse-bindings-toggle-label">
                    <User size={14} strokeWidth={1.5} />
                    <span>{contextInfo.characterName || 'Character'}</span>
                    {hasCharacterToggleBinding && (
                        <span className="lumiverse-bindings-toggle-badge">Bound</span>
                    )}
                </div>
                <div className="lumiverse-bindings-toggle-actions">
                    {hasCharacterToggleBinding ? (
                        <button
                            className="lumia-btn lumia-btn-danger lumia-btn-sm"
                            onClick={handleClearCharacterToggleBinding}
                            type="button"
                        >
                            <Trash2 size={12} strokeWidth={2} />
                            Clear
                        </button>
                    ) : (
                        <button
                            className="lumia-btn lumia-btn-primary lumia-btn-sm"
                            onClick={handleSaveTogglesToCharacter}
                            disabled={!contextInfo.characterAvatar}
                            type="button"
                        >
                            <ToggleRight size={12} strokeWidth={2} />
                            {compact ? 'Bind' : 'Bind Toggles'}
                        </button>
                    )}
                </div>
            </div>

            <div className="lumiverse-bindings-toggles-priority">
                <span>Priority: Chat &gt; Character (chat binding applied first)</span>
            </div>

            {defaultStateSettingsSection}
        </div>
    );
}

export default ToggleBindingsContent;
