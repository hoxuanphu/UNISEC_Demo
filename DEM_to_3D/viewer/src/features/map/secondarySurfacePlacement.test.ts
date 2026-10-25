import {describe,expect,it} from 'vitest';
import {placeSecondarySurface,surfacesOverlap} from './secondarySurfacePlacement';
const bounds={left:12,top:60,width:900,height:650};
const mini={left:20,top:350,width:248,height:320};
describe('secondary map clearance',()=>{
 it('keeps its expanded location when primary work is elsewhere',()=>{expect(placeSecondarySurface(mini,bounds,[{left:600,top:80,width:300,height:500}])).toEqual({compact:false,rect:mini});});
 it('compacts a map covered by a dragged case and finds a free header slot',()=>{const obstacle={left:20,top:80,width:450,height:500};const result=placeSecondarySurface(mini,bounds,[obstacle]);expect(result.compact).toBe(true);expect(result.rect).not.toBeNull();expect(surfacesOverlap(result.rect!,obstacle)).toBe(false);});
 it('never lays a compact header over the legend',()=>{const obstacles=[{left:20,top:350,width:450,height:200},{left:12,top:620,width:350,height:80}];const result=placeSecondarySurface(mini,bounds,obstacles);expect(result.rect).not.toBeNull();expect(obstacles.some(rect=>surfacesOverlap(result.rect!,rect))).toBe(false);});
 it('yields entirely when a primary surface occupies the available map',()=>{expect(placeSecondarySurface(mini,bounds,[bounds]).rect).toBeNull();});
 it('restores expansion after the occupying case closes',()=>{const obstacle={...mini};expect(placeSecondarySurface(mini,bounds,[obstacle]).compact).toBe(true);expect(placeSecondarySurface(mini,bounds,[]).compact).toBe(false);});
});
