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
  const activeRoute = selectAccessRoute({ candidate: candidateRoute, direct: directRoute }, selectedRouteType);

  return (
    <>
      <div className="sidebar-top">
        <div className="detail-title">
          <h1 id="place-title">{community.name}</h1>
          <button className="icon-button panel-close" onClick={onBack} aria-label={t('Đóng chi tiết địa bàn', 'Close community details')} title={t('Đóng chi tiết địa bàn', 'Close community details')}><UiIcon name="close" /></button>
        </div>
        <div className="detail-priority">
          <StatusText tone={community.prio === 1 ? 'priority' : 'neutral'} icon={community.prio === 1 ? 'priority' : undefined}>
            {community.prio === 1 ? t('Ưu tiên cao', 'High priority') : t('Theo dõi', 'Monitor')}
          </StatusText>
        </div>


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
              <dl className="fact-rows">
                <div><dt>{assessment.priority === 1 ? t('Lý do ưu tiên', 'Priority basis') : t('Lý do theo dõi', 'Monitoring basis')}</dt><dd>{t(...assessment.reason)}</dd></div>
                <div><dt>{t('Dân số tham chiếu', 'Baseline population')}</dt><dd>{community.pop} {t('người', 'residents')}, {community.hh} {t('hộ', 'households')}</dd></div>
                <div><dt>{t('Độ cao', 'Elevation')}</dt><dd>{terrainCovered === false ? t('Ngoài phạm vi DEM', 'Outside DEM coverage') : terrainCovered === true ? t('Có dữ liệu DEM', 'DEM available') : t('Chưa đánh giá', 'Not assessed')}</dd></div>
                {activeRoute?.eta && <div><dt>{t('Ước tính thời gian', 'Travel estimate')}</dt><dd>{activeRoute.eta.mode === 'foot' ? t('Đi bộ', 'On foot') : t('Xe 4x4', '4WD')}. {t('Giả định đi qua được. Chưa tính thời gian kiểm tra và dọn đường.', 'Assumes passage. Inspection and road clearance are excluded.')}</dd></div>}
              </dl>
              <button className="text-button" onClick={onOpenSources}>{t('Phương pháp và nguồn dữ liệu', 'Method and data sources')}</button>
            </section>
            <CommunityFindings facts={community.facts} evidence={evidence} locale={locale} onOpenEvidence={onOpenEvidence}/>

          </div>
        )}
      </div>
    </>
  );
};
