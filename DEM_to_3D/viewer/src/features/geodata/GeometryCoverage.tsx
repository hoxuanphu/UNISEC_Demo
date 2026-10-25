import { useState } from 'react';
import type { polygonCoverage } from '../../geo/vector/polygonCoverage';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { formatArea } from './geometryPresentation';

export function GeometryCoverage({
  coverage,
  locale,
  onSelect
}: {
  coverage: ReturnType<typeof polygonCoverage>;
  locale: Locale;
  onSelect: (id: string) => void;
}): JSX.Element {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);
  const [method, setMethod] = useState(false);
  const percent = (fraction: number) =>
    new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
      style: 'percent',
      maximumFractionDigits: 1
    }).format(fraction);
  return (
    <section className="geodata-section geodata-coverage">
      <h2>
        {t('Độ phủ hình học', 'Geometric coverage')}
        <button
          className="icon-button"
          aria-label={t('Phương pháp độ phủ', 'Coverage method')}
          aria-expanded={method}
          onClick={() => setMethod((value) => !value)}
        >
          <UiIcon name="info" />
        </button>
      </h2>
      {!coverage ? (
        <p className="geodata-empty">
          {t(
            'Chọn một vùng làm vùng quan tâm.',
            'Assign a polygon as the area of interest (AOI).'
          )}
        </p>
      ) : !coverage.rows.length ? (
        <p className="geodata-empty">
          {t(
            'Chọn phạm vi ảnh để so với ',
            'Import or assign image footprints to compare with '
          )}
          <strong>{coverage.aoiName}</strong>.
        </p>
      ) : (
        <>
          <div className="geodata-coverage-summary">
            <span>{coverage.aoiName}</span>
            <strong data-coverage-total>
              {percent(coverage.fraction ?? 0)}
            </strong>
            <small>
              {t('khoảng ', 'about ')}{formatArea(coverage.coveredArea ?? 0, locale)} /{' '}
              {formatArea(coverage.aoiArea, locale)}
            </small>
          </div>
          <table>
            <thead>
              <tr>
                <th>{t('Phạm vi ảnh', 'Image footprint')}</th>
                <th>{t('Phủ AOI', 'AOI covered')}</th>
              </tr>
            </thead>
            <tbody>
              {coverage.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button
                      className="geodata-coverage-link"
                      onClick={() => onSelect(row.id)}
                    >
                      {row.name}
                    </button>
                  </td>
                  <td>{percent(row.fraction)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {method && (
        <div className="geodata-method">
          <p>
            {t(
              'Phần AOI nằm trong vùng phủ của ảnh.',
              'Share of the AOI inside the image footprints.'
            )}
          </p>
          <p>
            {t(
              'Chưa tính mây và chất lượng ảnh.',
              'Clouds and image quality not assessed.'
            )}
          </p>
          <code>polygon-coverage-v1</code>
        </div>
      )}
    </section>
  );
}
