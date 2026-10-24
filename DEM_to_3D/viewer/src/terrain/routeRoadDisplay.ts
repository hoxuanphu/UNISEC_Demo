import type { RoadSegment, ScenarioRoute } from "../types/dear";
export type DisplayRoad = {
  road: RoadSegment;
  sourceId: string;
  routeSelected: boolean;
};
/** Full network roads remain contextual. A partial journey highlights only its
 * clipped geometry, while clicks still inspect the original road. */
export function routeRoadDisplay(
  roads: RoadSegment[],
  route: ScenarioRoute | null | undefined,
  enabled: boolean,
): DisplayRoad[] {
  const ids = new Set(roads.map((r) => r.id));
  const selected = new Set(enabled ? (route?.segs.map((r) => r.id) ?? []) : []);
  const result = roads.map((road) => ({
    road,
    sourceId: road.id,
    routeSelected: selected.has(road.id),
  }));
  if (enabled)
    for (const road of route?.segs ?? []) {
      if (ids.has(road.id)) continue;
      // A journey cuts the end roads at its anchors ("<road>:part:<n>"). The cut road is the
      // displayed one; `sourceRoadId` may instead name an upstream source (a KMZ placemark).
      const cut = road.id.includes(':part:') ? road.id.slice(0, road.id.indexOf(':part:')) : undefined;
      const sourceId = cut && ids.has(cut) ? cut : road.sourceRoadId && ids.has(road.sourceRoadId) ? road.sourceRoadId : undefined;
      if (sourceId) result.push({ road, sourceId, routeSelected: true });
    }
  return result;
}
