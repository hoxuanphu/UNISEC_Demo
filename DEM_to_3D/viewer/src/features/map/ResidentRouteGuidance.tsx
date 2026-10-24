import { useEffect, type MutableRefObject } from 'react';
import * as L from 'leaflet';
import type { ScenarioRoute } from '../../types/dear';
import type { TerrainMetadata } from '../../types/terrain';
import { projectedToWgs84 } from '../../terrain/coordinate';
import { mapPane } from './mapLayerOrder';
import { addResidentRoutePins } from './residentRoutePins';
import { routeStatus } from '../routes/roadConditions';

/** Direction follows route geometry; no turn instructions are inferred from imagery. */
export function ResidentRouteGuidance({mapRef, route, metadata, endpoints}: {
  mapRef: MutableRefObject<L.Map | null>;
  route: ScenarioRoute | null;
  metadata?: TerrainMetadata;
  endpoints: boolean;
}) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route || !metadata || routeStatus(route) === 'blocked') return;
    const positions = route.points.flatMap(point => {
      const p = projectedToWgs84(metadata, point);
      return p.latitude === undefined || p.longitude === undefined ? [] : [L.latLng(p.latitude, p.longitude)];
    });
    if (positions.length < 2) return;
    const removePins = !endpoints ? addResidentRoutePins(map, [positions[0], positions.at(-1)!].map((point, index) => ({latitude: point.lat, longitude: point.lng, label: index ? 'B' : 'A'}))) : undefined;
    const group = L.layerGroup().addTo(map);
    const draw = () => {
      group.clearLayers();
      const pixels = positions.map(point => map.latLngToContainerPoint(point));
      const lengths = pixels.slice(1).map((point, i) => point.distanceTo(pixels[i]));
      const total = lengths.reduce((sum, length) => sum + length, 0);
      for (const ratio of [.25, .5, .75]) {
        let station = total * ratio;
        const index = lengths.findIndex(length => { if (station <= length) return true; station -= length; return false; });
        if (index < 0 || lengths[index] < 1) continue;
        const a = pixels[index], b = pixels[index + 1];
        const at = a.add(b.subtract(a).multiplyBy(station / lengths[index]));
        const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        L.marker(map.containerPointToLatLng(at), {pane: mapPane('selection'), interactive: false, keyboard: false,
          icon: L.divIcon({className: 'resident-route-arrow', iconSize: [14, 14], iconAnchor: [7, 7],
            html: `<svg viewBox="0 0 20 20" style="transform:rotate(${angle}deg)" aria-hidden="true"><path d="m5 4 11 6-11 6 3-6Z" fill="white" stroke="#0d3a73" stroke-width="1.2" stroke-linejoin="round"/></svg>`})}).addTo(group);
      }
    };
    draw(); map.on('zoomend moveend resize', draw);
    return () => {map.off('zoomend moveend resize', draw);removePins?.();group.remove();};
  }, [mapRef, route, metadata, endpoints]);
  return null;
}
