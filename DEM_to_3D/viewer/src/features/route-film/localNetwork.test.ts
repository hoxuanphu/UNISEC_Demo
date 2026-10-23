import { describe, it, expect } from 'vitest';
import data from '../../../public/scenarios/che-tao/local-network.json';
import { validateLocalNetwork } from './localNetwork';
import { analyseRoadJourney } from '../routes/journeyAnalysis';
import { roadGeographic, roadProjected } from '../routes/selectedRoadJourney';
const network = validateLocalNetwork(data);
const select = (name: string) => { const p = network.places.find(p => p.name === name)!; return { origin: p.projected, source: p.id, label: name }; };
describe('prepared Chế Tạo demo network', () => {
    it('keeps local source coordinates, provenance and explicit demo semantics', () => {
        expect(network.sourceRoads).toHaveLength(21);
        expect(network.roads).toHaveLength(42);
        expect(network.topology.excluded).toContainEqual({ placemarkIndex: 67, reason: 'outside-che-tao-aoi' });
        expect(network.source.observedAt).toBeNull();
        expect(network.topology.crossingsConnected).toBe(false);
        for (const place of network.places) {
            const geo = roadGeographic(place.projected);
            expect(geo.longitude).toBeCloseTo(place.longitude, 7);
            expect(geo.latitude).toBeCloseTo(place.latitude, 7);
        }
    });
    it.each([['Village A', 'Village B'], ['Village A', 'Village C'], ['Village B', 'Village C']])('routes %s to %s without creating access roads', (a, b) => {
        const result = analyseRoadJourney(network.roads, select(a), select(b), true, 250);
        expect(result.kind).toBe('route');
        expect(result.route!.segs.some(s => s.status === 'blocked')).toBe(false);
        expect(result.route!.lengthKm).toBeGreaterThan(.2);
        expect(result.start!.anchor!.distance).toBeGreaterThan(30);
        expect(result.end!.anchor!.distance).toBeGreaterThan(30);
        expect(result.route!.points[0]).toEqual(result.start!.anchor!.point);
        expect(result.route!.points.at(-1)).toEqual(result.end!.anchor!.point);
        for (let i = 1; i < result.route!.segs.length; i++)
            expect(result.route!.segs[i].points[0]).toEqual(result.route!.segs[i - 1].points.at(-1));
    });
    it('takes a real longer detour when the red road is excluded', () => {
        const a = select('Village B'), b = select('Village C');
        const baseline = analyseRoadJourney(network.roads, a, b, false, 250).route!;
        const detour = analyseRoadJourney(network.roads, a, b, true, 250).route!;
        expect(baseline.status).toBe('blocked');
        expect(detour.status).not.toBe('blocked');
        expect(detour.lengthKm).toBeGreaterThan(baseline.lengthKm);
        expect(network.roads.some(r => r.status === 'blocked')).toBe(true);
    });
    it('rejects remote endpoints instead of fabricating a traversable connector', () => {
        const result = analyseRoadJourney(network.roads, select('Village A'), { origin: roadProjected(21.67983458, 104.09050835), source: 'map' }, true, 250);
        expect(result.kind).toBe('endpoint-unavailable');
        expect(result.route).toBeNull();
    });
});
