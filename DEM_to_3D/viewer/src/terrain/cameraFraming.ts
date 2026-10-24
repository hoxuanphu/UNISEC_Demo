import * as THREE from 'three';
import { visibleCameraOffset } from './visibleCameraTarget';

type Pose = {position: THREE.Vector3;target: THREE.Vector3};
export function cameraPoseBesideDock(camera: THREE.PerspectiveCamera, position: THREE.Vector3, target: THREE.Vector3, right: number, width: number): Pose {
  const preview = camera.clone();preview.position.copy(position);preview.lookAt(target);preview.updateMatrixWorld();
  const offset = visibleCameraOffset(preview,target,right,width);
  return {position:position.clone().add(offset),target:target.clone().add(offset)};
}

/** Fit real geometry without changing the operator's current orbit angle. */
export function frameCameraPoints(camera: THREE.PerspectiveCamera, currentTarget: THREE.Vector3, points: THREE.Vector3[], view: {width:number;height:number;right:number;bottom?:number;minDistance:number;maxDistance:number}): Pose | null {
  const frame = new THREE.Box3();
  points.filter(point => [point.x,point.y,point.z].every(Number.isFinite)).forEach(point => frame.expandByPoint(point));
  if (frame.isEmpty()) return null;
  const target = frame.getCenter(new THREE.Vector3()), extent = frame.getSize(new THREE.Vector3());
  const direction = camera.position.clone().sub(currentTarget).normalize();
  const right = new THREE.Vector3().crossVectors(camera.up,direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction,right).normalize();
  const visibleWidth = Math.max(240,view.width - view.right - 120);
  const bottom = Math.max(0,Math.min(view.bottom ?? 0,view.height - 200));
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov/2)) * Math.max(.25,(view.height - bottom - 150)/view.height);
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov/2)) * visibleWidth/view.height;
  let distance = view.minDistance;
  for (const x of [-extent.x/2,extent.x/2]) for (const y of [-extent.y/2,extent.y/2]) for (const z of [-extent.z/2,extent.z/2]) {
    const corner = new THREE.Vector3(x,y,z);
    distance = Math.max(distance,corner.dot(direction) + Math.max(Math.abs(corner.dot(right))/tanH,Math.abs(corner.dot(up))/tanV));
  }
  const position = target.clone().addScaledVector(direction,Math.min(view.maxDistance,distance*1.08));
  const pose = cameraPoseBesideDock(camera,position,target,view.right,view.width);
  if (bottom > 0) {
    const preview = camera.clone(); preview.position.copy(pose.position); preview.lookAt(pose.target); preview.updateMatrixWorld();
    const depth = target.clone().project(preview).z;
    const centre = new THREE.Vector3(0,0,depth).unproject(preview);
    const offset = new THREE.Vector3(0,-bottom/view.height,depth).unproject(preview).sub(centre);
    pose.position.add(offset); pose.target.add(offset);
  }
  return pose;
}
