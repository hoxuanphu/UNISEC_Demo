import { GeometryError, geometryPositions, isPolygon, type GeometryRecord, type GeometryRole } from '../../geo/vector/types';
import { validateGeometry } from '../../geo/vector/validateGeometry';
import type { parseSpatialInput } from './parseSpatialInput';

export function createGeometryRecords(parsed: ReturnType<typeof parseSpatialInput>, sourceName: string, role: GeometryRole): GeometryRecord[] {
  const importedAt=new Date().toISOString();
  const firstPolygon=parsed.features.findIndex(feature=>isPolygon(feature.geometry));
  return parsed.features.map((feature,index)=>({
    id:crypto.randomUUID(), name:String(feature.properties.name || `${sourceName} ${index+1}`).slice(0,160), feature,
    role:role === 'aoi' && index !== firstPolygon || !isPolygon(feature.geometry) ? 'reference' : role,
    visible:true,source:{name:sourceName,format:parsed.format,importedAt}
  }));
}

export function addGeometryRecords(previous: GeometryRecord[], additions: GeometryRecord[]): GeometryRecord[] {
  if (previous.length+additions.length > 100) throw new GeometryError('feature-limit');
  if ([...previous,...additions].reduce((sum,record)=>sum+geometryPositions(record.feature.geometry).length,0) > 15000) throw new GeometryError('vertex-limit');
  const replacesAoi=additions.some(record=>record.role === 'aoi');
  let aoiFound=false;
  return [...previous.map(record=>replacesAoi && record.role === 'aoi' ? {...record,role:'reference' as const} : record),...additions].map(record=>{
    if (record.role !== 'aoi') return record;
    if (aoiFound) return {...record,role:'reference' as const};
    aoiFound=true; return record;
  });
}

export function restoreGeometryRecords(raw: unknown): GeometryRecord[] {
  if (!Array.isArray(raw) || raw.length > 100) throw new GeometryError('storage');
  const ids=new Set<string>(); let aois=0;
  const records=raw.map(record=>{
    if (!record || typeof record.id !== 'string' || ids.has(record.id) || typeof record.name !== 'string' ||
      !['aoi','reference','footprint'].includes(record.role) || typeof record.visible !== 'boolean' ||
      typeof record.source?.name !== 'string' || !['KML','WKT','GeoJSON','coordinate','drawing'].includes(record.source?.format) ||
      typeof record.source?.importedAt !== 'string' || !Number.isFinite(Date.parse(record.source.importedAt))) throw new GeometryError('storage');
    ids.add(record.id);
    const geometry=validateGeometry(record.feature?.geometry);
    if (record.role !== 'reference' && !isPolygon(geometry)) throw new GeometryError('storage');
    if (record.role === 'aoi' && ++aois > 1) throw new GeometryError('storage');
    const properties=record.feature?.properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) throw new GeometryError('storage');
    return {...record,feature:{type:'Feature' as const,geometry,properties}};
  });
  if (records.reduce((sum,record)=>sum+geometryPositions(record.feature.geometry).length,0) > 15000) throw new GeometryError('storage');
  return records;
}
