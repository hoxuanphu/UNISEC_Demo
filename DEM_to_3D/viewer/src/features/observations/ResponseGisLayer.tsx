import { useLandslideAppearance } from '../landslides/useLandslideAppearance';
import { avoidAreaLabelCollisions } from '../landslides/leafletAreaLabel';
import {surveyPointSvg} from '../../terrain/poiFrame';
import { detailInset } from '../map/detailInset';
import { areaMapLabel } from '../landslides/areaMapLabel';
import { usePointRendering } from '../map/usePointRendering';
import type { PointRenderingMode } from '../map/pointRendering';
import { landslideAreaOf, landslideAreaStyle, landslideBoundaryCasing } from '../landslides/landslideAreas';
import { addAreaRoadSections } from '../landslides/leafletAreaRoads';
import type { RoadSegment } from '../../types/dear';
import { fieldAreaOwner } from './fieldAreas';
import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import type { GeometryRecord } from '../../geo/vector/types';
import type { Locale } from '../../types/dear';
import { observationOf } from './model';
import { observationColor } from './labels';
import { observationMarker } from './mapMarker';
import { mapPane } from '../map/mapLayerOrder';
import { roadColors } from '../../terrain/roadStyle';
import { attachPointClusters, type ClusterablePoint } from '../map/pointClusterLayer';
import './observations.css';
const emptyRoads: RoadSegment[] = [];

/** WGS84 reference overlays keep their IDs. They never enter the incident hazard/road assessment. */
export function ResponseGisLayer({
  mapRef,
  records,
  selectedId,
  request,
  enabled,
  interactive,
  locale = 'vi',
  groupIds = [],
  onSelect,
  onGroup,
  roads = emptyRoads, networkVersion, pointMode: modeOverride, compact = false
}: {
  mapRef: React.MutableRefObject<L.Map | null>;
  records: GeometryRecord[];
  selectedId: string | null;
  request: { version: number; id: string | null };
  enabled: boolean;
  interactive: boolean;
  locale?: Locale;
  /** Members of the point group open in the side panel. */
  groupIds?: string[];
  onSelect: (id: string) => void;
  onGroup?: (ids: string[]) => void;
  roads?: RoadSegment[];
  networkVersion?: string;
  pointMode?: PointRenderingMode;
  compact?: boolean;
}): null {
  const { mode: preferenceMode } = usePointRendering();
  const pointMode = modeOverride ?? preferenceMode;
  const { fillOpacity } = useLandslideAppearance();
  const action = useRef(onSelect);
  action.current = onSelect;
  const openGroup = useRef(onGroup);
  openGroup.current = onGroup;
  const groupKey = groupIds.join('|');
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !enabled) return;
    const group = L.layerGroup().addTo(map);
    const disposeLabels = avoidAreaLabelCollisions(map);
    const clustered: ClusterablePoint[] = [];
    for (const record of records.filter((r) => r.visible)) {
      const owner = fieldAreaOwner(record, records);
      const mappedArea = landslideAreaOf(record);
      const observation = observationOf(record),
        selected = record.id === selectedId || owner?.id === selectedId;
      const referenceRoad = record.feature.properties.referenceKind === 'road-corridor';
      const color = referenceRoad ? roadColors.reference : mappedArea ? landslideAreaStyle(mappedArea).color : observation
        ? observationColor(observation.kind)
        : record.role === 'aoi'
          ? '#219a7d'
          : record.role === 'footprint'
            ? '#3186bc'
            : '#b87919';
      const render = () => {
        const layer = L.geoJSON(record.feature, {
          pane: mapPane('boundary'),
          interactive,
          // Leaflet applies style after pointToLayer; a static style would repaint point markers.
          style: (feature) =>
            feature?.geometry.type === 'Point'
              ? {}
              : mappedArea ? { ...landslideAreaStyle(mappedArea, selected, fillOpacity, compact), className: 'landslide-area is-' + mappedArea.state } : {
                  color,
                  weight: referenceRoad ? selected ? 3 : 2 : selected ? 3 : 1.5,
                  fillOpacity: owner ? 0.18 : 0.03,
                  dashArray: record.role === 'footprint' ? '7 4' : undefined
                },
          pointToLayer: (_, position) => {
            if (!observation && (selected || record.feature.properties.sourceDatasetId)) {
              return L.marker(position, {pane:mapPane('selection'), interactive, keyboard:interactive,
                zIndexOffset:selected ? 1000 : 0,
                icon:L.divIcon({html:surveyPointSvg(selected),
                  className:'survey-reference-point '+(selected ? 'map-selected-reference' : 'map-reference-point'),
                  iconSize:[28,28],iconAnchor:[14,14],tooltipAnchor:[0,-28]})});
            }
            if (!observation)
              return L.circleMarker(position, {
                pane: mapPane('selection'),
                radius: selected ? 6 : 4,
                className: selected ? 'map-selected-reference' : 'map-reference-point',
                color,
                weight: selected ? 2 : 1.5,
                fillColor: '#fafbf8',
                fillOpacity: 1,
                interactive
              });
            return observationMarker(position, record, observation, {
              pane: mapPane('selection'),
              selected,
              interactive
            });
          }
        });
        const label = mappedArea ? areaMapLabel(record,locale) : document.createElement('span');
        if (!mappedArea) label.textContent = record.name;
        // A drawn note is read on the map, so its text stays visible like a map label.
        const note = record.feature.properties.shape === 'note';
        layer.bindTooltip(label, {
          direction: 'top',
          permanent: note || record.id === selectedId,
          className: note ? 'field-map-tooltip map-note-label' : 'field-map-tooltip'
        });
        if (interactive)
          layer.on('click', (event) => {
            L.DomEvent.stopPropagation(event.originalEvent);
            action.current(mappedArea ? record.id : owner?.id ?? record.id);
          });
        return layer;
      };
      if (record.feature.geometry.type === 'Point') {
        const [lng, lat] = record.feature.geometry.coordinates;
        clustered.push({
          id: owner?.id ?? record.id,
          name: record.name,
          latlng: L.latLng(lat, lng),
          color,
          selected,
          active: groupIds.includes(record.id),
          render
        });
        continue;
      }
      if (referenceRoad) L.geoJSON(record.feature,{pane:mapPane('boundary'),interactive:false,
        style:{color:roadColors.referenceCasing,weight:selected ? 5 : 4,opacity:.9,lineCap:'round',lineJoin:'round'}}).addTo(group);
      if (mappedArea) L.geoJSON(record.feature, { pane: mapPane('boundary'), interactive: false,
        style: { color: landslideBoundaryCasing, weight: landslideAreaStyle(mappedArea, selected, fillOpacity, compact).weight + 1.2, opacity: .8, fill: false, lineCap: 'round', lineJoin: 'round' } }).addTo(group);
      const displayed = render().addTo(group);
      if (mappedArea) displayed.eachLayer(item => {
        if (item instanceof L.Path) item.getElement()?.setAttribute('data-landslide-area', record.id);
      });
      if (mappedArea && selected && mappedArea.networkVersion === networkVersion) addAreaRoadSections(group, mappedArea, roads, mapPane('boundary'));
    }
    const disposeClusters = attachPointClusters(map, group, clustered, {
      pane: mapPane('selection'),
      interactive,
      locale,
      tooltipClass: 'field-map-tooltip',
      mode: pointMode,
      // Without a group panel, fall back to opening the first member.
      onOpenGroup: (ids) => (openGroup.current ? openGroup.current(ids) : action.current(ids[0]))
    });
    return () => {
      disposeLabels();
      disposeClusters();
      group.remove();
    };
    // groupKey stands in for groupIds so a new array with the same members does not redraw.
  }, [mapRef, records, selectedId, enabled, interactive, locale, groupKey, pointMode, roads, networkVersion, fillOpacity, compact]);
  useEffect(() => {
    if (pointMode === 'individual' && groupKey) openGroup.current?.([]);
  }, [pointMode, groupKey]);
  const last = useRef(0);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !enabled || request.version === last.current) return;
    last.current = request.version;
    // Only an explicit cross-screen request changes the response map view.
    if (!request.id) return;
    const record = records.find((r) => r.id === request.id && r.visible);
    if (!record) return;
    const bounds = L.geoJSON(record.feature).getBounds();
    if (bounds.isValid()) {
      const reserve = detailInset(map.getContainer()).right;
      map.fitBounds(bounds, { paddingTopLeft: [40, 40], paddingBottomRight: [40 + reserve, 40], maxZoom: 16, animate: false });
    }
  }, [mapRef, request, records, enabled]);
  return null;
}
