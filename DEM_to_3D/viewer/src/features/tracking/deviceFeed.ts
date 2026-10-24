import type { RoadSegment } from '../../types/dear';
import type { LocalRoadAreaLink } from '../route-film/localNetwork';
import { projectedPathLength } from '../../terrain/pathGeometry';
import { nearestRoadAnchor } from '../routes/selectedRoadJourney';
import { simulationPoint } from '../routes/routeSimulation';
export type DeviceRole = 'resident' | 'rescue';
export type DeviceState = 'moving' | 'approaching' | 'waiting' | 'stopped' | 'dispatching' | 'responding' | 'assisting' | 'escorting' | 'arrived';
type Point = {x:number;y:number};
type Path = {points:Point[];stations:number[];total:number};
export type DevicePosition = {
  id:string;role:DeviceRole;name:[string,string];roadId:string;roadName:[string,string];
  roadStatus:RoadSegment['status'];point:Point;stationM:number;state:DeviceState;updatedAt:number;
  missionId?:string;closureRoadId?:string;targetId?:string;targetName?:[string,string];
};
export type DevicePlan = {id:string;role:DeviceRole;name:[string,string];road:RoadSegment;path:Path;from:number;to:number;duration:number;
  missionId?:string;closureRoadId?:string;targetId?:string;targetName?:[string,string];
  timing?:{residentAt:number;dispatchAt:number;rescueAt:number;escortAt:number;finishAt:number;residentStation:number;rescueStation:number;meetingStation:number};
};
function measure(road:RoadSegment):Path|null {
  if(road.points.length<2||road.points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
  const points=road.points.filter((p,i,all)=>!i||Math.hypot(p.x-all[i-1].x,p.y-all[i-1].y)>.00001).map(p=>({...p}));
  const stations=[0];
  for(let i=1;i<points.length;i++)stations.push(stations[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
  const total=stations.at(-1)!;return total>=5?{points,stations,total}:null;
}
const gap=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const named=(role:DeviceRole,number:number):[string,string]=>role==='resident'?[`Người dân ${String(number).padStart(2,'0')}`,`Resident ${String(number).padStart(2,'0')}`]:[`Đội cứu hộ ${String(number).padStart(2,'0')}`,`Rescue team ${String(number).padStart(2,'0')}`];
/** Closed edges remain closed. A rendezvous is on the connected, unblocked side of the closure. */
export function buildDevicePlans(roads:RoadSegment[],links:readonly LocalRoadAreaLink[]=[]):DevicePlan[] {
  const candidates=[...new Map(roads.map(road=>[road.id,road])).values()].filter(road=>!road.id.includes(':part:')&&measure(road))
    .sort((a,b)=>projectedPathLength(b.points)-projectedPathLength(a.points)||a.id.localeCompare(b.id));
  const available=candidates.filter(road=>road.status!=='blocked');
  const clear=available.filter(road=>road.hz!=='landslide-risk');
  const local=clear.filter(road=>road.id.startsWith('local-'));
  const corridor=clear.filter(road=>!road.id.startsWith('local-'));
  const cruising=[...new Map([corridor[0],...local,...clear].filter((road):road is RoadSegment=>!!road).map(road=>[road.id,road])).values()].slice(0,4);
  const plans:DevicePlan[]=cruising.map((road,index)=>{
    const path=measure(road)!,from=.15+(index%3)*.15,to=Math.min(.92,from+Math.min(.4,250/path.total));
    return{id:`ND-${String(index+1).padStart(2,'0')}`,role:'resident',name:named('resident',index+1),road,path,from,to,duration:Math.max(8,(to-from)*path.total/(1.2+index*.1))};
  });
  const rendezvous:Point[]=[];
  const closures=candidates.filter(road=>road.status==='blocked').sort((a,b)=>Number(b.id.startsWith('local-'))-Number(a.id.startsWith('local-'))||a.id.localeCompare(b.id));
  let missions=0;
  for(const closed of closures){
    if(missions===2)break;
    const choices=[closed.points[0],closed.points.at(-1)!].flatMap(end=>available.flatMap(road=>{
      const first=gap(road.points[0],end)<.001,last=gap(road.points.at(-1)!,end)<.001;
      if(!first&&!last)return[];
      const oriented={...road,points:first?[...road.points].reverse():road.points},path=measure(oriented);
      if(!path||path.total<35)return[];
      return[{road,path}];
    })).sort((a,b)=>Number(a.road.hz==='landslide-risk')-Number(b.road.hz==='landslide-risk')||b.path.total-a.path.total||a.road.id.localeCompare(b.road.id));
    const choice=choices.find(c=>!rendezvous.some(point=>gap(point,c.path.points.at(-1)!)<100))??(missions===0?choices[0]:undefined);
    if(!choice)continue;
    const {road,path}=choice;
    const meetingStation=Math.max(0,path.total-8),residentStation=Math.max(0,meetingStation-18-missions*5),rescueStation=Math.max(0,residentStation-75-missions*20);
    // The resident reaches the obstruction first; dispatch follows five seconds later.
    const residentAt=(meetingStation-residentStation)/1.25,dispatchAt=residentAt+5;
    const rescueAt=dispatchAt+(meetingStation-rescueStation)/3;
    const escortAt=rescueAt+12,finishAt=escortAt+(meetingStation-rescueStation)/1.1;
    const timing={residentAt,dispatchAt,rescueAt,escortAt,finishAt,residentStation,rescueStation,meetingStation};
    const missionId=`assist:${closed.id}:${missions+1}`,residentId=`ND-${String(plans.filter(p=>p.role==='resident').length+1).padStart(2,'0')}`,rescueId=`CH-${String(missions+1).padStart(2,'0')}`;
    const residentName=named('resident',Number(residentId.slice(3))),rescueName=named('rescue',missions+1);
    const base={road,path,missionId,closureRoadId:closed.id,timing};
    plans.push({...base,id:residentId,role:'resident',name:residentName,from:residentStation/path.total,to:meetingStation/path.total,duration:residentAt,targetId:rescueId,targetName:rescueName},
      {...base,id:rescueId,role:'rescue',name:rescueName,from:rescueStation/path.total,to:meetingStation/path.total,duration:rescueAt-dispatchAt,targetId:residentId,targetName:residentName});
    rendezvous.push(path.points.at(-1)!);missions++;
  }
  // With no connected approach, keep people waiting on the approach side. Never put a team through a red edge.
  for(const closed of closures){
    if(plans.filter(p=>p.role==='resident').length>=6)break;
    if(plans.some(p=>p.closureRoadId===closed.id))continue;
    const path=measure(closed)!,contacts=links.filter(link=>link.roadId===closed.id||link.roadId===closed.sourceRoadId).flatMap(link=>{
      const at=nearestRoadAnchor([closed],link.roadPoint,100);return at?[at.station]:[];
    });
    const contact=contacts.length?Math.min(...contacts):path.total*.5,forward=contact>=path.total*.5;
    const stop=forward?Math.max(0,contact-40):Math.min(path.total,contact+40);
    const start=forward?Math.max(0,stop-18):Math.min(path.total,stop+18),number=plans.filter(p=>p.role==='resident').length+1;
    plans.push({id:`ND-${String(number).padStart(2,'0')}`,role:'resident',name:named('resident',number),road:closed,path,from:start/path.total,to:stop/path.total,duration:Math.max(1,Math.abs(start-stop)/1.25),closureRoadId:closed.id});
  }
  return plans.sort((a,b)=>a.role.localeCompare(b.role)||a.id.localeCompare(b.id));
}
function locate(plan:DevicePlan,elapsed:number,epoch:number):DevicePosition {
  let stationM=plan.path.total*plan.from,state:DeviceState='stopped';
  const timing=plan.timing;
  if(timing){
    const {residentAt,dispatchAt,rescueAt,escortAt,finishAt,residentStation,rescueStation,meetingStation}=timing;
    if(elapsed>=finishAt){stationM=rescueStation;state='arrived';}
    else if(elapsed>=escortAt){stationM=meetingStation-(meetingStation-rescueStation)*(elapsed-escortAt)/(finishAt-escortAt);state='escorting';}
    else if(plan.role==='resident'){
      stationM=elapsed<residentAt?residentStation+(meetingStation-residentStation)*elapsed/residentAt:meetingStation;
      state=elapsed<residentAt?'approaching':elapsed<rescueAt?'waiting':'assisting';
    }else{
      stationM=elapsed<dispatchAt?rescueStation:elapsed<rescueAt?rescueStation+(meetingStation-rescueStation)*(elapsed-dispatchAt)/(rescueAt-dispatchAt):meetingStation;
      state=elapsed<dispatchAt?'dispatching':elapsed<rescueAt?'responding':'assisting';
    }
  }else{
    const progress=Math.min(1,elapsed/plan.duration);stationM=plan.path.total*(plan.from+(plan.to-plan.from)*progress);
    state=progress===1?(plan.closureRoadId?'waiting':'arrived'):plan.closureRoadId?'approaching':'moving';
  }
  return {id:plan.id,role:plan.role,name:plan.name,roadId:plan.road.id,roadName:plan.road.name,roadStatus:plan.road.status,
    point:simulationPoint(plan.path,stationM),stationM,state,updatedAt:epoch+Math.floor(elapsed)*1000,
    missionId:plan.missionId,closureRoadId:plan.closureRoadId,targetId:plan.targetId,targetName:plan.targetName};
}
/** A single scenario clock, independent of rendering and isolated from real GPS or report submission. */
export function createDeviceFeed(roads:RoadSegment[],links:readonly LocalRoadAreaLink[]=[],epoch=Date.now()) {
  const plans=buildDevicePlans(roads,links);let elapsed=0;
  let snapshot=plans.map(plan=>locate(plan,elapsed,epoch));
  const listeners=new Set<()=>void>();
  return {getSnapshot:()=>snapshot,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
    advance:(seconds:number)=>{if(!Number.isFinite(seconds)||seconds<=0)return;elapsed+=Math.min(seconds,.25);snapshot=plans.map(plan=>locate(plan,elapsed,epoch));listeners.forEach(listener=>listener());},
    refreshSignal:()=>{epoch=Date.now()-Math.floor(elapsed)*1000;snapshot=plans.map(plan=>locate(plan,elapsed,epoch));listeners.forEach(listener=>listener());},
  };
}
export type DeviceFeed=ReturnType<typeof createDeviceFeed>;
