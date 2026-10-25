import { hazardLayerVisible } from '../features/map/visibleMapRecords';
import { mapLayoutMutation } from '../features/map/mapLayoutMutation';
import type { Community, Hazard, Locale, ResponseSite } from '../types/dear';
import type { OverlayHit } from '../features/map/mapContracts';
import {poiFrameSvg,poiMetrics,markerSize} from './poiFrame';
import { mapSymbolSvg, type MapSymbolName } from './mapSymbols';
import { layoutMarkerGroups, layoutPlaceMarkers, markerPriority, overlaps, type ScreenRect } from './markerLayout';
import { markerPresentation } from './markerPresentation';
import type { RoadSegment } from '../types/dear';
import { roadCondition } from '../features/routes/roadConditions';
import { roadConditionSvg } from '../features/map/roadConditionSvg';
import { absorbedCondition, roadConditionSigns } from '../features/map/roadConditionSigns';

export type ScreenMarkerOptions = {
  communities: Community[]; hazards: Hazard[]; layers: Record<string, boolean>;
  responseSites?: ResponseSite[];
  roads?: RoadSegment[];
  /** Commune roads and extent links: their signs at a landslide merge into its pin. */
  contextRoads?: RoadSegment[];
  roadAreaLinks?: import('../features/route-film/localNetwork').LocalRoadAreaLink[];
  selectedCommunityId: string | null; selectedObjectId: string | null; locale: Locale;
  onSelect: (hit: OverlayHit) => void;
  interactive?: boolean;
  focusId?: string;
  allowCounts?: () => boolean;
  presentation?: 'groups' | 'places';
  routeStops?: Array<{x: number; y: number}>;
  routePlaces?: Array<{x: number; y: number}>;
  appearance?: import('../features/map/layerAppearance').LayerAppearance;
  onPreviewFocus?: (point:{x:number;y:number})=>void;
  onExpandGroup?: (points: Array<{ x: number; y: number }>) => void;
  canExpandGroup?: () => boolean;
};
type Marker = {
  id: string; hit: OverlayHit; name: string; symbol: MapSymbolName;
  button: HTMLButtonElement; label: HTMLSpanElement; icon: HTMLElement;
  count: HTMLSpanElement; point: { x: number; y: number }; selected: boolean; priority: number; width: number; labelEligible: boolean;
  condition?: 'blocked' | 'risk';
  /** Belongs to the commune scale (a secondary assembly point): left out of a wider view. */
  local?: boolean; routePlace?: boolean;
};

/** Screen-sized, keyboard-accessible markers remain legible while the terrain zooms. */
type Projection = (point: { x: number; y: number }) => { x: number; y: number } | null;

const collisionElements = '#response-details,.geodata-detail,.geodata-map-toolbar,.geodata-map-zoom,.geodata-basemap,.scenario-card,.map-tools,.map-toolbar,.map-advanced-tools,.map-search-results,.map-help [data-popover],.map-bottom-bar,.map-reference,.basemap-status,.layers-panel,.profile-panel,.map-attribution,.map-source-popover,.map-tool-panel,.road-journey-panel,.map-location-panel,.map-measure-label,.map-panel-toggle,.revision-notice,.map-overview,.leaflet-tooltip,.leaflet-popup,.field-map-card,.field-selected-pin,.map-selected-reference,.notice-toast,.citizen-map-tools,.citizen-map-layers,.citizen-area-info,.citizen-pick-hint,.citizen-map-summary,.citizen-map-context,.road-condition-sign,.household-alert-disc,.household-alert-count,.local-road-card,.tracked-device-card';

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
  layer.dataset.presentation = options.presentation ?? 'groups';
  layer.inert = options.interactive === false;
  layer.dataset.basemap = layers.imagery === false ? 'terrain' : 'imagery';
  host.appendChild(layer);
  const markers: Marker[] = [];
  let groups = new Map<string, Marker[]>();
  let chooser: HTMLDivElement | null = null;
  let chooserTrigger: HTMLButtonElement | null = null;
  let chooserKey = '';
  let chooserAnchor = { x: 0, y: 0 };
  const groupCanExpand = (members: Marker[]) => options.presentation !== 'places' && Boolean(options.onExpandGroup && options.canExpandGroup?.() !== false &&
    members.some(member => Math.hypot(member.point.x - members[0].point.x, member.point.y - members[0].point.y) > 1));
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
    chooser.className = 'map-object-chooser'; chooser.setAttribute('role', 'dialog');
    chooser.setAttribute('aria-modal', 'false');
    chooser.setAttribute('aria-label', locale === 'vi' ? 'Chọn đối tượng' : 'Choose an object');
    const heading = document.createElement('div'); heading.className = 'map-object-chooser-heading';
    const title = document.createElement('span');
    title.textContent = options.presentation === 'places' ? (locale === 'vi' ? 'Địa điểm tại đây' : 'Places here') : locale === 'vi' ? `${members.length} đối tượng tại đây` : `${members.length} features here`;
    const close = document.createElement('button'); close.type = 'button'; close.className = 'map-chooser-close';
    close.setAttribute('aria-label', locale === 'vi' ? 'Đóng danh sách điểm' : 'Close point list');
    close.textContent = '×'; close.onclick = event => { event.stopPropagation(); closeChooser(true); };
    heading.append(title, close);
    chooser.appendChild(heading);
    members.forEach(member => {
      const choice = document.createElement('button'); choice.type = 'button';
      choice.className = 'map-object-choice';
      const icon = document.createElement('span'); icon.innerHTML = member.condition ? roadConditionSvg(member.condition) : mapSymbolSvg(member.symbol);
      icon.style.color = getComputedStyle(member.button).getPropertyValue('--pin');
      icon.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span'); name.textContent = member.name;
      choice.append(icon, name); choice.setAttribute('aria-pressed', String(member.selected));
      choice.addEventListener('click', event => { event.stopPropagation(); closeChooser(); options.onSelect(member.hit); });
      chooser!.appendChild(choice);
    });
    for (const type of ['pointerdown', 'mousedown', 'touchstart', 'mousemove', 'dblclick', 'wheel'])
      chooser.addEventListener(type, event => event.stopPropagation());
    const width = Math.min(280, host.clientWidth - 16);
    chooser.style.width = `${width}px`;
    // On phones a place picker belongs above the route sheet, not inside the
    // lower map stacking context where the sheet can intercept its buttons.
    (options.presentation === 'places' ? host.closest('.citizen-map') ?? layer : layer).appendChild(chooser);
    const height = Math.min(chooser.scrollHeight, 300, host.clientHeight - 16);
    chooser.style.maxHeight = `${height}px`;
    const r = marker.button.getBoundingClientRect(), area = host.getBoundingClientRect();
    const x = r.x - area.x, y = r.y - area.y;
    chooserAnchor = {x:x+r.width/2,y:y+poiMetrics(r.width,marker.selected).tip};
    const protectedRects = controlRects().controls;
    const candidates = [{ x: x + r.width + 8, y }, { x: x - width - 8, y }, { x, y: y + r.height + 8 }, { x, y: y - height - 8 }];
    const inside = (p: { x: number; y: number }) => p.x >= 8 && p.y >= 8 && p.x + width <= host.clientWidth - 8 && p.y + height <= host.clientHeight - 8;
    const position = candidates.find(p => inside(p) && !protectedRects.some(rect => overlaps({ ...p, width, height }, rect))) ??
      { x: Math.max(8, Math.min(x, host.clientWidth - width - 8)), y: Math.max(8, Math.min(y + r.height + 8, host.clientHeight - height - 8)) };
    chooser.style.left = `${position.x}px`; chooser.style.top = `${position.y}px`;
    chooser.querySelector<HTMLButtonElement>('.map-object-choice')?.focus();
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
    if (hit.type !== 'hazard' && options.routeStops?.some(stop => Math.hypot(stop.x-pos.x, stop.y-pos.y) < 2)) return;
    const routePlace = hit.type !== 'hazard' && options.routePlaces?.some(stop=>Math.hypot(stop.x-pos.x,stop.y-pos.y)<2);
    const displayName = name;
    const button = document.createElement('button');
    button.className = `map-pin ${kind}${selected ? ' is-selected' : ''}`;
    button.type = 'button';
    button.hidden = true;
    button.setAttribute('aria-label', displayName);
    button.setAttribute('aria-pressed', String(selected));
    button.dataset.mapObject = `${hit.type}:${hit.id}`;
    const icon = document.createElement('span'); icon.className = 'map-pin-icon'; icon.innerHTML = mapSymbolSvg(symbol);
    const count = document.createElement('span'); count.className = 'map-pin-count'; count.hidden = true;
    const frame=document.createElement('span');frame.className='map-pin-shape';frame.innerHTML=poiFrameSvg(selected);
    button.append(frame,icon,count);
    const label = document.createElement('span'); label.className = 'map-pin-label'; label.textContent = displayName; button.appendChild(label);
    button.addEventListener('click', event => {
      event.stopPropagation();
      const members = groups.get(button.dataset.mapObject!) ?? [];
      if(event.target instanceof Element && event.target.closest('.map-pin-label')) options.onSelect(hit);
      else if (members.length > 1) {
        if (groupCanExpand(members)) {
          closeChooser(); options.onExpandGroup?.(members.map(member => member.point));
        } else openChooser(markers.find(m => m.button === button)!, members);
      }
      else options.onSelect(hit);
    });
    for (const type of ['pointerdown', 'mousedown', 'touchstart', 'dblclick'])
      button.addEventListener(type, event => event.stopPropagation());
    layer.appendChild(button);
    const priority = markerPriority({ selected, hazard: hit.type === 'hazard', suspected: kind.includes('is-suspected'),
      priorityCommunity: kind.includes('is-priority'), staging: kind.startsWith('staging') });
    markers.push({ id: button.dataset.mapObject!, hit, name, symbol, button, label, icon, count, point: pos, selected, routePlace, priority, width: 0, labelEligible: labelVisible });
  };
  // One selected pin: an inspected point replaces the open community's pin; a road selection keeps it.
  const selectedPin = /^(community|hazard|poi):/.test(options.selectedObjectId ?? '') ? options.selectedObjectId
    : options.selectedCommunityId ? `community:${options.selectedCommunityId}` : null;
  if (layers.communities) communities.forEach(c => add({ type: 'community', id: c.id }, c.projected, c.name, `community${c.prio === 1 ? ' is-priority' : ''}`, 'community', selectedPin === `community:${c.id}`, c.labelMode !== 'hide'));
  // Every road sign the map would draw, so a landslide pin can stand in for those at its site.
  const signs = layers.status && layers.roads ? roadConditionSigns([...(options.roads ?? []), ...(layers.localRoads === false ? [] : options.contextRoads ?? [])], options.roadAreaLinks) : [];
  hazards.forEach(h => {
    const visible = hazardLayerVisible(h, layers);
    if (!visible) return;
    const name = locale === 'vi' ? h.name[0] : h.name[1];
    const selected = selectedPin === `hazard:${h.id}`;
    add({ type: 'hazard', id: h.id }, h.projected, name, `hazard ${h.kind}${h.observation === 'suspected' ? ' is-suspected' : ''}`, h.kind, selected, h.labelMode === 'show' || (h.labelMode !== 'hide' && selected));
    const linked = layers.status ? options.roads?.filter(road => road.hazardIds?.includes(h.id)).map(roadCondition) ?? [] : [];
    const nearby = absorbedCondition(signs, h.projected);
    const condition = linked.includes('blocked') || nearby === 'blocked' ? 'blocked' : linked.includes('risk') || nearby === 'risk' ? 'risk' : undefined;
    if (condition) {
      const marker = markers.at(-1)!;
      marker.condition = condition;
      marker.button.classList.add('has-road-condition');
      marker.button.dataset.roadCondition = condition;
    }
  });
  const primaryStaging = options.responseSites?.find(site => site.kind === 'staging')?.id;
  (options.responseSites ?? []).forEach(site => {
    if (!layers[site.kind]) return;
    add({ type: 'poi', id: site.id }, site.projected, locale === 'vi' ? site.name[0] : site.name[1],
      `${site.kind}${site.assessment === 'candidate' ? ' is-suspected' : site.assessment === 'unavailable' ? ' is-unavailable' : ''}`,
      site.kind, selectedPin === `poi:${site.id}`, site.labelMode !== 'hide');
    if (site.kind === 'staging' && site.id !== primaryStaging) markers.at(-1)!.local = true;
  });
  markers.sort((a, b) => b.priority - a.priority);
  const markerById = new Map(markers.map(marker => [marker.id, marker]));
  const preview=document.createElement('div');preview.className='map-hover-target';preview.hidden=true;preview.setAttribute('aria-hidden','true');layer.append(preview);
  let previewPoint:{x:number;y:number}|null=null;
  let previewId:string|null=null;
  const previewEvent=(event:Event)=>{const d=(event as CustomEvent).detail;if(!d?.scope?.contains(host))return;previewId=d.id??null;previewPoint=d.id&&d.point?d.point:null;if(d.focus&&previewPoint)options.onPreviewFocus?.(previewPoint);if(lastProjection)update(lastProjection);};
  document.addEventListener('dear:map-preview',previewEvent);
  // Measure the actual selected font, including Vietnamese diacritics.
  const measure = document.createElement('canvas').getContext('2d');
  const measureLabels = () => markers.forEach(marker => {
    if (!measure) return;
    const style = getComputedStyle(marker.label);
    measure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    marker.width = Math.ceil(measure.measureText(marker.label.textContent ?? '').width) + 8;
  });
  measureLabels();
  let disposed = false;
  let pendingFocusId = options.focusId;
  let lastProjection: Projection | undefined;
  const onFontsLoaded = () => { if (!disposed) { measureLabels(); if (lastProjection) update(lastProjection); } };
  document.fonts.addEventListener('loadingdone', onFontsLoaded);
  void document.fonts.ready.then(onFontsLoaded);
  const controlRects = (): { controls: ScreenRect[]; labels: ScreenRect[] } => {
    const hostRect = host.getBoundingClientRect();
    const workspace = host.closest('.geodata-workspace, .workspace') ?? host.closest('.map-area') ?? host.parentElement;
    const entries = Array.from(workspace?.querySelectorAll<HTMLElement>(collisionElements) ?? [])
      .filter(el => !el.querySelector('.landslide-map-label')).flatMap(el => {
        // The sign's hit target is larger than its visible symbol.
        const obstacle = el.matches('.road-condition-sign') ? el.querySelector('svg') ?? el : el;
        const r = obstacle.getBoundingClientRect();
        return r.height > 0 ? [{ tooltip: el.classList.contains('leaflet-tooltip') || Boolean(el.closest('.road-condition-sign, .household-alert')), rect: { x: r.x - hostRect.x, y: r.y - hostRect.y, width: r.width, height: r.height } }] : [];
      });
    // Map signs and hover tooltips constrain labels, never hide geographic
    // features or the selected pin as if they were toolbar controls.
    return { controls: entries.filter(item => !item.tooltip).map(item => item.rect), labels: entries.filter(item => item.tooltip).map(item => item.rect) };
  };
  const update = (project: Projection): void => {
    lastProjection = project;
    const width = host.clientWidth, height = host.clientHeight;
    const { controls, labels: externalLabels } = controlRects();
    // Commune assembly points read at commune scale only: drawn once a kilometre spans 80 px.
    const scaleAt = markers[0] && project(markers[0].point), scaleTo = markers[0] && project({ x: markers[0].point.x + 1000, y: markers[0].point.y });
    const communeScale = !scaleAt || !scaleTo || Math.hypot(scaleTo.x - scaleAt.x, scaleTo.y - scaleAt.y) >= 80;
    let positions = markers.flatMap(marker => {
      if (marker.local && !marker.selected && !marker.routePlace && !communeScale) return [];
      const position = project(marker.point);
      return position ? [{ id: marker.id, ...position, priority: marker.priority, selected: marker.selected || Boolean(marker.routePlace), category: marker.symbol,
        featured: marker.hit.type === 'hazard' && marker.labelEligible }] : [];
    });
    const stopRects = Array.from(host.querySelectorAll<HTMLElement>('.resident-route-pins > button')).map(pin => {
      const rect = pin.getBoundingClientRect(), hostRect = host.getBoundingClientRect();
      return {x: rect.x-hostRect.x, y: rect.y-hostRect.y, width: rect.width, height: rect.height};
    });
    controls.push(...stopRects);
    if (options.presentation === 'places') {
      const hostRect = host.getBoundingClientRect();
      const closures: ScreenRect[] = [];
      for (const symbol of host.querySelectorAll('.road-condition-sign svg')) {
        const rect = symbol.getBoundingClientRect();
        closures.push({ x: rect.x-hostRect.x, y: rect.y-hostRect.y, width: rect.width, height: rect.height });
      }
      // Village symbols and their overlap picker stay available. A secondary
      // landing-site symbol yields to a nearby closure until the map is zoomed in.
      positions = positions.filter(point => point.category !== 'hlz' || point.selected ||
        !closures.some(rect => overlaps({ x: point.x-14, y: point.y-14, width: 28, height: 28 }, rect, 3)));
      externalLabels.push(...closures);
    }
    const layout = (options.presentation === 'places' ? layoutPlaceMarkers : layoutMarkerGroups)(positions, width, height, controls);
    const pp=previewPoint?project(previewPoint):null;
    const previewGroup=previewId?layout.find(group=>group.members.some(member=>member.id===previewId)):null;
    const hidePreview=!!previewGroup||!pp||pp.x<12||pp.y<12||pp.x>width-12||pp.y>height-12||controls.some(r=>overlaps({x:pp.x-5,y:pp.y-5,width:10,height:10},r,0));
    if(preview.hidden!==hidePreview)preview.hidden=hidePreview;
    if(pp){const left=pp.x+'px',top=pp.y+'px';if(preview.style.left!==left)preview.style.left=left;if(preview.style.top!==top)preview.style.top=top;}
    const visible = new Set(layout.map(group => group.anchor.id));
    for (const marker of markers) {
      const hidden = !visible.has(marker.id);
      if (marker.button.hidden !== hidden) marker.button.hidden = hidden;
    }
    groups = new Map(layout.map(group => [group.anchor.id, group.members.map(p => markerById.get(p.id)!)]));
    if (chooserTrigger) {
      const members = groups.get(chooserTrigger.dataset.mapObject!) ?? [];
      const group = layout.find(g => g.anchor.id === chooserTrigger!.dataset.mapObject);
      if (!group || members.map(m => m.id).sort().join(',') !== chooserKey ||
          Math.hypot(group.anchor.x - chooserAnchor.x, group.anchor.y - chooserAnchor.y) > 1) closeChooser();
    }
    if (pendingFocusId) {
      const retained = layout.find(group => group.members.some(member => member.id === pendingFocusId));
      // Rebuilding symbols after selection must not drop focus or move focus from a form.
      if (retained && document.activeElement === document.body)
        markerById.get(retained.anchor.id)?.button.focus({ preventScroll: true });
      pendingFocusId = undefined;
    }
    const occupied = [...controls, ...externalLabels, ...layout.map(group => group.rect)];
    if (chooser) { const area = host.getBoundingClientRect(), r = chooser.getBoundingClientRect(); occupied.push({ x: r.x - area.x, y: r.y - area.y, width: r.width, height: r.height }); }
    layout.forEach(group => {
      const marker = markerById.get(group.anchor.id)!;
      const { x, y } = group.anchor;
      const clustered = group.members.length > 1;
      const members = [marker, ...groups.get(marker.id)!.filter(member => member !== marker)];
      const presentation = options.presentation === 'places' ? 'single' : markerPresentation(members, options.allowCounts?.() ?? false);
      const {half,tip}=poiMetrics(markerSize(options.presentation !== 'places' && clustered,marker.selected),marker.selected);
      const display = marker;
      const transform = `translate(${x - half}px,${y - tip}px)`;
      if (marker.button.style.transform !== transform) marker.button.style.transform = transform;
      const hoverLeft = `${x + 31 + marker.width < width - 8 ? 31 : -marker.width - 3}px`;
      const hoverTop = `${y - tip + 4 < 8 ? tip + 6 : 4}px`;
      if (marker.button.style.getPropertyValue('--hover-label-left') !== hoverLeft) marker.button.style.setProperty('--hover-label-left', hoverLeft);
      if (marker.button.style.getPropertyValue('--hover-label-top') !== hoverTop) marker.button.style.setProperty('--hover-label-top', hoverTop);
      marker.button.classList.toggle('is-cluster', presentation === 'cluster');
      marker.button.classList.toggle('has-overlap', presentation === 'feature-overlap');
      marker.button.classList.toggle('is-selected', marker.selected);
      // A mixed group whose anchor outranks a reported hazard still signals that hazard.
      const hiddenHazard = presentation === 'feature-overlap' &&
        members.slice(1).some(member => member.hit.type === 'hazard' && !member.button.classList.contains('is-suspected'));
      marker.button.classList.toggle('has-hazard', hiddenHazard);
      const accessibleName = clustered ? (presentation === 'cluster'
        ? `${group.members.length} ${categoryNames[marker.symbol][locale === 'vi' ? 0 : 1]}`
        : `${display.name}. ${hiddenHazard ? (locale === 'vi' ? 'Có điểm nguy hiểm đã báo cáo trong nhóm. ' : 'Includes a reported hazard. ') : ''}${groupCanExpand(members) ? (locale === 'vi' ? 'Phóng để tách điểm' : 'Zoom to separate points') : (locale === 'vi' ? 'Chọn đối tượng tại đây' : 'Choose a feature here')}`) : marker.name;
      if (marker.button.getAttribute('aria-label') !== accessibleName) marker.button.setAttribute('aria-label', accessibleName);
      const description = clustered ? group.members.map(p => markerById.get(p.id)!.name).join(', ') : marker.name;
      if (marker.button.getAttribute('aria-description') !== description) marker.button.setAttribute('aria-description', description);
      marker.button.classList.toggle('is-preview', previewGroup?.anchor.id === marker.id);
      const groupAction = clustered ? (groupCanExpand(members) ? 'zoom' : 'choose') : 'select';
      if (marker.button.dataset.groupAction !== groupAction) marker.button.dataset.groupAction = groupAction;
      if (clustered && !groupCanExpand(members)) {
        if (marker.button.getAttribute('aria-haspopup') !== 'dialog') marker.button.setAttribute('aria-haspopup', 'dialog');
        const expanded = String(chooserTrigger === marker.button);
        if (marker.button.getAttribute('aria-expanded') !== expanded) marker.button.setAttribute('aria-expanded', expanded);
      }
      else { marker.button.removeAttribute('aria-haspopup'); marker.button.removeAttribute('aria-expanded'); }
      const iconKey = display.condition ?? display.symbol;
      if (marker.icon.dataset.symbol !== iconKey) {
        marker.icon.dataset.symbol = iconKey;
        marker.icon.innerHTML = display.condition ? roadConditionSvg(display.condition) : mapSymbolSvg(display.symbol);
      }
      if (marker.icon.hidden) marker.icon.hidden = false;
      if (marker.count.hidden !== (presentation !== 'cluster')) marker.count.hidden = presentation !== 'cluster';
      if (marker.count.textContent !== String(group.members.length)) marker.count.textContent = String(group.members.length);
      if (!marker.labelEligible || options.appearance?.labels === 'none' || (options.appearance?.labels === 'selected' && !marker.selected) || (options.presentation !== 'places' && clustered && presentation !== 'feature-overlap')) { if (!marker.button.classList.contains('is-label-hidden')) marker.button.classList.add('is-label-hidden'); return; }
      const choices = [{ x: x + half + 4, y: y - tip + 4 }, { x: x - marker.width - half - 4, y: y - tip + 4 }, { x: x - marker.width / 2, y: y - tip - 26 }, { x: x - marker.width / 2, y: y + 8 }];
      const place = choices.find(p => p.x >= 6 && p.y >= 6 && p.x + marker.width <= width - 6 && p.y + 22 <= height - 6 && !occupied.some(r => overlaps({ ...p, width: marker.width, height: 22 }, r)));
      marker.button.classList.toggle('is-label-hidden', !place);
      if (place) {
        // .map-pin has no border. Avoid a layout read after moving each pin.
        const left = `${place.x - x + half}px`, top = `${place.y - y + tip}px`;
        if (marker.label.style.left !== left) marker.label.style.left = left;
        if (marker.label.style.top !== top) marker.label.style.top = top;
        occupied.push({ ...place, width: marker.width, height: 22 });
      }
    });
  };
  // Reference/photo layers have their own DOM. Relayout when their selected label or
  // popup changes, so collision avoidance also covers those layers, not just our symbols.
  let relayoutFrame = 0;
  const externalChanges = new MutationObserver(changes => {
    const relevant = changes.some(change => {
      if (change.target === layer || layer.contains(change.target)) return false;
      return mapLayoutMutation(change, host, collisionElements);
    });
    // Moving device dots and loading image tiles do not change label obstacles.
    if (!relevant) return;
    if (!relayoutFrame) relayoutFrame = requestAnimationFrame(() => {
      relayoutFrame = 0;
      if (!disposed && lastProjection) update(lastProjection);
    });
  });
  externalChanges.observe(host.closest('.geodata-workspace, .workspace') ?? host.closest('.map-area') ?? host.parentElement ?? host, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
  return { update, dispose: () => {
    document.removeEventListener('dear:map-preview',previewEvent);
    externalChanges.disconnect(); cancelAnimationFrame(relayoutFrame);
    disposed = true; closeChooser(); document.fonts.removeEventListener('loadingdone', onFontsLoaded);
    document.removeEventListener('pointerdown', dismiss, true); document.removeEventListener('keydown', escape); document.removeEventListener('focusin', dismissFocus);
    layer.remove();
  } };
}
