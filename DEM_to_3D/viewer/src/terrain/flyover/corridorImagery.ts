import { softenCoverageEdgeAsync } from '../../features/imagery/coverageFeather';
import { rasterUrl, type ImageryRaster } from '../../features/imagery/analysisImagery';

type Point = { x: number; y: number };

/** Source pixels over the route's viewing window, including the surrounding slopes.
 * Keep the mosaic's valid footprint intact; never erase side scars with a road mask. */
export async function corridorImagery(rasters: ImageryRaster[], route: Point[], options: { halfWidth: number; maxSize: number; signal?: AbortSignal }) {
  const { halfWidth, maxSize, signal } = options;
  const xs = route.map(p => p.x), ys = route.map(p => p.y), margin = halfWidth * 1.5;
  const union = rasters.reduce((b, r) => [Math.min(b[0], r.terrain.bounds[0]), Math.min(b[1], r.terrain.bounds[1]), Math.max(b[2], r.terrain.bounds[2]), Math.max(b[3], r.terrain.bounds[3])], [Infinity, Infinity, -Infinity, -Infinity]);
  const left = Math.max(union[0], Math.min(...xs) - margin), right = Math.min(union[2], Math.max(...xs) + margin);
  const bottom = Math.max(union[1], Math.min(...ys) - margin), top = Math.min(union[3], Math.max(...ys) + margin);
  if (!(right > left && top > bottom)) return null;
  const native = Math.min(...rasters.map(r => (r.terrain.bounds[2] - r.terrain.bounds[0]) / r.terrain.width));
  const mpp = Math.max(native, (right - left) / maxSize, (top - bottom) / maxSize);
  const width = Math.ceil((right - left) / mpp), height = Math.ceil((top - bottom) / mpp);
  const bounds = [left, top - height * mpp, left + width * mpp, top] as const;
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  const px = (x: number) => (x - left) / mpp, py = (y: number) => (top - y) / mpp;
  for (const raster of rasters) {
    const [l, b, r, t] = raster.terrain.bounds;
    if (r < left || l > bounds[2] || t < bounds[1] || b > top) continue;
    const image = await createImageBitmap(await (await fetch(await rasterUrl(raster.terrain, signal ?? new AbortController().signal), { signal })).blob());
    try { ctx.drawImage(image, px(l), py(t), (r - l) / mpp, (t - b) / mpp); } finally { image.close(); }
  }
  signal?.throwIfAborted();
  await softenCoverageEdgeAsync(canvas,mpp,signal);
  return { canvas, bounds };
}
