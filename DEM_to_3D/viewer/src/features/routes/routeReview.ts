import type { Hazard, ScenarioRoute, ScenarioRoutePair } from '../../types/dear';

export function selectAccessRoute(pair: ScenarioRoutePair | null, selected: 'candidate' | 'direct'): ScenarioRoute | null {
  return selected === 'direct' ? pair?.direct ?? pair?.candidate ?? null : pair?.candidate ?? pair?.direct ?? null;
}

/** Instructions concern the selected route; a different route's state cannot leak in. */
export function routeNextAction(route: ScenarioRoute | null, hazards: Hazard[]): [string, string] {
  if (!route) return ['Bổ sung dữ liệu đường và báo cáo tình trạng đường', 'Obtain road geometry and field observations'];
  if (route.status === 'blocked') return ['Không sử dụng tuyến này. Xác minh phương án tiếp cận khác.', 'Do not use this route. Verify another access option.'];
  const constraint = route.segs.find(road => road.status === 'uncertain');
  const hazard = hazards.find(item => item.id === constraint?.hz);
  if (constraint && hazard?.kind === 'bridge') return ['Kiểm tra mực nước và khả năng qua cầu trước khi sử dụng tuyến.', 'Check water level and bridge passage before using this route.'];
  if (constraint && hazard?.kind === 'crossing') return ['Kiểm tra điểm vượt khe trước khi sử dụng tuyến.', 'Inspect the gully crossing before using this route.'];
  if (constraint && hazard?.kind === 'landslide') return ['Xác minh ảnh hưởng sạt lở trên đoạn đường này.', 'Verify landslide impact on this road section.'];
  return constraint ? ['Kiểm tra đoạn cần xác minh trước khi sử dụng tuyến', 'Verify uncertain sections before using the route']
    : ['Xác minh khả năng đi qua toàn tuyến', 'Verify full-route passability'];
}
