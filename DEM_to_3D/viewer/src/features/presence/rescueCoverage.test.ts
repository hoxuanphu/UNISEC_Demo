import { describe, expect, it } from 'vitest';
import type { DevicePosition, LocationFeed } from '../tracking/deviceFeed';
import type { HouseholdView } from './householdStatus';
import { coverageSpots, createRescueTrail, unreachedNeeds } from './rescueCoverage';

const hut = (id: string, x: number, status: HouseholdView['status']) => ({ cluster: { id }, projected: { x, y: 0 }, status }) as unknown as HouseholdView;
const device = (id: string, role: 'rescue' | 'resident', x: number, extra: Partial<DevicePosition> = {}) => ({ id, role, point: { x, y: 0 }, state: 'moving', ...extra }) as DevicePosition;

describe('rescue coverage', () => {
  it('lifts the fog where teams have been and marks who still waits', () => {
    const spots = coverageSpots({ households: [hut('cut', 5000, 'cut-off'), hut('done', 9000, 'rescued'), hut('quiet', 7000, 'unverified')],
      devices: [device('CH-01', 'rescue', 0), device('ND-05', 'resident', 3000, { closureRoadId: 'r', state: 'waiting' })], trail: [{ x: 1000, y: 0 }], bases: [{ x: 0, y: 0 }], requests: [{ x: 3010, y: 0 }] });
    expect(spots.filter(spot => spot.kind === 'reached').map(spot => spot.point.x)).toEqual([0, 1000, 9000]);
    expect(spots.filter(spot => spot.kind === 'need').map(spot => spot.point.x)).toEqual([5000, 3000, 3010]);
    expect(spots.filter(spot => spot.kind === 'unverified').map(spot => spot.point.x)).toEqual([7000]);
    expect(unreachedNeeds(spots)).toBe(3);
    // A team arriving beside the stranded resident and the request covers both.
    expect(unreachedNeeds(coverageSpots({ households: [], devices: [device('CH-01', 'rescue', 3000), device('ND-05', 'resident', 3000, { closureRoadId: 'r', state: 'waiting' })], trail: [], bases: [], requests: [{ x: 3010, y: 0 }] }))).toBe(0);
  });
  it('keeps cut-off and unverified huts distinct from a nearby road patrol',()=>{
    const spots=coverageSpots({households:[hut('cut',0,'cut-off'),hut('assigned',50,'team'),hut('unknown',100,'unverified'),hut('done',200,'rescued')],devices:[device('team','rescue',0)],trail:[{x:0,y:0}],bases:[],requests:[]});
    expect(unreachedNeeds(spots)).toBe(2);
    expect(spots.filter(spot=>spot.accessPending).map(spot=>spot.point.x)).toEqual([0,50,100]);
    const completed=coverageSpots({households:[hut('cut',0,'rescued')],devices:[],trail:[],bases:[],requests:[]});
    expect(completed.some(spot=>spot.accessPending)).toBe(false);expect(unreachedNeeds(completed)).toBe(0);
  });
  it('retains the covered ground when a dispatch or guidance change replaces the feed',()=>{
    const a=createRescueTrail({getSnapshot:()=>[device('a','rescue',0)],subscribe:()=>()=>undefined});a.dispose();
    const b=createRescueTrail({getSnapshot:()=>[device('a','rescue',1000)],subscribe:()=>()=>undefined},a.points());
    expect(b.points().map(point=>point.x)).toEqual([0,1000]);b.dispose();
  });
  it('remembers every cell a team has passed', () => {
    let snapshot = [device('CH-01', 'rescue', 0)], listener = () => undefined as void;
    const feed = { getSnapshot: () => snapshot, subscribe: (fn: () => void) => { listener = fn; return () => undefined; } } as unknown as LocationFeed;
    const trail = createRescueTrail(feed);
    snapshot = [device('CH-01', 'rescue', 500)]; listener();
    snapshot = [device('CH-01', 'rescue', 520)]; listener();
    expect(trail.points().map(point => point.x)).toEqual([0, 500]);
  });
});
