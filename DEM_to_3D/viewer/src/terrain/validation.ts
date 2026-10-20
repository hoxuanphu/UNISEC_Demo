import type { TerrainMetadata } from '../types/terrain';

export class TerrainAssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TerrainAssetError';
  }
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function safeAssetFilename(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value !== '.'
    && value !== '..'
    && !value.includes('/')
    && !value.includes('\\')
    && !value.includes('\0');
}

export function validateMetadata(value: unknown): TerrainMetadata {
  if (!value || typeof value !== 'object') throw new TerrainAssetError('Metadata must be a JSON object');
  const metadata = value as Partial<TerrainMetadata>;
  const errors: string[] = [];
  if (metadata.schema_version !== 1) errors.push('schema_version must be 1');
  if (typeof metadata.asset_id !== 'string' || metadata.asset_id.length === 0) errors.push('asset_id is required');
  if (typeof metadata.analysis_supported !== 'boolean') errors.push('analysis_supported must be boolean');
  if (!metadata.scene_axes || Object.keys(metadata.scene_axes).length !== 3 || metadata.scene_axes.x !== 'east' || metadata.scene_axes.y !== 'up' || metadata.scene_axes.z !== 'negative_north') {
    errors.push('scene_axes must be X=east, Y=up, Z=negative_north');
  }
  const origin = metadata.world_origin;
  if (!origin || typeof origin !== 'object' || !finite(origin.x) || !finite(origin.y) || 'z' in origin) errors.push('world_origin must contain only finite x/y');
  const crs = metadata.crs;
  if (!crs || typeof crs.authority !== 'string' || !Number.isInteger(crs.code) || crs.code < (metadata.analysis_supported ? 1 : 0) || typeof crs.linear_unit !== 'string') {
    errors.push('crs authority/code/linear_unit are required');
  }
  const hasDefinition = [crs?.proj4, crs?.wkt].some((definition) => typeof definition === 'string' && definition.trim().length > 0);
  if (!hasDefinition || (crs?.proj4 !== undefined && typeof crs.proj4 !== 'string') || (crs?.wkt !== undefined && typeof crs.wkt !== 'string')) errors.push('crs.proj4 or crs.wkt must be a non-empty definition string');
  if (metadata.analysis_supported && (!crs || !['m', 'metre', 'meter', 'metres', 'meters'].includes((crs.linear_unit ?? '').toLowerCase()))) {
    errors.push('analysis_supported assets require metre units');
  }
  const grid = metadata.grid;
  if (!grid || !Array.isArray(grid.shape) || grid.shape.length !== 2 || !grid.shape.every((n) => Number.isInteger(n) && n > 0)) {
    errors.push('grid.shape must be [rows, cols]');
  }
  if (grid) {
    if (!safeAssetFilename(grid.file)) errors.push('grid.file must be a safe asset filename');
    const exact: Record<string, string> = {
      shape_order: 'rows_cols', dtype: 'float32', byte_order: 'little_endian', layout: 'row_major',
      nodata_encoding: 'nan', elevation_unit: 'metre', sampling_method: 'nearest_subsample',
    };
    for (const [key, wanted] of Object.entries(exact)) if ((grid as Record<string, unknown>)[key] !== wanted) errors.push(`grid.${key} must be ${wanted}`);
    if (!Number.isInteger(grid.source_step) || grid.source_step < 1) errors.push('grid.source_step must be >= 1');
    if (!Number.isInteger(grid.byte_length) || grid.byte_length < 0) errors.push('grid.byte_length must be a non-negative integer');
    const expectedBytes = grid.shape?.[0] * grid.shape?.[1] * 4;
    if (grid.byte_length !== expectedBytes) errors.push(`grid.byte_length must be ${expectedBytes}`);
  }
  const transform = metadata.grid_transform;
  const transformKeys: Array<keyof Pick<NonNullable<TerrainMetadata['grid_transform']>, 'a' | 'b' | 'c' | 'd' | 'e' | 'f'>> = ['a', 'b', 'c', 'd', 'e', 'f'];
  if (!transform || !transformKeys.every((key) => finite(transform[key])) || transform.convention !== 'rasterio_affine' || transform.pixel_reference !== 'center') {
    errors.push('grid_transform must be a complete rasterio_affine with pixel_reference=center');
  } else if (Math.abs(transform.a * transform.e - transform.b * transform.d) <= 1e-15) {
    errors.push('grid_transform must be invertible');
  }
  const elevation = metadata.elevation;
  if (!elevation || !finite(elevation.base_elevation) || !finite(elevation.exaggeration) || elevation.exaggeration <= 0 || typeof elevation.normalize_base !== 'boolean' || !finite(elevation.min) || !finite(elevation.max) || elevation.min > elevation.max) {
    errors.push('elevation metadata is invalid');
  }
  if (metadata.hole_mode !== undefined && metadata.hole_mode !== 'mask' && metadata.hole_mode !== 'fill') errors.push('hole_mode must be mask or fill');
  if (metadata.administrative !== undefined) {
    const administrative = metadata.administrative;
    if (!administrative || typeof administrative !== 'object') errors.push('administrative must be an object');
    else {
      if (administrative.source !== undefined && typeof administrative.source !== 'string') errors.push('administrative.source must be a string');
      for (const key of ['commune_code', 'commune_name', 'province_code', 'province_name', 'headquarters', 'type'] as const) {
        if (administrative[key] !== undefined && typeof administrative[key] !== 'string') errors.push(`administrative.${key} must be a string`);
      }
      for (const key of ['area_km2', 'population', 'density_per_km2'] as const) {
        if (administrative[key] !== undefined && !finite(administrative[key])) errors.push(`administrative.${key} must be finite`);
      }
      if (administrative.units !== undefined && (!Array.isArray(administrative.units) || administrative.units.length === 0)) errors.push('administrative.units must be a non-empty array');
    }
  }
  if (metadata.mesh !== undefined && (!metadata.mesh || typeof metadata.mesh !== 'object' || !safeAssetFilename(metadata.mesh.file) || !Number.isInteger(metadata.mesh.vertex_count) || metadata.mesh.vertex_count < 0 || !Number.isInteger(metadata.mesh.triangle_count) || metadata.mesh.triangle_count < 0)) errors.push('mesh metadata is invalid');
  if (errors.length) throw new TerrainAssetError(`Asset contract validation failed:\n- ${errors.join('\n- ')}`);
  return metadata as TerrainMetadata;
}

export function validateGridBuffer(metadata: TerrainMetadata, buffer: ArrayBuffer): void {
  if (buffer.byteLength !== metadata.grid.byte_length) {
    throw new TerrainAssetError(`Grid byte length ${buffer.byteLength} does not match metadata ${metadata.grid.byte_length}`);
  }
  const expectedElements = metadata.grid.shape[0] * metadata.grid.shape[1];
  if (buffer.byteLength !== expectedElements * 4) throw new TerrainAssetError('Grid shape/dtype byte length mismatch');
}
