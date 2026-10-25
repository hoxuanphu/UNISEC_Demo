import type { RoadSegment } from '../../types/dear';
import type { LocalRoadAreaLink } from '../route-film/localNetwork';
import { projectedPathLength } from '../../terrain/pathGeometry';
import { nearestRoadAnchor } from '../routes/selectedRoadJourney';
import { simulationPoint } from '../routes/routeSimulation';
import { analyseRoadJourney } from '../routes/journeyAnalysis';
import type { RescueBase } from './rescueBase';
export type DeviceRole = 'resident' | 'rescue';
export type DeviceState = 'moving' | 'approaching' | 'waiting' | 'stopped' | 'dispatching' | 'responding' | 'assisting' | 'escorting' | 'arrived'
  | 'crossing' | 'on-site' | 'evacuated';
type Point = {x:number;y:number};
export type Path = {points:Point[];stations:number[];total:number};
export type DevicePosition = {
  id:string;role:DeviceRole;name:[string,string];roadId:string;roadName:[string,string];
  roadStatus:RoadSegment['status'];point:Point;stationM:number;state:DeviceState;updatedAt:number;
  missionId?:string;closureRoadId?:string;targetId?:string;targetName?:[string,string];
  /** The assembly point a team left from. */
  baseId?:string;
};
/** A team's job, in path metres: leave `homeM`, ride to `endM`, work there, come back.
 * An escorted resident walks up to `endM` from `startM` and is brought back to `safeM`. */
export type Sortie = {homeM:number;endM:number;workS:number;workState:DeviceState;earliest:number;
  escort?:{residentId:string;startM:number;safeM:number}};
export type DevicePlan = {id:string;role:DeviceRole;name:[string,string];road:RoadSegment;path:Path;from:number;to:number;duration:number;
  missionId?:string;closureRoadId?:string;targetId?:string;targetName?:[string,string];
  baseId?:string;
  sortie?:Sortie;
  /** The roads a path from the base runs over, by path metres, so a position names the road it is on. */
  segments?:Array<{fromM:number;toM:number;road:RoadSegment}>;
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
/** Journey parts back to the network roads they were cut from, measured along the journey. */
export function routeSegments(segs:readonly RoadSegment[],roads:readonly RoadSegment[]):NonNullable<DevicePlan['segments']> {
  let at=0;
  return segs.map(seg=>{
    const length=projectedPathLength(seg.points),road=roads.find(r=>r.id===seg.id)??roads.find(r=>r.id===seg.id.split(':part:')[0])??seg;
    const part={fromM:at,toM:at+length,road};at+=length;return part;
  });
}
function roadAt(plan:DevicePlan,stationM:number,point:Point):RoadSegment {
  const near=plan.segments?.filter(part=>stationM>=part.fromM-5&&stationM<=part.toM+5)??[];
  let best=plan.road,distance=Infinity;
  for(const part of near){const at=nearestRoadAnchor([part.road],point,50);if(at&&at.distance<distance){distance=at.distance;best=part.road;}}
  return best;
}
const named=(role:DeviceRole,number:number):[string,string]=>role==='resident'?[`Người dân ${String(number).padStart(2,'0')}`,`Resident ${String(number).padStart(2,'0')}`]:[`Đội cứu hộ ${String(number).padStart(2,'0')}`,`Rescue team ${String(number).padStart(2,'0')}`];
/** Field seconds: before the first team leaves, between teams leaving or returning, assisting a
 * resident, a rescued resident's rest, and the hold before the scenario replays. */
const BRIEFING=60,SPACING=40,ASSIST=90,REST=120,HOLD=120;

/**
 * One timetable for every team, as a commander would run it from one assembly point:
 * teams leave one after another (same speed, so none overtakes), and none starts back
 * before the last has arrived, so no team meets another head-on. Every script shares
 * one cycle, so the order holds on every replay.
 */
export function scheduleSorties(plans:DevicePlan[]):DevicePlan[] {
  const teams=plans.filter(plan=>plan.sortie).sort((a,b)=>a.sortie!.earliest-b.sortie!.earliest||a.id.localeCompare(b.id));
  if(!teams.length)return plans;
  let lastDepart=-Infinity,lastLeave=-Infinity;
  const timed=teams.map(team=>{
    const sortie=team.sortie!,depart=Math.max(BRIEFING,sortie.earliest,lastDepart+SPACING);lastDepart=depart;
    return {team,sortie,depart,arrive:depart+(sortie.endM-sortie.homeM)/deviceSpeeds.rescue,leave:0};
  });
  const allThere=Math.max(...timed.map(item=>item.arrive));
  for(const item of [...timed].sort((a,b)=>a.arrive+a.sortie.workS-(b.arrive+b.sortie.workS)||a.team.id.localeCompare(b.team.id))){
    item.leave=Math.max(allThere,item.arrive+item.sortie.workS,lastLeave+SPACING);lastLeave=item.leave;
  }
  const scripts=new Map<string,NonNullable<DevicePlan['script']>['legs']>();
  for(const {team,sortie,depart,arrive,leave} of timed){
    const {homeM,endM,escort}=sortie;
    const legs:NonNullable<DevicePlan['script']>['legs']=[
      {until:depart,from:homeM,to:homeM,state:'dispatching'},
      {until:arrive,from:homeM,to:endM,state:'responding'},
      {until:leave,from:endM,to:endM,state:sortie.workState},
    ];
    if(escort){
      const escorted=leave+(endM-escort.safeM)/deviceSpeeds.escort,approached=(endM-escort.startM)/deviceSpeeds.walk,rested=escorted+REST;
      legs.push({until:escorted,from:endM,to:escort.safeM,state:'escorting'},
        {until:escorted+Math.abs(escort.safeM-homeM)/deviceSpeeds.rescue,from:escort.safeM,to:homeM,state:'moving'});
      scripts.set(escort.residentId,[
        {until:approached,from:escort.startM,to:endM,state:'approaching'},
        {until:arrive,from:endM,to:endM,state:'waiting'},
        {until:leave,from:endM,to:endM,state:'assisting'},
        {until:escorted,from:endM,to:escort.safeM,state:'escorting'},
        {until:rested,from:escort.safeM,to:escort.safeM,state:'arrived'},
        // Back to where they started, so the replay continues without a jump.
        {until:rested+Math.abs(escort.startM-escort.safeM)/deviceSpeeds.walk,from:escort.safeM,to:escort.startM,state:'moving'},
      ]);
    }else legs.push({until:leave+(endM-homeM)/deviceSpeeds.rescue,from:endM,to:homeM,state:'moving'});
    scripts.set(team.id,legs);
  }
  const cycle=Math.max(...[...scripts.values()].map(legs=>legs.at(-1)!.until))+HOLD;
  return plans.map(plan=>{
    const legs=scripts.get(plan.id);
    return legs?{...plan,script:{legs,cycle,end:plan.role==='rescue'?'arrived':'stopped'}}:plan;
  });
}

/** Closed edges remain closed. A rendezvous is on the connected, unblocked side of the closure.
 * With assembly points (`bases`), a team sets out from the nearest on open roads; without, from
 * half a kilometre back. */
export function buildDevicePlans(roads:RoadSegment[],links:readonly LocalRoadAreaLink[]=[],bases:readonly RescueBase[]=[]):DevicePlan[] {
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
    // From the nearest assembly point on open roads, to the side of the closure it can reach; the
    // resident and the team share that path, so the escort is one movement. Without a base,
    // the team waits half a kilometre back on the approach. A supplied, unreachable base does not spawn a team here.
    const fromBase=(approach:Path,road:RoadSegment)=>{
      const meeting=simulationPoint(approach,Math.max(0,approach.total-8));
      // The commune roads and the corridor roads are separate datasets with no shared junctions:
      // route on the one the closure belongs to, or the base snaps to a road that leads nowhere.
      const network=roads.filter(candidate=>candidate.id.startsWith('local-')===road.id.startsWith('local-'));
      return bases.flatMap(base=>{
        const route=analyseRoadJourney(network,{origin:base.projected,source:base.id},{origin:meeting,source:'meeting'},true,600).route;
        const path=route?measure({points:route.points}):null;
        return route&&path&&gap(path.points.at(-1)!,meeting)<20?[{path,segments:routeSegments(route.segs,roads),baseId:base.id}]:[];
      }).sort((a,b)=>a.path.total-b.path.total)[0]??null;
    };
    const reachable=choices.map(c=>({...c,base:fromBase(c.path,c.road)}));
    const pool=bases.length?reachable.filter(c=>c.base).sort((a,b)=>a.base!.path.total-b.base!.path.total):reachable;
    const choice=pool.find(c=>!rendezvous.some(point=>gap(point,c.path.points.at(-1)!)<100))??(missions===0?pool[0]:undefined);
    if(!choice)continue;
    const {road,path:approach}=choice,path=choice.base?.path??approach,segments=choice.base?.segments;
    const endM=choice.base?path.total:approach.total-8;
    // The resident walks up to the obstruction and is brought back about half a kilometre.
    const startM=Math.max(0,endM-80-missions*20),safeM=Math.max(0,startM-420-missions*120),homeM=choice.base?0:safeM;
    const missionId=`assist:${closed.id}:${missions+1}`,residentId=`ND-${String(plans.filter(p=>p.role==='resident').length+1).padStart(2,'0')}`,rescueId=`CH-${String(missions+1).padStart(2,'0')}`;
    const residentName=named('resident',Number(residentId.slice(3))),rescueName=named('rescue',missions+1);
    const shared={road,path,segments,missionId,closureRoadId:closed.id};
    // The call goes out 45 s after the resident stops at the closure.
    const earliest=(endM-startM)/deviceSpeeds.walk+45;
    plans.push({...shared,id:residentId,role:'resident',name:residentName,from:startM/path.total,to:endM/path.total,duration:1,targetId:rescueId,targetName:rescueName},
      {...shared,id:rescueId,role:'rescue',name:rescueName,from:homeM/path.total,to:endM/path.total,duration:1,targetId:residentId,targetName:residentName,baseId:choice.base?.baseId,
        sortie:{homeM,endM,workS:ASSIST,workState:'assisting',earliest,escort:{residentId,startM,safeM}}});
    rendezvous.push(approach.points.at(-1)!);missions++;
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
  return scheduleSorties(plans).sort((a,b)=>a.role.localeCompare(b.role)||a.id.localeCompare(b.id));
}
function locate(plan:DevicePlan,clock:number,updatedAt:number):DevicePosition {
  let stationM=plan.path.total*plan.from,state:DeviceState='stopped';
  if(plan.script){
    const {legs,cycle,end}=plan.script,t=clock%cycle;let previous=0;
    stationM=legs.at(-1)!.to;state=end;
    for(const leg of legs){
      if(t<leg.until){const progress=leg.until>previous?(t-previous)/(leg.until-previous):1;stationM=leg.from+(leg.to-leg.from)*progress;state=leg.state;break;}
      previous=leg.until;
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
  const point=simulationPoint(plan.path,stationM),road=roadAt(plan,stationM,point);
  return {id:plan.id,role:plan.role,name:plan.name,roadId:road.id,roadName:road.name,roadStatus:road.status,
    point,stationM,state,updatedAt,
    missionId:plan.missionId,closureRoadId:plan.closureRoadId,targetId:plan.targetId,targetName:plan.targetName,baseId:plan.baseId};
}
/** A single scenario clock, independent of rendering and isolated from real GPS or report submission. */
export function createDeviceFeed(roads:RoadSegment[],links:readonly LocalRoadAreaLink[]=[],epoch=Date.now(),missions:readonly DevicePlan[]=[],bases:readonly RescueBase[]=[]) {
  // Field clock for movement; the signal time shown is the real one. All teams share one timetable.
  const plans=scheduleSorties([...buildDevicePlans(roads,links,bases),...missions]);let elapsed=0,real=0;
  const at=()=>epoch+Math.floor(real)*1000;
  let snapshot=plans.map(plan=>locate(plan,elapsed,at()));
  const listeners=new Set<()=>void>();
  return {getSnapshot:()=>snapshot,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
    advance:(seconds:number)=>{if(!Number.isFinite(seconds)||seconds<=0)return;const step=Math.min(seconds,.25);real+=step;elapsed+=step*deviceTimeLapse;snapshot=plans.map(plan=>locate(plan,elapsed,at()));listeners.forEach(listener=>listener());},
    refreshSignal:()=>{epoch=Date.now()-Math.floor(real)*1000;snapshot=plans.map(plan=>locate(plan,elapsed,at()));listeners.forEach(listener=>listener());},
  };
}
export type DeviceFeed=ReturnType<typeof createDeviceFeed>;
