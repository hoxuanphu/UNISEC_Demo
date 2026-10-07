import { describe, expect, it } from 'vitest';
import packetJson from '../../../public/scenarios/che-tao/v0.2/incident.json';
import { validateIncidentPacket } from '../../data/incidentPacket';
import { deriveIncidentWorkspace } from './deriveIncidentWorkspace';

const packet = () => validateIncidentPacket(structuredClone(packetJson));

describe('incident workspace snapshot', () => {
  it('recalculates access, road impact and evidence together without changing the input', () => {
    const input = packet(), original = structuredClone(input);
    const before = deriveIncidentWorkspace(input, false);
    const after = deriveIncidentWorkspace(input, true);
    expect(before.assessments.get('NK')?.access).toBe('uncertain');
    expect(after.assessments.get('NK')?.access).toBe('blocked');
    expect(after.roads.find(road => road.id === input.report.roadId)?.status).toBe('blocked');
    expect(after.hazards.find(hazard => hazard.id === input.report.hazard.id)).toEqual(input.report.hazard);
    expect(after.evidence.find(item => item.hazardId === input.report.evidence.hazardId)).toEqual(input.report.evidence);
    const pair = after.routes.get('NK')!;
    for (const route of [pair.direct, pair.candidate]) {
      expect(route?.status).toBe('blocked');
      expect(route?.eta).toBeUndefined();
    }
    expect(input).toEqual(original);
    expect(deriveIncidentWorkspace(input, false)).toEqual(before);
  });

  it('excludes communities outside the AOI from counts, routes and assessments', () => {
    const input = packet();
    input.communities.push({ ...input.communities[0], id: 'OUTSIDE', projected: { x: 0, y: 0 } });
    input.signals.OUTSIDE = { communication: 'lost', urgentNeed: true };
    const result = deriveIncidentWorkspace(input, false);
    expect(result.communities.some(community => community.id === 'OUTSIDE')).toBe(false);
    expect(result.routes.has('OUTSIDE')).toBe(false);
    expect(result.assessments.has('OUTSIDE')).toBe(false);
    for (const community of result.communities) {
      expect(community.prio).toBe(result.assessments.get(community.id)?.priority);
      const pair = result.routes.get(community.id)!;
      for (const route of [pair.direct, pair.candidate]) {
        if (route) expect(route.segs.every(segment => result.roads.includes(segment))).toBe(true);
      }
    }
  });

  it('fails explicitly if the calculation is called without its staging origin', () => {
    const input = packet();
    input.responseSites = input.responseSites.filter(site => site.kind !== 'staging');
    expect(() => deriveIncidentWorkspace(input, false)).toThrow('staging site');
  });
});
