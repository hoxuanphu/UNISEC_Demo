import { describe, expect, it } from 'vitest';
import { withMinimumExtent } from './selectionScale';
describe('selection camera bounds', () => {
  it('keeps a point in geographic context without moving it', () => {
    const point = { x: 400000, y: 2400000 };
    const framed = withMinimumExtent([point]);
    expect(framed[0]).toEqual(point);
    expect(Math.max(...framed.map(p => p.x)) - Math.min(...framed.map(p => p.x))).toBeGreaterThanOrEqual(1200);
    expect(Math.max(...framed.map(p => p.y)) - Math.min(...framed.map(p => p.y))).toBeGreaterThanOrEqual(1200);
  });
  it('frames a large imported route without exceeding the JavaScript argument limit', () => {
    const route = Array.from({ length: 150000 }, (_, i) => ({ x: i, y: i }));
    expect(withMinimumExtent(route)).toEqual(route);
  });
  it('does not send invalid coordinates to the camera', () => {
    expect(withMinimumExtent([{ x: NaN, y: 1 }, { x: 1, y: Infinity }])).toEqual([]);
    expect(withMinimumExtent([])).toEqual([]);
  });
});
