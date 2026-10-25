import type { GeometryRecord } from '../../geo/vector/types';
import type { RoadSegment } from '../../types/dear';
import { localConditionAreas } from '../route-film/localRoadConditions';
import type { LocalRoadAreaLink } from '../route-film/localNetwork';
import { roadAreaContact } from '../route-film/roadAreaContact';
import { roadProjected } from './selectedRoadJourney';

type Point = { x: number; y: number };
export type SurveyConditionArea = { id: string; state: 'occurred' | 'potential'; ring: Point[]; holes: Point[][] };
/** Same reach as the commune roads: an extent this close to the line touches the road. */
const touchM = 10;

/** Mapped landslide extents (survey and drawn), projected once for road checks. */
export function surveyConditionAreas(records: GeometryRecord[]): SurveyConditionArea[] {
  return localConditionAreas(records).map(area => ({ id: area.id, state: area.state,
    ring: area.coordinates.map(([lon, lat]) => roadProjected(lat, lon)),
    holes: (area.holes ?? []).map(ring => ring.map(([lon, lat]) => roadProjected(lat, lon))) }));
}

const km = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
const kmEn = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });

/**
 * The main road gets the rule the commune roads already follow: a mapped landslide
 * extent touching an open road makes it a section to verify, not a closure. Only a
 * field report or a manual status sets it blocked, so roads with either keep theirs.
 */
export function withSurveyRoadConditions(roads: RoadSegment[], areas: SurveyConditionArea[], keep: ReadonlySet<string> = new Set()): { roads: RoadSegment[]; links: LocalRoadAreaLink[] } {
  const links: LocalRoadAreaLink[] = [];
  if (!areas.length) return { roads, links };
  const next = roads.map(road => {
    if (road.status !== 'open' || keep.has(road.id) || road.points.length < 2) return road;
    const contacts = areas.flatMap(area => {
      const contact = roadAreaContact(road.points, area.ring, area.holes);
      return contact && contact.distanceM <= touchM ? [{ area, contact }] : [];
    }).sort((a, b) => a.contact.station - b.contact.station);
    if (!contacts.length) return road;
    for (const { area, contact } of contacts) links.push({ roadId: road.id, areaId: area.id, state: area.state,
      roadPoint: contact.roadPoint, areaPoint: contact.areaPoint, distanceM: contact.distanceM });
    const from = (road.fromKm ?? 0) + contacts[0].contact.station / 1000, to = (road.fromKm ?? 0) + contacts.at(-1)!.contact.station / 1000;
    const span = contacts.length > 1 ? [`km ${km(from)} đến ${km(to)}`, `km ${kmEn(from)} to ${kmEn(to)}`] : [`km ${km(from)}`, `km ${kmEn(from)}`];
    return { ...road, status: 'uncertain' as const, hz: 'landslide-risk', hazardIds: road.hazardIds ?? [],
      landslideAreaId: contacts[0].area.id, landslideAreaIds: contacts.map(item => item.area.id),
      note: [`${contacts.length} vết sạt đã khoanh chạm đường, ${span[0]}. Chưa xác minh đi qua được.`,
        `${contacts.length} mapped landslide extent${contacts.length > 1 ? 's' : ''} touch the road, ${span[1]}. Passage not verified.`] as [string, string] };
  });
  return { roads: next, links };
}
