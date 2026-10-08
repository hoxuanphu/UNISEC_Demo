import { useLayoutEffect, useRef } from 'react';
import type { IncidentEvidence, Locale, ScenarioRoute } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { StatusText } from '../../shared/ui/StatusText';
import { EvidenceMetadata } from '../incident/EvidenceMetadata';
import { evidencePresentation } from '../incident/evidencePresentation';
import { roadStatusLabels } from './roadStatus';

export function RouteSections({ route, evidence, locale, selectedId, onSelect, onInspect, onEvidence, onProfile, hasProfile }: {
  route: ScenarioRoute; evidence: IncidentEvidence[]; locale: Locale; selectedId: string | null;
  onSelect: (id: string | null) => void; onInspect: (id: string) => void;
  onEvidence: (id: string) => void; onProfile: () => void; hasProfile: boolean;
}): JSX.Element {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const routeName = t(...route.name);
  const sectionRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const row = sectionRef.current?.querySelector('.is-selected > .route-section-row');
    const scroll = sectionRef.current?.closest('.sidebar-scroll');
    if (!row || !scroll) return;
    const bounds = scroll.getBoundingClientRect(), target = row.getBoundingClientRect();
    // Preserve the reading position; reveal only a selection outside the visible panel.
    if (target.top < bounds.top) scroll.scrollTop += target.top - bounds.top;
    else if (target.bottom > bounds.bottom - 64) scroll.scrollTop += target.bottom - bounds.bottom + 64;
  }, [route.id, selectedId]);
  return <section ref={sectionRef} className="route-sections" aria-labelledby="route-sections-title">
    <h3 id="route-sections-title">{t('Các đoạn trên tuyến', 'Route sections')} <span>({route.segs.length})</span></h3>
    <ol className="route-section-list">
      {route.segs.map((road, index) => {
        const name = t(...road.name);
        const title = name.startsWith(routeName + ', ') ? name.slice(routeName.length + 2).replace(/^./, c => c.toLocaleUpperCase()) : name;
        const record = evidence.find(item => road.hz && item.hazardId === road.hz);
        const expanded = selectedId === road.id;
        return <li key={road.id} className={expanded ? 'is-selected' : ''} data-road-id={road.id}>
          <button className="route-section-row" aria-expanded={expanded} aria-controls={`section-${road.id}`} onClick={() => onSelect(expanded ? null : road.id)}>
            <span className="route-section-number" aria-hidden="true">{index + 1}</span>
            <strong className="route-section-name" title={name}>{title}</strong>
            <span className="route-section-meta"><small>{road.len} km</small><StatusText tone={road.status === 'blocked' ? 'critical' : road.status === 'uncertain' ? 'warning' : 'neutral'} icon={road.status === 'blocked' ? 'blocked' : road.status === 'uncertain' ? 'uncertain' : undefined}>
              {t(...roadStatusLabels[road.status])}
            </StatusText></span>
            <UiIcon name={expanded ? 'collapse' : 'expand'} size={14}/>
          </button>
          {expanded && <div id={`section-${road.id}`} className="route-section-detail">
            <p>{record ? t(...record.finding) : road.note ? t(...road.note) : t('Chưa có báo cáo cho đoạn này.', 'No report for this section.')}</p>
            {record && <EvidenceMetadata evidence={record} locale={locale}/>}
            <div className="route-section-tools">
              {road.hz && <button className="button" onClick={() => onEvidence(road.hz!)}><UiIcon name="info" size={14}/>{record ? evidencePresentation(record.type, locale).action : t('Thông tin ảnh hưởng', 'Impact details')}</button>}
              <button className="button" onClick={onProfile} disabled={!hasProfile}><UiIcon name="profile" size={14}/>{t('Mặt cắt', 'Profile')}</button>
              <button className="text-button" onClick={() => onInspect(`road:${road.id}`)}>{t('Chi tiết đoạn', 'Section details')}</button>
            </div>
          </div>}
        </li>;
      })}
    </ol>
  </section>;
}
