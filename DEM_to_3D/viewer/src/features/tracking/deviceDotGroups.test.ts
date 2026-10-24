import { describe,expect,it } from 'vitest';
import { groupDeviceDots } from './deviceDotGroups';
describe('geographically anchored device groups',()=>{
  it('groups coincident devices without moving any displayed anchor',()=>{
    const points=Array.from({length:8},(_,i)=>({id:String(i),x:120,y:100})),before=structuredClone(points);
    expect(groupDeviceDots(points)).toEqual([{id:'0',x:120,y:100,members:points.map(p=>p.id)}]);
    expect(points).toEqual(before);
  });
  it('splits on zoom at exact member positions and remains independent of source ordering',()=>{
    const world=[{id:'CH-01',x:20,y:30},{id:'ND-01',x:24,y:30},{id:'ND-02',x:25,y:30}];
    for(const zoom of [1,2,8,16,2,1]){
      const projected=world.map(p=>({...p,x:p.x*zoom,y:p.y*zoom})),groups=groupDeviceDots(projected);
      expect(groupDeviceDots([...projected].reverse())).toEqual(groups);
      expect(groups.flatMap(g=>g.members).sort()).toEqual(world.map(p=>p.id).sort());
      for(const group of groups)expect({id:group.id,x:group.x,y:group.y}).toEqual(projected.find(p=>p.id===group.id));
      if(zoom===1)expect(groups).toHaveLength(1);
      if(zoom===16)expect(groups).toHaveLength(2);
    }
  });
  it('does not drag screen-edge points inward or invent locations around a closure',()=>{
    const points=[{id:'a',x:0,y:0},{id:'b',x:100,y:100}];
    expect(groupDeviceDots(points)).toEqual(points.map(point=>({...point,members:[point.id]})));
    expect(groupDeviceDots([])).toEqual([]);
  });
});
