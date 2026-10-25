import { describe, expect, it } from 'vitest';
import data from '../../../public/scenarios/che-tao/local-network.json';
import presenceJson from '../../../public/scenarios/che-tao/resident-presence.json';
import { validateLocalNetwork } from '../route-film/localNetwork';
import { withLocalRoadConditions } from '../route-film/localRoadConditions';
import { networkContext } from '../route-film/networkContext';
import { assessHouseholdAccess } from './householdIsolation';
import { validateResidentPresence } from './residentPresence';
import { householdWork } from './householdWork';
import { householdRescues } from './householdRescue';
import { rescueBases } from '../tracking/rescueBase';
import { validateIncidentPacket } from '../../data/incidentPacket';
import incident from '../../../public/scenarios/che-tao/v0.3/incident.json';
import { nearestRoadAnchor } from '../routes/selectedRoadJourney';
import { createDeviceFeed, deviceTimeLapse } from '../tracking/deviceFeed';

const network = withLocalRoadConditions(validateLocalNetwork(data));
const presence = validateResidentPresence(presenceJson);
const names = new Map(networkContext(network).areas.map(area => [area.id, area.name[0]]));

describe('isolated households', () => {
  it('finds every prepared hut cluster cut off by landslides on its roads', () => {
    const result = assessHouseholdAccess(network, presence.clusters);
    expect(result.map(item => item.isolated)).toEqual([true, true, true, true]);
    for (const item of result) {
      expect(item.access!.distanceM).toBeLessThan(400);
      expect(item.cutBy.length).toBeGreaterThan(0);
    }
    const labels = (id: string) => result.find(item => item.cluster.id === id)!.cutBy.map(item => item.kind === 'area' ? names.get(item.id) : item.kind);
    expect(labels('HH-02')).toContain('Vùng sạt 28');
    expect(labels('HH-03')).toEqual(expect.arrayContaining(['Vùng sạt 20', 'Vùng sạt 21']));
    // West of Village C: the residents' own report closes the way east, road 19 the way west.
    expect(labels('HH-01')).toEqual(['report', 'road']);
  });
  it('is computed from the roads, not declared: without the reported slide the western huts reach Village C', () => {
    const western = presence.clusters.find(cluster => cluster.id === 'HH-01')!;
    const [open] = assessHouseholdAccess(network, [{ ...western, reportedCuts: undefined }]);
    expect(open.isolated).toBe(false);
    expect(open.cutBy).toEqual([]);
  });
  it('leaves huts far from every mapped road unassessed', () => {
    const [far] = assessHouseholdAccess(network, [{ ...presence.clusters[0], id: 'far', longitude: 104.1, latitude: 21.78, reportedCuts: undefined }]);
    expect(far).toMatchObject({ isolated: false, access: null });
  });
  it('rejects malformed presence', () => {
    expect(() => validateResidentPresence({ ...presence, clusters: [{ ...presence.clusters[0], people: 1, households: 4 }] })).toThrow();
    expect(() => validateResidentPresence({ ...presence, dataKind: 'operational' })).toThrow();
  });
});

describe('relief work for isolated households', () => {
  it('raises one task per isolated cluster, a stated need first', () => {
    const tasks = householdWork(assessHouseholdAccess(network, presence.clusters));
    expect(tasks.map(task => task.id)).toEqual(['household:HH-01', 'household:HH-02', 'household:HH-03', 'household:HH-04']);
    expect(tasks.filter(task => task.priority === 0).map(task => task.id)).toEqual(['household:HH-01', 'household:HH-03']);
    expect(tasks[0].reason[0]).toBe('13 người, 4 hộ còn ở lán theo app DEAR. Mọi đường ra đều bị cắt. Một người bị thương ở chân.');
    expect(tasks.every(task => task.kind === 'contact' && task.objectId === task.id)).toBe(true);
  });
  it('raises none for huts that can still reach a village', () => {
    const western = presence.clusters.find(cluster => cluster.id === 'HH-01')!;
    expect(householdWork(assessHouseholdAccess(network, [{ ...western, reportedCuts: undefined }]))).toEqual([]);
  });
});

describe('rescue teams to isolated huts', () => {
  const bases = rescueBases(validateIncidentPacket(incident).responseSites, network.roads);
  const rescues = householdRescues(network, assessHouseholdAccess(network, presence.clusters), bases);
  it('approaches priority households on mapped roads and waits before the cut', () => {
    expect(rescues.map(rescue => rescue.householdId)).toEqual(['HH-03', 'HH-01']);
    for (const { plan, rideM } of rescues) {
      expect(plan.role).toBe('rescue');
      expect(plan.road.status).not.toBe('blocked');
      expect(network.roads.some(road => road.id === plan.road.id)).toBe(true);
      expect(rideM).toBeGreaterThan(500);
      const hut=assessHouseholdAccess(network,presence.clusters).find(item=>`household:${item.cluster.id}`===plan.targetId)!.projected;
      expect(Math.hypot(plan.path.points.at(-1)!.x-hut.x,plan.path.points.at(-1)!.y-hut.y)).toBeGreaterThan(15);
      const mapped=network.roads.filter(road=>road.status!=='blocked'&&!road.landslideAreaId);
      for(let i=1;i<plan.path.points.length;i+=Math.max(1,Math.floor(plan.path.points.length/16))){
        const a=plan.path.points[i-1],b=plan.path.points[i];
        for(const point of [a,b,{x:(a.x+b.x)/2,y:(a.y+b.y)/2}])expect(nearestRoadAnchor(mapped,point,5),plan.id).not.toBeNull();
      }
      expect(plan.script!.legs.map(leg => leg.state)).toEqual(['dispatching', 'responding', 'waiting', 'moving']);
      expect(plan.script!.legs.every((leg, i, legs) => !i || leg.until > legs[i - 1].until)).toBe(true);
    }
  });
  it('plays the mission in the shared feed and replays it', () => {
    const plan = rescues[0].plan, feed = createDeviceFeed([], [], 0, [plan]), states: string[] = [];
    let previous=feed.getSnapshot()[0].stationM;
    for (let i = 0; i < Math.ceil(plan.script!.cycle * 1.2 / deviceTimeLapse / .25); i++) {
      feed.advance(.25);
      const now=feed.getSnapshot()[0],state = now.state;
      expect(Math.abs(now.stationM-previous)).toBeLessThanOrEqual(7*deviceTimeLapse*.25+.0001);previous=now.stationM;
      if (states.at(-1) !== state) states.push(state);
    }
    expect(states.slice(0, 6)).toEqual(['dispatching', 'responding', 'waiting', 'moving', 'arrived', 'dispatching']);
  });
});
