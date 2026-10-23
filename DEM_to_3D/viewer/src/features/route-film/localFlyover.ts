import type { ContextArea, MapContextGeometry } from '../map/contextGeometry';
import type { ScenarioRoute } from '../../types/dear';
import type { JourneyEndpoint } from '../routes/journeyAnalysis';
import { nearestRoadAnchor } from '../routes/selectedRoadJourney';
import type { PreparedPhotoPoint } from '../fieldPhotos/preparedPhotos';
import { referencePhoto, type FlyoverInput } from '../flyover/flyoverInput';
import type { LocalNetwork } from './localNetwork';

/** The same area IDs drive map selection, stop highlights and illustrative photos. */
export function localRouteStops(route:ScenarioRoute,areas:ContextArea[]) {
  const line={...route.segs[0],id:'local-film-path',points:route.points};
  const candidates=areas.filter(a=>a.kind==='landslide').flatMap(area=>{
    const anchor=nearestRoadAnchor([line],area.center,450+Math.min(200,area.radius));
    if(!anchor)return [];
    const segment=nearestRoadAnchor(route.segs,area.center,700);
    const difficult=route.segs.find(road=>road.id===segment?.roadId)?.status==='uncertain';
    return [{area,station:anchor.station,offset:anchor.distance,difficult}];
  }).sort((a,b)=>Number(b.difficult)-Number(a.difficult)||a.offset-b.offset||a.area.id.localeCompare(b.area.id));
  const selected:typeof candidates=[];
  for(const candidate of candidates){
    if(selected.every(item=>Math.abs(item.station-candidate.station)>Math.max(300,route.lengthKm*1000/8)))selected.push(candidate);
    if(selected.length===3)break;
  }
  return selected.sort((a,b)=>a.station-b.station);
}

export function illustrativePhotoForArea(id:string,photos:Map<string,PreparedPhotoPoint>) {
  const examples=[...photos.values()].map(referencePhoto).filter((p):p is NonNullable<typeof p>=>!!p);
  const index=[...id].reduce((sum,char)=>sum+char.charCodeAt(0),0);
  return examples.length?examples[index%examples.length]:undefined;
}

export function buildLocalFlyover(network:LocalNetwork,context:MapContextGeometry,route:ScenarioRoute|null,
  start:JourneyEndpoint|null,end:JourneyEndpoint|null,photos:Map<string,PreparedPhotoPoint>):FlyoverInput|null {
  if(!route||!start||!end)return null;
  const stops=localRouteStops(route,context.areas).map(({area})=>({id:area.id,name:area.name,projected:area.center,status:'suspected' as const,
    photo:illustrativePhotoForArea(area.id,photos),photoRole:'illustrative' as const,photoCaption:['Ảnh minh họa, không xác nhận vị trí này','Illustrative photo, not evidence for this location'] as [string,string]}));
  // Real road vertices, not unoccupied rectangle corners. Preserve each road's
  // extrema so the final frame includes its full extent without excessive empty land.
  const overviewPoints=network.roads.flatMap(road=>{
    const stride=Math.max(1,Math.floor(road.points.length/24));
    const samples=road.points.filter((_,i)=>i%stride===0);
    for(const axis of ['x','y'] as const){samples.push(road.points.reduce((a,b)=>a[axis]<b[axis]?a:b),road.points.reduce((a,b)=>a[axis]>b[axis]?a:b));}
    samples.push(road.points.at(-1)!);return samples;
  });
  return {key:JSON.stringify([route.id,stops.map(stop=>[stop.id,stop.photo?.image.sha256]),network.source.sha256]),
    route:route.points,start:[start.label??'A',start.label??'A'],end:[end.label??'B',end.label??'B'],stops,
    areas:context.areas.filter(a=>a.kind==='landslide').map(a=>({id:a.id,center:a.center,radius:a.radius})),
    overviewPoints,imagery:[],imageryOpacity:1,imageryLabel:['Ảnh nền vệ tinh','Satellite basemap'],
    cameraMode:'network',retainContext:true,context};
}
