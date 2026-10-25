import { describe, expect, it } from 'vitest';
import { householdGroups } from './householdGroups';
const anchors = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 20, y: 0 }, { id: 'c', x: 400, y: 0 }];
describe('household symbols', () => {
  it('groups a close pair without swallowing a distant household', () => {
    expect(householdGroups(anchors).map(group => group.members)).toEqual([['a', 'b'], ['c']]);
  });
  it('keeps the selected household separate', () => {
    expect(householdGroups(anchors, 'b').map(group => group.members)).toEqual([['a'], ['b'], ['c']]);
  });
  it('uses actual member positions, is stable across source ordering, and splits when zoomed in', () => {
    expect(householdGroups([...anchors].reverse())).toEqual(householdGroups(anchors));
    for (const group of householdGroups(anchors)) expect({ id: group.id, x: group.x, y: group.y }).toEqual(anchors.find(point => point.id === group.id));
    expect(householdGroups(anchors.map(point => ({ ...point, x: point.x * 6 })))).toHaveLength(3);
    expect(householdGroups([])).toEqual([]);
  });
  it('merges discs that would crowd each other, and only those', () => {
    expect(householdGroups([{ id: 'a', x: 0, y: 0 }, { id: 'd', x: 24, y: 6 }]).map(group => group.members)).toEqual([['a', 'd']]);
    expect(householdGroups([{ id: 'a', x: 0, y: 0 }, { id: 'e', x: 40, y: 0 }])).toHaveLength(2);
  });
});
