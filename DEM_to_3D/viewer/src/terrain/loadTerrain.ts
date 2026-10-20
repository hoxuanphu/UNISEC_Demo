import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { LoadedTerrain, MeshMetadata } from '../types/terrain';
import { disposeObjectResources } from './raycast';
import { TerrainAssetError, validateGridBuffer, validateMetadata } from './validation';

export type TerrainAssetUrls = { glb: string; metadata: string; grid: string };

/** Return true only when the URL's final path component exactly matches the contract filename. */
export function assetUrlMatchesFilename(url: string, filename: string): boolean {
  if (!filename || filename === '.' || filename === '..' || /[\\/]/.test(filename)) return false;
  try {
    const parsed = new URL(url, 'http://terrain.invalid/');
    const pathPart = parsed.pathname.split('/').filter(Boolean).at(-1);
    return pathPart !== undefined && decodeURIComponent(pathPart) === filename;
  } catch {
    return false;
  }
}

/** Validate that the renderable GLB geometry belongs to the metadata/grid pair. */
export function validateGltfMeshCounts(root: import('three').Object3D, meshMetadata: MeshMetadata): void {
  let vertexCount = 0;
  let triangleCount = 0;
  root.traverse((object) => {
    const mesh = object as import('three').Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute('position');
    if (!position) throw new TerrainAssetError('GLB mesh is missing a position attribute');
    vertexCount += position.count;
    const indexCount = mesh.geometry.getIndex()?.count;
    const meshTriangles = (indexCount ?? position.count) / 3;
    if (!Number.isInteger(meshTriangles)) throw new TerrainAssetError('GLB mesh position/index count is not triangular');
    triangleCount += meshTriangles;
  });
  if (vertexCount !== meshMetadata.vertex_count) {
    throw new TerrainAssetError(`GLB vertex_count ${vertexCount} does not match metadata ${meshMetadata.vertex_count}`);
  }
  if (triangleCount !== meshMetadata.triangle_count) {
    throw new TerrainAssetError(`GLB triangle_count ${triangleCount} does not match metadata ${meshMetadata.triangle_count}`);
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Metadata request failed (${response.status}): ${url}`);
  return response.json();
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Asset request failed (${response.status}): ${url}`);
  return response.arrayBuffer();
}

function parseGltf(loader: GLTFLoader, buffer: ArrayBuffer, url: string): Promise<GLTF> {
  const resourcePath = new URL('.', new URL(url, window.location.href)).href;
  return new Promise((resolve, reject) => loader.parse(buffer, resourcePath, resolve, reject));
}

export async function loadTerrain(urls: TerrainAssetUrls): Promise<LoadedTerrain> {
  // Read and validate metadata first.  This lets us reject a mismatched sidecar
  // URL before opening either binary request and avoids partially initialized
  // asset work when a caller accidentally mixes export versions.
  const metadataValue = await fetchJson(urls.metadata);
  const metadata = validateMetadata(metadataValue);
  if (!assetUrlMatchesFilename(urls.grid, metadata.grid.file)) {
    throw new TerrainAssetError(`Grid URL does not match metadata grid.file (${metadata.grid.file})`);
  }
  if (metadata.mesh?.file && !assetUrlMatchesFilename(urls.glb, metadata.mesh.file)) {
    throw new TerrainAssetError(`GLB URL does not match metadata mesh.file (${metadata.mesh.file})`);
  }
  const [gridBuffer, glbBuffer] = await Promise.all([
    fetchBuffer(urls.grid), fetchBuffer(urls.glb),
  ]);
  validateGridBuffer(metadata, gridBuffer);
  // The contract is little-endian. Browser platforms are overwhelmingly
  // little-endian, but decode explicitly so a future big-endian target cannot
  // silently display corrupt elevations.
  const view = new DataView(gridBuffer);
  const grid = new Float32Array(metadata.grid.shape[0] * metadata.grid.shape[1]);
  for (let i = 0; i < grid.length; i += 1) grid[i] = view.getFloat32(i * 4, true);
  const gltf = await parseGltf(new GLTFLoader(), glbBuffer, urls.glb);
  try {
    if (metadata.mesh) validateGltfMeshCounts(gltf.scene, metadata.mesh);
  } catch (error) {
    disposeObjectResources(gltf.scene);
    throw error;
  }
  return { metadata, grid, gridBuffer, gltf };
}
