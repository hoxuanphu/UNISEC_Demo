import type { DevicePosition, LocationFeed } from '../tracking/deviceFeed';
import type { HouseholdView } from './householdStatus';

type Point = { x: number; y: number };
/**
 * What the rescue picture looks like from above, as in a strategy game's fog of war:
 * - `reached`: ground a team has covered (the assembly points, every place a team has been,
 *   the huts already rescued). The fog lifts there.
 * - `need`: people who need rescue: cut-off huts, residents held at a closure, rescue requests.
 * - `unverified`: a signal with no information yet.
 * - `team`: where each team is now.
 * Everything else stays under fog: no team has been there, whatever the signals say.
 */
export type CoverageKind = 'reached' | 'need' | 'unverified' | 'team';
export type CoverageSpot = { kind: CoverageKind; point: Point; radiusM: number };
export type CoverageLayers = Record<'fog' | 'need' | 'unverified' | 'team' | 'rescued', boolean>;
export const defaultCoverageLayers: CoverageLayers = { fog: true, need: true, unverified: true, team: true, rescued: true };

/** Display buffer around recorded team presence, in metres; not a verified safe-area boundary. */
export const REACH_M = 900;
/** The trail keeps one point per cell of this size, in metres. */
const TRAIL_CELL_M = 100;

const stranded = (device: DevicePosition) => device.role === 'resident' && !!device.closureRoadId && (device.state === 'waiting' || device.state === 'approaching');

/** Every point a rescue team has passed this session, kept per 100 m cell: the ground explored. */
export function createRescueTrail(feed: LocationFeed | null, previous:readonly Point[]=[]) {
  const cells = new Map<string, Point>();
  for(const point of previous)cells.set(`${Math.round(point.x/TRAIL_CELL_M)},${Math.round(point.y/TRAIL_CELL_M)}`,point);
  const record = () => {
    for (const device of feed?.getSnapshot() ?? []) if (device.role === 'rescue') {
      const key = `${Math.round(device.point.x / TRAIL_CELL_M)},${Math.round(device.point.y / TRAIL_CELL_M)}`;
      if (!cells.has(key)) cells.set(key, device.point);
    }
  };
  record();
  const unsubscribe = feed?.subscribe(record) ?? (() => undefined);
  return { points: () => [...cells.values()], dispose: unsubscribe };
}

export function coverageSpots({ households, devices, trail, bases, requests }: {
  households: readonly HouseholdView[]; devices: readonly DevicePosition[]; trail: readonly Point[];
  bases: readonly Point[]; requests: readonly Point[];
}): CoverageSpot[] {
  const spots:CoverageSpot[] = [
    ...bases.map(point => ({ kind: 'reached' as const, point, radiusM: REACH_M * 1.5 })),
    ...trail.map(point => ({ kind: 'reached' as const, point, radiusM: REACH_M })),
    ...households.filter(item => item.status === 'rescued').map(item => ({ kind: 'reached' as const, point: item.projected, radiusM: REACH_M })),
    ...households.filter(item => item.status === 'cut-off' || item.status === 'team').map(item => ({ kind: 'need' as const, point: item.projected, radiusM: Math.min(1000,350+150*Math.sqrt(item.cluster.households||1)) })),
    ...devices.filter(stranded).map(device => ({ kind: 'need' as const, point: device.point, radiusM: 350 })),
    ...requests.map(point => ({ kind: 'need' as const, point, radiusM: 350 })),
    ...households.filter(item => item.status === 'unverified').map(item => ({ kind: 'unverified' as const, point: item.projected, radiusM: Math.min(1000,350+150*Math.sqrt(item.cluster.households||1)) })),
    ...devices.filter(device => device.role === 'rescue').map(device => ({ kind: 'team' as const, point: device.point, radiusM: REACH_M })),
  ];
  // One request may also be a stranded phone. Keep one symbol at that location.
  return spots.filter((spot,index)=>spot.kind!=='need'||!spots.slice(0,index).some(other=>other.kind==='need'&&Math.hypot(other.point.x-spot.point.x,other.point.y-spot.point.y)<10));
}

/** Share of the signals needing rescue that no team has reached yet: the headline of the coverage view. */
export function unreachedNeeds(spots: readonly CoverageSpot[]): number {
  const reached = spots.filter(spot => spot.kind === 'reached' || spot.kind === 'team');
  return spots.filter(spot => spot.kind === 'need' && !reached.some(other => Math.hypot(other.point.x - spot.point.x, other.point.y - spot.point.y) <= other.radiusM)).length;
}
