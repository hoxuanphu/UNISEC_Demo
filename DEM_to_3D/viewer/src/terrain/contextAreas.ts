import { setDrawingLayer } from '../features/map/mapLayerOrder';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { roadProjected } from '../features/routes/selectedRoadJourney';
import type { MapContextGeometry } from '../features/map/contextGeometry';
import { defaultLandslideFillOpacity } from '../features/landslides/landslideAppearance';
import { landslideBoundaryColor } from '../features/landslides/landslideAreas';
import { surfaceLineGeometry, stabiliseSurfaceLine } from './surfaceLine';
import { breathe, setBreathBase } from './breath';

type XY={x:number;y:number};
/** Geometric shoreline feather only changes display alpha, never the source polygon. */
export function shorelineWeight(point:XY,ring:XY[],featherM=24):number {
  let distance=Infinity;
  for(let i=1;i<ring.length;i++){
    const a=ring[i-1],b=ring[i],dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    const t=length?THREE.MathUtils.clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/length,0,1):0;
    distance=Math.min(distance,Math.hypot(point.x-a.x-dx*t,point.y-a.y-dy*t));
  }
  const t=THREE.MathUtils.clamp(distance/featherM,0,1);return t*t*(3-2*t);
}

export function createContextAreaOverlay(host:HTMLElement,data:MapContextGeometry,selectedId:string|null,
  surface:(p:XY)=>THREE.Vector3|null,locale:'vi'|'en',interactive:()=>boolean,
  resolution:{width:number;height:number}) {
  const group=new THREE.Group();group.name='reference-context-areas';
  const layer=document.createElement('div');layer.className='map-context-closures';host.append(layer);
  const markers:Array<{button:HTMLButtonElement;anchor:THREE.Vector3;selected:boolean}>=[];
  const lines:LineMaterial[]=[];
  const styles=new Map<string,{fill?:THREE.MeshBasicMaterial;lines?:LineMaterial[]}>();
  for(const area of data.areas){
    const ring=area.coordinates.map(([lon,lat])=>roadProjected(lat,lon));
    const selected=area.id===selectedId;
    const contour=ring.slice(0,-1);
    const triangles=THREE.ShapeUtils.triangulateShape(contour.map(p=>new THREE.Vector2(p.x,p.y)),[]);
    const positions:number[]=[],colors:number[]=[];
    const color=new THREE.Color(area.kind==='water'?'#6497a2':landslideBoundaryColor);
    const cache=new Map<string,THREE.Vector3|null>();
    const ground=(p:XY)=>{const key=`${p.x.toFixed(2)},${p.y.toFixed(2)}`;if(!cache.has(key))cache.set(key,surface(p));return cache.get(key)!;};
    const append=(a:XY,b:XY,c:XY,depth=0)=>{
      const ab=Math.hypot(a.x-b.x,a.y-b.y),bc=Math.hypot(b.x-c.x,b.y-c.y),ca=Math.hypot(c.x-a.x,c.y-a.y);
      if(Math.max(ab,bc,ca)>38 && depth<16){
        if(ab>=bc && ab>=ca){const m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};append(a,m,c,depth+1);append(m,b,c,depth+1);}
        else if(bc>=ca){const m={x:(b.x+c.x)/2,y:(b.y+c.y)/2};append(a,b,m,depth+1);append(a,m,c,depth+1);}
        else{const m={x:(c.x+a.x)/2,y:(c.y+a.y)/2};append(a,b,m,depth+1);append(m,b,c,depth+1);}
        return;
      }
      const points=[a,b,c],world=points.map(ground);if(world.some(p=>!p))return;
      points.forEach((point,i)=>{const p=world[i]!;positions.push(p.x,p.y+3,p.z);colors.push(color.r,color.g,color.b,area.kind==='water'?shorelineWeight(point,ring):1);});
    };
    triangles.forEach(t=>append(contour[t[0]],contour[t[1]],contour[t[2]]));
    if(positions.length){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
      const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,opacity:area.kind==='water'?.36:selected?.3:defaultLandslideFillOpacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
      const mesh=new THREE.Mesh(geometry,material);setDrawingLayer(mesh, area.kind==='water' ? 'boundary' : 'landslides');if(area.kind==='landslide'){breathe(material,area.responsePriority??'routine');mesh.userData.contextAreaId=area.id;styles.set(area.id,{fill:material});}group.add(mesh);
    }
    if(area.kind==='landslide'){
      let run:number[]=[];
      const outline=()=>{
        if(run.length>=6){
          const material=breathe(stabiliseSurfaceLine(new LineMaterial({color:landslideBoundaryColor,linewidth:selected?3:area.responsePriority==='urgent'?2.6:1.9,transparent:true,opacity:1,depthWrite:false})),area.responsePriority??'routine');
          material.resolution.set(resolution.width,resolution.height);lines.push(material);
          const object=new Line2(surfaceLineGeometry(run),material);object.userData.contextAreaId=area.id;setDrawingLayer(object, 'landslides', .2);group.add(object);
          styles.set(area.id,{...styles.get(area.id),lines:[...(styles.get(area.id)?.lines??[]),material]});
        }
        run=[];
      };
      for(let i=1;i<ring.length;i++){
        const a=ring[i-1],b=ring[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/20));
        for(let j=i===1?0:1;j<=steps;j++){const t=j/steps,p=ground({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});if(p)run.push(p.x,p.y+5,p.z);else outline();}
      }
      outline();

    }
  }
  for(const closure of data.closures){
    const anchor=surface(closure.point);if(!anchor)continue;anchor.y+=12;
    const button=document.createElement('button');button.type='button';button.className='map-context-closure';button.textContent='−';button.disabled=true;button.setAttribute('aria-label',locale==='vi'?'Đường bị chặn, mô phỏng':'Blocked road, demo');layer.append(button);markers.push({button,anchor,selected:false});
  }
  const projected=new THREE.Vector3();
  return {group,
    setActiveArea(id:string|null){
      for(const [areaId,style] of styles){const active=areaId===id;if(style.fill)setBreathBase(style.fill,active?.3:defaultLandslideFillOpacity);style.lines?.forEach(line=>line.linewidth=active?3:data.areas.find(area=>area.id===areaId)?.responsePriority==='urgent'?2.6:1.9);}
    },
    update(camera:THREE.Camera){
      layer.hidden=!interactive();if(layer.hidden)return;
      const occupied:Array<{x:number;y:number}>=[];
      for(const marker of [...markers].sort((a,b)=>Number(b.selected)-Number(a.selected))){
        projected.copy(marker.anchor).project(camera);const x=(projected.x+1)*host.clientWidth/2,y=(1-projected.y)*host.clientHeight/2;
        const collision=!marker.selected && occupied.some(p=>Math.hypot(p.x-x,p.y-y)<25);
        marker.button.hidden=projected.z< -1||projected.z>1||x<16||x>host.clientWidth-16||y<16||y>host.clientHeight-16||collision;
        marker.button.style.transform=`translate(${x-11}px,${y-11}px)`;
        if(!marker.button.hidden)occupied.push({x,y});
      }
    },
    resolution(width:number,height:number){lines.forEach(line=>line.resolution.set(width,height));},
    dispose(){group.removeFromParent();group.traverse(object=>{const mesh=object as THREE.Mesh;mesh.geometry?.dispose();const materials=mesh.material?(Array.isArray(mesh.material)?mesh.material:[mesh.material]):[];materials.forEach(material=>material.dispose());});layer.remove();}
  };
}
