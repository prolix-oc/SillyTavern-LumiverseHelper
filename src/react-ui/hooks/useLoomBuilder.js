import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLumiverse, useLumiverseActions } from '../store/LumiverseContext';
import * as loomService from '../../lib/lucidLoomService';
import {
    DEFAULT_SAMPLER_OVERRIDES,
    DEFAULT_CUSTOM_BODY,
    DEFAULT_PROMPT_BEHAVIOR,
    DEFAULT_COMPLETION_SETTINGS,
    DEFAULT_ADVANCED_SETTINGS,
    SAMPLER_PARAMS,
    detectConnectionProfile,
} from '../../lib/lucidLoomService';
import { handleLoomPresetTransition } from '../../lib/oaiPresetSync';

/**
 * Hook for the Loom Builder component.
 * Connects lucidLoomService ↔ store ↔ component.
 */
export function useLoomBuilder() {
    const loomBuilder = useLumiverse(s => s.loomBuilder);
    const actions = useLumiverseActions();

    const registry = loomBuilder?.registry || {};
    const activePresetId = loomBuilder?.activePresetId || null;
    const bindings = loomBuilder?.bindings || { characters: {}, chats: {} };
    const tokenUsage = loomBuilder?.tokenUsage || null;

    // Local state for loaded preset content
    const [activePreset, setActivePreset] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Load active preset when activePresetId changes
    useEffect(() => {
        if (!activePresetId) {
            setActivePreset(null);
            return;
        }
        let cancelled = false;
        setIsLoading(true);
        loomService.loadPreset(activePresetId).then(preset => {
            if (!cancelled) {
                setActivePreset(preset);
                setIsLoading(false);
            }
        }).catch(err => {
            if (!cancelled) {
                console.warn('[LoomBuilder] Failed to load preset:', err);
                setError(err.message);
                setIsLoading(false);
            }
        });
        return () => { cancelled = true; };
    }, [activePresetId]);

    // Refresh registry from packCache
    const refreshRegistry = useCallback(() => {
        const reg = loomService.listPresets();
        actions.updateLoomRegistry(reg);
    }, [actions]);

    // Create a new preset
    const createPreset = useCallback(async (name, description) => {
        setIsLoading(true);
        try {
            const preset = await loomService.createPreset(name, description);
            refreshRegistry();
            loomService.setActivePreset(preset.id);
            actions.setActiveLoomPreset(preset.id);
            setActivePreset(preset);
            return preset;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [actions, refreshRegistry]);

    // Load and activate a preset by ID
    const selectPreset = useCallback(async (presetId) => {
        setIsLoading(true);
        try {
            const preset = await loomService.loadPreset(presetId);
            loomService.setActivePreset(presetId);
            actions.setActiveLoomPreset(presetId);
            setActivePreset(preset);
            if (preset) handleLoomPresetTransition(presetId, preset);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [actions]);

    // Save the active preset's blocks
    const saveBlocks = useCallback(async (blocks) => {
        if (!activePreset) return;
        const updated = { ...activePreset, blocks };
        setActivePreset(updated);
        await loomService.savePreset(updated);
        refreshRegistry();
    }, [activePreset, refreshRegistry]);

    // Delete a preset
    const deletePresetById = useCallback(async (presetId) => {
        await loomService.deletePreset(presetId);
        refreshRegistry();
        if (presetId === activePresetId) {
            actions.setActiveLoomPreset(null);
            setActivePreset(null);
            handleLoomPresetTransition(null, null);
        }
    }, [activePresetId, actions, refreshRegistry]);

    // Duplicate a preset
    const duplicatePreset = useCallback(async (presetId, newName) => {
        setIsLoading(true);
        try {
            const newPreset = await loomService.duplicatePreset(presetId, newName);
            refreshRegistry();
            loomService.setActivePreset(newPreset.id);
            actions.setActiveLoomPreset(newPreset.id);
            setActivePreset(newPreset);
            return newPreset;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [actions, refreshRegistry]);

    // Block manipulation helpers
    const addBlock = useCallback((block, index) => {
        if (!activePreset) return;
        const blocks = [...activePreset.blocks];
        if (typeof index === 'number') {
            blocks.splice(index, 0, block);
        } else {
            blocks.push(block);
        }
        saveBlocks(blocks);
    }, [activePreset, saveBlocks]);

    const removeBlock = useCallback((blockId) => {
        if (!activePreset) return;
        const blocks = activePreset.blocks.filter(b => b.id !== blockId);
        saveBlocks(blocks);
    }, [activePreset, saveBlocks]);

    const updateBlock = useCallback((blockId, updates) => {
        if (!activePreset) return;
        const blocks = activePreset.blocks.map(b =>
            b.id === blockId ? { ...b, ...updates } : b
        );
        saveBlocks(blocks);
    }, [activePreset, saveBlocks]);

    const toggleBlock = useCallback((blockId) => {
        if (!activePreset) return;
        const blocks = activePreset.blocks.map(b =>
            b.id === blockId ? { ...b, enabled: !b.enabled } : b
        );
        saveBlocks(blocks);
    }, [activePreset, saveBlocks]);

    const reorderBlocks = useCallback((fromIndex, toIndex) => {
        if (!activePreset) return;
        const blocks = [...activePreset.blocks];
        const [moved] = blocks.splice(fromIndex, 1);
        blocks.splice(toIndex, 0, moved);
        saveBlocks(blocks);
    }, [activePreset, saveBlocks]);

    // Import from ST preset
    const importFromST = useCallback(async (stPresetData, name) => {
        setIsLoading(true);
        try {
            const preset = await loomService.importFromSTPreset(stPresetData, name);
            refreshRegistry();
            loomService.setActivePreset(preset.id);
            actions.setActiveLoomPreset(preset.id);
            setActivePreset(preset);
            return preset;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [actions, refreshRegistry]);

    // Import from file (internal JSON format)
    const importFromFile = useCallback(async (jsonData) => {
        setIsLoading(true);
        try {
            const preset = await loomService.importFromFile(jsonData);
            refreshRegistry();
            loomService.setActivePreset(preset.id);
            actions.setActiveLoomPreset(preset.id);
            setActivePreset(preset);
            return preset;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [actions, refreshRegistry]);

    // Export to ST format
    const exportToST = useCallback(() => {
        if (!activePreset) return null;
        return loomService.exportToSTFormat(activePreset);
    }, [activePreset]);

    // Export internal JSON
    const exportInternal = useCallback(() => {
        return activePreset;
    }, [activePreset]);

    // Available macros for the inserter
    const availableMacros = useMemo(() => loomService.getAvailableMacros(), []);

    // Connection profile detection (cached, refreshed on preset change)
    const [connectionProfile, setConnectionProfile] = useState(() => detectConnectionProfile());
    useEffect(() => {
        setConnectionProfile(detectConnectionProfile());
    }, [activePresetId]);

    // Refresh connection profile on demand (e.g., when user opens the settings panel)
    const refreshConnectionProfile = useCallback(() => {
        setConnectionProfile(detectConnectionProfile());
    }, []);

    // Watch for model profile switches from index.js (via store._profileSwitchTs)
    const profileSwitchTs = loomBuilder?._profileSwitchTs || 0;
    useEffect(() => {
        if (!activePresetId || !profileSwitchTs) return;
        // Re-load the preset to get updated samplerOverrides from the profile switch
        loomService.loadPreset(activePresetId).then(preset => {
            if (preset) setActivePreset(preset);
        });
        refreshConnectionProfile();
    }, [profileSwitchTs, activePresetId, refreshConnectionProfile]);

    // Watch for block toggle binding application from index.js (via store._blockToggleTs)
    const blockToggleTs = loomBuilder?._blockToggleTs || 0;
    useEffect(() => {
        if (!activePresetId || !blockToggleTs) return;
        // Re-load the preset to pick up block enabled/disabled state changes
        loomService.loadPreset(activePresetId).then(preset => {
            if (preset) setActivePreset(preset);
        });
    }, [blockToggleTs, activePresetId]);

    // Debounced preset save — batches rapid changes (slider releases, typing)
    // into a single file write. State updates (setActivePreset) are immediate
    // for UI responsiveness; only the file I/O is deferred.
    const pendingSaveRef = useRef(null);
    const saveTimerRef = useRef(null);

    const debouncedSavePreset = useCallback((preset) => {
        pendingSaveRef.current = preset;
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            const toSave = pendingSaveRef.current;
            if (toSave) {
                pendingSaveRef.current = null;
                await loomService.savePreset(toSave);
            }
        }, 400);
    }, []);

    // Flush pending save on unmount
    useEffect(() => () => {
        clearTimeout(saveTimerRef.current);
        if (pendingSaveRef.current) {
            loomService.savePreset(pendingSaveRef.current);
        }
    }, []);

    // Save sampler overrides — immediate state update, debounced file I/O
    const saveSamplerOverrides = useCallback((overrides) => {
        if (!activePreset) return;
        const updated = { ...activePreset, samplerOverrides: { ...overrides } };
        setActivePreset(updated);
        debouncedSavePreset(updated);
    }, [activePreset, debouncedSavePreset]);

    // Save custom body — immediate state update, debounced file I/O
    const saveCustomBody = useCallback((customBody) => {
        if (!activePreset) return;
        const updated = { ...activePreset, customBody: { ...customBody } };
        setActivePreset(updated);
        debouncedSavePreset(updated);
    }, [activePreset, debouncedSavePreset]);

    // Save prompt behavior — immediate state update, debounced file I/O
    const savePromptBehavior = useCallback((updates) => {
        if (!activePreset) return;
        const updated = {
            ...activePreset,
            promptBehavior: { ...(activePreset.promptBehavior || DEFAULT_PROMPT_BEHAVIOR), ...updates },
        };
        setActivePreset(updated);
        debouncedSavePreset(updated);
    }, [activePreset, debouncedSavePreset]);

    // Save completion settings — immediate state update, debounced file I/O
    const saveCompletionSettings = useCallback((updates) => {
        if (!activePreset) return;
        const updated = {
            ...activePreset,
            completionSettings: { ...(activePreset.completionSettings || DEFAULT_COMPLETION_SETTINGS), ...updates },
        };
        setActivePreset(updated);
        debouncedSavePreset(updated);
    }, [activePreset, debouncedSavePreset]);

    // Save advanced settings — immediate state update, debounced file I/O
    const saveAdvancedSettings = useCallback((updates) => {
        if (!activePreset) return;
        const updated = {
            ...activePreset,
            advancedSettings: { ...(activePreset.advancedSettings || DEFAULT_ADVANCED_SETTINGS), ...updates },
        };
        setActivePreset(updated);
        debouncedSavePreset(updated);
    }, [activePreset, debouncedSavePreset]);

    return {
        // State
        registry,
        activePresetId,
        bindings,
        activePreset,
        isLoading,
        error,
        availableMacros,
        tokenUsage,

        // Connection profile
        connectionProfile,
        refreshConnectionProfile,

        // Sampler constants
        SAMPLER_PARAMS,
        DEFAULT_SAMPLER_OVERRIDES,
        DEFAULT_CUSTOM_BODY,
        DEFAULT_PROMPT_BEHAVIOR,
        DEFAULT_COMPLETION_SETTINGS,
        DEFAULT_ADVANCED_SETTINGS,

        // Preset CRUD
        createPreset,
        selectPreset,
        saveBlocks,
        deletePreset: deletePresetById,
        duplicatePreset,
        refreshRegistry,

        // Block manipulation
        addBlock,
        removeBlock,
        updateBlock,
        toggleBlock,
        reorderBlocks,

        // Sampler & body settings
        saveSamplerOverrides,
        saveCustomBody,

        // New setting groups
        savePromptBehavior,
        saveCompletionSettings,
        saveAdvancedSettings,

        // Import/Export
        importFromST,
        importFromFile,
        exportToST,
        exportInternal,
    };
}
