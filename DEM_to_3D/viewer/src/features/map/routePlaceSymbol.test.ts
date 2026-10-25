import { describe, expect, it } from 'vitest';
import { hasRoutePlaceSymbol } from './routePlaceSymbol';
const point = { x: 400000, y: 2400000 };
const scene = { layers: { communities: true, staging: true, hlz: false }, communities: [{ projected: point }], responseSites: [{ kind: 'staging', projected: { x: 400100, y: 2400000 } }] };
describe('route stops at existing places', () => {
  it('reuses a community or assembly symbol only at the selected coordinates', () => {
    expect(hasRoutePlaceSymbol(point, scene)).toBe(true);
    expect(hasRoutePlaceSymbol({ x: 400100, y: 2400000 }, scene)).toBe(true);
    expect(hasRoutePlaceSymbol({ x: 400040, y: 2400000 }, scene)).toBe(false);
  });
  it('retains route pins when the place layer is hidden or no place is known', () => {
    expect(hasRoutePlaceSymbol(point, { ...scene, layers: { communities: false } })).toBe(false);
    expect(hasRoutePlaceSymbol(point)).toBe(false);
  });
});
