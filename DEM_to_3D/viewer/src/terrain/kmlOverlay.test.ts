import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createKmlOverlay } from './kmlOverlay';
import type { TerrainMetadata } from '../types/terrain';
import type { KmlLayer } from './kml';

function surface() {
  const group = new THREE.Group();
  const root = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  root.rotation.x = -Math.PI / 2;
  root.position.y = 5;
  group.add(root);
  group.position.set(100, 20, -100);
  group.scale.y = 2;
  const metadata = { crs: { authority: 'EPSG', code: 4326 }, world_origin: { x: 100, y: 20 }, elevation: { base_elevation: 0, exaggeration: 1 }, grid_transform: { a: 1, b: 0, d: 0, e: -1 } } as TerrainMetadata;
  return { group, root, meshes: [root], metadata };
}

it('drapes point, subdivided line and polygon with hole on transformed terrain and cleans up', async () => {
  const terrain = surface();
  const layer: KmlLayer = { name: 'test', warnings: [], features: [
    { name: 'point', kind: 'point', coordinates: [[[100, 20]]] },
    { name: 'line', kind: 'line', coordinates: [[[98, 20], [102, 20]]] },
    { name: 'polygon', kind: 'polygon', coordinates: [[[97, 17], [103, 17], [103, 23], [97, 23], [97, 17]], [[99, 19], [99, 21], [101, 21], [101, 19], [99, 19]]] },
  ] };
  const overlay = await createKmlOverlay([layer], [terrain]);
  expect(overlay.message).toBeNull();
  expect(overlay.groups[0].children).toHaveLength(3);
  const face = overlay.groups[0].children.find((object) => object instanceof THREE.Mesh) as THREE.Mesh;
  const positions = face.geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i += 3) {
    const x = (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) / 3;
    const z = (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) / 3;
    expect(Math.abs(x) < 0.99 && Math.abs(z) < 0.99).toBe(false);
  }
  expect(positions.getY(0)).toBeGreaterThan(5);
  expect(positions.getY(0)).toBeLessThan(5.01);
  const dispose = vi.spyOn(face.geometry, 'dispose');
  overlay.dispose();
  expect(dispose).toHaveBeenCalled();
  expect(terrain.group.children).toEqual([terrain.root]);
});

it('reports outside coverage instead of drawing at a guessed elevation', async () => {
  const overlay = await createKmlOverlay([{ name: 'outside', warnings: [], features: [{ name: '', kind: 'line', coordinates: [[[0, 0], [1, 1]]] }] }], [surface()]);
  expect(overlay.message).toContain('Không có đối tượng');
  expect(overlay.groups[0].children).toHaveLength(0);
  overlay.dispose();
});

it('projects WGS84 to UTM and locates markers in model-local coordinates', async () => {
  const terrain = surface();
  terrain.metadata.crs = { authority: 'EPSG', code: 32648, linear_unit: 'metre' };
  terrain.metadata.world_origin = { x: 500000, y: 0 };
  const overlay = await createKmlOverlay([{ name: 'UTM', warnings: [], features: [{ name: '', kind: 'point', coordinates: [[[105, 0]]] }] }], [terrain]);
  expect(overlay.message).toBeNull();
  const points = overlay.groups[0].children[0] as THREE.Points;
  const position = points.geometry.getAttribute('position');
  expect(position.getX(0)).toBeCloseTo(0, 4);
  expect(position.getZ(0)).toBeCloseTo(0, 4);
  overlay.dispose();
});

it('honors cancelled work', async () => {
  const overlay = await createKmlOverlay([], [surface()], () => true);
  expect(overlay.groups).toHaveLength(0);
  overlay.dispose();
});
