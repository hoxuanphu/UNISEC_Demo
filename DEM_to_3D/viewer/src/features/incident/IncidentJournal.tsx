import { useState } from 'react';
import type { IncidentPacket } from '../../data/incidentPacket';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { downloadBlob } from '../../shared/downloadBlob';
import { localClock } from './sourceTime';
import { journalRecords } from './journalRecords';
import { type WorkEntry } from './responseWork';
import { EvidenceMetadata } from './EvidenceMetadata';
import './response-operations.css';

export type JournalProps = {
  packet: IncidentPacket;
  applied: boolean;
  historical: boolean;
  appliedAt: string | null;
  entries: WorkEntry[];
  locale: Locale;
  onClose: () => void;
  onOpenReport: () => void;
  onInspect: (id: string) => void;
  onRevision: (historical: boolean) => void;
};
export function IncidentJournal({
  packet,
  applied,
  historical,
  appliedAt,
  entries,
  locale,
  onClose,
  onOpenReport,
  onInspect,
  onRevision,
  initialFilter = 'all'
}: JournalProps & { initialFilter?: string }): JSX.Element {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);
  const [filter, setFilter] = useState(initialFilter);
  const records = journalRecords(packet, entries, appliedAt).filter(
    (record) => filter === 'all' || record.kind === filter
  );
  const kinds = {
    analysis: t('Phân tích', 'Analysis'),
    report: t('Báo cáo', 'Reports'),
    work: t('Công việc', 'Work'),
    revision: t('Bản đồ', 'Map revisions')
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="modal-dialog incident-journal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="journal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <h2 id="journal-title">{t('Nhật ký sự kiện', 'Incident journal')}</h2>
          <button
            className="icon-button"
            aria-label={t('Xuất nhật ký', 'Export journal')}
            title={t('Xuất nhật ký', 'Export journal')}
            onClick={() =>
              downloadBlob(
                new Blob(
                  [
                    JSON.stringify(
                      {
                        datasetVersion: packet.datasetVersion,
                        dataKind: packet.dataKind,
                        records: journalRecords(packet, entries, appliedAt)
                      },
                      null,
                      2
                    )
                  ],
                  { type: 'application/json' }
                ),
                'dear-incident-journal.json'
              )
            }
          >
            <UiIcon name="download" />
          </button>
          <button className="icon-button" aria-label={t('Đóng', 'Close')} onClick={onClose}>
            <UiIcon name="close" />
          </button>
        </header>
        <div className="response-work-context">
          {packet.dataKind === 'synthetic'
            ? t(
                'Kịch bản mô phỏng · thao tác công việc lưu tại trình duyệt',
                'Simulated scenario · work updates stored in this browser'
              )
            : t(
                'Báo cáo nguồn và thao tác trong workspace',
                'Source reports and workspace actions'
              )}
        </div>
        <div className="modal-body">
          <fieldset className="revision-choices">
            <legend>{t('Thời điểm bản đồ', 'Map revision')}</legend>
            <label>
              <input
                type="radio"
                name="revision"
                checked={!applied || historical}
                onChange={() => onRevision(applied)}
              />
              {t('Đánh giá ban đầu', 'Initial assessment')}{' '}
              <time dateTime={packet.incident.asOf}>{localClock(packet.incident.asOf)}</time>
            </label>
            {applied && (
              <label>
                <input
                  type="radio"
                  name="revision"
                  checked={!historical}
                  onChange={() => onRevision(false)}
                />
                {t('Sau báo cáo mới', 'After field update')}{' '}
                <time dateTime={packet.incident.asOfUpdated}>
                  {localClock(packet.incident.asOfUpdated)}
                </time>
              </label>
            )}
          </fieldset>
          <nav className="operations-filters" aria-label={t('Lọc nhật ký', 'Journal filters')}>
            {[['all', t('Tất cả', 'All')], ...Object.entries(kinds)].map(([id, label]) => (
              <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </nav>
          <ol className="notification-history journal-list">
            {records.map((record) => (
              <li key={record.id} data-journal-kind={record.kind}>
                <details>
                  <summary>
                    <time dateTime={record.at}>
                      <span>{new Date(record.at).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', {
                        timeZone: 'Asia/Bangkok',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                      <small>{new Date(record.at).toLocaleDateString('en-GB', {timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit'})}</small>
                    </time>
                    <span>
                      <strong>{t(...record.title)}</strong>
                      <small>
                        {record.kind === 'report' ? t('Tiếp nhận báo cáo', 'Report received') : kinds[record.kind]}
                        {record.pending
                          ? applied
                            ? t(' · đã cập nhật bản đồ', ' · applied to map')
                            : t(' · chờ kiểm tra', ' · awaiting review')
                          : ''}
                      </small>
                    </span>
                  </summary>
                  <div className="notification-record">
                    <p className="journal-finding">{t(...record.description)}</p>
                    {record.record && (
                      <>
                        <EvidenceMetadata
                          evidence={record.record}
                          locale={locale}
                          showSource={false}
                          showReceived={false}
                        />
                        <p className="small">{t(...record.record.limitation)}</p>
                      </>
                    )}
                    {record.entry && (
                      <dl className="journal-work-detail">
                        <div>
                          <dt>{t('Người phụ trách', 'Owner')}</dt>
                          <dd>{record.entry.owner || t('Chưa ghi nhận', 'Not recorded')}</dd>
                        </div>
                        {record.entry.note && (
                          <div>
                            <dt>{t('Kết quả / ghi chú', 'Result / note')}</dt>
                            <dd>{record.entry.note}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                    {record.pending ? (
                      <button className="text-button" onClick={onOpenReport}>
                        {t('Xem báo cáo', 'View report')}
                      </button>
                    ) : (
                      record.objectId && (
                        <button className="text-button" onClick={() => onInspect(record.objectId!)}>
                          {t('Xem trên bản đồ', 'View on map')}
                        </button>
                      )
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ol>
          {!records.length && (
            <p className="small">
              {t('Chưa có bản ghi trong nhóm này.', 'No records in this category.')}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
