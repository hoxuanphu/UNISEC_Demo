import { useEffect, useRef } from 'react';
import type { IncidentModel, Locale } from '../../types/dear';
import { UiIcon } from './UiIcon';
import type { IncidentPacket } from '../../data/incidentPacket';
import { localClock } from '../../features/incident/sourceTime';

export function TimelineDialog({ incident, report, locale, updated, historical, onRevision, onClose }: { incident: IncidentModel; report: IncidentPacket['report']; locale: Locale; updated: boolean; historical: boolean; onRevision: (historical: boolean) => void; onClose: () => void }): JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); trigger?.focus(); };
  }, []);
  return <dialog ref={ref} className="modal-dialog timeline-dialog" aria-labelledby="timeline-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-head"><h2 id="timeline-title">{t('Diễn biến sự kiện', 'Event timeline')}</h2><button className="icon-button" aria-label={t('Đóng', 'Close')} onClick={onClose}><UiIcon name="close" /></button></div>
    <div className="modal-body">
      <p className="data-context">{new Date(incident.triggeredAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok' })} (UTC+7)</p>
      <fieldset className="revision-choices"><legend>{t('Thời điểm bản đồ', 'Map revision')}</legend>
        <label><input type="radio" name="revision" checked={!updated || historical} onChange={() => onRevision(updated)}/>{t('Đánh giá ban đầu', 'Initial assessment')} <time dateTime={incident.asOf}>{new Date(incident.asOf).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })}</time></label>
        {updated && <label><input type="radio" name="revision" checked={!historical} onChange={() => onRevision(false)}/>{t('Sau báo cáo mới', 'After field update')} <time dateTime={incident.asOfUpdated}>{new Date(incident.asOfUpdated).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })}</time></label>}
      </fieldset>
      <ol className="event-timeline">{incident.timeline.map(([time, vi, en]) => <li key={time}><time>{time}</time><span>{t(vi, en)}</span></li>)}
        {updated && <li><time dateTime={report.evidence.receivedAt}>{localClock(report.evidence.receivedAt)}</time><span>{t(...report.evidence.finding)}</span></li>}
      </ol>
    </div>
  </dialog>;
}
