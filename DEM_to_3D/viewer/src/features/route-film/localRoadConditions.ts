import type { RoadSegment, ScenarioRoute } from '../../types/dear';
import { projectedPathLength } from '../../terrain/pathGeometry';
import { analyseRoadJourney, type JourneySelection } from '../routes/journeyAnalysis';
import { roadProjected } from '../routes/selectedRoadJourney';
import { roadAreaContact } from './roadAreaContact';
import type { LocalNetwork, LocalRoadAreaLink } from './localNetwork';
import type { GeometryRecord } from '../../geo/vector/types';
import { landslideAreaOf } from '../landslides/landslideAreas';

// Authored conditions for the prepared Chế Tạo scenario, not satellite detections or
// a Google/Apple routing response. Preserve that distinction in the source contract.
export const northernRoadConditions = {
  source: 'authored-scenario', observedAt: null,
  corridor: ['local-7-1', 'local-10-0', 'local-17-0'],
  // The northbound continuation is also shown when inspecting the whole network.
  roads: ['local-7-1', 'local-10-0', 'local-10-1', 'local-17-0'],
  maxDistanceM: 10,
} as const;

type Point = { x: number; y: number };
/** Both yellow layers participate. Keep record IDs so warnings inspect the actual
 * survey/drawn polygon, including edits, visibility and multipart outlines. */
type ConditionArea = LocalNetwork['areas'][number] & { state: 'occurred' | 'potential'; holes?: number[][][] };
export function localConditionAreas(records: GeometryRecord[]): ConditionArea[] {
  return records.flatMap(record => {
    const area = landslideAreaOf(record);
    // Visibility is a display preference, not a retraction of the road warning.
    if (!area) return [];
    const geometry = record.feature.geometry;
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
    return polygons.map(rings => ({ id: record.id, kind: 'landslide' as const, state: area.state, coordinates: rings[0], holes: rings.slice(1) }));
  });
}

function splitClosures(road: RoadSegment, closures: Array<{ station: number; areaId: string; state: 'occurred' | 'potential'; blocked: boolean }>): RoadSegment[] {
  const stations = [0];
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i];
    stations.push(stations[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const length = stations.at(-1)!;
  const at = (station: number): Point => {
    if (station <= 0) return road.points[0];
    if (station >= length) return road.points.at(-1)!;
    const i = stations.findIndex(value => value >= station);
    const t = (station - stations[i - 1]) / (stations[i] - stations[i - 1]);
    const a = road.points[i - 1], b = road.points[i];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };
  const intervals: Array<{ from: number; to: number; areaIds: string[]; state: 'occurred' | 'potential'; blocked: boolean }> = [];
  for (const closure of [...closures].sort((a, b) => a.station-b.station)) {
    const from = Math.max(0, closure.station-35), to = Math.min(length, closure.station+35), previous = intervals.at(-1);
    // One closure per continuous affected stretch, with every source area retained.
    if (previous && from <= previous.to) {
      previous.to = Math.max(previous.to, to);
      previous.blocked ||= closure.blocked;
      if (closure.state === 'occurred' && previous.state !== 'occurred') {
        previous.areaIds.unshift(closure.areaId); previous.state = 'occurred';
      } else previous.areaIds.push(closure.areaId);
    } else intervals.push({ from, to, areaIds: [closure.areaId], state: closure.state, blocked: closure.blocked });
  }
  const cuts = [...new Set([0, ...intervals.flatMap(interval => [interval.from, interval.to]), length])].sort((a, b) => a - b);
  // Reuse each boundary point exactly, so filtering a closure disconnects the graph.
  const boundaries = cuts.map(at);
  return cuts.slice(1).map((to, i) => {
    const points = [boundaries[i], ...road.points.filter((_, j) => stations[j] > cuts[i] && stations[j] < to), boundaries[i + 1]];
    const closure = intervals.find(interval => (cuts[i] + to) / 2 >= interval.from && (cuts[i] + to) / 2 <= interval.to);
    return { ...road, id: `${road.id}:condition:${i}`, points, len: projectedPathLength(points) / 1000,
      status: closure ? closure.blocked || road.status === 'blocked' ? 'blocked' : 'uncertain' : road.status,
      ...(closure ? { hz: closure.blocked ? 'landslide' : 'landslide-risk', landslideAreaId: closure.areaIds[0], landslideAreaIds: closure.areaIds,
        note: closure.blocked ? ['Sạt lở trên đường. Không đi qua đoạn này.', 'Landslide on the road. Do not cross this section.'] as [string,string]
          : closure.state === 'occurred' ? ['Có vùng sạt lở sát đường. Chưa xác nhận khả năng đi qua.', 'A mapped landslide is beside the road. Passage has not been confirmed.'] as [string,string]
          : ['Có nguy cơ sạt lở. Cần kiểm tra trước khi đi.', 'Landslide risk. Check before travel.'] as [string,string] } : {}),
    };
  });
}

/** Keep original KMZ coordinates and status basis intact; the authored overlay is separate. */
export function withLocalRoadConditions(network: LocalNetwork, mappedRecords: GeometryRecord[] = []): LocalNetwork {
  if (network.conditions) return network;
  const conditionAreas: ConditionArea[] = [...network.areas.filter(area => area.kind === 'landslide').map(area => ({ ...area, state: 'occurred' as const })), ...localConditionAreas(mappedRecords)];
  const areas = conditionAreas.map(area => ({ ...area, ring: area.coordinates.map(([lon,lat]) => roadProjected(lat,lon)),
    projectedHoles: (area.holes ?? []).map(ring => ring.map(([lon,lat]) => roadProjected(lat,lon))) }));
  const bounds = (points: Point[]) => ({ minX: Math.min(...points.map(p=>p.x)), maxX: Math.max(...points.map(p=>p.x)),
    minY: Math.min(...points.map(p=>p.y)), maxY: Math.max(...points.map(p=>p.y)) });
  const candidates = areas.map(area => ({ ...area, bounds: bounds(area.ring) }));
  const areaLinks: LocalRoadAreaLink[] = [];
  const roads = network.roads.flatMap(road => {
    const authoredClosure = northernRoadConditions.roads.some(id => id === road.id);
    const box = bounds(road.points), contacts = new Map<string, NonNullable<ReturnType<typeof roadAreaContact>> & { state: 'occurred' | 'potential' }>();
    for (const area of candidates) {
      const b = area.bounds, dx = Math.max(box.minX-b.maxX,b.minX-box.maxX,0), dy = Math.max(box.minY-b.maxY,b.minY-box.maxY,0);
      if (Math.hypot(dx,dy) > northernRoadConditions.maxDistanceM) continue;
      const contact = roadAreaContact(road.points, area.ring, area.projectedHoles);
      if (!contact || contact.distanceM > northernRoadConditions.maxDistanceM) continue;
      if (!contacts.has(area.id) || contact.distanceM < contacts.get(area.id)!.distanceM) contacts.set(area.id, { ...contact, state: area.state });
    }
    const closures = [...contacts].map(([areaId, contact]) => {
      areaLinks.push({ roadId: road.id, areaId, state: contact.state, roadPoint: contact.roadPoint, areaPoint: contact.areaPoint, distanceM: contact.distanceM });
      // An unreviewed extent near another road raises a check, not a fabricated
      // closure. The authored northern conditions retain their explicit basis.
      return { station: contact.station, areaId, state: contact.state, blocked: authoredClosure && contact.state === 'occurred' };
    });
    return closures.length ? splitClosures(road, closures) : [road];
  });
  return { ...network, conditions: { source: northernRoadConditions.source, observedAt: northernRoadConditions.observedAt,
    roadIds: [...new Set(areaLinks.map(link => link.roadId))], areaLinks }, roads };
}

/** Inspectable blocked northern corridor, never an eligible route choice. Connect only
 * through the prepared graph, and only when both chosen endpoints reach its ends. */
export function northernComparisonRoute(network: LocalNetwork, start: JourneySelection | null, end: JourneySelection | null): ScenarioRoute | null {
  if (!start || !end || Math.hypot(start.origin.x - end.origin.x, start.origin.y - end.origin.y) < 1) return null;
  const corridor = northernRoadConditions.corridor.flatMap(id => network.roads.filter(road => road.id === id || road.id.startsWith(`${id}:condition:`)));
  if (!corridor.length || !corridor.some(road => road.status === 'blocked')) return null;
  const ids = new Set(corridor.map(road => road.id));
  const connectors = network.roads.filter(road => !ids.has(road.id));
  const join = (selection: JourneySelection, origin: Point) => {
    // These corridor junctions are existing graph vertices, never new access roads.
    const result = analyseRoadJourney(connectors, selection, { origin, source: 'junction' }, false, 250);
    return result.kind === 'same-connection' || result.kind === 'same-location' ? [] : result.route?.segs ?? null;
  };
  const candidates = [corridor, [...corridor].reverse().map(road => ({ ...road, points: [...road.points].reverse() }))].flatMap(middle => {
    const prefix = join(start, middle[0].points[0]);
    const suffix = join(end, middle.at(-1)!.points.at(-1)!);
    if (!prefix || !suffix) return [];
    const segs = [...prefix, ...middle, ...[...suffix].reverse().map(road => ({ ...road, points: [...road.points].reverse() }))];
    // Repeated roads would describe a journey out and back, not an alternative.
    const sourceIds = segs.map(road => road.id.split(':part:')[0]);
    if (new Set(sourceIds).size !== sourceIds.length) return [];
    for (let i = 1; i < segs.length; i++) {
      const a = segs[i - 1].points.at(-1)!, b = segs[i].points[0];
      if (Math.hypot(a.x - b.x, a.y - b.y) > .01) return [];
    }
    const points = segs.flatMap((road, i) => i ? road.points.slice(1) : road.points);
    return [{ id: 'local-northern-comparison', name: ['Đường vòng phía bắc', 'Northern road'] as [string, string],
      communityId: '', type: 'direct' as const, status: 'blocked' as const, segs, points, lengthKm: projectedPathLength(points) / 1000 }];
  });
  return candidates.sort((a, b) => a.lengthKm - b.lengthKm)[0] ?? null;
}
