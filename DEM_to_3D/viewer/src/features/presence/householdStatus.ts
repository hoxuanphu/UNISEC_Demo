import type { AnalysisLayer } from '../imagery/analysisImagery';
import type { HouseholdAccess } from './householdIsolation';

type Point = { x: number; y: number };
type Bounds = [number, number, number, number];
/**
 * Where the people at a hut cluster stand for the responder, most urgent first. People
 * known to be cut off come before those nobody can assess yet:
 * - `cut-off`: every mapped road out is cut, and no team is assigned;
 * - `team`: cut off, in contact, a team is assigned: they wait for it;
 * - `unverified`: the app places people there but nothing shows whether they can leave:
 *   no mapped road near the huts, or no post-event image over them;
 * - `rescued`: a team has brought them out, or the relief task for them is completed;
 * - `clear`: a mapped road out with no known cut, seen on a post-event image.
 */
export type HouseholdStatus = 'cut-off' | 'unverified' | 'team' | 'rescued' | 'clear';
export type HouseholdView = HouseholdAccess & { status: HouseholdStatus; unverified?: 'no-road' | 'no-imagery' };

export const householdStatusOrder: readonly HouseholdStatus[] = ['cut-off', 'team', 'unverified', 'rescued', 'clear'];
export const householdStatusText: Record<HouseholdStatus, [vi: string, en: string]> = {
  'cut-off': ['Cần cứu', 'Needs rescue'], unverified: ['Chưa rõ', 'No information'], team: ['Chờ đội', 'Awaiting team'], rescued: ['Đã cứu', 'Rescued'], clear: ['Chưa ghi nhận chặn', 'No blockage recorded'],
};
/** Map legend: what each disc colour stands for. */
export const householdLegendText: Record<HouseholdStatus, [vi: string, en: string]> = {
  'cut-off': ['Bị cô lập, cần cứu', 'Cut off, needs rescue'], unverified: ['Chưa rõ thông tin', 'No information yet'], team: ['Đã liên lạc, chờ đội', 'In contact, awaiting team'], rescued: ['Đã cứu', 'Rescued'], clear: ['Chưa ghi nhận chặn', 'No blockage recorded'],
};
export const householdStatusTone = { 'cut-off': 'critical', unverified: 'warning', team: 'active', rescued: 'neutral', clear: 'neutral' } as const;
export const unverifiedText: Record<NonNullable<HouseholdView['unverified']>, [vi: string, en: string]> = {
  'no-road': ['Xa đường đã lập bản đồ', 'Far from mapped roads'], 'no-imagery': ['Chưa có ảnh sau thiên tai', 'No post-event imagery'],
};

/** Footprints of the images taken between the trigger and the time of the picture. */
export function postEventCoverage(layers: readonly AnalysisLayer[], from: string, to: string): Bounds[] {
  const start = Date.parse(from), end = Date.parse(to), within = (iso: string) => Date.parse(iso) >= start && Date.parse(iso) <= end;
  return layers.flatMap(layer => layer.kind === 'optical'
    ? layer.parts.filter(part => within(part.acquired)).map(part => part.terrain.bounds)
    : within(layer.acquired) ? [layer.modes.vv.terrain.bounds] : []);
}
const inside = (p: Point, [x0, y0, x1, y1]: Bounds) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;

/** Every hut cluster with its status; `teams` and `done` hold cluster ids (a team assigned, the relief task completed). */
export function householdStatuses(households: readonly HouseholdAccess[], coverage: readonly Bounds[], teams: ReadonlySet<string>, _done: ReadonlySet<string>): HouseholdView[] {
  return households.map(item => {
    const id = item.cluster.id;
    if (item.cluster.rescued) return { ...item, status: 'rescued' };
    if (item.isolated) return { ...item, status: teams.has(id) ? 'team' : 'cut-off' };
    if (!item.access) return { ...item, status: 'unverified', unverified: 'no-road' };
    // A footprint is context only: it never certifies image quality or road passability.
    if (!coverage.some(bounds => inside(item.projected, bounds))) return { ...item, status: 'unverified', unverified: 'no-imagery' };
    return { ...item, status: 'clear' };
  });
}

/** Clusters that need the responder, most urgent first, then by head count. */
export const householdsOfConcern = (views: readonly HouseholdView[]) => views.filter(item => item.status !== 'clear')
  .sort((a, b) => householdStatusOrder.indexOf(a.status) - householdStatusOrder.indexOf(b.status) || b.cluster.people - a.cluster.people);
