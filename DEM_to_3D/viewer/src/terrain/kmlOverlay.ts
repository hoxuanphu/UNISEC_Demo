import * as THREE from 'three';
import proj4 from 'proj4';
import type { TerrainMetadata } from '../types/terrain';
import type { KmlLayer } from './kml';
import { projectedToScene } from './coordinate';

export type KmlSurface = { root: THREE.Object3D; group: THREE.Group; meshes: THREE.Mesh[]; metadata: TerrainMetadata };
export type KmlOverlay = { groups: THREE.Group[]; samples: number; message: string | null; dispose: () => void };

export async function createKmlOverlay(layers: readonly KmlLayer[], surfaces: readonly KmlSurface[], cancelled = (): boolean => false): Promise<KmlOverlay> {
  const groups: THREE.Group[] = [];
  let samples = 0;
  let visibleSamples = 0;
  let clipped = false;
  const limit = 150000;
  const dispose = (): void => {
    groups.forEach((group) => {
      group.removeFromParent();
      group.traverse((object) => {
        const drawable = object as THREE.Mesh;
        drawable.geometry?.dispose();
        const materials = Array.isArray(drawable.material) ? drawable.material : [drawable.material];
        materials.forEach((material) => material?.dispose());
      });
    });
  };
  try {
    for (const surface of surfaces) {
      if (cancelled()) break;
      surface.group.updateWorldMatrix(true, true);
      const metadata = surface.metadata;
      const target = metadata.crs.proj4 || `${metadata.crs.authority}:${metadata.crs.code}`;
      const utm = /^EPSG:(326|327)(\d{2})$/i.exec(target);
      if (utm && !proj4.defs(target)) proj4.defs(target, `+proj=utm +zone=${Number(utm[2])} ${utm[1] === '327' ? '+south' : ''} +datum=WGS84 +units=m +no_defs`);
      const project = proj4('EPSG:4326', target);
      const bounds = new THREE.Box3().setFromObject(surface.root);
      const size = bounds.getSize(new THREE.Vector3());
      const lift = Math.max(size.x, size.z, 1) * 0.00008;
      const grid = metadata.grid_transform;
      const spacing = Math.max(Math.hypot(grid.a, grid.d), Math.hypot(grid.b, grid.e), 1);
      const ray = new THREE.Raycaster();
      (ray as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
      const overlay = new THREE.Group();
      overlay.name = 'kml-overlay';
      groups.push(overlay);
      surface.group.add(overlay);
      const toLocal = (coordinate: [number, number]): THREE.Vector3 => {
        const [x, y] = project.forward(coordinate);
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Không chuyển được tọa độ KML sang hệ tọa độ terrain.');
        const point = projectedToScene(metadata, { x, y }, metadata.elevation.base_elevation);
        return new THREE.Vector3(point.x, point.y, point.z);
      };
      const sample = (point: THREE.Vector3): THREE.Vector3 | null => {
        if (++samples > limit) { clipped = true; return null; }
        const world = surface.group.localToWorld(point.clone());
        if (world.x < bounds.min.x || world.x > bounds.max.x || world.z < bounds.min.z || world.z > bounds.max.z) return null;
        world.y = bounds.max.y + Math.max(size.y, 1);
        ray.set(world, new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObjects(surface.meshes, false)[0];
        if (!hit) return null;
        visibleSamples++;
        const local = surface.group.worldToLocal(hit.point.clone());
        local.y += lift;
        return local;
      };
      for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        const layer = layers[layerIndex];
        const color = ['#ffcc33', '#fb7185', '#38bdf8', '#a3e635'][layerIndex % 4];
        const lines: number[] = [];
        const points: number[] = [];
        const faces: number[] = [];
        for (const feature of layer.features) {
          if (cancelled() || clipped) break;
          if (samples % 500 < 10) await new Promise((resolve) => setTimeout(resolve, 0));
          const rings = feature.coordinates.map((ring) => ring.map(toLocal));
          const featureBounds = new THREE.Box3().setFromPoints(rings.flat().map((point) => surface.group.localToWorld(point.clone())));
          if (featureBounds.max.x < bounds.min.x || featureBounds.min.x > bounds.max.x || featureBounds.max.z < bounds.min.z || featureBounds.min.z > bounds.max.z) continue;
          if (feature.kind === 'point') {
            const hit = sample(rings[0][0]);
            if (hit) points.push(hit.x, hit.y, hit.z);
            continue;
          }
          for (const ring of rings) {
            for (let i = 1; i < ring.length && !clipped; i++) {
              const start = ring[i - 1], end = ring[i];
              const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.z - start.z) / spacing));
              let previous = sample(start);
              for (let step = 1; step <= steps && !clipped; step++) {
                if (samples % 1000 === 0) { await new Promise((resolve) => setTimeout(resolve, 0)); if (cancelled()) break; }
                const next = sample(start.clone().lerp(end, step / steps));
                if (previous && next) lines.push(previous.x, previous.y, previous.z, next.x, next.y, next.z);
                previous = next;
              }
              if (cancelled()) break;
            }
            if (cancelled()) break;
          }
          if (feature.kind === 'polygon' && !clipped && !cancelled()) {
            const openRings = rings.map((ring) => ring.length > 1 && ring[0].equals(ring[ring.length - 1]) ? ring.slice(0, -1) : ring);
            const flat = openRings.flat();
            const triangles = THREE.ShapeUtils.triangulateShape(openRings[0].map((p) => new THREE.Vector2(p.x, p.z)), openRings.slice(1).map((ring) => ring.map((p) => new THREE.Vector2(p.x, p.z))));
            const pending = triangles.map((indices) => indices.map((i) => flat[i]));
            while (pending.length && !clipped && !cancelled()) {
              if (samples % 500 < 3) await new Promise((resolve) => setTimeout(resolve, 0));
              const [a, b, c] = pending.pop()!;
              const edges = [[a, b, c], [b, c, a], [c, a, b]].sort((u, v) => v[0].distanceToSquared(v[1]) - u[0].distanceToSquared(u[1]));
              const [u, v, other] = edges[0];
              if (u.distanceToSquared(v) > spacing * spacing * 4) {
                const middle = u.clone().lerp(v, 0.5);
                pending.push([u, middle, other], [middle, v, other]);
                continue;
              }
              const hits = [sample(a), sample(b), sample(c)];
              if (hits.every((hit) => hit !== null)) hits.forEach((hit) => faces.push(hit!.x, hit!.y, hit!.z));
            }
          }
        }
        const add = (vertices: number[], kind: 'line' | 'point' | 'face'): void => {
          if (!vertices.length) return;
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
          const object = kind === 'line'
            ? new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color }))
            : kind === 'point'
              ? new THREE.Points(geometry, new THREE.PointsMaterial({ color, size: 8, sizeAttenuation: false }))
              : new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
          object.name = layer.name;
          object.renderOrder = kind === 'face' ? 5 : 6;
          overlay.add(object);
        };
        add(faces, 'face'); add(lines, 'line'); add(points, 'point');
      }
    }
    return { groups, samples, message: clipped ? 'Lớp KML quá chi tiết: đã giới hạn 150.000 mẫu phủ; hãy chia nhỏ dữ liệu.' : visibleSamples === 0 ? 'Không có đối tượng KML nằm trên bề mặt terrain. Kiểm tra phạm vi dữ liệu và hệ tọa độ.' : null, dispose };
  } catch (error) { dispose(); throw error; }
}
