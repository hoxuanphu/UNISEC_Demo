import { hasRoutePlaceSymbol } from './routePlaceSymbol';
import { TrackedDevices2D } from '../tracking/TrackedDevices2D';
import { RouteSimulationLayer } from './RouteSimulationLayer';
import { POINT_ZOOM, SELECTION_MAX_ZOOM } from './selectionScale';
import { drawingLayerRank } from './mapLayerOrder';
import { routeStopSvg } from '../routes/routeStopSymbol';
import { ContextAreas2D } from './ContextAreas2D';
import {addInternetDetail} from './internetDetail';
import { ResidentRouteGuidance } from './ResidentRouteGuidance';
import { ResidentRouteExtras } from './ResidentRouteExtras';
import { hazardLayerVisible } from './visibleMapRecords';
import { keepSymbolsDecluttered } from './symbolDeclutter';
import { IsolatedHouseholds2D } from '../presence/IsolatedHouseholds2D';
import { addResidentRoutePins } from './residentRoutePins';
import { roadProjected } from '../routes/selectedRoadJourney';
import { BasemapToneFilters } from '../imagery/BasemapToneFilters';
import { preparedToneAssetId } from '../imagery/basemapTone';
import { ImageryStatus, type ImageryLoadState } from '../imagery/ImageryStatus';
import { DeviceLocationLayer } from './DeviceLocationLayer';
import { detailInset } from './detailInset';
import { panelFitPadding } from './panelFitPadding';
import { responseOverviewPoints } from './responseOverview';
import type { DeviceLocation } from '../../shared/hooks/useDeviceLocation';
import { removeLeafletMap } from './removeLeafletMap';
import { PIN, teardropPinSvg } from '../../terrain/pinShape';
/** Half the 28 px place symbol: a journey pin on a named place stands on it instead of covering it. */
const PLACE_SYMBOL_CLEARANCE = 14;
import { createTileProgress } from './tileProgress';
import { retryTileErrors } from './tileRetry';
import { basemapTileOptions, terrainTileSource, imagerySource } from './imagerySource';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { projectedToWgs84, sceneToProjected } from '../../terrain/coordinate';
import { createScreenMarkers } from '../../terrain/screenMarkers';
import { addRoadLayers } from './addRoadLayers';
import { routeRoadDisplay } from '../../terrain/routeRoadDisplay';
import { roadCondition, routeStatus } from '../routes/roadConditions';
import { mapLayerOrder, mapPane, type MapPane } from './mapLayerOrder';
import type { TerrainData } from '../../types/terrain';
import type { MapContextRequest, MapDisplayProps, OverlayHit, ViewControls } from './mapContracts';
import { createRaster2d, type Raster2D } from './raster2d';
import { ResponseGisLayer } from '../observations/ResponseGisLayer';
import type { GeometryRecord } from '../../geo/vector/types';
import { MapOverview } from './MapOverview';
import { MapMeasurement, measurementGeometry, type MeasureAction, type MeasurementSession } from '../measurement';
import { DrawPanel, type DrawAction, type DrawSession } from '../drawing';
import { showRoad, defaultLayerAppearance } from './layerAppearance';
import { readMapLocation, type MapLocation } from './mapLocation';
import { createAnalysisOverlay2d } from '../imagery/analysisOverlay2d';

type Props = MapDisplayProps & {
  showOverview?: boolean;
  routeGuidance?: boolean;
  userLocation?: DeviceLocation | null;
  userLocationRequest?: number;
  journeyFitRequest?: number;
  journeyEndpoints?: Array<{latitude:number;longitude:number;label:string;name?:string;source?:string;place?:boolean;road?:{latitude:number;longitude:number}}>;
  onMapContextMenu?: (request: MapContextRequest) => void;
  gisEnabled?: boolean; gisRecords?: GeometryRecord[]; gisSelectedId?:string|null; gisRequest?:{version:number;id:string|null}; onGisSelect?:(id:string)=>void; gisGroupIds?:string[]; onGisGroup?:(ids:string[])=>void;
  terrain: TerrainData | null; imageUrl?: string; viewportRef: React.MutableRefObject<{ center: [number, number]; zoom: number } | null>;
  profileOpen: boolean;
  profilePoints?: Array<{ x: number; y: number }>;
  locationOpen: boolean; locationPoint: MapLocation | null; onLocation: (point: MapLocation) => void;
  measurementOpen: boolean; onCloseMeasurement: () => void;
  measureSession: MeasurementSession; dispatchMeasureSession: Dispatch<MeasureAction>;
  /** Drawing takes every map click while open; saved shapes become GIS records. */
  drawOpen?: boolean; drawSession?: DrawSession; dispatchDrawSession?: Dispatch<DrawAction>;
  onCloseDraw?: () => void; onSaveDrawing?: (record: GeometryRecord) => void;
};

export function Map2D(props: Props): JSX.Element {
  const interacting = (props.measurementOpen && (!props.measureSession.finished || props.measureSession.editing)) || Boolean(props.drawOpen);
  // Landslide pins on the map: road signs at them merge into the pin (see roadConditionSigns).
  const hazardPoints = useMemo(() => {
    const scene = props.scenarioProps;
    return scene ? scene.hazards.filter(hazard => hazardLayerVisible(hazard, scene.layers)).map(hazard => hazard.projected) : [];
  }, [props.scenarioProps?.hazards, props.scenarioProps?.layers]);
  const geometry = useMemo(() => measurementGeometry(props.scenarioProps, props.locale ?? 'vi'), [props.scenarioProps, props.locale]);
  const [mapReady, setMapReady] = useState(false);
  const [overviewRaster, setOverviewRaster] = useState<Raster2D | null>(null);
  const overviewArea = useMemo(() => (props.scenarioProps?.aoi?.points ?? []).flatMap(point => {
    if (!props.terrain) return [];
    const position = projectedToWgs84(props.terrain.metadata, point);
    return position.latitude === undefined || position.longitude === undefined ? [] : [[position.latitude, position.longitude] as [number, number]];
  }), [props.scenarioProps?.aoi, props.terrain]);
  const hostRef = useRef<HTMLDivElement>(null), mapRef = useRef<L.Map | null>(null);
  const propsRef = useRef(props); propsRef.current = props;
  const runtime = useRef<{ refresh: () => void } | null>(null);
  const focusLayer = useRef<L.CircleMarker | null>(null);
  const profileFollowing=useRef(true);
  const [imageryState,setImageryState]=useState<ImageryLoadState>('off');
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    for (const name of Object.keys(mapLayerOrder) as MapPane[]) {
      if (name === 'imagery') continue; // The basemap owns its terrain/imagery transition.
      const pane = mapRef.current.getPane(mapPane(name));
      if (pane) pane.style.zIndex = String(200 + drawingLayerRank(name) * 30);
    }
  }, [mapReady]);
  const analysisRef = useRef<ReturnType<typeof createAnalysisOverlay2d> | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const overlay = createAnalysisOverlay2d(map, mapPane('analysis'), props.locale === 'en' ? 'Analysis imagery' : 'Ảnh phân tích',setImageryState);
    analysisRef.current = overlay;
    return () => { overlay.dispose(); analysisRef.current = null; };
  }, [mapReady]);
  // Every layer's point symbols share one draw order; the lower rank yields on contact.
  useEffect(() => { const host = hostRef.current, map = mapRef.current; return mapReady && host && map ? keepSymbolsDecluttered(host, map) : undefined; }, [mapReady]);
  useEffect(() => { analysisRef.current?.set(props.analysisImagery?.rasters ?? [], props.analysisImagery?.opacity ?? 1); }, [mapReady, props.analysisImagery]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const surface = document.createElement('div'); surface.className = 'map-2d-surface terrain-canvas'; host.appendChild(surface);
    const map = L.map(surface, { zoomControl: false, attributionControl: false, preferCanvas: false, minZoom: 8, maxZoom: 19, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 90 });
    mapRef.current = map;
    for (const name of Object.keys(mapLayerOrder) as MapPane[]) {
      map.createPane(mapPane(name)).style.zIndex = String(200 + mapLayerOrder[name] * 30);
    }
    setMapReady(true);
    const saved = propsRef.current.viewportRef.current;
    map.setView(saved?.center ?? [21.72, 104.03], saved?.zoom ?? 12, { animate: false });
    const scale = L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 100 }).addTo(map);
    scale.getContainer()?.classList.add('map-reference', 'map-scale');
    scale.getContainer()?.setAttribute('aria-label', propsRef.current.locale === 'en' ? 'Map scale' : 'Thước tỷ lệ bản đồ');
    const north = document.createElement('div'); north.className = 'map-reference map-north'; north.title = 'North';
    north.innerHTML = '<span>N</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 5 17-5-4-5 4Z" fill="currentColor"/></svg>'; host.appendChild(north);
    let markers: ReturnType<typeof createScreenMarkers> | null = null;
    let overlay: L.LayerGroup | null = null, tileLayer: L.TileLayer | null = null, raster: L.ImageOverlay | null = null;
    let internetDetail: ReturnType<typeof addInternetDetail> | null = null;
    let onlineImageryReady = false;
    // Under opaque satellite tiles the local raster stays visible beneath them, filling
    // any tile not loaded yet; a faded basemap would show both, so it is hidden then.
    const localOpacity = () => { const opacity = propsRef.current.scenarioProps?.appearance?.imageryOpacity ?? 1; return onlineImageryReady && opacity < 1 ? 0 : opacity; };
    const imageryPane = map.getPane(mapPane('imagery'))!;
    let rasterAbort: AbortController | null = null, rasterKey = '', tileKey = '', frame = 0, disposed = false, basemapGeneration = 0;
    let hasFit = Boolean(saved), localData: TerrainData | null = null;
    let lastSelection = '';
    const ll = (point: { x: number; y: number }) => {
      const metadata = propsRef.current.terrain?.metadata;
      if (!metadata) return null;
      const p = projectedToWgs84(metadata, point);
      return p.latitude === undefined || p.longitude === undefined ? null : L.latLng(p.latitude, p.longitude);
    };
    const project = (point: { x: number; y: number }) => {
      const position = ll(point); return position ? map.latLngToContainerPoint(position) : null;
    };
    const updateLayout = () => {
      frame = 0; markers?.update(project);
      if (!host.clientWidth) return;
      const center = map.getCenter(); propsRef.current.viewportRef.current = { center: [center.lat, center.lng], zoom: map.getZoom() };
    };
    const schedule = () => { if (!frame && !disposed) frame = requestAnimationFrame(updateLayout); };
    const fit = () => {
      const scenario = propsRef.current.scenarioProps;
      const metadata = propsRef.current.terrain?.metadata;
      const points = (scenario && metadata ? responseOverviewPoints(scenario, propsRef.current.gisRecords ?? [], metadata) : []).map(ll).filter((p): p is L.LatLng => p !== null);
      if (points.length) map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [45, 70], paddingBottomRight: [65, 120], animate: false });
    };
    const setTiles = (imagery: boolean, enabled: boolean) => {
      const key = `${imagery}:${enabled}`;
      if (tileKey === key) return;
      const generation = ++basemapGeneration;
      tileKey = key; internetDetail?.dispose(); tileLayer?.remove(); tileLayer = null; onlineImageryReady = false; raster?.setOpacity(localOpacity());
      const style = imagery ? 'satellite' : 'terrain';
      // Satellite tiles draw over the local raster; the terrain basemap stays beneath it.
      imageryPane.style.zIndex = imagery && enabled ? '150' : String(200 + mapLayerOrder.imagery * 30);
      const publish = (status: 'off' | 'loading' | 'ready' | 'partial' | 'error', loaded = 0, total = 0) => {
        if (disposed || generation !== basemapGeneration) return;
        if (status === 'ready') onlineImageryReady = imagery && loaded > 0;
        else if (['off','partial','error'].includes(status)) onlineImageryReady = false;
        raster?.setOpacity(localOpacity());
        propsRef.current.onBasemapState?.({ status, style, loaded, total, provider: 'configured' });
      };
      if (!enabled) { publish('off'); return; }
      const progress = createTileProgress();
      const report = () => { const {status,loaded,total} = progress.snapshot(); publish(status,loaded,total); };
      const tiles = retryTileErrors(L.tileLayer(imagery ? imagerySource.url : terrainTileSource().url, { maxNativeZoom: imagery ? imagerySource.maxNativeZoom : terrainTileSource().maxZoom, maxZoom: 19, noWrap: true, ...basemapTileOptions }));
      tileLayer = tiles;
      tiles.on('loading', () => { progress.reset(); publish('loading'); });
      tiles.on('tileloadstart', event => progress.start(event.tile));
      tiles.on('tileunload', event => { progress.forget(event.tile); report(); });
      tiles.on('tileload', event => { progress.settle(event.tile,true); report(); });
      tiles.on('tileerror', event => { progress.settle(event.tile,false); report(); });
      tiles.on('load', () => { report(); schedule(); });
      tiles.addTo(map);
      if(imagery) internetDetail = addInternetDetail(map);
    };
    const refresh = () => {
      const { terrain, scenarioProps: scenario, locale = 'vi', onSelectOverlayHit } = propsRef.current;
      const layers = scenario?.layers ?? { imagery: true, context: false, hillshade: true };
      const appearance = scenario?.appearance ?? defaultLayerAppearance;
      north.title = locale === 'vi' ? 'Bắc địa lý' : 'True north'; north.setAttribute('aria-label', north.title);
      setTiles(layers.imagery !== false, layers.context !== false);
      tileLayer?.setOpacity(layers.imagery !== false ? appearance.imageryOpacity : 1);
      internetDetail?.setOpacity(appearance.imageryOpacity);
      // A hidden map (the phone layout opens on the panel) has no size yet; it is fitted once shown.
      if (terrain && !hasFit && scenario && host.clientWidth > 0) { fit(); hasFit = true; }
      if (!terrain && localData) {
        rasterAbort?.abort(); raster?.remove(); raster = null;
        localData = null; rasterKey = ''; hasFit = false; lastSelection = '';
        setOverviewRaster(null);
      }
      const nextRasterKey = `${terrain?.metadata.asset_id}:${layers.imagery}:${layers.hillshade}:${propsRef.current.imageUrl}`;
      if (terrain && (terrain !== localData || nextRasterKey !== rasterKey)) {
        localData = terrain; rasterKey = nextRasterKey; rasterAbort?.abort(); rasterAbort = new AbortController();
        const signal = rasterAbort.signal;
        void createRaster2d(terrain, propsRef.current.imageUrl, layers.imagery !== false, Boolean(layers.hillshade), signal).then(result => {
          if (disposed || signal.aborted) return;
          raster?.remove(); raster = L.imageOverlay(result.url, result.bounds, { opacity: localOpacity(), interactive: false, pane: mapPane('imagery'), alt: locale === 'vi' ? 'Ảnh nền khu vực Chế Tạo' : 'Chế Tạo area imagery' }).addTo(map);
          setOverviewRaster(result);
          schedule();
        }).catch(error => { if (!signal.aborted) console.warn('Local 2D raster unavailable', error); });
      }
      raster?.setOpacity(localOpacity());
      const focused = document.activeElement as HTMLElement | null;
      const focusId = focused?.closest('.map-marker-layer')?.parentElement === host ? focused.dataset.mapObject : undefined;
      markers?.dispose(); overlay?.remove(); markers = null; overlay = L.layerGroup().addTo(map);
      if (scenario && terrain) {
        markers = createScreenMarkers(host, { ...scenario, locale, focusId,
          routePlaces: propsRef.current.journeyEndpoints?.map(point => roadProjected(point.latitude,point.longitude)),
          interactive: !propsRef.current.pointPickActive && !propsRef.current.locationOpen && !propsRef.current.drawOpen && !(propsRef.current.measurementOpen && (!propsRef.current.measureSession.finished || propsRef.current.measureSession.editing)),
          presentation: propsRef.current.routeGuidance ? 'places' : 'groups',
          routeStops: propsRef.current.routeGuidance ? propsRef.current.journeyEndpoints?.length
            ? propsRef.current.journeyEndpoints.map(point => roadProjected(point.latitude, point.longitude))
            : scenario.selectedRoute && scenario.selectedRoute.status !== 'blocked'
              ? [scenario.selectedRoute.points[0], scenario.selectedRoute.points.at(-1)!].filter(Boolean) : [] : undefined,
          allowCounts: () => !propsRef.current.routeGuidance && map.getZoom() < 14,
          canExpandGroup: () => map.getZoom() < 18,
          onPreviewFocus:point=>propsRef.current.viewControlRef?.current?.focusProjected(point,detailInset(host)),
          onExpandGroup: points => {
            const positions = points.map(ll).filter((point): point is L.LatLng => point !== null);
            if (positions.length) map.fitBounds(L.latLngBounds(positions), { paddingTopLeft: [55, 80], paddingBottomRight: [75, 100], maxZoom: 18 });
          },
          onSelect: hit => propsRef.current.onSelectOverlayHit?.(hit) });
        if (scenario.aoi && layers.aoi) {
          const points = scenario.aoi.points.map(ll).filter((p): p is L.LatLng => p !== null);
          const selected = scenario.selectedObjectId === `aoi:${scenario.aoi.id}`;
          L.polygon(points, { pane: mapPane('boundary'), fill: false, color: selected ? '#167b66' : '#85aa9d', weight: selected ? 2 : 1.5,
            dashArray: '6 5', opacity: selected ? 0.9 : 0.6, bubblingMouseEvents: false })
            .on('click', () => onSelectOverlayHit?.({ type: 'aoi', id: scenario.aoi!.id })).addTo(overlay!);
        }
        const passable = !scenario.selectedRoute || routeStatus(scenario.selectedRoute) !== 'blocked';
        const contextIds = new Set(scenario.contextRoads?.map(road=>road.id));
        routeRoadDisplay([...scenario.roads,...(scenario.contextRoads??[])], scenario.selectedRoute, Boolean(layers.route && (!propsRef.current.routeGuidance || passable))).forEach(({road, sourceId, routeSelected}) => {
          if (contextIds.has(sourceId) && layers.localRoads===false && !routeSelected) return;
          const inspected = scenario.selectedObjectId === `road:${sourceId}`;
          const selected = routeSelected || inspected;
          if (!layers.roads && !routeSelected) return;
          if (!showRoad(roadCondition(road), Boolean(selected), appearance.roads)) return;
          const points = road.points.map(ll).filter((p): p is L.LatLng => p !== null);
          const warning = layers.status && roadCondition(road) !== 'open';
          addRoadLayers({ road, sourceId, points, layer: overlay!, selected: Boolean(routeSelected), inspected, warning: Boolean(warning), contextZoom:contextIds.has(sourceId)?map.getZoom():undefined,
            imagery: Boolean(layers.imagery), resident: propsRef.current.routeGuidance || contextIds.has(sourceId) && routeSelected,
            networkOpacity: propsRef.current.routeGuidance && scenario.selectedRoute ? .32 : appearance.networkOpacity,
            onSelect: () => onSelectOverlayHit?.({ type: 'road', id: sourceId }) });
        });
        const selection = scenario.selectedObjectId ?? (scenario.selectedCommunityId ? `community:${scenario.selectedCommunityId}` : '');
        if (selection && selection !== lastSelection && !propsRef.current.profileOpen) {
          const [kind, ...parts] = selection.split(':'), id = parts.join(':');
          const road = [...scenario.roads,...(scenario.contextRoads??[])].find(item => item.id === id);
          const position = kind === 'community' ? scenario.communities.find(item => item.id === id)?.projected
            : kind === 'hazard' ? scenario.hazards.find(item => item.id === id)?.projected
            : kind === 'poi' ? scenario.responseSites?.find(item => item.id === id)?.projected
            : road?.points[Math.floor(road.points.length / 2)];
          const point = position ? ll(position) : null;
          if (point) map.panInside(point, { paddingTopLeft: [65, 80], paddingBottomRight: [75, 190], animate: false });
        }
        lastSelection = selection;
      }
      if (frame) cancelAnimationFrame(frame);
      updateLayout();
    };
    runtime.current = { refresh }; refresh();
    map.on('zoomend',refresh);
    const viewApi: ViewControls = {
      zoomIn: () => map.zoomIn(0.5), zoomOut: () => map.zoomOut(0.5), resetView: fit,
      focusProjected: (point, inset) => {
        map.invalidateSize({pan:false});
        const p = ll(point); if (!p) return;
        const zoom = Math.min(map.getMaxZoom(), Math.max(map.getZoom(), POINT_ZOOM));
        // An open detail panel covers the right of the map: centre in what stays visible.
        const right = Math.min(inset?.right ?? profileInset(), Math.max(0, host.clientWidth - 240));
        const target = right ? map.unproject(map.project(p, zoom).add([right / 2, 0]), zoom) : p;
        map.stop(); map.setView(target, zoom, { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches, duration: 0.45 });
      },
      frameProjected: (points, inset) => {
        map.invalidateSize({pan:false});
        const positions = points.map(ll).filter((p): p is L.LatLng => p !== null);
        if (!positions.length) return;
        map.stop();
        const right = Math.min(inset?.right ?? profileInset(), Math.max(0, host.clientWidth - 240));
        const summary = host.closest('.citizen-map')?.querySelector('.citizen-map-summary')?.getBoundingClientRect();
        const bottom = summary ? Math.max(100, host.getBoundingClientRect().bottom - summary.top + 16) : Math.max(100, Math.min(inset?.bottom ?? 0, host.clientHeight - 160));
        map.fitBounds(L.latLngBounds(positions), {paddingTopLeft:summary?[45,70]:[65,90],paddingBottomRight:[right + 65,bottom],maxZoom:Math.max(map.getZoom(),SELECTION_MAX_ZOOM),animate:!window.matchMedia('(prefers-reduced-motion: reduce)').matches,duration:.5});
      },
      retryBasemap: () => { tileKey = ''; refresh(); }
    };
    if (props.viewControlRef) props.viewControlRef.current = viewApi;
    propsRef.current.onViewReady?.();
    const resize = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
      if (!hasFit && host.clientWidth > 0 && propsRef.current.terrain && propsRef.current.scenarioProps) { fit(); hasFit = true; }
      schedule();
    }); resize.observe(host);
    const ui = new MutationObserver(schedule);
    const area = host.closest('.map-area');
    if (area) ui.observe(area, { childList: true, subtree: true });
    area?.addEventListener('dear:map-layout', schedule);
    map.on('move zoom resize viewreset', schedule);
    let adjustingProfile=false;
    const keepProfileFocus=()=>{
      const current=propsRef.current;
      if(adjustingProfile || !profileFollowing.current || !current.profileOpen || !current.focusPoint || !current.profileMetadata)return;
      const p=projectedToWgs84(current.profileMetadata,sceneToProjected(current.profileMetadata,current.focusPoint).projected);
      if(p.latitude===undefined || p.longitude===undefined)return;
      adjustingProfile=true;
      try{map.panInside([p.latitude,p.longitude],{paddingTopLeft:[60,80],paddingBottomRight:[profileInset()+60,80],animate:false});}
      finally{adjustingProfile=false;}
    };
    const releaseProfileFocus=()=>{profileFollowing.current=false;};
    map.on('moveend resize',keepProfileFocus);map.on('dragstart',releaseProfileFocus);
    surface.addEventListener('wheel',releaseProfileFocus,{passive:true});

    const contextMenu = (event: MouseEvent) => {
      const current = propsRef.current;
      if (!current.onMapContextMenu) return;
      event.preventDefault();
      if (current.locationOpen || current.pointPickActive || current.drawOpen || (current.measurementOpen && (!current.measureSession.finished || current.measureSession.editing))) return;
      const target = event.target instanceof Element ? event.target : null;
      const pin = target?.closest<HTMLElement>('.map-pin:not(.is-cluster)');
      const roadId = target?.closest('[data-road-id]')?.getAttribute('data-road-id');
      let hit: OverlayHit | null = null, at = map.mouseEventToLatLng(event);
      if (pin?.dataset.mapObject) {
        const [type, ...rest] = pin.dataset.mapObject.split(':'), id = rest.join(':'), scenario = current.scenarioProps;
        const position = type === 'community' ? scenario?.communities.find(item => item.id === id)?.projected
          : type === 'hazard' ? scenario?.hazards.find(item => item.id === id)?.projected
          : type === 'poi' ? scenario?.responseSites?.find(item => item.id === id)?.projected : undefined;
        hit = { type, id } as OverlayHit; at = (position && ll(position)) || at;
      } else if (roadId) hit = { type: 'road', id: roadId };
      current.onMapContextMenu({ clientX: event.clientX, clientY: event.clientY, latitude: at.lat, longitude: at.lng, hit,
        zoomHere: () => map.setView(at, Math.min(map.getMaxZoom(), Math.max(map.getZoom() + 1.5, hit && hit.type !== 'road' ? 16 : 0)), { animate: true }) });
    };
    host.addEventListener('contextmenu', contextMenu);
    return () => {
      internetDetail?.dispose();
      disposed = true; rasterAbort?.abort(); cancelAnimationFrame(frame); resize.disconnect(); ui.disconnect(); markers?.dispose();
      area?.removeEventListener('dear:map-layout', schedule);
      host.removeEventListener('contextmenu', contextMenu);
      const center = map.getCenter(); propsRef.current.viewportRef.current = { center: [center.lat, center.lng], zoom: map.getZoom() };
      map.off('moveend resize',keepProfileFocus);map.off('dragstart',releaseProfileFocus);surface.removeEventListener('wheel',releaseProfileFocus);
      removeLeafletMap(map); north.remove(); surface.remove(); mapRef.current = null; runtime.current = null; focusLayer.current = null;
      // The 3D layout effect can already have installed its controls before this
      // passive cleanup runs. Only release the controller owned by this map.
      if (props.viewControlRef?.current === viewApi) props.viewControlRef.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    // Tool interaction must change before paint, independently of marker positioning.
    const markerLayer = hostRef.current?.querySelector<HTMLElement>('.map-marker-layer');
    if (markerLayer) markerLayer.inert = !!props.pointPickActive || props.locationOpen || interacting;
  }, [props.locationOpen, props.pointPickActive, interacting]);
  useEffect(() => { runtime.current?.refresh(); }, [props.terrain, props.imageUrl, props.locale,
    interacting, props.locationOpen, props.pointPickActive,
    props.scenarioProps?.communities, props.scenarioProps?.responseSites, props.scenarioProps?.hazards, props.scenarioProps?.roads, props.scenarioProps?.contextRoads, props.scenarioProps?.aoi,
    props.scenarioProps?.selectedRoute, props.scenarioProps?.selectedCommunityId,
    props.scenarioProps?.selectedObjectId, props.scenarioProps?.layers, props.scenarioProps?.appearance, props.journeyEndpoints]);
  const profileInset = () => {
    const host=hostRef.current,detail=host?.closest('.workspace')?.querySelector<HTMLElement>('#response-details');
    if(!host||!detail||getComputedStyle(detail).visibility==='hidden')return 0;
    const mapBox=host.getBoundingClientRect(),box=detail.getBoundingClientRect();
    return box.left>=mapBox.left && box.left<mapBox.right && box.bottom>mapBox.top ? Math.min(mapBox.right-box.left,mapBox.width-240) : 0;
  };
  useLayoutEffect(() => {
    const map = mapRef.current, metadata = props.terrain?.metadata, path = props.profilePoints;
    if (!map || !metadata || !path || !props.profileOpen) return;
    const points = path.map(point => projectedToWgs84(metadata, point))
      .filter((p): p is { latitude: number; longitude: number } => p.latitude !== undefined && p.longitude !== undefined)
      .map(p => L.latLng(p.latitude, p.longitude));
    const fitProfile=()=>{
      map.stop();map.invalidateSize({ pan: false });
      if (points.length) map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [45, 90], paddingBottomRight: [profileInset()+65, 100], maxZoom: 14, animate: false });
      const current=propsRef.current;
      if(current.focusPoint && current.profileMetadata){
        const position=projectedToWgs84(current.profileMetadata,sceneToProjected(current.profileMetadata,current.focusPoint).projected);
        if(position.latitude!==undefined && position.longitude!==undefined)map.panInside([position.latitude,position.longitude],{paddingTopLeft:[60,80],paddingBottomRight:[profileInset()+60,80],animate:false});
      }
    };
    fitProfile();
    // Opening a profile changes map height after React commits. Fit again at that size.
    const resize=new ResizeObserver(fitProfile);if(hostRef.current)resize.observe(hostRef.current);
    return ()=>resize.disconnect();
  }, [props.profileOpen, props.profilePoints,mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    focusLayer.current?.remove(); focusLayer.current = null;
    if (!props.focusPoint || !props.profileMetadata) return;
    profileFollowing.current=true;
    const projected = sceneToProjected(props.profileMetadata, props.focusPoint).projected;
    const { latitude, longitude } = projectedToWgs84(props.profileMetadata, projected);
    if (latitude === undefined || longitude === undefined) return;
    let second=0;
    const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{
      map.stop();map.invalidateSize({pan:false});
      map.panInside([latitude, longitude], { paddingTopLeft: [60, 80], paddingBottomRight: [profileInset()+60, 80], animate: false });
      const point = L.circleMarker([latitude, longitude], { pane: mapPane('selection'), radius: 4, color: 'white', weight: 2, fillColor: '#166553', fillOpacity: 1, interactive: false }).addTo(map);
      point.getElement()?.classList.add('map-profile-point-2d'); focusLayer.current = point;
    });});
    return ()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
  }, [props.focusPoint, props.profileMetadata,props.profileOpen,props.profilePoints,mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !props.locationOpen) return;
    const pick = (event: L.LeafletMouseEvent) => {
      if(event.originalEvent.target instanceof Element && event.originalEvent.target.closest('.analysis-load-status'))return;
      propsRef.current.onLocation(readMapLocation(event.latlng.lat,event.latlng.lng,propsRef.current.terrain));
    };
    map.on('click', pick);
    const point = props.locationPoint;
    const marker = point ? L.circleMarker([point.latitude, point.longitude], { radius: 5, color: 'white', weight: 2, fillColor: '#166553', fillOpacity: 1, interactive: false }).addTo(map) : null;
    marker?.getElement()?.classList.add('map-location-point');
    return () => { map.off('click', pick); marker?.remove(); };
  }, [mapReady, props.locationOpen, props.locationPoint]);
  useEffect(() => {
    const map=mapRef.current;
    if (!map || !props.pointPickActive) return;
    const host=map.getContainer();
    const pick=(event:MouseEvent)=>{
      if (event.target instanceof Element && event.target.closest('.leaflet-control,.map-overview,.leaflet-popup,.map-object-chooser,.field-map-card,.analysis-load-status')) return;
      event.stopImmediatePropagation(); event.preventDefault(); const p=map.mouseEventToLatLng(event); const roadId = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-road-id]')?.dataset.roadId : undefined;
      propsRef.current.onPointPick?.(p.lat,p.lng,roadId); };
    host.addEventListener('click',pick,true);
    return ()=>host.removeEventListener('click',pick,true);
  },[mapReady,props.pointPickActive]);
  useEffect(()=>{
    const map=mapRef.current;if(!map || !props.journeyEndpoints?.length)return;
    const group=L.layerGroup().addTo(map);
    const localJourneyPins = props.journeyEndpoints.every(point=>point.source?.startsWith('local:'));
    const separatePins = props.routeGuidance || localJourneyPins;
    const removeResidentPins = separatePins ? addResidentRoutePins(map, props.journeyEndpoints.map(point => {
      const [type, ...parts] = (point.source ?? '').split(':'), id = parts.join(':');
      const scene = props.scenarioProps;
      return {...point, name: type === 'community' ? scene?.communities.find(place => place.id === id)?.name ?? point.name
        : type === 'site' ? scene?.responseSites?.find(place => place.id === id)?.name[props.locale === 'en' ? 1 : 0] ?? point.name : point.name,
        onSelect: type === 'community' || type === 'site' ? () => propsRef.current.onSelectOverlayHit?.({type: type === 'site' ? 'poi' : 'community', id}) : undefined};
    })) : undefined;
    for(const p of props.journeyEndpoints){
      // Off-network endpoints: dashed access leg to where the route joins the road.
      if(p.road){
        L.polyline([[p.latitude,p.longitude],[p.road.latitude,p.road.longitude]],{pane:mapPane('selection'),color:'#246b9a',weight:2.5,dashArray:'2 6',lineCap:'round',interactive:false}).addTo(group);
        L.circleMarker([p.road.latitude,p.road.longitude],{pane:mapPane('selection'),radius:4,color:'#246b9a',weight:2,fillColor:'#fff',fillOpacity:1,interactive:false}).addTo(group);
      }
      if (separatePins || hasRoutePlaceSymbol(roadProjected(p.latitude,p.longitude),props.scenarioProps)) continue;
      const pin=document.createElement('span');pin.innerHTML=teardropPinSvg();const letter=document.createElement('b');letter.innerHTML=routeStopSvg(p.label==='A');pin.append(letter);
      L.marker([p.latitude,p.longitude],{pane:mapPane('selection'),interactive:false,keyboard:false,icon:L.divIcon({html:pin,className:'journey-map-pin is-'+p.label.toLowerCase(),iconSize:[PIN.width,PIN.height],iconAnchor:[PIN.tipX,PIN.tipY+(p.place?PLACE_SYMBOL_CLEARANCE:0)]}),zIndexOffset:1000}).addTo(group);
    }
    return ()=>{removeResidentPins?.();group.remove();};
  },[mapReady,props.journeyEndpoints,props.routeGuidance,props.scenarioProps?.layers,props.scenarioProps?.communities,props.scenarioProps?.responseSites]);
  useEffect(() => {
    const map=mapRef.current;
    // Resident framing includes alternatives and the sheet inset in its workspace.
    // A second endpoint-only fit here would race it and crop the other routes.
    if (!map || props.routeGuidance || !props.journeyFitRequest || !props.journeyEndpoints?.length) return;
    const host=map.getContainer();
    const panel=(host.closest('.map-area') ?? host.parentElement)?.querySelector('.road-journey-panel');
    const fitJourney=()=>{
      const current=propsRef.current;
      const points=(current.journeyEndpoints ?? []).flatMap(p => [L.latLng(p.latitude,p.longitude), ...(p.road ? [L.latLng(p.road.latitude,p.road.longitude)] : [])]);
      const metadata=current.terrain?.metadata;
      if (metadata) for (const point of current.scenarioProps?.selectedRoute?.points ?? []) {
        const geo=projectedToWgs84(metadata,point);
        if (geo.latitude !== undefined && geo.longitude !== undefined) points.push(L.latLng(geo.latitude,geo.longitude));
      }
      if (!points.length || !host.clientWidth || !host.clientHeight) return;
      const padding=panelFitPadding(host.getBoundingClientRect(),panel?.getBoundingClientRect());
      // Leave space for the full stop labels and the map's lower controls.
      padding.paddingBottomRight[0]+=50;
      padding.paddingBottomRight[1]=Math.max(70,padding.paddingBottomRight[1]);
      map.stop();map.fitBounds(L.latLngBounds(points),{...padding,maxZoom:16,animate:false});
    };
    let frame=requestAnimationFrame(fitJourney);
    const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fitJourney);});
    observer.observe(host);if(panel)observer.observe(panel);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();};
  },[mapReady,props.journeyFitRequest,props.routeGuidance,props.scenarioProps?.selectedRoute]);
  return <div className={`terrain-viewer map-2d${interacting ? ' is-measuring' : ''}${props.locationOpen ? ' is-locating' : ''}`} ref={hostRef} aria-label={props.locale === 'en' ? '2D response map' : 'Bản đồ ứng phó 2D'}>
    <BasemapToneFilters host={hostRef} active={!!props.analysisImagery?.balanceBasemap && props.scenarioProps?.layers.imagery!==false && !imagerySource.custom} prepared={props.terrain?.metadata.asset_id===preparedToneAssetId}/>
    <ImageryStatus state={imageryState} locale={props.locale ?? 'vi'} onRetry={()=>analysisRef.current?.set(props.analysisImagery?.rasters ?? [],props.analysisImagery?.opacity ?? 1)}/>
    {mapReady && <ContextAreas2D map={mapRef.current} geometry={props.contextGeometry} selectedId={props.selectedContextAreaId} onSelect={props.onSelectContextArea} minZoom={props.contextMinZoom} alwaysVisibleIds={props.contextAlwaysVisibleAreaIds} compact={props.routeGuidance} interactive={!props.pointPickActive && !props.measurementOpen && !props.locationOpen && !props.drawOpen}/>}
    {mapReady && <TrackedDevices2D selectedId={props.selectedDeviceId} selfId={props.selfDeviceId} heading={props.selfHeading} onDevice={props.onSelectDevice} map={mapRef.current} feed={props.deviceFeed ?? null} locale={props.locale ?? 'vi'} interactive={!props.pointPickActive&&!props.measurementOpen&&!props.drawOpen&&!props.locationOpen} onRoad={id=>props.onSelectOverlayHit?.({type:'road',id})}/>}
    {mapReady && <RouteSimulationLayer map={mapRef.current} simulation={props.routeSimulation ?? null} locale={props.locale ?? 'vi'}/>}
    {mapReady && <DeviceLocationLayer mapRef={mapRef} location={props.userLocation ?? null} request={props.userLocationRequest ?? 0} locale={props.locale ?? 'vi'}/>}
    {mapReady && !props.pointPickActive && !props.measurementOpen && !props.drawOpen && !props.locationOpen && <ResidentRouteExtras mapRef={mapRef} metadata={props.terrain?.metadata} alternatives={props.alternativeRoutes ?? []}
      alerts={props.routeGuidance ? props.roadAlerts ?? [] : props.scenarioProps?.layers.status && props.scenarioProps.layers.roads
        ? [...props.scenarioProps.roads, ...(props.scenarioProps.layers.localRoads === false ? [] : props.scenarioProps.contextRoads ?? [])] : []}
      comparison={props.comparisonRoute} selected={props.scenarioProps?.selectedRoute} locale={props.locale ?? 'vi'} onChoose={props.onChooseRoute}
      onInspectRoad={props.onInspectRoad ?? (id => props.onSelectOverlayHit?.({type:'road',id}))}
      areaLinks={props.roadAreaLinks ?? props.scenarioProps?.roadAreaLinks} hazardPoints={hazardPoints} showAreaLinks={props.showRoadAreaLinks ?? Boolean(props.scenarioProps?.layers.landslide && props.scenarioProps?.layers.status)}/>}
    {mapReady && !!props.households?.length && <IsolatedHouseholds2D mapRef={mapRef} metadata={props.terrain?.metadata} households={props.households} selectedId={props.selectedHouseholdId} locale={props.locale ?? 'vi'} onSelect={props.onSelectHousehold}/>}
    {mapReady && (props.routeGuidance || !!props.journeyEndpoints?.length && props.journeyEndpoints.every(point=>point.source?.startsWith('local:'))) && <ResidentRouteGuidance mapRef={mapRef} route={props.scenarioProps?.selectedRoute ?? null} metadata={props.terrain?.metadata} endpoints={Boolean(props.journeyEndpoints?.length)}/>}
    {mapReady && props.gisRecords && props.onGisSelect && <ResponseGisLayer compact={props.routeGuidance} pointMode={props.routeGuidance ? 'individual' : undefined} mapRef={mapRef} records={props.gisRecords} roads={props.scenarioProps?.roads} networkVersion={props.scenarioProps?.datasetVersion} selectedId={props.gisSelectedId ?? null} request={props.gisRequest ?? {version:0,id:null}} enabled={props.gisEnabled !== false} interactive={!props.pointPickActive && !props.measurementOpen && !props.locationOpen && !props.drawOpen} locale={props.locale ?? 'vi'} groupIds={props.gisGroupIds} onSelect={props.onGisSelect} onGroup={props.onGisGroup}/>}
    {props.showOverview !== false && <MapOverview mapRef={mapRef} raster={overviewRaster} area={overviewArea} locale={props.locale ?? 'vi'} coverage={props.rescueCoverage}
      enabled={mapReady && !props.measurementOpen && !props.drawOpen && !props.locationOpen && !props.profileOpen}/>}
    {mapReady && <MapMeasurement mapRef={mapRef} enabled={props.measurementOpen} locale={props.locale ?? 'vi'} onClose={props.onCloseMeasurement}
      session={props.measureSession} dispatch={props.dispatchMeasureSession} sources={geometry.sources} selected={geometry.selected}/>}
    {mapReady && props.drawSession && props.dispatchDrawSession && <DrawPanel mapRef={mapRef} enabled={Boolean(props.drawOpen)} locale={props.locale ?? 'vi'}
      session={props.drawSession} dispatch={props.dispatchDrawSession} sources={geometry.sources} records={props.gisRecords ?? []}
      onSave={record => props.onSaveDrawing?.(record)} onClose={() => props.onCloseDraw?.()}/>}
  </div>;
}
