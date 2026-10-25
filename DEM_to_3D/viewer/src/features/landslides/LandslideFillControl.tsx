import type { Locale } from '../../types/dear';
import { useLandslideAppearance } from './useLandslideAppearance';
import './landslide-appearance.css';

export function LandslideFillControl({locale, disabled = false}: {locale: Locale; disabled?: boolean}) {
  const {fillOpacity, setFillOpacity} = useLandslideAppearance();
  const label = locale === 'vi' ? 'Độ phủ màu' : 'Fill opacity';
  return <label className="landslide-fill-control">
    <span>{label}</span><output>{Math.round(fillOpacity * 100)}%</output>
    <input type="range" aria-label={label} min="0" max="100" step="1" value={Math.round(fillOpacity * 100)} disabled={disabled}
      onChange={event => setFillOpacity(Number(event.target.value) / 100)}/>
  </label>;
}
