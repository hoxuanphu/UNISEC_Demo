import { roadGeographic } from '../routes/selectedRoadJourney';
export type XY = {
    x: number;
    y: number;
};
export type FilmView = {
    cx: number;
    cy: number;
    metresPerPixel: number;
};
export const FILM_WIDTH = 1920, FILM_HEIGHT = 1080, FILM_DURATION = 25;
const R = 6378137;
export function world(longitude: number, latitude: number): XY {
    return { x: R * longitude * Math.PI / 180, y: R * Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360)) };
}
export function geographic(p: XY) { return { longitude: p.x / R * 180 / Math.PI, latitude: (2 * Math.atan(Math.exp(p.y / R)) - Math.PI / 2) * 180 / Math.PI }; }
export function roadWorld(point: XY): XY { const p = roadGeographic(point); return world(p.longitude, p.latitude); }
export function frameView(points: XY[], padding = 140): FilmView {
    const xs = points.map(p => p.x), ys = points.map(p => p.y), left = Math.min(...xs), right = Math.max(...xs), bottom = Math.min(...ys), top = Math.max(...ys);
    return { cx: (left + right) / 2, cy: (bottom + top) / 2, metresPerPixel: Math.max(1, (right - left) / (FILM_WIDTH - padding * 2), (top - bottom) / (FILM_HEIGHT - padding * 2)) };
}
export const pixel = (view: FilmView, p: XY): XY => ({ x: FILM_WIDTH / 2 + (p.x - view.cx) / view.metresPerPixel, y: FILM_HEIGHT / 2 - (p.y - view.cy) / view.metresPerPixel });
export const unpixel = (view: FilmView, p: XY): XY => ({ x: view.cx + (p.x - FILM_WIDTH / 2) * view.metresPerPixel, y: view.cy - (p.y - FILM_HEIGHT / 2) * view.metresPerPixel });
export function routeProgress(seconds: number, duration = FILM_DURATION): number {
    const t = Math.max(0, Math.min(1, (seconds - .8) / (duration - 2.3)));
    // Short acceleration/deceleration, steady middle. Ends with a complete-route hold.
    const ramp = .06, area = 1 - ramp;
    return t < ramp ? t * t / (2 * ramp * area) : t > 1 - ramp ? 1 - (1 - t) * (1 - t) / (2 * ramp * area) : (t - ramp / 2) / area;
}
export function pathStations(points: XY[]): number[] {
    const result = [0];
    for (let i = 1; i < points.length; i++)
        result.push(result[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    return result;
}
export function revealPath(points: XY[], stations: number[], progress: number): XY[] {
    if (!points.length)
        return [];
    const distance = (stations.at(-1) ?? 0) * Math.max(0, Math.min(1, progress));
    let lo = 0, hi = stations.length - 1;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (stations[mid] <= distance)
            lo = mid;
        else
            hi = mid - 1;
    }
    const result = points.slice(0, lo + 1), a = points[lo], b = points[lo + 1];
    if (b) {
        const t = (distance - stations[lo]) / (stations[lo + 1] - stations[lo] || 1);
        result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    return result;
}
