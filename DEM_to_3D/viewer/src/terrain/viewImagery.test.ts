import {expect,it,vi} from 'vitest';
import {setLocalMapSource, type LocalMapSource} from '../features/map/localMapSource';
import {reconnectInternetDetail} from '../features/map/imageryDetail';
import * as loader from './imageryAtlas';
import proj4 from 'proj4';
import * as THREE from 'three';
import {createViewImagery,viewImageryTiles,visibleImageryPoints} from './viewImagery';
import {basemapFrame} from './basemapFrame';
import {pixelToProjected} from './coordinate';
import {tileLonLat} from './regionalBasemap';
import {validateMetadata} from './validation';
import first from '../../public/terrain/che_tao_v2_tex.terrain.json';
import second from '../../public/terrain/lao_chai_v2_tex.terrain.json';
const metadata=validateMetadata(first),other=validateMetadata(second);
it('covers the full visible window with bounded requests and a tile buffer',()=>{
 const point=pixelToProjected(metadata,100,100),points=[point,{x:point.x+3500,y:point.y+2000}];
 const tiles=viewImageryTiles(metadata,points,19);
 const xs=tiles.map(t=>t.x),ys=tiles.map(t=>t.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
 const distances=tiles.map(t=>Math.hypot(t.x-cx,t.y-cy));
 expect(distances).toEqual([...distances].sort((a,b)=>a-b));
 expect(tiles.length).toBeGreaterThan(0);expect(tiles.length).toBeLessThanOrEqual(256);
 for(const p of points){
  const [lon,lat]=proj4(metadata.crs.proj4!,'EPSG:4326',[p.x,p.y]);
  expect(tiles.some(t=>{const a=tileLonLat(t.x,t.y,t.z),b=tileLonLat(t.x+1,t.y+1,t.z);return lon>=a[0]&&lon<=b[0]&&lat<=a[1]&&lat>=b[1];})).toBe(true);
 }
 expect(viewImageryTiles(metadata,[{x:NaN,y:0}],19)).toEqual([]);
 expect(viewImageryTiles(metadata,points,19,64).length).toBeLessThanOrEqual(64);
});
it('clips the terrain to the camera rather than downloading the entire DEM at close range',()=>{
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(40000,40000));mesh.rotation.x=-Math.PI/2;
 const camera=new THREE.PerspectiveCamera(45,1.6,1,100000);camera.position.set(0,2500,2000);camera.lookAt(0,0,0);
 const points=visibleImageryPoints(metadata,new THREE.Matrix4(),camera,[mesh]);
 expect(points.length).toBeGreaterThan(0);
 expect(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))).toBeLessThan(15000);
 mesh.position.x=1000000;
 expect(visibleImageryPoints(metadata,new THREE.Matrix4(),camera,[mesh])).toEqual([]);
 mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();
});
it('frames both existing DEMs without representing their bounding box as measured elevation',()=>{
 const combined=basemapFrame([metadata,other]);expect(combined.analysis_supported).toBe(false);
 const nw=pixelToProjected(combined,0,0),se=pixelToProjected(combined,combined.grid.shape[1]-1,combined.grid.shape[0]-1);
 for(const m of [metadata,other])for(const col of [0,m.grid.shape[1]-1])for(const row of [0,m.grid.shape[0]-1]){
  const p=pixelToProjected(m,col,row);expect(p.x).toBeGreaterThanOrEqual(nw.x);expect(p.x).toBeLessThanOrEqual(se.x);expect(p.y).toBeLessThanOrEqual(nw.y);expect(p.y).toBeGreaterThanOrEqual(se.y);
 }
});

it('cancels stale views, retains the complete image through failure, and retries without duplicate loads',async()=>{
 vi.useFakeTimers();vi.stubGlobal('document',{documentElement:{lang:'en'},createElement:()=>({setAttribute:vi.fn(),remove:vi.fn(),width:256,height:256})});
 let x=0;
 const make=()=>({zoom:18,minX:0,minY:0,maxX:1,maxY:1,texture:new THREE.CanvasTexture(document.createElement('canvas')),dispose:vi.fn()});
 const first=make(),stale=make(),last=make();let finish!:(value:typeof stale)=>void,signal!:AbortSignal;
 const load=vi.spyOn(loader,'loadImageryAtlas').mockResolvedValueOnce(first)
  .mockImplementationOnce((_tiles,s)=>{signal=s;return new Promise(resolve=>{finish=resolve;});})
  .mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(last);
 const publish=vi.fn(),view=createViewImagery(()=>[{x,y:1,z:18}],4,publish,vi.fn());
 try{
  view.setEnabled(true);await vi.advanceTimersByTimeAsync(250);expect(publish).toHaveBeenLastCalledWith(first);
  view.schedule();await vi.advanceTimersByTimeAsync(250);expect(load).toHaveBeenCalledTimes(1);
  x=1;view.schedule();await vi.advanceTimersByTimeAsync(250);
  expect(publish).toHaveBeenCalledTimes(1);expect(view.status.hidden).toBe(false);
  x=2;view.schedule();await vi.advanceTimersByTimeAsync(250);expect(signal.aborted).toBe(true);
  expect(first.dispose).not.toHaveBeenCalled();expect(view.status.hidden).toBe(true);
  finish(stale);await vi.advanceTimersByTimeAsync(0);expect(stale.dispose).toHaveBeenCalledOnce();
  view.retry();await vi.advanceTimersByTimeAsync(250);expect(publish).toHaveBeenLastCalledWith(last);expect(first.dispose).toHaveBeenCalledOnce();
 }finally{view.dispose();load.mockRestore();vi.unstubAllGlobals();vi.useRealTimers();}
});

it('publishes a complete view before its fine refinement finishes',async()=>{
 vi.useFakeTimers();vi.stubGlobal('document',{documentElement:{lang:'en'},createElement:()=>({setAttribute:vi.fn(),remove:vi.fn(),width:256,height:256})});
 const make=(zoom:number)=>({zoom,minX:0,minY:0,maxX:10,maxY:10,texture:new THREE.CanvasTexture(document.createElement('canvas')),dispose:vi.fn()});
 const coarse=make(17),fine=make(18);let finish!:(value:typeof fine)=>void;
 const load=vi.spyOn(loader,'loadImageryAtlas').mockResolvedValueOnce(coarse).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const tiles=Array.from({length:100},(_,i)=>({x:i%10,y:Math.floor(i/10),z:18})),publish=vi.fn();
 const view=createViewImagery(()=>tiles,4,publish,vi.fn());
 try{
  view.setEnabled(true);await vi.advanceTimersByTimeAsync(250);
  expect(load.mock.calls[0][0]).toHaveLength(25);expect(publish).toHaveBeenLastCalledWith(coarse);
  expect(view.status.hidden).toBe(false);expect(coarse.dispose).not.toHaveBeenCalled();
  finish(fine);await vi.advanceTimersByTimeAsync(0);
  expect(publish).toHaveBeenLastCalledWith(fine);expect(coarse.dispose).toHaveBeenCalledOnce();expect(view.status.hidden).toBe(true);
 }finally{view.dispose();load.mockRestore();vi.unstubAllGlobals();vi.useRealTimers();}
});

it('does not starve image requests during continuous camera motion',async()=>{
 vi.useFakeTimers();vi.stubGlobal('document',{documentElement:{lang:'en'},createElement:()=>({setAttribute:vi.fn(),remove:vi.fn()})});
 const load=vi.spyOn(loader,'loadImageryAtlas').mockResolvedValue(null),view=createViewImagery(()=>[{x:1,y:1,z:18}],4,vi.fn(),vi.fn());
 try{
  view.setEnabled(true);
  for(let i=0;i<6;i++){await vi.advanceTimersByTimeAsync(200);view.schedule();}
  expect(load).toHaveBeenCalled();
 }finally{view.dispose();load.mockRestore();vi.unstubAllGlobals();vi.useRealTimers();}
});

it('prepares the entire film corridor, holds it through camera motion and resumes after exit',async()=>{
 vi.useFakeTimers();vi.stubGlobal('document',{documentElement:{lang:'en'},createElement:()=>({setAttribute:vi.fn(),remove:vi.fn()})});
 const make=()=>({zoom:16,minX:0,minY:0,maxX:2,maxY:2,texture:new THREE.CanvasTexture(document.createElement('canvas')),dispose:vi.fn()});
 const viewImage=make(),filmImage=make(),nextImage=make(),publish=vi.fn();
 const load=vi.spyOn(loader,'loadImageryAtlas').mockResolvedValueOnce(viewImage).mockResolvedValueOnce(filmImage).mockResolvedValueOnce(nextImage);
 const view=createViewImagery(()=>[{x:1,y:1,z:18}],4,publish,vi.fn());
 try {
  view.setEnabled(true);await vi.advanceTimersByTimeAsync(250);
  const corridor=[{x:10,y:12,z:16},{x:11,y:12,z:16}];await view.prepare(corridor);
  expect(load.mock.calls[1][0]).toEqual(corridor);expect(publish).toHaveBeenLastCalledWith(filmImage);
  for(let i=0;i<5;i++){view.schedule();await vi.advanceTimersByTimeAsync(500);}
  expect(load).toHaveBeenCalledTimes(2);expect(filmImage.dispose).not.toHaveBeenCalled();
  view.release();await vi.advanceTimersByTimeAsync(250);
  expect(publish).toHaveBeenLastCalledWith(nextImage);expect(filmImage.dispose).toHaveBeenCalledOnce();
 }finally{view.dispose();load.mockRestore();vi.unstubAllGlobals();vi.useRealTimers();}
});

it('keeps distant mountains from forcing a coarse texture on the whole foreground',()=>{
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(40000,40000));mesh.rotation.x=-Math.PI/2;
 const camera=new THREE.PerspectiveCamera(45,1.6,1,100000);camera.position.set(0,500,1000);camera.lookAt(0,400,-1000);
 const all=visibleImageryPoints(metadata,new THREE.Matrix4(),camera,[mesh]);
 const near=visibleImageryPoints(metadata,new THREE.Matrix4(),camera,[mesh],5000);
 expect(near.length).toBeGreaterThan(0);
 expect(Math.abs(near[1].y-near[0].y)).toBeLessThan(Math.abs(all[1].y-all[0].y));
 expect(camera.far).toBe(100000);
 mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();
});

it('uses native detail pages over the retained corridor and releases them when the film ends',async()=>{
 vi.useFakeTimers();vi.stubGlobal('document',{documentElement:{lang:'en'},createElement:()=>({setAttribute:vi.fn(),remove:vi.fn()})});
 const base={zoom:12,minX:3200,minY:1700,maxX:3300,maxY:1900,texture:new THREE.CanvasTexture(document.createElement('canvas')),dispose:vi.fn()};
 const fine={zoom:16,minX:51701,minY:28698,maxX:51705,maxY:28702,texture:new THREE.CanvasTexture(document.createElement('canvas')),dispose:vi.fn()};
 const load=vi.spyOn(loader,'loadImageryAtlas').mockResolvedValueOnce(base).mockResolvedValueOnce(fine),publish=vi.fn(),publishBase=vi.fn(),prime=vi.fn();
 const view=createViewImagery(()=>[],4,publish,vi.fn(),publishBase,prime);
 try {
  view.setEnabled(true);
  await view.prepare([{x:3200,y:1700,z:12}],[[{x:51702,y:28700,z:16}]]);
  expect(publishBase).toHaveBeenLastCalledWith(base);expect(prime).toHaveBeenLastCalledWith(fine);
  const [lon,lat]=tileLonLat(51703,28700,16),[x,y]=proj4('EPSG:4326',metadata.crs.proj4!,[lon,lat]);
  view.filmAt({x,y},metadata);expect(publish).toHaveBeenLastCalledWith(fine);
  view.filmAt({x:x+100000,y},metadata);expect(publish).toHaveBeenLastCalledWith(base);
  expect(base.dispose).not.toHaveBeenCalled();expect(fine.dispose).not.toHaveBeenCalled();
  view.release();expect(prime).toHaveBeenLastCalledWith(null);expect(publishBase).toHaveBeenLastCalledWith(null);expect(fine.dispose).toHaveBeenCalledOnce();
 }finally{view.dispose();load.mockRestore();vi.unstubAllGlobals();vi.useRealTimers();}
});

it('waits for a matching camera request already in flight before starting the film',async()=>{
 vi.useFakeTimers();vi.stubGlobal('document',{documentElement:{lang:'en'},createElement:()=>({setAttribute:vi.fn(),remove:vi.fn()})});
 const atlas={zoom:16,minX:0,minY:0,maxX:2,maxY:2,texture:new THREE.CanvasTexture(document.createElement('canvas')),dispose:vi.fn()};
 let finish!:(value:typeof atlas)=>void;
 const load=vi.spyOn(loader,'loadImageryAtlas').mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const tiles=[{x:1,y:1,z:16}],publishBase=vi.fn(),view=createViewImagery(()=>tiles,4,vi.fn(),vi.fn(),publishBase);
 try{
  view.setEnabled(true);await vi.advanceTimersByTimeAsync(250);
  let ready=false;const prepared=view.prepare(tiles).then(()=>{ready=true;});
  await Promise.resolve();await Promise.resolve();expect(ready).toBe(false);expect(publishBase).not.toHaveBeenCalledWith(atlas);
  finish(atlas);await prepared;expect(ready).toBe(true);expect(publishBase).toHaveBeenLastCalledWith(atlas);expect(load).toHaveBeenCalledOnce();
 }finally{view.dispose();load.mockRestore();vi.unstubAllGlobals();vi.useRealTimers();}
});


it('publishes local imagery first, refines the same overview tiles online, and films locally',async()=>{
 vi.useFakeTimers();vi.stubGlobal('document',{documentElement:{lang:'en'},createElement:()=>({setAttribute:vi.fn(),remove:vi.fn()})});
 vi.stubGlobal('navigator',{onLine:true});reconnectInternetDetail();
 const local={imagery:{url:'/offline-map/imagery/{z}/{x}/{y}.webp',maxZoom:14}} as LocalMapSource;setLocalMapSource(local);
 const make=(source:'local'|'online')=>({zoom:12,minX:0,minY:0,maxX:2,maxY:2,source,texture:new THREE.CanvasTexture(document.createElement('canvas')),dispose:vi.fn()});
 const fallback=make('local'),online=make('online'),film=make('local'),stop=make('local');let finish!:(value:typeof online)=>void;
 const load=vi.spyOn(loader,'loadImageryAtlas').mockResolvedValueOnce(fallback).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce(film).mockResolvedValueOnce(stop);
 const tiles=[{x:1,y:1,z:12}],publish=vi.fn(),view=createViewImagery(()=>tiles,4,publish,vi.fn());
 try{
  view.setEnabled(true);await vi.advanceTimersByTimeAsync(250);
  expect(publish).toHaveBeenLastCalledWith(fallback);expect(fallback.dispose).not.toHaveBeenCalled();
  expect(load.mock.calls[0][4]).toBe(local.imagery.url);expect(load.mock.calls[1][4]).toMatch(/^https:/);
  finish(online);await vi.advanceTimersByTimeAsync(0);expect(publish).toHaveBeenLastCalledWith(online);
  await view.prepare(tiles,[tiles]);
  expect(load.mock.calls[2][4]).toBe(local.imagery.url);expect(load.mock.calls[3][4]).toBe(local.imagery.url);
  expect(publish).toHaveBeenLastCalledWith(film);
 }finally{view.dispose();setLocalMapSource(null);load.mockRestore();vi.unstubAllGlobals();vi.useRealTimers();}
});
