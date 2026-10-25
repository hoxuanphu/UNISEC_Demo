import {useLayoutEffect,useRef,useState,type RefObject} from 'react';
import {placeSecondarySurface,type SurfaceRect} from './secondarySurfacePlacement';
const blockers='.household-card,.local-road-card,.local-area-card,.point-group-card,.response-detail-dock,.road-journey-panel,.layers-panel,.map-location-panel,.map-advanced-tools,.map-measure-panel,.draw-panel,.map-search-results,.map-context-menu,.context-menu,.notification-popover,.map-attribution';
const rectOf=(node:Element):SurfaceRect=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};};
/** Measures dragged panels too; opening a new case must never cover the secondary map. */
export function useMapSurfaceClearance(root:RefObject<HTMLElement>,enabled:boolean,expanded:boolean,large:boolean,ready:boolean,respectLegend=true){
 const [compact,setCompact]=useState(false),compactRef=useRef(false),sizes=useRef(new Map<boolean,{width:number;height:number}>());
 // Folding changes size only; the saved position and dock corner stay fixed.
 const pill=useRef({width:136,height:38});
 useLayoutEffect(()=>{
  const node=root.current,area=node?.closest('.map-area'),workspace=node?.closest('.workspace');if(!node||!area||!enabled)return;
  node.style.removeProperty('translate');
  let frame=0,disposed=false;
  const observed=new Set<HTMLElement>();
  const resize=new ResizeObserver(()=>schedule());
  const visible=(element:HTMLElement)=>!element.hidden&&element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden'&&getComputedStyle(element).display!=='none';
  const update=()=>{
   frame=0;if(disposed||!node.getClientRects().length||getComputedStyle(node).display==='none')return;
   if(node.dataset.dragging==='true')return;
   const actual=rectOf(node),a=rectOf(area),toolbar=area.querySelector<HTMLElement>('.map-tools');
   const top=toolbar&&visible(toolbar)?Math.max(a.top+48,toolbar.getBoundingClientRect().bottom+8):a.top+64;
   const bounds={left:a.left+12,top,width:Math.max(0,a.width-24),height:Math.max(0,a.top+a.height-top-12)};
   if(!compactRef.current&&expanded)sizes.current.set(large,{width:actual.width,height:actual.height});
   if(!expanded||compactRef.current)pill.current={width:actual.width,height:actual.height};
   const saved=sizes.current.get(large),style=getComputedStyle(node);
   const size=expanded?{width:Math.min(saved?.width??(large?600:248),bounds.width,parseFloat(style.maxWidth)||bounds.width),
    height:Math.min(saved?.height??(large?500:330),bounds.height,parseFloat(style.maxHeight)||bounds.height)}:{width:actual.width,height:actual.height};
   const floatingTop=actual.top;
   // Docked, the panel hangs from the bottom-right corner: a wider open size grows to the left.
   const docked=node.dataset.floating!=='true';
   const rightAnchored=!node.classList.contains('map-bottom-bar');
   const requested={left:docked&&rightAnchored?actual.left+actual.width-size.width:actual.left,top:docked?actual.top+actual.height-size.height:floatingTop,...size};
   const elements=[...(workspace??area).querySelectorAll<HTMLElement>(blockers),...(respectLegend?area.querySelectorAll<HTMLElement>('.map-bottom-bar'):[])].filter(element=>element!==node&&visible(element));
   for(const element of observed)if(!elements.includes(element)){resize.unobserve(element);observed.delete(element);}
   for(const element of elements)if(!observed.has(element)){resize.observe(element);observed.add(element);}
   const result=placeSecondarySurface(requested,bounds,elements.map(rectOf),pill.current.width,pill.current.height,docked?(rightAnchored?'bottom-right':'bottom-left'):'top-left');
   compactRef.current=result.compact;setCompact(value=>value===result.compact?value:result.compact);
   if(node.dataset.autoCompact!==String(result.compact))node.dataset.autoCompact=String(result.compact);
   if(node.dataset.occluded!==String(!result.rect))node.dataset.occluded=String(!result.rect);
  };
  function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(update);}
  const mutation=new MutationObserver(records=>{
   if(records.some(record=>{const target=record.target as Element;return target.matches?.(blockers)||respectLegend&&target.matches?.('.map-bottom-bar')||record.type==='childList'&&[...record.addedNodes,...record.removedNodes].some(n=>n instanceof Element&&(n.matches(blockers)||n.querySelector(blockers)));}))schedule();
  });
  mutation.observe(workspace??area,{childList:true,subtree:true,attributes:true,attributeFilter:['style','hidden','class','data-floating','data-dragging']});
  resize.observe(area);resize.observe(node);area.addEventListener('dear:map-layout',schedule);schedule();
  return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();area.removeEventListener('dear:map-layout',schedule);};
 },[root,enabled,expanded,large,ready,respectLegend]);
 return compact;
}
