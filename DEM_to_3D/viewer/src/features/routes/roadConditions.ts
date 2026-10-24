import type { RoadSegment, RoadStatus, ScenarioRoute } from '../../types/dear';
import { projectedPathLength } from '../../terrain/pathGeometry';

export type RoadCondition = 'blocked' | 'risk' | 'uncertain' | 'open';

/** A closure always takes precedence over its cause or any remaining risk. */
export function roadCondition(road: Pick<RoadSegment, 'status' | 'hz'>): RoadCondition {
  return road.status === 'blocked' ? 'blocked' : road.hz === 'landslide-risk' ? 'risk' : road.status;
}

export function routeCondition(route: Pick<ScenarioRoute, 'status' | 'segs'>): RoadCondition {
  const conditions = route.segs.map(roadCondition);
  if (!conditions.length) return route.status;
  return conditions.includes('blocked') ? 'blocked'
    : conditions.includes('risk') ? 'risk'
    : conditions.includes('uncertain') ? 'uncertain' : 'open';
}

export const routeStatus = (route: Pick<ScenarioRoute, 'status' | 'segs'>): RoadStatus => {
  const condition = routeCondition(route);
  return condition === 'risk' ? 'uncertain' : condition;
};

/** The same priorities apply to village access and a journey chosen on the map.
 * The detour limit is applied by the caller before comparing these measures. */
export function routeConditionMetrics(roads: RoadSegment[]) {
  return roads.reduce((sum, road) => {
    const length = projectedPathLength(road.points), condition = roadCondition(road);
    sum.length += length;
    if (condition === 'blocked') sum.blocked += length;
    if (condition === 'risk') sum.risk += length;
    if (condition === 'risk' || condition === 'uncertain') sum.uncertain += length;
    return sum;
  }, { length: 0, blocked: 0, risk: 0, uncertain: 0 });
}

export function compareRoadConditions(a: RoadSegment[], b: RoadSegment[]) {
  const x = routeConditionMetrics(a), y = routeConditionMetrics(b);
  return x.blocked - y.blocked || x.risk - y.risk || x.uncertain - y.uncertain || x.length - y.length;
}
