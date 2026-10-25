import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createFlyoverBearing,createFlyoverCameraTrack,flyoverRouteAnchor,flyoverOverviewPose} from './flyoverCamera';
import {createPathSampler,planFlyover} from './flyoverPlan';

describe('tracking camera',()=>{
  const path=createPathSampler(Array.from({length:121},(_,i)=>({x:Math.sin(i/12)*1300,y:100,z:i*220})),10,700);
  const plan=planFlyover(path.length,[14000,18000,22000]);
  const bearing=createFlyoverBearing(path,plan);
  const angle=(t:number)=>{const h=bearing(t);return Math.atan2(h.x,h.z);};
  const delta=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
  it('follows the route with bounded yaw speed and acceleration, including arrivals',()=>{
    let previousSpeed=0;
    for(let i=1;i<=Math.ceil(plan.duration*60);i++){
      const speed=delta(angle((i-1)/60),angle(i/60))*60;
      expect(Math.abs(speed)).toBeLessThanOrEqual(Math.PI/10+1e-8);
      expect(Math.abs(speed-previousSpeed)*60).toBeLessThanOrEqual(.65+1e-7);
      previousSpeed=speed;
    }
    expect(Math.abs(angle(0)-angle(plan.duration))).toBeGreaterThan(.05);
  });
  it('gives identical orientations when seeking backwards or exporting at a different frame rate',()=>{
    const expected=bearing(7.25);
    bearing(19);bearing(2);
    expect(bearing(7.25)).toEqual(expected);
    expect(Math.hypot(expected.x,expected.z)).toBeCloseTo(1,12);
    expect(bearing(-1)).toEqual(bearing(0));
    expect(bearing(100)).toEqual(bearing(plan.duration));
  });
});

it.each([16/9,1,9/16])('fits the entire corridor in the final shot at aspect %s',aspect=>{
  const points=[new THREE.Vector3(-6500,200,-14000),new THREE.Vector3(5500,2800,13000),new THREE.Vector3(1000,1600,500)];
  const camera=new THREE.PerspectiveCamera(45,aspect,1,1000000);
  const pose=flyoverOverviewPose(points,{x:.2,z:.98},45,aspect);
  camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld();
  for(const p of points){const ndc=p.clone().project(camera);expect(Math.abs(ndc.x)).toBeLessThan(.9);expect(Math.abs(ndc.y)).toBeLessThan(.9);expect(ndc.z).toBeLessThan(1);}
});

it('bakes clearance once and gives identical camera positions during playback, seeking and export',()=>{
  let samples=0;
  const track=createFlyoverCameraTrack(25,t=>{samples++;return {position:new THREE.Vector3(t*20,100+t*2,-t*10),target:new THREE.Vector3(t*20,0,-t*10-100)};});
  expect(samples).toBe(751);
  const expected=track(12.345);track(22);track(1);
  expect(track(12.345)).toEqual(expected);
  expect(expected.position.x).toBeCloseTo(246.9);expect(expected.position.y).toBeCloseTo(124.69);
  expect(samples).toBe(751);
  expected.position.set(0,0,0);expect(track(12.345).position.x).toBeCloseTo(246.9);
  expect(track(-1)).toEqual(track(0));expect(track(99)).toEqual(track(25));
});

it('eases a camera that would start moving at once, without changing where it holds',()=>{
  // Still for 5 s, then 200 m/s: a hard start, as when a framing window begins to slide.
  const pose=(t:number)=>({position:new THREE.Vector3(Math.max(0,t-5)*200,500,0),target:new THREE.Vector3(Math.max(0,t-5)*200,0,-500)});
  const track=createFlyoverCameraTrack(10,pose,30,.5);
  const speed=(t:number)=>(track(t+1/30).position.x-track(t).position.x)*30;
  expect(track(0).position.x).toBeCloseTo(0,3);expect(track(3).position.x).toBeCloseTo(0,3);
  let previous=speed(0);
  for(let t=1/30;t<9;t+=1/30){const next=speed(t);expect(Math.abs(next-previous)).toBeLessThan(20);previous=next;}
  expect(speed(8)).toBeCloseTo(200,0);
});

it('holds the surrounding corridor through a hairpin while the real marker follows the road',()=>{
  const path=createPathSampler([{x:0,y:100,z:0},{x:900,y:120,z:0},{x:900,y:140,z:900}],10,700);
  const corner=path.pointAt(900),anchor=flyoverRouteAnchor(path,900);
  expect(corner.x).toBe(900);expect(corner.z).toBe(0);
  expect(anchor.x).toBeLessThan(corner.x);expect(anchor.z).toBeGreaterThan(corner.z);
  expect(anchor.distanceTo(new THREE.Vector3(corner.x,corner.y,corner.z))).toBeLessThan(300);
  expect(anchor.y).toBeGreaterThanOrEqual(100);expect(anchor.y).toBeLessThanOrEqual(140);
  const camera=new THREE.PerspectiveCamera(45,16/9,1,100000);
  camera.position.copy(anchor).add(new THREE.Vector3(-1280,1020,0));camera.lookAt(anchor.clone().add(new THREE.Vector3(220,18,0)));camera.updateMatrixWorld();
  for(const distance of [400,900,1400]){
    const point=path.pointAt(distance),projected=new THREE.Vector3(point.x,point.y,point.z).project(camera);
    expect(Math.abs(projected.x)).toBeLessThan(.9);expect(Math.abs(projected.y)).toBeLessThan(.9);
  }
});
