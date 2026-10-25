import { describe, expect, it } from 'vitest';
import data from '../../../public/scenarios/che-tao/local-network.json';
import presenceJson from '../../../public/scenarios/che-tao/resident-presence.json';
import incident from '../../../public/scenarios/che-tao/v0.3/incident.json';
import { validateLocalNetwork } from '../route-film/localNetwork';
import { withLocalRoadConditions } from '../route-film/localRoadConditions';
import { validateIncidentPacket } from '../../data/incidentPacket';
import { rescueBases } from '../tracking/rescueBase';
import { assessHouseholdAccess } from './householdIsolation';
import { validateResidentPresence } from './residentPresence';
import { communeVillages } from './communeSites';
import { householdStatuses } from './householdStatus';

const network = withLocalRoadConditions(validateLocalNetwork(data));
const households = householdStatuses(assessHouseholdAccess(network, validateResidentPresence(presenceJson).clusters), [], new Set(), new Set());
const entry = rescueBases(validateIncidentPacket(incident).responseSites, network.roads)[0];

describe('commune villages', () => {
  const villages = communeVillages(network, households, entry);
  it('lists every village once, in Vietnamese and English, with each hut cluster under its nearest village', () => {
    expect(villages.map(village => village.name)).toEqual([['Bản A', 'Village A'], ['Bản B', 'Village B'], ['Bản C', 'Village C']]);
    expect(villages.flatMap(village => village.huts).map(item => item.cluster.id).sort()).toEqual(households.map(item => item.cluster.id).sort());
    expect(villages.find(village => village.name[0] === 'Bản C')!.huts.map(item => item.cluster.id)).toEqual(expect.arrayContaining(['HH-01', 'HH-03']));
  });
  it('computes access from the mapped roads, not declared', () => {
    for (const village of villages) expect(['open', 'difficult', 'cut', 'unknown']).toContain(village.access);
    expect(communeVillages(network, households).every(village => village.access === 'unknown')).toBe(true);
  });
  it('does not classify missing road data as physical isolation',()=>{
    expect(communeVillages({...network,roads:[]},households,entry).every(village=>village.access==='unknown')).toBe(true);
  });

});
