import React from 'react';
import type {
  Community,
  DetailTab,
  Hazard,
  IncidentEvidence,
  Locale,
  ScenarioRoute
} from '../../types/dear';
import { UiIcon } from './UiIcon';
import { StatusText } from '../../shared/ui/StatusText';
import { AccessPanel } from '../../features/routes/AccessPanel';
import type { ResponseAssessment } from '../../features/incident/responseAssessment';
import { CommunityFindings } from '../../features/incident/CommunityFindings';
import { selectAccessRoute } from '../../features/routes/routeReview';

type Props = {
  community: Community;
  assessment: ResponseAssessment;
  terrainCovered: boolean | null;
  hazards: Hazard[];
  evidence: IncidentEvidence[];
  locale: Locale;
  detailTab: DetailTab;
  onChangeDetailTab: (tab: DetailTab) => void;
  onBack: () => void;
  candidateRoute: ScenarioRoute | null;
  directRoute: ScenarioRoute | null;
  selectedRouteType: 'candidate' | 'direct';
  onChangeRouteType: (type: 'candidate' | 'direct') => void;
  hasTerrainProfile: boolean;
  onToggleProfile: () => void;
  onOpenSources: () => void;
  onSelectObject: (obj: string) => void;
  onOpenEvidence: (hazardId: string) => void;
  onExport: () => void;
};

export const CommunityDetailView: React.FC<Props> = ({
  community,
  assessment,
  terrainCovered,
  hazards,
  evidence,
  locale,
  detailTab,
  onChangeDetailTab,
  onBack,
  candidateRoute,
  directRoute,
  selectedRouteType,
  onChangeRouteType,
  hasTerrainProfile,
  onToggleProfile,
  onOpenSources,
  onSelectObject,
  onOpenEvidence,
  onExport
}) => {
  const t = (vi: string, en: string) => (locale === 'en' ? en : vi);
  const hazardName = (id: string) => {
    const hazard = hazards.find(item => item.id === id);
    return hazard ? t(hazard.name[0], hazard.name[1]) : id;
  };

  const activeRoute = selectAccessRoute({ candidate: candidateRoute, direct: directRoute }, selectedRouteType);
  const accessIssues = [...new Map(
    [directRoute, candidateRoute].flatMap(route => route?.segs ?? [])
      .filter(segment => segment.status !== 'open')
      .map(segment => [segment.id, segment] as const)
  ).values()];

  return (
    <>
      <div className="sidebar-top">
        <div className="detail-title">
          <h1 id="place-title">{community.name}</h1>
          <button className="icon-button panel-close" onClick={onBack} aria-label={t('Đóng chi tiết địa bàn', 'Close community details')} title={t('Đóng chi tiết địa bàn', 'Close community details')}><UiIcon name="close" /></button>
        </div>
        <div className="detail-priority">
          <StatusText tone={community.prio === 1 ? 'critical' : 'neutral'} icon={community.prio === 1 ? 'priority' : undefined}>
            {community.prio === 1 ? t('Ưu tiên cao', 'High priority') : t('Theo dõi', 'Monitor')}
          </StatusText>
        </div>

        {detailTab === 'decision' && community.prio === 1 && <p className="priority-reason">{t(...assessment.reason)}</p>}

        <div className="decision-tabs" role="group">
          <button
            aria-pressed={detailTab === 'decision'}
            onClick={() => onChangeDetailTab('decision')}
          >
            {t('Tiếp cận', 'Access')}
          </button>
          <button
            aria-pressed={detailTab === 'evidence'}
            onClick={() => onChangeDetailTab('evidence')}
          >
            {t('Căn cứ', 'Evidence')}
          </button>
        </div>
      </div>

      <div className="sidebar-scroll">
        {detailTab === 'decision' && <AccessPanel key={community.id}
          locale={locale} candidate={candidateRoute} direct={directRoute} hazards={hazards} evidence={evidence}
          selected={selectedRouteType} onSelectRoute={onChangeRouteType}
          hasProfile={hasTerrainProfile} onProfile={onToggleProfile} onInspect={onSelectObject}
          onFindings={() => onChangeDetailTab('evidence')} onExport={onExport}/>}

        {detailTab === 'evidence' && (
          <div>
            <section className="assessment-basis">
              <h3>{t('Căn cứ đánh giá', 'Assessment basis')}</h3>
              <dl className="community-reference">
                <div><dt>{assessment.priority === 1 ? t('Lý do ưu tiên', 'Priority basis') : t('Lý do theo dõi', 'Monitoring basis')}</dt><dd>{t(...assessment.reason)}</dd></div>
              </dl>
              {activeRoute?.eta && <dl className="community-reference estimate-method">
                <div><dt>{t('Phương tiện', 'Estimated travel mode')}</dt><dd>{activeRoute.eta.mode === 'foot' ? t('Đi bộ', 'On foot') : t('Xe 4x4', '4WD')}</dd></div>
                <div><dt>{t('Giả định tính thời gian', 'Travel time assumptions')}</dt><dd>{t('Giả định đi qua được. Chưa tính thời gian kiểm tra và dọn đường.', 'Assumes passage. Inspection and road clearance are excluded.')}</dd></div>
              </dl>}
              <button className="text-button" onClick={onOpenSources}>{t('Phương pháp và nguồn dữ liệu', 'Method and data sources')}</button>
            </section>
            <dl className="community-reference">
              <div><dt>{t('Dân số tham chiếu', 'Baseline population')}</dt><dd>{community.pop} {t('người', 'residents')}, {community.hh} {t('hộ', 'households')}</dd></div>
              <div><dt>{t('Địa hình tại địa bàn', 'Local terrain')}</dt><dd>{terrainCovered === false ? t('Ngoài phạm vi DEM', 'Outside DEM coverage') : terrainCovered === true ? t('Có dữ liệu độ cao', 'Elevation data available') : t('Chưa đánh giá', 'Not assessed')}</dd></div>
            </dl>
            <CommunityFindings facts={community.facts} evidence={evidence} locale={locale} onOpenEvidence={onOpenEvidence}/>

            {accessIssues.length > 0 && <section className="workflow-section">
              <h3>{t('Báo cáo ảnh hưởng tiếp cận', 'Access impact reports')}</h3>
              {accessIssues
                .filter((s) => s.hz)
                .map((seg) => (
                  <button
                    key={seg.id}
                    className="object-row"
                    onClick={() => onSelectObject(`road:${seg.id}`)}
                  >
                    <span>
                      <strong>{hazardName(seg.hz!)}</strong>
                      <small>{t(seg.name[0], seg.name[1])}</small>
                    </span>
                    <StatusText tone={seg.status === 'blocked' ? 'critical' : 'warning'} icon={seg.status === 'blocked' ? 'blocked' : 'uncertain'}>
                      {seg.status === 'blocked' ? t('Bị chặn', 'Blocked') : t('Cần xác minh', 'Uncertain')}
                    </StatusText>
                  </button>
                ))}
            </section>}
          </div>
        )}
      </div>
    </>
  );
};
