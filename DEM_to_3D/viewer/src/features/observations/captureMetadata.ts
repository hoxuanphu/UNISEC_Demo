import type { GeometryRecord } from '../../geo/vector/types';
import type { AppPhotoCapture, FieldPhoto, FieldObservation } from './model';
import type { Locale } from '../../types/dear';

export type CaptureTime = { local: string; instant: string; source: string };
/** Keep EXIF wall time separate from an instant when the camera did not record an offset. */
export function captureTime(
  value: unknown,
  offset: unknown = '',
  source = ''
): CaptureTime | null {
  if (typeof value !== 'string') return null;
  const match =
    /^(\d{4})[:-](\d{2})[:-](\d{2})[T ](\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/.exec(
      value.trim()
    );
  if (!match) return null;
  const [, y, m, d, h, min, sec, fraction = '', embedded] = match;
  const local = `${y}-${m}-${d}T${h}:${min}:${sec}${fraction}`;
  const wall = new Date(local + 'Z');
  if (
    !Number.isFinite(wall.getTime()) ||
    wall.toISOString().slice(0, 19) !== local.slice(0, 19)
  )
    return null;
  const zone = embedded || (typeof offset === 'string' ? offset.trim() : '');
  if (zone && !/^(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(zone)) return null;
  if (
    zone &&
    Math.abs(Number(zone.slice(1, 3))) === 14 &&
    zone.slice(4) !== '00'
  )
    return null;
  const instant = zone ? new Date(local + zone).toISOString() : '';
  return { local, instant, source };
}
export function photoCaptureTime(photo: FieldPhoto): CaptureTime | null {
  return captureTime(
    photo.exif.DateTimeOriginal,
    photo.exif.OffsetTimeOriginal,
    photo.name
  ) ?? (photo.capture ? captureTime(photo.capture.capturedAt, '', photo.name) : null);
}

const validPosition = (latitude: unknown, longitude: unknown) =>
  typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 85.05112878 &&
  typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180;

export function validAppPhotoCapture(raw: unknown): raw is AppPhotoCapture {
  if (!raw || typeof raw !== 'object') return false;
  const value = raw as AppPhotoCapture, p = value.position;
  return value.source === 'app-camera' && !!captureTime(value.capturedAt)?.instant && (p === undefined ||
    (!!p && typeof p === 'object' && validPosition(p.latitude, p.longitude) && Number.isFinite(p.accuracyM) && p.accuracyM >= 0 && !!captureTime(p.measuredAt)?.instant));
}

/** Only actual file GPS or a measured app-camera position, never file modification time. */
export function photoLocation(photo: FieldPhoto) {
  if (validPosition(photo.exif.latitude, photo.exif.longitude)) return {
    latitude: Number(photo.exif.latitude), longitude: Number(photo.exif.longitude), accuracyM: null,
    source: 'exif' as const,
  };
  const capture = photo.capture;
  return capture && validAppPhotoCapture(capture) && capture.position ? {...capture.position, source: 'app-camera' as const} : null;
}
export function recordCaptureTime(record: GeometryRecord): CaptureTime | null {
  for (const key of [
    'observedAt',
    'observed_at',
    'timestamp',
    'date',
    'DateTimeOriginal'
  ]) {
    const result = captureTime(
      record.feature.properties[key],
      record.feature.properties.OffsetTimeOriginal,
      key
    );
    if (result) return result;
  }
  return null;
}
export function deviceLocal(instant: string): string {
  const date = new Date(instant);
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000
  ).toISOString();
  return local.slice(0, date.getMilliseconds() ? 23 : 19);
}
export function observationTimeLabel(
  value: FieldObservation,
  locale: Locale
): string {
  if (value.observedAt)
    return new Date(value.observedAt).toLocaleString(
      locale === 'vi' ? 'vi-VN' : 'en-GB'
    );
  if (value.observedLocalTime)
    return new Date(value.observedLocalTime + 'Z').toLocaleString(
      locale === 'vi' ? 'vi-VN' : 'en-GB',
      { timeZone: 'UTC' }
    );
  return locale === 'vi' ? 'Chưa ghi nhận' : 'Not recorded';
}

/** Display the camera wall time with its recorded offset, without substituting the device zone. */
export function photoCaptureLabel(photo: FieldPhoto, locale: Locale): string {
  const capture = photoCaptureTime(photo);
  if (!capture) return String(photo.exif.DateTimeOriginal ?? '');
  if (!photo.exif.DateTimeOriginal && photo.capture) return new Date(photo.capture.capturedAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB');
  const wall = new Date(capture.local + 'Z').toLocaleString(
    locale === 'vi' ? 'vi-VN' : 'en-GB',
    { timeZone: 'UTC' }
  );
  const offset =
    String(photo.exif.DateTimeOriginal).match(/(Z|[+-]\d{2}:\d{2})$/)?.[1] ||
    photo.exif.OffsetTimeOriginal ||
    'UTC';
  return (
    wall + (capture.instant ? ' ' + (offset === 'Z' ? 'UTC' : offset) : '')
  );
}
