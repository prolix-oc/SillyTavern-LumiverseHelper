import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to determine adaptive object-position for images based on aspect ratio.
 *
 * Rules:
 * - Square (1:1): center center (default)
 * - Portrait (height > width, like 2:3): center 20% (position content near top)
 * - Landscape (width > height): center center (default)
 *
 * @param {string} imageUrl - The URL of the image to analyze
 * @returns {{ objectPosition: string, isLoaded: boolean, isPortrait: boolean, isSquare: boolean, isLandscape: boolean }}
 */
export function useAdaptiveImagePosition(imageUrl) {
    const [state, setState] = useState({
        objectPosition: 'center center',
        isLoaded: false,
        isPortrait: false,
        isSquare: false,
        isLandscape: false,
    });

    // Track the current URL to avoid stale updates
    const currentUrlRef = useRef(imageUrl);

    useEffect(() => {
        currentUrlRef.current = imageUrl;

        if (!imageUrl) {
            setState({
                objectPosition: 'center center',
                isLoaded: false,
                isPortrait: false,
                isSquare: false,
                isLandscape: false,
            });
            return;
        }

        const img = new Image();

        img.onload = () => {
            // Only update if URL hasn't changed while loading
            if (currentUrlRef.current !== imageUrl) return;

            const { naturalWidth: width, naturalHeight: height } = img;
            const aspectRatio = width / height;

            // Tolerance for "square" detection (0.9 to 1.1 is considered square)
            const isSquare = aspectRatio >= 0.9 && aspectRatio <= 1.1;
            const isPortrait = aspectRatio < 0.9; // More tall than wide
            const isLandscape = aspectRatio > 1.1; // More wide than tall

            // Determine object-position
            let objectPosition = 'center center';
            if (isPortrait) {
                // Portrait images: position 20% from top to show face/head area
                objectPosition = 'center 20%';
            }
            // Square and landscape both use center center

            setState({
                objectPosition,
                isLoaded: true,
                isPortrait,
                isSquare,
                isLandscape,
            });
        };

        img.onerror = () => {
            if (currentUrlRef.current !== imageUrl) return;
            setState({
                objectPosition: 'center center',
                isLoaded: false,
                isPortrait: false,
                isSquare: false,
                isLandscape: false,
            });
        };

        img.src = imageUrl;

        return () => {
            // Cleanup
            img.onload = null;
            img.onerror = null;
        };
    }, [imageUrl]);

    return state;
}

export default useAdaptiveImagePosition;
