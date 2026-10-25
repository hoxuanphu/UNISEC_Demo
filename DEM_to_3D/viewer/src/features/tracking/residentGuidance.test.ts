import {createResidentLocation} from './residentLocation';
import {describe,expect,it} from 'vitest';
import {guidanceRoute,plannedGuidance,validGuidance,routeProposalOf} from './residentGuidance';
import type {RoadSegment} from '../../types/dear';
import type {LocalNetwork} from '../route-film/localNetwork';
const road:RoadSegment={id:'r',name:['r','r'],status:'open',cls:'track',len:1,points:[{x:0,y:0},{x:1000,y:0}]};
const target={id:'GPS-AP01',name:['A Phủ','A Phủ'] as [string,string],point:{x:100,y:0}};
const base={id:'base',name:['Tập kết','Assembly point'] as [string,string],projected:{x:900,y:0}};
const network={roads:[road]} as LocalNetwork;
describe('coordinator travel guidance',()=>{
 it('keeps proposals as data requiring review, and rejects malformed routes',()=>{
  const proposal={schema:1,name:['Tập kết','Assembly point'],roadIds:['r'],end:{x:900,y:0}};
  expect(routeProposalOf(proposal)).toEqual(proposal);expect(routeProposalOf({...proposal,end:{x:NaN,y:0}})).toBeNull();
  expect(routeProposalOf({...proposal,roadIds:[]})).toBeNull();
 });
 it('assigns one explicit connected route to a named resident',()=>{
  const entry=plannedGuidance(network.roads,target,base,'Coordinator')!;expect(validGuidance(entry)).toBe(true);
  const route=guidanceRoute(network,entry)!;expect(route.points[0]).toEqual(target.point);expect(route.points.at(-1)).toEqual(base.projected);
  expect(entry.roadIds).toEqual(['r']);expect(entry.recipientId).toBe('GPS-AP01');
 });
 it('suspends the approved route when a road is blocked instead of finding an unapproved detour',()=>{
  const entry=plannedGuidance(network.roads,target,base,'Coordinator')!;
  expect(guidanceRoute({...network,roads:[{...road,status:'blocked'}]},entry)).toBeNull();
 });
 it('never invents a walking connection for a person away from mapped roads',()=>{
  expect(plannedGuidance(network.roads,{...target,point:{x:100,y:150}},base,'Coordinator')).toBeNull();
 });
 it('moves the authored phone only after Start and holds it where coordination says to stop',()=>{
  const entry=plannedGuidance(network.roads,target,base,'Coordinator')!;
  const started={...entry,startedAt:1000};
  const feed=createResidentLocation(network.roads,[],0,1000,[],{entry:started,route:guidanceRoute(network,entry)})!;
  expect(feed.getSnapshot()[0].point).toEqual(target.point);
  feed.update(6000);const position=feed.getSnapshot()[0].point;
  const paused=createResidentLocation(network.roads,[],0,9000,[],{entry:{...started,pausedAt:6000},route:guidanceRoute(network,entry)})!;expect(paused.getSnapshot()[0].point).toEqual(position);paused.update(12000);expect(paused.getSnapshot()[0].point).toEqual(position);
  expect(position.x).toBeGreaterThan(target.point.x);expect(position.y).toBe(0);
  const hold=plannedGuidance(network.roads,{...target,point:position},null,'Coordinator')!;
  const stopped=createResidentLocation(network.roads,[],0,9000,[],{entry:hold,route:null})!;
  expect(stopped.getSnapshot()[0].point).toEqual(position);stopped.update(90000);expect(stopped.getSnapshot()[0].point).toEqual(position);
 });
 it('can issue a hold instruction without falsely publishing a route',()=>{
  const entry=plannedGuidance(network.roads,target,null,'Coordinator')!;expect(entry.mode).toBe('hold');expect(guidanceRoute(network,entry)).toBeNull();
  expect(validGuidance({...entry,origin:{x:NaN,y:0}})).toBe(false);expect(validGuidance({...entry,mode:'route'})).toBe(false);
 });
});
