import { carbonIcons } from '../../shared/ui/carbonIconData';

const people = (() => {
  const icon = carbonIcons.people[16];
  return `<svg width="12" height="12" viewBox="${icon.viewBox}" fill="currentColor" aria-hidden="true">${icon.content.map(node =>
    `<${node.elem} ${Object.entries(node.attrs).map(([name, value]) => `${name}="${value}"`).join(' ')}/>`).join('')}</svg>`;
})();
const escape = (value: string) => value.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!);
/** Disc size in pixels; the count sits beside it. */
export const HOUSEHOLD_SYMBOL_PX = 22;
/**
 * One hut cluster on any map: a people disc in the colour of its status, a ring while cut off.
 * The head count stays off the map (the panel lists it) and shows on hover, focus or selection.
 * Clusters merged at a far zoom show how many they are in the disc, as map clusters do.
 */
export const householdSymbolHtml = (count: string, merged = 1) =>
  `<span class="household-alert-ring"></span><span class="household-alert-disc">${merged > 1 ? `<b>${merged}</b>` : people}</span><span class="household-alert-count">${escape(count)}</span>`;
