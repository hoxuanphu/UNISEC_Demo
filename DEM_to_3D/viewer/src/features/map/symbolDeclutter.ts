/**
 * One draw order for every point symbol on the 2D and 3D maps, whichever layer draws it.
 * When two visible symbols touch, the lower rank yields and is hidden until the map
 * moves apart. The order answers a coordinator's questions in turn: who needs help, who
 * is helping, then why (landslides, closures), then places. Context loses nothing by
 * yielding: road lines keep their condition colour and landslide areas stay drawn.
 * Selected objects and your own position never yield.
 */
const ranks: ReadonlyArray<readonly [selector: string, rank: number]> = [
  ['.tracked-device.is-self', 100],     // you, on the resident's phone
  // Who needs help.
  ['.household-alert:is(.is-cut-off,.is-team)', 90],
  ['.tracked-device.is-stranded', 88],  // a resident held at a closure
  ['.field-map-marker.is-help', 86],    // a rescue request; the stranded dot it came from already says it
  ['.household-alert.is-unverified', 85],
  // Who is helping.
  ['.tracked-device.is-rescue', 84],
  // Why: what cuts the roads.
  ['.map-pin.hazard', 82],              // incident landslides outrank the closures they cause
  ['.road-closure-sign', 80],
  // Places and everything else.
  ['.map-pin.community.is-priority', 78],
  ['.map-pin.community', 76],
  ['.tracked-device', 70],              // residents moving freely
  ['.field-map-marker', 62],            // residents' other reports
  ['.map-pin', 60],                     // staging, landing sites, other places
  ['.household-alert', 55],             // already rescued: a record, yields to everything live
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
  if (element.matches('.field-map-marker')) return boxOf(element.querySelector('.field-map-symbol') ?? element);
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
  const placed: Array<{ box: Box; pin: boolean; element: HTMLElement }> = [];
  for (const item of items) {
    const pin = item.element.matches('.map-pin');
    if (item.rank < 100 && placed.some(other => !(pin && other.pin) && touches(other.box, item.box))) item.element.classList.add('is-decluttered');
    else placed.push({ box: item.box, pin, element: item.element });
  }
  // Labels yield before any symbol, as on web maps: a place name over another symbol is hidden.
  for (const entry of placed) {
    const label = entry.pin ? entry.element.querySelector('.map-pin-label') : null;
    entry.element.classList.remove('is-label-yielded');
    const box = label && getComputedStyle(label).display !== 'none' ? boxOf(label) : null;
    if (box && placed.some(other => other !== entry && touches(other.box, box))) entry.element.classList.add('is-label-yielded');
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
