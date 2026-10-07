import { describe, expect, it } from 'vitest';
import { initialHazards, initialRoadSegments, buildScenarioRoutes, scenarioHazards } from '../../data/cheTaoScenario';
import { assessCommunity } from './responseAssessment';

const signal = { communication: 'unknown' as const, urgentNeed: false };
describe('response assessment', () => {
  it('traces a priority to reported impact on an affected access road', () => {
    const routes = buildScenarioRoutes(initialRoadSegments);
    const result = assessCommunity(routes.get('KM'), initialHazards, signal);
    expect(result.priority).toBe(1); expect(result.hazardIds).toEqual(['B-2']); expect(result.access).toBe('uncertain');
    expect(result.reason[0]).toContain('báo cáo');
    expect(result.reason[0]).toContain('cầu');
    expect(result.reason[0]).not.toContain('ngập');
  });
  it('does not promote missing road data into safe access or proven isolation', () => {
    const result = assessCommunity(undefined, initialHazards, signal);
    expect(result.access).toBe('unmapped'); expect(result.priority).toBe(2); expect(result.hazardIds).toEqual([]);
  });
  it('changes the action when the previously uncertain bypass becomes blocked', () => {
    const routes = buildScenarioRoutes(initialRoadSegments.map(r => r.id === 'E13' ? { ...r, status: 'blocked' as const } : r));
    const result = assessCommunity(routes.get('NK'), scenarioHazards(true), { ...signal, communication: 'lost' });
    expect(result.access).toBe('blocked'); expect(result.hazardIds.sort()).toEqual(['LS-02', 'U-1']);
    expect(result.nextAction[0]).toContain('khác');
  });
  it('prioritizes an urgent request even when no access geometry is available', () => {
    expect(assessCommunity(undefined, [], { ...signal, urgentNeed: true }).priority).toBe(1);
  });
  it('reports blocked access even without a linked hazard report or communication loss', () => {
    const roads = initialRoadSegments.map(road => road.id === 'E13' ? { ...road, status: 'blocked' as const } : road);
    const result = assessCommunity(buildScenarioRoutes(roads).get('NK'), [], { ...signal, communication: 'available' });
    expect(result.access).toBe('blocked');
    expect(result.reason[0]).toBe('Các tuyến đã biết đều có đoạn bị chặn');
    expect(result.nextAction[0]).toContain('khác');
  });
  it('keeps communication loss in the priority basis when access remains uncertain', () => {
    const result = assessCommunity(buildScenarioRoutes(initialRoadSegments).get('KM'), [], { ...signal, communication: 'lost' });
    expect(result.priority).toBe(1);
    expect(result.access).toBe('uncertain');
    expect(result.reason[0]).toContain('Mất liên lạc');
  });
});
