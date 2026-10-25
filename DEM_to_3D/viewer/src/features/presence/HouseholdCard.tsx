import { useEffect, useSyncExternalStore } from 'react';
import type { Locale } from '../../types/dear';
import type { LocationFeed } from '../tracking/deviceFeed';
import { deviceStatusText } from '../tracking/trackingOverlay';
import { workStatusText, type WorkStatus } from '../incident/responseWork';
import { UiIcon } from '../../shared/ui/UiIcon';
import type { HouseholdCut } from './householdIsolation';
import { householdStatusText, unverifiedText, type HouseholdView } from './householdStatus';
import './isolated-households.css';

export const householdClock = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

/** The team sent to these huts, live from the same feed as the map dots. */
function TeamRow({ feed, id, locale, onShow }: { feed: LocationFeed; id: string; locale: Locale; onShow: (point: { x: number; y: number }) => void }) {
  // Re-render on a change of state only, not on every position update.
  useSyncExternalStore(feed.subscribe, () => feed.getSnapshot().find(device => device.id === id)?.state ?? null);
  const device = feed.getSnapshot().find(item => item.id === id);
  if (!device) return null;
  const vi = locale !== 'en';
  return <div><dt>{vi ? 'Đội cứu hộ' : 'Rescue team'}</dt><dd><button type="button" className="text-button household-team" onClick={() => { const current=feed.getSnapshot().find(item=>item.id===id);if(current)onShow(current.point); }}>
    <strong title={device.name[vi ? 0 : 1]}>{device.id}</strong><span>{deviceStatusText(device, locale)}</span></button></dd></div>;
}

export function HouseholdCard({ item, areaName, locale, onClose, workStatus, onWork, onDispatch, onDirections, helipad, team }: {
  item: HouseholdView;
  areaName: (id: string) => string;
  locale: Locale;
  onClose: () => void;
  /** The relief task for these huts and where it stands. */
  workStatus?: WorkStatus;
  onWork?: () => void;
  onDispatch?: () => void;
  onDirections?: () => void;
  /** Nearest landing site, straight-line distance: the fallback when no road gets through. */
  helipad?: { name: [vi: string, en: string]; distanceKm: number };
  team?: { feed: LocationFeed; id: string; onShow: (point: { x: number; y: number }) => void };
}) {
  const vi = locale !== 'en', t = (a: string, b: string) => vi ? a : b, { cluster } = item;
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[role="dialog"],.leaflet-popup,.tracked-device-card:not([hidden])')) return;
      event.preventDefault(); event.stopPropagation(); onClose();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);
  const cut = (entry: HouseholdCut) => entry.kind === 'area' ? areaName(entry.id)
    : entry.kind === 'road' ? t(`${entry.name[0]} bị chặn`, `${entry.name[1]} blocked`)
    : t(`Sạt lở dân báo lúc ${householdClock(entry.reportedAt, locale)}`, `Slide reported by residents at ${householdClock(entry.reportedAt, locale)}`);
  const cuts = [...new Set(item.cutBy.map(cut))];
  return <aside className="household-card" aria-label={cluster.name[vi ? 0 : 1]}>
    <header><div><small data-status={item.status}>{t(...householdStatusText[item.status])}</small><h2>{cluster.name[vi ? 0 : 1]}</h2></div>
      <button type="button" className="icon-button" aria-label={t('Đóng', 'Close')} onClick={onClose}><UiIcon name="close"/></button></header>
    <p className="household-card-people"><strong>{cluster.people}</strong><span>{t(`người, ${cluster.households} hộ`, `people, ${cluster.households} households`)}</span></p>
    <dl>
      {cluster.contact && <div><dt>{t('Liên lạc', 'Contact')}</dt><dd><a href={`tel:${cluster.contact.phone.replace(/[^+\d]/g,'')}`}>{cluster.contact.name} · {cluster.contact.phone}</a></dd></div>}
      {!cluster.contact && onWork && !cluster.rescued && <div><dt>{t('Liên lạc','Contact')}</dt><dd><button className="text-button" onClick={onWork}>{t('Chưa có số · xác minh','No number · check contact')}</button></dd></div>}
      <div><dt>{t('Tín hiệu app', 'App signal')}</dt><dd>{t(`${cluster.devices} máy, lần cuối ${householdClock(cluster.lastSeenAt, locale)}`, `${cluster.devices} phones, last at ${householdClock(cluster.lastSeenAt, locale)}`)}</dd></div>
      {cluster.rescued ? <div><dt>{t('Đã cứu', 'Rescued')}</dt><dd>{t(`Đưa về ${cluster.rescued.to[0]} lúc ${householdClock(cluster.rescued.at, locale)}`, `Brought to ${cluster.rescued.to[1]} at ${householdClock(cluster.rescued.at, locale)}`)}</dd></div>
      : item.isolated ? <>
        <div><dt>{t('Đường ra bị cắt', 'Way out cut by')}</dt><dd><ul>{cuts.length ? cuts.map(label => <li key={label}>{label}</li>) : <li>{t('Chưa rõ', 'Unknown')}</li>}</ul></dd></div>
        <div><dt>{t('Tiếp cận', 'Access')}</dt><dd>{t('Chưa rõ lối từ đường tới hộ', 'Last approach unverified')}</dd></div>
      </> : item.unverified && <div><dt>{t('Đường ra', 'Way out')}</dt><dd>{t(...unverifiedText[item.unverified])}</dd></div>}
      <div><dt>{t('Nhu cầu', 'Needs')}</dt><dd>{cluster.need ? cluster.need[vi ? 0 : 1] : t('Chưa rõ', 'Unknown')}</dd></div>
      {team && <TeamRow feed={team.feed} id={team.id} locale={locale} onShow={point => { onClose(); team.onShow(point); }}/>}
      {helipad && <div><dt>{t('Bãi đáp tham khảo', 'Landing reference')}</dt><dd>{t(`${helipad.name[0]}, ${helipad.distanceKm.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km đường chim bay`, `${helipad.name[1]}, ${helipad.distanceKm.toLocaleString('en-GB', { maximumFractionDigits: 1 })} km straight line`)}</dd></div>}
    </dl>
    {(onWork || onDispatch || onDirections) && !cluster.rescued && <div className="household-card-actions">
      {onDispatch && !team ? <button type="button" className="button primary" onClick={onDispatch}><UiIcon name="priority" size={16}/>{t('Điều đội cứu hộ','Dispatch team')}</button> : onWork && <button type="button" className="button primary" onClick={onWork}><UiIcon name="priority" size={16}/>{workStatus && workStatus !== 'pending' ? t(...workStatusText[workStatus]) : team ? t('Cập nhật xử lý', 'Update task') : t('Giao việc xác minh', 'Assign a check')}</button>}
      {onDirections && <button type="button" className="button" onClick={onDirections}><UiIcon name="route" size={16}/>{t('Điểm tiếp cận', 'Approach point')}</button>}
    </div>}
  </aside>;
}
