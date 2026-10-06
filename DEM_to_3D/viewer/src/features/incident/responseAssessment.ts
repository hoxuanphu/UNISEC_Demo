import type { Hazard, ScenarioRoutePair } from '../../types/dear';
import { routeNextAction } from '../routes/routeReview';

export type CommunitySignal = { communication: 'lost' | 'available' | 'unknown'; urgentNeed: boolean };
export type ResponseAssessment = {
  priority: 1 | 2 | 3;
  access: 'blocked' | 'uncertain' | 'unverified' | 'unmapped';
  reason: [vi: string, en: string];
  nextAction: [vi: string, en: string];
  hazardIds: string[];
  methodVersion: 'access-v1';
};

/** Prepared assessment policy. No LLM, isolation score, or inferred safe route.
 * Unknown coverage remains unknown. Operational thresholds require PO/RS review.
 */
export function assessCommunity(pair: ScenarioRoutePair | undefined, hazards: Hazard[], signal: CommunitySignal): ResponseAssessment {
  const routes = [pair?.direct, pair?.candidate].filter(route => route != null);
  const affected = [...new Map(routes.flatMap(route => route.segs).filter(road => road.status !== 'open').map(road => [road.id, road])).values()];
  const hazardIds = [...new Set(affected.flatMap(road => road.hz ? [road.hz] : []))];
  const reportedImpact = hazardIds.some(id => hazards.find(hazard => hazard.id === id)?.observation === 'reported');
  const access = !routes.length ? 'unmapped' : routes.every(route => route.status === 'blocked') ? 'blocked'
    : routes.some(route => route.status === 'uncertain') ? 'uncertain' : 'unverified';
  const priority = signal.urgentNeed || reportedImpact || (signal.communication === 'lost' && affected.length > 0) ? 1
    : access === 'unverified' && signal.communication === 'available' ? 3 : 2;
  const reason: ResponseAssessment['reason'] = signal.urgentNeed
    ? ['Có yêu cầu hỗ trợ khẩn cấp', 'Urgent assistance requested']
    : signal.communication === 'lost' && affected.some(road => road.status === 'blocked')
    ? ['Có đường bị chặn và mất liên lạc với địa bàn', 'Access road blocked and community contact lost']
    : reportedImpact
    ? ['Có báo cáo ảnh hưởng trên đường tiếp cận', 'Reported impact on the access route']
    : signal.communication === 'lost' && affected.length > 0
    ? ['Mất liên lạc và có đoạn tiếp cận chưa xác minh', 'Contact lost and access sections remain unverified']
    : access === 'unmapped'
    ? ['Chưa đủ dữ liệu đường vào để đánh giá tiếp cận', 'Insufficient road data to assess access']
    : access === 'blocked'
    ? ['Các tuyến đã biết đều có đoạn bị chặn', 'Every mapped route contains a blocked section']
    : affected.some(road => road.status === 'blocked')
    ? ['Có tuyến bị chặn, phương án khác chưa được xác minh', 'One route is blocked and other access is unverified']
    : access === 'uncertain'
    ? ['Có đoạn đường chưa xác minh khả năng đi qua', 'An access section has unverified passability']
    : ['Chưa ghi nhận đoạn bị chặn trên tuyến đã biết', 'No blockage reported on mapped routes'];
  const nextAction: ResponseAssessment['nextAction'] = access === 'blocked'
    ? ['Xác minh phương án tiếp cận khác', 'Verify another access option']
    : access === 'unmapped'
    ? ['Bổ sung dữ liệu đường và báo cáo tình trạng đường', 'Obtain road geometry and field observations']
    : access === 'uncertain'
    ? routeNextAction(pair?.candidate?.status !== 'blocked' ? pair?.candidate ?? pair?.direct ?? null : pair?.direct ?? null, hazards)
    : ['Xác minh khả năng đi qua toàn tuyến', 'Verify full-route passability'];
  return { priority, access, reason, nextAction, hazardIds, methodVersion: 'access-v1' };
}
