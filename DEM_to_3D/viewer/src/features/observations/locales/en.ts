import type { vi } from './vi';
export const en: Record<keyof typeof vi, string> = {
  viewPhoto: 'View photo',
  removePhoto: 'Remove photo',
  capturedAt: 'Captured at',
  camera: 'Camera',
  cameraGps: 'Photo GPS',
  fieldPhoto: 'Field photo',
  fileName: 'File name',
  captureLocation: 'Capture location',
  captureSource: 'Capture information source',
  inAppCamera: 'In-app camera',
  locationAccuracy: 'Location accuracy',
  metadata: 'File and camera details',
  dimensions: 'Image dimensions',
  fileSize: 'File size',
  noExif: 'No readable camera information in this photo.',
  differentTime:
    'Capture time differs from the report time, or its time zone is unknown.',
  differentCaptureLocation: 'Capture location differs from the reported location.',
  differentLocation: 'Photo GPS differs from the reported location.'
};
