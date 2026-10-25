const inside = (element: Element, x: number, y: number) => {
  const box = element.getBoundingClientRect();
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
};

/**
 * A pinch or Ctrl+wheel zooms the map under the pointer, never the page: page zoom
 * pushes the panels off screen. Symbols, cards and tracked devices drawn over the
 * map sit outside its own element, so the gesture is handed on to the map below.
 * Keyboard page zoom stays available.
 */
export function keepZoomOnMap(root: Document = document): () => void {
  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    if (event.defaultPrevented) return; // The map itself has taken it.
    const target = event.target instanceof Element ? event.target : null;
    const area = target?.closest('.map-area, .route-film-map');
    if (!area) return;
    const surface = [...area.querySelectorAll('.leaflet-container, canvas')].find(element => inside(element, event.clientX, event.clientY));
    if (!surface) return;
    event.preventDefault();
    if (surface.contains(target)) return;
    surface.dispatchEvent(new WheelEvent('wheel', event));
  };
  // Safari reports trackpad pinch as gesture events.
  const onGesture = (event: Event) => {
    const target=event.target instanceof Element?event.target:null;
    if(target?.closest('.map-area,.route-film-map'))event.preventDefault();
  };
  root.addEventListener('wheel', onWheel, { passive: false });
  root.addEventListener('gesturestart', onGesture);
  root.addEventListener('gesturechange', onGesture);
  return () => {
    root.removeEventListener('wheel', onWheel);
    root.removeEventListener('gesturestart', onGesture);
    root.removeEventListener('gesturechange', onGesture);
  };
}
