import type { Locale } from '../../types/dear';
import type { DeviceFeed,DevicePosition } from './deviceFeed';
import { groupDeviceDots } from './deviceDotGroups';
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
    button.setAttribute('aria-label',device.name[vi?0:1]);
    const dot=document.createElement('span');dot.className='tracked-device-dot location-signal-dot';dot.setAttribute('aria-hidden','true');button.append(dot);
    const name=document.createElement('span');name.className='tracked-device-name';name.textContent=device.name[vi?0:1];button.append(name);
    button.addEventListener('click',event=>{event.stopPropagation();selected=device.id;update();});
    button.style.setProperty('--signal-delay',`${markers.size*.31}s`);
    layer.append(button);markers.set(device.id,button);
  }
  let selected:string|null=null;
  const card=document.createElement('section');card.className='tracked-device-card';card.hidden=true;card.setAttribute('aria-label',t('Thông tin thiết bị','Device details'));
  const header=document.createElement('header'),head=document.createElement('div'),title=document.createElement('strong'),id=document.createElement('small');head.append(title,id);
  const close=document.createElement('button');close.type='button';close.className='icon-button';close.textContent='×';close.setAttribute('aria-label',t('Đóng thiết bị','Close device'));
  const closeCard=(restore=false)=>{const previous=selected;selected=null;card.hidden=true;markers.forEach(marker=>marker.classList.remove('is-selected'));if(restore&&previous){const anchor=markers.get(previous);(anchor?.hidden?markers.get(anchor.dataset.groupLeader??''):anchor)?.focus();}};
  close.addEventListener('click',()=>closeCard(true));header.append(head,close);
  const nearby=document.createElement('nav');nearby.className='device-nearby';nearby.setAttribute('aria-label',t('Thiết bị tại đây','Devices here'));nearby.hidden=true;
  const peerButtons=new Map<string,HTMLButtonElement>();
  const state=document.createElement('p'),road=document.createElement('p'),signal=document.createElement('p');signal.className='device-signal';
  card.append(header,nearby,state,road,signal);
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
    const obstacles=Array.from(host.closest('.map-area')?.querySelectorAll<HTMLElement>('.road-journey-panel,.local-area-card,#response-details,.citizen-map-summary,.layers-panel,.map-bottom-bar,.map-toolbar,.profile-panel')??[]).filter(node=>node.getClientRects().length).map(node=>node.getBoundingClientRect());
    const choice=positions.find(p=>p.x>=8&&p.y>=8&&p.x+width<=host.clientWidth-8&&p.y+height<=host.clientHeight-8&&!obstacles.some(box=>p.x+parent.left<box.right&&p.x+parent.left+width>box.left&&p.y+parent.top<box.bottom&&p.y+parent.top+height>box.top))??{x:12,y:Math.max(8,host.clientHeight-height-12)};
    card.style.left=`${choice.x}px`;card.style.top=`${choice.y}px`;
  }
  let zooming=false;
  function update() {
    if(zooming)return;
    const enabled=interactive();layer.style.pointerEvents=enabled?'':'none';
    const snapshot=feed.getSnapshot(),projected=new Map(snapshot.map(device=>[device.id,project(device.point)]));
    const groups=groupDeviceDots(snapshot.flatMap(device=>{const at=projected.get(device.id);return at?.visible&&at.x>=0&&at.y>=0&&at.x<=host.clientWidth&&at.y<=host.clientHeight?[{id:device.id,x:at.x,y:at.y}]:[];}));
    const membership=new Map(groups.flatMap(group=>group.members.map(id=>[id,group] as const)));
    for(const device of snapshot){
      const marker=markers.get(device.id);if(!marker)continue;
      const at=projected.get(device.id),group=membership.get(device.id);marker.hidden=group?.id!==device.id;
      marker.disabled=!enabled;marker.tabIndex=enabled&&!marker.hidden?0:-1;marker.style.pointerEvents=enabled?'auto':'none';
      marker.dataset.deviceRoad=device.roadId;marker.dataset.roadState=device.roadStatus;marker.dataset.motion=device.state;marker.dataset.closureRoad=device.closureRoadId??'';marker.dataset.mission=device.missionId??'';marker.dataset.targetDevice=device.targetId??'';
      marker.dataset.worldX=device.point.x.toFixed(3);marker.dataset.worldY=device.point.y.toFixed(3);marker.dataset.signal=String(device.updatedAt);
      marker.dataset.groupLeader=group?.id??'';marker.dataset.members=JSON.stringify(group?.members??[]);
      marker.classList.toggle('is-selected',!!selected&&!!group?.members.includes(selected));
      const label=device.name[vi?0:1]+(group&&group.members.length>1?t(`, ${group.members.length} thiết bị tại đây`,`, ${group.members.length} devices here`):'');
      marker.setAttribute('aria-label',label);
      const name=marker.querySelector<HTMLElement>('.tracked-device-name');if(name)text(name,label);
      if(at){marker.style.transform=`translate(${at.x-11}px,${at.y-11}px)`;marker.dataset.screenX=String(at.x);marker.dataset.screenY=String(at.y);}
    }
    const selectedDevice=snapshot.find(device=>device.id===selected),group=selected?membership.get(selected):undefined;
    nearby.hidden=!group||group.members.length<2;
    if(group){
      for(const device of snapshot){
        let button=peerButtons.get(device.id);
        if(!button){
          button=document.createElement('button');button.type='button';button.className='device-peer';button.dataset.devicePeer=device.id;
          const dot=document.createElement('i');dot.className='tracked-device-symbol is-'+device.role;dot.setAttribute('aria-hidden','true');
          const name=document.createElement('span');name.textContent=device.name[vi?0:1];button.append(dot,name);
          button.onclick=()=>{selected=device.id;update();};nearby.append(button);peerButtons.set(device.id,button);
        }
        button.hidden=!group.members.includes(device.id);button.setAttribute('aria-pressed',String(selected===device.id));
      }
    }
    const at=selected?projected.get(selected):null;
    if(selectedDevice&&group&&at&&enabled)updateCard(selectedDevice,at);
    else card.hidden=true;
  }
  const outside=(event:PointerEvent)=>{if(selected&&!layer.contains(event.target as Node))closeCard();};
  const escape=(event:KeyboardEvent)=>{if(selected&&event.key==='Escape'){event.preventDefault();event.stopPropagation();closeCard(true);}};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);
  const unsubscribe=feed.subscribe(update);update();
  return {update,setZooming:(active:boolean)=>{zooming=false;layer.classList.toggle('is-zooming',active);update();zooming=active;},dispose:()=>{unsubscribe();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);layer.remove();}};
}
