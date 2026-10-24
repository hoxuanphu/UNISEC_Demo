import type { RoadSegment, ScenarioRoute } from "../../types/dear";
import {
  nearestRoadAnchor,
  selectedRoadJourney,
  type RoadAnchor,
  type JourneyPreference,
} from "./selectedRoadJourney";
export const JOURNEY_ACCESS_LIMIT_M = 5_000;
export type JourneySelection = {
  origin: { x: number; y: number };
  source: string;
  label?: string;
};
export type JourneyEndpoint = JourneySelection & {
  anchor: RoadAnchor | null;
  problem: "too-far" | "blocked" | null;
};
export type JourneyResultKind =
  | "incomplete"
  | "endpoint-unavailable"
  | "same-location"
  | "same-connection"
  | "blocked-network"
  | "disconnected"
  | "route";
export type JourneyAnalysis = {
  start: JourneyEndpoint | null;
  end: JourneyEndpoint | null;
  route: ScenarioRoute | null;
  /** Other unblocked routes between the same points (resident advice only). */
  alternatives: ScenarioRoute[];
  kind: JourneyResultKind;
};
/** Matching uses the same eligible roads as routing. A connector is an unverified
 * straight-line offset, never an additional navigable road or a new graph edge. */
export function analyseRoadJourney(
  roads: RoadSegment[],
  a: JourneySelection | null,
  b: JourneySelection | null,
  avoidBlocked: boolean,
  accessLimitM = JOURNEY_ACCESS_LIMIT_M,
  preference: JourneyPreference = 'distance',
): JourneyAnalysis {
  if (preference === 'rescue-foot') avoidBlocked = true;
  const eligible = avoidBlocked
    ? roads.filter((r) => r.status !== "blocked")
    : roads;
  const resolve = (
    selection: JourneySelection | null,
  ): JourneyEndpoint | null => {
    if (!selection) return null;
    const anchor = nearestRoadAnchor(
      eligible,
      selection.origin,
      accessLimitM,
    );
    if (anchor) return { ...selection, anchor, problem: null };
    const nearby = nearestRoadAnchor(
      roads,
      selection.origin,
      accessLimitM,
    );
    return {
      ...selection,
      anchor: null,
      problem: nearby ? "blocked" : "too-far",
    };
  };
  const start = resolve(a),
    end = resolve(b);
  const result = (
    kind: JourneyResultKind,
    route: ScenarioRoute | null = null,
  ): JourneyAnalysis => ({ start, end, kind, route, alternatives: (route as { alternatives?: ScenarioRoute[] } | null)?.alternatives ?? [] });
  if (!start || !end) return result("incomplete");
  if (!start.anchor || !end.anchor) return result("endpoint-unavailable");
  if (
    Math.hypot(start.origin.x - end.origin.x, start.origin.y - end.origin.y) <
    0.001
  )
    return result("same-location");
  if (
    Math.hypot(
      start.anchor.point.x - end.anchor.point.x,
      start.anchor.point.y - end.anchor.point.y,
    ) < 0.001
  )
    return result("same-connection");
  const route = selectedRoadJourney(
    roads,
    start.anchor,
    end.anchor,
    avoidBlocked,
    preference,
  );
  if (route) return result("route", route);
  // Explain a blocked graph separately from absent topology. Never create a
  // cross-road link or try another disconnected road to force a successful route.
  if (
    avoidBlocked &&
    selectedRoadJourney(roads, start.anchor, end.anchor, false)
  )
    return result("blocked-network");
  return result("disconnected");
}
