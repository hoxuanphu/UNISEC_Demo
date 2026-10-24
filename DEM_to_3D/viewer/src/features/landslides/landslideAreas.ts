import { defaultLandslideFillOpacity, landslideFillOpacity } from './landslideAppearance';
import type { GeometryRecord, VectorGeometry } from '../../geo/vector/types';
import { isPolygon } from '../../geo/vector/types';
import { validateGeometry } from '../../geo/vector/validateGeometry';
import type { RoadSegment } from '../../types/dear';

export const landslideAreaKey = 'dearLandslideArea';
export const areaSources = ['field', 'imagery', 'resident', 'historical', 'terrain'] as const;
export type AreaSource = typeof areaSources[number];
export type LandslideArea = {
  schema: 'landslide-area/v1';
  state: 'potential' | 'occurred';
  part: 'source' | 'runout' | 'deposit' | 'undifferentiated';
  review: 'unreviewed' | 'reviewed' | 'field-checked';
  reviewer: string; reviewedAt: string;
  sources: AreaSource[]; basis: string; observedAt: string;
  imageReference: string; imageResolutionM: number | null; boundaryAccuracyM: number | null;
  observationIds: string[];
  networkVersion: string;
  roadLinks: Array<{ roadId: string; relation: 'threatens' | 'affected'; fromM?: number; toM?: number }>;
  mappedAt: string; updatedAt: string;
};
const date = (v: unknown, empty = false): v is string => typeof v === 'string' && ((empty && !v) || (/T.*(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v))));
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const positive = (v: unknown): boolean => v === null || (typeof v === 'number' && Number.isFinite(v) && v > 0);
export function validateLandslideArea(raw: unknown): LandslideArea {
  const a = raw as LandslideArea;
  if (!a || a.schema !== 'landslide-area/v1' || !['potential', 'occurred'].includes(a.state) ||
    !['source', 'runout', 'deposit', 'undifferentiated'].includes(a.part) || (a.state === 'potential' && a.part === 'deposit') ||
    !['unreviewed', 'reviewed', 'field-checked'].includes(a.review) || !text(a.reviewer, 160) || !date(a.reviewedAt, true) ||
    !Array.isArray(a.sources) || a.sources.length > areaSources.length || new Set(a.sources).size !== a.sources.length || !a.sources.every(s => areaSources.includes(s)) ||
    !text(a.basis, 2000) || !date(a.observedAt, true) || !text(a.imageReference, 500) || !positive(a.imageResolutionM) || !positive(a.boundaryAccuracyM) ||
    !Array.isArray(a.observationIds) || a.observationIds.length > 50 || !a.observationIds.every(id => text(id, 200) && !!id) || new Set(a.observationIds).size !== a.observationIds.length || !text(a.networkVersion,160) ||
    !Array.isArray(a.roadLinks) || a.roadLinks.length > 100 || new Set(a.roadLinks.map(l => l?.roadId)).size !== a.roadLinks.length ||
    !a.roadLinks.every(l => l && text(l.roadId, 160) && !!l.roadId && ['threatens', 'affected'].includes(l.relation) && (a.state !== 'potential' || l.relation === 'threatens') &&
      ((l.fromM === undefined && l.toM === undefined) || (typeof l.fromM === 'number' && typeof l.toM === 'number' && Number.isFinite(l.fromM) && Number.isFinite(l.toM) && l.fromM >= 0 && l.toM > l.fromM))) ||
    !date(a.mappedAt) || !date(a.updatedAt)) throw new Error('Invalid landslide area');
  return a;
}
export function landslideAreaOf(record: GeometryRecord): LandslideArea | null {
  if (!isPolygon(record.feature.geometry) || record.role !== 'reference') return null;
  try { const raw = record.feature.properties[landslideAreaKey]; return validateLandslideArea(typeof raw === 'string' ? JSON.parse(raw) : raw); } catch { return null; }
}
export function newLandslideArea(state: LandslideArea['state'], networkVersion = ''): LandslideArea {
  const now = new Date().toISOString();
  return { schema: 'landslide-area/v1', state, part: 'undifferentiated', review: 'unreviewed', reviewer: '', reviewedAt: '', sources: [], basis: '', observedAt: '', imageReference: '', imageResolutionM: null, boundaryAccuracyM: null, observationIds: [], networkVersion, roadLinks: [], mappedAt: now, updatedAt: now };
}
export function createLandslideArea(raw: VectorGeometry, state: LandslideArea['state'], name: string, networkVersion = ''): GeometryRecord {
  const geometry = validateGeometry(raw);
  if (!isPolygon(geometry)) throw new Error('A landslide area requires a polygon');
  const value = newLandslideArea(state, networkVersion);
  return { id: crypto.randomUUID(), name, role: 'reference', visible: true, source: { name: 'Landslide mapping', format: 'drawing', importedAt: value.mappedAt }, feature: { type: 'Feature', geometry, properties: { name, [landslideAreaKey]: value } } };
}
export function roadLengthM(road: Pick<RoadSegment, 'points'>): number {
  return road.points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - road.points[i].x, p.y - road.points[i].y), 0);
}
/** Chainage follows stored road geometry, independently of a chosen route's direction. */
export function roadAreaSection(road: Pick<RoadSegment, 'points'>, link: LandslideArea['roadLinks'][number]): RoadSegment['points'] {
  if (link.fromM === undefined || link.toM === undefined) return road.points;
  const result: RoadSegment['points'] = [];
  let distance = 0;
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length > 0 && distance < link.toM && distance + length > link.fromM) {
      for (const at of [Math.max(link.fromM, distance), Math.min(link.toM, distance + length)]) {
        const t = (at - distance) / length, p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        if (!result.length || Math.hypot(p.x - result.at(-1)!.x, p.y - result.at(-1)!.y) > .001) result.push(p);
      }
    }
    distance += length;
  }
  return result;
}
export function areaPublicationIssue(a: LandslideArea, roads?: RoadSegment[], networkVersion?: string): 'evidence' | 'imagery' | 'review' | 'road' | 'network' | null {
  if (!a.basis.trim() || !a.sources.length) return 'evidence';
  if (a.sources.includes('imagery') && !a.imageReference.trim()) return 'imagery';
  if (a.review !== 'unreviewed' && (!a.reviewer.trim() || !a.reviewedAt || (a.review === 'field-checked' && !a.sources.includes('field')))) return 'review';
  if (roads && a.roadLinks.length && (!networkVersion || a.networkVersion !== networkVersion)) return 'network';
  if (roads && a.roadLinks.some(l => { const road = roads.find(r => r.id === l.roadId); return !road || (l.toM !== undefined && l.toM > roadLengthM(road) + .1); })) return 'road';
  return null;
}
/** Round-trip evidence links only bind to source points included in the same import. */
export function remapLandslideEvidence(records: GeometryRecord[]): GeometryRecord[] {
  const ids = new Map(records.flatMap(r => typeof r.feature.properties.dearRecordId === 'string' ? [[r.feature.properties.dearRecordId, r.id] as const] : []));
  return records.map(record => {
    if (record.feature.properties[landslideAreaKey] == null) return record;
    const value = landslideAreaOf(record);
    if (!value) throw new Error('Invalid landslide area metadata');
    return {...record, feature:{...record.feature,properties:{...record.feature.properties,[landslideAreaKey]:{...value,observationIds:value.observationIds.map(id => ids.get(id) ?? (id.startsWith('external:') ? id : 'external:'+id))}}}};
  });
}
/** The boundary is geographic geometry; evidence and review state are read in its record. */
export const landslideBoundaryColor = '#ffe36a';
export const landslideBoundaryCasing = '#3c3921';
export function landslideAreaStyle(a: Pick<LandslideArea, 'state' | 'review'>, selected = false, fillOpacity = defaultLandslideFillOpacity, compact = false) {
  return {
    color: landslideBoundaryColor,
    weight: selected ? 3.5 : compact ? 1.6 : 2.5,
    dashArray: a.state === 'potential' ? '8 4' : undefined,
    fillOpacity: landslideFillOpacity(fillOpacity) * (compact && !selected ? .16 / defaultLandslideFillOpacity : 1),
    lineCap: 'round' as const,
    lineJoin: 'round' as const
  };
}

/** Review applies to the mapped boundary that was checked, not to later geometry edits. */
export function revisedLandslideBoundary(area: LandslideArea, at: string): LandslideArea {
  return { ...area, review: 'unreviewed', reviewer: '', reviewedAt: '', updatedAt: at };
}
