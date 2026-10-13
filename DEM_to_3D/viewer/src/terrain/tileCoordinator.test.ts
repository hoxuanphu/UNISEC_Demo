import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SceneTileCoordinator, estimateAtlasBytes } from './tileCoordinator';
const model = (id: string, area: number, tileObject?: THREE.Object3D) => ({ id, tilePyramid: { bounds_projected: { min_x: 0, min_y: 0, max_x: area, max_y: 1 } }, tileObject });
describe('scene tile coordinator', () => {
  it('prioritizes projected area within GPU budget', async () => {
    const coordinator = new SceneTileCoordinator({ atlasSize: 1024, gpuBytes: estimateAtlasBytes(1024) });
    await coordinator.update([model('small', 1), model('large', 10)] as never, new THREE.PerspectiveCamera(), { width: 100, height: 100 });
    const stats = coordinator.getStats();
    expect(stats.activeSources).toBe(1);
    expect(stats.perModel.get('large')?.detailAllowed).toBe(true);
    expect(stats.perModel.get('small')?.status).toBe('waiting for budget');
  });

  it('does not allow detail requests for models outside the camera frustum', async () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const inView = { ...model('in-view', 1), gltf: { scene: new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2)) } };
    const outObject = new THREE.Object3D();
    outObject.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2)));
    const outOfView = { ...model('out-of-view', 1, outObject), gltf: { scene: new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2)) } };
    outOfView.tileObject!.position.x = 1000;
    outOfView.tileObject!.updateMatrixWorld(true);
    const coordinator = new SceneTileCoordinator({ atlasSize: 1024, gpuBytes: estimateAtlasBytes(1024) * 2 });
    await coordinator.update([inView, outOfView] as never, camera, { width: 100, height: 100 });
    expect(coordinator.shouldRequestDetail('in-view')).toBe(true);
    expect(coordinator.shouldRequestDetail('out-of-view')).toBe(false);
    expect(coordinator.getStats().perModel.get('out-of-view')?.status).toBe('out of view');
  });

  it('enforces the global CPU bitmap budget through source caches', () => {
    let bytes = 900;
    const cache = { get byteEstimate(): number { return bytes; }, evictToBudget: (limit: number) => { bytes = Math.min(bytes, limit); }, loadedCount: 2 };
    const coordinator = new SceneTileCoordinator({ cpuBytes: 500 });
    const stats = coordinator.getStats([{ id: 'source', tileCache: cache }]);
    expect(stats.cpuBytes).toBe(500);
  });
});

