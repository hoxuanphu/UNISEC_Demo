import proj4 from "proj4";
import type { RoadSegment, ScenarioRoute } from "../../types/dear";
import { projectedPathLength } from "../../terrain/pathGeometry";
import { findConditionAwarePath, findPreparedNetworkPath, findRescueFootPath, routingPolicy } from "./networkRouting";
import { routeStatus } from './roadConditions';
export type JourneyPreference = 'distance' | 'conditions' | 'rescue-foot';
/** A resident journey also carries other unblocked routes, so the map can show them as choices. */
export type JourneyRoute = ScenarioRoute & { alternatives?: ScenarioRoute[] };
type Point = { x: number; y: number };
export type RoadAnchor = {
  point: Point;
  roadId: string;
  station: number;
  distance: number;
};
const crs = "+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs";
export function roadProjected(latitude: number, longitude: number): Point {
  const [x, y] = proj4("EPSG:4326", crs, [longitude, latitude]);
  return { x, y };
}
export function roadGeographic(point: Point): {
  latitude: number;
  longitude: number;
} {
  const [longitude, latitude] = proj4(crs, "EPSG:4326", [point.x, point.y]);
  return { latitude, longitude };
}
export function nearestRoadAnchor(
  roads: RoadSegment[],
  point: Point,
  maxDistance = 100,
): RoadAnchor | null {
  let best: RoadAnchor | null = null;
  for (const road of [...roads].sort((a, b) => a.id.localeCompare(b.id))) {
    if (
      road.points.length < 2 ||
      road.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
    )
      continue;
    let station = 0;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1],
        b = road.points[i],
        dx = b.x - a.x,
        dy = b.y - a.y,
        length = Math.hypot(dx, dy);
      if (!length) continue;
      const t = Math.max(
          0,
          Math.min(
            1,
            ((point.x - a.x) * dx + (point.y - a.y) * dy) / (length * length),
          ),
        ),
        p =
          t * length < 0.001
            ? a
            : (1 - t) * length < 0.001
              ? b
              : { x: a.x + t * dx, y: a.y + t * dy },
        distance = Math.hypot(point.x - p.x, point.y - p.y);
      if (!best || distance < best.distance)
        best = {
          point: p,
          roadId: road.id,
          station: station + (p === a ? 0 : p === b ? length : t * length),
          distance,
        };
      station += length;
    }
  }
  return best && best.distance <= maxDistance ? best : null;
}
/** Split only selected roads. Existing surveyed endpoint topology stays unchanged. */
export function selectedRoadJourney(
  roads: RoadSegment[],
  start: RoadAnchor,
  end: RoadAnchor,
  avoidBlocked = false,
  preference: JourneyPreference = 'distance',
): JourneyRoute | null {
  if (
    !roads.some((r) => r.id === start.roadId) ||
    !roads.some((r) => r.id === end.roadId) ||
    Math.hypot(start.point.x - end.point.x, start.point.y - end.point.y) < 0.001
  )
    return null;
  const split = roads.flatMap((road) => {
    const marks = [start, end].filter((p) => p.roadId === road.id),
      length = projectedPathLength(road.points);
    if (!marks.length) return [road];
    const cuts = [
      { station: 0, point: road.points[0] },
      ...marks,
      { station: length, point: road.points.at(-1)! },
    ]
      .sort((a, b) => a.station - b.station)
      .filter((p, i, all) => !i || p.station - all[i - 1].station > 0.001);
    const stations = [0];
    for (let i = 1; i < road.points.length; i++)
      stations.push(
        stations[i - 1] +
          Math.hypot(
            road.points[i].x - road.points[i - 1].x,
            road.points[i].y - road.points[i - 1].y,
          ),
      );
    return cuts.slice(1).map((cut, i) => {
      const from = cuts[i],
        points = [
          from.point,
          ...road.points.filter(
            (_, j) =>
              stations[j] > from.station + 0.001 &&
              stations[j] < cut.station - 0.001,
          ),
          cut.point,
        ];
      return {
        ...road,
        id: road.id + ":part:" + i,
        sourceRoadId: road.sourceRoadId ?? road.id,
        points,
        len: projectedPathLength(points) / 1000,
      };
    });
  });
  // Distance tools keep the shortest path. Resident advice takes the shortest unblocked route
  // unless a route with fewer sections to check is at most `residentDetourTolerance` longer.
  const shortest = findPreparedNetworkPath(split, start.point, end.point, !avoidBlocked, new Set(), 1);
  const length = (path: typeof shortest) => path ? path.reduce((sum, step) => sum + projectedPathLength(step.road.points), 0) : Infinity;
  const steps = preference === 'rescue-foot' ? findRescueFootPath(split, start.point, end.point) : preference === 'conditions'
    ? findConditionAwarePath(split, start.point, end.point, !avoidBlocked) : shortest;
  if (!steps) return null;
  const id = `journey:${start.roadId}:${start.station}:${end.roadId}:${end.station}:${avoidBlocked}:${preference}`;
  const build = (path: NonNullable<typeof shortest>): ScenarioRoute => {
    const segs = path.map((s) =>
        s.reversed ? { ...s.road, points: [...s.road.points].reverse() } : s.road,
      ),
      points = segs.flatMap((s, i) => (i ? s.points.slice(1) : s.points));
    return {
      // Identity follows the actual directed path, not its rank in the suggestions.
      id: `${id}:path:${path.map(step => `${encodeURIComponent(step.road.id)}~${step.reversed ? 'r' : 'f'}`).join('/')}`,
      communityId: "",
      type: "candidate",
      name: ["Tuyến đã chọn", "Selected route"],
      points,
      segs,
      status: routeStatus({ status: 'open', segs }),
      lengthKm: projectedPathLength(points) / 1000,
    };
  };
  if (preference === 'distance') return build(steps);
  // Other ways round: close each section of the advised route in turn. Keep unblocked paths that
  // share under 70% of their length with the advised route or each other, at most twice as long.
  const shared = (path: typeof steps, other: typeof steps) => {
    const ids = new Set(other.map(step => step.road.id));
    return path.reduce((sum, step) => sum + (ids.has(step.road.id) ? projectedPathLength(step.road.points) : 0), 0) / length(path);
  };
  const others: Array<typeof steps> = [];
  for (const step of steps) {
    const path = findPreparedNetworkPath(split, start.point, end.point, false, new Set([step.road.id]), routingPolicy.uncertainCostMultiplier);
    if (!path || length(path) > length(steps) * 2 || [steps, ...others].some(known => shared(path, known) >= 0.7)) continue;
    others.push(path);
  }
  return { ...build(steps), alternatives: others.sort((a, b) => length(a) - length(b)).slice(0, 2).map(build) };
}
