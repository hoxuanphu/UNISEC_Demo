import { useEffect, useRef } from 'react';

/**
 * Secondary surfaces over the map: the legend, the overview and the detail panel. Only one is
 * open at a time, as in a map app: opening one folds the others, which stay one tap away.
 */
export type MapSurface = 'legend' | 'overview' | 'detail';
const EVENT = 'dear:map-surface';

export const openMapSurface = (surface: MapSurface) => window.dispatchEvent(new CustomEvent<MapSurface>(EVENT, { detail: surface }));

/** Call `fold` whenever another surface opens. */
export function useMapSurface(surface: MapSurface, fold: () => void) {
  const latest = useRef(fold); latest.current = fold;
  useEffect(() => {
    const listener = (event: Event) => { if ((event as CustomEvent<MapSurface>).detail !== surface) latest.current(); };
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
  }, [surface]);
}
