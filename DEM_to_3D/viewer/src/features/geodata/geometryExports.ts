import type { Position } from 'geojson';
import { isPolygon, type GeometryRecord, type VectorGeometry } from '../../geo/vector/types';
import { coverageMethod, polygonCoverage } from '../../geo/vector/polygonCoverage';

const escape = (value: string) => value.replace(/[<>&"']/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]!)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
function orientRing(ring: Position[], outer: boolean): Position[] {
  const signed=ring.slice(0,-1).reduce((sum,p,i)=>sum+p[0]*ring[i+1][1]-ring[i+1][0]*p[1],0);
  return (signed > 0) === outer ? ring : [...ring].reverse();
}
function oriented(geometry: VectorGeometry): VectorGeometry {
  if (geometry.type === 'Polygon') return {...geometry,coordinates:geometry.coordinates.map((ring,i)=>orientRing(ring,i === 0))};
  if (geometry.type === 'MultiPolygon') return {...geometry,coordinates:geometry.coordinates.map(p=>p.map((ring,i)=>orientRing(ring,i === 0)))};
  return geometry;
}

export function exportGeometryGeoJSON(records: GeometryRecord[]): string {
  return JSON.stringify({type:'FeatureCollection',features:records.map(record=>({...record.feature,id:record.id,
    geometry:oriented(record.feature.geometry),properties:{...record.feature.properties,name:record.name,
      geometryRole:record.role,source:record.source.name,inputFormat:record.source.format,importedAt:record.source.importedAt}})),
    metadata:{coordinateOrder:'longitude,latitude',method:coverageMethod,
      coverage:polygonCoverage(records)}},null,2);
}

export function exportGeometryWkt(geometry: VectorGeometry): string {
  const point=(p:Position)=>p.join(' '), ring=(r:Position[])=>`(${r.map(point).join(', ')})`;
  const dimensions=geometry.type === 'Point' ? geometry.coordinates.length : isPolygon(geometry)
    ? (geometry.type === 'Polygon' ? geometry.coordinates[0][0] : geometry.coordinates[0][0][0]).length : geometry.coordinates[0].length;
  const z=dimensions === 3 ? ' Z' : '';
  switch (geometry.type) {
    case 'Point': return `POINT${z} (${point(geometry.coordinates)})`;
    case 'LineString': return `LINESTRING${z} ${ring(geometry.coordinates)}`;
    case 'Polygon': return `POLYGON${z} (${geometry.coordinates.map(ring).join(', ')})`;
    case 'MultiPolygon': return `MULTIPOLYGON${z} (${geometry.coordinates.map(p=>`(${p.map(ring).join(', ')})`).join(', ')})`;
  }
}

function kmlGeometry(raw: VectorGeometry): string {
  const geometry=oriented(raw), coords=(points:Position[])=>`<coordinates>${points.map(p=>p.join(',')).join(' ')}</coordinates>`;
  const polygon=(rings:Position[][])=>`<Polygon>${rings.map((ring,i)=>{
    const boundary=i === 0 ? 'outerBoundaryIs' : 'innerBoundaryIs';
    return `<${boundary}><LinearRing>${coords(ring)}</LinearRing></${boundary}>`;
  }).join('')}</Polygon>`;
  switch (geometry.type) {
    case 'Point': return `<Point>${coords([geometry.coordinates])}</Point>`;
    case 'LineString': return `<LineString>${coords(geometry.coordinates)}</LineString>`;
    case 'Polygon': return polygon(geometry.coordinates);
    case 'MultiPolygon': return `<MultiGeometry>${geometry.coordinates.map(polygon).join('')}</MultiGeometry>`;
  }
}
export function exportGeometryKml(records: GeometryRecord[]): string {
  return '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>'+
    records.map(record=>`<Placemark><name>${escape(record.name)}</name><ExtendedData><Data name="geometryRole"><value>${record.role}</value></Data><Data name="source"><value>${escape(record.source.name)}</value></Data></ExtendedData>${kmlGeometry(record.feature.geometry)}</Placemark>`).join('')+'</Document></kml>';
}
