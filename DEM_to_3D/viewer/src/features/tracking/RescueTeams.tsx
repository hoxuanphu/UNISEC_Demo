import { useSyncExternalStore } from 'react';
import type { Locale } from '../../types/dear';
import { StatusText } from '../../shared/ui/StatusText';
import { UiIcon } from '../../shared/ui/UiIcon';
import type { LocationFeed, DevicePosition } from './deviceFeed';
import type { RescueBase } from './rescueBase';
import { deviceStatusText } from './trackingOverlay';
import { RescueCross } from './deviceSymbols';
import './rescue-teams.css';

const noSubscription = () => () => undefined;
const IDLE = ['dispatching', 'arrived'];

/** The teams, re-read when one changes state or road: not on every movement frame. */
function useTeams(feed: LocationFeed | null): DevicePosition[] {
  useSyncExternalStore(feed?.subscribe ?? noSubscription, () => feed?.getSnapshot().filter(device => device.role === 'rescue')
    .map(device => `${device.id}:${device.state}:${device.roadId}`).join('|') ?? '');
  return feed?.getSnapshot().filter(device => device.role === 'rescue') ?? [];
}

/** One short word for the list; the full sentence is in the detail. */
export function teamStatus(team: DevicePosition, locale: Locale): { text: string; tone: 'active' | 'warning' | 'neutral' } {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  switch (team.state) {
    // Same words as the detail, shortened: the list and the panel never disagree.
    case 'dispatching': return { text: t('Chờ điều động', 'Awaiting dispatch'), tone: 'neutral' };
    case 'responding': return { text: t('Đang tới', 'Responding'), tone: 'active' };
    case 'assisting': return { text: t('Đang hỗ trợ', 'Assisting'), tone: 'active' };
    case 'waiting': return { text: t('Chờ tiếp cận', 'Awaiting access'), tone: 'warning' };
    case 'escorting': return { text: t('Đang đưa về', 'Escorting'), tone: 'active' };
    case 'moving': return { text: t('Đang về', 'Returning'), tone: 'neutral' };
    case 'arrived': return { text: t('Đã về', 'Back at base'), tone: 'neutral' };
    default: return { text: deviceStatusText(team, locale), tone: 'neutral' };
  }
}

/** What the team was sent for: a hut cluster by name, or a resident stopped at a closure. */
export function teamTask(team: DevicePosition, locale: Locale): string {
  const name = team.targetName?.[locale === 'vi' ? 0 : 1] ?? '';
  return team.missionId?.startsWith('household:') ? name : locale === 'vi' ? `${name} tại đoạn chặn` : `${name} at a closure`;
}

/** The rescue tab: how many teams and where they stand, then each team, then the assembly points. */
export function RescueView({ feed, bases, locale, selectedId, onSelectTeam, onSelectBase, onShowAll }: {
  feed: LocationFeed | null; bases: readonly RescueBase[]; locale: Locale; selectedId?: string | null;
  onSelectTeam: (id: string) => void; onSelectBase: (id: string) => void; onShowAll: () => void;
}): JSX.Element {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const teams = useTeams(feed);
  const out = teams.filter(team => !IDLE.includes(team.state)).length;
  const waiting = teams.filter(team => team.state === 'waiting').length;
  return <>
    <div className="sidebar-top incident-overview-heading">
      <div className="detail-title">
        <h1>{t('Cứu hộ', 'Rescue')}</h1>
        <button className="icon-button" aria-label={t('Xem các đội trên bản đồ', 'Show teams on the map')} title={t('Xem các đội trên bản đồ', 'Show teams on the map')} disabled={!teams.length} onClick={onShowAll}><UiIcon name="fit" size={18}/></button>
      </div>
      <div className="incident-summary" aria-label={t('Thống kê', 'Summary')}>
        <div className="incident-summary-fact"><span>{t('Đội cứu hộ', 'Rescue teams')}</span><strong>{teams.length}</strong></div>
        <div className="incident-summary-fact"><span>{t('Đang làm nhiệm vụ', 'Deployed')}</span><strong>{out}</strong></div>
        <div className="incident-summary-fact" data-tone={waiting ? 'warning' : undefined}><span>{t('Chờ tiếp cận', 'Awaiting access')}</span><strong>{waiting}</strong></div>
      </div>
    </div>
    <div className="sidebar-scroll incident-overview">
      {teams.length ? <RescueTeamList feed={feed} locale={locale} onSelect={onSelectTeam} selectedId={selectedId} counted={false}/>
        : <p className="detail-empty">{t('Chưa có đội cứu hộ nào được theo dõi.', 'No rescue teams are being tracked.')}</p>}
      {bases.length > 0 && <section className="rescue-bases">
        <h2 className="incident-section-title">{t('Điểm tập kết', 'Assembly points')}</h2>
        <div className="incident-landslide-list">
          {bases.map(base => {
            const count = teams.filter(team => team.baseId === base.id).length;
            return <button className="incident-landslide-row rescue-base-row" key={base.id} aria-current={selectedId === `poi:${base.id}` || undefined} onClick={() => onSelectBase(base.id)}>
              <span className="rescue-base-symbol" aria-hidden="true"><UiIcon name="location" size={18}/></span>
              <span className="incident-landslide-copy"><strong>{base.name[locale === 'vi' ? 0 : 1]}</strong>
                <small>{count ? t(`${count} đội`, `${count} ${count === 1 ? 'team' : 'teams'}`) : t('Chưa có đội', 'No team')}</small></span>
              <UiIcon name="next" size={16}/>
            </button>;
          })}
        </div>
      </section>}
    </div>
  </>;
}

/** Every rescue team at a glance: who, sent where, doing what. Optionally those of one assembly point. */
export function RescueTeamList({ feed, locale, onSelect, baseId, title, selectedId, counted = true }: {
  feed: LocationFeed | null; locale: Locale; onSelect: (id: string) => void; baseId?: string; title?: string; selectedId?: string | null;
  /** Off where a summary above already gives the count. */
  counted?: boolean;
}): JSX.Element | null {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const teams = useTeams(feed).filter(team => !baseId || team.baseId === baseId);
  if (!teams.length) return null;
  const out = teams.filter(team => !IDLE.includes(team.state)).length;
  return <section className="rescue-teams">
    <h2 className="incident-section-title"><span>{title ?? t('Đội cứu hộ', 'Rescue teams')}</span>
      {counted && <small>{t(`${out}/${teams.length} đang làm nhiệm vụ`, `${out} of ${teams.length} deployed`)}</small>}</h2>
    <div className="incident-landslide-list">
      {teams.map(team => {
        const status = teamStatus(team, locale);
        return <button className="incident-landslide-row rescue-team-row" key={team.id} aria-current={selectedId === `team:${team.id}` || undefined} onClick={() => onSelect(team.id)}>
          <span className="rescue-team-symbol" aria-hidden="true"><RescueCross size={16}/></span>
          <span className="incident-landslide-copy"><strong>{team.name[locale === 'vi' ? 0 : 1]}</strong><small title={teamTask(team, locale)}>{teamTask(team, locale)}</small></span>
          <small className="incident-status" data-tone={status.tone === 'active' ? undefined : status.tone}>{status.text}</small>
        </button>;
      })}
    </div>
  </section>;
}

/** One team in the detail panel: its state, its task, where it left from and the road it is on. */
export function RescueTeamDetail({ feed, id, bases, locale, onClose, onShow, onSelectTarget, onSelectBase, onRoad, onRecall }: {
  feed: LocationFeed | null; id: string; bases: readonly RescueBase[]; locale: Locale; onClose: () => void;
  onShow: (point: { x: number; y: number }) => void; onSelectTarget: (team: DevicePosition) => void; onSelectBase: (id: string) => void; onRoad:(id:string)=>void;onRecall?:()=>void;
}): JSX.Element {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const team = useTeams(feed).find(item => item.id === id);
  const base = bases.find(item => item.id === team?.baseId);
  const status = team && teamStatus(team, locale);
  return <>
    <div className="sidebar-top object-detail-heading" data-tracked-device={id}>
      <div className="detail-title">
        <div className="detail-name"><h1 id="object-title">{team ? team.name[locale === 'vi' ? 0 : 1] : t('Đội cứu hộ', 'Rescue team')}</h1></div>
        <button className="icon-button panel-close" onClick={onClose} aria-label={t('Đóng chi tiết đội', 'Close team details')} title={t('Đóng chi tiết đội', 'Close team details')}><UiIcon name="close"/></button>
      </div>
      {team && status && <div className="detail-priority detail-meta"><StatusText tone={status.tone === 'active' ? 'selected' : status.tone}>{deviceStatusText(team, locale)}</StatusText></div>}
    </div>
    <div className="sidebar-scroll rescue-team-detail">
      {!team ? <p className="detail-empty">{t('Không còn tín hiệu của đội này.', 'No signal from this team.')}</p> : <>
        <section className="workflow-section"><h3>{t('Nhiệm vụ', 'Task')}</h3>
          <button className="object-row" onClick={() => onSelectTarget(team)}><span><strong>{teamTask(team, locale)}</strong></span><UiIcon name="next" size={16}/></button>
        </section>
        <section className="workflow-section"><h3>{t('Điểm tập kết', 'Assembly point')}</h3>
          {base ? <button className="object-row" onClick={() => onSelectBase(base.id)}><span><strong>{base.name[locale === 'vi' ? 0 : 1]}</strong></span><UiIcon name="next" size={16}/></button>
            : <p className="detail-empty">{t('Chưa rõ', 'Unknown')}</p>}
        </section>
        <section className="workflow-section"><h3>{t('Đang ở', 'Now on')}</h3><button className="object-row" aria-label={t('Xem đoạn đường','Inspect road section')} onClick={()=>onRoad(team.roadId)}><span><strong>{team.roadName[locale === 'vi' ? 0 : 1]}</strong></span><UiIcon name="next" size={16}/></button></section>
        {!!team.approachGapM&&team.approachGapM>30&&<section className="workflow-section"><h3>{t('Đoạn còn lại','Last approach')}</h3><p>{t(`${Math.round(team.approachGapM)} m đường chim bay · chưa rõ lối đi`,`${Math.round(team.approachGapM)} m straight-line · path unverified`)}</p></section>}
        <div className="area-action">{onRecall&&<button type="button" className="button" onClick={onRecall}>{t('Gọi đội về','Recall team')}</button>}<button className="button" onClick={() => { const current=feed?.getSnapshot().find(item=>item.id===id);if(current)onShow(current.point); }}><UiIcon name="fit" size={16}/>{t('Xem trên bản đồ', 'Show on map')}</button></div>
      </>}
    </div>
  </>;
}
