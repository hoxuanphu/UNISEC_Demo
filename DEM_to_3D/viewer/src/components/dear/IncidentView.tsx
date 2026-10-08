import type { Community, IncidentModel, Locale } from '../../types/dear';
import { localClock } from '../../features/incident/sourceTime';
import { communityAccessText } from '../../features/routes/accessAssessment';
import { StatusText } from '../../shared/ui/StatusText';
import { UiIcon } from '../../shared/ui/UiIcon';
import type { ResponseAssessment } from '../../features/incident/responseAssessment';
import type { ScenarioRoutePair } from '../../types/dear';
import '../../features/incident/incident-panel.css';
import {
  workState,
  workStatusText,
  type ResponseWork,
  type WorkEntry
} from '../../features/incident/responseWork';

type Props = {
  incident: IncidentModel;
  locale: Locale;
  updated: boolean;
  areaName: [vi: string, en: string];
  tasks: ResponseWork[];
  entries: WorkEntry[];
  reportPending: boolean;
  historical: boolean;
  onOpenWork: (id?: string) => void;
  onOpenReport: () => void;
  communities: Community[];
  routes: Map<string, ScenarioRoutePair>;
  assessments: Map<string, ResponseAssessment>;
  blockedRoadCount: number;
  uncertainRoadCount: number;
  onSelectCommunity: (id: string) => void;
  onOpenTimeline: () => void;
  onOpenData: () => void;
  onOpenCommunities: () => void;
  onOpenRoads: (filter: 'blocked' | 'uncertain') => void;
  onOpenArea: () => void;
};

export function IncidentView({
  incident,
  locale,
  updated,
  areaName,
  tasks,
  entries,
  reportPending,
  historical,
  onOpenWork,
  onOpenReport,
  communities,
  routes,
  assessments,
  blockedRoadCount,
  uncertainRoadCount,
  onSelectCommunity,
  onOpenTimeline,
  onOpenData,
  onOpenCommunities,
  onOpenRoads,
  onOpenArea
}: Props): JSX.Element {
  const t = (vi: string, en: string) => (locale === 'en' ? en : vi);
  const asOf = updated ? incident.asOfUpdated : incident.asOf;
  const priorityCommunities = communities.filter((community) => community.prio === 1);
  const open = tasks.filter((task) => workState(task, entries).status !== 'done');
  return (
    <>
      <div className="sidebar-top incident-head">
        <h1>{incident.title ? t(...incident.title) : t('Sự kiện', 'Incident')}</h1>
        <button className="text-button incident-area-link" onClick={onOpenArea}>
          {t(...areaName)}
        </button>
        <dl className="incident-timing">
          <div>
            <dt>{t('Mở đánh giá', 'Assessment opened')}</dt>
            <dd>
              <time dateTime={incident.triggeredAt}>{localClock(incident.triggeredAt)}</time>
            </dd>
          </div>
          <div>
            <dt>{t('Tổng hợp', 'Data as of')}</dt>
            <dd>
              <time dateTime={asOf}>{localClock(asOf)}</time>
            </dd>
          </div>
        </dl>
        {historical ? (
          <p className="incident-context-note">
            {t('Đang xem bản dữ liệu cũ', 'Viewing an older revision')}
          </p>
        ) : (
          reportPending && (
            <button className="incident-pending-report" onClick={onOpenReport}>
              <UiIcon name="uncertain" size={16} />
              {t('Có báo cáo mới chưa cập nhật bản đồ', 'New report awaiting map update')}
            </button>
          )
        )}
      </div>
      <div className="sidebar-scroll incident-body">
        <section className="incident-section incident-work" aria-labelledby="incident-work-heading">
          <div className="incident-section-heading">
            <h3 id="incident-work-heading">{t('Việc cần xử lý', 'Response work')}</h3>
            <button className="text-button incident-all-communities" onClick={() => onOpenWork()}>
              {t('Tất cả', 'All')} ({open.length})
            </button>
          </div>
          {open
            .filter((task) => task.kind !== 'report')
            .slice(0, 2)
            .map((task) => (
              <button
                className="incident-work-row"
                key={task.id}
                onClick={() => onOpenWork(task.id)}
              >
                <span>
                  <strong>{t(...task.title)}</strong>
                  <small>{t(...workStatusText[workState(task, entries).status])}</small>
                </span>
              </button>
            ))}
          {!open.length && (
            <p className="small">
              {t(
                'Không có việc chưa hoàn tất trong danh sách hiện tại.',
                'No open work in the current list.'
              )}
            </p>
          )}
        </section>
        <section className="incident-section" aria-labelledby="incident-priority-heading">
          <div className="incident-section-heading">
            <h3 id="incident-priority-heading">{t('Địa bàn ưu tiên', 'Priority communities')}</h3>
            <button
              className="text-button incident-all-communities"
              onClick={onOpenCommunities}
              aria-label={`${t('Tất cả địa bàn', 'All communities')} (${communities.length})`}
            >
              {t('Tất cả', 'All')} ({communities.length})
            </button>
          </div>
          <div className="incident-priority-list">
            {priorityCommunities.map((community) => {
              const assessment = assessments.get(community.id);
              return (
                <button
                  className="incident-priority-row"
                  key={community.id}
                  onClick={() => onSelectCommunity(community.id)}
                >
                  <span>
                    <strong>{community.name}</strong>
                    <small className="priority-next-action">
                      {t(...(assessment?.reason ?? communityAccessText(routes.get(community.id))))}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <section
          className="incident-section incident-road-summary"
          aria-labelledby="incident-road-heading"
        >
          <div className="incident-section-heading">
            <h3 id="incident-road-heading">{t('Tình trạng đường', 'Road conditions')}</h3>
          </div>
          <button className="road-count-row" onClick={() => onOpenRoads('blocked')}>
            <StatusText tone="critical" icon="blocked">
              {t('Bị chặn', 'Blocked')}
            </StatusText>
            <span>
              {blockedRoadCount} {t('đoạn', blockedRoadCount === 1 ? 'section' : 'sections')}
            </span>
          </button>
          <button className="road-count-row" onClick={() => onOpenRoads('uncertain')}>
            <StatusText tone="warning" icon="uncertain">
              {t('Cần xác minh', 'To verify')}
            </StatusText>
            <span>
              {uncertainRoadCount} {t('đoạn', uncertainRoadCount === 1 ? 'section' : 'sections')}
            </span>
          </button>
        </section>
        <div className="incident-detail-actions">
          <button className="text-button" onClick={onOpenTimeline}>
            {t('Nhật ký sự kiện', 'Incident journal')}
          </button>
          <button className="text-button" onClick={onOpenData}>
            {t('Nguồn dữ liệu', 'Data sources')}
          </button>
        </div>
      </div>
    </>
  );
}
