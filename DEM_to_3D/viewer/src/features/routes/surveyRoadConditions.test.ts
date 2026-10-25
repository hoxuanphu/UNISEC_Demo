import { describe, expect, it } from 'vitest';
import surveyKml from '../../../public/scenarios/che-tao/field/CheTao-Landslide-Scars.kml?raw';
import incident from '../../../public/scenarios/che-tao/v0.3/incident.json';
import { validateIncidentPacket } from '../../data/incidentPacket';
import { fieldRecords } from '../landslides/fieldDataset';
import { deriveIncidentWorkspace } from '../incident/deriveIncidentWorkspace';
import type { VectorFeature } from '../../geo/vector/types';
import { surveyConditionAreas, withSurveyRoadConditions } from './surveyRoadConditions';

// The actual survey outlines, parsed as in the near-road warning tests.
const features: VectorFeature[] = [...surveyKml.matchAll(/<Polygon\b[^>]*>([\s\S]*?)<\/Polygon>/g)].map((match, i) => ({
  type: 'Feature', properties: { name: `Survey scar ${i}` }, geometry: { type: 'Polygon', coordinates: [
    /<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/.exec(match[1])![1].trim().split(/\s+/).map(tuple => tuple.split(',').map(Number)),
  ] },
}));
const areas = surveyConditionAreas(fieldRecords(features, 'survey-fixture', 'CheTao-Landslide-Scars.kml', 'network', '2026-10-19T00:00:00Z'));
const packet = validateIncidentPacket(incident);

describe('mapped landslides on the main road', () => {
  it('marks every open section a mapped extent touches as one to verify, never as blocked', () => {
    const { roads, links } = withSurveyRoadConditions(packet.roads, areas);
    const byId = new Map(roads.map(road => [road.id, road]));
    for (const id of ['E0', 'E1', 'E9']) {
      expect(byId.get(id)).toMatchObject({ status: 'uncertain', hz: 'landslide-risk', hazardIds: [] });
      expect(byId.get(id)!.landslideAreaIds!.length).toBeGreaterThan(0);
    }
    expect(byId.get('E0')!.landslideAreaIds).toHaveLength(13);
    expect(byId.get('E0')!.note![0]).toMatch(/^13 vết sạt đã khoanh chạm đường, km 9 đến 14,3\./);
    // The section already under review keeps its incident evidence.
    expect(byId.get('E8')).toEqual(packet.roads.find(road => road.id === 'E8'));
    expect(roads.some(road => road.status === 'blocked')).toBe(false);
    expect(links.every(link => link.distanceM <= 10)).toBe(true);
  });
  it('keeps a manual status and a field-report closure', () => {
    const { roads } = withSurveyRoadConditions(packet.roads, areas, new Set(['E0']));
    expect(roads.find(road => road.id === 'E0')!.status).toBe('open');
    const updated = deriveIncidentWorkspace(packet, true, [], null, areas);
    expect(updated.roads.find(road => road.id === packet.report.roadId)!.status).toBe('blocked');
    expect(updated.surveyLinks.length).toBeGreaterThan(0);
  });
  it('changes nothing without mapped extents', () => {
    expect(withSurveyRoadConditions(packet.roads, []).roads).toBe(packet.roads);
  });
});
