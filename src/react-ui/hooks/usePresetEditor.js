
import { useState, useEffect, useCallback, useMemo } from 'react';
import { chatPresetService } from '../../lib/chatPresetService';

const CATEGORY_MARKER = '\u2501'; // ━

/**
 * Hook to manage preset editor state
 */
export function usePresetEditor() {
    const [currentPreset, setCurrentPreset] = useState(null);
    const [prompts, setPrompts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Load the currently active preset
    const loadCurrentPreset = useCallback(async () => {
        setIsLoading(true);
        try {
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

    // Save changes to the prompt list
    const savePrompts = useCallback(async (newPrompts) => {
        if (!currentPreset) return;
        setIsLoading(true);
        try {
            await chatPresetService.updatePrompts(newPrompts);
            setPrompts(newPrompts);
            // Reload to ensure sync
            loadCurrentPreset();
        } catch (err) {
            setError("Failed to save prompts");
            console.error(err);
        } finally {
            setIsLoading(false);
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

    // Initial load
    useEffect(() => {
        loadCurrentPreset();
    }, [loadCurrentPreset]);

    return {
        currentPreset,
        prompts,
        structuredPrompts,
        isLoading,
        error,
        refresh: loadCurrentPreset,
        savePrompts
    };
}
