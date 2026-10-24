import * as THREE from 'three';
import proj4 from 'proj4';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import {surfaceLineGeometry,stabiliseSurfaceLine} from '../../terrain/surfaceLine';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { GeometryRecord } from '../../geo/vector/types';
import type { TerrainMetadata } from '../../types/terrain';
import type { RoadSegment } from '../../types/dear';
import { terrainDrapePoints, terrainSurfaceElevation } from '../../terrain/terrainSurface';
import { projectedToScene } from '../../terrain/coordinate';
import { setDrawingLayer } from '../map/mapLayerOrder';
import { landslideAreaOf, landslideAreaStyle, roadAreaSection, landslideBoundaryCasing } from './landslideAreas';

type XY = { x: number; y: number };
/** Display drape only: samples the supplied DEM and leaves NoData gaps unfilled. */
export function terrainLandslideAreas(records: GeometryRecord[], metadata: TerrainMetadata, grid: Float32Array, roads: RoadSegment[], selectedId: string | null, resolution: { width: number; height: number }, networkVersion?: string, fillOpacity?: number): THREE.Group {
  const root = new THREE.Group(); root.name = 'mapped-landslide-areas';
  const crs = metadata.crs.proj4 || `${metadata.crs.authority}:${metadata.crs.code}`;
  const spacing = Math.max(40, Math.hypot(metadata.grid_transform.a, metadata.grid_transform.d), Math.hypot(metadata.grid_transform.b, metadata.grid_transform.e));
  let remaining = 36000;
  const surface = (p: XY) => { const z = terrainSurfaceElevation(grid, metadata, p.x, p.y); return z === undefined ? null : projectedToScene(metadata, p, z + 3); };
  const line = (points: XY[], color: string, width: number, dashed: boolean, id: string, opacity = 1, dash: [number, number] = [60, 40], casing = false) => {
    let positions: number[] = [];
    const flush = () => {
      if (positions.length >= 6) {
        const geometry = surfaceLineGeometry(positions);
        const material = stabiliseSurfaceLine(new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthTest: true, depthWrite: false, dashed, dashSize: dash[0], gapSize: dash[1] }));
        material.resolution.set(resolution.width, resolution.height);
        const object = new Line2(geometry, material); object.computeLineDistances(); object.userData.recordId = id; setDrawingLayer(object, 'landslides', casing ? .1 : .2); root.add(object);
      }
      positions = [];
    };
    for (const point of terrainDrapePoints(points,[metadata])) {
      const p=surface(point);
      if (p) positions.push(p.x,p.y,p.z); else flush();
    }
    flush();
  };
  for (const record of records) {
    const value = record.visible && landslideAreaOf(record);
    if (!value || (record.feature.geometry.type !== 'Polygon' && record.feature.geometry.type !== 'MultiPolygon')) continue;
    const selected = record.id === selectedId, style = landslideAreaStyle(value, selected, fillOpacity);
    const polygons = record.feature.geometry.type === 'Polygon' ? [record.feature.geometry.coordinates] : record.feature.geometry.coordinates;
    for (const polygon of polygons) {
      const rings = polygon.map(r => r.map(p => { const [x, y] = proj4('EPSG:4326', crs, [p[0], p[1]]); return { x, y }; }));
      if (rings.some(ring => ring.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)))) continue;
      const dash = style.dashArray?.split(' ').map(Number).map(size => size * 10) as [number, number] | undefined;
      rings.forEach(r => {
        line(r, landslideBoundaryCasing, style.weight + 1.2, false, record.id, .8, undefined, true);
        line(r, style.color, style.weight, Boolean(dash), record.id, 1, dash);
      });
      const contour = rings[0].slice(0, -1), holes = rings.slice(1).map(r => r.slice(0, -1));
      const vertices = [contour, ...holes].flat();
      const triangles = THREE.ShapeUtils.triangulateShape(contour.map(p => new THREE.Vector2(p.x, p.y)), holes.map(h => h.map(p => new THREE.Vector2(p.x, p.y))));
      const positions: number[] = []; const limit=Math.min(remaining,12000); let budget = limit, exceeded = false;
      const append = (a: XY, b: XY, c: XY, depth = 0) => {
        if (exceeded) return;
        const ab = Math.hypot(a.x-b.x,a.y-b.y), bc = Math.hypot(b.x-c.x,b.y-c.y), ca = Math.hypot(c.x-a.x,c.y-a.y);
        if (Math.max(ab,bc,ca) > spacing * 1.5 && depth < 18) {
          if (ab >= bc && ab >= ca) { const m={x:(a.x+b.x)/2,y:(a.y+b.y)/2}; append(a,m,c,depth+1); append(m,b,c,depth+1); }
          else if (bc >= ca) { const m={x:(b.x+c.x)/2,y:(b.y+c.y)/2}; append(a,b,m,depth+1); append(a,m,c,depth+1); }
          else { const m={x:(c.x+a.x)/2,y:(c.y+a.y)/2}; append(a,b,m,depth+1); append(m,b,c,depth+1); }
          return;
        }
        if (--budget < 0) { exceeded = true; return; }
        const samples = [surface(a), surface(b), surface(c)], centre = surface({x:(a.x+b.x+c.x)/3,y:(a.y+b.y+c.y)/3});
        if (centre && samples.every(p => p !== null)) samples.forEach(p => positions.push(p!.x,p!.y,p!.z));
      };
      triangles.forEach(t => append(vertices[t[0]],vertices[t[1]],vertices[t[2]]));
      remaining=Math.max(0,remaining-(limit-budget));
      // A large footprint keeps its complete outline instead of a truncated, misleading fill.
      if (!exceeded && positions.length) {
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
        const material = new THREE.MeshBasicMaterial({color:style.color,side:THREE.DoubleSide,transparent:true,opacity:style.fillOpacity,depthWrite:false,depthTest:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
        const mesh = new THREE.Mesh(geometry,material); mesh.userData.recordId=record.id; setDrawingLayer(mesh, 'landslides'); root.add(mesh);
      }
    }
    if (selected && value.networkVersion === networkVersion) for (const link of value.roadLinks) { const road=roads.find(r=>r.id===link.roadId); if(road) line(roadAreaSection(road,link),style.color,8,link.relation==='threatens',record.id,.3); }
  }
  return root;
}
export function disposeTerrainAreas(group: THREE.Group | null): void {
  group?.removeFromParent();
  group?.traverse(object => { const item=object as THREE.Mesh; item.geometry?.dispose(); const materials=item.material?(Array.isArray(item.material)?item.material:[item.material]):[]; materials.forEach(m=>m.dispose()); });
}
