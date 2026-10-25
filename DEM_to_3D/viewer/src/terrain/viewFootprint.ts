import * as THREE from 'three';

/** Intersect the camera frame with the horizontal plane at its target elevation.
 * Rays above the horizon stop at the display range instead of producing infinite bounds. */
export function viewFootprint(camera: THREE.Camera, target: THREE.Vector3): THREE.Vector3[] {
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -target.y);
  const range = Math.min(100_000, Math.max(1_000, camera.position.distanceTo(target) * 8));
  return [[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0]].map(([x,y]) => {
    ray.setFromCamera(new THREE.Vector2(x,y), camera);
    const at = ray.ray.intersectPlane(plane, new THREE.Vector3());
    if (at && at.distanceTo(target) <= range) return at;
    const direction = (at ?? ray.ray.at(range, new THREE.Vector3())).sub(target);
    direction.y = 0;
    return direction.lengthSq() ? direction.setLength(range).add(target) : target.clone();
  });
}
