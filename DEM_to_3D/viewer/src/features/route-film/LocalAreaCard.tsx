import { useEffect, useState } from 'react';
import type { ContextArea } from '../map/contextGeometry';
import type { Locale } from '../../types/dear';
import type { PreparedPhotoPoint } from '../fieldPhotos/preparedPhotos';
import { photoUrl } from '../fieldPhotos/preparedPhotos';
import { illustrativePhotoForArea } from './localFlyover';
import { UiIcon } from '../../shared/ui/UiIcon';
import './route-film.css';

export function LocalAreaCard({area,photos,locale,onClose,linkToJourney=false}:{area:ContextArea;photos:Map<string,PreparedPhotoPoint>;locale:Locale;onClose:()=>void;linkToJourney?:boolean}) {
  const [image,setImage]=useState<string|null>(null);
  const photo=illustrativePhotoForArea(area.id,photos);
  useEffect(()=>{let current=true;setImage(null);if(photo)void photoUrl(photo.image).then(url=>{if(current)setImage(url);}).catch(()=>undefined);return()=>{current=false;};},[photo?.image.sha256]);
  const vi=locale==='vi';
  const url=new URL(location.href);url.searchParams.set('workspace','routes');url.searchParams.set('area',area.id);
  return <aside className="local-area-card" aria-label={vi?'Vùng sạt lở':'Landslide area'}>
    <header><div><small>{vi?'Vùng sạt lở':'Landslide area'}</small><h2>{area.name[vi?0:1].replace(/ \([^)]*\)$/,'')}</h2></div><button className="icon-button" aria-label={vi?'Đóng vùng sạt':'Close landslide area'} onClick={onClose}><UiIcon name="close"/></button></header>
    {image&&<img src={image} alt={vi?'Ảnh khảo sát Chế Tạo':'Chế Tạo survey photo'}/>}
    <p>{vi?'Ảnh khảo sát Chế Tạo, chưa xác nhận hiện trạng tại vùng này.':'Chế Tạo survey photo, not evidence of conditions in this extent.'}</p>
    {linkToJourney&&<a className="button" href={url.href}><UiIcon name="route"/>{vi?'Mở hành trình Chế Tạo':'Open Chế Tạo journey'}</a>}
  </aside>;
}
