import { useFloatingPanel } from '../../shared/hooks/useFloatingPanel';
import { isSelectPickerEvent } from '../../shared/ui/selectKeyboard';
import { reportReviewLabel } from '../access/reportReviewLabel';
import { useEffect, useRef, useState } from 'react';
import type { GeometryRecord } from '../../geo/vector/types';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { roleColors } from '../geodata/geometryPresentation';
import { SAME_SITE_METERS, centroid, groundSpread } from '../map/pointClusters';
import { observationTimeLabel } from './captureMetadata';
import { observationColor, observationLabel } from './labels';
import { observationOf } from './model';
import { PhotoLightbox, type LightboxPhoto } from './PhotoLightbox';
import './observations.css';
import './point-group.css';

const heroLimit = 5;

/**
 * Side panel for a cluster of nearby points: every photo of the group in one strip,
 * then one entry per point. Mirrors a place panel in consumer map apps.
 */
export function PointGroupCard({
  records,
  locale,
  activeId,
  openLabel,
  className = '',
  onOpen,
  onClose
}: {
  records: GeometryRecord[];
  locale: Locale;
  activeId: string | null;
  openLabel: string;
  className?: string;
  onOpen: (id: string) => void;
  onClose: () => void;
}): JSX.Element {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);
  const panel = useRef<HTMLElement>(null);
  const floating=useFloatingPanel(panel,'observation-group',true,'fit');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !e.defaultPrevented &&
        !isSelectPickerEvent(e) &&
        !(e.target as HTMLElement)?.closest('dialog[open]')
      ) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const [viewing, setViewing] = useState<number | null>(null);
  const points = records.flatMap((record) =>
    record.feature.geometry.type === 'Point'
      ? [
          {
            lat: record.feature.geometry.coordinates[1],
            lng: record.feature.geometry.coordinates[0]
          }
        ]
      : []
  );
  const centre = points.length ? centroid(points) : null,
    spread = groundSpread(points),
    site = spread <= SAME_SITE_METERS;
  const photos: LightboxPhoto[] = records.flatMap((record) =>
    (observationOf(record)?.photos ?? []).map((photo) => ({
      photo,
      recordId: record.id,
      recordName: record.name
    }))
  );
  const mixedSources =
    new Set(records.map((record) => record.source.name)).size > 1;
  const observations = records.filter((record) => observationOf(record)).length;
  const metres = Math.max(1, Math.round(spread));
  return (
    <section
      ref={panel}
      className={'field-map-card point-group-card ' + className}
      aria-label={t('Nhóm điểm gần nhau', 'Group of nearby points')}
    >
      <header className="floating-panel-handle" {...floating} tabIndex={0} role="group" aria-label={t('Vị trí nhóm điểm','Group position')}>
        <div>
          <h2>
            {site
              ? observations === records.length
                ? t(
                    `${records.length} ghi nhận tại cùng vị trí`,
                    `${records.length} observations at one location`
                  )
                : t(
                    `${records.length} điểm tại cùng vị trí`,
                    `${records.length} points at one location`
                  )
              : t(
                  `${records.length} điểm gần nhau`,
                  `${records.length} nearby points`
                )}
          </h2>
          <p className="point-group-meta">
            {centre && (
              <span>{`${centre.lat.toFixed(5)}°, ${centre.lng.toFixed(5)}°`}</span>
            )}
            <span>{`${t('Phạm vi khoảng', 'Approximate extent')} ${metres < 1000 ? metres + ' m' : (metres / 1000).toFixed(1) + ' km'}`}</span>
            {photos.length > 0 && (
              <span>
                {photos.length} {t('ảnh', 'photos')}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={t('Đóng nhóm điểm', 'Close point group')}
          onClick={onClose}
        >
          <UiIcon name="close" />
        </button>
      </header>
      {photos.length > 0 && (
        <div
          className="point-group-hero"
          data-count={Math.min(photos.length, heroLimit)}
        >
          {photos.slice(0, heroLimit).map((entry, position) => (
            <button
              key={entry.recordId + entry.photo.id}
              type="button"
              aria-label={t(
                `Xem ảnh ${entry.photo.name} của ${entry.recordName}`,
                `View ${entry.photo.name} from ${entry.recordName}`
              )}
              onClick={() => setViewing(position)}
            >
              <img src={entry.photo.preview} alt="" loading="lazy" />
              {position === heroLimit - 1 && photos.length > heroLimit ? (
                <span className="point-group-more">
                  +{photos.length - heroLimit}
                </span>
              ) : (
                records.length > 1 && (
                  <span className="point-group-caption">
                    {entry.recordName}
                  </span>
                )
              )}
            </button>
          ))}
        </div>
      )}
      <ol className="point-group-list">
        {records.map((record) => {
          const observation = observationOf(record);
          const color = observation
            ? observationColor(observation.kind)
            : roleColors[record.role];
          // Only what tells members apart: kind, time, and the source when sources differ.
          const meta = [
            observation && observationLabel(observation.kind, locale),
            observation &&
            (observation.observedAt || observation.observedLocalTime)
              ? observationTimeLabel(observation, locale)
              : '',
            observation && reportReviewLabel(record, locale),
            mixedSources && record.source.name
          ]
            .filter(Boolean)
            .map((text, index) => <span key={index}>{text}</span>);
          return (
            <li
              key={record.id}
              aria-current={record.id === activeId ? 'true' : undefined}
            >
              <button
                type="button"
                className="point-group-row"
                title={openLabel}
                onClick={() => onOpen(record.id)}
              >
                <span
                  className="point-group-marker"
                  style={{ background: color }}
                  aria-hidden="true"
                >
                  {observation
                    ? observation.kind === 'survey'
                      ? 'i'
                      : '!'
                    : ''}
                </span>
                <span className="point-group-text">
                  <strong>
                    {record.name || t('(Không tên)', '(Untitled)')}
                  </strong>
                  {meta.length > 0 && <small>{meta}</small>}
                </span>
                <UiIcon name="next" size={16} />
              </button>

            </li>
          );
        })}
      </ol>
      {viewing !== null && photos.length > 0 && (
        <PhotoLightbox
          photos={photos}
          index={viewing}
          locale={locale}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}
