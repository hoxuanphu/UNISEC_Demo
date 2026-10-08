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
import { CommunityEvidence } from '../../features/incident/CommunityEvidence';

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
  sectionId: string | null;
  onSelectSection: (id: string | null) => void;
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
  sectionId,
  onSelectSection,
  hasTerrainProfile,
  onToggleProfile,
  onOpenSources,
  onSelectObject,
  onOpenEvidence,
  onExport
}) => {
  const t = (vi: string, en: string) => (locale === 'en' ? en : vi);

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
          sectionId={sectionId} onSelectSection={onSelectSection} onEvidence={onOpenEvidence}
          hasProfile={hasTerrainProfile} onProfile={onToggleProfile} onInspect={onSelectObject}
          onFindings={() => onChangeDetailTab('evidence')} onExport={onExport}/>}

        {detailTab === 'evidence' && (
          <CommunityEvidence community={community} assessment={assessment} terrainCovered={terrainCovered}
            evidence={evidence} locale={locale} onSources={onOpenSources} onEvidence={onOpenEvidence}/>
        )}
      </div>
    </>
  );
};
