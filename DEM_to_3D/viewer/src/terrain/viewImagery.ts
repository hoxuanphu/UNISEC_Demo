import {detailTileTemplate, parentImageryTiles, reconnectInternetDetail} from '../features/map/imageryDetail';
import {localMapSource} from '../features/map/localMapSource';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import proj4 from 'proj4';
import { loadImageryAtlas, type ImageryDetailAtlas } from './imageryAtlas';
import type { TerrainMetadata } from '../types/terrain';
import type { MapTile } from './regionalBasemap';

const faces = [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];

/** Conservative visible surface bounds, including tilted views and terrain at different heights. */
export function visibleImageryPoints(metadata: TerrainMetadata, reference: THREE.Matrix4, camera: THREE.Camera, meshes: THREE.Mesh[], detailDistance?: number): Array<{x:number;y:number}> {
  camera.updateMatrixWorld();
  const toReference = reference.clone().invert();
  let projection=camera.projectionMatrix;
  if(detailDistance && camera instanceof THREE.PerspectiveCamera) {
    const local=camera.clone();local.far=Math.min(camera.far,Math.max(camera.near+1,detailDistance));local.updateProjectionMatrix();projection=local.projectionMatrix;
  }
  const view = new THREE.Matrix4().multiplyMatrices(projection, camera.matrixWorldInverse);
  const visible = new THREE.Box3();
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (!box || box.isEmpty() || mesh.geometry.index?.count===0) continue;
    const projection = view.clone().multiply(mesh.matrixWorld);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(projection);
    if (!frustum.intersectsBox(box)) continue;
    const transform = toReference.clone().multiply(mesh.matrixWorld);
    const append=(polygon:THREE.Vector3[])=>{
      for (const plane of frustum.planes) {
        const next:THREE.Vector3[]=[];
        for(let i=0;i<polygon.length;i++){
          const a=polygon[i],b=polygon[(i+1)%polygon.length],da=plane.distanceToPoint(a),db=plane.distanceToPoint(b);
          if(da>=0)next.push(a);
          if((da>=0)!==(db>=0))next.push(a.clone().lerp(b,da/(da-db)));
        }
        polygon=next;if(!polygon.length)break;
      }
      polygon.forEach(point=>visible.expandByPoint(point.clone().applyMatrix4(transform)));
    };
    // Surface BVH leaves have tight height ranges. A model-wide box includes
    // empty air above valleys and would select a much coarser image than needed.
    const tree=mesh.geometry.boundsTree??(mesh.geometry.boundsTree=new MeshBVH(mesh.geometry));
    tree.shapecast({
      intersectsBounds:(bounds,isLeaf)=>{
        if(!frustum.intersectsBox(bounds))return false;
        const corners=[bounds.min.x,bounds.max.x].flatMap(x=>[bounds.min.y,bounds.max.y].flatMap(y=>[bounds.min.z,bounds.max.z].map(z=>new THREE.Vector3(x,y,z))));
        if(corners.every(p=>frustum.containsPoint(p))){corners.forEach(p=>visible.expandByPoint(p.applyMatrix4(transform)));return false;}
        if(isLeaf){faces.forEach(face=>append(face.map(i=>corners[i])));return false;}
        return true;
      },
      intersectsTriangle:triangle=>{append([triangle.a,triangle.b,triangle.c]);return false;}
    });
  }
  if(visible.isEmpty())return [];
  const result=[visible.min,visible.max].map(point=>({x:metadata.world_origin.x+point.x,y:metadata.world_origin.y-point.z}));
  return result;
}

/** One complete image window, with an extra tile outside the view to keep its edge off screen. */
export function viewImageryTiles(metadata: TerrainMetadata, points: Array<{x:number;y:number}>, maxZoom: number, budget=256, maxAxis=32): MapTile[] {
  const valid=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  if (!valid.length) return [];
  const convert=proj4(metadata.crs.proj4 || `${metadata.crs.authority}:${metadata.crs.code}`,'EPSG:4326');
  const corners=[Math.min(...valid.map(p=>p.x)),Math.max(...valid.map(p=>p.x))].flatMap(x=>[Math.min(...valid.map(p=>p.y)),Math.max(...valid.map(p=>p.y))].map(y=>convert.forward([x,y])));
  for (let z=Math.min(19,maxZoom);z>=0;z--) {
    const n=2**z;
    const xy=corners.map(([lon,lat])=>[(lon+180)/360*n,(1-Math.asinh(Math.tan(THREE.MathUtils.degToRad(THREE.MathUtils.clamp(lat,-85.0511,85.0511))))/Math.PI)/2*n]);
    const west=Math.max(0,Math.floor(Math.min(...xy.map(p=>p[0])))-1),east=Math.min(n-1,Math.floor(Math.max(...xy.map(p=>p[0])))+1);
    const north=Math.max(0,Math.floor(Math.min(...xy.map(p=>p[1])))-1),south=Math.min(n-1,Math.floor(Math.max(...xy.map(p=>p[1])))+1);
    if ((east-west+1)*(south-north+1)>budget || east-west+1>maxAxis || south-north+1>maxAxis) continue;
    const tiles:MapTile[]=[];
    for(let x=west;x<=east;x++)for(let y=north;y<=south;y++)tiles.push({x,y,z});
    const cx = (west + east) / 2, cy = (north + south) / 2;
    return tiles.sort((a, b) => Math.hypot(a.x-cx, a.y-cy) - Math.hypot(b.x-cx, b.y-cy));
  }
  return [];
}


/** One request/atlas shared by native DEMs and context; only completed windows are published. */
export function createViewImagery(plan: () => MapTile[], anisotropy: number, publish: (atlas: ImageryDetailAtlas | null) => void, invalidate: () => void, publishBase: (atlas:ImageryDetailAtlas|null)=>void = ()=>{}, primeDetail:(atlas:ImageryDetailAtlas|null)=>void=()=>{}) {
  const status = document.createElement('span'); status.className='terrain-detail-status';
  status.setAttribute('role','status'); status.hidden=true;
  let enabled=false, disposed=false, timer:ReturnType<typeof setTimeout>|undefined;
  let controller:AbortController|null=null, atlas:ImageryDetailAtlas|null=null, loadedKey='', loadingKey='';
  const cache=new Map<string,Blob>();
  const keyOf=(tiles:MapTile[],template=detailTileTemplate(tiles[0]?.z))=>`${template}:`+tiles.map(t=>`${t.z}/${t.x}/${t.y}`).join(',');
  let scheduledAt:number|null=null;
  let pendingRequest:Promise<void>|null=null;
  const cancel = () => {clearTimeout(timer);scheduledAt=null;controller?.abort();controller=null;loadingKey='';status.hidden=true;};
  let held=false;
  let filmController:AbortController|null=null, filmKey='';
  let pages:Array<{tiles:MapTile[];atlas:ImageryDetailAtlas}>=[];
  const clearFilm=()=>{filmController?.abort();filmController=null;publishBase(null);primeDetail(null);pages.forEach(page=>page.atlas.dispose());pages=[];filmKey='';};
  const request = async (preparedTiles?:MapTile[], localOnly=false) => {
    if (!enabled || disposed) return;
    const tiles=preparedTiles ?? plan();
    if (!tiles.length) return;
    const template=localOnly?localMapSource()?.imagery.url:detailTileTemplate(tiles[0].z);
    if(template===null)return;
    const key=keyOf(tiles,template);
    if(key===loadedKey)return;
    if(key===loadingKey)return pendingRequest;
    controller?.abort(); const run=new AbortController();controller=run;loadingKey=key;
    const timeout=setTimeout(()=>run.abort(),45000);
    status.textContent=document.documentElement.lang==='en'?'Loading imagery':'Đang tải ảnh';status.hidden=false;
    const apply=(next:ImageryDetailAtlas|null,nextKey:string)=>{
      if(!next)return;
      if(disposed || run.signal.aborted || controller!==run){next.dispose();return;}
      publish(next);atlas?.dispose();atlas=next;loadedKey=nextKey;invalidate();
    };
    const task=(async()=>{
      try {
        const local=localMapSource();
        if(local && template!==local.imagery.url && atlas?.source!=='online'){
          let zoom=Math.min(tiles[0].z,local.imagery.maxZoom);
          let fallback=parentImageryTiles(tiles,zoom);
          // The regional local tiles remain underneath. A small complete preview
          // must not delay online refinement by loading another full-size atlas.
          while(fallback.length>36 && zoom>0)fallback=parentImageryTiles(tiles,--zoom);
          const fallbackKey=keyOf(fallback,local.imagery.url);
          if(fallbackKey!==loadedKey)apply(await loadImageryAtlas(fallback,run.signal,anisotropy,cache,local.imagery.url),fallbackKey);
        }
        // A full-view intermediate image arrives first; refinement never leaves
        // a sharp island surrounded by the prepared low-resolution image.
        if(tiles.length>80 && tiles[0].z>0){
          const parents=new Map<string,MapTile>();
          tiles.forEach(t=>{const p={z:t.z-1,x:Math.floor(t.x/2),y:Math.floor(t.y/2)};parents.set(`${p.x}/${p.y}`,p);});
          const coarse=[...parents.values()],coarseKey=keyOf(coarse,template);
          if(coarseKey!==loadedKey)apply(await loadImageryAtlas(coarse,run.signal,anisotropy,cache,template ?? undefined),coarseKey);
        }
        run.signal.throwIfAborted();
        apply(await loadImageryAtlas(tiles,run.signal,anisotropy,cache,template ?? undefined),key);
      } catch {run.abort();} // Retain the last complete image while a moved view loads or fails.
      finally {clearTimeout(timeout);if(controller===run){controller=null;loadingKey='';pendingRequest=null;status.hidden=true;}}
    })();
    pendingRequest=task;return task;
  };
  const schedule=()=>{
    if(!enabled||disposed||held)return;
    const now=performance.now();scheduledAt??=now;clearTimeout(timer);
    // Debounce short gestures, but keep refining during a continuous orbit/drag.
    const delay=Math.min(250,Math.max(0,1000-(now-scheduledAt)));
    timer=setTimeout(()=>{scheduledAt=null;void request();},delay);
  };
  const online=()=>{reconnectInternetDetail();schedule();};
  if(typeof window!=='undefined'){window.addEventListener('online',online);window.addEventListener('offline',schedule);}
  return {status,schedule,
    /** Hold a completed image of the entire film corridor, not the launch view.
     * Releasing it resumes normal camera-based refinement. Failure keeps the last
     * complete image; no partially loaded atlas is ever published. */
    async prepare(tiles:MapTile[], detailWindows:MapTile[][]=[]) {
      clearFilm();held=true;clearTimeout(timer);scheduledAt=null;
      await request(tiles,!!localMapSource());
      if(!enabled||disposed||!held)return;
      publishBase(atlas);
      const run=new AbortController();filmController=run;
      const timeout=setTimeout(()=>run.abort(),25000);
      try {
        // A small native-detail page per stop, plus the two endpoints. The complete
        // corridor remains underneath; switching pages never exposes a blank patch.
        for(const window of detailWindows) {
          run.signal.throwIfAborted();
          const next=await loadImageryAtlas(window,run.signal,anisotropy,cache,localMapSource()?.imagery.url);
          if(next) {
            if(disposed||run.signal.aborted){next.dispose();break;}
            primeDetail(next);pages.push({tiles:window,atlas:next});
          }
        }
      } catch { /* The complete corridor image remains usable. */ }
      finally {clearTimeout(timeout);}
    },
    filmAt(point:{x:number;y:number}, metadata:TerrainMetadata) {
      if(!held||!pages.length)return;
      const [lon,lat]=proj4(metadata.crs.proj4 || `${metadata.crs.authority}:${metadata.crs.code}`,'EPSG:4326',[point.x,point.y]);
      const selected=pages.find(page=>{
        const a=page.atlas,n=2**a.zoom,x=(lon+180)/360*n,y=(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n;
        return x>a.minX+.8&&x<a.maxX-.8&&y>a.minY+.8&&y<a.maxY-.8;
      });
      const key=selected?keyOf(selected.tiles):loadedKey;
      if(filmKey===key)return;
      filmKey=key;publish(selected?.atlas??atlas);invalidate();
    },
    release(){publish(atlas);clearFilm();held=false;schedule();},
    setEnabled(value:boolean){if(enabled===value)return;enabled=value;if(!enabled){cancel();publish(atlas);clearFilm();held=false;}else schedule();},
    retry:schedule,dispose(){disposed=true;if(typeof window!=='undefined'){window.removeEventListener('online',online);window.removeEventListener('offline',schedule);}cancel();publish(null);clearFilm();atlas?.dispose();cache.clear();status.remove();}};
}
