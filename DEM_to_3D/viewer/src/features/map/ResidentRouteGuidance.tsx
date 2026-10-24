import { useEffect, type MutableRefObject } from 'react';
import * as L from 'leaflet';
import type { ScenarioRoute } from '../../types/dear';
import type { TerrainMetadata } from '../../types/terrain';
import { projectedToWgs84 } from '../../terrain/coordinate';
import { addResidentRoutePins } from './residentRoutePins';
import { routeStatus } from '../routes/roadConditions';

/** Add endpoint symbols only when the caller has no explicit selected locations. */
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
    return () => { removePins?.(); };
  }, [mapRef, route, metadata, endpoints]);
  return null;
}
