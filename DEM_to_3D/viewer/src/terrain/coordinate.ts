import proj4 from 'proj4';
import type { HoverInfo, TerrainMetadata } from '../types/terrain';

export type ProjectedPoint = { x: number; y: number };
export type ScenePoint = { x: number; y: number; z: number };

const geographicProjections = new WeakMap<TerrainMetadata, {source: string; projection: proj4.Converter}>();

export function pixelToProjected(metadata: TerrainMetadata, column: number, row: number): ProjectedPoint {
  const t = metadata.grid_transform;
  const col = column + 0.5;
  const r = row + 0.5;
  return { x: t.a * col + t.b * r + t.c, y: t.d * col + t.e * r + t.f };
}

export function projectedToPixel(metadata: TerrainMetadata, x: number, y: number): { column: number; row: number } {
  const t = metadata.grid_transform;
  const det = t.a * t.e - t.b * t.d;
  if (Math.abs(det) <= 1e-15) throw new Error('grid_transform is not invertible');
  const colCenter = (t.e * (x - t.c) - t.b * (y - t.f)) / det;
  const rowCenter = (-t.d * (x - t.c) + t.a * (y - t.f)) / det;
  return { column: colCenter - 0.5, row: rowCenter - 0.5 };
}

export function projectedToScene(metadata: TerrainMetadata, point: ProjectedPoint, elevation: number): ScenePoint {
  const { world_origin: origin, elevation: e } = metadata;
  return { x: point.x - origin.x, y: (elevation - e.base_elevation) * e.exaggeration, z: -(point.y - origin.y) };
}

export function sceneToProjected(metadata: TerrainMetadata, point: ScenePoint): { projected: ProjectedPoint; elevation: number } {
  const { world_origin: origin, elevation: e } = metadata;
  return {
    projected: { x: point.x + origin.x, y: -point.z + origin.y },
    elevation: point.y / e.exaggeration + e.base_elevation,
  };
}

export function projectedToWgs84(metadata: TerrainMetadata, point: ProjectedPoint): { longitude?: number; latitude?: number } {
  if (metadata.crs.code === 4326) return { longitude: point.x, latitude: point.y };
  const source = metadata.crs.proj4 || `${metadata.crs.authority}:${metadata.crs.code}`;
  try {
    let saved = geographicProjections.get(metadata);
    if (saved?.source !== source) {
      saved = {source, projection: proj4(source, 'EPSG:4326')};
      geographicProjections.set(metadata, saved);
    }
    const [longitude, latitude] = saved.projection.forward([point.x, point.y]);
    return { longitude, latitude };
  } catch {
    return {};
  }
}

export function formatHover(metadata: TerrainMetadata, scene: ScenePoint, projected: ProjectedPoint, elevation: number, row: number, column: number, interpolated: boolean): HoverInfo {
  return { scene, projected, ...projectedToWgs84(metadata, projected), elevation, row, column, interpolated };
}
