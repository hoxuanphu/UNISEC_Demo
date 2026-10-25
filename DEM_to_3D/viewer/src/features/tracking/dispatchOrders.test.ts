import { describe, expect, it } from 'vitest';
import type { RoadSegment } from '../../types/dear';
import { planDispatch, restoreDispatch, dispatchPosition } from './dispatchOrders';
import { createDeviceFeed, buildDevicePlans, deviceTimeLapse } from './deviceFeed';
import localData from '../../../public/scenarios/che-tao/local-network.json';
import incidentData from '../../../public/scenarios/che-tao/v0.3/incident.json';
import { validateLocalNetwork } from '../route-film/localNetwork';
import { validateIncidentPacket } from '../../data/incidentPacket';
import { rescueBases } from './rescueBase';
import { createResidentLocation } from './residentLocation';
const road=(id:string,x=0,y=0):RoadSegment=>({id,name:[id,id],status:'open',cls:'track',len:1,points:[{x,y},{x:x+1000,y}]});
const base={id:'base',name:['Tập kết','Base'] as [string,string],projected:{x:0,y:0}};
const target={id:'GPS-AP01',name:['A Phủ','A Phủ'] as [string,string],point:{x:900,y:0}};
describe('rescue dispatch',()=>{
  it('drives an explicit order along the connected road and holds at the approach',()=>{
    const roads=[road('local-r')],order=planDispatch(roads,[base],{...target,id:'household:h',point:{x:900,y:80}},1000)!;
    expect(order).not.toBeNull();expect(order.gapM).toBeCloseTo(80);
    expect(restoreDispatch(order,roads,[base])).toEqual(order);
    const enRoute=dispatchPosition(order,roads,6000)!;
    expect(enRoute.state).toBe('responding');expect(enRoute.point.y).toBe(0);
    expect(dispatchPosition(order,roads,100000)!.state).toBe('waiting');
    expect(dispatchPosition(order,roads,100000)!.point).toEqual({x:900,y:0});
    expect(dispatchPosition(order,roads,100000)!.targetId).toBe('household:h');
  });
  it('refuses disconnected routes and invalidates a route when its road becomes blocked',()=>{
    const roads=[road('local-r'),road('local-other',10000)];
    expect(planDispatch(roads,[base],{...target,point:{x:10500,y:0}},1000)).toBeNull();
    const order=planDispatch(roads,[base],target,1000)!;
    expect(restoreDispatch(order,[{...roads[0],status:'blocked'}],[base])).toBeNull();
    expect(restoreDispatch({...order,points:[{x:0,y:0},{x:900,y:900}]},roads,[base])).toBeNull();
  });
  it('recalls from the current position without a jump or an invented evacuation',()=>{
    const roads=[road('local-r')],order=planDispatch(roads,[base],target,1000)!;
    const before=dispatchPosition(order,roads,7000)!,recalled={...order,recalledAt:7000};
    expect(dispatchPosition(recalled,roads,7000)!.point).toEqual(before.point);
    expect(dispatchPosition(recalled,roads,9000)!.stationM).toBeLessThan(before.stationM);
    expect(dispatchPosition(recalled,roads,100000)!.point).toEqual(base.projected);
    expect(dispatchPosition(recalled,roads,100000)!.state).toBe('arrived');
  });
  it('can send a team from a shipped assembly point towards the resident phone',()=>{
    const network=validateLocalNetwork(localData),packet=validateIncidentPacket(incidentData),bases=rescueBases(packet.responseSites??[],network.roads);
    const me=createResidentLocation(network.roads,network.conditions?.areaLinks??[],0,100000)!.getSnapshot()[0];
    expect(bases.length).toBeGreaterThan(0);
    expect(planDispatch(network.roads,bases,{id:me.id,name:me.name,point:me.point},1000)).not.toBeNull();
  });
  it('holds a team at an unverified approach until an operator changes its task',()=>{
    const open=road('local-r'),closed={...road('closed',1000),status:'blocked' as const};
    const plan={...buildDevicePlans([open,closed]).find(plan=>plan.role==='rescue')!,id:'CH-hold',holdAtAccess:true};
    plan.sortie={...plan.sortie!,workState:'waiting',escort:undefined};
    const feed=createDeviceFeed([open,closed],[],0,[plan],[],{repeat:false});
    feed.synchronise(100000);
    expect(feed.getSnapshot().find(device=>device.id==='CH-hold')!.state).toBe('waiting');
  });
  it('keeps rescued residents at safety and limits unrelated moving devices in the app',()=>{
    const open=road('local-r'),closed={...road('closed',1000),status:'blocked' as const};
    const plans=buildDevicePlans([open,closed]),person=plans.find(plan=>plan.role==='resident'&&plan.missionId)!;
    const feed=createDeviceFeed([open,closed],[],0,[],[],{repeat:false,ambientLimit:2});
    feed.synchronise(person.script!.cycle/deviceTimeLapse*2);
    const rescued=feed.getSnapshot().find(device=>device.id===person.id)!;
    expect(rescued.state).toBe('arrived');const safe=rescued.point;
    feed.synchronise(person.script!.cycle/deviceTimeLapse*3);
    expect(feed.getSnapshot().find(device=>device.id===person.id)!.point).toEqual(safe);
    expect(feed.getSnapshot().filter(device=>device.role==='resident'&&!device.missionId&&!device.closureRoadId).length).toBeLessThanOrEqual(2);
  });
});
