import { useState, useEffect, useCallback, useRef } from 'react';
import { useLumiverse, useLumiverseActions } from '../store/LumiverseContext';
import * as connService from '../../lib/connectionService';

/**
 * Hook for the Connection Manager component.
 * Connects connectionService <-> store <-> component.
 */
export function useConnectionManager() {
    const connectionManager = useLumiverse(s => s.connectionManager);
    const actions = useLumiverseActions();

    const registry = connectionManager?.registry || {};
    const activeProfileId = connectionManager?.activeProfileId || null;
    const bindings = connectionManager?.bindings || { characters: {}, chats: {} };

    // Local state for loaded profile content
    const [activeProfile, setActiveProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isApplying, setIsApplying] = useState(false);

    // Load active profile when activeProfileId changes
    useEffect(() => {
        if (!activeProfileId) {
            setActiveProfile(null);
            return;
        }
        let cancelled = false;
        setIsLoading(true);
        connService.loadProfile(activeProfileId).then(profile => {
            if (!cancelled) {
                setActiveProfile(profile);
                setIsLoading(false);
            }
        }).catch(err => {
            if (!cancelled) {
                console.warn('[ConnectionManager] Failed to load profile:', err);
                setError(err.message);
                setIsLoading(false);
            }
        });
        return () => { cancelled = true; };
    }, [activeProfileId]);

    // Refresh registry from packCache
    // Spread to create new object references — packCache returns the same cachedIndex
    // object each time, so useMemo([registry]) in the component would skip recomputation
    // without the spread.
    const refreshRegistry = useCallback(() => {
        actions.updateConnectionRegistry({ ...connService.getRegistry() });
        actions.updateConnectionBindings({ ...connService.getBindings() });
    }, [actions]);

    // CRUD operations
    const createProfile = useCallback(async (data) => {
        try {
            const profile = await connService.createProfile(data);
            refreshRegistry();
            return profile;
        } catch (err) {
            console.error('[ConnectionManager] Failed to create profile:', err);
            setError(err.message);
            return null;
        }
    }, [refreshRegistry]);

    const saveProfile = useCallback(async (profile) => {
        try {
            await connService.saveProfile(profile);
            setActiveProfile(profile);
            refreshRegistry();
            // If this is the active profile, re-apply so changes (e.g. endpoint URL) take effect
            if (profile.id && profile.id === activeProfileId) {
                await connService.applyProfile(profile.id);
            }
        } catch (err) {
            setError(err.message);
        }
    }, [refreshRegistry, activeProfileId]);

    const deleteProfileById = useCallback(async (profileId) => {
        try {
            await connService.deleteProfile(profileId);
            if (activeProfileId === profileId) {
                actions.setActiveConnectionProfile(null);
            }
            refreshRegistry();
        } catch (err) {
            setError(err.message);
        }
    }, [activeProfileId, actions, refreshRegistry]);

    const duplicateProfile = useCallback(async (profileId, newName) => {
        try {
            const duplicate = await connService.duplicateProfile(profileId, newName);
            refreshRegistry();
            return duplicate;
        } catch (err) {
            setError(err.message);
            return null;
        }
    }, [refreshRegistry]);

    const captureCurrentAsProfile = useCallback(async (name) => {
        try {
            const profile = await connService.captureCurrentAsProfile(name);
            refreshRegistry();
            console.log('[ConnectionManager] Profile captured and registry refreshed');
            return profile;
        } catch (err) {
            console.error('[ConnectionManager] Failed to capture profile:', err);
            setError(err.message);
            return null;
        }
    }, [refreshRegistry]);

    // Apply profile
    const applyProfile = useCallback(async (profileId) => {
        setIsApplying(true);
        try {
            const success = await connService.applyProfile(profileId);
            if (success) {
                refreshRegistry();
                // Reload the profile to reflect as active
                const profile = await connService.loadProfile(profileId);
                setActiveProfile(profile);
            }
            return success;
        } catch (err) {
            setError(err.message);
            return false;
        } finally {
            setIsApplying(false);
        }
    }, [refreshRegistry]);

    // Bindings
    const setCharacterBinding = useCallback(async (avatar, profileId) => {
        await connService.setCharacterBinding(avatar, profileId);
        refreshRegistry();
    }, [refreshRegistry]);

    const setChatBinding = useCallback(async (chatId, profileId) => {
        await connService.setChatBinding(chatId, profileId);
        refreshRegistry();
    }, [refreshRegistry]);

    // Migration
    const detectSTProfiles = useCallback(async () => {
        return await connService.detectSTProfiles();
    }, []);

    const migrateSTProfile = useCallback(async (stProfile) => {
        const profile = await connService.migrateSTProfile(stProfile);
        refreshRegistry();
        return profile;
    }, [refreshRegistry]);

    // Debounced save for inline edits
    const pendingSaveRef = useRef(null);
    const saveTimerRef = useRef(null);

    const debouncedSaveProfile = useCallback((profile) => {
        pendingSaveRef.current = profile;
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            const toSave = pendingSaveRef.current;
            if (toSave) {
                pendingSaveRef.current = null;
                await connService.saveProfile(toSave);
                refreshRegistry();
            }
        }, 400);
    }, [refreshRegistry]);

    // Flush on unmount
    useEffect(() => () => {
        clearTimeout(saveTimerRef.current);
        if (pendingSaveRef.current) {
            connService.saveProfile(pendingSaveRef.current);
        }
    }, []);

    return {
        // State
        registry,
        activeProfileId,
        bindings,
        activeProfile,
        isLoading,
        error,
        isApplying,

        // Constants
        PROVIDER_DEFAULTS: connService.PROVIDER_DEFAULTS,

        // CRUD
        createProfile,
        saveProfile,
        debouncedSaveProfile,
        deleteProfile: deleteProfileById,
        duplicateProfile,
        captureCurrentAsProfile,

        // Apply
        applyProfile,

        // Bindings
        setCharacterBinding,
        setChatBinding,

        // Migration
        detectSTProfiles,
        migrateSTProfile,

        // Refresh
        refreshRegistry,
    };
}
