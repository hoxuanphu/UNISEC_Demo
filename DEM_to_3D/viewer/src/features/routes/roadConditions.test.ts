import { describe, expect, it } from 'vitest';
import type { RoadSegment, ScenarioRoute } from '../../types/dear';
import { roadCondition, routeCondition, routeStatus } from './roadConditions';
import { roadConditionMessage } from './localRoadLabels';
import { recommendRoute } from './routeAdvice';
import { analyseRoadJourney } from './journeyAnalysis';
import { buildNetworkRoutes } from './networkRouting';

const road = (id: string, points: RoadSegment['points'], status: RoadSegment['status'] = 'open', hz?: RoadSegment['hz']): RoadSegment =>
  ({id, points, status, hz, name:[id,id], cls:'track', len:0});
const p = (x: number, y = 0) => ({x,y});
const selection = (x: number) => ({origin:p(x),source:'map'});
const route = (id: string, segs: RoadSegment[], lengthKm: number, status: ScenarioRoute['status'] = 'uncertain'): ScenarioRoute =>
  ({id, segs, lengthKm, status, points:segs.flatMap(road=>road.points),name:[id,id],type:'candidate',communityId:''});

describe('one road condition across advice and display', () => {
  it('gives an actual closure precedence over a risk tag and an outdated route summary', () => {
    const closed = road('closed',[p(0),p(100)],'blocked','landslide-risk');
    const stale = route('stale',[closed],.1,'open');
    expect(roadCondition(closed)).toBe('blocked');
    expect(routeCondition(stale)).toBe('blocked');
    expect(routeStatus(stale)).toBe('blocked');
    expect(roadConditionMessage(stale,'vi',true)).toContain('Không đi qua');
    const available = route('available',[road('other',[p(0),p(120)])],.12,'open');
    expect(recommendRoute({direct:stale,candidate:available}).best).toBe(available);
    expect(routeStatus({...stale,segs:[{...closed,status:'open',hz:undefined}]})).toBe('open');
  });

  it('does not describe a potential landslide as passable or blocked', () => {
    const risk = road('risk',[p(0),p(100)],'open','landslide-risk');
    const value = route('risk',[risk],.1,'open');
    expect(routeStatus(value)).toBe('uncertain');
    expect(roadConditionMessage(value,'vi',true)).toBe(roadConditionMessage(risk,'vi',true));
    expect(roadConditionMessage(value,'vi',true)).toContain('Có nguy cơ sạt lở');
    expect(roadConditionMessage(value,'en',true)).toContain('Landslide risk');
  });

  it('uses the same advice for village access and two chosen endpoints', () => {
    // Both routes fit the 25% detour allowance. The longer route has less
    // uncertain road even though its old weighted cost was slightly higher.
    const roads = [road('start',[p(-10),p(0)]),
      road('short-check',[p(0),p(60)],'uncertain'), road('short-end',[p(60),p(100)]),
      road('long-check',[p(0),p(30,15),p(50)],'uncertain'), road('long-end',[p(50),p(80,20),p(100)]),
      road('finish',[p(100),p(110)])];
    const journey = analyseRoadJourney(roads,selection(-10),selection(110),true,250,'conditions');
    const direct = route('short',[roads[0],roads[1],roads[2],roads[5]],.12);
    const length = (roads[3].points.slice(1).reduce((sum,v,i)=>sum+Math.hypot(v.x-roads[3].points[i].x,v.y-roads[3].points[i].y),0) +
      roads[4].points.slice(1).reduce((sum,v,i)=>sum+Math.hypot(v.x-roads[4].points[i].x,v.y-roads[4].points[i].y),0)+20)/1000;
    const candidate = route('long',[roads[0],roads[3],roads[4],roads[5]],length);
    expect(journey.route?.segs.some(road=>road.id==='long-check')).toBe(true);
    expect(recommendRoute({direct,candidate}).best).toBe(candidate);
    const village = {id:'village',name:'Bản',commune:'Chế Tạo',prio:3 as const,pop:0,hh:0,desc:['',''] as [string,string],facts:[],projected:p(110)};
    const access = recommendRoute(buildNetworkRoutes(roads,[village],p(-10)).get(village.id));
    expect(access.best?.segs.map(road=>road.id)).toEqual(journey.route?.segs.map(road=>road.id.split(':part:')[0]));
  });

  it('prefers a difficult road over an actual landslide risk within the detour allowance', () => {
    const roads = [road('risk',[p(0),p(100)],'uncertain','landslide-risk'),
      road('difficult',[p(0),p(50,30),p(100)],'uncertain')];
    const journey = analyseRoadJourney(roads,selection(0),selection(100),true,250,'conditions');
    expect(journey.route?.segs.every(road=>road.sourceRoadId==='difficult')).toBe(true);
    expect(routeCondition(journey.route!)).toBe('uncertain');
    expect(roadConditionMessage(journey.route!,'en',true)).toBe('Difficult but possible');
  });

  it('preserves a path identity when it moves between advice and alternatives', () => {
    const roads = [road('start',[p(-10),p(0)]),road('main',[p(0),p(100)],'uncertain'),
      road('north',[p(0),p(50,30),p(100)],'uncertain'),road('finish',[p(100),p(110)])];
    const before = analyseRoadJourney(roads,selection(-10),selection(110),true,250,'conditions');
    const chosen = before.alternatives[0];
    expect(chosen).toBeDefined();
    const updated = roads.map(road=>road.id==='north'?{...road,status:'open' as const}:road);
    const after = analyseRoadJourney(updated,selection(-10),selection(110),true,250,'conditions');
    expect(after.route?.id).toBe(chosen.id);
    expect(after.alternatives[0].id).toBe(before.route?.id);
    const closed = analyseRoadJourney(updated.map(road=>road.id==='north'?{...road,status:'blocked' as const}:road),selection(-10),selection(110),true,250,'conditions');
    expect([closed.route,...closed.alternatives].some(route=>route?.id===chosen.id)).toBe(false);
    expect(closed.route?.segs.some(road=>road.status==='blocked')).toBe(false);
  });
});
