import area from '@turf/area';
import intersect from '@turf/intersect';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { isPolygon, type GeometryRecord, type PolygonGeometry } from '../../geo/vector/types';
import { validateGeometry } from '../../geo/vector/validateGeometry';

export type ImageryScene = {
  id: string;
  collection: string;
  sensor: 'sar' | 'optical';
  acquiredAt: string;
  platform: string;
  geometry: PolygonGeometry;
  level: string;
  metadataUrl: string;
  cloudCover: number | null;
  gsd: number | null;
  pixelSpacing: number | null;
  orbit: number | null;
  pass: string | null;
  polarizations: string[];
  instrumentMode: string | null;
};
export type ImageryCatalog = {
  scenes: ImageryScene[];
  source: {
    provider: string;
    retrievedAt: string;
    region: string;
    license: string;
    queries: string[];
  };
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid catalog object');
  return value as Record<string, unknown>;
};
const text = (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new Error('Missing catalog metadata');
  return value;
};
const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const url = (value: unknown) => {
  const href = text(value);
  if (new URL(href).protocol !== 'https:') throw new Error('Invalid catalog URL');
  return href;
};

/** Validate provider metadata at the repository boundary; never derive quality from the basemap. */
export function parseImageryCatalog(raw: unknown): ImageryCatalog {
  const root = object(raw),
    source = object(root.source);
  if (root.catalogVersion !== 1 || !Array.isArray(root.features) || root.features.length > 100)
    throw new Error('Unsupported catalog');
  const ids = new Set<string>();
  const scenes = root.features.map((item) => {
    const feature = object(item),
      p = object(feature.properties),
      id = text(feature.id),
      collection = text(feature.collection);
    if (ids.has(id) || !['sentinel-1-grd', 'sentinel-2-l2a'].includes(collection))
      throw new Error('Invalid catalog scene');
    ids.add(id);
    const geometry = validateGeometry(feature.geometry),
      acquiredAt = text(p.datetime);
    if (
      !isPolygon(geometry) ||
      !Number.isFinite(Date.parse(acquiredAt)) ||
      !acquiredAt.endsWith('Z')
    )
      throw new Error('Invalid scene extent/date');
    const links = Array.isArray(feature.links) ? feature.links.map(object) : [];
    const cloud = number(p['eo:cloud_cover']);
    if (cloud !== null && cloud > 100) throw new Error('Invalid cloud cover');
    return {
      id,
      collection,
      sensor: collection === 'sentinel-1-grd' ? ('sar' as const) : ('optical' as const),
      geometry,
      acquiredAt,
      platform: text(p.platform),
      level: text(p['processing:level']),
      metadataUrl: url(links.find((link) => link.rel === 'self')?.href),
      cloudCover: collection === 'sentinel-2-l2a' ? cloud : null,
      gsd: number(p.gsd),
      pixelSpacing: number(p['sar:pixel_spacing_range']),
      orbit: number(p['sat:relative_orbit']),
      pass: typeof p['sat:orbit_state'] === 'string' ? p['sat:orbit_state'] : null,
      instrumentMode:
        typeof p['sar:instrument_mode'] === 'string' ? p['sar:instrument_mode'] : null,
      polarizations: Array.isArray(p['sar:polarizations'])
        ? p['sar:polarizations'].filter((value): value is string => typeof value === 'string')
        : []
    };
  });
  const retrievedAt = text(source.retrievedAt);
  if (!Number.isFinite(Date.parse(retrievedAt))) throw new Error('Invalid retrieval date');
  if (!Array.isArray(source.queries)) throw new Error('Missing catalog provenance');
  return {
    scenes,
    source: {
      provider: text(source.provider),
      retrievedAt,
      region: text(source.region),
      license: url(source.license),
      queries: source.queries.map(url)
    }
  };
}

export const preparedCatalogRepository = {
  async load(signal: AbortSignal): Promise<ImageryCatalog> {
    const response = await fetch('./catalog/che-tao.json', { signal });
    if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
    return parseImageryCatalog(await response.json());
  }
};

type PolygonFeature = Feature<Polygon | MultiPolygon>;
const feature = (geometry: PolygonGeometry): PolygonFeature => ({
  type: 'Feature',
  geometry,
  properties: {}
});
export function sceneCoverage(aoi: PolygonGeometry, scene: ImageryScene): number {
  const common = intersect({
    type: 'FeatureCollection',
    features: [feature(aoi), feature(scene.geometry)]
  });
  return common ? Math.min(1, area(common) / area(feature(aoi))) : 0;
}
export function searchImagery(
  catalog: ImageryCatalog,
  aoi: PolygonGeometry,
  filters: { sensor: string; from: string; to: string; cloud: number | null }
) {
  const validDay = (value: string) => {
    const date = new Date(value + 'T00:00:00Z');
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  };
  if (
    !validDay(filters.from) ||
    !validDay(filters.to) ||
    filters.from > filters.to ||
    !['sar', 'optical', 'all'].includes(filters.sensor) ||
    (filters.cloud !== null &&
      (!Number.isFinite(filters.cloud) || filters.cloud < 0 || filters.cloud > 100))
  )
    throw new Error('Invalid date range');
  return catalog.scenes
    .filter(
      (scene) =>
        (filters.sensor === 'all' || scene.sensor === filters.sensor) &&
        scene.acquiredAt.slice(0, 10) >= filters.from &&
        scene.acquiredAt.slice(0, 10) <= filters.to &&
        (scene.sensor !== 'optical' ||
          filters.cloud === null ||
          (scene.cloudCover !== null && scene.cloudCover <= filters.cloud))
    )
    .map((scene) => ({ scene, coverage: sceneCoverage(aoi, scene) }))
    .filter((row) => row.coverage > 0)
    .sort((a, b) => b.scene.acquiredAt.localeCompare(a.scene.acquiredAt));
}
export function reviewScenePair(
  scenes: ImageryScene[],
  aoi: PolygonGeometry
): 'count' | 'sensor' | 'time' | 'orbit' | 'coverage' | 'metadata-only' {
  if (scenes.length !== 2) return 'count';
  const [a, b] = scenes;
  if (a.collection !== b.collection || a.level !== b.level) return 'sensor';
  if (a.acquiredAt === b.acquiredAt) return 'time';
  if (
    a.sensor === 'sar' &&
    (!a.orbit ||
      !b.orbit ||
      a.orbit !== b.orbit ||
      !a.pass ||
      a.pass !== b.pass ||
      !a.instrumentMode ||
      a.instrumentMode !== b.instrumentMode ||
      !a.polarizations.length ||
      [...a.polarizations].sort().join() !== [...b.polarizations].sort().join())
  )
    return 'orbit';
  if (
    !intersect({
      type: 'FeatureCollection',
      features: [feature(aoi), feature(a.geometry), feature(b.geometry)]
    })
  )
    return 'coverage';
  return 'metadata-only';
}
export function sceneRecord(scene: ImageryScene, retrievedAt: string): GeometryRecord {
  return {
    id: `scene:${scene.id}`,
    name:
      scene.platform.toUpperCase().replace('SENTINEL-', 'S') +
      ' · ' +
      scene.acquiredAt.slice(0, 19).replace('T', ' ') +
      ' UTC',
    role: 'footprint',
    visible: true,
    source: {
      name: scene.metadataUrl,
      format: 'GeoJSON',
      importedAt: new Date().toISOString()
    },
    feature: {
      type: 'Feature',
      geometry: scene.geometry,
      properties: {
        name: scene.id,
        sceneId: scene.id,
        collection: scene.collection,
        acquiredAt: scene.acquiredAt,
        metadataUrl: scene.metadataUrl,
        catalogRetrievedAt: retrievedAt
      }
    }
  };
}
