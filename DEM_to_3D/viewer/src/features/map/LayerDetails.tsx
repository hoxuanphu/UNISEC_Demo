import type { ReactNode } from 'react';
import type { IncidentPacket } from '../../data/incidentPacket';
import type { IncidentEvidence, Locale, ScenarioRoute } from '../../types/dear';
import type { TerrainMetadata } from '../../types/terrain';

type Props = {
  id: string; locale: Locale; packet: IncidentPacket; updated: boolean;
  evidence: IncidentEvidence[]; terrain?: TerrainMetadata; route: ScenarioRoute | null; imagery: boolean;
};

/** Show recorded provenance only. The snapshot date is never an acquisition date. */
export function LayerDetails({ id, locale, packet, updated, evidence, terrain, route, imagery }: Props): JSX.Element {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const date = (iso: string) => new Date(iso).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const rows: Array<[string, ReactNode]> = [];
  let note = '';
  const add = (vi: string, en: string, value: ReactNode) => rows.push([t(vi, en), value]);
  const snapshot = updated ? packet.incident.asOfUpdated : packet.incident.asOf;
  if (['imagery', 'terrain', 'hillshade'].includes(id)) {
    if (terrain) {
      add('Tệp dữ liệu', 'Dataset', terrain.asset_id);
      add('Hệ tọa độ', 'Coordinate system', `${terrain.crs.authority}:${terrain.crs.code}`);
      const cell = Math.max(Math.hypot(terrain.grid_transform.a, terrain.grid_transform.d), Math.hypot(terrain.grid_transform.b, terrain.grid_transform.e));
      add('Bước lưới DEM', 'DEM cell spacing', `${cell.toFixed(1)} m`);
    }
    add('Ngày thu nhận', 'Acquisition date', t('Chưa ghi trong metadata', 'Not recorded in metadata'));
    add('Phạm vi', 'Coverage', t('Giới hạn ảnh/lưới địa hình, giữ trống vùng thiếu dữ liệu', 'Image/elevation footprint with no-data areas retained'));
    note = id === 'imagery'
      ? t('Ảnh nền dùng để định vị, không phải ảnh sau sự kiện đã được kiểm chứng.', 'Reference imagery for orientation, not verified post-event imagery.')
      : t('Chưa xác nhận nguồn DEM, DSM/DTM và mốc độ cao. Độ dốc không thay thế khảo sát mặt đường.', 'DEM provenance, DSM/DTM and vertical datum are unconfirmed. Slope does not replace road inspection.');
  } else if (id === 'context') {
    add('Nguồn', 'Source', <a href="https://maps.eox.at/" target="_blank" rel="noreferrer">{imagery ? 'EOX Sentinel-2 cloudless' : 'EOX Terrain Light'}</a>);
    if (imagery) {
      add('Năm ảnh nền', 'Basemap vintage', '2016');
      add('Giấy phép', 'License', 'CC BY 4.0');
    } else {
      add('Dữ liệu nền', 'Basemap data', <a href="https://maps.eox.at/#data" target="_blank" rel="noreferrer">OpenStreetMap, Natural Earth, ASTER GDEM, GTOPO30, GEBCO</a>);
      add('Ghi công', 'Credits', 'Data © OpenStreetMap contributors & others. Rendering © EOX.');
    }
    note = t('Nền khu vực tải qua Internet. Không dùng để xác định tình trạng thiên tai hiện tại.', 'Regional basemap requires Internet. It does not describe current disaster conditions.');
  } else if (id === 'aoi') {
    add('Nguồn', 'Source', t(...packet.aoi.source));
    add('Thời điểm', 'Timestamp', date(packet.aoi.observedAt));
    add('Phạm vi', 'Coverage', t(...packet.aoi.name));
    add('Loại ranh giới', 'Boundary type', t('Vùng đánh giá', 'Assessment area'));
  } else if (id === 'staging' || id === 'hlz') {
    const sites = packet.responseSites.filter(site => site.kind === id);
    for (const site of sites) add(t(...site.name), t(...site.name), `${t(...site.source)} (${date(site.observedAt)})`);
    note = id === 'hlz' ? t('H là vị trí đề xuất chưa khảo sát. Chưa xác nhận dùng được cho hạ cánh.', 'H denotes an unsurveyed candidate. Landing suitability is unconfirmed.') : t('Điểm xuất phát dùng để tính phương án tiếp cận.', 'Origin used for access-route calculations.');
  } else if (id === 'landslide' || id === 'flood' || id === 'status') {
    const ids = new Set(packet.hazards.filter(h => id === 'status' || h.kind === id).map(h => h.id));
    const records = evidence.filter(item => ids.has(item.hazardId));
    const times = records.map(item => item.observedAt).sort((a, b) => Date.parse(a) - Date.parse(b));
    add('Tổng hợp lúc', 'Data as of', date(snapshot));
    if (times.length) {
      add('Quan sát đầu tiên', 'First observation', date(times[0]));
      if (times.at(-1) !== times[0]) add('Quan sát gần nhất', 'Latest observation', date(times.at(-1)!));
    }
    add('Báo cáo và phân tích', 'Reports and analyses', [...new Set(records.map(item => t(...item.source)))].join('\n') || t('Chưa có báo cáo hoặc phân tích', 'No reports or analyses'));
    note = id === 'status' ? t('Tình trạng từng đoạn lấy từ bản ghi ảnh hưởng. Chưa ghi nhận chặn không có nghĩa đã xác nhận đi được.', 'Segment conditions use impact records. No reported blockage does not mean confirmed passability.')
      : t('Chỉ có vị trí điểm trong gói. Không suy ra diện tích hay phạm vi sạt lở/ngập từ ký hiệu điểm.', 'The packet contains point locations. Point symbols do not establish landslide or flood extent.');
  } else if (id === 'route') {
    add('Phương pháp', 'Method', t('Tính trên mạng đường của bộ dữ liệu', 'Computed on the dataset road network'));
    if (route) add('Tuyến', 'Route', t(...route.name));
    add('Tổng hợp lúc', 'Data as of', date(snapshot));
    note = t('Loại đoạn bị chặn khi tìm tuyến, tăng chi phí đoạn chưa rõ. Phương án vẫn cần kiểm tra hiện trường.', 'Routing excludes blocked segments and penalises uncertain ones. Field verification is still required.');
  } else {
    add('Phiên bản dữ liệu', 'Dataset version', packet.datasetVersion);
    add('Tổng hợp lúc', 'Data as of', date(snapshot));
    add('Phạm vi', 'Coverage', t(...packet.aoi.name));
    note = id === 'communities' ? t('Chưa ghi nguồn gốc dân số và số hộ trong gói.', 'Population and household provenance is not recorded in the packet.')
      : t('Mạng đường chưa đầy đủ cho mọi địa bàn. Chưa xác nhận nguồn hình tuyến và số hiệu thực địa.', 'The road network is incomplete. Geometry provenance and real-world route numbers are unconfirmed.');
  }
  return <div className="layer-details"><dl>{rows.map(([label, value], index) => <div key={index}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{note && <p>{note}</p>}</div>;
}
