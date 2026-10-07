import { describe, expect, it } from 'vitest';
import type { MapScene } from '../map/mapContracts';
import { initialCommunities, initialRoadSegments, initialHazards, preparedPacket, buildScenarioRoutes } from '../../data/cheTaoScenario';
import { measurementGeometry } from './measurementGeometry';
import { defaultLayerAppearance } from '../map/layerAppearance';
import { canFinish } from './measurement';

const base: MapScene = {
  aoi: preparedPacket.aoi, communities: initialCommunities, roads: initialRoadSegments, hazards: initialHazards,
  selectedRoute: null, selectedCommunityId: null, selectedObjectId: null,
  layers: { roads: true, communities: true, aoi: true }, appearance: defaultLayerAppearance
};
describe('measurement geometry sources', () => {
  it('excludes hidden layers and open roads filtered out of the map', () => {
    expect(measurementGeometry({ ...base, layers: {} }, 'en').sources).toEqual([]);
    const visible = measurementGeometry({ ...base, appearance: { ...defaultLayerAppearance, roads: 'affected' } }, 'en');
    expect(visible.sources.some(source => source.name === initialRoadSegments.find(road => road.status === 'open')!.name[1])).toBe(false);
    expect(visible.sources.some(source => source.name === initialCommunities[0].name)).toBe(true);
  });
  it('retains an inspected road under filters and imports its exact vertices', () => {
    const road = initialRoadSegments.find(item => item.status === 'open')!;
    const geometry = measurementGeometry({ ...base, selectedObjectId: `road:${road.id}`, appearance: { ...defaultLayerAppearance, roads: 'affected' } }, 'en');
    expect(geometry.sources.some(source => source.name === road.name[1])).toBe(true);
    expect(geometry.selected?.kind).toBe('road');
    expect(geometry.selected?.points.map(({ x, y }) => ({ x, y }))).toEqual(road.points);
  });
  it('imports AOI or the active route without substituting a route for an inspected hazard', () => {
    const area = measurementGeometry({ ...base, aoi: { ...preparedPacket.aoi, points: [...preparedPacket.aoi.points, preparedPacket.aoi.points[0]] }, selectedObjectId: `aoi:${preparedPacket.aoi.id}` }, 'en').selected!;
    expect(area.closed).toBe(true); expect(canFinish('area', area.points)).toBe(true);
    const selectedRoute = buildScenarioRoutes(initialRoadSegments).get('NK')!.candidate;
    expect(measurementGeometry({ ...base, selectedRoute }, 'en').selected?.kind).toBe('route');
    expect(measurementGeometry({ ...base, selectedRoute, selectedObjectId: `hazard:${initialHazards[0].id}` }, 'en').selected).toBeUndefined();
  });
});
