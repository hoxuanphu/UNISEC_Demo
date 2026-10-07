import type { Community, IncidentModel, Locale } from '../../types/dear';
import { localClock } from '../../features/incident/sourceTime';
import { communityAccessText } from '../../features/routes/accessAssessment';
import { StatusText } from '../../shared/ui/StatusText';
import type { ResponseAssessment } from '../../features/incident/responseAssessment';
import type { ScenarioRoutePair } from '../../types/dear';

type Props = {
  incident: IncidentModel; locale: Locale; updated: boolean; areaName: [vi: string, en: string];
  communities: Community[];
  routes: Map<string, ScenarioRoutePair>;
  assessments: Map<string, ResponseAssessment>;
  blockedRoadCount: number; uncertainRoadCount: number;
  onSelectCommunity: (id: string) => void;
  onOpenTimeline: () => void; onOpenData: () => void;
  onOpenCommunities: () => void; onOpenRoads: (filter: 'blocked' | 'uncertain') => void;
  onOpenArea: () => void;
};

export function IncidentView({ incident, locale, updated, areaName, communities, routes, assessments, blockedRoadCount, uncertainRoadCount, onSelectCommunity, onOpenTimeline, onOpenData, onOpenCommunities, onOpenRoads, onOpenArea }: Props): JSX.Element {
  const t = (vi: string, en: string) => locale === 'en' ? en : vi;
  const asOf = updated ? incident.asOfUpdated : incident.asOf;
  const priorityCommunities = communities.filter(community => community.prio === 1);
  return <>
    <div className="sidebar-top incident-head">
      <h1>{incident.title ? t(...incident.title) : t('Sự kiện', 'Incident')}</h1>
      <div className="incident-status">
        <button className="text-button incident-area-link" onClick={onOpenArea}>{t(...areaName)}</button>
      </div>
      <dl className="incident-timing">
        <div><dt>{t('Cảnh báo', 'Triggered')}</dt><dd><time dateTime={incident.triggeredAt}>{localClock(incident.triggeredAt)}</time></dd></div>
        <div><dt>{t('Dữ liệu đến', 'Data as of')}</dt><dd><time dateTime={asOf}>{localClock(asOf)}</time></dd></div>
      </dl>
    </div>
    <div className="sidebar-scroll">
      <section className="workflow-section">
        <div className="section-line"><h3>{t('Địa bàn ưu tiên', 'Priority communities')}</h3><button className="text-button section-link incident-all-communities" onClick={onOpenCommunities}>{t('Tất cả địa bàn', 'All communities')} ({communities.length})</button></div>
        <div className="incident-priority-list">
          {priorityCommunities.map(community => {
            const assessment = assessments.get(community.id);
            return <button className="incident-priority-row" key={community.id} onClick={() => onSelectCommunity(community.id)}>
              <span><strong>{community.name}</strong><small className="priority-next-action">{t(...(assessment?.reason ?? communityAccessText(routes.get(community.id))))}</small></span>
            </button>;
          })}
        </div>
      </section>
      <section className="workflow-section incident-road-summary">
        <h3>{t('Tình trạng đường', 'Road conditions')}</h3>
        <button className="road-count-row" onClick={() => onOpenRoads('blocked')}><StatusText tone="critical" icon="blocked">{t('Bị chặn', 'Blocked')}</StatusText><span>{blockedRoadCount} {t('đoạn', blockedRoadCount === 1 ? 'section' : 'sections')}</span></button>
        <button className="road-count-row" onClick={() => onOpenRoads('uncertain')}><StatusText tone="warning" icon="uncertain">{t('Cần xác minh', 'To verify')}</StatusText><span>{uncertainRoadCount} {t('đoạn', uncertainRoadCount === 1 ? 'section' : 'sections')}</span></button>
      </section>
      <div className="incident-detail-actions">
        <button className="text-button" onClick={onOpenTimeline}>{t('Diễn biến sự kiện', 'Analysis timeline')}</button>
        <button className="text-button" onClick={onOpenData}>{t('Nguồn dữ liệu', 'Data sources')}</button>
      </div>
    </div>
  </>;
}
