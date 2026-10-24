import { describe,expect,it } from 'vitest';
import { layoutDeviceDots } from './deviceDotLayout';
const anchor={id:'ND-01',x:120,y:100};
describe('compact operational dot placement',()=>{
  it('keeps uncrowded locations on their true screen anchor',()=>{
    expect(layoutDeviceDots([anchor],[],300,240)).toEqual([{...anchor,anchorX:120,anchorY:100}]);
  });
  it('separates eight collocated devices, preserves coordinates and stays independent of feed ordering',()=>{
    const points=Array.from({length:8},(_,i)=>({...anchor,id:String(i)}));
    const before=structuredClone(points),placed=layoutDeviceDots(points,[],300,240);
    for(const [i,point] of placed.entries()){
      expect(point.anchorX).toBe(120);expect(point.anchorY).toBe(100);
      expect(Math.hypot(point.x-point.anchorX,point.y-point.anchorY)).toBeLessThanOrEqual(48.00001);
      for(const other of placed.slice(i+1))expect(Math.hypot(point.x-other.x,point.y-other.y)).toBeGreaterThanOrEqual(21.9999);
    }
    expect(points).toEqual(before);expect(layoutDeviceDots([...points].reverse(),[],300,240)).toEqual(placed);
  });
  it('protects road closure signs and keeps the dot within map edges',()=>{
    const obstacle={left:110,top:90,right:130,bottom:110};
    const [dot]=layoutDeviceDots([anchor],[obstacle],300,240);
    expect(Math.hypot(Math.max(obstacle.left-dot.x,0,dot.x-obstacle.right),Math.max(obstacle.top-dot.y,0,dot.y-obstacle.bottom))).toBeGreaterThanOrEqual(8);
    const near=layoutDeviceDots([{id:'1',x:1,y:1},{id:'2',x:1,y:1}],[],100,100);
    for(const point of near){expect(point.x).toBeGreaterThanOrEqual(8);expect(point.y).toBeGreaterThanOrEqual(8);}
    expect(layoutDeviceDots([],[],100,100)).toEqual([]);
  });
});
