import { LayerOrderControl } from '../../features/map/LayerOrderControl';
import { useMapLayerOrder } from '../../features/map/useMapLayerOrder';
import { defaultDrawingOrder } from '../../features/map/mapLayerOrder';
import { LandslideFillControl } from '../../features/landslides/LandslideFillControl';
import { useLandslideAppearance } from '../../features/landslides/useLandslideAppearance';
import { defaultLandslideFillOpacity } from '../../features/landslides/landslideAppearance';
import { supportsBasemapTone } from '../../features/imagery/basemapTone';
import { TerrainOverlayControls } from '../../features/terrain/TerrainOverlayControls';
import { AnalysisImageryControl } from '../../features/imagery/AnalysisImageryControl';
import type { AnalysisImageryState } from '../../features/imagery/useAnalysisImagery';
import type { useTerrainOverlays } from '../../features/terrain/useTerrainOverlays';
import { MapLayerSample } from '../../features/map/MapLayerSample';
import { PointRenderingControl } from '../../features/map/PointRenderingControl';
import { useEffect, useRef } from 'react';
import type { Locale } from '../../types/dear';
import { UiIcon } from './UiIcon';
import { clampOpacity, type LayerAppearance } from '../../features/map/layerAppearance';
import { useFloatingPanel } from '../../shared/hooks/useFloatingPanel';
import '../../features/map/layers-panel.css';

type Props = {
  locale: Locale; layers: Record<string, boolean>; appearance: LayerAppearance; mapMode: '2d' | '3d';
  onAppearance: (appearance: LayerAppearance) => void;
  hasFloodData: boolean; hasHLZData?: boolean; hasSelectedRoute: boolean; hasIncidentLayers: boolean;
  areaCount: number; onShowAreas: () => void; onReset: () => void;
  onToggleLayer: (id: string) => void; onClose: () => void;
  hasLocalRoads?: boolean; onShowLocalRoads?: () => void;
};
type PreviewProps = { imageryPreview?: string; terrainOverlays?: ReturnType<typeof useTerrainOverlays>; hasTerrainGrid?: boolean; analysisImagery?: AnalysisImageryState };

export function LayersDialog({ locale, layers, appearance, mapMode, onAppearance, hasFloodData, hasHLZData, hasSelectedRoute, hasIncidentLayers, areaCount, onShowAreas, onReset, onToggleLayer, onClose, imageryPreview, terrainOverlays, hasTerrainGrid = false, analysisImagery, hasLocalRoads, onShowLocalRoads }: Props & PreviewProps): JSX.Element {
  const t = (vi: string, en: string) => locale === 'en' ? en : vi;
  const panelRef = useRef<HTMLElement>(null);
  const { setOrder } = useMapLayerOrder();
  const { setFillOpacity } = useLandslideAppearance();
  const floating = useFloatingPanel(panelRef, 'layers');
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLButtonElement>('button')?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); } };
    const outside = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!panel?.contains(target) && !target.closest('[data-map-layers-trigger]')) closeRef.current();
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside, true);
    return () => { document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside, true); if (panel?.contains(document.activeElement) || document.activeElement === document.body) previous?.focus(); };
  }, []);

  const row = (id: string, label: string) => <div className="layer-row" key={id} data-layer={id}>
    <label><input type="checkbox" aria-label={label} checked={layers[id] !== false} onChange={() => onToggleLayer(id)}/><MapLayerSample kind={id} imagery={layers.imagery}/><span>{label}</span>
      {id === 'landslide' && areaCount > 0 && <small className="layer-count">{areaCount}</small>}
    </label>
    {id === 'landslide' && areaCount > 0 && <button className="icon-button layer-fit" onClick={onShowAreas} aria-label={t('Xem các vùng sạt lở', 'Fit landslide extents')} title={t('Xem các vùng sạt lở', 'Fit landslide extents')}><UiIcon name="fit" size={16}/></button>}
    {id === 'localRoads' && <button className="icon-button layer-fit" onClick={onShowLocalRoads} aria-label={t('Xem đường trong xã Chế Tạo', 'Fit Chế Tạo local roads')} title={t('Xem đường trong xã Chế Tạo', 'Fit Chế Tạo local roads')}><UiIcon name="fit" size={16}/></button>}
  </div>;
  const bases: Array<[boolean, string]> = [[true, t('Ảnh nền', 'Imagery')], [false, t('Địa hình', 'Terrain')]];
  return <section className="layers-panel" id="map-layers-panel" ref={panelRef} role="dialog" aria-modal="false" aria-labelledby="map-layers-title">
    <div className="layers-heading floating-panel-handle" {...floating} tabIndex={0} role="group" aria-label={t('Vị trí bảng lớp', 'Layers panel position')} aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home"><h2 id="map-layers-title">{t('Lớp bản đồ', 'Map layers')}</h2><button className="icon-button" onClick={onClose} aria-label={t('Đóng lớp bản đồ', 'Close map layers')}><UiIcon name="close" /></button></div>
    <div className="layers-content">
      {hasIncidentLayers && <fieldset className="map-layer-group response-layer-group"><legend>{t('Ưu tiên ứng phó', 'Response priorities')}</legend>
        {row('landslide', t('Sạt lở', 'Landslides'))}
        {areaCount > 0 && <LandslideFillControl locale={locale} disabled={layers.landslide === false}/>}
        {row('status', t('Tình trạng đường', 'Road status'))}
        {row('roads', t('Mạng đường', 'Road network'))}
        {hasLocalRoads && row('localRoads', t('Đường trong xã Chế Tạo', 'Chế Tạo local roads'))}
        {hasLocalRoads && row('devices',t('Thiết bị định vị','Location devices'))}
        {row('communities', t('Địa bàn dân cư', 'Communities'))}
        {hasSelectedRoute && row('route', t('Tuyến đang xem', 'Selected route'))}
        {hasFloodData && row('flood', t('Nghi ngập lũ quét', 'Possible flash flooding'))}
      </fieldset>}
      <LayerOrderControl locale={locale}/>
      <fieldset className="basemap-choices"><legend>{t('Bản đồ nền', 'Base map')}</legend>
        {bases.map(([imagery, label]) => <label className={'basemap-choice ' + (layers.imagery === imagery ? 'is-active' : '')} key={String(imagery)}>
          <span className={'basemap-preview ' + (imagery ? 'is-imagery' : 'is-terrain')} aria-hidden="true">
            {imagery && imageryPreview ? <img src={imageryPreview} alt=""/> : <svg viewBox="0 0 150 48" preserveAspectRatio="xMidYMid slice"><path d="M-20 48C10-25 75-15 88 18s65 43 88-2M-12 50C10-15 65-15 78 18s60 35 88-3M-3 52C15-7 55-9 67 19s55 30 86-4M8 55C24 0 46-3 55 20s49 27 88-3M21 52C29 8 38 4 43 23s39 21 87-4"/></svg>}
          </span>
          <input type="radio" name="basemap" checked={layers.imagery === imagery} onChange={() => { if (layers.imagery !== imagery) onToggleLayer('imagery'); }}/><span>{label}</span>
        </label>)}
      </fieldset>
      <div className="basemap-extras"><label><input type="checkbox" checked={Boolean(layers.context)} onChange={() => onToggleLayer('context')}/>{t('Nền bản đồ khu vực', 'Regional basemap')}</label><label><input type="checkbox" checked={layers.hillshade} onChange={() => onToggleLayer('hillshade')}/>{t('Bóng địa hình', 'Terrain shading')}</label></div>
      {analysisImagery && analysisImagery.catalogState !== 'off' && <details className="layer-section layer-analysis" open><summary>{t('Ảnh phân tích', 'Analysis imagery')}<small>{analysisImagery.selection.layer ? t('Đang phủ ảnh', 'Overlay active') : t('Quang học, SAR', 'Optical, SAR')}</small></summary>
        {analysisImagery.catalogState==='loading' && <p className="analysis-note" role="status">{t('Đang tải danh sách ảnh…','Loading imagery catalog…')}</p>}
        {analysisImagery.catalogState==='error' && <p className="analysis-note" role="status">{t('Chưa tải được danh sách ảnh.','Imagery catalog could not be loaded.')} <button type="button" className="text-button" onClick={analysisImagery.retryCatalog}>{t('Thử lại','Retry')}</button></p>}
        <AnalysisImageryControl locale={locale} layers={analysisImagery.layers} selection={analysisImagery.selection} onChange={analysisImagery.setSelection}/>
        {supportsBasemapTone(analysisImagery.layers) && analysisImagery.layers.some(layer=>layer.id===analysisImagery.selection.layer && layer.kind==='optical') && <label className="analysis-tone-choice"><input type="checkbox" checked={analysisImagery.balanceBasemap} onChange={event=>analysisImagery.setBalanceBasemap(event.target.checked)}/>{t('Cân màu nền theo Planet','Match basemap tone to Planet')}</label>}
      </details>}
      <details className="layer-section layer-context"><summary>{t('Điểm hỗ trợ và tham chiếu', 'Support and reference')}</summary>
        <fieldset className="map-layer-group"><legend className="sr-only">{t('Đối tượng bổ sung', 'Additional features')}</legend>
          {hasIncidentLayers && <>{row('crossings', t('Cầu, điểm vượt khe', 'Bridges and crossings'))}{row('staging', t('Điểm tập kết', 'Staging point'))}{hasHLZData && row('hlz', t('Bãi đáp đề xuất', 'Proposed landing sites'))}{row('aoi', t('Vùng đánh giá', 'Assessment area'))}</>}
          <label className="reference-layer-toggle"><input type="checkbox" checked={layers.gis !== false} onChange={() => onToggleLayer('gis')}/><UiIcon name="layers" size={18}/><span>{t('Dữ liệu tham chiếu', 'Reference data')}</span></label>
        </fieldset>
      </details>
      <details className="layer-section layer-appearance"><summary>{t('Tùy chỉnh hiển thị', 'Display options')}</summary>
        <label>{t('Độ rõ ảnh nền (2D)', 'Imagery opacity (2D)')}<output>{Math.round(appearance.imageryOpacity * 100)}%</output><input type="range" aria-label={t('Độ rõ ảnh nền', 'Imagery opacity')} disabled={mapMode !== '2d'} min="30" max="100" value={appearance.imageryOpacity * 100} onChange={event => onAppearance({ ...appearance, imageryOpacity: clampOpacity(Number(event.target.value) / 100) })}/></label>
        <label>{t('Độ rõ mạng đường nền', 'Background road opacity')}<output>{Math.round(appearance.networkOpacity * 100)}%</output><input type="range" aria-label={t('Độ rõ mạng đường nền', 'Background road opacity')} min="30" max="100" value={appearance.networkOpacity * 100} onChange={event => onAppearance({ ...appearance, networkOpacity: clampOpacity(Number(event.target.value) / 100) })}/></label>
        <label>{t('Đường hiển thị', 'Road filter')}<select aria-label={t('Đường hiển thị', 'Road filter')} value={appearance.roads} onChange={event => onAppearance({ ...appearance, roads: event.target.value as LayerAppearance['roads'] })}><option value="all">{t('Toàn bộ mạng đường', 'All roads')}</option><option value="affected">{t('Đoạn bị ảnh hưởng và tuyến đang xem', 'Affected roads and selected route')}</option></select></label>
        <label>{t('Nhãn địa danh', 'Place labels')}<select aria-label={t('Nhãn địa danh', 'Place labels')} value={appearance.labels} onChange={event => onAppearance({ ...appearance, labels: event.target.value as LayerAppearance['labels'] })}><option value="auto">{t('Tự động theo vùng nhìn', 'Automatic')}</option><option value="selected">{t('Chỉ đối tượng đang xem', 'Selected object only')}</option><option value="none">{t('Tắt nhãn', 'Off')}</option></select></label>
        <PointRenderingControl locale={locale} disabled={mapMode !== '2d' || layers.gis === false}/>
      </details>
      {terrainOverlays && mapMode === '3d' && <details className="layer-section layer-terrain"><summary>{t('Phân tích địa hình 3D', '3D terrain analysis')}</summary><TerrainOverlayControls locale={locale} mapMode={mapMode} hasGrid={hasTerrainGrid} overlays={terrainOverlays}/></details>}
    </div>
    <div className="layers-footer"><button className="text-button" onClick={() => { setFillOpacity(defaultLandslideFillOpacity); setOrder(defaultDrawingOrder); onReset(); }}>{t('Khôi phục hiển thị mặc định', 'Restore default display')}</button></div>
  </section>;
}
