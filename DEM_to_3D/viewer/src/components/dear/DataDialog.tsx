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
        <p className="data-context">{manifest
          ? t('Chế Tạo: EPSG:32648, bước lưới 28,8 m. Metadata ghi ảnh Sentinel-2. Chưa có nguồn DEM.', 'Chế Tạo: EPSG:32648, 28.8 m grid. Metadata lists Sentinel-2 imagery. DEM source unavailable.')
          : terrainMetadata
          ? `${t('Mô hình được tải lên', 'Uploaded model')}: ${terrainMetadata.crs.authority}:${terrainMetadata.crs.code}.`
          : t('Chưa có metadata của mô hình địa hình.', 'Terrain model metadata is unavailable.')}</p>
        <h3 className="data-section-title">{t('Cách đánh giá', 'Assessment method')}</h3>
        <dl className="assessment-method"><div><dt>{t('Ưu tiên địa bàn', 'Community priority')}</dt><dd>{t('Dựa vào báo cáo ảnh hưởng trên đường tiếp cận, tình trạng liên lạc và yêu cầu khẩn cấp.', 'Uses reported road impacts, community contact and urgent requests.')}</dd></div><div><dt>{t('Phương án tiếp cận', 'Access options')}</dt><dd>{t('Tính trên mạng đường có trong dữ liệu. Loại đoạn bị chặn, tăng chi phí cho đoạn chưa rõ. Tuyến gợi ý vẫn cần xác minh khả năng đi qua.', 'Computed on the available road network. Blocked sections are excluded and uncertain sections add cost. Suggested routes still require passage verification.')}</dd></div></dl>
      </div>
    </section>
  </div>;
}
