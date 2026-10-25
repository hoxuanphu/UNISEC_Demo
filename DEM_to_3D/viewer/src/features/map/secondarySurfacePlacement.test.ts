import {describe,expect,it} from 'vitest';
import {placeSecondarySurface,surfacesOverlap} from './secondarySurfacePlacement';
const bounds={left:12,top:60,width:900,height:650};
const mini={left:20,top:350,width:248,height:320};
describe('secondary map clearance',()=>{
 it('keeps its expanded location when primary work is elsewhere',()=>{expect(placeSecondarySurface(mini,bounds,[{left:600,top:80,width:300,height:500}])).toEqual({compact:false,rect:mini});});
 it('folds at the same corner when a case covers only the upper map',()=>{const obstacle={left:20,top:80,width:450,height:500};const result=placeSecondarySurface(mini,bounds,[obstacle]);expect(result.compact).toBe(true);expect(result.rect).toEqual({left:20,top:632,width:248,height:38});expect(surfacesOverlap(result.rect!,obstacle)).toBe(false);});
 it('does not move sideways when the anchored pill is occupied by the legend',()=>{const obstacles=[{left:20,top:350,width:450,height:200},{left:12,top:620,width:350,height:80}];const result=placeSecondarySurface(mini,bounds,obstacles);expect(result).toEqual({compact:true,rect:null});});
 it('keeps a manually positioned heading fixed while folding its map',()=>{const obstacle={left:20,top:450,width:450,height:220};expect(placeSecondarySurface(mini,bounds,[obstacle],136,38,'top-left')).toEqual({compact:true,rect:{left:20,top:350,width:136,height:38}});});
 it('keeps a legend anchored on the left when its contents fold',()=>{const obstacle={left:20,top:80,width:450,height:500};expect(placeSecondarySurface(mini,bounds,[obstacle],100,38,'bottom-left')).toEqual({compact:true,rect:{left:20,top:632,width:100,height:38}});});
 it('yields entirely when a primary surface occupies the available map',()=>{expect(placeSecondarySurface(mini,bounds,[bounds]).rect).toBeNull();});
 it('restores expansion after the occupying case closes',()=>{const obstacle={...mini};expect(placeSecondarySurface(mini,bounds,[obstacle]).compact).toBe(true);expect(placeSecondarySurface(mini,bounds,[]).compact).toBe(false);});
});
