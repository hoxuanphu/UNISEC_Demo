import type { IncidentEvidence, Locale } from '../../types/dear';
import { evidencePresentation } from './evidencePresentation';
import { observationTime } from './sourceTime';

type Props = {
  evidence: IncidentEvidence; locale: Locale; className?: string;
  showSource?: boolean; showObserved?: boolean; showReceived?: boolean;
};

export function EvidenceMetadata({ evidence, locale, className = 'evidence-metadata', showSource = true, showObserved = true, showReceived = true }: Props): JSX.Element {
  const labels = evidencePresentation(evidence.type, locale);
  return <dl className={className}>
    {showSource && <div><dt>{labels.source}</dt><dd>{evidence.source[locale === 'vi' ? 0 : 1]}</dd></div>}
    {showObserved && <div><dt>{labels.observed}</dt><dd><time dateTime={evidence.observedAt}>{observationTime(evidence.observedAt, locale)}</time></dd></div>}
    {showReceived && <div><dt>{labels.received}</dt><dd><time dateTime={evidence.receivedAt}>{observationTime(evidence.receivedAt, locale)}</time></dd></div>}
  </dl>;
}
