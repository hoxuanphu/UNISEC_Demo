import { describe, expect, it } from 'vitest';
import { photoSummary } from './photoSummary';
import { photoCaptureLabel, photoCaptureTime, photoLocation } from './captureMetadata';
import { validPhoto } from './model';
import type { FieldPhoto } from './model';
const photo: FieldPhoto = {
  id: 'photo-1',
  name: 'field.jpg',
  mime: 'image/jpeg',
  bytes: 100,
  width: 10,
  height: 10,
  preview: 'data:image/jpeg;base64,AA==',
  sha256: '0'.repeat(64),
  addedAt: '2026-09-29T01:30:15Z',
  exif: {
    DateTimeOriginal: '2026:09:29 08:30:15',
    OffsetTimeOriginal: '+07:00',
    latitude: 21.7833333,
    longitude: 104.05,
    Make: 'Test',
    Model: 'Camera'
  }
};
const reported = {
  observedAt: '2026-09-29T01:30:15Z',
  coordinates: [104.05, 21.783333]
};
describe('photo metadata in report context', () => {
  it('retains actual in-app capture time and GPS separately from the original file EXIF', () => {
    const captured: FieldPhoto = {...photo, exif: {}, capture: {source:'app-camera',capturedAt:'2026-10-24T02:30:15.123Z',
      position:{latitude:21.78,longitude:104.05,accuracyM:12,measuredAt:'2026-10-24T02:30:12Z'}}};
    expect(validPhoto(captured)).toBe(true);
    expect(photoCaptureTime(captured)?.instant).toBe('2026-10-24T02:30:15.123Z');
    expect(photoLocation(captured)).toMatchObject({latitude:21.78,longitude:104.05,accuracyM:12,source:'app-camera'});
    expect(photoSummary(captured,{observedAt:captured.capture!.capturedAt,coordinates:[104.05,21.78]})).toMatchObject({showTime:false,showGps:false});
    expect(captured.exif).toEqual({});
    expect(photoCaptureTime({...photo,exif:{}})).toBeNull();
    expect(photoLocation({...photo,exif:{}})).toBeNull();
  });

  it('rejects invalid captured locations and does not use upload time as capture time', () => {
    const capture = {source:'app-camera' as const,capturedAt:'2026-10-24T02:30:15Z'};
    expect(validPhoto({...photo,capture})).toBe(true);
    for (const position of [null, {latitude:99,longitude:104,accuracyM:2,measuredAt:capture.capturedAt},
      {latitude:21,longitude:104,accuracyM:-1,measuredAt:capture.capturedAt},
      {latitude:21,longitude:104,accuracyM:2,measuredAt:'not a date'}]) {
      expect(validPhoto({...photo,capture:{...capture,position}})).toBe(false);
    }
    expect(photoLocation({...photo,exif:{latitude:Infinity,longitude:104}})).toBeNull();
    expect(photoLocation({...photo,exif:{latitude:0,longitude:0}})).toMatchObject({latitude:0,longitude:0});
  });
  it('hides duplicate capture time and coordinates but keeps them in the photo source', () => {
    expect(photoSummary(photo, reported)).toMatchObject({
      showTime: false,
      showGps: false,
      showCamera: false,
      differentTime: false,
      differentLocation: false
    });
    expect(photo.exif.latitude).toBe(21.7833333);
    expect(photoSummary(photo)).toMatchObject({
      showTime: true,
      showGps: true,
      showCamera: true
    });
  });
  it('keeps differing capture time and coordinates visible for review', () => {
    expect(
      photoSummary(photo, {
        observedAt: '2026-09-29T02:30:15Z',
        coordinates: [104.06, 21.78]
      })
    ).toMatchObject({
      showTime: true,
      showGps: true,
      differentTime: true,
      differentLocation: true
    });
  });
  it('does not claim time equality when only one side has a timezone', () => {
    const unknownZone = {
      ...photo,
      exif: { ...photo.exif, OffsetTimeOriginal: '' }
    };
    expect(photoSummary(unknownZone, reported).showTime).toBe(true);
    expect(
      photoSummary(photo, { observedLocalTime: '2026-09-29T08:30:15' }).showTime
    ).toBe(true);
    expect(
      photoSummary(unknownZone, { observedLocalTime: '2026-09-29T08:30:15' })
        .showTime
    ).toBe(false);
  });
  it('retains an embedded camera offset rather than labeling its wall time UTC', () => {
    const embedded = {
      ...photo,
      exif: { DateTimeOriginal: '2026-09-29T08:30:15+07:00' }
    };
    expect(photoCaptureLabel(embedded, 'en')).toContain('+07:00');
    expect(photoCaptureLabel(embedded, 'en')).not.toContain('UTC');
    expect(
      photoCaptureLabel(
        { ...photo, exif: { DateTimeOriginal: '2026-09-29T08:30:15Z' } },
        'en'
      )
    ).toContain('UTC');
  });
});
