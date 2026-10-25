import './analysis-imagery.css';
import { acquisitionLabel, availableSarModes, imageryGroups, sarModeForLayer, type AnalysisLayer, type AnalysisSelection } from './analysisImagery';
import { UiIcon } from '../../shared/ui/UiIcon';

type Props = { locale: 'vi' | 'en'; layers: AnalysisLayer[]; selection: AnalysisSelection; onChange: (selection: AnalysisSelection) => void; onFit?: () => void; externalActive?: boolean };

/** One analysis raster at a time over the basemap: switching layers is the comparison. */
export function AnalysisImageryControl({ locale, layers, selection, onChange, onFit, externalActive = false }: Props) {
  const t = (vi: string, en: string) => locale === 'en' ? en : vi;
  const active = layers.find(layer => layer.id === selection.layer);
  const set = (patch: Partial<AnalysisSelection>) => onChange({ ...selection, ...patch });
  const mode = active?.kind === 'sar' ? sarModeForLayer(active,selection.sarMode) : selection.sarMode;
  const range = active?.kind === 'sar' && mode !== 'rgb' ? active.rangesDb[mode] : undefined;
  return <fieldset className="map-layer-group analysis-imagery" aria-label={t('Ảnh phân tích', 'Analysis imagery')}>
    <label className="analysis-off"><input type="radio" name="analysis-imagery" checked={!active && !externalActive} onChange={() => set({ layer: null })}/>{t('Tắt ảnh phủ', 'No image overlay')}</label>
    {imageryGroups(layers).filter(group=>group.layers.length).map(group=><fieldset className="analysis-catalog-group" key={group.kind}>
      <legend>{group.kind === 'optical' ? t('Quang học', 'Optical') : 'SAR'}</legend>
      {group.layers.map(layer => <label key={layer.id} className={active?.id === layer.id ? 'is-selected' : ''}>
        <input type="radio" name="analysis-imagery" checked={selection.layer === layer.id} onChange={() => set({ layer: layer.id, sarMode: layer.kind === 'sar' ? sarModeForLayer(layer,selection.sarMode) : selection.sarMode })}/>
        <span>{t(...layer.name)}<small>{acquisitionLabel(layer)}{layer.kind === 'sar' ? `, ${availableSarModes(layer).filter(mode=>mode!=='rgb').map(mode=>mode.toUpperCase()).join(', ')}` : ''}</small></span>
      </label>)}
    </fieldset>)}
    {active && <div className="analysis-active-details">
    {onFit && <button type="button" className="button analysis-fit" onClick={onFit}><UiIcon name="fit" size={16}/>{t('Xem vùng ảnh', 'Fit image coverage')}</button>}
    {active?.kind === 'sar' && <>
      {availableSarModes(active).length > 1 && <div className="analysis-sar-modes" role="radiogroup" aria-label={t('Kênh SAR', 'SAR channel')}>
        {availableSarModes(active).map(value => <button key={value} type="button" role="radio" aria-checked={mode === value} onClick={() => set({ sarMode: value })}>{value === 'rgb' ? t('Tổ hợp', 'Composite') : value.toUpperCase()}</button>)}
      </div>}
      {mode === 'rgb'
        ? <p className="analysis-legend">R: VV, G: VH, B: VV/VH</p>
        : range && <p className="analysis-legend"><span>{range[0]} dB</span><i aria-hidden="true"/><span>{range[1]} dB</span></p>}
      <p className="analysis-note">{active.nativePixelM
        ? t(`Pixel nguồn ${active.nativePixelM.toLocaleString('vi-VN')} m, hiển thị ${active.pixelM} m.`, `Source pixels ${active.nativePixelM} m, display ${active.pixelM} m.`)
        : t(`Pixel hiển thị ${active.pixelM} m.`, `Display pixels ${active.pixelM} m.`)}</p>
      <p className="analysis-note">{t('Độ sáng SAR không tự xác nhận sạt lở.', 'SAR brightness alone does not confirm a landslide.')}</p>
    </>}
    {active?.kind === 'optical' && <p className="analysis-note" title={t('Ngoài vùng phủ ảnh PlanetScope là nền bản đồ khu vực.', 'Outside PlanetScope coverage, the regional basemap remains visible.')}>{active.mosaic ? t(`Ảnh ghép ${active.parts.length} dải, chi tiết gốc khoảng `, `${active.parts.length}-strip mosaic, native detail about `) : t('Chi tiết gốc khoảng ', 'Native detail about ')}{Math.max(...active.parts.map(part => part.gsdM ?? part.pixelM)).toLocaleString(locale, {maximumFractionDigits:1})} m</p>}
    {active && <label className="analysis-opacity">{t('Độ rõ ảnh phủ', 'Overlay opacity')}<output>{Math.round(selection.opacity * 100)}%</output>
      <input type="range" min="30" max="100" value={selection.opacity * 100} aria-label={t('Độ rõ ảnh phân tích', 'Analysis imagery opacity')} onChange={event => set({ opacity: Number(event.target.value) / 100 })}/>
    </label>}
    </div>}
    <p className="analysis-note analysis-order-note">{t('Mỗi lần xem một ảnh. Ngày chụp được ghi dưới tên ảnh.', 'View one image at a time. Acquisition dates appear below each name.')}</p>
  </fieldset>;
}
