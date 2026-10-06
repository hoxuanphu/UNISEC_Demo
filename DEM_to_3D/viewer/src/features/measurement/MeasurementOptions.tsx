import type { Locale } from '../../types/dear';
import type { MeasureMode } from './measurement';
import type { MeasureUnits } from './measurementResults';

type Props = {
  mode: MeasureMode; units: MeasureUnits; onUnits: (units: MeasureUnits) => void;
  snap: boolean; onSnap: (value: boolean) => void; labels: boolean; onLabels: (value: boolean) => void; locale: Locale;
};
export function MeasurementOptions({ mode, units, onUnits, snap, onSnap, labels, onLabels, locale }: Props) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  return <div className="measure-options">
    {!['location', 'angle'].includes(mode) && <label><span>{t('Độ dài', 'Length units')}</span><select value={units.distance} aria-label={t('Đơn vị độ dài', 'Length units')} onChange={event => onUnits({ ...units, distance: event.target.value as MeasureUnits['distance'] })}><option value="auto">{t('Tự động', 'Automatic')}</option><option value="m">m</option><option value="km">km</option></select></label>}
    {['area', 'radius'].includes(mode) && <label><span>{t('Diện tích', 'Area units')}</span><select value={units.area} aria-label={t('Đơn vị diện tích', 'Area units')} onChange={event => onUnits({ ...units, area: event.target.value as MeasureUnits['area'] })}><option value="auto">{t('Tự động', 'Automatic')}</option><option value="m2">m²</option><option value="ha">ha</option><option value="km2">km²</option></select></label>}
    <label className="measure-checkbox"><input type="checkbox" checked={snap} onChange={event => onSnap(event.target.checked)}/><span>{t('Bắt vào đối tượng hiển thị', 'Snap to visible features')}</span></label>
    <label className="measure-checkbox"><input type="checkbox" checked={labels} onChange={event => onLabels(event.target.checked)}/><span>{t('Hiện kết quả trên bản đồ', 'Show results on map')}</span></label>
    <dl className="measure-method"><div><dt>{t('Phương pháp', 'Method')}</dt><dd>{mode === 'location' ? 'WGS84' : t('Mặt phẳng UTM 48N', 'UTM 48N planar')}</dd></div>{mode === 'bearing' && <div><dt>{t('Mốc phương vị', 'Reference north')}</dt><dd>{t('Bắc lưới', 'Grid north')}</dd></div>}</dl>
  </div>;
}