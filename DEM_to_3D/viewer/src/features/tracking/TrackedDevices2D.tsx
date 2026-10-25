import { useEffect,useRef } from 'react';
import type * as L from 'leaflet';
import type { Locale } from '../../types/dear';
import type { LocationFeed } from './deviceFeed';
import { roadGeographic } from '../routes/selectedRoadJourney';
import { createTrackingOverlay } from './trackingOverlay';
import { POINT_ZOOM } from '../map/selectionScale';
import './tracked-devices.css';
export function TrackedDevices2D({map,feed,locale,interactive,onRoad,onDevice,selectedId,selfId,heading=null}:{map:L.Map|null;feed:LocationFeed|null;locale:Locale;interactive:boolean;onRoad?:(id:string)=>void;onDevice?:(id:string)=>void;selectedId?:string|null;
  /** The phone's own device, and the way it faces when the phone reports it. */
  selfId?:string|null;heading?:number|null}) {
  const live=useRef({interactive,onRoad,onDevice,selectedId});live.current={interactive,onRoad,onDevice,selectedId};
  const runtime=useRef<ReturnType<typeof createTrackingOverlay>|null>(null);
  useEffect(()=>{
    if(!map||!feed)return;
    let zoomView:L.ZoomAnimEvent|null=null;
    const overlay=createTrackingOverlay(map.getContainer().parentElement??map.getContainer(),feed,locale,point=>{
      const geo=roadGeographic(point);
      if(zoomView){const at=map.project([geo.latitude,geo.longitude],zoomView.zoom).subtract(map.project(zoomView.center,zoomView.zoom)),size=map.getSize();return{x:at.x+size.x/2,y:at.y+size.y/2,visible:true};}
      const at=map.latLngToContainerPoint([geo.latitude,geo.longitude]);return{x:at.x,y:at.y,visible:true};
    },()=>live.current.interactive,id=>live.current.onRoad?.(id),point=>{
      const geo=roadGeographic(point);
      map.setView([geo.latitude,geo.longitude],Math.max(map.getZoom(),POINT_ZOOM),{animate:!matchMedia('(prefers-reduced-motion: reduce)').matches});
    },onDevice?id=>live.current.onDevice?.(id):undefined,()=>live.current.selectedId??null,selfId);
    runtime.current=overlay;
    const animate=(event:L.ZoomAnimEvent)=>{zoomView=event;overlay.setZooming(true);overlay.update();};
    const finish=()=>{zoomView=null;overlay.setZooming(false);overlay.update();};
    map.on('zoomanim',animate);map.on('zoomend',finish);map.on('move zoom resize viewreset',overlay.update);
    return()=>{map.off('zoomanim',animate);map.off('zoomend',finish);map.off('move zoom resize viewreset',overlay.update);overlay.dispose();runtime.current=null;};
  },[map,feed,locale,selfId]);
  useEffect(()=>{runtime.current?.update();},[interactive,selectedId]);
  useEffect(()=>{runtime.current?.setHeading(heading);},[heading,feed,selfId,locale,map]);
  return null;
}
