import type { CommunityFact, IncidentEvidence, Locale } from '../../types/dear';
import { observationTime } from './sourceTime';
import { resolveCommunityFindings } from './resolveCommunityFindings';
import { EvidenceMetadata } from './EvidenceMetadata';
import { evidencePresentation } from './evidencePresentation';

type Props = { facts: CommunityFact[]; evidence: IncidentEvidence[]; locale: Locale; onOpenEvidence: (hazardId: string) => void };

export function CommunityFindings({ facts, evidence, locale, onOpenEvidence }: Props): JSX.Element {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const findings = resolveCommunityFindings(facts, evidence);
  return <>{(['report', 'context', 'gap'] as const).map(kind => {
    const items = findings.filter(finding => finding.kind === kind);
    if (!items.length) return null;
    return <section className="workflow-section community-findings" key={kind}>
      <h3>{kind === 'gap' ? t('Thông tin còn thiếu', 'Information gaps') : kind === 'report' ? t('Ghi nhận tại địa bàn', 'Community observations') : t('Dữ liệu nền', 'Baseline data')}</h3>
      {items.map((finding, index) => {
        const record = evidence.find(item => item.hazardId === finding.hazardId);
        return <article className="community-finding" key={index}>
          <h4>{t(...finding.label)}</h4><p>{t(...finding.value)}</p>
          {record ? <EvidenceMetadata evidence={record} locale={locale} className="finding-source" showSource={false}/> : finding.source && <dl className="finding-source">
            <div><dt>{t('Nguồn', 'Source')}</dt><dd>{t(...finding.source)}</dd></div>
            {finding.observedAt && <div><dt>{t('Ghi nhận', 'Observed')}</dt><dd><time dateTime={finding.observedAt}>{observationTime(finding.observedAt, locale)}</time></dd></div>}
            {finding.receivedAt && <div><dt>{t('Tiếp nhận', 'Received')}</dt><dd><time dateTime={finding.receivedAt}>{observationTime(finding.receivedAt, locale)}</time></dd></div>}
          </dl>}
          {record && <button className="text-button" onClick={() => onOpenEvidence(record.hazardId)}>{evidencePresentation(record.type, locale).action}</button>}
        </article>;
      })}
    </section>;
  })}</>;
}
