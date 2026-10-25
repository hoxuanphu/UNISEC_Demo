import type { RescueBase } from './rescueBase';
import {useEffect,useMemo,useState} from 'react';
import type {LocalNetwork} from '../route-film/localNetwork';
import {createResidentLocation,type GuidedLocation} from './residentLocation';
import {sharedScenarioEpoch} from './scenarioClock';
const noBases:readonly RescueBase[]=[];
/** A shared scenario clock survives role changes/reloads and is identical in same-origin windows. */
export function useResidentLocation(network:LocalNetwork|null,bases:readonly RescueBase[]=noBases,guidance?:GuidedLocation) {
  const key=network?'dear.resident-location.v1:'+network.source.sha256:null;
  const [revision,setRevision]=useState(0);
  const feed=useMemo(()=>network&&key?createResidentLocation(network.roads,network.conditions?.areaLinks??[],sharedScenarioEpoch(key),Date.now(),bases,guidance,key?key+':progress':''):null,[network,key,revision,bases,guidance?.entry,guidance?.route]);
  useEffect(()=>{
    if(!feed||!key)return;
    const timer=window.setInterval(()=>feed.update(Date.now()),33);
    const sync=(event:StorageEvent)=>{if(event.key===key)setRevision(value=>value+1);};
    window.addEventListener('storage',sync);
    return()=>{clearInterval(timer);window.removeEventListener('storage',sync);};
  },[feed,key]);
  return feed;
}
