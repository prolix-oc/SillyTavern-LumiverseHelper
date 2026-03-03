import { useState, useCallback, useRef } from 'react';

/**
 * Hook that manages the image crop modal flow:
 * - Opens the crop modal with an objectURL from a File
 * - On crop confirm, converts the Blob to a File and calls onComplete
 * - On cancel, cleans up the objectURL
 *
 * @param {(file: File) => void} onComplete - Called with the cropped File when the user applies the crop
 * @returns {{ cropModalProps: Object, openCropFlow: (file: File) => void }}
 */
export default function useImageCropFlow(onComplete) {
    const [isOpen, setIsOpen] = useState(false);
    const [imageSrc, setImageSrc] = useState(null);
    const objectUrlRef = useRef(null);

    const cleanup = useCallback(() => {
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }
        setImageSrc(null);
        setIsOpen(false);
    }, []);

    const openCropFlow = useCallback((file) => {
        // Clean up any previous URL
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
        }
        const url = URL.createObjectURL(file);
        objectUrlRef.current = url;
        setImageSrc(url);
        setIsOpen(true);
    }, []);

    const handleCropDone = useCallback((blob) => {
        const croppedFile = new File([blob], 'avatar.png', { type: 'image/png' });
        cleanup();
        onComplete(croppedFile);
    }, [onComplete, cleanup]);

    const handleCancel = useCallback(() => {
        cleanup();
    }, [cleanup]);

    return {
        cropModalProps: {
            isOpen,
            imageSrc,
            onCropDone: handleCropDone,
            onCancel: handleCancel,
        },
        openCropFlow,
    };
}
