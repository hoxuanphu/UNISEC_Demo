import { useEffect, useRef, useState, useSyncExternalStore, type MutableRefObject } from 'react';
import * as L from 'leaflet';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import type { Raster2D } from './raster2d';
import type { RescueCoverage } from './mapContracts';
import { addCoverageFog } from './coverageFog';
import { defaultCoverageLayers, unreachedNeeds, type CoverageLayers } from '../presence/rescueCoverage';
import { roadGeographic } from '../routes/selectedRoadJourney';
import './map-overview.css';

type Props = {
  mapRef: MutableRefObject<L.Map | null>;
  raster: Raster2D | null;
  enabled: boolean;
  locale: Locale;
  area: Array<[number, number]>;
  /** Rescue coverage: the overview then frames the commune and shows the fog of war. */
  coverage?: RescueCoverage;
};

const noSubscription = () => () => undefined;
const latLng = (point: { x: number; y: number }) => { const g = roadGeographic(point); return L.latLng(g.latitude, g.longitude); };

/** Local overview: reuses the raster and tracks the actual 2D map bounds. With rescue coverage it
 * also shows where teams have been and who still waits, each as a layer that can be switched. */
export function MapOverview({ mapRef, raster, enabled, locale, area, coverage }: Props): JSX.Element | null {
  const [expanded, setExpanded] = useState(false);
  const [large, setLarge] = useState(false);
  const [layers, setLayers] = useState<CoverageLayers>(defaultCoverageLayers);
  const layersRef = useRef(layers); layersRef.current = layers;
  const fogRef = useRef<{ draw: () => void } | null>(null);
  const root = useRef<HTMLElement>(null), host = useRef<HTMLDivElement>(null);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const waiting = useSyncExternalStore(coverage?.subscribe ?? noSubscription, () => coverage ? unreachedNeeds(coverage.spots()) : 0);
  useEffect(() => { fogRef.current?.draw(); }, [layers]);
  useEffect(() => {
    const main = mapRef.current, surface = host.current, container = root.current;
    if (!enabled || !expanded || !raster || !main || !surface || !container) return;
    const overview = L.map(surface, {
      zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false,
      doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false,
      zoomSnap: 0, fadeAnimation: false, zoomAnimation: false
    });
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    L.imageOverlay(raster.url, raster.bounds, { interactive: false }).addTo(overview);
    if (area.length) L.polygon(area, { fill: false, color: '#e7f0f8', weight: 1, dashArray: '3 3', interactive: false }).addTo(overview);
    const extent = L.rectangle(main.getBounds(), {
      className: 'overview-extent', color: '#ffffff', weight: 1.5,
      fillColor: '#197663', fillOpacity: .16, interactive: false
    }).addTo(overview);
    const context = coverage?.focus.length ? L.latLngBounds(coverage.focus.map(latLng)).pad(.12) : L.latLngBounds(raster.bounds).extend(area);
    const fog = coverage ? addCoverageFog(overview, latLng, coverage.spots, () => layersRef.current, coverage.rescued) : null;
    fogRef.current = fog;
    let fogFrame = 0;
    const unsubscribe = coverage?.subscribe(() => { if (!fogFrame) fogFrame = requestAnimationFrame(() => { fogFrame = 0; fog?.draw(); }); }) ?? (() => undefined);
    const fit = () => {
      if (!surface.clientWidth || !surface.clientHeight) return;
      overview.invalidateSize({ pan: false });
      overview.fitBounds(context, { padding: [8, 8], animate: false });
    };
    let frame = 0;
    const update = () => { frame = 0; extent.setBounds(main.getBounds()); };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const navigate = (event: L.LeafletMouseEvent) => main.panTo(event.latlng, { animate: false });
    const keyboard = (event: KeyboardEvent) => {
      const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); main.panTo(context.getCenter(), { animate: false });
      } else if (delta) {
        event.preventDefault();
        const center = main.getCenter(), view = main.getBounds();
        main.panTo([center.lat + delta[1] * (view.getNorth() - view.getSouth()) * .2,
          center.lng + delta[0] * (view.getEast() - view.getWest()) * .2], { animate: false });
      }
    };
    surface.addEventListener('keydown', keyboard);
    main.on('move zoom resize', schedule);
    overview.on('click', navigate);
    const resize = new ResizeObserver(fit); resize.observe(surface);
    fit(); update();
    return () => {
      cancelAnimationFrame(frame); cancelAnimationFrame(fogFrame); unsubscribe(); fog?.dispose(); fogRef.current = null; resize.disconnect();
      surface.removeEventListener('keydown', keyboard);
      main.off('move zoom resize', schedule); overview.off('click', navigate);
      L.DomEvent.off(container);
      overview.remove();
    };
  }, [enabled, expanded, mapRef, raster, area, coverage]);
  if (!enabled || !raster) return null;
  const chips: Array<[keyof CoverageLayers, string]> = [
    ['fog', t('Đội chưa tới', 'Not reached')], ['need', t('Cần cứu', 'Needs rescue')], ['team', t('Đội cứu hộ', 'Rescue teams')], ['rescued', t('Đã cứu', 'Rescued')]];
  return <section ref={root} className="map-overview" data-expanded={expanded} data-coverage={!!coverage || undefined} data-large={large || undefined} aria-label={t('Bản đồ tổng quan', 'Overview map')}>
    <div className="overview-head">
      <button className="overview-toggle" aria-expanded={expanded} aria-controls="overview-map-surface"
        aria-label={expanded ? t('Thu gọn bản đồ tổng quan', 'Hide overview map') : t('Mở bản đồ tổng quan', 'Show overview map')}
        onClick={() => setExpanded(value => !value)}>
        <UiIcon name="area" size={15}/><span>{coverage ? t('Vùng cứu hộ', 'Rescue coverage') : t('Tổng quan', 'Overview')}</span><UiIcon name={expanded ? 'collapse' : 'expand'} size={14}/>
      </button>
      {expanded && coverage && <button className="icon-button overview-size" aria-pressed={large} aria-label={large ? t('Thu nhỏ', 'Smaller') : t('Phóng to', 'Larger')} title={large ? t('Thu nhỏ', 'Smaller') : t('Phóng to', 'Larger')}
        onClick={() => setLarge(value => !value)}><UiIcon name={large ? 'zoomOut' : 'zoomIn'} size={14}/></button>}
    </div>
    {expanded && <div ref={host} id="overview-map-surface" className="map-overview-surface" tabIndex={0} role="group"
      aria-label={t('Định hướng bản đồ chính', 'Navigate the main map')}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter"
      title={t('Chọn vị trí trên bản đồ', 'Choose a map location')}/>}
    {expanded && coverage && <div className="overview-coverage">
      <p className={waiting ? 'is-alert' : undefined}>{waiting ? t(`${waiting} điểm cần cứu ngoài vùng đã tới`, `${waiting} rescue ${waiting === 1 ? 'location' : 'locations'} outside team coverage`) : t('Không có điểm cần cứu ngoài vùng đã tới', 'No rescue locations outside team coverage')}</p>
      <fieldset aria-label={t('Lớp vùng cứu hộ', 'Coverage layers')}>
        {chips.map(([key, label]) => <label key={key} data-layer={key}><input type="checkbox" checked={layers[key]} onChange={() => setLayers(value => ({ ...value, [key]: !value[key] }))}/><i aria-hidden="true"/>{label}</label>)}
      </fieldset>
    </div>}
  </section>;
}
