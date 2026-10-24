import { validVoice, type FieldVoice } from './voice';
import { captureTime, validAppPhotoCapture } from './captureMetadata';
import type { GeometryRecord } from '../../geo/vector/types';

export const observationKey = 'dearObservation';
export const observationKinds = [
  'suspected-landslide',
  'road-damage',
  'water',
  'survey',
  'other'
] as const;
export type ObservationKind = (typeof observationKinds)[number];
/** Values measured when this app takes a photo, separate from the file's EXIF. */
export type AppPhotoCapture = {
  source: 'app-camera';
  capturedAt: string;
  position?: { latitude: number; longitude: number; accuracyM: number; measuredAt: string };
};
export type FieldPhoto = {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  width: number;
  height: number;
  preview: string;
  sha256: string;
  addedAt: string;
  exif: Record<string, string | number>;
  capture?: AppPhotoCapture;
};
export type FieldObservation = {
  schema: 'field-observation/v1';
  kind: ObservationKind;
  note: string;
  observedAt: string;
  observedLocalTime?: string;
  observer: string;
  accuracyM: number | null;
  status: 'unreviewed';
  updatedAt: string;
  photos: FieldPhoto[];
  voice?: FieldVoice;
};
export const photoLimits = {
  bytes: 8_000_000,
  count: 3,
  previewChars: 500_000
} as const;
export function validPhoto(raw: unknown): raw is FieldPhoto {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as FieldPhoto;
  return (
    typeof p.id === 'string' &&
    p.id.length > 0 &&
    p.id.length <= 160 &&
    typeof p.name === 'string' &&
    p.name.length <= 200 &&
    ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif'].includes(p.mime) &&
    Number.isSafeInteger(p.bytes) &&
    p.bytes > 0 &&
    p.bytes <= photoLimits.bytes &&
    Number.isSafeInteger(p.width) &&
    p.width > 0 &&
    Number.isSafeInteger(p.height) &&
    p.height > 0 &&
    p.width * p.height <= 40_000_000 &&
    typeof p.preview === 'string' &&
    p.preview.length <= photoLimits.previewChars &&
    /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(p.preview) &&
    typeof p.sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(p.sha256) &&
    typeof p.addedAt === 'string' &&
    Number.isFinite(Date.parse(p.addedAt)) &&
    (p.capture === undefined || validAppPhotoCapture(p.capture)) &&
    !!p.exif &&
    typeof p.exif === 'object' &&
    !Array.isArray(p.exif) &&
    Object.keys(p.exif).length <= 20 &&
    Object.values(p.exif).every(
      (v) =>
        (typeof v === 'string' && v.length <= 200) ||
        (typeof v === 'number' && Number.isFinite(v))
    )
  );
}
export function validateObservation(raw: unknown): FieldObservation {
  const o = raw as FieldObservation;
  if (
    !o ||
    o.schema !== 'field-observation/v1' ||
    !observationKinds.includes(o.kind) ||
    typeof o.note !== 'string' ||
    o.note.length > 2000 ||
    typeof o.observer !== 'string' ||
    o.observer.length > 160 ||
    typeof o.observedAt !== 'string' ||
    (o.observedAt !== '' && !captureTime(o.observedAt)?.instant) ||
    (o.observedLocalTime !== undefined &&
      (captureTime(o.observedLocalTime)?.local !== o.observedLocalTime ||
        !!captureTime(o.observedLocalTime)?.instant ||
        !!o.observedAt)) ||
    (o.accuracyM !== null &&
      (typeof o.accuracyM !== 'number' ||
        !Number.isFinite(o.accuracyM) ||
        o.accuracyM < 0)) ||
    o.status !== 'unreviewed' ||
    typeof o.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(o.updatedAt)) ||
    (o.voice !== undefined && !validVoice(o.voice)) ||
    !Array.isArray(o.photos) ||
    o.photos.length > photoLimits.count ||
    !o.photos.every(validPhoto) ||
    new Set(o.photos.map((p) => p.id)).size !== o.photos.length
  )
    throw new Error('Invalid field observation');
  return o;
}
export function observationOf(record: GeometryRecord): FieldObservation | null {
  if (record.feature.geometry.type !== 'Point') return null;
  try {
    const raw = record.feature.properties[observationKey];
    // KML ExtendedData stores structured properties as JSON text.
    return validateObservation(typeof raw === 'string' ? JSON.parse(raw) : raw);
  } catch {
    return null;
  }
}
export function annotateRecord(
  record: GeometryRecord,
  observation: FieldObservation
): GeometryRecord {
  if (record.feature.geometry.type !== 'Point')
    throw new Error('Field observation requires a point');
  return {
    ...record,
    feature: {
      ...record.feature,
      properties: {
        ...record.feature.properties,
        [observationKey]: validateObservation(observation)
      }
    }
  };
}
