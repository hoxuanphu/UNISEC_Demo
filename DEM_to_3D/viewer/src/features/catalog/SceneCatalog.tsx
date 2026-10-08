import { useState } from 'react';
import type { GeometryRecord } from '../../geo/vector/types';
import { isPolygon } from '../../geo/vector/types';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import {
  reviewScenePair,
  searchImagery,
  type ImageryCatalog,
  type ImageryScene
} from './imageryCatalog';
import './catalog.css';

export type SceneResult = ReturnType<typeof searchImagery>[number];
export function SceneCatalog({
  locale,
  catalog,
  error,
  onRetry,
  aoi,
  results,
  queryAoi,
  selected,
  onSelection,
  onResults,
  onInspect,
  onAdd,
  onExport,
  disabled
}: {
  locale: Locale;
  catalog: ImageryCatalog | null;
  error: boolean;
  onRetry: () => void;
  aoi: GeometryRecord | undefined;
  results: SceneResult[];
  queryAoi: string | null;
  selected: string[];
  onSelection: (ids: string[]) => void;
  onResults: (results: SceneResult[], signature: string) => void;
  onInspect: (scene: ImageryScene) => void;
  onAdd: () => void;
  onExport: () => void;
  disabled: boolean;
}): JSX.Element {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);
  const [sensor, setSensor] = useState('sar'),
    [from, setFrom] = useState('2026-09-01'),
    [to, setTo] = useState('2026-10-08'),
    [cloud, setCloud] = useState('30');
  const [formError, setFormError] = useState(''),
    [page, setPage] = useState(1);
  const signature = aoi ? JSON.stringify(aoi.feature.geometry) : '';
  const stale = queryAoi !== null && queryAoi !== signature;
  const scenes = catalog?.scenes.filter((scene) => selected.includes(scene.id)) ?? [];
  const pair =
    aoi && isPolygon(aoi.feature.geometry)
      ? reviewScenePair(scenes, aoi.feature.geometry)
      : 'count';
  const pairText = {
    count: t(
      'Chọn hai cảnh để kiểm cặp thời gian.',
      'Select two scenes to review a temporal pair.'
    ),
    sensor: t('Khác collection hoặc mức xử lý.', 'Different collections or processing levels.'),
    time: t('Hai cảnh cùng thời điểm thu nhận.', 'Both scenes have the same acquisition time.'),
    orbit: t(
      'Thông số SAR thiếu hoặc không khớp.',
      'SAR acquisition metadata is missing or incompatible.'
    ),
    coverage: t(
      'Cặp ảnh không có vùng chung trong AOI.',
      'The pair has no common extent inside the AOI.'
    ),
    'metadata-only': t(
      'Metadata phù hợp. Chưa kiểm raster, mask và đồng đăng ký.',
      'Metadata is compatible. Raster, masks and coregistration are not checked.'
    )
  }[pair];
  if (error)
    return (
      <section className="geodata-section" role="alert">
        <h2>{t('Catalog không tải được', 'Catalog unavailable')}</h2>
        <button className="button" onClick={onRetry}>
          {t('Thử lại', 'Retry')}
        </button>
      </section>
    );
  if (!catalog)
    return (
      <section className="geodata-section" role="status">
        {t('Đang tải catalog…', 'Loading catalog…')}
      </section>
    );
  return (
    <fieldset className="scene-catalog" disabled={disabled}>
      <section className="geodata-section">
        <h2>{t('Tìm cảnh ảnh', 'Find imagery')}</h2>
        <p className="geodata-hint">
          {t('Catalog cục bộ', 'Local catalog')} · {catalog.source.region} · {catalog.scenes.length}{' '}
          {t('cảnh', 'scenes')}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setFormError('');
            if (!aoi || !isPolygon(aoi.feature.geometry)) {
              setFormError(
                t('Chọn hoặc vẽ AOI trước khi tìm.', 'Select or draw an AOI before searching.')
              );
              return;
            }
            try {
              onResults(
                searchImagery(catalog, aoi.feature.geometry, {
                  sensor,
                  from,
                  to,
                  cloud: sensor === 'optical' && cloud !== '' ? Number(cloud) : null
                }),
                signature
              );
              setPage(1);
            } catch {
              setFormError(
                t('Kiểm tra khoảng ngày và hình học AOI.', 'Check the date range and AOI geometry.')
              );
            }
          }}
        >
          <label className="geodata-field">
            Collection
            <select
              aria-label={t('Collection ảnh', 'Imagery collection')}
              value={sensor}
              onChange={(event) => setSensor(event.target.value)}
            >
              <option value="sar">Sentinel-1 GRD</option>
              <option value="optical">Sentinel-2 L2A</option>
              <option value="all">{t('Tất cả', 'All')}</option>
            </select>
          </label>
          <div className="catalog-dates">
            <label className="geodata-field">
              {t('Từ ngày (UTC)', 'From (UTC)')}
              <input
                aria-label={t('Từ ngày ảnh', 'Imagery from date')}
                type="date"
                required
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="geodata-field">
              {t('Đến ngày (UTC)', 'To (UTC)')}
              <input
                aria-label={t('Đến ngày ảnh', 'Imagery to date')}
                type="date"
                required
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>
          {sensor === 'optical' && (
            <label className="geodata-field">
              {t('Mây toàn cảnh tối đa (%)', 'Maximum scene cloud cover (%)')}
              <input
                aria-label={t('Mây toàn cảnh', 'Scene cloud cover')}
                type="number"
                min="0"
                max="100"
                value={cloud}
                onChange={(event) => setCloud(event.target.value)}
              />
            </label>
          )}
          <button className="button primary catalog-search" type="submit">
            <UiIcon name="search" />
            {t('Tìm ảnh', 'Search imagery')}
          </button>
          {formError && (
            <p className="geodata-hint" role="alert">
              {formError}
            </p>
          )}
        </form>
      </section>
      <section className="geodata-section">
        <h2>
          {t('Kết quả', 'Results')}
          <span>{results.length}</span>
        </h2>
        {stale && (
          <p className="catalog-warning" role="status">
            {t(
              'AOI đã đổi. Tìm lại để cập nhật kết quả.',
              'AOI changed. Search again to update results.'
            )}
          </p>
        )}
        {queryAoi === null ? (
          <p className="geodata-empty">
            {t(
              'Tìm ảnh trong vùng quan tâm đang chọn.',
              'Search inside the current area of interest.'
            )}
          </p>
        ) : (
          !results.length && (
            <p className="geodata-empty">
              {t(
                'Không có cảnh trong bộ cục bộ phù hợp điều kiện.',
                'No matching scene in the local catalog.'
              )}
            </p>
          )
        )}
        <ul className="catalog-results">
          {results.slice(0, page * 6).map(({ scene, coverage }) => (
            <li key={scene.id} className={selected.includes(scene.id) ? 'is-selected' : ''}>
              <input
                type="checkbox"
                aria-label={t('Chọn cảnh ', 'Select scene ') + scene.id}
                checked={selected.includes(scene.id)}
                onChange={(event) =>
                  onSelection(
                    event.target.checked
                      ? [...selected, scene.id]
                      : selected.filter((id) => id !== scene.id)
                  )
                }
              />
              <button
                className="catalog-scene"
                title={scene.id}
                aria-label={t('Thông tin cảnh ', 'Scene metadata ') + scene.id}
                onClick={() => onInspect(scene)}
              >
                <UiIcon name={scene.sensor === 'sar' ? 'layers' : 'image'} />
                <span>
                  <strong>
                    {scene.platform.replace('sentinel-', 'S').toUpperCase()} ·{' '}
                    {scene.sensor === 'sar' ? 'GRD' : 'L2A'}
                    {scene.sensor === 'optical' &&
                      scene.id.split('_').find((part) => /^T\d{2}[A-Z]{3}$/.test(part)) &&
                      ` · ${scene.id.split('_').find((part) => /^T\d{2}[A-Z]{3}$/.test(part))}`}
                  </strong>
                  <time>
                    {new Date(scene.acquiredAt).toLocaleString(
                      locale === 'vi' ? 'vi-VN' : 'en-GB',
                      {
                        timeZone: 'UTC',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      }
                    )}{' '}
                    UTC
                  </time>
                  <small>
                    {t('Phủ AOI', 'AOI covered')} {(coverage * 100).toFixed(1)}% ·{' '}
                    {scene.sensor === 'sar'
                      ? scene.polarizations.join('/') || '—'
                      : t('Mây cảnh', 'Scene cloud') +
                        ' ' +
                        (scene.cloudCover === null ? '—' : scene.cloudCover + '%')}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {results.length > page * 6 && (
          <button className="button" onClick={() => setPage((value) => value + 1)}>
            {t('Thêm kết quả', 'More results')}
          </button>
        )}
      </section>
      <section className="geodata-section catalog-selection">
        <h2>
          {t('Bộ chọn', 'Selection')}
          <span>{scenes.length}</span>
        </h2>
        <p className="geodata-hint" data-pair-review={pair}>
          {pairText}
        </p>
        <ul>
          {[...scenes]
            .sort((a, b) => a.acquiredAt.localeCompare(b.acquiredAt))
            .map((scene) => (
              <li key={scene.id}>
                <button
                  className="catalog-selected-name"
                  title={scene.id}
                  onClick={() => onInspect(scene)}
                >
                  {scene.platform.replace('sentinel-', 'S').toUpperCase()} ·{' '}
                  {scene.acquiredAt.slice(0, 19).replace('T', ' ')} UTC
                </button>
                <button
                  className="icon-button"
                  aria-label={t('Bỏ cảnh ', 'Remove scene ') + scene.id}
                  onClick={() => onSelection(selected.filter((id) => id !== scene.id))}
                >
                  <UiIcon name="close" />
                </button>
              </li>
            ))}
        </ul>
        <div className="geodata-actions">
          <button className="button" disabled={!scenes.length || stale} onClick={onAdd}>
            {t('Thêm phạm vi ảnh', 'Add footprints')}
          </button>
          <button
            className="icon-button"
            disabled={!scenes.length || !aoi || stale}
            title={t('Xuất bộ chọn', 'Export selection')}
            aria-label={t('Xuất bộ chọn', 'Export selection')}
            onClick={onExport}
          >
            <UiIcon name="download" />
          </button>
        </div>
        <p className="geodata-hint">
          {catalog.source.provider} · {t('Lấy metadata', 'Metadata retrieved')}{' '}
          {catalog.source.retrievedAt}.{' '}
          <a href={catalog.source.license} target="_blank" rel="noreferrer">
            {t('Quyền sử dụng', 'Terms')}
          </a>
        </p>
      </section>
    </fieldset>
  );
}

export function SceneDetails({
  scene,
  locale,
  onClose,
  onFit
}: {
  scene: ImageryScene;
  locale: Locale;
  onClose: () => void;
  onFit: () => void;
}): JSX.Element {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);
  const acquired =
    new Date(scene.acquiredAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' UTC';
  const values: [[string, string], ...[string, string][]] = [
    [t('Thu nhận', 'Acquired'), acquired],
    ['Collection', scene.collection],
    [t('Mức xử lý', 'Processing level'), scene.level]
  ];
  if (scene.sensor === 'sar')
    values.push(
      ['Pass', scene.pass ?? '—'],
      ['Relative orbit', String(scene.orbit ?? '—')],
      ['Polarization', scene.polarizations.join('/') || '—'],
      ['Pixel spacing', scene.pixelSpacing === null ? '—' : scene.pixelSpacing + ' m']
    );
  else
    values.push(
      [t('GSD sản phẩm', 'Product GSD'), scene.gsd === null ? '—' : scene.gsd + ' m'],
      [
        t('Mây toàn cảnh', 'Scene cloud cover'),
        scene.cloudCover === null ? '—' : scene.cloudCover + '%'
      ]
    );
  return (
    <aside className="geodata-scene-detail">
      <header>
        <h2>{t('Thông tin cảnh', 'Scene metadata')}</h2>
        <button
          className="icon-button"
          aria-label={t('Đóng thông tin cảnh', 'Close scene metadata')}
          onClick={onClose}
        >
          <UiIcon name="close" />
        </button>
      </header>
      <div className="geodata-section">
        <p className="catalog-scene-id">{scene.id}</p>
        <dl className="geodata-properties">
          {values.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="geodata-actions">
          <button className="button" onClick={onFit}>
            <UiIcon name="fit" />
            {t('Xem phạm vi', 'Fit footprint')}
          </button>
          <a href={scene.metadataUrl} target="_blank" rel="noreferrer">
            STAC metadata
          </a>
        </div>
        <p className="geodata-hint">
          {t(
            'Chưa tải raster. Độ phủ là giao hình học, chưa kiểm pixel hợp lệ hoặc chất lượng trong AOI.',
            'Raster not loaded. Coverage is geometric; valid pixels and AOI quality are not checked.'
          )}
        </p>
      </div>
    </aside>
  );
}
