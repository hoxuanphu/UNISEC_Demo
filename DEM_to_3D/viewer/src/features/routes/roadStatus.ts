import type { RoadSegment } from '../../types/dear';

/** `open` means no reported blockage in this snapshot, not verified passage. */
export const roadStatusLabels: Record<RoadSegment['status'], [vi: string, en: string]> = {
  blocked: ['Bị chặn', 'Blocked'],
  uncertain: ['Cần xác minh', 'Needs verification'],
  open: ['Chưa ghi nhận đường bị chặn', 'No blockage reported']
};
