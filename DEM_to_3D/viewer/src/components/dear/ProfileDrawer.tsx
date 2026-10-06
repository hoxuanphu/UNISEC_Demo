import { useEffect, useMemo, useState } from 'react';
import type { Locale } from '../../types/dear';
import { ProfileChart } from '../ProfileChart';
import type { SurfaceProfile } from '../../terrain/profile';
import { nearestProfileSample, profileGrade, profileMetrics } from '../../terrain/profileMetrics';
import { UiIcon } from './UiIcon';

type Props = {
  locale: Locale;
  name: string;
  profile: SurfaceProfile | null;
  onHoverDistance: (distance: number | null) => void;
  onClose: () => void;
};

export function ProfileDrawer({ locale, name, profile, onHoverDistance, onClose }: Props): JSX.Element | null {
  const [distance, setDistance] = useState(0);
  const metrics = useMemo(() => profile ? profileMetrics(profile) : null, [profile]);
  useEffect(() => { setDistance(0); onHoverDistance(profile ? 0 : null); }, [profile, onHoverDistance]);
  const t = (vi: string, en: string) => locale === 'en' ? en : vi;
  if (!profile || !metrics) return null;
  const current = nearestProfileSample(profile, distance);
  const grade = profileGrade(profile, current.index);
  const value = (n: number | undefined, unit: string) => n === undefined ? t('Không có dữ liệu', 'No data') : `${Math.round(n)} ${unit}`;
  const selectDistance = (next: number | null) => {
    if (next === null) return;
    const sample = nearestProfileSample(profile, next);
    setDistance(sample.distance);
    onHoverDistance(sample.distance);
  };
  return <section className="profile-panel" aria-label={t('Địa hình dọc tuyến', 'Terrain along route')}>
    <div className="profile-heading">
      <div><strong>{t('Mặt cắt địa hình', 'Elevation profile')}</strong><span className="small profile-target-name" title={name}>{name}</span><span className="small">{(profile.length / 1000).toFixed(2)} km</span></div>
      <button className="icon-button" onClick={onClose} aria-label={t('Đóng mặt cắt', 'Close profile')}><UiIcon name="close" /></button>
    </div>
    <dl className="profile-stats">
      <div><dt>{t('Thấp nhất', 'Lowest')}</dt><dd>{value(metrics.min, 'm')}</dd></div>
      <div><dt>{t('Cao nhất', 'Highest')}</dt><dd>{value(metrics.max, 'm')}</dd></div>
      {metrics.complete && <><div><dt>{t('Độ cao tăng', 'Elevation gain')}</dt><dd>{value(metrics.ascent, 'm')}</dd></div><div><dt>{t('Độ cao giảm', 'Elevation loss')}</dt><dd>{value(metrics.descent, 'm')}</dd></div></>}
      {!metrics.complete && <div className="profile-coverage"><dt>{t('Tỷ lệ tuyến có DEM', 'DEM coverage')}</dt><dd>{Math.round(metrics.coverage * 100)}%</dd></div>}
    </dl>
    <div className="profile-body">
      <div className="profile-chart-container"><ProfileChart compact locale={locale} profile={profile} selectedDistance={current.distance} onHoverDistance={selectDistance} /></div>
      <div className="profile-controls">
        <label htmlFor="profile-dist-slider">{t('Vị trí trên mặt cắt', 'Position along profile')}</label>
        <input id="profile-dist-slider" type="range" min={0} max={profile.length} step={profile.sampleInterval} value={distance} onChange={e => selectDistance(Number(e.target.value))} />
        <dl className="profile-readout">
          <div><dt>{t('Khoảng cách', 'Distance')}</dt><dd>{(current.distance / 1000).toFixed(2)} km</dd></div>
          <div><dt>{t('Độ cao', 'Elevation')}</dt><dd>{value(current.elevation, 'm')}</dd></div>
          <div><dt>{t('Độ dốc địa hình', 'DEM path slope')}</dt><dd>{grade === undefined ? t('Không có dữ liệu', 'No data') : `${grade > 0 ? '+' : ''}${grade.toFixed(1)}%`}</dd></div>
        </dl>
        <p className="profile-method-note" title={t('Khoảng cách giữa các mẫu độ cao theo lưới DEM', 'Elevation sample spacing from the DEM grid')}>DEM · {Math.round(profile.sampleInterval)} m</p>
      </div>
    </div>
  </section>;
}
