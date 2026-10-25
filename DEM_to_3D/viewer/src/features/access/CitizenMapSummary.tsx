import type { Locale, RoadSegment, ScenarioRoute } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { roadConditionMessage } from '../routes/localRoadLabels';
import { roadCondition, routeCondition, routeStatus } from '../routes/roadConditions';
import { roadColors } from '../../terrain/roadStyle';
import { RoadConditionSymbol } from '../map/RoadConditionSymbol';
import { RescueCross } from '../tracking/deviceSymbols';

type Props = {
  locale: Locale;
  route: ScenarioRoute | null;
  endpoints?: {from: string; to: string};
  place?: {name: string; onClose: () => void; onDirections: () => void};
  road?: RoadSegment;
  onCloseRoad: () => void;
  onDetails: () => void;
  onFind: () => void;
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
  nearestTeam?: {name: string; detail: string; onShow: () => void};
};

export function CitizenMapSummary({locale, route, endpoints, place, road, onCloseRoad, onDetails, onFind, onPlaces, loadError, onRetry, local, advised = true, comparison = false, risk = false, blocked = false, nearestTeam}: Props) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const condition = road && roadCondition(road);
  const status = condition === 'risk' ? 'uncertain' : condition ?? (route ? routeStatus(route) : undefined);
  const value = road ?? route;
  const message = value ? roadConditionMessage(value, locale, local) : '';
  return <section className={`citizen-map-summary${route && !place && !road ? ' has-route' : ''}`} aria-label={t('Thông tin đường đi', 'Route information')}>
    {place ? <>
      <header><strong>{place.name}</strong><button className="icon-button" aria-label={t('Đóng địa điểm', 'Close place')} onClick={place.onClose}><UiIcon name="close" size={18}/></button></header>
      <button className="button citizen-primary" onClick={place.onDirections}><UiIcon name="route" size={18}/>{t('Tìm đường đến đây', 'Directions here')}</button>
    </> : road ? <header><div><strong>{t(...road.name)}</strong><p data-road-state={status}>{message}</p></div><button className="icon-button" aria-label={t('Đóng đoạn đường', 'Close road section')} onClick={onCloseRoad}><UiIcon name="close" size={18}/></button></header> : <>
      {nearestTeam && <button className="citizen-team" onClick={nearestTeam.onShow}>
        <span className="citizen-team-icon" aria-hidden="true"><RescueCross size={14}/></span>
        <span className="citizen-team-copy"><strong>{nearestTeam.name}</strong><small>{nearestTeam.detail}</small></span>
        <UiIcon name="next" size={16}/>
      </button>}
      {(comparison || blocked || risk) && <div className="citizen-map-legend citizen-comparison-legend" aria-label={t('Chú giải đường đi', 'Route legend')}>
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
      </button> : <header><div><strong>{endpoints ? t('Chưa tìm được đường đi', 'No route found') : t('Bạn muốn đi đâu?', 'Where are you going?')}</strong>{endpoints && <p>{t('Hỏi cán bộ xã trước khi đi.', 'Check with the commune office before travel.')}</p>}</div></header>}
      {loadError && <p className="field-error" role="alert">{t('Chưa tải được đường.', 'Roads could not load.')} <button className="text-button" onClick={onRetry}>{t('Thử lại', 'Retry')}</button></p>}
      {!route && <div className="citizen-map-actions"><button className="button citizen-primary" onClick={onFind}><UiIcon name="route" size={18}/>{t('Tìm đường', 'Find a route')}</button><button className="button" onClick={onPlaces}>{t('Địa điểm', 'Places')}</button></div>}
    </>}
  </section>;
}
