import React from 'react';
import type {
  Community,
  AnalysisArea,
  Hazard,
  IncidentEvidence,
  Locale,
  RoadSegment,
  ScenarioRoutePair,
  ResponseSite
} from '../../types/dear';
import { UiIcon } from './UiIcon';
import { StatusText } from '../../shared/ui/StatusText';
import { areaM2, withinArea } from '../../terrain/areaGeometry';
import { EvidenceMetadata } from '../../features/incident/EvidenceMetadata';
import { evidencePresentation } from '../../features/incident/evidencePresentation';
import { roadStatusLabels } from '../../features/routes/roadStatus';
import { findingAddsDetail } from '../../features/incident/findingPresentation';

type Props = {
  objectId: string;
  aoi: AnalysisArea;
  parentName?: string;
  locale: Locale;
  roads: RoadSegment[];
  hazards: Hazard[];
  evidence: IncidentEvidence[];
  communities: Community[];
  responseSites: ResponseSite[];
  routes: Map<string, ScenarioRoutePair>;
  hasTerrainProfile: boolean;
  profileOpen: boolean;
  onToggleProfile: () => void;
  onBack: () => void;
  onSelectCommunity: (id: string) => void;
  onOpenEvidence: (id: string) => void;
  onSelectObject: (id: string) => void;
  onOpenPriority: () => void;
};

export const ObjectDetailView: React.FC<Props> = ({
  objectId,
  aoi,
  parentName,
  locale,
  roads,
  hazards,
  evidence,
  communities,
  responseSites,
  routes,
  hasTerrainProfile,
  profileOpen,
  onToggleProfile,
  onBack,
  onSelectCommunity,
  onOpenEvidence,
  onSelectObject,
  onOpenPriority
}) => {
  const t = (vi: string, en: string) => (locale === 'en' ? en : vi);

  const [kind, id] = objectId.split(':');

  const road = kind === 'road' ? roads.find((r) => r.id === id) : undefined;
  const hazard = kind === 'hazard' ? hazards.find((h) => h.id === id) : undefined;
  const relatedHazard = road?.hz ? hazards.find(item => item.id === road.hz) : undefined;
  const roadRecord = road?.hz ? evidence.find(item => item.hazardId === road.hz) : undefined;
  const hazardRecord = hazard ? evidence.find(item => item.hazardId === hazard.id) : undefined;
  const affectedRoads = hazard ? roads.filter(item => item.hz === hazard.id) : [];
  const site = kind === 'poi' ? responseSites.find(item => item.id === id) : undefined;
  const affectedCommunities = road ? communities.filter(community => {
    const pair = routes.get(community.id);
    return [pair?.candidate, pair?.direct].some(route => route?.segs.some(segment => segment.id === road.id));
  }) : [];
  const observation = roadRecord ? t(...roadRecord.finding) : road?.note ? t(...road.note).replace(/^(Tin|Report at) \d{2}:\d{2}:\s*/i, '') : null;
  const roadObservation = observation ? observation[0].toLocaleUpperCase() + observation.slice(1) : null;

  let title = id;
  if (kind === 'road' && road) title = t(road.name[0], road.name[1]);
  else if (kind === 'hazard' && hazard) title = t(hazard.name[0], hazard.name[1]);
  else if (site) title = t(site.name[0], site.name[1]);
  else if (kind === 'aoi' && id === aoi.id) title = t(...aoi.name);

  return (
    <>
      <div className="sidebar-top">
        {parentName && <button className="text-button back panel-parent" onClick={onBack}>
          <UiIcon name="back" size={16} /> {parentName}
        </button>}
        <div className="detail-title"><h1 id="object-title">{title}</h1><button className="icon-button panel-close" onClick={onBack} aria-label={t('Đóng chi tiết đối tượng', 'Close feature details')} title={t('Đóng chi tiết đối tượng', 'Close feature details')}><UiIcon name="close" /></button></div>
        {road && <div className="detail-priority detail-meta"><StatusText tone={road.status === 'blocked' ? 'critical' : road.status === 'uncertain' ? 'warning' : 'neutral'} icon={road.status === 'blocked' ? 'blocked' : road.status === 'uncertain' ? 'uncertain' : undefined}>{t(...roadStatusLabels[road.status])}</StatusText><span>{road.len} km</span></div>}
      </div>

      <div className="sidebar-scroll">
        {kind === 'aoi' && <>
          <dl className="area-facts fact-rows"><div><dt>{t('Diện tích', 'Area')}</dt><dd>{(areaM2(aoi.points) / 1000000).toFixed(1)} <small>km²</small></dd></div><div><dt>{t('Thôn, bản', 'Communities')}</dt><dd>{communities.filter(community => withinArea(community.projected, aoi.points)).length}</dd></div></dl>
          <section className="workflow-section area-action">
            <button className="button primary" onClick={onOpenPriority}>{t('Xem địa bàn trong vùng', 'View communities in area')}</button>
          </section>
          <details className="object-reference"><summary>{t('Nguồn ranh giới', 'Boundary source')}</summary><p>{t(...aoi.source)}</p></details>
        </>}
        {kind === 'road' && road && (
          <>
            {roadObservation && <section className="object-observation">
              {roadRecord && <h3>{evidencePresentation(roadRecord.type, locale).kind}</h3>}
              <p>{roadObservation}</p>
              {roadRecord ? <EvidenceMetadata evidence={roadRecord} locale={locale} className="observation-times" showSource={false}/>
                : relatedHazard && <p className="observation-meta">{t(...relatedHazard.src)} · {relatedHazard.detected}</p>}
            </section>}
            <section className="workflow-section detail-next">
              <p className={'object-next-action is-' + road.status}><UiIcon name={road.status === 'blocked' ? 'blocked' : road.status === 'uncertain' ? 'uncertain' : 'info'} size={18}/><span>{road.status === 'blocked' ? t('Tìm tuyến tránh đoạn bị chặn.', 'Find a route avoiding the blocked section.')
                : relatedHazard?.kind === 'bridge' ? t('Kiểm tra mực nước, mặt cầu và khả năng qua cầu.', 'Check water level, bridge deck and passage conditions.')
                : t('Kiểm tra khả năng đi qua trước khi sử dụng tuyến.', 'Check passage conditions before using this route.')}</span></p>
              <div className="detail-actions">
                {road.hz && <button className="button" onClick={() => onOpenEvidence(road.hz!)}><UiIcon name="info" size={16}/>{roadRecord ? evidencePresentation(roadRecord.type, locale).action : t('Xem chi tiết', 'View details')}</button>}
                <button className="button road-profile-action" disabled={!hasTerrainProfile} aria-pressed={profileOpen} onClick={onToggleProfile} title={!hasTerrainProfile ? t('Chưa có DEM cho đoạn đường này', 'DEM unavailable for this road section') : undefined}><UiIcon name="profile" size={16}/>{t('Mặt cắt địa hình', 'Elevation profile')}</button>
              </div>
            </section>
            {affectedCommunities.length > 0 && <section className="workflow-section">
              <h3>{t('Địa bàn liên quan', 'Related communities')}</h3>
              {affectedCommunities.map(community => <button key={community.id} className="object-row linked-row" onClick={() => onSelectCommunity(community.id)}>
                <strong>{community.name}</strong>
              </button>)}
            </section>}
          </>
        )}

        {kind === 'hazard' && hazard && (
          <section className="hazard-detail">
            <div className="detail-meta"><StatusText tone={affectedRoads.some(item => item.status === 'blocked') ? 'critical' : 'warning'} icon={affectedRoads.some(item => item.status === 'blocked') ? 'blocked' : 'uncertain'}>
              {affectedRoads.some(item => item.status === 'blocked') ? t('Có đoạn đường bị chặn', 'Related road section blocked') : hazard.kind === 'landslide'
                ? hazard.observation === 'reported' ? t('Có báo cáo sạt lở', 'Landslide reported from field') : t('Nghi sạt lở, cần xác minh', 'Suspected landslide, verification needed')
                : hazard.kind === 'bridge' ? t('Cầu cần xác minh', 'Bridge to verify')
                : hazard.kind === 'crossing' ? t('Điểm vượt khe cần xác minh', 'Gully crossing to verify')
                : t('Nghi ngập', 'Flood indication')}
            </StatusText></div>
            {hazardRecord && findingAddsDetail(title, t(...hazardRecord.finding)) && <p className="hazard-observation">{t(...hazardRecord.finding)}</p>}
            {hazardRecord && <EvidenceMetadata evidence={hazardRecord} locale={locale} className="observation-times" showSource={false}/>}

            <dl className="object-facts fact-rows">
              {hazard.area != null && (hazard.kind === 'landslide' || hazard.kind === 'flood') && <div>
                <dt>{t('Diện tích ước tính', 'Estimated area')}</dt>
                <dd>{hazard.area} ha</dd>
              </div>}
              {!hazardRecord && <div>
                <dt>{t('Ghi nhận lúc', 'Impact recorded')}</dt>
                <dd>{hazard.detected}</dd>
              </div>}
            </dl>
            <div className="detail-actions"><button className="button" onClick={() => onOpenEvidence(hazard.id)}><UiIcon name="info" size={16}/>{hazardRecord ? evidencePresentation(hazardRecord.type, locale).action : t('Xem chi tiết', 'View details')}</button></div>

            {affectedRoads.length > 0 && <section className="workflow-section"><h3>{t('Đoạn đường liên quan', 'Related road sections')}</h3>{affectedRoads.map(item => <button className="object-row impact-row" key={item.id} onClick={() => onSelectObject(`road:${item.id}`)}><span><strong>{t(...item.name)}</strong><small>{item.len} km</small></span><StatusText tone={item.status === 'blocked' ? 'critical' : item.status === 'uncertain' ? 'warning' : 'neutral'} icon={item.status === 'blocked' ? 'blocked' : item.status === 'uncertain' ? 'uncertain' : undefined}>{t(...roadStatusLabels[item.status])}</StatusText></button>)}</section>}

          </section>
        )}

        {kind === 'poi' && site && (
          <section className="workflow-section" style={{ borderTop: 0 }}>
            {site.kind === 'staging' && <p>{t(
                'Điểm xuất phát của các tuyến tiếp cận.',
                'Starting point for access routes.'
              )}</p>}
            {site.kind === 'hlz' && <dl className="object-facts fact-rows"><div><dt>{t('Đánh giá bãi đáp', 'Landing site assessment')}</dt><dd>{site.assessment === 'assessed' ? t('Đã khảo sát', 'Assessed') : site.assessment === 'unavailable' ? t('Không sử dụng', 'Unavailable') : t('Đề xuất, chưa khảo sát', 'Proposed, not surveyed')}</dd></div><div><dt>{t('Nguồn', 'Source')}</dt><dd>{t(site.source[0], site.source[1])}</dd></div><div><dt>{t('Cập nhật', 'Updated')}</dt><dd>{new Date(site.observedAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</dd></div></dl>}
            {site.kind === 'hlz' && site.assessment === 'candidate' && <section className="workflow-section"><h3>{t('Cần khảo sát', 'Survey required')}</h3><p>{t('Độ phẳng, vật cản và hướng tiếp cận trước khi xác nhận điểm hạ cánh.', 'Ground levelness, obstacles and approach direction before confirming a landing site.')}</p></section>}
            {site.kind === 'staging' && <button
              className="button primary"
              style={{ width: '100%', marginTop: '16px' }}
              onClick={onOpenPriority}
            >
              {t('Chọn địa bàn cần tiếp cận', 'Choose destination community')}
            </button>}
          </section>
        )}

      </div>
    </>
  );
};
