import { useEffect,useRef } from 'react';
import type * as L from 'leaflet';
import type { Locale } from '../../types/dear';
import type { DeviceFeed } from './deviceFeed';
import { roadGeographic } from '../routes/selectedRoadJourney';
import { createTrackingOverlay } from './trackingOverlay';
import './tracked-devices.css';
export function TrackedDevices2D({map,feed,locale,interactive,onRoad}:{map:L.Map|null;feed:DeviceFeed|null;locale:Locale;interactive:boolean;onRoad?:(id:string)=>void}) {
  const live=useRef({interactive,onRoad});live.current={interactive,onRoad};
  const runtime=useRef<ReturnType<typeof createTrackingOverlay>|null>(null);
  useEffect(()=>{
    if(!map||!feed)return;
    const overlay=createTrackingOverlay(map.getContainer().parentElement??map.getContainer(),feed,locale,point=>{
      const geo=roadGeographic(point),at=map.latLngToContainerPoint([geo.latitude,geo.longitude]);return{x:at.x,y:at.y,visible:true};
    },()=>live.current.interactive,id=>live.current.onRoad?.(id));
    runtime.current=overlay;
    map.on('move zoom resize',overlay.update);
    return()=>{map.off('move zoom resize',overlay.update);overlay.dispose();runtime.current=null;};
  },[map,feed,locale]);
  useEffect(()=>{runtime.current?.update();},[interactive]);
  return null;
}
