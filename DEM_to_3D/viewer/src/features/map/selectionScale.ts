type Point = { x: number; y: number };

/**
 * Selecting something brings it into view at a working scale, with its surroundings, never as
 * a close-up. A selection never zooms the 2D map past this level (about 1.5 km across) unless
 * the user is already closer; a point is brought in no farther out than `POINT_ZOOM`.
 */
export const SELECTION_MAX_ZOOM = 16;
export const POINT_ZOOM = 15;
/** The 3D camera frames at least this far around a selection, in metres either side. */
export const SELECTION_HALF_EXTENT_M = 600;

/** A frame no smaller than `half` metres either side of its centre, so a point is not framed as a close-up. */
export function withMinimumExtent(points: readonly Point[], half = SELECTION_HALF_EXTENT_M): Point[] {
  const valid = points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!valid.length) return [];
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (const point of valid) {
    left = Math.min(left, point.x); right = Math.max(right, point.x);
    bottom = Math.min(bottom, point.y); top = Math.max(top, point.y);
  }
  const cx = (left + right) / 2, cy = (bottom + top) / 2;
  if (right - left >= 2 * half && top - bottom >= 2 * half) return valid;
  return [...valid, { x: cx - half, y: cy - half }, { x: cx + half, y: cy + half }];
}
