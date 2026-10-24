import { describe, expect, it } from 'vitest';
import { roadAreaContact } from './roadAreaContact';
const p = (x: number, y: number) => ({ x, y });
const square = [p(0, 0), p(10, 0), p(10, 10), p(0, 10), p(0, 0)];
describe('road association with an existing landslide extent', () => {
  it('finds the polygon edge nearest the road, including an edge interior', () => {
    expect(roadAreaContact([p(4, -5), p(6, -5)], square)).toMatchObject({ distanceM: 5, areaPoint: p(4, 0), roadPoint: p(4, -5) });
  });
  it('detects a narrow crossing between road vertices', () => {
    const contact = roadAreaContact([p(-5, 5), p(15, 5)], square)!;
    expect(contact.distanceM).toBe(0);
    expect(contact.roadPoint).toEqual(contact.areaPoint);
    expect(contact.station).toBeGreaterThanOrEqual(5);
    expect(contact.station).toBeLessThanOrEqual(15);
  });
  it('handles a road wholly inside an extent and refuses incomplete geometry', () => {
    expect(roadAreaContact([p(3, 3), p(8, 8)], square)?.distanceM).toBe(0);
    expect(roadAreaContact([], square)).toBeNull();
    expect(roadAreaContact([p(0, 0), p(1, 1)], [])).toBeNull();
  });
  it('excludes polygon holes while measuring to their boundaries', () => {
    const hole = [p(2, 2), p(8, 2), p(8, 8), p(2, 8), p(2, 2)];
    expect(roadAreaContact([p(4, 5), p(6, 5)], square, [hole])?.distanceM).toBe(2);
    expect(roadAreaContact([p(1, 5), p(9, 5)], square, [hole])?.distanceM).toBe(0);
    expect(roadAreaContact([p(2, 4), p(2, 6)], square, [hole])?.distanceM).toBe(0);
  });
});
