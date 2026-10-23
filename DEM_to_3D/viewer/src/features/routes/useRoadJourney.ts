import { useMemo, useState } from "react";
import type { RoadSegment } from "../../types/dear";
import { roadGeographic, roadProjected } from "./selectedRoadJourney";
import { analyseRoadJourney, type JourneySelection } from "./journeyAnalysis";
export {
  JOURNEY_ACCESS_LIMIT_M,
  type JourneyEndpoint,
} from "./journeyAnalysis";

/** Keep chosen locations; derive their road connections from current geometry/status. */
export function useRoadJourney(roads: RoadSegment[], accessLimitM?: number) {
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
  ) => {
    const selection = { origin, source, label };
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
    () => analyseRoadJourney(roads, startSelection, endSelection, avoidBlocked, accessLimitM),
    [roads, startSelection, endSelection, avoidBlocked, accessLimitM],
  );
  return {
    open,
    setOpen,
    picking,
    setPicking,
    ...analysis,
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
