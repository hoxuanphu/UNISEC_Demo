import { useEffect } from 'react';
import * as L from 'leaflet';
import type { Locale } from '../../types/dear';
import type { RouteSimulation } from '../routes/routeSimulation';
import { positionResidentLabel, simulatedResidentMarker } from '../routes/simulatedResidentMarker';
import { roadGeographic } from '../routes/selectedRoadJourney';
import { mapPane } from './mapLayerOrder';
import '../routes/route-simulation.css';
export function RouteSimulationLayer({map,simulation,locale}:{map:L.Map|null;simulation:RouteSimulation|null;locale:Locale}) {
  useEffect(()=>{
    if(!map||!simulation)return;
    const {node,name}=simulatedResidentMarker(simulation,locale);
    const marker=L.marker([0,0],{pane:mapPane('selection'),interactive:false,keyboard:false,zIndexOffset:2000,
      icon:L.divIcon({html:node,className:'simulated-resident-anchor',iconSize:[30,30],iconAnchor:[15,15]})}).addTo(map);
    let lastLayout=0;
    const update=()=>{
      const state=simulation.getSnapshot(),position=roadGeographic(state.point);
      marker.setLatLng([position.latitude,position.longitude]);
      if(performance.now()-lastLayout>100){positionResidentLabel(node,name,map.getContainer());lastLayout=performance.now();}
      node.dataset.progress=state.progress.toFixed(5);node.dataset.distance=state.distance.toFixed(3);node.dataset.status=state.status;
    };
    const unsubscribe=simulation.subscribe(update);update();map.on('move zoom resize',update);
    return()=>{unsubscribe();map.off('move zoom resize',update);marker.remove();};
  },[map,simulation,locale]);
  return null;
}
