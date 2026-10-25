import { describe,expect,it } from 'vitest';
import data from '../../../public/scenarios/che-tao/local-network.json';
import incident from '../../../public/scenarios/che-tao/v0.3/incident.json';
import { validateLocalNetwork } from '../route-film/localNetwork';
import { validateIncidentPacket } from '../../data/incidentPacket';
import { nearestRoadAnchor } from '../routes/selectedRoadJourney';
import type { RoadSegment } from '../../types/dear';
import { buildDevicePlans,createDeviceFeed,deviceSpeeds,deviceTimeLapse,type DevicePlan,type DeviceState } from './deviceFeed';
import { rescueBases } from './rescueBase';
import { withLocalRoadConditions } from '../route-film/localRoadConditions';
import { assessHouseholdAccess } from '../presence/householdIsolation';
import { householdRescues } from '../presence/householdRescue';
import { validateResidentPresence } from '../presence/residentPresence';
import presenceData from '../../../public/scenarios/che-tao/resident-presence.json';
const packet=validateIncidentPacket(incident),network=validateLocalNetwork(data);
const roads=[...packet.roads,...network.roads];
const until=(plan:DevicePlan,state:DeviceState)=>plan.script!.legs.find(leg=>leg.state===state)!.until;
const line=(id:string,status:RoadSegment['status']='open'):RoadSegment=>({id,status,name:[id,id],cls:'track',len:1,points:[{x:0,y:0},{x:1000,y:0}]});
describe('resident and rescue device feed',()=>{
  it('places six residents and two distinct rescue teams on the shipped road geometry',()=>{
    const plans=buildDevicePlans(roads);
    expect(plans.filter(p=>p.role==='resident')).toHaveLength(6);
    expect(plans.filter(p=>p.role==='rescue')).toHaveLength(2);
    expect(plans.filter(p=>p.role==='resident'&&p.closureRoadId)).toHaveLength(2);
    expect(plans.filter(p=>p.missionId).every(p=>p.road.status!=='blocked')).toBe(true);
    expect(plans.filter(p=>p.role==='rescue').every(p=>p.road.status!=='blocked')).toBe(true);
    expect(new Set(plans.map(p=>p.id)).size).toBe(plans.length);
    expect(buildDevicePlans([...roads].reverse()).map(p=>p.id+':'+p.road.id)).toEqual(plans.map(p=>p.id+':'+p.road.id));
    const feed=createDeviceFeed(roads,[],1000),original=feed.getSnapshot();
    for(let i=0;i<800;i++){
      feed.advance(.25);
      for(const device of feed.getSnapshot()){
        const road=roads.find(r=>r.id===device.roadId)!;
        expect(nearestRoadAnchor([road],device.point,1)?.distance).toBeLessThan(.0011);
        expect(device.roadStatus).toBe(road.status);
        expect(device.updatedAt).toBeGreaterThanOrEqual(1000);
      }
    }
    expect(feed.getSnapshot().some((p,i)=>Math.hypot(p.point.x-original[i].point.x,p.point.y-original[i].point.y)>10)).toBe(true);
  });
  it('waits before mapped closure contacts when no rescue approach exists',()=>{
    const road=line('closed','blocked');
    const links=[{roadId:road.id,areaId:'scar',state:'occurred' as const,roadPoint:{x:200,y:0},areaPoint:{x:200,y:0},distanceM:0}];
    const feed=createDeviceFeed([road],links,0),seen=new Set<string>();let near=Infinity;
    for(let i=0;i<2000;i++){
      feed.advance(.25);const p=feed.getSnapshot()[0];
      near=Math.min(near,p.stationM);seen.add(p.state);
      expect(p.stationM).toBeGreaterThanOrEqual(240-.00001);
      expect(p.point.y).toBe(0);
    }
    expect(near).toBeCloseTo(240);
    expect(seen).toEqual(new Set(['approaching','waiting']));
    expect(road.status).toBe('blocked');expect(road.points[0]).toEqual({x:0,y:0});
  });
  it('dispatches only after the resident stops, meets them, assists and escorts them back without crossing the closure',()=>{
    const approach=line('local-approach');
    const closed={...line('closed','blocked'),points:[{x:1000,y:0},{x:1300,y:0}]};
    const roads=[approach,closed],plans=buildDevicePlans(roads),person=plans.find(p=>p.role==='resident'&&p.missionId)!;
    const team=plans.find(p=>p.role==='rescue'&&p.missionId===person.missionId)!;
    expect(until(team,'dispatching')).toBeGreaterThan(until(person,'approaching'));
    expect(until(team,'responding')).toBe(until(person,'waiting'));
    expect(until(team,'assisting')).toBe(until(person,'assisting'));
    expect(until(team,'escorting')).toBe(until(person,'escorting'));
    expect(person.road.id).toBe('local-approach');expect(team.road.id).toBe('local-approach');
    const feed=createDeviceFeed(roads,[],0),stages=new Set<string>();
    for(let i=0;i<1600;i++){
      feed.advance(.25);const elapsed=((i+1)*.25*deviceTimeLapse)%person.script!.cycle;
      const resident=feed.getSnapshot().find(p=>p.id===person.id)!,rescue=feed.getSnapshot().find(p=>p.id===team.id)!;
      stages.add(resident.state+':'+rescue.state);
      expect(resident.point.x).toBeLessThan(1000);expect(rescue.point.x).toBeLessThan(1000);
      if(elapsed>=until(person,'approaching')&&elapsed<until(person,'waiting')){
        expect(resident.state).toBe('waiting');expect(resident.stationM).toBe(team.sortie!.endM);
      }
      if(elapsed<until(team,'dispatching'))expect(rescue.stationM).toBe(team.sortie!.homeM);
      if(elapsed>=until(person,'waiting')&&elapsed<until(person,'escorting'))expect(resident.point).toEqual(rescue.point);
      expect(resident.targetId).toBe(rescue.id);expect(rescue.targetId).toBe(resident.id);
    }
    expect(stages.has('waiting:dispatching')).toBe(true);expect(stages.has('waiting:responding')).toBe(true);
    expect(stages.has('assisting:assisting')).toBe(true);expect(stages.has('escorting:escorting')).toBe(true);expect(stages.has('arrived:arrived')).toBe(true);
    expect(closed.status).toBe('blocked');
  });
  it('keeps moving at field speeds: walkers keep walking, missions replay, teams ride far faster than people walk',()=>{
    const approach=line('local-approach'),closed={...line('closed','blocked'),points:[{x:1000,y:0},{x:1300,y:0}]};
    const plans=buildDevicePlans([approach,closed]),person=plans.find(p=>p.role==='resident'&&p.missionId)!,t=person.script!;
    const team=plans.find(p=>p.role==='rescue')!,sortie=team.sortie!,legs=team.script!.legs;
    expect(sortie.endM-sortie.escort!.safeM).toBeGreaterThanOrEqual(400);
    expect((sortie.endM-sortie.escort!.startM)/until(person,'approaching')).toBeCloseTo(deviceSpeeds.walk);
    const ride=legs.find(leg=>leg.state==='responding')!;
    expect((ride.to-ride.from)/(ride.until-until(team,'dispatching'))).toBeCloseTo(deviceSpeeds.rescue);
    const walker=createDeviceFeed([line('road')],[],0),start=walker.getSnapshot()[0].stationM,seen:number[]=[];
    for(let i=0;i<4000;i++){walker.advance(.25);seen.push(walker.getSnapshot()[0].stationM);}
    expect(Math.max(...seen)-Math.min(...seen)).toBeGreaterThan(100);
    expect(seen.slice(-200).some(station=>Math.abs(station-seen.at(-1)!)>1)).toBe(true);
    expect(seen.some(station=>Math.abs(station-start)<1)).toBe(true);
    const feed=createDeviceFeed([approach,closed],[],0),states=new Set<string>();
    for(let i=0;i<Math.ceil(t.cycle*1.5/deviceTimeLapse/.25);i++){feed.advance(.25);const now=feed.getSnapshot().find(p=>p.id===person.id)!;states.add(now.state);}
    expect(states.has('arrived')&&states.has('approaching')).toBe(true);
    expect(states.has('moving')).toBe(true);
  });
  it('repeats missions without teleporting and keeps signal timestamps on real elapsed seconds',()=>{
    const approach=line('local-approach'),closed={...line('closed','blocked'),points:[{x:1000,y:0},{x:1300,y:0}]};
    const feed=createDeviceFeed([approach,closed],[],5000);let previous=feed.getSnapshot();
    for(let i=0;i<2000;i++){
      feed.advance(.1);const next=feed.getSnapshot();
      for(const device of next){
        const before=previous.find(item=>item.id===device.id)!;
        const speed=device.role==='rescue'?deviceSpeeds.rescue:deviceSpeeds.escort;
        expect(Math.abs(device.stationM-before.stationM)).toBeLessThanOrEqual(speed*deviceTimeLapse*.1+.00001);
        expect(device.point.x).toBeLessThan(1000);
        expect(device.updatedAt).toBeLessThanOrEqual(5000+(i+1)*100+.01);
      }
      previous=next;
    }
    expect(feed.getSnapshot()[0].updatedAt).toBeGreaterThanOrEqual(204000);
  });
  it('does not dispatch a team across disconnected or merely crossing roads',()=>{
    const closed={...line('closed','blocked'),points:[{x:1000,y:0},{x:1300,y:0}]};
    const unrelated={...line('unrelated'),points:[{x:1100,y:-500},{x:1100,y:500}]};
    const plans=buildDevicePlans([closed,unrelated]);
    expect(plans.filter(p=>p.role==='rescue')).toEqual([]);
    expect(plans.filter(p=>p.closureRoadId).every(p=>!p.script)).toBe(true);
  });
  it('sends every team from an assembly point, one after another, and never head-on into another team',()=>{
    // As the workspace loads it: commune roads cut where mapped slides meet them.
    const commune=withLocalRoadConditions(network),all=[...packet.roads,...commune.roads];
    const staging=packet.responseSites.find(site=>site.kind==='staging')!.projected,bases=rescueBases(network.places,staging,commune.roads);
    expect(bases.map(base=>base.name)).toEqual(['Helipad','Village B','Village C']);
    const huts=householdRescues(commune,assessHouseholdAccess(commune,validateResidentPresence(presenceData).clusters),bases).map(rescue=>rescue.plan);
    const feed=createDeviceFeed(all,[],0,huts,bases.map(base=>base.projected));
    const teams=()=>feed.getSnapshot().filter(device=>device.role==='rescue');
    expect(teams()).toHaveLength(4);
    // Every team waits exactly at an assembly point before it leaves.
    for(const team of teams())expect(Math.min(...bases.map(base=>Math.hypot(team.point.x-base.projected.x,team.point.y-base.projected.y)))).toBeLessThan(1);
    const cycle=huts[0].script!.cycle;
    let previous=teams();
    for(let i=0;i<Math.ceil(cycle/deviceTimeLapse/.25);i++){
      feed.advance(.25);const now=teams();
      const moves=now.map(team=>{const before=previous.find(item=>item.id===team.id)!;return {team,dx:team.point.x-before.point.x,dy:team.point.y-before.point.y};});
      for(const a of moves)for(const b of moves){
        if(a.team.id>=b.team.id||Math.hypot(a.team.point.x-b.team.point.x,a.team.point.y-b.team.point.y)>60)continue;
        if(Math.hypot(a.dx,a.dy)<1||Math.hypot(b.dx,b.dy)<1)continue;
        expect(a.dx*b.dx+a.dy*b.dy,`${a.team.id} meets ${b.team.id} head-on`).toBeGreaterThan(0);
      }
      previous=now;
    }
    // Leaving: spaced apart, in a fixed order.
    const departs=feed.getSnapshot().filter(device=>device.role==='rescue').map(device=>device.id);
    expect(new Set(departs).size).toBe(departs.length);
  });
  it('does not invent a rescue starting point when the assembly point has no connected approach',()=>{
    const approach=line('local-approach'),closed={...line('closed','blocked'),points:[{x:1000,y:0},{x:1300,y:0}]};
    const plans=buildDevicePlans([approach,closed],[],[{x:10000,y:10000}]);
    expect(plans.filter(plan=>plan.role==='rescue')).toEqual([]);
    expect(plans.some(plan=>plan.role==='resident'&&plan.closureRoadId===closed.id)).toBe(true);
  });
  it('handles missing roads and invalid signals without fabricated coordinates or jumps',()=>{
    expect(createDeviceFeed([]).getSnapshot()).toEqual([]);
    expect(buildDevicePlans([{...line('broken'),points:[{x:NaN,y:0},{x:10,y:0}]}])).toEqual([]);
    const feed=createDeviceFeed([line('road')],[],0),initial=feed.getSnapshot();
    feed.advance(NaN);feed.advance(-1);feed.advance(0);expect(feed.getSnapshot()).toBe(initial);
    // A long frame is capped: one step moves a walker no further than a quarter second of time-lapse.
    feed.advance(1000);expect(Math.abs(feed.getSnapshot()[0].stationM-initial[0].stationM)).toBeLessThanOrEqual(.25*deviceTimeLapse*deviceSpeeds.walk);
    let count=0;const unsub=feed.subscribe(()=>count++);feed.advance(.1);expect(count).toBe(1);unsub();feed.advance(.1);expect(count).toBe(1);
    const changed=createDeviceFeed([line('road','blocked')],[],0);
    expect(changed.getSnapshot().every(p=>p.roadStatus==='blocked'&&p.role==='resident')).toBe(true);
  });
});
