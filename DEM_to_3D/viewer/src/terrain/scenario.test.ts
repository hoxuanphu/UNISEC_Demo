import { Color } from 'three';
import metadataJson from '../../public/terrain/che_tao_v2_tex.terrain.json';
import { validateMetadata } from './validation';
import { describe, expect, it } from 'vitest';
import {
  cheTaoIncident,
  initialCommunities,
  initialHazards,
  scenarioHazards,
  initialRoadSegments,
  buildScenarioRoutes
} from '../data/fixtures/networkScenario';
import { roadColors } from './roadStyle';
import { buildScenarioOverlays } from './scenarioOverlays';
import type { TerrainMetadata } from '../types/terrain';
import type { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { projectedPathLength } from './pathGeometry';

describe('DEAR Scenario & Overlays', () => {
  it('validates Che Tao incident metadata and timeline', () => {
    expect(cheTaoIncident.id).toBe('INC-2026-0412');
    expect(cheTaoIncident.timeline.length).toBeGreaterThanOrEqual(6);
    expect(cheTaoIncident.sources.length).toBe(5);
  });

  it('validates 7 communities and priority ranking', () => {
    expect(initialCommunities.length).toBe(7);
    const prio1 = initialCommunities.filter((c) => c.prio === 1);
    expect(prio1.map(community => community.id)).toEqual(['NK', 'KM']);
    const namKhat = initialCommunities.find((c) => c.id === 'NK');
    expect(namKhat).toBeDefined();
    expect(namKhat?.pop).toBe(640);
  });

  it('validates initial route resolution for Nậm Khắt', () => {
    const routes = buildScenarioRoutes(initialRoadSegments);
    const nk = routes.get('NK');
    expect(nk).toBeDefined();
    expect(nk?.candidate?.status).toBe('uncertain');
    expect(nk?.direct?.status).toBe('blocked');
    expect(nk?.candidate?.lengthKm).toBeGreaterThan(0);
    expect(nk?.direct?.lengthKm).toBeGreaterThan(0);
  });

  it('uses the same geometry for displayed distances and terrain profiles', () => {
    const routes = buildScenarioRoutes(initialRoadSegments);
    for (const pair of routes.values()) for (const route of [pair.direct, pair.candidate]) {
      if (!route) continue;
      expect(Math.abs(route.lengthKm * 1000 - projectedPathLength(route.points))).toBeLessThanOrEqual(5);
      expect(Math.abs(route.segs.reduce((sum, seg) => sum + seg.len, 0) - route.lengthKm)).toBeLessThan(0.03);
      for (let i = 1; i < route.segs.length; i++) expect(route.segs[i].points[0]).toEqual(route.segs[i - 1].points.at(-1));
    }
  });

  it('validates simulated U-1 field update on PR-7 route', () => {
    const updatedRoads = initialRoadSegments.map((r) =>
      r.id === 'E13' ? { ...r, status: 'blocked' as const } : r
    );
    const routes = buildScenarioRoutes(updatedRoads);
    const nk = routes.get('NK');
    expect(nk?.candidate?.status).toBe('blocked');
    expect(scenarioHazards(true).find(hazard => hazard.id === 'U-1')?.detected).toBe('14:11 12/09/2026');
    expect(scenarioHazards(false).find(hazard => hazard.id === 'U-1')?.detected).toBe('13:29 12/09/2026');
  });

  it('does not invent road elevations where the DEM has no coverage', () => {
    const metadata = validateMetadata(metadataJson);
    const grid = new Float32Array(metadata.grid.shape[0] * metadata.grid.shape[1]).fill(NaN);
    const overlays = buildScenarioOverlays({metadata, grid, communities: [], hazards: [], roads: initialRoadSegments,
      selectedRoute: null, selectedCommunityId: null, selectedObjectId: null, layers: {roads: true, status: true}, screenMarkers: true});
    expect(overlays.getObjectByName('scenario-roads')!.children).toHaveLength(0);
  });

  it.each([
    { routeType: 'candidate' as const, roadsVisible: true, warningId: 'E13', color: new Color(roadColors.selected).getHex(), dashed: false },
    { routeType: 'direct' as const, roadsVisible: true, warningId: 'E8', color: new Color(roadColors.blocked).getHex(), dashed: false },
    { routeType: 'candidate' as const, roadsVisible: false, warningId: 'E13', color: new Color(roadColors.selected).getHex(), dashed: false }
  ])('preserves road warnings on $routeType route with network visible=$roadsVisible', ({ routeType, roadsVisible, warningId, color, dashed }) => {
    const dummyMetadata: TerrainMetadata = {
      schema_version: 1,
      asset_id: 'test_terrain',
      crs: { authority: 'EPSG', code: 32648, linear_unit: 'metre' },
      scene_axes: { x: 'east', y: 'up', z: 'negative_north' },
      world_origin: { x: 399543.8, y: 2400708.0 },
      grid: {
        file: 'test.grid.bin',
        shape: [10, 10],
        shape_order: 'rows_cols',
        dtype: 'float32',
        byte_order: 'little_endian',
        layout: 'row_major',
        nodata_encoding: 'nan',
        elevation_unit: 'metre',
        sampling_method: 'nearest_subsample',
        source_step: 1,
        byte_length: 400
      },
      grid_transform: {
        a: 3000,
        b: 0,
        c: 390000,
        d: 0,
        e: -3000,
        // Include every road inside the mesh's outer vertices, not only within
        // the half-cell nearest-neighbour fringe outside the rendered mesh.
        f: 2420000,
        convention: 'rasterio_affine',
        pixel_reference: 'center'
      },
      elevation: {
        base_elevation: 100,
        exaggeration: 1.5,
        normalize_base: true,
        min: 100,
        max: 2000
      },
      analysis_supported: true
    };
    const dummyGrid = new Float32Array(100).fill(500);

    const routes = buildScenarioRoutes(initialRoadSegments);
    const selectedRoute = routes.get('NK')![routeType]!;
    const overlays = buildScenarioOverlays({
      metadata: dummyMetadata,
      grid: dummyGrid,
      communities: initialCommunities,
      hazards: initialHazards,
      roads: initialRoadSegments,
      selectedRoute,
      selectedCommunityId: 'NK',
      selectedObjectId: null,
      layers: {
        roads: roadsVisible,
        status: true,
        communities: true,
        landslide: true,
        staging: true,
        route: true
      }
    });

    expect(overlays.name).toBe('dear-scenario-overlays');
    expect(overlays.children.length).toBe(4); // roads, communities, hazards, staging
    const roadLines = overlays.getObjectByName('scenario-roads')!.children as Line2[];
    const warning = roadLines.find(line => line.userData.id === warningId && !line.userData.casing)!;
    expect(warning.material.color.getHex()).toBe(color);
    expect(warning.material.dashed).toBe(dashed);
    const casing = roadLines.find(line => line.userData.id === warningId && line.userData.casing)!;
    // A traversable selected route stays blue with an amber caution rim; closures stay red.
    expect(casing.material.color.getHexString()).toBe((routeType === 'candidate' ? roadColors.uncertain : roadColors.neutralCasing).slice(1));
    expect(casing.material.color.getHexString()).not.toBe(roadColors.selectedCasing.slice(1));
    if (!roadsVisible) {
      const renderedIds = new Set(roadLines.map(line => line.userData.id));
      expect(renderedIds).toEqual(new Set(selectedRoute.segs.map(segment => segment.id)));
    }
    overlays.traverse(object => {
      const mesh = object as Line2;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(material => material?.dispose());
    });
  });
});
