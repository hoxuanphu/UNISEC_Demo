import { useEffect, useRef, useState, type Dispatch, type MutableRefObject } from 'react';
import type * as L from 'leaflet';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { canFinish, measurementPreviewPoints, minimumPoints, type MeasureMode } from './measurement';
import type { MeasureAction, MeasurementSession } from './measurementSession';
import { defaultMeasureUnits, measurementResults, modeNames } from './measurementResults';
import type { MeasureGeometry } from './measurementGeometry';
import { useMeasurementMap } from './useMeasurementMap';
import { useFloatingPanel } from '../../shared/hooks/useFloatingPanel';
import { MeasurementOptions } from './MeasurementOptions';
import { MeasurementRecords, MeasurementDetails } from './MeasurementRecords';
import './measurement.css';

type Props = {
  mapRef: MutableRefObject<L.Map | null>; enabled: boolean; locale: Locale; onClose: () => void;
  session: MeasurementSession; dispatch: Dispatch<MeasureAction>; sources: MeasureGeometry[]; selected?: MeasureGeometry;
};
export function MapMeasurement({ mapRef, enabled, locale, session, dispatch, sources, selected, onClose }: Props): JSX.Element | null {
  const [collapsed, setCollapsed] = useState(false), [snap, setSnap] = useState(true), [labels, setLabels] = useState(true);
  const [view, setView] = useState<'measure' | 'saved' | 'options'>('measure');
  const [units, setUnits] = useState(defaultMeasureUnits), [copyState, setCopyState] = useState<'ready' | 'copied' | 'error'>('ready');
  const root = useRef<HTMLElement>(null);
  const floating = useFloatingPanel(root, 'measure', enabled);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const close = () => { if (session.editing) dispatch({ type: 'cancel' }); onClose(); };
  const { hover, outside } = useMeasurementMap({ mapRef, enabled, session, dispatch, sources, snap, labels, units, locale, onClose: close });
  useEffect(() => { setCopyState('ready'); }, [session, units, locale]);
  const displayPoints = session.finished || !session.points.length ? session.points : measurementPreviewPoints(session.mode, session.points, hover?.point);
  const results = measurementResults(session.mode, displayPoints, units, locale);
  const finalResults = measurementResults(session.mode, session.points, units, locale);
  const canComplete = canFinish(session.mode, session.points);
  const copy = async () => {
    const report = [t(...modeNames[session.mode]), ...finalResults.map(([label, value]) => `${label}: ${value}`),
      ...(session.source ? [t('Đối tượng đo: ', 'Measured feature: ') + session.source] : []), 'EPSG:32648 (UTM 48N), WGS84',
      ...session.points.map((point, i) => `${i + 1}: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)} | E ${point.x.toFixed(1)} m, N ${point.y.toFixed(1)} m`)].join('\n');
    try { await navigator.clipboard.writeText(report); setCopyState('copied'); } catch { setCopyState('error'); }
  };
  if (!enabled) return null;
  const hint = outside ? t('Điểm nằm ngoài phạm vi đo UTM 48N.', 'Point is outside the UTM 48N measurement area.')
    : session.mode === 'area' && session.points.length >= 3 && !canComplete ? t('Các cạnh giao nhau. Hãy chỉnh lại các điểm.', 'Edges intersect. Adjust the points.')
    : session.mode === 'radius' && session.points.length === 2 && !canComplete ? t('Đường tròn vượt phạm vi đo UTM 48N.', 'The circle exceeds the UTM 48N measurement area.')
    : session.editing ? t('Kéo các điểm, sau đó chọn Áp dụng.', 'Drag points, then apply changes.')
    : session.finished ? ''
    : session.mode === 'location' ? t('Chọn vị trí trên bản đồ.', 'Select a position on the map.')
    : session.mode === 'angle' ? t('Chọn 3 điểm. Điểm thứ hai là đỉnh góc.', 'Select 3 points. The second is the angle vertex.')
    : session.mode === 'radius' ? t('Chọn tâm, sau đó chọn điểm trên đường tròn.', 'Select the centre, then a point on the circle.')
    : session.mode === 'bearing' ? t('Chọn điểm đầu và điểm hướng tới.', 'Select the origin and destination.')
    : session.points.length < minimumPoints(session.mode) ? t(session.mode === 'area' ? 'Chọn ít nhất 3 điểm để khoanh vùng.' : 'Chọn điểm đầu và các điểm tiếp theo.', session.mode === 'area' ? 'Select at least 3 points for an area.' : 'Select the first point, then continue.')
    : t('Nhấp đúp điểm cuối hoặc nhấn Enter để kết thúc.', 'Double-click the last point or press Enter to finish.');
  return <section ref={root} className="map-measure-panel" data-collapsed={collapsed} data-stage={session.editing ? 'editing' : session.finished ? 'finished' : 'drawing'} aria-label={t('Đo bản đồ', 'Map measurement')}>
    <div className="map-measure-heading floating-panel-handle" {...floating} tabIndex={0} role="group" aria-label={t('Vị trí công cụ đo', 'Measurement panel position')} aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home" title={t('Kéo để đổi vị trí. Nhấp đúp để đặt lại.', 'Drag to move. Double-click to reset.')}>
      <strong>{t('Đo bản đồ', 'Map measurement')}</strong>
      <button className="icon-button" aria-label={t('Tùy chọn đo', 'Measurement settings')} title={t('Tùy chọn đo', 'Measurement settings')} aria-expanded={view === 'options' && !collapsed} aria-controls="measurement-options" onClick={() => { setCollapsed(false); setView(value => value === 'options' ? 'measure' : 'options'); }}><UiIcon name="settings" size={16}/></button>
      <button className="icon-button" aria-label={collapsed ? t('Mở rộng công cụ đo', 'Expand measurement') : t('Thu gọn công cụ đo', 'Collapse measurement')} aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}><UiIcon name={collapsed ? 'expand' : 'collapse'} size={16}/></button>
      <button className="icon-button" aria-label={t('Đóng công cụ đo', 'Close measurement')} onClick={close}><UiIcon name="close" size={16}/></button>
    </div>
    {collapsed ? <button className="map-measure-compact" onClick={() => setCollapsed(false)}><span>{t(...modeNames[session.mode])}</span><strong>{results[0]?.[1] ?? t('Chọn điểm', 'Select points')}</strong></button> : <>
      <label className="map-measure-type"><span>{t('Kiểu đo', 'Measurement type')}</span><select aria-label={t('Kiểu đo', 'Measurement type')} value={session.mode} onChange={event => { dispatch({ type: 'mode', mode: event.target.value as MeasureMode }); setView('measure'); }}>
        {Object.entries(modeNames).map(([mode, name]) => <option key={mode} value={mode}>{t(...name)}</option>)}
      </select></label>
      <div className="measure-tabs" aria-label={t('Nội dung công cụ đo', 'Measurement views')}>
        <button aria-pressed={view === 'measure'} aria-controls="measurement-result-view" onClick={() => setView('measure')}>{t('Phép đo', 'Measurement')}</button>
        <button aria-pressed={view === 'saved'} aria-controls="measurement-saved-view" onClick={() => setView('saved')}>{t('Kết quả', 'Results')}{session.saved.length > 0 && <span>{session.saved.length}</span>}</button>
      </div>
      <div className="measure-body" id="measurement-result-view" hidden={view !== 'measure'}>
        <div className="measure-result-header">
        <dl className="map-measure-result" data-empty={!results.length} aria-label={t('Kết quả đo', 'Measurement result')}>
          {(results.length ? results : [[t(...modeNames[session.mode]), t('Chưa đo', 'No measurement')]]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        {session.finished && !session.editing && <button className="icon-button measure-copy" onClick={copy} aria-label={copyState === 'copied' ? t('Đã sao chép', 'Copied') : t('Sao chép kết quả', 'Copy results')} title={copyState === 'copied' ? t('Đã sao chép', 'Copied') : t('Sao chép kết quả', 'Copy results')}><UiIcon name={copyState === 'copied' ? 'check' : 'copy'} size={16}/></button>}
        </div>
        <p className="map-measure-context map-measure-source" title={session.source ?? hover?.name}>{session.source ?? (hover?.name && !session.finished ? t('Bắt điểm: ', 'Snapped: ') + hover.name : '')}</p>
        <p className="map-measure-hint" role="status">{copyState === 'error' ? t('Không sao chép được. Hãy chọn trực tiếp kết quả.', 'Copy failed. Select the result text directly.') : hint}</p>
        {selected && <button className="text-button measure-feature" disabled={session.editing} title={selected.name} onClick={() => dispatch({ type: 'import', points: selected.points, mode: selected.closed ? 'area' : 'distance', source: selected.name })}>{selected.kind === 'road' ? t('Đo đoạn đường', 'Measure road segment') : selected.kind === 'aoi' ? t('Đo vùng đánh giá', 'Measure assessment area') : t('Đo tuyến đang xem', 'Measure selected route')}</button>}
        <MeasurementDetails session={session} units={units} locale={locale}/>
      </div>
      <div className="measure-body" id="measurement-options" role="group" aria-label={t('Tùy chọn đo', 'Measurement settings')} hidden={view !== 'options'}>
        <MeasurementOptions mode={session.mode} units={units} onUnits={setUnits} snap={snap} onSnap={setSnap} labels={labels} onLabels={setLabels} locale={locale}/>
      </div>
      <div className="measure-body" id="measurement-saved-view" hidden={view !== 'saved'}>
        <MeasurementRecords session={session} dispatch={dispatch} units={units} locale={locale}/>
      </div>
      <div className="map-measure-actions">
        {session.finished && !session.editing ? <>
          <button className="button" onClick={() => { dispatch({ type: 'edit' }); setView('measure'); }}>{t('Chỉnh sửa', 'Edit')}</button>
          <button className="button primary" onClick={() => { dispatch({ type: 'new' }); setView('measure'); }}>{t('Đo mới', 'New')}</button>
        </> : <>
          <button className="icon-button" title={t('Hoàn tác (Ctrl+Z)', 'Undo (Ctrl+Z)')} aria-label={t('Hoàn tác', 'Undo')} disabled={!session.undo.length} onClick={() => dispatch({ type: 'undo' })}><UiIcon name="undo" size={16}/></button>
          <button className="icon-button measure-redo" title={t('Làm lại (Ctrl+Y)', 'Redo (Ctrl+Y)')} aria-label={t('Làm lại', 'Redo')} disabled={!session.redo.length} onClick={() => dispatch({ type: 'redo' })}><UiIcon name="undo" size={16}/></button>
          <button className="text-button" disabled={!session.points.length} onClick={() => dispatch({ type: 'cancel' })}>{t('Hủy', 'Cancel')}</button>
          <button className="button primary" disabled={!canComplete} onClick={() => { dispatch({ type: 'finish' }); setView('measure'); }}>{session.editing ? t('Áp dụng', 'Apply changes') : t('Kết thúc', 'Finish')}</button>
        </>}
      </div>
    </>}
  </section>;
}
