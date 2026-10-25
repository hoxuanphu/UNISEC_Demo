import type { IncidentModel, Locale, RoadSegment } from '../../types/dear';
import type { IncidentPacket } from '../../data/incidentPacket';
import { localClock } from '../../features/incident/sourceTime';
import { UiIcon } from '../../shared/ui/UiIcon';

export type RescueAlert = {id:string;name:string;at:string;kind:'help'|'proposal'};
type Props = {rescueAlerts?:RescueAlert[];onOpenReports?:()=>void;onRescueOpen?:(id:string)=>void; locale: Locale; incident: IncidentModel; report: IncidentPacket['report']; road?: RoadSegment; updated: boolean; onClose: () => void; onOpenDetails: () => void; onOpenIncident: () => void; onOpenAll: () => void };

export function NotificationPopover({ rescueAlerts=[], onOpenReports, onRescueOpen, locale, incident, report, updated, onClose, onOpenDetails, onOpenIncident, onOpenAll }: Props): JSX.Element {
  const t = (vi: string, en: string) => locale === 'en' ? en : vi;
  return <section className="notification-popover" id="incident-notifications" data-popover role="dialog" aria-modal="false" aria-labelledby="notification-preview-title">
    <div className="notification-heading"><h2 id="notification-preview-title">{t('Thông báo', 'Notifications')}</h2><button className="icon-button" onClick={onClose} aria-label={t('Đóng thông báo', 'Close notifications')}><UiIcon name="close" size={16}/></button></div>
    {rescueAlerts.slice(0,4).map(alert=><button key={alert.id} className="notification-rescue-row" onClick={()=>onRescueOpen?.(alert.id)}>
      <span className={alert.kind==='help'?'notification-critical-title':undefined}>{alert.kind==='help'?t('Cầu cứu','Rescue request'):t('Đề xuất tuyến','Route proposal')}</span>
      <strong>{alert.name}</strong><time dateTime={alert.at}>{localClock(alert.at)}</time><UiIcon name="next" size={16}/>
    </button>)}
    {rescueAlerts.length>4&&<button className="text-button notification-all" onClick={onOpenReports}>{t(`Tất cả yêu cầu (${rescueAlerts.length})`,`All requests (${rescueAlerts.length})`)}</button>}
    <button className="notification-rescue-row" onClick={onOpenDetails}>
      <span className="notification-critical-title">{updated?t('Đường bị chặn','Road blocked'):t('Báo cáo mới','New report')}</span>
      <strong>{t(...report.hazard.name)}</strong><time dateTime={report.evidence.receivedAt}>{localClock(report.evidence.receivedAt)}</time><UiIcon name="next" size={16}/>
    </button>
    <button className="notification-rescue-row" onClick={onOpenIncident}>
      <span>{t('Sự kiện','Incident')}</span><strong>{incident.title?t(...incident.title):t('Cảnh báo sự kiện','Incident alert')}</strong>
      <time dateTime={incident.triggeredAt}>{localClock(incident.triggeredAt)}</time><UiIcon name="next" size={16}/>
    </button>
    <button className="text-button notification-all" onClick={onOpenAll}>{t('Nhật ký sự kiện', 'Incident journal')}</button>
  </section>;
}
