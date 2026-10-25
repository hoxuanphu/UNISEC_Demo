import type { RoadSegment } from '../../types/dear';
import type { LocalNetwork } from '../route-film/localNetwork';
import { analyseRoadJourney } from '../routes/journeyAnalysis';
import { nearestRoadAnchor } from '../routes/selectedRoadJourney';
import { projectedPathLength } from '../../terrain/pathGeometry';
import { deviceSpeeds, measure, type DevicePlan } from '../tracking/deviceFeed';
import type { HouseholdAccess } from './householdIsolation';

type Point = { x: number; y: number };
/** Teams available for the huts; the clusters with a stated need are reached first. */
const TEAMS = 2;
/** Field seconds: briefing before leaving, time with the people at the huts, hold before replay. */
const BRIEFING = 60, ON_SITE = 240, HOLD = 120;
/** On foot over a slide and up a terrace trail, then slower back with the people. */
const FOOT = 0.9, FOOT_WITH_PEOPLE = 0.6;
const cut = (road: RoadSegment) => road.status === 'blocked' || Boolean(road.landslideAreaId);
/** The network section a journey part was cut from, so the card names and inspects a real road. */
const sourceId = (road: RoadSegment) => road.id.split(':part:')[0];

export type HouseholdRescue = { plan: DevicePlan; householdId: string; rideM: number; footM: number };

/**
 * A rescue team for an isolated hut cluster, as it would go: by motorbike from the
 * nearest village on the rescue-on-foot route (never through a blocked road), to the
 * first cut on it, a landslide or a slide the residents reported; then on foot over
 * the slide and up the trail to the huts, time with the people, and back out on foot
 * with them to the vehicle. Simulated movement, not a dispatch record.
 */
export function householdRescues(network: LocalNetwork, households: HouseholdAccess[]): HouseholdRescue[] {
  const villages = network.places.filter(place => place.kind === 'village');
  const order = households.filter(item => item.isolated).sort((a, b) => Number(Boolean(b.cluster.need)) - Number(Boolean(a.cluster.need)) || b.cluster.people - a.cluster.people);
  const rescues: HouseholdRescue[] = [];
  for (const item of order) {
    if (rescues.length === TEAMS) break;
    const hut = { origin: item.projected, source: `household:${item.cluster.id}` };
    const best = villages.map(place => ({ place, result: analyseRoadJourney(network.roads, { origin: place.projected, source: place.id }, hut, true, 600, 'rescue-foot') }))
      .filter(entry => entry.result.route&&entry.result.route.segs.length&&entry.result.route.points.length>=2).sort((a, b) => a.result.route!.lengthKm - b.result.route!.lengthKm)[0];
    if (!best) continue;
    const route = best.result.route!, points: Point[] = [best.place.projected, ...route.points, item.projected];
    const path = measure({ points });
    if (!path) continue;
    // Where the vehicle must stop: the start of the first cut section, or a reported slide.
    const offset = Math.hypot(route.points[0].x-best.place.projected.x,route.points[0].y-best.place.projected.y);
    let station = offset, firstCut = Infinity, cutRoad: RoadSegment | undefined;
    for (const seg of route.segs) {
      const length = projectedPathLength(seg.points);
      if (cut(seg) && station < firstCut) { firstCut = station; cutRoad = seg; }
      station += length;
    }
    for (const report of item.cutBy) {
      if (report.kind !== 'report') continue;
      const at = nearestRoadAnchor([{ ...route.segs[0], id: 'rescue-path', points: route.points }], report.point, 60);
      if (at && offset + at.station < firstCut) { firstCut = offset + at.station; cutRoad = route.segs.find(seg => nearestRoadAnchor([seg], report.point, 60)); }
    }
    const roadEnd = offset+projectedPathLength(route.points);
    const rideM = Math.max(0, Math.min(firstCut, roadEnd) - 15), footM = path.total - rideM;
    const road = network.roads.find(candidate => candidate.id === sourceId(cutRoad ?? route.segs.at(-1)!)) ?? route.segs.at(-1)!;
    const ride = BRIEFING + rideM / deviceSpeeds.rescue, walk = ride + footM / FOOT, stay = walk + ON_SITE, out = stay + footM / FOOT_WITH_PEOPLE, back = out + HOLD + rideM / deviceSpeeds.rescue;
    const number = rescues.length + 3, id = `CH-${String(number).padStart(2, '0')}`;
    rescues.push({ householdId: item.cluster.id, rideM, footM, plan: {
      id, role: 'rescue', name: [`Đội cứu hộ ${String(number).padStart(2, '0')}`, `Rescue team ${String(number).padStart(2, '0')}`],
      road, path, from: 0, to: 1, duration: out, missionId: `household:${item.cluster.id}`, targetId: `household:${item.cluster.id}`, targetName: item.cluster.name,
      script: { cycle: back + HOLD, end: 'arrived', legs: [
        { until: BRIEFING, from: 0, to: 0, state: 'dispatching' },
        { until: ride, from: 0, to: rideM, state: 'responding' },
        { until: walk, from: rideM, to: path.total, state: 'crossing' },
        { until: stay, from: path.total, to: path.total, state: 'on-site' },
        { until: out, from: path.total, to: rideM, state: 'escorting' },
        { until: out + HOLD, from: rideM, to: rideM, state: 'evacuated' },
        { until: back, from: rideM, to: 0, state: 'moving' },
      ] },
    } });
  }
  return rescues;
}
