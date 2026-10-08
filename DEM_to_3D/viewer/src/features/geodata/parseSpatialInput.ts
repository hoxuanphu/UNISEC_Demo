import { GeometryError, type ImportFormat, type VectorFeature } from '../../geo/vector/types';
import { validateGeometry } from '../../geo/vector/validateGeometry';
import { parseKml } from './parseKml';
import { parseWktBatch } from './parseWkt';

function jsonFeatures(value: unknown, depth=0): VectorFeature[] {
  if (depth > 8) throw new GeometryError('geometry-type');
  const raw=value as Record<string, unknown>;
  if (!raw || typeof raw !== 'object') throw new GeometryError('geojson');
  if (raw.crs) {
    const name=(raw.crs as {properties?:{name?:string}}).properties?.name;
    if (!name || !['EPSG:4326','urn:ogc:def:crs:OGC:1.3:CRS84','urn:ogc:def:crs:EPSG::4326','OGC:CRS84'].includes(name)) throw new GeometryError('crs');
  }
  if (raw.type === 'FeatureCollection') {
    if (!Array.isArray(raw.features) || raw.features.length > 100) throw new GeometryError('feature-limit');
    return raw.features.flatMap(feature=>jsonFeatures(feature,depth+1));
  }
  if (raw.type === 'Feature') {
    const features=jsonFeatures(raw.geometry,depth+1);
    const properties=raw.properties && typeof raw.properties === 'object' && !Array.isArray(raw.properties) ? raw.properties as Record<string,unknown> : {};
    return features.map(feature=>({...feature,properties}));
  }
  if (raw.type === 'GeometryCollection') {
    if (!Array.isArray(raw.geometries) || raw.geometries.length > 100) throw new GeometryError('feature-limit');
    return raw.geometries.flatMap(geometry=>jsonFeatures(geometry,depth+1));
  }
  return [{type:'Feature',geometry:validateGeometry(raw),properties:{}}];
}

export function parseSpatialInput(input: string): { format: ImportFormat; features: VectorFeature[] } {
  if (input.length > 2_000_000) throw new GeometryError('file-limit');
  const text=input.trim();
  if (!text) throw new GeometryError('empty');
  let features: VectorFeature[], format: ImportFormat;
  if (text.startsWith('<')) { features=parseKml(text); format='KML'; }
  else if (text.startsWith('{')) {
    let raw: unknown;
    try { raw=JSON.parse(text); } catch { throw new GeometryError('geojson'); }
    features=jsonFeatures(raw); format='GeoJSON';
  } else {
    const coordinate=/^([+-]?(?:\d+\.?\d*|\.\d+))\s*°?\s*([NSEW])\s*[,;]?\s+([+-]?(?:\d+\.?\d*|\.\d+))\s*°?\s*([NSEW])$/i.exec(text);
    if (coordinate) {
      const values=new Map<number|string,number>();
      for (const index of [1,3]) {
        const axis=coordinate[index+1].toUpperCase(), number=Number(coordinate[index]);
        if (number < 0) throw new GeometryError('coordinates');
        values.set(/[NS]/.test(axis) ? 'lat' : 'lon', /[SW]/.test(axis) ? -number : number);
      }
      if (!values.has('lat') || !values.has('lon')) throw new GeometryError('coordinates');
      features=[{type:'Feature',geometry:{type:'Point',coordinates:[values.get('lon')!,values.get('lat')!]},properties:{}}]; format='coordinate';
    } else {
      features=parseWktBatch(text).map(item=>({type:'Feature',geometry:item.geometry,properties:{name:item.name}})); format='WKT';
    }
  }
  if (!features.length) throw new GeometryError('empty');
  if (features.length > 100) throw new GeometryError('feature-limit');
  return {format,features:features.map(feature=>({...feature,geometry:validateGeometry(feature.geometry)}))};
}
