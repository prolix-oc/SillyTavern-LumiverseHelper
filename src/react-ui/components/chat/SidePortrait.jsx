/**
 * SidePortrait — Persistent side-pinned character avatar panel (desktop only).
 *
 * Shows the last character message's avatar with name label,
 * a "View Gallery" button when gallery images exist,
 * and an inline GalleryMosaic when toggled open.
 *
 * In group chats: shows navigation to cycle through group members,
 * with auto-follow mode that tracks the last speaker.
 *
 * Click avatar → opens AvatarLightbox.
 */

import React, { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import { Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLumiverseStore } from '../../store/LumiverseContext';
import { fetchGalleryImages, getGroupMemberList } from '../../../lib/chatSheldService';
import { isGroupChat } from '../../../stContext';
import GalleryMosaic from './GalleryMosaic';

const store = useLumiverseStore;
const selectMessages = () => store.getState().chatSheld?.messages || [];

export default function SidePortrait() {
    const messages = useSyncExternalStore(store.subscribe, selectMessages, selectMessages);

    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryImages, setGalleryImages] = useState([]);
    const [galleryLoading, setGalleryLoading] = useState(false);

    // Group navigation state
    const [isGroup, setIsGroup] = useState(false);
    const [groupMembers, setGroupMembers] = useState([]);
    const [viewingIndex, setViewingIndex] = useState(-1); // -1 = auto-follow
    const [autoFollow, setAutoFollow] = useState(true);

    // Detect group chat and load members
    useEffect(() => {
        const group = isGroupChat();
        setIsGroup(group);
        if (group) {
            setGroupMembers(getGroupMemberList());
        }
    }, [messages.length]); // Re-check on chat changes

    // Find last character message (scan backward)
    const lastCharMessage = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (!msg.isUser && !msg.isSystem && msg.avatar) {
                return msg;
            }
        }
        return null;
    }, [messages]);

    // In group mode with auto-follow, update viewingIndex to match last speaker
    useEffect(() => {
        if (!isGroup || !autoFollow || groupMembers.length === 0 || !lastCharMessage) return;
        const speakerIdx = groupMembers.findIndex(m => m.name === lastCharMessage.name);
        if (speakerIdx !== -1) {
            setViewingIndex(speakerIdx);
        }
    }, [isGroup, autoFollow, groupMembers, lastCharMessage]);

    // Determine which character to display
    const displayMember = isGroup && groupMembers.length > 0 && viewingIndex >= 0
        ? groupMembers[viewingIndex]
        : null;

    const avatarSrc = displayMember
        ? displayMember.avatarUrl
        : (lastCharMessage?.avatar || null);
    const charName = displayMember
        ? displayMember.name
        : (lastCharMessage?.name || '');

    // Open avatar lightbox
    const handleAvatarClick = useCallback(() => {
        if (!avatarSrc) return;
        const cs = store.getState().chatSheld;
        store.setState({ chatSheld: { ...cs, avatarLightbox: { src: avatarSrc, name: charName } } });
    }, [avatarSrc, charName]);

    // Toggle gallery
    const handleToggleGallery = useCallback(async () => {
        if (galleryOpen) {
            setGalleryOpen(false);
            return;
        }
        setGalleryLoading(true);
        try {
            const images = await fetchGalleryImages(charName);
            setGalleryImages(images);
        } catch {
            setGalleryImages([]);
        } finally {
            setGalleryLoading(false);
            setGalleryOpen(true);
        }
    }, [galleryOpen, charName]);

    // Reset gallery when character changes
    useEffect(() => {
        setGalleryOpen(false);
        setGalleryImages([]);
    }, [charName]);

    // Open a gallery image in lightbox with gallery navigation
    const handleGalleryImageClick = useCallback((index) => {
        const cs = store.getState().chatSheld;
        store.setState({
            chatSheld: {
                ...cs,
                avatarLightbox: {
                    src: galleryImages[index]?.path || '',
                    name: charName,
                    galleryImages,
                    galleryIndex: index,
                },
            },
        });
    }, [galleryImages, charName]);

    // Group navigation handlers
    const handlePrev = useCallback(() => {
        if (groupMembers.length === 0) return;
        setAutoFollow(false);
        setViewingIndex(prev => {
            const idx = prev <= 0 ? groupMembers.length - 1 : prev - 1;
            return idx;
        });
    }, [groupMembers.length]);

    const handleNext = useCallback(() => {
        if (groupMembers.length === 0) return;
        setAutoFollow(false);
        setViewingIndex(prev => {
            const idx = prev >= groupMembers.length - 1 ? 0 : prev + 1;
            return idx;
        });
    }, [groupMembers.length]);

    const handleDotClick = useCallback((idx) => {
        setAutoFollow(false);
        setViewingIndex(idx);
    }, []);

    const toggleAutoFollow = useCallback(() => {
        setAutoFollow(prev => !prev);
    }, []);

    if (!lastCharMessage && !displayMember) {
        return (
            <div className="lcs-side-portrait">
                <div className="lcs-side-portrait-empty">
                    <div className="lcs-side-portrait-placeholder" />
                </div>
            </div>
        );
    }

    return (
        <div className="lcs-side-portrait">
            {/* Group member navigation */}
            {isGroup && groupMembers.length > 1 && (
                <div className="lcs-portrait-member-nav">
                    <button
                        className="lcs-portrait-nav-btn"
                        onClick={handlePrev}
                        title="Previous member"
                        type="button"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <div className="lcs-portrait-member-dots">
                        {groupMembers.map((m, i) => (
                            <span
                                key={m.chid}
                                className={`lcs-portrait-dot${i === viewingIndex ? ' lcs-portrait-dot--active' : ''}`}
                                onClick={() => handleDotClick(i)}
                                title={m.name}
                            />
                        ))}
                    </div>
                    <button
                        className="lcs-portrait-nav-btn"
                        onClick={handleNext}
                        title="Next member"
                        type="button"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            )}

            <div className="lcs-side-portrait-frame" onClick={handleAvatarClick}>
                {avatarSrc ? (
                    <img
                        className="lcs-side-portrait-img"
                        src={avatarSrc}
                        alt={charName}
                        loading="lazy"
                    />
                ) : (
                    <div className="lcs-side-portrait-placeholder">
                        {(charName || '?')[0].toUpperCase()}
                    </div>
                )}
            </div>
            <span className="lcs-side-portrait-name">{charName}</span>

            {/* Auto-follow toggle (group only) */}
            {isGroup && groupMembers.length > 1 && (
                <button
                    className={`lcs-portrait-auto-follow${autoFollow ? ' lcs-portrait-auto-follow--active' : ''}`}
                    onClick={toggleAutoFollow}
                    title={autoFollow ? 'Following last speaker — click to pin' : 'Pinned to selection — click to follow'}
                    type="button"
                >
                    {autoFollow ? 'Following' : 'Pinned'}
                </button>
            )}

            <button
                className="lcs-side-portrait-gallery-btn"
                onClick={handleToggleGallery}
                title={galleryOpen ? 'Close gallery' : 'View gallery'}
                type="button"
            >
                <ImageIcon size={14} />
                <span>{galleryOpen ? 'Close Gallery' : 'View Gallery'}</span>
            </button>

            {galleryOpen && (
                <GalleryMosaic
                    images={galleryImages}
                    loading={galleryLoading}
                    onImageClick={handleGalleryImageClick}
                />
            )}
        </div>
    );
}
