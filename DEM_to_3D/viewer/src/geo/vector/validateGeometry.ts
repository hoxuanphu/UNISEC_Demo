import area from '@turf/area';
import intersect from '@turf/intersect';
import pointInPolygon from '@turf/boolean-point-in-polygon';
import type { Polygon, Position } from 'geojson';
import { GeometryError, geometryPositions, type VectorGeometry } from './types';

const same = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1];
const epsilon = 1e-12;
const cross = (a: Position, b: Position, c: Position) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function onSegment(a: Position, b: Position, c: Position): boolean {
  return Math.abs(cross(a, b, c)) <= epsilon && c[0] >= Math.min(a[0], b[0])-epsilon &&
    c[0] <= Math.max(a[0], b[0])+epsilon && c[1] >= Math.min(a[1], b[1])-epsilon && c[1] <= Math.max(a[1], b[1])+epsilon;
}
function crosses(a: Position, b: Position, c: Position, d: Position): boolean {
  const abC = cross(a,b,c), abD = cross(a,b,d), cdA = cross(c,d,a), cdB = cross(c,d,b);
  return ((abC > epsilon && abD < -epsilon || abC < -epsilon && abD > epsilon) &&
    (cdA > epsilon && cdB < -epsilon || cdA < -epsilon && cdB > epsilon)) ||
    onSegment(a,b,c) || onSegment(a,b,d) || onSegment(c,d,a) || onSegment(c,d,b);
}

function validatePolygon(polygon: Polygon): void {
  const rings = polygon.coordinates;
  if (!rings.length) throw new GeometryError('empty');
  for (const ring of rings) {
    if (ring.length < 4 || new Set(ring.slice(0,-1).map(p => `${p[0]},${p[1]}`)).size < 3) throw new GeometryError('ring-points');
    if (!ring[0].every((coordinate,index)=>coordinate === ring[ring.length-1][index])) throw new GeometryError('ring-open');
    if (new Set(ring.slice(0,-1).map(p => `${p[0]},${p[1]}`)).size !== ring.length-1) throw new GeometryError('self-intersection');
    for (let i=0; i<ring.length-1; i++) for (let j=i+1; j<ring.length-1; j++) {
      if (j === i+1 || i === 0 && j === ring.length-2) continue;
      if (crosses(ring[i],ring[i+1],ring[j],ring[j+1])) throw new GeometryError('self-intersection');
    }
    // Adjacent backtracking segments are invalid even though their shared vertex is allowed.
    for (let i=0; i<ring.length-1; i++) {
      const a=ring[(i+ring.length-2)%(ring.length-1)], b=ring[i], c=ring[(i+1)%(ring.length-1)];
      if (same(b,c) || onSegment(a,b,c) || onSegment(b,c,a)) throw new GeometryError('self-intersection');
    }
    if (area({ type:'Polygon', coordinates:[ring] }) < 0.01) throw new GeometryError('zero-area');
  }
  for (let r=0; r<rings.length; r++) for (let s=r+1; s<rings.length; s++) {
    for (let i=0; i<rings[r].length-1; i++) for (let j=0; j<rings[s].length-1; j++) {
      if (crosses(rings[r][i],rings[r][i+1],rings[s][j],rings[s][j+1])) throw new GeometryError('holes');
    }
    if (r > 0 && (pointInPolygon(rings[r][0], {type:'Polygon',coordinates:[rings[s]]}) ||
      pointInPolygon(rings[s][0], {type:'Polygon',coordinates:[rings[r]]}))) throw new GeometryError('holes');
  }
  for (const hole of rings.slice(1)) {
    if (!pointInPolygon(hole[0], {type:'Polygon',coordinates:[rings[0]]}, {ignoreBoundary:true})) throw new GeometryError('holes');
  }
}

/** Reject unsupported coordinates and invalid topology; never guess a projected CRS. */
export function validateGeometry(value: unknown): VectorGeometry {
  const raw = value as VectorGeometry;
  if (!raw || !['Point','LineString','Polygon','MultiPolygon'].includes(raw.type)) throw new GeometryError('geometry-type');
  let geometry: VectorGeometry;
  try { geometry = JSON.parse(JSON.stringify(raw)); } catch { throw new GeometryError('coordinates'); }
  let positions: number[][];
  try { positions = geometryPositions(geometry); } catch { throw new GeometryError('coordinates'); }
  if (!positions.length) throw new GeometryError('empty');
  if (positions.length > 1500) throw new GeometryError('vertex-limit');
  for (const p of positions) {
    if (!Array.isArray(p) || p.length < 2 || p.length > 3 || p.some(n => typeof n !== 'number' || !Number.isFinite(n))) throw new GeometryError('coordinates');
    if (p.length !== positions[0].length) throw new GeometryError('coordinates');
    if (Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) throw new GeometryError('coordinate-range');
    if (Math.abs(p[1]) > 85.05112878) throw new GeometryError('map-range');
  }
  if (Math.max(...positions.map(p=>p[0]))-Math.min(...positions.map(p=>p[0])) > 180) throw new GeometryError('dateline');
  if (geometry.type === 'LineString' && (positions.length < 2 || positions.every(p=>same(p,positions[0])))) throw new GeometryError('line-points');
  if (geometry.type === 'Polygon') validatePolygon(geometry);
  if (geometry.type === 'MultiPolygon') {
    if (!geometry.coordinates.length || geometry.coordinates.length > 30) throw new GeometryError('empty');
    const polygons: Polygon[] = geometry.coordinates.map(coordinates=>({type:'Polygon',coordinates}));
    polygons.forEach(validatePolygon);
    for (let i=0; i<polygons.length; i++) for (let j=i+1; j<polygons.length; j++) {
      const common = intersect({type:'FeatureCollection',features:polygons.slice(i,i+1).concat(polygons[j]).map(geometry=>({type:'Feature',geometry,properties:{}}))});
      if (common && area(common) > 0.01) throw new GeometryError('multi-overlap');
    }
  }
  return geometry;
}
