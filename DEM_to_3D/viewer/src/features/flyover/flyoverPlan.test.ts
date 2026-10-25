import { describe, expect, it } from 'vitest';
import { createPathSampler, planFlyover } from './flyoverPlan';

describe('flyover timeline', () => {
  const plan = planFlyover(32100, [21100, 17300, 22400]);
  const frames = Array.from({ length: Math.ceil(plan.duration * 60) + 1 }, (_, i) => plan.at(i / 60));

  it('runs 25 seconds at 1x, with brief scar visits and a short closing shot', () => {
    expect(plan.duration).toBe(25);
    const dwell=plan.stopWindows.reduce((sum,stop)=>sum+stop.end-stop.start,0);
    expect(dwell).toBeCloseTo(4.8);
    expect(plan.stopWindows[0].start).toBeGreaterThan(7);
    expect(plan.stopWindows[0].start).toBeLessThan(13);
    expect(planFlyover(1000,[]).duration).toBe(25);
    // The closing pull-back is brief, then holds long enough to read the closing card.
    const outro=frames.filter(f=>f.phase==='outro').length/60,final=frames.filter(f=>f.phase==='final').length/60;
    expect(outro).toBeLessThan(2);expect(final).toBeGreaterThan(1.2);
    expect(plan.at(-1).distance).toBe(0);
    expect(plan.at(100).distance).toBe(plan.length);
    expect(planFlyover(200000,[100000,110000,120000]).duration).toBe(25);
  });

  it('moves forward only, without jumps, and ends on the route end', () => {
    for (let i = 1; i < frames.length; i++) {
      const step = frames[i].distance - frames[i - 1].distance;
      expect(step).toBeGreaterThanOrEqual(-1e-6);
      expect(step).toBeLessThanOrEqual(Math.max(frames[i].speed,frames[i-1].speed)/60+1e-6);
    }
    expect(frames[0]).toMatchObject({ phase: 'intro', distance: 0, overview: 1 });
    expect(frames.at(-1)).toMatchObject({ phase: 'final', distance: 32100, overview: 1 });
  });

  it('visits every stop in road order, standing still at it', () => {
    expect(plan.stopWindows.map(w => w.stop)).toEqual([1, 0, 2]);
    for (const window of plan.stopWindows) {
      const mid = plan.at((window.start + window.end) / 2);
      expect(mid).toMatchObject({ phase: 'stop', stop: window.stop, distance: plan.stops[window.stop], speed: 0 });
      // Arrival and departure are at rest: no jolt into or out of the stop.
      expect(plan.at(window.start - 1e-6).speed).toBeLessThan(1);
      expect(plan.at(window.end + 1e-6).speed).toBeLessThan(1);
    }
  });

  it('uses wider framing only at the start/end, never during travel', () => {
    for (let i = 1; i < frames.length; i++) expect(Math.abs(frames[i].overview - frames[i - 1].overview)).toBeLessThan(.1);
    expect(frames.filter(f => f.phase === 'travel').every(f => f.overview === 0)).toBe(true);
    expect(frames.filter(f => f.phase === 'stop').every(f => f.overview === 0)).toBe(true);
  });
});

describe('flyover path', () => {
  const zigzag = Array.from({ length: 101 }, (_, i) => ({ x: i * 20, y: 0, z: i % 2 ? 15 : -15 }));
  const path = createPathSampler(zigzag, 10, 200);

  it('measures and interpolates along the path', () => {
    expect(path.length).toBeCloseTo(100 * Math.hypot(20, 30), 6);
    const p = path.pointAt(path.length / 200);
    expect(p.x).toBeCloseTo(10, 6);
    const q = path.pointAt(1234);
    expect(path.project(q.x, q.z)).toBeCloseTo(1234, 6);
  });

  it('smooths hairpins into the overall direction of travel', () => {
    const h = path.headingAt(path.length / 2);
    expect(h.x).toBeGreaterThan(.99);
    expect(Math.hypot(h.x, h.z)).toBeCloseTo(1, 9);
  });
});
