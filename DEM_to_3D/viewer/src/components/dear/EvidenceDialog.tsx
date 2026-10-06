import type { Hazard, IncidentEvidence, Locale, RoadSegment } from '../../types/dear';
import { UiIcon } from './UiIcon';
import { EvidenceMetadata } from '../../features/incident/EvidenceMetadata';
import { evidencePresentation } from '../../features/incident/evidencePresentation';

type Props = {
  evidence?: IncidentEvidence;
  hazard?: Hazard;
  roads: RoadSegment[];
  locale: Locale;
  onClose: () => void;
  onSelectRoad: (id: string) => void;
};

export function EvidenceDialog({ evidence, hazard, roads, locale, onClose, onSelectRoad }: Props): JSX.Element {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const affected = roads.filter(road => road.hz === hazard?.id);
  return <div className="modal-overlay" onClick={onClose}>
    <section className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="evidence-dialog-title" onClick={event => event.stopPropagation()}>
      <div className="modal-head"><h2 id="evidence-dialog-title">{evidence ? evidencePresentation(evidence.type, locale).kind : t('Thông tin đánh giá', 'Assessment details')}</h2><button className="icon-button" onClick={onClose} aria-label={t('Đóng', 'Close')}><UiIcon name="close"/></button></div>
      <div className="modal-body">
        <h3 className="evidence-title">{hazard ? t(...hazard.name) : t('Chưa có thông tin chi tiết', 'No details available')}</h3>
        {evidence ? <>
          <p className="evidence-finding">{t(...evidence.finding)}</p>
          <EvidenceMetadata evidence={evidence} locale={locale}/>
          {affected.length > 0 && <section className="workflow-section"><h3>{t('Ảnh hưởng đến tiếp cận', 'Access impact')}</h3>{affected.map(road => <button className="object-row evidence-road" key={road.id} onClick={() => onSelectRoad(`road:${road.id}`)}><strong>{t(...road.name)}</strong><span>{road.status === 'blocked' ? t('Bị chặn', 'Blocked') : t('Khả năng đi qua chưa xác minh', 'Passability unverified')}</span></button>)}</section>}
          <section className="workflow-section"><h3>{t('Cần xác minh', 'Verification needed')}</h3><p>{t(...evidence.limitation)}</p></section>
        </> : <p>{t('Chưa có bản ghi chi tiết cho nhận định này.', 'No detailed record is available for this finding.')}</p>}
      </div>
    </section>
  </div>;
}
