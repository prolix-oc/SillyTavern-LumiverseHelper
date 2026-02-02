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

    if (!hasContext) {
        return (
            <div className="lumiverse-bindings-no-context">
                <ToggleLeft size={20} strokeWidth={1.5} />
                <span>Select a character to bind prompt toggles</span>
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
        </div>
    );
}

export default ToggleBindingsContent;
