import type { Hazard, IncidentEvidence, Locale, RoadSegment } from '../../types/dear';
import { MapSymbol } from '../../shared/ui/MapSymbol';
import { UiIcon } from '../../shared/ui/UiIcon';
import { StatusText } from '../../shared/ui/StatusText';
import { localClock } from '../incident/sourceTime';
import { evidencePresentation } from '../incident/evidencePresentation';

export function RoadConstraint({ road, routeName, hazard, record, locale, onInspect }: {
  road: RoadSegment; routeName?: string; hazard?: Hazard; record?: IncidentEvidence; locale: Locale; onInspect: () => void;
}): JSX.Element {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  // Under a route heading, "Route name, section" reads as "Section".
  const name = t(...road.name), prefix = routeName ? `${routeName}, ` : '';
  const title = prefix && name.startsWith(prefix) ? name.slice(prefix.length).replace(/^./, c => c.toLocaleUpperCase()) : name;
  // Same symbol and tone as the map marker, so the row and the point read as one object.
  return <button className={'road-constraint is-' + road.status} onClick={onInspect}>
    <span className="constraint-symbol" aria-hidden="true">{hazard ? <MapSymbol name={hazard.kind} size={16}/> : <UiIcon name={road.status === 'blocked' ? 'blocked' : 'uncertain'} size={16}/>}</span>
    <span className="constraint-title"><strong title={name}>{title}</strong>{road.status === 'blocked' && <StatusText tone="critical" icon="blocked">{t('Bị chặn', 'Blocked')}</StatusText>}</span>
    {record && <span className="constraint-observation">{t(...record.finding)}</span>}
    <small className="constraint-source">{record ? <>{evidencePresentation(record.type, locale).kind} · {evidencePresentation(record.type, locale).observed} <time dateTime={record.observedAt}>{localClock(record.observedAt)}</time></> : t('Chưa có báo cáo chi tiết', 'No detailed report')}</small>
  </button>;
}
