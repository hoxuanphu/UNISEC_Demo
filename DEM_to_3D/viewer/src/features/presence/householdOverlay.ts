import type { Locale } from '../../types/dear';
import { householdGroups } from './householdGroups';
import { householdStatusOrder, householdStatusText, type HouseholdView } from './householdStatus';
import { HOUSEHOLD_SYMBOL_PX, householdSymbolHtml } from './householdSymbol';
import './isolated-households.css';

type Point = { x: number; y: number };
type Screen = { x: number; y: number; visible: boolean } | null;

/**
 * The hut clusters on a screen-space map (the 3D view): the same symbols, merging and
 * statuses as the 2D map, placed by `project` after every camera change.
 */
export function createHouseholdOverlay(host: HTMLElement, project: (point: Point) => Screen, onSelect?: (id: string) => void) {
  const layer = document.createElement('div');
  layer.className = 'household-overlay';
  host.append(layer);
  let households: HouseholdView[] = [], selectedId: string | null = null, locale: Locale = 'vi';
  const buttons = new Map<string, HTMLButtonElement>();
  const update = () => {
    const vi = locale !== 'en';
    const shown = households.flatMap(item => {
      if (item.status === 'clear') return [];
      const at = project(item.projected);
      return at?.visible && at.x >= 0 && at.y >= 0 && at.x <= host.clientWidth && at.y <= host.clientHeight ? [{ item, at }] : [];
    });
    const groups = householdGroups(shown.map(({ item, at }) => ({ id: item.cluster.id, x: at.x, y: at.y })), selectedId);
    const children = groups.map(group => {
      const members = shown.filter(entry => group.members.includes(entry.item.cluster.id));
      const status = householdStatusOrder.find(value => members.some(entry => entry.item.status === value))!;
      // A merged disc counts the people still waiting; the rescued count only when nobody else is there.
      const waiting = members.filter(entry => entry.item.status !== 'rescued');
      const people = (waiting.length ? waiting : members).reduce((sum, entry) => sum + entry.item.cluster.people, 0);
      const count = vi ? `${people} người` : `${people} ${people === 1 ? 'person' : 'people'}`;
      const leader = members.find(entry => entry.item.cluster.id === group.id)!;
      const button = buttons.get(group.id) ?? document.createElement('button');
      buttons.set(group.id, button);
      button.type = 'button';
      button.className = `household-alert is-${status}${members.length > 1 ? ' household-aggregate' : ''}${group.id === selectedId ? ' is-selected' : ''}`;
      const html = householdSymbolHtml(count, members.length);
      if (button.dataset.symbol !== html) { button.innerHTML = html; button.dataset.symbol = html; }
      button.style.transform = `translate(${Math.round(group.x - HOUSEHOLD_SYMBOL_PX / 2)}px,${Math.round(group.y - HOUSEHOLD_SYMBOL_PX / 2)}px)`;
      button.setAttribute('aria-label', members.length > 1 ? `${members.length} ${vi ? 'cụm hộ' : 'household groups'}, ${count}`
        : `${leader.item.cluster.name[vi ? 0 : 1]}, ${count}, ${householdStatusText[status][vi ? 0 : 1].toLocaleLowerCase(vi ? 'vi' : 'en')}`);
      button.onclick = event => { event.stopPropagation(); onSelect?.(group.id); };
      return button;
    });
    // Keep nodes stable during camera motion: replacing them would trigger the viewer's
    // layout observer again, keeping an otherwise idle 3D map rendering continuously.
    if (children.length !== layer.children.length || children.some((node, i) => layer.children[i] !== node)) layer.replaceChildren(...children);
    const active = new Set(groups.map(group => group.id));
    for (const id of buttons.keys()) if (!active.has(id)) buttons.delete(id);
  };
  return {
    set(next: HouseholdView[], selected: string | null, nextLocale: Locale) { households = next; selectedId = selected; locale = nextLocale; update(); },
    update,
    dispose: () => layer.remove(),
  };
}
