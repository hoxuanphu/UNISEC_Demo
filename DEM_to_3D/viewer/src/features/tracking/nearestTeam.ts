import { useSyncExternalStore } from 'react';
import type { DevicePosition, LocationFeed } from './deviceFeed';

type Point = { x: number; y: number };
const noSubscription = () => () => undefined;

/** The rescue team closest to `origin` in a straight line, re-read only when it, its state
 * or its distance (to 100 m) changes: not on every movement frame. */
export function useNearestTeam(teams: LocationFeed | null, origin: () => Point | null, originFeed?: LocationFeed | null): { team: DevicePosition; distanceM: number } | null {
  const nearest = () => {
    const at = origin();
    if (!teams || !at) return null;
    let best: { team: DevicePosition; distanceM: number } | null = null;
    for (const team of teams.getSnapshot()) {
      if (team.role !== 'rescue') continue;
      const distanceM = Math.hypot(team.point.x - at.x, team.point.y - at.y);
      if (!best || distanceM < best.distanceM) best = { team, distanceM };
    }
    return best;
  };
  const subscribe = (listener: () => void) => {
    const a = (teams ?? { subscribe: noSubscription }).subscribe(listener), b = (originFeed ?? { subscribe: noSubscription }).subscribe(listener);
    return () => { a(); b(); };
  };
  useSyncExternalStore(subscribe, () => { const found = nearest(); return found ? `${found.team.id}|${found.team.state}|${Math.round(found.distanceM / 100)}` : ''; });
  return nearest();
}
