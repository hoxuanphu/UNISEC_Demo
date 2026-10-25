import { useFloatingPanel } from '../../shared/hooks/useFloatingPanel';
import { localMapSource } from './localMapSource';
import { useEffect, useRef, useState, useSyncExternalStore, type MutableRefObject } from 'react';
import * as L from 'leaflet';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { createRaster2d, type Raster2D } from './raster2d';
import type { TerrainData } from '../../types/terrain';
import type { ViewControls, RescueCoverage } from './mapContracts';
import { addCoverageFog } from './coverageFog';
import { defaultCoverageLayers, unreachedNeeds, type CoverageLayers } from '../presence/rescueCoverage';
import { roadProjected, roadGeographic } from '../routes/selectedRoadJourney';
import './map-overview.css';

type Props = {
  mapRef?: MutableRefObject<L.Map | null>;
  raster?: Raster2D | null;
  terrain?: TerrainData;
  imageUrl?: string;
  onNavigate?: (point: { x: number; y: number }) => void;
  viewControlRef?: MutableRefObject<ViewControls | null>;
  viewVersion?: number;
  enabled: boolean;
  locale: Locale;
  area?: Array<[number, number]>;
  /** Rescue coverage: the overview then frames the commune and shows the fog of war. */
  coverage?: RescueCoverage;
};

const emptyArea: Array<[number, number]> = [];
const noSubscription = () => () => undefined;
const latLng = (point: { x: number; y: number }) => { const g = roadGeographic(point); return L.latLng(g.latitude, g.longitude); };

/** Local overview: reuses the raster and tracks the actual 2D map bounds. With rescue coverage it
 * also shows where teams have been and who still waits, each as a layer that can be switched. */
export function MapOverview({ mapRef, raster: providedRaster, terrain, imageUrl, onNavigate, viewControlRef, viewVersion, enabled, locale, area = emptyArea, coverage }: Props): JSX.Element | null {
  const [expanded, setExpanded] = useState(() => Boolean(coverage) && window.matchMedia('(min-width: 1100px) and (min-height: 650px)').matches);
  const [generatedRaster, setGeneratedRaster] = useState<Raster2D | null>(null);
  const [rasterError, setRasterError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const generatedSource = useRef<{ terrain: TerrainData; imageUrl?: string } | null>(null);
  const raster = providedRaster ?? generatedRaster;
  const navigateRef = useRef(onNavigate); navigateRef.current = onNavigate;
  // The 3D workspace loads the same local overview raster only on opening.
  useEffect(() => {
    if (providedRaster || !terrain || !enabled || !expanded || (generatedSource.current?.terrain === terrain && generatedSource.current.imageUrl === imageUrl)) return;
    setGeneratedRaster(null);
    const controller = new AbortController();
    setRasterError(false);
    void createRaster2d(terrain, imageUrl, true, false, controller.signal).then(value => {
      if (!controller.signal.aborted) { generatedSource.current = { terrain, imageUrl }; setGeneratedRaster(value); }
    }).catch(() => { if (!controller.signal.aborted) setRasterError(true); });
    return () => controller.abort();
  }, [providedRaster, terrain, imageUrl, enabled, expanded, attempt]);
  const [large, setLarge] = useState(false);
  const [layers, setLayers] = useState<CoverageLayers>(defaultCoverageLayers);
  const shownLayers = coverage?.layers ?? layers;
  const layersRef = useRef(shownLayers); layersRef.current = shownLayers;
  const fogRef = useRef<{ draw: () => void } | null>(null);
  const root = useRef<HTMLElement>(null), host = useRef<HTMLDivElement>(null);
  const floating=useFloatingPanel(root,'overview-map',enabled,'fit');
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const waiting = useSyncExternalStore(coverage?.subscribe ?? noSubscription, () => coverage ? unreachedNeeds(coverage.spots()) : 0);
  useEffect(() => { fogRef.current?.draw(); }, [shownLayers]);
  useEffect(() => {
    const main = mapRef?.current, surface = host.current, container = root.current;
    if (!enabled || !expanded || !raster || (!main && !navigateRef.current) || !surface || !container) return;
    let disposed = false;
    const overview = L.map(surface, {
      zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false,
      doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false,
      zoomSnap: 0, fadeAnimation: false, zoomAnimation: false
    });
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    const local=localMapSource();
    if(local)L.tileLayer(local.imagery.url,{maxNativeZoom:local.imagery.maxZoom,maxZoom:18,noWrap:true,bounds:L.latLngBounds([local.bounds[1],local.bounds[0]],[local.bounds[3],local.bounds[2]]),errorTileUrl:'/offline-map/blank.webp'}).addTo(overview);
    L.imageOverlay(raster.url, raster.bounds, { interactive: false }).addTo(overview);
    if (area.length) L.polygon(area, { fill: false, color: '#e7f0f8', weight: 1, dashArray: '3 3', interactive: false }).addTo(overview);
    const extent = main ? L.rectangle(main.getBounds(), {
      className: 'overview-extent', color: '#ffffff', weight: 1.5,
      fillColor: '#197663', fillOpacity: .16, interactive: false
    }).addTo(overview) : null;
    const viewApi = viewControlRef?.current;
    const footprint = !main && viewApi?.getVisibleArea ? L.polygon([], { className: 'overview-extent', color: '#fff', weight: 2, fillColor: '#70b5e4', fillOpacity: .10, interactive: false }).addTo(overview) : null;
    const selection = L.circleMarker([0,0], { className: 'overview-selected', radius: 9, color: '#fff', weight: 3, fillColor: '#2181cc', fillOpacity: .25, interactive: false });
    const context = coverage?.focus.length ? L.latLngBounds(coverage.focus.map(latLng)).pad(.12) : L.latLngBounds(raster.bounds).extend(area);
    const fog = coverage ? addCoverageFog(overview, latLng, coverage.spots, () => layersRef.current, coverage.rescued) : null;
    fogRef.current = fog;
    let fogFrame = 0;
    const unsubscribe = coverage?.subscribe(() => { if (!fogFrame) fogFrame = requestAnimationFrame(() => { fogFrame = 0; fog?.draw(); update(); }); }) ?? (() => undefined);
    const fit = () => {
      if (disposed) return;
      if (!surface.clientWidth || !surface.clientHeight) return;
      overview.invalidateSize({ pan: false });
      overview.fitBounds(context, { padding: [8, 8], animate: false });
      lastFootprint=undefined; schedule();
    };
    let lastFootprint:ReadonlyArray<{x:number;y:number}>|undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (disposed || typeof overview.getZoom() !== 'number' || !overview.getPane('overlayPane')) return;
      if (main) extent?.setBounds(main.getBounds());
      const visible=viewApi?.getVisibleArea?.();
      if (footprint && visible!==lastFootprint) {
        const bounds=overview.getPixelBounds(),inset=new L.Bounds(bounds.min!.add([3,3]),bounds.max!.subtract([3,3]));
        const clipped=L.PolyUtil.clipPolygon((visible??[]).map(point=>overview.project(latLng(point))),inset);
        footprint.setLatLngs(clipped.map(point=>overview.unproject(point)));lastFootprint=visible;
      }
      const selected = coverage?.selected?.();
      if (selected) { selection.setLatLng(latLng(selected.point)); if (!overview.hasLayer(selection)) selection.addTo(overview); selection.bringToFront();selection.getElement()?.setAttribute('aria-label',selected.label); }
      else selection.remove();
      // The view frame stays legible above the coverage mask.
      overview.getPane('overlayPane')!.style.zIndex = '460';
    };
    const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(update); };
    let center = context.getCenter();
    const pan = (at: L.LatLng) => { center = at; if (main) main.panTo(at, { animate: false }); else navigateRef.current?.(roadProjected(at.lat, at.lng)); };
    const navigate = (event: L.LeafletMouseEvent) => pan(event.latlng);
    const keyboard = (event: KeyboardEvent) => {
      const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); pan(context.getCenter());
      } else if (delta) {
        event.preventDefault();
        const at = main?.getCenter() ?? center, view = main?.getBounds() ?? context;
        pan(L.latLng(at.lat + delta[1] * (view.getNorth() - view.getSouth()) * .2,
          at.lng + delta[0] * (view.getEast() - view.getWest()) * .2));
      }
    };
    surface.addEventListener('keydown', keyboard);
    main?.on('move zoom resize', schedule);
    const stopView = viewApi?.subscribeView?.(schedule);
    overview.on('click', navigate);
    const resize = new ResizeObserver(fit); resize.observe(surface);
    fit(); update();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame); cancelAnimationFrame(fogFrame); unsubscribe(); stopView?.(); fog?.dispose(); fogRef.current = null; resize.disconnect();
      surface.removeEventListener('keydown', keyboard);
      main?.off('move zoom resize', schedule); overview.off('click', navigate);
      L.DomEvent.off(container);
      overview.remove();
    };
  }, [enabled, expanded, mapRef, raster, area, coverage, viewControlRef, viewVersion]);
  if (!enabled || (!raster && !terrain)) return null;
  const chips: Array<[keyof CoverageLayers, string]> = [
    ['fog', t('Đội chưa tới', 'Not reached')], ['need', t('Cần cứu', 'Needs rescue')], ['unverified', t('Chưa rõ', 'Unverified')], ['team', t('Đội cứu hộ', 'Rescue teams')], ['rescued', t('Đã cứu', 'Rescued')]];
  return <section ref={root} className="map-overview" data-expanded={expanded} data-coverage={!!coverage || undefined} data-large={large || undefined} aria-label={t('Bản đồ tổng quan', 'Overview map')}>
    <div className="overview-head floating-panel-handle" {...floating} tabIndex={0} role="group" aria-label={t('Vị trí bản đồ tổng quan','Overview position')}>
      <span className="overview-title"><UiIcon name="area" size={15}/>{t('Tổng quan','Overview')}</span>
      <button className="overview-toggle" aria-expanded={expanded} aria-controls="overview-map-surface"
        aria-label={expanded ? t('Thu gọn bản đồ tổng quan', 'Hide overview map') : t('Mở bản đồ tổng quan', 'Show overview map')}
        onClick={() => setExpanded(value => !value)}>
        <UiIcon name={expanded ? 'collapse' : 'expand'} size={14}/>
      </button>
      {expanded && coverage && <button className="icon-button overview-size" aria-pressed={large} aria-label={large ? t('Thu nhỏ', 'Smaller') : t('Phóng to', 'Larger')} title={large ? t('Thu nhỏ', 'Smaller') : t('Phóng to', 'Larger')}
        onClick={() => setLarge(value => !value)}><svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={large ? "M3 8h5V3M17 12h-5v5M8 8 2 2m10 10 6 6" : "M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6"}/></svg></button>}

    </div>
    {expanded && <div ref={host} id="overview-map-surface" className="map-overview-surface" tabIndex={0} role="group"
      aria-label={t('Định hướng bản đồ chính', 'Navigate the main map')}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter"
      title={t('Chọn vị trí trên bản đồ', 'Choose a map location')}>
      {!raster && <p className="overview-loading" role="status">{rasterError ? <button className="text-button" onClick={() => setAttempt(value => value + 1)}>{t('Thử lại', 'Retry')}</button> : t('Đang tải bản đồ…', 'Loading map…')}</p>}
    </div>}
    {expanded && coverage && <div className="overview-coverage">
      <p className="overview-meaning"><i aria-hidden="true"/>{t('Đội đã tiếp cận', 'Team coverage')}</p>
      <p className={waiting ? 'is-alert' : undefined}>{waiting ? t(`${waiting} điểm chờ tiếp cận`, `${waiting} awaiting access`) : t('Đã tiếp cận các điểm cầu cứu', 'All requests reached')}</p>
      {coverage.onOpenLayers ? <div className="overview-key" aria-label={t('Chú giải cứu hộ', 'Rescue legend')}>
        {chips.filter(([key]) => shownLayers[key]).map(([key,label]) => <span data-layer={key} key={key}><i aria-hidden="true"/>{label}</span>)}
      </div> :       <fieldset aria-label={t('Lớp vùng cứu hộ', 'Coverage layers')}>
        {chips.map(([key, label]) => <label key={key} data-layer={key}><input type="checkbox" checked={shownLayers[key]} onChange={() => setLayers(value => ({ ...value, [key]: !value[key] }))}/><i aria-hidden="true"/>{label}</label>)}
      </fieldset>}
    </div>}
  </section>;
}
