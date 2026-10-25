import type { RoadSegment } from '../../types/dear';
import type { LocalNetwork } from '../route-film/localNetwork';
import { analyseRoadJourney } from '../routes/journeyAnalysis';
import { nearestRoadAnchor } from '../routes/selectedRoadJourney';
import { projectedPathLength } from '../../terrain/pathGeometry';
import { deviceSpeeds, measure, type DevicePlan } from '../tracking/deviceFeed';
import { simulationPoint } from '../routes/routeSimulation';
import type { HouseholdAccess } from './householdIsolation';

type Point = { x: number; y: number };
/** Teams available for the huts; the clusters with a stated need are reached first. */
const TEAMS = 2;
/** Field seconds: briefing, awaiting an access plan, hold before replay. */
const BRIEFING = 60, ACCESS_WAIT = 240, HOLD = 120;
const cut = (road: RoadSegment) => road.status === 'blocked' || Boolean(road.landslideAreaId);
/** The network section a journey part was cut from, so the card names and inspects a real road. */
const sourceId = (road: RoadSegment) => road.id.split(':part:')[0];

export type HouseholdRescue = { plan: DevicePlan; householdId: string; rideM: number };

/** Approach on mapped roads only. Stop before the first cut and await an access plan;
 * a nearest-road projection does not establish a trail to the households. */
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
    const route = best.result.route!, mappedPath = measure({ points: route.points });
    if (!mappedPath) continue;
    // Where the vehicle must stop: the start of the first cut section, or a reported slide.
    let station = 0, firstCut = Infinity;
    for (const seg of route.segs) {
      const length = projectedPathLength(seg.points);
      if (cut(seg) && station < firstCut) { firstCut = station; }
      station += length;
    }
    for (const report of item.cutBy) {
      if (report.kind !== 'report') continue;
      const at = nearestRoadAnchor([{ ...route.segs[0], id: 'rescue-path', points: route.points }], report.point, 60);
      if (at && at.station < firstCut) { firstCut = at.station; }
    }
    const rideM = Math.max(0, Math.min(firstCut, mappedPath.total) - 15);
    const points: Point[] = mappedPath.points.filter((_, index) => mappedPath.stations[index] < rideM);
    points.push(simulationPoint(mappedPath, rideM));
    const path = measure({ points });
    if (!path) continue;
    const road = network.roads.find(candidate => candidate.id === sourceId(route.segs[0])) ?? route.segs[0];
    if (cut(road)) continue;
    const ride = BRIEFING + path.total / deviceSpeeds.rescue, wait = ride + ACCESS_WAIT, back = wait + path.total / deviceSpeeds.rescue;
    const number = rescues.length + 3, id = `CH-${String(number).padStart(2, '0')}`;
    rescues.push({ householdId: item.cluster.id, rideM: path.total, plan: {
      id, role: 'rescue', name: [`Đội cứu hộ ${String(number).padStart(2, '0')}`, `Rescue team ${String(number).padStart(2, '0')}`],
      road, path, from: 0, to: 1, duration: back, missionId: `household:${item.cluster.id}`, targetId: `household:${item.cluster.id}`, targetName: item.cluster.name,
      script: { cycle: back + HOLD, end: 'arrived', legs: [
        { until: BRIEFING, from: 0, to: 0, state: 'dispatching' },
        { until: ride, from: 0, to: path.total, state: 'responding' },
        { until: wait, from: path.total, to: path.total, state: 'waiting' },
        { until: back, from: path.total, to: 0, state: 'moving' },
      ] },
    } });
  }
  return rescues;
}
