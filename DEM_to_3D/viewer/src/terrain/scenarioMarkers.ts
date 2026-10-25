import * as THREE from 'three';
import type { TerrainMetadata } from '../types/terrain';
import { terrainSurfaceElevation } from './terrainSurface';
import { projectedToScene } from './coordinate';
import { createScreenMarkers, type ScreenMarkerOptions } from './screenMarkers';
import { createRoadConditionMarkers } from './roadConditionMarkers';
import { hazardLayerVisible } from '../features/map/visibleMapRecords';
import type { RoadSegment } from '../types/dear';
import type { LocalRoadAreaLink } from '../features/route-film/localNetwork';

export function createScenarioMarkers(host: HTMLElement, options: ScreenMarkerOptions & {
  metadata: TerrainMetadata; grid: Float32Array; transform: THREE.Matrix4;
  elevationAt?: (x: number, y: number) => number | undefined;
  roads?: RoadSegment[]; contextRoads?: RoadSegment[]; roadAreaLinks?: LocalRoadAreaLink[];
}) {
  const screen = createScreenMarkers(host, options);
  const roads = options.layers.status && options.layers.roads ? [...(options.roads ?? []), ...(options.layers.localRoads === false ? [] : options.contextRoads ?? [])] : [];
  const signs = createRoadConditionMarkers(host, roads, options.roadAreaLinks, options.locale,
    id => options.onSelect({type:'road',id}), options.interactive !== false,
    // A sign at a shown landslide is carried by its pin instead.
    options.hazards.filter(hazard => hazardLayerVisible(hazard, options.layers)).map(hazard => hazard.projected));
  const point = new THREE.Vector3();
  let width = host.clientWidth, height = host.clientHeight;
  return {
    update(camera: THREE.Camera): void {
      width = host.clientWidth; height = host.clientHeight;
      const project = (position: {x:number;y:number}) => {
        const elevation = options.elevationAt ? options.elevationAt(position.x, position.y) : terrainSurfaceElevation(options.grid, options.metadata, position.x, position.y);
        // Outside every DEM a point can only rest on the flat regional basemap.
        if (elevation === undefined && options.layers.context === false) return null;
        const local = projectedToScene(options.metadata, position, (elevation ?? options.metadata.elevation.base_elevation) + 3);
        point.set(local.x, local.y, local.z).applyMatrix4(options.transform).project(camera);
        return point.z >= -1 && point.z <= 1 ? {
          x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2
        } : null;
      };
      signs.update(project);
      screen.update(project);
    },
    dispose: () => { signs.dispose(); screen.dispose(); }
  };
}
