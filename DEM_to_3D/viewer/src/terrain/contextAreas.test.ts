import { describe, expect, it, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { shorelineWeight, createContextAreaOverlay } from './contextAreas';
import data from '../../public/scenarios/che-tao/local-network.json';
import { validateLocalNetwork } from '../features/route-film/localNetwork';
import { networkContext } from '../features/route-film/networkContext';
const context=networkContext(validateLocalNetwork(data));
afterEach(()=>vi.unstubAllGlobals());
describe('draped reference polygons',()=>{
  it('fades the shore continuously into the land without moving boundary coordinates',()=>{
    const ring=[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100},{x:0,y:0}];
    expect(shorelineWeight({x:0,y:50},ring)).toBe(0);
    expect(shorelineWeight({x:12,y:50},ring)).toBeCloseTo(.5);
    expect(shorelineWeight({x:30,y:50},ring)).toBe(1);
    expect(shorelineWeight({x:6,y:50},ring)).toBeLessThan(shorelineWeight({x:12,y:50},ring));
  });
  it('builds only surface meshes/outlines for landslides, and highlights their actual polygon',()=>{
    vi.stubGlobal('document',{createElement:()=>({append:vi.fn(),remove:vi.fn(),setAttribute:vi.fn(),style:{}})});
    const area=context.areas.find(area=>area.kind==='landslide')!;
    const overlay=createContextAreaOverlay({append:vi.fn()} as unknown as HTMLElement,{areas:[area],closures:[]},null,p=>new THREE.Vector3(p.x,100,-p.y),'en',()=>true,{width:1920,height:1080});
    try {
      expect(overlay.group.children.length).toBeGreaterThan(0);
      expect(overlay.group.children.every(object=>object.type==='Mesh'||object.type==='Line2')).toBe(true);
      expect(overlay.group.children.every(object=>object.userData.contextAreaId===area.id)).toBe(true);
      const fill=overlay.group.children.find(object=>object.type==='Mesh') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
      const before=fill.material.opacity;
      overlay.setActiveArea(area.id);expect(fill.material.opacity).toBeGreaterThan(before);
      overlay.setActiveArea(null);expect(fill.material.opacity).toBe(before);
      expect(fill.geometry.getAttribute('position').count).toBeGreaterThan(0);
    }finally{overlay.dispose();}
  });
});
