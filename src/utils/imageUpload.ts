/**
 * Client-side image compression and file reader utility
 * Keeps uploaded photos (logo / attendance proof) crisp and lightweight for storage & canvas rendering
 */

export async function readAndCompressImage(
  file: File,
  maxWidth = 960,
  maxHeight = 960,
  quality = 0.82
): Promise<{ dataUrl: string; fileName: string }> {
  // For SVG logos, read directly without rasterizing
  if (file.type === 'image/svg+xml') {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { dataUrl, fileName: file.name };
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = rawDataUrl;
  });

  let { width, height } = img;
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: rawDataUrl, fileName: file.name };
  }

  // Preserve transparency for PNG logos, use JPEG for photos
  const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  ctx.drawImage(img, 0, 0, width, height);

  return {
    dataUrl: canvas.toDataURL(outputMime, quality),
    fileName: file.name,
  };
}
