import L from 'leaflet';
import { placeMapLabel } from '../../terrain/markerLayout';
import { areaLabelObstacles, areaLabelObstacleSelector } from './areaLabelLayout';
import { mapLayoutMutation } from '../map/mapLayoutMutation';

/** A tooltip offset moves only its label; polygon coordinates and hit targets stay intact. */
export function avoidAreaLabelCollisions(map: L.Map): () => void {
  let frame=0;
  const host=map.getContainer();
  const update=()=>{
    frame=0;
    const obstacles=areaLabelObstacles(host);
    map.eachLayer(layer=>{
      if(!(layer instanceof L.Tooltip)) return;
      const element=layer.getElement();
      if(!element?.querySelector('.landslide-map-label')) return;
      element.style.visibility='';
      const location=layer.getLatLng();
      if(!location)return;
      const anchor=map.latLngToContainerPoint(location);
      const position=placeMapLabel(anchor,{width:element.offsetWidth,height:element.offsetHeight},{width:host.clientWidth,height:host.clientHeight},obstacles);
      if(!position){element.style.visibility='hidden';return;}
      layer.options.direction='center';
      layer.options.offset=L.point(position.x+position.width/2-anchor.x,position.y+position.height/2-anchor.y);
      layer.update();
      obstacles.push(position);
    });
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  map.on('tooltipopen move zoom resize',schedule);
  host.addEventListener('pointerover',schedule);
  host.addEventListener('pointerout',schedule);
  const observer=new MutationObserver(changes=>{
    if(changes.some(change=>change.target instanceof Element && !change.target.closest('.leaflet-tooltip') &&
      mapLayoutMutation(change,host,areaLabelObstacleSelector)))schedule();
  });
  observer.observe(host.closest('.workspace')??host,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','style','class']});
  schedule();
  return ()=>{cancelAnimationFrame(frame);observer.disconnect();map.off('tooltipopen move zoom resize',schedule);host.removeEventListener('pointerover',schedule);host.removeEventListener('pointerout',schedule);};
}
