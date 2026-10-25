import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Locale, ScenarioRoute } from '../../types/dear';
import type { LocationFeed } from '../tracking/deviceFeed';
import { navigationState, routeSteps, OFF_ROUTE_M, WALK_M_PER_MIN, type Turn } from './navigation';

type Point = { x: number; y: number };
const noSubscription = () => () => undefined;

/** Big, plain arrows as in a map app: one glance tells which way. */
function TurnArrow({ turn, arrived, off }: { turn: Turn; arrived: boolean; off: boolean }) {
  const path = off ? 'M16 5 3 27h26ZM16 13v6M16 23v.5'
    : arrived ? 'M10 4v24M10 5h14l-4 5 4 5H10'
    : turn === 'left' ? 'M22 28V16a4 4 0 0 0-4-4H8m5-5-5 5 5 5'
    : turn === 'right' ? 'M10 28V16a4 4 0 0 1 4-4h10m-5-5 5 5-5 5'
    : 'M16 28V5m-7 7 7-7 7 7';
  return <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path}/></svg>;
}

/**
 * Walking directions on the resident's phone: the next turn at the top, time and distance
 * left at the bottom, the map following the resident. Off the route it offers a new one.
 */
export function CitizenNavigation({ route, destination, locale, feed, me, onFollow, onReroute, onExit }: {
  route: ScenarioRoute; destination: string; locale: Locale;
  /** The resident's position feed, read on a change of about 5 m. */
  feed: LocationFeed | null; me: () => Point | null;
  onFollow: (point: Point) => void; onReroute: () => void; onExit: () => void;
}) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const steps = useMemo(() => routeSteps(route), [route]);
  const cell = useSyncExternalStore(feed?.subscribe ?? noSubscription, () => { const at = me(); return at ? `${Math.round(at.x / 5)},${Math.round(at.y / 5)}` : ''; });
  const at = me();
  const state = at ? navigationState(route, steps, at) : null;
  // The map keeps the resident in view as they walk.
  useEffect(() => { const point = me(); if (point) onFollow(point); }, [cell]); // eslint-disable-line react-hooks/exhaustive-deps
  const distance = (m: number) => m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', { maximumFractionDigits: 1 })} km`;
  const road = (name: [string, string]) => name[locale === 'vi' ? 0 : 1];
  const off = !!state && state.offRouteM > OFF_ROUTE_M;
  const arrived = !!state?.arrived;
  const turnText = (turn: Turn) => turn === 'left' ? t('Rẽ trái', 'Turn left') : turn === 'right' ? t('Rẽ phải', 'Turn right') : t('Đi thẳng', 'Continue');
  const minutes = state ? Math.max(1, Math.round(state.remainingM / WALK_M_PER_MIN)) : 0;
  return <>
    <div className="citizen-nav-banner" data-state={off ? 'off' : arrived ? 'arrived' : 'on'} role="status" aria-live="polite">
      <span className="citizen-nav-arrow"><TurnArrow turn={state?.next?.turn ?? 'straight'} arrived={arrived || (!!state && !state.next)} off={off}/></span>
      <div className="citizen-nav-copy">
        {!state ? <strong>{t('Đang tìm vị trí của bạn', 'Finding your location')}</strong>
          : off ? <><strong>{t('Bạn đang ở ngoài tuyến', 'You are off the route')}</strong><span>{t(`Cách tuyến ${distance(state.offRouteM)}`, `${distance(state.offRouteM)} from the route`)}</span></>
          : arrived ? <><strong>{t('Bạn đã đến nơi', 'You have arrived')}</strong><span>{destination}</span></>
          : state.next ? <><strong>{distance(state.next.inM)}</strong><span>{turnText(state.next.turn)} {t('vào', 'onto')} {road(state.next.name)}</span></>
          : <><strong>{distance(state.remainingM)}</strong><span>{t(`Đi tiếp đến ${destination}`, `Continue to ${destination}`)}</span></>}
        {state && !off && !arrived && <small>{t('Đang đi', 'On')} {road(state.current.name)}</small>}
      </div>
      {off && <button type="button" className="button" onClick={onReroute}>{t('Tìm lại đường', 'Reroute')}</button>}
    </div>
    <div className="citizen-nav-bar">
      <div>{arrived ? <strong>{destination}</strong> : <><strong>{t(`${minutes} phút`, `${minutes} min`)}</strong>
        <small>{state ? distance(state.remainingM) : ''}{t(' đi bộ, đến ', ' on foot to ')}{destination}</small></>}</div>
      <button type="button" className="button citizen-nav-exit" onClick={onExit}>{arrived ? t('Kết thúc', 'Done') : t('Thoát', 'Exit')}</button>
    </div>
  </>;
}
