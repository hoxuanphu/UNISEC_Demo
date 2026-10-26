import { useEffect } from 'react';
import * as L from 'leaflet';
import type { MapContextGeometry } from './contextGeometry';
import { landslideAreaStyle } from '../landslides/landslideAreas';
import { useLandslideAppearance } from '../landslides/useLandslideAppearance';
import { mapPane } from './mapLayerOrder';
import './context-areas.css';

/** Shared reference polygons. No centroid icons or invented hazard observations. */
export function ContextAreas2D({map,geometry,selectedId,onSelect,interactive,minZoom,alwaysVisibleIds,compact=false}:{map:L.Map|null;geometry:MapContextGeometry|undefined;selectedId?:string|null;onSelect?:(id:string)=>void;interactive:boolean;minZoom?:number;alwaysVisibleIds?:string[];compact?:boolean}) {
  const {fillOpacity}=useLandslideAppearance();
  useEffect(()=>{
    if(!map||!geometry)return;
    const group=L.layerGroup();
    const pinned=L.layerGroup().addTo(map);
    for(const area of geometry.areas){
      const water=area.kind==='water',selected=area.id===selectedId;
      const style=landslideAreaStyle({state:'occurred',review:'unreviewed'},selected,fillOpacity,compact);
      const polygon=L.polygon(area.coordinates.map(([lon,lat])=>L.latLng(lat,lon)),{
        pane:mapPane(water ? 'boundary' : 'landslides'),color:water?'#6497a2':style.color,weight:water ? 0 : Math.max(style.weight,area.responsePriority==='urgent'?2.6:1.9),
        fillOpacity:water ? .2 : style.fillOpacity,interactive:interactive&&!water,
        className:water?'map-context-water':'map-context-landslide priority-'+(area.responsePriority??'routine')
      }).addTo(alwaysVisibleIds?.includes(area.id)?pinned:group);
      polygon.getElement()?.setAttribute('data-context-area',area.id);
      if(!water&&interactive)polygon.on('click',event=>{L.DomEvent.stopPropagation(event.originalEvent);onSelect?.(area.id);});
    }
    // Keep areas at route overview scales; the floor only hides remote, regional specks.
    const show=()=>{if(minZoom===undefined||map.getZoom()>=minZoom)group.addTo(map);else group.remove();};
    show();map.on('zoomend',show);
    return()=>{map.off('zoomend',show);group.remove();pinned.remove();};
  },[map,geometry,selectedId,onSelect,interactive,minZoom,alwaysVisibleIds,compact,fillOpacity]);
  return null;
}
