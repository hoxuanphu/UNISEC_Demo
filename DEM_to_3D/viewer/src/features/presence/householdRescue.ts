import type { RoadSegment } from '../../types/dear';
import type { LocalNetwork } from '../route-film/localNetwork';
import { analyseRoadJourney } from '../routes/journeyAnalysis';
import { nearestRoadAnchor } from '../routes/selectedRoadJourney';
import { projectedPathLength } from '../../terrain/pathGeometry';
import { measure, routeSegments, scheduleSorties, type DevicePlan } from '../tracking/deviceFeed';
import { simulationPoint } from '../routes/routeSimulation';
import type { HouseholdAccess } from './householdIsolation';
import type { RescueBase } from '../tracking/rescueBase';

type Point = { x: number; y: number };
/** Teams available for the huts; the clusters with a stated need are reached first. */
const TEAMS = 2;
/** Field seconds awaiting an access plan at the cut. */
const ACCESS_WAIT = 240;
const cut = (road: RoadSegment) => road.status === 'blocked' || Boolean(road.landslideAreaId);
/** The network section a journey part was cut from, so the card names and inspects a real road. */
const sourceId = (road: RoadSegment) => road.id.split(':part:')[0];

export type HouseholdRescue = { plan: DevicePlan; householdId: string; rideM: number };

/** Approach on mapped roads only, from the nearest assembly point. Stop before the first cut and
 * await an access plan; a nearest-road projection does not establish a trail to the households.
 * Timing comes from the shared timetable (`scheduleSorties`), with every other team. */
export function householdRescues(network: LocalNetwork, households: HouseholdAccess[], bases: readonly RescueBase[]): HouseholdRescue[] {
  const order = households.filter(item => item.isolated && !item.cluster.rescued).sort((a, b) => Number(Boolean(b.cluster.need)) - Number(Boolean(a.cluster.need)) || b.cluster.people - a.cluster.people);
  const rescues: HouseholdRescue[] = [];
  for (const item of order) {
    if (rescues.length === TEAMS) break;
    const hut = { origin: item.projected, source: `household:${item.cluster.id}` };
    const best = bases.map(base => ({ base, route: analyseRoadJourney(network.roads, { origin: base.projected, source: base.id }, hut, true, 600, 'rescue-foot').route }))
      .filter(entry => entry.route?.segs.length && entry.route.points.length >= 2).sort((a, b) => a.route!.lengthKm - b.route!.lengthKm)[0];
    if (!best) continue;
    const route = best.route!;
    const mappedPath = measure({ points: route.points });
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
    const number = rescues.length + 3, id = `CH-${String(number).padStart(2, '0')}`;
    rescues.push({ householdId: item.cluster.id, rideM: path.total, plan: {
      id, role: 'rescue', name: [`Đội cứu hộ ${String(number).padStart(2, '0')}`, `Rescue team ${String(number).padStart(2, '0')}`],
      road, path, from: 0, to: 1, duration: 1, missionId: `household:${item.cluster.id}`, targetId: `household:${item.cluster.id}`, targetName: item.cluster.name,
      segments: routeSegments(route.segs, network.roads).filter(part => part.fromM < path.total), baseId: best.base.id,
      sortie: { homeM: 0, endM: path.total, workS: ACCESS_WAIT, workState: 'waiting', earliest: 0 },
    } });
  }
  const scheduled = scheduleSorties(rescues.map(rescue => rescue.plan));
  return rescues.map((rescue, index) => ({ ...rescue, plan: scheduled[index] }));
}
