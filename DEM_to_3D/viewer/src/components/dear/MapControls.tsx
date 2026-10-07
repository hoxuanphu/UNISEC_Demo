import type { Hazard, Locale } from '../../types/dear';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UiIcon } from './UiIcon';
import { roadColors } from '../../terrain/roadStyle';
import { MapSymbol } from '../../shared/ui/MapSymbol';
import type { MapSymbolName } from '../../terrain/mapSymbols';
import { useDismissiblePopover } from '../../shared/hooks/useDismissiblePopover';
import '../../styles/map-controls.css';

const swatchColors: Record<string, string> = { selected: roadColors.selected, blocked: roadColors.blocked, uncertain: roadColors.uncertain };

type Props = {
  panelCollapsed: boolean; onTogglePanel: () => void;
  locating: boolean; onLocation: () => void;
  locale: Locale; mapMode: '3d' | '2d';
  onToggleMapMode: () => void; onZoomIn: () => void; onZoomOut: () => void;
  onResetView: () => void; onOpenLayers: () => void;
  layersOpen: boolean; layers: Record<string, boolean>; hasSelectedRoute: boolean; hazards: Hazard[];
  hasHLZData?: boolean;
  affectedOnly?: boolean;
  children?: ReactNode; onMeasure: () => void; measuring: boolean;
};

export function MapControls({ locale, mapMode, onToggleMapMode, onZoomIn, onZoomOut, onResetView, onOpenLayers, layersOpen, layers, hasSelectedRoute, hazards, hasHLZData, affectedOnly, children, onMeasure, measuring, panelCollapsed, onTogglePanel, locating, onLocation }: Props): JSX.Element {
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [legendMinimized, setLegendMinimized] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => { if (measuring || layersOpen) setHelpOpen(false); }, [measuring, layersOpen]);
  const helpRef = useRef<HTMLDivElement>(null);
  useDismissiblePopover(helpRef, helpOpen, () => setHelpOpen(false));
  const t = (vi: string, en: string) => locale === 'en' ? en : vi;
  const routeVisible = hasSelectedRoute && layers.route;
  const legend: Array<{ kind: string; label: string; symbol?: MapSymbolName; uiSymbol?: 'layers' }> = [];
  if (layers.roads && !affectedOnly) legend.push({ kind: 'network', label: t('Chưa ghi nhận chặn', 'No blockage reported') });
  if (layers.aoi) legend.push({ kind: 'aoi', label: t('Vùng đánh giá', 'Assessment area') });
  if ((layers.roads || routeVisible) && layers.status) legend.push({ kind: 'blocked', label: t('Đường bị chặn', 'Blocked road') }, { kind: 'uncertain', label: t('Đường cần xác minh', 'Road to verify') });
  if (routeVisible) legend.push({ kind: 'selected', label: t('Tuyến đang xem', 'Selected route') });
  if (layers.communities) legend.push({ kind: 'community', symbol: 'community', label: t('Thôn, bản', 'Community') }, { kind: 'priority', symbol: 'community', label: t('Ưu tiên cứu hộ', 'Rescue priority') });
  if (layers.landslide && hazards.some(h => h.kind === 'landslide' && h.observation === 'reported')) legend.push({ kind: 'landslide', symbol: 'landslide', label: t('Điểm sạt lở', 'Reported landslide') });
  if (layers.landslide && hazards.some(h => h.kind === 'landslide' && h.observation === 'suspected')) legend.push({ kind: 'suspected', symbol: 'landslide', label: t('Nghi sạt lở', 'Suspected landslide') });
  if (layers.status && hazards.some(h => h.kind === 'bridge')) legend.push({ kind: 'bridge', symbol: 'bridge', label: t('Cầu cần xác minh', 'Bridge to verify') });
  if (layers.status && hazards.some(h => h.kind === 'crossing')) legend.push({ kind: 'crossing', symbol: 'crossing', label: t('Điểm vượt khe', 'Gully crossing') });
  if (layers.flood && hazards.some(h => h.kind === 'flood')) legend.push({ kind: 'flood', symbol: 'flood', label: t('Điểm nghi ngập', 'Possible flood site') });
  if (layers.staging) legend.push({ kind: 'staging', symbol: 'staging', label: t('Điểm tập kết', 'Staging point') });
  if (layers.hlz && hasHLZData) legend.push({ kind: 'hlz', symbol: 'hlz', label: t('Vị trí hạ cánh đề xuất', 'Proposed landing site') });
  if (layers.communities || layers.landslide || layers.status) legend.push({ kind: 'overlap', uiSymbol: 'layers', label: t('Nhóm đối tượng', 'Overlapping points') });
  const visibleLegend = legendExpanded ? legend : legend.filter(item => ['network', 'blocked', 'uncertain', 'selected'].includes(item.kind));

  return <>
    <div className="map-toolbar" role="group" aria-label={t('Công cụ bản đồ', 'Map tools')}>
      <button className="icon-button map-panel-toggle" aria-controls="response-panel" aria-expanded={!panelCollapsed} onClick={onTogglePanel} aria-label={panelCollapsed ? t('Mở bảng thông tin', 'Show information panel') : t('Ẩn bảng thông tin', 'Hide information panel')} title={panelCollapsed ? t('Mở bảng thông tin', 'Show information panel') : t('Ẩn bảng thông tin', 'Hide information panel')}><UiIcon name={panelCollapsed ? 'panelOpen' : 'panelClose'}/></button>
      {children}
      <button className="icon-button map-layer-trigger map-layer-launcher" data-map-layers-trigger aria-label={t('Lớp bản đồ', 'Layers')} title={t('Lớp bản đồ', 'Layers')} aria-expanded={layersOpen} aria-controls="map-layers-panel" onClick={onOpenLayers}><UiIcon name="layers"/></button>
      <button className="icon-button map-measure-trigger" aria-label={t('Đo trên bản đồ 2D', 'Measure on 2D map')} title={t('Đo trên bản đồ 2D', 'Measure on 2D map')} aria-pressed={measuring} onClick={onMeasure}><UiIcon name="ruler"/></button>
    </div>
    <div className="map-tools" role="group" aria-label={t('Điều khiển bản đồ', 'Map controls')}>
      <button className="icon-button map-mode" onClick={onToggleMapMode} aria-label={t('Chuyển sang ' + (mapMode === '2d' ? '3D' : '2D'), 'Switch to ' + (mapMode === '2d' ? '3D' : '2D'))} title={mapMode === '3d' ? t('Ctrl + kéo để nghiêng và xoay', 'Ctrl + drag to tilt and rotate') : t('Chuyển sang góc nhìn 3D', 'Switch to 3D view')}>{mapMode === '2d' ? '3D' : '2D'}</button>
      <div className="map-zoom">
        <button className="icon-button" onClick={onZoomIn} aria-label={t('Phóng to', 'Zoom in')} title={t('Phóng to', 'Zoom in')}><UiIcon name="plus" /></button>
        <button className="icon-button" onClick={onZoomOut} aria-label={t('Thu nhỏ', 'Zoom out')} title={t('Thu nhỏ', 'Zoom out')}><UiIcon name="minus" /></button>
      </div>
      <button className="icon-button" onClick={onResetView} aria-label={t('Xem toàn khu vực', 'Fit area')} title={t('Xem toàn khu vực', 'Fit area')}>
        <UiIcon name="fit" />
      </button>
      <button className="icon-button map-location-trigger" aria-label={t('Thông tin vị trí', 'Location information')} title={t('Thông tin vị trí', 'Location information')} aria-pressed={locating} onClick={onLocation}><UiIcon name="location"/></button>
      <div className="map-help" ref={helpRef}>
        <button className="icon-button" aria-label={t('Thao tác bản đồ', 'Map gestures')} title={t('Thao tác bản đồ', 'Map gestures')} aria-expanded={helpOpen} aria-controls="map-gesture-help" onClick={() => setHelpOpen(open => !open)}><UiIcon name="help"/></button>
        {helpOpen && <div id="map-gesture-help" data-popover><strong>{t('Thao tác bản đồ', 'Map gestures')}</strong><dl><dt>{t('Di chuyển', 'Pan')}</dt><dd>{t('Kéo chuột trái', 'Left-drag')}</dd><dt>{t('Phóng to / thu nhỏ', 'Zoom')}</dt><dd>{t('Cuộn chuột', 'Mouse wheel')}</dd>{mapMode === '3d' && <><dt>{t('Nghiêng và xoay', 'Tilt and rotate')}</dt><dd>{t('Ctrl + kéo hoặc kéo chuột phải', 'Ctrl + drag or right-drag')}</dd></>}</dl></div>}
      </div>
    </div>
    <div className="map-bottom-bar" hidden={layersOpen || measuring || locating || !legend.length} data-expanded={legendExpanded} data-minimized={legendMinimized}>
      <div className="map-legend-heading">
        {legend.length > 0 && <button className="text-button legend-toggle" aria-expanded={!legendMinimized && legendExpanded} aria-controls="map-legend-items" onClick={() => { setLegendMinimized(false); setLegendExpanded(expanded => legendMinimized || !expanded); }}>{t('Chú giải', 'Legend')}<UiIcon name={!legendMinimized && legendExpanded ? 'collapse' : 'expand'} size={14}/></button>}
        {!legendMinimized && <button className="icon-button legend-minimize" aria-label={t('Thu gọn chú giải', 'Minimize legend')} title={t('Thu gọn chú giải', 'Minimize legend')} onClick={() => setLegendMinimized(true)}><UiIcon name="minus" size={14}/></button>}
      </div>
      {!layersOpen && !measuring && !legendMinimized && visibleLegend.length > 0 && <div className="map-legend" id="map-legend-items" aria-label={t('Chú giải', 'Legend')}>
        {visibleLegend.map(({ kind, label, symbol, uiSymbol }) => <span className="legend-item" key={kind}>
          {symbol ? <i className={'legend-symbol ' + kind}><MapSymbol name={symbol} size={15} /></i> : uiSymbol ? <UiIcon name={uiSymbol} size={18}/> : <i className={'line ' + kind} style={{ borderColor: kind === 'network' ? (layers.imagery ? roadColors.networkImagery : roadColors.networkTerrain) : swatchColors[kind] }} aria-hidden="true"/>}{label}
        </span>)}
      </div>}
    </div>
  </>;
}
