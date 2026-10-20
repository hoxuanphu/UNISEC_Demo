import { Texture, SRGBColorSpace, Mesh, MeshStandardMaterial } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { LoadedModel } from '../types/terrain';
import { TerrainAssetError } from './validation';

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const textureSidecarExtensions = new Set(['.tif', '.tiff']);

export type DecodedTexture = {
  texture: Texture;
  width: number;
  height: number;
};

function extension(name: string): string {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot >= 0 ? lower.slice(dot) : '';
}

export function isImageFile(file: File): boolean {
  return imageExtensions.has(extension(file.name));
}

export function isTextureSidecarFile(file: File): boolean {
  return textureSidecarExtensions.has(extension(file.name));
}

export function isTextureFile(file: File): boolean {
  return isImageFile(file) || isTextureSidecarFile(file);
}

export function basename(file: File): string {
  const name = file.name.toLowerCase();
  const suffix = extension(name);
  return suffix ? name.slice(0, -suffix.length) : name;
}

async function decodeImageFile(file: File): Promise<DecodedTexture> {
  const bitmap = await createImageBitmap(file);
  const texture = new Texture(bitmap);
  // The exporter writes UV.v = 1 - row/(rows - 1), matching glTF's
  // bottom-left texture convention.  Keep external images in the same
  // orientation as the embedded GLB texture.
  texture.flipY = false;
  texture.needsUpdate = true;
  texture.colorSpace = SRGBColorSpace;
  return { texture, width: bitmap.width, height: bitmap.height };
}

/** Decode a GeoTIFF texture sidecar (as written by dem_to_3d_v2 --texture-crop-bbox). */
async function decodeGeoTiffFile(file: File): Promise<DecodedTexture> {
  const { fromBlob } = await import('geotiff');
  const tiff = await fromBlob(file);
  const image = await tiff.getImage();
  const directory = image.getFileDirectory();
  const color = directory.getValue('PhotometricInterpretation') === 2;
  const bits = directory.getValue('BitsPerSample') ?? [8];
  const formats = directory.getValue('SampleFormat') ?? [1];
  const extras = directory.getValue('ExtraSamples') ?? [];
  const alpha = color && (extras[0] === 1 || extras[0] === 2);
  if (alpha && extras.length !== 1) throw new TerrainAssetError('GeoTIFF texture chỉ hỗ trợ một sample alpha.');
  const channels = alpha ? 4 : 3;
  if (color && Array.from({ length: channels }, (_, i) => i).some((i) =>
    (formats[i] ?? formats[0]) !== 1 || !Number.isInteger(bits[i] ?? bits[0]) || (bits[i] ?? bits[0]) < 1 || (bits[i] ?? bits[0]) > 32)) {
    throw new TerrainAssetError('GeoTIFF texture RGB cần unsigned integer 1–32 bit; float/signed cần chuyển scale trước khi tải.');
  }
  const rgb = await image.readRGB({ interleave: true, enableAlpha: alpha });
  const width = image.getWidth();
  const height = image.getHeight();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new TerrainAssetError('Canvas 2D không khả dụng để decode GeoTIFF texture');
  const imageData = context.createImageData(width, height);
  const pixels = rgb as unknown as { length: number; [index: number]: number };
  const pixelCount = width * height;
  if (pixels.length !== pixelCount * channels) throw new TerrainAssetError('GeoTIFF texture có số sample không khớp kích thước ảnh.');
  for (let index = 0; index < pixelCount; index += 1) {
    const source = index * channels;
    const target = index * 4;
    const opacity = alpha ? pixels[source + 3] / (2 ** (bits[3] ?? bits[0]) - 1) : 1;
    for (let channel = 0; channel < 3; channel += 1) {
      // readRGB returns native sample values for RGB, but already-scaled bytes for other photometrics.
      const value = color ? pixels[source + channel] * 255 / (2 ** (bits[channel] ?? bits[0]) - 1) : pixels[source + channel];
      imageData.data[target + channel] = extras[0] === 1 && alpha ? (opacity > 0 ? value / opacity : 0) : value;
    }
    imageData.data[target + 3] = Math.round(opacity * 255);
  }
  context.putImageData(imageData, 0, 0);
  const bitmap = await createImageBitmap(canvas);
  const texture = new Texture(bitmap);
  texture.flipY = false;
  texture.needsUpdate = true;
  texture.colorSpace = SRGBColorSpace;
  return { texture, width, height };
}

export async function decodeTextureFile(file: File): Promise<DecodedTexture> {
  if (isImageFile(file)) return decodeImageFile(file);
  if (isTextureSidecarFile(file)) return decodeGeoTiffFile(file);
  throw new TerrainAssetError(`Không hỗ trợ file texture: ${file.name}`);
}

function allMeshes(root: GLTF['scene']): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.isMesh) meshes.push(mesh);
  });
  return meshes;
}

function meshHasUv(mesh: Mesh): boolean {
  const uv = mesh.geometry.getAttribute('uv');
  return uv !== undefined && uv.count > 0;
}

/**
 * Check whether every mesh in the model already carries a UV attribute, which
 * is required before an external texture image can be swapped in.
 */
export function modelHasUvMaps(model: LoadedModel): boolean {
  const meshes = allMeshes(model.gltf.scene);
  if (meshes.length === 0) return false;
  return meshes.every(meshHasUv);
}

/** Count how many meshes carry UV sets across the model. */
export function countTextureSlots(model: LoadedModel): number {
  return allMeshes(model.gltf.scene).filter(meshHasUv).length;
}

function disposeExistingMaterialTextures(material: MeshStandardMaterial): void {
  if (material.map) {
    material.map.dispose();
    material.map = null;
  }
}

/**
 * Apply a decoded texture image to every mesh of a model.
 *
 * - Meshes with an existing UV attribute keep their UVs and only get the
 *   texture image replaced (PNG/JPG/WebP/GeoTIFF of the same area).
 * - Meshes without UVs raise an error: the GLB must be exported with
 *   --texture once so UVs are baked in, or the caller must supply grid
 *   metadata so UVs can be recomputed.
 */
export function applyTextureToModel(scene: GLTF['scene'], modelName: string, decoded: DecodedTexture): void {
  const meshes = allMeshes(scene);
  if (meshes.length === 0) throw new TerrainAssetError(`Model ${modelName} không chứa mesh nào để dán texture`);
  const withoutUv = meshes.filter((mesh) => !meshHasUv(mesh));
  if (withoutUv.length > 0) {
    throw new TerrainAssetError(
      `Model ${modelName} không có UV map (phải xuất GLB kèm --texture ít nhất 1 lần để có UV, hoặc dùng bản export khác)`,
    );
  }
  for (const mesh of meshes) {
    const material = mesh.material as MeshStandardMaterial | MeshStandardMaterial[];
    const targets = Array.isArray(material) ? material : [material];
    for (const mat of targets) {
      if (!(mat instanceof MeshStandardMaterial)) continue;
      disposeExistingMaterialTextures(mat);
      mat.map = decoded.texture;
      mat.color.set('#ffffff');
      mat.needsUpdate = true;
    }
  }
}
