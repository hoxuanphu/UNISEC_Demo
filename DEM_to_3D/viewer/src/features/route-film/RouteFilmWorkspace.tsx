import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Locale } from '../../types/dear';
import type { ViewControls, BasemapState, MapScene } from '../map/mapContracts';
import { UiIcon } from '../../shared/ui/UiIcon';
import { useRoadJourney } from '../routes/useRoadJourney';
import { useTerrainWorkspace } from '../terrain/useTerrainWorkspace';
import { usePreparedPhotos } from '../fieldPhotos/preparedPhotos';
import { Map3DBoundary } from '../map/Map3DBoundary';
import { FlyoverBar } from '../flyover/FlyoverBar';
import type { FlyoverState } from '../../terrain/flyover/flyoverController';
import { useLocalNetwork } from './networkContext';
import { buildLocalFlyover, localRouteStops } from './localFlyover';
import { LocalAreaCard } from './LocalAreaCard';
import './route-film.css';
import { difficultRoadLabel, roadConditionMessage } from '../routes/localRoadLabels';
import { useResidentPresence } from '../presence/residentPresence';
import { assessHouseholdAccess } from '../presence/householdIsolation';
const TerrainViewer=lazy(()=>import('../../components/TerrainViewer').then(module=>({default:module.TerrainViewer})));
const noRoads:MapScene['roads']=[];

export function RouteFilmWorkspace({locale,onChangeLocale,theme='light'}:{locale:Locale;onChangeLocale:(locale:Locale)=>void;theme?:'light'|'dark'}):JSX.Element {
  const t=(vi:string,en:string)=>locale==='vi'?vi:en;
  const [unavailable,setUnavailable]=useState(false),[viewerAttempt,setViewerAttempt]=useState(0);
  const onUnavailable=useCallback(()=>setUnavailable(true),[]);
  const runtime=useTerrainWorkspace({mapMode:'3d',on3DUnavailable:onUnavailable});
  const local=useLocalNetwork(true,runtime.fieldDataset?.records);
  const journey=useRoadJourney(local.network?.roads??noRoads,250);
  const photos=usePreparedPhotos(runtime.manifest?.fieldPhotos);
  const presence=useResidentPresence(runtime.manifest?.residentPresence);
  const [selectedArea,setSelectedArea]=useState<string|null>(()=>new URLSearchParams(location.search).get('area'));
  const [film,setFilm]=useState<FlyoverState>({status:'idle',time:0,duration:0});
  const [mapState,setMapState]=useState<BasemapState|null>(null);
  const [ready,setReady]=useState(0);
  const onViewReady=useCallback(()=>setReady(value=>value+1),[]);
  const controlRef=useRef<ViewControls|null>(null);
  const busy=['loading','playing','paused','exporting'].includes(film.status);
  const network=local.network;
  const initialized=useRef(false);
  useEffect(()=>{
    if(!network||initialized.current)return;
    initialized.current=true;
    journey.setOpen(true);
    for(const [side,name] of [['start','Village A'],['end','Village C']] as const){const place=network.places.find(p=>p.name===name);if(place)journey.setPoint(side,place.projected,place.id,place.name);}
  },[network]);
  useEffect(()=>{
    if(!journey.picking)return;
    const cancel=(event:KeyboardEvent)=>{if(event.key==='Escape')journey.setPicking(null);};
    document.addEventListener('keydown',cancel);return()=>document.removeEventListener('keydown',cancel);
  },[journey.picking]);
  const households=useMemo(()=>network&&presence?assessHouseholdAccess(network,presence.clusters):[],[network,presence]);
  const input=useMemo(()=>network&&local.context?buildLocalFlyover(network,local.context,journey.route,journey.start,journey.end,photos,households):null,[network,local.context,journey.route,journey.start,journey.end,photos,households]);
  const endpoints=useMemo(()=>[journey.start,journey.end].flatMap((endpoint,index)=>endpoint?[{label:index?'B':'A',point:endpoint.origin,anchor:endpoint.anchor?.point}]:[]),[journey.start,journey.end]);
  const scene=useMemo<MapScene|undefined>(()=>network?{
    datasetVersion:network.source.sha256,communities:network.places.filter(p=>p.kind==='village').map(p=>({id:p.id,name:p.name,commune:'Chế Tạo',prio:3,pop:0,hh:0,desc:['',''],facts:[],projected:p.projected})),
    responseSites:network.places.filter(p=>p.kind==='hlz').map(p=>({id:p.id,name:[p.name,p.name],kind:'hlz',projected:p.projected,assessment:'candidate',observedAt:'',source:[network.source.file,network.source.file]})),
    hazards:[],roads:network.roads,selectedRoute:journey.route,selectedCommunityId:null,selectedObjectId:null,
    layers:{imagery:true,context:true,roads:true,status:true,route:true,communities:true,hlz:true},appearance:{imageryOpacity:1,networkOpacity:.9,labels:'auto',roads:'all',roadPalette:'schematic'}
  }:undefined,[network,journey.route]);
  const fit=useCallback(()=>{
    if(!network||busy)return;
    const points=journey.route?[...journey.route.points,...network.places.filter(p=>p.kind==='village').map(p=>p.projected)]:network.roads.flatMap(road=>road.points);
    controlRef.current?.frameProjected?.(points);
  },[network,journey.route,busy]);
  const latestFit=useRef(fit);latestFit.current=fit;
  useEffect(()=>{if(ready&&runtime.models.length)latestFit.current();},[ready,journey.route?.id,runtime.models.length]);
  const area=local.context?.areas.find(area=>area.id===selectedArea&&area.kind==='landslide');
  const selectArea=(id:string)=>{setSelectedArea(id);};
  const choose=(side:'start'|'end',id:string)=>{
    if(id==='pick'){journey.setPicking(side);return;}
    const place=network?.places.find(p=>p.id===id);
    if(place)journey.setPoint(side,place.projected,place.id,place.name);else journey.clear(side);
  };
  const close=()=>{const url=new URL(location.href);url.searchParams.delete('workspace');url.searchParams.delete('area');location.assign(url.href);};
  const failed=local.error||runtime.startupError||unavailable;
  // The film reports its clock ten times a second: keep that re-render cheap.
  const stops=useMemo(()=>journey.route&&local.context?localRouteStops(journey.route,local.context.areas):[],[journey.route,local.context]);
  return <main className="route-film-workspace">
    <header className="route-film-header"><button className="icon-button" aria-label={t('Về điều phối','Back to coordination')} onClick={close}><UiIcon name="back"/></button><div><strong>Chế Tạo</strong><span>{t('Mạng đường và hành trình 3D','Road network and 3D journey')}</span></div><select aria-label={t('Ngôn ngữ','Language')} value={locale} disabled={busy} onChange={e=>onChangeLocale(e.target.value as Locale)}><option value="en">English</option><option value="vi">Tiếng Việt</option></select></header>
    <div className="route-film-layout">
      <aside className="route-film-panel" aria-label={t('Hành trình A–B','A–B journey')}>
        <h1>{t('Hành trình','Journey')}</h1>
        <fieldset disabled={busy||!network}>
          {(['start','end'] as const).map((side,index)=><div className="route-film-stop" key={side}><b>{index?'B':'A'}</b><select aria-label={index?t('Điểm đến','Destination'):t('Điểm đi','Origin')} value={journey[side]?.source??''} onChange={e=>choose(side,e.target.value)}><option value="">{t('Chọn điểm','Choose a place')}</option>{journey[side]?.source==='map'&&<option value="map">{t('Điểm trên bản đồ','Map point')}</option>}<option value="pick">{t('Chọn trên bản đồ','Pick on map')}</option>{network?.places.map(place=><option key={place.id} value={place.id}>{place.name}</option>)}</select><button className="icon-button" aria-label={`${t('Chọn trên bản đồ','Pick on map')} ${index?'B':'A'}`} aria-pressed={journey.picking===side} onClick={()=>journey.setPicking(journey.picking===side?null:side)}><UiIcon name="location"/></button></div>)}
          <button className="text-button" onClick={journey.swap}><UiIcon name="swap" size={16}/>{t('Đổi A / B','Swap A / B')}</button>
          <label className="route-film-avoid"><input type="checkbox" checked={journey.avoidBlocked} onChange={e=>journey.setAvoidBlocked(e.target.checked)}/>{t('Tránh đường bị chặn','Avoid blocked roads')}</label>
        </fieldset>
        {journey.picking&&<p role="status">{t('Chọn điểm trên địa hình','Choose a point on the terrain')} {journey.picking==='start'?'A':'B'}. <button className="text-button" onClick={()=>journey.setPicking(null)}>{t('Hủy','Cancel')}</button></p>}
        {journey.route?<div className="route-film-result" aria-live="polite"><strong>{journey.route.lengthKm.toLocaleString(locale==='vi'?'vi-VN':'en-GB',{maximumFractionDigits:2})} km</strong><span>{roadConditionMessage(journey.route,locale,true)}</span><small>{t('Điểm cách đường, chưa xác minh:','Offsets to road, unverified:')} A {Math.round(journey.start?.anchor?.distance??0)} m, B {Math.round(journey.end?.anchor?.distance??0)} m</small></div>:network&&<p role="status">{journey.kind==='incomplete'?t('Chọn hai điểm để tìm tuyến.','Choose two points to find a route.'):journey.kind==='endpoint-unavailable'?t('Điểm cách đường quá 250 m.','A point is more than 250 m from the roads.'):t('Không có tuyến nối theo lựa chọn hiện tại.','No connected route under the current selection.')}</p>}
        <div className="route-film-fit"><button className="button" disabled={busy||!journey.route} onClick={fit}>{t('Xem tuyến','Fit route')}</button><button className="button" disabled={busy||!input} onClick={()=>controlRef.current?.frameProjected?.(input?.overviewPoints??[])}>{t('Toàn mạng đường','Whole network')}</button></div>
        {stops.length>0&&<div className="route-film-stops"><h2>{t('Điểm trong phim','Film stops')}</h2>{stops.map(({area},index)=><button key={area.id} aria-pressed={selectedArea===area.id} onClick={()=>selectArea(area.id)} disabled={busy}><span>{index+1}</span>{area.name[locale==='vi'?0:1].replace(/ \([^)]*\)$/,'')}</button>)}<small>{t('Ảnh tham chiếu · Chế Tạo.','Reference photos · Chế Tạo.')}</small></div>}
        <details className="route-film-source"><summary>{t('Nguồn','Source')}</summary><p>{t('Mạng đường Chế Tạo · KML','Chế Tạo road network · KML')}</p></details>
      </aside>
      <section className="map-area route-film-map" aria-label={t('Bản đồ 3D Chế Tạo','Chế Tạo 3D map')}>
        <div className="map-canvas">
          <Map3DBoundary key={viewerAttempt} onUnavailable={onUnavailable}><Suspense fallback={null}><TerrainViewer routeEndpoints={endpoints} models={runtime.models} geographicPlacements={runtime.placements} locale={locale} theme={theme} mapMode="3d" surfaceLayers={scene?.layers} scenarioProps={scene} contextGeometry={local.context} selectedContextAreaId={selectedArea} onSelectContextArea={selectArea} viewControlRef={controlRef} onViewReady={onViewReady} onUnavailable={onUnavailable} onBasemapState={setMapState} flyover={input} onFlyoverState={setFilm} measureMode={!!journey.picking} onPick={point=>{if(journey.picking)journey.setPoint(journey.picking,point.projected);}} onSelectOverlayHit={hit=>{const place=network?.places.find(p=>p.id===hit.id);if(place&&journey.picking)journey.setPoint(journey.picking,place.projected,place.id,place.name);}}/></Suspense></Map3DBoundary>
        </div>
        {(!network||!runtime.models.length||failed)&&<div className="route-film-loading" role={failed?'alert':'status'}>{failed?t('Không mở được bản đồ 3D.','The 3D map could not open.'):t('Đang mở địa hình 3D','Opening 3D terrain')}{failed&&<button className="button" onClick={()=>{setUnavailable(false);setViewerAttempt(v=>v+1);local.retry();runtime.reload();}}>{t('Thử lại','Retry')}</button>}{!failed&&runtime.progress3D!==null&&<progress value={runtime.progress3D} max={1}/>}</div>}
        <div className="route-film-legend" aria-label={t('Chú giải','Legend')}><span><i className="open"/>{t('Thông','Open')}</span><span><i className="difficult"/>{difficultRoadLabel(locale)}</span><span><i className="blocked"/>{t('Bị chặn','Blocked')}</span><span><i className="area"/>{t('Vùng sạt','Landslide')}</span></div>
        <div className="route-film-zoom"><button className="icon-button" disabled={busy} aria-label={t('Phóng to','Zoom in')} onClick={()=>controlRef.current?.zoomIn()}><UiIcon name="zoomIn"/></button><button className="icon-button" disabled={busy} aria-label={t('Thu nhỏ','Zoom out')} onClick={()=>controlRef.current?.zoomOut()}><UiIcon name="zoomOut"/></button></div>
        {area&&!busy&&<LocalAreaCard area={area} photos={photos} locale={locale} onClose={()=>setSelectedArea(null)}/>}
        {input&&<FlyoverBar layout="journey" disabled={!runtime.models.length||failed} locale={locale} state={film} title={locale==='vi'?`Từ ${journey.start?.label??'A'} đến ${journey.end?.label??'B'}`:`${journey.start?.label??'A'} to ${journey.end?.label??'B'}`} fileName="DEAR-Che-Tao-A-B-3D.mp4" mapMode="3d" onRequest3D={()=>undefined} controlRef={controlRef}/>}
        {mapState?.status==='error'&&<button className="route-film-map-retry" onClick={()=>controlRef.current?.retryBasemap()}>{t('Tải lại ảnh nền','Retry map imagery')}</button>}
      </section>
    </div>
  </main>;
}
