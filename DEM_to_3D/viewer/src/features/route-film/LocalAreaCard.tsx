import { useEffect, useRef, useState } from 'react';
import type { ContextArea } from '../map/contextGeometry';
import type { Locale } from '../../types/dear';
import type { PreparedPhotoPoint } from '../fieldPhotos/preparedPhotos';
import { photoUrl } from '../fieldPhotos/preparedPhotos';
import { illustrativePhotoForArea } from './localFlyover';
import { UiIcon } from '../../shared/ui/UiIcon';
import { useNativeDialog } from '../../shared/hooks/useNativeDialog';
import './route-film.css';
function IllustrativePhoto({image,title,caption,locale,onClose}:{image:string;title:string;caption:string;locale:Locale;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);useNativeDialog(ref);
  return <dialog ref={ref} className="local-area-photo-dialog" aria-label={title}
    onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <header><h2>{title}</h2><button type="button" className="icon-button" aria-label={locale==='vi'?'Đóng ảnh':'Close photo'} onClick={onClose}><UiIcon name="close"/></button></header>
    <img src={image} alt={locale==='vi'?'Ảnh khảo sát minh họa Chế Tạo':'Illustrative Chế Tạo survey photo'}/><p>{caption}</p>
  </dialog>;
}
export function LocalAreaCard({area,photos,locale,onClose,linkToJourney=false}:{area:ContextArea;photos:Map<string,PreparedPhotoPoint>;locale:Locale;onClose:()=>void;linkToJourney?:boolean}) {
  const [loaded,setLoaded]=useState<{key:string;url:string}|null>(null);
  const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0),[zoomed,setZoomed]=useState(false);
  const photo=illustrativePhotoForArea(area.id,photos);
  useEffect(()=>{let current=true;setFailed(false);setZoomed(false);
    if(photo)void photoUrl(photo.image).then(url=>{if(current)setLoaded({key:photo.image.sha256,url});},()=>{if(current)setFailed(true);});
    return()=>{current=false;};
  },[photo?.image.sha256,attempt]);
  const image=loaded?.key===photo?.image.sha256?loaded?.url:undefined;
  const vi=locale==='vi',title=area.name[vi?0:1].replace(/ \([^)]*\)$/,'');
  const caption=vi?'Ảnh tham chiếu · Chế Tạo':'Reference photo · Chế Tạo';
  const url=new URL(location.href);url.searchParams.set('workspace','routes');url.searchParams.set('area',area.id);
  return <aside className="local-area-card" aria-label={vi?'Vùng sạt lở':'Landslide area'}>
    <header><div><small>{vi?'Vùng sạt lở':'Landslide extent'}</small><h2>{title}</h2></div><button type="button" className="icon-button" aria-label={vi?'Đóng vùng sạt':'Close landslide area'} onClick={onClose}><UiIcon name="close"/></button></header>
    <div className="local-area-body">
      {photo && <figure><button type="button" className="local-area-photo" disabled={!image} aria-label={vi?'Xem ảnh minh họa':'View illustrative photo'} onClick={()=>setZoomed(true)}>
        {image?<><img src={image} alt={vi?'Ảnh khảo sát Chế Tạo':'Chế Tạo survey photo'}/><span><UiIcon name="expand" size={18}/></span></>:<span className="local-area-photo-loading">{failed?vi?'Chưa tải được ảnh':'Photo unavailable':vi?'Đang tải ảnh':'Loading photo'}</span>}
      </button><figcaption>{caption}</figcaption></figure>}
      {failed&&<button type="button" className="text-button" onClick={()=>setAttempt(value=>value+1)}>{vi?'Tải lại ảnh':'Retry photo'}</button>}
      {linkToJourney&&<a className="button" href={url.href}><UiIcon name="route" size={18}/>{vi?'Mở hành trình Chế Tạo':'Open Chế Tạo journey'}</a>}
    </div>
    {zoomed&&image&&<IllustrativePhoto image={image} title={title} caption={caption} locale={locale} onClose={()=>setZoomed(false)}/>}
  </aside>;
}
