import type { Community, IncidentModel, Locale } from '../../types/dear';
import { localClock } from '../../features/incident/sourceTime';
import { communityAccessText } from '../../features/routes/accessAssessment';
import type { ResponseAssessment } from '../../features/incident/responseAssessment';
import type { ScenarioRoutePair } from '../../types/dear';

type Props = {
  incident: IncidentModel; locale: Locale; updated: boolean;
  communities: Community[];
  routes: Map<string, ScenarioRoutePair>;
  assessments: Map<string, ResponseAssessment>;
  blockedRoadCount: number; uncertainRoadCount: number;
  onSelectCommunity: (id: string) => void;
  onOpenTimeline: () => void; onOpenData: () => void;
  onOpenCommunities: () => void; onOpenRoads: () => void;
  onOpenArea: () => void;
};

export function IncidentView({ incident, locale, updated, communities, routes, assessments, blockedRoadCount, uncertainRoadCount, onSelectCommunity, onOpenTimeline, onOpenData, onOpenCommunities, onOpenRoads, onOpenArea }: Props): JSX.Element {
  const t = (vi: string, en: string) => locale === 'en' ? en : vi;
  const asOf = updated ? incident.asOfUpdated : incident.asOf;
  const priorityCommunities = communities.filter(community => community.prio === 1);
  return <>
    <div className="sidebar-top">
      <h1>{t('Sạt lở, nguy cơ lũ quét', 'Landslide and flash-flood risk')}</h1>
      <div className="incident-status">
        <button className="text-button incident-area-link" onClick={onOpenArea}>{t('Vùng đánh giá Nậm Kha', 'Nậm Kha assessment area')}</button>
      </div>
    </div>
    <div className="sidebar-scroll">
      <section className="workflow-section">
        <div className="section-line"><h3>{t('Cần xử lý trước', 'Immediate priorities')}</h3></div>
        <div className="incident-priority-list">
          {priorityCommunities.map(community => {
            return <button className="incident-priority-row" key={community.id} onClick={() => onSelectCommunity(community.id)}>
              <span><strong>{community.name}</strong><small>{t(...(assessments.get(community.id)?.reason ?? communityAccessText(routes.get(community.id))))}</small>{assessments.get(community.id) && <small className="priority-next-action">{t(...assessments.get(community.id)!.nextAction)}</small>}</span>
            </button>;
          })}
        </div>
        <button className="text-button incident-all-communities" onClick={onOpenCommunities}>{t('Danh sách địa bàn', 'Community list')} ({communities.length})</button>
      </section>
      <section className="workflow-section incident-road-summary">
        <h3>{t('Tình trạng đường', 'Road conditions')}</h3>
        <p>{blockedRoadCount} {t('đoạn bị chặn', 'blocked segments')} · {uncertainRoadCount} {t('cần xác minh', 'need verification')}</p>
        <button className="text-button" onClick={onOpenRoads}>{t('Xem tình trạng đường', 'Review road conditions')}</button>
      </section>
      <section className="workflow-section incident-data-summary">
        <dl>
          <div><dt>{t('Kích hoạt', 'Triggered')}</dt><dd><time dateTime={incident.triggeredAt}>{localClock(incident.triggeredAt)}</time></dd></div>
          <div><dt>{t('Tổng hợp lúc', 'Data as of')}</dt><dd><time dateTime={asOf}>{localClock(asOf)}</time> <small>UTC+7</small></dd></div>
        </dl>
        <div className="incident-detail-actions">
          <button className="text-button" onClick={onOpenTimeline}>{t('Diễn biến sự kiện', 'Analysis timeline')}</button>
          <button className="text-button" onClick={onOpenData}>{t('Nguồn dữ liệu', 'Data sources')}</button>
        </div>
      </section>
    </div>
  </>;
}
