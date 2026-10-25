import type { RoadSegment } from '../../types/dear';
import type { LocalRoadAreaLink } from '../route-film/localNetwork';
import { simulationPoint } from '../routes/routeSimulation';
import { buildDevicePlans, deviceSpeeds, deviceTimeLapse, type DevicePosition, type LocationFeed } from './deviceFeed';

export const residentDeviceId = 'GPS-AP01';
/** An authored device follows a mapped approach and holds before the closure. It never submits GPS evidence. */
export function createResidentLocation(roads: RoadSegment[], links: readonly LocalRoadAreaLink[], epoch: number, now = Date.now()) {
  const plans = buildDevicePlans(roads, links);
  const plan = plans.find(p => p.role === 'resident' && p.closureRoadId) ?? plans.find(p => p.role === 'resident');
  if (!plan) return null;
  const start = plan.from * plan.path.total, end = plan.to * plan.path.total;
  const listeners = new Set<() => void>();
  const locate = (time: number): DevicePosition[] => {
    const distance = Math.min(Math.abs(end-start), Math.max(0, time-epoch)/1000 * deviceSpeeds.walk * deviceTimeLapse);
    const stationM = start + Math.sign(end-start)*distance;
    return [{id:residentDeviceId,role:'resident',name:['A Phủ','A Phủ'],householdName:['Hộ A Phủ','A Phủ household'],source:'scenario',
      roadId:plan.road.id,roadName:plan.road.name,roadStatus:plan.road.status,closureRoadId:plan.closureRoadId,
      point:simulationPoint(plan.path,stationM),stationM,updatedAt:Math.floor(time/1000)*1000,
      state:distance<Math.abs(end-start)?plan.closureRoadId?'approaching':'moving':plan.closureRoadId?'waiting':'arrived'}];
  };
  let snapshot = locate(now);
  return {getSnapshot:()=>snapshot,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
    update:(time:number)=>{
      if(!Number.isFinite(time))return;
      const next=locate(time),a=snapshot[0],b=next[0];
      if(a.updatedAt===b.updatedAt&&a.stationM===b.stationM&&a.state===b.state)return;
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
