
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
    // Update UI immediately, then persist to ST in background
    const savePrompts = useCallback(async (newPrompts) => {
        if (!currentPreset) return;
        
        // Update UI state immediately for responsive feedback
        setPrompts(newPrompts);
        
        // Persist to ST in background (don't block UI)
        try {
            await chatPresetService.updatePrompts(newPrompts);
        } catch (err) {
            setError("Failed to save prompts");
            console.error('[usePresetEditor] Failed to persist prompts:', err);
            // Optionally reload to restore from ST on error
            loadCurrentPreset();
        }
    }, [currentPreset, loadCurrentPreset]);

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

    // Apply a saved toggle state to current prompts
    const applyToggleState = useCallback(async (stateName) => {
        if (!stateName || prompts.length === 0) return null;
        try {
            const result = await chatPresetService.applyToggleState(stateName, prompts);
            if (result.prompts) {
                // Update prompts with applied toggle states
                setPrompts(result.prompts);
                // Persist to ST
                await chatPresetService.updatePrompts(result.prompts);
            }
            return result;
        } catch (err) {
            setError(`Failed to apply toggle state: ${err.message}`);
            return null;
        }
    }, [prompts]);

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
    };
}
