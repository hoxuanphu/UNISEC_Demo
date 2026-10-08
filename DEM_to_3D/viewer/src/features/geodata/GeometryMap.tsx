import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { geometryPositions, type GeometryRecord } from '../../geo/vector/types';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { MapAttribution } from '../../components/dear/MapAttribution';
import type { BasemapState } from '../map/mapContracts';
import { roleColors } from './geometryPresentation';
import { vertexHandles } from './geometryEditing';
import type { useGeometryEditor } from './useGeometryEditor';

type Props = {
  records: GeometryRecord[];
  selectedId: string | null;
  locale: Locale;
  offline: boolean;
  viewRequest: { version: number; id: string | null };
  onSelect: (id: string) => void;
  editor: ReturnType<typeof useGeometryEditor>;
  snapping: boolean;
  onFinish: () => void;
  onCancel: () => void;
  intersection: Feature<Polygon | MultiPolygon> | null;
};

export function GeometryMap(props: Props): JSX.Element {
  const t = (vi: string, en: string) => (props.locale === 'vi' ? vi : en);
  const host = useRef<HTMLDivElement>(null),
    mapRef = useRef<L.Map | null>(null);
  const previewRef = useRef<L.Polyline | null>(null);
  const snapRef = useRef<L.CircleMarker | null>(null);
  const snapPosition = useRef<(position: L.LatLng) => L.LatLng>((position) => position);
  const live = useRef(props);
  live.current = props;
  const [ready, setReady] = useState(false),
    [base, setBase] = useState<'none' | 'satellite' | 'terrain'>(
      props.offline ? 'none' : 'satellite'
    );
  const [showIntersection, setShowIntersection] = useState(true),
    [cursor, setCursor] = useState('');
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
          setCursor(`${event.latlng.lat.toFixed(5)}°, ${event.latlng.lng.toFixed(5)}°`);
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
      else preview.setLatLngs(editor.mode === 'polygon' && last ? [[last[1], last[0]], point] : []);
    };
    const click = (event: L.LeafletMouseEvent) => {
      const { editor } = live.current;
      if (!['polygon', 'rectangle'].includes(editor.mode) || event.originalEvent.detail >= 2)
        return;
      const vertices = editor.draft.vertices;
      const near = (point: number[], pixels: number) =>
        map.latLngToContainerPoint([point[1], point[0]]).distanceTo(event.containerPoint) <= pixels;
      if (vertices.length >= 3 && near(vertices[0], 10)) {
        live.current.onFinish();
        return;
      }
      if (vertices.length && near(vertices[vertices.length - 1], 3)) return;
      const point = snap(event.latlng);
      if (vertices.length < 1499) editor.add([point.lng, point.lat]);
      if (editor.mode === 'rectangle' && vertices.length === 1) live.current.onFinish();
    };
    const double = () => {
      if (live.current.editor.mode === 'polygon') live.current.onFinish();
    };
    map.on('mousemove', move).on('click', click).on('dblclick', double);
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(host.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      map.remove();
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
    let loaded = 0,
      total = 0,
      failed = 0,
      disposed = false;
    const publish = (status: BasemapState['status']) => {
      if (!disposed) setSource({ status, style: base, loaded, total });
    };
    const layer = L.tileLayer(
      `https://tiles.maps.eox.at/wmts/1.0.0/${base === 'satellite' ? 's2cloudless_3857' : 'terrain-light_3857'}/default/g/{z}/{y}/{x}.jpg`,
      {
        maxNativeZoom: 14,
        maxZoom: 19,
        noWrap: true,
        keepBuffer: 1,
        updateWhenIdle: true
      }
    );
    layer.on('loading', () => {
      loaded = 0;
      total = 0;
      failed = 0;
      publish('loading');
    });
    layer
      .on('tileloadstart', () => total++)
      .on('tileload', () => {
        loaded++;
        publish('loading');
      })
      .on('tileerror', () => {
        failed++;
        publish(loaded ? 'partial' : 'error');
      })
      .on('load', () => publish(failed ? (loaded ? 'partial' : 'error') : 'ready'))
      .addTo(map);
    return () => {
      disposed = true;
      layer.remove();
    };
  }, [ready, base, retry]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const group = L.layerGroup().addTo(map);
    for (const record of props.records.filter(
      (record) =>
        record.visible && !(props.editor.mode === 'edit' && record.id === props.editor.recordId)
    )) {
      const color = roleColors[record.role],
        selected = record.id === props.selectedId;
      const pane =
        record.feature.geometry.type === 'Point' ? 'points' : selected ? 'selected' : record.role;
      const layer = L.geoJSON(record.feature, {
        pane,
        style: {
          color,
          weight: selected ? 3 : 1.5,
          fillOpacity: selected ? 0.15 : 0.06,
          dashArray: record.role === 'footprint' ? '7 4' : undefined,
          interactive: !props.editor.active
        },
        pointToLayer: (_, position) =>
          L.circleMarker(position, {
            pane: 'points',
            radius: selected ? 7 : 5,
            color: '#ffffff',
            weight: 2,
            fillColor: color,
            fillOpacity: 1,
            interactive: !props.editor.active
          })
      }).addTo(group);
      const label = document.createElement('span');
      label.textContent = record.name;
      if (!props.editor.active)
        layer
          .bindTooltip(label, {
            permanent: selected,
            direction: 'top',
            className: 'geodata-map-label'
          })
          .on('click', (event) => {
            L.DomEvent.stopPropagation(event.originalEvent);
            live.current.onSelect(record.id);
          });
      if (!props.editor.active && record.feature.geometry.type === 'LineString') {
        L.geoJSON(record.feature, { pane, style: { weight: 12, opacity: 0 } })
          .on('click', (event) => {
            L.DomEvent.stopPropagation(event.originalEvent);
            live.current.onSelect(record.id);
          })
          .addTo(group);
      }
    }
    if (showIntersection && props.intersection)
      L.geoJSON(props.intersection, {
        pane: 'intersection',
        style: {
          color: roleColors.aoi,
          weight: 1,
          fillOpacity: 0.22,
          interactive: false
        }
      }).addTo(group);
    if (props.editor.mode === 'edit' && props.editor.draft.geometry) {
      const draft: Feature = {
        type: 'Feature',
        geometry: props.editor.draft.geometry,
        properties: {}
      };
      L.geoJSON(draft, {
        pane: 'drawing',
        style: {
          color: roleColors.aoi,
          weight: 3,
          fillOpacity: 0.12,
          interactive: false
        },
        pointToLayer: (_, position) =>
          L.circleMarker(position, {
            radius: 7,
            color: roleColors.aoi,
            interactive: false
          })
      }).addTo(group);
      vertexHandles(props.editor.draft.geometry).forEach(({ path, coordinate }, index) => {
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
          snapPosition.current(marker.getLatLng());
        });
        marker.on('dragend', () => {
          const point = snapPosition.current(marker.getLatLng());
          snapRef.current?.remove();
          live.current.editor.move(path, [point.lng, point.lat]);
        });
      });
    }
    if (props.editor.draft.vertices.length) {
      const positions = props.editor.draft.vertices.map((p) => L.latLng(p[1], p[0]));
      L.polyline(positions, {
        pane: 'drawing',
        color: roleColors.aoi,
        weight: 2,
        interactive: false
      }).addTo(group);
      positions.forEach((position) =>
        L.circleMarker(position, {
          pane: 'drawing',
          radius: 4,
          color: 'white',
          weight: 1.5,
          fillColor: roleColors.aoi,
          fillOpacity: 1,
          interactive: false
        }).addTo(group)
      );
    }
    return () => {
      group.remove();
    };
  }, [
    ready,
    props.records,
    props.selectedId,
    props.editor.mode,
    props.editor.draft,
    props.intersection,
    showIntersection
  ]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || props.viewRequest.version === 0) return;
    const records = props.records.filter((record) =>
      props.viewRequest.id ? record.id === props.viewRequest.id : record.visible
    );
    const points = records
      .flatMap((record) => geometryPositions(record.feature.geometry))
      .map((p) => L.latLng(p[1], p[0]));
    if (points.length)
      map.fitBounds(L.latLngBounds(points), {
        padding: [36, 36],
        maxZoom: 15,
        animate: false
      });
  }, [ready, props.viewRequest]);
  useEffect(() => {
    const map = mapRef.current;
    previewRef.current?.setLatLngs([]);
    snapRef.current?.remove();
    if (props.editor.active) map?.doubleClickZoom.disable();
    else map?.doubleClickZoom.enable();
    if (!props.editor.active) return;
    const keys = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!['enter', 'escape', 'backspace', 'z', 'y'].includes(key)) return;
      if (['z', 'y'].includes(key) && !event.ctrlKey && !event.metaKey) return;
      if (
        event.key !== 'Escape' &&
        ((event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]') ||
          (key === 'enter' && (event.target as HTMLElement)?.closest('button')))
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === 'Escape') live.current.onCancel();
      else if (event.key === 'Enter') live.current.onFinish();
      else if (key === 'y' || (key === 'z' && event.shiftKey)) live.current.editor.redo();
      else live.current.editor.undo();
    };
    document.addEventListener('keydown', keys, true);
    return () => document.removeEventListener('keydown', keys, true);
  }, [props.editor.mode]);
  return (
    <section className="geodata-map" aria-label={t('Bản đồ dữ liệu GIS', 'GIS data map')}>
      <div className="geodata-map-toolbar">
        <label>
          {t('Nền', 'Base')}
          <select
            aria-label={t('Bản đồ nền GIS', 'GIS basemap')}
            value={base}
            onChange={(event) => setBase(event.target.value as typeof base)}
          >
            <option value="satellite" disabled={props.offline}>
              {t('Ảnh nền', 'Imagery')}
            </option>
            <option value="terrain" disabled={props.offline}>
              {t('Địa hình', 'Terrain')}
            </option>
            <option value="none">{t('Không nền', 'None')}</option>
          </select>
        </label>
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
        <div className="geodata-map-buttons">
          {(
            [
              ['zoomIn', t('Phóng to GIS', 'Zoom in GIS'), () => mapRef.current?.zoomIn()],
              ['zoomOut', t('Thu nhỏ GIS', 'Zoom out GIS'), () => mapRef.current?.zoomOut()],
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
        className={'geodata-map-surface' + (props.editor.active ? ' is-drawing' : '')}
      />
      <div className="geodata-map-footer">
        <span>{cursor || 'WGS84'}</span>
        <span>
          EPSG:3857 · <span aria-label={t('Bắc', 'North')}>N ↑</span>
        </span>
      </div>
      <MapAttribution
        locale={props.locale}
        state={source}
        onRetry={() => setRetry((value) => value + 1)}
      />
    </section>
  );
}
