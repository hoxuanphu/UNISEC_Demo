import type { Hazard, IncidentEvidence, Locale, ScenarioRoute } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { StatusText } from '../../shared/ui/StatusText';
import { communityAccessText } from './accessAssessment';
import { RouteOption } from './RouteOption';
import { RouteSections } from './RouteSections';
import { routeNextAction, selectAccessRoute } from './routeReview';
import { RouteVerification } from './RouteVerification';
import './access-panel.css';

type Props = {
  locale: Locale; hazards: Hazard[]; evidence: IncidentEvidence[];
  candidate: ScenarioRoute | null; direct: ScenarioRoute | null;
  selected: 'candidate' | 'direct'; onSelectRoute: (type: 'candidate' | 'direct') => void;
  sectionId: string | null; onSelectSection: (id: string | null) => void;
  hasProfile: boolean; onProfile: () => void; onInspect: (id: string) => void;
  onEvidence: (id: string) => void; onFindings: () => void; onExport: () => void;
};

/** Route choice and its ordered sections stay in one review. Details do not replace it. */
export function AccessPanel({ locale, hazards, evidence, candidate, direct, selected, onSelectRoute,
  sectionId, onSelectSection, hasProfile, onProfile, onInspect, onEvidence, onFindings, onExport }: Props): JSX.Element {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const active = selectAccessRoute({ candidate, direct }, selected);
  const blocked = active?.status === 'blocked';
  const other = active === direct ? candidate : direct;
  const needsOtherRoute = Boolean(blocked && other && other.status !== 'blocked');
  const action = needsOtherRoute
    ? t('Tuyến bị chặn. Kiểm tra phương án còn lại.', 'Route blocked. Review the alternative.')
    : t(...routeNextAction(active, hazards));
  const firstConstraint = active?.segs.find(road => road.status === 'blocked')
    ?? active?.segs.find(road => road.status === 'uncertain');
  const primaryAction = () => {
    if (needsOtherRoute) onSelectRoute(active === direct ? 'candidate' : 'direct');
    else if (firstConstraint) onSelectSection(firstConstraint.id);
    else onFindings();
  };
  return <>
    {(!active || (candidate && direct)) && <p className="decision-overview">{t(...communityAccessText({ candidate, direct }))}</p>}
    {active ? <section className="decision-route" aria-label={t('Tuyến đang xem', 'Selected route')}>
    {candidate && direct && <div className="access-route-choice" aria-labelledby="access-choice-title">
      <h3 id="access-choice-title">{t('Phương án tiếp cận', 'Access options')}</h3>
      <div className="route-options" role="group" aria-label={t('Chọn tuyến tiếp cận', 'Select access route')}>
        <RouteOption route={candidate} selected={active === candidate} locale={locale} onSelect={() => onSelectRoute('candidate')}/>
        <RouteOption route={direct} selected={active === direct} locale={locale} onSelect={() => onSelectRoute('direct')}/>
      </div>
    </div>}
      {!(candidate && direct) && <div className="access-route-label">
        <span>{t('Tuyến đang chọn', 'Selected route')}</span>
        <StatusText tone={blocked ? 'critical' : 'warning'}>{blocked ? t('Bị chặn', 'Blocked') : t('Cần xác minh', 'Verify access')}</StatusText>
      </div>}
      {!(candidate && direct) && <h2>{t(...active.name)}</h2>}
      <dl className="route-metrics">
        {!(candidate && direct) && <div><dt>{t('Từ điểm tập kết', 'From staging point')}</dt><dd>{active.lengthKm} <small>km</small></dd></div>}
        {active.eta && <div className="route-travel-estimate"><dt>{t('Thời gian dự kiến', 'Estimated time')}</dt><dd>{active.eta.minMinutes}–{active.eta.maxMinutes} <small>{t('phút', 'min')}</small></dd><span>{active.eta.mode === 'foot' ? t('Đi bộ, nếu thông tuyến', 'On foot, assuming passage') : t('Xe 4x4, nếu thông tuyến', '4WD, assuming passage')}</span></div>}
      </dl>
      <div className={'next-action ' + (blocked ? 'is-blocked' : 'is-uncertain')}>
        <p id="route-next-action" className="assessment-action route-action"><UiIcon name={blocked ? 'blocked' : 'uncertain'} size={16}/><span>{action}</span></p>
        <button className="button access-primary" aria-describedby="route-next-action" onClick={primaryAction}>
          {needsOtherRoute ? t('Xem tuyến khác', 'Review other route') : firstConstraint ? t('Xem đoạn cần kiểm tra', 'Inspect road constraint') : t('Xem căn cứ', 'Review evidence')}
        </button>
      </div>
      <RouteSections route={active} evidence={evidence} locale={locale} selectedId={sectionId} onSelect={onSelectSection}
        onInspect={onInspect} onEvidence={onEvidence} onProfile={onProfile} hasProfile={hasProfile}/>
      <RouteVerification route={active} evidence={evidence} locale={locale}/>
    </section> : <div className="next-action"><p className="assessment-action route-action">{action}</p><button className="button" onClick={onFindings}>{t('Xem thông tin địa bàn', 'Review community findings')}</button></div>}
    <div className="route-tools access-tools">
      {active && !sectionId && <button className="button" onClick={onProfile} disabled={!hasProfile} title={!hasProfile ? t('Chưa có DEM cho tuyến này', 'DEM unavailable for this route') : undefined}><UiIcon name="profile" size={16}/>{t('Mặt cắt địa hình', 'Elevation profile')}</button>}
      <button className="button decision-save" onClick={onExport}><UiIcon name="download" size={16}/>{t('Lưu đánh giá', 'Save assessment')}</button>
    </div>
  </>;
}
