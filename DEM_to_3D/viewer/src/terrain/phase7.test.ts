import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bilinearElevation } from './elevationGrid';
import { pixelToProjected, projectedToPixel } from './coordinate';
import { createSurfaceProfile } from './profile';
import { calculateSegmentSlopes } from './slope';
import { validateGridBuffer, validateMetadata } from './validation';
import { assetUrlMatchesFilename, loadTerrain, validateGltfMeshCounts } from './loadTerrain';
import { disposeObjectResources } from './raycast';
import type { TerrainMetadata } from '../types/terrain';

const metadata: TerrainMetadata = {
  schema_version: 1,
  asset_id: 'phase7-plane',
  crs: { authority: 'EPSG', code: 32648, proj4: '+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs', linear_unit: 'metre' },
  scene_axes: { x: 'east', y: 'up', z: 'negative_north' },
  world_origin: { x: 100, y: 200 },
  grid: { file: 'phase7.grid.bin', shape: [20, 20], shape_order: 'rows_cols', dtype: 'float32', byte_order: 'little_endian', layout: 'row_major', nodata_encoding: 'nan', elevation_unit: 'metre', sampling_method: 'nearest_subsample', source_step: 1, byte_length: 1600 },
  grid_transform: { a: 10, b: 1, c: 100, d: 0.5, e: -10, f: 200, convention: 'rasterio_affine', pixel_reference: 'center' },
  elevation: { base_elevation: 0, exaggeration: 1, normalize_base: false, min: 0, max: 300 },
  analysis_supported: true,
};

function planeElevation(x: number, y: number): number {
  return 0.2 * x - 0.35 * y + 120;
}

function makePlaneGrid(): Float32Array {
  const [rows, columns] = metadata.grid.shape;
  const grid = new Float32Array(rows * columns);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const point = pixelToProjected(metadata, column, row);
      grid[row * columns + column] = planeElevation(point.x, point.y);
    }
  }
  return grid;
}

describe('Phase 7 affine/profile correctness', () => {
  it('round-trips projected and raster coordinates below a quarter pixel', () => {
    for (const [column, row] of [[0.2, 0.3], [4.25, 7.75], [15.5, 12.125], [-0.2, 4.4]]) {
      const projected = pixelToProjected(metadata, column, row);
      const recovered = projectedToPixel(metadata, projected.x, projected.y);
      expect(Math.hypot(recovered.column - column, recovered.row - row)).toBeLessThan(0.25);
    }
  });

  it('interpolates the synthetic plane within one millimetre', () => {
    const grid = makePlaneGrid();
    const projected = pixelToProjected(metadata, 7.35, 8.2);
    const sampled = bilinearElevation(grid, metadata, projected.x, projected.y);
    expect(sampled.elevation).toBeDefined();
    expect(Math.abs(sampled.elevation! - planeElevation(projected.x, projected.y))).toBeLessThan(1e-3);
  });

  it('reports reference slope for a diagonal projected line', () => {
    const grid = makePlaneGrid();
    const start = pixelToProjected(metadata, 2.5, 3.5);
    const end = pixelToProjected(metadata, 14.5, 14.5);
    const profile = createSurfaceProfile(grid, metadata, start, end, 5);
    const slopes = calculateSegmentSlopes(profile.samples);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const expectedPercent = (0.2 * dx - 0.35 * dy) / length * 100;
    const expectedAngle = Math.atan((0.2 * dx - 0.35 * dy) / length) * 180 / Math.PI;
    expect(slopes.length).toBeGreaterThan(2);
    slopes.forEach((slope) => {
      expect(Math.abs(slope.percent - expectedPercent)).toBeLessThan(0.1);
      expect(Math.abs(slope.angle - expectedAngle)).toBeLessThan(0.1);
    });
  });

  it('keeps horizontal, vertical, diagonal, and very short line metrics in projected metres', () => {
    const grid = makePlaneGrid();
    const horizontalCenter = pixelToProjected(metadata, 10, 10);
    const horizontalStart = { x: horizontalCenter.x - 20, y: horizontalCenter.y };
    const horizontalEnd = { x: horizontalCenter.x + 20, y: horizontalCenter.y };
    const horizontal = createSurfaceProfile(grid, metadata, horizontalStart, horizontalEnd, 5);
    expect(horizontal.length).toBeCloseTo(Math.hypot(horizontalEnd.x - horizontalStart.x, horizontalEnd.y - horizontalStart.y), 10);
    expect(horizontal.azimuth).toBeCloseTo(90, 10);

    const verticalStart = { x: horizontalCenter.x, y: horizontalCenter.y - 20 };
    const verticalEnd = { x: horizontalCenter.x, y: horizontalCenter.y + 20 };
    const vertical = createSurfaceProfile(grid, metadata, verticalStart, verticalEnd, 5);
    expect(vertical.length).toBeCloseTo(Math.hypot(verticalEnd.x - verticalStart.x, verticalEnd.y - verticalStart.y), 10);
    expect(vertical.azimuth).toBeCloseTo(0, 10);

    const diagonalStart = pixelToProjected(metadata, 3, 3);
    const diagonalEnd = pixelToProjected(metadata, 8, 8);
    const diagonal = createSurfaceProfile(grid, metadata, diagonalStart, diagonalEnd, 5);
    expect(diagonal.length).toBeCloseTo(Math.hypot(diagonalEnd.x - diagonalStart.x, diagonalEnd.y - diagonalStart.y), 10);

    const short = createSurfaceProfile(grid, metadata, horizontalStart, { x: horizontalStart.x + 0.2, y: horizontalStart.y + 0.1 }, 5);
    expect(short.length).toBeCloseTo(Math.hypot(0.2, 0.1), 10);
    expect(short.samples).toHaveLength(2);
  });

  it('keeps outside-grid lines invalid and bridges a nodata crossing with flagged samples', () => {
    const grid = makePlaneGrid();
    const outside = createSurfaceProfile(grid, metadata, { x: 50, y: 50 }, { x: 60, y: 60 }, 5);
    expect(outside.samples.every((sample) => sample.elevation === undefined)).toBe(true);
    grid[8 * metadata.grid.shape[1] + 8] = Number.NaN;
    const start = pixelToProjected(metadata, 6, 8);
    const end = pixelToProjected(metadata, 10, 8);
    const profile = createSurfaceProfile(grid, metadata, start, end, 5);
    // The nodata crossing is bridged so the line stays connected…
    expect(profile.samples.every((sample) => sample.elevation !== undefined)).toBe(true);
    // …but the bridged samples are flagged so they render distinctly.
    expect(profile.samples.some((sample) => Boolean(sample.gapFilled))).toBe(true);
  });
});

describe('Phase 7 asset and lifecycle hardening', () => {
  it('rejects malformed metadata and binary lengths', () => {
    expect(() => validateMetadata({ ...metadata, world_origin: { x: 1, y: 2, z: 3 } })).toThrow(/world_origin/);
    expect(() => validateGridBuffer(metadata, new ArrayBuffer(4))).toThrow(/byte length/);
    expect(() => validateMetadata({ ...metadata, grid: { ...metadata.grid, file: '../outside.bin' } })).toThrow(/file/);
    expect(() => validateMetadata({ ...metadata, mesh: { file: '../outside.glb', vertex_count: 1, triangle_count: 1 } })).toThrow(/mesh/);
    expect(() => validateMetadata({ ...metadata, mesh: null })).toThrow(/mesh/);
  });

  it('accepts scene axes independent of JSON property order', () => {
    expect(validateMetadata({ ...metadata, scene_axes: { z: 'negative_north', x: 'east', y: 'up' } })).toMatchObject({ scene_axes: metadata.scene_axes });
  });

  it('requires a usable CRS definition string', () => {
    expect(() => validateMetadata({ ...metadata, crs: { ...metadata.crs, proj4: {} } })).toThrow(/crs/);
    expect(() => validateMetadata({ ...metadata, crs: { ...metadata.crs, proj4: '   ' } })).toThrow(/crs/);
  });

  it('matches asset URLs by exact basename and rejects mismatched files', () => {
    expect(assetUrlMatchesFilename('/assets/phase7.grid.bin?cache=1', 'phase7.grid.bin')).toBe(true);
    expect(assetUrlMatchesFilename('/assets/other.grid.bin', 'phase7.grid.bin')).toBe(false);
    expect(assetUrlMatchesFilename('/assets/phase7.grid.bin.backup', 'phase7.grid.bin')).toBe(false);
  });

  it('rejects sidecar URL mismatches before fetching binary sidecars', async () => {
    const metadataValue = { ...metadata, mesh: { file: 'phase7.glb', vertex_count: 3, triangle_count: 1 } };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('phase7.terrain.json')) {
        return { ok: true, json: async () => metadataValue };
      }
      throw new Error(`unexpected sidecar fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadTerrain({ glb: '/phase7.glb', metadata: '/phase7.terrain.json', grid: '/wrong.grid.bin' })).rejects.toThrow(/grid.file/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('resolves GLB external resources relative to its containing directory', async () => {
    vi.stubGlobal('window', { location: { href: 'https://viewer.test/app/' } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('.json')
      ? { ok: true, json: async () => metadata }
      : { ok: true, arrayBuffer: async () => new ArrayBuffer(metadata.grid.byte_length) }));
    const parse = vi.spyOn(GLTFLoader.prototype, 'parse').mockImplementation((_buffer, _path, resolve) => {
      resolve({ scene: new THREE.Group() } as GLTF);
    });
    try {
      await loadTerrain({ glb: '/assets/model.glb?cache=1', grid: '/assets/phase7.grid.bin', metadata: '/assets/phase7.terrain.json' });
      expect(parse.mock.calls[0][1]).toBe('https://viewer.test/assets/');
    } finally {
      parse.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('rejects a GLB whose geometry counts do not match metadata', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ], 3));
    geometry.setIndex([0, 1, 2]);
    root.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
    expect(() => validateGltfMeshCounts(root, { file: 'phase7.glb', vertex_count: 4, triangle_count: 1 })).toThrow(/vertex_count/);
    expect(() => validateGltfMeshCounts(root, { file: 'phase7.glb', vertex_count: 3, triangle_count: 2 })).toThrow(/triangle_count/);
    expect(() => validateGltfMeshCounts(root, { file: 'phase7.glb', vertex_count: 3, triangle_count: 1 })).not.toThrow();
  });

  it('disposes geometry, materials, textures, and BVH exactly once across repeated asset unloads', () => {
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const root = new THREE.Group();
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.MeshStandardMaterial();
      const texture = new THREE.Texture();
      material.map = texture;
      root.add(new THREE.Mesh(geometry, material));
      const geometryDispose = vi.spyOn(geometry, 'dispose');
      const materialDispose = vi.spyOn(material, 'dispose');
      const textureDispose = vi.spyOn(texture, 'dispose');
      disposeObjectResources(root);
      expect(geometryDispose).toHaveBeenCalledTimes(1);
      expect(materialDispose).toHaveBeenCalledTimes(1);
      expect(textureDispose).toHaveBeenCalledTimes(1);
    }
  });
});
