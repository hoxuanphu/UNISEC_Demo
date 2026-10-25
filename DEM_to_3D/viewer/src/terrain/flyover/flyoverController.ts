import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import {surfaceLineGeometry,stabiliseSurfaceLine} from '../surfaceLine';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { createPathSampler, easeInOutCubic, planFlyover, type FlyoverMoment, type FlyoverPlan, type PathSampler } from '../../features/flyover/flyoverPlan';
import { createFlyoverBearing,createFlyoverCameraTrack,flyoverRouteAnchor,flyoverOverviewPose } from '../../features/flyover/flyoverCamera';
import type { FlyoverInput } from '../../features/flyover/flyoverInput';
import { verifiedAssetBytes } from '../../data/ScenarioRepository';
import { corridorImagery } from './corridorImagery';
import { imagerySource } from '../../features/map/imagerySource';
import { drawFlyoverOverlay, type OverlayFrame, type OverlayStop, type ScreenPoint } from './flyoverOverlay';

export type FlyoverStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'exporting';
export type FlyoverState = { status: FlyoverStatus; time: number; duration: number; exportProgress?: number; error?: string; playbackRate?:number };
export type FlyoverControls = {
  setPlaybackRate:(rate:number)=>void;
  play: () => Promise<void>; pause: () => void; resume: () => void; seek: (time: number) => void; exit: () => void;
  exportVideo: (onProgress: (fraction: number) => void, signal: AbortSignal) => Promise<Blob>;
};

type Deps = {
  host: HTMLElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  terrainMeshes: THREE.Mesh[];
  /** Terrain surface in world coordinates for a projected (EPSG:32648) point. */
  surfaceWorld: (point: { x: number; y: number }) => THREE.Vector3 | null;
  /** World-space ground height under a world (x, z), if any terrain covers it. */
  groundAt: (x: number, z: number) => number | undefined;
  /** Shows a prepared corridor image as the drape, or restores the user's choice with null. */
  setDrape: (image: { canvas: HTMLCanvasElement; bounds: readonly [number, number, number, number]; opacity?:number } | null) => void;
  /** Resolves when surface heights beyond the DEMs (online relief) are as complete as they will get. */
  ready: () => Promise<void>;
  cancelPreparation?:()=>void;
  onFrame?: (target:THREE.Vector3,activeAreaId?:string)=>void;
  onResolution?: (width:number,height:number)=>void;
  maxTextureSize: number;
  enter: () => void;
  leave: (target: THREE.Vector3) => void;
  render: () => void;
  invalidate: () => void;
  restoreViewport: () => void;
  locale: () => 'vi' | 'en';
  onState: (state: FlyoverState) => void;
};

const STEP = 10, LIFT = 9, FOG = '#bccbd5';
const lerp = THREE.MathUtils.lerp;

type Prepared = {
  key: string;
  cameraMode:'corridor'|'network';
  context: {areas:Array<{id:string}>;closures:THREE.Vector3[]};
  plan: FlyoverPlan;
  path: PathSampler;
  bearing: ReturnType<typeof createFlyoverBearing>;
  stops: Array<{ world: THREE.Vector3; info: Omit<OverlayStop, 'screen'> }>;
  areas: Array<{world:THREE.Vector3; distance:number; radius:number}>;
  start: THREE.Vector3; end: THREE.Vector3;
  overviewPoints:THREE.Vector3[];
  cameraTrack?:{aspect:number;fov:number;at:ReturnType<typeof createFlyoverCameraTrack>};
  trail: { base: Line2; glow: Line2; done: Line2; segments: number };
  text: {start: string; end: string; attribution: string; blocked: string; cutOff: (people: number) => string};
  alerts: Array<{ world: THREE.Vector3; people: number }>;
  summary?: { title: string; stats: Array<{ value: string; label: string }> };
  places: Array<{ world: THREE.Vector3; label: string; kind: 'community' | 'staging' | 'hlz' }>;
  /** Route metres before the first surface point (off every terrain); chainage still counts them. */
  offset: number;
  imagery: Awaited<ReturnType<typeof corridorImagery>>;
  imageryOpacity:number;
};

function skyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  // Below the horizon band the sky equals the fog colour, so fully fogged ridges dissolve into it.
  gradient.addColorStop(0, '#5f84a8'); gradient.addColorStop(.5, '#a9bfcf'); gradient.addColorStop(.72, FOG); gradient.addColorStop(1, FOG);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 4, 512);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createFlyoverController(deps: Deps) {
  const { host, renderer, scene, camera } = deps;
  const mapFont=getComputedStyle(document.documentElement).getPropertyValue('--font-map').trim() || 'Roboto, Arial, sans-serif';
  const overlay = document.createElement('canvas');
  overlay.className = 'flyover-overlay'; overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true');
  host.append(overlay);
  const raycaster = new THREE.Raycaster();
  (raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
  const sky = skyTexture();
  const fog = new THREE.Fog(FOG, 1, 2);
  const loading = new AbortController();
  let input: FlyoverInput | null = null, prepared: Prepared | null = null, preparing: Promise<Prepared> | null = null;
  let playbackRate=1,playbackRequest=0,preparationReleased=false;
  let status: FlyoverStatus = 'idle', elapsed = 0, last = 0, lastEmit = 0, disposed = false;
  let saved: { background: THREE.Scene['background']; fog: THREE.Scene['fog']; near: number; far: number } | null = null;
  let finalTarget = new THREE.Vector3();

  const emit = (force = false, extra: Partial<FlyoverState> = {}) => {
    const now = performance.now();
    if (!force && now - lastEmit < 100) return;
    lastEmit = now;
    deps.onState({ status, time: elapsed, duration: prepared?.plan.duration ?? 0, playbackRate, ...extra });
  };

  async function prepare(): Promise<Prepared> {
    if (!input) throw new Error('No route for the flyover');
    if (prepared && saved) return prepared;
    if (preparing) return preparing;
    preparing = (async () => {
      preparationReleased=false;
      await deps.ready();
      if (disposed) throw new DOMException('Viewer replaced','AbortError');
      if (!input) throw new Error('No route for the flyover');
      // Photo and imagery catalogs can finish loading while relief is prepared.
      const source=input, locale=deps.locale(), key=source.key+':'+locale;
      if(prepared?.key===key) return prepared;
      // Densify the route so the trail follows the terrain, then lift it onto the surface.
      const dense: Array<{ x: number; y: number }> = [];
      source.route.forEach((p, i) => {
        if (!i) { dense.push(p); return; }
        const a = source.route[i - 1], n = Math.max(1, Math.ceil(Math.hypot(p.x - a.x, p.y - a.y) / STEP));
        for (let k = 1; k <= n; k++) dense.push({ x: a.x + (p.x - a.x) * k / n, y: a.y + (p.y - a.y) * k / n });
      });
      // A point off every DEM keeps the last height; scene x is east and z is south.
      let previous: { world: THREE.Vector3; projected: { x: number; y: number } } | null = null, offset = 0;
      const world: THREE.Vector3[] = [];
      for (const p of dense) {
        const w = deps.surfaceWorld(p);
        const point: THREE.Vector3 | null = w ?? (previous ? new THREE.Vector3(previous.world.x + p.x - previous.projected.x, previous.world.y, previous.world.z - (p.y - previous.projected.y)) : null);
        if (!point) { if (!world.length) offset += STEP; continue; }
        world.push(point); previous = { world: point, projected: p };
      }
      if (world.length < 2) throw new Error('The route is outside the terrain');
      const path = createPathSampler(world, STEP, 700);
      const anchor=previous!;
      const overviewPoints=[...world,...(source.overviewPoints??[]).map(p=>deps.surfaceWorld(p)??new THREE.Vector3(anchor.world.x+p.x-anchor.projected.x,anchor.world.y,anchor.world.z-p.y+anchor.projected.y))];
      const stopInfo = source.stops.map(stop => {
        const w = deps.surfaceWorld(stop.projected);
        return { stop, world: w, distance: w ? path.project(w.x, w.z) : -1 };
      }).filter((item): item is typeof item & { world: THREE.Vector3 } => item.world !== null).sort((a, b) => a.distance - b.distance);
      const plan = planFlyover(path.length, stopInfo.map(item => item.distance));
      const areas = source.areas.flatMap(area => {
        const world = deps.surfaceWorld(area.center);
        if (!world) return [];
        const distance=path.project(world.x,world.z), nearest=path.pointAt(distance);
        return Math.hypot(world.x-nearest.x,world.z-nearest.z)>900+area.radius ? [] : [{world,distance,radius:area.radius}];
      });
      const t = (vi: string, en: string) => locale === 'en' ? en : vi;
      const stops = await Promise.all(stopInfo.map(async item => {
        const photo = item.stop.photo ? await verifiedAssetBytes(item.stop.photo.image, loading.signal)
          .then(bytes => createImageBitmap(new Blob([bytes], {type: 'image/webp'}))).catch(() => undefined) : undefined;
        return {world: item.world, info: {
          id:item.stop.id, label: t(...item.stop.name), distance: item.distance, status: item.stop.status,
          photo: photo ? {image: photo, caption: item.stop.photoCaption ? t(...item.stop.photoCaption) : '', illustrative:item.stop.photoRole==='illustrative'} : undefined
        }};
      }));
      if (disposed) { stops.forEach(stop=>stop.info.photo?.image.close()); throw new DOMException('Viewer replaced','AbortError'); }
      const imagery = source.imagery.length ? await corridorImagery(source.imagery, source.route, { halfWidth: 1800, maxSize: Math.min(8192, deps.maxTextureSize), signal: loading.signal }).catch(() => null) : null;
      if (disposed || (source.imagery.length && !imagery)) {
        stops.forEach(stop=>stop.info.photo?.image.close());
        throw new Error(disposed ? 'Viewer replaced' : 'Flyover imagery unavailable');
      }
      // Trail: the whole road faint, the travelled part in route orange over a soft glow.
      const positions = world.flatMap(p => [p.x, p.y + LIFT, p.z]);
      const line = (color: string, width: number, opacity: number, order: number) => {
        const geometry = surfaceLineGeometry(positions);
        const material = stabiliseSurfaceLine(new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthWrite: false }));
        material.resolution.set(renderer.domElement.width, renderer.domElement.height);
        const object = new Line2(geometry, material); object.renderOrder = order; object.frustumCulled = false; object.visible = false;
        scene.add(object); return object;
      };
      const routeColor=source.cameraMode==='network'?'#368df0':'#e28b42';
      const trail = { base: line('#c9c6bb', 1.5, .4, 40), glow: line(routeColor, 7, .17, 41), done: line(routeColor, 3, 1, 42), segments: 0 };
      trail.segments=trail.base.geometry.getAttribute('instanceStart').count;
      const name = (label: [string, string]) => t(...label);

      if (disposed) {
        [trail.base,trail.glow,trail.done].forEach(disposeLine);stops.forEach(stop=>stop.info.photo?.image.close());
        throw new DOMException('Viewer replaced','AbortError');
      }
      return {
        key, cameraMode:source.cameraMode??'corridor',context:{
          areas:(source.context?.areas??[]).filter(area=>area.kind==='landslide').map(area=>({id:area.id})),
          closures:(source.context?.closures??[]).flatMap(closure=>{const world=deps.surfaceWorld(closure.point);return world?[world]:[];})
        }, places:(source.places??[]).flatMap(place=>{const world=deps.surfaceWorld(place.projected);return world?[{world,label:name(place.name),kind:place.kind}]:[];}),
        alerts:(source.alerts??[]).flatMap(alert=>{const world=deps.surfaceWorld(alert.projected);return world?[{world,people:alert.people}]:[];}),
        summary:source.summary&&{title:name(source.summary.title),stats:source.summary.stats.map(stat=>({value:name(stat.value),label:name(stat.label)}))},
        plan, path, overviewPoints, bearing: createFlyoverBearing(path,plan), stops, areas, start: world[0], end: world[world.length - 1], trail, offset, imagery, imageryOpacity:source.imageryOpacity,
        text: {start: offset > 100 ? '' : name(source.start), end: name(source.end), blocked: t('Đường bị chặn','Road blocked'),
          cutOff: people => locale === 'en' ? `${people} ${people === 1 ? 'person' : 'people'} cut off` : `${people} người bị cô lập`,
          attribution: [source.imagery.length ? `${source.imageryLabel[locale==='vi'?0:1]} © Planet Labs PBC` : '',imagerySource.credit,'© OpenStreetMap'].filter(Boolean).join(', ')}
      } satisfies Prepared;
    })();
    try {
      const next=await preparing;
      if (prepared && prepared!==next) releasePrepared(prepared);
      prepared=next;return next;
    } finally { preparing=null; }
  }

  function releasePrepared(p: Prepared) {
    [p.trail.base,p.trail.glow,p.trail.done].forEach(disposeLine);
    p.stops.forEach(stop=>stop.info.photo?.image.close());
    if(p.imagery)p.imagery.canvas.width=p.imagery.canvas.height=1;
  }
  function disposeLine(line: Line2) { line.removeFromParent(); line.geometry.dispose(); (line.material as LineMaterial).dispose(); }

  // --- Camera ---------------------------------------------------------------------------------
  const up = new THREE.Vector3(0, 1, 0);
  /** Maintain a forward-looking tracking shot. Close in gently on a scar without
   * orbiting it or reversing the bearing when its photograph appears. */
  function followPose(p: Prepared, moment: FlyoverMoment) {
    const s=moment.distance, heading=p.bearing(moment.time);
    const forward=new THREE.Vector3(heading.x,0,heading.z);
    const nearest=p.stops.reduce<typeof p.stops[number] | undefined>((best,stop)=>
      !best || Math.abs(stop.info.distance-s)<Math.abs(best.info.distance-s) ? stop : best,undefined);
    const focus=nearest ? 1-easeInOutCubic(Math.min(1,Math.abs(nearest.info.distance-s)/550)) : 0;
    const width=1+moment.overview*.4;
    // Keep enough ground in the frame to read the route and the side scars.
    // Photograph visits tighten only slightly, keeping the same corridor view.
    let back=lerp(2250,2150,focus)*width, height=lerp(1750,1800,focus)*width;
    const P=p.path.pointAt(s), head=new THREE.Vector3(P.x,P.y,P.z);
    const anchor=flyoverRouteAnchor(p.path,s);
    const target=anchor.clone().addScaledVector(forward,220);
    if(nearest) target.lerp(nearest.world,focus*.2);
    // Frame the nearby real extents as a group, without swinging around each one.
    // Fade their influence with chainage so small side scars enter the shot gently.
    const neighbours=p.areas.map(area=>({...area,weight:Math.max(0,1-Math.abs(area.distance-s)/700)**2 * Math.max(0,1-area.world.distanceTo(head)/1100)}))
      .filter(area=>area.weight>0 && area.radius<500);
    const total=neighbours.reduce((sum,area)=>sum+area.weight,0);
    if(total>0) {
      const centre=neighbours.reduce((sum,area)=>sum.addScaledVector(area.world,area.weight),new THREE.Vector3()).multiplyScalar(1/total);
      target.lerp(centre,Math.min(.4,total*.2));
      for(const area of neighbours) {
        const span=Math.hypot(area.world.x-target.x,area.world.z-target.z)+area.radius;
        const halfFov=Math.atan(Math.tan(camera.fov*Math.PI/360)*Math.min(1,camera.aspect));
        const fit=(span+40)/Math.sin(halfFov)/Math.hypot(back,height);
        const scale=1+Math.max(0,fit-1)*area.weight;
        back*=scale;height*=scale;
      }
    }
    target.y+=18;
    const offset=forward.clone().multiplyScalar(-back);
    offset.y=height+Math.max(0,target.y-anchor.y);
    const look=target.clone().sub(anchor);
    const need = (at: number) => {
      const point=flyoverRouteAnchor(p.path,at),cam=point.clone().add(offset),target=point.clone().add(look);
      let rise = (deps.groundAt(cam.x, cam.z) ?? -Infinity) + 140 - cam.y;
      for (const f of [.25, .5, .75, .9]) {
        const q = cam.clone().lerp(target, f), g = deps.groundAt(q.x, q.z);
        if (g !== undefined) rise = Math.max(rise, (g + 40 - q.y) / (1 - f));
      }
      return rise;
    };
    // A windowed maximum, averaged: clears ridges ahead of time without jitter.
    let rise = 0;
    for (const centre of [-160, 0, 160]) {
      let worst = 0;
      for (let d = -240; d <= 240; d += 80) worst = Math.max(worst, need(s + centre + d));
      rise += worst / 3;
    }
    const position = anchor.clone().add(offset); position.y += rise;
    return { position, target };
  }

  /** Share of the route a network film keeps in frame while the marker moves. */
  const NETWORK_WINDOW=.6;
  /** Seconds of camera smoothing: removes kinks where framing rules hand over, keeps every shot. */
  const CAMERA_SMOOTHING=.5;

  function prepareCameraTrack(p:Prepared){
    if(p.cameraTrack?.aspect===camera.aspect&&p.cameraTrack.fov===camera.fov)return p.cameraTrack;
    // A network film reads as a wide oblique map. Keep its bearing and framing
    // stable while the marker moves; open on the route and close on the full area of interest.
    const networkPose=p.cameraMode==='network'?flyoverOverviewPose([
      ...p.path.cumulative.map(s=>{const q=p.path.pointAt(s);return new THREE.Vector3(q.x,q.y,q.z);}),
      ...p.stops.map(stop=>stop.world)
    ],{x:.25,z:.97},camera.fov,camera.aspect):null;
    const close=flyoverOverviewPose(p.overviewPoints,p.cameraMode==='network'?{x:.25,z:.97}:p.bearing(p.plan.duration),camera.fov,camera.aspect);
    // While the marker travels, frame a window of about 60% of the route around it (at least
    // 1.5 km) so the view visibly moves; the opening holds the route, and the close shows the whole road network.
    // The window glides the whole way, eased at both ends, so it never starts or stops with
    // a jolt; it is sampled densely so a hairpin entering it does not shake the frame.
    const networkWindow=(distance:number)=>{
      const length=p.path.length,span=Math.min(length,Math.max(1500,length*NETWORK_WINDOW));
      const u=Math.min(1,Math.max(0,distance/length)),from=(length-span)*u*u*(3-2*u);
      const points=Array.from({length:241},(_,i)=>{const q=p.path.pointAt(from+span*i/240);return new THREE.Vector3(q.x,q.y,q.z);});
      return flyoverOverviewPose(points,{x:.25,z:.97},camera.fov,camera.aspect);
    };
    const at=createFlyoverCameraTrack(p.plan.duration,time=>{
      const moment=p.plan.at(time);
      let pose;
      if(!networkPose)pose=followPose(p,moment);
      else{
        pose=networkWindow(moment.distance);
        if(moment.phase==='intro'||moment.phase==='dive'){pose.position.lerp(networkPose.position,moment.overview);pose.target.lerp(networkPose.target,moment.overview);}
      }
      if(moment.phase==='outro'||moment.phase==='final'){
        pose.position.lerp(close.position,moment.overview);pose.target.lerp(close.target,moment.overview);
      }
      return pose;
    },30,CAMERA_SMOOTHING);
    return p.cameraTrack={aspect:camera.aspect,fov:camera.fov,at};
  }

  // --- Frame ----------------------------------------------------------------------------------
  let width = 1, height = 1;
  function apply(p: Prepared, time: number) {
    const moment = p.plan.at(time);
    const { position, target } = prepareCameraTrack(p).at(time);
    camera.position.copy(position); camera.up.copy(up); camera.lookAt(target);
    camera.updateMatrixWorld();
    const distance = position.distanceTo(target);
    fog.near = distance * 3;
    fog.far = distance * 16;
    camera.near = Math.max(4, distance / 400); camera.far = distance * 14; camera.updateProjectionMatrix();
    const closing=moment.phase==='outro'||moment.phase==='final'?moment.overview:0;
    (p.trail.done.material as LineMaterial).linewidth=lerp(3,1.8,closing);
    (p.trail.glow.material as LineMaterial).linewidth=lerp(7,3,closing);
    // The trail ends at the last route vertex the marker has passed. Vertices are not evenly
    // spaced, so a share of the vertex count would run ahead of or behind the marker.
    const travelled = moment.phase === 'final' || moment.phase === 'outro' ? p.trail.segments : passedVertices(p.path.cumulative, moment.distance);
    p.trail.done.geometry.instanceCount = p.trail.glow.geometry.instanceCount = Math.max(0, Math.min(p.trail.segments, travelled));
    finalTarget = target;deps.onFrame?.(target,p.stops[moment.stop]?.info.id);
    return moment;
  }
  const projected = new THREE.Vector3(), direction = new THREE.Vector3();
  function screen(point: THREE.Vector3, lift = LIFT): ScreenPoint {
    projected.set(point.x, point.y + lift, point.z);
    const range = camera.position.distanceTo(projected);
    direction.copy(projected).sub(camera.position).normalize();
    projected.project(camera);
    const visible = projected.z < 1 && Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < 1.15;
    let occluded = false;
    if (visible) {
      raycaster.set(camera.position, direction); raycaster.far = range;
      const hit = raycaster.intersectObjects(deps.terrainMeshes, false)[0];
      occluded = Boolean(hit && hit.distance < range - Math.max(25, range * .01));
    }
    return { x: (projected.x + 1) / 2 * width, y: (1 - projected.y) / 2 * height, visible, occluded };
  }
  function frameData(p: Prepared, moment: FlyoverMoment, w: number, h: number): OverlayFrame {
    width = w; height = h;
    const head = p.path.pointAt(moment.distance);
    return {
      width: w, height: h, moment,
      font: mapFont,
      ...p.text,
      start: { label: p.text.start, screen: screen(p.start) }, end: { label: p.text.end, screen: screen(p.end) },
      head: screen(new THREE.Vector3(head.x, head.y, head.z)),
      stops: p.stops.map(stop => ({ ...stop.info, screen: screen(stop.world, 30) })),
      context:{areas:p.context.areas,closures:p.context.closures.map(point=>screen(point,15)),blocked:p.text.blocked},
      alerts:p.alerts.map(alert=>({people:alert.people,screen:screen(alert.world,15)})),cutOff:p.text.cutOff,summary:p.summary,
      // The map's own place markers are hidden during the film, so every frame carries the names.
      places:p.places.map(place=>({label:place.label,kind:place.kind,screen:screen(place.world,15)}))
    };
  }
  function drawLive(p: Prepared, moment: FlyoverMoment) {
    const ratio = renderer.getPixelRatio(), w = host.clientWidth, h = host.clientHeight;
    if (overlay.width !== Math.round(w * ratio) || overlay.height !== Math.round(h * ratio)) { overlay.width = Math.round(w * ratio); overlay.height = Math.round(h * ratio); }
    const ctx = overlay.getContext('2d'); if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0,0,w,h);
    drawFlyoverOverlay(ctx, frameData(p, moment, w, h));
  }
  function setResolution(w: number, h: number) {
    if (!prepared) return;
    deps.onResolution?.(w,h);
    for (const line of [prepared.trail.base, prepared.trail.glow, prepared.trail.done]) (line.material as LineMaterial).resolution.set(w, h);
  }

  async function begin(p: Prepared,allowed=()=>!disposed) {
    await document.fonts?.ready;
    if(!allowed())return false;
    // A cancelled launch may have released the imagery while this shared
    // preparation was pending. Reacquire it before a quick subsequent launch.
    if(preparationReleased){await deps.ready();if(!allowed())return false;preparationReleased=false;}
    prepareCameraTrack(p);
    deps.enter();
    saved = { background: scene.background, fog: scene.fog, near: camera.near, far: camera.far };
    scene.background = sky; scene.fog = fog;
    for (const line of [p.trail.base, p.trail.glow, p.trail.done]) line.visible = true;
    setResolution(renderer.domElement.width, renderer.domElement.height);
    overlay.hidden = false;
    if (p.imagery) deps.setDrape({...p.imagery,opacity:p.imageryOpacity});
    // Upload the Planet drape and compile the first shot before the playback
    // clock starts; a cold GPU upload must not skip the beginning of the route.
    const moment=apply(p,0);deps.render();drawLive(p,moment);return true;
  }
  function finish() {
    if (!saved) {preparationReleased=true;deps.cancelPreparation?.();return;}
    scene.background = saved.background; scene.fog = saved.fog;
    camera.near = saved.near; camera.far = saved.far; camera.updateProjectionMatrix();
    saved = null;
    if (prepared) for (const line of [prepared.trail.base, prepared.trail.glow, prepared.trail.done]) line.visible = false;
    overlay.hidden = true;
    void deps.setDrape(null);
    deps.leave(finalTarget);
  }

  const controls: FlyoverControls = {
    setPlaybackRate(rate){if(![.75,1,1.25,1.5].includes(rate))return;playbackRate=rate;last=performance.now();emit(true);},
    async play() {
      if (status === 'exporting' || status === 'loading' || status === 'playing') return;
      if (status === 'paused' || status === 'ended') { if (status === 'ended') elapsed = 0; status = 'playing'; last = performance.now(); emit(true); deps.invalidate(); return; }
      const request=++playbackRequest;
      status = 'loading'; emit(true);
      try {
        const p = await prepare();
        loading.signal.throwIfAborted();
        const current=()=>request===playbackRequest&&status==='loading'&&!disposed;
        if(!current()||!await begin(p,current))return;
        loading.signal.throwIfAborted();
        if(!current())return;
        elapsed = 0; last = performance.now(); status = 'playing'; emit(true); deps.invalidate();
      } catch (error) {
        if (disposed) throw error;
        if(request!==playbackRequest)return;
        finish(); status = 'idle'; emit(true, { error: error instanceof Error ? error.message : String(error) });
      }
    },
    pause() { if (status === 'playing') { status = 'paused'; emit(true); } },
    resume() { if (status === 'paused') { status = 'playing'; last = performance.now(); emit(true); deps.invalidate(); } },
    seek(time) {
      if (!prepared || !['playing', 'paused', 'ended'].includes(status)) return;
      elapsed = Math.min(prepared.plan.duration, Math.max(0, time));
      if (status === 'ended' && elapsed < prepared.plan.duration) status = 'paused';
      last = performance.now(); emit(true); deps.invalidate();
    },
    exit() { if (status === 'idle' || status === 'exporting') return; playbackRequest++;finish(); status = 'idle'; elapsed = 0; emit(true); },
    async exportVideo(onProgress, signal) {
      if (status === 'exporting') throw new Error('Export already running');
      const resume = status === 'idle' ? null : status;
      status = 'exporting'; emit(true, { exportProgress: 0 });
      const W = 1920, H = 1080, FPS = 30;
      const ratio = renderer.getPixelRatio(), size = renderer.getSize(new THREE.Vector2()), aspect = camera.aspect;
      let entered = false;
      try {
        const p = await prepare();
        signal.throwIfAborted();loading.signal.throwIfAborted();
        if (!saved) { entered=await begin(p,()=>!disposed&&!signal.aborted); }
        loading.signal.throwIfAborted();
        const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH, getFirstEncodableVideoCodec } = await import('mediabunny');
        const codec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: W, height: H });
        if (!codec) throw new Error('This browser cannot encode video');
        renderer.setPixelRatio(1); renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); setResolution(W, H);
        prepareCameraTrack(p);
        overlay.hidden = true;
        const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d')!;
        const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
        const source = new CanvasSource(canvas, { codec, bitrate: QUALITY_HIGH, keyFrameInterval: 2 });
        output.addVideoTrack(source, { frameRate: FPS });
        await output.start();
        const rate=playbackRate,frames = Math.ceil(p.plan.duration / rate * FPS);
        try {
          for (let i = 0; i < frames; i++) {
            signal.throwIfAborted();loading.signal.throwIfAborted();
            const moment = apply(p, Math.min(p.plan.duration, i / FPS * rate));
            deps.render();
            ctx.drawImage(renderer.domElement, 0, 0, W, H);
            drawFlyoverOverlay(ctx, frameData(p, moment, W, H));
            await source.add(i / FPS, 1 / FPS);
            if (i % 6 === 0) { onProgress(i / frames); emit(true, { exportProgress: i / frames }); await new Promise(resolve => setTimeout(resolve, 0)); }
          }
          await output.finalize();
        } catch (error) { await output.cancel(); throw error; }
        onProgress(1);
        return new Blob([(output.target as InstanceType<typeof BufferTarget>).buffer!], { type: 'video/mp4' });
      } finally {
        if (!disposed) {
          renderer.setPixelRatio(ratio); renderer.setSize(size.x, size.y, false); camera.aspect = aspect; camera.updateProjectionMatrix();
          setResolution(renderer.domElement.width, renderer.domElement.height);
          if (entered || !resume) { finish(); status = 'idle'; elapsed = 0; }
          else { status = resume === 'playing' ? 'paused' : resume; overlay.hidden = false; }
          deps.restoreViewport();
          emit(true); deps.invalidate();
        }
      }
    }
  };

  return {
    controls,
    get active() { return status === 'playing' || status === 'paused' || status === 'ended'; },
    get exporting() { return status === 'exporting'; },
    setInput(next: FlyoverInput | null) {
      if(input?.key!==next?.key && ['loading','playing','paused','ended'].includes(status))controls.exit();
      input = next;
      if (!next && (status === 'loading' || status === 'playing' || status === 'paused' || status === 'ended')) controls.exit();
    },
    /** Called from the render loop; returns whether another frame is needed. */
    frame(now: number) {
      if (!prepared || !saved) return false;
      if (status === 'playing') {
        elapsed += Math.max(0, (now - last) / 1000)*playbackRate; last = now;
        if (elapsed >= prepared.plan.duration) { elapsed = prepared.plan.duration; status = 'ended'; emit(true); }
        else emit();
      }
      const moment = apply(prepared, elapsed);
      deps.render();
      drawLive(prepared, moment);
      return status === 'playing';
    },
    resize(w: number, h: number) { if (saved && status !== 'exporting') setResolution(w, h); },
    dispose() {
      disposed = true;playbackRequest++;loading.abort();
      if (saved) finish();
      if(prepared){releasePrepared(prepared);prepared=null;}
      sky.dispose(); overlay.remove();
      status = 'idle'; deps.onState({ status, time: 0, duration: 0 });
    }
  };
}
export type FlyoverController = ReturnType<typeof createFlyoverController>;

/** Segments fully travelled: route vertices at or before `distance`, less the first. */
function passedVertices(cumulative: readonly number[], distance: number): number {
  let lo = 0, hi = cumulative.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cumulative[mid] <= distance) lo = mid + 1; else hi = mid; }
  return Math.max(0, lo - 1);
}
