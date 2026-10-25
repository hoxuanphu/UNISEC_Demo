/**
 * One draw order for every point symbol on the 2D map, whichever layer draws it.
 * When two visible symbols touch, the lower rank yields and is hidden until the map
 * moves apart. Road lines keep their condition colour, so a yielding sign loses no
 * information. Selected objects never yield.
 */
const ranks: ReadonlyArray<readonly [selector: string, rank: number]> = [
  ['.household-alert', 90],            // people cut off: the alarm
  ['.map-pin.community.is-priority', 85],
  ['.map-pin.hazard', 82],              // incident landslides outrank the closures they cause
  ['.road-closure-sign', 80],
  ['.map-pin.community', 76],
  ['.tracked-device', 70],
  ['.map-pin', 60],                    // staging, landing sites, other places
  ['.road-risk-sign', 50],
];
const selected = '.is-selected';
const candidates = ranks.map(([selector]) => selector).join(',');
/** Room kept between symbols, in screen pixels. */
const GAP = 2;

type Box = { left: number; top: number; right: number; bottom: number };
const boxOf = (element: Element): Box | null => {
  const rect = element.getBoundingClientRect();
  return rect.width && rect.height ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null;
};
const union = (boxes: Array<Box | null>): Box | null => {
  const present = boxes.filter((box): box is Box => !!box);
  return present.length ? { left: Math.min(...present.map(b => b.left)), top: Math.min(...present.map(b => b.top)),
    right: Math.max(...present.map(b => b.right)), bottom: Math.max(...present.map(b => b.bottom)) } : null;
};
const touches = (a: Box, b: Box) => a.left < b.right + GAP && b.left < a.right + GAP && a.top < b.bottom + GAP && b.top < a.bottom + GAP;

/** The drawn symbol, not its larger tap target. */
function symbolBox(element: HTMLElement): Box | null {
  if (element.matches('.household-alert')) return union([...element.querySelectorAll('.household-alert-disc, .household-alert-count')].filter(part => getComputedStyle(part).display !== 'none').map(boxOf));
  if (element.matches('.road-condition-sign')) { const svg = element.querySelector('svg'); return svg ? boxOf(svg) : null; }
  if (element.matches('.map-pin')) return boxOf(element.querySelector('.map-pin-shape') ?? element);
  if (element.matches('.tracked-device')) return boxOf(element.querySelector('.tracked-device-dot') ?? element);
  return boxOf(element);
}

export function declutterSymbols(host: HTMLElement): void {
  const items = [...host.querySelectorAll<HTMLElement>(candidates)].flatMap((element, order) => {
    element.classList.remove('is-decluttered');
    if (element.hidden || element.closest('[hidden]') || getComputedStyle(element).display === 'none' || getComputedStyle(element).visibility === 'hidden') return [];
    const box = symbolBox(element);
    if (!box) return [];
    const rank = element.matches(selected) ? 100 : ranks.find(([selector]) => element.matches(selector))![1];
    return [{ element, box, rank, order }];
  }).sort((a, b) => b.rank - a.rank || a.order - b.order);
  // Place pins resolve among themselves (groups with a count); here they only meet other layers.
  const placed: Array<{ box: Box; pin: boolean }> = [];
  for (const item of items) {
    const pin = item.element.matches('.map-pin');
    if (item.rank < 100 && placed.some(other => !(pin && other.pin) && touches(other.box, item.box))) item.element.classList.add('is-decluttered');
    else placed.push({ box: item.box, pin });
  }
}

/** Re-run after every view change and whenever a layer adds or removes symbols. */
export function keepSymbolsDecluttered(host: HTMLElement, map: { on: (types: string, fn: () => void) => unknown; off: (types: string, fn: () => void) => unknown }): () => void {
  let frame = 0;
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => declutterSymbols(host)); };
  map.on('zoomend moveend resize', schedule);
  const observer = new MutationObserver(schedule);
  observer.observe(host, { childList: true, subtree: true });
  // Tracked devices move between view changes.
  const timer = window.setInterval(schedule, 1000);
  schedule();
  return () => { cancelAnimationFrame(frame); map.off('zoomend moveend resize', schedule); observer.disconnect(); window.clearInterval(timer); };
}
