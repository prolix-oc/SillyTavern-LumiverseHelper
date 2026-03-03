/**
 * Hook for image generation settings management.
 * Follows the useConnectionManager pattern.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { useLumiverseStore, useLumiverseActions, saveToExtensionImmediate } from '../store/LumiverseContext';
import { generateManually, clearSceneBackground, abortImageGeneration } from '../../lib/imageGenService.js';

const store = useLumiverseStore;

// Stable selectors
const selectImageGeneration = () => store.getState().imageGeneration || {};
const selectSceneBackground = () => store.getState().sceneBackground;
const selectSceneGenerating = () => store.getState().sceneGenerating || false;
const selectLastSceneParams = () => store.getState().lastSceneParams;

export function useImageGenSettings() {
    const actions = useLumiverseActions();

    const settings = useSyncExternalStore(store.subscribe, selectImageGeneration, selectImageGeneration);
    const sceneBackground = useSyncExternalStore(store.subscribe, selectSceneBackground, selectSceneBackground);
    const sceneGenerating = useSyncExternalStore(store.subscribe, selectSceneGenerating, selectSceneGenerating);
    const lastSceneParams = useSyncExternalStore(store.subscribe, selectLastSceneParams, selectLastSceneParams);

    const updateSettings = useCallback((updates) => {
        actions.updateImageGenSettings(updates);
    }, [actions]);

    const updateGoogleSettings = useCallback((updates) => {
        actions.updateImageGenSettings({ google: updates });
    }, [actions]);

    const updateNanoGptSettings = useCallback((updates) => {
        actions.updateImageGenSettings({ nanogpt: updates });
    }, [actions]);

    const updateNovelAiSettings = useCallback((updates) => {
        actions.updateImageGenSettings({ novelai: updates });
    }, [actions]);

    const triggerGeneration = useCallback(async () => {
        const result = await generateManually();
        return result;
    }, []);

    const cancelGeneration = useCallback(() => {
        abortImageGeneration();
    }, []);

    const clearBackground = useCallback(async () => {
        await clearSceneBackground(true);
    }, []);

    const addReferenceImage = useCallback((imageData) => {
        const provider = store.getState().imageGeneration?.provider || 'google_gemini';
        const providerKey = provider === 'nanogpt' ? 'nanogpt' : provider === 'novelai' ? 'novelai' : 'google';
        const current = store.getState().imageGeneration?.[providerKey]?.referenceImages || [];
        if (current.length >= 14) return;
        const updated = [...current, imageData];
        actions.updateImageGenSettings({
            [providerKey]: { referenceImages: updated },
        });
    }, [actions]);

    const removeReferenceImage = useCallback((imageId, index) => {
        const provider = store.getState().imageGeneration?.provider || 'google_gemini';
        const providerKey = provider === 'nanogpt' ? 'nanogpt' : provider === 'novelai' ? 'novelai' : 'google';
        const current = store.getState().imageGeneration?.[providerKey]?.referenceImages || [];
        // Filter by stable ID when available; fall back to index for legacy images without id
        const updated = imageId
            ? current.filter(img => img.id !== imageId)
            : current.filter((_, i) => i !== index);
        actions.updateImageGenSettings({
            [providerKey]: { referenceImages: updated },
        });
    }, [actions]);

    return {
        settings,
        sceneBackground,
        sceneGenerating,
        lastSceneParams,
        updateSettings,
        updateGoogleSettings,
        updateNanoGptSettings,
        updateNovelAiSettings,
        triggerGeneration,
        cancelGeneration,
        clearBackground,
        addReferenceImage,
        removeReferenceImage,
    };
}
