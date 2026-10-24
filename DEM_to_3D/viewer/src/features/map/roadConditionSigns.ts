import type { RoadSegment } from '../../types/dear';
import type { LocalRoadAreaLink } from '../route-film/localNetwork';
import { projectedPathLength } from '../../terrain/pathGeometry';
import { roadCondition } from '../routes/roadConditions';

type Point = { x: number; y: number };
export type RoadConditionSign = { road: RoadSegment; point: Point; condition: 'blocked' | 'risk' };

function midway(points: Point[]): Point {
  let distance = projectedPathLength(points) / 2;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length > 0 && distance <= length) return { x: a.x + (b.x - a.x) * distance / length, y: a.y + (b.y - a.y) * distance / length };
    distance -= length;
  }
  return points[0];
}

/** A closure is a road condition, not a symbol at a polygon's centre. Both map
 * renderers keep it on the affected road, beside its linked extent when known. */
export function roadConditionSigns(roads: RoadSegment[], areaLinks: LocalRoadAreaLink[] = []): RoadConditionSign[] {
  const runs: Array<{ sign: RoadConditionSign; endpoints: Point[] }> = [];
  const source = (road: RoadSegment) => road.sourceRoadId ?? road.id.split(':condition:')[0].split(':part:')[0];
  for (const road of roads) {
    const condition = roadCondition(road);
    if ((condition !== 'blocked' && condition !== 'risk') || road.points.length < 2) continue;
    const link = areaLinks.find(item => item.areaId === road.landslideAreaId &&
      (road.id === item.roadId || road.id.startsWith(`${item.roadId}:condition:`)));
    const point = link?.roadPoint ?? midway(road.points);
    const endpoints = [road.points[0], road.points.at(-1)!];
    const run = runs.find(run => source(run.sign.road) === source(road) && run.sign.condition === condition &&
      endpoints.some(point=>run.endpoints.some(end=>Math.hypot(end.x-point.x,end.y-point.y)<.001)));
    if (run) {
      run.endpoints.push(...endpoints);
      // Splitting a known blocked road at an extent must not create three
      // competing signs. Prefer the linked location over an arbitrary midpoint.
      if (road.landslideAreaId && !run.sign.road.landslideAreaId) run.sign = { road, point, condition };
      continue;
    }
    runs.push({ sign: { road, point, condition }, endpoints });
  }
  return runs.map(run=>run.sign);
}

export const roadConditionSignLabel = (condition: 'blocked' | 'risk', locale: 'vi' | 'en') =>
  locale === 'en' ? condition === 'blocked' ? 'Road blocked' : 'Landslide risk'
    : condition === 'blocked' ? 'Đường bị chặn' : 'Có nguy cơ sạt lở';
