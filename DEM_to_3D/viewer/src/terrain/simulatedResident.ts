import * as THREE from 'three';
import type { Locale } from '../types/dear';
import type { RouteSimulation } from '../features/routes/routeSimulation';
import { positionResidentLabel, simulatedResidentMarker } from '../features/routes/simulatedResidentMarker';
/** Updates only a screen marker; route playback does not rebuild meshes or move the camera. */
export function createSimulatedResident(host:HTMLElement,simulation:RouteSimulation,locale:Locale,
  surface:(point:{x:number;y:number})=>THREE.Vector3|null,camera:THREE.Camera) {
  const layer=document.createElement('div');layer.className='terrain-simulated-resident';host.append(layer);
  const {node,name}=simulatedResidentMarker(simulation,locale);layer.append(node);
  const projected=new THREE.Vector3();
  let lastLayout=0,labelFrame=0;
  const update=()=>{
    const state=simulation.getSnapshot(),world=surface(state.point);
    if(!world){node.hidden=true;return;}
    projected.copy(world).project(camera);
    const x=(projected.x+1)*host.clientWidth/2,y=(1-projected.y)*host.clientHeight/2;
    node.hidden=projected.z< -1||projected.z>1||x<0||y<0||x>host.clientWidth||y>host.clientHeight;
    node.style.transform=`translate(${x-15}px,${y-15}px)`;
    if(!labelFrame && performance.now()-lastLayout>100)labelFrame=requestAnimationFrame(()=>{labelFrame=0;positionResidentLabel(node,name,host);lastLayout=performance.now();});
    node.dataset.progress=state.progress.toFixed(5);node.dataset.distance=state.distance.toFixed(3);node.dataset.status=state.status;
  };
  const unsubscribe=simulation.subscribe(update);update();
  return {update,dispose:()=>{unsubscribe();cancelAnimationFrame(labelFrame);layer.remove();}};
}
