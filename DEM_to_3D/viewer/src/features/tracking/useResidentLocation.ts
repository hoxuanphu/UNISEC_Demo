import {useEffect,useMemo,useState} from 'react';
import type {LocalNetwork} from '../route-film/localNetwork';
import {createResidentLocation} from './residentLocation';
import {sharedScenarioEpoch} from './scenarioClock';
/** A shared scenario clock survives role changes/reloads and is identical in same-origin windows. */
export function useResidentLocation(network:LocalNetwork|null) {
  const key=network?'dear.resident-location.v1:'+network.source.sha256:null;
  const [revision,setRevision]=useState(0);
  const feed=useMemo(()=>network&&key?createResidentLocation(network.roads,network.conditions?.areaLinks??[],sharedScenarioEpoch(key)):null,[network,key,revision]);
  useEffect(()=>{
    if(!feed||!key)return;
    const timer=window.setInterval(()=>feed.update(Date.now()),250);
    const sync=(event:StorageEvent)=>{if(event.key===key)setRevision(value=>value+1);};
    window.addEventListener('storage',sync);
    return()=>{clearInterval(timer);window.removeEventListener('storage',sync);};
  },[feed,key]);
  return feed;
}
