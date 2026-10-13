import { CanvasTexture, ClampToEdgeWrapping, LinearFilter, Mesh, MeshStandardMaterial, SRGBColorSpace, Texture, Vector4 } from 'three';
import type { LoadedModel } from '../types/terrain';
import { logicalTilePath, tileKey, tileLevel, type TilePyramidMetadata } from './tileMetadata';
import { TileRequestQueue, TileTextureCache } from './tileTexture';

export type AtlasTile = { key: string; column: number; row: number; bitmap: ImageBitmap };
export type AtlasWindow = { zoom: number; column: number; row: number; columns: number; rows: number };
export type RequestedTile = { zoom: number; column: number; row: number };
export type ModelTileState = {
  sourceId: string;
  model: LoadedModel;
  metadata: TilePyramidMetadata;
  previewTexture?: Texture;
  frontCanvas: HTMLCanvasElement;
  backCanvas: HTMLCanvasElement;
  frontTexture: CanvasTexture;
  backTexture: CanvasTexture;
  activeWindow?: AtlasWindow;
  ready: boolean;
  atlasSize: number;
  tileSize: number;
  gutter: number;
  cache: TileTextureCache;
  objectUrls: Set<string>;
  originalMaterials: Map<Mesh, MeshStandardMaterial | MeshStandardMaterial[]>;
  shaders: Set<{ uniforms: Record<string, { value: unknown }> }>;
  clonedMaterials: Set<MeshStandardMaterial>;
  requestQueue: TileRequestQueue;
  disposed: boolean;
  generation: number;
};

export function atlasPlacement(tile: { column: number; row: number }, window: AtlasWindow, tileSize: number, gutter: number): { x: number; y: number; size: number } {
  return { x: (tile.column - window.column) * tileSize + gutter, y: (tile.row - window.row) * tileSize + gutter, size: tileSize };
}
export function requiredWindow(centerColumn: number, centerRow: number, columns: number, rows: number, maxColumns: number, maxRows: number, zoom = 0): AtlasWindow {
  const column = Math.max(0, Math.min(Math.max(0, maxColumns - columns), Math.floor(centerColumn - columns / 2)));
  const row = Math.max(0, Math.min(Math.max(0, maxRows - rows), Math.floor(centerRow - rows / 2)));
  return { zoom, column, row, columns, rows };
}
export function canSwapWindow(requestedTiles: readonly RequestedTile[], files: ReadonlyMap<string, File>): boolean { return requestedTiles.length > 0 && requestedTiles.every((tile) => files.has(logicalTilePath(tile.zoom, tile.column, tile.row))); }
export class DetailAtlas { readonly size: number; readonly tileSize: number; activeWindow: AtlasWindow | undefined; constructor(size = 2048, tileSize = 512) { this.size = size; this.tileSize = tileSize; } get slots(): number { return Math.floor(this.size / this.tileSize) ** 2; } canFit(): boolean { return this.slots > 0; } }

function canvas(size: number): HTMLCanvasElement { const value = document.createElement('canvas'); value.width = size; value.height = size; return value; }
function texture(value: HTMLCanvasElement): CanvasTexture { const result = new CanvasTexture(value); result.colorSpace = SRGBColorSpace; result.flipY = false; result.generateMipmaps = false; result.minFilter = LinearFilter; result.magFilter = LinearFilter; result.wrapS = ClampToEdgeWrapping; result.wrapT = ClampToEdgeWrapping; return result; }
function firstPreview(model: LoadedModel): Texture | undefined {
  let found: Texture | undefined;
  model.gltf.scene.traverse((object) => { if (found || !(object as Mesh).isMesh) return; const material = (object as Mesh).material as MeshStandardMaterial; if (material?.isMeshStandardMaterial) found = material.map ?? undefined; });
  return found;
}
function detailMaterial(material: MeshStandardMaterial, state: ModelTileState): void {
  const original = material.onBeforeCompile;
  material.onBeforeCompile = (shader) => {
    original?.(shader, material as never);
    shader.uniforms.terrainDetailMap = { value: state.frontTexture };
    shader.uniforms.terrainDetailWindow = { value: new Vector4(0, 0, 1, 1) };
    shader.uniforms.terrainDetailReady = { value: 0 };
    state.shaders.add(shader as unknown as { uniforms: Record<string, { value: unknown }> });
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D terrainDetailMap;\nuniform vec4 terrainDetailWindow;\nuniform float terrainDetailReady;').replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_MAP\nvec2 terrainDetailUv = (vMapUv - terrainDetailWindow.xy) / terrainDetailWindow.zw;\nif (terrainDetailReady > 0.5 && terrainDetailUv.x >= 0.0 && terrainDetailUv.x <= 1.0 && terrainDetailUv.y >= 0.0 && terrainDetailUv.y <= 1.0) { diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(terrainDetailMap, terrainDetailUv).rgb, 1.0); }\n#endif');
  };
  material.customProgramCacheKey = () => state.sourceId;
  material.needsUpdate = true;
}
export function createModelTileState(model: LoadedModel, rendererCapabilities: { maxTextureSize?: number } = {}, budget: { atlasSize?: number } = {}, requestQueue = new TileRequestQueue(6)): ModelTileState | undefined {
  const metadata = model.tilePyramid;
  if (!metadata || !model.tileFiles) return undefined;
  const requested = Math.min(budget.atlasSize ?? 2048, rendererCapabilities.maxTextureSize ?? 2048);
  const atlasSize = requested >= 4096 ? 4096 : requested >= 2048 ? 2048 : 1024;
  const tileSize = metadata.tile_size;
  const state: ModelTileState = { sourceId: model.id, model, metadata, previewTexture: firstPreview(model), frontCanvas: canvas(atlasSize), backCanvas: canvas(atlasSize), frontTexture: texture(canvas(atlasSize)), backTexture: texture(canvas(atlasSize)), ready: false, atlasSize, tileSize, gutter: metadata.gutter_px, cache: new TileTextureCache(), objectUrls: new Set(), originalMaterials: new Map(), shaders: new Set(), clonedMaterials: new Set(), requestQueue, disposed: false, generation: 0 };
  state.frontCanvas = canvas(atlasSize); state.backCanvas = canvas(atlasSize); state.frontTexture.dispose(); state.backTexture.dispose(); state.frontTexture = texture(state.frontCanvas); state.backTexture = texture(state.backCanvas);
  model.gltf.scene.traverse((object) => { const mesh = object as Mesh; if (!mesh.isMesh) return; const material = mesh.material as MeshStandardMaterial | MeshStandardMaterial[]; state.originalMaterials.set(mesh, material); const materials = Array.isArray(material) ? material : [material]; mesh.material = materials.map((item) => { const clone = item.clone(); if (clone instanceof MeshStandardMaterial) { detailMaterial(clone, state); state.clonedMaterials.add(clone); } return clone; }); if (!Array.isArray(material)) mesh.material = (mesh.material as MeshStandardMaterial[])[0]; });
  return state;
}
function windowUniform(state: ModelTileState): Vector4 { const active = state.activeWindow; if (!active) return new Vector4(0, 0, 1, 1); const level = tileLevel(state.metadata, active.zoom); return new Vector4(active.column * state.tileSize / level.width_px, active.row * state.tileSize / level.height_px, active.columns * state.tileSize / level.width_px, active.rows * state.tileSize / level.height_px); }
export async function updateModelDetail(state: ModelTileState, requestedTiles: readonly RequestedTile[]): Promise<void> {
  const level = requestedTiles.length ? tileLevel(state.metadata, requestedTiles[0].zoom) : undefined;
  if (!level) return;
  const window = requiredWindow(requestedTiles.reduce((sum, tile) => sum + tile.column, 0) / requestedTiles.length, requestedTiles.reduce((sum, tile) => sum + tile.row, 0) / requestedTiles.length, Math.min(Math.floor(state.atlasSize / state.tileSize), level.columns), Math.min(Math.floor(state.atlasSize / state.tileSize), level.rows), level.columns, level.rows, level.zoom);
  if (state.disposed) return;
  const generation = ++state.generation;
  const bitmaps: AtlasTile[] = [];
  if (!canSwapWindow(requestedTiles, state.model.tileFiles ?? new Map())) return;
  for (const tile of requestedTiles) { const file = state.model.tileFiles?.get(logicalTilePath(tile.zoom, tile.column, tile.row)); if (!file) continue; const key = tileKey(state.sourceId, tile.zoom, tile.column, tile.row); const url = URL.createObjectURL(file); state.objectUrls.add(url); try { bitmaps.push({ key, column: tile.column, row: tile.row, bitmap: await state.requestQueue.enqueue(state.sourceId, (signal) => state.cache.load(key, url, signal)) }); } finally { URL.revokeObjectURL(url); state.objectUrls.delete(url); } }
  if (bitmaps.length !== requestedTiles.length) return;
  if (state.disposed || generation !== state.generation || !bitmaps.length) return;
  const context = state.backCanvas.getContext('2d'); if (!context) return;
  context.clearRect(0, 0, state.atlasSize, state.atlasSize);
  for (const tile of bitmaps) { const placement = atlasPlacement(tile, window, state.tileSize, state.gutter); context.drawImage(tile.bitmap, placement.x - state.gutter, placement.y - state.gutter, state.tileSize + state.gutter * 2, state.tileSize + state.gutter * 2); }
  state.backTexture.needsUpdate = true;
  const oldTexture = state.frontTexture; state.frontTexture = state.backTexture; state.backTexture = oldTexture; const oldCanvas = state.frontCanvas; state.frontCanvas = state.backCanvas; state.backCanvas = oldCanvas; state.activeWindow = window; state.ready = true;
  const uniform = windowUniform(state); state.shaders.forEach((shader) => { shader.uniforms.terrainDetailMap.value = state.frontTexture; shader.uniforms.terrainDetailWindow.value = uniform; shader.uniforms.terrainDetailReady.value = 1; });
}
export function setModelDetailWindow(state: ModelTileState, window: AtlasWindow): void { state.activeWindow = window; const uniform = windowUniform(state); state.shaders.forEach((shader) => { shader.uniforms.terrainDetailWindow.value = uniform; }); }
export function disposeModelTileState(state: ModelTileState): void { if (state.disposed) return; state.disposed = true; state.generation += 1; state.requestQueue.cancel(state.sourceId); state.cache.dispose(); state.frontTexture.dispose(); state.backTexture.dispose(); state.shaders.forEach((shader) => { shader.uniforms.terrainDetailReady.value = 0; }); state.objectUrls.forEach((url) => URL.revokeObjectURL(url)); state.objectUrls.clear(); state.model.gltf.scene.traverse((object) => { const mesh = object as Mesh; const original = state.originalMaterials.get(mesh); if (original) mesh.material = original; }); state.originalMaterials.clear(); state.shaders.clear(); state.clonedMaterials.forEach((material) => material.dispose()); state.clonedMaterials.clear(); }
