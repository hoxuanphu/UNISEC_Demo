import { describe, expect, it } from 'vitest';
import type { ScenarioRoute } from '../../types/dear';
import { createRouteSimulation, simulationPath, simulationPoint } from './routeSimulation';
const points=[{x:0,y:0},{x:0,y:10},{x:0,y:10},{x:90,y:10}];
const route:ScenarioRoute={id:'route',communityId:'',type:'candidate',name:['Tuyến','Route'],points,
  segs:[{id:'road',name:['Đường','Road'],points,status:'open',cls:'track',len:.1}],status:'open',lengthKm:.1};
describe('person movement on mapped routes',()=>{
  it('interpolates by ground distance through bends and duplicate vertices, never by vertex count',()=>{
    const path=simulationPath(route)!;
    expect(path.total).toBe(100);
    expect(simulationPoint(path,5)).toEqual({x:0,y:5});
    expect(simulationPoint(path,50)).toEqual({x:40,y:10});
    expect(simulationPoint(path,-1)).toEqual(points[0]);
    expect(simulationPoint(path,200)).toEqual(points.at(-1));
    expect(simulationPoint(path,NaN)).toEqual(points[0]);
    expect(route.points).toEqual(points);
  });
  it('does not animate blocked roads, empty paths, invalid geometry or coincident points',()=>{
    expect(createRouteSimulation(null)).toBeNull();
    expect(createRouteSimulation({...route,segs:[{...route.segs[0],status:'blocked'}]})).toBeNull();
    expect(createRouteSimulation({...route,points:[{x:NaN,y:0},points[1]]})).toBeNull();
    expect(createRouteSimulation({...route,points:[points[0],points[0]]})).toBeNull();
    expect(createRouteSimulation({...route,points:[]})).toBeNull();
    expect(createRouteSimulation({...route,segs:[route.segs[0],{...route.segs[0],points:[{x:500,y:0},{x:600,y:0}]}]})).toBeNull();
  });
  it('pauses, seeks, changes rate and replays without mutating the selected route',()=>{
    const playback=createRouteSimulation(route,'A Phủ')!;
    let updates=0;const unsubscribe=playback.subscribe(()=>updates++);
    const original=playback.getSnapshot();
    playback.advance(.25);expect(playback.getSnapshot()).toBe(original);
    playback.play();for(let i=0;i<60;i++)playback.advance(.25);
    expect(playback.getSnapshot().progress).toBeCloseTo(.5);
    expect(playback.getSnapshot().point.x).toBeCloseTo(40);expect(playback.getSnapshot().point.y).toBe(10);
    playback.pause();const paused=playback.getSnapshot();playback.advance(1);expect(playback.getSnapshot()).toBe(paused);
    playback.seek(.9);expect(playback.getSnapshot().status).toBe('paused');
    playback.setRate(2);playback.play();for(let i=0;i<10;i++)playback.advance(.25);
    expect(playback.getSnapshot().status).toBe('finished');expect(playback.getSnapshot().point).toEqual(points.at(-1));
    playback.play();expect(playback.getSnapshot().distance).toBe(0);
    playback.seek(.5);expect(playback.getSnapshot().status).toBe('playing');
    playback.reset();expect(playback.getSnapshot().status).toBe('idle');expect(playback.getSnapshot().distance).toBe(0);
    const count=updates;unsubscribe();playback.play();expect(updates).toBe(count);
    expect(route.points).toEqual(points);
  });
  it('clamps stalled frames and rejects corrupt control input instead of jumping over the route',()=>{
    const playback=createRouteSimulation(route)!;playback.play();playback.advance(500);
    expect(playback.getSnapshot().progress).toBeCloseTo(.25/30);
    const snapshot=playback.getSnapshot();playback.seek(NaN);playback.advance(Infinity);playback.advance(-1);playback.setRate(20);
    expect(playback.getSnapshot()).toBe(snapshot);
    playback.seek(1);expect(playback.getSnapshot().status).toBe('finished');
    playback.seek(.25);expect(playback.getSnapshot().status).toBe('paused');
  });
});
