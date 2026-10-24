import type { ScenarioRoute, ScenarioRoutePair } from '../../types/dear';
import { residentDetourTolerance } from './networkRouting';
import { compareRoadConditions, roadCondition, routeConditionMetrics, routeStatus } from './roadConditions';

/**
 * Unblocked before blocked. Among unblocked routes the shortest is the reference; another is
 * chosen for fewer sections to check only while it is at most `residentDetourTolerance` longer.
 * `avoided` is the other mapped route when it is worse, so the app can say why it was not chosen.
 */
export function recommendRoute(pair: ScenarioRoutePair | undefined): {
  best: ScenarioRoute | null;
  avoided: ScenarioRoute | null;
} {
  const mapped = [pair?.direct, pair?.candidate].filter((route): route is ScenarioRoute => route != null)
    .map(route => routeStatus(route) === route.status ? route : { ...route, status: routeStatus(route) });
  const shortest = Math.min(...mapped.filter(route => route.status !== 'blocked').map(route => route.lengthKm));
  const detour = (route: ScenarioRoute) => route.status !== 'blocked' && route.lengthKm > shortest * residentDetourTolerance;
  const routes = mapped.sort((a, b) => (a.status === 'blocked' ? 1 : 0) - (b.status === 'blocked' ? 1 : 0) ||
    Number(detour(a)) - Number(detour(b)) || compareRoadConditions(a.segs, b.segs) || a.lengthKm - b.lengthKm);
  const [best = null, other = null] = routes;
  const bestConditions = best && routeConditionMetrics(best.segs), otherConditions = other && routeConditionMetrics(other.segs);
  const worse = bestConditions && otherConditions && (other?.status === 'blocked' && best?.status !== 'blocked' ||
    otherConditions.risk > bestConditions.risk || otherConditions.uncertain > bestConditions.uncertain);
  return { best, avoided: best?.status !== 'blocked' && worse ? other : null };
}

/** Road sections a resident must know about on the chosen route; open sections are omitted. */
export const routeProblems = (route: ScenarioRoute) => route.segs.filter((road) => roadCondition(road) !== 'open');
