import { useSyncExternalStore } from 'react';
import { defaultDrawingOrder, normaliseDrawingOrder, type DrawingLayer } from './mapLayerOrder';
export const drawingOrderKey = 'dear.map-drawing-order.v1';
function read(): DrawingLayer[] {
  try { return normaliseDrawingOrder(JSON.parse(localStorage.getItem(drawingOrderKey) ?? 'null')); }
  catch { return [...defaultDrawingOrder]; }
}
const serverOrder = [...defaultDrawingOrder];
let current = read();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  const storage = (event: StorageEvent) => {
    if (event.key !== drawingOrderKey && event.key !== null) return;
    current = read(); listener();
  };
  window.addEventListener('storage', storage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', storage); };
}
function setOrder(value: readonly DrawingLayer[]) {
  current = normaliseDrawingOrder(value);
  try { localStorage.setItem(drawingOrderKey, JSON.stringify(current)); } catch { /* Session remains usable. */ }
  listeners.forEach(listener => listener());
}
/** One display preference across map modes and roles. */
export function useMapLayerOrder() {
  return { order: useSyncExternalStore(subscribe, () => current, () => serverOrder), setOrder };
}
