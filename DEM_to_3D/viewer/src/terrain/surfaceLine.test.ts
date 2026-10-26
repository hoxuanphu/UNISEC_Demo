import {describe,it,expect} from 'vitest';
import {surfaceLineGeometry,stabiliseSurfaceLine} from './surfaceLine';
import {LineMaterial} from 'three/examples/jsm/lines/LineMaterial.js';
describe('terrain line GPU input',()=>{
  it('removes float-collapsed intersections without shifting the surviving vertices',()=>{
    const geometry=surfaceLineGeometry([20000,0,20000,20000.0001,0,20000.0001,20020,1,20030]);
    const start=geometry.attributes.instanceStart,end=geometry.attributes.instanceEnd;
    expect(start.count).toBe(1);expect([start.getX(0),start.getY(0),start.getZ(0)]).toEqual([20000,0,20000]);
    expect([end.getX(0),end.getY(0),end.getZ(0)]).toEqual([20020,1,20030]);geometry.dispose();
  });
  it('does not create a segment from a collapsed line and rejects non-finite input',()=>{
    const geometry=surfaceLineGeometry([1,2,3,1,2,3]);expect(geometry.instanceCount).toBe(0);geometry.dispose();
    expect(()=>surfaceLineGeometry([1,2,3,NaN,2,3])).toThrow();
  });
  it('preserves material opacity in both antialiased cap shader branches',()=>{
    const material=stabiliseSurfaceLine(new LineMaterial());
    const shader={vertexShader:'// clip space\ndir = normalize( dir );',fragmentShader:'alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );\nalpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );'} as Parameters<typeof material.onBeforeCompile>[0];
    material.onBeforeCompile(shader,null as unknown as Parameters<typeof material.onBeforeCompile>[1]);
    expect(shader.fragmentShader.match(/alpha = opacity \*/g)).toHaveLength(2);
    expect(material.alphaToCoverage).toBe(true);expect(material.depthTest).toBe(true);material.dispose();
  });
  it('keeps road width in screen units and depth-tests against the terrain',()=>{
    const material=stabiliseSurfaceLine(new LineMaterial({linewidth:1.8,depthTest:true}));
    expect(material.worldUnits).toBe(false);expect(material.depthTest).toBe(true);expect(material.linewidth).toBe(1.8);material.dispose();
  });
});
