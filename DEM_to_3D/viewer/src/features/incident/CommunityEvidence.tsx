import type { Community, IncidentEvidence, Locale } from '../../types/dear';
import type { ResponseAssessment } from './responseAssessment';
import { CommunityFindings } from './CommunityFindings';
import { UiIcon } from '../../shared/ui/UiIcon';

export function CommunityEvidence({ community, assessment, terrainCovered, evidence, locale, onSources, onEvidence }: {
  community: Community; assessment: ResponseAssessment; terrainCovered: boolean | null;
  evidence: IncidentEvidence[]; locale: Locale;
  onSources: () => void; onEvidence: (id: string) => void;
}): JSX.Element {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  return <div className="community-evidence">
    <section className="assessment-basis">
      <dl className="fact-rows assessment-facts">
        <div><dt>{assessment.priority === 1 ? t('Lý do ưu tiên', 'Priority basis') : t('Tiếp cận', 'Access assessment')}</dt><dd>{t(...assessment.reason)}</dd></div>
      </dl>
    </section>
    <section className="community-reference-section">
      <h3>{t('Dữ liệu tham chiếu', 'Reference data')}</h3>
      <dl className="fact-rows">
        <div><dt>{t('Dân số', 'Population')}</dt><dd>{community.pop} {t('người', 'residents')}</dd></div>
        <div><dt>{t('Số hộ', 'Households')}</dt><dd>{community.hh} {t('hộ', 'households')}</dd></div>
        <div><dt>{t('Địa hình', 'Terrain')}</dt><dd>{terrainCovered === false ? t('Ngoài phạm vi DEM', 'Outside DEM coverage') : terrainCovered === true ? t('Có dữ liệu DEM', 'DEM available') : t('Chưa có thông tin', 'Not available')}</dd></div>
      </dl>
    </section>
    <CommunityFindings facts={community.facts} communityName={community.name} evidence={evidence} locale={locale} onOpenEvidence={onEvidence}/>
    <div className="community-evidence-actions"><button className="text-button" onClick={onSources}><UiIcon name="info" size={14}/>{t('Nguồn và cách đánh giá', 'Sources and assessment method')}</button></div>
  </div>;
}
