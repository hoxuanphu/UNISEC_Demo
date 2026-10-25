import { latestOperationalReports } from '../observations/operationalReports';
import {useSyncExternalStore} from 'react';
import type {Locale,RoadSegment} from '../../types/dear';
import {UiIcon} from '../../shared/ui/UiIcon';
import {StatusText} from '../../shared/ui/StatusText';
import type {DevicePosition,LocationFeed} from './deviceFeed';
import {deviceStatusText} from './trackingOverlay';
import type {GeometryRecord} from '../../geo/vector/types';
import {observationOf} from '../observations/model';
import {observationLabel} from '../observations/labels';
import {PhotoGallery} from '../observations/PhotoGallery';
import {reportPhotoContext} from '../observations/photoSummary';
import {VoicePlayback} from '../observations/VoicePlayback';
import {submissionOf} from '../access/submissions';
import {deviceContact,submissionMatchesDevice} from './deviceContacts';
import './resident-devices.css';
const noSubscription=()=>()=>undefined;
type ResidentRow=Omit<DevicePosition,'point'|'stationM'>;
const stranded=(device:Pick<DevicePosition,'role'|'state'|'closureRoadId'>)=>device.role==='resident'&&!!device.closureRoadId&&['waiting','approaching','assisting'].includes(device.state);
function useResidentRows(feed:LocationFeed|null) {
  const value=useSyncExternalStore(feed?.subscribe??noSubscription,()=>JSON.stringify(feed?.getSnapshot().filter(device=>device.role==='resident').map(({point,stationM,...device})=>device)??[]));
  return JSON.parse(value) as ResidentRow[];
}
/** When this phone's owner last asked for rescue from the app, if they have. */
function rescueRequestAt(id:string,records:readonly GeometryRecord[]):string|null {
  return records.flatMap(record=>{const submission=submissionOf(record);return submissionMatchesDevice(submission,id)&&observationOf(record)?.kind==='help'?[submission!.submittedAt]:[];}).sort().at(-1)??null;
}
export function ResidentDeviceList({feed,roads,locale,onSelect,selectedId,records=[]}:{feed:LocationFeed|null;roads:RoadSegment[];locale:Locale;onSelect:(id:string)=>void;selectedId?:string|null;records?:GeometryRecord[]}) {
  const t=(vi:string,en:string)=>locale==='vi'?vi:en;
  const clock=(iso:string)=>new Date(iso).toLocaleTimeString(locale==='vi'?'vi-VN':'en-GB',{hour:'2-digit',minute:'2-digit'});
  const devices=useResidentRows(feed).filter(device=>stranded(device)||records.some(record=>submissionMatchesDevice(submissionOf(record),device.id)&&observationOf(record)?.kind==='help'&&submissionOf(record)?.review.status==='pending')).sort((a,b)=>Number(b.state==='waiting')-Number(a.state==='waiting')||a.name[0].localeCompare(b.name[0]));
  const groups=new Map<string,ResidentRow[]>();
  devices.forEach(device=>{const road=roads.find(road=>road.id===(device.closureRoadId??device.roadId));const key=road?.sourceRoadId??road?.name.join(' / ')??device.closureRoadId??device.roadId;groups.set(key,[...(groups.get(key)??[]),device]);});
  if(!devices.length)return null;
  return <section className="resident-devices-section">
    <h2 className="incident-section-title"><span>{t('Người cần hỗ trợ','Residents needing help')}</span><small>{t(`${devices.length} thiết bị`,`${devices.length} ${devices.length===1?'device':'devices'}`)}</small></h2>
    {[...groups].map(([roadId,people])=><div className="resident-road-group" key={roadId}>
      <h3>{roads.find(road=>road.id===(people[0].closureRoadId??people[0].roadId))?.name[locale==='vi'?0:1]??people[0].roadName[locale==='vi'?0:1]}</h3>
      {people.map(device=><button key={device.id} className="incident-landslide-row resident-device-row" data-resident-device={device.id} aria-current={device.id===selectedId||undefined} onClick={()=>onSelect(device.id)}>
        <i className="tracked-device-symbol is-resident" aria-hidden="true"/>
        <span className="incident-landslide-copy"><strong>{device.name[locale==='vi'?0:1]}</strong>{(()=>{const asked=rescueRequestAt(device.id,records);return asked?<small className="resident-device-asked">{t(`Gửi yêu cầu cứu lúc ${clock(asked)}`,`Asked for rescue at ${clock(asked)}`)}</small>:<small>{deviceContact(device.id)?.phone??device.id}</small>;})()}</span>
        <small className="incident-status" data-tone="warning">{!stranded(device)?t('Cầu cứu','Rescue requested'):device.state==='approaching'?t('Sắp tới chỗ chặn','Nearing closure'):device.state==='assisting'?t('Đang hỗ trợ','Being assisted'):t('Chờ cứu hộ','Waiting for rescue')}</small>
      </button>)}
    </div>)}
  </section>;
}
/** The person behind a tracked phone, in the order a coordinator acts: what they reported, how to reach them, where they are. */
export function ResidentDeviceDetail({feed,id,roads,locale,onClose,onShow,onRoad,records=[],onReport,onDispatch,onApproach,onShowTeam,onGuidance,onReviewProposal}:{feed:LocationFeed|null;id:string;roads:RoadSegment[];locale:Locale;onClose:()=>void;onShow:(point:{x:number;y:number})=>void;onRoad:(id:string)=>void;
  /** Field records, to find what this person reported from the resident app. */
  records?:GeometryRecord[];onReport?:(id:string)=>void;onDispatch?:()=>void;onApproach?:()=>void;onShowTeam?:(id:string)=>void;onGuidance?:()=>void;onReviewProposal?:(record:GeometryRecord)=>void}) {
  const t=(vi:string,en:string)=>locale==='vi'?vi:en;
  const device=useResidentRows(feed).find(device=>device.id===id);
  const clock=new Intl.DateTimeFormat(locale==='vi'?'vi-VN':'en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Ho_Chi_Minh'});
  const blocked=roads.find(road=>road.id===device?.closureRoadId);
  const contact=deviceContact(id);
  const assigned=feed?.getSnapshot().find(team=>team.role==='rescue'&&team.targetId===id);
  const time=(iso:string)=>new Date(iso).toLocaleString(locale==='vi'?'vi-VN':'en-GB',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'});
  const reports=records.filter(record=>submissionMatchesDevice(submissionOf(record),id)&&observationOf(record))
    .sort((a,b)=>submissionOf(b)!.submittedAt.localeCompare(submissionOf(a)!.submittedAt));
  const needsResponse=!!device&&(stranded(device)||reports.some(record=>observationOf(record)?.kind==='help'&&submissionOf(record)?.review.status==='pending'));
  const activeIds=new Set(latestOperationalReports(reports).map(record=>record.id));
  const currentReports=[...reports.filter(record=>activeIds.has(record.id)),...reports.filter(record=>!activeIds.has(record.id)&&observationOf(record)?.kind!=='help'&&!record.feature.properties.dearRouteProposal)].slice(0,3);
  const currentIds=new Set(currentReports.map(record=>record.id)),olderReports=reports.filter(record=>!currentIds.has(record.id));
  const renderReport=(record:GeometryRecord)=>{const observation=observationOf(record)!;return <article key={record.id} data-kind={observation.kind}>
            <button className="object-row" onClick={()=>onReport?.(record.id)}><span><strong>{record.feature.properties.dearRouteProposal?t('Đề xuất tuyến','Route proposal'):observationLabel(observation.kind,locale)}</strong><small>{time(submissionOf(record)!.submittedAt)}</small></span><UiIcon name="next" size={16}/></button>
            {observation.note&&!['Rescue needed at this location.','Cần cứu hộ tại vị trí này.'].includes(observation.note)&&<p>{observation.note}</p>}
            {record.feature.properties.dearRouteProposal&&onReviewProposal?<button className="text-button" onClick={()=>onReviewProposal(record)}>{t('Xem tuyến đề xuất','Review proposed route')}</button>:null}
            {observation.voice&&<VoicePlayback voice={observation.voice} locale={locale}/>}
            {observation.photos.length>0&&<PhotoGallery photos={observation.photos} locale={locale} reported={reportPhotoContext(record)}/>}
          </article>;};
  return <>
    <div className="sidebar-top object-detail-heading resident-device-heading" data-tracked-device={id}>
      <div className="detail-title"><div className="detail-name"><p>{t('Vị trí người dân','Resident location')}</p><h1>{device?.name[locale==='vi'?0:1]??t('Thiết bị','Device')}</h1></div>
        <button className="icon-button panel-close" onClick={onClose} aria-label={t('Đóng chi tiết thiết bị','Close device details')}><UiIcon name="close"/></button></div>
      {device&&<div className="detail-priority detail-meta"><StatusText tone={needsResponse?'warning':'neutral'}>{needsResponse&&!stranded(device)?t('Có yêu cầu cứu hộ','Rescue requested'):deviceStatusText(device,locale)}</StatusText></div>}
    </div>
    <div className="sidebar-scroll resident-device-detail">
      {!device?<p className="detail-empty">{t('Không còn tín hiệu của thiết bị này.','No signal from this device.')}</p>:<>
        <div className="area-action resident-device-actions">
          {needsResponse&&!assigned&&onDispatch&&<button className="button primary" onClick={onDispatch}>{t('Điều đội cứu hộ','Dispatch team')}</button>}
          {onGuidance&&<button className="button" onClick={onGuidance}>{t('Hướng dẫn di chuyển','Travel guidance')}</button>}
          {needsResponse&&onApproach&&<button className="button" onClick={onApproach}>{t('Điểm tiếp cận','Approach point')}</button>}
        </div>
        {reports.length>0&&<section className="workflow-section resident-device-reports"><h3>{t('Trình báo','Reports')}<small>{reports.length}</small></h3>
          {currentReports.map(renderReport)}
          {olderReports.length>0&&<details className="resident-report-history"><summary>{t('Lịch sử','History')} · {olderReports.length}</summary>{olderReports.map(renderReport)}</details>}
        </section>}
        {contact&&<section className="workflow-section resident-device-facts"><h3>{t('Liên lạc','Contact')}</h3>
          <dl><div><dt>{t('Số điện thoại','Phone')}</dt><dd><a href={`tel:${contact.phone.replace(/[^+\d]/g,'')}`}>{contact.phone}</a></dd></div>
            {device.householdName&&<div><dt>{t('Hộ dân','Household')}</dt><dd>{device.householdName[locale==='vi'?0:1]}</dd></div>}</dl>
        </section>}
        <section className="workflow-section"><h3>{t('Vị trí','Location')}</h3><button className="object-row" aria-label={t('Xem đoạn đường','Inspect road section')} onClick={()=>onRoad(device.roadId)}><strong>{device.roadName[locale==='vi'?0:1]}</strong><UiIcon name="next" size={16}/></button>
          {blocked&&blocked.id!==device.roadId&&<button className="object-row" onClick={()=>onRoad(blocked.id)}><span><small>{t('Đoạn bị chặn','Blocked section')}</small>{blocked.name[locale==='vi'?0:1]!==device.roadName[locale==='vi'?0:1]&&<strong>{blocked.name[locale==='vi'?0:1]}</strong>}</span><UiIcon name="next" size={16}/></button>}
        </section>
        {assigned&&<section className="workflow-section"><h3>{t('Đội được giao','Assigned team')}</h3><button className="object-row" onClick={()=>onShowTeam?.(assigned.id)}><span><strong>{assigned.name[locale==='vi'?0:1]}</strong><small>{deviceStatusText(assigned,locale)}</small></span><UiIcon name="next" size={16}/></button></section>}
        <section className="workflow-section resident-device-facts"><h3>{t('Thiết bị','Device')}</h3>
          <dl>{!contact&&device.householdName&&<div><dt>{t('Hộ dân','Household')}</dt><dd>{device.householdName[locale==='vi'?0:1]}</dd></div>}
            <div><dt>{t('Mã thiết bị','Device ID')}</dt><dd>{device.id}</dd></div><div><dt>{t('Cập nhật','Updated')}</dt><dd>{clock.format(device.updatedAt)}</dd></div></dl>
        </section>
        <div className="area-action"><button className="button" onClick={()=>{const current=feed?.getSnapshot().find(device=>device.id===id);if(current)onShow(current.point);}}><UiIcon name="fit" size={16}/>{t('Xem trên bản đồ','Show on map')}</button></div>
      </>}
    </div>
  </>;
}
