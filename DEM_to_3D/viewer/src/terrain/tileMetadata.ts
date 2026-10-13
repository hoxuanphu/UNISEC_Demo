export type TileLevelMetadata = { zoom: number; width_px: number; height_px: number; columns: number; rows: number; pixel_size_x: number; pixel_size_y: number };
export type TilePyramidMetadata = { schema_version: 1; asset_id: string; format: 'webp'; quality: number; tile_size: number; gutter_px: number; min_zoom: number; max_zoom: number; bounds_projected: { min_x: number; min_y: number; max_x: number; max_y: number }; crs: { authority: string; code: number; linear_unit: string }; orientation: { origin: 'top_left'; x: 'east'; y: 'north_to_south' }; levels: TileLevelMetadata[]; source: string };
const rootKeys = new Set(['schema_version','asset_id','format','quality','tile_size','gutter_px','min_zoom','max_zoom','bounds_projected','crs','orientation','levels','source']);
const safeText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\/\0]/.test(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const fail = (message: string): never => { throw new Error('Invalid tile metadata: ' + message); };
export function validateTilePyramidMetadata(value: unknown): TilePyramidMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('root must be an object');
  const item = value as Record<string, unknown>;
  if (Object.keys(item).some((key) => !rootKeys.has(key)) || [...rootKeys].some((key) => !(key in item))) return fail('root fields are incomplete');
  if (item.schema_version !== 1 || item.format !== 'webp' || !safeText(item.asset_id) || !safeText(item.source) || !Number.isInteger(item.quality) || (item.quality as number) < 1 || (item.quality as number) > 100) return fail('root fields are invalid');
  if (!Number.isInteger(item.tile_size) || (item.tile_size as number) <= 0 || !Number.isInteger(item.gutter_px) || (item.gutter_px as number) < 0 || !Number.isInteger(item.min_zoom) || !Number.isInteger(item.max_zoom) || (item.min_zoom as number) < 0 || (item.max_zoom as number) < (item.min_zoom as number)) return fail('zoom or tile dimensions are invalid');
  const bounds = item.bounds_projected as Record<string, unknown>;
  if (!bounds || !['min_x','min_y','max_x','max_y'].every((key) => finite(bounds[key])) || (bounds.max_x as number) <= (bounds.min_x as number) || (bounds.max_y as number) <= (bounds.min_y as number)) return fail('bounds are invalid');
  const crs = item.crs as Record<string, unknown>;
  if (!crs || crs.authority !== 'EPSG' || !Number.isInteger(crs.code) || (crs.code as number) <= 0 || !safeText(crs.linear_unit)) return fail('CRS is invalid');
  const orientation = item.orientation as Record<string, unknown>;
  if (!orientation || orientation.origin !== 'top_left' || orientation.x !== 'east' || orientation.y !== 'north_to_south') return fail('orientation is invalid');
  if (!Array.isArray(item.levels) || item.levels.length !== (item.max_zoom as number) - (item.min_zoom as number) + 1) return fail('levels are incomplete');
  const levels = (item.levels as unknown[]).map((raw, index) => { const level = raw as Record<string, unknown>; if (!level || level.zoom !== (item.min_zoom as number) + index || !['width_px','height_px','columns','rows'].every((key) => Number.isInteger(level[key]) && (level[key] as number) > 0) || !finite(level.pixel_size_x) || !finite(level.pixel_size_y) || (level.columns as number) !== Math.ceil((level.width_px as number) / (item.tile_size as number)) || (level.rows as number) !== Math.ceil((level.height_px as number) / (item.tile_size as number))) return fail('level ' + index + ' is invalid'); return level as unknown as TileLevelMetadata; });
  return item as unknown as TilePyramidMetadata;
}
export function tileLevel(metadata: TilePyramidMetadata, zoom: number): TileLevelMetadata { if (!Number.isInteger(zoom) || zoom < metadata.min_zoom || zoom > metadata.max_zoom) return fail('zoom is outside metadata'); return metadata.levels[zoom - metadata.min_zoom]; }
export function logicalTilePath(zoom: number, column: number, row: number): string { if (![zoom,column,row].every((value) => Number.isInteger(value) && value >= 0)) return fail('tile indexes are invalid'); return 'z' + zoom + '/' + column + '_' + row + '.webp'; }
export function tileKey(sourceId: string, zoom: number, column: number, row: number): string { if (!safeText(sourceId)) return fail('source id is invalid'); return sourceId + '/' + zoom + '/' + column + '/' + row; }
