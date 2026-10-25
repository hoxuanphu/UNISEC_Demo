import { useMemo, useSyncExternalStore } from 'react';
import type { RoadSegment, ScenarioRoute } from '../../types/dear';
import { analyseRoadJourney } from '../routes/journeyAnalysis';
import { routeCondition } from '../routes/roadConditions';
import type { LocationFeed } from '../tracking/deviceFeed';
import type { RescueBase } from '../tracking/rescueBase';

type Point = { x: number; y: number };
/** An assembly point as the resident reaches it: on foot over mapped roads, never through a blocked section. */
export type SafePlace = { base: RescueBase; route: ScenarioRoute | null; straightM: number };

/** Off-road distance to a mapped road at either end, as in the commune route search. */
const ACCESS_M = 250;
const passable = (route: ScenarioRoute | null) => !!route && routeCondition(route) !== 'blocked';

/** The commune's assembly points from `me`: reachable ones first by road length, then the rest by straight line. */
export function safePlaces(roads: RoadSegment[], bases: readonly RescueBase[], me: Point): SafePlace[] {
  return bases.map(base => {
    const route = analyseRoadJourney(roads, { origin: me, source: 'device' }, { origin: base.projected, source: `site:${base.id}` }, true, ACCESS_M, 'conditions').route;
    return { base, route: passable(route) ? route : null, straightM: Math.hypot(base.projected.x - me.x, base.projected.y - me.y) };
  }).sort((a, b) => Number(!a.route) - Number(!b.route) || (a.route && b.route ? a.route.lengthKm - b.route.lengthKm : a.straightM - b.straightM));
}

const noSubscription = () => () => undefined;
/** Re-routed only when the resident has moved about 50 m, not on every position update. */
export function useSafePlaces(roads: RoadSegment[], bases: readonly RescueBase[], me: () => Point | null, feed?: LocationFeed | null): SafePlace[] {
  const cell = useSyncExternalStore(feed?.subscribe ?? noSubscription, () => { const at = me(); return at ? `${Math.round(at.x / 50)},${Math.round(at.y / 50)}` : ''; });
  return useMemo(() => {
    const at = me();
    return at && roads.length ? safePlaces(roads, bases, at) : [];
  // `cell` stands for `me`, rounded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roads, bases, cell]);
}
