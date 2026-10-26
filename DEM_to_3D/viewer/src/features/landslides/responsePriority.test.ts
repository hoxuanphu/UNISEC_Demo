import {expect,it} from 'vitest';
import type {RoadSegment} from '../../types/dear';
import {areaResponsePriority} from './responsePriority';
const road={id:'road',status:'blocked',landslideAreaId:'slide'} as RoadSegment;
it('prioritises the mapped area linked to a blocked road, without prioritising unrelated extents',()=>{
 expect(areaResponsePriority('slide',[road])).toBe('urgent');expect(areaResponsePriority('elsewhere',[road])).toBe('routine');
});
it('prioritises households awaiting access and explicit current-network road links',()=>{
 expect(areaResponsePriority('hut-cut',[],[],true)).toBe('urgent');expect(areaResponsePriority('imported',[road],['road'])).toBe('urgent');
});
it('keeps unverified impacts distinct from recorded blockage',()=>{
 expect(areaResponsePriority('slide',[{...road,status:'uncertain'}])).toBe('review');expect(areaResponsePriority('imported',[],[],false,true)).toBe('review');
});
