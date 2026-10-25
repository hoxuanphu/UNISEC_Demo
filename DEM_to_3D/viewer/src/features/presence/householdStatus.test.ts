import { describe, expect, it } from 'vitest';
import type { AnalysisLayer, ImageryRaster } from '../imagery/analysisImagery';
import type { HouseholdAccess } from './householdIsolation';
import { householdsOfConcern, householdStatuses, postEventCoverage } from './householdStatus';

const hut = (id: string, x: number, isolated: boolean, access = true, people = 5): HouseholdAccess => ({
  cluster: { id, name: [id, id], longitude: 104.05, latitude: 21.7, households: 1, people, devices: 1, lastSeenAt: '2026-09-12T13:00:00+07:00' },
  projected: { x, y: 50 }, isolated, access: access ? { roadId: 'r', point: { x, y: 0 }, distanceM: 50 } : null, cutBy: [],
});
const raster = (bounds: [number, number, number, number]) => ({ terrain: { bounds, width: 1 } }) as unknown as ImageryRaster;

describe('household status', () => {
  const coverage: [number, number, number, number][] = [[0, 0, 100, 100]];
  it('reads cut off, team, rescued, unverified and clear from the access, teams, tasks and imagery', () => {
    const views = householdStatuses([hut('A', 10, true), hut('B', 20, true), hut('C', 30, true), hut('D', 200, false), hut('E', 40, false, false), hut('F', 50, false)],
      coverage, new Set(['B']), new Set(['C']));
    expect(views.map(view => [view.cluster.id, view.status, view.unverified])).toEqual([
      ['A', 'cut-off', undefined], ['B', 'team', undefined], ['C', 'cut-off', undefined],
      ['D', 'unverified', 'no-imagery'], ['E', 'unverified', 'no-road'], ['F', 'clear', undefined]]);
  });
  it('keeps an assigned team or completed check separate from a confirmed rescue', () => {
    const pending = hut('pending', 10, true), rescued = hut('rescued', 20, true);
    rescued.cluster.rescued = { at: '2026-09-12T14:00:00+07:00', to: ['Điểm tập kết', 'Assembly point'] };
    const views = householdStatuses([pending, rescued], coverage, new Set(['pending']), new Set(['pending']));
    expect(views.map(item => item.status)).toEqual(['team', 'rescued']);
  });
  it('lists those needing a responder, most urgent first, then by head count', () => {
    const views = householdStatuses([hut('T', 10, true), hut('U', 200, false, true, 9), hut('A', 20, true, true, 3), hut('B', 30, true, true, 8), hut('F', 50, false)], coverage, new Set(['T']), new Set());
    expect(householdsOfConcern(views).map(view => view.cluster.id)).toEqual(['B', 'A', 'T', 'U']);
  });
  it('counts only images taken between the trigger and the time of the picture', () => {
    const layers = [
      { id: 'opt', name: ['', ''], kind: 'optical', parts: [
        { ...raster([0, 0, 1, 1]), id: 'before', acquired: '2026-09-01T03:00:00Z', source: '', pixelM: 3, cloudPercent: 0 },
        { ...raster([2, 2, 3, 3]), id: 'after', acquired: '2026-09-12T03:43:00Z', source: '', pixelM: 3, cloudPercent: 0 }] },
      { id: 'sar', name: ['', ''], kind: 'sar', acquired: '2026-10-18T11:00:00Z', source: '', pixelM: 10, rangesDb: { vv: [0, 1] }, modes: { vv: raster([4, 4, 5, 5]) } },
    ] as AnalysisLayer[];
    expect(postEventCoverage(layers, '2026-09-12T03:40:00+07:00', '2026-09-12T14:02:00+07:00')).toEqual([[2, 2, 3, 3]]);
  });
});
