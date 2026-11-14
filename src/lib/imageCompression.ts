export interface CompressedImageResult {
  file: File;
  originalBytes: number;
  compressedBytes: number;
  wasCompressed: boolean;
}

/**
 * Compresses and resizes a car image client-side via Canvas before uploading
 * to Supabase Storage, significantly reducing storage footprint and upload time.
 */
export async function compressImageFile(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
): Promise<CompressedImageResult> {
  const maxWidth = options.maxWidth ?? 1280;
  const maxHeight = options.maxHeight ?? 960;
  const quality = options.quality ?? 0.78;
  const originalBytes = file.size;

  if (!file.type.startsWith('image/')) {
    return {
      file,
      originalBytes,
      compressedBytes: originalBytes,
      wasCompressed: false,
    };
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const imageEl = new Image();
      imageEl.onload = () => resolve(imageEl);
      imageEl.onerror = () => reject(new Error('Failed to decode image'));
      imageEl.src = objectUrl;
    });

    let targetWidth = img.naturalWidth || img.width;
    let targetHeight = img.naturalHeight || img.height;

    if (targetWidth > maxWidth || targetHeight > maxHeight) {
      const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
      targetWidth = Math.max(1, Math.round(targetWidth * ratio));
      targetHeight = Math.max(1, Math.round(targetHeight * ratio));
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        file,
        originalBytes,
        compressedBytes: originalBytes,
        wasCompressed: false,
      };
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const outputMime = file.type === 'image/png' ? 'image/jpeg' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const ext = outputMime === 'image/webp' ? 'webp' : 'jpg';

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), outputMime, quality),
    );

    if (!blob || blob.size >= originalBytes) {
      return {
        file,
        originalBytes,
        compressedBytes: originalBytes,
        wasCompressed: false,
      };
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'car-photo';
    const compressedFile = new File([blob], `${baseName}.${ext}`, {
      type: outputMime,
      lastModified: Date.now(),
    });

    return {
      file: compressedFile,
      originalBytes,
      compressedBytes: compressedFile.size,
      wasCompressed: true,
    };
  } catch {
    return {
      file,
      originalBytes,
      compressedBytes: originalBytes,
      wasCompressed: false,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
