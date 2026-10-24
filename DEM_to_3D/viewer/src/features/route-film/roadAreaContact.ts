import pointInPolygon from '@turf/boolean-point-in-polygon';

type Point = { x: number; y: number };
export type RoadAreaContact = { station: number; roadPoint: Point; areaPoint: Point; distanceM: number };
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const subtract = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y });
const along = (a: Point, b: Point, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const parameter = (p: Point, a: Point, b: Point) => {
  const d = subtract(b, a), length2 = d.x * d.x + d.y * d.y;
  return length2 ? Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / length2)) : 0;
};

/** Nearest road/polygon pair in their shared projected CRS, including crossings.
 * Proximity establishes a display association, not evidence of a blocked road. */
export function roadAreaContact(road: Point[], ring: Point[], holes: Point[][] = []): RoadAreaContact | null {
  if (road.length < 2 || ring.length < 3) return null;
  const rings = [ring, ...holes.filter(hole => hole.length >= 3)].map(points =>
    points[0].x === points.at(-1)!.x && points[0].y === points.at(-1)!.y ? points : [...points, points[0]]);
  const polygon = { type: 'Polygon' as const, coordinates: rings.map(points => points.map(p => [p.x, p.y])) };
  let best: RoadAreaContact | null = null, station = 0;
  const consider = (roadPoint: Point, areaPoint: Point, at: number) => {
    const distanceM = Math.hypot(roadPoint.x - areaPoint.x, roadPoint.y - areaPoint.y);
    if (!best || distanceM < best.distanceM) best = { roadPoint, areaPoint, station: at, distanceM };
  };
  for (let i = 1; i < road.length; i++) {
    const a = road[i - 1], b = road[i], d = subtract(b, a), length = Math.hypot(d.x, d.y);
    if (pointInPolygon([a.x, a.y], polygon)) consider(a, a, station);
    if (pointInPolygon([b.x, b.y], polygon)) consider(b, b, station + length);
    for (const closed of rings) for (let j = 1; j < closed.length; j++) {
      const c = closed[j - 1], e = closed[j], edge = subtract(e, c), denominator = cross(d, edge);
      if (Math.abs(denominator) > 1e-10) {
        const offset = subtract(c, a), t = cross(offset, edge) / denominator, u = cross(offset, d) / denominator;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
          const at = along(a, b, t); consider(at, at, station + length * t);
        }
      }
      for (const p of [c, e]) {
        const t = parameter(p, a, b); consider(along(a, b, t), p, station + length * t);
      }
      consider(a, along(c, e, parameter(a, c, e)), station);
      consider(b, along(c, e, parameter(b, c, e)), station + length);
    }
    station += length;
  }
  return best;
}
