import {poiMetrics,markerSize} from './poiFrame';
export type ScreenRect = { x: number; y: number; width: number; height: number };
export type ScreenMarker = { id: string; x: number; y: number; priority: number; selected?: boolean; category?: string; featured?: boolean };

/** Display rank: the selection, reported hazards, priority communities, unverified hazards, then staging. */
export function markerPriority(marker: { selected: boolean; hazard?: boolean; suspected?: boolean; priorityCommunity?: boolean; staging?: boolean }): number {
  if (marker.selected) return 100;
  if (marker.hazard && !marker.suspected) return 80;
  if (marker.priorityCommunity) return 50;
  if (marker.hazard) return 40;
  return marker.staging ? 30 : 10;
}
export type MarkerGroup = { anchor: ScreenMarker; members: ScreenMarker[]; rect: ScreenRect };

export function overlaps(a: ScreenRect, b: ScreenRect, gap = 4): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

const markerRect = (point: ScreenMarker, size: number): ScreenRect => {
  size=markerSize(size>28,!!point.selected);
  const {half,tip,height}=poiMetrics(size,!!point.selected),padding=point.selected?1:0;
  return {x:point.x-half-padding,y:point.y-tip-padding,width:size+padding*2,height:height+padding*2};
};

const byPriority = (a: ScreenMarker, b: ScreenMarker) => b.priority - a.priority || a.id.localeCompare(b.id);
const covers = (a: ScreenMarker, b: ScreenMarker): boolean => {
  // The chosen pin is anchored at its tip, not at its visual centre. Compare
  // the other feature's actual coordinate so selecting it cannot split a group
  // of coincident features or hide a neighbour under the enlarged pin.
  const r=markerRect(a,32),x=b.x,y=b.y;
  return x > r.x && x < r.x + r.width && y > r.y && y < r.y + r.height;
};

/** Aggregate colliding screen symbols, without moving their geographic positions.
 * One category merges when its symbols touch. A higher-ranked group absorbs another
 * category only when one anchor would cover the other's centre, so a reported hazard
 * is never hidden under a community and touching symbols stay visible and clickable.
 * The selected/highest-priority member anchors each group. A group includes all its
 * members, even when a member lies behind a control; controls always win.
 */
export function layoutMarkerGroups(points: ScreenMarker[], width: number, height: number, controls: ScreenRect[]): MarkerGroup[] {
  const remaining = points.filter(p => {
    const r=markerRect(p,28);
    return Number.isFinite(p.x) && Number.isFinite(p.y) && r.x>=4 && r.y>=4 && r.x+r.width<=width-4 && r.y+r.height<=height-4;
  }).sort(byPriority);
  const clusters: ScreenMarker[][] = [];
  while (remaining.length) {
    const members = [remaining.shift()!];
    // Connected components prevent a newly enlarged count symbol from covering
    // a neighbouring symbol. Stable IDs break ties between equal priorities.
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = remaining.length - 1; i >= 0; i--) {
        if (remaining[i].category === members[0].category &&
            members.some(p => p.featured || remaining[i].featured
              ? covers(p, remaining[i]) || covers(remaining[i], p)
              : overlaps(markerRect(p, 32), markerRect(remaining[i], 32), 6))) {
          members.push(remaining.splice(i, 1)[0]); changed = true;
        }
      }
    }
    clusters.push(members.sort(byPriority));
  }
  // Only anchors are compared across categories, so groups do not chain over the map.
  const merged: ScreenMarker[][] = [];
  for (const cluster of clusters.sort((a, b) => byPriority(a[0], b[0]))) {
    const host = merged.find(group => covers(group[0], cluster[0]) || covers(cluster[0], group[0]));
    if (host) host.push(...cluster); else merged.push([...cluster]);
  }
  const groups: MarkerGroup[] = [];
  for (const members of merged) {
    members.sort(byPriority);
    const size = members.length > 1 ? 32 : 28;
    const anchor = members.find(p => !controls.some(r => overlaps(markerRect(p, size), r, 6)));
    if (!anchor) continue;
    groups.push({ anchor, members, rect: markerRect(anchor, size) });
  }
  return groups;
}

/** Individual places do not merge merely because they are nearby. A covered
 * feature remains selectable behind a normal symbol, without count or offset. */
export function layoutPlaceMarkers(points: ScreenMarker[], width: number, height: number, controls: ScreenRect[]): MarkerGroup[] {
  const placed: MarkerGroup[] = [];
  for (const point of [...points].sort(byPriority)) {
    const rect = markerRect(point, 28);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || rect.x < 4 || rect.y < 4 ||
      rect.x + rect.width > width - 4 || rect.y + rect.height > height - 4 || controls.some(control => overlaps(rect, control, 3))) continue;
    const covered = placed.find(item => overlaps(item.rect, rect, 3));
    if (covered) covered.members.push(point);
    else placed.push({anchor: point, members: [point], rect});
  }
  return placed;
}

/** Place a contextual label near its geographic anchor without covering symbols or controls.
 * Suppress the label when space is exhausted; never displace the geographic feature. */
export function placeMapLabel(anchor: {x:number;y:number}, size: {width:number;height:number}, viewport: {width:number;height:number}, obstacles: ScreenRect[]): ScreenRect | undefined {
  const {x,y}=anchor, {width,height}=size, margin=10;
  const candidates=[14,40,64].flatMap(gap=>[
    {x:x-width/2,y:y-height-gap}, {x:x-width/2,y:y+gap},
    {x:x+gap,y:y-height/2}, {x:x-width-gap,y:y-height/2},
    {x:x+gap,y:y-height-gap}, {x:x-width-gap,y:y-height-gap},
    {x:x+gap,y:y+gap}, {x:x-width-gap,y:y+gap}
  ]);
  return candidates.map(p=>({...p,width,height})).find(rect=>
    rect.x>=margin && rect.y>=margin && rect.x+width<=viewport.width-margin && rect.y+height<=viewport.height-margin &&
    !obstacles.some(obstacle=>overlaps(rect,obstacle,6)));
}
