import type { Feature, LineString, MultiPolygon, Point, Polygon } from 'geojson';

/** File geometry stays in longitude/latitude WGS84, independent of the map projection. */
export type VectorGeometry = Point | LineString | Polygon | MultiPolygon;
export type VectorFeature = Feature<VectorGeometry, Record<string, unknown>>;
export type PolygonGeometry = Polygon | MultiPolygon;
export type GeometryRole = 'reference' | 'aoi' | 'footprint';
export type ImportFormat = 'KML' | 'WKT' | 'GeoJSON' | 'coordinate' | 'drawing';
export type GeometryRecord = {
  id: string;
  name: string;
  feature: VectorFeature;
  role: GeometryRole;
  visible: boolean;
  source: { name: string; format: ImportFormat; importedAt: string };
};

export class GeometryError extends Error {
  constructor(public readonly code: string, public readonly detail = '') { super(code); }
}

export function isPolygon(geometry: VectorGeometry): geometry is PolygonGeometry {
  return geometry.type === 'Polygon' || geometry.type === 'MultiPolygon';
}

export function geometryPositions(geometry: VectorGeometry): number[][] {
  switch (geometry.type) {
    case 'Point': return [geometry.coordinates];
    case 'LineString': return geometry.coordinates;
    case 'Polygon': return geometry.coordinates.flat();
    case 'MultiPolygon': return geometry.coordinates.flat(2);
  }
}
