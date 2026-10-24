import { setDrawingLayer } from '../features/map/mapLayerOrder';
import * as THREE from 'three';
import proj4 from 'proj4';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import {surfaceLineGeometry,stabiliseSurfaceLine} from './surfaceLine';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { GeometryRecord } from '../geo/vector/types';
import type { TerrainMetadata } from '../types/terrain';
import { projectedToScene } from './coordinate';
import { roadColors, roadSurfaceOffsetM } from './roadStyle';
import { terrainDrapePoints, terrainSurfaceElevation } from './terrainSurface';

type Surface = {model:{metadata?:TerrainMetadata|null;grid?:Float32Array|null};group:THREE.Object3D};
/** Display-only drape. Preserve the OSM planimetry and break at missing heights.
 * Context elevation is never passed into the profile or routing analysis.
 */
export function terrainReferenceRoads(records:GeometryRecord[], surfaces:Surface[], selectedId:string|null,
  resolution:{width:number;height:number}, contextPoint?: (x:number,y:number)=>THREE.Vector3|undefined):THREE.Group {
  const group = new THREE.Group(); group.name = 'reference-roads';
  const first = surfaces.find(surface => surface.model.metadata)?.model.metadata;
  if (!first) return group;
  const crs = first.crs.proj4 || `${first.crs.authority}:${first.crs.code}`;
  const surfacePoint = (x:number,y:number) => {
    for (const surface of surfaces) {
      const {metadata,grid} = surface.model; if (!metadata || !grid) continue;
      const elevation = terrainSurfaceElevation(grid,metadata,x,y);
      if (elevation === undefined) continue;
      const p = projectedToScene(metadata,{x,y},elevation+roadSurfaceOffsetM);
      return new THREE.Vector3(p.x,p.y,p.z).applyMatrix4(surface.group.matrixWorld);
    }
    return contextPoint?.(x,y);
  };
  for (const record of records) {
    if (!record.visible || record.feature.properties.referenceKind !== 'road-corridor' || record.feature.geometry.type !== 'LineString') continue;
    const selected = record.id === selectedId;
    let positions:number[] = [];
    const flush = () => {
      if (positions.length >= 6) for (const [color,width] of [[roadColors.referenceCasing,selected?5:4],[roadColors.reference,selected?3:2]] as const) {
        const geometry = surfaceLineGeometry(positions);
        const material = stabiliseSurfaceLine(new LineMaterial({color,linewidth:width,depthWrite:false,depthTest:true,transparent:true}));
        material.resolution.set(resolution.width,resolution.height);
        const line = new Line2(geometry,material);line.userData.recordId=record.id;setDrawingLayer(line, 'reference', color===roadColors.referenceCasing ? 0 : .2);group.add(line);
      }
      positions=[];
    };
    const xy = record.feature.geometry.coordinates.map(p=>proj4('EPSG:4326',crs,p.slice(0,2)));
    for(const p of terrainDrapePoints(xy.map(([x,y])=>({x,y})),surfaces.flatMap(surface=>surface.model.metadata ? [surface.model.metadata] : []))) {
      const point=surfacePoint(p.x,p.y);
      if(point)positions.push(point.x,point.y,point.z);else flush();
    }
    flush();
  }
  return group;
}
