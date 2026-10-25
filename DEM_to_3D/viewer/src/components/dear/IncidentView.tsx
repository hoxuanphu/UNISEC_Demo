import { useRef } from 'react';
import type { Community, Hazard, IncidentModel, Locale, RoadSegment } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import type { ResponseAssessment } from '../../features/incident/responseAssessment';
import type { ScenarioRoutePair } from '../../types/dear';
import { roadHazardIds } from '../../features/incident/roadHazards';
import { PhotoThumb } from '../../features/fieldPhotos/PhotoThumb';
import type { PreparedPhotoPoint } from '../../features/fieldPhotos/preparedPhotos';
import '../../features/incident/incident-panel.css';
import { householdsOfConcern, householdStatusText, householdStatusTone, type HouseholdView } from '../../features/presence/householdStatus';
import {
  workState,
  type ResponseWork,
  type WorkEntry
} from '../../features/incident/responseWork';

type Props = {
  incident: IncidentModel;
  hazards: Hazard[];
  roads: RoadSegment[];
  fieldPhotos?: Map<string, PreparedPhotoPoint>;
  onInspectObject: (id: string) => void;
  locale: Locale;
  areaName: [vi: string, en: string];
  tasks: ResponseWork[];
  entries: WorkEntry[];
  reportPending: boolean;
  pendingReport?: [vi: string, en: string];
  historical: boolean;
  onOpenWork: (id?: string) => void;
  onOpenReport: () => void;
  communities: Community[];
  routes: Map<string, ScenarioRoutePair>;
  assessments: Map<string, ResponseAssessment>;
  onSelectCommunity: (id: string) => void;
  onOpenCommunities: () => void;
  onOpenRoads: (filter: 'blocked' | 'uncertain') => void;
  onOpenArea: () => void;
  residentDevices?: import('react').ReactNode;
  /** Field huts the resident app places people at, with where each stands. */
  households?: HouseholdView[];
  onSelectHousehold?: (id: string) => void;
  onShowHouseholds?: () => void;
};

/** A compact field summary; counts are independent facts, not a causal diagram. */
export function IncidentView({
  incident, locale, areaName, tasks, entries, communities, onSelectCommunity, onOpenWork, onOpenArea,
  hazards, roads, fieldPhotos, onInspectObject, reportPending, pendingReport,
  onOpenReport, historical, onOpenRoads, onOpenCommunities, residentDevices, households = [], onSelectHousehold, onShowHouseholds
}: Props): JSX.Element {
  const householdSection = useRef<HTMLElement>(null);
  const t = (vi: string, en: string) => locale === 'en' ? en : vi;
  // English counts agree with their noun; Vietnamese has no plural form.
  const tn = (count: number, vi: string, one: string, many: string) => locale === 'en' ? (count === 1 ? one : many) : vi;
  const number = (value: number) => value.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB');
  // Along-road order, as a responder meets them from the staging point.
  const order = roads.flatMap(roadHazardIds);
  const landslides = hazards.filter(hazard => hazard.kind === 'landslide')
    .sort((a, b) => (order.indexOf(a.id) + 1 || 1e9) - (order.indexOf(b.id) + 1 || 1e9));
  const blocked = roads.filter(road => road.status === 'blocked'), uncertain = roads.filter(road => road.status === 'uncertain');
  const priority = communities.filter(community => community.prio === 1);
  const openTasks = tasks.filter(task => task.kind !== 'report' && workState(task, entries).status !== 'done');
  const activeTasks = openTasks.filter(task => workState(task, entries).status === 'active');
  const concern = historical ? [] : householdsOfConcern(households).filter(item=>item.status!=='rescued');
  const isolated = concern.filter(item => item.status === 'cut-off' || item.status === 'team');
  return <>
    <div className="sidebar-top incident-overview-heading">
      <div className="detail-title">
        <h1>{incident.title ? t(...incident.title) : t('Sạt lở và tiếp cận', 'Landslides and access')}</h1>
        <button className="icon-button" aria-label={t('Xem phạm vi trên bản đồ', 'Show response area')} title={t(...areaName)} onClick={onOpenArea}><UiIcon name="fit" size={18}/></button>
      </div>
      {/* What happened, what it cuts, and who is waiting: each figure opens its list. */}
      <div className="incident-summary" aria-label={t('Thống kê', 'Summary')}>
        <div className="incident-summary-fact">
          <span>{t('Sạt lở', 'Landslides')}</span>
          <strong>{landslides.length}</strong>
        </div>
        <button className="incident-summary-fact" data-tone={blocked.length ? 'critical' : uncertain.length ? 'warning' : undefined} disabled={!blocked.length && !uncertain.length} onClick={() => onOpenRoads(blocked.length ? 'blocked' : 'uncertain')}>
          <span>{blocked.length || !uncertain.length ? t('Đoạn bị chặn', 'Blocked sections') : t('Đoạn cần xác minh', 'Sections to verify')}</span>
          <strong>{blocked.length || uncertain.length}</strong>
        </button>
        {/* Who is waiting: people the app still sees cut off, when known; otherwise the priority villages. */}
        {isolated.length > 0 ? <button className="incident-summary-fact" data-tone="critical" onClick={() => { onShowHouseholds?.(); householdSection.current?.scrollIntoView({block:"nearest",inline:"nearest"}); }}>
          <span>{t('Hộ bị cô lập', 'Isolated households')}</span>
          <strong>{number(isolated.reduce((sum, item) => sum + item.cluster.households, 0))}</strong>
          <small>{t(`${number(isolated.reduce((sum, item) => sum + item.cluster.people, 0))} người`, `${number(isolated.reduce((sum, item) => sum + item.cluster.people, 0))} people`)}</small>
        </button> : <button className="incident-summary-fact" disabled={!priority.length} onClick={() => priority.length === 1 ? onSelectCommunity(priority[0].id) : onOpenCommunities()}>
          <span>{t('Địa bàn ưu tiên', 'Priority communities')}</span>
          <strong>{priority.length}</strong>
          {priority.length > 0 && <small>{t(`${number(priority.reduce((sum, community) => sum + community.pop, 0))} người`, `${number(priority.reduce((sum, community) => sum + community.pop, 0))} people`)}</small>}
        </button>}
      </div>
    </div>
    <div className="sidebar-scroll incident-overview">



      {residentDevices}

      {/* People the app places at huts who need a responder, most urgent first, each with where it stands. */}
      {concern.length > 0 && <section className="incident-households" ref={householdSection}>
        <h2 className="incident-section-title"><span>{t('Hộ dân', 'Households')}</span><small>{t(`${number(concern.reduce((sum, item) => sum + item.cluster.people, 0))} người`, `${number(concern.reduce((sum, item) => sum + item.cluster.people, 0))} people`)}</small></h2>
        <div className="incident-landslide-list">
          {concern.map(item => <button className="incident-landslide-row incident-household-row" key={item.cluster.id} onClick={() => onSelectHousehold?.(item.cluster.id)}>
            <span className="incident-household-icon" data-status={item.status}><UiIcon name="people" size={20}/></span>
            <span className="incident-landslide-copy"><strong title={t(...item.cluster.name)}>{t(...item.cluster.name)}</strong><small>{t(`${item.cluster.people} người, ${item.cluster.households} hộ`, `${item.cluster.people} people, ${item.cluster.households} households`)}</small></span>
            <small className="incident-status" data-tone={householdStatusTone[item.status]}>{t(...householdStatusText[item.status])}</small>
          </button>)}
        </div>
      </section>}

      {!historical && reportPending && <button className="incident-report-review" onClick={onOpenReport}>
        <UiIcon name="bell" size={18}/><span><strong>{t('Báo cáo mới chờ kiểm tra', 'New report to review')}</strong>
        {pendingReport && <small>{t(...pendingReport)}</small>}</span><UiIcon name="next" size={16}/>
      </button>}

      {/* Landslides first: what happened, with its survey photos. */}
      <section className="incident-landslides">
        <h2 className="incident-section-title">{t('Điểm sạt lở', 'Landslides')}</h2>
        <div className="incident-landslide-list">
        {landslides.map(hazard => <button className="incident-landslide-row" data-map-preview={'hazard:' + hazard.id} key={hazard.id} onClick={() => onInspectObject('hazard:' + hazard.id)}>
          <PhotoThumb photo={fieldPhotos?.get(hazard.id)?.photos[0]}/>
          <span className="incident-landslide-copy"><strong>{t(...hazard.name)}</strong>{hazard.area != null && <small>{number(hazard.area)} ha</small>}</span>
          <small className="incident-status" data-tone={hazard.observation === 'reported' ? 'critical' : 'warning'}>{hazard.observation === 'reported' ? t('Có báo cáo', 'Reported') : t('Chưa kiểm chứng', 'Unverified')}</small>
        </button>)}
        </div>
      </section>

      <section className="incident-overview-work incident-work">
        <h2 className="incident-section-title"><span>{t('Xác minh và cứu trợ', 'Verification and relief')}</span></h2>
        <button className="incident-overview-item incident-work-row" onClick={() => onOpenWork()}>
          <div className="incident-work-copy">
            <strong>{historical ? t('Xem công việc', 'View work records') : `${openTasks.length} ${tn(openTasks.length, 'việc chưa hoàn tất', 'open task', 'open tasks')}`}</strong>
            {!historical && activeTasks.length > 0 && <small>{activeTasks.length} {t('đang xử lý', 'in progress')}</small>}
          </div>
          <UiIcon name="next" size={16}/>
        </button>
      </section>
    </div>
  </>;
}
