import { useMemo, useState } from "react";
import type { RoadSegment } from "../../types/dear";
import { roadGeographic, roadProjected, type JourneyPreference } from "./selectedRoadJourney";
import { analyseRoadJourney, type JourneySelection } from "./journeyAnalysis";
export {
  JOURNEY_ACCESS_LIMIT_M,
  type JourneyEndpoint,
} from "./journeyAnalysis";

/** Keep chosen locations; derive their road connections from current geometry/status. */
export function useRoadJourney(roads: RoadSegment[], accessLimitM?: number, initialPreference: JourneyPreference = 'distance') {
  const [preference, setPreference] = useState<JourneyPreference>(initialPreference);
  const [open, setOpenState] = useState(false),
    [picking, setPicking] = useState<"start" | "end" | null>(null),
    [startSelection, setStart] = useState<JourneySelection | null>(null),
    [endSelection, setEnd] = useState<JourneySelection | null>(null),
    [avoidBlocked, setAvoidBlocked] = useState(true),
    [fitSequence, setFitSequence] = useState(0);
  const setOpen = (value: boolean) => {
    setOpenState(value);
    if (!value) setPicking(null);
  };
  const setPoint = (
    side: "start" | "end",
    origin: { x: number; y: number },
    source = "map",
    label?: string,
    roadIds?: readonly string[],
  ) => {
    const selection = { origin, source, label, roadIds };
    if (side === "start") setStart(selection);
    else setEnd(selection);
    setPicking(null);
    if (side === "start" ? endSelection : startSelection)
      setFitSequence((value) => value + 1);
  };
  const pick = (latitude: number, longitude: number) => {
    if (picking) setPoint(picking, roadProjected(latitude, longitude));
  };
  const analysis = useMemo(
    () => analyseRoadJourney(roads, startSelection, endSelection, avoidBlocked, accessLimitM, preference),
    [roads, startSelection, endSelection, avoidBlocked, accessLimitM, preference],
  );
  // A chosen alternative stays chosen only while it exists for the current endpoints.
  const [choice, setChoice] = useState<string | null>(null);
  const { shown, others } = useMemo(() => {
    const routes = analysis.route ? [analysis.route, ...analysis.alternatives] : [];
    const shown = routes.find((route) => route.id === choice) ?? analysis.route;
    return { shown, others: routes.filter((route) => route !== shown) };
  }, [analysis, choice]);
  return {
    open,
    setOpen,
    picking,
    setPicking,
    ...analysis,
    route: shown,
    /** False once the resident picks another way than the advised one. */
    advised: shown === analysis.route,
    alternatives: others,
    choose: setChoice,
    setPoint,
    pick,
    fitSequence,
    fit: () => setFitSequence((value) => value + 1),
    swap: () => {
      setStart(endSelection);
      setEnd(startSelection);
      setPicking(null);
    },
    clear: (side: "start" | "end") => {
      if (side === "start") setStart(null);
      else setEnd(null);
      setPicking(null);
    },
    avoidBlocked,
    setAvoidBlocked,
    preference,
    setPreference,
    close: () => setOpen(false),
  };
}

/** A/B stay at the chosen coordinates, including a failed network match. */
export function journeyMarkers(journey: ReturnType<typeof useRoadJourney>) {
  if (!journey.open) return [];
  return [journey.start, journey.end].flatMap((endpoint, index) =>
    endpoint
      ? [
          {
            ...roadGeographic(endpoint.origin),
            label: index === 0 ? "A" : "B",
            name: endpoint.label,
            source: endpoint.source,
            // A named place already has its own symbol: the pin stands on top of it.
            place: /^(community|site):/.test(endpoint.source),
            road:
              endpoint.anchor && endpoint.anchor.distance > 1
                ? roadGeographic(endpoint.anchor.point)
                : undefined,
          },
        ]
      : [],
  );
}
