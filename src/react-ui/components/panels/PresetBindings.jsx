import React, { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import {
    Link2,
    Link2Off,
    User,
    MessageSquare,
    ChevronDown,
    X,
    Plus,
    Trash2,
    Settings2,
    FileJson,
    AlertTriangle
} from 'lucide-react';
import { usePresetBindings } from '../../hooks/usePresetBindings';

/* global toastr */

/**
 * Preset Bindings Panel - Quick status and actions for binding presets to characters/chats
 */
export function PresetBindingsPanel() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const {
        contextInfo,
        currentBinding,
        currentCharacterBinding,
        currentChatBinding,
        allBindings,
    } = usePresetBindings();

    const hasAnyBinding = allBindings.length > 0;
    const hasCurrentContext = contextInfo.characterAvatar || contextInfo.chatId;

    // Determine active binding status for current context
    const activeBindingLabel = useMemo(() => {
        if (!currentBinding.presetName) return null;
        const typeLabel = currentBinding.bindingType === 'chat' ? 'Chat' : 'Character';
        return `${typeLabel}: ${currentBinding.presetName}`;
    }, [currentBinding]);

    return (
        <>
            {/* Current Context Status */}
            <div className="lumiverse-bindings-status">
                {hasCurrentContext ? (
                    <>
                        <div className="lumiverse-bindings-context">
                            {contextInfo.characterName && (
                                <div className="lumiverse-bindings-context-item">
                                    <User size={12} strokeWidth={2} />
                                    <span className="lumiverse-bindings-context-label">Character:</span>
                                    <span className="lumiverse-bindings-context-value">{contextInfo.characterName}</span>
                                    {currentCharacterBinding && (
                                        <span className="lumiverse-bindings-context-bound">
                                            <Link2 size={10} />
                                            {currentCharacterBinding}
                                        </span>
                                    )}
                                </div>
                            )}
                            {contextInfo.chatId && (
                                <div className="lumiverse-bindings-context-item">
                                    <MessageSquare size={12} strokeWidth={2} />
                                    <span className="lumiverse-bindings-context-label">Chat:</span>
                                    <span className="lumiverse-bindings-context-value lumiverse-bindings-context-value--mono">
                                        {contextInfo.chatId.length > 25 
                                            ? contextInfo.chatId.slice(0, 25) + '...' 
                                            : contextInfo.chatId}
                                    </span>
                                    {currentChatBinding && (
                                        <span className="lumiverse-bindings-context-bound">
                                            <Link2 size={10} />
                                            {currentChatBinding}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        {activeBindingLabel && (
                            <div className="lumiverse-bindings-active">
                                <Link2 size={12} strokeWidth={2} />
                                <span>Active: {activeBindingLabel}</span>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="lumiverse-bindings-empty-context">
                        <User size={16} strokeWidth={1.5} />
                        <span>Select a character to manage bindings</span>
                    </div>
                )}
            </div>

            {/* Bindings Summary */}
            {hasAnyBinding && (
                <div className="lumiverse-bindings-summary">
                    <span className="lumiverse-bindings-summary-label">
                        <Link2 size={11} strokeWidth={2} />
                        {allBindings.length} binding{allBindings.length !== 1 ? 's' : ''} configured
                    </span>
                </div>
            )}

            {/* Manage Button */}
            <button
                className="lumia-btn lumia-btn-secondary lumia-btn-full"
                onClick={() => setIsModalOpen(true)}
                type="button"
            >
                <Settings2 size={14} strokeWidth={2} />
                Manage Bindings
            </button>

            {isModalOpen && (
                <PresetBindingsModal onClose={() => setIsModalOpen(false)} />
            )}
        </>
    );
}

/**
 * Preset Bindings Modal - Full management interface
 */
function PresetBindingsModal({ onClose }) {
    const {
        contextInfo,
        availablePresets,
        allBindings,
        currentCharacterBinding,
        currentChatBinding,
        bindCurrentCharacter,
        bindCurrentChat,
        removeCharacterBinding,
        removeChatBinding,
        refreshPresets,
    } = usePresetBindings();

    const [selectedPreset, setSelectedPreset] = useState('');
    const [bindingType, setBindingType] = useState('character');

    // Refresh presets on mount
    React.useEffect(() => {
        refreshPresets();
    }, [refreshPresets]);

    // Handle escape key
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    const handleBind = useCallback(() => {
        if (!selectedPreset) {
            toastr?.warning('Select a preset first');
            return;
        }

        let success = false;
        if (bindingType === 'character') {
            success = bindCurrentCharacter(selectedPreset);
            if (success) {
                toastr?.success(`Bound "${contextInfo.characterName}" to "${selectedPreset}"`);
            }
        } else {
            success = bindCurrentChat(selectedPreset);
            if (success) {
                toastr?.success(`Bound current chat to "${selectedPreset}"`);
            }
        }

        if (!success) {
            toastr?.error('No active context to bind');
        } else {
            setSelectedPreset('');
        }
    }, [selectedPreset, bindingType, bindCurrentCharacter, bindCurrentChat, contextInfo.characterName]);

    const handleRemoveBinding = useCallback((type, id) => {
        if (type === 'character') {
            removeCharacterBinding(id);
            toastr?.info('Character binding removed');
        } else {
            removeChatBinding(id);
            toastr?.info('Chat binding removed');
        }
    }, [removeCharacterBinding, removeChatBinding]);

    const handleBackdropClick = useCallback((e) => {
        if (e.target === e.currentTarget) onClose();
    }, [onClose]);

    const handleModalClick = useCallback((e) => {
        e.stopPropagation();
    }, []);

    const hasContext = contextInfo.characterAvatar || contextInfo.chatId;

    return createPortal(
        <div
            className="lumiverse-modal-backdrop"
            onClick={handleBackdropClick}
            onMouseDown={handleModalClick}
            onMouseUp={handleModalClick}
        >
            <div
                className="lumiverse-modal lumiverse-bindings-modal"
                onClick={handleModalClick}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="lumiverse-bindings-modal-header">
                    <div className="lumiverse-bindings-modal-header-info">
                        <span className="lumiverse-bindings-modal-header-icon">
                            <Link2 size={22} strokeWidth={1.5} />
                        </span>
                        <div className="lumiverse-bindings-modal-header-text">
                            <h3 className="lumiverse-bindings-modal-title">Preset Bindings</h3>
                            <p className="lumiverse-bindings-modal-subtitle">
                                Auto-switch presets when changing characters or chats
                            </p>
                        </div>
                    </div>
                    <button
                        className="lumiverse-bindings-modal-close"
                        onClick={onClose}
                        title="Close"
                        type="button"
                    >
                        <X size={18} strokeWidth={2} />
                    </button>
                </div>

                {/* Content */}
                <div className="lumiverse-bindings-modal-content">
                    {/* Create New Binding */}
                    <div className="lumiverse-bindings-section">
                        <div className="lumiverse-bindings-section-header">
                            <Plus size={14} strokeWidth={2} />
                            <span>Create Binding</span>
                        </div>

                        {hasContext ? (
                            <div className="lumiverse-bindings-create">
                                {/* Binding Type Toggle */}
                                <div className="lumiverse-bindings-type-toggle">
                                    <button
                                        className={clsx(
                                            'lumiverse-bindings-type-btn',
                                            bindingType === 'character' && 'is-active'
                                        )}
                                        onClick={() => setBindingType('character')}
                                        disabled={!contextInfo.characterAvatar}
                                        type="button"
                                    >
                                        <User size={14} strokeWidth={2} />
                                        Character
                                    </button>
                                    <button
                                        className={clsx(
                                            'lumiverse-bindings-type-btn',
                                            bindingType === 'chat' && 'is-active'
                                        )}
                                        onClick={() => setBindingType('chat')}
                                        disabled={!contextInfo.chatId}
                                        type="button"
                                    >
                                        <MessageSquare size={14} strokeWidth={2} />
                                        This Chat
                                    </button>
                                </div>

                                {/* Context Info */}
                                <div className="lumiverse-bindings-create-context">
                                    {bindingType === 'character' ? (
                                        <span>
                                            <User size={12} />
                                            {contextInfo.characterName || contextInfo.characterAvatar || 'No character'}
                                            {currentCharacterBinding && (
                                                <span className="lumiverse-bindings-create-existing">
                                                    (currently: {currentCharacterBinding})
                                                </span>
                                            )}
                                        </span>
                                    ) : (
                                        <span>
                                            <MessageSquare size={12} />
                                            {contextInfo.chatId 
                                                ? (contextInfo.chatId.length > 30 
                                                    ? contextInfo.chatId.slice(0, 30) + '...' 
                                                    : contextInfo.chatId)
                                                : 'No chat'}
                                            {currentChatBinding && (
                                                <span className="lumiverse-bindings-create-existing">
                                                    (currently: {currentChatBinding})
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </div>

                                {/* Preset Selector */}
                                <div className="lumiverse-bindings-create-row">
                                    <select
                                        className="lumiverse-bindings-select"
                                        value={selectedPreset}
                                        onChange={(e) => setSelectedPreset(e.target.value)}
                                    >
                                        <option value="">Select a preset...</option>
                                        {availablePresets.map((preset) => (
                                            <option key={preset} value={preset}>
                                                {preset}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        className="lumia-btn lumia-btn-primary"
                                        onClick={handleBind}
                                        disabled={!selectedPreset}
                                        type="button"
                                    >
                                        <Link2 size={14} strokeWidth={2} />
                                        Bind
                                    </button>
                                </div>

                                {availablePresets.length === 0 && (
                                    <div className="lumiverse-bindings-no-presets">
                                        <AlertTriangle size={14} strokeWidth={2} />
                                        <span>No presets available. Create one in SillyTavern first.</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="lumiverse-bindings-no-context">
                                <User size={20} strokeWidth={1.5} />
                                <span>Select a character to create bindings</span>
                            </div>
                        )}
                    </div>

                    {/* Existing Bindings List */}
                    <div className="lumiverse-bindings-section">
                        <div className="lumiverse-bindings-section-header">
                            <Link2 size={14} strokeWidth={2} />
                            <span>Active Bindings ({allBindings.length})</span>
                        </div>

                        {allBindings.length > 0 ? (
                            <div className="lumiverse-bindings-list">
                                {allBindings.map((binding) => (
                                    <div
                                        key={`${binding.type}-${binding.id}`}
                                        className="lumiverse-bindings-list-item"
                                    >
                                        <div className="lumiverse-bindings-list-item-icon">
                                            {binding.type === 'character' ? (
                                                <User size={14} strokeWidth={1.5} />
                                            ) : (
                                                <MessageSquare size={14} strokeWidth={1.5} />
                                            )}
                                        </div>
                                        <div className="lumiverse-bindings-list-item-info">
                                            <span className="lumiverse-bindings-list-item-name">
                                                {binding.displayName}
                                            </span>
                                            <span className="lumiverse-bindings-list-item-type">
                                                {binding.type === 'character' ? 'Character' : 'Chat'}
                                            </span>
                                        </div>
                                        <div className="lumiverse-bindings-list-item-preset">
                                            <FileJson size={12} strokeWidth={1.5} />
                                            {binding.presetName}
                                        </div>
                                        <button
                                            className="lumiverse-bindings-list-item-remove"
                                            onClick={() => handleRemoveBinding(binding.type, binding.id)}
                                            title="Remove binding"
                                            type="button"
                                        >
                                            <Trash2 size={14} strokeWidth={2} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="lumiverse-bindings-empty">
                                <Link2Off size={20} strokeWidth={1.5} />
                                <span>No bindings configured</span>
                                <span className="lumiverse-bindings-empty-hint">
                                    Bindings auto-switch presets when you change characters or chats
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Info Box */}
                    <div className="lumiverse-bindings-info">
                        <div className="lumiverse-bindings-info-title">How it works</div>
                        <ul className="lumiverse-bindings-info-list">
                            <li><strong>Chat bindings</strong> have higher priority than character bindings</li>
                            <li>When you switch to a character/chat with a binding, the preset auto-switches</li>
                            <li>If a bound preset is deleted, the binding is automatically removed</li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="lumiverse-bindings-modal-footer">
                    <button
                        className="lumiverse-bindings-modal-btn lumiverse-bindings-modal-btn--primary"
                        onClick={onClose}
                        type="button"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default PresetBindingsPanel;
