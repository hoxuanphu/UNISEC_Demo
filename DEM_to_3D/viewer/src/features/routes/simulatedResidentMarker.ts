import type { Locale } from '../../types/dear';
import type { RouteSimulation } from './routeSimulation';
/** Constant screen-size halo identifies a demo person; it is not an accuracy radius. */
export function simulatedResidentMarker(simulation:RouteSimulation,locale:Locale) {
  const node=document.createElement('div');node.className='simulated-resident';
  node.tabIndex=0;node.setAttribute('role','img');node.setAttribute('aria-label',`${simulation.name}, ${locale==='vi'?'vị trí trên tuyến':'position on route'}`);
  const body=document.createElement('span');body.className='simulated-resident-body location-signal-dot';
  const name=document.createElement('span');name.className='simulated-resident-name';name.textContent=simulation.name;
  node.append(body,name);
  return {node,name};
}

/** Labels may move around the person; the person's geographic point never moves. */
export function positionResidentLabel(node:HTMLElement,name:HTMLElement,host:HTMLElement) {
  name.hidden=false;
  const map=host.getBoundingClientRect(),anchor=node.getBoundingClientRect();
  const width=name.offsetWidth,height=name.offsetHeight;
  const obstacles=Array.from(host.closest('.map-area')?.querySelectorAll<HTMLElement>(
    '.map-pin:not([hidden]):not(.is-label-hidden) .map-pin-label,.resident-stop-name:not([hidden]),.road-journey-panel,.local-area-card,.citizen-map-summary,.citizen-map-context,.citizen-movement-control,.map-reference,.map-attribution,.profile-panel'
  )??[]).filter(item=>item.getClientRects().length>0).map(item=>item.getBoundingClientRect());
  const candidates=[{left:39,top:5},{left:-width-9,top:5},{left:15-width/2,top:-height-9},{left:15-width/2,top:39}];
  const chosen=candidates.find(p=>{
    const box={left:anchor.left+p.left,top:anchor.top+p.top,right:anchor.left+p.left+width,bottom:anchor.top+p.top+height};
    return box.left>=map.left+6&&box.right<=map.right-6&&box.top>=map.top+6&&box.bottom<=map.bottom-6&&
      !obstacles.some(item=>box.left<item.right+4&&box.right>item.left-4&&box.top<item.bottom+4&&box.bottom>item.top-4);
  });
  name.hidden=!chosen;
  if(chosen){name.style.left=`${chosen.left}px`;name.style.top=`${chosen.top}px`;name.style.right='auto';}
}
