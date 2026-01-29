/* global SillyTavern */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { LumiverseProvider, useLumiverseStore } from './store/LumiverseContext';
import App from './App';
import ViewportApp from './components/ViewportApp';
import './styles/main.css';

// Reference to the drawer header for dynamic updates
let accordionHeaderElement = null;

// Check for React conflicts early (helps debug Error #158)
function checkReactConflicts() {
    if (typeof window !== 'undefined' && window.React && window.React !== React) {
        console.warn(
            '[LumiverseUI] Warning: Multiple React instances detected. ' +
            'This may cause "Invalid hook call" errors (Error #158). ' +
            'The extension bundles its own React to ensure compatibility.'
        );
        return true;
    }
    return false;
}

// Run conflict check immediately
const hasReactConflict = checkReactConflicts();

// Determine if we're in development mode for StrictMode wrapper
const isDev = process.env.NODE_ENV === 'development';

// Store references to mounted React roots for cleanup
const mountedRoots = new Map();

// Store initial settings passed from the extension
let initialExtensionSettings = null;

/**
 * Mount the main Lumiverse settings panel into the extensions settings area
 * Uses ST's inline-drawer (accordion) structure for proper integration
 * @param {string} containerId - The ID of the container element
 * @param {Object} settings - Initial settings from the extension
 * @returns {Function} Cleanup function to unmount
 */
function mountSettingsPanel(containerId = 'lumiverse-settings-root', settings = null) {
    // Store initial settings for the provider
    if (settings) {
        initialExtensionSettings = settings;
        // Sync to store immediately
        useLumiverseStore.syncFromExtension(settings);
    }

    const existingRoot = document.getElementById(containerId);
    if (existingRoot) {
        console.warn('[LumiverseUI] Settings panel already mounted');
        return () => unmount(containerId);
    }

    const container = document.getElementById('extensions_settings');
    if (!container) {
        console.error('[LumiverseUI] Could not find #extensions_settings container');
        return null;
    }

    // Create ST's inline-drawer (accordion) wrapper structure
    const drawerWrapper = document.createElement('div');
    drawerWrapper.className = 'lumia-injector-settings';

    const drawer = document.createElement('div');
    drawer.className = 'inline-drawer';

    // Create the accordion header (toggle)
    const drawerHeader = document.createElement('div');
    drawerHeader.className = 'inline-drawer-toggle inline-drawer-header';
    drawerHeader.innerHTML = `
        <b>Lumiverse Helper</b>
        <span id="lumiverse-accordion-update-badge" class="lumiverse-accordion-badge" style="display: none;">New!</span>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    `;
    
    // Store reference for dynamic updates
    accordionHeaderElement = drawerHeader;

    // Create the accordion content area
    const drawerContent = document.createElement('div');
    drawerContent.className = 'inline-drawer-content';

    // Create the React root inside the drawer content
    const rootElement = document.createElement('div');
    rootElement.id = containerId;
    drawerContent.appendChild(rootElement);

    // Assemble the drawer structure
    drawer.appendChild(drawerHeader);
    drawer.appendChild(drawerContent);
    drawerWrapper.appendChild(drawer);
    container.appendChild(drawerWrapper);

    const root = ReactDOM.createRoot(rootElement);
    // Use StrictMode only in development to avoid double-rendering issues in production
    const Wrapper = isDev ? React.StrictMode : React.Fragment;
    root.render(
        <Wrapper>
            <LumiverseProvider initialSettings={initialExtensionSettings}>
                <App />
            </LumiverseProvider>
        </Wrapper>
    );

    // Store reference to the outer wrapper for cleanup
    mountedRoots.set(containerId, { root, element: drawerWrapper });
    console.log('[LumiverseUI] Settings panel mounted with inline-drawer accordion');

    return () => unmount(containerId);
}

/**
 * Mount a React component into a specific container
 * @param {React.Component} Component - The component to mount
 * @param {HTMLElement} container - The DOM container
 * @param {Object} props - Props to pass to the component
 * @param {string} id - Unique identifier for this mount
 * @returns {Function} Cleanup function
 */
function mountComponent(Component, container, props = {}, id = null) {
    const mountId = id || `lumiverse-mount-${Date.now()}`;

    if (mountedRoots.has(mountId)) {
        console.warn(`[LumiverseUI] Component ${mountId} already mounted`);
        return () => unmount(mountId);
    }

    const rootElement = document.createElement('div');
    rootElement.id = mountId;
    rootElement.className = 'lumiverse-react-root';
    container.appendChild(rootElement);

    const root = ReactDOM.createRoot(rootElement);
    // Use StrictMode only in development to avoid double-rendering issues in production
    const Wrapper = isDev ? React.StrictMode : React.Fragment;
    root.render(
        <Wrapper>
            <LumiverseProvider>
                <Component {...props} />
            </LumiverseProvider>
        </Wrapper>
    );

    mountedRoots.set(mountId, { root, element: rootElement });
    return () => unmount(mountId);
}

/**
 * Unmount a previously mounted React component
 * @param {string} mountId - The ID used when mounting
 */
function unmount(mountId) {
    const mounted = mountedRoots.get(mountId);
    if (mounted) {
        mounted.root.unmount();
        mounted.element.remove();
        mountedRoots.delete(mountId);
        console.log(`[LumiverseUI] Unmounted ${mountId}`);
    }
}

/**
 * Unmount all React components
 */
function unmountAll() {
    for (const [mountId] of mountedRoots) {
        unmount(mountId);
    }
}

/**
 * Get the SillyTavern context (for use in components)
 */
function getSTContext() {
    if (typeof SillyTavern !== 'undefined') {
        return SillyTavern.getContext();
    }
    console.warn('[LumiverseUI] SillyTavern context not available');
    return null;
}

/**
 * Sync settings from the extension to the React store
 * Called when settings change on the extension side
 * @param {Object} settings - Settings in React format
 */
function syncSettings(settings) {
    if (settings) {
        const packCount = settings.packs ? Object.keys(settings.packs).length : 0;
        console.log('[LumiverseUI] syncSettings called with:', {
            packsCount: packCount,
            customPacksCount: settings.customPacks?.length || 0,
        });
        useLumiverseStore.syncFromExtension(settings);
        // Verify the sync worked
        const newState = useLumiverseStore.getState();
        const newPackCount = newState.packs ? Object.keys(newState.packs).length : 0;
        console.log('[LumiverseUI] After sync, store has:', {
            packsCount: newPackCount,
            customPacksCount: newState.customPacks?.length || 0,
        });
    } else {
        console.warn('[LumiverseUI] syncSettings called with null/undefined settings');
    }
}

/**
 * Update the accordion header badge to show update notification
 * @param {boolean} hasUpdates - Whether there are updates available
 * @param {string} badgeText - Text to show in the badge (default: "New!")
 */
function updateAccordionBadge(hasUpdates, badgeText = 'New!') {
    const badge = document.getElementById('lumiverse-accordion-update-badge');
    if (badge) {
        badge.style.display = hasUpdates ? 'inline-flex' : 'none';
        badge.textContent = badgeText;
    }
}

/**
 * Get current state from the React store
 * For the extension to read current UI state
 * @returns {Object} Current state
 */
function getState() {
    return useLumiverseStore.exportForExtension();
}

/**
 * Subscribe to store changes
 * @param {Function} callback - Called when state changes
 * @returns {Function} Unsubscribe function
 */
function subscribe(callback) {
    return useLumiverseStore.subscribe(callback);
}

/**
 * Get the raw Zustand store (for advanced use)
 * @returns {Object} Zustand store
 */
function getStore() {
    return useLumiverseStore;
}

/**
 * Mount the viewport panel (dockable sidebar with profile, browser, analytics)
 * Following the BunnyMo/Loom Summary button pattern for reliable fixed positioning
 * @param {Object} settings - Initial settings from the extension
 * @returns {Function} Cleanup function to unmount
 */
function mountViewportPanel(settings = null) {
    const mountId = 'lumiverse-viewport-root';

    // Remove existing if any (following summary button pattern)
    const existing = document.getElementById(mountId);
    if (existing) {
        existing.remove();
        mountedRoots.delete(mountId);
    }

    // Store initial settings for the provider
    if (settings) {
        useLumiverseStore.syncFromExtension(settings);
    }

    // Create container at body level for proper fixed positioning
    // Apply critical positioning styles inline to ensure they take effect (BunnyMo pattern)
    const rootElement = document.createElement('div');
    rootElement.id = mountId;
    rootElement.className = 'lumiverse-react-root lumiverse-viewport-container';

    // Inline styles for reliable fixed positioning - container is just a wrapper
    // The actual panel positioning is handled by the React component
    rootElement.style.position = 'fixed';
    rootElement.style.top = '0';
    rootElement.style.right = '0';
    rootElement.style.bottom = '0';
    rootElement.style.left = 'auto';
    rootElement.style.zIndex = '9998';
    rootElement.style.pointerEvents = 'none'; // Let clicks pass through to elements below

    // Append directly to document.body for proper fixed positioning
    document.body.appendChild(rootElement);

    const root = ReactDOM.createRoot(rootElement);
    // Use StrictMode only in development to avoid double-rendering issues in production
    const Wrapper = isDev ? React.StrictMode : React.Fragment;
    root.render(
        <Wrapper>
            <LumiverseProvider initialSettings={settings}>
                <ViewportApp />
            </LumiverseProvider>
        </Wrapper>
    );

    mountedRoots.set(mountId, { root, element: rootElement });
    console.log('[LumiverseUI] Viewport panel mounted with inline positioning');

    return () => unmount(mountId);
}

// Export the public API
const LumiverseUI = {
    // Mounting
    mountSettingsPanel,
    mountViewportPanel,
    mountComponent,
    unmount,
    unmountAll,

    // State sync
    syncSettings,
    getState,
    subscribe,
    getStore,

    // Update notifications
    updateAccordionBadge,

    // SillyTavern integration
    getSTContext,
};

// Log when the bundle loads
console.log('[LumiverseUI] Bundle loaded, API available:', Object.keys(LumiverseUI));

// Explicitly assign to window for reliable global access
// (webpack library config should do this, but being explicit ensures it works)
if (typeof window !== 'undefined') {
    window.LumiverseUI = LumiverseUI;
}

export default LumiverseUI;
