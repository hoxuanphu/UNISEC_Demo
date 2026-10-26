import * as L from 'leaflet';
import type { RoadSegment } from '../../types/dear';
import { guidedRouteStyle, roadColors, roadStroke } from '../../terrain/roadStyle';
import { mapPane } from './mapLayerOrder';
import { roadCondition } from '../routes/roadConditions';
import { contextRoadStyle } from './contextRoadStyle';

type Props = {
  road: RoadSegment; points: L.LatLng[]; layer: L.LayerGroup;
  selected: boolean; inspected: boolean; warning: boolean; imagery: boolean;
  networkOpacity: number; onSelect: () => void;
  resident?: boolean;
  sourceId?: string;
  contextZoom?: number;
};

/** Selection tolerance is independent of the cartographic stroke width. */
export function addRoadLayers({ road, points, layer, selected, inspected, warning, imagery, networkOpacity, onSelect, resident = false, sourceId = road.id, contextZoom }: Props) {
  const pane = mapPane(warning ? 'roadStatus' : selected ? 'route' : 'roads');
  const guided = selected && road.status !== 'blocked';
  const condition = roadCondition(road);
  const color = guided ? guidedRouteStyle(warning).line : warning ? roadColors[condition === 'blocked' ? 'blocked' : 'uncertain']
    : selected ? roadColors.selected : resident ? roadColors.alternative : imagery ? roadColors.networkImagery : roadColors.networkTerrain;
  const weight = guided ? 5 : warning ? condition==='blocked'?roadStroke.blocked:roadStroke.caution : selected || inspected ? roadStroke.emphasis : roadStroke.normal;
  const opacity = resident && !selected && !inspected ? (road.status === 'blocked' && warning ? .9 : warning ? .55 : networkOpacity)
    : selected || inspected || warning ? 1 : networkOpacity;
  const casingColor = condition === 'blocked' && warning ? roadColors.neutralCasing : inspected ? roadColors.inspectedCasing : selected && !warning ? roadColors.selectedCasing : roadColors.neutralCasing;
  const casing = L.polyline(points, { pane, color: casingColor, weight: weight + (inspected ? roadStroke.inspectedCasing : roadStroke.casing), opacity: opacity * 0.8, interactive: false }).addTo(layer);
  const context = contextZoom === undefined || selected ? null : contextRoadStyle(road, contextZoom, imagery, warning, inspected, networkOpacity);
  if (context) casing.setStyle({color:context.casing,weight:context.casingWidth,opacity:context.opacity*.7});
  if (guided) {
    // Web-map route: one line with a thin rim of its own shade; sections to verify turn amber.
    casing.setStyle(guidedCasing(warning));
  }
  const stroke = L.polyline(points, { pane, color, weight, opacity, interactive: false, className: selected ? 'map-road-route-line' : 'map-road-network-line',
    lineCap: 'round', lineJoin: 'round', dashArray: warning && condition !== 'blocked' && !guided ? '7 5' : undefined }).addTo(layer);
  stroke.getElement()?.setAttribute('data-road-status', road.status);
  stroke.getElement()?.setAttribute('data-road-stroke', sourceId);
  stroke.getElement()?.setAttribute('data-road-condition', condition);
  if(warning)stroke.getElement()?.classList.add('road-warning-breathe');
  if (context) {
    stroke.setStyle({color:context.color,weight:context.weight,opacity:context.opacity,dashArray:context.dashed?'5 4':undefined});
    stroke.getElement()?.classList.add('map-context-road');
  }
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const target = L.polyline(points, { pane, color: 'transparent', weight: touch ? 24 : 16,
    opacity: 1, bubblingMouseEvents: false, className: 'map-road-target' }).addTo(layer);
  target.getElement()?.setAttribute('data-road-id', sourceId);
  if (selected) target.getElement()?.setAttribute('data-route-segment', road.id);
  target.on('click', onSelect);
  if (window.matchMedia('(hover: hover)').matches) {
    target.on('mouseover', () => casing.setStyle(guided && warning
      ? { ...guidedCasing(true), weight: guidedRouteStyle(true).rimWidth + 2 }
      : { color: condition === 'blocked' && warning ? roadColors.neutralCasing : roadColors.inspectedCasing, opacity: 0.85, weight: weight + roadStroke.inspectedCasing }));
    target.on('mouseout', () => casing.setStyle(context ? {color:context.casing,weight:context.casingWidth,opacity:context.opacity*.7} : guided
      ? guidedCasing(warning)
      : { color: casingColor, opacity: opacity * 0.8, weight: weight + (inspected ? roadStroke.inspectedCasing : roadStroke.casing) }));
  }
}

const guidedCasing = (warning: boolean): L.PathOptions => {
  const style = guidedRouteStyle(warning);
  return { color: style.rim, weight: style.rimWidth, opacity: 1, lineCap: 'round', lineJoin: 'round' };
};
