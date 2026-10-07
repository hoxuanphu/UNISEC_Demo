import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { projectedToWgs84, sceneToProjected } from '../../terrain/coordinate';
import { createScreenMarkers } from '../../terrain/screenMarkers';
import { addRoadLayers } from './addRoadLayers';
import { mapLayerOrder, mapPane, type MapPane } from './mapLayerOrder';
import type { TerrainData } from '../../types/terrain';
import type { MapDisplayProps } from './mapContracts';
import { createRaster2d, type Raster2D } from './raster2d';
import { MapOverview } from './MapOverview';
import { MapMeasurement } from '../measurement/MapMeasurement';
import { measurementGeometry } from '../measurement/measurementGeometry';
import type { MeasureAction, MeasurementSession } from '../measurement/measurementSession';
import { showRoad, defaultLayerAppearance } from './layerAppearance';
import { readMapLocation, type MapLocation } from './mapLocation';

type Props = MapDisplayProps & {
  terrain: TerrainData | null; imageUrl?: string; viewportRef: React.MutableRefObject<{ center: [number, number]; zoom: number } | null>;
  profileOpen: boolean;
  profilePoints?: Array<{ x: number; y: number }>;
  locationOpen: boolean; locationPoint: MapLocation | null; onLocation: (point: MapLocation) => void;
  measurementOpen: boolean; onCloseMeasurement: () => void;
  measureSession: MeasurementSession; dispatchMeasureSession: Dispatch<MeasureAction>;
};

export function Map2D(props: Props): JSX.Element {
  const interacting = props.measurementOpen && (!props.measureSession.finished || props.measureSession.editing);
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
    const north = document.createElement('div'); north.className = 'map-reference map-north'; north.title = 'North';
    north.innerHTML = '<span>N</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 5 17-5-4-5 4Z" fill="currentColor"/></svg>'; host.appendChild(north);
    let markers: ReturnType<typeof createScreenMarkers> | null = null;
    let overlay: L.LayerGroup | null = null, tileLayer: L.TileLayer | null = null, raster: L.ImageOverlay | null = null;
    let rasterAbort: AbortController | null = null, rasterKey = '', tileKey = '', frame = 0, disposed = false;
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
      const center = map.getCenter(); propsRef.current.viewportRef.current = { center: [center.lat, center.lng], zoom: map.getZoom() };
    };
    const schedule = () => { if (!frame && !disposed) frame = requestAnimationFrame(updateLayout); };
    const fit = () => {
      const scenario = propsRef.current.scenarioProps;
      const points = [...(scenario?.communities.map(c => c.projected) ?? []), ...(scenario?.roads.flatMap(r => r.points) ?? []), ...(scenario?.aoi?.points ?? [])].map(ll).filter((p): p is L.LatLng => p !== null);
      if (points.length) map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [45, 70], paddingBottomRight: [65, 120], animate: false });
    };
    const setTiles = (imagery: boolean, enabled: boolean) => {
      const key = `${imagery}:${enabled}`;
      if (tileKey === key) return;
      tileKey = key; tileLayer?.remove(); tileLayer = null;
      const style = imagery ? 'satellite' : 'terrain';
      const publish = (status: 'off' | 'loading' | 'ready' | 'partial' | 'error', loaded = 0, total = 0) => propsRef.current.onBasemapState?.({ status, style, loaded, total });
      if (!enabled) { publish('off'); return; }
      let loaded = 0, failed = 0, total = 0;
      const layer = imagery ? 's2cloudless_3857' : 'terrain-light_3857';
      const tiles = L.tileLayer(`https://tiles.maps.eox.at/wmts/1.0.0/${layer}/default/g/{z}/{y}/{x}.jpg`, { maxNativeZoom: 14, maxZoom: 19, keepBuffer: 1, updateWhenIdle: true, noWrap: true });
      tileLayer = tiles;
      tiles.on('loading', () => { loaded = 0; failed = 0; total = 0; publish('loading'); });
      tiles.on('tileloadstart', () => total++);
      tiles.on('tileload', () => { loaded++; publish(failed ? 'partial' : 'loading', loaded, total); });
      tiles.on('tileerror', () => { failed++; publish(loaded ? 'partial' : 'error', loaded, total); });
      tiles.on('load', () => { publish(failed ? (loaded ? 'partial' : 'error') : 'ready', loaded, total); schedule(); });
      tiles.addTo(map);
    };
    const refresh = () => {
      const { terrain, scenarioProps: scenario, locale = 'vi', onSelectOverlayHit } = propsRef.current;
      const layers = scenario?.layers ?? { imagery: true, context: false, hillshade: true };
      const appearance = scenario?.appearance ?? defaultLayerAppearance;
      north.title = locale === 'vi' ? 'Bắc địa lý' : 'True north'; north.setAttribute('aria-label', north.title);
      setTiles(layers.imagery !== false, layers.context !== false);
      if (terrain && !hasFit && scenario) { fit(); hasFit = true; }
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
          raster?.remove(); raster = L.imageOverlay(result.url, result.bounds, { opacity: propsRef.current.scenarioProps?.appearance?.imageryOpacity ?? 1, interactive: false, pane: mapPane('imagery'), alt: locale === 'vi' ? 'Ảnh nền khu vực Chế Tạo' : 'Chế Tạo area imagery' }).addTo(map);
          setOverviewRaster(result);
          schedule();
        }).catch(error => { if (!signal.aborted) console.warn('Local 2D raster unavailable', error); });
      }
      raster?.setOpacity(appearance.imageryOpacity);
      markers?.dispose(); overlay?.remove(); markers = null; overlay = L.layerGroup().addTo(map);
      if (scenario && terrain) {
        markers = createScreenMarkers(host, { ...scenario, locale,
          interactive: !propsRef.current.locationOpen && !(propsRef.current.measurementOpen && (!propsRef.current.measureSession.finished || propsRef.current.measureSession.editing)),
          allowCounts: () => map.getZoom() < 14,
          onExpandGroup: points => {
            const positions = points.map(ll).filter((point): point is L.LatLng => point !== null);
            if (positions.length) map.fitBounds(L.latLngBounds(positions), { paddingTopLeft: [55, 80], paddingBottomRight: [75, 100], maxZoom: 17 });
          },
          onSelect: hit => propsRef.current.onSelectOverlayHit?.(hit) });
        if (scenario.aoi && layers.aoi) {
          const points = scenario.aoi.points.map(ll).filter((p): p is L.LatLng => p !== null);
          const selected = scenario.selectedObjectId === `aoi:${scenario.aoi.id}`;
          L.polygon(points, { pane: mapPane('boundary'), fill: false, color: selected ? '#167b66' : '#85aa9d', weight: selected ? 2 : 1.5,
            dashArray: '6 5', opacity: selected ? 0.9 : 0.6, bubblingMouseEvents: false })
            .on('click', () => onSelectOverlayHit?.({ type: 'aoi', id: scenario.aoi!.id })).addTo(overlay!);
        }
        scenario.roads.forEach(road => {
          const routeSelected = layers.route && scenario.selectedRoute?.segs.some(s => s.id === road.id);
          const inspected = scenario.selectedObjectId === `road:${road.id}`;
          const selected = routeSelected || inspected;
          if (!layers.roads && !routeSelected) return;
          if (!showRoad(road.status, Boolean(selected), appearance.roads)) return;
          const points = road.points.map(ll).filter((p): p is L.LatLng => p !== null);
          const warning = layers.status && road.status !== 'open';
          addRoadLayers({ road, points, layer: overlay!, selected: Boolean(routeSelected), inspected, warning: Boolean(warning),
            imagery: Boolean(layers.imagery), networkOpacity: appearance.networkOpacity,
            onSelect: () => onSelectOverlayHit?.({ type: 'road', id: road.id }) });
        });
        const selection = scenario.selectedObjectId ?? (scenario.selectedCommunityId ? `community:${scenario.selectedCommunityId}` : '');
        if (selection && selection !== lastSelection) {
          const [kind, id] = selection.split(':');
          const road = scenario.roads.find(item => item.id === id);
          const position = kind === 'community' ? scenario.communities.find(item => item.id === id)?.projected
            : kind === 'hazard' ? scenario.hazards.find(item => item.id === id)?.projected
            : kind === 'poi' ? scenario.responseSites?.find(item => item.id === id)?.projected
            : road?.points[Math.floor(road.points.length / 2)];
          const point = position ? ll(position) : null;
          if (point) map.panInside(point, { paddingTopLeft: [65, 80], paddingBottomRight: [75, 190], animate: false });
        }
        lastSelection = selection;
      }
      schedule();
    };
    runtime.current = { refresh }; refresh();
    if (props.viewControlRef) props.viewControlRef.current = {
      zoomIn: () => map.zoomIn(0.5), zoomOut: () => map.zoomOut(0.5), resetView: fit,
      focusProjected: point => { const p = ll(point); if (p) map.panTo(p, { animate: true, duration: 0.3 }); },
      retryBasemap: () => { tileKey = ''; refresh(); }
    };
    const resize = new ResizeObserver(() => { map.invalidateSize({ pan: false }); schedule(); }); resize.observe(host);
    const ui = new MutationObserver(schedule);
    if (host.parentElement) ui.observe(host.parentElement, { childList: true, subtree: true });
    const area = host.closest('.map-area'); area?.addEventListener('dear:map-layout', schedule);
    map.on('move zoom resize viewreset', schedule);
    return () => {
      disposed = true; rasterAbort?.abort(); cancelAnimationFrame(frame); resize.disconnect(); ui.disconnect(); markers?.dispose();
      area?.removeEventListener('dear:map-layout', schedule);
      const center = map.getCenter(); propsRef.current.viewportRef.current = { center: [center.lat, center.lng], zoom: map.getZoom() };
      map.remove(); north.remove(); surface.remove(); mapRef.current = null; runtime.current = null; focusLayer.current = null;
      if (props.viewControlRef) props.viewControlRef.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    // Tool interaction must change before paint, independently of marker positioning.
    const markerLayer = hostRef.current?.querySelector<HTMLElement>('.map-marker-layer');
    if (markerLayer) markerLayer.inert = props.locationOpen || interacting;
  }, [props.locationOpen, interacting]);
  useEffect(() => { runtime.current?.refresh(); }, [props.terrain, props.imageUrl, props.locale,
    interacting, props.locationOpen,
    props.scenarioProps?.communities, props.scenarioProps?.responseSites, props.scenarioProps?.hazards, props.scenarioProps?.roads, props.scenarioProps?.aoi,
    props.scenarioProps?.selectedRoute, props.scenarioProps?.selectedCommunityId,
    props.scenarioProps?.selectedObjectId, props.scenarioProps?.layers, props.scenarioProps?.appearance]);
  useLayoutEffect(() => {
    const map = mapRef.current, metadata = props.terrain?.metadata, path = props.profilePoints;
    if (!map || !metadata || !path || !props.profileOpen) return;
    map.invalidateSize({ pan: false });
    const points = path.map(point => projectedToWgs84(metadata, point))
      .filter((p): p is { latitude: number; longitude: number } => p.latitude !== undefined && p.longitude !== undefined)
      .map(p => L.latLng(p.latitude, p.longitude));
    if (points.length) map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [45, 90], paddingBottomRight: [65, 100], maxZoom: 14, animate: false });
  }, [props.profileOpen, props.profilePoints]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    focusLayer.current?.remove(); focusLayer.current = null;
    if (!props.focusPoint || !props.profileMetadata) return;
    const projected = sceneToProjected(props.profileMetadata, props.focusPoint).projected;
    const { latitude, longitude } = projectedToWgs84(props.profileMetadata, projected);
    if (latitude === undefined || longitude === undefined) return;
    map.panInside([latitude, longitude], { paddingTopLeft: [60, 80], paddingBottomRight: [60, 140], animate: false });
    const point = L.circleMarker([latitude, longitude], { pane: mapPane('selection'), radius: 4, color: 'white', weight: 2, fillColor: '#166553', fillOpacity: 1, interactive: false }).addTo(map);
    point.getElement()?.classList.add('map-profile-point-2d'); focusLayer.current = point;
  }, [props.focusPoint, props.profileMetadata]);
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !props.locationOpen) return;
    const pick = (event: L.LeafletMouseEvent) => propsRef.current.onLocation(readMapLocation(event.latlng.lat, event.latlng.lng, propsRef.current.terrain));
    map.on('click', pick);
    const point = props.locationPoint;
    const marker = point ? L.circleMarker([point.latitude, point.longitude], { radius: 5, color: 'white', weight: 2, fillColor: '#166553', fillOpacity: 1, interactive: false }).addTo(map) : null;
    marker?.getElement()?.classList.add('map-location-point');
    return () => { map.off('click', pick); marker?.remove(); };
  }, [mapReady, props.locationOpen, props.locationPoint]);
  return <div className={`terrain-viewer map-2d${interacting ? ' is-measuring' : ''}${props.locationOpen ? ' is-locating' : ''}`} ref={hostRef} aria-label={props.locale === 'en' ? '2D response map' : 'Bản đồ ứng phó 2D'}>
    <MapOverview mapRef={mapRef} raster={overviewRaster} area={overviewArea} locale={props.locale ?? 'vi'}
      enabled={mapReady && !props.measurementOpen && !props.locationOpen && !props.profileOpen}/>
    {mapReady && <MapMeasurement mapRef={mapRef} enabled={props.measurementOpen} locale={props.locale ?? 'vi'} onClose={props.onCloseMeasurement}
      session={props.measureSession} dispatch={props.dispatchMeasureSession} sources={geometry.sources} selected={geometry.selected}/>}
  </div>;
}
