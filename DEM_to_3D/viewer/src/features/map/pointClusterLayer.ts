import {poiGeometry} from './poiGeometry';
import * as L from 'leaflet';
import { selectedPinSvg,poiMetrics,markerSize } from '../../terrain/poiFrame';
import type { Locale } from '../../types/dear';
import type { PointRenderingMode } from './pointRendering';
import {
  SAME_SITE_METERS,
  centroid,
  pointScreenGroups,
  colorShares,
  convexHull,
  groundSpread
} from './pointClusters';
import './point-clusters.css';

export type ClusterablePoint = {
  /** Record identifier reported through `onOpenGroup`. */
  id: string;
  name: string;
  latlng: L.LatLng;
  color: string;
  selected: boolean;
  /** Member of the group currently shown in the side panel. */
  active?: boolean;
  /** Builds the standalone marker (with its own tooltip and click) when the point is not clustered. */
  render: () => L.Layer;
};

type Options = {
  pane: string;
  interactive: boolean;
  locale: Locale;
  tooltipClass: string;
  mode?: PointRenderingMode;
  /** Opens the record/photo list without changing the map view. */
  onOpenGroup: (ids: string[]) => void;
};

/**
 * Renders coordinates and compact aggregate symbols, re-clustering after every zoom.
 * Returns a disposer; the caller still owns `parent`.
 */
export function attachPointClusters(
  map: L.Map,
  parent: L.LayerGroup,
  points: ClusterablePoint[],
  options: Options
): () => void {
  const t = (vi: string, en: string) => (options.locale === 'vi' ? vi : en);
  const layer = L.layerGroup().addTo(parent);
  let hull: L.Layer | null = null;
  const clearHull = () => {
    hull?.remove();
    hull = null;
  };
  const clusterMarker = (members: ClusterablePoint[]) => {
    const latlngs = members.map((member) => member.latlng);
    const selected = members.find((member) => member.selected);
    // The selected record always remains anchored at its actual coordinate.
    const mean = selected?.latlng ?? centroid(latlngs);
    const centre = L.latLng(mean.lat, mean.lng);
    const site = groundSpread(latlngs) <= SAME_SITE_METERS;
    const active = !!selected || members.some((member) => member.active);
    const size = 28;
    const shares = colorShares(members.map((member) => member.color));
    // A mixed group is not a new hazard class, and its size is not a risk score.
    const color =
      selected?.color ?? (shares.length === 1 ? shares[0].color : '#667b78');
    const badge = document.createElement('span');
    badge.className = 'map-point-cluster-badge';
    badge.style.setProperty('--cluster-core', color);
    badge.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i++) badge.append(document.createElement('i'));
    if (selected) {
      badge.innerHTML = selectedPinSvg();
      const count = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      count.setAttribute('x',String(poiMetrics(markerSize(false,true),true).half)); count.setAttribute('y','21'); count.setAttribute('text-anchor','middle');
      count.setAttribute('fill','currentColor'); count.setAttribute('stroke','none'); count.setAttribute('font-size','10');
      count.textContent = String(members.length); badge.querySelector('svg')!.append(count);
      badge.style.color = color;
    }
    const label = selected
      ? t(
          `${selected.name} (+${members.length - 1} điểm)`,
          `${selected.name} (+${members.length - 1})`
        )
      : site
        ? t(
            `${members.length} điểm gần cùng vị trí`,
            `${members.length} nearby records`
          )
        : t(`${members.length} điểm`, `${members.length} points`);
    const marker = L.marker(centre, {
      pane: options.pane,
      interactive: options.interactive,
      keyboard: options.interactive,
      riseOnHover: true,
      zIndexOffset: active ? 1000 : 0,
      icon: L.divIcon({
        html: badge,
        className:
          'map-point-cluster' +
          (site ? ' is-site' : '') +
          (active ? ' is-selected map-selected-reference' : '') +
          (selected ? ' has-selected-pin' : ''),
        ...poiGeometry(!!selected,size)
      })
    });
    const tip = document.createElement('span');
    tip.className = 'map-cluster-tip';
    const tipTitle = document.createElement('strong');
    tipTitle.textContent = selected?.name ?? label;
    tip.append(tipTitle);
    for (const member of members.slice(0, 4)) {
      const line = document.createElement('span');
      line.textContent = member.name || t('(Không tên)', '(Untitled)');
      tip.append(line);
    }
    if (members.length > 4) {
      const more = document.createElement('span');
      more.textContent = t(
        `Và ${members.length - 4} điểm khác`,
        `And ${members.length - 4} more`
      );
      tip.append(more);
    }
    marker.bindTooltip(selected ? tipTitle : tip, {
      direction: 'top',
      offset: [0, selected ? -30 : -size / 2],
      permanent: false,
      className: options.tooltipClass
    });
    marker.on('add', () =>
      marker.getElement()?.setAttribute('aria-label', label)
    );
    if (!options.interactive) return marker;
    marker.on('keydown', (event: L.LeafletKeyboardEvent) => {
      if (!['Enter', ' '].includes(event.originalEvent.key)) return;
      L.DomEvent.stop(event.originalEvent);
      marker.fire('click', { originalEvent: event.originalEvent });
    });
    marker.on('mouseover', () => {
      clearHull();
      if (site) return;
      const outline = convexHull(latlngs).map((p) => L.latLng(p.lat, p.lng));
      const style = {
        pane: options.pane,
        interactive: false,
        color,
        weight: 1.5,
        dashArray: '4 4',
        fillOpacity: 0.08
      };
      hull = (
        outline.length > 2
          ? L.polygon(outline, style)
          : L.polyline(outline, style)
      ).addTo(map);
    });
    marker.on('mouseout', clearHull);
    marker.on('click', (event: L.LeafletMouseEvent) => {
      if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
      clearHull();
      marker.closeTooltip();
      options.onOpenGroup(members.map((member) => member.id));
    });
    return marker;
  };

  const draw = () => {
    clearHull();
    layer.clearLayers();
    const zoom = map.getZoom();
    const projected = points.map((point) => {
      const pixel = map.project(point.latlng, zoom);
      return { point, x: pixel.x, y: pixel.y };
    });
    for (const group of pointScreenGroups(
      projected,
      zoom,
      options.mode ?? 'group'
    )) {
      if (group.length === 1) layer.addLayer(group[0].point.render());
      else layer.addLayer(clusterMarker(group.map((entry) => entry.point)));
    }
  };
  map.on('zoomend', draw);
  draw();
  return () => {
    map.off('zoomend', draw);
    clearHull();
    layer.remove();
  };
}
