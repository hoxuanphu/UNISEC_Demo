import {areaResponsePriority} from '../landslides/responsePriority';
import {addInternetDetail} from '../map/internetDetail';
import {BasemapToneFilters} from '../imagery/BasemapToneFilters';
import {supportsBasemapTone} from '../imagery/basemapTone';
import {localMapSource} from '../map/localMapSource';
import { useLandslideAppearance } from '../landslides/useLandslideAppearance';
import type { AnalysisImageryState } from '../imagery/useAnalysisImagery';
import { createAnalysisOverlay2d } from '../imagery/analysisOverlay2d';
import { acquisitionLabel, availableSarModes, imageryGroups, type SarMode } from '../imagery/analysisImagery';
import { areaMapLabel } from '../landslides/areaMapLabel';
import { removeLeafletMap } from '../map/removeLeafletMap';
import { panelFitPadding } from '../map/panelFitPadding';
import { surveyPointSvg } from '../../terrain/poiFrame';
import { distinctSourceRecords, representedHazard } from '../map/sourceRepresentation';
import { landslideAreaOf, landslideAreaStyle, landslideBoundaryColor, landslideBoundaryCasing } from '../landslides/landslideAreas';
import { roadColors } from '../../terrain/roadStyle';
import { addAreaRoadSections } from '../landslides/leafletAreaRoads';
import type { RenameScenario } from '../access/ScenarioLabels';
import { PointRenderingControl } from '../map/PointRenderingControl';
import { usePointRendering } from '../map/usePointRendering';
import { isSelectPickerEvent } from '../../shared/ui/selectKeyboard';
import { scenarioOverlayLayer, targetKey, type ScenarioOverlay, type ScenarioTarget } from './scenarioOverlay';
import { ScenarioFeatureCard } from './ScenarioFeatureCard';
import type { GeometryMapDetail } from './geometryDetail';
import type { ScenarioEdits } from '../access/scenarioEdits';
import { roadGeographic, roadProjected } from '../routes/selectedRoadJourney';
import { createTileProgress } from '../map/tileProgress';
import { retryTileErrors } from '../map/tileRetry';
import { basemapTileOptions, terrainTileSource, imagerySource } from '../map/imagerySource';
import { fieldAreaOwner } from '../observations/fieldAreas';
import { GEOMETRY_LIMITS } from '../../geo/vector/limits';
import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { geometryPositions, type GeometryRecord, type VectorGeometry } from '../../geo/vector/types';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { MapAttribution } from '../../components/dear/MapAttribution';
import type { BasemapState } from '../map/mapContracts';
import { observationOf } from '../observations/model';
import { observationMarker } from '../observations/mapMarker';
import { observationColor } from '../observations/labels';
import { PointGroupCard } from '../observations/PointGroupCard';
import {
  attachPointClusters,
  type ClusterablePoint
} from '../map/pointClusterLayer';
import { roleColors, roleLabel } from './geometryPresentation';
import {
  vertexHandles,
  moveVertex,
  translateGeometry
} from './geometryEditing';
import type { useGeometryEditor } from './useGeometryEditor';

type Props = {
  records: GeometryRecord[];
  selectedId: string | null;
  locale: Locale;
  offline: boolean;
  viewRequest: { version: number; id: string | null };
  onSelect: (id: string) => void;
  detail: GeometryMapDetail | null;
  onDetail: (detail: GeometryMapDetail | null) => void;
  editor: ReturnType<typeof useGeometryEditor>;
  snapping: boolean;
  drawingColor?: string;
  previewGeometry?: VectorGeometry;
  onFinish: () => void;
  onCancel: () => void;
  intersection: Feature<Polygon | MultiPolygon> | null;
  /** Incident scenario features shown read-only for context. */
  scenario?: ScenarioOverlay;
  /** Present for managers: scenario features become selectable and editable. */
  scenarioEdits?: ScenarioEdits;
  onRenameScenario?: RenameScenario;
  scenarioFocus?: ScenarioTarget | null;
  onResponseScenario?: (target: ScenarioTarget) => void;
  onSelectScenario: (target: ScenarioTarget) => void;
  onScenarioNotice?: (message: [string,string]) => void;
  onPickPoint?: (point: {latitude:number;longitude:number}) => void;
  onCancelPick?: () => void;
  pickLabel?: [string, string];
  pickAnchor?: {latitude:number;longitude:number};
  onPickScenarioPosition?: () => void;
  /** Shared with the response map so a scar can be digitised on the chosen scene. */
  analysisImagery?: AnalysisImageryState;
};

const emptyPointGroup: readonly string[] = [];

export function GeometryMap(props: Props): JSX.Element {
  const basemapUnavailable = props.offline && !localMapSource();
  const { fillOpacity } = useLandslideAppearance();
  const t = (vi: string, en: string) => (props.locale === 'vi' ? vi : en);
  const host = useRef<HTMLDivElement>(null),
    mapRef = useRef<L.Map | null>(null);
  const previewRef = useRef<L.Polyline | null>(null);
  const snapRef = useRef<L.CircleMarker | null>(null);
  const snapPosition = useRef<(position: L.LatLng) => L.LatLng>(
    (position) => position
  );
  const live = useRef(props);
  live.current = props;
  const [ready, setReady] = useState(false),
    [base, setBase] = useState<'none' | 'satellite' | 'terrain'>(
      basemapUnavailable ? 'none' : 'satellite'
    );
  const { mode: pointMode } = usePointRendering();
  const analysis = props.analysisImagery;
  const analysisLayer = analysis?.layers.find(layer => layer.id === analysis.selection.layer);
  const analysisChoice = !analysisLayer ? '' : analysisLayer.kind === 'sar' ? `${analysisLayer.id}:${analysis!.selection.sarMode}` : analysisLayer.id;
  const analysisOverlay = useRef<ReturnType<typeof createAnalysisOverlay2d> | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const overlay = createAnalysisOverlay2d(map, 'analysis', props.locale === 'en' ? 'Analysis imagery' : 'Ảnh phân tích');
    analysisOverlay.current = overlay;
    return () => { overlay.dispose(); analysisOverlay.current = null; };
  }, [ready]);
  useEffect(() => { analysisOverlay.current?.set(analysis?.rasters ?? [], analysis?.selection.opacity ?? 1); }, [ready, analysis?.rasters, analysis?.selection.opacity]);
  const [showIntersection, setShowIntersection] = useState(true),
    [showScenario, setShowScenario] = useState(true),
    [cursor, setCursor] = useState('');
  const scenarioDetail = props.detail?.kind === 'scenario' ? props.detail : null;
  const scenarioTarget = scenarioDetail?.target ?? null;
  const scenarioMoving = scenarioDetail?.moving ?? false;
  const scenarioPending = scenarioDetail?.pending ?? null;
  const pointGroup = props.detail?.kind === 'group' ? props.detail.ids : emptyPointGroup;
  const updateScenario = (patch: Partial<Pick<NonNullable<typeof scenarioDetail>, 'moving' | 'pending'>>) => {
    const current = live.current.detail;
    if (current?.kind === 'scenario')
      live.current.onDetail({ ...current, ...patch });
  };
  const [retry, setRetry] = useState(0);
  const [source, setSource] = useState<BasemapState>({
    status: 'off',
    style: 'satellite',
    loaded: 0,
    total: 0
  });
  useEffect(() => {
    if (!host.current) return;
    const map = L.map(host.current, {
      zoomControl: false,
      attributionControl: false,
      minZoom: 1,
      maxZoom: 19,
      preferCanvas: false
    }).setView([21.782919, 104.053554], 10);
    mapRef.current = map;
    setReady(true);
    for (const [pane, zIndex] of [
      ['analysis', 300],
      ['footprint', 420],
      ['reference', 440],
      ['aoi', 460],
      ['intersection', 470],
      ['selected', 480],
      ['points', 500],
      ['drawing', 510]
    ] as const) {
      map.createPane(pane).style.zIndex = String(zIndex);
    }
    map.getPane('intersection')!.style.pointerEvents = 'none';
    L.control.scale({ imperial: false, maxWidth: 100 }).addTo(map);
    const preview = L.polyline([], {
      pane: 'drawing',
      color: roleColors.aoi,
      weight: 2,
      dashArray: '5 4',
      interactive: false
    }).addTo(map);
    previewRef.current = preview;
    const snapMarker = L.circleMarker([0, 0], {
      pane: 'drawing',
      radius: 6,
      color: roleColors.aoi,
      weight: 2,
      fillOpacity: 0,
      interactive: false
    });
    snapRef.current = snapMarker;
    const snap = (position: L.LatLng) => {
      if (!live.current.snapping) return position;
      const target = map.latLngToContainerPoint(position);
      let closest = 12,
        point = position;
      for (const record of live.current.records.filter(
        (record) => record.visible && record.id !== live.current.editor.recordId
      )) {
        for (const coordinate of geometryPositions(record.feature.geometry)) {
          const candidate = L.latLng(coordinate[1], coordinate[0]),
            distance = map.latLngToContainerPoint(candidate).distanceTo(target);
          if (distance < closest) {
            closest = distance;
            point = candidate;
          }
        }
      }
      if (point !== position) snapMarker.setLatLng(point).addTo(map);
      else snapMarker.remove();
      return point;
    };
    snapPosition.current = snap;
    let frame = 0;
    const move = (event: L.LeafletMouseEvent) => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          setCursor(
            `φ ${event.latlng.lat.toFixed(5)}°, λ ${event.latlng.lng.toFixed(5)}°`
          );
        });
      const { editor } = live.current,
        last = editor.draft.vertices.at(-1),
        point = editor.active ? snap(event.latlng) : event.latlng;
      if (editor.mode === 'rectangle' && last)
        preview.setLatLngs([
          [last[1], last[0]],
          [last[1], point.lng],
          [point.lat, point.lng],
          [point.lat, last[0]],
          [last[1], last[0]]
        ]);
      else
        preview.setLatLngs(
          editor.mode === 'polygon' && last ? [[last[1], last[0]], point] : []
        );
    };
    const click = (event: L.LeafletMouseEvent) => {
      if (live.current.onPickPoint) { live.current.onPickPoint({latitude:event.latlng.lat,longitude:event.latlng.lng}); return; }
      const { editor } = live.current;
      if (
        !['polygon', 'rectangle'].includes(editor.mode) ||
        event.originalEvent.detail >= 2
      )
        return;
      const vertices = editor.draft.vertices;
      const near = (point: number[], pixels: number) =>
        map
          .latLngToContainerPoint([point[1], point[0]])
          .distanceTo(event.containerPoint) <= pixels;
      if (vertices.length >= 3 && near(vertices[0], 10)) {
        live.current.onFinish();
        return;
      }
      if (vertices.length && near(vertices[vertices.length - 1], 3)) return;
      const point = snap(event.latlng);
      if (vertices.length < GEOMETRY_LIMITS.verticesPerFeature - 1)
        editor.add([point.lng, point.lat]);
      if (editor.mode === 'rectangle' && vertices.length === 1)
        live.current.onFinish();
    };
    const double = () => {
      if (live.current.editor.mode === 'polygon') live.current.onFinish();
    };
    map.on('mousemove', move).on('click', click).on('dblclick', double);
    const observer = new ResizeObserver(() =>
      map.invalidateSize({ animate: false })
    );
    observer.observe(host.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      removeLeafletMap(map);
      mapRef.current = null;
    };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (base === 'none') {
      setSource({ status: 'off', style: 'satellite', loaded: 0, total: 0 });
      return;
    }
    let disposed = false;
    const progress = createTileProgress();
    const publish = () => {
      if (!disposed) setSource({ ...progress.snapshot(), style: base });
    };
    const layer = retryTileErrors(L.tileLayer(
      base === 'satellite'
        ? imagerySource.url
        : terrainTileSource().url,
      {
        maxNativeZoom: base === 'satellite' ? imagerySource.maxNativeZoom : terrainTileSource().maxZoom,
        maxZoom: 19,
        noWrap: true,
        ...basemapTileOptions
      }
    ));
    layer.on('loading', () => { progress.reset(); publish(); });
    layer.on('tileloadstart', event => progress.start(event.tile));
    layer.on('tileunload', event => { progress.forget(event.tile); publish(); });
    layer.on('tileload', event => { progress.settle(event.tile,true); publish(); });
    layer.on('tileerror', event => { progress.settle(event.tile,false); publish(); });
    layer.on('load', publish).addTo(map);
    const detail=base === 'satellite' ? addInternetDetail(map) : null;
    return () => {
      disposed = true;
      detail?.dispose(); layer.remove();
    };
  }, [ready, base, retry]);
  // A scenario focus (e.g. "Edit in GIS") wins over the view request pending at that moment:
  // on open the session asks to fit all GIS records, which would otherwise run after this
  // and move the map away from the object being edited.
  const appliedFocus = useRef<ScenarioTarget | null>(null);
  const focusedView = useRef<typeof props.viewRequest | null>(null);
  const focusPadding = () => {
    const canvas = mapRef.current!.getContainer();
    const card = canvas.closest('.geodata-map')?.querySelector<HTMLElement>('.scenario-card');
    return panelFitPadding(canvas.getBoundingClientRect(),card?.getBoundingClientRect());
  };
  useEffect(() => {
    const map=mapRef.current, target=props.scenarioFocus, scenario=props.scenario;
    if(!ready||!map||!target||!scenario||appliedFocus.current===target) return;
    setShowScenario(true);
    const collection=target.type==='community'?scenario.communities:target.type==='hazard'?scenario.hazards:target.type==='site'?scenario.responseSites:scenario.roads;
    const feature=collection.find(f=>f.id===target.id);
    if(!feature) return;
    appliedFocus.current=target; focusedView.current=props.viewRequest;
    if('projected' in feature) {
      const point=feature.projected;
      const bounds=L.latLngBounds([{x:point.x-250,y:point.y-250},{x:point.x+250,y:point.y+250}].map(p=>{const g=roadGeographic(p);return L.latLng(g.latitude,g.longitude);}));
      map.fitBounds(bounds,{...focusPadding(),maxZoom:17,animate:false});
    } else map.fitBounds(L.latLngBounds(feature.points.map(p=>{const g=roadGeographic(p);return L.latLng(g.latitude,g.longitude);})),{...focusPadding(),maxZoom:16,animate:false});
  },[ready,props.scenarioFocus,props.scenario]);
  const scenarioFitted = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || scenarioFitted.current || !props.scenario) return;
    scenarioFitted.current = true;
    // With nothing imported yet, open on the incident area rather than a regional view.
    if (props.scenarioFocus || props.viewRequest.version || props.records.some((record) => record.visible)) return;
    const { communities, responseSites, hazards, roads } = props.scenario;
    const points = [
      ...communities.map((item) => item.projected),
      ...responseSites.map((item) => item.projected),
      ...hazards.map((item) => item.projected),
      ...roads.flatMap((road) => road.points)
    ]
      .map(roadGeographic)
      .map((point) => L.latLng(point.latitude, point.longitude));
    if (points.length)
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15, animate: false });
  }, [ready, props.scenario]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !showScenario || !props.scenario) return;
    if (!map.getPane('scenario')) map.createPane('scenario').style.zIndex = '410';
    const pending = scenarioPending && roadGeographic(scenarioPending);
    const selectedSource = props.records.find(record => record.id === props.selectedId);
    const represented = selectedSource && representedHazard(selectedSource, props.scenario.hazards)?.id;
    const layer = scenarioOverlayLayer({...props.scenario, hazards:props.scenario.hazards
      .filter(hazard => hazard.id !== represented).map(hazard => ({...hazard,labelMode:hazard.labelMode ?? 'show'}))}, {
      map,
      imagery: base === 'satellite',
      pane: 'scenario',
      locale: props.locale,
      selected: scenarioTarget,
      moving: scenarioMoving,
      pendingAt: pending ? L.latLng(pending.latitude, pending.longitude) : null,
      onSelect: !live.current.onPickPoint && !live.current.editor.active
        ? (target) => {
            live.current.onDetail({ kind: 'scenario', target, moving: false, pending: null });
          }
        : undefined,
      onMoved: (_, position) => updateScenario({ pending: roadProjected(position.lat, position.lng) })
    }).addTo(map);
    return () => {
      layer.remove();
    };
    // The wrapper object is rebuilt per render; its arrays are stable snapshot data.
  }, [ready, base, showScenario, props.scenario?.communities, props.scenario?.responseSites, props.scenario?.hazards, props.scenario?.roads, props.records, props.selectedId, props.locale, targetKey(scenarioTarget), scenarioMoving, scenarioPending, props.editor.active, props.onPickPoint]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const group = L.layerGroup().addTo(map);
    const clustered: ClusterablePoint[] = [];
    for (const record of distinctSourceRecords(props.records, props.selectedId).filter(
      (record) =>
        record.visible &&
        !(showScenario && props.scenario && record.id !== props.selectedId && representedHazard(record, props.scenario.hazards)) &&
        !(props.editor.mode === 'edit' && record.id === props.editor.recordId)
    )) {
      const observation = observationOf(record);
      const owner = fieldAreaOwner(record, props.records);
      const mappedArea = landslideAreaOf(record);
      const referenceRoad = record.feature.properties.referenceKind === 'road-corridor';
      const color = referenceRoad ? roadColors.reference : mappedArea ? landslideAreaStyle(mappedArea).color : owner
          ? '#b87919'
          : observation
            ? observationColor(observation.kind)
            : roleColors[record.role],
        selected =
          record.id === props.selectedId || owner?.id === props.selectedId;
      const pane =
        record.feature.geometry.type === 'Point'
          ? 'points'
          : selected
            ? 'selected'
            : record.role;
      const pointStyle: L.CircleMarkerOptions = {
        pane: 'points',
        radius: selected ? 6 : 4,
        className: selected ? 'map-selected-reference' : 'map-reference-point',
        color,
        weight: selected ? 2 : 1.5,
        fillColor: '#fafbf8',
        fillOpacity: 1,
        interactive: !props.editor.active && !props.onPickPoint
      };
      const render = () => {
        const layer = L.geoJSON(record.feature, {
          pane,
          // Leaflet applies style after pointToLayer, including to CircleMarker paths.
          style: (feature) =>
            feature?.geometry.type === 'Point'
              ? pointStyle
              : mappedArea ? { ...landslideAreaStyle(mappedArea, selected, fillOpacity), className: 'landslide-area is-' + mappedArea.state+' priority-'+areaResponsePriority(record.id,props.scenario?.roads??[],mappedArea.networkVersion===props.scenario?.datasetVersion?mappedArea.roadLinks.map(link=>link.roadId):[],false,mappedArea.review==='unreviewed'), interactive: !props.editor.active && !props.onPickPoint } : {
                  color,
                  weight: referenceRoad ? selected ? 3 : 2 : selected ? 3 : 1.5,
                  fillOpacity: owner
                    ? selected
                      ? 0.22
                      : 0.14
                    : selected
                      ? 0.15
                      : 0.06,
                  dashArray: record.role === 'footprint' ? '7 4' : undefined,
                  interactive: !props.editor.active && !props.onPickPoint
                },
          pointToLayer: (_, position) =>
            observation
              ? observationMarker(position, record, observation, {
                  pane: 'points',
                  selected,
                  interactive: !props.editor.active && !props.onPickPoint
                })
              : selected
                ? L.marker(position, { pane: 'points', interactive: !props.editor.active && !props.onPickPoint,
                    keyboard: !props.editor.active && !props.onPickPoint, zIndexOffset: 1000,
                    icon: L.divIcon({ html: surveyPointSvg(true), className: 'geodata-selected-point map-selected-reference',
                      iconSize: [28, 28], iconAnchor: [14, 14], tooltipAnchor: [0, -30] }) })
                : record.feature.properties.sourceDatasetId
                  ? L.marker(position,{pane:'points',interactive:!props.editor.active && !props.onPickPoint,
                      keyboard:!props.editor.active && !props.onPickPoint,
                      icon:L.divIcon({html:surveyPointSvg(),className:'survey-reference-point map-reference-point',iconSize:[28,28],iconAnchor:[14,14],tooltipAnchor:[0,-28]})})
                  : L.circleMarker(position, pointStyle)
        });
        const label = mappedArea ? areaMapLabel(record,props.locale) : document.createElement('span');
        if (!mappedArea) label.textContent = record.name;
        if (!props.editor.active && !props.onPickPoint)
          layer
            .bindTooltip(label, {
              permanent: record.id === props.selectedId,
              direction: 'top',
              className: 'geodata-map-label'
            })
            .on('click', (event) => {
              L.DomEvent.stopPropagation(event.originalEvent);
              live.current.onSelect(record.id);
            });
        return layer;
      };
      if (record.feature.geometry.type === 'Point') {
        const [lng, lat] = record.feature.geometry.coordinates;
        clustered.push({
          id: record.id,
          name: record.name,
          latlng: L.latLng(lat, lng),
          color,
          selected,
          active: pointGroup.includes(record.id),
          render
        });
        continue;
      }
      if (referenceRoad) L.geoJSON(record.feature, { pane, interactive: false,
        style: { color: roadColors.referenceCasing, weight: selected ? 5 : 4, opacity: .9, lineCap: 'round', lineJoin: 'round' } }).addTo(group);
      if (mappedArea) L.geoJSON(record.feature, { pane, interactive: false,
        style: { color: landslideBoundaryCasing, weight: landslideAreaStyle(mappedArea, selected).weight + 1.2, opacity: .8, fill: false, lineCap: 'round', lineJoin: 'round' } }).addTo(group);
      render().addTo(group);
      if (mappedArea && selected && mappedArea.networkVersion === props.scenario?.datasetVersion) addAreaRoadSections(group, mappedArea, props.scenario?.roads ?? [], 'reference');
      if (
        !props.editor.active && !props.onPickPoint &&
        record.feature.geometry.type === 'LineString'
      ) {
        L.geoJSON(record.feature, { pane, style: { weight: 12, opacity: 0 } })
          .on('click', (event) => {
            L.DomEvent.stopPropagation(event.originalEvent);
            live.current.onSelect(record.id);
          })
          .addTo(group);
      }
    }
    const disposeClusters = attachPointClusters(map, group, clustered, {
      pane: 'points',
      interactive: !props.editor.active && !props.onPickPoint,
      locale: props.locale,
      tooltipClass: 'geodata-map-label',
      mode: pointMode,
      onOpenGroup: ids => live.current.onDetail({ kind: 'group', ids })
    });
    if (showIntersection && props.intersection)
      L.geoJSON(props.intersection, {
        pane: 'intersection',
        style: {
          color: props.drawingColor ?? roleColors.aoi,
          weight: 1,
          fillOpacity: 0.22,
          interactive: false
        }
      }).addTo(group);
    if (props.previewGeometry && props.editor.mode !== 'edit') {
      const preview: Feature = { type: 'Feature', properties: {}, geometry: props.previewGeometry };
      L.geoJSON(preview, {
        pane: 'drawing',
        style: { color: props.drawingColor ?? roleColors.aoi, weight: 3, fillOpacity: 0.12, interactive: false }
      }).addTo(group);
    }
    if (props.editor.mode === 'edit' && props.editor.draft.geometry) {
      const draft: Feature = {
        type: 'Feature',
        geometry: props.editor.draft.geometry,
        properties: {}
      };
      const draftLayer = L.geoJSON(draft, {
        pane: 'drawing',
        style: {
          color: props.drawingColor ?? roleColors.aoi,
          weight: 3,
          fillOpacity: 0.12,
          interactive: false
        },
        pointToLayer: (_, position) =>
          L.circleMarker(position, {
            radius: 7,
            color: props.drawingColor ?? roleColors.aoi,
            interactive: false
          })
      }).addTo(group);
      if (
        draft.geometry.type === 'Polygon' ||
        draft.geometry.type === 'MultiPolygon'
      ) {
        const center = draftLayer.getBounds().getCenter();
        const handle = L.marker(center, {
          pane: 'drawing',
          draggable: true,
          title: t('Di chuyển cả vùng', 'Move entire area'),
          icon: L.divIcon({
            className: 'geodata-move-handle',
            html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/></svg>',
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          })
        }).addTo(group);
        handle.on('drag', () => {
          const p = handle.getLatLng();
          draftLayer.clearLayers();
          draftLayer.addData({
            ...draft,
            geometry: translateGeometry(
              props.editor.draft.geometry!,
              p.lng - center.lng,
              p.lat - center.lat
            )
          } as Feature);
        });
        handle.on('dragend', () => {
          const p = handle.getLatLng();
          live.current.editor.translate(p.lng - center.lng, p.lat - center.lat);
        });
      }
      vertexHandles(props.editor.draft.geometry).forEach(
        ({ path, coordinate }, index) => {
          const marker = L.marker([coordinate[1], coordinate[0]], {
            pane: 'drawing',
            draggable: true,
            keyboard: true,
            title: t('Đỉnh ', 'Vertex ') + (index + 1),
            icon: L.divIcon({
              className: 'geodata-vertex',
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            })
          }).addTo(group);
          marker.on('drag', () => {
            const point = snapPosition.current(marker.getLatLng());
            const next = moveVertex(
              draft.geometry as typeof props.editor.draft.geometry & {},
              path,
              [point.lng, point.lat]
            );
            draftLayer.clearLayers();
            draftLayer.addData({ ...draft, geometry: next } as Feature);
          });
          marker.on('dragend', () => {
            const point = snapPosition.current(marker.getLatLng());
            snapRef.current?.remove();
            live.current.editor.move(path, [point.lng, point.lat]);
          });
        }
      );
    }
    if (props.editor.draft.vertices.length && !props.previewGeometry) {
      const positions = props.editor.draft.vertices.map((p) =>
        L.latLng(p[1], p[0])
      );
      L.polyline(positions, {
        pane: 'drawing',
        color: props.drawingColor ?? roleColors.aoi,
        weight: 2,
        interactive: false
      }).addTo(group);
      positions.forEach((position) =>
        L.circleMarker(position, {
          pane: 'drawing',
          radius: 4,
          color: 'white',
          weight: 1.5,
          fillColor: props.drawingColor ?? roleColors.aoi,
          fillOpacity: 1,
          interactive: false
        }).addTo(group)
      );
    }
    return () => {
      disposeClusters();
      group.remove();
    };
  }, [
    ready,
    props.records,
    props.selectedId,
    props.editor.mode,
    props.editor.draft,
    props.previewGeometry,
    fillOpacity,
    props.intersection,
    showIntersection,
    pointMode,
    pointGroup,
    props.onPickPoint,
    props.scenario?.roads,
    props.scenario?.hazards,
    props.scenario?.datasetVersion,
    showScenario,
    props.locale
  ]);
  useEffect(() => {
    const map=mapRef.current, point=props.pickAnchor;
    if(!ready||!map||!point||!props.onPickPoint)return;
    const marker=L.circleMarker([point.latitude,point.longitude],{pane:'drawing',radius:4,color:'#fff',weight:1.5,fillColor:'#9a742f',fillOpacity:1,interactive:false}).addTo(map);
    marker.bindTooltip(props.locale==='vi'?'Đầu đoạn':'Section start',{permanent:true,direction:'top',className:'geodata-map-label'});
    return ()=>{marker.remove();};
  },[ready,props.pickAnchor,props.onPickPoint,props.locale]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || props.viewRequest.version === 0 || props.viewRequest === focusedView.current) return;
    const records = props.records.filter((record) =>
      props.viewRequest.id ? record.id === props.viewRequest.id : record.visible
    );
    const points = records
      .flatMap((record) => geometryPositions(record.feature.geometry))
      .map((p) => L.latLng(p[1], p[0]));
    if (!points.length) return;
    const focused = !!props.viewRequest.id;
    // A single record (e.g. a 400 m² field area) needs street-level zoom to be visible at all.
    const single = focused && records[0]?.feature.geometry.type === 'Point';
    map.fitBounds(L.latLngBounds(points), {
      padding: focused ? [64, 64] : [36, 36],
      maxZoom: focused ? (single ? 17 : 18) : 15,
      animate: focused
    });
  }, [ready, props.viewRequest]);
  useEffect(() => {
    if (props.previewGeometry) previewRef.current?.setLatLngs([]);
  }, [props.previewGeometry]);
  useEffect(() => {
    const map = mapRef.current;
    previewRef.current?.setLatLngs([]);
    snapRef.current?.remove();
    if (props.editor.active) map?.doubleClickZoom.disable();
    else map?.doubleClickZoom.enable();
    if (!props.editor.active) return;
    const keys = (event: KeyboardEvent) => {
      if (isSelectPickerEvent(event) || (event.target as HTMLElement)?.closest('dialog[open]')) return;
      const key = event.key.toLowerCase();
      if (!['enter', 'escape', 'backspace', 'z', 'y'].includes(key)) return;
      if (['z', 'y'].includes(key) && !event.ctrlKey && !event.metaKey) return;
      if (
        event.key !== 'Escape' &&
        ((event.target as HTMLElement)?.closest(
          'input,textarea,select,[contenteditable]'
        ) ||
          (key === 'enter' && (event.target as HTMLElement)?.closest('button')))
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === 'Escape') live.current.onCancel();
      else if (event.key === 'Enter') live.current.onFinish();
      else if (key === 'y' || (key === 'z' && event.shiftKey))
        live.current.editor.redo();
      else live.current.editor.undo();
    };
    document.addEventListener('keydown', keys, true);
    return () => document.removeEventListener('keydown', keys, true);
  }, [props.editor.mode]);
  useEffect(() => {
    if (live.current.detail?.kind === 'group') live.current.onDetail(null);
  }, [pointMode]);
  const groupRecords = props.records.filter(
    (record) => record.visible && pointGroup.includes(record.id)
  );
  return (
    <section
      className="geodata-map"
      aria-label={t('Bản đồ dữ liệu GIS', 'GIS data map')}
    >
      <BasemapToneFilters host={host} prepared={false}
        active={base === 'satellite' && !imagerySource.custom && !!analysis?.balanceBasemap &&
          supportsBasemapTone(analysis.layers) && analysisLayer?.kind === 'optical'}/>
      <div className="geodata-map-toolbar">
        <label>
          {t('Nền', 'Base')}
          <select
            aria-label={t('Bản đồ nền GIS', 'GIS basemap')}
            value={base}
            onChange={(event) => setBase(event.target.value as typeof base)}
          >
            <option value="satellite" disabled={basemapUnavailable}>
              {t('Ảnh nền', 'Imagery')}
            </option>
            <option value="terrain" disabled={basemapUnavailable}>
              {t('Địa hình', 'Terrain')}
            </option>
            <option value="none">{t('Không nền', 'None')}</option>
          </select>
        </label>
        {analysis && analysis.layers.length > 0 && (
          <label>
            {t('Ảnh', 'Scene')}
            <select aria-label={t('Ảnh phân tích', 'Analysis imagery')} value={analysisChoice}
              onChange={event => { const [layer, sarMode] = event.target.value.split(':'); analysis.setSelection({ ...analysis.selection, layer: layer || null, ...(sarMode ? { sarMode: sarMode as SarMode } : {}) }); }}>
              <option value="">{t('Tắt ảnh phủ', 'No image overlay')}</option>
              {imageryGroups(analysis.layers).filter(group=>group.layers.length).map(group=><optgroup key={group.kind} label={group.kind==='optical'?t('Quang học','Optical'):'SAR'}>
                {group.layers.flatMap(layer=>layer.kind==='optical'
                  ? [<option key={layer.id} value={layer.id}>{t(...layer.name)}, {acquisitionLabel(layer)}</option>]
                  : availableSarModes(layer).map(mode=><option key={layer.id+mode} value={`${layer.id}:${mode}`}>{t(...layer.name)}, {acquisitionLabel(layer)}, {mode==='rgb'?t('tổ hợp','composite'):mode.toUpperCase()}</option>))}
              </optgroup>)}
            </select>
          </label>
        )}
        {props.intersection && (
          <label>
            <input
              type="checkbox"
              checked={showIntersection}
              onChange={(event) => setShowIntersection(event.target.checked)}
            />
            {t('Phần giao', 'Intersection')}
          </label>
        )}
        {props.records.filter(
          (record) => record.visible && record.feature.geometry.type === 'Point'
        ).length > 1 && (
          <PointRenderingControl locale={props.locale} />
        )}
        {props.scenario && (
          <label>
            <input type="checkbox" checked={showScenario} onChange={(event) => {
              setShowScenario(event.target.checked);
              if (!event.target.checked && scenarioDetail) props.onDetail(null);
            }} />
            {t('Lớp tình huống', 'Scenario layer')}
          </label>
        )}
        {props.records.some((record) => record.visible) && (
          <ul
            className="geodata-map-legend"
            aria-label={t('Chú giải dữ liệu', 'Data legend')}
          >
            {(['reference', 'aoi', 'footprint'] as const)
              .filter((role) =>
                props.records.some(
                  (record) =>
                    record.visible &&
                    record.role === role &&
                    !observationOf(record) && !landslideAreaOf(record) && record.feature.properties.referenceKind !== 'road-corridor'
                )
              )
              .map((role) => (
                <li key={role}>
                  <span
                    className={'geodata-legend-symbol is-' + role}
                    style={{ color: roleColors[role] }}
                    aria-hidden="true"
                  />
                  {role === 'aoi' ? t('Vùng quan tâm', 'AOI') : roleLabel(role, props.locale)}
                </li>
              ))}
            {props.records.some(record => record.visible && landslideAreaOf(record)) && <li>
              <span className="geodata-legend-symbol" style={{ color: landslideBoundaryColor }} aria-hidden="true"/>
              {t('Vùng sạt lở', 'Landslide extents')}
            </li>}
            {props.records.some(record => record.visible && record.feature.properties.referenceKind === 'road-corridor') && <li>
              <svg width="20" height="12" aria-hidden="true"><path d="M0 6h20" stroke={roadColors.referenceCasing} strokeWidth="4"/><path d="M0 6h20" stroke={roadColors.reference} strokeWidth="2"/></svg>
              {t('Đường tham chiếu', 'Reference road')}
            </li>}
            {props.records.some(
              (record) =>
                record.visible &&
                observationOf(record) &&
                observationOf(record)?.kind !== 'survey'
            ) && (
              <li>
                <span className="field-legend-symbol" aria-hidden="true">
                  !
                </span>
                {t('Ghi nhận chưa xác minh', 'Unreviewed observations')}
              </li>
            )}
            {props.records.some(
              (record) =>
                record.visible && observationOf(record)?.kind === 'survey'
            ) && (
              <li>
                <span
                  className="field-legend-symbol is-survey"
                  aria-hidden="true"
                >
                  i
                </span>
                {t('Điểm khảo sát', 'Survey points')}
              </li>
            )}
          </ul>
        )}
        <div className="geodata-map-buttons">
          {(
            [
              [
                'zoomIn',
                t('Phóng to GIS', 'Zoom in GIS'),
                () => mapRef.current?.zoomIn()
              ],
              [
                'zoomOut',
                t('Thu nhỏ GIS', 'Zoom out GIS'),
                () => mapRef.current?.zoomOut()
              ],
              [
                'fit',
                t('Xem tất cả lớp', 'Fit all layers'),
                () => {
                  const points = props.records
                    .filter((r) => r.visible)
                    .flatMap((r) => geometryPositions(r.feature.geometry));
                  if (points.length)
                    mapRef.current?.fitBounds(
                      L.latLngBounds(points.map((p) => L.latLng(p[1], p[0]))),
                      { padding: [36, 36], maxZoom: 15 }
                    );
                }
              ]
            ] as const
          ).map(([icon, name, action]) => (
            <button
              key={icon}
              className="icon-button"
              aria-label={name}
              title={name}
              onClick={action}
            >
              <UiIcon name={icon} />
            </button>
          ))}
        </div>
      </div>
      <div
        ref={host}
        className={
          'geodata-map-surface' + (props.editor.active || props.onPickPoint ? ' is-drawing' : '')
        }
      />
      <div className="geodata-map-footer">
        <span>{cursor || 'WGS84'}</span>
        <span>
          EPSG:3857 <span>{t('Bắc ở trên', 'North up')}</span>
        </span>
      </div>
      {!props.editor.active && !props.onPickPoint && scenarioTarget && props.scenario && (
        <ScenarioFeatureCard
          onRename={props.scenarioEdits?.canEdit ? props.onRenameScenario : undefined}
          key={targetKey(scenarioTarget)}
          scenario={props.scenario}
          mappedAreas={props.records.filter(record => landslideAreaOf(record))}
          onOpenMappedArea={props.onSelect}
          onSelectRelated={props.onSelectScenario}
          target={scenarioTarget}
          edits={props.scenarioEdits?.edits ?? []}
          readOnly={!props.scenarioEdits?.canEdit}
          locale={props.locale}
          moving={scenarioMoving}
          pending={scenarioPending}
          onStartMove={() => updateScenario({ moving: true })}
          onPreviewPosition={pending => updateScenario({moving:true,pending})}
          onPickPosition={() => props.onPickScenarioPosition?.()}
          onResponse={props.onResponseScenario ? () => props.onResponseScenario!(scenarioTarget) : undefined}
          onCancelMove={() => updateScenario({ moving: false, pending: null })}
          onRecord={(change, note, name) => {
            const site = scenarioTarget.type === 'site' ? props.scenario?.responseSites.find(s => s.id === scenarioTarget.id) : undefined;
            const reviewed = change.kind === 'move' && site?.kind === 'hlz' ? {...change,fromAssessment:site.assessment,toAssessment:'candidate' as const} : change;
            const saved = props.scenarioEdits?.record({ target: { ...scenarioTarget, name }, change: reviewed, note }) ?? false;
            if (saved) {
              updateScenario({ moving: false, pending: null });
              props.onScenarioNotice?.(['Đã sửa đối tượng trong bản nháp.','Feature updated in draft.']);
            }
            return saved;
          }}
          onRevert={(id, note) => props.scenarioEdits?.revert(id, note) ?? false}
          onClose={() => props.onDetail(null)}
        />
      )}
      {props.onPickPoint && <div className="scenario-pick-bar" role="status"><span>{props.pickLabel ? props.pickLabel[props.locale === 'vi' ? 0 : 1] : t('Chọn vị trí trên bản đồ.', 'Choose a point on the map.')}</span><button className="button" onClick={props.onCancelPick}>{t('Hủy', 'Cancel')}</button></div>}
      {!props.editor.active && !props.onPickPoint && groupRecords.length > 1 && (
        <PointGroupCard key={pointGroup.join('|')}
          records={groupRecords}
          locale={props.locale}
          activeId={props.selectedId}
          openLabel={t('Chọn để xem hồ sơ', 'Select to inspect')}
          onOpen={props.onSelect}
          onClose={() => props.onDetail(null)}
        />
      )}
      <MapAttribution
        locale={props.locale}
        state={{ ...source, provider: 'configured' }}
        onRetry={() => setRetry((value) => value + 1)}
      />
    </section>
  );
}
