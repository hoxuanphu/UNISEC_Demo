import { useState, type Dispatch } from 'react';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { DisclosureTrigger } from '../../shared/ui/DisclosureTrigger';
import { horizontalLength } from './measurement';
import type { MeasureAction, MeasurementSession } from './measurementSession';
import { formatDistance, measurementResults, modeNames, type MeasureUnits } from './measurementResults';

type Props = { session: MeasurementSession; units: MeasureUnits; locale: Locale };
export function MeasurementDetails({ session, units, locale }: Props) {
  const [open, setOpen] = useState(false);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const hasSegments = session.mode === 'distance' && session.points.length > 1;
  const hasCoordinates = session.mode === 'location' && session.points.length > 0;
  if (!hasSegments && !hasCoordinates) return null;
  return <div className="measure-details">
    <DisclosureTrigger className="measure-detail-toggle" expanded={open} aria-controls="measurement-details" onClick={() => setOpen(value => !value)}>{hasSegments ? t('Chi tiết từng đoạn', 'Segment details') : 'UTM 48N'}</DisclosureTrigger>
    {open && <div id="measurement-details">{hasSegments ? <table><thead><tr><th>{t('Đoạn', 'Segment')}</th><th>{t('Chiều dài', 'Length')}</th></tr></thead><tbody>{session.points.slice(1).map((point, index) => <tr key={index}><td>{t('Đoạn ', 'Segment ') + (index + 1)}</td><td>{formatDistance(horizontalLength([session.points[index], point]), units, locale)}</td></tr>)}</tbody></table> : <dl className="measure-coordinate-grid"><div><dt>E</dt><dd>{session.points[0].x.toFixed(1)} m</dd></div><div><dt>N</dt><dd>{session.points[0].y.toFixed(1)} m</dd></div></dl>}</div>}
  </div>;
}

export function MeasurementRecords({ session, dispatch, units, locale }: Props & { dispatch: Dispatch<MeasureAction> }) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  return <div className="measure-history">
    {!session.saved.length && <p className="measure-empty">{t('Chưa có kết quả.', 'No results.')}</p>}
    {session.saved.map(item => <div className="measure-history-row" key={item.id}><label><input type="checkbox" checked={item.visible} onChange={() => dispatch({ type: 'visible', id: item.id })}/><span><strong>{t(...modeNames[item.mode])} {item.id}</strong><small>{measurementResults(item.mode, item.points, units, locale)[0]?.[1]}</small></span></label><button className="icon-button" aria-label={t('Xóa phép đo ', 'Delete measurement ') + item.id} onClick={() => dispatch({ type: 'delete', id: item.id })}><UiIcon name="trash" size={16}/></button></div>)}
    {session.saved.length > 0 && <button className="text-button measure-feature" disabled={session.editing} onClick={() => dispatch({ type: 'reset' })}>{t('Xóa toàn bộ phép đo', 'Clear all measurements')}</button>}
  </div>;
}
