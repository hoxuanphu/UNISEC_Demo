import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createGeoOverlay, imageMode, imagePixels, rasterDisplaySize, readSarRaster, sarUv, triangleIntersectsRaster, type SarRaster } from './sarOverlay';
import type { TerrainMetadata } from '../types/terrain';
import { fromBlob } from 'geotiff';
vi.mock('geotiff', async (importOriginal) => ({ ...await importOriginal<typeof import('geotiff')>(), fromBlob: vi.fn() }));

const metadata = { crs: { authority: 'EPSG', code: 4326 }, world_origin: { x: 10, y: 22 }, elevation: { base_elevation: 0, exaggeration: 1 } } as TerrainMetadata;
function raster(samples: number[][], extras: Partial<SarRaster> = {}): SarRaster {
  return { name: 'image', width: samples[0].length, height: 1, bands: samples.map((_, index) => ({ index, label: `Band ${index}` })), crs: 'EPSG:4326', bbox: [10, 20, 12, 22], photometric: 1, bits: [8], sampleFormat: [1], readBand: async (i) => samples[i], ...extras };
}

it('detects actual photometric RGB, never two-band SAR as RGB', () => {
  expect(imageMode(raster([[1], [2]], { photometric: 1 }))).toBe('gray');
  expect(() => imageMode(raster([[1], [2]], { photometric: 2 }))).toThrow();
  expect(imageMode(raster([[1], [2], [3]], { photometric: 2 }))).toBe('rgb');
  expect(() => imageMode(raster([[1]], { photometric: 3 }))).toThrow('palette');
});

it('stretches only valid grayscale samples and honors WhiteIsZero', async () => {
  const source = [[-9999, 10, 20, 30, NaN]];
  const pixels = await imagePixels(raster(source, { nodata: -9999 }));
  expect([pixels.low, pixels.high]).toEqual([10, 30]);
  expect(Array.from(pixels.data)).toEqual([0, 0, 0, 0, 0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255, 0, 0, 0, 0]);
  const white = await imagePixels(raster([[10, 30]], { photometric: 0 }));
  expect(Array.from(white.data)).toEqual([255, 255, 255, 255, 0, 0, 0, 255]);
  expect(source[0][1]).toBe(10);
});

it('uses RGB channels and declared bit range, not per-channel contrast stretching', async () => {
  const rgb = await imagePixels(raster([[255, 128], [0, 64], [32, 255]], { photometric: 2 }));
  expect(Array.from(rgb.data)).toEqual([255, 0, 32, 255, 128, 64, 255, 255]);
  const sixteen = await imagePixels(raster([[65535], [32768], [0]], { photometric: 2, bits: [16, 16, 16] }));
  expect(Array.from(sixteen.data)).toEqual([255, 128, 0, 255]);
  await expect(imagePixels(raster([[0.1], [0.2], [0.3]], { photometric: 2, sampleFormat: [3], bits: [32] }))).rejects.toThrow('scale');
});

it('makes RGB nodata and nonfinite samples transparent, honors alpha and unassociates RGB', async () => {
  const pixels = await imagePixels(raster([[255, -1, NaN, 255], [100, 2, 3, 100], [50, 2, 3, 50], [128, 255, 255, 0]], { photometric: 2, nodata: -1, extraSamples: [2] }));
  expect(Array.from(pixels.data.slice(0, 4))).toEqual([255, 100, 50, 128]);
  expect([pixels.data[7], pixels.data[11], pixels.data[15]]).toEqual([0, 0, 0]);
  const associated = await imagePixels(raster([[64], [32], [0], [128]], { photometric: 2, extraSamples: [1] }));
  expect(Array.from(associated.data)).toEqual([128, 64, 0, 128]);
});

it('excludes transparent grayscale samples from percentile scaling', async () => {
  const pixels = await imagePixels(raster([[10000, 10, 30], [0, 255, 255]], { extraSamples: [2] }));
  expect([pixels.low, pixels.high]).toEqual([10, 30]);
  expect(pixels.data[3]).toBe(0);
});

it('bounds texture memory while preserving aspect ratio', () => {
  expect(rasterDisplaySize(8000, 4000)).toEqual([2048, 1024]);
  expect(rasterDisplaySize(2, 1)).toEqual([2, 1]);
});

it('detects triangle intersections even if no vertex lies inside the image', () => {
  expect(triangleIntersectsRaster([[-10, -10], [10, -10], [0, 10]])).toBe(true);
  expect(triangleIntersectsRaster([[2, 2], [3, 2], [2, 3]])).toBe(false);
  expect(triangleIntersectsRaster([[1, 0], [2, 0], [1, 1]])).toBe(false);
});

it('composes image above SAR, retains tile hooks, independent opacity and restores resources', async () => {
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 2, 0, 0, 0, 0, 2], 3));
  const material = new THREE.MeshStandardMaterial();
  material.onBeforeCompile = (shader) => { shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', 'tileDetail;'); };
  const mesh = new THREE.Mesh(geometry, material);
  const child = new THREE.Group(); child.position.x = 0.25; child.add(mesh);
  const root = new THREE.Group(); root.position.set(1000, 10, 2000); root.add(child);
  const image = raster([[255], [0], [0]], { photometric: 2 });
  const sar = raster([[10]]);
  const surface = await createGeoOverlay([{ raster: sar, band: 0, kind: 'sar' }, { raster: image, band: 0, kind: 'image' }], [{ root, metadata }]);
  expect(surface.status).toBeNull();
  const disposeSpies: { mock: { calls: unknown[] } }[] = [];
  surface.renderLayers(true, [{ visible: false, opacity: 1 }, { visible: true, opacity: 0.4 }], () => {
    const shader = { uniforms: {} as Record<string, { value: any }>, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <map_fragment>\n#include <alphamap_fragment>' };
    (mesh.material as THREE.Material).onBeforeCompile(shader as any, {} as any);
    expect(shader.uniforms.sarOpacity.value).toBe(0);
    expect(shader.uniforms.geo1Opacity.value).toBe(0.4);
    expect(shader.fragmentShader.indexOf('tileDetail')).toBeLessThan(shader.fragmentShader.indexOf('sarSample'));
    expect(shader.fragmentShader.indexOf('sarSample')).toBeLessThan(shader.fragmentShader.indexOf('geo1Sample'));
    expect(shader.fragmentShader).toContain('vGeo1Uv.x >= 0.0 && vGeo1Uv.x <= 1.0');
    expect(mesh.geometry.getAttribute('geo1Uv').getX(0)).toBeCloseTo(0.125);
    disposeSpies.push(vi.spyOn(shader.uniforms.geo1Map.value, 'dispose'), vi.spyOn(mesh.geometry, 'dispose'));
  });
  expect(mesh.geometry).toBe(geometry); expect(mesh.material).toBe(material);
  surface.renderLayers(false, [{ visible: true, opacity: 0.5 }, { visible: false, opacity: 1 }], () => {
    expect((mesh.material as THREE.MeshStandardMaterial).map).toBeNull();
  });
  surface.dispose(); surface.dispose();
  disposeSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
});

it('composes four ordered RGB images above SAR with independent controls and isolated failures', async () => {
  const root = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 2, 0, 0, 0, 0, 2], 3)), new THREE.MeshStandardMaterial());
  const image = raster([[255], [128], [0]], { photometric: 2 });
  const bad = { ...image, readBand: async () => { throw new Error('broken RGB'); } };
  const surface = await createGeoOverlay([
    { raster: raster([[10]]), band: 0, kind: 'sar' },
    ...[image, bad, image, image].map((item) => ({ raster: item, band: 0, kind: 'image' as const })),
  ], [{ root, metadata }]);
  expect(surface.layerStatus).toEqual([null, null, 'broken RGB', null, null]);
  const originalGeometry = root.geometry, originalMaterial = root.material;
  const disposals: ReturnType<typeof vi.spyOn>[] = [];
  surface.renderLayers(true, [
    { visible: true, opacity: 0.65 }, { visible: true, opacity: 0.2 }, { visible: true, opacity: 1 },
    { visible: false, opacity: 0.8 }, { visible: true, opacity: 0.9 },
  ], () => {
    const shader = { uniforms: {} as Record<string, { value: any }>, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <alphamap_fragment>' };
    (root.material as THREE.Material).onBeforeCompile(shader as any, {} as any);
    expect(['sar', 'geo1', 'geo2', 'geo3', 'geo4'].map((name) => shader.uniforms[`${name}Opacity`].value)).toEqual([0.65, 0.2, 0, 0, 0.9]);
    const names = ['sar', 'geo1', 'geo2', 'geo3', 'geo4'];
    for (const [index, name] of names.entries()) {
      expect(root.geometry.getAttribute(`${name}Uv`)).toBeDefined();
      disposals.push(vi.spyOn(shader.uniforms[`${name}Map`].value, 'dispose'));
      if (index) expect(shader.fragmentShader.indexOf(`${names[index - 1]}Sample`)).toBeLessThan(shader.fragmentShader.indexOf(`${name}Sample`));
    }
  });
  expect(root.geometry).toBe(originalGeometry); expect(root.material).toBe(originalMaterial);
  surface.dispose(); surface.dispose();
  disposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  originalGeometry.dispose(); originalMaterial.dispose();
});

it('reports no overlap and isolates a failed image from working SAR', async () => {
  const root = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 2, 0, 0, 0, 0, 2], 3)), new THREE.MeshStandardMaterial());
  const outside = raster([[1]], { bbox: [100, 100, 101, 101] });
  const bad = raster([[1]], { readBand: async () => { throw new Error('bad image'); } });
  const surface = await createGeoOverlay([{ raster: outside, band: 0, kind: 'sar' }, { raster: bad, band: 0, kind: 'image' }], [{ root, metadata }]);
  expect(surface.layerStatus[0]).toContain('Không giao');
  expect(surface.layerStatus[1]).toBe('bad image');
  surface.renderLayers(true, [{ visible: true, opacity: 1 }, { visible: true, opacity: 1 }], () => {
    const shader = { uniforms: {} as Record<string, { value: any }>, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <alphamap_fragment>' };
    (root.material as THREE.Material).onBeforeCompile(shader as any, {} as any);
    expect(shader.uniforms.geo1Opacity.value).toBe(0);
  });
  surface.dispose();
});

it('does not decode stale requests', async () => {
  const readBand = vi.fn();
  await expect(createGeoOverlay([{ raster: raster([[1]], { readBand }), band: 0, kind: 'image' }], [], () => true)).rejects.toThrow('cancelled');
  expect(readBand).not.toHaveBeenCalled();
});

it('reads v3 metadata and rotated PixelIsPoint affine without axis-aligned origin methods', async () => {
  const fields: Record<string, unknown> = { ModelTransformation: [0, 2, 0, 10, -3, 0, 0, 22], PhotometricInterpretation: 1, BitsPerSample: [16], SampleFormat: [1] };
  const image = { getFileDirectory: () => ({ getValue: (key: string) => fields[key] }), getGeoKeys: () => ({ GeographicTypeGeoKey: 4326, GTRasterTypeGeoKey: 2 }), getWidth: () => 2, getHeight: () => 2, getSamplesPerPixel: () => 1, readRasters: vi.fn(async () => [new Uint16Array(4)]) };
  const spy = vi.mocked(fromBlob).mockResolvedValue({ getImage: async () => image } as any);
  try {
    const loaded = await readSarRaster({ name: 'point.tif' } as File);
    expect(loaded.transform).toEqual({ a: 0, b: 2, c: 9, d: -3, e: 0, f: 23.5 });
    expect(loaded.photometric).toBe(1);
    expect(sarUv(loaded, metadata, new THREE.Vector3(0, 0, 0))).toEqual([0.25, 0.25]);
    await loaded.readBand(0);
    expect(image.readRasters).toHaveBeenCalledWith(expect.objectContaining({ width: 2, height: 2, resampleMethod: 'nearest' }));
  } finally { spy.mockRestore(); }
});

it('imports a custom spherical SAR CRS and preserves its rotated footprint for SAR and image layers', async () => {
  const keys = {
    GTModelTypeGeoKey: 1, ProjectedCSTypeGeoKey: 32767, GeographicTypeGeoKey: 32767,
    ProjCoordTransGeoKey: 17, ProjLinearUnitsGeoKey: 9001, GeogAngularUnitsGeoKey: 9102,
    GeogSemiMajorAxisGeoKey: 6378166.17539632, GeogSemiMinorAxisGeoKey: 6378166.17539632,
    ProjCenterLongGeoKey: 104.023498585448, ProjCenterLatGeoKey: 21.7330101664615,
    ProjStdParallel1GeoKey: 21.7330101664615,
  };
  const fields: Record<string, unknown> = {
    ModelTransformation: [9.622405953412807, -2.6874622746610455, 0, -2183.778071816824,
      -2.687028433184553, -9.623959565110653, 0, 6870.779342868769],
    PhotometricInterpretation: 1, BitsPerSample: [32, 32], SampleFormat: [3, 3],
  };
  const readRasters = vi.fn(async () => [new Float32Array(791 * 1207).fill(10)]);
  const image = {
    getFileDirectory: () => ({ getValue: (key: string) => fields[key] }), getGeoKeys: () => keys,
    getWidth: () => 791, getHeight: () => 1207, getSamplesPerPixel: () => 2, readRasters,
    getGDALMetadata: async (i: number) => ({ DESCRIPTION: ['VV', 'VH'][i] }),
  };
  vi.mocked(fromBlob).mockResolvedValue({ getImage: async () => image } as any);
  try {
    const loaded = await readSarRaster({ name: 'custom-sar.tif' } as File);
    expect(loaded.bands.map((band) => band.label)).toEqual(['VV', 'VH']);
    expect(imageMode(loaded)).toBe('gray');
    const terrain = { ...metadata, world_origin: { x: keys.ProjCenterLongGeoKey, y: keys.ProjCenterLatGeoKey } };
    const [u, v] = sarUv(loaded, terrain, new THREE.Vector3());
    expect(u).toBeGreaterThan(0); expect(u).toBeLessThan(1);
    expect(v).toBeGreaterThan(0); expect(v).toBeLessThan(1);
    const root = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',
      new THREE.Float32BufferAttribute([-0.001, 0, -0.001, 0.001, 0, -0.001, 0, 0, 0.001], 3)), new THREE.MeshStandardMaterial());
    const surface = await createGeoOverlay([{ raster: loaded, band: 0, kind: 'sar' }, { raster: loaded, band: 1, kind: 'image' }], [{ root, metadata: terrain }]);
    expect(surface.layerStatus).toEqual([null, null]);
    surface.dispose(); root.geometry.dispose(); (root.material as THREE.Material).dispose();
  } finally { vi.mocked(fromBlob).mockRestore(); }
});

it('rejects unsupported CRS at import time before reading pixels or accepting the geographic base CRS', async () => {
  const readRasters = vi.fn();
  const image = { getFileDirectory: () => ({}), getGeoKeys: () => ({ GTModelTypeGeoKey: 1, GeographicTypeGeoKey: 4326 }), readRasters };
  vi.mocked(fromBlob).mockResolvedValue({ getImage: async () => image } as any);
  try {
    await expect(readSarRaster({ name: 'unsupported.tif' } as File)).rejects.toThrow('reproject');
    expect(readRasters).not.toHaveBeenCalled();
  } finally { vi.mocked(fromBlob).mockRestore(); }
});

it('rejects oversized files before reading TIFF metadata', async () => {
  const spy = vi.mocked(fromBlob);
  spy.mockClear();
  await expect(readSarRaster({ size: 257 * 1024 * 1024 } as File)).rejects.toThrow('256 MiB');
  expect(spy).not.toHaveBeenCalled();
});

it('never treats an alpha sample as a grayscale color band', async () => {
  await expect(imagePixels(raster([[10], [255]], { extraSamples: [2] }), 1)).rejects.toThrow('alpha');
  await expect(imagePixels(raster([[10]]), -1)).rejects.toThrow('band');
});

it('serializes decodes and skips queued stale uploads', async () => {
  let complete: (value: number[][]) => void = () => {};
  const readRasters = vi.fn().mockImplementationOnce(() => new Promise<number[][]>((resolve) => { complete = resolve; }));
  const image = {
    getFileDirectory: () => ({ PhotometricInterpretation: 1, BitsPerSample: [8] }),
    getGeoKeys: () => ({ GeographicTypeGeoKey: 4326 }), getOrigin: () => [10, 22], getResolution: () => [1, -1],
    getWidth: () => 1, getHeight: () => 1, getSamplesPerPixel: () => 1, readRasters,
  };
  vi.mocked(fromBlob).mockResolvedValue({ getImage: async () => image } as any);
  try {
    const source = await readSarRaster({ name: 'queue.tif' } as File);
    const first = source.readBand(0);
    await Promise.resolve();
    let stale = false;
    const second = source.readBand(0, () => stale);
    const rejected = expect(second).rejects.toThrow('cancelled');
    stale = true;
    complete([[42]]);
    expect(await first).toEqual([42]);
    await rejected;
    expect(readRasters).toHaveBeenCalledTimes(1);
  } finally { vi.mocked(fromBlob).mockRestore(); }
});

it('rejects excessive decoded bytes and unsupported orientation before decoding', async () => {
  const fields: Record<string, unknown> = { PhotometricInterpretation: 1, BitsPerSample: [64] };
  const readRasters = vi.fn();
  const image = {
    getFileDirectory: () => fields, getGeoKeys: () => ({ GeographicTypeGeoKey: 4326 }),
    getOrigin: () => [10, 22], getResolution: () => [1, -1], getWidth: () => 8000,
    getHeight: () => 5000, getSamplesPerPixel: () => 1, readRasters,
  };
  vi.mocked(fromBlob).mockResolvedValue({ getImage: async () => image } as any);
  try {
    await expect(readSarRaster({ name: 'large.tif' } as File)).rejects.toThrow('256 MiB');
    fields.BitsPerSample = [8]; fields.Orientation = 4;
    await expect(readSarRaster({ name: 'flipped.tif' } as File)).rejects.toThrow('orientation');
    expect(readRasters).not.toHaveBeenCalled();
  } finally { vi.mocked(fromBlob).mockRestore(); }
});

it('restores terrain resources when rendering throws', async () => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial());
  const geometry = mesh.geometry, material = mesh.material;
  const surface = await createGeoOverlay([{ raster: raster([[10]]), kind: 'image', band: 0 }], [{ root: mesh, metadata }]);
  expect(() => surface.renderLayers(true, [{ visible: true, opacity: 1 }], () => { throw new Error('draw failed'); })).toThrow('draw failed');
  expect(mesh.geometry).toBe(geometry);
  expect(mesh.material).toBe(material);
  surface.dispose();
});
