import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { LoadedModel, TerrainMetadata } from '../types/terrain';
import { buildContours, contourSteps, createContourBudget, validateContourInterval } from './contours';
import { createGeographicPlacements } from './geographic';
import { pixelToProjected, projectedToScene, sceneToProjected } from './coordinate';

const metadata: TerrainMetadata = {
  schema_version: 1, asset_id: 'test', analysis_supported: true,
  crs: { authority: 'EPSG', code: 32648, linear_unit: 'metre' },
  scene_axes: { x: 'east', y: 'up', z: 'negative_north' },
  world_origin: { x: 100, y: 200 },
  grid: { file: 'test.grid.bin', shape: [2, 2], shape_order: 'rows_cols', dtype: 'float32', byte_order: 'little_endian', layout: 'row_major', nodata_encoding: 'nan', elevation_unit: 'metre', sampling_method: 'nearest_subsample', source_step: 1, byte_length: 16 },
  grid_transform: { a: 8, b: 2, c: 100, d: 3, e: -6, f: 200, convention: 'rasterio_affine', pixel_reference: 'center' },
  elevation: { base_elevation: 7, exaggeration: 3, normalize_base: true, min: 3, max: 43 },
};
function generate(values: number[], interval: number, meta = metadata, budget = createContourBudget()): Float32Array {
  const steps = contourSteps(new Float32Array(values), meta, interval, budget);
  let result = steps.next();
  while (!result.done) result = steps.next();
  return result.value;
}

describe('DEM elevation contours', () => {
  it.each([10, 20, 40, 12.5])('uses true absolute elevation multiples of %s metres and affine pixel centres', (interval) => {
    const positions = generate([3, 43, 3, 43], interval);
    const levels = new Set<number>();
    for (let i = 0; i < positions.length; i += 3) {
      const point = sceneToProjected(metadata, { x: positions[i], y: positions[i + 1], z: positions[i + 2] });
      const elevation = point.elevation;
      expect(elevation / interval).toBeCloseTo(Math.round(elevation / interval));
      levels.add(elevation);
      const expected = projectedToScene(metadata, pixelToProjected(metadata, (elevation - 3) / 40, (point.projected.y - 200 - 3 * ((elevation - 3) / 40 + 0.5)) / -6 - 0.5), elevation);
      expect(positions[i]).toBeCloseTo(expected.x);
    }
    expect([...levels]).toEqual(Array.from({ length: Math.floor(43 / interval) }, (_, i) => (i + 1) * interval));
  });
  it.each([NaN, Infinity, -Infinity])('does not bridge cells containing nodata %s', (nodata) => {
    expect(generate([0, 30, nodata, 30], 10)).toHaveLength(0);
  });
  it('resolves a saddle using the same NE–SW diagonal as the exporter', () => {
    const positions = generate([0, 20, 20, 0], 10);
    const level10 = [];
    for (let i = 0; i < positions.length; i += 6) if (positions[i + 1] === 9) level10.push(Array.from(positions.slice(i, i + 6)));
    const scene = (c: number, r: number) => {
      const p = projectedToScene(metadata, pixelToProjected(metadata, c, r), 10);
      return [p.x, p.y, p.z];
    };
    expect(level10).toEqual([[...scene(0, 0.5), ...scene(0.5, 0)], [...scene(0.5, 1), ...scene(1, 0.5)]]);
    expect(generate([0, 20, 20, 0], 10)).toEqual(positions);
  });
  it('handles negative and zero absolute elevations', () => {
    const positions = generate([-15, 15, -15, 15], 10);
    const levels = new Set<number>();
    for (let i = 1; i < positions.length; i += 3) levels.add(positions[i] / 3 + 7);
    expect([...levels]).toEqual([-10, 0, 10]);
  });
  it('joins typed coordinate chunks without losing segments', () => {
    const meta = { ...metadata, grid: { ...metadata.grid, shape: [2, 2000] as [number, number] } };
    const positions = generate(Array.from({ length: 4000 }, (_, i) => i % 2 ? 50 : 0), 10, meta);
    expect(positions.length).toBeGreaterThan(65_532);
    expect(positions.length % 6).toBe(0);
    expect(Array.from(positions).every(Number.isFinite)).toBe(true);
    for (let i = 1; i < positions.length; i += 3) expect((positions[i] / 3 + 7) % 10).toBe(0);
  });
  it('rejects grid shape/buffer mismatches', () => {
    expect(() => generate([0, 30], 10)).toThrow(/không hợp lệ/);
  });
  it('skips flat triangles and zero-length intersections at exact-level vertices', () => {
    expect(generate([10, 10, 10, 10], 10)).toHaveLength(0);
    const positions = generate([0, 10, 10, 20], 10);
    for (let i = 0; i < positions.length; i += 6) expect(Array.from(positions.slice(i, i + 3))).not.toEqual(Array.from(positions.slice(i + 3, i + 6)));
  });
  it.each([0, -10, NaN, Infinity])('rejects invalid interval %s', (interval) => {
    expect(() => validateContourInterval(interval)).toThrow(/lớn hơn 0/);
  });
  it('bounds tiny intervals, large grids, segments and aggregate work without truncation', () => {
    expect(() => generate([0, 30, 0, 30], 1e-10)).toThrow(/quá nhỏ/);
    expect(() => generate([0, 30, 0, 30], 10, metadata, { ...createContourBudget(), cells: 0 })).toThrow(/quá lớn/);
    expect(() => generate([0, 30, 0, 30], 10, metadata, { ...createContourBudget(), segments: 0 })).toThrow(/đoạn đồng mức/);
    expect(() => generate([0, 30, 0, 30], 10, metadata, { ...createContourBudget(), work: 0 })).toThrow(/phép tính/);
  });
  it('cancels stale async computations before and during generation', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(buildContours(new Float32Array([0, 30, 0, 30]), metadata, 10, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    const second = new AbortController();
    const promise = buildContours(new Float32Array(4096).fill(20), { ...metadata, grid: { ...metadata.grid, shape: [64, 64] } }, 10, second.signal);
    second.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('aligns contour endpoints across merged origins, bases and exaggerations', () => {
    const other = { ...metadata, world_origin: { x: 120, y: 180 }, elevation: { ...metadata.elevation, base_elevation: 2, exaggeration: 6 } };
    const models = [metadata, other].map((meta, i) => ({ id: String(i), metadata: meta }) as LoadedModel);
    const placements = createGeographicPlacements(models);
    const a = generate([3, 43, 3, 43], 10);
    const b = generate([3, 43, 3, 43], 10, other);
    const group = new THREE.Group();
    const { x, y, z } = placements[1].position;
    group.position.set(x, y, z);
    group.scale.y = placements[1].scaleY;
    group.updateMatrixWorld();
    for (let i = 0; i < a.length; i += 3) {
      const world = group.localToWorld(new THREE.Vector3(b[i], b[i + 1], b[i + 2]));
      expect(world.x).toBeCloseTo(a[i], 4);
      expect(world.y).toBeCloseTo(a[i + 1], 4);
      expect(world.z).toBeCloseTo(a[i + 2], 4);
    }
  });
});
