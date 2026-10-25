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
  it('merges a household whose disc would sit on the count of another, instead of hiding it', () => {
    expect(householdGroups([{ id: 'a', x: 0, y: 0 }, { id: 'd', x: 80, y: 6 }]).map(group => group.members)).toEqual([['a', 'd']]);
    // On another row, or clear of the count, both stay.
    expect(householdGroups([{ id: 'a', x: 0, y: 0 }, { id: 'e', x: 80, y: 40 }])).toHaveLength(2);
    expect(householdGroups([{ id: 'a', x: 0, y: 0 }, { id: 'f', x: 130, y: 0 }])).toHaveLength(2);
  });
});
