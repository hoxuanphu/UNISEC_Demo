import { Box3, Frustum, Matrix4, Vector3, type Camera, type Object3D } from 'three';
import type { LoadedModel } from '../types/terrain';
export type TileBudget = { cpuBytes: number; gpuBytes: number; maxRequests: number; atlasSize: number };
export type TileModelStats = { sourceId: string; status: string; projectedArea: number; detailAllowed: boolean; visible: boolean; priority: number };
export type TileStreamingStats = { activeSources: number; queuedRequests: number; loadedTiles: number; cpuBytes: number; gpuBytes: number; perModel: Map<string, TileModelStats> };
export type TileStatsSource = { id: string; tilePyramid?: unknown; tileCache?: { loadedCount: number; byteEstimate: number; evictToBudget?: (maxBytes: number) => void }; requestQueue?: { queuedCount: number } };
export const DEFAULT_TILE_BUDGET: TileBudget = { cpuBytes: 128 * 1024 * 1024, gpuBytes: 128 * 1024 * 1024, maxRequests: 6, atlasSize: 2048 };
export function estimateAtlasBytes(size: number, mipmap = true): number { return size * size * 4 * (mipmap ? 4 / 3 : 1); }
function projectedArea(model: LoadedModel): number { const bounds = model.tilePyramid?.bounds_projected; return bounds ? Math.max(0, bounds.max_x - bounds.min_x) * Math.max(0, bounds.max_y - bounds.min_y) : 0; }
function modelObject(model: LoadedModel): Object3D | undefined { return model.tileObject ?? model.gltf?.scene; }
function screenCoverage(model: LoadedModel, camera: Camera, viewport: { width: number; height: number }): { visible: boolean; area: number } {
  const object = modelObject(model);
  if (!object) return { visible: true, area: projectedArea(model) };
  const bounds = new Box3().setFromObject(object);
  if (bounds.isEmpty()) return { visible: true, area: projectedArea(model) };
  camera.updateMatrixWorld();
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  if (!frustum.intersectsBox(bounds)) return { visible: false, area: 0 };
  const corners = [
    new Vector3(bounds.min.x, bounds.min.y, bounds.min.z), new Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
    new Vector3(bounds.min.x, bounds.max.y, bounds.min.z), new Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
    new Vector3(bounds.max.x, bounds.min.y, bounds.min.z), new Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
    new Vector3(bounds.max.x, bounds.max.y, bounds.min.z), new Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
  ];
  const ndc = corners.map((corner) => corner.project(camera));
  const minX = Math.max(-1, Math.min(...ndc.map((point) => point.x)));
  const maxX = Math.min(1, Math.max(...ndc.map((point) => point.x)));
  const minY = Math.max(-1, Math.min(...ndc.map((point) => point.y)));
  const maxY = Math.min(1, Math.max(...ndc.map((point) => point.y)));
  return { visible: maxX > minX && maxY > minY, area: Math.max(0, (maxX - minX) * viewport.width * (maxY - minY) * viewport.height) };
}
export class SceneTileCoordinator {
  readonly budget: TileBudget; private states = new Map<string, TileModelStats>();
  constructor(budget: Partial<TileBudget> = {}) { this.budget = { ...DEFAULT_TILE_BUDGET, ...budget }; }
  async update(models: readonly LoadedModel[], camera: Camera, viewport: { width: number; height: number }, _now = performance.now()): Promise<void> {
    const candidates = models.filter((model) => Boolean(model.tilePyramid)).map((model) => { const coverage = screenCoverage(model, camera, viewport); return { model, ...coverage }; }).filter((candidate) => candidate.visible).sort((a, b) => b.area - a.area);
    const maxSources = Math.max(0, Math.floor(this.budget.gpuBytes / estimateAtlasBytes(this.budget.atlasSize)));
    this.states = new Map(models.map((model) => {
      const coverage = screenCoverage(model, camera, viewport);
      const candidateIndex = candidates.findIndex((candidate) => candidate.model.id === model.id);
      const allowed = candidateIndex >= 0 && candidateIndex < maxSources;
      const status = !model.tilePyramid ? 'fallback' : !coverage.visible ? 'out of view' : allowed ? 'preview' : 'waiting for budget';
      return [model.id, { sourceId: model.id, status, projectedArea: coverage.area || projectedArea(model), detailAllowed: allowed, visible: coverage.visible, priority: coverage.area }];
    }));
  }
  shouldRequestDetail(modelId: string): boolean { return this.states.get(modelId)?.detailAllowed === true; }
  getStats(sources: readonly TileStatsSource[] = []): TileStreamingStats { this.enforceCpuBudget(sources); const active = [...this.states.values()].filter((state) => state.detailAllowed); const loadedTiles = sources.reduce((sum, source) => sum + (source.tileCache?.loadedCount ?? 0), 0); const cpuBytes = sources.reduce((sum, source) => sum + (source.tileCache?.byteEstimate ?? 0), 0); const queuedRequests = sources.reduce((sum, source) => sum + (source.requestQueue?.queuedCount ?? 0), 0); return { activeSources: active.length, queuedRequests, loadedTiles, cpuBytes, gpuBytes: active.length * estimateAtlasBytes(this.budget.atlasSize), perModel: new Map(this.states) }; }
  private enforceCpuBudget(sources: readonly TileStatsSource[]): void { let totalBytes = sources.reduce((sum, source) => sum + (source.tileCache?.byteEstimate ?? 0), 0); while (totalBytes > this.budget.cpuBytes) { const victim = [...sources].sort((left, right) => (right.tileCache?.byteEstimate ?? 0) - (left.tileCache?.byteEstimate ?? 0))[0]; const currentBytes = victim?.tileCache?.byteEstimate ?? 0; if (!victim?.tileCache?.evictToBudget || currentBytes <= 0) break; const targetBytes = Math.max(0, currentBytes - (totalBytes - this.budget.cpuBytes)); victim.tileCache.evictToBudget(targetBytes); const nextTotal = sources.reduce((sum, source) => sum + (source.tileCache?.byteEstimate ?? 0), 0); if (nextTotal >= totalBytes) break; totalBytes = nextTotal; } }
  setStatus(modelId: string, status: string): void { const state = this.states.get(modelId); if (state) this.states.set(modelId, { ...state, status }); }
  remove(modelId: string): void { this.states.delete(modelId); }
  dispose(): void { this.states.clear(); }
}
