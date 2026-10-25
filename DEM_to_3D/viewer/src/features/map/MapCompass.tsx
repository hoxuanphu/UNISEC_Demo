import type { Locale } from '../../types/dear';
import './map-compass.css';

/**
 * The map is drawn north up, so the rose is fixed: north at the top, the four directions around it.
 * On a phone that reports its heading, tapping it shows the way the phone faces on your own dot.
 */
export function MapCompass({ locale, supported, active, heading, onToggle }: {
  locale: Locale; supported: boolean; active: boolean; heading: number | null; onToggle: () => void;
}): JSX.Element {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [n, e, s, w] = locale === 'vi' ? ['B', 'Đ', 'N', 'T'] : ['N', 'E', 'S', 'W'];
  const rose = <svg viewBox="0 0 44 44" aria-hidden="true">
    <path className="map-compass-north" d="M22 7 26 22h-8Z"/><path className="map-compass-south" d="M22 37 18 22h8Z"/>
    <text x="22" y="6.5" className="is-north">{n}</text><text x="39" y="23.5">{e}</text><text x="22" y="41">{s}</text><text x="5" y="23.5">{w}</text>
  </svg>;
  const label = active && heading !== null ? t(`Bạn đang nhìn hướng ${heading}°`, `Facing ${heading}°`) : t('Phía trên là hướng Bắc', 'North is up');
  if (!supported) return <div className="map-compass" role="img" aria-label={label} title={label}>{rose}</div>;
  return <button type="button" className="map-compass" aria-pressed={active} aria-label={active ? label : t('Hiện hướng bạn đang nhìn', 'Show the way you face')}
    title={active ? label : t('Hiện hướng bạn đang nhìn', 'Show the way you face')} onClick={onToggle}>{rose}</button>;
}
