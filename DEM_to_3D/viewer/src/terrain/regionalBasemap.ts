import { setBasemapTone } from './basemapTone';
import type { BasemapTone } from '../features/imagery/basemapTone';
import { closeTerrainSeams, terrainBoundaryEdges, type TerrainEdge } from './terrainSeams';
import { createTerrainCoverageClip } from './terrainCoverage';
import { imageryDrape } from './imageryDrape';
import type { ImageryDetailAtlas } from './imageryAtlas';
import { createRegionalElevation, type ElevationSurface } from './regionalElevation';
import * as THREE from 'three';
import proj4 from 'proj4';
import { imagerySource,terrainTileSource } from '../features/map/imagerySource';
import { mapLayerOrder } from '../features/map/mapLayerOrder';
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
export function planRegionalTiles(metadata: TerrainMetadata, options: { padding?: number; maxZoom?: number; budget?: number } = {}): MapTile[] {
  if (metadata.crs.linear_unit !== 'metre') throw new Error('Regional basemap requires a metric projected terrain CRS');
  const [rows, columns] = metadata.grid.shape;
  const gridCorners = [0, columns - 1].flatMap(col => [0, rows - 1].map(row => pixelToProjected(metadata, col, row)));
  const minX = Math.min(...gridCorners.map(p => p.x)), maxX = Math.max(...gridCorners.map(p => p.x));
  const minY = Math.min(...gridCorners.map(p => p.y)), maxY = Math.max(...gridCorners.map(p => p.y));
  const radiusX = (maxX - minX) / 2 + Math.max(maxX - minX, maxY - minY) * (options.padding ?? .65);
  const radiusY = (maxY - minY) / 2 + Math.max(maxX - minX, maxY - minY) * (options.padding ?? .65);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const corners = [-1, 1].flatMap(dx => [-1, 1].map(dy => proj4(sourceCrs(metadata), 'EPSG:4326', [cx + dx * radiusX, cy + dy * radiusY])));
  for (let z = Math.max(0, Math.min(22, Math.floor(options.maxZoom ?? 12))); z >= 0; z--) {
    const n = 2 ** z;
    const xy = corners.map(([lon, lat]) => {
      const r = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(lat, -85.0511, 85.0511));
      return { x: Math.floor((lon + 180) / 360 * n), y: Math.floor((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2 * n) };
    });
    const minX = Math.max(0, Math.min(...xy.map(p => p.x))), maxX = Math.min(n - 1, Math.max(...xy.map(p => p.x)));
    const minY = Math.max(0, Math.min(...xy.map(p => p.y))), maxY = Math.min(n - 1, Math.max(...xy.map(p => p.y)));
    if ((maxX - minX + 1) * (maxY - minY + 1) > (options.budget ?? 64)) continue;
    const tiles: MapTile[] = [];
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) tiles.push({ x, y, z });
    return tiles.sort((a, b) => Math.hypot(a.x - (minX + maxX) / 2, a.y - (minY + maxY) / 2) - Math.hypot(b.x - (minX + maxX) / 2, b.y - (minY + maxY) / 2));
  }
  return [];
}

/** Coarse context stays visible while a bounded, finer DEM footprint arrives. */
export function planBasemapTiles(metadata: TerrainMetadata, maxZoom: number): MapTile[] {
  const overview = planRegionalTiles(metadata, { padding: 1.9, maxZoom: Math.min(10, maxZoom), budget: 32 });
  const context = planRegionalTiles(metadata, { maxZoom: Math.min(12, maxZoom), budget: 64 });
  const detail = planRegionalTiles(metadata, { padding: .05, maxZoom, budget: 128 });
  const seen = new Set<string>();
  return [...overview.slice(0, 4), ...context.slice(0, 4), ...detail, ...context.slice(4), ...overview.slice(4)].filter(tile => {
    const key = `${tile.z}/${tile.x}/${tile.y}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function tileScenePoint(metadata: TerrainMetadata, tile: MapTile, u: number, v: number): THREE.Vector3 {
  const [x, y] = proj4('EPSG:4326', sourceCrs(metadata), tileLonLat(tile.x + u, tile.y + v, tile.z));
  const point = projectedToScene(metadata, { x, y }, metadata.elevation.base_elevation - 20);
  return new THREE.Vector3(point.x, point.y, point.z);
}

export function tileGeometry(metadata: TerrainMetadata, tile: MapTile, elevation?: (x: number, y: number) => number | undefined, edges:readonly TerrainEdge[]=[]): THREE.BufferGeometry {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const projection = proj4('EPSG:4326', sourceCrs(metadata));
  const steps = elevation ? Math.max(4, Math.min(128, 2 ** (19 - tile.z))) : 4;
  const valid: boolean[] = [];
  for (let row = 0; row <= steps; row++) for (let col = 0; col <= steps; col++) {
    const [x, y] = projection.forward(tileLonLat(tile.x + col / steps, tile.y + row / steps, tile.z));
    const p = projectedToScene(metadata, {x, y}, metadata.elevation.base_elevation - 20);
    const height = elevation?.(p.x + metadata.world_origin.x, metadata.world_origin.y - p.z);
    valid.push(!elevation || height !== undefined);
    if (height !== undefined) p.y = (height - metadata.elevation.base_elevation) * metadata.elevation.exaggeration;
    positions.push(p.x, p.y, p.z); uv.push(col / steps, 1 - row / steps);
  }
  for (let row = 0; row < steps; row++) for (let col = 0; col < steps; col++) {
    const a = row * (steps + 1) + col, b = a + 1, c = a + steps + 1, d = c + 1;
    if (valid[a] && valid[c] && valid[b]) indices.push(a, c, b);
    if (valid[b] && valid[c] && valid[d]) indices.push(b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  if(edges.length)closeTerrainSeams(geometry,metadata,tile,steps,edges);
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export function createRegionalBasemap(metadata: TerrainMetadata, transform: THREE.Matrix4, onState: (state: BasemapState) => void, anisotropy = 1, onImageryTile?: (tile: MapTile, bitmap: ImageBitmap) => void, elevationSurfaces?: ElevationSurface[]) {
  const edges=terrainBoundaryEdges(elevationSurfaces??[]);
  const coverage=createTerrainCoverageClip(elevationSurfaces ?? [],metadata.world_origin);
  const group = new THREE.Group();
  group.name = 'regional-basemap'; group.matrix.copy(transform); group.matrixAutoUpdate = false;
  const tilesFor = (nextStyle: BasemapStyle): MapTile[] => {
    try { return planBasemapTiles(metadata, nextStyle === 'satellite' ? imagerySource.maxNativeZoom : terrainTileSource().maxZoom); }
    catch { return []; } // Unlocated/custom models remain usable without a basemap.
  };
  let tiles = tilesFor('satellite');
  let tone:BasemapTone|null=null;
  let style: BasemapStyle = 'satellite', enabled = false, disposed = false, generation = 0;
  let controller: AbortController | null = null;
  let imageryStatus: BasemapState['status'] = 'off';
  const cached = new Map<string, { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>; bitmap: ImageBitmap; style: BasemapStyle; tile: MapTile; setDetail: ReturnType<typeof imageryDrape> }>();
  let viewAtlas: ImageryDetailAtlas|null = null, baseAtlas:ImageryDetailAtlas|null=null;
  const relief = elevationSurfaces?.length && tiles.length ? createRegionalElevation(metadata, elevationSurfaces,
    planRegionalTiles(metadata, { padding: 1.2, maxZoom: 11, budget: 48 }), () => {
      if (disposed) return;
      cached.forEach(item => {
        const geometry = tileGeometry(metadata, item.tile, relief!.sample,edges);
        item.mesh.geometry.dispose(); item.mesh.geometry = geometry;
      });
      publish(imageryStatus);
    }) : null;
  const key = (tile: MapTile, nextStyle = style) => `${nextStyle}/${tile.z}/${tile.x}/${tile.y}`;
  const publish = (status: BasemapState['status']) => { imageryStatus = status; if (!disposed) onState({ status, style, ...(relief ? {relief:relief.status} : {}), provider: style === 'satellite' ? 'configured' : 'eox', loaded: tiles.filter(t => cached.has(key(t))).length, total: tiles.length }); };
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
          const template = runStyle === 'satellite' ? imagerySource.url : terrainTileSource().url;
          const url = template.replaceAll('{z}', String(tile.z)).replaceAll('{y}', String(tile.y)).replaceAll('{x}', String(tile.x));
          const response = await fetch(url, { signal: request.signal });
          if (!response.ok) throw new Error(`Basemap tile ${response.status}`);
          bitmap = await createImageBitmap(await response.blob(), { imageOrientation: 'flipY' });
          if (disposed || run !== generation) { bitmap.close(); continue; }
          const texture = new THREE.Texture(bitmap); texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = anisotropy; texture.needsUpdate = true;
          const mesh = new THREE.Mesh(tileGeometry(metadata, tile, relief?.sample,edges), new THREE.MeshLambertMaterial({ map: texture, depthWrite: false, side:THREE.DoubleSide }));
          // The DEM writes depth first. Tiles test against it, but do not occlude
          // finer tiles in the same flat context plane.
          mesh.renderOrder = mapLayerOrder.imagery * 2 + tile.z / 32;
          const setDetail=imageryDrape(mesh.material,tile);coverage.apply(mesh.material);setDetail(runStyle==='satellite'?viewAtlas:null);setDetail.setBase(runStyle==='satellite'?baseAtlas:null);
          setBasemapTone(mesh.material,runStyle==='satellite'?tone:null);setDetail.setTone(runStyle==='satellite'?tone:null);
          group.add(mesh); cached.set(key(tile, runStyle), { mesh, bitmap, style: runStyle, tile, setDetail });
          if (runStyle === 'satellite') {
            try {onImageryTile?.(tile, bitmap);} catch { /* The prepared DEM texture remains the fallback. */ }
          }
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
    setTone(next:BasemapTone|null){tone=next;cached.forEach(item=>{setBasemapTone(item.mesh.material,item.style==='satellite'?tone:null);item.setDetail.setTone(item.style==='satellite'?tone:null);});},
    surfacePoint(x:number,y:number):THREE.Vector3|undefined {
      const height=relief?.sample(x,y);if(height===undefined)return undefined;
      const p=projectedToScene(metadata,{x,y},height+3);
      return new THREE.Vector3(p.x,p.y,p.z).applyMatrix4(group.matrix);
    },
    setBase(atlas:ImageryDetailAtlas|null){baseAtlas=atlas;cached.forEach(item=>item.setDetail.setBase(item.style==='satellite'?atlas:null));},
    setDetail(atlas:ImageryDetailAtlas|null){viewAtlas=atlas;cached.forEach(item=>item.setDetail(item.style==='satellite'?atlas:null));},
    setOptions(nextEnabled: boolean, nextStyle: BasemapStyle): void {
      if (enabled === nextEnabled && style === nextStyle) return;
      enabled = nextEnabled; style = nextStyle; tiles = tilesFor(style); group.visible = enabled;
      cached.forEach(item => { item.mesh.visible = item.style === style; });
      if (enabled) void relief?.load();
      void load();
    },
    retry: () => { if (enabled) void relief?.load(); void load(); },
    dispose(): void {
      disposed = true; generation++; controller?.abort(); relief?.dispose(); coverage.dispose();
      cached.forEach(({ mesh, bitmap }) => { mesh.geometry.dispose(); mesh.material.map?.dispose(); mesh.material.dispose(); bitmap.close(); });
      cached.clear(); group.removeFromParent();
    }
  };
}
