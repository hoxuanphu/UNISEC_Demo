import {sharedScenarioEpoch} from './scenarioClock';
import { useEffect,useMemo } from 'react';
import type { RoadSegment } from '../../types/dear';
import type { LocalRoadAreaLink } from '../route-film/localNetwork';
import { createDeviceFeed, type DevicePlan } from './deviceFeed';
import type { RescueBase } from './rescueBase';
const noLinks:readonly LocalRoadAreaLink[]=[],noMissions:readonly DevicePlan[]=[],noBases:readonly RescueBase[]=[];
export function useDeviceFeed(roads:RoadSegment[],enabled:boolean,links:readonly LocalRoadAreaLink[]=noLinks,missions:readonly DevicePlan[]=noMissions,bases:readonly RescueBase[]=noBases) {
  const epochKey=useMemo(()=>`dear.device-clock.v1:${roads.map(road=>road.id).sort().join(',')}:${missions.map(mission=>mission.id).sort().join(',')}`,[roads,missions]);
  const epoch=useMemo(()=>sharedScenarioEpoch(epochKey),[epochKey]);
  const feed=useMemo(()=>{const feed=createDeviceFeed(roads,links,epoch,missions,bases);feed.synchronise(Math.max(0,(Date.now()-epoch)/1000));return feed;},[roads,links,missions,bases,epoch]);
  useEffect(()=>{
    if(!enabled)return;
    let frame=0,last:number|null=null;
    const draw=(time:number)=>{
      frame=0;if(document.hidden)return;
      if(last===null)last=time;
      if(time-last>=32){feed.synchronise(Math.max(0,(Date.now()-epoch)/1000));last=time;}
      frame=requestAnimationFrame(draw);
    };
    const visibility=()=>{cancelAnimationFrame(frame);frame=0;last=null;if(!document.hidden){feed.synchronise(Math.max(0,(Date.now()-epoch)/1000));frame=requestAnimationFrame(draw);}};
    document.addEventListener('visibilitychange',visibility);visibility();
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);};
  },[feed,enabled,epoch]);
  return enabled?feed:null;
}
