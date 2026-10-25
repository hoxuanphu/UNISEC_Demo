import { areaDisplayName, areaPhotoEvidence } from '../landslides/areaEvidence';
import { FieldPhotoStrip } from '../fieldPhotos/FieldPhotoStrip';
import type { PreparedPhotoPoint } from '../fieldPhotos/preparedPhotos';
import { reportReviewLabel } from '../access/reportReviewLabel';
import { landslideAreaOf } from '../landslides/landslideAreas';
import { LandslideAreaSummary, landslideAreaHead } from '../landslides/LandslideAreaSummary';
import { StatusText } from '../../shared/ui/StatusText';
import type { RoadSegment } from '../../types/dear';
import { observationTimeLabel } from './captureMetadata';
import type { GeometryRecord } from '../../geo/vector/types';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { observationOf } from './model';
import { observationLabel } from './labels';
import { VoicePlayback } from './VoicePlayback';
import { submissionOf, submissionLocationLabel } from '../access/submissions';
import { PhotoGallery } from './PhotoGallery';
export function ResponseObservationCard({
  record,
  docked = false,
  records = [], fieldPhotos,
  locale,
  onClose,
  onEdit, onCompare, onRespond,
  onBack,
  roads = [], onRoad
}: {
  record: GeometryRecord;
  docked?: boolean;
  records?: GeometryRecord[]; fieldPhotos?: Map<string,PreparedPhotoPoint>;
  locale: Locale;
  onClose: () => void;
  onEdit: () => void; onCompare?:()=>void; onRespond?:()=>void;
  /** Returns to the point group this record was opened from. */
  onBack?: () => void;
  roads?: RoadSegment[];
  onRoad?: (id: string) => void;
}): JSX.Element {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);
  const reference = record.feature.properties.referenceKind;
  const sourceUrl = typeof record.feature.properties.sourceUrl === 'string' && /^https:\/\//.test(record.feature.properties.sourceUrl) ? record.feature.properties.sourceUrl : undefined;
  const observation = observationOf(record),
    point =
      record.feature.geometry.type === 'Point'
        ? record.feature.geometry.coordinates
        : null;
  const submission=submissionOf(record), emergency=observation?.kind==='help';
  const areaPhotos=areaPhotoEvidence(record,records,fieldPhotos);
  const stationPhotos=record.feature.geometry.type==='Point'?[...(fieldPhotos?.values()??[])].find(point=>point.surveyName.trim()===String(record.feature.properties.sourceName??record.name).trim()):undefined;
  const areaHead = landslideAreaHead(record, locale);
  return (
    <section
      className={"field-map-card" + (docked ? " is-docked" : "")}
      aria-label={reference === 'road-corridor' ? t('Tuyến đường tham chiếu', 'Reference road corridor') : landslideAreaOf(record) ? t('Vùng sạt lở', 'Landslide area') : emergency ? t('Yêu cầu cứu hộ', 'Rescue request') : t('Điểm dữ liệu GIS', 'GIS data point')}
    >
      <header>
        {onBack && (
          <button
            className="icon-button"
            aria-label={t('Quay lại nhóm điểm', 'Back to point group')}
            title={t('Quay lại nhóm điểm', 'Back to point group')}
            onClick={onBack}
          >
            <UiIcon name="back" />
          </button>
        )}
        <div className="detail-name">
          {areaHead && <p className="sheet-kind">{areaHead.kind}</p>}
          <h2>{areaHead ? areaDisplayName(record,locale) : submission?.authorName ?? record.name}</h2>
        </div>
        <button
          className="icon-button"
          aria-label={t('Đóng chi tiết', 'Close details')}
          onClick={onClose}
        >
          <UiIcon name="close" />
        </button>
        {areaHead && <div className="field-map-card-head">
          <div className="detail-priority"><StatusText tone={areaHead.unreviewed ? 'warning' : 'neutral'} icon={areaHead.unreviewed ? 'uncertain' : undefined}>{areaHead.review}</StatusText></div>

        </div>}
      </header>
      <div className="field-map-card-body">
      {areaPhotos && <FieldPhotoStrip point={areaPhotos.point} locale={locale} context={t(`Điểm khảo sát liên quan: ${areaPhotos.point.surveyName}.`,`Related survey station: ${areaPhotos.point.surveyName}.`)}/>}
      {areaHead && <div className="area-measure"><span>{t('Diện tích ước tính','Estimated area')}</span><strong>{areaHead.facts[0].value}</strong></div>}
      {landslideAreaOf(record) && <LandslideAreaSummary record={record} roads={roads} locale={locale} onRoad={onRoad}/>}

      {stationPhotos && <FieldPhotoStrip point={stationPhotos} locale={locale}/>}
      {reference === 'road-corridor' && <p className="field-note">{t('Đường tham chiếu OSM đến bản Chế Tạo. Chưa xác minh khả năng đi qua và vị trí trụ sở xã.', 'OSM reference road to Chế Tạo settlement. Passage and commune office location remain unverified.')}</p>}
      {reference === 'destination-place' && <p className="field-note">{t('Mốc bản Chế Tạo từ GeoNames. Vị trí trụ sở xã chưa được xác minh.', 'Chế Tạo settlement reference from GeoNames. The commune office location has not been verified.')}</p>}
      {reference === 'required-imagery-point' && <p className="field-note">{typeof record.feature.properties.coverageCheck === 'string' ? record.feature.properties.coverageCheck : t('Ảnh tải về phải có pixel dữ liệu hợp lệ tại điểm này. Chưa xác nhận ảnh đáp ứng yêu cầu.', 'Downloaded imagery must contain valid pixels here. Coverage has not yet been confirmed.')}</p>}
      {observation && (
        <>
          <div className="field-record-heading">
            {record.name.trim().toLocaleLowerCase() !== observationLabel(observation.kind, locale).toLocaleLowerCase() && <strong>{observationLabel(observation.kind, locale)}</strong>}
            <span className="field-status">
              {reportReviewLabel(record, locale)}
            </span>
          </div>
          {observation.note&&!['Rescue needed at this location.','Cần cứu hộ tại vị trí này.'].includes(observation.note)&&<p className="field-note">{observation.note}</p>}
          <VoicePlayback voice={observation.voice} locale={locale}/>
          {submissionLocationLabel(record,locale)&&<p className="field-hint">{submissionLocationLabel(record,locale)}</p>}
        </>
      )}
      {!landslideAreaOf(record) && <dl className="field-metadata">
        {point && (
          <>
            <div>
              <dt>{t('Vĩ độ', 'Latitude')}</dt>
              <dd>{point[1].toFixed(6)}°</dd>
            </div>
            <div>
              <dt>{t('Kinh độ', 'Longitude')}</dt>
              <dd>{point[0].toFixed(6)}°</dd>
            </div>
          </>
        )}
        {reference === 'road-corridor' && typeof record.feature.properties.lengthM === 'number' && <div><dt>{t('Chiều dài theo đường', 'Mapped length')}</dt><dd>{(record.feature.properties.lengthM/1000).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB',{maximumFractionDigits:2})} km</dd></div>}
        {!emergency && <div>
          <dt>{t('Nguồn', 'Source')}</dt>
          <dd>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">{record.source.name}</a> : record.source.name}</dd>
        </div>}
        {observation &&
          (observation.observedAt || observation.observedLocalTime) && (
            <div>
              <dt>{t('Ghi nhận lúc', 'Observed at')}</dt>
              <dd>{observationTimeLabel(observation, locale)}</dd>
            </div>
          )}
      </dl>}
      {observation && (
        <PhotoGallery photos={observation.photos} locale={locale} />
      )}
      </div>
      {emergency&&onRespond&&<footer><button className="button primary" onClick={onRespond}>{t('Điều đội cứu hộ','Dispatch team')}</button></footer>}
      {!emergency && <footer>{areaHead&&onCompare&&<button className="button" onClick={onCompare}>{t('Đối chiếu ảnh','Compare imagery')}</button>}<button className="button" onClick={onEdit}>
        {t('Mở trong GIS', 'Open in GIS')}
      </button></footer>}
    </section>
  );
}
