import { FieldPhotoStrip } from '../../features/fieldPhotos/FieldPhotoStrip';
import type { PreparedPhotoPoint } from '../../features/fieldPhotos/preparedPhotos';
import {communitiesForHazard,roadHazardIds,roadsForHazard} from '../../features/incident/roadHazards';
import type { GeometryRecord } from '../../geo/vector/types';
import { landslideAreaOf } from '../../features/landslides/landslideAreas';
import { areaLabel } from '../../features/landslides/areaLabels';
import { editsFor, type ScenarioEdit } from '../../features/access/scenarioEdits';
import React, { useId, useRef, useState } from 'react';
import { ChoiceGroup } from '../../shared/ui/ChoiceGroup';
import type {
  RoadStatus,
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
import { SourceTimes } from '../../features/incident/EvidenceMetadata';
import { evidencePresentation } from '../../features/incident/evidencePresentation';
import { formatRoadLength, roadStatusIcon, roadStatusLabels, roadStatusShortLabels, roadStatusTone } from '../../features/routes/roadStatus';
import { nearestRoadAnchor } from '../../features/routes/selectedRoadJourney';
import { observationTime } from '../../features/incident/sourceTime';
import { CommunityImpactRow, KeyFacts, peopleText, type KeyFact } from './DetailFacts';
import { workStatusText, type WorkStatus } from '../../features/incident/responseWork';
import { hazardObservationText, roadEvidence, findingAddsDetail, findingStatesArea } from '../../features/incident/findingPresentation';
import '../../features/geodata/scenario-card.css';
import './hazard-detail.css';

type Props = {
  objectId: string;
  aoi: AnalysisArea;
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
  onClose: () => void;
  onSelectCommunity: (id: string, routeType?: 'candidate' | 'direct', sectionId?: string) => void;
  onOpenEvidence: (id: string) => void;
  onSelectObject: (id: string) => void;
  onOpenPriority: () => void;

  /** Present when the viewer may change road status here; returns false when not saved. */
  onSetRoadStatus?: (road: RoadSegment, status: RoadStatus, note: string) => boolean;
  onRevertEdit?: (editId: string) => boolean;
  /** The road's open verification task, if any. */
  verification?: { taskId: string; status: WorkStatus; owner: string };
  onOpenWork?: (taskId: string) => void;
  /** Manual scenario edits, to show who last changed a road's status. */
  scenarioEdits?: ScenarioEdit[];
  mappedAreas?: GeometryRecord[];
  onOpenMappedArea?: (id: string) => void;
  /** Prepared survey photos by hazard ID. */
  fieldPhotos?: Map<string, PreparedPhotoPoint>;
  /** What else a secondary staging site holds, such as the rescue teams based there. */
  siteContent?: (siteId: string) => React.ReactNode;
};

/** An open field task: its name, then state and owner on one quiet line; the dot carries the state. */
function WorkRow({ label, verification, locale, onOpen }: { label: string; verification: NonNullable<Props['verification']>; locale: Locale; onOpen?: (taskId: string) => void }): JSX.Element {
  const t = (vi: string, en: string) => (locale === 'en' ? en : vi);
  const state=verification.status==='pending'&&!verification.owner?t('Chờ phân công','Awaiting assignment'):t(...workStatusText[verification.status]);
  const detail=[state,verification.owner].filter(Boolean).join(', ');
  return <button className="verification-row" data-state={verification.status} onClick={() => onOpen?.(verification.taskId)}>
    <span><strong>{label}</strong><small>{detail}</small></span>
    <UiIcon name="next" size={16}/>
  </button>;
}

const distanceText =(meters: number) => meters < 1000 ? `${Math.max(10, Math.round(meters / 10) * 10)} m` : `${(meters / 1000).toFixed(1)} km`;

export const ObjectDetailView: React.FC<Props> = ({
  fieldPhotos, siteContent,
  onSetRoadStatus,
  onRevertEdit,
  verification,
  onOpenWork,
  scenarioEdits = [],
  objectId,
  aoi,
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
  onClose,
  onSelectCommunity,
  onOpenEvidence,
  onSelectObject,
  onOpenPriority
  , mappedAreas = [], onOpenMappedArea
}) => {
  const t = (vi: string, en: string) => (locale === 'en' ? en : vi);
  // Keyed by object so a half-entered change never carries over to another selection.
  const statusRef = useRef<HTMLDivElement>(null);
  const reasonErrorId = useId();
  const restoreStatusFocus = () => requestAnimationFrame(() => statusRef.current?.querySelector<HTMLButtonElement>('[data-road-status-edit]')?.focus());
  const [change, setChange] = useState<{ objectId: string; status: RoadStatus; note: string; error?: string } | null>(null);
  const pending = change?.objectId === objectId ? change : null;
  const [failedFor, setFailedFor] = useState<string | null>(null);

  const [kind, id] = objectId.split(':');

  const road = kind === 'road' ? roads.find((r) => r.id === id) : undefined;
  const hazard = kind === 'hazard' ? hazards.find((h) => h.id === id) : undefined;
  const linkedHazards = road ? hazards.filter(item=>roadHazardIds(road).includes(item.id)) : [];
  const relatedHazard=linkedHazards[0];
  const roadRecord = road ? roadEvidence(road,evidence)[0] : undefined;
  const hazardRecord = hazard ? evidence.find(item => item.hazardId === hazard.id) : undefined;
  const affectedRoads = hazard ? roadsForHazard(roads,hazard.id) : [];
  // Communities named in the hazard's findings, or reached through a road it affects.
  const hazardCommunities = hazard ? communitiesForHazard(communities, routes, hazard.id) : [];
  const nearestAnchor = hazard && !affectedRoads.length ? nearestRoadAnchor(roads, hazard.projected, 2000) : null;
  const nearestRoad = nearestAnchor && { road: roads.find(item => item.id === nearestAnchor.roadId)!, distance: nearestAnchor.distance };
  const site = kind === 'poi' ? responseSites.find(item => item.id === id) : undefined;
  const affectedCommunities = road ? communities.filter(community => {
    const pair = routes.get(community.id);
    return [pair?.candidate, pair?.direct].some(route => route?.segs.some(segment => segment.id === road.id));
  }) : [];
  const observation = roadRecord ? t(...roadRecord.finding) : road?.note ? t(...road.note).replace(/^(Tin|Report at) \d{2}:\d{2}:\s*/i, '') : null;
  const roadObservation = observation ? observation[0].toLocaleUpperCase() + observation.slice(1) : null;
  const statusEdit = road ? editsFor(scenarioEdits, 'road', road.id).find(item => item.change.kind === 'status') : undefined;

  let title = id;
  if (kind === 'road' && road) title = t(road.name[0], road.name[1]);
  else if (kind === 'hazard' && hazard) title = t(hazard.name[0], hazard.name[1]);
  else if (site) title = t(site.name[0], site.name[1]);
  else if (kind === 'aoi' && id === aoi.id) title = t(...aoi.name);

  // Staging routes are computed from the primary staging point only.
  const primaryStaging = site?.kind === 'staging' && responseSites.find(item => item.kind === 'staging')?.id === site.id;
  const reachable = primaryStaging ? communities.filter(community => routes.get(community.id)?.candidate || routes.get(community.id)?.direct)
    .map(community => {
      const pair = routes.get(community.id)!, options = [pair.candidate, pair.direct].filter(route => route != null);
      const best = options.find(route => route.status === 'open') ?? options.find(route => route.status === 'uncertain') ?? options[0];
      return { community, route: best };
    }).sort((a, b) => a.community.prio - b.community.prio || a.community.name.localeCompare(b.community.name)) : [];
  const reachableOpen = reachable.filter(item => item.route.status !== 'blocked').length;

  // The title block of the sheet: what the object is, its state, and the few measured facts.
  const status = road ? <StatusText tone={roadStatusTone(road.status)} icon={roadStatusIcon(road.status)}>{t(...roadStatusLabels[road.status])}</StatusText>
    : hazard ? <StatusText tone="warning">{hazardObservationText(hazard, locale, verification?.status === 'done')}</StatusText>
    : site?.kind === 'hlz' ? <StatusText tone={site.assessment === 'candidate' ? 'warning' : site.assessment === 'unavailable' ? 'critical' : 'neutral'} icon={site.assessment === 'assessed' ? undefined : 'uncertain'}>
        {site.assessment === 'assessed' ? t('Đã khảo sát', 'Assessed') : site.assessment === 'unavailable' ? t('Không sử dụng', 'Unavailable') : t('Đề xuất, chưa khảo sát', 'Proposed, not surveyed')}</StatusText>
    : null;
  const facts: KeyFact[] = (() => {
    if (primaryStaging) return [
      { label: t('Địa bàn có tuyến', 'With a route'), value: reachable.length },
      { label: t('Chưa bị chặn', 'Not blocked'), value: reachableOpen },
      { label: t('Bị chặn', 'Blocked'), value: reachable.length - reachableOpen, tone: reachable.length - reachableOpen ? 'critical' : undefined }
    ];
    if (kind === 'aoi') {
      const inside = communities.filter(community => withinArea(community.projected, aoi.points));
      const blocked = roads.filter(item => item.status === 'blocked').length, uncertain = roads.filter(item => item.status === 'uncertain').length;
      const people = inside.reduce((sum, c) => sum + c.pop, 0);
      return [
        { label: t('Diện tích', 'Area'), value: `${(areaM2(aoi.points) / 1000000).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', { maximumFractionDigits: 1 })} km²` },
        { label: t('Dân cư', 'Residents'), value: <>{t(`${people} người`, `${people} people`)}<small>{t(`${inside.length} địa bàn`, `${inside.length} ${inside.length === 1 ? 'community' : 'communities'}`)}</small></> },
        { label: t('Đoạn bị chặn', 'Blocked'), value: blocked, tone: blocked ? 'critical' : undefined },
        { label: t('Cần xác minh', 'To verify'), value: uncertain, tone: uncertain ? 'warning' : undefined }
      ];
    }
    return [];
  })();

  return (
    <>
      <div className="sidebar-top object-detail-heading">
        <div className="detail-title">
          <div className="detail-name">
            <h1 id="object-title">{title}</h1>
          </div>
          <button className="icon-button panel-close" onClick={onClose} aria-label={t('Đóng chi tiết đối tượng', 'Close feature details')} title={t('Đóng chi tiết đối tượng', 'Close feature details')}><UiIcon name="close" /></button>
        </div>
        {status && <div className="detail-priority detail-meta">{status}{road && <span className="detail-measure">{formatRoadLength(road.len, locale)} km</span>}</div>}
      </div>

      <div className="sidebar-scroll">
        <KeyFacts items={facts}/>
        {kind === 'aoi' && <>
          <div className="area-action">
            <button className="button primary" onClick={onOpenPriority}>{t('Xem địa bàn trong vùng', 'View communities in area')}</button>
          </div>
          <section className="workflow-section"><h3>{t('Nguồn ranh giới', 'Boundary source')}</h3><p className="detail-source">{t(...aoi.source)}</p></section>
        </>}
        {kind === 'road' && road && (
          <>
            {/* Actions on the section first; a status change opens right under them. */}
            <div ref={statusRef} className="detail-actions-group">
              <div className="detail-actions">
                {onSetRoadStatus && <button type="button" className="button road-status-edit-trigger" data-road-status-edit aria-expanded={!!pending} onClick={() => { if(pending){setChange(null);return;} setChange({objectId,status:road.status,note:''}); requestAnimationFrame(() => statusRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus()); }}><UiIcon name="edit" size={16}/>{t('Cập nhật tình trạng', 'Update status')}</button>}
                <button className="button road-profile-action" disabled={!hasTerrainProfile} aria-pressed={profileOpen} onClick={onToggleProfile} title={!hasTerrainProfile ? t('Chưa có dữ liệu độ cao cho đoạn đường này', 'No elevation data for this road section') : undefined}><UiIcon name="profile" size={16}/>{t('Mặt cắt địa hình', 'Elevation profile')}</button>
              </div>
              {pending && onSetRoadStatus && <section className="workflow-section road-status-editor">
                <div className="road-status-switch">
                  <ChoiceGroup label={t('Tình trạng đường', 'Road status')}
                    options={(['open', 'uncertain', 'blocked'] as const).map(value => ({value, label:t(...roadStatusShortLabels[value])}))}
                    value={pending.status}
                    onChange={status => setChange({objectId, status, note:pending.note})}/>
                </div>
                <form className="road-status-change" onSubmit={event => {
                  event.preventDefault();
                  if (onSetRoadStatus(road, pending.status, pending.note.trim())) { setChange(null); restoreStatusFocus(); }
                  else setChange({ ...pending, error: t('Không lưu được thay đổi.', 'Could not save the change.') });
                }}>
                  <details className="status-optional-note">
                    <summary>{t('Thêm ghi chú (tùy chọn)', 'Add note (optional)')}</summary>
                    <textarea aria-label={t('Ghi chú', 'Note')} name="roadStatusReason" rows={2} maxLength={2000} value={pending.note} aria-invalid={!!pending.error} aria-describedby={pending.error ? reasonErrorId : undefined}
                      onChange={event => setChange({ ...pending, note: event.target.value, error: undefined })}/>
                  </details>
                  {pending.error && <p id={reasonErrorId} className="road-status-error" role="alert">{pending.error}</p>}
                  <div className="road-status-actions">
                    <button className="button primary" type="submit" disabled={pending.status === road.status}>{t('Lưu', 'Save')}</button>
                    <button className="button" type="button" onClick={() => { setChange(null); restoreStatusFocus(); }}>{t('Hủy', 'Cancel')}</button>
                  </div>
                </form>
              </section>}
              {failedFor === objectId && <p className="road-status-error" role="alert">{t('Không lưu được thay đổi.', 'Could not save the change.')}</p>}
            </div>
            {(() => {
              const edit = statusEdit;
              if (edit?.change.kind !== 'status') return null;
              // A later field report can supersede the edit; then it is history, not something to undo.
              const effective = road.status === edit.change.to;
              return (
                <section className="workflow-section manual-edit-note">
                  <div className="manual-edit-heading">
                    <h3>{t('Cập nhật gần nhất', 'Latest update')}</h3>
                    {onRevertEdit && effective && <button type="button" className="text-button" onClick={() => setFailedFor(onRevertEdit(edit.id) ? null : objectId)}>{t('Hoàn tác', 'Undo')}</button>}
                  </div>
                  <p><strong>{t(`${roadStatusShortLabels[edit.change.from][0]} → ${roadStatusShortLabels[edit.change.to][0]}`, `${roadStatusShortLabels[edit.change.from][1]} → ${roadStatusShortLabels[edit.change.to][1]}`)}</strong>
                    <small>{edit.author.name}, {observationTime(edit.at, locale)}{edit.reverts && t(' (hoàn tác)', ' (undo)')}</small></p>
                  {edit.note && <details className="manual-edit-comment"><summary>{t('Ghi chú', 'Note')}</summary><p>{edit.note}</p></details>}
                </section>
              );
            })()}
            {verification && <WorkRow label={t('Xác minh khả năng đi qua', 'Verify passage')} verification={verification} locale={locale} onOpen={onOpenWork}/>}
            {linkedHazards.length > 0 && <section className="workflow-section">
              <h3>{t('Sự cố trên đoạn này', 'Incidents on this section')}</h3>
              {linkedHazards.map(hazard => <button key={hazard.id} className="object-row related-incident-row" onClick={() => onSelectObject(`hazard:${hazard.id}`)}>
                <span><strong>{t(...hazard.name)}</strong><small>{[hazard.area != null && `${hazard.area.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB')} ha`, hazardObservationText(hazard, locale).toLocaleLowerCase(locale === 'vi' ? 'vi-VN' : 'en-GB')].filter(Boolean).join(', ')}</small></span>
                <UiIcon name="next" size={16}/></button>)}
            </section>}
            {affectedCommunities.length > 0 && <section className="workflow-section">
              <h3>{t('Tuyến đi qua đoạn này', 'Routes using this section')}</h3>
              {affectedCommunities.flatMap(community => {
                const pair = routes.get(community.id);
                return [pair?.candidate, pair?.direct].filter(route => route?.segs.some(segment => segment.id === road.id)).map(route => route && <button key={community.id + route.type} className="object-row linked-row" onClick={() => onSelectCommunity(community.id, route.type, road.id)}>
                  <span><strong>{t(...route.name)}</strong><small>{peopleText(community, locale)}</small></span><UiIcon name="next" size={16}/>
                </button>);
              })}
            </section>}
            {mappedAreas.some(r => landslideAreaOf(r)?.roadLinks.some(l => l.roadId === road.id)) && <section className="workflow-section"><h3>{t('Vùng sạt lở liên quan', 'Linked landslide areas')}</h3>{mappedAreas.filter(r => landslideAreaOf(r)?.roadLinks.some(l => l.roadId === road.id)).map(record => {
              const value=landslideAreaOf(record)!, link=value.roadLinks.find(l=>l.roadId===road.id)!;
              return <button className="object-row" key={record.id} onClick={() => onOpenMappedArea?.(record.id)}><span><strong>{record.name}</strong><small>{areaLabel(value.state,locale)}{link.fromM!==undefined?`, ${link.fromM}–${link.toM} m`:''}</small></span><UiIcon name="next" size={16}/></button>;
            })}</section>}
            {/* Why the section has this status, and from which source: read last. */}
            {roadObservation && <section className="object-observation">
              <h3>{t('Cơ sở đánh giá', 'Basis')}</h3>
              <p>{roadObservation}</p>
              {roadRecord ? <dl className="fact-rows">
                <div><dt>{t('Nguồn', 'Source')}</dt><dd>{evidencePresentation(roadRecord.type, locale).kind}</dd></div>
                <div><dt>{t('Thời gian', 'Time')}</dt><dd><SourceTimes observedAt={roadRecord.observedAt} receivedAt={roadRecord.receivedAt} labels={evidencePresentation(roadRecord.type, locale)} locale={locale}/></dd></div>
              </dl> : relatedHazard && <dl className="fact-rows">
                <div><dt>{t('Nguồn', 'Source')}</dt><dd>{t(...relatedHazard.src)}</dd></div>
                <div><dt>{t('Phát hiện', 'Detected')}</dt><dd>{relatedHazard.detected.split(' ').reverse().join(', ')}</dd></div>
              </dl>}
              {roadRecord && <button className="text-button evidence-open" onClick={() => onOpenEvidence(roadRecord.hazardId)}>{evidencePresentation(roadRecord.type, locale).action}<UiIcon name="next" size={14}/></button>}
            </section>}
          </>
        )}

        {kind === 'hazard' && hazard && (
          <section className="hazard-detail">
            {fieldPhotos?.get(hazard.id) && <FieldPhotoStrip point={fieldPhotos.get(hazard.id)!} locale={locale}/>}
            {verification && <WorkRow label={t('Kiểm chứng tại hiện trường', 'Verify on site')} verification={verification} locale={locale} onOpen={onOpenWork}/>}
            <section className="workflow-section hazard-impact">
              <h3>{t('Ảnh hưởng', 'Impact')}</h3>
              <ol className="impact-trace">
                {affectedRoads.map(item => <li key={item.id} data-tone={roadStatusTone(item.status)}><button className="object-row impact-row" onClick={() => onSelectObject(`road:${item.id}`)}><span><strong>{t(...item.name)}</strong><small>{formatRoadLength(item.len,locale)} km</small></span><StatusText tone={roadStatusTone(item.status)} icon={roadStatusIcon(item.status)}>{t(...roadStatusShortLabels[item.status])}</StatusText></button></li>)}
                {/* Not linked yet: the nearest road and its distance tell where to look first. */}
                {!affectedRoads.length && nearestRoad && <li data-tone="neutral"><button className="object-row impact-row" onClick={() => onSelectObject(`road:${nearestRoad.road.id}`)}>
                  <span><strong>{t(...nearestRoad.road.name)}</strong><small>{t(`Gần nhất, cách ${distanceText(nearestRoad.distance)}, chưa xác định ảnh hưởng`, `Nearest, ${distanceText(nearestRoad.distance)} away, impact not established`)}</small></span>
                  <StatusText tone={roadStatusTone(nearestRoad.road.status)} icon={roadStatusIcon(nearestRoad.road.status)}>{t(...roadStatusShortLabels[nearestRoad.road.status])}</StatusText>
                </button></li>}
                {hazardCommunities.map(community => <li key={community.id} data-tone={community.prio === 1 ? 'priority' : 'neutral'}><CommunityImpactRow community={community} locale={locale} onSelect={() => onSelectCommunity(community.id)}/></li>)}
              </ol>
              {!affectedRoads.length && !nearestRoad && <p className="detail-empty">{t('Chưa gắn với đoạn đường nào.', 'Not linked to a road section.')}</p>}
            </section>
            <details className="workflow-section hazard-basis">
              <summary>{t('Nguồn và phân tích', 'Source and analysis')}</summary>
              {hazardRecord && findingAddsDetail(title, t(...hazardRecord.finding)) && <p className="detail-lead">{t(...hazardRecord.finding)}</p>}
              <dl className="fact-rows">
                {hazard.area != null && (hazard.kind === 'landslide' || hazard.kind === 'flood') && !(hazardRecord && findingAddsDetail(title,t(...hazardRecord.finding)) && findingStatesArea(t(...hazardRecord.finding),hazard.area)) && <div><dt>{t('Diện tích ước tính', 'Estimated area')}</dt><dd>{hazard.area.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB')} ha</dd></div>}
                <div><dt>{t('Nguồn', 'Source')}</dt><dd>{t(...hazard.src)}</dd></div>
                {hazardRecord && <div><dt>{t('Giới hạn', 'Limitation')}</dt><dd>{t(...hazardRecord.limitation)}</dd></div>}
              </dl>
              <button className="text-button evidence-open" onClick={() => onOpenEvidence(hazard.id)}>{hazardRecord ? evidencePresentation(hazardRecord.type, locale).action : t('Xem chi tiết', 'View details')}<UiIcon name="next" size={14}/></button>
            </details>

          </section>
        )}

        {kind === 'poi' && site && site.kind === 'hlz' && (
          <section className="site-detail">
            {/* Straight-line distance is what matters for a helicopter, not the road route. */}
            <section className="workflow-section">
              <h3>{t('Địa bàn gần nhất', 'Nearest communities')}</h3>
              {[...communities].sort((a, b) => Math.hypot(a.projected.x - site.projected.x, a.projected.y - site.projected.y) - Math.hypot(b.projected.x - site.projected.x, b.projected.y - site.projected.y))
                .slice(0, 3).map(community => <CommunityImpactRow key={community.id} community={community} locale={locale}
                  note={`${distanceText(Math.hypot(community.projected.x - site.projected.x, community.projected.y - site.projected.y))} ${t('đường chim bay', 'straight line')}`}
                  onSelect={() => onSelectCommunity(community.id)}/>)}
            </section>
            <section className="workflow-section">
              <dl className="fact-rows">
                <div><dt>{t('Cập nhật', 'Updated')}</dt><dd>{observationTime(site.observedAt, locale)}</dd></div>
                <div><dt>{t('Nguồn', 'Source')}</dt><dd>{t(...site.source)}</dd></div>
              </dl>
            </section>
          </section>
        )}
        {kind === 'poi' && site && site.kind === 'staging' && (() => {
          const primary = primaryStaging;
          return <section className="site-detail">
            {primary && <section className="workflow-section">
              <h3>{t('Tuyến từ điểm này', 'Routes from here')}</h3>
              {reachable.map(({ community, route }) => <CommunityImpactRow key={community.id} community={community} locale={locale}
                note={`${t(...roadStatusLabels[route.status])}${route.eta ? `, ${route.eta.minMinutes}–${route.eta.maxMinutes} ${t('phút', 'min')}` : ''}`}
                onSelect={() => onSelectCommunity(community.id, route.type)}/>)}
            </section>}
            {!primary && (siteContent?.(site.id) || <p className="detail-empty">{t('Tuyến tiếp cận đang tính từ điểm tập kết chính.', 'Access routes are calculated from the primary staging point.')}</p>)}
          </section>;
        })()}

      </div>
    </>
  );
};
