import type { GeometryRecord } from '../../geo/vector/types';
import { landslideAreaOf, landslideAreaStyle } from '../../features/landslides/landslideAreas';
import { MapPoiSample } from '../../features/map/MapLayerSample';
import type { ObservationKind } from '../../features/observations/model';
import type { Hazard, Locale } from '../../types/dear';
import { useState, type ReactNode } from 'react';
import { UiIcon } from './UiIcon';
import { roadColors } from '../../terrain/roadStyle';
import { roadStatusLabels } from '../../features/routes/roadStatus';
import type { MapSymbolName } from '../../terrain/mapSymbols';
import { RoadConditionSymbol } from '../../features/map/RoadConditionSymbol';
import '../../styles/map-controls.css';
import '../../features/map/map-legend.css';

const swatchColors: Record<string, string> = { 'local-network': roadColors.reference, selected: roadColors.selected, blocked: roadColors.blocked, uncertain: roadColors.uncertain };

type Props = {
  panelCollapsed: boolean; onTogglePanel: () => void;
  locating: boolean; onLocation: () => void;
  locale: Locale; mapMode: '3d' | '2d';
  orbiting?: boolean; onToggleOrbit?: () => void;
  onChangeMapMode: (mode: '2d' | '3d') => void; onZoomIn: () => void; onZoomOut: () => void;
  onResetView: () => void; onOpenLayers: () => void; onOpenGis:()=>void; onCompareImagery?: () => void;
  layersOpen: boolean; layers: Record<string, boolean>; hasSelectedRoute: boolean; hazards: Hazard[];
  hasHLZData?: boolean; gisObservations?: ObservationKind[];
  hasLocalRoads?: boolean;
  affectedOnly?: boolean;
  mappedAreas?: GeometryRecord[];
  timelineExpanded?: boolean; onToggleTimeline?: () => void;
  headerCollapsed?: boolean; onShowHeader?: () => void;
  journeyControl?: ReactNode; flyoverControl?: ReactNode;
  children?: ReactNode; onMeasure: () => void; measuring: boolean; onDraw: () => void; drawing: boolean;
};

export function MapControls({ orbiting = false, onToggleOrbit, mappedAreas = [], locale, mapMode, onChangeMapMode, onZoomIn, onZoomOut, onResetView, gisObservations=[], onOpenGis, onCompareImagery, onOpenLayers, layersOpen, layers, hasSelectedRoute, hazards, hasHLZData, hasLocalRoads, affectedOnly, timelineExpanded, onToggleTimeline, headerCollapsed, onShowHeader, journeyControl, flyoverControl, children, onMeasure, measuring, onDraw, drawing, panelCollapsed, onTogglePanel, locating, onLocation }: Props): JSX.Element {
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [legendMinimized, setLegendMinimized] = useState(true);
  const t = (vi: string, en: string) => locale === 'en' ? en : vi;
  const routeVisible = hasSelectedRoute && layers.route;
  const legend: Array<{ kind: string; label: string; symbol?: MapSymbolName; uiSymbol?: 'layers'; fieldSymbol?: boolean; area?: ReturnType<typeof landslideAreaStyle> }> = [];
  if (layers.roads && !affectedOnly) legend.push({ kind: 'network', label: layers.status ? t(...roadStatusLabels.open) : t('Mạng đường', 'Road network') });
  if (hasLocalRoads && layers.roads && layers.localRoads!==false && !affectedOnly) legend.push({kind:'local-network',label:t('Đường trong xã Chế Tạo','Chế Tạo local roads')});
  if (layers.aoi) legend.push({ kind: 'aoi', label: t('Vùng đánh giá', 'Assessment area') });
  if ((layers.roads || routeVisible) && layers.status) legend.push({ kind: 'blocked', label: t('Đường bị chặn', 'Blocked road') }, { kind: 'risk', label: t('Nguy cơ sạt lở trên đường', 'Landslide risk on road') }, { kind: 'uncertain', label: t('Đường cần xác minh', 'Road to verify') });
  if (routeVisible) legend.push({ kind: 'selected', label: t('Tuyến đang xem', 'Selected route') });
  if (layers.communities) legend.push({ kind: 'community', symbol: 'community', label: t('Địa bàn dân cư', 'Community') }, { kind: 'priority', symbol: 'community', label: t('Ưu tiên cứu hộ', 'Rescue priority') });
  if (layers.landslide && hazards.some(h => h.kind === 'landslide' && h.observation === 'reported')) legend.push({ kind: 'landslide', symbol: 'landslide', label: t('Điểm sạt lở', 'Reported landslide') });
  if (layers.landslide && hazards.some(h => h.kind === 'landslide' && h.observation === 'suspected')) legend.push({ kind: 'suspected', symbol: 'landslide', label: t('Nghi sạt lở', 'Suspected landslide') });
  if ((layers.crossings ?? layers.status) && hazards.some(h => h.kind === 'bridge')) legend.push({ kind: 'bridge', symbol: 'bridge', label: t('Cầu cần xác minh', 'Bridge to verify') });
  if ((layers.crossings ?? layers.status) && hazards.some(h => h.kind === 'crossing')) legend.push({ kind: 'crossing', symbol: 'crossing', label: t('Điểm vượt khe', 'Gully crossing') });
  if (layers.flood && hazards.some(h => h.kind === 'flood')) legend.push({ kind: 'flood', symbol: 'flood', label: t('Điểm nghi ngập', 'Possible flood site') });
  if (layers.staging) legend.push({ kind: 'staging', symbol: 'staging', label: t('Điểm tập kết', 'Staging point') });
  if (layers.hlz && hasHLZData) legend.push({ kind: 'hlz', symbol: 'hlz', label: t('Vị trí hạ cánh đề xuất', 'Proposed landing site') });
  if (layers.communities || layers.landslide || layers.status) legend.push({ kind: 'overlap', uiSymbol: 'layers', label: t('Nhóm đối tượng', 'Overlapping points') });
  if (gisObservations.some(kind=>kind!=='survey')) legend.push({kind:'field-warning',fieldSymbol:true,label:t('Ghi nhận chưa xác minh','Unreviewed observations')});
  if (gisObservations.includes('survey')) legend.push({kind:'field-survey',fieldSymbol:true,label:t('Điểm khảo sát','Survey points')});
  if (layers.landslide) {
    const areas = mappedAreas.flatMap(record => { const area = record.visible && landslideAreaOf(record); return area ? [area] : []; });
    const potential = areas.find(area => area.state === 'potential');
    const observed = areas.find(area => area.state === 'occurred' && area.review !== 'unreviewed');
    const unreviewed = areas.find(area => area.state === 'occurred' && area.review === 'unreviewed');
    if (potential) legend.push({kind:'potential-area', label:t('Vùng có nguy cơ sạt lở','Potential landslide extent'), area:landslideAreaStyle(potential)});
    if (observed) legend.push({kind:'observed-area', label:t('Vết sạt lở đã rà soát','Reviewed landslide extent'), area:landslideAreaStyle(observed)});
    if (unreviewed) legend.push({kind:'unreviewed-area', label:t('Vết sạt lở chưa rà soát','Unreviewed landslide extent'), area:landslideAreaStyle(unreviewed)});
  }
  const visibleLegend = legendExpanded ? legend : legend.filter(item => ['network', 'local-network', 'blocked', 'risk', 'uncertain', 'selected', 'potential-area', 'observed-area', 'unreviewed-area', 'field-warning', 'field-survey'].includes(item.kind));

  return <>
    <div className="map-toolbar" role="group" aria-label={t('Công cụ bản đồ', 'Map tools')}>
      <button className="icon-button map-panel-toggle" aria-controls="response-panel" aria-expanded={!panelCollapsed} onClick={onTogglePanel} aria-label={panelCollapsed ? t('Mở bảng thông tin', 'Show information panel') : t('Ẩn bảng thông tin', 'Hide information panel')} title={panelCollapsed ? t('Mở bảng thông tin', 'Show information panel') : t('Ẩn bảng thông tin', 'Hide information panel')}><UiIcon name={panelCollapsed ? 'panelOpen' : 'panelClose'}/></button>
      {headerCollapsed && <button className="icon-button map-header-restore" onClick={onShowHeader} aria-label={t('Hiện tiêu đề', 'Show header')} title={t('Hiện tiêu đề', 'Show header')}><UiIcon name="expand"/></button>}
      {children}
      <div className="map-tool-group map-primary-actions">
        {journeyControl}
        <button className="icon-button map-layer-trigger map-layer-launcher" data-map-layers-trigger aria-label={t('Lớp bản đồ', 'Layers')} title={t('Lớp bản đồ', 'Layers')} aria-expanded={layersOpen} aria-controls="map-layers-panel" onClick={onOpenLayers}><UiIcon name="layers"/><span>{t('Lớp', 'Layers')}</span></button>
        <button className="icon-button map-tool-toggle" aria-label={t('Công cụ bổ sung', 'Additional map tools')} title={t('Công cụ bổ sung', 'Additional map tools')} aria-expanded={toolsExpanded} aria-controls="map-advanced-tools" onClick={() => setToolsExpanded(open => !open)}><UiIcon name="settings"/><span>{t('Công cụ', 'Tools')}</span></button>
        {onToggleTimeline && <button className="icon-button map-timeline-toggle" aria-label={t('Diễn biến sự kiện', 'Incident timeline')} title={t('Diễn biến sự kiện', 'Incident timeline')} aria-expanded={timelineExpanded} aria-controls="assessment-timeline" onClick={onToggleTimeline}><UiIcon name="history"/><span>{t('Diễn biến', 'Timeline')}</span></button>}
      </div>
    </div>
    <div className="map-advanced-tools" id="map-advanced-tools" role="group" aria-label={t('Công cụ bổ sung', 'Additional map tools')} hidden={!toolsExpanded}>
      {flyoverControl}
      {/* Data opens layers and the GIS workspace; tools take map input until closed. */}
      <div className="map-tool-group" role="group" aria-label={t('Dữ liệu', 'Data')}>
        <button className="icon-button map-gis-trigger" aria-label={t('Dữ liệu GIS','GIS data')} title={t('Dữ liệu GIS','GIS data')} onClick={onOpenGis}><UiIcon name="polygon"/><span>GIS</span></button>
        {onCompareImagery && <button className="icon-button map-compare-trigger" aria-label={t('So sánh ảnh trước và sau', 'Compare before and after imagery')} title={t('So sánh ảnh trước và sau', 'Compare before and after imagery')} onClick={onCompareImagery}><UiIcon name="image"/><span>{t('Trước, sau', 'Before, after')}</span></button>}
      </div>
      <div className="map-tool-group" role="group" aria-label={t('Đo và vẽ', 'Measure and draw')}>
        <button className="icon-button map-measure-trigger" aria-label={t('Đo trên bản đồ 2D', 'Measure on 2D map')} title={t('Đo trên bản đồ 2D', 'Measure on 2D map')} aria-pressed={measuring} onClick={onMeasure}><UiIcon name="ruler"/><span>{t('Đo', 'Measure')}</span></button>
        <button className="icon-button map-draw-trigger" aria-label={t('Vẽ trên bản đồ 2D', 'Draw on 2D map')} title={t('Vẽ trên bản đồ 2D', 'Draw on 2D map')} aria-pressed={drawing} onClick={onDraw}><UiIcon name="edit"/><span>{t('Vẽ', 'Draw')}</span></button>
        <button className="icon-button map-location-trigger" aria-label={t('Thông tin vị trí', 'Location information')} title={t('Thông tin vị trí', 'Location information')} aria-pressed={locating} onClick={onLocation}><UiIcon name="location"/><span>{t('Vị trí', 'Location')}</span></button>
      </div>
    </div>
    <div className="map-tools" role="group" aria-label={t('Điều khiển bản đồ', 'Map controls')}>
      <div className="map-zoom">
        <button className="icon-button" onClick={onZoomIn} aria-label={t('Phóng to', 'Zoom in')} title={t('Phóng to', 'Zoom in')}><UiIcon name="zoomIn" /></button>
        <button className="icon-button" onClick={onZoomOut} aria-label={t('Thu nhỏ', 'Zoom out')} title={t('Thu nhỏ', 'Zoom out')}><UiIcon name="zoomOut" /></button>
      </div>
      <button className="icon-button" onClick={onResetView} aria-label={t('Xem toàn khu vực', 'Fit area')} title={t('Xem toàn khu vực', 'Fit area')}>
        <UiIcon name="fit" />
      </button>
      {mapMode === '3d' && onToggleOrbit && <button className="icon-button map-orbit" aria-pressed={orbiting} onClick={onToggleOrbit} aria-label={t('Xoay địa hình', 'Orbit terrain')} title={t('Xoay địa hình; kéo bản đồ để dừng', 'Orbit terrain; drag the map to stop')}><UiIcon name="redo"/></button>}
      <div className="map-mode-group" role="group" aria-label={t('Góc nhìn bản đồ', 'Map view')}>
        {(['2d', '3d'] as const).map(mode => <button key={mode} className="icon-button map-mode" aria-pressed={mapMode === mode} onClick={() => onChangeMapMode(mode)} aria-label={t('Chuyển sang ', 'Switch to ') + mode.toUpperCase()} title={mode === '3d' ? t('Ctrl + kéo để nghiêng và xoay', 'Ctrl + drag to tilt and rotate') : t('Bản đồ 2D', '2D map')}>{mode.toUpperCase()}</button>)}
      </div>
    </div>
    <div className="map-bottom-bar" hidden={layersOpen || measuring || drawing || locating || !legend.length} data-expanded={legendExpanded} data-minimized={legendMinimized}>
      <div className="map-legend-heading">
        {legend.length > 0 && <button className="text-button legend-toggle" aria-expanded={!legendMinimized && legendExpanded} aria-controls="map-legend-items" onClick={() => { setLegendMinimized(false); setLegendExpanded(expanded => legendMinimized || !expanded); }}>{t('Chú giải', 'Legend')}<UiIcon name={!legendMinimized && legendExpanded ? 'collapse' : 'expand'} size={14}/></button>}
        {!legendMinimized && <button className="icon-button legend-minimize" aria-label={t('Thu gọn chú giải', 'Minimize legend')} title={t('Thu gọn chú giải', 'Minimize legend')} onClick={() => setLegendMinimized(true)}><UiIcon name="minus" size={14}/></button>}
      </div>
      {!layersOpen && !measuring && !drawing && !legendMinimized && visibleLegend.length > 0 && <div className="map-legend" id="map-legend-items" aria-label={t('Chú giải', 'Legend')}>
        {visibleLegend.map(({ kind, label, symbol, uiSymbol, fieldSymbol, area }) => <span className="legend-item" key={kind}>
          {area ? <i className="legend-area" aria-hidden="true"><svg viewBox="0 0 28 22"><rect x="2" y="3" width="24" height="16" rx="1" fill={area.color} fillOpacity={area.fillOpacity} stroke={area.color} strokeWidth={area.weight} strokeDasharray={area.dashArray}/></svg></i> : kind === 'blocked' || kind === 'risk' ? <RoadConditionSymbol condition={kind}/> : fieldSymbol ? <i className={'field-legend-symbol'+(kind==='field-survey'?' is-survey':'')} aria-hidden="true">{kind==='field-survey'?'i':'!'}</i> : symbol ? <MapPoiSample symbol={symbol} kind={kind}/> : uiSymbol ? <UiIcon name={uiSymbol} size={18}/> : <i className={'line ' + kind} style={{ borderColor: kind === 'local-network' ? (layers.imagery ? roadColors.reference : roadColors.networkTerrain) : kind === 'network' ? (layers.imagery ? roadColors.networkImagery : roadColors.networkTerrain) : swatchColors[kind] }} aria-hidden="true"/>}{label}
        </span>)}
      </div>}
    </div>
  </>;
}
