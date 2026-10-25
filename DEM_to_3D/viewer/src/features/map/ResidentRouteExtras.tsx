import { useEffect, type MutableRefObject } from 'react';
import * as L from 'leaflet';
import type { Locale, RoadSegment, ScenarioRoute } from '../../types/dear';
import type { TerrainMetadata } from '../../types/terrain';
import { projectedToWgs84 } from '../../terrain/coordinate';
import { mapPane } from './mapLayerOrder';
import type { LocalRoadAreaLink } from '../route-film/localNetwork';
import { roadConditionSvg } from './roadConditionSvg';
import { roadColors } from '../../terrain/roadStyle';
import { routeStatus } from '../routes/roadConditions';
import './resident-route-extras.css';
import { roadConditionSigns, roadConditionSignLabel } from './roadConditionSigns';

type Point = { x: number; y: number };
const latLngs = (points: Point[], metadata: TerrainMetadata) => points.flatMap(point => {
  const p = projectedToWgs84(metadata, point);
  return p.latitude === undefined || p.longitude === undefined ? [] : [L.latLng(p.latitude, p.longitude)];
});
/** The point halfway along a line, by length. */
function midway(points: L.LatLng[], map: L.Map): L.LatLng {
  const lengths = points.slice(1).map((p, i) => map.distance(points[i], p));
  let half = lengths.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (half <= lengths[i]) { const t = lengths[i] ? half / lengths[i] : 0; return L.latLng(points[i].lat + (points[i + 1].lat - points[i].lat) * t, points[i].lng + (points[i + 1].lng - points[i].lng) * t); }
    half -= lengths[i];
  }
  return points[Math.floor(points.length / 2)];
}
const ALTERNATIVE_PANE = 'dear-route-alternatives';
const OTHER_ROUTE = { color: roadColors.alternative, casing: roadColors.alternativeCasing };

/**
 * Resident map extras: other unblocked routes as quieter lines with their length, tappable to
 * choose (as in web maps), and a closure sign on each blocked section.
 */
export function ResidentRouteExtras({ mapRef, metadata, alternatives, alerts, comparison, selected, locale, onChoose, onInspectRoad, areaLinks, showAreaLinks = true, hazardPoints }: {
  mapRef: MutableRefObject<L.Map | null>;
  metadata?: TerrainMetadata;
  alternatives: ScenarioRoute[];
  alerts: RoadSegment[];
  comparison?: ScenarioRoute | null;
  selected?: ScenarioRoute | null;
  areaLinks?: LocalRoadAreaLink[];
  showAreaLinks?: boolean;
  locale: Locale;
  onChoose?: (id: string) => void;
  onInspectRoad?: (id: string) => void;
  /** Shown incident landslides: a sign at one of them is carried by its pin. */
  hazardPoints?: Array<{ x: number; y: number }>;
}) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !metadata) return;
    // Between the road network and the advised route, so the chosen line always stays on top.
    if (!map.getPane(ALTERNATIVE_PANE)) map.createPane(ALTERNATIVE_PANE).style.zIndex = '305';
    const group = L.layerGroup().addTo(map);
    const roadId = (id: string) => id.split(':part:')[0];
    const selectedIds = new Set(selected?.segs.map(road => roadId(road.id)));
    // Shared sections belong to the blue route. A quiet route and its hit target
    // cover only its distinct sections; tapping blue must not select another way.
    const otherPaths = (route: ScenarioRoute) => route.segs.filter(road => !selectedIds.has(roadId(road.id)))
      .map(road => latLngs(road.points, metadata)).filter(points => points.length >= 2);
    const pins: Array<{ marker: L.Marker; roadId: string }> = [];
    for (const link of showAreaLinks ? areaLinks ?? [] : []) {
      const line = L.polyline(latLngs([link.roadPoint, link.areaPoint], metadata), { pane: mapPane('roadStatus'),
        color: '#e4b943', weight: 1.5, opacity: 1, dashArray: '3 3', interactive: false, className: 'resident-road-area-link' }).addTo(group);
      line.getElement()?.setAttribute('data-landslide-area', link.areaId);
    }
    if (comparison?.status === 'blocked') {
      const points = otherPaths(comparison);
      L.polyline(points, { pane: ALTERNATIVE_PANE, color: OTHER_ROUTE.casing, weight: 7, opacity: .95, interactive: false, lineCap: 'round', lineJoin: 'round' }).addTo(group);
      L.polyline(points, { pane: ALTERNATIVE_PANE, color: OTHER_ROUTE.color, weight: 4.5, opacity: 1, interactive: false, lineCap: 'round', lineJoin: 'round', className: 'resident-blocked-comparison' }).addTo(group);
    }
    const km = (value: number) => value.toLocaleString(locale === 'en' ? 'en-GB' : 'vi-VN', { maximumFractionDigits: 1 });
    for (const route of alternatives) {
      // Blocked paths are inspection context, never an eligible choice.
      if (routeStatus(route) === 'blocked') continue;
      const points = otherPaths(route);
      if (!points.length) continue;
      const choose = () => onChoose?.(route.id);
      L.polyline(points, { pane: ALTERNATIVE_PANE, color: OTHER_ROUTE.casing, weight: 7, opacity: .95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(group);
      L.polyline(points, { pane: ALTERNATIVE_PANE, color: OTHER_ROUTE.color, weight: 4.5, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false, className: 'resident-route-alternative' }).addTo(group);
      const target = L.polyline(points, { pane: ALTERNATIVE_PANE, color: 'transparent', weight: 22, opacity: 1, bubblingMouseEvents: false, className: 'resident-alternative-target' }).on('click', choose).addTo(group);
      target.getElement()?.setAttribute('data-route-id', route.id);
      const label = locale === 'en' ? `${km(route.lengthKm)} km, tap to use` : `${km(route.lengthKm)} km, chạm để chọn`;
      const labelPath = [...points].sort((a,b) => {
        const length = (path: L.LatLng[]) => path.slice(1).reduce((sum,p,i) => sum + map.distance(path[i],p),0);
        return length(b)-length(a);
      })[0];
      const marker = L.marker(midway(labelPath, map), { pane: mapPane('selection'), keyboard: false, icon: L.divIcon({
        className: 'resident-route-alternative-label', iconSize: [0, 0], iconAnchor: [0, 0],
        html: `<button type="button" aria-label="${label}">${km(route.lengthKm)} km</button>` }) })
        .on('click', choose).addTo(group);
      marker.getElement()?.setAttribute('data-route-id', route.id);
    }
    // Adjacent sections of the same source road share one condition sign.
    const signs = roadConditionSigns(alerts, areaLinks, hazardPoints);
    for (const {road, point, condition} of signs) {
      const at = latLngs([point], metadata)[0];
      if (!at) continue;
      const landslide = road.hz === 'landslide';
      const label = roadConditionSignLabel(condition, locale);
      const marker = L.marker(at, { pane: mapPane('selection'), title: label, keyboard: true, bubblingMouseEvents: false, icon: L.divIcon({
        className: `road-condition-sign ${condition === 'blocked' ? 'road-closure-sign' : 'road-risk-sign'}${landslide ? ' is-landslide' : ''}${road.id.startsWith('local-') ? ' is-local-road' : ''}`, iconSize: [44, 44], iconAnchor: [22, 22],
        html: roadConditionSvg(condition) }) }).addTo(group);
      marker.getElement()?.setAttribute('aria-label', label);
      marker.getElement()?.setAttribute('data-road-id', road.id);
      marker.getElement()?.setAttribute('data-road-condition', condition);
      if (road.landslideAreaId) marker.getElement()?.setAttribute('data-landslide-area', road.landslideAreaId);
      if (road.landslideAreaIds) marker.getElement()?.setAttribute('data-landslide-areas', road.landslideAreaIds.join(' '));
      // Close symbols retain their positions and 44 px hit areas. When hit areas
      // overlap, open the road nearest the actual tap rather than the top DOM node.
      marker.setZIndexOffset((signs.length - pins.length) * 1000);
      pins.push({ marker, roadId: road.id });
      marker.on('click', (event: L.LeafletMouseEvent) => {
        const anchor = map.latLngToContainerPoint(marker.getLatLng());
        const mouse = event.originalEvent instanceof MouseEvent ? map.mouseEventToContainerPoint(event.originalEvent) : anchor;
        const at = mouse.distanceTo(anchor) <= 44 ? mouse : anchor;
        const nearby = pins.filter(pin => map.latLngToContainerPoint(pin.marker.getLatLng()).distanceTo(anchor) <= 44);
        const nearest = nearby.sort((a, b) => map.latLngToContainerPoint(a.marker.getLatLng()).distanceTo(at) - map.latLngToContainerPoint(b.marker.getLatLng()).distanceTo(at))[0];
        if (nearest) onInspectRoad?.(nearest.roadId);
      });
    }
    const sizeSymbols = () => {
      for (const pin of pins) {
        const at = map.latLngToContainerPoint(pin.marker.getLatLng());
        const distance = Math.min(...pins.filter(other => other !== pin).map(other => {
          const p = map.latLngToContainerPoint(other.marker.getLatLng());
          return Math.max(Math.abs(at.x - p.x), Math.abs(at.y - p.y));
        }));
        pin.marker.getElement()?.style.setProperty('--closure-symbol-size', `${Math.max(10, Math.min(22, distance - 4))}px`);
      }
    };
    // Commune-road risk signs only crowd the far view; closures stay at every zoom.
    const farView = () => map.getContainer().classList.toggle('road-signs-far', map.getZoom() < 13);
    sizeSymbols(); farView(); map.on('zoom move resize', sizeSymbols); map.on('zoomend', farView);
    return () => { map.off('zoom move resize', sizeSymbols); map.off('zoomend', farView); map.getContainer().classList.remove('road-signs-far'); group.remove(); };
  }, [mapRef, metadata, alternatives, alerts, comparison, selected, locale, onChoose, onInspectRoad, areaLinks, showAreaLinks, hazardPoints]);
  return null;
}
