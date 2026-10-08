import { useState } from 'react';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { downloadBlob } from '../../shared/downloadBlob';
import {
  workState,
  workStatusText,
  type ResponseWork,
  type WorkEntry,
  type WorkStatus
} from './responseWork';
import './response-operations.css';

export function ResponseWorkDialog({
  tasks,
  initialTaskId,
  entries,
  locale,
  readOnly,
  storageError,
  onRecord,
  onInspect,
  onReport,
  onClose
}: {
  tasks: ResponseWork[];
  entries: WorkEntry[];
  locale: Locale;
  readOnly: boolean;
  storageError: boolean;
  initialTaskId: string | null;
  onRecord: (task: ResponseWork, status: WorkStatus, note: string, owner: string) => void;
  onInspect: (id: string) => void;
  onReport: () => void;
  onClose: () => void;
}): JSX.Element {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);
  const [selected, setSelected] = useState(initialTaskId),
    [filter, setFilter] = useState('open');
  const [error, setError] = useState(false);
  const active = tasks.find((task) => task.id === selected);
  const state = active ? workState(active, entries) : null;
  const rows = tasks.filter(
    (task) => filter === 'all' || workState(task, entries).status !== 'done'
  );
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="modal-dialog response-work-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="response-work-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <h2 id="response-work-title">{t('Theo dõi xác minh', 'Verification tracking')}</h2>
          <button
            className="icon-button"
            aria-label={t('Xuất công việc', 'Export work')}
            title={t('Xuất công việc', 'Export work')}
            onClick={() =>
              downloadBlob(
                new Blob(
                  [JSON.stringify({ type: 'local-response-work', tasks, entries }, null, 2)],
                  { type: 'application/json' }
                ),
                'dear-response-work.json'
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
          {t(
            'Ghi nhận tại trình duyệt · không đồng bộ với đơn vị hiện trường',
            'Browser records · not shared with field teams'
          )}
        </div>
        {(readOnly || storageError) && <div className="response-work-notices">
          {readOnly && (
            <p className="operations-notice" role="status">
              {t(
                'Đang xem bản dữ liệu cũ. Về bản mới nhất để cập nhật công việc.',
                'Viewing an older revision. Return to the latest revision to update work.'
              )}
            </p>
          )}
          {storageError && (
            <p className="operations-notice" role="alert">
              {t(
                'Không đọc hoặc lưu được nhật ký cục bộ. Xuất công việc để giữ bản hiện tại.',
                'Local history could not be read or saved. Export work to keep this session.'
              )}
            </p>
          )}
        </div>}
        <div className={'modal-body response-work-body' + (active ? ' has-work' : '')}>
          <nav className="operations-filters" aria-label={t('Lọc công việc', 'Work filters')}>
            {[
              ['open', t('Chưa hoàn tất', 'Open')],
              ['all', t('Tất cả', 'All')]
            ].map(([id, label]) => (
              <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </nav>
          <ul className="response-work-list">
            {rows.map((task) => (
              <li key={task.id}>
                <button
                  className="response-work-row"
                  data-task-id={task.id}
                  aria-pressed={selected === task.id}
                  onClick={() => {
                    setSelected(task.id);
                    setError(false);
                  }}
                >
                  <span>
                    <strong>{t(...task.action)}</strong>
                    <small>{t(...task.subject)}</small>
                  </span>
                  <span className={`work-status work-${workState(task, entries).status}`}>
                    {t(...workStatusText[workState(task, entries).status])}
                  </span>
                </button>
              </li>
            ))}
          {!rows.length && (
            <li className="small">
              {t(
                'Không có việc chưa hoàn tất trong danh sách hiện tại.',
                'No open work in the current list.'
              )}
            </li>
          )}
          </ul>
          {active && state && (
            <section className="response-work-edit" key={active.id + state.status + state.note}>
              <button className="text-button work-back" onClick={() => setSelected(null)}>
                <UiIcon name="back" />
                {t('Danh sách công việc', 'Work list')}
              </button>
              <h3>{t(...active.action)}</h3>
              <p className="work-subject">{t(...active.subject)}</p>
              <section className="work-basis"><h4>{t('Căn cứ', 'Evidence')}</h4><p>{t(...active.reason)}</p></section>
              <button
                className="text-button"
                onClick={() => (active.kind === 'report' ? onReport() : onInspect(active.objectId))}
              >
                {active.kind === 'report'
                  ? t('Xem báo cáo', 'View report')
                  : t('Xem trên bản đồ', 'View on map')}
              </button>
              {state.changed && (
                <p className="operations-notice">
                  {t(
                    'Căn cứ đã thay đổi. Cần kiểm tra lại; ghi nhận trước vẫn còn trong nhật ký.',
                    'Evidence changed. Review again; previous records remain in the journal.'
                  )}
                </p>
              )}
              {active.kind !== 'report' && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    try {
                      onRecord(
                        active,
                        String(data.get('status')) as WorkStatus,
                        String(data.get('note') ?? ''),
                        String(data.get('owner') ?? '')
                      );
                      setError(false);
                    } catch {
                      setError(true);
                    }
                  }}
                >
                  <fieldset disabled={readOnly}>
                    <p className="work-completion">{t(...active.completion)}</p>
                    <div className="work-fields">
                      <label>
                        {t('Trạng thái công việc', 'Work status')}
                        <select
                          name="status"
                          aria-label={t('Trạng thái công việc', 'Work status')}
                          defaultValue={state.status}
                        >
                          {(Object.keys(workStatusText) as WorkStatus[]).map((status) => (
                            <option key={status} value={status}>
                              {t(...workStatusText[status])}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t('Người phụ trách', 'Owner')}
                        <input name="owner" maxLength={100} defaultValue={state.owner} />
                      </label>
                    </div>
                    <label>
                      {t('Kết quả / lý do chờ', 'Result / reason for waiting')}
                      <textarea name="note" rows={3} maxLength={1000} defaultValue={state.note} />
                    </label>
                    {error && (
                      <p className="operations-notice" role="alert">
                        {t(
                          'Nhập người phụ trách; ghi kết quả khi hoàn tất hoặc lý do chờ hỗ trợ.',
                          'Enter an owner, plus a result when completed or a reason for waiting.'
                        )}
                      </p>
                    )}
                    <button className="button primary" type="submit">
                      {t('Ghi nhận', 'Record update')}
                    </button>
                  </fieldset>
                </form>
              )}
              <p className="small">
                {t(
                  'Trạng thái công việc không thay đổi dữ liệu bản đồ.',
                  'Work status does not change map data.'
                )}
              </p>
            </section>
          )}
          {!active && (
            <div className="work-selection-empty">
              {t('Chọn công việc để xem và cập nhật.', 'Select work to view and update.')}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
