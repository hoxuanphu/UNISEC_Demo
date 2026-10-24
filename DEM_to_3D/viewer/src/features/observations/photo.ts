import { photoLimits, type AppPhotoCapture, type FieldPhoto } from './model';
import { validAppPhotoCapture } from './captureMetadata';

/** Read only uploaded bytes. EXIF is provenance, never an automatic change to the observed location. */
export async function readFieldPhoto(file: File, capture?: AppPhotoCapture): Promise<FieldPhoto> {
  if (capture !== undefined && !validAppPhotoCapture(capture)) throw new Error('photo-capture');
  if (file.size <= 0 || file.size > photoLimits.bytes)
    throw new Error('photo-file');
  const raw = new Uint8Array(await file.arrayBuffer());
  // Detect bytes, because phone file pickers can omit or misreport MIME types.
  const signature = String.fromCharCode(...raw.slice(0, 64));
  const iso = signature.slice(4, 8) === 'ftyp';
  const mime =
    raw[0] === 255 && raw[1] === 216 && raw[2] === 255
      ? 'image/jpeg'
      : raw[0] === 137 && signature.slice(1, 4) === 'PNG'
        ? 'image/png'
        : signature.slice(0, 4) === 'RIFF' && signature.slice(8, 12) === 'WEBP'
          ? 'image/webp'
          : iso && /avif|avis/.test(signature)
            ? 'image/avif'
            : iso && /heic|heix|hevc|hevx|mif1|msf1/.test(signature)
              ? 'image/heic'
              : '';
  if (!mime) throw new Error('photo-file');
  const hash = await crypto.subtle.digest('SHA-256', raw);
  const sha256 = Array.from(new Uint8Array(hash), (v) =>
    v.toString(16).padStart(2, '0')
  ).join('');
  const exif: Record<string, string | number> = {};
  try {
    const parser = await import('exifr');
    const tags = await parser.parse(file, {
      pick: [
        'Make',
        'Model',
        'DateTimeOriginal',
        'OffsetTimeOriginal',
        'FNumber',
        'ExposureTime',
        'ISO',
        'FocalLength',
        'GPSLatitude',
        'GPSLatitudeRef',
        'GPSLongitude',
        'GPSLongitudeRef',
        'GPSImgDirection',
        'GPSImgDirectionRef',
        'Orientation'
      ],
      reviveValues: false
    });
    for (const key of [
      'Make',
      'Model',
      'DateTimeOriginal',
      'OffsetTimeOriginal',
      'FNumber',
      'ExposureTime',
      'ISO',
      'FocalLength',
      'GPSImgDirection',
      'GPSImgDirectionRef',
      'Orientation',
      'latitude',
      'longitude'
    ]) {
      const value = tags?.[key];
      if (typeof value === 'string') exif[key] = value.slice(0, 200);
      else if (typeof value === 'number' && Number.isFinite(value))
        exif[key] = value;
    }
  } catch {
    /* A displayable photo may have no readable EXIF. */
  }
  const blob = new Blob([file], { type: mime });
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch (error) {
    if (mime !== 'image/heic') throw error;
    const { heicTo } = await import('heic-to/csp');
    bitmap = await heicTo({ blob, type: 'bitmap' });
  }
  try {
    if (bitmap.width * bitmap.height > 40_000_000)
      throw new Error('photo-dimensions');
    const ratio = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('photo-decode');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let preview = canvas.toDataURL('image/jpeg', 0.8);
    if (preview.length > photoLimits.previewChars)
      preview = canvas.toDataURL('image/jpeg', 0.55);
    if (preview.length > photoLimits.previewChars)
      throw new Error('photo-preview');
    return {
      id: crypto.randomUUID(),
      name: file.name.slice(0, 200),
      mime,
      bytes: file.size,
      width: bitmap.width,
      height: bitmap.height,
      preview,
      sha256,
      exif,
      ...(capture ? {capture} : {}),
      addedAt: new Date().toISOString()
    };
  } finally {
    bitmap.close();
  }
}
