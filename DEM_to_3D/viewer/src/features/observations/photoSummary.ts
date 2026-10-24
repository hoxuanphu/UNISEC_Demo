import { photoCaptureTime, photoLocation } from './captureMetadata';
import { observationOf, type FieldPhoto } from './model';
import type { GeometryRecord } from '../../geo/vector/types';

export type PhotoReportContext = {
  coordinates?: readonly number[];
  observedAt?: string;
  observedLocalTime?: string;
};
export function reportPhotoContext(record: GeometryRecord): PhotoReportContext {
  const observation = observationOf(record);
  return {
    coordinates:
      record.feature.geometry.type === 'Point'
        ? record.feature.geometry.coordinates
        : undefined,
    observedAt: observation?.observedAt,
    observedLocalTime: observation?.observedLocalTime
  };
}
/** Hide only source values already shown by the report; preserve differences and unknown zones. */
export function photoSummary(photo: FieldPhoto, reported?: PhotoReportContext) {
  const capture = photoCaptureTime(photo);
  const sameTime =
    !!capture &&
    !!reported &&
    (capture.instant && reported.observedAt
      ? Date.parse(capture.instant) === Date.parse(reported.observedAt)
      : !reported.observedAt &&
        !!reported.observedLocalTime &&
        !capture.instant &&
        capture.local === reported.observedLocalTime);
  const location = photoLocation(photo);
  // The report displays six decimal places. Do not conceal differences beyond that precision.
  const sameLocation =
    !!location &&
    !!reported?.coordinates &&
    location.latitude.toFixed(6) ===
      reported.coordinates[1].toFixed(6) &&
    location.longitude.toFixed(6) ===
      reported.coordinates[0].toFixed(6);
  return {
    capture,
    location,
    showTime: !!capture && !sameTime,
    showGps: !!location && !sameLocation,
    showCamera: !reported && !!(photo.exif.Make || photo.exif.Model),
    differentTime:
      !!capture &&
      !sameTime &&
      !!(reported?.observedAt || reported?.observedLocalTime),
    differentLocation: !!location && !sameLocation && !!reported?.coordinates
  };
}
