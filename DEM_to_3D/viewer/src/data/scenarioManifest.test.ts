import { describe, expect, it } from 'vitest';
import manifestJson from '../../public/scenarios/che-tao/v0.3/manifest.json';
import terrainMetadata from '../../public/terrain/che_tao_v2_tex.terrain.json';
import {
  buildScenarioRoutes, cheTaoIncident, initialCommunities,
  initialHazards, initialRoadSegments
} from './cheTaoScenario';
import { validateScenarioManifest } from './scenarioManifest';

const manifest = validateScenarioManifest(manifestJson);

describe('Chế Tạo prepared dataset', () => {
  it('pins the event, snapshot, CRS and item counts', () => {
    expect(manifest.incidentId).toBe(cheTaoIncident.id);
    expect(manifest.snapshotAt).toBe(cheTaoIncident.asOf);
    expect(manifest.crs).toBe(`${terrainMetadata.crs.authority}:${terrainMetadata.crs.code}`);
    expect(manifest.counts).toEqual({
      communities: initialCommunities.length,
      roads: initialRoadSegments.length,
      hazards: initialHazards.length
    });
    expect(manifest.dataKind).toBe('synthetic');
    expect(manifest.reviewStatus).toBe('draft');
  });

  it('keeps resident locations explicitly bound to the selected scenario manifest',()=>{
    expect(manifest.residentPresence?.url).toBe('/scenarios/che-tao/resident-presence.json');
    const other={...manifestJson};delete (other as {residentPresence?:unknown}).residentPresence;
    expect(validateScenarioManifest(other).residentPresence).toBeUndefined();
    expect(()=>validateScenarioManifest({...manifestJson,residentPresence:{...manifest.residentPresence,url:'/../resident-presence.json'}})).toThrow('residentPresence.url');
  });

  it('links terrain files to metadata', () => {
    expect(manifest.terrain.grid.url.endsWith(terrainMetadata.grid.file)).toBe(true);
    expect(manifest.terrain.glb.url.endsWith(terrainMetadata.mesh.file)).toBe(true);
  });

  it('rejects malformed manifests before opening terrain assets', () => {
    expect(() => validateScenarioManifest({ ...manifest, schemaVersion: 2 })).toThrow('version');
    expect(() => validateScenarioManifest({
      ...manifest, terrain: { ...manifest.terrain, glb: { ...manifest.terrain.glb, url: '/../other.glb' } }
    })).toThrow('terrain.glb.url');
    expect(() => validateScenarioManifest({ ...manifest, snapshotAt: '29/09/2026' })).toThrow('snapshotAt');
  });

  it('keeps IDs and route geometry linked to the displayed objects', () => {
    const unique = (values: string[]) => new Set(values).size === values.length;
    expect(unique(initialCommunities.map(item => item.id))).toBe(true);
    expect(unique(initialRoadSegments.map(item => item.id))).toBe(true);
    expect(unique(initialHazards.map(item => item.id))).toBe(true);
    const hazardIds = new Set(initialHazards.map(item => item.id));
    for (const road of initialRoadSegments) if (road.hz) expect(hazardIds.has(road.hz), road.id).toBe(true);
    const roads = new Set(initialRoadSegments);
    const segment = (id: string) => initialRoadSegments.find(item => item.id === id)!;
    // Sections of the single Mù Cang Chải – Chế Tạo road, named by chainage from the town.
    expect(initialRoadSegments.map(road => road.id)).toEqual(['E0', 'E1', 'E8', 'E9']);
    expect(segment('E0').name[0]).toBe('Đường Mù Cang Chải – Chế Tạo, đoạn 1');
    expect(segment('E0').fromKm).toBe(0);
    for (let i=1;i<initialRoadSegments.length;i++) expect(initialRoadSegments[i].fromKm).toBe(initialRoadSegments[i-1].toKm);
    // The three photographed scars, north to south along the road.
    expect(segment('E8').hazardIds).toEqual(['LS-03', 'LS-02', 'LS-01']);
    const routes = buildScenarioRoutes(initialRoadSegments);
    // No alternative road exists: only this road reaches Chế Tạo.
    const ct = routes.get('CT')!;
    expect([ct.candidate, ct.direct].filter(route => route != null).map(route => route.segs.map(road => road.id))).toEqual([['E0', 'E1', 'E8', 'E9']]);
    for (const community of initialCommunities) {
      const pair = routes.get(community.id);
      expect(pair, community.id).toBeDefined();
      for (const route of [pair?.candidate, pair?.direct]) {
        if (!route) continue;
        expect(route.communityId).toBe(community.id);
        expect(route.segs.length).toBeGreaterThan(0);
        for (const segment of route.segs) expect(roads.has(segment), route.id).toBe(true);
        const start = route.segs[0].points[0];
        const end = route.segs.at(-1)!.points.at(-1)!;
        const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
          Math.hypot(a.x - b.x, a.y - b.y);
        expect(distance(route.points[0], start), `${route.id} start`).toBeLessThan(100);
        expect(distance(route.points.at(-1)!, end), `${route.id} end`).toBeLessThan(100);
      }
    }
  });
});
