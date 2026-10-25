import './terrain-overlays.css';
import type { useTerrainOverlays } from './useTerrainOverlays';

type Props = { locale: 'vi' | 'en'; mapMode: '2d' | '3d'; hasGrid: boolean; overlays: ReturnType<typeof useTerrainOverlays> };

export function TerrainOverlayControls({ locale, mapMode, hasGrid, overlays }: Props) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const { options, setOptions } = overlays;
  const enabled = mapMode === '3d';
  return <fieldset className="map-layer-group terrain-overlay-controls">
    <legend>{t('Lớp địa hình 3D', '3D terrain overlays')}</legend>
    <label><input type="checkbox" disabled={!enabled || !hasGrid} checked={options.contours} onChange={event => setOptions(previous => ({ ...previous, contours: event.target.checked }))}/>{t('Đường đồng mức', 'Elevation contours')}</label>
    {options.contours && <label className="terrain-overlay-field"><span>{t('Khoảng cao độ', 'Contour interval')}</span><select aria-label={t('Khoảng cao độ', 'Contour interval')} disabled={!enabled} value={options.interval} onChange={event => setOptions(previous => ({ ...previous, interval: Number(event.target.value) }))}>{[20, 50, 100, 200, 500].map(value => <option key={value} value={value}>{value} m</option>)}</select></label>}
    {overlays.status && !options.sar && <p role="status">{overlays.status}</p>}
    {!enabled && <small>{t('Chỉ dùng trong bản đồ 3D.', 'Available in the 3D map.')}</small>}
  </fieldset>;
}

/** A private raster belongs with imagery, independent of contour controls. */
export function SarRasterControl({locale,mapMode,overlays,onActivate}:Omit<Props,'hasGrid'> & {onActivate:()=>void}) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const {options,setOptions}=overlays;
  const enabled=mapMode==='3d';
  return <details className="terrain-sar-controls terrain-overlay-controls">
    <summary>{t('GeoTIFF riêng (3D)', 'Local GeoTIFF (3D)')}</summary>
    <label className="terrain-overlay-field terrain-raster-upload"><span>{t('Nhập lớp SAR GeoTIFF', 'Import SAR GeoTIFF')}</span><input type="file" accept=".tif,.tiff" disabled={!enabled || overlays.busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) { onActivate();void overlays.importSar(file); } }}/></label>
    {overlays.busy && <p role="status">{t('Đang đọc raster', 'Reading raster')}</p>}
    {overlays.status && options.sar && <p role="status">{overlays.status}</p>}
    {options.sar && <>
      <label><input type="checkbox" disabled={!enabled} checked={options.sarVisible} onChange={event => {if(event.target.checked)onActivate();setOptions(previous => ({ ...previous, sarVisible: event.target.checked }));}}/><span style={{overflowWrap:'anywhere'}}>{options.sar.name}</span></label>
      <label className="terrain-overlay-field"><span>{t('Kênh SAR', 'SAR band')}</span><select aria-label={t('Kênh SAR', 'SAR band')} disabled={!enabled} value={options.band} onChange={event => setOptions(previous => ({ ...previous, band: Number(event.target.value) }))}>{options.sar.bands.map(band => <option key={band.index} value={band.index}>{band.label}</option>)}</select></label>
      <label className="terrain-overlay-field terrain-overlay-opacity"><span>{t('Độ rõ lớp SAR', 'SAR opacity')}</span><output>{Math.round(options.opacity * 100)}%</output><input aria-label={t('Độ rõ lớp SAR', 'SAR opacity')} type="range" disabled={!enabled} min="0" max="100" value={options.opacity * 100} onChange={event => setOptions(previous => ({ ...previous, opacity: Number(event.target.value) / 100 }))}/></label>
      <small>{t('Ảnh SAR giãn tương phản, chưa phân loại.', 'Contrast-stretched SAR, unclassified.')}</small>
      <button type="button" className="text-button" onClick={() => void overlays.importSar(null)}>{t('Gỡ lớp SAR', 'Remove SAR layer')}</button>
    </>}
    {overlays.error && <p role="alert">{overlays.error}</p>}
    {!enabled && <small>{t('Chỉ dùng trong bản đồ 3D.', 'Available in the 3D map.')}</small>}
  </details>;
}
