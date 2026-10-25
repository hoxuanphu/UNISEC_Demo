import type { Locale, RoadSegment, ScenarioRoute } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { roadConditionMessage } from '../routes/localRoadLabels';
import { roadCondition, routeCondition, routeStatus } from '../routes/roadConditions';
import { roadColors } from '../../terrain/roadStyle';
import { RoadConditionSymbol } from '../map/RoadConditionSymbol';
import { RescueCross } from '../tracking/deviceSymbols';
import { MapSymbol } from '../../shared/ui/MapSymbol';

const clock = (iso: string, locale: Locale) => new Date(iso).toLocaleTimeString(locale === 'vi' ? 'vi-VN' : 'en-GB', {hour: '2-digit', minute: '2-digit'});

type Props = {
  guidance?: {mode:'hold'|'route';awaitingTeam?:boolean;blocked:boolean;destination:string;onProposal:()=>void;onReport:()=>void};
  locale: Locale;
  route: ScenarioRoute | null;
  endpoints?: {from: string; to: string};
  place?: {name: string; onClose: () => void; onDirections: () => void};
  road?: RoadSegment;
  onCloseRoad: () => void;
  onDetails: () => void;
  onFind: () => void;
  /** Start walking directions along the shown route, from where the resident is. */
  onNavigate?: () => void;
  onPlaces: () => void;
  loadError: boolean;
  onRetry: () => void;
  local?: boolean;
  /** False when the resident chose another way than the advised one. */
  advised?: boolean;
  comparison?: boolean;
  risk?: boolean;
  blocked?: boolean;
  /** The rescue team closest to the resident: one line, tap to see it on the map. */
  nearestTeam?: {assigned?:boolean;name: string; detail: string; summary: string; onShow: () => void};
  /** The road the resident is on, and whether it is blocked just ahead. */
  here?: {road: string; blocked: boolean};
  /** The nearest assembly point on foot; `reachable` false when every way there is blocked. */
  safe?: {name: string; detail: string; reachable: boolean; onGo: () => void};
  /** Staying put for the nearest team instead of walking out. */
  waiting?: {onStart: () => void; onClose: () => void; onReport: () => void; active: boolean;
    /** When the resident last asked for rescue from here, if they have. */
    helpSentAt: string | null; onHelp: () => void};
};

/** The resident's two ways out, the safer one first: walk to an assembly point, or stay and wait for a team. */
function SafetyOptions({locale, here, safe, nearestTeam, waiting}: Pick<Props, 'locale' | 'here' | 'safe' | 'nearestTeam' | 'waiting'>) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const walk = safe && <button className="citizen-option" data-tone={safe.reachable ? 'safe' : 'blocked'} disabled={!safe.reachable} onClick={safe.onGo}>
    <span className="citizen-option-icon is-assembly" aria-hidden="true"><MapSymbol name="staging" size={16}/></span>
    <span className="citizen-option-copy"><strong>{safe.reachable ? t(`Đề xuất đến ${safe.name}`, `Propose ${safe.name}`) : t('Chưa tìm được tuyến', 'No mapped route')}</strong><small>{safe.detail}</small></span>
    {safe.reachable && <UiIcon name="next" size={16}/>}
  </button>;
  const wait = waiting && nearestTeam && <button className="citizen-option" onClick={waiting.onStart}>
    <span className="citizen-option-icon is-team" aria-hidden="true"><RescueCross size={16}/></span>
    <span className="citizen-option-copy"><strong>{t('Chờ đội cứu hộ', 'Wait for a rescue team')}</strong><small>{nearestTeam.summary}</small></span>
    <UiIcon name="next" size={16}/>
  </button>;
  return <>
    {here && <header className="citizen-here"><div><small>{t('Bạn đang ở', 'You are on')}</small><strong>{here.road}</strong>
      {here.blocked && <p data-road-state="blocked"><RoadConditionSymbol condition="blocked"/>{t('Phía trước bị chặn, không đi tiếp.', 'Blocked ahead. Do not go on.')}</p>}</div></header>}
    <div className="citizen-options">{safe?.reachable ? <>{walk}{wait}</> : <>{wait}{walk}</>}</div>
    {/* In an emergency one tap is enough: the request goes with where the resident is. */}
    {waiting && (waiting.helpSentAt
      ? <p className="citizen-help-sent" role="status"><UiIcon name="check" size={16}/>{t(`Đã gửi yêu cầu cứu lúc ${clock(waiting.helpSentAt, locale)}`, `Rescue request sent at ${clock(waiting.helpSentAt, locale)}`)}</p>
      : <div className="citizen-map-actions"><button className="button citizen-help" onClick={waiting.onHelp}><UiIcon name="send" size={18}/>{t('Gửi yêu cầu cứu', 'Ask for rescue')}</button></div>)}
  </>;
}

export function CitizenMapSummary({guidance,locale, route, endpoints, place, road, onCloseRoad, onDetails, onFind, onNavigate, onPlaces, loadError, onRetry, local, advised = true, comparison = false, risk = false, blocked = false, nearestTeam, here, safe, waiting}: Props) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const condition = road && roadCondition(road);
  const status = condition === 'risk' ? 'uncertain' : condition ?? (route ? routeStatus(route) : undefined);
  const value = road ?? route;
  const message = value ? roadConditionMessage(value, locale, local) : '';
  const home = !route && !endpoints && (safe || nearestTeam);
  if (waiting?.active && nearestTeam) return <section className="citizen-map-summary citizen-wait" aria-label={t('Chờ đội cứu hộ', 'Waiting for a rescue team')}>
    <header><strong>{t('Chờ đội cứu hộ', 'Waiting for a rescue team')}</strong><button className="icon-button" aria-label={t('Đóng', 'Close')} onClick={waiting.onClose}><UiIcon name="close" size={18}/></button></header>
    <p className="citizen-team-label">{nearestTeam.assigned?t('Đội được giao','Assigned team'):t('Đội gần vị trí của bạn','Nearby team')}</p>
    <button className="citizen-team" onClick={nearestTeam.onShow}>
      <span className="citizen-team-icon" aria-hidden="true"><RescueCross size={16}/></span>
      <span className="citizen-team-copy"><strong>{nearestTeam.name}</strong><small>{nearestTeam.detail}</small></span>
      <UiIcon name="next" size={16}/>
    </button>
    <ul className="citizen-wait-tips">
      <li>{t('Ở yên chỗ an toàn, tránh xa taluy và suối.', 'Stay somewhere safe, away from slopes and streams.')}</li>
      <li>{t('Giữ máy bật để cập nhật vị trí.', 'Keep your phone on to update your location.')}</li>
    </ul>
    {waiting.helpSentAt && <p className="citizen-help-sent" role="status"><UiIcon name="check" size={16}/>{t(`Đã gửi yêu cầu cứu lúc ${clock(waiting.helpSentAt, locale)}`, `Rescue request sent at ${clock(waiting.helpSentAt, locale)}`)}{!nearestTeam.assigned?t(' · chờ giao đội',' · awaiting assignment'):''}</p>}
    <div className="citizen-map-actions">
      {!waiting.helpSentAt && <button className="button citizen-primary citizen-help" onClick={waiting.onHelp}><UiIcon name="send" size={18}/>{t('Gửi yêu cầu cứu', 'Ask for rescue')}</button>}
      <button className={`button${waiting.helpSentAt ? ' citizen-primary' : ''}`} onClick={waiting.onReport}><UiIcon name="camera" size={18}/>{t('Báo tình trạng', 'Report your situation')}</button>
    </div>
  </section>;
  if(guidance&&!place&&!road)return <section className="citizen-map-summary citizen-official-guidance" aria-label={t('Hướng dẫn từ điều phối','Coordination guidance')}>
    <header aria-live="polite"><div><small>{t('Điều phối','Coordination')}</small><strong>{guidance.awaitingTeam?t('Chờ đội được giao','Await the assigned team'):guidance.blocked?t('Tuyến cần cập nhật','Route update needed'):guidance.mode==='hold'?t('Chờ hỗ trợ tại vị trí an toàn','Wait at a safe location'):t(`Đi đến ${guidance.destination}`,`Go to ${guidance.destination}`)}</strong></div></header>
    {route&&!guidance.blocked&&<p>{route.lengthKm.toLocaleString(locale==='vi'?'vi-VN':'en-GB',{maximumFractionDigits:1})} km</p>}
    {nearestTeam?.assigned&&<button className="citizen-team" onClick={nearestTeam.onShow}><strong>{nearestTeam.name}</strong><small>{nearestTeam.summary}</small></button>}
    <div className="citizen-map-actions">{route&&!guidance.blocked&&!guidance.awaitingTeam&&onNavigate&&<button className="button citizen-primary" onClick={onNavigate}>{t('Bắt đầu','Start')}</button>}
      {waiting&&!waiting.helpSentAt&&<button className="button citizen-help" onClick={waiting.onHelp}>{t('Gửi yêu cầu cứu','Ask for rescue')}</button>}
      <button className="button" onClick={guidance.onReport}>{t('Báo tình hình','Report situation')}</button></div>
    <button className="text-button" onClick={guidance.onProposal}>{t('Đề xuất tuyến khác','Suggest another route')}</button>
  </section>;
  return <section className={`citizen-map-summary${route && !place && !road ? ' has-route' : ''}`} aria-label={t('Thông tin đường đi', 'Route information')}>
    {place ? <>
      <header><strong>{place.name}</strong><button className="icon-button" aria-label={t('Đóng địa điểm', 'Close place')} onClick={place.onClose}><UiIcon name="close" size={18}/></button></header>
      <button className="button citizen-primary" onClick={place.onDirections}><UiIcon name="route" size={18}/>{t('Đề xuất tuyến đến đây', 'Propose a route here')}</button>
    </> : road ? <header><div><strong>{t(...road.name)}</strong><p data-road-state={status}>{message}</p></div><button className="icon-button" aria-label={t('Đóng đoạn đường', 'Close road section')} onClick={onCloseRoad}><UiIcon name="close" size={18}/></button></header> : <>
      {home ? <SafetyOptions locale={locale} here={here} safe={safe} nearestTeam={nearestTeam} waiting={waiting}/>
        : nearestTeam && !route && !endpoints && <button className="citizen-team" onClick={nearestTeam.onShow}>
        <span className="citizen-team-icon" aria-hidden="true"><RescueCross size={16}/></span>
        <span className="citizen-team-copy"><strong>{nearestTeam.name}</strong><small>{nearestTeam.detail}</small></span>
        <UiIcon name="next" size={16}/>
      </button>}
      {(comparison || blocked || risk) && !home && <div className="citizen-map-legend citizen-comparison-legend" aria-label={t('Chú giải đường đi', 'Route legend')}>
        {comparison && <span><i style={{borderColor: roadColors.alternative}}/>{t('Đường khác', 'Other routes')}</span>}
        {blocked && <span><RoadConditionSymbol condition="blocked"/>{t('Bị chặn', 'Blocked')}</span>}
        {risk && <span><RoadConditionSymbol condition="risk"/>{t('Có nguy cơ', 'At risk')}</span>}
      </div>}
      {route ? <button className="citizen-route-overview" onClick={onDetails} aria-label={t('Chi tiết đường đi', 'Route details')}>
        <div className="citizen-route-overview-copy">
          <strong className="citizen-route-label">{status === 'blocked' ? t('Chưa có đường nên đi', 'No passable route found') : advised ? t('Đường nên đi', 'Suggested route') : t('Đường bạn chọn', 'Your chosen route')}</strong>
          {endpoints ? <dl className="citizen-route-stops"><div><dt>{t('Từ', 'From')}</dt><dd>{endpoints.from}</dd></div><div><dt>{t('Đến', 'To')}</dt><dd>{endpoints.to}</dd></div></dl> : <span className="citizen-route-name">{t(...route.name)}</span>}
          <span className="citizen-route-status" data-road-state={status}>{routeCondition(route) === 'risk' ? t('Hỏi lại trước khi đi', 'Check before travel') : message}</span>
        </div>
        <span className="citizen-route-distance"><strong>{route.lengthKm.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', {maximumFractionDigits: 1})}</strong><span>km</span></span>
        <UiIcon name="next" size={18}/>
      </button> : home ? null : <header><div><strong>{endpoints ? t('Chưa tìm được đường đi', 'No route found') : t('Bạn muốn đi đâu?', 'Where are you going?')}</strong>{endpoints && <p>{t('Hỏi cán bộ xã trước khi đi.', 'Check with the commune office before travel.')}</p>}</div></header>}
      {route && onNavigate && status !== 'blocked' && <div className="citizen-map-actions"><button className="button citizen-primary" onClick={onNavigate}><UiIcon name="myLocation" size={18}/>{t('Bắt đầu', 'Start')}</button></div>}
      {loadError && <p className="field-error" role="alert">{t('Chưa tải được đường.', 'Roads could not load.')} <button className="text-button" onClick={onRetry}>{t('Thử lại', 'Retry')}</button></p>}
      {!route && (home
        ? <div className="citizen-map-links"><button className="text-button" onClick={onFind}><UiIcon name="route" size={16}/>{t('Tìm đường khác', 'Other directions')}</button><button className="text-button" onClick={onPlaces}><UiIcon name="location" size={16}/>{t('Địa điểm', 'Places')}</button></div>
        : <div className="citizen-map-actions"><button className="button citizen-primary" onClick={onFind}><UiIcon name="route" size={18}/>{t('Tìm đường', 'Find a route')}</button><button className="button" onClick={onPlaces}>{t('Địa điểm', 'Places')}</button></div>)}
    </>}
  </section>;
}
