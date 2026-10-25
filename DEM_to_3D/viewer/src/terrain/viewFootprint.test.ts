import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { viewFootprint } from './viewFootprint';
const camera=(distance:number,target=new THREE.Vector3())=>{const c=new THREE.PerspectiveCamera(45,1.6,1,100000);c.position.copy(target).add(new THREE.Vector3(0,distance,distance));c.lookAt(target);c.updateMatrixWorld();return c;};
describe('3D view footprint',()=>{
  it('tracks zoom and pan in map coordinates',()=>{
    const target=new THREE.Vector3(),near=viewFootprint(camera(500),target),far=viewFootprint(camera(1000),target);
    const span=(p:THREE.Vector3[])=>Math.max(...p.map(p=>p.x))-Math.min(...p.map(p=>p.x));
    expect(span(far)).toBeCloseTo(span(near)*2);
    const shifted=new THREE.Vector3(1200,0,2300),pan=viewFootprint(camera(500,shifted),shifted);
    expect(pan[0].x-near[0].x).toBeCloseTo(1200);expect(pan[0].z-near[0].z).toBeCloseTo(2300);
    expect(near.every(p=>p.y===0&&Number.isFinite(p.x)&&Number.isFinite(p.z))).toBe(true);
  });
  it('keeps horizon-facing views finite',()=>{
    const c=camera(500);c.lookAt(0,500,-1000);c.updateMatrixWorld();
    expect(viewFootprint(c,new THREE.Vector3()).every(p=>p.length()<=100000)).toBe(true);
  });
});
