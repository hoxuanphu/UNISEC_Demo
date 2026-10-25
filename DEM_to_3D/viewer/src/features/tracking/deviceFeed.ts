import type { RoadSegment } from '../../types/dear';
import type { LocalRoadAreaLink } from '../route-film/localNetwork';
import { projectedPathLength } from '../../terrain/pathGeometry';
import { nearestRoadAnchor } from '../routes/selectedRoadJourney';
import { simulationPoint } from '../routes/routeSimulation';
export type DeviceRole = 'resident' | 'rescue';
export type DeviceState = 'moving' | 'approaching' | 'waiting' | 'stopped' | 'dispatching' | 'responding' | 'assisting' | 'escorting' | 'arrived'
  | 'crossing' | 'on-site' | 'evacuated';
type Point = {x:number;y:number};
export type Path = {points:Point[];stations:number[];total:number};
export type DevicePosition = {
  id:string;role:DeviceRole;name:[string,string];roadId:string;roadName:[string,string];
  roadStatus:RoadSegment['status'];point:Point;stationM:number;state:DeviceState;updatedAt:number;
  missionId?:string;closureRoadId?:string;targetId?:string;targetName?:[string,string];
};
export type DevicePlan = {id:string;role:DeviceRole;name:[string,string];road:RoadSegment;path:Path;from:number;to:number;duration:number;
  missionId?:string;closureRoadId?:string;targetId?:string;targetName?:[string,string];
  timing?:{residentAt:number;dispatchAt:number;rescueAt:number;escortAt:number;finishAt:number;returnAt:number;cycle:number;residentStation:number;rescueStation:number;meetingStation:number};
  /** A multi-leg mission in field seconds and path metres; it replays every cycle. */
  script?:{legs:Array<{until:number;from:number;to:number;state:DeviceState}>;cycle:number;end:DeviceState};
};
/** Field speeds in m/s: walking, a rescue motorbike on a mountain road, and the slower escort back. */
export const deviceSpeeds={walk:1.3,rescue:7,escort:2.5} as const;
/** The scenario runs as a time-lapse: one screen second is this many field seconds, so walking
 * reads as movement at commune scale while the walk-to-motorbike ratio stays true. */
export const deviceTimeLapse=8;
export function measure(road:{points:Point[]}):Path|null {
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
    return{id:`ND-${String(index+1).padStart(2,'0')}`,role:'resident',name:named('resident',index+1),road,path,from,to,duration:Math.max(8,(to-from)*path.total/(deviceSpeeds.walk-.2+index*.1))};
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
    // The resident walks up to the obstruction; the team rides in from about half a kilometre back.
    const meetingStation=Math.max(0,path.total-8),residentStation=Math.max(0,meetingStation-80-missions*20),rescueStation=Math.max(0,residentStation-500-missions*120);
    // Dispatch follows the resident's stop by 45 s; the team assists for 90 s, then escorts them back.
    const residentAt=(meetingStation-residentStation)/deviceSpeeds.walk,dispatchAt=residentAt+45;
    const rescueAt=dispatchAt+(meetingStation-rescueStation)/deviceSpeeds.rescue;
    const escortAt=rescueAt+90,finishAt=escortAt+(meetingStation-rescueStation)/deviceSpeeds.escort;
    // After resting at the assembly point the resident walks back to the initial approach.
    // The cycle boundary is continuous; never teleport the person back towards the closure.
    const returnAt=finishAt+120,cycle=returnAt+(residentStation-rescueStation)/deviceSpeeds.walk;
    const timing={residentAt,dispatchAt,rescueAt,escortAt,finishAt,returnAt,cycle,residentStation,rescueStation,meetingStation};
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
    plans.push({id:`ND-${String(number).padStart(2,'0')}`,role:'resident',name:named('resident',number),road:closed,path,from:start/path.total,to:stop/path.total,duration:Math.max(1,Math.abs(start-stop)/deviceSpeeds.walk),closureRoadId:closed.id});
  }
  return plans.sort((a,b)=>a.role.localeCompare(b.role)||a.id.localeCompare(b.id));
}
function locate(plan:DevicePlan,clock:number,updatedAt:number):DevicePosition {
  let stationM=plan.path.total*plan.from,state:DeviceState='stopped';
  const timing=plan.timing;
  if(plan.script){
    const {legs,cycle,end}=plan.script,t=clock%cycle;let previous=0;
    stationM=legs.at(-1)!.to;state=end;
    for(const leg of legs){
      if(t<leg.until){const progress=leg.until>previous?(t-previous)/(leg.until-previous):1;stationM=leg.from+(leg.to-leg.from)*progress;state=leg.state;break;}
      previous=leg.until;
    }
  }else if(timing){
    const {residentAt,dispatchAt,rescueAt,escortAt,finishAt,returnAt,cycle,residentStation,rescueStation,meetingStation}=timing;
    const elapsed=clock%cycle;
    if(elapsed>=returnAt&&plan.role==='resident'){stationM=rescueStation+Math.min(residentStation-rescueStation,(elapsed-returnAt)*deviceSpeeds.walk);state='moving';}
    else if(elapsed>=finishAt){stationM=rescueStation;state='arrived';}
    else if(elapsed>=escortAt){stationM=meetingStation-(meetingStation-rescueStation)*(elapsed-escortAt)/(finishAt-escortAt);state='escorting';}
    else if(plan.role==='resident'){
      stationM=elapsed<residentAt?residentStation+(meetingStation-residentStation)*elapsed/residentAt:meetingStation;
      state=elapsed<residentAt?'approaching':elapsed<rescueAt?'waiting':'assisting';
    }else{
      stationM=elapsed<dispatchAt?rescueStation:elapsed<rescueAt?rescueStation+(meetingStation-rescueStation)*(elapsed-dispatchAt)/(rescueAt-dispatchAt):meetingStation;
      state=elapsed<dispatchAt?'dispatching':elapsed<rescueAt?'responding':'assisting';
    }
  }else if(plan.closureRoadId){
    // Stopped short of a closure with no way round: they stay and wait.
    const progress=Math.min(1,clock/plan.duration);stationM=plan.path.total*(plan.from+(plan.to-plan.from)*progress);
    state=progress===1?'waiting':'approaching';
  }else{
    // Residents on open roads keep walking their stretch, there and back.
    const phase=(clock/plan.duration)%2,progress=phase<=1?phase:2-phase;
    stationM=plan.path.total*(plan.from+(plan.to-plan.from)*progress);state='moving';
  }
  return {id:plan.id,role:plan.role,name:plan.name,roadId:plan.road.id,roadName:plan.road.name,roadStatus:plan.road.status,
    point:simulationPoint(plan.path,stationM),stationM,state,updatedAt,
    missionId:plan.missionId,closureRoadId:plan.closureRoadId,targetId:plan.targetId,targetName:plan.targetName};
}
/** A single scenario clock, independent of rendering and isolated from real GPS or report submission. */
export function createDeviceFeed(roads:RoadSegment[],links:readonly LocalRoadAreaLink[]=[],epoch=Date.now(),missions:readonly DevicePlan[]=[]) {
  // Field clock for movement; the signal time shown is the real one.
  const plans=[...buildDevicePlans(roads,links),...missions];let elapsed=0,real=0;
  const at=()=>epoch+Math.floor(real)*1000;
  let snapshot=plans.map(plan=>locate(plan,elapsed,at()));
  const listeners=new Set<()=>void>();
  return {getSnapshot:()=>snapshot,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
    advance:(seconds:number)=>{if(!Number.isFinite(seconds)||seconds<=0)return;const step=Math.min(seconds,.25);real+=step;elapsed+=step*deviceTimeLapse;snapshot=plans.map(plan=>locate(plan,elapsed,at()));listeners.forEach(listener=>listener());},
    refreshSignal:()=>{epoch=Date.now()-Math.floor(real)*1000;snapshot=plans.map(plan=>locate(plan,elapsed,at()));listeners.forEach(listener=>listener());},
  };
}
export type DeviceFeed=ReturnType<typeof createDeviceFeed>;
