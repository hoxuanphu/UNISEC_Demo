import { useState } from 'react';
import type { Hazard, IncidentEvidence, Locale, ScenarioRoute } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { DisclosureTrigger } from '../../shared/ui/DisclosureTrigger';
import { StatusText } from '../../shared/ui/StatusText';
import { communityAccessText } from './accessAssessment';
import { RouteOption } from './RouteOption';
import { RoadConstraint } from './RoadConstraint';
import { routeNextAction, selectAccessRoute } from './routeReview';
import { roadStatusLabels } from './roadStatus';
import { RouteVerification } from './RouteVerification';
import './access-panel.css';

type Props = {
  locale: Locale; hazards: Hazard[]; evidence: IncidentEvidence[];
  candidate: ScenarioRoute | null; direct: ScenarioRoute | null;
  selected: 'candidate' | 'direct'; onSelectRoute: (type: 'candidate' | 'direct') => void;
  hasProfile: boolean; onProfile: () => void; onInspect: (id: string) => void;
  onFindings: () => void; onExport: () => void;
};

/** One access review: selected route, its constraints, then optional comparisons. */
export function AccessPanel({ locale, hazards, evidence, candidate, direct, selected, onSelectRoute, hasProfile, onProfile, onInspect, onFindings, onExport }: Props): JSX.Element {
  const [compare, setCompare] = useState(false), [allSections, setAllSections] = useState(false);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const active = selectAccessRoute({ candidate, direct }, selected);
  const constraints = active?.segs.filter(road => road.status !== 'open') ?? [];
  const blocked = active?.status === 'blocked';
  const other = active === direct ? candidate : direct;
  const needsOtherRoute = Boolean(blocked && other && other.status !== 'blocked');
  const action = needsOtherRoute
    ? t('Tuyến đang xem bị chặn. Kiểm tra phương án còn lại.', 'This route is blocked. Review the other option.')
    : t(...routeNextAction(active, hazards));
  const tone = blocked ? 'is-blocked' : active ? 'is-uncertain' : '';
  const firstConstraint = constraints.find(road => road.status === 'blocked') ?? constraints[0];
  const inspect = (id: string) => onInspect(`road:${id}`);
  const primaryAction = () => {
    if (needsOtherRoute) onSelectRoute(active === direct ? 'candidate' : 'direct');
    else if (firstConstraint) inspect(firstConstraint.id);
    else if (active) setAllSections(true);
    else onFindings();
  };
  const roadRows = (roads: ScenarioRoute['segs']) => roads.map(road => <button key={road.id} className="object-row impact-row" onClick={() => inspect(road.id)}>
    <span><strong>{t(...road.name)}</strong><small>{road.len} km</small></span>
    <StatusText tone={road.status === 'blocked' ? 'critical' : road.status === 'uncertain' ? 'warning' : 'neutral'} icon={road.status === 'blocked' ? 'blocked' : road.status === 'uncertain' ? 'uncertain' : undefined}>
      {t(...roadStatusLabels[road.status])}
    </StatusText>
  </button>);
  return <>
    {(!active || (candidate && direct)) && <p className="decision-overview">{t(...communityAccessText({ candidate, direct }))}</p>}
    {active && <section className="decision-route" aria-label={t('Tuyến đang xem', 'Selected route')}>
      <div className="access-route-label"><span>{active.type === 'candidate' && !blocked ? t('Tuyến gợi ý', 'Suggested route') : t('Tuyến đang xem', 'Selected route')}</span><StatusText tone={blocked ? 'critical' : 'warning'}>{blocked ? t('Bị chặn', 'Blocked') : t('Cần xác minh', 'Verify access')}</StatusText></div>
      <h2>{t(...active.name)}</h2>
      <dl className="route-metrics">
        <div><dt>{t('Quãng đường', 'Distance')}</dt><dd>{active.lengthKm} <small>km</small></dd><span>{t('Từ điểm tập kết', 'From staging point')}</span></div>
        {active.eta && <div className="route-travel-estimate"><dt>{t('Thời gian dự kiến', 'Estimated time')}</dt><dd>{active.eta.minMinutes}–{active.eta.maxMinutes} <small>{t('phút', 'min')}</small></dd><span>{active.eta.mode === 'foot' ? t('Đi bộ, nếu thông tuyến', 'On foot, assuming passage') : t('Xe 4x4, nếu thông tuyến', '4WD, assuming passage')}</span></div>}
      </dl>
      <RouteVerification route={active} evidence={evidence} locale={locale}/>
    </section>}
    <section className={'next-action ' + tone} aria-label={t('Việc cần làm', 'Next action')}>
      <div id="route-next-action" className={'assessment-action route-action ' + tone}>{active && <UiIcon name={blocked ? 'blocked' : 'uncertain'} size={18}/>}<span>{action}</span></div>
      <button className="button primary access-primary" aria-describedby="route-next-action" onClick={primaryAction}>
        {needsOtherRoute ? t('Xem tuyến khác', 'Review other route') : firstConstraint ? t('Xem đoạn cần kiểm tra', 'Inspect road constraint') : active ? t('Xem các đoạn đường', 'Review road sections') : t('Xem thông tin địa bàn', 'Review community findings')}
      </button>
    </section>
    {constraints.length > 0 && <section className="access-issues" aria-label={t('Đoạn ảnh hưởng tiếp cận', 'Access constraints')}>
      <h3>{t('Đoạn cần kiểm tra', 'Sections to check')}</h3>{constraints.map(road => <RoadConstraint key={road.id} road={road} routeName={active ? t(...active.name) : undefined} hazard={hazards.find(item => item.id === road.hz)} record={evidence.find(item => item.hazardId === road.hz)} locale={locale} onInspect={() => inspect(road.id)}/>)}
    </section>}
    {active && <div className="access-supplementary">
      {candidate && direct && <>
        <DisclosureTrigger className="access-disclosure" expanded={compare} aria-controls="access-route-options" onClick={() => setCompare(open => !open)}>{t('So sánh tuyến', 'Compare routes')}</DisclosureTrigger>
        {compare && <div id="access-route-options" className="route-options" role="group" aria-label={t('Chọn tuyến tiếp cận', 'Select access route')}>
          <RouteOption route={candidate} selected={active === candidate} locale={locale} onSelect={() => onSelectRoute('candidate')}/>
          <RouteOption route={direct} selected={active === direct} locale={locale} onSelect={() => onSelectRoute('direct')}/>
        </div>}
      </>}
      <DisclosureTrigger className="access-disclosure" expanded={allSections} aria-controls="access-route-sections" onClick={() => setAllSections(open => !open)}><span>{t('Các đoạn trên tuyến', 'Route sections')} ({active.segs.length})</span></DisclosureTrigger>
      {allSections && <div id="access-route-sections">{roadRows(active.segs)}</div>}
      {active.eta && <button className="access-disclosure" onClick={onFindings}>{t('Căn cứ ước tính thời gian', 'Travel estimate basis')}<UiIcon name="info" size={16}/></button>}
    </div>}
    <div className="route-tools access-tools">
      {active && <button className="button" onClick={onProfile} disabled={!hasProfile} title={!hasProfile ? t('Chưa có DEM cho tuyến này', 'DEM unavailable for this route') : undefined}><UiIcon name="profile" size={16}/>{t('Mặt cắt địa hình', 'Elevation profile')}</button>}
      <button className="button decision-save" onClick={onExport}><UiIcon name="download" size={16}/>{t('Lưu đánh giá', 'Save assessment')}</button>
    </div>
  </>;
}
