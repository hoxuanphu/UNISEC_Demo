import { useEffect, useRef, useState } from 'react';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { useFloatingPanel } from '../../shared/hooks/useFloatingPanel';
import type { MapLocation } from './mapLocation';

export function MapLocationPanel({ locale, point, onClose }: { locale: Locale; point: MapLocation | null; onClose: () => void }): JSX.Element {
  const root = useRef<HTMLElement>(null);
  const floating = useFloatingPanel(root, 'location');
  const [format, setFormat] = useState<'wgs84' | 'projected'>('wgs84');
  const [copied, setCopied] = useState<'ready' | 'done' | 'error'>('ready');
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  useEffect(() => { setCopied('ready'); }, [point, format]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); onClose(); } };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);
  const projected = format === 'projected' && point?.projected;
  const rows = point ? projected
    ? [[point.crs === 'EPSG:32648' ? 'E (m)' : 'X', projected.x.toFixed(1)], [point.crs === 'EPSG:32648' ? 'N (m)' : 'Y', projected.y.toFixed(1)]]
    : [[t('Vĩ độ', 'Latitude'), point.latitude.toFixed(6) + '°'], [t('Kinh độ', 'Longitude'), point.longitude.toFixed(6) + '°']] : [];
  const copy = async () => {
    if (!point) return;
    try {
      await navigator.clipboard.writeText([format === 'projected' ? point.crs : 'WGS84 (EPSG:4326)',
        ...rows.map(([label, value]) => `${label}: ${value}`),
        ...(point.elevation === undefined ? [] : [`${t('Độ cao', 'Elevation')}: ${point.elevation.toFixed(1)} m`])].join('\n'));
      setCopied('done');
    } catch { setCopied('error'); }
  };
  return <section className="map-location-panel" ref={root} aria-label={t('Thông tin vị trí', 'Location information')}>
    <div className="map-location-heading floating-panel-handle" {...floating} tabIndex={0} role="group" aria-label={t('Vị trí bảng tọa độ', 'Location panel position')} title={t('Kéo để đổi vị trí. Nhấp đúp để đặt lại.', 'Drag to move. Double-click to reset.')}>
      <strong>{t('Thông tin vị trí', 'Location information')}</strong>
      <button className="icon-button" onClick={onClose} aria-label={t('Đóng thông tin vị trí', 'Close location information')}><UiIcon name="close" size={16}/></button>
    </div>
    <div className="map-location-body">{point ? <>
      <select aria-label={t('Hệ tọa độ', 'Coordinate system')} value={projected ? 'projected' : 'wgs84'} onChange={event => setFormat(event.target.value as 'wgs84' | 'projected')}>
        <option value="wgs84">WGS84</option>{point.projected && <option value="projected">{point.crs === 'EPSG:32648' ? 'UTM 48N' : point.crs}</option>}
      </select>
      <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}<div><dt>{t('Độ cao', 'Elevation')}</dt><dd>{point.elevation === undefined ? t('Chưa có dữ liệu', 'No data') : `${point.elevation.toFixed(1)} m`}</dd></div></dl>
      <button className="icon-button" onClick={copy} aria-label={copied === 'done' ? t('Đã sao chép', 'Copied') : t('Sao chép tọa độ', 'Copy coordinates')} title={copied === 'done' ? t('Đã sao chép', 'Copied') : t('Sao chép tọa độ', 'Copy coordinates')}><UiIcon name={copied === 'done' ? 'check' : 'copy'} size={16}/></button>
      {copied === 'error' && <p role="status">{t('Không sao chép được. Chọn trực tiếp phần tọa độ để sao chép.', 'Copy failed. Select the coordinate text to copy.')}</p>}
    </> : <p>{t('Chọn một điểm trên bản đồ.', 'Select a point on the map.')}</p>}</div>
  </section>;
}
