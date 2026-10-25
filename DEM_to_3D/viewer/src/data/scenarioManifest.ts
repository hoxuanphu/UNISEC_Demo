import { readResponse } from '../shared/http/readResponse';

export type ScenarioAsset = {
  url: string;
  byteLength: number;
  sha256: string;
};

export type ScenarioManifest = {
  schemaVersion: 1;
  datasetVersion: string;
  dataKind: 'synthetic' | 'historical' | 'operational';
  reviewStatus: 'draft' | 'reviewed' | 'published';
  incidentId: string;
  snapshotAt: string;
  crs: string;
  counts: { communities: number; roads: number; hazards: number };
  terrain: { glb: ScenarioAsset; grid: ScenarioAsset; metadata: ScenarioAsset; image?: ScenarioAsset };
  workspace?: ScenarioAsset;
  fieldData?: ScenarioAsset;
  referenceData?: ScenarioAsset;
  analysisImagery?: ScenarioAsset;
  fieldPhotos?: ScenarioAsset;
  residentPresence?: ScenarioAsset;
  terrainContext?: Array<{glb: ScenarioAsset; grid: ScenarioAsset; metadata: ScenarioAsset}>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid manifest: ${field}`);
  return value;
}

function requireCount(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`Invalid manifest: ${field}`);
  return value as number;
}

function requireAsset(value: unknown, field: string, kind: 'terrain' | 'workspace' | 'field' | 'reference' | 'imagery' | 'photos' | 'presence' = 'terrain'): ScenarioAsset {
  if (!isRecord(value)) throw new Error(`Invalid manifest: ${field}`);
  const url = requireString(value.url, `${field}.url`);
  const validUrl = kind === 'presence' ? /^\/scenarios\/[a-zA-Z0-9._/-]+\/resident-presence\.json$/.test(url) : kind === 'photos' ? /^\/scenarios\/[a-zA-Z0-9._/-]+\/photos\.json$/.test(url) : kind === 'imagery' ? /^\/scenarios\/[a-zA-Z0-9._/-]+\/imagery\.json$/.test(url) : kind === 'reference' ? /^\/scenarios\/[a-zA-Z0-9._/-]+\.geojson$/.test(url) : kind === 'field' ? /^\/scenarios\/[a-zA-Z0-9._/-]+\.kml$/.test(url) : kind === 'workspace' ? /^\/scenarios\/[a-zA-Z0-9._/-]+\/incident\.json$/.test(url) : /^\/terrain\/[a-zA-Z0-9._-]+$/.test(url);
  if (!validUrl || url.includes('..')) {
    throw new Error(`Invalid manifest: ${field}.url`);
  }
  const byteLength = requireCount(value.byteLength, `${field}.byteLength`);
  if (byteLength === 0) throw new Error(`Invalid manifest: ${field}.byteLength`);
  const sha256 = requireString(value.sha256, `${field}.sha256`);
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`Invalid manifest: ${field}.sha256`);
  return { url, byteLength, sha256 };
}

export function validateScenarioManifest(value: unknown): ScenarioManifest {
  if (!isRecord(value) || value.schemaVersion !== 1) throw new Error('Unsupported scenario manifest version');
  const datasetVersion = requireString(value.datasetVersion, 'datasetVersion');
  const incidentId = requireString(value.incidentId, 'incidentId');
  const snapshotAt = requireString(value.snapshotAt, 'snapshotAt');
  const crs = requireString(value.crs, 'crs');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(snapshotAt) ||
      !Number.isFinite(Date.parse(snapshotAt))) throw new Error('Invalid manifest: snapshotAt');
  if (!/^EPSG:\d+$/.test(crs)) throw new Error('Invalid manifest: crs');
  if (value.dataKind !== 'synthetic' && value.dataKind !== 'historical' && value.dataKind !== 'operational') {
    throw new Error('Invalid manifest: dataKind');
  }
  if (value.reviewStatus !== 'draft' && value.reviewStatus !== 'reviewed' && value.reviewStatus !== 'published') {
    throw new Error('Invalid manifest: reviewStatus');
  }
  if (!isRecord(value.counts) || !isRecord(value.terrain)) throw new Error('Invalid manifest: counts or terrain');
  const counts = {
    communities: requireCount(value.counts.communities, 'counts.communities'),
    roads: requireCount(value.counts.roads, 'counts.roads'),
    hazards: requireCount(value.counts.hazards, 'counts.hazards')
  };
  const terrain = {
    glb: requireAsset(value.terrain.glb, 'terrain.glb'),
    grid: requireAsset(value.terrain.grid, 'terrain.grid'),
    metadata: requireAsset(value.terrain.metadata, 'terrain.metadata'),
    ...(value.terrain.image ? { image: requireAsset(value.terrain.image, 'terrain.image') } : {})
  };
  if (new Set(Object.values(terrain).map(asset => asset.url)).size !== Object.keys(terrain).length) {
    throw new Error('Invalid manifest: duplicate terrain URLs');
  }
  if (value.terrainContext !== undefined && (!Array.isArray(value.terrainContext) || value.terrainContext.length > 3)) throw new Error('Invalid manifest: terrainContext');
  const terrainContext = (value.terrainContext as unknown[] | undefined)?.map((item, index) => {
    if (!isRecord(item)) throw new Error('Invalid manifest: terrainContext');
    return {glb: requireAsset(item.glb, `terrainContext.${index}.glb`), grid: requireAsset(item.grid, `terrainContext.${index}.grid`), metadata: requireAsset(item.metadata, `terrainContext.${index}.metadata`)};
  });
  const terrainUrls = [...Object.values(terrain), ...(terrainContext ?? []).flatMap(group => Object.values(group))].map(asset => asset.url);
  if (new Set(terrainUrls).size !== terrainUrls.length) throw new Error('Invalid manifest: duplicate terrain URLs');
  return {
    schemaVersion: 1, datasetVersion, dataKind: value.dataKind,
    reviewStatus: value.reviewStatus, incidentId, snapshotAt, crs, counts, terrain,
    ...(value.workspace ? { workspace: requireAsset(value.workspace, 'workspace', 'workspace') } : {}),
    ...(value.fieldData ? { fieldData: requireAsset(value.fieldData, 'fieldData', 'field') } : {}),
    ...(value.referenceData ? {referenceData:requireAsset(value.referenceData,'referenceData','reference')} : {}),
    ...(value.residentPresence ? { residentPresence: requireAsset(value.residentPresence,'residentPresence','presence') } : {}),
    ...(value.fieldPhotos ? { fieldPhotos: requireAsset(value.fieldPhotos, 'fieldPhotos', 'photos') } : {}),
    ...(value.analysisImagery ? { analysisImagery: requireAsset(value.analysisImagery, 'analysisImagery', 'imagery') } : {}),
    ...(terrainContext?.length ? {terrainContext} : {})
  };
}

export async function loadScenarioManifest(url: string, signal?: AbortSignal): Promise<ScenarioManifest> {
  const response = await readResponse(url, signal);
  return validateScenarioManifest(await response.json());
}
