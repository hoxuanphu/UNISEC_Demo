import * as THREE from 'three';
import proj4 from 'proj4';
import { fromBlob } from 'geotiff';
import type { TerrainMetadata } from '../types/terrain';
import { sceneToProjected } from './coordinate';
import { geoTiffCrs, registerCrs } from './geotiffCrs';

export type SarBand = { index: number; label: string; description?: string };
export type SarRaster = {
  name: string; bands: SarBand[]; width: number; height: number; crs?: string;
  bbox: [number, number, number, number]; nodata?: number;
  transform?: { a: number; b: number; c: number; d: number; e: number; f: number };
  readBand: (index: number, isCancelled?: () => boolean) => Promise<ArrayLike<number>>;
  photometric?: number; bits?: number[]; sampleFormat?: number[]; extraSamples?: number[];
  sourceWidth?: number; sourceHeight?: number;
};

export const MAX_RASTER_SIZE = 2048;
export function rasterDisplaySize(width: number, height: number): [number, number] {
  const scale = Math.min(1, MAX_RASTER_SIZE / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

export function imageMode(raster: SarRaster): 'rgb' | 'gray' {
  if (raster.photometric === 2 && raster.bands.length - (raster.extraSamples?.length ?? 0) >= 3) return 'rgb';
  if (raster.photometric === 0 || raster.photometric === 1) return 'gray';
  throw new Error('Ảnh chỉ hỗ trợ RGB (Photometric=2) hoặc grayscale (0/1); palette/CMYK chưa hỗ trợ.');
}

function directoryFields(image: any): any {
  const directory = image.getFileDirectory?.() ?? {};
  return new Proxy(directory, { get: (target, key) => typeof key === 'string' && typeof target.getValue === 'function' ? target.getValue(key) : target[key] });
}

async function bandLabels(image: any): Promise<SarBand[]> {
  const directory = directoryFields(image);
  const xml = String(directory.GDAL_METADATA ?? directory[42112] ?? '');
  const labels = [...xml.matchAll(/sample="(\d+)"[^>]*>([^<]+)</gi)].map((match) => ({ index: Number(match[1]), label: match[2].trim() }));
  return Promise.all(Array.from({ length: image.getSamplesPerPixel() }, async (_, index) => ({
    index, label: (await image.getGDALMetadata?.(index))?.DESCRIPTION || labels.find((label) => label.index === index)?.label || `Band ${index + 1}`,
  })));
}

// Serialize decodes across replacements: stale uploads cannot multiply peak browser memory.
let rasterDecodeQueue: Promise<unknown> = Promise.resolve();

export async function readSarRaster(file: File): Promise<SarRaster> {
  if (file.size > 256 * 1024 * 1024) throw new Error('GeoTIFF vượt 256 MiB; hãy cắt ảnh trước khi tải.');
  const tiff = await fromBlob(file);
  const image: any = await tiff.getImage();
  const rawDirectory = image.getFileDirectory();
  if (typeof rawDirectory.loadValue === 'function') await rawDirectory.loadValue('GDAL_METADATA');
  const keys = image.getGeoKeys?.() ?? {};
  const crs = geoTiffCrs(keys);
  const directory = directoryFields(image);
  const matrix = directory.ModelTransformation;
  const origin = matrix ? null : image.getOrigin(), resolution = matrix ? null : image.getResolution();
  const transform = matrix
    ? { a: matrix[0], b: matrix[1], c: matrix[3], d: matrix[4], e: matrix[5], f: matrix[7] }
    : { a: resolution[0], b: 0, c: origin[0], d: 0, e: resolution[1], f: origin[1] };
  const tiepoint = directory.ModelTiepoint;
  if (!matrix && tiepoint?.length >= 6) {
    transform.c -= transform.a * tiepoint[0] + transform.b * tiepoint[1];
    transform.f -= transform.d * tiepoint[0] + transform.e * tiepoint[1];
  }
  // PixelIsPoint origins describe the first sample centre rather than its outer corner.
  if (keys.GTRasterTypeGeoKey === 2) {
    transform.c -= (transform.a + transform.b) / 2;
    transform.f -= (transform.d + transform.e) / 2;
  }
  const rawNodata = image.getGDALNoData?.();
  const sourceWidth = image.getWidth(), sourceHeight = image.getHeight();
  const samplesPerPixel = image.getSamplesPerPixel();
  const bits: number[] = Array.from(directory.BitsPerSample ?? [8]);
  const sourcePixels = sourceWidth * sourceHeight;
  const sourceBytes = sourcePixels * Array.from({ length: samplesPerPixel }, (_, i) => Math.ceil((bits[i] ?? bits[0]) / 8)).reduce((a, b) => a + b, 0);
  if (![sourceWidth, sourceHeight, samplesPerPixel].every((n) => Number.isSafeInteger(n) && n > 0) || !Number.isFinite(sourceBytes)) throw new Error('GeoTIFF dimensions/bit depth are invalid.');
  if (sourcePixels * samplesPerPixel > 64_000_000 || sourceBytes > 256 * 1024 * 1024) throw new Error('GeoTIFF quá lớn cho trình duyệt (64 triệu mẫu / 256 MiB giải mã). Hãy cắt ảnh trước khi tải.');
  if (directory.Orientation != null && directory.Orientation !== 1) throw new Error('GeoTIFF orientation chưa hỗ trợ; hãy chuẩn hóa thành top-left.');
  if (!Object.values(transform).every(Number.isFinite) || transform.a * transform.e - transform.b * transform.d === 0) throw new Error('GeoTIFF affine is invalid or not invertible.');
  const [width, height] = rasterDisplaySize(sourceWidth, sourceHeight);
  const corners = [[0, 0], [sourceWidth, 0], [0, sourceHeight], [sourceWidth, sourceHeight]]
    .map(([x, y]) => [transform.a * x + transform.b * y + transform.c, transform.d * x + transform.e * y + transform.f]);
  transform.a *= sourceWidth / width; transform.d *= sourceWidth / width;
  transform.b *= sourceHeight / height; transform.e *= sourceHeight / height;
  return {
    name: file.name, bands: await bandLabels(image), width, height, sourceWidth, sourceHeight,
    photometric: directory.PhotometricInterpretation, bits: Array.from(directory.BitsPerSample ?? [8]),
    sampleFormat: Array.from(directory.SampleFormat ?? [1]), extraSamples: Array.from(directory.ExtraSamples ?? []),
    crs,
    bbox: [Math.min(...corners.map((p) => p[0])), Math.min(...corners.map((p) => p[1])), Math.max(...corners.map((p) => p[0])), Math.max(...corners.map((p) => p[1]))], transform,
    nodata: rawNodata == null ? undefined : Number(rawNodata),
    readBand: (index, isCancelled = () => false) => {
      const decode = rasterDecodeQueue.then(async () => {
        if (isCancelled()) throw new Error('Upload cancelled');
        if (!Number.isInteger(index) || index < 0 || index >= samplesPerPixel) throw new Error('Invalid GeoTIFF band');
        const rasters = await image.readRasters({ samples: [index], interleave: false, width, height, resampleMethod: 'nearest' });
        if (isCancelled()) throw new Error('Upload cancelled');
        return rasters[0] as ArrayLike<number>;
      });
      rasterDecodeQueue = decode.then(() => undefined, () => undefined);
      return decode;
    },
  };
}

export function sarPixels(values: ArrayLike<number>, nodata?: number): { data: Uint8Array; low: number; high: number } {
  const buffer = new Float64Array(values.length);
  let count = 0;
  for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i]) && values[i] !== nodata) buffer[count++] = values[i];
  const valid = buffer.subarray(0, count).sort();
  const low = valid[Math.floor(valid.length * 0.02)] ?? 0;
  const high = valid[Math.min(valid.length - 1, Math.floor(valid.length * 0.98))] ?? low;
  const data = new Uint8Array(values.length * 4);
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i]) || values[i] === nodata) continue;
    const c = high === low ? 128 : Math.round(255 * THREE.MathUtils.clamp((values[i] - low) / (high - low), 0, 1));
    data.set([c, c, c, 255], i * 4);
  }
  return { data, low, high };
}

export async function imagePixels(raster: SarRaster, band = 0, isCancelled = (): boolean => false): Promise<{ data: Uint8Array; low?: number; high?: number }> {
  const mode = imageMode(raster);
  const colorBands = raster.bands.length - (raster.extraSamples?.length ?? 0);
  if (mode === 'gray' && (!Number.isInteger(band) || band < 0 || band >= colorBands)) throw new Error('Invalid grayscale band (alpha is not a color band).');
  const indices = mode === 'rgb' ? [0, 1, 2] : [band];
  const alphaExtra = raster.extraSamples?.findIndex((value) => value === 1 || value === 2) ?? -1;
  const alphaIndex = alphaExtra < 0 ? -1 : raster.bands.length - raster.extraSamples!.length + alphaExtra;
  const samples: ArrayLike<number>[] = [];
  for (const index of [...indices, ...(alphaIndex >= 0 ? [alphaIndex] : [])]) {
    if (isCancelled()) throw new Error('Upload cancelled');
    samples.push(await raster.readBand(index, isCancelled));
  }
  if (isCancelled()) throw new Error('Upload cancelled');
  const count = raster.width * raster.height;
  if (samples.some((s) => s.length !== count)) throw new Error('GeoTIFF dimensions do not match the raster.');
  let grayValues = samples[0];
  if (mode === 'gray' && alphaIndex >= 0) {
    const masked = Float64Array.from(grayValues);
    for (let i = 0; i < count; i++) {
      const alpha = samples[samples.length - 1][i];
      if (!Number.isFinite(alpha) || alpha <= 0 || alpha === raster.nodata || masked[i] === raster.nodata) masked[i] = NaN;
      else if (raster.extraSamples?.[alphaExtra] === 1) {
        const bits = raster.bits?.[alphaIndex] ?? raster.bits?.[0] ?? 8;
        masked[i] /= alpha / (2 ** bits - 1);
      }
    }
    grayValues = masked;
  }
  const gray = mode === 'gray' ? sarPixels(grayValues, raster.nodata) : undefined;
  const data = gray?.data ?? new Uint8Array(count * 4);
  const maximum = (index: number): number => {
    const format = raster.sampleFormat?.[index] ?? raster.sampleFormat?.[0] ?? 1;
    const bits = raster.bits?.[index] ?? raster.bits?.[0] ?? 8;
    if (format !== 1 || !Number.isInteger(bits) || bits < 1 || bits > 32) throw new Error('RGB/alpha chỉ hỗ trợ số nguyên không dấu ≤32 bit; không tự suy đoán scale reflectance/float.');
    return 2 ** bits - 1;
  };
  const maxima = mode === 'rgb' ? indices.map(maximum) : [];
  const alphaMax = alphaIndex >= 0 ? maximum(alphaIndex) : 1;
  for (let i = 0; i < count; i++) {
    const invalid = indices.some((_, k) => !Number.isFinite(samples[k][i]) || samples[k][i] === raster.nodata);
    const alphaValue = alphaIndex >= 0 ? samples[samples.length - 1][i] : alphaMax;
    if (invalid || !Number.isFinite(alphaValue) || alphaValue === raster.nodata || alphaValue <= 0) { data.fill(0, i * 4, i * 4 + 4); continue; }
    const alpha = THREE.MathUtils.clamp(alphaValue / alphaMax, 0, 1);
    if (mode === 'rgb') {
      const associated = alphaExtra >= 0 && raster.extraSamples?.[alphaExtra] === 1;
      for (let k = 0; k < 3; k++) data[i * 4 + k] = Math.round(255 * THREE.MathUtils.clamp(samples[k][i] / maxima[k] / (associated ? alpha : 1), 0, 1));
      data[i * 4 + 3] = 255;
    } else if (raster.photometric === 0) {
      for (let k = 0; k < 3; k++) data[i * 4 + k] = 255 - data[i * 4 + k];
    }
    data[i * 4 + 3] = Math.round(data[i * 4 + 3] * alpha);
  }
  return { data, low: gray?.low, high: gray?.high };
}

export function sarUv(raster: SarRaster, metadata: TerrainMetadata, point: THREE.Vector3): [number, number] {
  if (!raster.crs) throw new Error('SAR GeoTIFF requires a supported CRS.');
  const target = metadata.crs.proj4 || `${metadata.crs.authority}:${metadata.crs.code}`;
  registerCrs(target); registerCrs(raster.crs);
  const projected = sceneToProjected(metadata, point).projected;
  const [x, y] = proj4(target, raster.crs, [projected.x, projected.y]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('GeoTIFF CRS produced invalid coordinates.');
  const [minX, minY, maxX, maxY] = raster.bbox;
  const t = raster.transform ?? { a: (maxX - minX) / raster.width, b: 0, c: minX, d: 0, e: -(maxY - minY) / raster.height, f: maxY };
  const det = t.a * t.e - t.b * t.d;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-20) throw new Error('SAR geotransform is not invertible.');
  return [(t.e * (x - t.c) - t.b * (y - t.f)) / det / raster.width,
    (-t.d * (x - t.c) + t.a * (y - t.f)) / det / raster.height];
}

export function triangleIntersectsRaster(points: [number, number][]): boolean {
  let polygon = points;
  for (const [axis, boundary, direction] of [[0, 0, 1], [0, 1, -1], [1, 0, 1], [1, 1, -1]]) {
    const next: [number, number][] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const insideA = direction * (a[axis] - boundary) >= 0, insideB = direction * (b[axis] - boundary) >= 0;
      if (insideA) next.push(a);
      if (insideA !== insideB) {
        const t = (boundary - a[axis]) / (b[axis] - a[axis]);
        next.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    polygon = next;
  }
  let area = 0;
  polygon.forEach((a, i) => { const b = polygon[(i + 1) % polygon.length]; area += a[0] * b[1] - a[1] * b[0]; });
  return Math.abs(area) > 1e-12;
}

export type SarSurface = { render: (color: boolean, visible: boolean, opacity: number, render: () => void) => void; dispose: () => void };

// Swap only for the draw: tile streaming and model ownership always see their original resources.
export async function createSarOverlay(raster: SarRaster, band: number, models: { root: THREE.Object3D; metadata: TerrainMetadata }[]): Promise<SarSurface> {
  return createGeoOverlay([{ raster, band, kind: 'sar' }], models);
}

export type GeoLayer = { raster: SarRaster; band: number; kind: 'sar' | 'image' };
export type GeoSurface = SarSurface & { status: string | null; layerStatus: (string | null)[]; renderLayers: (color: boolean, controls: { visible: boolean; opacity: number }[], render: () => void) => void };

export async function createGeoOverlay(layers: GeoLayer[], models: { root: THREE.Object3D; metadata: TerrainMetadata }[], isCancelled = (): boolean => false): Promise<GeoSurface> {
  const textures: THREE.DataTexture[] = [];
  const errors: (string | null)[] = layers.map(() => null);
  try {
    for (const [index, layer] of layers.entries()) {
      if (isCancelled()) throw new Error('Upload cancelled');
      let data: Uint8Array;
      try {
        const pixels = layer.kind === 'sar' ? sarPixels(await layer.raster.readBand(layer.band, isCancelled), layer.raster.nodata) : await imagePixels(layer.raster, layer.band, isCancelled);
        if (pixels.data.length !== layer.raster.width * layer.raster.height * 4) throw new Error('GeoTIFF dimensions do not match the raster.');
        data = pixels.data;
      } catch (error) {
        errors[index] = error instanceof Error ? error.message : String(error);
        data = new Uint8Array(4);
      }
      if (isCancelled()) throw new Error('Upload cancelled');
      const texture = new THREE.DataTexture(data as Uint8Array<ArrayBuffer>, errors[index] ? 1 : layer.raster.width, errors[index] ? 1 : layer.raster.height, THREE.RGBAFormat);
      texture.colorSpace = THREE.SRGBColorSpace;
      // Do not blend valid colors with transparent NoData pixels at hole boundaries.
      texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter;
      texture.needsUpdate = true;
      textures.push(texture);
    }
  } catch (error) { textures.forEach((texture) => texture.dispose()); throw error; }
  const names = layers.map((_, i) => i === 0 ? 'sar' : `geo${i}`);
  const varyings = names.map((name) => `v${name[0].toUpperCase()}${name.slice(1)}Uv`);
  const opacityUniforms = layers.map(() => ({ value: 0 }));
  const overlaps = layers.map(() => false);
  const bindings: { mesh: THREE.Mesh; geometry: THREE.BufferGeometry; color: THREE.Material | THREE.Material[]; neutral: THREE.Material | THREE.Material[] }[] = [];
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((m) => m.dispose()); textures.forEach((texture) => texture.dispose());
  };
  const decorate = (original: THREE.Material): THREE.Material => {
    const clone = original.clone(); materials.push(clone);
    const hook = original.onBeforeCompile;
    const key = original.customProgramCacheKey();
    clone.onBeforeCompile = (shader, renderer) => {
      hook.call(original, shader, renderer);
      names.forEach((name, i) => {
        shader.uniforms[`${name}Map`] = { value: textures[i] };
        shader.uniforms[`${name}Opacity`] = opacityUniforms[i];
      });
      shader.vertexShader = names.map((name, i) => `attribute vec2 ${name}Uv; varying vec2 ${varyings[i]};\n`).join('') + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + names.map((name, i) => `${varyings[i]} = ${name}Uv;`).join('\n'));
      shader.fragmentShader = names.map((name, i) => `uniform sampler2D ${name}Map; uniform float ${name}Opacity; varying vec2 ${varyings[i]};\n`).join('') + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\n' + names.map((name, i) => {
        const uv = varyings[i];
        return `if (${uv}.x >= 0.0 && ${uv}.x <= 1.0 && ${uv}.y >= 0.0 && ${uv}.y <= 1.0) {
  vec4 ${name}Sample = texture2D(${name}Map, ${uv});
  diffuseColor.rgb = mix(diffuseColor.rgb, ${name}Sample.rgb, ${name}Sample.a * ${name}Opacity);
}`;
      }).join('\n'));
    };
    clone.customProgramCacheKey = () => `${key}:geo-surface-v2:${layers.length}`;
    return clone;
  };
  try {
    for (const { root, metadata } of models) {
      root.updateWorldMatrix(true, true);
      const inverse = root.matrixWorld.clone().invert();
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        const geometry = mesh.geometry.clone();
        geometries.push(geometry);
        const position = geometry.getAttribute('position');
        const matrix = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
        layers.forEach((layer, layerIndex) => {
          const uv = new Float32Array(position.count * 2);
          try {
            if (errors[layerIndex]) uv.fill(-1);
            else for (let i = 0; i < position.count; i++) uv.set(sarUv(layer.raster, metadata, new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(matrix)), i * 2);
          } catch (error) {
            errors[layerIndex] = error instanceof Error ? error.message : String(error);
            uv.fill(-1);
          }
          geometry.setAttribute(`${names[layerIndex]}Uv`, new THREE.BufferAttribute(uv, 2));
          const index = geometry.index;
          const count = index?.count ?? position.count;
          for (let i = 0; i + 2 < count && !overlaps[layerIndex]; i += 3) {
            overlaps[layerIndex] = triangleIntersectsRaster([0, 1, 2].map((offset) => {
              const vertex = index ? index.getX(i + offset) : i + offset;
              return [uv[vertex * 2], uv[vertex * 2 + 1]];
            }));
          }
        });
        const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const color = originals.map(decorate);
        const neutral = originals.map(() => {
          const base = new THREE.MeshStandardMaterial({ color: '#b8b8b8', roughness: 0.92, side: THREE.DoubleSide });
          const result = decorate(base); base.dispose(); return result;
        });
        bindings.push({ mesh, geometry, color: Array.isArray(mesh.material) ? color : color[0], neutral: Array.isArray(mesh.material) ? neutral : neutral[0] });
      });
    }
  } catch (error) { dispose(); throw error; }
  const layerStatus = layers.map((layer, i) => errors[i] ?? (overlaps[i] ? null : `Không giao với địa hình: ${layer.raster.name}. Kiểm tra CRS và phạm vi ảnh.`));
  const status = layerStatus.filter(Boolean).join(' ') || null;
  const renderLayers: GeoSurface['renderLayers'] = (color, controls, render) => {
      if (disposed) { render(); return; }
      opacityUniforms.forEach((uniform, i) => { uniform.value = !errors[i] && controls[i]?.visible ? THREE.MathUtils.clamp(controls[i].opacity, 0, 1) : 0; });
      const originals = bindings.map(({ mesh }) => ({ mesh, geometry: mesh.geometry, material: mesh.material }));
      try {
        bindings.forEach((b) => { b.mesh.geometry = b.geometry; b.mesh.material = color ? b.color : b.neutral; });
        render();
      } finally { originals.forEach((b) => { b.mesh.geometry = b.geometry; b.mesh.material = b.material; }); }
  };
  return { dispose, status, layerStatus, renderLayers, render: (color, visible, opacity, render) => renderLayers(color, [{ visible, opacity }], render) };
}
