import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { TerrainMetadata } from '../types/terrain';
import { buildContourLabels, contourLabelSteps, formatContourElevation, labelCollides, LABEL_HEIGHT, LABEL_WIDTH, MAX_LABEL_CANDIDATES, projectContourLabel, projectContourTangent, rotatedLabelBox, terrainOccludesLabel } from './contourLabels';

const metadata = { elevation: { base_elevation: -15, exaggeration: 3 } } as TerrainMetadata;
function anchors(segments: number[], limit = MAX_LABEL_CANDIDATES) {
  const steps = contourLabelSteps(new Float32Array(segments), metadata, 2.5, limit);
  let result = steps.next();
  while (!result.done) result = steps.next();
  return result.value;
}
function camera() {
  const result = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
  result.position.z = 100;
  result.updateMatrixWorld();
  return result;
}

describe('contour screen labels', () => {
  it('joins shuffled segments into one arc-length midpoint, not one label per triangle', () => {
    const labels = anchors([2, 60, 0, 10, 60, 0, 0, 60, 0, 2, 60, 0]);
    expect(labels).toHaveLength(1);
    expect(labels[0].point.toArray()).toEqual([5, 60, 0]);
    expect(labels[0].elevation).toBe(5);
    expect(formatContourElevation(labels[0].elevation)).toBe('5');
  });
  it('keeps disconnected lines/levels separate and never merges nearby endpoints', () => {
    const labels = anchors([0, 0, 0, 1, 0, 0, 1.001, 0, 0, 3, 0, 0, 0, 7.5, 0, 1, 7.5, 0]);
    expect(labels).toHaveLength(3);
    expect(labels.map((label) => label.elevation).sort()).toEqual([-12.5, -15, -15].sort());
  });
  it('traces closed loops once and bounds candidates by longest polylines', () => {
    expect(anchors([0, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 2, 2, 0, 2, 0, 0, 0])).toHaveLength(1);
    const labels = anchors([0, 0, 0, 2, 0, 0, 10, 0, 0, 20, 0, 0], 1);
    expect(labels).toHaveLength(1);
    expect(labels[0].length).toBe(10);
  });
  it('handles zero length and empty geometry', () => {
    expect(anchors([])).toEqual([]);
    expect(anchors([1, 0, 0, 1, 0, 0])).toEqual([]);
  });
  it('formats true signed and fractional elevations without floating point artifacts', () => {
    expect(formatContourElevation(-12.5)).toBe('-12.5');
    expect(formatContourElevation(0)).toBe('0');
    expect(formatContourElevation(0.1 + 0.2)).toBe('0.3');
  });
  it('honours merged group transforms while preserving the absolute elevation', () => {
    const label = anchors([0, 60, 0, 10, 60, 0])[0];
    const group = new THREE.Group();
    group.position.set(30, -20, 40);
    group.scale.y = 0.5;
    group.updateMatrixWorld();
    expect(group.localToWorld(label.point.clone()).toArray()).toEqual([35, 10, 40]);
    expect(label.elevation).toBe(5);
  });
  it('keeps CSS pixel dimensions constant across zoom and viewport resize', () => {
    const cam = camera();
    const point = new THREE.Vector3(1, 1, 0);
    const before = projectContourLabel(point, cam, 800, 800)!;
    cam.position.z = 10;
    cam.updateMatrixWorld();
    const after = projectContourLabel(point, cam, 800, 800)!;
    const resized = projectContourLabel(point, cam, 1000, 700)!;
    for (const box of [before, after, resized]) {
      expect(box.width).toBe(LABEL_WIDTH);
      expect(box.height).toBe(LABEL_HEIGHT);
    }
    expect(after.x).not.toBe(before.x);
    expect(resized.x).not.toBe(after.x);
  });
  it('culls behind camera, near/far clipped anchors and partially offscreen boxes', () => {
    const cam = camera();
    for (const point of [[0, 0, 101], [0, 0, 99.99], [0, 0, -20000], [100, 0, 0], [40, 0, 0]]) {
      expect(projectContourLabel(new THREE.Vector3(...point), cam, 800, 800)).toBeNull();
    }
  });
  it('rejects colliding boxes with a gap and terrain-occluded anchors, tolerating surface rounding', () => {
    const box = { x: 100, y: 100, width: LABEL_WIDTH, height: LABEL_HEIGHT };
    expect(labelCollides(box, [{ ...box, x: 170 }])).toBe(true);
    expect(labelCollides(box, [{ ...box, x: 180 }])).toBe(false);
    expect(terrainOccludesLabel(90, 100)).toBe(true);
    expect(terrainOccludesLabel(99.99, 100)).toBe(false);
    expect(terrainOccludesLabel(undefined, 100)).toBe(false);
  });
  it('projects local tangents upright and updates angle with camera orbit', () => {
    const cam = camera();
    const point = new THREE.Vector3();
    const tangent = new THREE.Vector3(1, 1, 0).normalize();
    expect(projectContourTangent(point, tangent, cam, 800, 800)).toBeCloseTo(-45);
    expect(projectContourTangent(point, tangent.clone().negate(), cam, 800, 800)).toBeCloseTo(-45);
    cam.position.set(100, 80, 50);
    cam.lookAt(point);
    cam.updateMatrixWorld();
    const angle = projectContourTangent(point, tangent, cam, 800, 800)!;
    expect(angle).toBeGreaterThanOrEqual(-90);
    expect(angle).toBeLessThanOrEqual(90);
    expect(angle).not.toBeCloseTo(-45);
    expect(projectContourTangent(point, new THREE.Vector3(), cam, 800, 800)).toBeNull();
    const box = rotatedLabelBox({ x: 0, y: 0, width: 64, height: 18 }, 90);
    expect(box.width).toBeCloseTo(18);
    expect(box.height).toBeCloseTo(64);
  });
  it('repeats sparsely at quarter points of long polylines, within the budget', () => {
    const segments = Array.from({ length: 150 }, (_, i) => [i, 60, 0, i + 1, 60, 0]).flat();
    const labels = anchors(segments);
    expect(labels.map((label) => label.point.x)).toEqual([75, 37.5, 112.5]);
    expect(labels.every((label) => label.tangent.x === 1)).toBe(true);
    expect(anchors(segments, 1)).toHaveLength(1);
    expect(anchors(segments, 0)).toEqual([]);
  });
  it('cancels before and during label construction', async () => {
    const first = new AbortController();
    first.abort();
    await expect(buildContourLabels(new Float32Array(), metadata, 10, first.signal, 256)).rejects.toMatchObject({ name: 'AbortError' });
    const second = new AbortController();
    const promise = buildContourLabels(new Float32Array([0, 60, 0, 10, 60, 0]), metadata, 10, second.signal, 256);
    second.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});
