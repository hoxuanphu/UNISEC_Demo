import type { ContextArea, MapContextGeometry } from '../map/contextGeometry';
import type { ScenarioRoute } from '../../types/dear';
import type { JourneyEndpoint } from '../routes/journeyAnalysis';
import { nearestRoadAnchor, roadProjected } from '../routes/selectedRoadJourney';
import type { PreparedPhotoPoint } from '../fieldPhotos/preparedPhotos';
import { referencePhoto, type FlyoverInput } from '../flyover/flyoverInput';
import type { LocalNetwork } from './localNetwork';
import { roadAreaContact } from './roadAreaContact';
import { roadCondition } from '../routes/roadConditions';
import type { HouseholdAccess } from '../presence/householdIsolation';

/** A stop is a slide the road actually meets: its mapped edge within this distance of the route. */
export const FILM_STOP_EDGE_M = 50;

/** Every mapped slide the road actually meets, with where it meets it. */
function routeLandslides(route:ScenarioRoute,areas:ContextArea[]) {
  return areas.filter(a=>a.kind==='landslide').flatMap(area=>{
    // Measured from the extent's edge, not its centre: a scar up the slope is not on the road.
    const contact=roadAreaContact(route.points,area.coordinates.map(([lon,lat])=>roadProjected(lat,lon)));
    if(!contact||contact.distanceM>FILM_STOP_EDGE_M)return [];
    const anchor={station:contact.station,distance:contact.distanceM};
    const segment=nearestRoadAnchor(route.segs,area.center,700);
    const difficult=route.segs.find(road=>road.id===segment?.roadId)?.status==='uncertain';
    return [{area,station:anchor.station,offset:anchor.distance,difficult}];
  });
}

/** The same area IDs drive map selection, stop highlights and illustrative photos. */
export function localRouteStops(route:ScenarioRoute,areas:ContextArea[]) {
  const candidates=routeLandslides(route,areas).sort((a,b)=>Number(b.difficult)-Number(a.difficult)||a.offset-b.offset||a.area.id.localeCompare(b.area.id));
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

/** Commune place names in both languages, as the resident map shows them. */
const placeName=(name:string):[string,string]=>[name.replace(/^Village /,'Bản ').replace(/^Helipad$/,'Bãi đáp'),name];

/** Separate runs of difficult road along the route, not every short part of one. */
function difficultSections(route:ScenarioRoute) {
  let count=0,previous=false;
  for(const road of route.segs){const difficult=['risk','uncertain'].includes(roadCondition(road));if(difficult&&!previous)count++;previous=difficult;}
  return count;
}

export function buildLocalFlyover(network:LocalNetwork,context:MapContextGeometry,route:ScenarioRoute|null,
  start:JourneyEndpoint|null,end:JourneyEndpoint|null,photos:Map<string,PreparedPhotoPoint>,households:HouseholdAccess[]=[]):FlyoverInput|null {
  if(!route||!start||!end)return null;
  const stops=localRouteStops(route,context.areas).map(({area})=>({id:area.id,name:area.name,projected:area.center,status:'suspected' as const,
    photo:illustrativePhotoForArea(area.id,photos),photoRole:'illustrative' as const,photoCaption:['Ảnh khảo sát Chế Tạo, chưa xác nhận vùng này','Chế Tạo survey photo, not evidence for this extent'] as [string,string]}));
  // Real road vertices, not unoccupied rectangle corners. Preserve each road's
  // extrema so the final frame includes its full extent without excessive empty land.
  const overviewPoints=network.roads.flatMap(road=>{
    const stride=Math.max(1,Math.floor(road.points.length/24));
    const samples=road.points.filter((_,i)=>i%stride===0);
    for(const axis of ['x','y'] as const){samples.push(road.points.reduce((a,b)=>a[axis]<b[axis]?a:b),road.points.reduce((a,b)=>a[axis]>b[axis]?a:b));}
    samples.push(road.points.at(-1)!);return samples;
  });
  const from=placeName(start.label??'A'),to=placeName(end.label??'B');
  const km=(locale:string)=>route.lengthKm.toLocaleString(locale,{maximumFractionDigits:1});
  const slides=routeLandslides(route,context.areas).length,difficult=difficultSections(route);
  const alerts=households.filter(item=>item.isolated).map(item=>({id:item.cluster.id,projected:item.projected,people:item.cluster.people}));
  return {key:JSON.stringify([route.id,stops.map(stop=>[stop.id,stop.photo?.image.sha256]),network.source.sha256,alerts]),
    route:route.points,start:from,end:to,stops,alerts,
    summary:{title:[`${from[0]} đến ${to[0]}`,`${from[1]} to ${to[1]}`],stats:[
      {value:[km('vi-VN'),km('en-GB')],label:['km','km']},
      {value:[String(slides),String(slides)],label:['điểm sạt trên tuyến',slides===1?'landslide on route':'landslides on route']},
      {value:[String(difficult),String(difficult)],label:['đoạn khó đi',difficult===1?'difficult section':'difficult sections']}]},
    areas:context.areas.filter(a=>a.kind==='landslide').map(a=>({id:a.id,center:a.center,radius:a.radius})),
    overviewPoints,imagery:[],imageryOpacity:1,imageryLabel:['Ảnh nền vệ tinh','Satellite basemap'],
    cameraMode:'network',retainContext:true,context,
    places:network.places.map(place=>({name:placeName(place.name),kind:place.kind==='hlz'?'hlz' as const:'community' as const,projected:place.projected}))};
}
