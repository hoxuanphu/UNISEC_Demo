import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createSarOverlay, sarPixels, sarUv } from './sarOverlay';
import type { TerrainMetadata } from '../types/terrain';

const metadata = {
  crs: { authority: 'EPSG', code: 4326 }, world_origin: { x: 10, y: 22 },
  elevation: { base_elevation: 100, exaggeration: 2 },
} as TerrainMetadata;
const raster = {
  name: 'sar', width: 2, height: 2, bands: [{ index: 0, label: 'VV' }],
  crs: 'EPSG:4326', bbox: [10, 20, 12, 22] as [number, number, number, number],
  readBand: async () => new Float32Array([1, 2, 3, 4]),
};

it('stretches valid samples to grayscale without modifying raw data', () => {
  const raw = new Float32Array([-9999, 1, 2, 3, NaN, Infinity]);
  const before = raw.slice();
  const { data, low, high } = sarPixels(raw, -9999);
  expect([low, high]).toEqual([1, 3]);
  expect(Array.from(data.slice(0, 4))).toEqual([0, 0, 0, 0]);
  expect(Array.from(data.slice(8, 12))).toEqual([128, 128, 128, 255]);
  expect(data[19]).toBe(0);
  expect(raw).toEqual(before);
});

it('uses terrain origin and north-down raster coordinates, including rotated transforms', () => {
  expect(sarUv(raster, metadata, new THREE.Vector3(0.5, 20, 0.5))).toEqual([0.25, 0.25]);
  const rotated = { ...raster, transform: { a: 0, b: 1, c: 10, d: -1, e: 0, f: 22 } };
  expect(sarUv(rotated, metadata, new THREE.Vector3(1.5, 0, 0.5))).toEqual([0.25, 0.75]);
  expect(() => sarUv({ ...raster, crs: undefined }, metadata, new THREE.Vector3())).toThrow('CRS');
});

it('resolves UTM raster CRS rather than assuming degrees', () => {
  const utm = { ...raster, crs: 'EPSG:32648', bbox: [400000, 2000000, 600000, 3000000] as typeof raster.bbox };
  const terrain = { ...metadata, world_origin: { x: 105, y: 22 } };
  expect(sarUv(utm, terrain, new THREE.Vector3())[0]).toBeCloseTo(0.5);
});

it('shades existing triangles for all models and restores arrays, geometry and tile hooks after draws', async () => {
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0.5, 20, 0.5, 1.5, 20, 0.5, 0.5, 20, 1.5], 3));
  const hook = vi.fn((shader) => { shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', 'tile-detail;'); });
  const original = [new THREE.MeshStandardMaterial(), new THREE.MeshBasicMaterial()];
  original[0].onBeforeCompile = hook;
  const root = new THREE.Group(); root.position.set(1000, 0, 2000);
  const mesh = new THREE.Mesh(geometry, original); mesh.position.x = 0.25; root.add(mesh);
  const other = new THREE.Mesh(geometry, original[1]);
  const surface = await createSarOverlay(raster, 0, [{ root, metadata }, { root: other, metadata }]);
  expect(root.children).toHaveLength(1);
  const disposals: { mock: { calls: unknown[] } }[] = [];
  surface.render(true, true, 0.65, () => {
    expect(mesh.geometry.getAttribute('position').array).toEqual(geometry.getAttribute('position').array);
    expect(mesh.geometry.getAttribute('sarUv').getX(0)).toBeCloseTo(0.375);
    expect(other.material).not.toBe(original[1]);
    const shader = { uniforms: {} as Record<string, { value: any }>, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>\n#include <map_fragment>\n#include <alphamap_fragment>' };
    (mesh.material as THREE.Material[])[0].onBeforeCompile(shader as any, {} as any);
    expect(hook).toHaveBeenCalled();
    expect(shader.fragmentShader.indexOf('tile-detail')).toBeLessThan(shader.fragmentShader.indexOf('sarSample'));
    expect(shader.uniforms.sarOpacity.value).toBe(0.65);
    disposals.push(vi.spyOn(shader.uniforms.sarMap.value, 'dispose'), vi.spyOn(mesh.geometry, 'dispose'), vi.spyOn((mesh.material as THREE.Material[])[0], 'dispose'));
  });
  expect(mesh.material).toBe(original); expect(mesh.geometry).toBe(geometry);
  expect(() => surface.render(false, false, 1, () => {
    expect((mesh.material as THREE.MeshStandardMaterial[])[0].map).toBeNull();
    const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <alphamap_fragment>' };
    (mesh.material as THREE.Material[])[0].onBeforeCompile(shader as any, {} as any);
    expect(shader.uniforms.sarOpacity.value).toBe(0);
    expect(shader.fragmentShader).toContain('sarSample.a * sarOpacity');
    expect(shader.fragmentShader).toContain('vSarUv.x >= 0.0');
    throw new Error('draw failed');
  })).toThrow('draw failed');
  expect(mesh.material).toBe(original); expect(mesh.geometry).toBe(geometry);
  surface.dispose(); surface.dispose();
  disposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
});
