import type { RescueBase } from './rescueBase';
import { nearestRoadAnchor } from '../routes/selectedRoadJourney';
import type { RoadSegment, ScenarioRoute } from '../../types/dear';
import type { LocalRoadAreaLink } from '../route-film/localNetwork';
import type { ResidentGuidance } from './residentGuidance';
import { simulationPoint } from '../routes/routeSimulation';
import { buildDevicePlans, measure, deviceSpeeds, deviceTimeLapse, type DevicePosition, type LocationFeed } from './deviceFeed';
export type GuidedLocation={entry:ResidentGuidance|null;route:ScenarioRoute|null};
export const residentDeviceId='GPS-AP01';
/** Authored movement stays on mapped roads and follows only an explicitly started instruction. */
export function createResidentLocation(roads:RoadSegment[],links:readonly LocalRoadAreaLink[],epoch:number,now=Date.now(),bases:readonly RescueBase[]=[],guidance?:GuidedLocation,progressKey=''){
  const plans=buildDevicePlans(roads,links,bases),plan=plans.find(p=>p.role==='resident'&&p.closureRoadId)??plans.find(p=>p.role==='resident');
  if(!plan)return null;
  const start=plan.from*plan.path.total,end=plan.to*plan.path.total,closurePoint=simulationPoint(plan.path,plan.to*plan.path.total),entry=guidance?.entry,path=guidance?.route?measure(guidance.route):null;
  let lastPoint=entry?.origin??null,lastSaved=0;
  if(entry&&progressKey)try{const saved=JSON.parse(localStorage.getItem(progressKey)??'null');if(saved?.id===entry.id&&Number.isFinite(saved.point?.x)&&Number.isFinite(saved.point?.y))lastPoint=saved.point;}catch{/* Resume at the instruction's origin if progress cannot be restored. */}
  const listeners=new Set<()=>void>();
  const locate=(time:number):DevicePosition[]=>{
    const distance=Math.min(Math.abs(end-start),Math.max(0,time-epoch)/1000*deviceSpeeds.walk*deviceTimeLapse);
    let stationM=start+Math.sign(end-start)*distance,point=simulationPoint(plan.path,stationM),closureRoadId=plan.closureRoadId;
    let state:DevicePosition['state']=distance<Math.abs(end-start)?closureRoadId?'approaching':'moving':closureRoadId?'waiting':'arrived';
    let missionId:string|undefined;
    if(entry){
      if(entry.mode==='hold'){point=entry.origin;state=Math.hypot(point.x-closurePoint.x,point.y-closurePoint.y)<100?'waiting':'stopped';if(state==='stopped')closureRoadId=undefined;}
      else if(entry.startedAt&&path){stationM=Math.min(path.total,Math.max(0,(entry.pausedAt??time)-entry.startedAt)/1000*deviceSpeeds.walk*deviceTimeLapse);point=simulationPoint(path,stationM);state=entry.pausedAt?'stopped':stationM<path.total?'moving':'arrived';closureRoadId=undefined;missionId='guidance:'+entry.id;}
      else if(entry.startedAt){point=lastPoint??entry.origin;state='stopped';closureRoadId=undefined;}
      else {point=entry.origin;state=Math.hypot(point.x-closurePoint.x,point.y-closurePoint.y)<100?'waiting':'stopped';if(state==='stopped')closureRoadId=undefined;}
      lastPoint=point;
      if(progressKey&&time-lastSaved>=1000){lastSaved=time;try{localStorage.setItem(progressKey,JSON.stringify({id:entry.id,point,at:time}));}catch{/* Position signals continue without local persistence. */}}
    }
    const anchor=nearestRoadAnchor(roads,point,5),road=roads.find(road=>road.id===anchor?.roadId)??plan.road;
    return [{id:residentDeviceId,role:'resident',name:['A Phủ','A Phủ'],householdName:['Hộ A Phủ','A Phủ household'],source:'scenario',roadId:road.id,roadName:road.name,roadStatus:road.status,closureRoadId,point,stationM,updatedAt:Math.floor(time/1000)*1000,state,missionId}];
  };
  let snapshot=locate(now);
  return {getSnapshot:()=>snapshot,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},update:(time:number)=>{
    if(!Number.isFinite(time))return;const next=locate(time),a=snapshot[0],b=next[0];
    if(a.updatedAt===b.updatedAt&&a.point.x===b.point.x&&a.point.y===b.point.y&&a.state===b.state)return;
    snapshot=next;listeners.forEach(listener=>listener());
  }};
}

/** Cache the combined snapshot so useSyncExternalStore never observes a new array without an update. */
export function mergeLocationFeeds(primary: LocationFeed | null, resident: LocationFeed | null): LocationFeed | null {
  if(!primary)return resident;if(!resident)return primary;
  let previousA:DevicePosition[]|undefined,previousB:DevicePosition[]|undefined,snapshot:DevicePosition[]=[];
  return {getSnapshot:()=>{
    const a=primary.getSnapshot(),b=resident.getSnapshot();
    if(a!==previousA||b!==previousB){previousA=a;previousB=b;const ids=new Set(b.map(device=>device.id));snapshot=[...a.filter(device=>!ids.has(device.id)),...b];}
    return snapshot;
  },subscribe:listener=>{const a=primary.subscribe(listener),b=resident.subscribe(listener);return()=>{a();b();};}};
}

/** A resident's app shows the rescue teams of a feed, never other residents. */
export function rescueOnly(feed: LocationFeed): LocationFeed {
  let source: DevicePosition[] | undefined, snapshot: DevicePosition[] = [];
  return {getSnapshot:()=>{
    const all=feed.getSnapshot();
    if(all!==source){source=all;snapshot=all.filter(device=>device.role==='rescue');}
    return snapshot;
  },subscribe:feed.subscribe};
}
