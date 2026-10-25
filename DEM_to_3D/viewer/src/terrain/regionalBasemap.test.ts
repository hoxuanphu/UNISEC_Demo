import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import * as regionalElevation from './regionalElevation';
import proj4 from 'proj4';
import { createTerrainImagery, planImageryAtlases } from './terrainImagery';
import { imagerySource } from '../features/map/imagerySource';
import { mapLayerOrder } from '../features/map/mapLayerOrder';
import metadataJson from '../../public/terrain/che_tao_v2_tex.terrain.json';
import { validateMetadata } from './validation';
import { pixelToProjected, sceneToProjected } from './coordinate';
import { createRegionalBasemap, planRegionalTiles, planBasemapTiles, tileLonLat, tileScenePoint, tileGeometry, type BasemapState } from './regionalBasemap';

const metadata = validateMetadata(metadataJson);
describe('Regional basemap placement', () => {
  it('retains exact terrain placement and texture coordinates with a shared CRS converter',()=>{
    const tile=planRegionalTiles(metadata,{maxZoom:11})[0];
    const geometry=tileGeometry(metadata,tile,()=>1250),steps=Math.max(4,Math.min(128,2**(19-tile.z)));
    const position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
    try{
      for(const [col,row] of [[0,0],[steps,steps],[steps/2,steps/2],[steps/4,steps*3/4]]){
        const i=row*(steps+1)+col,p=tileScenePoint(metadata,tile,col/steps,row/steps);
        expect(position.getX(i)).toBeCloseTo(p.x,2);expect(position.getZ(i)).toBeCloseTo(p.z,2);
        expect(position.getY(i)).toBeCloseTo((1250-metadata.elevation.base_elevation)*metadata.elevation.exaggeration,2);
        expect(uv.getX(i)).toBe(col/steps);expect(uv.getY(i)).toBe(1-row/steps);
      }
    }finally{geometry.dispose();}
  });
  it('uses Web Mercator tile coordinates with north at the top', () => {
    expect(tileLonLat(1, 1, 1)).toEqual([0, 0]);
    const [lon, lat] = tileLonLat(0, 0, 0);
    expect(lon).toBe(-180);
    expect(lat).toBeCloseTo(85.05112878);
  });
  it.each([false, true])('bounds tile requests and covers all DEM corners (rotated grid=%s)', rotated => {
    const terrain = rotated ? { ...metadata, grid_transform: { ...metadata.grid_transform, b: -20, d: -20 } } : metadata;
    const tiles = planRegionalTiles(terrain);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThanOrEqual(64);
    for (const col of [0, terrain.grid.shape[1] - 1]) for (const row of [0, terrain.grid.shape[0] - 1]) {
      const p = pixelToProjected(terrain, col, row);
      const [lon, lat] = proj4(terrain.crs.proj4!, 'EPSG:4326', [p.x, p.y]);
      expect(tiles.some(tile => {
        const nw = tileLonLat(tile.x, tile.y, tile.z), se = tileLonLat(tile.x + 1, tile.y + 1, tile.z);
        return lon >= nw[0] && lon <= se[0] && lat <= nw[1] && lat >= se[1];
      })).toBe(true);
    }
  });
  it.each([14, 19])('adds detail around the DEM without unbounded regional requests or duplicate tiles (native zoom=%s)', maxZoom => {
    const tiles = planBasemapTiles(metadata, maxZoom);
    const context = planRegionalTiles(metadata, { budget: 64 });
    expect(tiles.length).toBeLessThanOrEqual(224);
    expect(new Set(tiles.map(t => `${t.z}/${t.x}/${t.y}`)).size).toBe(tiles.length);
    expect(Math.max(...tiles.map(t => t.z))).toBeGreaterThan(Math.max(...context.map(t => t.z)));
    expect(tiles.every(t => t.z <= maxZoom)).toBe(true);
    for (const t of context) expect(tiles).toContainEqual(t);
    expect(planBasemapTiles(metadata, 8).every(t => t.z <= 8)).toBe(true);
    expect(planBasemapTiles(metadata, 14.5).every(t => Number.isInteger(t.z) && t.z <= 14)).toBe(true);
  });
  it('reprojects tiles into the DEM frame without gaps along shared edges', () => {
    const tile = planRegionalTiles(metadata)[0];
    const point = tileScenePoint(metadata, tile, .5, .5);
    const converted = sceneToProjected(metadata, point);
    const expected = proj4('EPSG:4326', metadata.crs.proj4!, tileLonLat(tile.x + .5, tile.y + .5, tile.z));
    expect(converted.projected.x).toBeCloseTo(expected[0], 6);
    expect(converted.projected.y).toBeCloseTo(expected[1], 6);
    expect(converted.elevation).toBeCloseTo(metadata.elevation.base_elevation - 20);
    for (const v of [0, .25, .5, .75, 1]) {
      const left = tileScenePoint(metadata, tile, 1, v);
      const right = tileScenePoint(metadata, { ...tile, x: tile.x + 1 }, 0, v);
      expect(left.distanceTo(right)).toBeLessThan(.000001);
    }
  });
  it('rejects unprojected terrain rather than placing tiles in the wrong location', () => {
    expect(() => planRegionalTiles({ ...metadata, crs: { authority: 'EPSG', code: 4326, linear_unit: 'degree' } })).toThrow('metric');
  });
  it('uses the configured source, renders detail above context and releases cached textures', async () => {
    vi.stubGlobal('window', globalThis);
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close })));
    const fetchMock = vi.fn(async (_url: string, _options: RequestInit) => ({ ok: true, blob: async () => new Blob() }));
    vi.stubGlobal('fetch', fetchMock);
    const originalUrl = imagerySource.url;
    imagerySource.url = 'https://imagery.example.test/{z}/{x}/{y}.png';
    const states: BasemapState[] = [];
    const basemap = createRegionalBasemap(metadata, new THREE.Matrix4(), state => states.push(state), 4);
    try {
      basemap.setOptions(true, 'satellite');
      await vi.waitFor(() => expect(states.at(-1)?.status).toBe('ready'));
      expect(states.at(-1)?.provider).toBe('configured');
      expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(224);
      expect(fetchMock.mock.calls.every(args => String(args[0]).startsWith('https://imagery.example.test/'))).toBe(true);
      for (const child of basemap.group.children) {
        const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
        expect(mesh.material.map?.anisotropy).toBe(4);
        expect(mesh.material.depthWrite).toBe(false);
        expect(mesh.renderOrder).toBeGreaterThan(0);
        expect(mesh.renderOrder).toBeLessThan(mapLayerOrder.boundary * 2);
      }
      const requests = fetchMock.mock.calls.length;
      basemap.setOptions(false, 'satellite');
      basemap.setOptions(true, 'satellite');
      expect(fetchMock.mock.calls.length).toBe(requests);
    } finally {
      basemap.dispose();
      expect(close).toHaveBeenCalledTimes(fetchMock.mock.calls.length);
      imagerySource.url = originalUrl;
      vi.unstubAllGlobals();
    }
  });
  it('keeps a failed imagery request failed when context terrain finishes later', async () => {
    vi.stubGlobal('window', {setTimeout, clearTimeout});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('imagery offline')));
    let finish!: () => void;
    const loader = vi.spyOn(regionalElevation, 'createRegionalElevation').mockImplementation((_metadata, _surfaces, _tiles, onReady) => {
      finish = onReady;
      return {sample: () => undefined, load: async () => {}, status: 'ready', dispose: () => {}};
    });
    const states: BasemapState[] = [];
    const basemap = createRegionalBasemap(metadata, new THREE.Matrix4(), state => states.push(state), 1, undefined, [{metadata,grid:new Float32Array()}]);
    try {
      basemap.setOptions(true, 'satellite');
      await vi.waitFor(() => expect(states.at(-1)?.status).toBe('error'));
      finish(); expect(states.at(-1)).toMatchObject({status:'error',relief:'ready'});
    } finally {basemap.dispose();loader.mockRestore();vi.unstubAllGlobals();}
  });
  it('replaces imagery only with a complete level, retains it through partial detail and respects visibility', () => {
    const context = {save: vi.fn(), translate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), restore: vi.fn()};
    vi.stubGlobal('document', {createElement: () => ({width: 0, height: 0, getContext: () => context, setAttribute: vi.fn(), remove: vi.fn()})});
    const root = new THREE.Group();
    const source = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial()); root.add(source);
    const imagery = createTerrainImagery(metadata, root, [source], 19, 4)!;
    const levels = planImageryAtlases(metadata, 19);
    expect(levels.length).toBe(3);
    const tiles = (level: typeof levels[number]) => {
      const result = [];
      for (let x = level.minX; x < level.maxX; x++) for (let y = level.minY; y < level.maxY; y++) result.push({x, y, z: level.zoom});
      return result;
    };
    const paint = (tile: {x: number; y: number; z: number}) => imagery.tile(tile, {} as ImageBitmap);
    const material = (imagery.group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>).material;
    try {
      imagery.setVisible(true);
      const coarse = tiles(levels[0]); coarse.slice(0, -1).forEach(paint);
      expect(imagery.group.visible).toBe(false); expect(material.map).toBeNull();
      paint(coarse.at(-1)!);
      expect(imagery.group.visible).toBe(true); const previous = material.map;
      const detail = tiles(levels.at(-1)!); detail.slice(0, -1).forEach(paint);
      expect(material.map).toBe(previous);
      imagery.setVisible(false); paint(detail.at(-1)!);
      expect(material.map).not.toBe(previous); expect(imagery.group.visible).toBe(false);
      imagery.setVisible(true); expect(imagery.group.visible).toBe(true);
      coarse.forEach(paint); expect(material.map).not.toBe(previous);
    } finally { imagery.dispose(); source.geometry.dispose(); source.material.dispose(); vi.unstubAllGlobals(); }
  });
  it('shares a completed view image without disposing the controller-owned texture', () => {
    vi.stubGlobal('document', {createElement:()=>({width:0,height:0,getContext:()=>null})});
    const root=new THREE.Group(),source=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshStandardMaterial());root.add(source);
    const imagery=createTerrainImagery(metadata,root,[source],19,4)!;
    const bounds=planImageryAtlases(metadata,19)[0],texture=new THREE.CanvasTexture(document.createElement('canvas'));
    const dispose=vi.spyOn(texture,'dispose');
    try {
      imagery.setVisible(true);imagery.setDetail({...bounds,texture,dispose:()=>texture.dispose()});
      const detail=root.getObjectByName('terrain-detail-imagery')!;
      expect(detail.visible).toBe(true);
      imagery.setVisible(false);expect(detail.visible).toBe(false);
      imagery.setVisible(true);expect(detail.visible).toBe(true);
      imagery.setDetail(null);expect(detail.visible).toBe(false);expect(dispose).not.toHaveBeenCalled();
    } finally {imagery.dispose();source.geometry.dispose();source.material.dispose();texture.dispose();vi.unstubAllGlobals();}
  });
  it('reuses prepared stop geometry through page switches and releases it before source canvases are cleared',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>null})});
    const root=new THREE.Group(),source=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshStandardMaterial());root.add(source);
    const imagery=createTerrainImagery(metadata,root,[source],19,4)!;
    const bounds=planImageryAtlases(metadata,19)[0];
    const a={...bounds,texture:new THREE.CanvasTexture(document.createElement('canvas')),dispose:vi.fn()};
    const b={...bounds,texture:new THREE.CanvasTexture(document.createElement('canvas')),dispose:vi.fn()};
    try{
      imagery.setVisible(true);const texture=imagery.primeDetail(a)!;imagery.primeDetail(b);
      const dispose=vi.spyOn(texture,'dispose');imagery.setDetail(a);
      const group=root.getObjectByName('terrain-detail-imagery')!,patch=group.children[0];
      imagery.setDetail(b);imagery.setDetail(a);
      expect(group.children[0]).toBe(patch);expect(dispose).not.toHaveBeenCalled();
      imagery.primeDetail(null);expect(dispose).toHaveBeenCalledOnce();expect(group.children).toHaveLength(0);
      expect(a.dispose).not.toHaveBeenCalled();expect(b.dispose).not.toHaveBeenCalled();
    }finally{imagery.dispose();source.geometry.dispose();source.material.dispose();a.texture.dispose();b.texture.dispose();vi.unstubAllGlobals();}
  });
  it('stops requesting tiles when the service is unavailable', async () => {
    vi.stubGlobal('window', globalThis);
    const fetchMock = vi.fn(async () => { throw new Error('offline'); });
    vi.stubGlobal('fetch', fetchMock);
    const states: BasemapState[] = [];
    const basemap = createRegionalBasemap(metadata, new THREE.Matrix4(), state => states.push(state));
    try {
      basemap.setOptions(true, 'satellite');
      await vi.waitFor(() => expect(states.at(-1)?.status).toBe('error'), { timeout: 1000 });
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4);
      expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(7);
    } finally {
      basemap.dispose();
      vi.unstubAllGlobals();
    }
  });
});
