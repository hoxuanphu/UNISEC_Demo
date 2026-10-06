import type { IncidentPacket } from '../../data/incidentPacket';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { localClock } from './sourceTime';
import { EvidenceMetadata } from './EvidenceMetadata';

export function NotificationCenter({ packet, applied, locale, onClose, onOpenReport, onInspect }: {
  packet: IncidentPacket; applied: boolean; locale: Locale; onClose: () => void;
  onOpenReport: () => void; onInspect: (key: string) => void;
}): JSX.Element {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const records = [...packet.evidence, packet.report.evidence].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  return <div className="modal-overlay" onClick={onClose}><section className="modal-dialog notification-center" role="dialog" aria-modal="true" aria-labelledby="notification-center-title" onClick={event => event.stopPropagation()}>
    <header className="modal-head"><h2 id="notification-center-title">{t('Thông báo sự kiện', 'Incident notifications')}</h2><button className="icon-button" aria-label={t('Đóng', 'Close')} onClick={onClose}><UiIcon name="close"/></button></header>
    <div className="modal-body">
      <ol className="notification-history">{records.map(record => {
        const pending = record.id === packet.report.evidence.id;
        const hazard = pending ? packet.report.hazard : packet.hazards.find(item => item.id === record.hazardId);
        const road = packet.roads.find(item => item.hz === record.hazardId);
        return <li key={record.id}><details><summary><time dateTime={record.receivedAt}>{localClock(record.receivedAt)}</time><span><strong>{hazard ? t(...hazard.name) : t(...record.source)}</strong><small>{t(...record.source)}{pending && !applied ? t(' (chờ cập nhật)', ' (pending update)') : ''}</small></span></summary>
          <div className="notification-record"><p>{t(...record.finding)}</p><EvidenceMetadata evidence={record} locale={locale} showSource={false}/><p className="small">{t(...record.limitation)}</p>
            {pending ? <button className="text-button" onClick={onOpenReport}>{t('Xem báo cáo', 'View report')}</button> : road && <button className="text-button" onClick={() => onInspect(`road:${road.id}`)}>{t('Xem đoạn đường', 'View road segment')}</button>}
          </div></details></li>;
      })}<li className="notification-trigger"><time dateTime={packet.incident.triggeredAt}>{localClock(packet.incident.triggeredAt)}</time><strong>{t('Kích hoạt đánh giá', 'Assessment triggered')}: {t(...packet.aoi.name)}</strong></li></ol>
    </div>
  </section></div>;
}
