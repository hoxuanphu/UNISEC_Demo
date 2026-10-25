import { softenCoverageEdgeAsync } from '../features/imagery/coverageFeather';
import type { ImageryLoadState } from '../features/imagery/ImageryStatus';
import * as THREE from 'three';
import type { LoadedModel } from '../types/terrain';
import { rasterUrl, type ImageryRaster } from '../features/imagery/analysisImagery';
import { mapLayerOrder } from '../features/map/mapLayerOrder';

type Entry = { model: LoadedModel; root: THREE.Object3D; meshes: THREE.Mesh[] };

/** Canvas outer edges are the geographic bounds, including any last partial pixel. */
export function analysisTextureFrame(rasters: ImageryRaster[], maxSize: number) {
  const left = Math.min(...rasters.map(r => r.terrain.bounds[0]));
  const bottom = Math.min(...rasters.map(r => r.terrain.bounds[1]));
  const right = Math.max(...rasters.map(r => r.terrain.bounds[2]));
  const top = Math.max(...rasters.map(r => r.terrain.bounds[3]));
  const native = Math.min(...rasters.map(r => (r.terrain.bounds[2] - r.terrain.bounds[0]) / r.terrain.width));
  const metresPerPixel = Math.max(native, (right - left) / maxSize, (top - bottom) / maxSize);
  const width = Math.ceil((right - left) / metresPerPixel), height = Math.ceil((top - bottom) / metresPerPixel);
  return { width, height, metresPerPixel, bounds: [left, top - height * metresPerPixel, left + width * metresPerPixel, top] as const };
}

async function composeTexture(rasters: ImageryRaster[], maxSize: number, anisotropy: number, signal: AbortSignal) {
  const frame = analysisTextureFrame(rasters, maxSize);
  const [left, , , top] = frame.bounds;
  const canvas = document.createElement('canvas');
  canvas.width = frame.width; canvas.height = frame.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D unavailable');
  context.imageSmoothingQuality = 'high';
  for (const raster of rasters) {
    const blob = await (await fetch(await rasterUrl(raster.terrain, signal), { signal })).blob();
    const bitmap = await createImageBitmap(blob);
    try {
      signal.throwIfAborted();
      const [l, b, r, t] = raster.terrain.bounds;
      context.drawImage(bitmap, (l - left) / frame.metresPerPixel, (top - t) / frame.metresPerPixel,
        (r - l) / frame.metresPerPixel, (t - b) / frame.metresPerPixel);
    } finally { bitmap.close(); }
  }
  signal.throwIfAborted();
  await softenCoverageEdgeAsync(canvas,frame.metresPerPixel,signal);
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = anisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  return { texture, bounds: frame.bounds };
}

/** A separate drape sits above every basemap pass and below vector overlays.
 * Shares terrain geometry, never its materials, UVs or online-imagery shader hooks. */
export function createAnalysisDrape(entries: Entry[], maxTextureSize: number, invalidate: () => void, anisotropy = 4, onStatus: (state:ImageryLoadState)=>void = ()=>{}) {
  const uniforms = { map: { value: null as THREE.Texture | null }, opacity: { value: 1 }, relief: { value: 0 } };
  const overlays: THREE.Group[] = [], materials: THREE.Material[] = [];
  const frames: Array<{ bounds: THREE.Vector4; origin: { x: number; y: number } }> = [];
  for (const entry of entries.filter(entry => entry.model.metadata)) {
    const bounds = new THREE.Vector4(0, 0, 1, 1);
    frames.push({ bounds, origin: entry.model.metadata!.world_origin });
    entry.root.updateWorldMatrix(true, true);
    const inverse = entry.root.matrixWorld.clone().invert();
    const group = new THREE.Group(); group.name = 'analysis-imagery-drape'; group.visible = false;
    for (const source of entry.meshes) {
      const matrix = inverse.clone().multiply(source.matrixWorld);
      const material = new THREE.MeshBasicMaterial({
        transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, toneMapped: false
      });
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, { analysisMap: uniforms.map, analysisOpacity: uniforms.opacity, analysisRelief: uniforms.relief,
          analysisNormalMatrix: {value: new THREE.Matrix3().getNormalMatrix(source.matrixWorld)},
          analysisMatrix: { value: matrix }, analysisBounds: { value: bounds } });
        shader.vertexShader = 'uniform mat4 analysisMatrix; uniform mat3 analysisNormalMatrix; uniform vec4 analysisBounds; varying vec2 vAnalysisUv; varying vec3 vAnalysisNormal;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvAnalysisNormal = normalize(analysisNormalMatrix * normal);\nvec3 analysisPoint = (analysisMatrix * vec4(position, 1.0)).xyz;\nvAnalysisUv = (vec2(analysisPoint.x, analysisPoint.z) - analysisBounds.xy) / analysisBounds.zw;');
        shader.fragmentShader = 'uniform sampler2D analysisMap; uniform float analysisOpacity; uniform float analysisRelief; varying vec2 vAnalysisUv; varying vec3 vAnalysisNormal;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
if (any(lessThan(vAnalysisUv, vec2(0.0))) || any(greaterThan(vAnalysisUv, vec2(1.0)))) discard;
vec4 analysisSample = texture2D(analysisMap, vAnalysisUv);
if (analysisSample.a < 0.001) discard;
// Optional presentation lighting, never used by the analytical raster view.
float hillLight = dot(normalize(vAnalysisNormal), normalize(vec3(-0.62, 0.65, 0.38)));
diffuseColor.rgb = analysisSample.rgb * (1.0 + analysisRelief * (hillLight - 0.55));
diffuseColor.a = analysisSample.a * analysisOpacity;`);
      };
      material.customProgramCacheKey = () => 'analysis-imagery-drape-v3';
      const mesh = new THREE.Mesh(source.geometry, material);
      mesh.matrix.copy(matrix); mesh.matrixAutoUpdate = false;
      mesh.renderOrder = mapLayerOrder.analysis * 2;
      group.add(mesh); materials.push(material);
    }
    entry.root.add(group); overlays.push(group);
  }
  let run: AbortController | null = null, current = '', disposed = false, pending: Promise<void> = Promise.resolve();
  const release = () => {
    overlays.forEach(group => { group.visible = false; });
    uniforms.map.value?.dispose(); uniforms.map.value = null;
  };
  return {
    /** Resolves once the drape shows these rasters (or was superseded or failed). */
    set(rasters: ImageryRaster[], opacity: number): Promise<void> {
      if (disposed) return Promise.resolve();
      uniforms.opacity.value = THREE.MathUtils.clamp(opacity, 0, 1);
      uniforms.relief.value = 0;
      const key = rasters.map(raster => raster.terrain.sha256).join(',');
      if (key === current) { if(!rasters.length)onStatus('off'); invalidate(); return pending; }
      current = key; run?.abort(); release(); invalidate();
      if (!rasters.length || !overlays.length) {onStatus('off'); return pending = Promise.resolve();}
      onStatus('loading');
      const next = new AbortController(); run = next;
      return pending = composeTexture(rasters, Math.min(4096, maxTextureSize), anisotropy, next.signal).then(({ texture, bounds: [left, bottom, right, top] }) => {
        if (disposed || next.signal.aborted) { texture.dispose(); return; }
        for (const { bounds, origin } of frames) bounds.set(left - origin.x, origin.y - top, right - left, top - bottom);
        uniforms.map.value = texture;
        overlays.forEach(group => { group.visible = true; });
        onStatus('ready'); invalidate();
      }, () => { if (!next.signal.aborted) {current = ''; onStatus('error');} });
    },
    /** Shows a prepared image (e.g. a masked corridor) whose outer edges are these EPSG:32648 bounds. */
    setCanvas(canvas: HTMLCanvasElement, [left, bottom, right, top]: readonly [number, number, number, number], relief = 0, opacity=1) {
      if (disposed || !overlays.length) return;
      current = `canvas:${performance.now()}`; run?.abort(); release();
      const texture = new THREE.CanvasTexture(canvas);
      texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = anisotropy;
      texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
      uniforms.opacity.value = THREE.MathUtils.clamp(opacity,0,1);
      uniforms.relief.value = THREE.MathUtils.clamp(relief, 0, .3);
      for (const { bounds, origin } of frames) bounds.set(left - origin.x, origin.y - top, right - left, top - bottom);
      uniforms.map.value = texture;
      overlays.forEach(group => { group.visible = true; });
      pending = Promise.resolve(); onStatus('ready'); invalidate();
    },
    dispose() {
      if (disposed) return;
      disposed = true; run?.abort(); release();
      overlays.forEach(group => group.removeFromParent());
      materials.forEach(material => material.dispose());
    }
  };
}
