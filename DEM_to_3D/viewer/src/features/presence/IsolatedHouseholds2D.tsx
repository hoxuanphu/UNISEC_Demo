import { useEffect, type MutableRefObject } from 'react';
import * as L from 'leaflet';
import type { Locale } from '../../types/dear';
import type { TerrainMetadata } from '../../types/terrain';
import { projectedToWgs84 } from '../../terrain/coordinate';
import { carbonIcons } from '../../shared/ui/carbonIconData';
import { mapPane } from '../map/mapLayerOrder';
import type { HouseholdAccess } from './householdIsolation';
import { householdGroups } from './householdGroups';
import './isolated-households.css';

const people = (() => {
  const icon = carbonIcons.people[16];
  return `<svg width="12" height="12" viewBox="${icon.viewBox}" fill="currentColor" aria-hidden="true">${icon.content.map(node =>
    `<${node.elem} ${Object.entries(node.attrs).map(([name, value]) => `${name}="${value}"`).join(' ')}/>`).join('')}</svg>`;
})();
/** A small red disc with a people glyph and one slow ring: urgent, without crowding the map. */
const SIZE = 22;
const html = (count: string) => `<span class="household-alert-ring"></span><span class="household-alert-disc">${people}</span><span class="household-alert-count">${escape(count)}</span>`;
const escape = (value: string) => value.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!);
/**
 * People the resident app still places at isolated field huts: a small red disc with
 * a people glyph and a slow ring, the head count beside it. Zoomed out until discs
 * would touch, they merge into one total. The selected cluster also shows its
 * point and the slides the residents reported.
 */
export function IsolatedHouseholds2D({ mapRef, metadata, households, selectedId, locale, onSelect, attended = '' }: {
  mapRef: MutableRefObject<L.Map | null>;
  metadata?: TerrainMetadata;
  households: HouseholdAccess[];
  selectedId?: string | null;
  locale: Locale;
  onSelect?: (id: string) => void;
  /** Comma-separated cluster IDs a rescue team has reached: the alarm calms and shows the team. */
  attended?: string;
}) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !metadata) return;
    const at = (point: { x: number; y: number }) => {
      const p = projectedToWgs84(metadata, point);
      return p.latitude === undefined || p.longitude === undefined ? null : L.latLng(p.latitude, p.longitude);
    };
    const group = L.layerGroup().addTo(map);
    const vi = locale !== 'en';
    const isolated = households.flatMap(item => { const point = item.isolated ? at(item.projected) : null; return point ? [{ item, point }] : []; });
    let popup: L.Popup | null = null;
    const render = () => {
      group.clearLayers();
      const groups = householdGroups(isolated.map(({ item, point }) => ({ id: item.cluster.id, ...map.latLngToContainerPoint(point) })), selectedId);
      for (const symbol of groups) {
        const members = isolated.filter(entry => symbol.members.includes(entry.item.cluster.id));
        const { item, point } = members.find(entry => entry.item.cluster.id === symbol.id)!;
        const people = members.reduce((sum, entry) => sum + entry.item.cluster.people, 0);
        const multiple = members.length > 1;
        const selected = item.cluster.id === selectedId;
        if (selected) {
          for (const cut of item.cutBy) {
            const place = cut.kind === 'report' ? at(cut.point) : null;
            if (place) L.marker(place, { pane: mapPane('selection'), interactive: false, keyboard: false, icon: L.divIcon({
              className: 'household-reported-cut', iconSize: [22, 22], iconAnchor: [11, 11], html: '<span></span>' }) }).addTo(group);
          }
        }
        const name = item.cluster.name[vi ? 0 : 1];
        const count = vi ? `${people} người` : `${people} ${people === 1 ? 'person' : 'people'}`;
        const label = multiple ? `${members.length} ${vi ? 'cụm hộ' : 'household groups'}, ${count}` : `${name}, ${count}, ${vi ? 'bị cô lập' : 'cut off'}`;
        const marker = L.marker(point, { pane: mapPane('selection'), keyboard: true, title: label, bubblingMouseEvents: false, zIndexOffset: selected ? 2000 : 1000,
          icon: L.divIcon({ className: `household-alert${multiple ? ' household-aggregate' : ''}${selected ? ' is-selected' : ''}${members.every(entry => attended.split(',').includes(entry.item.cluster.id)) ? ' is-attended' : ''}`, iconSize: [SIZE, SIZE], iconAnchor: [SIZE / 2, SIZE / 2], html: html(count) }) })
          .on('click', () => {
            if (!multiple) { onSelect?.(item.cluster.id); return; }
            if (map.getZoom() < Math.min(map.getMaxZoom(), 18)) {
              map.flyToBounds(L.latLngBounds(members.map(entry => entry.point)), { padding: [80, 80], maxZoom: 18, duration: .5, animate: !matchMedia('(prefers-reduced-motion: reduce)').matches });
              return;
            }
            const list = document.createElement('div'); list.className = 'household-group-list';
            for (const member of members) {
              const button = document.createElement('button'); button.type = 'button';
              button.textContent = `${member.item.cluster.name[vi ? 0 : 1]} · ${member.item.cluster.people} ${vi ? 'người' : 'people'}`;
              button.onclick = () => { popup?.remove(); onSelect?.(member.item.cluster.id); };
              list.append(button);
            }
            popup?.remove(); popup = L.popup({ maxWidth: 280 }).setLatLng(point).setContent(list).openOn(map);
          }).addTo(group);
        marker.getElement()?.setAttribute('aria-label', label);
        if (!multiple) marker.getElement()?.setAttribute('data-household', item.cluster.id);
        marker.getElement()?.setAttribute('data-household-members', JSON.stringify(symbol.members));
      }
    };
    render(); map.on('zoomend resize', render);
    return () => { map.off('zoomend resize', render); popup?.remove(); group.remove(); };
  }, [mapRef, metadata, households, selectedId, locale, onSelect, attended]);
  return null;
}
