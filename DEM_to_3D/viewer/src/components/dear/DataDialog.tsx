import type { IncidentModel, Locale } from '../../types/dear';
import { UiIcon } from './UiIcon';
import type { ScenarioManifest } from '../../data/scenarioManifest';
import type { TerrainMetadata } from '../../types/terrain';
import { localClock, sourceObservedAt } from '../../features/incident/sourceTime';

type Props = {
  locale: Locale;
  incident: IncidentModel;
  updated: boolean;
  manifest: ScenarioManifest | null;
  terrainMetadata?: TerrainMetadata;
  onClose: () => void;
};

export function DataDialog({ incident, locale, updated, manifest, terrainMetadata, onClose }: Props): JSX.Element {
  const t = (vi: string, en: string) => locale === 'en' ? en : vi;
  const snapshot = updated ? incident.asOfUpdated : incident.asOf;
  const terrainCrs = terrainMetadata
    ? `${terrainMetadata.crs.authority}:${terrainMetadata.crs.code}`
    : manifest?.crs;
  const gridSpacing = terrainMetadata ? (() => {
    const { a, b, d, e } = terrainMetadata.grid_transform;
    const column = Math.hypot(a, d), row = Math.hypot(b, e);
    const number = (value: number) => value.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', { maximumFractionDigits: 1 });
    const unit = terrainMetadata.crs.linear_unit === 'metre' ? 'm' : terrainMetadata.crs.linear_unit;
    return `${Math.abs(column - row) < 1e-7 ? number(column) : `${number(column)} × ${number(row)}`} ${unit}`;
  })() : null;
  // The optional texture record names an image file, not a DEM source or acquisition date.
  const texture = terrainMetadata && 'texture' in terrainMetadata ? terrainMetadata.texture : undefined;
  const imagerySource = texture && typeof texture === 'object' && 'source' in texture && typeof texture.source === 'string'
    ? texture.source : null;
  const sourceRow = (source: IncidentModel['sources'][number]) => <div className="data-source-row" key={source.id}>
    <div><strong>{t(...source.name)}</strong><small>{t(...source.note)}</small></div>
    <time dateTime={sourceObservedAt(source, updated)}>{localClock(sourceObservedAt(source, updated))}</time>
  </div>;
  return <div className="modal-overlay" onClick={onClose}>
    <section className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="data-title" onClick={event => event.stopPropagation()}>
      <div className="modal-head">
        <h2 id="data-title">{t('Nguồn và thời điểm dữ liệu', 'Data sources and timestamps')}</h2>
        <button className="icon-button" onClick={onClose} aria-label={t('Đóng', 'Close')}><UiIcon name="close" /></button>
      </div>
      <div className="modal-body">
        <div className="data-snapshot">
          <span>{t('Thời điểm tổng hợp', 'Snapshot')}</span>
          <strong><time dateTime={snapshot}>{new Date(snapshot).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</time> (UTC+7)</strong>
        </div>
        {manifest && <div className="data-snapshot">
          <span>{t('Phiên bản dữ liệu', 'Dataset version')}</span>
          <strong>{manifest.datasetVersion}</strong>
        </div>}
        {manifest?.dataKind === 'synthetic' && <p className="data-context data-review-status">
          {t('Dữ liệu trình diễn.', 'Demonstration data.')}
        </p>}
        {manifest?.dataKind === 'synthetic' && <p className="data-context">
          {t('NR-18, PR-7 và T-5 là mã đường nội bộ.', 'NR-18, PR-7 and T-5 are internal road codes.')}
        </p>}
        <h3 className="data-section-title">{t('Dữ liệu và báo cáo', 'Data and reports')}</h3>
        <div className="data-source-list">
          {incident.sources.filter(source => source.id !== 'route').map(sourceRow)}
        </div>
        {incident.sources.some(source => source.id === 'route') && <><h3 className="data-section-title">{t('Kết quả tính tuyến', 'Routing results')}</h3><div className="data-source-list">{incident.sources.filter(source => source.id === 'route').map(sourceRow)}</div></>}
        <h3 className="data-section-title">{t('Mô hình địa hình', 'Terrain model')}</h3>
        {terrainCrs ? <dl className="fact-rows data-terrain">
          <div><dt>{t('Hệ tọa độ', 'Coordinate system')}</dt><dd>{terrainCrs}</dd></div>
          {gridSpacing && <div><dt>{t('Bước lưới DEM', 'DEM cell spacing')}</dt><dd>{gridSpacing}</dd></div>}
          <div><dt>{t('Nguồn DEM', 'DEM source')}</dt><dd>{t('Chưa khai báo', 'Not provided')}</dd></div>
          {imagerySource && <div><dt>{t('Tệp ảnh nền', 'Imagery file')}</dt><dd style={{ overflowWrap: 'anywhere' }}>{imagerySource}</dd></div>}
        </dl> : <p className="data-context">{t('Chưa có metadata địa hình.', 'Terrain metadata unavailable.')}</p>}
        <h3 className="data-section-title">{t('Cách đánh giá', 'Assessment method')}</h3>
        <dl className="assessment-method"><div><dt>{t('Ưu tiên địa bàn', 'Community priority')}</dt><dd>{t('Dựa vào báo cáo ảnh hưởng trên đường tiếp cận, tình trạng liên lạc và yêu cầu khẩn cấp.', 'Uses reported road impacts, community contact and urgent requests.')}</dd></div><div><dt>{t('Phương án tiếp cận', 'Access options')}</dt><dd>{t('Tính trên mạng đường có trong dữ liệu. Loại đoạn bị chặn, tăng chi phí cho đoạn chưa rõ. Tuyến gợi ý vẫn cần xác minh khả năng đi qua.', 'Computed on the available road network. Blocked sections are excluded and uncertain sections add cost. Suggested routes still require passage verification.')}</dd></div></dl>
      </div>
    </section>
  </div>;
}
