import type { Community, Hazard, Locale, ResponseSite } from '../types/dear';
import type { OverlayHit } from '../features/map/mapContracts';
import { mapSymbolSvg, type MapSymbolName } from './mapSymbols';
import { layoutMarkerGroups, overlaps, type ScreenRect } from './markerLayout';
import { markerPresentation } from './markerPresentation';

export type ScreenMarkerOptions = {
  communities: Community[]; hazards: Hazard[]; layers: Record<string, boolean>;
  responseSites?: ResponseSite[];
  selectedCommunityId: string | null; selectedObjectId: string | null; locale: Locale;
  onSelect: (hit: OverlayHit) => void;
  interactive?: boolean;
  allowCounts?: () => boolean;
  appearance?: import('../features/map/layerAppearance').LayerAppearance;
  onExpandGroup?: (points: Array<{ x: number; y: number }>) => void;
};
type Marker = {
  id: string; hit: OverlayHit; name: string; symbol: MapSymbolName;
  button: HTMLButtonElement; label: HTMLSpanElement | null; icon: HTMLElement;
  count: HTMLSpanElement; point: { x: number; y: number }; selected: boolean; priority: number; width: number;
};

/** Screen-sized, keyboard-accessible markers remain legible while the terrain zooms. */
type Projection = (point: { x: number; y: number }) => { x: number; y: number } | null;

export function createScreenMarkers(host: HTMLElement, options: ScreenMarkerOptions): { update: (project: Projection) => void; dispose: () => void } {
  const { communities, hazards, layers, locale } = options;
  const categoryNames: Record<MapSymbolName, [string, string]> = {
    community: ['thôn, bản', 'communities'], landslide: ['điểm sạt lở', 'landslide sites'],
    bridge: ['cầu', 'bridges'], crossing: ['điểm vượt khe', 'gully crossings'],
    flood: ['điểm ngập', 'flood sites'], staging: ['điểm tập kết', 'staging points'],
    hlz: ['vị trí hạ cánh', 'landing sites']
  };
  const layer = document.createElement('div');
  layer.className = 'map-marker-layer';
  layer.inert = options.interactive === false;
  layer.dataset.basemap = layers.imagery === false ? 'terrain' : 'imagery';
  host.appendChild(layer);
  const markers: Marker[] = [];
  let groups = new Map<string, Marker[]>();
  let chooser: HTMLDivElement | null = null;
  let chooserTrigger: HTMLButtonElement | null = null;
  let chooserKey = '';
  let chooserAnchor = { x: 0, y: 0 };
  const closeChooser = (restoreFocus = false): void => {
    chooser?.remove(); chooser = null; chooserKey = '';
    chooserTrigger?.setAttribute('aria-expanded', 'false');
    if (restoreFocus && !chooserTrigger?.hidden) chooserTrigger?.focus();
    chooserTrigger = null;
  };
  const openChooser = (marker: Marker, members: Marker[]): void => {
    if (chooserTrigger === marker.button) { closeChooser(true); return; }
    closeChooser();
    chooserTrigger = marker.button; chooserKey = members.map(m => m.id).sort().join(',');
    marker.button.setAttribute('aria-expanded', 'true');
    chooser = document.createElement('div');
    chooser.className = 'map-object-chooser'; chooser.setAttribute('role', 'group');
    chooser.setAttribute('aria-label', locale === 'vi' ? 'Chọn đối tượng' : 'Choose an object');
    const heading = document.createElement('div'); heading.className = 'map-object-chooser-heading';
    heading.textContent = locale === 'vi' ? 'Các điểm trong nhóm' : 'Points in this group';
    chooser.appendChild(heading);
    if (options.onExpandGroup && members.some(member => Math.hypot(member.point.x - members[0].point.x, member.point.y - members[0].point.y) > 1)) {
      const expand = document.createElement('button'); expand.type = 'button';
      expand.className = 'map-chooser-expand';
      expand.textContent = locale === 'vi' ? 'Xem khu vực này' : 'View this area';
      expand.onclick = () => { closeChooser(); options.onExpandGroup?.(members.map(member => member.point)); };
      chooser.appendChild(expand);
    }
    members.forEach(member => {
      const choice = document.createElement('button'); choice.type = 'button';
      const icon = document.createElement('span'); icon.innerHTML = mapSymbolSvg(member.symbol);
      const name = document.createElement('span'); name.textContent = member.name;
      choice.append(icon, name); choice.setAttribute('aria-pressed', String(member.selected));
      choice.addEventListener('click', event => { event.stopPropagation(); closeChooser(); options.onSelect(member.hit); });
      chooser!.appendChild(choice);
    });
    chooser.addEventListener('pointerdown', event => event.stopPropagation());
    layer.appendChild(chooser);
    const width = Math.min(280, host.clientWidth - 16);
    const height = Math.min(chooser.scrollHeight, host.clientHeight - 16);
    chooser.style.width = `${width}px`; chooser.style.maxHeight = `${height}px`;
    const r = marker.button.getBoundingClientRect(), area = host.getBoundingClientRect();
    const x = r.x - area.x, y = r.y - area.y;
    chooserAnchor = { x, y };
    const protectedRects = controlRects();
    const candidates = [{ x: x + r.width + 8, y }, { x: x - width - 8, y }, { x, y: y + r.height + 8 }, { x, y: y - height - 8 }];
    const inside = (p: { x: number; y: number }) => p.x >= 8 && p.y >= 8 && p.x + width <= host.clientWidth - 8 && p.y + height <= host.clientHeight - 8;
    const position = candidates.find(p => inside(p) && !protectedRects.some(rect => overlaps({ ...p, width, height }, rect))) ??
      { x: Math.max(8, Math.min(x, host.clientWidth - width - 8)), y: Math.max(8, Math.min(y + r.height + 8, host.clientHeight - height - 8)) };
    chooser.style.left = `${position.x}px`; chooser.style.top = `${position.y}px`;
    chooser.querySelector('button')?.focus();
  };
  const dismiss = (event: PointerEvent): void => {
    if (chooser && !chooser.contains(event.target as Node) && !chooserTrigger?.contains(event.target as Node)) closeChooser();
  };
  const escape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && chooser) { event.preventDefault(); event.stopPropagation(); closeChooser(true); }
  };
  const dismissFocus = (event: FocusEvent): void => {
    if (chooser && !chooser.contains(event.target as Node) && event.target !== chooserTrigger) closeChooser();
  };
  document.addEventListener('pointerdown', dismiss, true);
  document.addEventListener('keydown', escape);
  document.addEventListener('focusin', dismissFocus);
  const add = (hit: OverlayHit, pos: { x: number; y: number }, name: string, kind: string, symbol: MapSymbolName, selected: boolean, labelVisible: boolean): void => {
    const displayName = name;
    const button = document.createElement('button');
    button.className = `map-pin ${kind}${selected ? ' is-selected' : ''}`;
    button.type = 'button';
    button.title = displayName;
    button.setAttribute('aria-label', displayName);
    button.setAttribute('aria-pressed', String(selected));
    button.dataset.mapObject = `${hit.type}:${hit.id}`;
    const icon = document.createElement('span'); icon.className = 'map-pin-icon'; icon.innerHTML = mapSymbolSvg(symbol);
    const count = document.createElement('span'); count.className = 'map-pin-count'; count.hidden = true;
    button.append(icon, count);
    let label: HTMLSpanElement | null = null;
    if (labelVisible) { label = document.createElement('span'); label.className = 'map-pin-label'; label.textContent = displayName; button.appendChild(label); }
    button.addEventListener('click', event => {
      event.stopPropagation();
      const members = groups.get(button.dataset.mapObject!) ?? [];
      if (members.length > 1) openChooser(markers.find(m => m.button === button)!, members);
      else options.onSelect(hit);
    });
    button.addEventListener('pointerdown', event => event.stopPropagation());
    layer.appendChild(button);
    markers.push({ id: button.dataset.mapObject!, hit, name, symbol, button, label, icon, count, point: pos, selected, priority: selected ? 100 : kind.includes('is-priority') ? 50 : kind.startsWith('staging') ? 30 : 10, width: 0 });
  };
  if (layers.communities) communities.forEach(c => add({ type: 'community', id: c.id }, c.projected, c.name, `community${c.prio === 1 ? ' is-priority' : ''}`, 'community', c.id === options.selectedCommunityId, true));
  hazards.forEach(h => {
    const visible = h.kind === 'landslide' ? layers.landslide : h.kind === 'flood' ? layers.flood : layers.status;
    if (!visible) return;
    const name = locale === 'vi' ? h.name[0] : h.name[1];
    const selected = options.selectedObjectId === `hazard:${h.id}`;
    add({ type: 'hazard', id: h.id }, h.projected, name, `hazard ${h.kind}${h.observation === 'suspected' ? ' is-suspected' : ''}`, h.kind, selected, selected);
  });
  (options.responseSites ?? []).forEach(site => {
    if (!layers[site.kind]) return;
    add({ type: 'poi', id: site.id }, site.projected, locale === 'vi' ? site.name[0] : site.name[1],
      `${site.kind}${site.assessment === 'candidate' ? ' is-suspected' : site.assessment === 'unavailable' ? ' is-unavailable' : ''}`,
      site.kind, options.selectedObjectId === `poi:${site.id}`, true);
  });
  markers.sort((a, b) => b.priority - a.priority);
  // Measure the actual selected font, including Vietnamese diacritics.
  const measure = document.createElement('canvas').getContext('2d');
  const measureLabels = () => markers.forEach(marker => {
    if (!marker.label || !measure) return;
    const style = getComputedStyle(marker.label);
    measure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    marker.width = Math.ceil(measure.measureText(marker.label.textContent ?? '').width) + 8;
  });
  measureLabels();
  let disposed = false;
  let lastProjection: Projection | undefined;
  const onFontsLoaded = () => { if (!disposed) { measureLabels(); if (lastProjection) update(lastProjection); } };
  document.fonts.addEventListener('loadingdone', onFontsLoaded);
  void document.fonts.ready.then(onFontsLoaded);
  const controlRects = (): ScreenRect[] => {
    const hostRect = host.getBoundingClientRect();
    const workspace = host.closest('.map-area') ?? host.parentElement;
    return Array.from(workspace?.querySelectorAll<HTMLElement>('.map-tools,.map-toolbar,.map-search-results,.map-help [data-popover],.map-bottom-bar,.map-reference,.basemap-status,.layers-panel,.profile-panel,.map-attribution,.map-source-popover,.map-measure-panel,.map-location-panel,.map-measure-label,.map-panel-toggle,.revision-notice,.map-overview') ?? [])
      .filter(el => el.offsetHeight > 0).map(el => { const r = el.getBoundingClientRect(); return { x: r.x - hostRect.x, y: r.y - hostRect.y, width: r.width, height: r.height }; });
  };
  const update = (project: Projection): void => {
    lastProjection = project;
    const width = host.clientWidth, height = host.clientHeight;
    const controls = controlRects();
    const positions = markers.flatMap(marker => {
      const position = project(marker.point);
      marker.button.hidden = true;
      return position ? [{ id: marker.id, ...position, priority: marker.priority }] : [];
    });
    const layout = layoutMarkerGroups(positions, width, height, controls);
    groups = new Map(layout.map(group => [group.anchor.id, group.members.map(p => markers.find(m => m.id === p.id)!)]));
    if (chooserTrigger) {
      const members = groups.get(chooserTrigger.dataset.mapObject!) ?? [];
      const group = layout.find(g => g.anchor.id === chooserTrigger!.dataset.mapObject);
      if (!group || members.map(m => m.id).sort().join(',') !== chooserKey ||
          Math.hypot(group.rect.x - chooserAnchor.x, group.rect.y - chooserAnchor.y) > 1) closeChooser();
    }
    const occupied = [...controls, ...layout.map(group => group.rect)];
    if (chooser) { const area = host.getBoundingClientRect(), r = chooser.getBoundingClientRect(); occupied.push({ x: r.x - area.x, y: r.y - area.y, width: r.width, height: r.height }); }
    layout.forEach(group => {
      const marker = markers.find(m => m.id === group.anchor.id)!;
      const { x, y } = group.anchor, half = group.rect.width / 2;
      const clustered = group.members.length > 1;
      const members = [marker, ...groups.get(marker.id)!.filter(member => member !== marker)];
      const presentation = markerPresentation(members, options.allowCounts?.() ?? false);
      const display = marker;
      marker.button.hidden = false;
      marker.button.style.transform = `translate(${x - half}px,${y - half}px)`;
      marker.button.classList.toggle('is-cluster', presentation === 'cluster');
      marker.button.classList.toggle('is-overlap', presentation === 'overlap');
      marker.button.classList.toggle('has-overlap', presentation === 'feature-overlap');
      marker.button.classList.toggle('is-selected', marker.selected);
      marker.button.classList.toggle('has-critical', (presentation === 'overlap' || presentation === 'cluster') && members.some(member => member.priority >= 50 || (member.symbol === 'landslide' && !member.button.classList.contains('is-suspected'))));
      marker.button.setAttribute('aria-label', clustered ? (presentation === 'cluster'
        ? `${group.members.length} ${categoryNames[marker.symbol][locale === 'vi' ? 0 : 1]}`
        : `${display.name}. ${locale === 'vi' ? 'Mở danh sách điểm trong nhóm' : 'Browse points in this group'}`) : marker.name);
      marker.button.title = clustered ? group.members.map(p => markers.find(m => m.id === p.id)!.name).join(', ') : marker.name;
      if (clustered) { marker.button.setAttribute('aria-haspopup', 'true'); marker.button.setAttribute('aria-expanded', String(chooserTrigger === marker.button)); }
      else { marker.button.removeAttribute('aria-haspopup'); marker.button.removeAttribute('aria-expanded'); }
      const iconKey = presentation === 'overlap' ? 'overlap' : display.symbol;
      if (marker.icon.dataset.symbol !== iconKey) {
        marker.icon.dataset.symbol = iconKey;
        marker.icon.innerHTML = presentation === 'overlap'
          ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/></svg>'
          : mapSymbolSvg(display.symbol);
      }
      marker.icon.hidden = false; marker.count.hidden = presentation !== 'cluster';
      if (marker.count.textContent !== String(group.members.length)) marker.count.textContent = String(group.members.length);
      if (!marker.label || options.appearance?.labels === 'none' || (options.appearance?.labels === 'selected' && !marker.selected) || (clustered && presentation !== 'feature-overlap')) { marker.button.classList.add('is-label-hidden'); return; }
      const choices = [{ x: x + 22, y: y - 10 }, { x: x - marker.width - 22, y: y - 10 }, { x: x - marker.width / 2, y: y - 43 }, { x: x - marker.width / 2, y: y + 22 }];
      const place = choices.find(p => p.x >= 6 && p.y >= 6 && p.x + marker.width <= width - 6 && p.y + 22 <= height - 6 && !occupied.some(r => overlaps({ ...p, width: marker.width, height: 22 }, r)));
      marker.button.classList.toggle('is-label-hidden', !place);
      if (place) { marker.label.style.left = `${place.x - x + half}px`; marker.label.style.top = `${place.y - y + half}px`; occupied.push({ ...place, width: marker.width, height: 22 }); }
    });
  };
  return { update, dispose: () => {
    disposed = true; closeChooser(); document.fonts.removeEventListener('loadingdone', onFontsLoaded);
    document.removeEventListener('pointerdown', dismiss, true); document.removeEventListener('keydown', escape); document.removeEventListener('focusin', dismissFocus);
    layer.remove();
  } };
}
