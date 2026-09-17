/**
 * Client-side image optimizer and compressor for storefront logos and merchant assets.
 * Automatically resizes high-resolution images down to web-optimized dimensions (default max 400x400)
 * and compresses them to tiny, fast-loading base64 data URIs.
 */

export interface OptimizeImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export async function optimizeImageFile(
  file: File,
  options: OptimizeImageOptions = {},
): Promise<string> {
  const { maxWidth = 400, maxHeight = 400, quality = 0.88 } = options;

  // If already an SVG, read directly as data URL or text (vector graphics don't need raster compression)
  if (file.type === 'image/svg+xml') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read SVG file as data URL'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('SVG read error'));
      reader.readAsDataURL(file);
    });
  }

  // For raster images (JPEG, PNG, WebP, GIF), load into Image and downscale using Canvas
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Calculate aspect-ratio-preserving dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Fallback to raw FileReader if canvas context is unavailable
        const fallbackReader = new FileReader();
        fallbackReader.onload = () => resolve(fallbackReader.result as string);
        fallbackReader.onerror = () => reject(fallbackReader.error);
        fallbackReader.readAsDataURL(file);
        return;
      }

      // High quality scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Check if image has transparency (PNG)
      const hasAlpha = file.type === 'image/png' || file.type === 'image/webp';
      const outputType = hasAlpha ? 'image/png' : 'image/jpeg';

      const compressedDataUri = canvas.toDataURL(outputType, quality);
      resolve(compressedDataUri);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Fallback to FileReader if objectUrl failed
      const fallbackReader = new FileReader();
      fallbackReader.onload = () => resolve(fallbackReader.result as string);
      fallbackReader.onerror = () => reject(new Error('Failed to load image for optimization'));
      fallbackReader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}
