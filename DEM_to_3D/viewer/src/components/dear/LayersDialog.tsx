import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Locale } from '../../types/dear';
import { UiIcon } from './UiIcon';
import { clampOpacity, type LayerAppearance } from '../../features/map/layerAppearance';
import { useFloatingPanel } from '../../shared/hooks/useFloatingPanel';

type Props = { locale: Locale; layers: Record<string, boolean>; appearance: LayerAppearance; mapMode: '2d' | '3d'; onAppearance: (appearance: LayerAppearance) => void; onCompare: () => void; renderInfo: (id: string) => ReactNode; hasFloodData: boolean; hasHLZData?: boolean; hasSelectedRoute: boolean; hasIncidentLayers: boolean; onToggleLayer: (id: string) => void; onClose: () => void };
type PreviewProps = { imageryPreview?: string };

export function LayersDialog({ locale, layers, appearance, mapMode, onAppearance, onCompare, onImportGeometry, renderInfo, hasFloodData, hasHLZData, hasSelectedRoute, hasIncidentLayers, onToggleLayer, onClose, imageryPreview }: Props & PreviewProps & {onImportGeometry:()=>void}): JSX.Element {
  const t = (vi: string, en: string) => locale === 'en' ? en : vi;
  const [infoId, setInfoId] = useState<string | null>(null);
  const info = (id: string, label: string) => <button type="button" className="layer-info-button" aria-label={t('Nguồn lớp ', 'Layer source: ') + label} aria-expanded={infoId === id} aria-controls={infoId === id ? `layer-info-${id}` : undefined} onClick={() => setInfoId(current => current === id ? null : id)}><UiIcon name="info"/></button>;
  const details = (id: string) => infoId === id ? <div id={`layer-info-${id}`}>{renderInfo(id)}</div> : null;
  const panelRef = useRef<HTMLElement>(null);
  const floating = useFloatingPanel(panelRef, 'layers');
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLButtonElement>('button')?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); } };
    const outside = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!panel?.contains(target) && !target.closest('[data-map-layers-trigger]')) closeRef.current();
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside, true);
    return () => { document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside, true); if (panel?.contains(document.activeElement) || document.activeElement === document.body) previous?.focus(); };
  }, []);
  const groups = [
    { name: t('Tình huống', 'Situation'), items: [['aoi', t('Vùng đánh giá', 'Assessment area')], ['landslide', t('Sạt lở', 'Landslides')], ['flood', t('Nghi ngập lũ quét', 'Possible flash flooding')], ['status', t('Tình trạng đường', 'Road status')]] },
    { name: t('Tiếp cận', 'Access'), items: [['roads', t('Mạng đường', 'Road network')], ['communities', t('Thôn, bản', 'Communities')], ['staging', t('Điểm tập kết', 'Staging point')], ['hlz', t('Điểm hạ cánh trực thăng', 'Helicopter landing zones')], ['route', t('Tuyến đang xem', 'Selected route')]] }
  ];
  const bases: Array<[boolean, string]> = [[true, t('Ảnh nền', 'Imagery')], [false, t('Địa hình', 'Terrain')]];
  return <section className="layers-panel" id="map-layers-panel" ref={panelRef} role="dialog" aria-modal="false" aria-labelledby="map-layers-title">
    <div className="layers-heading floating-panel-handle" {...floating} tabIndex={0} role="group" aria-label={t('Vị trí bảng lớp', 'Layers panel position')} aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home" title={t('Kéo để đổi vị trí. Nhấp đúp để đặt lại.', 'Drag to move. Double-click to reset.')}><h2 id="map-layers-title">{t('Lớp bản đồ', 'Map layers')}</h2><button className="icon-button" onClick={onClose} aria-label={t('Đóng lớp bản đồ', 'Close map layers')}><UiIcon name="close" /></button></div>
    <div className="layers-content">
      <button className="geodata-entry" onClick={onImportGeometry}><UiIcon name="plus"/>{t('Nhập KML / polygon','Import KML / polygon')}</button>
      <fieldset className="basemap-choices"><legend>{t('Bản đồ nền', 'Base map')}</legend>
        {bases.map(([imagery, label]) => <label className={'basemap-choice ' + (layers.imagery === imagery ? 'is-active' : '')} key={String(imagery)}>
          <span className={'basemap-preview ' + (imagery ? 'is-imagery' : 'is-terrain')} aria-hidden="true">
            {imagery && imageryPreview ? <img src={imageryPreview} alt=""/> : <svg viewBox="0 0 150 48" preserveAspectRatio="xMidYMid slice"><path d="M-20 48C10-25 75-15 88 18s65 43 88-2M-12 50C10-15 65-15 78 18s60 35 88-3M-3 52C15-7 55-9 67 19s55 30 86-4M8 55C24 0 46-3 55 20s49 27 88-3M21 52C29 8 38 4 43 23s39 21 87-4"/></svg>}
          </span>
          <input type="radio" name="basemap" checked={layers.imagery === imagery} onChange={() => { if (layers.imagery !== imagery) onToggleLayer('imagery'); }}/><span>{label}</span>
        </label>)}
      </fieldset>
      <div className="layer-source-row"><span>{t('Nguồn bản đồ nền', 'Basemap source')}</span>{info(layers.imagery ? 'imagery' : 'terrain', t('Bản đồ nền', 'Base map'))}</div>
      {details(layers.imagery ? 'imagery' : 'terrain')}
      <div className="layer-source-row"><label className="regional-basemap-toggle"><input type="checkbox" checked={Boolean(layers.context)} onChange={() => onToggleLayer('context')}/><span>{t('Nền bản đồ khu vực', 'Regional basemap')}</span></label>{info('context', t('Nền bản đồ khu vực', 'Regional basemap'))}</div>
      {details('context')}
      {hasIncidentLayers && groups.map(group => <fieldset className="map-layer-group" key={group.name}><legend>{group.name}</legend>{group.items.filter(([id]) => (id !== 'flood' || hasFloodData) && (id !== 'hlz' || hasHLZData) && (id !== 'route' || hasSelectedRoute)).map(([id, label]) => (
        <div key={id}><div className="layer-source-row"><label><input type="checkbox" checked={Boolean(layers[id])} onChange={() => onToggleLayer(id)}/><span>{label}</span></label>{info(id, label)}</div>{details(id)}</div>
      ))}</fieldset>)}
      <div className="layer-source-row"><label className="terrain-shading"><input type="checkbox" checked={layers.hillshade} onChange={() => onToggleLayer('hillshade')}/>{t('Bóng địa hình', 'Terrain shading')}</label>{info('hillshade', t('Bóng địa hình', 'Terrain shading'))}</div>{details('hillshade')}
      <details className="layer-appearance"><summary>{t('Hiển thị', 'Display options')}</summary>
        <label>{t('Độ rõ ảnh nền (2D)', 'Imagery opacity (2D)')}<output>{Math.round(appearance.imageryOpacity * 100)}%</output><input type="range" aria-label={t('Độ rõ ảnh nền', 'Imagery opacity')} disabled={mapMode !== '2d'} min="30" max="100" value={appearance.imageryOpacity * 100} onChange={event => onAppearance({ ...appearance, imageryOpacity: clampOpacity(Number(event.target.value) / 100) })}/></label>
        <label>{t('Độ rõ mạng đường nền', 'Background road opacity')}<output>{Math.round(appearance.networkOpacity * 100)}%</output><input type="range" aria-label={t('Độ rõ mạng đường nền', 'Background road opacity')} min="30" max="100" value={appearance.networkOpacity * 100} onChange={event => onAppearance({ ...appearance, networkOpacity: clampOpacity(Number(event.target.value) / 100) })}/></label>
        <label>{t('Đường hiển thị', 'Road filter')}<select aria-label={t('Đường hiển thị', 'Road filter')} value={appearance.roads} onChange={event => onAppearance({ ...appearance, roads: event.target.value as LayerAppearance['roads'] })}><option value="all">{t('Toàn bộ mạng đường', 'All roads')}</option><option value="affected">{t('Đoạn bị ảnh hưởng và tuyến đang xem', 'Affected roads and selected route')}</option></select></label>
        <label>{t('Nhãn địa danh', 'Place labels')}<select aria-label={t('Nhãn địa danh', 'Place labels')} value={appearance.labels} onChange={event => onAppearance({ ...appearance, labels: event.target.value as LayerAppearance['labels'] })}><option value="auto">{t('Tự động theo vùng nhìn', 'Automatic')}</option><option value="selected">{t('Chỉ đối tượng đang xem', 'Selected object only')}</option><option value="none">{t('Tắt nhãn', 'Off')}</option></select></label>
      </details>
      <button className="text-button layer-compare-action" onClick={onCompare}>{t('So ảnh trước và sau sự kiện', 'Compare pre/post imagery')}</button>
    </div>
  </section>;
}
