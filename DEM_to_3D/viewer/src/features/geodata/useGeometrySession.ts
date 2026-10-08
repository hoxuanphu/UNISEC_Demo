import { useEffect, useRef, useState } from 'react';
import { GeometryError, isPolygon, type GeometryRecord, type GeometryRole } from '../../geo/vector/types';
import { parseSpatialInput } from './parseSpatialInput';
import { addGeometryRecords, createGeometryRecords, restoreGeometryRecords } from './geometrySession';

const storageKey='dear.geodata.v1';
function read() {
  try {
    const text=localStorage.getItem(storageKey);
    if (text && text.length > 2_000_000) throw new GeometryError('storage');
    return {records:text ? restoreGeometryRecords(JSON.parse(text)) : [],error:null as unknown};
  } catch { return {records:[] as GeometryRecord[],error:new GeometryError('storage')}; }
}

export function useGeometrySession() {
  const [initial]=useState(read);
  const [records,setRecords]=useState(initial.records);
  const [error,setError]=useState<unknown>(initial.error);
  const [busy,setBusy]=useState(false);
  const [selectedId,setSelectedId]=useState<string | null>(initial.records[0]?.id ?? null);
  const [viewRequest,setViewRequest]=useState({version:initial.records.length ? 1 : 0,id:null as string | null});
  const latest=useRef(records); latest.current=records;
  const alive=useRef(true);
  useEffect(()=>{ alive.current=true; return ()=>{alive.current=false;}; },[]);
  useEffect(()=>{
    if (initial.error && records === initial.records) return;
    try {
      const value=JSON.stringify(records);
      if (value.length > 2_000_000) throw new GeometryError('storage');
      localStorage.setItem(storageKey,value);
    } catch { setError(new GeometryError('storage')); }
  },[records]);
  const fit=(id:string | null=null)=>setViewRequest(previous=>({version:previous.version+1,id}));
  const add=(additions:GeometryRecord[])=>{
    const combined=addGeometryRecords(latest.current,additions);
    latest.current=combined; setRecords(combined); setSelectedId(additions[0]?.id ?? null); setError(null); fit();
  };
  const importText=(text:string,role:GeometryRole)=>{
    try {
      const parsed = parseSpatialInput(text);
      add(createGeometryRecords(parsed, parsed.format === 'coordinate' ? 'WGS84' : parsed.format, role));
      return true;
    }
    catch (reason) { setError(reason); return false; }
  };
  const importFiles=async(files:File[],role:GeometryRole)=>{
    setBusy(true); setError(null);
    try {
      if (files.length > 10) throw new GeometryError('feature-limit');
      const additions=(await Promise.all(files.map(async file=>{
        if (file.size > 2_000_000) throw new GeometryError('file-limit');
        if (!/\.(kml|geojson|json|wkt|txt)$/i.test(file.name)) throw new GeometryError('file');
        return createGeometryRecords(parseSpatialInput(await file.text()),file.name,role);
      }))).flat();
      if (alive.current) {add(additions);return true;}
      return false;
    } catch (reason) { if (alive.current) setError(reason);return false; }
    finally { if (alive.current) setBusy(false); }
  };
  const select=(id:string)=>{
    setSelectedId(id); setRecords(previous=>previous.map(record=>record.id === id ? {...record,visible:true} : record)); fit(id);
  };
  const update=(id:string,patch:Partial<Pick<GeometryRecord,'name'|'visible'|'role'>>)=>setRecords(previous=>{
    const target=previous.find(record=>record.id === id);
    if (!target || patch.role && patch.role !== 'reference' && !isPolygon(target.feature.geometry)) return previous;
    return previous.map(record=>{
      if (record.id === id) return {...record,...patch};
      return patch.role === 'aoi' && record.role === 'aoi' ? {...record,role:'reference' as const} : record;
    });
  });
  const remove=(id:string)=>{setRecords(previous=>previous.filter(record=>record.id !== id)); if (selectedId === id) setSelectedId(null);};
  return {records,selectedId,viewRequest,error,busy,importText,importFiles,add,fit,select,update,remove,setError};
}
