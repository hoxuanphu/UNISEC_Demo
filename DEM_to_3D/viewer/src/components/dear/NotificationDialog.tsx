import React from 'react';
import type { Locale, RoadSegment } from '../../types/dear';
import type { IncidentPacket } from '../../data/incidentPacket';
import { EvidenceMetadata } from '../../features/incident/EvidenceMetadata';
import { UiIcon } from './UiIcon';

type Props = {
  locale: Locale;
  report: IncidentPacket['report'];
  road?: RoadSegment;
  updated: boolean;
  historical?: boolean;
  onApplyReport: () => void;
  onClose: () => void;
  onSelectRoad: (roadId: string) => void;
};

export const NotificationDialog: React.FC<Props> = ({
  locale,
  report,
  road,
  updated,
  historical,
  onApplyReport,
  onClose,
  onSelectRoad
}) => {
  const t = (vi: string, en: string) => (locale === 'en' ? en : vi);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="notification-dialog-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id="notification-dialog-title">{t('Báo cáo hiện trường', 'Field report')}</h2>
          <button className="icon-button" onClick={onClose} aria-label={t('Đóng', 'Close')}>
            <UiIcon name="close" />
          </button>
        </div>

        <div className="modal-body">
          <div className="notification-list">
            <div
              className="notification-item"
            >
              <span className="notification-marker critical" />
              <div>
                <strong style={{ color: 'var(--critical-ink)' }}>
                  {t(...report.hazard.name)}
                </strong>
                {road && <p className="notification-road-name">{t(...road.name)}</p>}
                <p className="notification-finding">{t(...report.evidence.finding)}</p>
                <EvidenceMetadata evidence={report.evidence} locale={locale}/>
                {!updated && <small className="notification-pending">{t('Chưa áp dụng vào bản đồ', 'Not yet applied to the map')}</small>}
                <div className="notification-actions">
                  {!updated && <button className="button primary" onClick={() => { onApplyReport(); onClose(); }}>{t('Cập nhật bản đồ', 'Update map')}</button>}
                  {updated && historical && <button className="button primary" onClick={onApplyReport}>{t('Mở bản đồ cập nhật', 'Open updated map')}</button>}
                  <button className="text-button" onClick={() => { onSelectRoad(`road:${report.roadId}`); onClose(); }}>{t('Xem đoạn đường', 'View road segment')}</button>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
