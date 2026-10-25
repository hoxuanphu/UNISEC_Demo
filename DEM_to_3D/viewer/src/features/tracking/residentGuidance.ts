import { createResidentLocation } from './residentLocation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LocalNetwork } from '../route-film/localNetwork';
import type { RoadSegment } from '../../types/dear';
import { analyseRoadJourney } from '../routes/journeyAnalysis';
import type { RescueBase } from './rescueBase';
import type { DispatchTarget } from './dispatchOrders';
type Point={x:number;y:number};
export type ResidentGuidance={schema:1;startedAt?:number;pausedAt?:number;id:string;recipientId:string;mode:'hold'|'route';issuedAt:string;issuedBy:string;origin:Point;destination:RescueBase|null;roadIds:string[]};
export type RouteProposal={schema:1;name:[string,string];roadIds:string[];end:Point};
export function routeProposalOf(value:unknown):RouteProposal|null{
 const p=value as RouteProposal;
 return p?.schema===1&&Array.isArray(p.name)&&p.name.length===2&&p.name.every(s=>typeof s==='string'&&s.length<=200)&&Array.isArray(p.roadIds)&&p.roadIds.length>0&&p.roadIds.length<3000&&p.roadIds.every(id=>typeof id==='string'&&id.length<200)&&Number.isFinite(p.end?.x)&&Number.isFinite(p.end?.y)?p:null;
}
const eventName='dear:guidance-changed';
export function guidanceRoute(network:LocalNetwork,entry:ResidentGuidance){
  if(entry.mode!=='route'||!entry.destination)return null;
  const roads=network.roads.filter(road=>entry.roadIds.includes(road.id));
  return analyseRoadJourney(roads,{origin:entry.origin,source:'guidance:origin'},{origin:entry.destination.projected,source:entry.destination.id},true,30,'conditions').route;
}
export function plannedGuidance(roads:RoadSegment[],target:DispatchTarget,destination:RescueBase|null,issuedBy:string):ResidentGuidance|null {
  const route=destination?analyseRoadJourney(roads,{origin:target.point,source:target.id},{origin:destination.projected,source:destination.id},true,30,'conditions').route:null;
  if(destination&&!route)return null;
  const ids=route?.segs.map(seg=>roads.find(road=>road.id===seg.id)?.id??[...roads].sort((a,b)=>b.id.length-a.id.length).find(road=>seg.id.startsWith(road.id+':part:'))?.id??seg.id)??[];
  return {schema:1,id:crypto.randomUUID(),recipientId:target.id,mode:destination?'route':'hold',issuedAt:new Date().toISOString(),issuedBy:issuedBy.trim().slice(0,100),origin:target.point,destination,roadIds:[...new Set(ids)]};
}
export function validGuidance(value:unknown):value is ResidentGuidance{
  const e=value as ResidentGuidance,p=(at:Point)=>Number.isFinite(at?.x)&&Number.isFinite(at?.y);
  return !!e&&e.schema===1&&typeof e.id==='string'&&typeof e.recipientId==='string'&&e.recipientId.length<=100&&['hold','route'].includes(e.mode)&&
    (e.startedAt===undefined||Number.isFinite(e.startedAt)&&e.startedAt>0)&&(e.pausedAt===undefined||Number.isFinite(e.pausedAt)&&!!e.startedAt&&e.pausedAt>=e.startedAt)&&Number.isFinite(Date.parse(e.issuedAt))&&typeof e.issuedBy==='string'&&e.issuedBy.length<=100&&p(e.origin)&&Array.isArray(e.roadIds)&&e.roadIds.length<3000&&e.roadIds.every(id=>typeof id==='string'&&id.length<200)&&
    (e.mode==='hold'&&e.destination===null||e.mode==='route'&&!!e.destination&&typeof e.destination.id==='string'&&p(e.destination.projected)&&Array.isArray(e.destination.name)&&e.destination.name.length===2&&e.destination.name.every(s=>typeof s==='string'&&s.length<=200));
}
export function initialGuidance(network:LocalNetwork,recipientId:string,bases:readonly RescueBase[]):ResidentGuidance|null {
  const position=createResidentLocation(network.roads,network.conditions?.areaLinks??[],0,0,bases)?.getSnapshot()[0];
  if(!position)return null;
  const target={id:recipientId,name:position.name,point:position.point};
  return bases.flatMap(base=>{const entry=plannedGuidance(network.roads,target,base,'Coordination');const route=entry&&guidanceRoute(network,entry);return entry&&route?[{entry,length:route.lengthKm}]:[];})
    .filter(item=>item.length>.05).sort((a,b)=>a.length-b.length)[0]?.entry??null;
}
const emptyBases:readonly RescueBase[]=[];
export function useResidentGuidance(network:LocalNetwork|null,recipientId:string|null,bases:readonly RescueBase[]=emptyBases,options:{restartOnOpen?:boolean}={}){
  const key=network?'dear.resident-guidance.v1:'+network.source.sha256:'', [revision,setRevision]=useState(0);
  const entries=useMemo(()=>{try{const raw=key?localStorage.getItem(key):null;if(!raw||raw.length>1_000_000)return[];const data:unknown=JSON.parse(raw);return Array.isArray(data)?data.filter(validGuidance).slice(-100):[];}catch{return[];}},[key,revision]);
  useEffect(()=>{const sync=(event:Event)=>{if(!(event instanceof StorageEvent)||event.key===key)setRevision(n=>n+1);};window.addEventListener('storage',sync);window.addEventListener(eventName,sync);return()=>{window.removeEventListener('storage',sync);window.removeEventListener(eventName,sync);};},[key]);
  const seed=useMemo(()=>network&&recipientId&&bases.length?initialGuidance(network,recipientId,bases):null,[network,recipientId,bases]);
  const savedEntry=[...entries].reverse().find(item=>item.recipientId===recipientId)??null;
  const entry=savedEntry??seed;
  useEffect(()=>{
    if(!key||!seed||savedEntry)return;
    try{const raw=localStorage.getItem(key),data:unknown=raw?JSON.parse(raw):[];const current=Array.isArray(data)?data.filter(validGuidance):[];
      if(current.some(item=>item.recipientId===seed.recipientId))return;
      localStorage.setItem(key,JSON.stringify([...current,seed].slice(-100)));window.dispatchEvent(new Event(eventName));
    }catch{/* Keep the locally configured guidance available if persistence is unavailable. */}
  },[key,seed,savedEntry]);
  const route=useMemo(()=>network&&entry?guidanceRoute(network,entry):null,[network,entry]);
  const issue=(target:DispatchTarget,destination:RescueBase|null,issuedBy:string,approvedRoadIds?:readonly string[])=>{
    if(!network||!key)return false;const next=plannedGuidance(approvedRoadIds?network.roads.filter(road=>approvedRoadIds.includes(road.id)):network.roads,target,destination,issuedBy);if(!next)return false;
    try{const raw=localStorage.getItem(key),saved:unknown=raw?JSON.parse(raw):[];const current=Array.isArray(saved)?saved.filter(validGuidance):[];localStorage.setItem(key,JSON.stringify([...current.filter(item=>item.recipientId!==target.id),next].slice(-100)));window.dispatchEvent(new Event(eventName));return true;}catch{return false;}
  };
  const start=()=>{
    if(!entry||!route||!key)return false;if(entry.startedAt&&!entry.pausedAt)return true;
    try{const raw=localStorage.getItem(key),saved:unknown=raw?JSON.parse(raw):[];const all=Array.isArray(saved)?saved.filter(validGuidance):[];
      if([...all].reverse().find(item=>item.recipientId===entry.recipientId)?.id!==entry.id)return false;
      localStorage.setItem(key,JSON.stringify(all.map(item=>item.id===entry.id?{...item,startedAt:item.startedAt&&item.pausedAt?item.startedAt+Math.max(0,Date.now()-item.pausedAt):Date.now(),pausedAt:undefined}:item)));window.dispatchEvent(new Event(eventName));return true;
    }catch{return false;}
  };
  const pause=()=>{
    if(!entry?.startedAt||entry.pausedAt||!key)return;
    try{const raw=localStorage.getItem(key),saved:unknown=raw?JSON.parse(raw):[];const all=Array.isArray(saved)?saved.filter(validGuidance):[];
      if([...all].reverse().find(item=>item.recipientId===entry.recipientId)?.id!==entry.id)return;
      localStorage.setItem(key,JSON.stringify(all.map(item=>item.id===entry.id?{...item,pausedAt:Date.now()}:item)));window.dispatchEvent(new Event(eventName));
    }catch{/* The emergency report can still be submitted. */}
  };
  const restart=useCallback(()=>{
    if(!entry||entry.mode!=='route'||!key)return false;
    try{
      const raw=localStorage.getItem(key),saved:unknown=raw?JSON.parse(raw):[];
      const all=Array.isArray(saved)?saved.filter(validGuidance):[];
      const latest=[...all].reverse().find(item=>item.recipientId===entry.recipientId);
      if(!latest||latest.id!==entry.id)return false;
      if(latest.startedAt===undefined&&latest.pausedAt===undefined)return true;
      localStorage.setItem(key,JSON.stringify(all.map(item=>item.id===entry.id?{...item,startedAt:undefined,pausedAt:undefined}:item)));
      window.dispatchEvent(new Event(eventName));return true;
    }catch{return false;}
  },[key,entry?.id,entry?.recipientId,entry?.mode]);
  const opened=useRef('');
  useEffect(()=>{
    // Only the resident opening their screen restarts the assigned trip. Opening
    // another coordinator window must leave an ongoing trip untouched.
    if(options.restartOnOpen&&key&&opened.current!==key&&restart())opened.current=key;
  },[key,options.restartOnOpen,restart]);
  return {entry,route,issue,start,pause,restart};
}
