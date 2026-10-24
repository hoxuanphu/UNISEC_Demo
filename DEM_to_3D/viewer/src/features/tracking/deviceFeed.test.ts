import { describe,expect,it } from 'vitest';
import data from '../../../public/scenarios/che-tao/local-network.json';
import incident from '../../../public/scenarios/che-tao/v0.3/incident.json';
import { validateLocalNetwork } from '../route-film/localNetwork';
import { validateIncidentPacket } from '../../data/incidentPacket';
import { nearestRoadAnchor } from '../routes/selectedRoadJourney';
import type { RoadSegment } from '../../types/dear';
import { buildDevicePlans,createDeviceFeed } from './deviceFeed';
const roads=[...validateIncidentPacket(incident).roads,...validateLocalNetwork(data).roads];
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
    expect(person.timing!.dispatchAt).toBeGreaterThan(person.timing!.residentAt);
    expect(person.timing!.rescueAt).toBeGreaterThan(person.timing!.dispatchAt);
    expect(person.timing!.escortAt).toBeGreaterThan(person.timing!.rescueAt);
    expect(person.road.id).toBe('local-approach');expect(team.road.id).toBe('local-approach');
    const feed=createDeviceFeed(roads,[],0),stages=new Set<string>();
    for(let i=0;i<1600;i++){
      feed.advance(.25);const elapsed=(i+1)*.25;
      const resident=feed.getSnapshot().find(p=>p.id===person.id)!,rescue=feed.getSnapshot().find(p=>p.id===team.id)!;
      stages.add(resident.state+':'+rescue.state);
      expect(resident.point.x).toBeLessThan(1000);expect(rescue.point.x).toBeLessThan(1000);
      if(elapsed>=person.timing!.residentAt&&elapsed<person.timing!.rescueAt){
        expect(resident.state).toBe('waiting');expect(resident.stationM).toBe(person.timing!.meetingStation);
      }
      if(elapsed<person.timing!.dispatchAt)expect(rescue.stationM).toBe(person.timing!.rescueStation);
      if(elapsed>=person.timing!.rescueAt)expect(resident.point).toEqual(rescue.point);
      expect(resident.targetId).toBe(rescue.id);expect(rescue.targetId).toBe(resident.id);
    }
    expect(stages.has('waiting:dispatching')).toBe(true);expect(stages.has('waiting:responding')).toBe(true);
    expect(stages.has('assisting:assisting')).toBe(true);expect(stages.has('escorting:escorting')).toBe(true);expect(stages.has('arrived:arrived')).toBe(true);
    expect(closed.status).toBe('blocked');
  });
  it('does not dispatch a team across disconnected or merely crossing roads',()=>{
    const closed={...line('closed','blocked'),points:[{x:1000,y:0},{x:1300,y:0}]};
    const unrelated={...line('unrelated'),points:[{x:1100,y:-500},{x:1100,y:500}]};
    const plans=buildDevicePlans([closed,unrelated]);
    expect(plans.filter(p=>p.role==='rescue')).toEqual([]);
    expect(plans.filter(p=>p.closureRoadId).every(p=>!p.timing)).toBe(true);
  });
  it('handles missing roads and invalid signals without fabricated coordinates or jumps',()=>{
    expect(createDeviceFeed([]).getSnapshot()).toEqual([]);
    expect(buildDevicePlans([{...line('broken'),points:[{x:NaN,y:0},{x:10,y:0}]}])).toEqual([]);
    const feed=createDeviceFeed([line('road')],[],0),initial=feed.getSnapshot();
    feed.advance(NaN);feed.advance(-1);feed.advance(0);expect(feed.getSnapshot()).toBe(initial);
    feed.advance(1000);expect(Math.abs(feed.getSnapshot()[0].stationM-initial[0].stationM)).toBeLessThanOrEqual(1.1);
    let count=0;const unsub=feed.subscribe(()=>count++);feed.advance(.1);expect(count).toBe(1);unsub();feed.advance(.1);expect(count).toBe(1);
    const changed=createDeviceFeed([line('road','blocked')],[],0);
    expect(changed.getSnapshot().every(p=>p.roadStatus==='blocked'&&p.role==='resident')).toBe(true);
  });
});
