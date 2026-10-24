import { describe, expect, it } from "vitest";
import type { RoadSegment } from "../../types/dear";
import { initialRoadSegments } from "../../data/fixtures/networkScenario";
import { analyseRoadJourney, type JourneySelection } from "./journeyAnalysis";
import {
  roadProjected,
  nearestRoadAnchor,
  selectedRoadJourney,
} from "./selectedRoadJourney";
const p = (x: number, y = 0) => ({ x, y });
const selection = (x: number, y = 0): JourneySelection => ({
  origin: p(x, y),
  source: "map",
});
const road = (
  id: string,
  points: { x: number; y: number }[],
  status: RoadSegment["status"] = "open",
): RoadSegment => ({
  id,
  points,
  status,
  cls: "track",
  len: 1,
  name: [id, id],
});
const a = { origin: roadProjected(21.77797, 104.03868), source: "map" },
  b = { origin: roadProjected(21.75074, 104.05062), source: "map" };
describe("journey matching and business rules", () => {
  it('rescue on foot takes a longer local trail to avoid mapped risk without the everyday detour cap', () => {
    const roads = [{...road('short-risk', [p(0),p(100)]), hz:'landslide-risk'},
      road('local-trail', [p(0),p(0,100),p(100,100),p(100)])];
    const everyday = analyseRoadJourney(roads, selection(0), selection(100), true, 1, 'conditions');
    const rescue = analyseRoadJourney(roads, selection(0), selection(100), true, 1, 'rescue-foot');
    expect(everyday.route!.segs[0].id).toContain('short-risk');
    expect(rescue.route!.segs.every(road=>road.id.startsWith('local-trail'))).toBe(true);
    expect(rescue.route!.lengthKm).toBeCloseTo(.3);
  });
  it('rescue never allows a blocked shortcut, even if everyday blockage avoidance was unchecked', () => {
    const roads = [road('closed', [p(0),p(100)], 'blocked'), road('trail', [p(0),p(0,100),p(100,100),p(100)])];
    const result = analyseRoadJourney(roads, selection(0), selection(100), false, 1, 'rescue-foot');
    expect(result.route!.segs.every(road=>road.status!=='blocked')).toBe(true);
    expect(analyseRoadJourney([roads[0]],selection(0),selection(100),false,1,'rescue-foot').route).toBeNull();
  });
  it('rescue retains an unverified condition when no confirmed passage is mapped', () => {
    const result = analyseRoadJourney([road('trail',[p(0),p(100)],'uncertain')],selection(0),selection(100),true,1,'rescue-foot');
    expect(result.route!.status).toBe('uncertain');
  });
  it("routes the screenshot A/B via eligible roads instead of snapping B onto blocked E8", () => {
    const result = analyseRoadJourney(initialRoadSegments, a, b, true);
    expect(result.kind).toBe("route");
    expect(result.end?.anchor?.roadId).toBe("E9");
    expect(result.start?.anchor?.roadId).toBe("E13");
    expect(result.route?.segs.some((r) => r.status === "blocked")).toBe(false);
    expect(result.route?.status).toBe("uncertain");
    expect(result.end?.origin).toEqual(b.origin);
    expect(result.end?.anchor?.distance).toBeGreaterThan(800);
    expect(result.route?.points.at(-1)).toEqual(result.end?.anchor?.point);
  });
  it("recomputes connection points when avoidance is toggled without moving A/B", () => {
    const before = analyseRoadJourney(initialRoadSegments, a, b, false),
      after = analyseRoadJourney(initialRoadSegments, a, b, true);
    expect(before.end?.anchor?.roadId).toBe("E8");
    expect(before.route?.status).toBe("blocked");
    expect(after.end?.anchor?.roadId).toBe("E9");
    expect(after.end?.origin).toEqual(before.end?.origin);
  });
  it("derives anchors from edited road geometry rather than retaining stale stations", () => {
    const original = [road("R", [p(0), p(100)])],
      moved = [road("R", [p(0, 100), p(100, 100)])];
    const before = analyseRoadJourney(
        original,
        selection(20),
        selection(80),
        true,
      ),
      after = analyseRoadJourney(moved, selection(20), selection(80), true);
    expect(before.route?.points).toEqual([p(20), p(80)]);
    expect(after.route?.points).toEqual([p(20, 100), p(80, 100)]);
    expect(after.start?.origin).toEqual(p(20));
    expect(after.start?.anchor?.distance).toBe(100);
  });
  it("retains a failed chosen position and returns no stale previous route", () => {
    const roads = [road("R", [p(0), p(100)])];
    expect(
      analyseRoadJourney(roads, selection(20), selection(80), true).kind,
    ).toBe("route");
    const result = analyseRoadJourney(
      roads,
      selection(20),
      selection(8000),
      true,
    );
    expect(result.end?.origin).toEqual(p(8000));
    expect(result.end?.problem).toBe("too-far");
    expect(result.route).toBeNull();
    expect(result.kind).toBe("endpoint-unavailable");
  });
  it("separates unavailable blocked connections, blocked paths and missing topology", () => {
    const onlyBlocked = analyseRoadJourney(
      [road("R", [p(0), p(100)], "blocked")],
      selection(20),
      selection(80),
      true,
    );
    expect(onlyBlocked.start?.problem).toBe("blocked");
    expect(onlyBlocked.route).toBeNull();
    const roads = [
      road("A", [p(0), p(100)]),
      road("X", [p(100), p(200)], "blocked"),
      road("B", [p(200), p(300)]),
    ];
    expect(
      analyseRoadJourney(roads, selection(20), selection(280), true).kind,
    ).toBe("blocked-network");
    expect(
      analyseRoadJourney(
        roads.filter((r) => r.id !== "X"),
        selection(20),
        selection(280),
        true,
      ).kind,
    ).toBe("disconnected");
  });
  it("distinguishes coincident locations from distinct locations sharing a road connection", () => {
    const roads = [road("R", [p(0), p(100)])];
    expect(
      analyseRoadJourney(roads, selection(-30, 30), selection(-30, 30), true)
        .kind,
    ).toBe("same-location");
    const result = analyseRoadJourney(
      roads,
      selection(-30, 30),
      selection(-30, -30),
      true,
    );
    expect(result.kind).toBe("same-connection");
    expect(result.route).toBeNull();
  });
  it("uses shortest road length; uncertain roads are flagged rather than silently penalised", () => {
    const roads = [
      road("direct", [p(0), p(100)], "uncertain"),
      road("detour", [p(0), p(0, 100), p(100)]),
    ];
    const result = analyseRoadJourney(
      roads,
      selection(0),
      selection(100),
      true,
    );
    expect(result.route?.lengthKm).toBeCloseTo(0.1);
    expect(result.route?.status).toBe("uncertain");
  });
  it("does not invent junctions at line crossings", () => {
    const roads = [
      road("A", [p(0), p(100)]),
      road("B", [p(50, -50), p(50, 50)]),
    ];
    expect(
      analyseRoadJourney(roads, selection(10), selection(50, 40), true).kind,
    ).toBe("disconnected");
  });
  it('advises the short road to check over a long open detour', () => {
    const roads = [
      road('shortcut', [p(0), p(100)], 'uncertain'),
      road('open-way', [p(0), p(0, 400), p(100)]),
    ];
    const advised = analyseRoadJourney(roads, selection(0), selection(100), true, 250, 'conditions');
    expect(advised.route?.status).toBe('uncertain');
    expect(advised.route?.lengthKm).toBeCloseTo(.1);
  });
  it('takes an open route when it is only slightly longer than the road to check', () => {
    const roads = [
      road('shortcut', [p(0), p(100)], 'uncertain'),
      road('open-way', [p(0), p(50, 30), p(100)]),
    ];
    const advised = analyseRoadJourney(roads, selection(0), selection(100), true, 250, 'conditions');
    expect(advised.route?.status).toBe('open');
    expect(advised.route?.segs.every(section => section.sourceRoadId === 'open-way')).toBe(true);
  });
  it('offers other unblocked ways round, never one through a blockage', () => {
    const roads = [
      road('main', [p(0), p(100)], 'uncertain'),
      road('north', [p(0), p(0, 30), p(100, 30), p(100)]),
      road('south', [p(0), p(0, -50), p(100, -50), p(100)], 'blocked'),
    ];
    const advised = analyseRoadJourney(roads, selection(0), selection(100), true, 250, 'conditions');
    expect(advised.route?.lengthKm).toBeCloseTo(.1);
    expect(advised.alternatives).toHaveLength(1);
    expect(advised.alternatives[0].segs.every(section => section.status !== 'blocked')).toBe(true);
    expect(analyseRoadJourney(roads, selection(0), selection(100), true).alternatives).toEqual([]);
  });
  it('retains caution on the only usable resident route and never routes through a blockage', () => {
    const roads = [
      road('start', [p(0), p(100)]),
      road('short-blocked', [p(100), p(200)], 'blocked'),
      road('check-first', [p(100), p(100, 80), p(200)], 'uncertain'),
      road('finish', [p(200), p(300)]),
    ];
    const advised = analyseRoadJourney(roads, selection(20), selection(280), true, 250, 'conditions');
    expect(advised.route?.status).toBe('uncertain');
    expect(advised.route?.segs.some(section => section.status === 'blocked')).toBe(false);
    expect(advised.start?.origin).toEqual(p(20));
    expect(advised.end?.origin).toEqual(p(280));
  });
  it("does not add straight-line access offsets to mapped road length", () => {
    const result = analyseRoadJourney(
      [road("R", [p(0), p(100)])],
      selection(20, 30),
      selection(80, 40),
      true,
    );
    expect(result.route?.lengthKm).toBeCloseTo(0.06);
    expect(result.start?.anchor?.distance).toBe(30);
    expect(result.end?.anchor?.distance).toBe(40);
  });
  it("keeps reversed endpoints and numerically close vertices connected on the known graph", () => {
    const roads = [
      road("A", [p(0.1, 0.3), p(0.3, 0.4)]),
      road("B", [p(0.3, 0.4), p(0.7, 0.4)]),
    ];
    const start = nearestRoadAnchor(roads, p(0.7, 0.4))!,
      end = nearestRoadAnchor(roads, p(0.3 - 1e-10, 0.4))!;
    const result = selectedRoadJourney(roads, start, end, true);
    expect(end.point).toEqual(p(0.3, 0.4));
    expect(result?.points[0]).toEqual(start.point);
    expect(result?.points.at(-1)).toEqual(end.point);
  });
});
