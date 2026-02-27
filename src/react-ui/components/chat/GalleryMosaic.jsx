/**
 * GalleryMosaic — Scrollable grid of character gallery thumbnails.
 *
 * Renders inside/below SidePortrait when "View Gallery" is clicked.
 * Click thumbnail → opens AvatarLightbox with gallery navigation.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export default function GalleryMosaic({ images, loading, onImageClick }) {
    if (loading) {
        return (
            <div className="lcs-gallery-mosaic lcs-gallery-mosaic--loading">
                <Loader2 size={20} className="lcs-gallery-spinner" />
            </div>
        );
    }

    if (!images || images.length === 0) {
        return (
            <div className="lcs-gallery-mosaic lcs-gallery-mosaic--empty">
                <span>No gallery images found</span>
            </div>
        );
    }

    return (
        <div className="lcs-gallery-mosaic">
            <div className="lcs-gallery-grid">
                {images.map((image, index) => (
                    <button
                        key={image.path || index}
                        className="lcs-gallery-thumb"
                        onClick={() => onImageClick(index)}
                        type="button"
                        title={image.title || `Image ${index + 1}`}
                    >
                        <img
                            src={image.path}
                            alt={image.title || ''}
                            loading="lazy"
                            className="lcs-gallery-thumb-img"
                        />
                    </button>
                ))}
            </div>
        </div>
    );
}
