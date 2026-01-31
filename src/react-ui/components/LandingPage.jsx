import React, { useState, useEffect, useCallback, useLayoutEffect, useSyncExternalStore, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Clock, Sparkles, Users, Package, RefreshCw, Compass, Loader2 } from 'lucide-react';
import { landingPageStyles } from './LandingPageStyles.js';
import { useLumiverseStore } from '../store/LumiverseContext';
import { getTopBarHeight } from '../../lib/domUtils.js';

/* global toastr */

/**
 * Landing Page Component
 *
 * A full-screen glassmorphic landing page displaying recent chats as cards.
 * Hides the default #sheld and creates an immersive Apple-esque experience.
 *
 * Uses CSS-in-JS (injected styles) to prevent stylesheet loading failures.
 */

// Stable selector
const selectLandingPageChatsDisplayed = () => useLumiverseStore.getState().landingPageChatsDisplayed ?? 12;

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(timestamp) {
    if (!timestamp) return 'Unknown';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Get avatar URL for a character or group
 */
async function getAvatarUrl(item) {
    if (!item) return '/img/fa-solid-user.svg';

    // Groups have members array and use avatar_url
    if (item.members || item.is_group) {
        return item.avatar_url || '/img/fa-solid-groups.svg';
    }

    // Characters use getThumbnailUrl for optimized thumbnails
    if (item.avatar) {
        try {
            const { getThumbnailUrl: stGetThumbnailUrl } = await import(/* webpackIgnore: true */ '../../../../../script.js');
            if (stGetThumbnailUrl) {
                return stGetThumbnailUrl('avatar', item.avatar);
            }
        } catch (err) {
            console.warn('[Lumiverse] Failed to import getThumbnailUrl, using fallback:', err);
        }
        return `/characters/${encodeURIComponent(item.avatar)}`;
    }

    return '/img/fa-solid-user.svg';
}

// Animation Variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.1
        }
    },
    exit: { opacity: 0 }
};

const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { 
        opacity: 1, 
        y: 0, 
        scale: 1,
        transition: { 
            default: { type: "spring", stiffness: 300, damping: 24 },
            opacity: { duration: 0.3, ease: "easeOut" }
        }
    }
};

/**
 * Character/Group Card Component
 */
const ChatCard = React.memo(({ item, presetName, onClick, index }) => {
    const isGroup = item.members || item.is_group;
    const [avatarUrl, setAvatarUrl] = useState('/img/fa-solid-user.svg');
    const [isHovered, setIsHovered] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const shouldReduceMotion = useReducedMotion();

    // Derive stable keys for effect dependency to prevent unnecessary loading state resets
    // This prevents the spinner from flashing when the parent re-fetches identical data
    const stableAvatarKey = item.avatar || item.avatar_url;
    const stableIsGroup = !!(item.members || item.is_group);

    useEffect(() => {
        let cancelled = false;
        // Reset load state only when the underlying avatar source changes
        setImageLoaded(false);
        getAvatarUrl(item).then(url => {
            if (!cancelled) setAvatarUrl(url);
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stableAvatarKey, stableIsGroup]);

    return (
        <motion.div
            className="lumiverse-lp-card"
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            variants={cardVariants}
            whileHover={shouldReduceMotion ? {} : { y: -8, scale: 1.02, transition: { duration: 0.2 } }}
            whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
            layout={false} // Explicitly disable layout animations to prevent thrashing
            style={{ willChange: 'transform, opacity' }} // Performance hint
        >
            {/* Glass shimmer effect */}
            {!shouldReduceMotion && (
                <motion.div
                    className="lumiverse-lp-card-shimmer"
                    animate={{ opacity: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                />
            )}

            {/* Avatar Container */}
            <div className="lumiverse-lp-card-image-container">
                <div className="lumiverse-lp-card-glow" />
                {isGroup ? (
                    <div className="lumiverse-lp-card-avatar-group">
                        <Users size={32} strokeWidth={1.5} />
                    </div>
                ) : (
                    <>
                        {!imageLoaded && (
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1
                            }}>
                                <Loader2 className="lumiverse-lp-spin" size={24} color="rgba(255,255,255,0.5)" />
                            </div>
                        )}
                        <motion.img
                            src={avatarUrl}
                            alt={item.name}
                            className="lumiverse-lp-card-avatar"
                            draggable={false}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: imageLoaded ? 1 : 0 }}
                            transition={{ duration: 0.3 }}
                            onLoad={() => setImageLoaded(true)}
                            style={{
                                width: '75%',
                                height: '75%',
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'cover',
                                borderRadius: '50%'
                            }}
                            onError={(e) => { e.target.src = '/img/fa-solid-user.svg'; setImageLoaded(true); }}
                        />
                    </>
                )}

                {/* Time badge */}
                <div className="lumiverse-lp-card-time-badge">
                    <Clock size={10} strokeWidth={2} />
                    <span>{formatRelativeTime(item.date_last_chat)}</span>
                </div>
            </div>

            {/* Content */}
            <div className="lumiverse-lp-card-content">
                <h3 className="lumiverse-lp-card-name">{item.name || 'Unnamed'}</h3>

                <div className="lumiverse-lp-card-meta">
                    {presetName && (
                        <span className="lumiverse-lp-card-badge lumiverse-lp-card-badge-preset">
                            <Sparkles size={10} strokeWidth={2} />
                            {presetName}
                        </span>
                    )}
                    {isGroup && (
                        <span className="lumiverse-lp-card-badge lumiverse-lp-card-badge-group">
                            <Users size={10} strokeWidth={2} />
                            Group
                        </span>
                    )}
                </div>
            </div>

            {/* Hover indicator */}
            {!shouldReduceMotion && (
                <motion.div
                    className="lumiverse-lp-card-indicator"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                />
            )}
        </motion.div>
    );
});

/**
 * Empty State Component
 */
function EmptyState() {
    return (
        <motion.div
            className="lumiverse-lp-empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
        >
            <div className="lumiverse-lp-empty-icon">
                <Compass size={64} strokeWidth={1} />
            </div>
            <h3>Begin Your Journey</h3>
            <p>No recent conversations found. Select a character to start a new adventure.</p>
        </motion.div>
    );
}

/**
 * Loading Skeleton Card
 */
function SkeletonCard({ index }) {
    return (
        <motion.div
            className="lumiverse-lp-card lumiverse-lp-skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
        >
            <div className="lumiverse-lp-skeleton-image" />
            <div className="lumiverse-lp-skeleton-content">
                <div className="lumiverse-lp-skeleton-line lumiverse-lp-skeleton-title" />
                <div className="lumiverse-lp-skeleton-line lumiverse-lp-skeleton-meta" />
            </div>
        </motion.div>
    );
}

/**
 * Main Landing Page Component
 */
function LandingPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [presetBindings, setPresetBindings] = useState({});
    const [paddingTop, setPaddingTop] = useState(50);
    const [isAppReady, setIsAppReady] = useState(!!window.lumiverseAppReady);
    const mountTimeRef = React.useRef(Date.now());

    // Get setting from store

    // Get setting from store
    const chatsDisplayed = useSyncExternalStore(
        useLumiverseStore.subscribe,
        selectLandingPageChatsDisplayed,
        selectLandingPageChatsDisplayed
    );

    // Inject styles and set padding, handle resize
    useLayoutEffect(() => {
        const updatePadding = () => {
            setPaddingTop(getTopBarHeight());
        };

        const updateGrid = () => {
            // Target ALL grid instances (loading or active) to ensure variables are set
            const grids = document.querySelectorAll('.lumiverse-lp-grid-cards');
            if (!grids.length) return;

            grids.forEach(grid => {
                // Use clientWidth to exclude scrollbar
                const containerWidth = grid.parentElement?.clientWidth || window.innerWidth;
                const gap = 20; // 20px gap from CSS
                
                // Dynamic sizing logic:
                // We want to maintain density on desktop.
                // Fixed minimum width ensures we just add more columns as space grows,
                // rather than making cards awkwardly large.
                const minCardWidth = 220;

                // Calculate exact width for perfect alignment
                // container = cols * width + (cols - 1) * gap
                // maxCols = floor((container + gap) / (minWidth + gap))
                const maxCols = Math.floor((containerWidth + gap) / (minCardWidth + gap));
                const cols = Math.max(1, maxCols); // At least 1 column
                
                // width = (container - (cols - 1) * gap) / cols
                const exactWidth = (containerWidth - (gap * (cols - 1))) / cols;
                
                // Subtract a tiny fraction (0.5px) to handle sub-pixel rounding errors in browsers
                grid.style.setProperty('--lumiverse-card-width', `${exactWidth - 0.5}px`);
            });
        };
        
        // Initial set
        updatePadding();
        
        // Listen for resizing
        const handleResize = () => {
            updatePadding();
            updateGrid();
        };

        window.addEventListener('resize', handleResize);
        
        // Use ResizeObserver for more robust container tracking
        const mainContent = document.querySelector('.lumiverse-lp-main');
        let observer = null;
        if (mainContent) {
            observer = new ResizeObserver(() => {
                updateGrid();
            });
            observer.observe(mainContent);
        }
        
        // Initial grid update (delayed slightly to ensure DOM is ready)
        setTimeout(updateGrid, 0);
        setTimeout(updateGrid, 100); // Secondary check for slow renders
        
        const styleId = 'lumiverse-landing-styles';
        if (!document.getElementById(styleId)) {
            const styleEl = document.createElement('style');
            styleEl.id = styleId;
            styleEl.textContent = landingPageStyles;
            document.head.appendChild(styleEl);
        }
        
        return () => {
            window.removeEventListener('resize', handleResize);
            if (observer) observer.disconnect();
        };
    }, []);

    // Re-run grid update when items change (to ensure grid exists)
    useEffect(() => {
        // Run updateGrid logic immediately after render
        const updateGrid = () => {
            const grids = document.querySelectorAll('.lumiverse-lp-grid-cards');
            if (grids.length) {
                // Dispatch event to trigger the main listener (simpler than duplicating logic)
                window.dispatchEvent(new Event('resize'));
            }
        };
        
        updateGrid();
        // Also retry after a frame to catch layout settle
        requestAnimationFrame(updateGrid);
    }, [items, loading]);

    // Fetch recent chats
    const fetchChats = useCallback(async (retryCount = 0) => {
        // Only set loading true on the very first attempt of a sequence
        if (retryCount === 0) setLoading(true);
        setError(null);

        try {
            const { characters, groups } = await import(/* webpackIgnore: true */ '../../../../../script.js');

            const mappedChars = (characters || []).map((char, index) => ({
                ...char,
                _type: 'character',
                _index: index,
                _sortDate: char.date_last_chat || 0,
            }));

            const mappedGroups = (groups || []).map(group => ({
                ...group,
                _type: 'group',
                _sortDate: group.date_last_chat || 0,
            }));

            const allItems = [...mappedChars, ...mappedGroups]
                .filter(item => item._sortDate > 0);

            const sortedItems = allItems
                .sort((a, b) => b._sortDate - a._sortDate)
                .slice(0, chatsDisplayed);
            
            // SMART RETRY LOGIC:
            // If we found no chats, and we are within the first 4 seconds of mounting,
            // assume ST might still be lazy-loading and retry.
            // This prevents the "Empty State" flash.
            if (sortedItems.length === 0 && (Date.now() - mountTimeRef.current < 4000) && retryCount < 8) {
                console.log(`[Lumiverse Landing] No items found, retrying (${retryCount + 1}/8)...`);
                setTimeout(() => fetchChats(retryCount + 1), 500);
                return; // Keep loading=true
            }

            setItems(sortedItems);
        } catch (err) {
            console.error('[Lumiverse] Error fetching chats:', err);
            setError(err.message);
        } finally {
            // Only turn off loading if we are NOT retrying
            // We check the same condition as above essentially
            const shouldRetry = false; // logic handled inside try block via return
            // If we reached here, we are done (success or error or gave up retrying)
            setLoading(false);
        }
    }, [chatsDisplayed]);

    // Fetch preset bindings
    const fetchPresetBindings = useCallback(async () => {
        try {
            const { getCachedIndex } = await import('../../lib/packCache.js');
            const index = getCachedIndex();
            if (index?.presetBindings) {
                setPresetBindings(index.presetBindings);
            }
        } catch (err) {
            console.warn('[Lumiverse] Could not fetch preset bindings:', err);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchChats();
        fetchPresetBindings();

        // Listen for external refresh triggers (e.g., from index.js on APP_READY)
        const handleRefresh = () => {
            console.log('[Lumiverse Landing] External refresh triggered');
            setIsAppReady(true);
            fetchChats();
        };
        window.addEventListener('lumiverse:landing-refresh', handleRefresh);

        // Fallback: If APP_READY never fires (or we missed it), force ready state after a timeout
        const fallbackTimer = setTimeout(() => {
            if (!window.lumiverseAppReady) {
                console.warn('[Lumiverse Landing] Force-enabling ready state (timeout)');
                setIsAppReady(true);
            }
        }, 4000);

        // Hide the sheld initially
        const sheld = document.querySelector('#sheld');
        if (sheld) {
            sheld.style.opacity = '0';
            sheld.style.pointerEvents = 'none';
        }

        return () => {
            clearTimeout(fallbackTimer);
            window.removeEventListener('lumiverse:landing-refresh', handleRefresh);
            
            // Restore sheld on unmount
            const sheld = document.querySelector('#sheld');
            if (sheld) {
                sheld.style.opacity = '';
                sheld.style.pointerEvents = '';
            }
        };
    }, [fetchChats, fetchPresetBindings]);

    // Get preset name
    const getCharacterPreset = useCallback((characterName) => {
        if (!characterName || !presetBindings) return null;
        const binding = presetBindings[characterName];
        return binding?.presetName || null;
    }, [presetBindings]);

    // Handle item click
    const handleItemClick = useCallback(async (item) => {
        try {
            if (item._type === 'group' || item.members) {
                const { openGroupById } = await import(/* webpackIgnore: true */ '../../../../group-chats.js');
                if (openGroupById && item.id) {
                    await openGroupById(item.id);
                }
            } else {
                const { selectCharacterById } = await import(/* webpackIgnore: true */ '../../../../../script.js');
                if (selectCharacterById && item._index !== undefined) {
                    await selectCharacterById(String(item._index));
                }
            }
        } catch (err) {
            console.error('[Lumiverse] Error opening chat:', err);
            toastr?.error('Failed to open chat');
        }
    }, []);

    return (
        <div className="lumiverse-lp-container" style={{ paddingTop: `${paddingTop}px`, pointerEvents: 'none' }}>
            {/* Ambient background effects */}
            <div className="lumiverse-lp-bg" style={{ top: `${paddingTop}px`, pointerEvents: 'auto' }}>
                <div className="lumiverse-lp-bg-glow lumiverse-lp-bg-glow-1" />
                <div className="lumiverse-lp-bg-glow lumiverse-lp-bg-glow-2" />
                <div className="lumiverse-lp-bg-glow lumiverse-lp-bg-glow-3" />
            </div>

            {/* Grid pattern overlay */}
            <div className="lumiverse-lp-grid" style={{ top: `${paddingTop}px`, pointerEvents: 'none' }} />

            {/* Main content */}
            <motion.div
                className="lumiverse-lp-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                style={{ pointerEvents: 'auto' }}
            >
                {/* Header */}
                <motion.header
                    className="lumiverse-lp-header"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    <div className="lumiverse-lp-header-left">
                        <div className="lumiverse-lp-logo">
                            <div className="lumiverse-lp-logo-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="28" height="28" className="lumiverse-spool-icon">
                                    <g transform="rotate(-12, 32, 32)">
                                        <ellipse cx="32" cy="12" rx="18" ry="6" fill="#8B5A2B"/>
                                        <ellipse cx="32" cy="12" rx="14" ry="4" fill="#A0522D"/>
                                        <rect x="14" y="12" width="36" height="40" fill="#8B5FC7"/>
                                        <line x1="14" y1="18" x2="50" y2="18" stroke="#7A4EB8" strokeWidth="1.5"/>
                                        <line x1="14" y1="24" x2="50" y2="24" stroke="#7A4EB8" strokeWidth="1.5"/>
                                        <line x1="14" y1="30" x2="50" y2="30" stroke="#7A4EB8" strokeWidth="1.5"/>
                                        <line x1="14" y1="36" x2="50" y2="36" stroke="#7A4EB8" strokeWidth="1.5"/>
                                        <line x1="14" y1="42" x2="50" y2="42" stroke="#7A4EB8" strokeWidth="1.5"/>
                                        <line x1="14" y1="48" x2="50" y2="48" stroke="#7A4EB8" strokeWidth="1.5"/>
                                        <rect x="14" y="12" width="8" height="40" fill="#A78BD4" opacity="0.5"/>
                                        <ellipse cx="32" cy="52" rx="18" ry="6" fill="#8B5A2B"/>
                                        <rect x="14" y="48" width="36" height="4" fill="#8B5FC7"/>
                                        <ellipse cx="32" cy="52" rx="14" ry="4" fill="#A0522D"/>
                                        <ellipse cx="32" cy="52" rx="5" ry="2" fill="#5D3A1A"/>
                                        <path d="M 48 35 Q 55 38 52 45 Q 49 52 56 58" fill="none" stroke="#8B5FC7" strokeWidth="2" strokeLinecap="round"/>
                                    </g>
                                </svg>
                            </div>
                            <div className="lumiverse-lp-logo-text">
                                <h1>Lumiverse</h1>
                                <span>Continue your story</span>
                            </div>
                        </div>
                    </div>

                    <div className="lumiverse-lp-header-right">
                        <motion.button
                            className="lumiverse-lp-btn lumiverse-lp-btn-refresh"
                            onClick={fetchChats}
                            disabled={loading}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            type="button"
                        >
                            <RefreshCw size={16} strokeWidth={1.5} className={loading ? 'lumiverse-lp-spin' : ''} />
                        </motion.button>
                    </div>
                </motion.header>

                {/* Main grid */}
                <main className="lumiverse-lp-main">
                    <AnimatePresence mode="wait">
                        {(() => {
                            // Show loading skeletons if:
                            // 1. Actually fetching data (loading = true)
                            // 2. OR we have no items AND app isn't ready yet (prevent premature empty state)
                            const showLoading = loading || (!isAppReady && items.length === 0);

                            if (showLoading) {
                                return (
                                    <motion.div
                                        key="loading"
                                        className="lumiverse-lp-grid-cards"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        {Array.from({ length: 8 }).map((_, i) => (
                                            <SkeletonCard key={i} index={i} />
                                        ))}
                                    </motion.div>
                                );
                            }
                            if (error) {
                                return (
                                    <motion.div
                                        key="error"
                                        className="lumiverse-lp-error"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        <p>Failed to load chats</p>
                                        <button onClick={fetchChats} className="lumiverse-lp-btn lumiverse-lp-btn-primary" type="button">
                                            Try Again
                                        </button>
                                    </motion.div>
                                );
                            }
                            if (items.length === 0) {
                                return <EmptyState />;
                            }
                            return (
                                <motion.div
                                    key="chats"
                                    className="lumiverse-lp-grid-cards"
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                >
                                    {items.map((item, index) => (
                                        <ChatCard
                                            key={`${item._type}-${item.id ?? item._index}-${index}`}
                                            item={item}
                                            presetName={item._type === 'character' ? getCharacterPreset(item.name) : null}
                                            onClick={() => handleItemClick(item)}
                                            index={index}
                                        />
                                    ))}
                                </motion.div>
                            );
                        })()}
                    </AnimatePresence>
                </main>

                {/* Footer */}
                <motion.footer
                    className="lumiverse-lp-footer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                >
                    <p>Select a character to continue your journey</p>
                </motion.footer>
            </motion.div>
        </div>
    );
}

export default LandingPage;
