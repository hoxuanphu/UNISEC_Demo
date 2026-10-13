import { LoadingManager } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { LoadedModel, TerrainMetadata } from '../types/terrain';
import { assetUrlMatchesFilename, validateGltfMeshCounts } from './loadTerrain';
import { disposeObjectResources } from './raycast';
import { TerrainAssetError, validateGridBuffer, validateMetadata } from './validation';
import { applyTextureToModel, basename as textureBasename, decodeTextureFile, isTextureFile } from './texture';
import { tileLevel, validateTilePyramidMetadata, type TilePyramidMetadata } from './tileMetadata';

const modelExtensions = new Set(['.glb', '.gltf']);
const sidecarExtensions = new Set(['.terrain.json', '.grid.bin']);
const tileMetadataSuffix = '.tiles.json';

export type UploadedFilePair = {
  model: File;
  metadata?: File;
  grid?: File;
  texture?: File;
  resources: File[];
  tilePyramid?: { metadataFile: File; rootPath: string; files: Map<string, File>; metadata?: TilePyramidMetadata };
};

export function selectUploadedFiles(files: readonly File[], mode: 'single' | 'merge'): File[] {
  if (mode === 'merge') return [...files];
  const model = files.find(isModel);
  if (!model) throw new TerrainAssetError('Choose at least one .glb or .gltf model file');
  const key = basename(model);
  return files.filter((file) => {
    if (file === model) return true;
    if (isSidecar(file)) return basename(file) === key;
    if (isTextureFile(file)) return textureMatchesModel(file, key);
    return !isModel(file);
  });
}

function lowerName(file: File): string {
  return file.name.toLowerCase();
}

function extension(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.terrain.json')) return '.terrain.json';
  if (lower.endsWith('.grid.bin')) return '.grid.bin';
  const dot = lower.lastIndexOf('.');
  return dot >= 0 ? lower.slice(dot) : '';
}

function basename(file: File): string {
  const name = lowerName(file);
  const suffix = extension(name);
  return suffix ? name.slice(0, -suffix.length) : name;
}

function isModel(file: File): boolean {
  return modelExtensions.has(extension(file.name));
}

function isSidecar(file: File): boolean {
  return sidecarExtensions.has(extension(file.name));
}

function relativePath(file: File): string {
  const candidate = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  return candidate.replace(/\\/g, '/');
}

function isSafeRelativePath(value: string): boolean { return value.startsWith('/') === false && !value.split('/').some((part) => part === '..' || part === '.'); }
function isTileMetadata(file: File): boolean { return file.name.toLowerCase().endsWith(tileMetadataSuffix); }
function tileRootFor(file: File): string | undefined {
  const parts = relativePath(file).split('/').filter(Boolean);
  const index = parts.findIndex((part) => part.toLowerCase().endsWith('_tiles'));
  return index >= 0 ? parts.slice(0, index + 1).join('/') : undefined;
}
function isPyramidTile(file: File): boolean {
  const raw = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  if (raw.includes('\\') || /^[A-Za-z]:|^\//.test(raw)) return false;
  const value = relativePath(file);
  return isSafeRelativePath(value) && /^z\d+\/\d+_\d+\.webp$/i.test(value.split('/').slice(-2).join('/'));
}

function findUniqueByName(files: File[], name: string): File | undefined {
  const matches = files.filter((file) => lowerName(file) === name);
  if (matches.length > 1) throw new TerrainAssetError(`Duplicate uploaded file name ${name} is ambiguous`);
  return matches[0];
}

function textureMatchesModel(file: File, modelKey: string): boolean {
  const key = textureBasename(file);
  // Accept both `name.tif` and the exporter default
  // `name.texture.tif` naming convention.
  return key === modelKey || key === `${modelKey}.texture`;
}

function findUniqueTexture(files: File[], modelKey: string): File | undefined {
  const matches = files.filter((file) => textureMatchesModel(file, modelKey));
  if (matches.length > 1) {
    throw new TerrainAssetError(`Multiple texture files match model ${modelKey}: ${matches.map((file) => file.name).join(', ')}`);
  }
  return matches[0];
}

export function validateUploadedTileInventory(metadata: TilePyramidMetadata, files: ReadonlyMap<string, File>): void {
  for (const relative of files.keys()) {
    const match = /^z(\d+)\/(\d+)_(\d+)\.webp$/i.exec(relative);
    if (!match) throw new TerrainAssetError(`Invalid tile path ${relative}`);
    const zoom = Number(match[1]);
    const column = Number(match[2]);
    const row = Number(match[3]);
    let level;
    try {
      level = tileLevel(metadata, zoom);
    } catch {
      throw new TerrainAssetError(`Tile ${relative} is outside metadata bounds`);
    }
    if (column >= level.columns || row >= level.rows) {
      throw new TerrainAssetError(`Tile ${relative} is outside metadata bounds`);
    }
  }
}

export function pairUploadedFiles(files: readonly File[]): UploadedFilePair[] {
  const models = files.filter(isModel);
  if (models.length === 0) throw new TerrainAssetError('Choose at least one .glb or .gltf model file');

  const metadataFiles = files.filter((file) => extension(file.name) === '.terrain.json');
  const gridFiles = files.filter((file) => extension(file.name) === '.grid.bin');
  const textureFiles = files.filter((file) => isTextureFile(file) && !isPyramidTile(file));
  const tileMetadataFiles = files.filter(isTileMetadata);
  const pairs = models.map((model) => {
    const key = basename(model);
    const metadata = findUniqueByName(metadataFiles, `${key}.terrain.json`);
    const grid = findUniqueByName(gridFiles, `${key}.grid.bin`);
    const texture = findUniqueTexture(textureFiles, key);
    const tileMetadataFile = findUniqueByName(tileMetadataFiles, `${key}.tiles.json`);
    let tilePyramid: UploadedFilePair['tilePyramid'];
    if (tileMetadataFile) {
      const tileRoot = files.map(tileRootFor).find((root) => root?.toLowerCase() === `${key}_tiles`) ?? `${key}_tiles`;
      const owned = new Map<string, File>();
      files.filter((file) => tileRootFor(file) === tileRoot && ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).toLowerCase().endsWith('.webp') && !isPyramidTile(file)).forEach((file) => { throw new TerrainAssetError(`Unsafe tile path ${(file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name}`); });
      files.filter((file) => tileRootFor(file) === tileRoot && isPyramidTile(file)).forEach((file) => { const relative = relativePath(file).split(`${tileRoot}/`)[1]; if (relative && /^z\d+\/\d+_\d+\.webp$/i.test(relative)) owned.set(relative, file); });
      tilePyramid = { metadataFile: tileMetadataFile, rootPath: tileRoot, files: owned };
    }
    return { model, metadata, grid, texture, tilePyramid, resources: files.filter((file) => !isModel(file) && !isSidecar(file) && !isTextureFile(file) && !isTileMetadata(file)) };
  });

  const pairedNames = new Set(pairs.flatMap((pair) => [pair.metadata?.name.toLowerCase(), pair.grid?.name.toLowerCase()].filter((name): name is string => Boolean(name))));
  const orphanSidecar = [...metadataFiles, ...gridFiles].find((file) => !pairedNames.has(lowerName(file)));
  if (orphanSidecar) {
    throw new TerrainAssetError(`Sidecar ${orphanSidecar.name} does not match uploaded model(s): ${models.map((model) => model.name).join(', ')}`);
  }
  return pairs;
}

function parseGltf(loader: GLTFLoader, buffer: ArrayBuffer): Promise<GLTF> {
  return new Promise((resolve, reject) => loader.parse(buffer, 'https://uploads.invalid/', resolve, reject));
}

function decodeGrid(buffer: ArrayBuffer, metadata: TerrainMetadata): Float32Array {
  validateGridBuffer(metadata, buffer);
  const view = new DataView(buffer);
  const grid = new Float32Array(metadata.grid.shape[0] * metadata.grid.shape[1]);
  for (let index = 0; index < grid.length; index += 1) grid[index] = view.getFloat32(index * 4, true);
  return grid;
}

function resourceUrlMap(files: File[], objectUrls: string[]): Map<string, string> {
  const urls = new Map<string, string>();
  files.forEach((file) => {
    const url = URL.createObjectURL(file);
    objectUrls.push(url);
    const key = file.name.toLowerCase();
    if (urls.has(key)) throw new TerrainAssetError(`Duplicate uploaded resource name ${file.name} is ambiguous`);
    urls.set(key, url);
  });
  return urls;
}

function resolveResourceUrl(url: string, resources: Map<string, string>): string {
  if (/^(data:|blob:|https?:|\/\/)/i.test(url)) {
    const name = decodeURIComponent(url).split(/[\\/]/).filter(Boolean).at(-1)?.toLowerCase();
    return name && resources.get(name) ? resources.get(name)! : url;
  }
  const name = decodeURIComponent(url).split(/[\\/]/).filter(Boolean).at(-1)?.toLowerCase();
  return name && resources.get(name) ? resources.get(name)! : url;
}

export function releaseUploadedModels(models: readonly LoadedModel[]): void {
  models.forEach((model) => {
    if (!model.released) {
      model.released = true;
      disposeObjectResources(model.gltf.scene, !model.bvhDisposed);
    }
    model.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    model.objectUrls.length = 0;
  });
}

export async function loadUploadedModels(files: readonly File[]): Promise<LoadedModel[]> {
  const pairs = pairUploadedFiles(files);
  const loaded: LoadedModel[] = [];
  try {
    for (const pair of pairs) {
      const objectUrls: string[] = [];
      try {
        const resources = resourceUrlMap([pair.model, ...pair.resources], objectUrls);
        let metadata: TerrainMetadata | undefined;
        let grid: Float32Array | undefined;
        let gridBuffer: ArrayBuffer | undefined;
        if (pair.metadata) {
          metadata = validateMetadata(JSON.parse(await pair.metadata.text()) as unknown);
          if (pair.grid) {
            if (!assetUrlMatchesFilename(pair.grid.name, metadata.grid.file)) {
              throw new TerrainAssetError(`Grid file ${pair.grid.name} does not match metadata grid.file (${metadata.grid.file})`);
            }
            gridBuffer = await pair.grid.arrayBuffer();
            grid = decodeGrid(gridBuffer, metadata);
          }
          if (metadata.mesh && !assetUrlMatchesFilename(pair.model.name, metadata.mesh.file)) {
            throw new TerrainAssetError(`Model file ${pair.model.name} does not match metadata mesh.file (${metadata.mesh.file})`);
          }
        }
        const manager = new LoadingManager();
        manager.setURLModifier((url) => resolveResourceUrl(url, resources));
        const gltf = await parseGltf(new GLTFLoader(manager), await pair.model.arrayBuffer());
        try {
          if (metadata?.mesh) validateGltfMeshCounts(gltf.scene, metadata.mesh);
        } catch (error) {
          disposeObjectResources(gltf.scene);
          throw error;
        }
        if (pair.texture && !pair.tilePyramid) {
          const decoded = await decodeTextureFile(pair.texture);
          applyTextureToModel(gltf.scene, pair.model.name, decoded);
        }
        let tilePyramid = pair.tilePyramid;
        if (tilePyramid) {
          const parsed = validateTilePyramidMetadata(JSON.parse(await tilePyramid.metadataFile.text()) as unknown);
          if (parsed.asset_id.toLowerCase() !== basename(pair.model)) throw new TerrainAssetError('Tile metadata asset_id does not match ' + pair.model.name);
          validateUploadedTileInventory(parsed, tilePyramid.files);
          const preview = tilePyramid.files.get('z0/0_0.webp');
          if (!preview) throw new TerrainAssetError('Tile pyramid ' + pair.model.name + ' is missing z0/0_0.webp preview');
          const decoded = await decodeTextureFile(preview);
          applyTextureToModel(gltf.scene, pair.model.name, decoded);
          tilePyramid = { ...tilePyramid, metadata: parsed };
        }
        loaded.push({ id: pair.model.name + '-' + loaded.length, name: pair.model.name, metadata, grid, gridBuffer, gltf, objectUrls, tilePyramid: tilePyramid?.metadata, tileFiles: tilePyramid?.files });
      } catch (error) {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        throw error;
      }
    }
    return loaded;
  } catch (error) {
    releaseUploadedModels(loaded);
    throw error;
  }
}
