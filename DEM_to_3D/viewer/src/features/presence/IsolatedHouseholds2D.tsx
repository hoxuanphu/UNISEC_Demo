import { useEffect, type MutableRefObject } from 'react';
import * as L from 'leaflet';
import type { Locale } from '../../types/dear';
import type { TerrainMetadata } from '../../types/terrain';
import { projectedToWgs84 } from '../../terrain/coordinate';
import { carbonIcons } from '../../shared/ui/carbonIconData';
import { mapPane } from '../map/mapLayerOrder';
import type { HouseholdAccess } from './householdIsolation';
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
/** Closer than this on screen, the pins merge into one count. */
const MERGE_PX = 40;
/** The ground the huts and their terraces cover, outlined for the selected cluster. */
const ZONE_M = 140;

/**
 * People the resident app still places at isolated field huts: a small red disc with
 * a people glyph and a slow ring, the head count beside it. Zoomed out until discs
 * would touch, they merge into one total. The selected cluster also shows its
 * ground and the slides the residents reported.
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
    for (const { item, point } of isolated) {
      const selected = item.cluster.id === selectedId;
      if (selected) L.circle(point, { radius: ZONE_M, pane: mapPane('selection'), color: '#c62828', weight: 1.5, dashArray: '4 4', fill: false, interactive: false, className: 'household-zone' }).addTo(group);
      if (selected) {
        for (const cut of item.cutBy) {
          const place = cut.kind === 'report' ? at(cut.point) : null;
          if (place) L.marker(place, { pane: mapPane('selection'), interactive: false, keyboard: false, icon: L.divIcon({
            className: 'household-reported-cut', iconSize: [22, 22], iconAnchor: [11, 11], html: '<span></span>' }) }).addTo(group);
        }
      }
      const name = item.cluster.name[vi ? 0 : 1];
      const count = vi ? `${item.cluster.people} người` : `${item.cluster.people} people`;
      const label = vi ? `${name}, ${count}, bị cô lập` : `${name}, ${count}, cut off`;
      const marker = L.marker(point, { pane: mapPane('selection'), keyboard: true, title: label, bubblingMouseEvents: false, zIndexOffset: selected ? 2000 : 1000,
        icon: L.divIcon({ className: `household-alert${selected ? ' is-selected' : ''}${attended.split(',').includes(item.cluster.id) ? ' is-attended' : ''}`, iconSize: [SIZE, SIZE], iconAnchor: [SIZE / 2, SIZE / 2], html: html(count) }) })
        .on('click', () => onSelect?.(item.cluster.id)).addTo(group);
      marker.getElement()?.setAttribute('aria-label', label);
      marker.getElement()?.setAttribute('data-household', item.cluster.id);
    }
    // One total for the far view; tapping it zooms to where the pins separate.
    const total = isolated.reduce((sum, { item }) => sum + item.cluster.people, 0);
    const bounds = L.latLngBounds(isolated.map(entry => entry.point));
    const totalLabel = vi ? `${total} người bị cô lập` : `${total} people cut off`;
    const aggregate = isolated.length > 1 ? L.marker(bounds.getCenter(), { pane: mapPane('selection'), keyboard: true, title: totalLabel, bubblingMouseEvents: false, zIndexOffset: 1500,
      icon: L.divIcon({ className: 'household-alert household-aggregate', iconSize: [SIZE, SIZE], iconAnchor: [SIZE / 2, SIZE / 2], html: html(vi ? `${total} người` : `${total} people`) }) })
      .on('click', () => map.flyToBounds(bounds, { padding: [90, 90], maxZoom: 16, duration: .6 })).addTo(group) : null;
    aggregate?.getElement()?.setAttribute('aria-label', totalLabel);
    const merge = () => {
      const screen = isolated.map(entry => map.latLngToContainerPoint(entry.point));
      const crowded = screen.some((a, i) => screen.some((b, j) => j > i && a.distanceTo(b) < MERGE_PX));
      map.getContainer().classList.toggle('households-merged', Boolean(aggregate) && crowded);
    };
    merge(); map.on('zoomend', merge);
    return () => { map.off('zoomend', merge); map.getContainer().classList.remove('households-merged'); group.remove(); };
  }, [mapRef, metadata, households, selectedId, locale, onSelect, attended]);
  return null;
}
