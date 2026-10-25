import {createDeviceFeed} from './deviceFeed';
import {describe,it,expect} from 'vitest';
import data from '../../../public/scenarios/che-tao/local-network.json';
import {validateLocalNetwork} from '../route-film/localNetwork';
import {withLocalRoadConditions} from '../route-film/localRoadConditions';
import {nearestRoadAnchor} from '../routes/selectedRoadJourney';
import {createResidentLocation,mergeLocationFeeds,residentDeviceId,rescueOnly} from './residentLocation';
const network=withLocalRoadConditions(validateLocalNetwork(data));
describe('shared resident location',()=>{
  it('walks on a mapped road, stops before the closure and stays there',()=>{
    const feed=createResidentLocation(network.roads,network.conditions?.areaLinks??[],1000,1000)!;
    const start=feed.getSnapshot()[0];expect(start.id).toBe(residentDeviceId);expect(start.closureRoadId).toBeTruthy();
    feed.update(5000);const walking=feed.getSnapshot()[0];expect(walking.stationM).not.toBe(start.stationM);
    feed.update(1000000);const waiting=feed.getSnapshot()[0];expect(waiting.state).toBe('waiting');
    expect(nearestRoadAnchor(network.roads,waiting.point,1)?.distance).toBeLessThan(.001);
    feed.update(2000000);expect(feed.getSnapshot()[0].point).toEqual(waiting.point);
  });
  it('reconstructs the same device across role changes and windows from one epoch',()=>{
    const mobile=createResidentLocation(network.roads,[],1000,12000)!;
    const admin=createResidentLocation(network.roads,[],1000,12000)!;
    expect(mobile.getSnapshot()).toEqual(admin.getSnapshot());
    expect(createResidentLocation([],[],1000)).toBeNull();
  });
  it('retains snapshot identity, updates both subscriptions and removes them on disposal',()=>{
    const a=createResidentLocation(network.roads,[],1000,1000)!,b=createResidentLocation(network.roads,[],1000,1000)!;
    const merged=mergeLocationFeeds(a,b)!;expect(merged.getSnapshot()).toBe(merged.getSnapshot());expect(merged.getSnapshot()).toHaveLength(1);
    let updates=0;const close=merged.subscribe(()=>updates++);a.update(5000);b.update(6000);expect(updates).toBe(2);
    expect(merged.getSnapshot()[0]).toBe(b.getSnapshot()[0]);close();a.update(9000);expect(updates).toBe(2);
  });
});

describe('shared operational clock',()=>{
  it('reconstructs rescue and resident positions at the same time after changing roles',()=>{
    const mobile=createDeviceFeed(network.roads,[],1000),admin=createDeviceFeed(network.roads,[],1000);
    mobile.synchronise(45);admin.synchronise(45);expect(mobile.getSnapshot()).toEqual(admin.getSnapshot());
    const teams=rescueOnly(mobile);expect(teams.getSnapshot().every(device=>device.role==='rescue')).toBe(true);
    expect(teams.getSnapshot()).toBe(teams.getSnapshot());
    mobile.synchronise(60);admin.synchronise(60);expect(teams.getSnapshot()).toEqual(admin.getSnapshot().filter(device=>device.role==='rescue'));
  });
});
