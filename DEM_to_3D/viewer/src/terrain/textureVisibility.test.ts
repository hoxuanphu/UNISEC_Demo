import { expect, it } from 'vitest';
import * as THREE from 'three';
import { renderWithoutColorTexture } from './textureVisibility';

it('temporarily hides terrain colors without changing SAR or losing original materials', () => {
  const original = [new THREE.MeshStandardMaterial({ vertexColors: true }), new THREE.MeshStandardMaterial()];
  const terrain = new THREE.Mesh(new THREE.BufferGeometry(), original);
  const sar = new THREE.Mesh();
  const sarMaterial = sar.material;
  const neutral = new THREE.MeshStandardMaterial();
  renderWithoutColorTexture([terrain], neutral, () => {
    expect(terrain.material).toBe(neutral);
    expect(sar.material).toBe(sarMaterial);
  });
  expect(terrain.material).toBe(original);
  expect(() => renderWithoutColorTexture([terrain], neutral, () => { throw new Error('render failed'); })).toThrow();
  expect(terrain.material).toBe(original);
});
