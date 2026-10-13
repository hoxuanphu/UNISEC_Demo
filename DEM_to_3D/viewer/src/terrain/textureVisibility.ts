import * as THREE from 'three';

export function renderWithoutColorTexture(roots: THREE.Object3D[], neutral: THREE.Material, render: () => void): void {
  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  for (const root of roots) root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || originals.has(mesh)) return;
    originals.set(mesh, mesh.material);
    mesh.material = neutral;
  });
  try { render(); }
  finally { originals.forEach((material, mesh) => { mesh.material = material; }); }
}
