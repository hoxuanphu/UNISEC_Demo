import { useEffect, type MutableRefObject } from 'react';
import * as L from 'leaflet';
import type { Locale } from '../../types/dear';
import type { TerrainMetadata } from '../../types/terrain';
import { projectedToWgs84 } from '../../terrain/coordinate';
import { mapPane } from '../map/mapLayerOrder';
import { householdGroups } from './householdGroups';
import { householdStatusOrder, householdStatusText, type HouseholdView } from './householdStatus';
import { HOUSEHOLD_SYMBOL_PX as SIZE, householdSymbolHtml as html } from './householdSymbol';
import './isolated-households.css';

/**
 * People the resident app places at field huts who need a responder, the head count beside
 * each disc: red with a slow ring when cut off, amber when nothing shows whether they can
 * leave, red with a team badge once a team is assigned, grey once rescued. Zoomed out until
 * discs would touch, they merge into one total in the most urgent colour. The selected
 * cluster also shows the slides the residents reported.
 */
export function IsolatedHouseholds2D({ mapRef, metadata, households, selectedId, locale, onSelect }: {
  mapRef: MutableRefObject<L.Map | null>;
  metadata?: TerrainMetadata;
  households: HouseholdView[];
  selectedId?: string | null;
  locale: Locale;
  onSelect?: (id: string) => void;
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
    const isolated = households.flatMap(item => { const point = item.status !== 'clear' ? at(item.projected) : null; return point ? [{ item, point }] : []; });
    let popup: L.Popup | null = null;
    const render = () => {
      group.clearLayers();
      const groups = householdGroups(isolated.map(({ item, point }) => ({ id: item.cluster.id, ...map.latLngToContainerPoint(point) })), selectedId);
      for (const symbol of groups) {
        const members = isolated.filter(entry => symbol.members.includes(entry.item.cluster.id));
        const { item, point } = members.find(entry => entry.item.cluster.id === symbol.id)!;
        // A merged disc counts the people still waiting; the rescued count only when nobody else is there.
        const waiting = members.filter(entry => entry.item.status !== 'rescued');
        const people = (waiting.length ? waiting : members).reduce((sum, entry) => sum + entry.item.cluster.people, 0);
        const multiple = members.length > 1;
        const selected = item.cluster.id === selectedId;
        const status = householdStatusOrder.find(value => members.some(entry => entry.item.status === value))!;
        if (selected) {
          for (const cut of item.cutBy) {
            const place = cut.kind === 'report' ? at(cut.point) : null;
            if (place) L.marker(place, { pane: mapPane('selection'), interactive: false, keyboard: false, icon: L.divIcon({
              className: 'household-reported-cut', iconSize: [22, 22], iconAnchor: [11, 11], html: '<span></span>' }) }).addTo(group);
          }
        }
        const name = item.cluster.name[vi ? 0 : 1];
        const count = vi ? `${people} người` : `${people} ${people === 1 ? 'person' : 'people'}`;
        const label = multiple ? `${members.length} ${vi ? 'cụm hộ' : 'household groups'}, ${count}` : `${name}, ${count}, ${householdStatusText[status][vi ? 0 : 1].toLocaleLowerCase(vi ? 'vi' : 'en')}`;
        const marker = L.marker(point, { pane: mapPane('selection'), keyboard: true, title: label, bubblingMouseEvents: false, zIndexOffset: selected ? 2000 : 1000,
          icon: L.divIcon({ className: `household-alert is-${status}${multiple ? ' household-aggregate' : ''}${selected ? ' is-selected' : ''}`, iconSize: [SIZE, SIZE], iconAnchor: [SIZE / 2, SIZE / 2], html: html(count, members.length) }) })
          .on('click', () => {
            if (!multiple) { onSelect?.(item.cluster.id); return; }
            if (map.getZoom() < Math.min(map.getMaxZoom(), 18)) {
              map.flyToBounds(L.latLngBounds(members.map(entry => entry.point)), { padding: [80, 80], maxZoom: 18, duration: .5, animate: !matchMedia('(prefers-reduced-motion: reduce)').matches });
              return;
            }
            const list = document.createElement('div'); list.className = 'household-group-list';
            for (const member of members) {
              const button = document.createElement('button'); button.type = 'button';
              button.textContent = `${member.item.cluster.name[vi ? 0 : 1]}, ${member.item.cluster.people} ${vi ? 'người' : 'people'}, ${householdStatusText[member.item.status][vi ? 0 : 1].toLocaleLowerCase(vi ? 'vi' : 'en')}`;
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
  }, [mapRef, metadata, households, selectedId, locale, onSelect]);
  return null;
}
