import { useEffect, useMemo } from 'react';
import type { ScenarioRoute } from '../../types/dear';
import { createRouteSimulation } from './routeSimulation';
/** Pause on hidden tabs, changed routes, point picking or closed tools. No automatic playback. */
export function useRouteSimulation(route:ScenarioRoute|null,enabled:boolean,name='A Phủ') {
  const simulation=useMemo(()=>createRouteSimulation(route,name),[route,name]);
  useEffect(()=>{
    if(!simulation)return;
    if(!enabled){simulation.pause();return;}
    let frame=0,last:number|null=null,advancing=false;
    const draw=(time:number)=>{
      frame=0;
      if(document.hidden){simulation.pause();return;}
      advancing=true;
      if(last!==null)simulation.advance((time-last)/1000);
      advancing=false;last=time;
      if(simulation.getSnapshot().status==='playing')frame=requestAnimationFrame(draw);
    };
    const schedule=()=>{
      if(advancing)return;
      if(simulation.getSnapshot().status==='playing'&&!frame&&!document.hidden){last=null;frame=requestAnimationFrame(draw);}
      else if(simulation.getSnapshot().status!=='playing'){cancelAnimationFrame(frame);frame=0;last=null;}
    };
    const unsubscribe=simulation.subscribe(schedule);
    const visibility=()=>{if(document.hidden)simulation.pause();};
    document.addEventListener('visibilitychange',visibility);schedule();
    return()=>{unsubscribe();cancelAnimationFrame(frame);simulation.pause();document.removeEventListener('visibilitychange',visibility);};
  },[simulation,enabled]);
  return enabled?simulation:null;
}
