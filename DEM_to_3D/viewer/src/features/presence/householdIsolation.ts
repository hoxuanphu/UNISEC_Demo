import type { RoadSegment } from '../../types/dear';
import type { LocalNetwork } from '../route-film/localNetwork';
import { roadProjected } from '../routes/selectedRoadJourney';
import type { PresenceCluster } from './residentPresence';

type Point = { x: number; y: number };
/** What cuts the huts off: a mapped landslide extent, a section mapped as blocked, or a slide residents reported in the app. */
export type HouseholdCut =
  | { kind: 'area'; id: string }
  | { kind: 'road'; roadId: string; name: [vi: string, en: string] }
  | { kind: 'report'; point: Point; reportedAt: string };
export type HouseholdAccess = {
  cluster: PresenceCluster;
  projected: Point;
  /** Every mapped road out of the huts crosses a landslide or a blocked section. */
  isolated: boolean;
  /** Nearest mapped road, reached on foot from the huts. */
  access: { roadId: string; point: Point; distanceM: number } | null;
  /** Nearest first; empty unless isolated. */
  cutBy: HouseholdCut[];
};

/** Huts further than this from any mapped road are not assessed: access is unknown. */
export const householdAccessMaxM = 600;
/** A reported slide further than this from every road is not placed on one. */
const reportOnRoadM = 60;

const key = (p: Point) => `${Math.round(p.x * 2)},${Math.round(p.y * 2)}`;
const cut = (road: RoadSegment) => road.status === 'blocked' || Boolean(road.landslideAreaId);

function nearestOnRoad(road: RoadSegment, p: Point): { point: Point; distanceM: number; station: number } {
  let best = { point: road.points[0], distanceM: Infinity, station: 0 }, travelled = 0;
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i], dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
    const point = { x: a.x + dx * t, y: a.y + dy * t }, distanceM = Math.hypot(p.x - point.x, p.y - point.y);
    if (distanceM < best.distanceM) best = { point, distanceM, station: travelled + Math.sqrt(length) * t };
    travelled += Math.sqrt(length);
  }
  return best;
}
function nearestRoad(roads: RoadSegment[], p: Point) {
  let best: { road: RoadSegment; point: Point; distanceM: number; station: number } | null = null;
  for (const road of roads) {
    const hit = nearestOnRoad(road, p);
    if (!best || hit.distanceM < best.distanceM) best = { road, ...hit };
  }
  return best;
}
const cutKey = (item: HouseholdCut) => item.kind === 'area' ? `area:${item.id}` : item.kind === 'road' ? `road:${item.roadId}` : `report:${key(item.point)}`;

/**
 * Whether people the resident app places at field huts can leave them by road.
 * The huts are isolated when no mapped road joins them to a village or the helipad
 * without crossing a landslide extent, a blocked section or a slide the residents
 * reported. A reading of the mapped network, not a field confirmation of passage.
 */
export function assessHouseholdAccess(network: LocalNetwork, clusters: PresenceCluster[]): HouseholdAccess[] {
  const roads = network.roads.filter(road => road.points.length >= 2);
  const edges = new Map<string, Array<{ road: RoadSegment; to: string }>>();
  for (const road of roads) {
    const a = key(road.points[0]), b = key(road.points.at(-1)!);
    edges.set(a, [...edges.get(a) ?? [], { road, to: b }]);
    edges.set(b, [...edges.get(b) ?? [], { road, to: a }]);
  }
  // A place is reached at either end of its own road, when that road is clear.
  const targets = new Set<string>();
  for (const place of network.places) {
    const hit = nearestRoad(roads, place.projected);
    if (hit && hit.distanceM <= householdAccessMaxM && !cut(hit.road)) { targets.add(key(hit.road.points[0])); targets.add(key(hit.road.points.at(-1)!)); }
  }
  return clusters.map(cluster => {
    const projected = roadProjected(cluster.latitude, cluster.longitude);
    const hit = nearestRoad(roads, projected);
    if (!hit || hit.distanceM > householdAccessMaxM) return { cluster, projected, isolated: false, access: null, cutBy: [] };
    // Slides the residents reported, placed on the road they lie on.
    const reports = new Map<string, Array<{ station: number; item: HouseholdCut }>>();
    for (const report of cluster.reportedCuts ?? []) {
      const at = roadProjected(report.latitude, report.longitude), on = nearestRoad(roads, at);
      if (!on || on.distanceM > reportOnRoadM) continue;
      reports.set(on.road.id, [...reports.get(on.road.id) ?? [], { station: on.station, item: { kind: 'report', point: on.point, reportedAt: report.reportedAt } }]);
    }
    const reasons = (road: RoadSegment): HouseholdCut[] => [
      ...(road.landslideAreaIds ?? (road.landslideAreaId ? [road.landslideAreaId] : [])).map(id => ({ kind: 'area' as const, id })),
      ...(road.status === 'blocked' && !road.landslideAreaId ? [{ kind: 'road' as const, roadId: road.id, name: road.name }] : []),
      ...(reports.get(road.id) ?? []).map(report => report.item),
    ];
    const blockers = new Map<string, { item: HouseholdCut; depth: number }>();
    const block = (items: HouseholdCut[], depth: number) => {
      for (const item of items) if ((blockers.get(cutKey(item))?.depth ?? Infinity) > depth) blockers.set(cutKey(item), { item, depth });
    };
    // Leave the huts' road towards each end that no cut lies before.
    const own = hit.road, length = nearestOnRoad(own, own.points.at(-1)!).station, ownReports = reports.get(own.id) ?? [];
    const start: string[] = [];
    if (cut(own)) block(reasons(own).filter(item => item.kind !== 'report'), 0);
    for (const [end, from, to] of [[own.points[0], 0, hit.station], [own.points.at(-1)!, hit.station, length]] as const) {
      const before = ownReports.filter(report => report.station >= from && report.station <= to);
      block(before.map(report => report.item), 0);
      // Huts beside a cut section reach only its nearer end.
      const nearer = Math.abs(hit.station - (end === own.points[0] ? 0 : length)) <= length / 2;
      if (!before.length && (!cut(own) || nearer)) start.push(key(end));
    }
    // Breadth first, never through a cut section.
    const depth = new Map(start.map(node => [node, 1]));
    const queue = [...start];
    let reached = start.some(node => targets.has(node));
    while (queue.length && !reached) {
      const node = queue.shift()!;
      for (const edge of edges.get(node) ?? []) {
        if (cut(edge.road) || reports.has(edge.road.id)) { block(reasons(edge.road), depth.get(node)!); continue; }
        if (depth.has(edge.to)) continue;
        depth.set(edge.to, depth.get(node)! + 1); queue.push(edge.to);
        if (targets.has(edge.to)) { reached = true; break; }
      }
    }
    const cutBy = reached ? [] : [...blockers.values()].sort((a, b) => a.depth - b.depth).map(entry => entry.item);
    return { cluster, projected, isolated: !reached, access: { roadId: own.id, point: hit.point, distanceM: hit.distanceM }, cutBy };
  });
}
