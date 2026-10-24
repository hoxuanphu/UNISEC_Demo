import { describe, expect, it } from "vitest";
import { initialRoadSegments } from "../data/fixtures/networkScenario";
import { analyseRoadJourney } from "../features/routes/journeyAnalysis";
import { roadProjected } from "../features/routes/selectedRoadJourney";
import { routeRoadDisplay } from "./routeRoadDisplay";
describe("partial journey map geometry", () => {
  const a = { origin: roadProjected(21.77797, 104.03868), source: "map" },
    b = { origin: roadProjected(21.75074, 104.05062), source: "map" };
  const route = analyseRoadJourney(initialRoadSegments, a, b, true).route!;
  it("highlights the selected parts, retains their source links, and preserves warning status", () => {
    const display = routeRoadDisplay(initialRoadSegments, route, true),
      selected = display.filter((r) => r.routeSelected);
    expect(selected.map((r) => r.road.id).sort()).toEqual(
      route.segs.map((r) => r.id).sort(),
    );
    const first = selected.find((r) => r.road.sourceRoadId === "E13")!;
    expect(first.road.points[0]).toEqual(route.points[0]);
    expect(first.sourceId).toBe("E13");
    expect(first.road.status).toBe("uncertain");
    expect(display.find((r) => r.road.id === "E13")?.routeSelected).toBe(false);
  });
  it("draws the cut end roads of a journey on a network whose roads name an upstream source", () => {
    // Local network roads carry their KMZ placemark as sourceRoadId; the cut part must still map to the drawn road.
    const road = { id: "local-1-0", sourceRoadId: "kmz-1", name: ["Đường", "Road"] as [string, string], cls: "track" as const, len: 0.2, status: "open" as const,
      points: [{ x: 0, y: 0 }, { x: 200, y: 0 }] };
    const part = { ...road, id: "local-1-0:part:1", len: 0.1, points: [{ x: 100, y: 0 }, { x: 200, y: 0 }] };
    const route = { id: "r", type: "candidate" as const, communityId: "", name: ["r", "r"] as [string, string], lengthKm: 0.1, status: "open" as const, points: part.points, segs: [part] };
    const shown = routeRoadDisplay([road], route, true).filter(item => item.routeSelected);
    expect(shown.map(item => [item.road.id, item.sourceId])).toEqual([["local-1-0:part:1", "local-1-0"]]);
  });
  it("keeps only contextual roads when the route layer is hidden", () => {
    const display = routeRoadDisplay(initialRoadSegments, route, false);
    expect(display).toHaveLength(initialRoadSegments.length);
    expect(display.every((r) => !r.routeSelected)).toBe(true);
  });
});
