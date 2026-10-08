import { describe, expect, it } from 'vitest';
import type { Polygon } from 'geojson';
import area from '@turf/area';
import { GeometryError, type GeometryRecord, type GeometryRole } from '../../geo/vector/types';
import { validateGeometry } from '../../geo/vector/validateGeometry';
import { polygonCoverage } from '../../geo/vector/polygonCoverage';
import { parseSpatialInput } from './parseSpatialInput';
import { createGeometryRecords, addGeometryRecords, restoreGeometryRecords } from './geometrySession';
import { exportGeometryGeoJSON, exportGeometryKml, exportGeometryWkt } from './geometryExports';

const rectangle=(west:number,south:number,east:number,north:number):Polygon=>({type:'Polygon',coordinates:[[[west,south],[east,south],[east,north],[west,north],[west,south]]]});
const record=(id:string,role:GeometryRole,geometry:Polygon):GeometryRecord=>({id,name:id,role,visible:true,feature:{type:'Feature',geometry,properties:{}},source:{format:'WKT',name:'test',importedAt:'2026-10-08T00:00:00Z'}});
function fails(value:unknown,code:string) {
  try {validateGeometry(value);throw new Error('Expected invalid geometry');}
  catch (error) {expect(error).toBeInstanceOf(GeometryError);expect((error as GeometryError).code).toBe(code);}
}

describe('Spatial import',()=>{
  it('reads cardinal coordinates in either order, preserving longitude first internally',()=>{
    expect(parseSpatialInput('21.782919° N, 104.053554° E').features[0].geometry).toEqual({type:'Point',coordinates:[104.053554,21.782919]});
    expect(parseSpatialInput('104.053554 E 21.782919 S').features[0].geometry).toEqual({type:'Point',coordinates:[104.053554,-21.782919]});
    expect(()=>parseSpatialInput('21 N 22 N')).toThrow();
    expect(()=>parseSpatialInput('-21 N 104 E')).toThrow();
  });
  it('reads labeled multiline WKT batches and rejects trailing garbage',()=>{
    const parsed=parseSpatialInput('Strip 1: POLYGON((104 21,105 21,105 22,104 21))\nPoint: POINT(104.053554 21.782919)');
    expect(parsed.features).toHaveLength(2);expect(parsed.features[0].properties.name).toBe('Strip 1');
    expect(()=>parseSpatialInput('POINT(104 21) garbage')).toThrow();
    expect(()=>parseSpatialInput('POINT(10421)')).toThrow();
  });
  it('accepts explicit WGS84 SRID and rejects projected CRS without guessing',()=>{
    expect(parseSpatialInput('SRID=4326; POINT(104 21)').features[0].geometry.type).toBe('Point');
    expect(()=>parseSpatialInput('SRID=32648; POINT(400000 2400000)')).toThrow();
    expect(()=>parseSpatialInput(JSON.stringify({type:'Point',coordinates:[104,21],crs:{properties:{name:'EPSG:3857'}}}))).toThrow();
  });
  it('preserves GeoJSON properties and flattens GeometryCollections',()=>{
    const result=parseSpatialInput(JSON.stringify({type:'Feature',properties:{name:'Survey',note:'<script>x</script>'},geometry:{type:'GeometryCollection',geometries:[{type:'Point',coordinates:[104,21]},rectangle(104,21,105,22)]}}));
    expect(result.features).toHaveLength(2);expect(result.features[1].properties.note).toBe('<script>x</script>');
  });
  it('round trips supported geometry and Z values through WKT',()=>{
    for (const input of ['POINT Z(104 21 120)','LINESTRING(104 21,105 22)','POLYGON((104 21,105 21,105 22,104 21))','MULTIPOLYGON(((104 21,105 21,105 22,104 21)),((106 21,107 21,107 22,106 21)))']) {
      const original=parseSpatialInput(input).features[0].geometry;
      expect(parseSpatialInput(exportGeometryWkt(original)).features[0].geometry).toEqual(original);
    }
  });
  it('rejects empty, unsupported and oversized input',()=>{
    for (const input of ['', 'POINT EMPTY', 'MULTIPOINT((104 21))', 'POINT(104 NaN)']) expect(()=>parseSpatialInput(input)).toThrow();
    expect(()=>parseSpatialInput(' '.repeat(2_000_001))).toThrow();
    expect(()=>parseSpatialInput(Array.from({length:101},()=> 'POINT(104 21)').join('\n'))).toThrow();
  });
});

describe('Topology and coordinates',()=>{
  it('rejects unclosed, self-crossing, backtracking and touching polygon boundaries',()=>{
    fails({type:'Polygon',coordinates:[[[0,0],[2,0],[2,2],[0,2]]]},'ring-open');
    fails({type:'Polygon',coordinates:[[[0,0,1],[2,0,1],[2,2,1],[0,0,2]]]},'ring-open');
    fails({type:'Polygon',coordinates:[[[0,0],[2,2],[2,0],[0,2],[0,0]]]},'self-intersection');
    fails({type:'Polygon',coordinates:[[[0,0],[2,0],[1,0],[1,2],[0,0]]]},'self-intersection');
    fails({type:'Polygon',coordinates:[[[0,0],[2,0],[2,2],[1,0],[0,2],[0,0]]]},'self-intersection');
  });
  it('accepts forward collinear vertices',()=>{
    expect(validateGeometry({type:'Polygon',coordinates:[[[0,0],[1,0],[2,0],[2,2],[0,2],[0,0]]]}).type).toBe('Polygon');
  });
  it('validates holes and subtracts their area',()=>{
    const outer=rectangle(104,21,105,22),hole=rectangle(104.2,21.2,104.8,21.8);
    const result=validateGeometry({...outer,coordinates:[outer.coordinates[0],hole.coordinates[0]]});
    expect(area(result)).toBeCloseTo(area(outer)-area(hole),2);
    fails({...outer,coordinates:[outer.coordinates[0],rectangle(105,21,106,22).coordinates[0]]},'holes');
    fails({...outer,coordinates:[outer.coordinates[0],hole.coordinates[0],rectangle(104.3,21.3,104.7,21.7).coordinates[0]]},'holes');
  });
  it('rejects overlapping MultiPolygon members',()=>{
    fails({type:'MultiPolygon',coordinates:[rectangle(104,21,105,22).coordinates,rectangle(104.5,21,105.5,22).coordinates]},'multi-overlap');
  });
  it('rejects nonfinite, mixed dimensions, malformed and projected coordinates',()=>{
    fails({type:'Point',coordinates:[500000,2300000]},'coordinate-range');
    fails({type:'Point',coordinates:[104,Infinity]},'coordinates');
    fails({type:'Polygon',coordinates:null},'coordinates');
    fails({type:'LineString',coordinates:[[104,21,0],[105,22]]},'coordinates');
    fails(rectangle(-179,21,179,22),'dateline');
    fails({type:'Point',coordinates:[104,89]},'map-range');
  });
});

describe('AOI coverage and local session',()=>{
  const aoi=record('AOI','aoi',rectangle(104,21,106,22));
  const left=record('Left','footprint',rectangle(104,21,105.5,22));
  const right=record('Right','footprint',rectangle(104.5,21,106,22));
  it('unions overlapping footprints before calculating total coverage',()=>{
    const result=polygonCoverage([aoi,left,right])!;
    result.rows.forEach(row=>expect(row.fraction).toBeCloseTo(0.75,10));
    expect(result.fraction).toBeCloseTo(1,10);expect(result.coveredArea).toBeCloseTo(result.aoiArea,2);
  });
  it('hiding a footprint does not remove it from analysis',()=>{
    expect(polygonCoverage([aoi,{...left,visible:false},right])!.fraction).toBeCloseTo(1,10);
  });
  it('handles disjoint footprints and AOI holes',()=>{
    expect(polygonCoverage([aoi,record('Outside','footprint',rectangle(107,21,108,22))])!.fraction).toBe(0);
    const hole=rectangle(104.2,21.2,104.8,21.8);
    const holed={...aoi,feature:{...aoi.feature,geometry:{...rectangle(104,21,105,22),coordinates:[rectangle(104,21,105,22).coordinates[0],hole.coordinates[0]]}}};
    expect(polygonCoverage([holed,record('In hole','footprint',hole)])!.fraction).toBe(0);
    expect(polygonCoverage([left])).toBeNull();
    expect(polygonCoverage([aoi])!.fraction).toBeNull();
  });
  it('assigns AOI to the first polygon after a point and replaces previous AOI explicitly',()=>{
    const added=createGeometryRecords(parseSpatialInput('POINT(104 21)\nPOLYGON((104 21,105 21,105 22,104 21))'),'data.wkt','aoi');
    expect(added.map(record=>record.role)).toEqual(['reference','aoi']);
    expect(addGeometryRecords([aoi],added).filter(record=>record.role === 'aoi')).toHaveLength(1);
    expect(addGeometryRecords([aoi],added)[0].role).toBe('reference');
  });
  it('validates restored data and rejects duplicate IDs or multiple AOIs',()=>{
    expect(restoreGeometryRecords([aoi,left])).toEqual([aoi,left]);
    expect(()=>restoreGeometryRecords([aoi,aoi])).toThrow();
    expect(()=>restoreGeometryRecords([aoi,{...right,role:'aoi'}])).toThrow();
  });
  it('exports semantic roles and input provenance, with clockwise input normalized',()=>{
    const exported=JSON.parse(exportGeometryGeoJSON([{...left,name:'Strip <A>',feature:{...left.feature,geometry:{...left.feature.geometry as Polygon,coordinates:[[...rectangle(104,21,105.5,22).coordinates[0]].reverse()]}}}]));
    expect(exported.features[0].properties.geometryRole).toBe('footprint');
    expect(exported.metadata.method.crs).toBe('OGC:CRS84');
    expect(parseSpatialInput(JSON.stringify(exported)).features[0].geometry).toEqual(left.feature.geometry);
    expect(exportGeometryKml([{...left,name:'Strip <A> & B'}])).toContain('Strip &lt;A&gt; &amp; B');
  });
});
