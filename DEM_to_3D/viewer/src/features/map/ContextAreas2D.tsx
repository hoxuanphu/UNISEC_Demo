import { useEffect } from 'react';
import * as L from 'leaflet';
import type { MapContextGeometry } from './contextGeometry';
import { landslideAreaStyle } from '../landslides/landslideAreas';
import { mapPane } from './mapLayerOrder';
import './context-areas.css';

/** Shared reference polygons. No centroid icons or invented hazard observations. */
export function ContextAreas2D({map,geometry,selectedId,onSelect,interactive}:{map:L.Map|null;geometry:MapContextGeometry|undefined;selectedId?:string|null;onSelect?:(id:string)=>void;interactive:boolean}) {
  useEffect(()=>{
    if(!map||!geometry)return;
    const group=L.layerGroup().addTo(map);
    for(const area of geometry.areas){
      const water=area.kind==='water',selected=area.id===selectedId;
      const style=landslideAreaStyle({state:'occurred',review:'unreviewed'},selected);
      const polygon=L.polygon(area.coordinates.map(([lon,lat])=>L.latLng(lat,lon)),{
        pane:mapPane('boundary'),color:water?'#6497a2':style.color,weight:water?0:style.weight,
        fillOpacity:water?.2:style.fillOpacity,interactive:interactive&&!water,
        className:water?'map-context-water':'map-context-landslide'
      }).addTo(group);
      polygon.getElement()?.setAttribute('data-context-area',area.id);
      if(!water&&interactive)polygon.on('click',event=>{L.DomEvent.stopPropagation(event.originalEvent);onSelect?.(area.id);});
    }
    return()=>{group.remove();};
  },[map,geometry,selectedId,onSelect,interactive]);
  return null;
}
