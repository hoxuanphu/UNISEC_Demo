import {localMapSource} from '../../features/map/localMapSource';
import {
  imagerySource,
  defaultImagerySource
} from '../../features/map/imagerySource';
import type { BasemapState } from '../../features/map/mapContracts';
import type { Locale } from '../../types/dear';
import { useRef, useState } from 'react';
import { useDismissiblePopover } from '../../shared/hooks/useDismissiblePopover';
import { UiIcon } from './UiIcon';

export function MapAttribution({
  locale,
  state,
  onRetry,
  localSource,
  terrainDisplay,
  analysisSource,
  fieldSource, osmReference, showLabel = false
}: {
  locale: Locale;
  state: BasemapState;
  onRetry: () => void;
  localSource?: [string, string];
  terrainDisplay?: {exaggeration: number};
  analysisSource?: {name:string; acquired:string; credit:string};
  fieldSource?: string;
  osmReference?: boolean;
  showLabel?: boolean;
}): JSX.Element | null {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);
  const local = localMapSource();
  const imagery = local || state.provider === 'configured' ? imagerySource : defaultImagerySource;
  const terrainName = local ? t('Địa hình cục bộ', 'Local terrain') : 'Terrain Light';
  const imageryCredit = imagery.link ? (
    <a href={imagery.link} target="_blank" rel="noreferrer">
      {imagery.credit}
    </a>
  ) : (
    imagery.credit
  );
  const anchor = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useDismissiblePopover(anchor, open, () => setOpen(false));
  const unavailable =
    state.status === 'partial' ||
    state.status === 'error' ||
    state.status === 'unavailable' || (state.status !== 'off' && (state.relief === 'error' || state.relief === 'partial'));
  return (
    <>
      <div className="map-attribution" ref={anchor}>
        <button
          className="map-source-button"
          aria-label={t('Nguồn bản đồ', 'Map sources')}
          aria-expanded={open}
          aria-controls="map-source-popover"
          onClick={() => setOpen((value) => !value)}
          title={t('Nguồn bản đồ', 'Map sources')}
        >
          <UiIcon name="info" size={18} />
          {showLabel && <span>{t('Nguồn', 'Sources')}</span>}
          {unavailable && (
            <span
              className="map-source-warning"
              aria-label={t(
                'Nền khu vực chưa đầy đủ',
                'Regional basemap incomplete'
              )}
            />
          )}
        </button>
        {open && (
          <div
            className="map-source-popover"
            id="map-source-popover"
            data-popover
          >
            <div className="map-source-heading">
              <h3>{t('Nguồn bản đồ', 'Map sources')}</h3>
              <button
                className="icon-button"
                onClick={() => setOpen(false)}
                aria-label={t('Đóng nguồn bản đồ', 'Close map sources')}
              >
                <UiIcon name="close" size={16} />
              </button>
            </div>
            <dl>
              {analysisSource && <div><dt>{t('Ảnh đang hiển thị','Displayed imagery')}</dt><dd>{analysisSource.name}<br/>{analysisSource.acquired}<br/>{analysisSource.credit}</dd></div>}
              {localSource && (
                <div>
                  <dt>{t('Dữ liệu khu vực', 'Local data')}</dt>
                  <dd>{t(...localSource)}</dd>
                </div>
              )}
              {fieldSource && <div><dt>{t('Khảo sát thực địa', 'Field survey')}</dt><dd>{fieldSource}<br/>{t('Lớp ảnh Google Earth không kèm dữ liệu ảnh.', 'Google Earth image layers contain no raster data.')}</dd></div>}
              {osmReference && <div><dt>{t('Đường tham chiếu', 'Reference road')}</dt><dd><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors, ODbL</a></dd></div>}
              {osmReference && <div><dt>{t('Mốc địa danh', 'Place reference')}</dt><dd><a href="https://www.geonames.org/8526472/ban-che-tao.html" target="_blank" rel="noreferrer">GeoNames, CC BY 4.0</a></dd></div>}
              {state.relief && <div><dt>{t('Địa hình nền', 'Context terrain')}</dt><dd>
                <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noreferrer">Mapzen Terrain Tiles</a>
                <br/>{state.relief === 'loading' ? t('Đang tải', 'Loading') : state.relief === 'error' ? t('Chưa tải được', 'Unavailable') : t('Chỉ hiển thị, không dùng đo đạc', 'Display only, excluded from measurements')}
              </dd></div>}
              {terrainDisplay && (
                <div><dt>{t('Phóng đại độ cao', 'Vertical exaggeration')}</dt><dd>×{Number(terrainDisplay.exaggeration.toFixed(2))}</dd></div>
              )}
              <div>
                <dt>{t('Nền khu vực', 'Regional basemap')}</dt>
                <dd>
                  {state.status === 'off'
                    ? t('Đã tắt', 'Off')
                    : state.status === 'loading' && !state.loaded
                      ? t('Đang tải', 'Loading')
                    : state.loaded > 0
                      ? state.style === 'satellite'
                        ? imagery.name
                        : terrainName
                      : t('Chưa tải được', 'Unavailable')}
                </dd>
              </div>
              {state.style === 'satellite' && !imagery.custom && state.status !== 'off' && (
                <div>
                  <dt>{t('Độ phân giải nền', 'Basemap resolution')}</dt>
                  <dd>{t('Thay đổi theo khu vực', 'Varies by location')}</dd>
                </div>
              )}
            </dl>
            {unavailable && (
              <div className="map-source-status" role="status">
                {state.relief === 'error' || state.relief === 'partial'
                  ? t('Địa hình nền chưa đầy đủ', 'Context terrain is incomplete')
                  : state.status === 'partial'
                  ? t(
                      'Một phần nền chưa tải được',
                      'Some basemap tiles are unavailable'
                    )
                  : state.status === 'unavailable'
                    ? t(
                        'Mô hình chưa hỗ trợ nền khu vực',
                        'Regional basemap unavailable for this model'
                      )
                    : t(
                        'Không tải được nền khu vực',
                        'Regional basemap unavailable'
                      )}
                {(state.status === 'error' || state.status === 'partial' || state.relief === 'error' || state.relief === 'partial') && (
                  <button onClick={onRetry}>{t('Thử lại', 'Retry')}</button>
                )}
              </div>
            )}
            {state.loaded > 0 && (
              <p className="map-source-license">
                {state.style === 'satellite' ? (
                  imageryCredit
                ) : local ? (
                  <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noreferrer">Mapzen Terrain Tiles / USGS</a>
                ) : (
                  <>
                    <a
                      href="https://maps.eox.at"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Terrain Light
                    </a>{' '}
                    / Data ©{' '}
                    <a
                      href="https://www.openstreetmap.org/copyright"
                      target="_blank"
                      rel="noreferrer"
                    >
                      OpenStreetMap contributors
                    </a>{' '}
                    &amp;{' '}
                    <a
                      href="https://maps.eox.at/#data"
                      target="_blank"
                      rel="noreferrer"
                    >
                      others
                    </a>{' '}
                    / Rendering ©{' '}
                    <a href="https://eox.at" target="_blank" rel="noreferrer">
                      EOX
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
