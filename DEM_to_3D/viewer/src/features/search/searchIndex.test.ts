import { describe, expect, it } from 'vitest';
import { preparedPacket, initialRoadSegments, initialHazards } from '../../data/cheTaoScenario';
import { searchWorkspace } from './searchIndex';

const data = { ...preparedPacket, communities: preparedPacket.communities.map(c => ({ ...c, prio: 2 as const })), roads: initialRoadSegments, hazards: initialHazards };
describe('workspace search', () => {
  it('finds Vietnamese names without accents or case', () => {
    expect(searchWorkspace('NAM KHAT', data, 'vi')[0].key).toBe('community:NK');
  });
  it('accepts a road reference and preserves the object-detail identity', () => {
    const result = searchWorkspace('E13', data, 'vi');
    expect(result).toHaveLength(1); expect(result[0].key).toBe('road:E13');
    expect(initialRoadSegments.find(r => r.id === 'E13')!.points).toContainEqual(result[0].projected);
  });
  it('finds response sites and hazards without mixing their identities', () => {
    expect(searchWorkspace(preparedPacket.responseSites[0].id, data, 'en')[0].key).toBe(`poi:${preparedPacket.responseSites[0].id}`);
    expect(searchWorkspace('LS-02', data, 'en')[0].key).toBe('hazard:LS-02');
    expect(searchWorkspace(' ', data, 'vi')).toEqual([]);
    for (const hazard of data.hazards) {
      expect(searchWorkspace(hazard.id, data, 'vi').find(result => result.key === `hazard:${hazard.id}`)?.symbol).toBe(hazard.kind);
    }
    for (const site of data.responseSites) {
      expect(searchWorkspace(site.id, data, 'en').find(result => result.key === `poi:${site.id}`)?.symbol).toBe(site.kind);
    }
  });
});
