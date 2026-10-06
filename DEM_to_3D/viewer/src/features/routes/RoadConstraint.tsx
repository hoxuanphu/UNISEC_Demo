import type { IncidentEvidence, Locale, RoadSegment } from '../../types/dear';
import { StatusText } from '../../shared/ui/StatusText';
import { localClock } from '../incident/sourceTime';
import { evidencePresentation } from '../incident/evidencePresentation';

export function RoadConstraint({ road, record, locale, onInspect }: {
  road: RoadSegment; record?: IncidentEvidence; locale: Locale; onInspect: () => void;
}): JSX.Element {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  return <button className="road-constraint" onClick={onInspect}>
    <span className="constraint-title"><strong>{t(...road.name)}</strong><StatusText tone={road.status === 'blocked' ? 'critical' : 'warning'} icon={road.status === 'blocked' ? 'blocked' : 'uncertain'}>{road.status === 'blocked' ? t('Bị chặn', 'Blocked') : t('Cần xác minh', 'Uncertain')}</StatusText></span>
    {record && <span className="constraint-observation">{t(...record.finding)}</span>}
    <small className="constraint-source">{record ? <>{evidencePresentation(record.type, locale).kind} · {evidencePresentation(record.type, locale).observed} <time dateTime={record.observedAt}>{localClock(record.observedAt)}</time></> : t('Chưa có báo cáo chi tiết', 'No detailed report')}</small>
  </button>;
}
