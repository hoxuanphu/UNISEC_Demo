import type { IncidentModel, Locale, RoadSegment } from '../../types/dear';
import type { IncidentPacket } from '../../data/incidentPacket';
import { localClock } from '../../features/incident/sourceTime';
import { UiIcon } from '../../shared/ui/UiIcon';

type Props = { locale: Locale; incident: IncidentModel; report: IncidentPacket['report']; road?: RoadSegment; updated: boolean; onClose: () => void; onOpenDetails: () => void; onOpenIncident: () => void; onOpenAll: () => void };

export function NotificationPopover({ locale, incident, report, road, updated, onClose, onOpenDetails, onOpenIncident, onOpenAll }: Props): JSX.Element {
  const t = (vi: string, en: string) => locale === 'en' ? en : vi;
  return <section className="notification-popover" id="incident-notifications" data-popover role="dialog" aria-modal="false" aria-labelledby="notification-preview-title">
    <div className="notification-heading"><h2 id="notification-preview-title">{t('Thông báo', 'Notifications')}</h2><button className="icon-button" onClick={onClose} aria-label={t('Đóng thông báo', 'Close notifications')}><UiIcon name="close" size={16}/></button></div>
    <div className="notification-preview">
      <div className="notification-preview-heading"><strong className="notification-critical-title">{t(...report.hazard.name)}</strong><time dateTime={report.evidence.receivedAt}>{localClock(report.evidence.receivedAt)}</time></div>
      {road && <span className="notification-road-name">{t(...road.name)}</span>}
      <p>{t(...report.evidence.finding)}</p>
      <span className="small">{updated ? t('Đã cập nhật bản đồ', 'Applied to map') : t('Chờ cập nhật bản đồ', 'Pending map update')}</span>
      <button className="text-button" onClick={onOpenDetails}>{t('Xem chi tiết', 'View details')}</button>
    </div>
    <div className="notification-preview notification-incident">
      <div className="notification-preview-heading"><strong>{incident.title ? t(...incident.title) : t('Cảnh báo sự kiện', 'Incident alert')}</strong><time dateTime={incident.triggeredAt}>{localClock(incident.triggeredAt)}</time></div>
      <button className="text-button" onClick={onOpenIncident}>{t('Mở sự kiện', 'Open incident')}</button>
    </div>
    <button className="text-button notification-all" onClick={onOpenAll}>{t('Tất cả thông báo', 'All notifications')}</button>
  </section>;
}
