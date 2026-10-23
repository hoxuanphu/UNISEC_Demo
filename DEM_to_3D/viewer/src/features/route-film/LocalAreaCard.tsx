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
  return <aside className="local-area-card" aria-label={vi?'Vùng sạt mô phỏng':'Demo landslide area'}>
    <header><div><small>{vi?'Vùng sạt, dữ liệu mô phỏng':'Landslide area, demo data'}</small><h2>{area.name[vi?0:1].replace(/ \([^)]*\)$/,'')}</h2></div><button className="icon-button" aria-label={vi?'Đóng vùng sạt':'Close landslide area'} onClick={onClose}><UiIcon name="close"/></button></header>
    {image&&<img src={image} alt={vi?'Ảnh minh họa từ bộ khảo sát Chế Tạo':'Illustrative photograph from the Chế Tạo survey'}/>}
    <p>{vi?'Ảnh minh họa, không xác nhận hiện trạng tại vị trí này.':'Illustrative photo, not evidence of conditions at this location.'}</p>
    {linkToJourney&&<a className="button" href={url.href}><UiIcon name="route"/>{vi?'Mở hành trình Chế Tạo':'Open Chế Tạo journey'}</a>}
  </aside>;
}
