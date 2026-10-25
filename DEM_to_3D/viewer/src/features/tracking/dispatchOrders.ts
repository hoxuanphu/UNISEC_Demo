import { analyseRoadJourney } from '../routes/journeyAnalysis';
import { nearestRoadAnchor } from '../routes/selectedRoadJourney';
import { measure, deviceSpeeds, deviceTimeLapse, type DevicePosition } from './deviceFeed';
import { simulationPoint } from '../routes/routeSimulation';
import type { RoadSegment } from '../../types/dear';
import type { RescueBase } from './rescueBase';
type Point = {x:number;y:number};
export type DispatchTarget = {id:string;name:[string,string];point:Point};
export type DispatchOrder = {schema:1;id:string;at:number;target:DispatchTarget;teamId:string;baseId:string;points:Point[];roadIds:string[];gapM:number;recalledAt?:number};
export const dispatchTeamId='CH-05';
const gap=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const allowed=(roads:RoadSegment[])=>roads.filter(road=>road.status!=='blocked'&&!road.landslideAreaId);

/** A dispatch ends on an actual connected road. The remaining offset is never drawn as a path. */
export function planDispatch(roads:RoadSegment[],bases:readonly RescueBase[],target:DispatchTarget,at:number):DispatchOrder|null {
  const open=allowed(roads);
  const key=(p:Point)=>`${p.x},${p.y}`;
  const options=bases.flatMap(base=>{
    const start=nearestRoadAnchor(open,base.projected,300);if(!start)return[];
    const first=open.find(road=>road.id===start.roadId)!;
    const nodes=new Set([key(first.points[0]),key(first.points.at(-1)!)]),connected=new Set([first.id]);
    let changed=true;
    while(changed){changed=false;for(const road of open){if(connected.has(road.id))continue;
      if(nodes.has(key(road.points[0]))||nodes.has(key(road.points.at(-1)!))){connected.add(road.id);nodes.add(key(road.points[0]));nodes.add(key(road.points.at(-1)!));changed=true;}
    }}
    // A cut can separate the nearest road from the base. Approach on the base's
    // connected component, then stop; the remaining offset stays unverified.
    const reachable=open.filter(road=>connected.has(road.id)),end=nearestRoadAnchor(reachable,target.point,5000);if(!end)return[];
    const route=analyseRoadJourney(reachable,{origin:base.projected,source:base.id},{origin:end.point,source:target.id},true,600,'rescue-foot').route;
    if(!route)return[];
    const path=measure(route);return path?[{base,route,path,offset:end.distance}]:[];
  }).sort((a,b)=>a.offset-b.offset||a.path.total-b.path.total);
  const best=options[0];if(!best)return null;
  return {schema:1,id:crypto.randomUUID(),at,target,teamId:dispatchTeamId,baseId:best.base.id,points:best.path.points,
    roadIds:[...new Set(best.route.segs.map(seg=>roads.find(road=>road.id===seg.id)?.id??[...roads].sort((a,b)=>b.id.length-a.id.length).find(road=>seg.id.startsWith(road.id+':part:'))?.id??seg.id))],gapM:gap(best.path.points.at(-1)!,target.point)};
}
/** Stored routes are rechecked against the current road assessment before any movement resumes. */
export function restoreDispatch(raw:unknown,roads:RoadSegment[],bases:readonly RescueBase[]):DispatchOrder|null {
  const o=raw as DispatchOrder;if(!o||o.schema!==1||o.teamId!==dispatchTeamId||typeof o.id!=='string'||!Number.isFinite(o.at)||o.at<0||
    !o.target||typeof o.target.id!=='string'||!Array.isArray(o.target.name)||o.target.name.length!==2||!o.target.name.every(s=>typeof s==='string'&&s.length<=200)||
    !Number.isFinite(o.target.point?.x)||!Number.isFinite(o.target.point?.y)||!Number.isFinite(o.gapM)||o.gapM<0||
    !Array.isArray(o.points)||o.points.length<2||o.points.length>10000||!o.points.every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y))||
    (o.recalledAt!==undefined&&(!Number.isFinite(o.recalledAt)||o.recalledAt<o.at))||
    !Array.isArray(o.roadIds)||!o.roadIds.length||!o.roadIds.every(id=>typeof id==='string'))return null;
  const base=bases.find(base=>base.id===o.baseId),open=allowed(roads).filter(road=>o.roadIds.includes(road.id));
  if(!base||gap(base.projected,o.points[0])>300||o.points.some(point=>!nearestRoadAnchor(open,point,2)))return null;
  for(let i=1;i<o.points.length;i++){
    const a=o.points[i-1],b=o.points[i],steps=Math.ceil(gap(a,b)/50);
    for(let j=1;j<steps;j++)if(!nearestRoadAnchor(open,{x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps},3))return null;
  }
  return o;
}
/** Signals continue while the team holds at the approach. Arrival does not certify evacuation. */
export function dispatchPosition(order:DispatchOrder,roads:RoadSegment[],now:number):DevicePosition|null {
  const path=measure({points:order.points});if(!path)return null;
  const elapsed=Math.max(0,((order.recalledAt??now)-order.at)/1000-2),outbound=Math.min(path.total,elapsed*deviceSpeeds.rescue*deviceTimeLapse);
  const stationM=order.recalledAt?Math.max(0,outbound-Math.max(0,(now-order.recalledAt)/1000)*deviceSpeeds.rescue*deviceTimeLapse):outbound;
  const point=simulationPoint(path,stationM),anchor=nearestRoadAnchor(allowed(roads).filter(road=>order.roadIds.includes(road.id)),point,3);
  const road=roads.find(road=>road.id===anchor?.roadId);if(!road)return null;
  return {id:dispatchTeamId,role:'rescue',name:['Đội cứu hộ 05','Rescue team 05'],point,stationM,updatedAt:Math.floor(now/1000)*1000,
    state:order.recalledAt?stationM>0?'moving':'arrived':now-order.at<2000?'dispatching':stationM<path.total?'responding':order.target.id.startsWith('household:')||order.gapM>30?'waiting':'assisting',
    approachGapM:order.gapM,roadId:road.id,roadName:road.name,roadStatus:road.status,baseId:order.baseId,targetId:order.recalledAt?undefined:order.target.id,targetName:order.target.name,missionId:'dispatch:'+order.id,source:'scenario'};
}
