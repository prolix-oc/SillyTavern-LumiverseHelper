/**
 * Crops an image source to the given pixel region, then scales
 * the result to the target output dimensions. Returns a PNG Blob.
 *
 * @param {string} imageSrc - Object URL or data URL of the source image
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop - Crop region in source pixels
 * @param {number} [outputWidth=512] - Width of the output image
 * @param {number} [outputHeight=768] - Height of the output image
 * @returns {Promise<Blob>} PNG blob of the cropped/scaled image
 */
export default function cropImage(imageSrc, pixelCrop, outputWidth = 512, outputHeight = 768) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = outputWidth;
            canvas.height = outputHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas 2d context'));
                return;
            }

            ctx.drawImage(
                img,
                pixelCrop.x,
                pixelCrop.y,
                pixelCrop.width,
                pixelCrop.height,
                0,
                0,
                outputWidth,
                outputHeight,
            );

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas toBlob returned null'));
                }
            }, 'image/png');
        };

        img.onerror = () => reject(new Error('Failed to load image for cropping'));
        img.src = imageSrc;
    });
}
