import type { ResponseSite, RoadSegment } from '../../types/dear';
import { nearestRoadAnchor } from '../routes/selectedRoadJourney';

type Point = { x: number; y: number };
export type RescueBase = { id: string; name: [vi: string, en: string]; projected: Point };
/** A staging site this close to an open commune road is one of the commune's assembly points. */
const ON_NETWORK_M = 300;

/**
 * Where the commune's rescue teams muster: the scenario's staging sites on the commune road
 * network (the incident's main staging point lies far outside it). Each is placed exactly on
 * its open road, so every team leaving it starts from the same spot.
 */
export function rescueBases(sites: readonly ResponseSite[], roads: readonly RoadSegment[]): RescueBase[] {
  const open = roads.filter(road => road.status !== 'blocked' && !road.landslideAreaId);
  return sites.filter(site => site.kind === 'staging').flatMap(site => {
    const anchor = nearestRoadAnchor(open, site.projected, ON_NETWORK_M);
    return anchor ? [{ id: site.id, name: site.name, projected: anchor.point }] : [];
  });
}
