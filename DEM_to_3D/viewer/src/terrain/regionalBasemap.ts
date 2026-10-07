import * as THREE from 'three';
import proj4 from 'proj4';
import type { TerrainMetadata } from '../types/terrain';
import { pixelToProjected, projectedToScene } from './coordinate';

import type { BasemapStyle, BasemapState } from '../features/map/mapContracts';
export type { BasemapStyle, BasemapState } from '../features/map/mapContracts';
export type MapTile = { x: number; y: number; z: number };
const sourceCrs = (metadata: TerrainMetadata): string => metadata.crs.proj4 || `${metadata.crs.authority}:${metadata.crs.code}`;

export function tileLonLat(x: number, y: number, z: number): [number, number] {
  const n = 2 ** z;
  return [x / n * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI];
}

/** A bounded regional context around the DEM, never a global tile prefetch. */
export function planRegionalTiles(metadata: TerrainMetadata): MapTile[] {
  if (metadata.crs.linear_unit !== 'metre') throw new Error('Regional basemap requires a metric projected terrain CRS');
  const [rows, columns] = metadata.grid.shape;
  const gridCorners = [0, columns - 1].flatMap(col => [0, rows - 1].map(row => pixelToProjected(metadata, col, row)));
  const minX = Math.min(...gridCorners.map(p => p.x)), maxX = Math.max(...gridCorners.map(p => p.x));
  const minY = Math.min(...gridCorners.map(p => p.y)), maxY = Math.max(...gridCorners.map(p => p.y));
  const radius = Math.max(maxX - minX, maxY - minY) * 2.4;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const corners = [-1, 1].flatMap(dx => [-1, 1].map(dy => proj4(sourceCrs(metadata), 'EPSG:4326', [cx + dx * radius, cy + dy * radius])));
  for (let z = 11; z >= 0; z--) {
    const n = 2 ** z;
    const xy = corners.map(([lon, lat]) => {
      const r = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(lat, -85.0511, 85.0511));
      return { x: Math.floor((lon + 180) / 360 * n), y: Math.floor((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2 * n) };
    });
    const minX = Math.max(0, Math.min(...xy.map(p => p.x))), maxX = Math.min(n - 1, Math.max(...xy.map(p => p.x)));
    const minY = Math.max(0, Math.min(...xy.map(p => p.y))), maxY = Math.min(n - 1, Math.max(...xy.map(p => p.y)));
    if ((maxX - minX + 1) * (maxY - minY + 1) > 64) continue;
    const tiles: MapTile[] = [];
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) tiles.push({ x, y, z });
    return tiles.sort((a, b) => Math.hypot(a.x - (minX + maxX) / 2, a.y - (minY + maxY) / 2) - Math.hypot(b.x - (minX + maxX) / 2, b.y - (minY + maxY) / 2));
  }
  return [];
}

export function tileScenePoint(metadata: TerrainMetadata, tile: MapTile, u: number, v: number): THREE.Vector3 {
  const [x, y] = proj4('EPSG:4326', sourceCrs(metadata), tileLonLat(tile.x + u, tile.y + v, tile.z));
  const point = projectedToScene(metadata, { x, y }, metadata.elevation.base_elevation - 20);
  return new THREE.Vector3(point.x, point.y, point.z);
}

function tileGeometry(metadata: TerrainMetadata, tile: MapTile): THREE.BufferGeometry {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const steps = 4;
  for (let row = 0; row <= steps; row++) for (let col = 0; col <= steps; col++) {
    const p = tileScenePoint(metadata, tile, col / steps, row / steps);
    positions.push(p.x, p.y, p.z); uv.push(col / steps, 1 - row / steps);
  }
  for (let row = 0; row < steps; row++) for (let col = 0; col < steps; col++) {
    const a = row * (steps + 1) + col, b = a + 1, c = a + steps + 1, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeBoundingSphere();
  return geometry;
}

export function createRegionalBasemap(metadata: TerrainMetadata, transform: THREE.Matrix4, onState: (state: BasemapState) => void) {
  const group = new THREE.Group();
  group.name = 'regional-basemap'; group.matrix.copy(transform); group.matrixAutoUpdate = false;
  let tiles: MapTile[] = [];
  try { tiles = planRegionalTiles(metadata); } catch { /* Unlocated/custom models remain usable without a basemap. */ }
  let style: BasemapStyle = 'satellite', enabled = false, disposed = false, generation = 0;
  let controller: AbortController | null = null;
  const cached = new Map<string, { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; bitmap: ImageBitmap; style: BasemapStyle }>();
  const key = (tile: MapTile, nextStyle = style) => `${nextStyle}/${tile.z}/${tile.x}/${tile.y}`;
  const publish = (status: BasemapState['status']) => { if (!disposed) onState({ status, style, loaded: tiles.filter(t => cached.has(key(t))).length, total: tiles.length }); };
  const load = async (): Promise<void> => {
    controller?.abort(); const run = ++generation;
    if (!enabled || disposed) { publish('off'); return; }
    if (!tiles.length) { publish('unavailable'); return; }
    controller = new AbortController(); const signal = controller.signal, runStyle = style;
    const queue = tiles.filter(tile => !cached.has(key(tile)));
    if (!queue.length) { publish('ready'); return; }
    const batchController = controller;
    const batchTimeout = window.setTimeout(() => batchController.abort(), 20000);
    let failedBeforeFirstSuccess = 0;
    let loadedInBatch = false;
    publish('loading');
    const worker = async (): Promise<void> => {
      while (queue.length && !signal.aborted) {
        const tile = queue.shift()!;
        const request = new AbortController();
        const abort = () => request.abort(); signal.addEventListener('abort', abort, { once: true });
        const timeout = window.setTimeout(abort, 12000);
        let bitmap: ImageBitmap | undefined;
        try {
          const layer = runStyle === 'satellite' ? 's2cloudless_3857' : 'terrain-light_3857';
          const response = await fetch(`https://tiles.maps.eox.at/wmts/1.0.0/${layer}/default/g/${tile.z}/${tile.y}/${tile.x}.jpg`, { signal: request.signal });
          if (!response.ok) throw new Error(`Basemap tile ${response.status}`);
          bitmap = await createImageBitmap(await response.blob(), { imageOrientation: 'flipY' });
          if (disposed || run !== generation) { bitmap.close(); continue; }
          const texture = new THREE.Texture(bitmap); texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
          const mesh = new THREE.Mesh(tileGeometry(metadata, tile), new THREE.MeshBasicMaterial({ map: texture }));
          group.add(mesh); cached.set(key(tile, runStyle), { mesh, bitmap, style: runStyle });
          loadedInBatch = true;
          publish('loading');
        } catch {
          bitmap?.close();
          // A dead tile service should not make an offline demo request the entire grid.
          if (!signal.aborted && run === generation && !loadedInBatch && ++failedBeforeFirstSuccess >= 4) {
            batchController.abort();
          }
        } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    clearTimeout(batchTimeout);
    if (run !== generation || disposed) return;
    const loaded = tiles.filter(tile => cached.has(key(tile))).length;
    publish(loaded === tiles.length ? 'ready' : loaded ? 'partial' : 'error');
  };
  return {
    group,
    setOptions(nextEnabled: boolean, nextStyle: BasemapStyle): void {
      if (enabled === nextEnabled && style === nextStyle) return;
      enabled = nextEnabled; style = nextStyle; group.visible = enabled;
      cached.forEach(item => { item.mesh.visible = item.style === style; });
      void load();
    },
    retry: () => { void load(); },
    dispose(): void {
      disposed = true; generation++; controller?.abort();
      cached.forEach(({ mesh, bitmap }) => { mesh.geometry.dispose(); mesh.material.map?.dispose(); mesh.material.dispose(); bitmap.close(); });
      cached.clear(); group.removeFromParent();
    }
  };
}
