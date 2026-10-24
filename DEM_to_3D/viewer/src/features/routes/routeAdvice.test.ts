import { describe, expect, it } from 'vitest';
import { recommendRoute, routeProblems } from './routeAdvice';
import { buildScenarioRoutes, initialRoadSegments } from '../../data/fixtures/networkScenario';
import type { ScenarioRoute } from '../../types/dear';

describe('resident route advice', () => {
  it('recommends the bypass when the main road is blocked and names the avoided road', () => {
    const { best, avoided } = recommendRoute(buildScenarioRoutes(initialRoadSegments).get('NK'));
    expect(best?.type).toBe('candidate');
    expect(avoided?.status).toBe('blocked');
    expect(routeProblems(best!).every(road => road.status !== 'open')).toBe(true);
  });
  it('still answers when every mapped route is blocked, without inventing an alternative', () => {
    const roads = initialRoadSegments.map(road => road.id === 'E13' ? { ...road, status: 'blocked' as const } : road);
    const { best, avoided } = recommendRoute(buildScenarioRoutes(roads).get('NK'));
    expect(best?.status).toBe('blocked');
    expect(avoided).toBeNull();
  });
  it('keeps the short road to check instead of a long open bypass to the village', () => {
    const route = (id: string, lengthKm: number, status: 'open' | 'uncertain'): ScenarioRoute => ({
      id, communityId: 'village', type: id === 'bypass' ? 'candidate' : 'direct', name: [id, id], lengthKm, status, points: [],
      segs: [{id: id + '-road', name: [id, id], cls: 'track', len: lengthKm, status, points: [{x: 0, y: 0}, {x: lengthKm * 1000, y: 0}]}],
    });
    const direct = route('main', 15, 'uncertain'), candidate = route('bypass', 32, 'open');
    expect(recommendRoute({direct, candidate}).best).toBe(direct);
  });
  it('returns nothing when no route is mapped', () => {
    expect(recommendRoute(undefined)).toEqual({ best: null, avoided: null });
  });
  it('does not replace the condition-aware candidate with a shorter route having more unchecked road', () => {
    const route = (id: string, lengthKm: number, uncheckedKm: number): ScenarioRoute => ({
      id, communityId: 'village', type: 'candidate', name: [id, id], lengthKm, status: 'uncertain', points: [],
      segs: [
        {id: id + '-check', name: [id, id], cls: 'track', len: uncheckedKm, status: 'uncertain', points: [{x: 0, y: 0}, {x: uncheckedKm * 1000, y: 0}]},
        {id: id + '-open', name: [id, id], cls: 'track', len: lengthKm - uncheckedKm, status: 'open', points: [{x: uncheckedKm * 1000, y: 0}, {x: lengthKm * 1000, y: 0}]},
      ],
    });
    const direct = route('short', 10, 9), candidate = route('less-affected', 12, 1);
    expect(recommendRoute({direct, candidate})).toEqual({best: candidate, avoided: direct});
  });
});
