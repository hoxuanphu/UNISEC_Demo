import type { RoadSegment } from '../../types/dear';
import type { NetworkPlace } from '../route-film/localNetwork';
import { nearestRoadAnchor } from '../routes/selectedRoadJourney';

type Point = { x: number; y: number };
/** Villages closer than this to an assembly point muster there rather than at a post of their own. */
const MERGE_M = 1000;
const gap = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * The commune's rescue assembly points. The first is where teams from the incident staging
 * point enter the commune (the mapped place nearest it); each village farther than a kilometre
 * from every assembly point keeps its own. Teams set out from the one nearest their task.
 * Given `roads`, each point is moved onto the nearest open road, so every team leaving it
 * starts from the same spot rather than each route picking its own way onto the network.
 */
export function rescueBases(places: readonly NetworkPlace[], staging?: Point, roads: readonly RoadSegment[] = []): NetworkPlace[] {
  const villages = places.filter(place => place.kind === 'village');
  const entry = staging ? [...places].sort((a, b) => gap(a.projected, staging) - gap(b.projected, staging))[0] : villages[0];
  const bases = entry ? [entry] : [];
  for (const village of villages) if (bases.every(base => gap(base.projected, village.projected) > MERGE_M)) bases.push(village);
  const open = roads.filter(road => road.status !== 'blocked' && !road.landslideAreaId);
  return bases.map(base => {
    const anchor = open.length ? nearestRoadAnchor(open, base.projected, 600) : null;
    return anchor ? { ...base, projected: anchor.point } : base;
  });
}
