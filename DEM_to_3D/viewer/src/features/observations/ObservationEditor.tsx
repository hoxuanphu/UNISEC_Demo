import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GeometryRecord } from '../../geo/vector/types';
import type { Locale } from '../../types/dear';
import {
  observationOf,
  observationKinds,
  photoLimits,
  type FieldObservation,
  type FieldPhoto,
  type ObservationKind
} from './model';
import { observationLabel } from './labels';
import { readFieldPhoto } from './photo';
import { PhotoGallery } from './PhotoGallery';
import { reportPhotoContext } from './photoSummary';
import { VoicePlayback } from './VoicePlayback';
import { VoiceRecorder } from './VoiceRecorder';
import type { FieldVoice } from './voice';
import { submissionLocationLabel } from '../access/submissions';
import { FileDropZone } from '../../shared/ui/FileDropZone';
import {
  deviceLocal,
  recordCaptureTime,
  photoCaptureTime,
  observationTimeLabel
} from './captureMetadata';

export function ObservationEditor({
  record,
  locale,
  onSave,
  onResponse,
  initialEditing = false,
  compact = false,
  positionAccuracy,
  locationControl,
  submitLabel,
  onPhotosRead,
  disabled = false
}: {
  record: GeometryRecord;
  locale: Locale;
  disabled?: boolean;
  initialEditing?: boolean;
  compact?: boolean;
  positionAccuracy?: number | null;
  locationControl?: ReactNode;
  submitLabel?: string;
  onPhotosRead?: (photos: FieldPhoto[]) => void;
  onSave: (value: FieldObservation) => boolean;
  onResponse?: () => void;
}): JSX.Element {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);
  const current = observationOf(record);
  const [editing, setEditing] = useState(initialEditing),
    [kind, setKind] = useState<ObservationKind>(current?.kind ?? 'other');
  const [note, setNote] = useState(
      current?.note ??
        String(
          record.feature.properties.note ??
            record.feature.properties.description ??
            ''
        ).slice(0, 2000)
    ),
    [observer, setObserver] = useState(
      current?.observer ??
        String(record.feature.properties.observer ?? '').slice(0, 160)
    );
  const seed = recordCaptureTime(record);
  const initialObserved = current?.observedAt
    ? deviceLocal(current.observedAt)
    : current
      ? (current.observedLocalTime ?? '')
      : seed?.instant
        ? deviceLocal(seed.instant)
        : (seed?.local ?? '');
  const initialZone = current
    ? current.observedLocalTime
      ? 'unknown'
      : 'device'
    : seed && !seed.instant
      ? 'unknown'
      : 'device';
  const [observed, setObserved] = useState(initialObserved);
  const [timeZone, setTimeZone] = useState(initialZone);
  const timeTouched = useRef(false);
  const [timeSource, setTimeSource] = useState(
    current ? '' : (seed?.source ?? '')
  );

  const [voice,setVoice]=useState<FieldVoice|undefined>(current?.voice),[voiceBusy,setVoiceBusy]=useState(false);
  const [photos, setPhotos] = useState<FieldPhoto[]>(current?.photos ?? []),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const alive = useRef(true),
    guard = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function attach(files: File[]) {
    if (guard.current || disabled) return;
    if (photos.length + files.length > photoLimits.count) {
      setError(t('Tối đa 3 ảnh cho một điểm.', 'Up to 3 photos per point.'));
      return;
    }
    guard.current = true;
    setBusy(true);
    setError('');
    try {
      const additions: FieldPhoto[] = [];
      for (const file of files) additions.push(await readFieldPhoto(file));
      if (alive.current) {
        setPhotos((previous) => [...previous, ...additions]);
        onPhotosRead?.(additions);
        if (!observed && !timeTouched.current) {
          const capture = additions.map(photoCaptureTime).find(Boolean);
          if (capture) {
            setObserved(
              capture.instant ? deviceLocal(capture.instant) : capture.local
            );
            setTimeZone(capture.instant ? 'device' : 'unknown');
            setTimeSource(capture.source);
          }
        }
      }
    } catch {
      if (alive.current)
        setError(
          t(
            'Không đọc được ảnh. Chọn JPEG, PNG, WebP, AVIF hoặc HEIC, tối đa 8 MB và 40 megapixel.',
            'Could not read photo. Choose JPEG, PNG, WebP, AVIF or HEIC up to 8 MB and 40 megapixels.'
          )
        );
    } finally {
      guard.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section
      className="field-observation"
      aria-label={t('Ghi nhận thực địa', 'Field observation')}
    >
      {!compact && (
        <header>
          <h3>{t('Ghi nhận thực địa', 'Field observation')}</h3>
        </header>
      )}
      {!editing && current ? (
        <>
          {!compact && (
            <strong>{observationLabel(current.kind, locale)}</strong>
          )}
          {current.note && <p className="field-note">{current.note}</p>}
          <dl className="field-metadata">
            {record.feature.geometry.type === 'Point' && <div><dt>{t('Vị trí ghi nhận', 'Reported location')}</dt><dd>{record.feature.geometry.coordinates[1].toFixed(6)}, {record.feature.geometry.coordinates[0].toFixed(6)}</dd></div>}
            <div>
              <dt>{t('Ghi nhận lúc', 'Observed at')}</dt>
              <dd>{observationTimeLabel(current, locale)}</dd>
            </div>
            {current.observer && (
              <div>
                <dt>{t('Người ghi nhận', 'Observer')}</dt>
                <dd>
                  {current.observer || t('Chưa ghi nhận', 'Not recorded')}
                </dd>
              </div>
            )}
            {current.accuracyM != null && (
              <div>
                <dt>{t('Sai số vị trí', 'Location accuracy')}</dt>
                <dd>
                  {current.accuracyM == null
                    ? t('Chưa có thông tin', 'Not available')
                    : `${current.accuracyM} m`}
                </dd>
              </div>
            )}
          </dl>
          {submissionLocationLabel(record,locale)&&<p className="field-hint">{submissionLocationLabel(record,locale)}</p>}
          <VoicePlayback voice={current.voice} locale={locale}/>
          <PhotoGallery photos={current.photos} locale={locale} reported={reportPhotoContext(record)} />
          <div className="geodata-actions">
            <button
              className="button"
              disabled={disabled}
              onClick={() => setEditing(true)}
            >
              {t('Sửa ghi nhận', 'Edit observation')}
            </button>
            {onResponse && (
              <button className="button" onClick={onResponse}>
                {t('Xem trên bản đồ ứng phó', 'View on response map')}
              </button>
            )}
          </div>
        </>
      ) : !editing ? (
        <button
          className="button"
          disabled={disabled}
          onClick={() => setEditing(true)}
        >
          {t('Thêm ghi nhận thực địa', 'Add field observation')}
        </button>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (busy || voiceBusy || disabled) return;
            if (!photos.length && !voice && !note.trim()) {
              setError(
                t(
                  'Thêm ảnh, ghi âm hoặc mô tả điều bạn thấy.',
                  'Add a photo, a recording or describe what you saw.'
                )
              );
              return;
            }
            const date = observed ? new Date(observed) : null;
            if (date && !Number.isFinite(date.getTime())) {
              setError(
                t('Thời gian không hợp lệ.', 'Invalid observation time.')
              );
              return;
            }
            const value: FieldObservation = {
              schema: 'field-observation/v1',
              kind,
              note: note.trim(),
              observer: observer.trim(),
              observedAt:
                timeZone === 'device' ? (date?.toISOString() ?? '') : '',
              ...(observed && timeZone === 'unknown'
                ? {
                    observedLocalTime:
                      observed.length === 16 ? observed + ':00' : observed
                  }
                : {}),
              accuracyM: positionAccuracy ?? current?.accuracyM ?? null,
              status: 'unreviewed',
              photos,
              ...(voice?{voice}:{}),
              updatedAt: new Date().toISOString()
            };
            if (onSave(value)) {
              setEditing(false);
              setError('');
            } else
              setError(
                t(
                  'Chưa lưu được. Kiểm tra dung lượng lưu trữ hoặc giảm số ảnh.',
                  'Could not save. Check local storage capacity or remove a photo.'
                )
              );
          }}
        >
          <VoiceRecorder voice={voice} onChange={setVoice} onBusyChange={setVoiceBusy} locale={locale} active={editing} disabled={busy||disabled}/>
          <fieldset disabled={busy || disabled}>
            <FileDropZone
              icon="image"
              title={t('Thêm ảnh hiện trường', 'Add field photos')}
              inputLabel={t('Ảnh hiện trường', 'Field photos')}
              hint={photos.length ? `${photos.length}/${photoLimits.count} ${t('ảnh', 'photos')}` : t(`Tối đa ${photoLimits.count} ảnh`, `Up to ${photoLimits.count} photos`)}
              accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif"
              multiple
              disabled={busy || disabled || photos.length >= photoLimits.count}
              onFiles={(files) => void attach(files)}
              onRejected={() =>
                setError(
                  t(
                    'Chọn ảnh JPG, PNG, WebP, AVIF hoặc HEIC/HEIF.',
                    'Choose JPG, PNG, WebP, AVIF or HEIC/HEIF photos.'
                  )
                )
              }
            />
            <PhotoGallery
              photos={photos}
              locale={locale}
              onRemove={(id) =>
                setPhotos((value) => value.filter((p) => p.id !== id))
              }
            />
            {locationControl}
            <details className="field-extra">
              <summary>{t('Thông tin bổ sung', 'More information')}</summary>
              <label className="geodata-field">
                {t('Loại ghi nhận', 'Observation type')}
                <select
                  aria-label={t('Loại ghi nhận', 'Observation type')}
                  value={kind}
                  onChange={(e) => setKind(e.target.value as ObservationKind)}
                >
                  {observationKinds.map((value) => (
                    <option value={value} key={value}>
                      {observationLabel(value, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="geodata-field">
                {t('Ghi chú hiện trường', 'Field note')}
                <textarea
                  aria-label={t('Ghi chú hiện trường', 'Field note')}
                  maxLength={2000}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <label className="geodata-field">
                {t('Thời gian ghi nhận', 'Observation time')}
                <input
                  type="datetime-local"
                  step="0.001"
                  value={observed}
                  onChange={(e) => {
                    timeTouched.current = true;
                    setTimeSource('');
                    setObserved(e.target.value);
                  }}
                />
              </label>
              <label className="geodata-field">
                {t('Múi giờ', 'Time zone')}
                <select
                  value={timeZone}
                  onChange={(e) => {
                    timeTouched.current = true;
                    setTimeZone(e.target.value);
                  }}
                >
                  <option value="device">
                    {t('Theo thiết bị', 'Device time zone')}
                  </option>
                  <option value="unknown">
                    {t('Chưa xác định', 'Unknown')}
                  </option>
                </select>
              </label>
              {timeSource && (
                <p className="field-hint" role="status">
                  {t('Thời gian lấy từ ', 'Time from ') + timeSource}
                </p>
              )}
              {!compact && (
                <>
                  <label className="geodata-field">
                    {t('Người ghi nhận', 'Observer')}
                    <input
                      maxLength={160}
                      value={observer}
                      onChange={(e) => setObserver(e.target.value)}
                    />
                  </label>
                </>
              )}
            </details>
          </fieldset>
          {busy && <p role="status">{t('Đang đọc ảnh', 'Reading photos')}</p>}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="geodata-actions field-form-actions">
            <button
              className="button primary"
              type="submit"
              disabled={busy || voiceBusy || disabled}
            >
              {submitLabel ?? t('Lưu ghi nhận', 'Save observation')}
            </button>
            <button
              type="button"
              className="button"
              disabled={busy || disabled}
              onClick={() => {
                setKind(current?.kind ?? 'other');
                setNote(current?.note ?? '');
                setObserver(current?.observer ?? '');

                setPhotos(current?.photos ?? []);
                setVoice(current?.voice);
                setObserved(initialObserved);
                setTimeZone(initialZone);
                timeTouched.current = false;
                setTimeSource(current ? '' : (seed?.source ?? ''));
                setEditing(false);
                setError('');
              }}
            >
              {t('Hủy', 'Cancel')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
