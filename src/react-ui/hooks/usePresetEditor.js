
import { useState, useEffect, useCallback, useMemo } from 'react';
import { chatPresetService } from '../../lib/chatPresetService';

const CATEGORY_MARKER = '\u2501'; // ━

/**
 * Hook to manage preset editor state
 */
export function usePresetEditor() {
    const [currentPreset, setCurrentPreset] = useState(null);
    const [prompts, setPrompts] = useState([]);
    const [availablePresets, setAvailablePresets] = useState([]);
    const [toggleStateNames, setToggleStateNames] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Chat/Character binding status
    const [hasChatBinding, setHasChatBinding] = useState(false);
    const [hasCharacterBinding, setHasCharacterBinding] = useState(false);
    const [currentCharacterName, setCurrentCharacterName] = useState(null);

    // Load the currently active preset and list of available presets
    const loadCurrentPreset = useCallback(async () => {
        setIsLoading(true);
        try {
            // Load available presets list
            const presetsList = chatPresetService.getAvailablePresets();
            setAvailablePresets(presetsList);

            // Load toggle state names
            const stateNames = chatPresetService.getToggleStateNames();
            setToggleStateNames(stateNames);

            // Check binding status
            setHasChatBinding(chatPresetService.hasChatToggleState());
            setHasCharacterBinding(chatPresetService.hasCharacterToggleState());
            
            // Get character name for display
            const avatar = chatPresetService.getCurrentCharacterAvatar();
            if (avatar && typeof SillyTavern !== 'undefined') {
                const ctx = SillyTavern.getContext?.();
                if (ctx?.characters) {
                    const char = ctx.characters.find(c => c.avatar === avatar);
                    setCurrentCharacterName(char?.name || null);
                }
            } else {
                setCurrentCharacterName(null);
            }

            const preset = chatPresetService.getCurrentPreset();
            console.log('[usePresetEditor] Loaded preset:', preset);
            if (preset) {
                setCurrentPreset(preset);
                // Ensure every prompt has a unique UI ID for drag and drop
                const rawPrompts = preset.settings.prompts || [];
                console.log('[usePresetEditor] Raw prompts length:', rawPrompts.length);
                
                const loadedPrompts = rawPrompts.map(p => ({
                    ...p,
                    _uiId: p.identifier && p.identifier !== 'main' ? p.identifier : crypto.randomUUID()
                }));
                setPrompts(loadedPrompts);
            } else {
                setError("No active preset found");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Switch to a different preset
    const selectPreset = useCallback(async (name) => {
        setIsLoading(true);
        try {
            const success = await chatPresetService.selectPreset(name);
            if (success) {
                // Short delay to allow ST to update state if needed, though selectPreset is async
                await loadCurrentPreset();
            } else {
                setError(`Failed to select preset: ${name}`);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [loadCurrentPreset]);

    // Export current preset
    const exportPreset = useCallback(() => {
        if (!currentPreset) return;
        const json = chatPresetService.exportPreset(currentPreset.name);
        if (json) {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentPreset.name}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }, [currentPreset]);

    // Save changes to the prompt list
    // For toggle changes, also updates runtime prompt_order for immediate effect
    const savePrompts = useCallback(async (newPrompts, options = {}) => {
        if (!currentPreset) return;
        
        const oldPrompts = prompts;
        
        // Update UI state immediately for responsive feedback
        setPrompts(newPrompts);
        
        // Check if this is a toggle change (enabled state changed)
        // If so, update runtime prompt_order for immediate effect
        const toggleChanges = {};
        newPrompts.forEach((newPrompt, index) => {
            const oldPrompt = oldPrompts[index];
            if (oldPrompt && newPrompt.enabled !== oldPrompt.enabled) {
                const key = newPrompt.identifier || newPrompt.name;
                if (key) {
                    toggleChanges[key] = newPrompt.enabled;
                }
            }
        });

        // Apply toggle changes to runtime prompt_order if any
        if (Object.keys(toggleChanges).length > 0) {
            const result = chatPresetService.applyTogglesToPromptOrder(toggleChanges);
            if (result.matched > 0) {
                chatPresetService.refreshPromptManagerUI();
                console.log(`[usePresetEditor] Applied ${result.matched} toggle changes to runtime`);
            }
        }
        
        // Persist to ST preset file in background (for content/order changes)
        try {
            await chatPresetService.updatePrompts(newPrompts);
        } catch (err) {
            setError("Failed to save prompts");
            console.error('[usePresetEditor] Failed to persist prompts:', err);
            // Optionally reload to restore from ST on error
            loadCurrentPreset();
        }
    }, [currentPreset, prompts, loadCurrentPreset]);

    // Parse flat prompts into a hierarchical structure for rendering
    // This is purely for UI consumption; the source of truth is the flat list
    const structuredPrompts = useMemo(() => {
        const structure = [];
        let currentCategory = null;

        prompts.forEach((prompt, index) => {
            const isCategory = prompt.name.startsWith(CATEGORY_MARKER);
            
            if (isCategory) {
                currentCategory = {
                    ...prompt,
                    id: prompt.identifier || `prompt-${index}`,
                    originalIndex: index,
                    children: []
                };
                structure.push(currentCategory);
            } else {
                const item = {
                    ...prompt,
                    id: prompt.identifier || `prompt-${index}`,
                    originalIndex: index
                };

                if (currentCategory) {
                    currentCategory.children.push(item);
                } else {
                    // Items before any category go to root
                    structure.push(item);
                }
            }
        });

        return structure;
    }, [prompts]);

    // Save current toggle states with a name
    const saveToggleState = useCallback(async (stateName) => {
        if (!stateName || prompts.length === 0) return false;
        try {
            await chatPresetService.saveToggleState(stateName, prompts);
            // Refresh the list
            setToggleStateNames(chatPresetService.getToggleStateNames());
            return true;
        } catch (err) {
            setError(`Failed to save toggle state: ${err.message}`);
            return false;
        }
    }, [prompts]);

    // Apply a saved toggle state to current prompts (runtime approach)
    const applyToggleState = useCallback(async (stateName) => {
        if (!stateName) return null;
        try {
            // Use the runtime approach that modifies prompt_order directly
            const result = await chatPresetService.applyToggleStateToRuntime(stateName);
            
            if (result.applied) {
                // Reload the preset to reflect the new toggle states in UI
                await loadCurrentPreset();
            }
            
            return result;
        } catch (err) {
            setError(`Failed to apply toggle state: ${err.message}`);
            return null;
        }
    }, [loadCurrentPreset]);

    // Delete a saved toggle state
    const deleteToggleState = useCallback(async (stateName) => {
        try {
            await chatPresetService.deleteToggleState(stateName);
            setToggleStateNames(chatPresetService.getToggleStateNames());
            return true;
        } catch (err) {
            setError(`Failed to delete toggle state: ${err.message}`);
            return false;
        }
    }, []);

    // =========================================================================
    // CHAT/CHARACTER TOGGLE STATE BINDING
    // =========================================================================

    /**
     * Save current prompt toggle states to the current chat.
     * This creates a per-chat override that auto-applies when switching to this chat.
     */
    const saveTogglesToChat = useCallback(async () => {
        if (prompts.length === 0) return false;
        try {
            const success = await chatPresetService.saveToggleStateToChat(prompts);
            if (success) {
                setHasChatBinding(true);
            }
            return success;
        } catch (err) {
            setError(`Failed to save toggles to chat: ${err.message}`);
            return false;
        }
    }, [prompts]);

    /**
     * Clear the toggle state binding from the current chat.
     */
    const clearChatToggles = useCallback(() => {
        const success = chatPresetService.clearChatToggleState();
        if (success) {
            setHasChatBinding(false);
        }
        return success;
    }, []);

    /**
     * Save current prompt toggle states to the current character.
     * This creates a per-character override that auto-applies for all chats with this character.
     */
    const saveTogglesToCharacter = useCallback(async () => {
        if (prompts.length === 0) return false;
        try {
            const success = await chatPresetService.saveToggleStateToCharacter(prompts);
            if (success) {
                setHasCharacterBinding(true);
            }
            return success;
        } catch (err) {
            setError(`Failed to save toggles to character: ${err.message}`);
            return false;
        }
    }, [prompts]);

    /**
     * Clear the toggle state binding from the current character.
     */
    const clearCharacterToggles = useCallback(() => {
        const success = chatPresetService.clearCharacterToggleState();
        if (success) {
            setHasCharacterBinding(false);
        }
        return success;
    }, []);

    // Initial load
    useEffect(() => {
        loadCurrentPreset();
    }, [loadCurrentPreset]);

    return {
        currentPreset,
        prompts,
        availablePresets,
        toggleStateNames,
        structuredPrompts,
        isLoading,
        error,
        refresh: loadCurrentPreset,
        selectPreset,
        exportPreset,
        savePrompts,
        saveToggleState,
        applyToggleState,
        deleteToggleState,
        // Chat/Character binding
        hasChatBinding,
        hasCharacterBinding,
        currentCharacterName,
        saveTogglesToChat,
        clearChatToggles,
        saveTogglesToCharacter,
        clearCharacterToggles,
    };
}
