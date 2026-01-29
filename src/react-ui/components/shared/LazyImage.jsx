import React, { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * LazyImage - Image component with loading spinner for lazy-loaded images
 * 
 * Shows a loading spinner while the image is loading, then fades in the image.
 * Uses native browser lazy loading via loading="lazy" attribute.
 */

const styles = {
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
    ...props 
}) {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const handleLoad = useCallback(() => {
        setIsLoading(false);
    }, []);

    const handleError = useCallback(() => {
        setIsLoading(false);
        setHasError(true);
    }, []);

    if (hasError || !src) {
        return null;
    }

    return (
        <div style={styles.container}>
            {isLoading && (
                <div style={styles.spinner}>
                    <Loader2 size={24} strokeWidth={1.5} />
                </div>
            )}
            <img
                src={src}
                alt={alt}
                style={{
                    ...styles.image,
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
