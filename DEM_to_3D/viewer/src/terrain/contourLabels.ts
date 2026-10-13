import * as THREE from 'three';
import type { TerrainMetadata } from '../types/terrain';

export const LABEL_WIDTH = 64;
export const LABEL_HEIGHT = 18;
export const MAX_VISIBLE_LABELS = 48;
export const MAX_LABEL_CANDIDATES = 256;
export type ContourLabelAnchor = { point: THREE.Vector3; tangent: THREE.Vector3; elevation: number; length: number };
export type LabelBox = { x: number; y: number; width: number; height: number };

export function formatContourElevation(elevation: number): string {
  return `${Number(elevation.toFixed(6))}`;
}

// Join identical Float32 endpoints, never nearby disconnected contours. Process
// one elevation at a time so the connectivity graph need not cover the whole DEM.
export function* contourLabelSteps(positions: Float32Array, metadata: TerrainMetadata, interval: number, limit = MAX_LABEL_CANDIDATES): Generator<void, ContourLabelAnchor[]> {
  if (limit <= 0) return [];
  const levels = new Map<number, number[]>();
  for (let i = 0; i < positions.length; i += 6) {
    const y = positions[i + 1];
    const segments = levels.get(y) ?? [];
    segments.push(i);
    levels.set(y, segments);
    if (i % 24576 === 0) yield;
  }
  let candidates: ContourLabelAnchor[] = [];
  let work = 0;
  for (const [y, segments] of levels) {
    type Node = { point: THREE.Vector3; edges: number[] };
    const nodes = new Map<string, Node>();
    const edges: Array<[Node, Node]> = [];
    for (const i of segments) {
      const endpoints = [i, i + 3].map((offset) => {
        const key = `${positions[offset]},${positions[offset + 2]}`;
        let node = nodes.get(key);
        if (!node) {
          node = { point: new THREE.Vector3(positions[offset], y, positions[offset + 2]), edges: [] };
          nodes.set(key, node);
        }
        node.edges.push(edges.length);
        return node;
      });
      edges.push([endpoints[0], endpoints[1]]);
      if (++work % 4096 === 0) yield;
    }
    const visited = new Uint8Array(edges.length);
    // Trace open/branch-ended polylines first, then closed loops.
    for (const start of [...nodes.values()].sort((a, b) => Number(a.edges.length === 2) - Number(b.edges.length === 2))) {
      for (const first of start.edges) {
        if (visited[first]) continue;
        const path = [start.point];
        let node = start;
        let edgeIndex = first;
        let length = 0;
        for (;;) {
          visited[edgeIndex] = 1;
          const edge = edges[edgeIndex];
          const next = edge[0] === node ? edge[1] : edge[0];
          length += node.point.distanceTo(next.point);
          path.push(next.point);
          node = next;
          if (++work % 4096 === 0) yield;
          if (node.edges.length !== 2) break;
          const remaining = node.edges.find((index) => !visited[index]);
          if (remaining === undefined) break;
          edgeIndex = remaining;
        }
        if (length === 0) continue;
        const fractions = path.length > 100 ? [0.5, 0.25, 0.75] : [0.5];
        for (const fraction of fractions) {
          let remaining = length * fraction;
          for (let p = 1; p < path.length; p += 1) {
            const distance = path[p - 1].distanceTo(path[p]);
            if (distance > 0 && remaining <= distance) {
              const elevation = Math.round((y / metadata.elevation.exaggeration + metadata.elevation.base_elevation) / interval) * interval;
              candidates.push({ point: path[p - 1].clone().lerp(path[p], remaining / distance), tangent: path[p].clone().sub(path[p - 1]).normalize(), elevation, length });
              break;
            }
            remaining -= distance;
            if (++work % 4096 === 0) yield;
          }
        }
        if (candidates.length > limit * 2) candidates = candidates.sort((a, b) => b.length - a.length).slice(0, limit);
      }
    }
  }
  return candidates.sort((a, b) => b.length - a.length).slice(0, limit);
}

export async function buildContourLabels(positions: Float32Array, metadata: TerrainMetadata, interval: number, signal: AbortSignal, limit: number): Promise<ContourLabelAnchor[]> {
  const steps = contourLabelSteps(positions, metadata, interval, limit);
  try {
    for (;;) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const step = steps.next();
      if (step.done) return step.value;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  } finally { steps.return([]); }
}

export function projectContourLabel(point: THREE.Vector3, camera: THREE.Camera, width: number, height: number): LabelBox | null {
  const view = point.clone().applyMatrix4(camera.matrixWorldInverse);
  if (view.z >= 0) return null;
  const ndc = point.clone().project(camera);
  if (ndc.z < -1 || ndc.z > 1) return null;
  const box = { x: (ndc.x + 1) * width / 2 - LABEL_WIDTH / 2, y: (1 - ndc.y) * height / 2 - LABEL_HEIGHT / 2, width: LABEL_WIDTH, height: LABEL_HEIGHT };
  if (box.x < 0 || box.y < 0 || box.x + box.width > width || box.y + box.height > height) return null;
  return box;
}

export function projectContourTangent(point: THREE.Vector3, tangent: THREE.Vector3, camera: THREE.Camera, width: number, height: number): number | null {
  const a = point.clone().project(camera);
  const b = point.clone().add(tangent).project(camera);
  const dx = (b.x - a.x) * width;
  const dy = -(b.y - a.y) * height;
  if (!Number.isFinite(dx + dy) || Math.hypot(dx, dy) < 1e-6) return null;
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return angle;
}

export function rotatedLabelBox(box: LabelBox, angle: number): LabelBox {
  const radians = angle * Math.PI / 180;
  const width = Math.abs(Math.cos(radians)) * box.width + Math.abs(Math.sin(radians)) * box.height;
  const height = Math.abs(Math.sin(radians)) * box.width + Math.abs(Math.cos(radians)) * box.height;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

export function labelCollides(box: LabelBox, occupied: LabelBox[]): boolean {
  return occupied.some((other) => box.x < other.x + other.width + 8 && box.x + box.width + 8 > other.x && box.y < other.y + other.height + 8 && box.y + box.height + 8 > other.y);
}

export function terrainOccludesLabel(surfaceDistance: number | undefined, anchorDistance: number): boolean {
  return surfaceDistance !== undefined && surfaceDistance < anchorDistance - Math.max(0.05, anchorDistance * 1e-5);
}
