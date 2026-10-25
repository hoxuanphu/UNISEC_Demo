import type { LocalNetwork, NetworkPlace } from '../route-film/localNetwork';
import { analyseRoadJourney } from '../routes/journeyAnalysis';
import { routeCondition } from '../routes/roadConditions';
import { householdStatusOrder, type HouseholdView } from './householdStatus';

type Point = { x: number; y: number };
export type VillageAccess = 'open' | 'difficult' | 'cut' | 'unknown';
export type CommuneVillage = { place: NetworkPlace; name: [vi: string, en: string]; access: VillageAccess; huts: HouseholdView[] };

/**
 * The commune's villages as a responder reaches them: by open road from the assembly point
 * (`entry`), and the hut clusters the resident app places people at, each under its nearest
 * village. Access is computed from the mapped roads; nothing is declared.
 */
export function communeVillages(network: LocalNetwork, households: readonly HouseholdView[], entry?: { id: string; projected: Point }): CommuneVillage[] {
  const villages = network.places.filter(place => place.kind === 'village');
  const near = (p: Point) => villages.reduce((best, place) => Math.hypot(place.projected.x - p.x, place.projected.y - p.y) < Math.hypot(best.projected.x - p.x, best.projected.y - p.y) ? place : best);
  return villages.map(place => {
    const journey = entry ? analyseRoadJourney(network.roads, { origin: entry.projected, source: entry.id }, { origin: place.projected, source: place.id }, true, 600) : null;
    const access: VillageAccess = journey?.route ? routeCondition(journey.route) === 'open' ? 'open' : 'difficult'
      : journey?.kind === 'blocked-network' ? 'cut' : 'unknown';
    const huts = households.filter(item => near(item.projected) === place)
      .sort((a, b) => householdStatusOrder.indexOf(a.status) - householdStatusOrder.indexOf(b.status) || b.cluster.people - a.cluster.people);
    return { place, name: [place.name.replace(/^Village /, 'Bản '), place.name], access, huts };
  });
}
