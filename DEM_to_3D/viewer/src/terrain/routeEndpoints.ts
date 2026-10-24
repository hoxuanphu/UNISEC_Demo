import { routeStopSvg } from '../features/routes/routeStopSymbol';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { surfaceLineGeometry,stabiliseSurfaceLine } from './surfaceLine';
export type RouteEndpoint = {label:string;point:{x:number;y:number};anchor?:{x:number;y:number}};
/** Endpoint letters stay on the selected coordinates. Dashed offsets are not roads. */
export function createRouteEndpoints(host:HTMLElement,endpoints:RouteEndpoint[],surface:(p:{x:number;y:number})=>THREE.Vector3|null,resolution:{width:number;height:number}) {
  const group=new THREE.Group();group.name='journey-endpoint-offsets';
  const layer=document.createElement('div');layer.className='terrain-route-endpoints';host.append(layer);
  const markers:Array<{element:HTMLElement;point:THREE.Vector3}>=[],materials:LineMaterial[]=[];
  for(const endpoint of endpoints){
    const point=surface(endpoint.point);if(!point)continue;point.y+=5;
    const element=document.createElement('span');element.className='terrain-route-endpoint is-'+endpoint.label.toLowerCase();element.innerHTML=routeStopSvg(endpoint.label==='A');element.setAttribute('role','img');element.setAttribute('aria-label',endpoint.label);layer.append(element);markers.push({element,point});
    if(endpoint.anchor && Math.hypot(endpoint.anchor.x-endpoint.point.x,endpoint.anchor.y-endpoint.point.y)>1){
      const positions:number[]=[];let complete=true;
      for(let i=0;i<=8;i++){const t=i/8,p=surface({x:endpoint.point.x+(endpoint.anchor.x-endpoint.point.x)*t,y:endpoint.point.y+(endpoint.anchor.y-endpoint.point.y)*t});if(!p){complete=false;break;}positions.push(p.x,p.y+4,p.z);}
      if(complete){const material=stabiliseSurfaceLine(new LineMaterial({color:'#dae8ee',linewidth:1.5,transparent:true,opacity:.9,depthWrite:false,dashed:true,dashSize:8,gapSize:6}));material.resolution.set(resolution.width,resolution.height);materials.push(material);const line=new Line2(surfaceLineGeometry(positions),material);line.computeLineDistances();line.renderOrder=15;group.add(line);}
    }
  }
  const projected=new THREE.Vector3();
  return {group,update(camera:THREE.Camera){for(const marker of markers){projected.copy(marker.point).project(camera);const x=(projected.x+1)*host.clientWidth/2,y=(1-projected.y)*host.clientHeight/2;marker.element.hidden=projected.z< -1||projected.z>1;marker.element.style.transform=`translate(${x-12}px,${y-12}px)`;}},resolution(width:number,height:number){materials.forEach(material=>material.resolution.set(width,height));},dispose(){group.removeFromParent();group.traverse(object=>{const mesh=object as THREE.Mesh;mesh.geometry?.dispose();(mesh.material as THREE.Material)?.dispose();});layer.remove();}};
}
