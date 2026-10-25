import { useSyncExternalStore } from 'react';
import type { Locale } from '../../types/dear';
import type { DeviceFeed } from '../tracking/deviceFeed';
import { deviceStatusText } from '../tracking/trackingOverlay';
import { workStatusText, type WorkStatus } from '../incident/responseWork';
import { UiIcon } from '../../shared/ui/UiIcon';
import type { HouseholdAccess, HouseholdCut } from './householdIsolation';
import './isolated-households.css';

export const householdClock = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

/** One isolated hut cluster: how many people, how recently the app saw them, and what cuts the way out. */
/** The team sent to these huts, live from the same feed as the map dots. */
function TeamRow({ feed, id, locale, onShow }: { feed: DeviceFeed; id: string; locale: Locale; onShow: (point: { x: number; y: number }) => void }) {
  // Re-render on a change of state only, not on every position update.
  useSyncExternalStore(feed.subscribe, () => feed.getSnapshot().find(device => device.id === id)?.state ?? null);
  const device = feed.getSnapshot().find(item => item.id === id);
  if (!device) return null;
  const vi = locale !== 'en';
  return <div><dt>{vi ? 'Đội cứu hộ' : 'Rescue team'}</dt><dd><button type="button" className="text-button household-team" onClick={() => { const current=feed.getSnapshot().find(item=>item.id===id);if(current)onShow(current.point); }}>
    <strong>{device.name[vi ? 0 : 1]}</strong>{deviceStatusText(device, locale).replace(/^./, c => c.toLocaleLowerCase())}</button></dd></div>;
}

export function HouseholdCard({ item, source, areaName, locale, onClose, workStatus, onWork, onDirections, helipad, team }: {
  item: HouseholdAccess;
  source: [vi: string, en: string];
  areaName: (id: string) => string;
  locale: Locale;
  onClose: () => void;
  /** The relief task for these huts and where it stands. */
  workStatus?: WorkStatus;
  onWork?: () => void;
  onDirections?: () => void;
  /** Nearest landing site, straight-line distance: the fallback when no road gets through. */
  helipad?: { name: [vi: string, en: string]; distanceKm: number };
  team?: { feed: DeviceFeed; id: string; onShow: (point: { x: number; y: number }) => void };
}) {
  const vi = locale !== 'en', t = (a: string, b: string) => vi ? a : b, { cluster } = item;
  const metres = item.access ? Math.round(item.access.distanceM / 10) * 10 : null;
  const cut = (entry: HouseholdCut) => entry.kind === 'area' ? areaName(entry.id)
    : entry.kind === 'road' ? t(`${entry.name[0]} bị chặn`, `${entry.name[1]} blocked`)
    : t(`Sạt lở dân báo lúc ${householdClock(entry.reportedAt, locale)}`, `Slide reported by residents at ${householdClock(entry.reportedAt, locale)}`);
  return <aside className="household-card" aria-label={t('Hộ bị cô lập', 'Isolated households')}>
    <header><div><small>{t('Còn người, bị cô lập', 'People present, cut off')}</small><h2>{cluster.name[vi ? 0 : 1]}</h2></div>
      <button type="button" className="icon-button" aria-label={t('Đóng', 'Close')} onClick={onClose}><UiIcon name="close"/></button></header>
    <p className="household-card-people"><strong>{cluster.people}</strong><span>{t(`người, ${cluster.households} hộ`, `people, ${cluster.households} households`)}</span></p>
    <dl>
      <div><dt>{t('Tín hiệu app', 'App signal')}</dt><dd>{t(`${cluster.devices} máy, lần cuối ${householdClock(cluster.lastSeenAt, locale)}`, `${cluster.devices} phones, last at ${householdClock(cluster.lastSeenAt, locale)}`)}</dd></div>
      <div><dt>{t('Đường ra bị cắt', 'Way out cut by')}</dt><dd><ul>{item.cutBy.map((entry, index) => <li key={index}>{cut(entry)}</li>)}</ul></dd></div>
      {metres !== null && <div><dt>{t('Ra tới đường', 'To the road')}</dt><dd>{t(`${metres} m đi bộ`, `${metres} m on foot`)}</dd></div>}
      <div><dt>{t('Nhu cầu', 'Needs')}</dt><dd>{cluster.need ? cluster.need[vi ? 0 : 1] : t('Chưa rõ', 'Unknown')}</dd></div>
      {team && <TeamRow feed={team.feed} id={team.id} locale={locale} onShow={team.onShow}/>}
      {helipad && <div><dt>{t('Bãi đáp gần nhất', 'Nearest landing')}</dt><dd>{t(`${helipad.name[0]}, ${helipad.distanceKm.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km đường chim bay`, `${helipad.name[1]}, ${helipad.distanceKm.toLocaleString('en-GB', { maximumFractionDigits: 1 })} km straight line`)}</dd></div>}
    </dl>
    {(onWork || onDirections) && <div className="household-card-actions">
      {onWork && <button type="button" className="button primary" onClick={onWork}><UiIcon name="priority" size={16}/>{workStatus && workStatus !== 'pending' ? t(...workStatusText[workStatus]) : t('Giao việc cứu trợ', 'Assign relief')}</button>}
      {onDirections && <button type="button" className="button" onClick={onDirections}><UiIcon name="route" size={16}/>{t('Chỉ đường tới', 'Directions')}</button>}
    </div>}
    <footer>{source[vi ? 0 : 1]}. {t('Chưa xác minh tại hiện trường.', 'Not verified in the field.')}</footer>
  </aside>;
}
