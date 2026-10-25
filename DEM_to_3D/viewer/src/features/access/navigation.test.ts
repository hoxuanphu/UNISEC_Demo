import { describe, expect, it } from 'vitest';
import type { RoadSegment, ScenarioRoute } from '../../types/dear';
import { navigationState, routeSteps } from './navigation';

const road = (name: string, points: Array<{ x: number; y: number }>) => ({ id: name, name: [name, name], points, status: 'open' }) as unknown as RoadSegment;
// East 500 m on road A, then north 300 m on road B: a left turn.
const route = {
  id: 'r', type: 'direct', communityId: '', name: ['r', 'r'], lengthKm: .8, status: 'open',
  segs: [road('A', [{ x: 0, y: 0 }, { x: 500, y: 0 }]), road('B', [{ x: 500, y: 0 }, { x: 500, y: 300 }])],
  points: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 300 }],
} as ScenarioRoute;

describe('resident navigation', () => {
  const steps = routeSteps(route);
  it('splits the route into named roads with the turn onto each', () => {
    expect(steps.map(step => [step.name[0], Math.round(step.fromM), step.turn])).toEqual([['A', 0, 'straight'], ['B', 500, 'left']]);
    const right = { ...route, points: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: -300 }] };
    expect(routeSteps(right)[1].turn).toBe('right');
  });
  it('tells the next turn and the distance left from where the resident is', () => {
    const state = navigationState(route, steps, { x: 200, y: 10 });
    expect(state.current.name[0]).toBe('A');
    expect(Math.round(state.next!.inM)).toBe(300);
    expect(Math.round(state.remainingM)).toBe(600);
    expect(Math.round(state.offRouteM)).toBe(10);
    expect(state.arrived).toBe(false);
  });
  it('has no next turn on the last road, and arrives near the end', () => {
    expect(navigationState(route, steps, { x: 500, y: 100 }).next).toBeNull();
    expect(navigationState(route, steps, { x: 500, y: 290 }).arrived).toBe(true);
  });
});
