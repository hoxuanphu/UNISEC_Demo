import type { Locale } from '../../types/dear';
import type { ObservationKind } from './model';
const labels: Record<ObservationKind, [string, string]> = {
  'suspected-landslide': ['Nghi sạt lở', 'Suspected landslide'],
  'road-damage': ['Hư hỏng đường', 'Road damage'],
  water: ['Nước / ngập', 'Water / flooding'],
  survey: ['Điểm khảo sát', 'Survey point'],
  help: ['Cần cứu hộ', 'Needs rescue'],
  other: ['Ghi nhận khác', 'Other observation']
};
export function observationLabel(
  kind: ObservationKind,
  locale: Locale
): string {
  return labels[kind][locale === 'vi' ? 0 : 1];
}
export function observationColor(kind: ObservationKind): string {
  return kind === 'survey' ? '#3186bc' : kind === 'help' ? '#d32f2f' : '#b87919';
}

const photoLabels: Record<string, [string, string]> = {
  Make: ['Hãng máy ảnh', 'Camera make'],
  Model: ['Thiết bị', 'Camera model'],
  DateTimeOriginal: ['Giờ chụp EXIF', 'EXIF capture time'],
  OffsetTimeOriginal: ['Múi giờ EXIF', 'EXIF time offset'],
  FNumber: ['Khẩu độ', 'Aperture'],
  ExposureTime: ['Phơi sáng (s)', 'Exposure (s)'],
  ISO: ['Độ nhạy ISO', 'ISO speed'],
  FocalLength: ['Tiêu cự (mm)', 'Focal length (mm)'],
  GPSImgDirection: ['Hướng chụp (°)', 'Camera direction (°)'],
  GPSImgDirectionRef: ['Tham chiếu hướng', 'Direction reference'],
  Orientation: ['Hướng ảnh EXIF', 'EXIF image orientation'],
  latitude: ['Vĩ độ máy ảnh (°)', 'Camera latitude (°)'],
  longitude: ['Kinh độ máy ảnh (°)', 'Camera longitude (°)']
};
export function photoMetadataLabel(key: string, locale: Locale): string {
  return photoLabels[key]?.[locale === 'vi' ? 0 : 1] ?? key;
}
