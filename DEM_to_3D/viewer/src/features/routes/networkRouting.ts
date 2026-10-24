import type { Community, RoadSegment, RoutingAssumptions, ScenarioRoute, ScenarioRoutePair } from '../../types/dear';
import { projectedPathLength } from '../../terrain/pathGeometry';
import { compareRoadConditions, roadCondition, routeStatus } from './roadConditions';

type Point = { x: number; y: number };
type Step = { road: RoadSegment; reversed: boolean };
const key = (point: Point) => `${point.x},${point.y}`;
export const routingPolicy = { algorithm: 'dijkstra', version: 'network-v2', weight: 'travel-time', uncertainCostMultiplier: 3 } as const;
/** Resident advice: the shortest unblocked route is the reference. A route with fewer sections
 * to check is preferred only while it is at most this much longer; a long detour is not
 * safer advice than a short road that may be difficult but is not reported blocked. */
export const residentDetourTolerance = 1.25;

/** Edge weight: hours at the mid scenario speed of the road class, so a short footpath does
 * not outrank a longer vehicle road. Without speeds the weight is distance. */
const edgeWeight = (road: RoadSegment, metres: number, speeds?: RoutingAssumptions) =>
  speeds ? metres / 1000 / ((speeds[road.cls][0] + speeds[road.cls][1]) / 2) : metres;

/** Prepared graph: endpoints are explicitly connected. Do not snap unknown roads
 * or connect line crossings without a surveyed network junction. */
export function findPreparedNetworkPath(roads: RoadSegment[], start: Point, destination: Point,
  ignoreStatus: boolean, excluded = new Set<string>(), uncertainCostMultiplier: number = routingPolicy.uncertainCostMultiplier,
  speeds?: RoutingAssumptions, conditionsFirst = false): Step[] | null {
  const adjacency = new Map<string, Array<Step & { to: string; cost: number; risk: number; uncertain: number }>>();
  for (const road of [...roads].sort((a, b) => a.id.localeCompare(b.id))) {
    if (excluded.has(road.id) || (!ignoreStatus && road.status === 'blocked') || road.points.length < 2) continue;
    const a = key(road.points[0]), b = key(road.points.at(-1)!);
    const length = projectedPathLength(road.points);
    if (!Number.isFinite(length) || length <= 0) continue;
    // Versioned demo policy: uncertainty adds cost, not proof of passage.
    const condition = roadCondition(road);
    const cost = edgeWeight(road, length, speeds) * (!ignoreStatus && (condition === 'uncertain' || condition === 'risk') ? uncertainCostMultiplier : 1);
    const exposure = { risk: condition === 'risk' ? length : 0, uncertain: condition === 'uncertain' ? length : 0 };
    const forward = adjacency.get(a) ?? []; forward.push({ road, reversed: false, to: b, cost, ...exposure }); adjacency.set(a, forward);
    const reverse = adjacency.get(b) ?? []; reverse.push({ road, reversed: true, to: a, cost, ...exposure }); adjacency.set(b, reverse);
  }
  const from = key(start), to = key(destination);
  if (!adjacency.has(from) || !adjacency.has(to)) return null;
  type Cost = [number, number, number];
  const compare = (a: Cost, b: Cost) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  const distance = new Map<string, Cost>([[from, [0, 0, 0]]]), previous = new Map<string, { from: string; step: Step }>();
  const visited = new Set<string>();
  while (true) {
    let current: string | null = null, best: Cost = [Infinity, Infinity, Infinity];
    for (const [node, value] of distance) if (!visited.has(node) && compare(value, best) < 0) { current = node; best = value; }
    if (current === null) return null;
    if (current === to) break;
    visited.add(current);
    for (const edge of adjacency.get(current) ?? []) {
      if (visited.has(edge.to)) continue;
      const candidate: Cost = conditionsFirst ? [best[0] + edge.risk, best[1] + edge.uncertain, best[2] + edge.cost] : [0, 0, best[2] + edge.cost];
      if (compare(candidate, distance.get(edge.to) ?? [Infinity, Infinity, Infinity]) < 0) {
        distance.set(edge.to, candidate); previous.set(edge.to, { from: current, step: edge });
      }
    }
  }
  const result: Step[] = [];
  for (let node = to; node !== from;) {
    const entry = previous.get(node); if (!entry) return null;
    result.unshift(entry.step); node = entry.from;
  }
  return result.length ? result : null;
}

/** Foot rescue planning: known closures are never eligible. Minimise exposure to
 * mapped risk, then unverified stretches, then distance. No everyday detour cap. */
export const findRescueFootPath = (roads: RoadSegment[], start: Point, end: Point) =>
  findPreparedNetworkPath(roads, start, end, false, new Set(), 1, undefined, true);

/** Resident directions and village access use one bounded condition preference. */
export function findConditionAwarePath(roads: RoadSegment[], start: Point, end: Point, ignoreStatus = false): Step[] | null {
  const shortest = findPreparedNetworkPath(roads, start, end, ignoreStatus, new Set(), 1);
  if (!shortest) return null;
  const length = (path: Step[]) => path.reduce((sum, step) => sum + projectedPathLength(step.road.points), 0);
  const candidates = [shortest,
    findPreparedNetworkPath(roads.filter(road => roadCondition(road) === 'open'), start, end, false),
    findPreparedNetworkPath(roads, start, end, ignoreStatus),
    ...shortest.map(step => findPreparedNetworkPath(roads, start, end, ignoreStatus, new Set([step.road.id]), 1)),
  ].filter((path): path is Step[] => !!path && length(path) <= length(shortest) * residentDetourTolerance);
  return candidates.sort((a,b) => compareRoadConditions(a.map(step=>step.road), b.map(step=>step.road)))[0];
}

function route(steps: Step[], community: Community, type: 'direct' | 'candidate'): ScenarioRoute {
  const segs = steps.map(step => step.reversed ? { ...step.road, points: [...step.road.points].reverse() } : step.road);
  const points = segs.flatMap((segment, index) => index ? segment.points.slice(1) : segment.points);
  const status = routeStatus({status: 'open', segs});
  // Keep the mapped road name when sections share it. Shortest does not imply
  // an officially designated main road, and an alternative is not always a bypass.
  const name = [0, 1].map(index => {
    const names = segs.map(segment => segment.name[index].split(',')[0].trim());
    return names.every(value => value === names[0]) ? names[0]
      : index === 0 ? `Tuyến tiếp cận ${community.name}` : `Access route to ${community.name}`;
  }) as [string, string];
  return { id: `RT-${community.id}-${type.toUpperCase()}`, communityId: community.id, type, name,
    points, segs, status, lengthKm: Number((projectedPathLength(points) / 1000).toFixed(2)) };
}

/** Shortest mapped baseline and candidate after blockage filtering. When all
 * options are blocked, keep known geometry for inspection, not recommendation. */
export function buildNetworkRoutes(roads: RoadSegment[], communities: Community[], staging: Point, speeds?: RoutingAssumptions): Map<string, ScenarioRoutePair> {
  const routes = new Map<string, ScenarioRoutePair>();
  const find = (ignoreStatus: boolean, excluded?: Set<string>) => (community: Community) =>
    findPreparedNetworkPath(roads, staging, community.projected, ignoreStatus, excluded, routingPolicy.uncertainCostMultiplier, speeds);
  for (const community of communities) {
    const baseline = find(true)(community);
    if (!baseline) { routes.set(community.id, { direct: null, candidate: null }); continue; }
    const preferred = speeds ? find(false)(community) : findConditionAwarePath(roads, staging, community.projected);
    let alternative: Step[] | null = null, alternativeLength = Infinity;
    // A distinct path can be found by excluding each edge of the baseline.
    // Retain the fastest known alternative for comparison even if blocked.
    for (const step of baseline) {
      const path = find(true, new Set([step.road.id]))(community);
      const length = path?.reduce((sum, item) => sum + edgeWeight(item.road, projectedPathLength(item.road.points), speeds), 0) ?? Infinity;
      if (length < alternativeLength) { alternative = path; alternativeLength = length; }
    }
    const differs = preferred && preferred.map(step => step.road.id).join(',') !== baseline.map(step => step.road.id).join(',');
    if (differs || (!preferred && alternative)) {
      routes.set(community.id, {
        direct: route(baseline, community, 'direct'),
        candidate: route(differs ? preferred! : alternative!, community, 'candidate')
      });
    } else routes.set(community.id, { direct: null, candidate: route(preferred ?? baseline, community, 'candidate') });
  }
  return routes;
}
