import { useEffect, useMemo, useState } from 'react';
import type { LocalNetwork } from '../route-film/localNetwork';
import type { RescueBase } from './rescueBase';
import type { DevicePosition, LocationFeed } from './deviceFeed';
import { dispatchPosition, planDispatch, restoreDispatch, type DispatchOrder, type DispatchTarget } from './dispatchOrders';
const changed='dear:dispatch-changed';

/** A local incident order shared by coordinator and resident windows of this installation. */
export function useRescueDispatch(network:LocalNetwork|null,bases:readonly RescueBase[]) {
  const key=network?'dear.rescue-order.v1:'+network.source.sha256:'';
  const [revision,setRevision]=useState(0);
  const order=useMemo(()=>{
    if(!network||!key)return null;
    try {const raw=localStorage.getItem(key);return raw&&raw.length<1_000_000?restoreDispatch(JSON.parse(raw),network.roads,bases):null;}catch{return null;}
  },[key,network,bases,revision]);
  useEffect(()=>{const sync=(event:Event)=>{if(!(event instanceof StorageEvent)||event.key===key)setRevision(value=>value+1);};
    window.addEventListener('storage',sync);window.addEventListener(changed,sync);return()=>{window.removeEventListener('storage',sync);window.removeEventListener(changed,sync);};},[key]);
  const feed=useMemo(()=>{
    if(!network||!order)return null;
    const listeners=new Set<()=>void>();let snapshot:DevicePosition[]=[];
    const update=()=>{const point=dispatchPosition(order,network.roads,Date.now());snapshot=point?[point]:[];listeners.forEach(fn=>fn());};update();
    return {getSnapshot:()=>snapshot,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},update};
  },[network,order]);
  useEffect(()=>{if(!feed)return;const timer=window.setInterval(()=>{if(!document.hidden)feed.update();},250);return()=>clearInterval(timer);},[feed]);
  const dispatch=(target:DispatchTarget):'ok'|'busy'|'no-route'|'storage-error'=>{
    if(!network||!key)return 'no-route';
    let latest=order;
    try{const raw=localStorage.getItem(key);if(raw)latest=restoreDispatch(JSON.parse(raw),network.roads,bases);}catch{return 'storage-error';}
    if(latest&&(!latest.recalledAt||dispatchPosition(latest,network.roads,Date.now())?.state!=='arrived'))return 'busy';
    const next=planDispatch(network.roads,bases,target,Date.now());if(!next)return 'no-route';
    try {localStorage.setItem(key,JSON.stringify(next));window.dispatchEvent(new Event(changed));return 'ok';}catch{return 'storage-error';}
  };
  const recall=()=>{
    if(!order||order.recalledAt||!network)return false;
    try{
      const raw=localStorage.getItem(key),latest=raw?restoreDispatch(JSON.parse(raw),network.roads,bases):null;
      if(!latest||latest.id!==order.id)return false;
      localStorage.setItem(key,JSON.stringify({...latest,recalledAt:Date.now()}));window.dispatchEvent(new Event(changed));return true;
    }catch{return false;}
  };
  return {recall,order:order as DispatchOrder|null,feed:feed as LocationFeed|null,dispatch};
}
