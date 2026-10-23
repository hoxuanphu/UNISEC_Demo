/** Timing and path geometry of the route flyover. Pure functions: one plan drives
 * both live playback and frame-exact video export, so they always agree. */

export type FlyoverPhase = 'intro' | 'dive' | 'travel' | 'stop' | 'arrive' | 'outro' | 'final';
export type FlyoverMoment = {
  time: number;
  phase: FlyoverPhase;
  /** Metres along the route. */
  distance: number;
  /** Metres per second along the route at this moment. */
  speed: number;
  /** Index of the stop being visited, or -1. */
  stop: number;
  /** 0..1 within the current stop visit. */
  stopProgress: number;
  /** Wider local framing at the start/end; travel always follows the route. */
  overview: number;
};
export type FlyoverSettings = {
  duration: number; introHold: number; dive: number; maxRamp: number;
  dwell: number; arriveHold: number; outro: number; finalHold: number;
};
export const defaultFlyoverSettings: FlyoverSettings = {
  duration: 25, introHold: 1, dive: 1.2, maxRamp: .8,
  dwell: 1.6, arriveHold: .3, outro: 3, finalHold: 1.2
};

type Segment =
  | { kind: 'hold'; phase: 'intro' | 'stop' | 'arrive' | 'final'; start: number; end: number; distance: number; stop: number }
  | { kind: 'dive' | 'outro'; start: number; end: number; distance: number }
  | { kind: 'leg'; start: number; end: number; from: number; to: number; ramp: number; vmax: number };

export const easeInOutCubic = (x: number) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Trapezoidal speed (ramp, cruise, ramp): the camera starts and stops without a jolt. */
function legPosition(segment: Extract<Segment, { kind: 'leg' }>, tau: number) {
  const { ramp: r, vmax: v } = segment, T = segment.end - segment.start, D = segment.to - segment.from;
  if (tau <= 0) return { s: 0, speed: 0 };
  if (tau >= T) return { s: D, speed: 0 };
  if (tau < r) return { s: v * tau * tau / (2 * r), speed: v * tau / r };
  if (tau > T - r) return { s: D - v * (T - tau) ** 2 / (2 * r), speed: v * (T - tau) / r };
  return { s: v * r / 2 + v * (tau - r), speed: v };
}

export function planFlyover(length: number, stopDistances: number[], settings: FlyoverSettings = defaultFlyoverSettings) {
  if (!(length > 0)) throw new Error('A flyover needs a route');
  const stops = stopDistances.map(d => Math.min(length, Math.max(0, d)));
  const order = stops.map((d, i) => [d, i] as const).sort((a, b) => a[0] - b[0]);
  // Narrative time, not vehicle speed. Long routes get up to 25 seconds; short
  // sequences stay compact. Reserve readable photo visits, then allocate travel
  // more proportionally so the long opening leg is not squeezed into two seconds.
  const targetDuration = Math.min(settings.duration, Math.max(20, 22 + length / 5000 + stops.length * .6));
  const fixed = settings.introHold + settings.dive + settings.arriveHold + settings.outro + settings.finalHold;
  const dwell = order.length ? Math.min(settings.dwell, (targetDuration-fixed)*.65/order.length) : 0;
  const travelBudget = targetDuration - fixed - dwell*order.length;
  const distances = [0, ...order.map(([distance]) => distance), length];
  const weight = (distance: number) => distance > 1e-6 ? Math.pow(distance, .75) : 0;
  const totalWeight = distances.slice(1).reduce((sum, distance, i) => sum + weight(distance-distances[i]), 0);
  const segments: Segment[] = [];
  let time = 0;
  const push = (segment: Segment) => { segments.push(segment); time = segment.end; };
  push({ kind: 'hold', phase: 'intro', start: 0, end: settings.introHold, distance: 0, stop: -1 });
  push({ kind: 'dive', start: time, end: time + settings.dive, distance: 0 });
  let at = 0;
  const leg = (to: number) => {
    const D = to - at;
    if (D <= 1e-6) return;
    const T = travelBudget * weight(D) / totalWeight;
    const ramp = Math.min(settings.maxRamp, T * .4);
    push({ kind: 'leg', start: time, end: time + T, from: at, to, ramp, vmax: D / (T - ramp) });
    at = to;
  };
  for (const [distance, index] of order) {
    leg(distance);
    push({ kind: 'hold', phase: 'stop', start: time, end: time + dwell, distance, stop: index });
  }
  leg(length);
  push({ kind: 'hold', phase: 'arrive', start: time, end: time + settings.arriveHold, distance: length, stop: -1 });
  push({ kind: 'outro', start: time, end: time + settings.outro, distance: length });
  push({ kind: 'hold', phase: 'final', start: time, end: time + settings.finalHold, distance: length, stop: -1 });
  const duration = Math.round(time*1e6)/1e6;
  const stopWindows = order.map(([, index]) => {
    const segment = segments.find(item => item.kind === 'hold' && item.phase === 'stop' && item.stop === index)!;
    return { stop: index, start: segment.start, end: segment.end };
  });

  const at_ = (t: number): FlyoverMoment => {
    const clamped = Math.min(duration, Math.max(0, t));
    const segment = segments.find(item => clamped < item.end) ?? segments[segments.length - 1];
    const tau = clamped - segment.start, span = segment.end - segment.start;
    const base = { time: clamped, speed: 0, stop: -1, stopProgress: 0, overview: 0 };
    switch (segment.kind) {
      case 'hold': return { ...base, phase: segment.phase, distance: segment.distance, stop: segment.stop,
        stopProgress: segment.phase === 'stop' ? clamp01(tau / span) : 0, overview: segment.phase === 'intro' || segment.phase === 'final' ? 1 : 0 };
      case 'dive': return { ...base, phase: 'dive', distance: 0, overview: 1 - easeInOutCubic(clamp01(tau / span)) };
      case 'outro': return { ...base, phase: 'outro', distance: length, overview: easeInOutCubic(clamp01(tau / span)) };
      case 'leg': {
        const p = legPosition(segment, tau);
        return { ...base, phase: 'travel', distance: segment.from + p.s, speed: p.speed };
      }
    }
  };
  return { duration, length, stops, stopWindows, at: at_ };
}
export type FlyoverPlan = ReturnType<typeof planFlyover>;

/** Arc-length path with headings smoothed over hundreds of metres, so the camera
 * turns with the valley rather than every hairpin. Coordinates: x east, z south. */
export function createPathSampler(points: Array<{ x: number; y: number; z: number }>, step: number, smoothing = 260) {
  if (points.length < 2) throw new Error('A path needs two points');
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  const length = cumulative[cumulative.length - 1];
  const locate = (s: number) => {
    const d = Math.min(length, Math.max(0, s));
    let lo = 0, hi = cumulative.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cumulative[mid] <= d) lo = mid; else hi = mid; }
    const span = cumulative[hi] - cumulative[lo];
    return { i: lo, f: span > 0 ? (d - cumulative[lo]) / span : 0 };
  };
  const pointAt = (s: number) => {
    const { i, f } = locate(s), a = points[i], b = points[Math.min(points.length - 1, i + 1)];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
  };
  // Headings on a regular grid, Gaussian-averaged as unit vectors.
  const count = Math.max(2, Math.ceil(length / step) + 1);
  const rawX = new Float64Array(count), rawZ = new Float64Array(count);
  const reach = Math.max(step, 120);
  for (let k = 0; k < count; k++) {
    const s = k * step, a = pointAt(s - reach), b = pointAt(s + reach);
    const dx = b.x - a.x, dz = b.z - a.z, n = Math.hypot(dx, dz) || 1;
    rawX[k] = dx / n; rawZ[k] = dz / n;
  }
  const radius = Math.ceil(3 * smoothing / step), headX = new Float64Array(count), headZ = new Float64Array(count);
  for (let k = 0; k < count; k++) {
    let sx = 0, sz = 0;
    for (let j = Math.max(0, k - radius); j <= Math.min(count - 1, k + radius); j++) {
      const w = Math.exp(-(((j - k) * step) ** 2) / (2 * smoothing * smoothing));
      sx += rawX[j] * w; sz += rawZ[j] * w;
    }
    const n = Math.hypot(sx, sz) || 1;
    headX[k] = sx / n; headZ[k] = sz / n;
  }
  const headingAt = (s: number) => {
    const u = Math.min(count - 1, Math.max(0, s / step)), k = Math.min(count - 2, Math.floor(u)), f = u - k;
    const x = headX[k] * (1 - f) + headX[k + 1] * f, z = headZ[k] * (1 - f) + headZ[k + 1] * f, n = Math.hypot(x, z) || 1;
    return { x: x / n, z: z / n };
  };
  /** Distance along the path of the point nearest to (x, z). */
  const project = (x: number, z: number) => {
    let best = Infinity, at = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
      const f = l2 ? Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / l2)) : 0;
      const d = Math.hypot(a.x + dx * f - x, a.z + dz * f - z);
      if (d < best) { best = d; at = cumulative[i - 1] + Math.sqrt(l2) * f; }
    }
    return at;
  };
  return { length, cumulative, pointAt, headingAt, project };
}
export type PathSampler = ReturnType<typeof createPathSampler>;
