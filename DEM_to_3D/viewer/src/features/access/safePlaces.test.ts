import { describe, expect, it } from 'vitest';
import data from '../../../public/scenarios/che-tao/local-network.json';
import incident from '../../../public/scenarios/che-tao/v0.3/incident.json';
import { validateLocalNetwork } from '../route-film/localNetwork';
import { withLocalRoadConditions } from '../route-film/localRoadConditions';
import { validateIncidentPacket } from '../../data/incidentPacket';
import { rescueBases } from '../tracking/rescueBase';
import { safePlaces } from './safePlaces';

const network = withLocalRoadConditions(validateLocalNetwork(data));
const bases = rescueBases(validateIncidentPacket(incident).responseSites, network.roads);

describe('assembly points for a resident', () => {
  it('routes to every assembly point it can reach on foot, nearest first, never through a blocked section', () => {
    const villageA = network.places.find(place => place.name === 'Village A')!.projected;
    const places = safePlaces(network.roads, bases, villageA);
    expect(places).toHaveLength(bases.length);
    expect(places[0].route).not.toBeNull();
    expect(places[0].route!.segs.some(road => road.status === 'blocked')).toBe(false);
    const lengths = places.filter(place => place.route).map(place => place.route!.lengthKm);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
  });
  it('lists the unreachable ones last, by straight-line distance', () => {
    const places = safePlaces([], bases, { x: 400000, y: 2402000 });
    expect(places.every(place => place.route === null)).toBe(true);
    expect(places.map(place => place.straightM)).toEqual([...places.map(place => place.straightM)].sort((a, b) => a - b));
  });
});
