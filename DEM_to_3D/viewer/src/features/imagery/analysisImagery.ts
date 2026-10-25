import type { ScenarioAsset } from '../../data/scenarioManifest';
import { verifiedAssetBytes } from '../../data/ScenarioRepository';

/** Display renderings of prepared EO scenes. They support interpretation; they are not analysis results. */
type Bounds = [number, number, number, number];
type LatLngBounds = [[number, number], [number, number]];
export type ImageryRaster = {
  /** Terrain CRS (EPSG:32648) rendering: linear UVs on the 3D surface. */
  terrain: ScenarioAsset & { bounds: Bounds; width: number };
  /** EPSG:3857 rendering: exact Leaflet image overlay. */
  web: ScenarioAsset & { latLngBounds: LatLngBounds };
};
export type OpticalPart = ImageryRaster & { id: string; acquired: string; source: string; pixelM: number; gsdM?: number; cloudPercent: number };
export type SarMode = 'vv' | 'vh' | 'rgb';
type Named = { id: string; name: [string, string] };
export type OpticalLayer = Named & { kind: 'optical'; parts: OpticalPart[]; mosaic?: ImageryRaster };
export type SarLayer = Named & {
  kind: 'sar'; acquired: string; source: string; pixelM: number;
  sensor?: string; credit?: string; nativePixelM?: number;
  rangesDb: { vv: [number, number]; vh?: [number, number]; ratio?: [number, number] };
  modes: { vv: ImageryRaster; vh?: ImageryRaster; rgb?: ImageryRaster };
};
export type AnalysisLayer = OpticalLayer | SarLayer;
export type AnalysisSelection = { layer: string | null; sarMode: SarMode; opacity: number };
export const defaultAnalysisSelection: AnalysisSelection = { layer: 'planet-post', sarMode: 'vv', opacity: 1 };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const fail = (field: string): never => { throw new Error(`Invalid imagery catalog: ${field}`); };
const finite = (value: unknown, field: string): number => typeof value === 'number' && Number.isFinite(value) ? value : fail(field);
const text = (value: unknown, field: string): string => typeof value === 'string' && value.trim() ? value : fail(field);

function asset(value: unknown, base: string, field: string): ScenarioAsset {
  if (!isRecord(value)) return fail(field);
  const name = text(value.url, `${field}.url`);
  if (!/^[a-z0-9.-]+\.webp$/.test(name)) fail(`${field}.url`);
  const byteLength = finite(value.byteLength, `${field}.byteLength`);
  const sha256 = text(value.sha256, `${field}.sha256`);
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0 || !/^[0-9a-f]{64}$/.test(sha256)) fail(field);
  return { url: base + name, byteLength, sha256 };
}

function raster(value: unknown, base: string, field: string): ImageryRaster {
  if (!isRecord(value) || !isRecord(value.terrain) || !isRecord(value.web)) return fail(field);
  const bounds = value.terrain.bounds, latLng = value.web.latLngBounds;
  if (!Array.isArray(bounds) || bounds.length !== 4) fail(`${field}.terrain.bounds`);
  const [left, bottom, right, top] = (bounds as unknown[]).map((v, i) => finite(v, `${field}.terrain.bounds.${i}`));
  if (right <= left || top <= bottom) fail(`${field}.terrain.bounds`);
  if (!Array.isArray(latLng) || latLng.length !== 2 || !latLng.every(pair => Array.isArray(pair) && pair.length === 2)) fail(`${field}.web.latLngBounds`);
  const [[south, west], [north, east]] = (latLng as unknown[][]).map((pair, i) => pair.map((v, j) => finite(v, `${field}.web.latLngBounds.${i}.${j}`)));
  if (north <= south || east <= west || Math.abs(north) > 85 || Math.abs(east) > 180) fail(`${field}.web.latLngBounds`);
  if (value.terrain.crs !== 'EPSG:32648') fail(`${field}.terrain.crs`);
  return {
    terrain: { ...asset(value.terrain, base, `${field}.terrain`), bounds: [left, bottom, right, top], width: finite(value.terrain.width, `${field}.terrain.width`) },
    web: { ...asset(value.web, base, `${field}.web`), latLngBounds: [[south, west], [north, east]] }
  };
}

export function validateImageryCatalog(value: unknown, catalogUrl: string): AnalysisLayer[] {
  const base = catalogUrl.slice(0, catalogUrl.lastIndexOf('/') + 1);
  if (!isRecord(value) || !Array.isArray(value.layers) || !value.layers.length) return fail('layers');
  const layers = value.layers.map((layer, index): AnalysisLayer => {
    if (!isRecord(layer)) return fail(`layers.${index}`);
    const id = text(layer.id, `layers.${index}.id`);
    if (!Array.isArray(layer.name) || layer.name.length !== 2) fail(`${id}.name`);
    const name = (layer.name as unknown[]).map((v, i) => text(v, `${id}.name.${i}`)) as [string, string];
    if (layer.kind === 'optical') {
      if (!Array.isArray(layer.parts) || !layer.parts.length) fail(`${id}.parts`);
      return { id, name, kind: 'optical', ...(layer.mosaic === undefined ? {} : {mosaic: raster(layer.mosaic, base, `${id}.mosaic`)}), parts: (layer.parts as unknown[]).map((part, p) => {
        if (!isRecord(part)) return fail(`${id}.parts.${p}`);
        const acquired = text(part.acquired, `${id}.parts.${p}.acquired`);
        if (!Number.isFinite(Date.parse(acquired))) fail(`${id}.parts.${p}.acquired`);
        return { ...raster(part, base, `${id}.parts.${p}`), id: text(part.id, `${id}.parts.${p}.id`), acquired,
          source: text(part.source, `${id}.parts.${p}.source`), pixelM: finite(part.pixelM, `${id}.parts.${p}.pixelM`),
          ...(part.gsdM === undefined ? {} : {gsdM: finite(part.gsdM, `${id}.parts.${p}.gsdM`)}),
          cloudPercent: finite(part.cloudPercent, `${id}.parts.${p}.cloudPercent`) };
      }) };
    }
    if (layer.kind === 'sar') {
      if (!isRecord(layer.modes) || !isRecord(layer.rangesDb)) return fail(`${id}.modes`);
      const range = (key: string): [number, number] => {
        const pair = (layer.rangesDb as Record<string, unknown>)[key];
        if (!Array.isArray(pair) || pair.length !== 2) return fail(`${id}.rangesDb.${key}`);
        const [low, high] = pair.map(v => finite(v, `${id}.rangesDb.${key}`));
        return low < high ? [low, high] : fail(`${id}.rangesDb.${key}`);
      };
      const acquired = text(layer.acquired, `${id}.acquired`);
      if (!Number.isFinite(Date.parse(acquired))) fail(`${id}.acquired`);
      const modes: SarLayer['modes'] = { vv: raster(layer.modes.vv, base, `${id}.modes.vv`) };
      const rangesDb: SarLayer['rangesDb'] = { vv: range('vv') };
      if (layer.modes.vh !== undefined) { modes.vh = raster(layer.modes.vh, base, `${id}.modes.vh`); rangesDb.vh = range('vh'); }
      if (layer.modes.rgb !== undefined) {
        if (!modes.vh) fail(`${id}.modes.rgb requires VH`);
        modes.rgb = raster(layer.modes.rgb, base, `${id}.modes.rgb`); rangesDb.ratio = range('ratio');
      }
      return { id, name, kind: 'sar', acquired, source: text(layer.source, `${id}.source`), pixelM: finite(layer.pixelM, `${id}.pixelM`),
        ...(layer.sensor === undefined ? {} : {sensor: text(layer.sensor, `${id}.sensor`)}),
        ...(layer.credit === undefined ? {} : {credit: text(layer.credit, `${id}.credit`)}),
        ...(layer.nativePixelM === undefined ? {} : {nativePixelM: finite(layer.nativePixelM, `${id}.nativePixelM`)}), rangesDb, modes };
    }
    return fail(`${id}.kind`);
  });
  if (new Set(layers.map(layer => layer.id)).size !== layers.length) fail('duplicate layer id');
  return layers;
}

export async function loadImageryCatalog(asset: ScenarioAsset, signal: AbortSignal): Promise<AnalysisLayer[]> {
  const bytes = await verifiedAssetBytes(asset, signal);
  return validateImageryCatalog(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), asset.url);
}

/** The rasters drawn for a selection. Optical layers prefer the seamless display mosaic, retaining all scene provenance; SAR draws its chosen mode. */
export function selectedRasters(layers: AnalysisLayer[], selection: AnalysisSelection): ImageryRaster[] {
  const layer = layers.find(item => item.id === selection.layer);
  if (!layer) return [];
  if (layer.kind === 'sar') return [layer.modes[selection.sarMode] ?? layer.modes.vv];
  return layer.mosaic ? [layer.mosaic] : layer.parts;
}

/** Checksummed bytes become object URLs once per asset and are shared by 2D, 3D and GIS maps. */
const objectUrls = new Map<string, Promise<string>>();
export function rasterUrl(asset: ScenarioAsset, signal: AbortSignal): Promise<string> {
  let url = objectUrls.get(asset.sha256);
  if (!url) {
    url = verifiedAssetBytes(asset, new AbortController().signal).then(bytes => URL.createObjectURL(new Blob([bytes], { type: 'image/webp' })));
    url.catch(() => objectUrls.delete(asset.sha256));
    objectUrls.set(asset.sha256, url);
  }
  return new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    url!.then(resolve, reject);
  });
}

const dateLabel = (iso: string) => { const [, m, d] = iso.slice(0, 10).split('-'); return `${Number(d)}/${Number(m)}`; };
/** Distinct acquisition days, e.g. "1/9, 12/9/2026". */
export function acquisitionLabel(layer: AnalysisLayer): string {
  const dates = layer.kind === 'optical' ? layer.parts.map(part => part.acquired) : [layer.acquired];
  const days = [...new Set(dates.map(date => date.slice(0, 10)))].sort();
  return days.map(dateLabel).join(', ') + '/' + days.at(-1)!.slice(0, 4);
}

/** Retain an explicit off/valid choice, but never carry a missing layer ID
 * into another dataset and silently make its imagery disappear. */
export function selectionForCatalog(layers:AnalysisLayer[],selection:AnalysisSelection,chosen:boolean):AnalysisSelection {
  if(chosen&&(selection.layer===null||layers.some(layer=>layer.id===selection.layer))) {
    const layer = layers.find(layer=>layer.id===selection.layer);
    const mode = layer?.kind === 'sar' ? sarModeForLayer(layer,selection.sarMode) : selection.sarMode;
    return mode === selection.sarMode ? selection : {...selection,sarMode:mode};
  }
  return {...selection,layer:latestOpticalLayer(layers)?.id??null};
}

/** Latest available optical acquisition, not the more recent SAR acquisition. */
export function latestOpticalLayer(layers: AnalysisLayer[]): OpticalLayer | undefined {
  return layers.filter((layer): layer is OpticalLayer => layer.kind === 'optical')
    .reduce<OpticalLayer | undefined>((latest, layer) => !latest ||
      Math.max(...layer.parts.map(part => Date.parse(part.acquired))) > Math.max(...latest.parts.map(part => Date.parse(part.acquired))) ? layer : latest, undefined);
}

export function analysisSourceInfo(layers: AnalysisLayer[], selection: AnalysisSelection, locale: 'vi' | 'en') {
  const layer=layers.find(item=>item.id===selection.layer);
  return layer ? {name:layer.name[locale==='vi'?0:1],acquired:acquisitionLabel(layer),
    credit:layer.kind==='optical'?'© Planet Labs PBC':layer.credit ?? layer.source} : undefined;
}

export const sarModeForLayer = (layer: SarLayer, requested: SarMode): SarMode => layer.modes[requested] ? requested : 'vv';
export const availableSarModes = (layer: SarLayer): SarMode[] => (['vv','vh','rgb'] as const).filter(mode=>!!layer.modes[mode]);
/** Organise the catalog by modality, then newest acquisition, without changing the user's selection. */
export function imageryGroups(layers: AnalysisLayer[]) {
  const acquired = (layer: AnalysisLayer) => layer.kind === 'sar' ? Date.parse(layer.acquired) : Math.max(...layer.parts.map(part=>Date.parse(part.acquired)));
  return (['optical','sar'] as const).map(kind=>({kind,layers:layers.filter(layer=>layer.kind===kind).sort((a,b)=>acquired(b)-acquired(a)||a.id.localeCompare(b.id))}));
}
