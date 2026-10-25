import type { Locale } from '../../types/dear';
import type { LocationFeed,DevicePosition } from './deviceFeed';
import { groupDeviceDots } from './deviceDotGroups';
type Pixel={x:number;y:number;visible:boolean};
/** What a device is doing, in words; shared by the map card and the household card. */
export function deviceStatusText(device:Pick<DevicePosition,'state'|'role'|'missionId'>,locale:Locale):string {
  const t=(a:string,b:string)=>locale==='vi'?a:b;
  return device.state==='waiting'?device.role==='rescue'?t('Chờ phương án tiếp cận','Awaiting access'):t('Đang chờ cứu hộ','Waiting for rescue')
    :device.state==='dispatching'?t('Chờ điều động','Awaiting dispatch')
    :device.state==='responding'?t('Đang tới hỗ trợ','Responding')
    :device.state==='crossing'?t('Đang đi bộ vượt vùng sạt','Crossing the slide on foot')
    :device.state==='on-site'?t('Đang hỗ trợ tại lán','Assisting at the huts')
    :device.state==='evacuated'?t('Đã đưa người dân ra tới xe','People brought out to the vehicle')
    :device.state==='assisting'?t('Đang hỗ trợ tại điểm chặn','Providing assistance at closure')
    :device.state==='escorting'?device.role==='rescue'?t('Đang đưa người dân về','Escorting residents back'):t('Đang đi cùng đội cứu hộ','Returning with rescue team')
    :device.state==='arrived'?device.missionId?t('Đã về điểm tập kết','At the assembly point'):t('Đã tới cuối đoạn đường','At the end of the road segment')
    :device.state==='approaching'?t('Đang tiếp cận đoạn chặn','Approaching a closure'):device.state==='stopped'?t('Đã dừng','Stopped'):t('Đang di chuyển','Moving');
}
/** Both map adapters share symbols, selection, keyboard handling and the same location snapshots. */
export function createTrackingOverlay(host:HTMLElement,feed:LocationFeed,locale:Locale,
  project:(point:{x:number;y:number})=>Pixel|null,interactive:()=>boolean,onRoad?:(id:string)=>void,
  /** Brings a chosen device to the middle of the map, as every other map object. */
  onFocus?:(point:{x:number;y:number})=>void,onDevice?:(id:string)=>void,selectedId:()=>string|null=()=>null,
  /** The phone's own position: drawn as "You", above and apart from every other dot. */
  selfId?:string|null) {
  const vi=locale==='vi',t=(a:string,b:string)=>vi?a:b;
  const layer=document.createElement('div');layer.className='tracked-devices';layer.setAttribute('aria-label',t('Vị trí người dân và cứu hộ','Resident and rescue locations'));host.append(layer);
  const markers=new Map<string,HTMLButtonElement>();
  for(const device of feed.getSnapshot()){
    const button=document.createElement('button');button.type='button';button.className='tracked-device is-'+device.role;
    button.dataset.deviceId=device.id;button.dataset.deviceRole=device.role;
    button.setAttribute('aria-label',device.name[vi?0:1]);
    const dot=document.createElement('span');dot.className='tracked-device-dot location-signal-dot';dot.setAttribute('aria-hidden','true');button.append(dot);
    const self=device.id===selfId;
    if(self){button.classList.add('is-self');const heading=document.createElement('span');heading.className='tracked-device-heading';heading.setAttribute('aria-hidden','true');button.prepend(heading);}
    const name=document.createElement('span');name.className='tracked-device-name';name.textContent=self?t('Bạn','You'):device.name[vi?0:1];button.append(name);
    button.addEventListener('click',event=>{event.stopPropagation();selected=device.id;const members=JSON.parse(button.dataset.members??'[]') as string[];if(onDevice&&members.length<2){selected=null;onDevice(device.id);}update();const now=feed.getSnapshot().find(d=>d.id===device.id);if(now&&!onDevice)onFocus?.(now.point);});
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
  if(onDevice){id.hidden=true;state.hidden=true;road.hidden=true;signal.hidden=true;}
  if(onRoad&&!onDevice){const inspect=document.createElement('button');inspect.type='button';inspect.className='text-button';inspect.textContent=t('Xem đoạn đường','Inspect road section');inspect.onclick=()=>{const device=feed.getSnapshot().find(d=>d.id===selected);if(device){closeCard();onRoad(device.roadId);}};card.append(inspect);}
  layer.append(card);
  const text=(node:HTMLElement,value:string)=>{if(node.textContent!==value)node.textContent=value;};
  const clock=new Intl.DateTimeFormat(vi?'vi-VN':'en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Ho_Chi_Minh'});
  function updateCard(device:DevicePosition,at:Pixel) {
    if(card.hidden)card.hidden=false;text(title,onDevice?t('Thiết bị tại đây','Devices here'):device.name[vi?0:1]);text(id,[device.householdName?.[vi?0:1],device.id].filter(Boolean).join(', '));
    const target=device.targetName?.[vi?0:1];
    const status=deviceStatusText(device,locale);
    text(state,status+(target&&device.role==='rescue'?`, ${target}`:''));
    const warningClass=device.state==='waiting'||device.state==='approaching'?'device-warning':'';
    if(state.className!==warningClass)state.className=warningClass;
    text(road,device.roadName[vi?0:1]);text(signal,t('Tín hiệu lúc ','Signal at ')+clock.format(device.updatedAt));
    const width=card.offsetWidth,height=card.offsetHeight;
    const positions=[{x:at.x+24,y:at.y+12},{x:at.x-width-24,y:at.y+12},{x:at.x-width/2,y:at.y-height-24},{x:12,y:12}];
    const parent=host.getBoundingClientRect();
    const obstacles=Array.from(host.closest('.map-area')?.querySelectorAll<HTMLElement>('.road-journey-panel,.household-card,.local-road-card,.local-area-card,#response-details,.citizen-map-summary,.layers-panel,.map-bottom-bar,.map-toolbar,.map-tools,.map-advanced-tools,.profile-panel')??[]).filter(node=>node.getClientRects().length).map(node=>node.getBoundingClientRect());
    const choice=positions.find(p=>p.x>=8&&p.y>=8&&p.x+width<=host.clientWidth-8&&p.y+height<=host.clientHeight-8&&!obstacles.some(box=>p.x+parent.left<box.right&&p.x+parent.left+width>box.left&&p.y+parent.top<box.bottom&&p.y+parent.top+height>box.top))??{x:12,y:Math.max(8,host.clientHeight-height-12)};
    const left=`${Math.round(choice.x)}px`,top=`${Math.round(choice.y)}px`;
    if(card.style.left!==left)card.style.left=left;if(card.style.top!==top)card.style.top=top;
  }
  let zooming=false;
  function update() {
    if(zooming)return;
    const enabled=interactive();layer.style.pointerEvents=enabled?'':'none';
    const snapshot=feed.getSnapshot(),projected=new Map(snapshot.map(device=>[device.id,project(device.point)]));
    const onScreen=snapshot.flatMap(device=>{const at=projected.get(device.id);return at?.visible&&at.x>=0&&at.y>=0&&at.x<=host.clientWidth&&at.y<=host.clientHeight?[{id:device.id,x:at.x,y:at.y}]:[];});
    // Your own dot is never folded into a group with others.
    const groups=[...groupDeviceDots(onScreen.filter(anchor=>anchor.id!==selfId)),...onScreen.filter(anchor=>anchor.id===selfId).map(anchor=>({...anchor,members:[anchor.id]}))];
    const membership=new Map(groups.flatMap(group=>group.members.map(id=>[id,group] as const)));
    for(const device of snapshot){
      const marker=markers.get(device.id);if(!marker)continue;
      const at=projected.get(device.id),group=membership.get(device.id);marker.hidden=group?.id!==device.id;
      marker.disabled=!enabled;marker.tabIndex=enabled&&!marker.hidden?0:-1;marker.style.pointerEvents=enabled?'auto':'none';
      marker.dataset.deviceRoad=device.roadId;marker.dataset.roadState=device.roadStatus;marker.dataset.motion=device.state;marker.dataset.closureRoad=device.closureRoadId??'';marker.dataset.mission=device.missionId??'';marker.dataset.targetDevice=device.targetId??'';
      marker.dataset.worldX=device.point.x.toFixed(3);marker.dataset.worldY=device.point.y.toFixed(3);marker.dataset.signal=String(device.updatedAt);
      marker.dataset.groupLeader=group?.id??'';marker.dataset.members=JSON.stringify(group?.members??[]);
      const active=selectedId()??selected;marker.classList.toggle('is-selected',!!active&&!!group?.members.includes(active));
      const label=device.id===selfId?t('Vị trí của bạn','Your location'):device.name[vi?0:1]+(group&&group.members.length>1?t(`, ${group.members.length} thiết bị tại đây`,`, ${group.members.length} devices here`):'');
      marker.setAttribute('aria-label',label);
      const name=marker.querySelector<HTMLElement>('.tracked-device-name');if(name&&device.id!==selfId)text(name,label);
      if(at){marker.style.transform=`translate(${at.x-11}px,${at.y-11}px)`;marker.dataset.screenX=String(at.x);marker.dataset.screenY=String(at.y);}
    }
    const selectedDevice=snapshot.find(device=>device.id===selected),group=selected?membership.get(selected):undefined;
    const hideNearby=!group||group.members.length<2;
    if(nearby.hidden!==hideNearby)nearby.hidden=hideNearby;
    if(group){
      for(const device of snapshot){
        let button=peerButtons.get(device.id);
        if(!button){
          button=document.createElement('button');button.type='button';button.className='device-peer';button.dataset.devicePeer=device.id;
          const dot=document.createElement('i');dot.className='tracked-device-symbol is-'+device.role;dot.setAttribute('aria-hidden','true');
          const name=document.createElement('span');name.textContent=device.name[vi?0:1];button.append(dot,name);
          button.onclick=()=>{if(onDevice){closeCard();onDevice(device.id);}else selected=device.id;update();};nearby.append(button);peerButtons.set(device.id,button);
        }
        const hidden=!group.members.includes(device.id);
        if(button.hidden!==hidden)button.hidden=hidden;
        const pressed=String(selected===device.id);if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
      }
    }
    const at=selected?projected.get(selected):null;
    if(selectedDevice&&group&&at&&enabled)updateCard(selectedDevice,at);
    else if(!card.hidden)card.hidden=true;
  }
  const outside=(event:PointerEvent)=>{if(selected&&!layer.contains(event.target as Node))closeCard();};
  const escape=(event:KeyboardEvent)=>{if(selected&&event.key==='Escape'){event.preventDefault();event.stopPropagation();closeCard(true);}};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);
  const unsubscribe=feed.subscribe(update);update();
  /** The way the phone faces, in degrees from north, shown as a cone on your own dot. */
  const setHeading=(degrees:number|null)=>{
    const marker=selfId?markers.get(selfId):undefined;if(!marker)return;
    marker.classList.toggle('has-heading',degrees!==null);
    if(degrees!==null)marker.style.setProperty('--heading',`${degrees}deg`);
  };
  return {update,setHeading,setZooming:(active:boolean)=>{zooming=false;layer.classList.toggle('is-zooming',active);update();zooming=active;},dispose:()=>{unsubscribe();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);layer.remove();}};
}
