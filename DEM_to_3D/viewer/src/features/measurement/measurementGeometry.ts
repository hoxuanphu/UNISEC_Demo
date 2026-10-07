import type { MapScene } from '../map/mapContracts';
import type { Locale } from '../../types/dear';
import { projectedMeasurementPoint, type MeasurePoint } from './measurement';
import { showRoad } from '../map/layerAppearance';

export type MeasureGeometry = { name: string; points: MeasurePoint[]; closed?: boolean; kind?: 'road' | 'aoi' | 'route' };
export function measurementGeometry(scenario: MapScene | undefined, locale: Locale): { sources: MeasureGeometry[]; selected?: MeasureGeometry } {
  if (!scenario) return { sources: [] };
  const t = (name: [string, string]) => name[locale === 'vi' ? 0 : 1];
  const geometry = (name: string, points: Array<{ x: number; y: number }>, closed = false): MeasureGeometry | undefined => {
    const first = points[0]; let end = points.length;
    while (closed && end > 1 && first.x === points[end - 1].x && first.y === points[end - 1].y) end--;
    const vertices = points.slice(0, end);
    const projected = vertices.map(point => projectedMeasurementPoint(point.x, point.y));
    return projected.length && projected.every((point): point is MeasurePoint => point !== null) ? { name, points: projected, closed } : undefined;
  };
  const sources: MeasureGeometry[] = [];
  const add = (item?: MeasureGeometry) => { if (item) sources.push(item); };
  scenario.roads.forEach(road => {
    const routeSelected = scenario.layers.route && scenario.selectedRoute?.segs.some(segment => segment.id === road.id);
    const selected = routeSelected || scenario.selectedObjectId === `road:${road.id}`;
    if ((scenario.layers.roads || routeSelected) && showRoad(road.status, Boolean(selected), scenario.appearance?.roads ?? 'all')) add(geometry(t(road.name), road.points));
  });
  if (scenario.layers.communities) scenario.communities.forEach(community => add(geometry(community.name, [community.projected])));
  scenario.hazards.forEach(hazard => {
    if (scenario.layers[hazard.kind === 'landslide' ? 'landslide' : hazard.kind === 'flood' ? 'flood' : 'status']) add(geometry(t(hazard.name), [hazard.projected]));
  });
  scenario.responseSites?.forEach(site => { if (scenario.layers[site.kind]) add(geometry(t(site.name), [site.projected])); });
  if (scenario.layers.aoi && scenario.aoi) add(geometry(t(scenario.aoi.name), scenario.aoi.points, true));
  const [kind, id] = scenario.selectedObjectId?.split(':') ?? [];
  const road = kind === 'road' ? scenario.roads.find(item => item.id === id) : undefined;
  const selected = road ? geometry(t(road.name), road.points)
    : kind === 'aoi' && scenario.aoi ? geometry(t(scenario.aoi.name), scenario.aoi.points, true)
    : !scenario.selectedObjectId && scenario.selectedRoute ? geometry(t(scenario.selectedRoute.name), scenario.selectedRoute.points) : undefined;
  return { sources, selected: selected ? { ...selected, kind: road ? 'road' : kind === 'aoi' ? 'aoi' : 'route' } : undefined };
}

/** Pixel tolerance follows zoom; the result remains on the projected geometry. */
export function snapMeasurement(point: MeasurePoint, sources: MeasureGeometry[], project: (point: MeasurePoint) => { x: number; y: number }, tolerance = 10): { point: MeasurePoint; name?: string } {
  const cursor = project(point); let closest = tolerance, result = point, name: string | undefined;
  const consider = (candidate: MeasurePoint, label: string) => {
    const screen = project(candidate), distance = Math.hypot(screen.x - cursor.x, screen.y - cursor.y);
    if (distance <= closest) { closest = distance; result = candidate; name = label; }
  };
  for (const source of sources) {
    source.points.forEach(candidate => consider(candidate, source.name));
    const count = source.closed ? source.points.length : source.points.length - 1;
    for (let i = 0; i < count; i++) {
      const a = source.points[i], b = source.points[(i + 1) % source.points.length];
      const dx = b.x - a.x, dy = b.y - a.y, denominator = dx * dx + dy * dy;
      if (!denominator) continue;
      const fraction = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / denominator));
      const candidate = projectedMeasurementPoint(a.x + fraction * dx, a.y + fraction * dy);
      if (candidate) consider(candidate, source.name);
    }
  }
  return { point: result, name };
}
