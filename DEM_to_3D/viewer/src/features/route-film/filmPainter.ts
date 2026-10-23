import type { Locale, ScenarioRoute } from '../../types/dear';
import type { JourneyEndpoint } from '../routes/journeyAnalysis';
import type { LocalNetwork } from './localNetwork';
import { FILM_WIDTH as W, FILM_HEIGHT as H, pixel, roadWorld, world, geographic, pathStations, revealPath, routeProgress, type FilmView, type XY } from './filmGeometry';
export const networkColors = { open: '#58c477', uncertain: '#f1c94f', blocked: '#ef6559' };
type Line = {
    points: XY[];
    status: 'open' | 'uncertain' | 'blocked';
};
export type FilmScene = {
    view: FilmView;
    background: HTMLCanvasElement;
    credit: string;
    locale: Locale;
    roads: Line[];
    areas: Array<{
        points: XY[];
        kind: 'water' | 'landslide';
    }>;
    places: Array<{
        point: XY;
        name: string;
        kind: string;
    }>;
    blocked: XY[];
    route: XY[];
    stations: number[];
    endpoints: Array<{
        point: XY;
        road: XY | null;
        label: string;
    }>;
};
export function createFilmScene(network: LocalNetwork, view: FilmView, background: HTMLCanvasElement, credit: string, locale: Locale, route: ScenarioRoute | null, start: JourneyEndpoint | null, end: JourneyEndpoint | null): FilmScene {
    const points = route?.points.map(roadWorld) ?? [];
    return { view, background, credit, locale, roads: network.roads.map(r => ({ points: r.points.map(roadWorld), status: r.status })),
        areas: network.areas.map(a => ({ kind: a.kind, points: a.coordinates.map(p => world(p[0], p[1])) })),
        places: network.places.map(p => ({ point: world(p.longitude, p.latitude), name: p.name, kind: p.kind })),
        blocked: network.sourceRoads.filter(r => r.color === 'ff0000ff').map(r => { const p = r.coordinates[Math.floor(r.coordinates.length / 2)]; return world(p[0], p[1]); }),
        route: points, stations: pathStations(points), endpoints: [start, end].flatMap((p, i) => p ? [{ point: roadWorld(p.origin), road: p.anchor && p.anchor.distance > 1 ? roadWorld(p.anchor.point) : null, label: i ? 'B' : 'A' }] : []) };
}
function line(ctx: CanvasRenderingContext2D, scene: FilmScene, points: XY[], color: string, width: number, dash: number[] = []) {
    if (!points.length)
        return;
    ctx.beginPath();
    points.forEach((p, i) => { const q = pixel(scene.view, p); if (!i)
        ctx.moveTo(q.x, q.y);
    else
        ctx.lineTo(q.x, q.y); });
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
}
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) { ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(15,28,24,.85)'; ctx.strokeText(text, x, y); ctx.fillStyle = '#fff'; ctx.fillText(text, x, y); }
/** Preview and encoder call this exact painter with the same frozen geographic view. */
export function paintFilmFrame(ctx: CanvasRenderingContext2D, scene: FilmScene, seconds: number | null) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(scene.background, 0, 0, W, H);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const area of scene.areas) {
        ctx.beginPath();
        area.points.forEach((p, i) => { const q = pixel(scene.view, p); if (!i)
            ctx.moveTo(q.x, q.y);
        else
            ctx.lineTo(q.x, q.y); });
        ctx.closePath();
        ctx.fillStyle = area.kind === 'water' ? 'rgba(76,146,227,.65)' : 'rgba(191,66,45,.5)';
        ctx.fill();
        ctx.strokeStyle = area.kind === 'water' ? '#75b5ed' : '#d88b6a';
        ctx.lineWidth = 1.2;
        ctx.stroke();
    }
    for (const road of scene.roads) {
        line(ctx, scene, road.points, 'rgba(13,30,24,.75)', 5.5);
        line(ctx, scene, road.points, networkColors[road.status], 3, road.status === 'uncertain' ? [8, 4] : []);
    }
    const progress = seconds === null ? 1 : routeProgress(seconds), route = revealPath(scene.route, scene.stations, progress);
    if (route.length > 1) {
        line(ctx, scene, route, 'rgba(255,255,255,.95)', 8);
        line(ctx, scene, route, '#368df0', 4.5);
    }
    // A route inspected through a closure never paints over the red blocked status.
    for (const road of scene.roads)
        if (road.status === 'blocked')
            line(ctx, scene, road.points, networkColors.blocked, 3.2);
    ctx.font = '500 23px Roboto, Arial, sans-serif';
    ctx.textAlign = 'left';
    for (const place of scene.places) {
        const p = pixel(scene.view, place.point);
        ctx.beginPath();
        ctx.arc(p.x, p.y, place.kind === 'hlz' ? 12 : 7, 0, 2 * Math.PI);
        ctx.fillStyle = place.kind === 'hlz' ? '#ba8737' : '#6bb7d2';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (place.kind === 'hlz') {
            ctx.font = 'bold 15px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'white';
            ctx.fillText('H', p.x, p.y + 5);
            ctx.textAlign = 'left';
            ctx.font = '500 23px Roboto, Arial, sans-serif';
        }
        label(ctx, place.name, p.x + 15, p.y - 10);
    }
    for (const point of scene.blocked) {
        const p = pixel(scene.view, point);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 13, 0, 2 * Math.PI);
        ctx.fillStyle = networkColors.blocked;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'white';
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x - 6, p.y);
        ctx.lineTo(p.x + 6, p.y);
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    for (const endpoint of scene.endpoints) {
        const p = pixel(scene.view, endpoint.point);
        if (endpoint.road)
            line(ctx, scene, [endpoint.point, endpoint.road], 'rgba(255,255,255,.9)', 2, [5, 6]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 18, 0, 2 * Math.PI);
        ctx.fillStyle = endpoint.label === 'A' ? '#176a55' : '#253f53';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'white';
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = '600 21px Roboto, Arial, sans-serif';
        ctx.fillText(endpoint.label, p.x, p.y + 7);
    }
    if (seconds !== null && route.length) {
        const p = pixel(scene.view, route.at(-1)!);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#247ae0';
        ctx.lineWidth = 4;
        ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.font = '400 17px Roboto, Arial, sans-serif';
    const vi = scene.locale === 'vi', legend = [vi ? 'Đường thông' : 'Open', vi ? 'Khó đi' : 'Difficult', vi ? 'Bị chặn' : 'Blocked'];
    ctx.fillStyle = 'rgba(20,34,29,.84)';
    ctx.fillRect(28, 28, vi ? 432 : 352, 50);
    let x = 46;
    (['open', 'uncertain', 'blocked'] as const).forEach((status, i) => { ctx.beginPath(); ctx.moveTo(x, 53); ctx.lineTo(x + 26, 53); ctx.strokeStyle = networkColors[status]; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = 'white'; ctx.fillText(legend[i], x + 35, 59); x += ctx.measureText(legend[i]).width + 64; });
    ctx.font = '500 20px Roboto, Arial, sans-serif';
    label(ctx, 'N', W - 50, 53);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W - 43, 62);
    ctx.lineTo(W - 43, 95);
    ctx.stroke();
    const mpp = scene.view.metresPerPixel * Math.cos(geographic({ x: scene.view.cx, y: scene.view.cy }).latitude * Math.PI / 180), target = mpp * 150, power = 10 ** Math.floor(Math.log10(target)), distance = [1, 2, 5, 10].map(v => v * power).find(v => v >= target)!, bar = distance / mpp;
    ctx.font = '400 17px Roboto, Arial, sans-serif';
    label(ctx, distance >= 1000 ? `${distance / 1000} km` : `${distance} m`, 40, H - 70);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, H - 58);
    ctx.lineTo(40 + bar, H - 58);
    ctx.stroke();
    ctx.fillStyle = 'rgba(15,28,23,.8)';
    ctx.fillRect(0, H - 32, W, 32);
    ctx.font = '400 13px Roboto, Arial, sans-serif';
    ctx.fillStyle = '#eee';
    ctx.fillText(`${vi ? 'Mô phỏng KMZ · Chưa xác minh thực địa' : 'KMZ demonstration · Not field verified'} | ${scene.credit}`, 20, H - 11);
}
