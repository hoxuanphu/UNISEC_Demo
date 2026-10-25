import { useSyncExternalStore } from 'react';
import type { LocationFeed } from './deviceFeed';

const noSubscription = () => () => undefined;

/**
 * The direction a device is moving, in whole degrees clockwise from north, as a GPS reports
 * its course: used for "You" when the phone has no compass. It holds the last direction while
 * the device stands still, and is null until it has moved.
 */
export function useMovementHeading(feed: LocationFeed | null, id: string | null): number | null {
  const memory = movementMemory(feed, id);
  return useSyncExternalStore(feed?.subscribe ?? noSubscription, memory.read);
}

const memories = new WeakMap<LocationFeed, Map<string, { read: () => number | null }>>();
function movementMemory(feed: LocationFeed | null, id: string | null) {
  if (!feed || !id) return { read: () => null };
  const byId = memories.get(feed) ?? new Map<string, { read: () => number | null }>();
  memories.set(feed, byId);
  let memory = byId.get(id);
  if (!memory) {
    let last: { x: number; y: number } | null = null, heading: number | null = null;
    memory = { read: () => {
      const point = feed.getSnapshot().find(device => device.id === id)?.point;
      if (!point) return heading;
      if (!last) { last = point; return heading; }
      // Projected metres, x east and y north. Ignore jitter under 3 m.
      if (Math.hypot(point.x - last.x, point.y - last.y) >= 3) {
        heading = Math.round((Math.atan2(point.x - last.x, point.y - last.y) * 180 / Math.PI + 360) % 360);
        last = point;
      }
      return heading;
    } };
    byId.set(id, memory);
  }
  return memory;
}
