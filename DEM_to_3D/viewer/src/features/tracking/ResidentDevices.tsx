import {useSyncExternalStore} from 'react';
import type {Locale,RoadSegment} from '../../types/dear';
import {UiIcon} from '../../shared/ui/UiIcon';
import {StatusText} from '../../shared/ui/StatusText';
import type {DevicePosition,LocationFeed} from './deviceFeed';
import {deviceStatusText} from './trackingOverlay';
import './resident-devices.css';
const noSubscription=()=>()=>undefined;
type ResidentRow=Omit<DevicePosition,'point'|'stationM'>;
const stranded=(device:Pick<DevicePosition,'role'|'state'|'closureRoadId'>)=>device.role==='resident'&&!!device.closureRoadId&&['waiting','approaching','assisting'].includes(device.state);
function useResidentRows(feed:LocationFeed|null) {
  const value=useSyncExternalStore(feed?.subscribe??noSubscription,()=>JSON.stringify(feed?.getSnapshot().filter(device=>device.role==='resident').map(({point,stationM,...device})=>device)??[]));
  return JSON.parse(value) as ResidentRow[];
}
export function ResidentDeviceList({feed,roads,locale,onSelect,selectedId}:{feed:LocationFeed|null;roads:RoadSegment[];locale:Locale;onSelect:(id:string)=>void;selectedId?:string|null}) {
  const t=(vi:string,en:string)=>locale==='vi'?vi:en;
  const devices=useResidentRows(feed).filter(stranded).sort((a,b)=>Number(b.state==='waiting')-Number(a.state==='waiting')||a.name[0].localeCompare(b.name[0]));
  const groups=new Map<string,ResidentRow[]>();
  devices.forEach(device=>{const road=roads.find(road=>road.id===device.closureRoadId);const key=road?.sourceRoadId??road?.name.join(' / ')??device.closureRoadId!;groups.set(key,[...(groups.get(key)??[]),device]);});
  if(!devices.length)return null;
  return <section className="resident-devices-section">
    <h2 className="incident-section-title"><span>{t('Người đang kẹt','Stranded residents')}</span><small>{t(`${devices.length} thiết bị`,`${devices.length} ${devices.length===1?'device':'devices'}`)}</small></h2>
    {[...groups].map(([roadId,people])=><div className="resident-road-group" key={roadId}>
      <h3>{roads.find(road=>road.id===people[0].closureRoadId)?.name[locale==='vi'?0:1]??people[0].roadName[locale==='vi'?0:1]}</h3>
      {people.map(device=><button key={device.id} className="incident-landslide-row resident-device-row" data-resident-device={device.id} aria-current={device.id===selectedId||undefined} onClick={()=>onSelect(device.id)}>
        <i className="tracked-device-symbol is-resident" aria-hidden="true"/>
        <span className="incident-landslide-copy"><strong>{device.name[locale==='vi'?0:1]}</strong><small>{device.id}</small></span>
        <small className="incident-status" data-tone="warning">{device.state==='approaching'?t('Đang tới','Approaching'):device.state==='assisting'?t('Đang hỗ trợ','Being assisted'):t('Chờ cứu hộ','Waiting for rescue')}</small>
      </button>)}
    </div>)}
  </section>;
}
export function ResidentDeviceDetail({feed,id,roads,locale,onClose,onShow,onRoad}:{feed:LocationFeed|null;id:string;roads:RoadSegment[];locale:Locale;onClose:()=>void;onShow:(point:{x:number;y:number})=>void;onRoad:(id:string)=>void}) {
  const t=(vi:string,en:string)=>locale==='vi'?vi:en;
  const device=useResidentRows(feed).find(device=>device.id===id);
  const clock=new Intl.DateTimeFormat(locale==='vi'?'vi-VN':'en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Ho_Chi_Minh'});
  const blocked=roads.find(road=>road.id===device?.closureRoadId);
  return <>
    <div className="sidebar-top object-detail-heading resident-device-heading" data-tracked-device={id}>
      <div className="detail-title"><div className="detail-name"><p>{t('Vị trí người dân','Resident location')}</p><h1>{device?.name[locale==='vi'?0:1]??t('Thiết bị','Device')}</h1></div>
        <button className="icon-button panel-close" onClick={onClose} aria-label={t('Đóng chi tiết thiết bị','Close device details')}><UiIcon name="close"/></button></div>
      {device&&<div className="detail-priority detail-meta"><StatusText tone={stranded(device)?'warning':'neutral'}>{deviceStatusText(device,locale)}</StatusText></div>}
    </div>
    <div className="sidebar-scroll resident-device-detail">
      {!device?<p className="detail-empty">{t('Không còn tín hiệu của thiết bị này.','No signal from this device.')}</p>:<>
        <section className="workflow-section"><h3>{t('Vị trí','Location')}</h3><button className="object-row" aria-label={t('Xem đoạn đường','Inspect road section')} onClick={()=>onRoad(device.roadId)}><strong>{device.roadName[locale==='vi'?0:1]}</strong><UiIcon name="next" size={16}/></button>
          {blocked&&blocked.id!==device.roadId&&<button className="object-row" onClick={()=>onRoad(blocked.id)}><span><small>{t('Đoạn bị chặn','Blocked section')}</small>{blocked.name[locale==='vi'?0:1]!==device.roadName[locale==='vi'?0:1]&&<strong>{blocked.name[locale==='vi'?0:1]}</strong>}</span><UiIcon name="next" size={16}/></button>}
        </section>
        <section className="workflow-section resident-device-facts"><h3>{t('Thiết bị','Device')}</h3>
          <dl>{device.householdName&&<div><dt>{t('Hộ dân','Household')}</dt><dd>{device.householdName[locale==='vi'?0:1]}</dd></div>}
            <div><dt>{t('Mã thiết bị','Device ID')}</dt><dd>{device.id}</dd></div><div><dt>{t('Cập nhật','Updated')}</dt><dd>{clock.format(device.updatedAt)}</dd></div></dl>
        </section>
        <div className="area-action"><button className="button" onClick={()=>{const current=feed?.getSnapshot().find(device=>device.id===id);if(current)onShow(current.point);}}><UiIcon name="fit" size={16}/>{t('Xem trên bản đồ','Show on map')}</button></div>
      </>}
    </div>
  </>;
}
