import type {RoadSegment} from '../../types/dear';
export type ResponsePriority='urgent'|'review'|'routine';
/** Display priority follows recorded impact, never polygon size or a guessed severity. */
export function areaResponsePriority(id:string,roads:readonly RoadSegment[],roadIds:readonly string[]=[],needsAccess=false,unreviewed=false):ResponsePriority {
 const linked=roads.filter(road=>roadIds.includes(road.id)||road.landslideAreaId===id||road.landslideAreaIds?.includes(id));
 if(needsAccess||linked.some(road=>road.status==='blocked'))return 'urgent';
 if(unreviewed||linked.some(road=>road.status==='uncertain'||road.hz==='landslide-risk'))return 'review';
 return 'routine';
}
