import type { ScenarioRoute } from '../../types/dear';

type Point = { x: number; y: number };
export type Turn = 'straight' | 'left' | 'right';
/** A stretch of the route on one named road, starting `fromM` metres along it, entered with `turn`. */
export type NavigationStep = { name: [vi: string, en: string]; fromM: number; turn: Turn };
export type NavigationState = {
  /** How far along the route the resident is, and how far off it. */
  alongM: number; offRouteM: number; remainingM: number;
  /** The next road change ahead, or null when only the destination remains. */
  next: (NavigationStep & { inM: number }) | null;
  /** The road the resident is on now. */
  current: NavigationStep;
  arrived: boolean;
};

/** Off the route by more than this, the resident has left it. */
export const OFF_ROUTE_M = 60;
/** Within this of the end, the resident has arrived. */
export const ARRIVED_M = 30;
/** Walking on mountain roads and tracks, in metres a minute (about 3 km/h). */
export const WALK_M_PER_MIN = 50;

const length = (points: readonly Point[]) => points.reduce((sum, p, i) => i ? sum + Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) : 0, 0);
const stations = (points: readonly Point[]) => {
  const out: number[] = [];
  for (let i = 0; i < points.length; i++) out.push(i ? out[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y) : 0);
  return out;
};

function pointAt(points: readonly Point[], at: readonly number[], m: number): Point {
  const s = Math.max(0, Math.min(m, at[at.length - 1]));
  for (let i = 1; i < points.length; i++) if (at[i] >= s) {
    const t = at[i] === at[i - 1] ? 0 : (s - at[i - 1]) / (at[i] - at[i - 1]);
    return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t };
  }
  return points[points.length - 1];
}

/** Which way the route bends at `m`: the heading 25 m before against 25 m after. */
function turnAt(points: readonly Point[], at: readonly number[], m: number): Turn {
  const a = pointAt(points, at, m - 25), b = pointAt(points, at, m), c = pointAt(points, at, m + 25);
  const ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y;
  const angle = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy) * 180 / Math.PI;
  // Projected y points north, so a positive angle turns anticlockwise: left.
  return Math.abs(angle) < 30 ? 'straight' : angle > 0 ? 'left' : 'right';
}

/** The route as named roads in order, each with the turn onto it. Consecutive sections of one road are one step. */
export function routeSteps(route: ScenarioRoute): NavigationStep[] {
  const at = stations(route.points), total = at[at.length - 1] || 1;
  const lengths = route.segs.map(seg => length(seg.points)), sum = lengths.reduce((a, b) => a + b, 0) || 1;
  const steps: NavigationStep[] = [];
  let travelled = 0;
  route.segs.forEach((seg, i) => {
    const fromM = travelled / sum * total;
    travelled += lengths[i];
    if (steps.length && steps[steps.length - 1].name[0] === seg.name[0]) return;
    steps.push({ name: seg.name, fromM, turn: steps.length ? turnAt(route.points, at, fromM) : 'straight' });
  });
  return steps.length ? steps : [{ name: route.name, fromM: 0, turn: 'straight' }];
}

/** Where the resident stands on the route, and what comes next. */
export function navigationState(route: ScenarioRoute, steps: readonly NavigationStep[], me: Point): NavigationState {
  const points = route.points, at = stations(points), total = at[at.length - 1];
  let alongM = 0, offRouteM = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((me.x - a.x) * dx + (me.y - a.y) * dy) / l2)) : 0;
    const d = Math.hypot(me.x - a.x - dx * t, me.y - a.y - dy * t);
    if (d < offRouteM) { offRouteM = d; alongM = at[i - 1] + Math.sqrt(l2) * t; }
  }
  const remainingM = Math.max(0, total - alongM);
  const index = steps.findIndex(step => step.fromM > alongM + 5);
  const current = steps[index === -1 ? steps.length - 1 : Math.max(0, index - 1)];
  return { alongM, offRouteM, remainingM, current, arrived: remainingM <= ARRIVED_M && offRouteM <= OFF_ROUTE_M,
    next: index === -1 ? null : { ...steps[index], inM: steps[index].fromM - alongM } };
}
