import type { Locale } from '../../types/dear';
import type { DeviceFeed,DevicePosition } from './deviceFeed';
import { deviceGlyph } from './deviceSymbols';
type Pixel={x:number;y:number;visible:boolean};
/** Both map adapters share symbols, selection, keyboard handling and the same location snapshots. */
export function createTrackingOverlay(host:HTMLElement,feed:DeviceFeed,locale:Locale,
  project:(point:{x:number;y:number})=>Pixel|null,interactive:()=>boolean,onRoad?:(id:string)=>void) {
  const vi=locale==='vi',t=(a:string,b:string)=>vi?a:b;
  const layer=document.createElement('div');layer.className='tracked-devices';layer.setAttribute('aria-label',t('Vị trí người dân và cứu hộ','Resident and rescue locations'));host.append(layer);
  const markers=new Map<string,HTMLButtonElement>();
  for(const device of feed.getSnapshot()){
    const button=document.createElement('button');button.type='button';button.className='tracked-device is-'+device.role;
    button.dataset.deviceId=device.id;button.dataset.deviceRole=device.role;
    button.setAttribute('aria-label',device.name[vi?0:1]);button.innerHTML=deviceGlyph(device.role);
    const name=document.createElement('span');name.className='tracked-device-name';name.textContent=device.name[vi?0:1];button.append(name);
    button.addEventListener('click',event=>{event.stopPropagation();selected=device.id;update();});
    layer.append(button);markers.set(device.id,button);
  }
  let selected:string|null=null;
  const card=document.createElement('section');card.className='tracked-device-card';card.hidden=true;card.setAttribute('aria-label',t('Thông tin thiết bị','Device details'));
  const header=document.createElement('header'),head=document.createElement('div'),title=document.createElement('strong'),id=document.createElement('small');head.append(title,id);
  const close=document.createElement('button');close.type='button';close.className='icon-button';close.textContent='×';close.setAttribute('aria-label',t('Đóng thiết bị','Close device'));
  const closeCard=(restore=false)=>{const previous=selected;selected=null;card.hidden=true;markers.forEach(marker=>marker.classList.remove('is-selected'));if(restore&&previous)markers.get(previous)?.focus();};
  close.addEventListener('click',()=>closeCard(true));header.append(head,close);
  const state=document.createElement('p'),road=document.createElement('p'),signal=document.createElement('p');signal.className='device-signal';
  card.append(header,state,road,signal);
  if(onRoad){const inspect=document.createElement('button');inspect.type='button';inspect.className='text-button';inspect.textContent=t('Xem đoạn đường','Inspect road section');inspect.onclick=()=>{const device=feed.getSnapshot().find(d=>d.id===selected);if(device){closeCard();onRoad(device.roadId);}};card.append(inspect);}
  layer.append(card);
  const text=(node:HTMLElement,value:string)=>{if(node.textContent!==value)node.textContent=value;};
  const clock=new Intl.DateTimeFormat(vi?'vi-VN':'en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Ho_Chi_Minh'});
  function updateCard(device:DevicePosition,at:Pixel) {
    card.hidden=false;text(title,device.name[vi?0:1]);text(id,device.id);
    const target=device.targetName?.[vi?0:1];
    const status=device.state==='waiting'?t('Đang chờ cứu hộ','Waiting for rescue')
      :device.state==='dispatching'?t('Chờ điều động','Awaiting dispatch')
      :device.state==='responding'?t('Đang tới hỗ trợ','Responding')
      :device.state==='assisting'?t('Đang hỗ trợ tại điểm chặn','Providing assistance at closure')
      :device.state==='escorting'?device.role==='rescue'?t('Đang đưa người dân về','Escorting residents back'):t('Đang đi cùng đội cứu hộ','Returning with rescue team')
      :device.state==='arrived'?device.missionId?t('Đã về điểm tập kết','At the assembly point'):t('Đã tới cuối đoạn đường','At the end of the road segment')
      :device.state==='approaching'?t('Đang tiếp cận đoạn chặn','Approaching a closure'):device.state==='stopped'?t('Đã dừng','Stopped'):t('Đang di chuyển','Moving');
    text(state,status+(target&&device.role==='rescue'?`, ${target}`:''));
    state.className=device.state==='waiting'||device.state==='approaching'?'device-warning':'';
    text(road,device.roadName[vi?0:1]);text(signal,t('Tín hiệu lúc ','Signal at ')+clock.format(device.updatedAt));
    const width=card.offsetWidth,height=card.offsetHeight;
    const positions=[{x:at.x+24,y:at.y+12},{x:at.x-width-24,y:at.y+12},{x:at.x-width/2,y:at.y-height-24},{x:12,y:12}];
    const parent=host.getBoundingClientRect();
    const obstacles=Array.from(host.closest('.map-area')?.querySelectorAll<HTMLElement>('.road-journey-panel,.local-area-card,#response-details,.citizen-map-summary,.layers-panel')??[]).filter(node=>node.getClientRects().length).map(node=>node.getBoundingClientRect());
    const choice=positions.find(p=>p.x>=8&&p.y>=8&&p.x+width<=host.clientWidth-8&&p.y+height<=host.clientHeight-8&&!obstacles.some(box=>p.x+parent.left<box.right&&p.x+parent.left+width>box.left&&p.y+parent.top<box.bottom&&p.y+parent.top+height>box.top))??{x:12,y:Math.max(8,host.clientHeight-height-12)};
    card.style.left=`${choice.x}px`;card.style.top=`${choice.y}px`;
  }
  function update() {
    const enabled=interactive();layer.style.pointerEvents=enabled?'':'none';
    let selectedVisible=false;
    for(const device of feed.getSnapshot()){
      const marker=markers.get(device.id);if(!marker)continue;
      const at=project(device.point);marker.hidden=!at||!at.visible||at.x< -16||at.y< -16||at.x>host.clientWidth+16||at.y>host.clientHeight+16;
      marker.disabled=!enabled;marker.tabIndex=enabled?0:-1;marker.style.pointerEvents=enabled?'auto':'none';
      marker.dataset.deviceRoad=device.roadId;marker.dataset.roadState=device.roadStatus;marker.dataset.motion=device.state;marker.dataset.closureRoad=device.closureRoadId??'';marker.dataset.mission=device.missionId??'';marker.dataset.targetDevice=device.targetId??'';
      marker.dataset.worldX=device.point.x.toFixed(3);marker.dataset.worldY=device.point.y.toFixed(3);marker.dataset.signal=String(device.updatedAt);
      marker.classList.toggle('is-selected',selected===device.id);
      const partner=device.targetId?feed.getSnapshot().find(item=>item.id===device.targetId):undefined;
      const partnerAt=partner?project(partner.point):null;
      const separation=at&&partnerAt?Math.hypot(at.x-partnerAt.x,at.y-partnerAt.y):Infinity;
      const spread=Math.max(0,(40-separation)/2);
      const dx=at&&partnerAt&&separation>.01?(at.x-partnerAt.x)/separation:device.role==='rescue'?1:-1;
      const dy=at&&partnerAt&&separation>.01?(at.y-partnerAt.y)/separation:0;
      const displayX=(at?.x??0)+spread*dx,displayY=(at?.y??0)+spread*dy;
      if(at)marker.style.transform=`translate(${displayX-(device.role==='rescue'?14.5:13)}px,${displayY-(device.role==='rescue'?14.5:13)}px)`;
      if(selected===device.id&&at&&at.visible&&!marker.hidden&&enabled){selectedVisible=true;updateCard(device,at);}
    }
    if(!selectedVisible)card.hidden=true;
  }
  const outside=(event:PointerEvent)=>{if(selected&&!layer.contains(event.target as Node))closeCard();};
  const escape=(event:KeyboardEvent)=>{if(selected&&event.key==='Escape'){event.preventDefault();event.stopPropagation();closeCard(true);}};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);
  const unsubscribe=feed.subscribe(update);update();
  return {update,dispose:()=>{unsubscribe();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);layer.remove();}};
}
