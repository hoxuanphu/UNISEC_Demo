import { describe, expect, it } from 'vitest';
import { DetailAtlas, atlasPlacement, canSwapWindow, requiredWindow } from './tileAtlas';
describe('tile atlas', () => { it('keeps projected tiles inside a moving window', () => { const window = requiredWindow(9, 7, 4, 4, 20, 20); const placement = atlasPlacement({ column: window.column + 3, row: window.row + 2 }, window, 512, 2); expect(placement.x).toBe(1538); expect(placement.y).toBe(1026); }); it('uses a bounded default atlas', () => { expect(new DetailAtlas().slots).toBe(16); }); });
describe('tile atlas readiness', () => { it('does not swap a window until every required tile is present', () => { const requested = [{ zoom: 2, column: 3, row: 4 }, { zoom: 2, column: 4, row: 4 }]; const files = new Map([['z2/3_4.webp', new File(['tile'], '3_4.webp')]]); expect(canSwapWindow(requested, files)).toBe(false); files.set('z2/4_4.webp', new File(['tile'], '4_4.webp')); expect(canSwapWindow(requested, files)).toBe(true); }); });

