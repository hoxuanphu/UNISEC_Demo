import { describe, it, expect } from 'vitest';
import data from '../../../public/scenarios/che-tao/local-network.json';
import { validateLocalNetwork } from './localNetwork';
import { analyseRoadJourney } from '../routes/journeyAnalysis';
import { roadGeographic, roadProjected } from '../routes/selectedRoadJourney';
import { frameView, pixel, unpixel, pathStations, revealPath, routeProgress, FILM_DURATION } from './filmGeometry';
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
describe('fixed frame movie geometry', () => {
    it('preserves scale in both axes and inverts map picks', () => {
        const view = frameView([{ x: 0, y: 0 }, { x: 1000, y: 1000 }]);
        const p = pixel(view, { x: 100, y: 200 }), q = pixel(view, { x: 200, y: 300 });
        expect(q.x - p.x).toBeCloseTo(p.y - q.y, 10);
        expect(unpixel(view, p).x).toBeCloseTo(100, 10);
        expect(unpixel(view, p).y).toBeCloseTo(200, 10);
    });
    it('reveals the measured path with short intro and a complete final overview', () => {
        const points = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 400 }], stations = pathStations(points);
        expect(stations).toEqual([0, 300, 700]);
        expect(revealPath(points, stations, .5).at(-1)).toEqual({ x: 300, y: 50 });
        expect(routeProgress(0)).toBe(0);
        expect(routeProgress(FILM_DURATION - 1)).toBe(1);
        let previous = 0;
        for (let t = 0; t < FILM_DURATION; t += .1) {
            const next = routeProgress(t);
            expect(next).toBeGreaterThanOrEqual(previous);
            previous = next;
        }
        expect(revealPath(points, stations, 1)).toEqual(points);
    });
});
