import pointOnFeature from '@turf/point-on-feature';
import { useEffect, useMemo, useState } from 'react';
import type { MapContextGeometry } from '../map/contextGeometry';
import { roadProjected } from '../routes/selectedRoadJourney';
import { loadLocalNetwork, type LocalNetwork } from './localNetwork';
import { withLocalRoadConditions } from './localRoadConditions';
import type { GeometryRecord } from '../../geo/vector/types';

export function networkContext(network:LocalNetwork):MapContextGeometry {
  return {
    areas:network.areas.map((area,index)=>{
      const points=area.coordinates.map(([lon,lat])=>roadProjected(lat,lon));
      const [longitude,latitude]=pointOnFeature({type:'Feature',geometry:{type:'Polygon',coordinates:[area.coordinates]},properties:{}}).geometry.coordinates;
      const center=roadProjected(latitude,longitude);
      const number=String(network.areas.slice(0,index+1).filter(a=>a.kind===area.kind).length).padStart(2,'0');
      return {id:area.id,name:area.kind==='water' ? ['Vùng nước','Water extent'] as [string,string] : [`Vùng sạt ${number}`,`Landslide area ${number}`] as [string,string],
        kind:area.kind,coordinates:area.coordinates,center,radius:Math.max(...points.map(p=>Math.hypot(p.x-center.x,p.y-center.y))),source:'demo'};
    }),
    closures:network.sourceRoads.filter(road=>road.color==='ff0000ff').map(road=>{
      const [lon,lat]=road.coordinates[Math.floor(road.coordinates.length/2)];
      return {id:`closure-${road.placemarkIndex}`,point:roadProjected(lat,lon)};
    })
  };
}

/** Optional read-only context cannot make the incident dataset fail to open. */
export function useLocalNetwork(enabled=true, mappedRecords?: GeometryRecord[]) {
  const [sourceNetwork,setNetwork]=useState<LocalNetwork|null>(null);
  const [error,setError]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!enabled){setNetwork(null);return;}
    const controller=new AbortController();setError(false);
    void loadLocalNetwork(controller.signal).then(setNetwork).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return()=>controller.abort();
  },[enabled,attempt]);
  const network=useMemo(()=>sourceNetwork?withLocalRoadConditions(sourceNetwork,mappedRecords):null,[sourceNetwork,mappedRecords]);
  const context=useMemo(()=>network?networkContext(network):undefined,[network]);
  return {network,context,error,retry:()=>setAttempt(value=>value+1)};
}
