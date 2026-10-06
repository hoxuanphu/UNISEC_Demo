import type { IncidentEvidence, Locale } from '../../types/dear';

const labels = {
  'field-report': {
    kind: ['Báo cáo hiện trường', 'Field report'],
    source: ['Báo cáo', 'Report'],
    observed: ['Ghi nhận', 'Observed'],
    received: ['Tiếp nhận', 'Received'],
    action: ['Xem báo cáo', 'View report']
  },
  'image-analysis': {
    kind: ['Phân tích ảnh vệ tinh', 'Satellite image analysis'],
    source: ['Tài liệu phân tích', 'Analysis record'],
    observed: ['Thu nhận ảnh', 'Image acquired'],
    received: ['Nhận kết quả', 'Result received'],
    action: ['Xem phân tích', 'View analysis']
  }
} as const;

/** Report titles are records, not the identity of a reporting person or agency. */
export function evidencePresentation(type: IncidentEvidence['type'], locale: Locale) {
  const copy = labels[type], index = locale === 'vi' ? 0 : 1;
  return { kind: copy.kind[index], source: copy.source[index], observed: copy.observed[index],
    received: copy.received[index], action: copy.action[index] };
}
