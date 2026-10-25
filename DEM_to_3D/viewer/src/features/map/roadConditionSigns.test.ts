import { describe, expect, it } from 'vitest';
import { absorbedCondition, HAZARD_SIGN_MERGE_M, roadConditionSigns } from './roadConditionSigns';
import type { RoadSegment } from '../../types/dear';
const road: RoadSegment = {id:'local-road',name:['Đường','Road'],cls:'track',len:.2,status:'blocked',points:[{x:0,y:0},{x:10,y:0},{x:10,y:190}]};
describe('shared road warning locations',()=>{
  it('uses distance along the road, not its vertex index or polygon centre',()=>{
    expect(roadConditionSigns([road])[0].point).toEqual({x:10,y:90});
    const point={x:10,y:170};
    expect(roadConditionSigns([{...road,landslideAreaId:'extent'}],[{roadId:road.id,areaId:'extent',state:'occurred',roadPoint:point,areaPoint:{x:15,y:170},distanceM:5}])[0].point).toEqual(point);
  });
  it('shows one closure convention and a separate risk convention, never calling an ordinary unknown road blocked',()=>{
    expect(roadConditionSigns([{...road,hz:'landslide-risk'}])[0].condition).toBe('blocked');
    expect(roadConditionSigns([{...road,status:'uncertain',hz:'landslide-risk'}])[0].condition).toBe('risk');
    expect(roadConditionSigns([{...road,status:'uncertain'}])).toEqual([]);
    expect(roadConditionSigns([{...road,status:'open'}])).toEqual([]);
  });
  it('keeps warnings on separate nearby roads instead of hiding one as a duplicate',()=>{
    expect(roadConditionSigns([road,{...road,id:'another-road'}])).toHaveLength(2);
    expect(roadConditionSigns([road,{...road,id:'local-road:part:0'}])).toHaveLength(1);
  });
  it('keeps one sign beside the extent when splitting a continuous blocked road',()=>{
    const before={...road,id:'local-road:condition:0',points:[{x:0,y:0},{x:100,y:0}]};
    const affected={...road,id:'local-road:condition:1',landslideAreaId:'extent',points:[{x:100,y:0},{x:170,y:0}]};
    const after={...road,id:'local-road:condition:2',points:[{x:170,y:0},{x:300,y:0}]};
    const signs=roadConditionSigns([before,affected,after]);
    expect(signs).toHaveLength(1);
    expect(signs[0].road.id).toBe(affected.id);
  });
  it('lets a shown landslide pin stand in for the sign at the same slide, and only there',()=>{
    const sign=roadConditionSigns([road])[0];
    const atSlide={x:sign.point.x+HAZARD_SIGN_MERGE_M-1,y:sign.point.y},elsewhere={x:sign.point.x+HAZARD_SIGN_MERGE_M+1,y:sign.point.y};
    expect(roadConditionSigns([road],[],[atSlide])).toEqual([]);
    expect(roadConditionSigns([road],[],[elsewhere])).toHaveLength(1);
    expect(absorbedCondition([sign],atSlide)).toBe('blocked');
    expect(absorbedCondition([sign],elsewhere)).toBeUndefined();
  });
});
