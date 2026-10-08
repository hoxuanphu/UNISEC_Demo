import type { VectorFeature, VectorGeometry } from '../../geo/vector/types';
import { GeometryError, geometryPositions } from '../../geo/vector/types';

const children = (element: Element, name: string) => [...element.children].filter(child=>child.localName === name);
const content = (element: Element, name: string) => children(element,name)[0]?.textContent?.trim() ?? '';
function coordinates(element: Element): number[][] {
  const value = content(element,'coordinates');
  if (!value) throw new GeometryError('coordinates');
  return value.split(/\s+/).map(tuple=>{
    const parts = tuple.split(',');
    if (parts.length === 3 && parts[2] === '') parts[2]='0';
    if (parts.some(part=>!(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/).test(part))) throw new GeometryError('coordinates');
    return parts.map(part=>Number(part));
  });
}
function geometry(element: Element, depth=0): VectorGeometry[] {
  if (depth > 8 || element.children.length > 100) throw new GeometryError('feature-limit');
  if (element.localName === 'Point') {
    const points=coordinates(element);
    if (points.length !== 1) throw new GeometryError('coordinates');
    return [{type:'Point',coordinates:points[0]}];
  }
  if (element.localName === 'LineString' || element.localName === 'LinearRing') return [{type:'LineString',coordinates:coordinates(element)}];
  if (element.localName === 'Polygon') {
    const boundaries=[...children(element,'outerBoundaryIs'),...children(element,'innerBoundaryIs')];
    if (children(element,'outerBoundaryIs').length !== 1) throw new GeometryError('ring-points');
    return [{type:'Polygon',coordinates:boundaries.map(boundary=>{
      const ring=children(boundary,'LinearRing');
      if (ring.length !== 1) throw new GeometryError('ring-points');
      return coordinates(ring[0]);
    })}];
  }
  if (element.localName === 'MultiGeometry') return [...element.children].flatMap(child=>geometry(child,depth+1));
  throw new GeometryError('geometry-type', element.localName);
}

/** Native XML parser only reads local geometries. Descriptions are plain text, never HTML. */
export function parseKml(text: string): VectorFeature[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new GeometryError('kml-xml');
  const document = new DOMParser().parseFromString(text,'application/xml');
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'kml') throw new GeometryError('kml-xml');
  if (!['http://www.opengis.net/kml/2.2','http://earth.google.com/kml/2.0','http://earth.google.com/kml/2.1','http://earth.google.com/kml/2.2',null].includes(document.documentElement.namespaceURI)) throw new GeometryError('kml-xml');
  const all = (name: string) => [...document.getElementsByTagNameNS('*',name)];
  if (all('NetworkLink').length) throw new GeometryError('kml-network');
  if (all('GroundOverlay').length || all('ScreenOverlay').length) throw new GeometryError('kml-overlay');
  const placemarks=all('Placemark');
  if (placemarks.length > 100) throw new GeometryError('feature-limit');
  const features=placemarks.flatMap(placemark=>{
    const geometries=[...placemark.children].filter(child=>['Point','LineString','Polygon','MultiGeometry','Model','Track','MultiTrack','LinearRing'].includes(child.localName));
    if (!geometries.length) return [];
    const properties: Record<string, unknown> = { name:content(placemark,'name'), description:content(placemark,'description') };
    const extended=children(placemark,'ExtendedData')[0];
    if (extended) for (const item of [...extended.getElementsByTagNameNS('*','Data'),...extended.getElementsByTagNameNS('*','SimpleData')]) {
      const key=item.getAttribute('name');
      if (key && !['__proto__','prototype','constructor','name','description'].includes(key)) properties[key]=item.localName === 'Data' ? content(item,'value') : item.textContent?.trim();
    }
    const values=geometries.flatMap(element=>geometry(element));
    for (const geometry of values) {
      const positions=geometryPositions(geometry);
      if (positions.some(position=>position.length === 3)) positions.forEach(position=>{if(position.length === 2)position.push(0);});
    }
    return values.map((geometry,index):VectorFeature=>({type:'Feature',geometry,properties:{...properties,
      name:values.length > 1 ? `${properties.name || 'Placemark'} ${index+1}` : properties.name }}));
  });
  if (!features.length) throw new GeometryError('empty');
  return features;
}
