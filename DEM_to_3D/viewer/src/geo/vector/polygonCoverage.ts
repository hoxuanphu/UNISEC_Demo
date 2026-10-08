import area from '@turf/area';
import intersect from '@turf/intersect';
import union from '@turf/union';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { isPolygon, type GeometryRecord } from './types';

export const coverageMethod = { id:'polygon-coverage-v1', crs:'OGC:CRS84', area:'spherical', radiusMetres:6371008.8 } as const;
type PolygonFeature = Feature<Polygon | MultiPolygon>;
const feature = (record: GeometryRecord): PolygonFeature => ({type:'Feature',geometry:record.feature.geometry as Polygon | MultiPolygon,properties:{}});
const collection = (features: PolygonFeature[]) => ({type:'FeatureCollection' as const, features});

/** Union before intersecting prevents counting overlapping footprints twice. Visibility is display-only. */
export function polygonCoverage(records: GeometryRecord[]) {
  const aoi = records.find(record=>record.role === 'aoi' && isPolygon(record.feature.geometry));
  if (!aoi) return null;
  const aoiFeature = feature(aoi), aoiArea = area(aoiFeature);
  const footprints = records.filter(record=>record.role === 'footprint' && isPolygon(record.feature.geometry));
  const rows = footprints.map(record=>{
    const intersection = intersect(collection([aoiFeature,feature(record)]));
    const coveredArea = intersection ? area(intersection) : 0;
    return { id:record.id, name:record.name, coveredArea, fraction:Math.min(1,coveredArea/aoiArea) };
  });
  const combined = footprints.length === 1 ? feature(footprints[0]) : footprints.length ? union(collection(footprints.map(feature))) : null;
  const intersection = combined ? intersect(collection([aoiFeature,combined])) : null;
  const coveredArea = intersection ? area(intersection) : 0;
  return { aoiId:aoi.id, aoiName:aoi.name, aoiArea, coveredArea:footprints.length ? coveredArea : null,
    fraction:footprints.length ? Math.min(1,coveredArea/aoiArea) : null, rows, intersection, method:coverageMethod };
}
