import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * LazyImage - Image component with loading spinner for lazy-loaded images
 *
 * Shows a loading spinner while the image is loading, then fades in the image.
 * Uses native browser lazy loading via loading="lazy" attribute.
 *
 * Props:
 *  - src: image URL
 *  - alt: alt text
 *  - style: extra styles merged onto the <img>
 *  - objectPosition: CSS object-position (default 'center')
 *  - className: class on the <img>
 *  - fallback: ReactNode shown when src is missing or image fails to load
 *  - spinnerSize: size of the Loader2 icon (default 24)
 *  - containerClassName: class on the wrapper div
 *  - containerStyle: extra styles merged onto the wrapper div
 */

const baseStyles = {
    container: {
        position: 'relative',
        width: '100%',
        height: '100%',
    },
    image: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transition: 'opacity 0.2s ease',
    },
    spinner: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--lumiverse-primary, #9370db)',
        opacity: 0.6,
        animation: 'spin 1s linear infinite',
    },
};

function LazyImage({
    src,
    alt = '',
    style = {},
    objectPosition = 'center',
    className = '',
    fallback = null,
    spinnerSize = 24,
    containerClassName = '',
    containerStyle = {},
    ...props
}) {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const prevSrcRef = useRef(src);

    // Reset loading/error state when src changes (e.g. cache-busted URL after avatar upload)
    useEffect(() => {
        if (src !== prevSrcRef.current) {
            prevSrcRef.current = src;
            setIsLoading(true);
            setHasError(false);
        }
    }, [src]);

    const handleLoad = useCallback(() => {
        setIsLoading(false);
    }, []);

    const handleError = useCallback(() => {
        setIsLoading(false);
        setHasError(true);
    }, []);

    if (hasError || !src) {
        return fallback;
    }

    // When containerClassName is provided, omit default width/height so the
    // class can control dimensions (inline styles beat class specificity).
    const containerInline = containerClassName
        ? { position: 'relative', overflow: 'hidden', ...containerStyle }
        : { ...baseStyles.container, ...containerStyle };

    return (
        <div
            style={containerInline}
            className={containerClassName || undefined}
        >
            {isLoading && (
                <div style={baseStyles.spinner}>
                    <Loader2 size={spinnerSize} strokeWidth={1.5} />
                </div>
            )}
            <img
                src={src}
                alt={alt}
                style={{
                    ...baseStyles.image,
                    ...style,
                    objectPosition,
                    opacity: isLoading ? 0 : 1,
                }}
                className={className}
                loading="lazy"
                onLoad={handleLoad}
                onError={handleError}
                {...props}
            />
        </div>
    );
}

export default LazyImage;
