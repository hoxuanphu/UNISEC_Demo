import * as THREE from 'three';
import type { FlyoverPlan, PathSampler } from './flyoverPlan';

/** Bake a restrained camera bearing once. It follows the valley, rather than each
 * switchback, with bounded yaw speed/acceleration. A time-indexed track gives
 * playback, seeking and MP4 export the exact same orientation. */
export function createFlyoverBearing(path: PathSampler, plan: FlyoverPlan) {
  const fps=60, dt=1/fps, maxSpeed=Math.PI/16, maxAcceleration=.4;
  const first=path.headingAt(0), angles=[Math.atan2(first.x,first.z)];
  let angle=angles[0], velocity=0;
  for(let i=1;i<=Math.ceil(plan.duration*fps);i++) {
    const heading=path.headingAt(plan.at(i/fps).distance);
    const raw=Math.atan2(heading.x,heading.z);
    const error=Math.atan2(Math.sin(raw-angle),Math.cos(raw-angle));
    const acceleration=Math.max(-maxAcceleration,Math.min(maxAcceleration,error*5-velocity*4));
    velocity=Math.max(-maxSpeed,Math.min(maxSpeed,velocity+acceleration*dt));
    angle+=velocity*dt;angles.push(angle);
  }
  return (time: number) => {
    const t=Math.max(0,Math.min(plan.duration,time)*fps);
    const i=Math.min(angles.length-2,Math.floor(t)), f=t-i;
    const a=angles[i]+(angles[i+1]-angles[i])*f;
    return {x:Math.sin(a),z:Math.cos(a)};
  };
}

/** Fit all route/area vertices inside the closing shot, including the narrow-screen case. */
export function flyoverOverviewPose(points:readonly THREE.Vector3[],heading:{x:number;z:number},fov:number,aspect:number){
  const bounds=new THREE.Box3().setFromPoints([...points]);
  const target=bounds.getCenter(new THREE.Vector3());
  const direction=new THREE.Vector3(-heading.x,1.5,-heading.z).normalize();
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
  const up=new THREE.Vector3().crossVectors(direction,right).normalize();
  const tanV=Math.tan(THREE.MathUtils.degToRad(fov/2))*.82,tanH=tanV*aspect;
  let distance=500;
  for(const point of points){
    const delta=point.clone().sub(target);
    distance=Math.max(distance,delta.dot(direction)+Math.max(Math.abs(delta.dot(right))/tanH,Math.abs(delta.dot(up))/tanV));
  }
  return {target,position:target.clone().addScaledVector(direction,distance*1.06)};
}

export type FlyoverCameraPose={position:THREE.Vector3;target:THREE.Vector3};
/** Sample terrain clearance before playback. Seeking, live playback and export
 * interpolate the same track without hundreds of terrain queries per frame. */
export function createFlyoverCameraTrack(duration:number,poseAt:(time:number)=>FlyoverCameraPose,fps=30){
  const count=Math.max(1,Math.ceil(duration*fps)),step=duration/count;
  const poses=Array.from({length:count+1},(_,i)=>poseAt(i*step));
  return (time:number):FlyoverCameraPose=>{
    const t=THREE.MathUtils.clamp(time,0,duration)/step,i=Math.min(count-1,Math.floor(t)),f=t-i;
    return {position:poses[i].position.clone().lerp(poses[i+1].position,f),target:poses[i].target.clone().lerp(poses[i+1].target,f)};
  };
}

/** Follow the surrounding route corridor instead of locking the camera onto
 * each bend of the moving marker. The marker itself remains on the real path. */
export function flyoverRouteAnchor(path:PathSampler,distance:number){
  const anchor=new THREE.Vector3();let weight=0;
  for(const [offset,w] of [[-1000,1],[-500,2],[0,3],[500,2],[1000,1]]){
    const point=path.pointAt(distance+offset);anchor.addScaledVector(new THREE.Vector3(point.x,point.y,point.z),w);weight+=w;
  }
  return anchor.multiplyScalar(1/weight);
}
