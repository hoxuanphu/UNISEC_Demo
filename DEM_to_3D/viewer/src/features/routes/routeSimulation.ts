import type { ScenarioRoute } from '../../types/dear';
import { routeStatus } from './roadConditions';
type Point = {x: number; y: number};
export type SimulationSnapshot = {
  status: 'idle' | 'playing' | 'paused' | 'finished';
  progress: number; distance: number; total: number; point: Point; rate: number;
};
/** Immutable plan in projected metres. It contains mapped road geometry only. */
export function simulationPath(route: ScenarioRoute | null) {
  if (!route || routeStatus(route) === 'blocked' || route.points.length < 2 ||
      route.points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  if (route.segs.some((segment,index) => segment.points.length < 2 || index > 0 &&
      Math.hypot(segment.points[0].x-route.segs[index-1].points.at(-1)!.x,segment.points[0].y-route.segs[index-1].points.at(-1)!.y) > .001)) return null;
  const points = route.points.filter((p,i,all) => !i || p.x !== all[i-1].x || p.y !== all[i-1].y).map(p => ({...p}));
  const stations = [0];
  for (let i=1;i<points.length;i++) stations.push(stations[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
  const total = stations.at(-1)!;
  if (!(total > .001)) return null;
  return {points, stations, total};
}
export function simulationPoint(path: NonNullable<ReturnType<typeof simulationPath>>, distance: number): Point {
  const station = Number.isFinite(distance) ? Math.max(0,Math.min(path.total,distance)) : 0;
  let lo=0,hi=path.stations.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>>1;if(path.stations[mid]<=station)lo=mid;else hi=mid;}
  const a=path.points[lo],b=path.points[hi],span=path.stations[hi]-path.stations[lo];
  const t=span ? (station-path.stations[lo])/span : 0;
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}
/** A demo clock, not a GPS feed or travel-time estimate. Consumers subscribe without rerendering the map workspace. */
export function createRouteSimulation(route: ScenarioRoute | null, name='A Phủ') {
  const path=simulationPath(route);if(!path)return null;
  let snapshot:SimulationSnapshot={status:'idle',progress:0,distance:0,total:path.total,point:simulationPoint(path,0),rate:1};
  const listeners=new Set<()=>void>();
  const update=(patch:Partial<SimulationSnapshot>)=>{snapshot={...snapshot,...patch};listeners.forEach(listener=>listener());};
  const seek=(progress:number,status=snapshot.status)=>{
    if(!Number.isFinite(progress))return;
    progress=Math.max(0,Math.min(1,progress));
    const distance=path.total*progress;
    update({progress,distance,point:simulationPoint(path,distance),status:progress===1?'finished':status==='finished'?'paused':status});
  };
  return {name,routeId:route!.id,
    getSnapshot:()=>snapshot,
    subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
    play:()=>update({status:'playing',...(snapshot.progress===1 ? {progress:0,distance:0,point:simulationPoint(path,0)} : {})}),
    pause:()=>{if(snapshot.status==='playing')update({status:'paused'});},
    reset:()=>seek(0,'idle'),
    seek:(progress:number)=>seek(progress),
    setRate:(rate:number)=>{if([.5,1,2].includes(rate))update({rate});},
    // 30 seconds at 1x. Long suspended frames never teleport the person across the map.
    advance:(seconds:number)=>{if(snapshot.status==='playing' && Number.isFinite(seconds) && seconds>0)seek(snapshot.progress+Math.min(.25,seconds)*snapshot.rate/30);},
  };
}
export type RouteSimulation = NonNullable<ReturnType<typeof createRouteSimulation>>;
