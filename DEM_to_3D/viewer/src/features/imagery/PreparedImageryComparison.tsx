import {useEffect,useRef,useState} from 'react';
import L from 'leaflet';
import type {GeometryRecord} from '../../geo/vector/types';
import type {Locale} from '../../types/dear';
import {UiIcon} from '../../shared/ui/UiIcon';
import {acquisitionLabel,rasterUrl,selectedRasters,type AnalysisLayer,type SarMode} from './analysisImagery';
import {landslideAreaOf,landslideAreaStyle} from '../landslides/landslideAreas';
import {removeLeafletMap} from '../map/removeLeafletMap';
import {basemapTileOptions,imagerySource} from '../map/imagerySource';
import {retryTileErrors} from '../map/tileRetry';
import {supportsBasemapTone} from './basemapTone';
import {BasemapToneFilters} from './BasemapToneFilters';
import {comparisonGif} from './comparisonGif';
import {preparedComparisonPair,type ComparisonKind} from './preparedComparison';
import './analysis-imagery.css';
import './prepared-comparison.css';

/** Georeferenced optical and fixed-stretch SAR previews on a single map, with the original KML overlay.
 * Each side retains its own acquisition dates; neither date confirms the KML boundary.
 * Two ways to read change: drag a divider, or blink the same view between dates;
 * the blink exports as a GIF for slides. */
type Mode='swipe'|'blink';
const speeds=[[500,'0,5 giây','0.5 s'],[1000,'1 giây','1 s'],[2000,'2 giây','2 s']] as const;
export function PreparedImageryComparison({layers,records,selected,locale,onClose}:{layers:AnalysisLayer[];records:GeometryRecord[];selected?:GeometryRecord;locale:Locale;onClose:()=>void}){
  const t=(vi:string,en:string)=>locale==='vi'?vi:en;
  const available=(['optical','sar'] as const).filter(kind=>preparedComparisonPair(layers,kind));
  const [requestedKind,setRequestedKind]=useState<ComparisonKind>('optical');
  const kind=available.includes(requestedKind)?requestedKind:available[0];
  const pair=preparedComparisonPair(layers,kind);
  const before=pair?.before,after=pair?.after;
  const [sarMode,setSarMode]=useState<SarMode>('vv');
  const assetKey=JSON.stringify([before,after,sarMode]);
  const host=useRef<HTMLDivElement>(null),mapRef=useRef<L.Map|null>(null);
  const [position,setPosition]=useState(50),[status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[attempt,setAttempt]=useState(0);
  const [mode,setMode]=useState<Mode>('swipe'),[frame,setFrame]=useState<'before'|'after'>('before'),[playing,setPlaying]=useState(true),[delay,setDelay]=useState(1000);
  const [gifState,setGifState]=useState<'idle'|'working'|'error'>('idle');
  const tone=kind==='optical'&&supportsBasemapTone(layers)&&!imagerySource.custom;
  const mask=useRef<{before:HTMLElement;after:HTMLElement}|null>(null),view=useRef({position,mode,frame});view.current={position,mode,frame};
  const applyMask=()=>{
    const map=mapRef.current;if(!map||!mask.current)return;
    const {before:beforePane,after:afterPane}=mask.current;
    if(view.current.mode==='blink'){
      // The same view, one date at a time; the other scene is hidden so dates never mix where coverage differs.
      beforePane.style.clip='';afterPane.style.clip='';
      beforePane.style.visibility=view.current.frame==='before'?'':'hidden';afterPane.style.visibility=view.current.frame==='after'?'':'hidden';
      return;
    }
    beforePane.style.visibility='';afterPane.style.visibility='';
    const origin=map.containerPointToLayerPoint(L.point(0,0)),size=map.getSize(),divider=origin.x+size.x*view.current.position/100;
    beforePane.style.clip=`rect(${origin.y}px,${divider}px,${origin.y+size.y}px,${origin.x}px)`;
    afterPane.style.clip=`rect(${origin.y}px,${origin.x+size.x}px,${origin.y+size.y}px,${divider}px)`;
  };
  useEffect(()=>{
    if(!host.current||!before||!after)return;
    const map=L.map(host.current,{attributionControl:false,zoomControl:false,maxZoom:19});mapRef.current=map;
    L.control.zoom({position:'topright'}).addTo(map);
    // The same satellite basemap as the main map, under both acquisitions, so their extent reads in context.
    // CORS-enabled so the view can be exported as a GIF.
    retryTileErrors(L.tileLayer(imagerySource.url,{maxNativeZoom:imagerySource.maxNativeZoom,maxZoom:19,noWrap:true,crossOrigin:'anonymous',...basemapTileOptions})).addTo(map);
    const pane=map.createPane('comparison-before');pane.style.zIndex='310';
    const afterPane=map.createPane('comparison-after');afterPane.style.zIndex='300';mask.current={before:pane,after:afterPane};
    map.on('move zoom resize',applyMask);
    const vectors=map.createPane('comparison-extents');vectors.style.zIndex='410';
    const all=L.featureGroup();
    for(const record of records.filter(record=>record.visible&&landslideAreaOf(record))){
      const area=landslideAreaOf(record)!;
      L.geoJSON(record.feature,{pane:'comparison-extents',interactive:false,style:{...landslideAreaStyle(area,record.id===selected?.id),fillOpacity:0}}).addTo(all);
    }
    all.addTo(map);
    const fit=selected?L.geoJSON(selected.feature).getBounds():all.getBounds();
    if(before.kind==='sar'&&after.kind==='sar'&&!selected){
      const a=before.modes.vv.web.latLngBounds,b=after.modes.vv.web.latLngBounds;
      const common=L.latLngBounds([[Math.max(a[0][0],b[0][0]),Math.max(a[0][1],b[0][1])],[Math.min(a[1][0],b[1][0]),Math.min(a[1][1],b[1][1])]]);
      map.fitBounds(common,{padding:[24,24],maxZoom:17});
    }else if(fit.isValid())map.fitBounds(fit,{padding:[60,60],maxZoom:17});
    else map.fitBounds(selectedRasters(layers,{layer:after.id,sarMode,opacity:1})[0].web.latLngBounds);
    applyMask();
    const resize=new ResizeObserver(()=>{map.invalidateSize();applyMask();});resize.observe(host.current);
    return ()=>{resize.disconnect();mask.current=null;mapRef.current=null;removeLeafletMap(map);};
  },[records,selected,attempt,kind]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!before||!after)return;
    const run=new AbortController(),images=L.layerGroup().addTo(map);
    setStatus('loading');setGifState('idle');
    const load=async()=>{
      for(const [layer,pane] of [[after,'comparison-after'],[before,'comparison-before']] as const){
        const rasters=selectedRasters(layers,{layer:layer.id,sarMode,opacity:1});
        const urls=await Promise.all(rasters.map(raster=>rasterUrl(raster.web,run.signal)));
        run.signal.throwIfAborted();
        await Promise.all(urls.map((url,index)=>new Promise<void>((resolve,reject)=>{
          const image=L.imageOverlay(url,rasters[index].web.latLngBounds,{pane,interactive:false,
            alt:layer.kind==='sar'?`Sentinel-1 SAR ${sarMode.toUpperCase()}`:t('Ảnh Planet gốc','Original Planet imagery')});
          const cleanup=()=>{image.off('load',loaded);image.off('error',failed);run.signal.removeEventListener('abort',aborted);};
          const loaded=()=>{cleanup();resolve();},failed=()=>{cleanup();reject(new Error('Image decode failed'));},aborted=()=>{cleanup();reject(run.signal.reason);};
          image.on('load',loaded).on('error',failed);run.signal.addEventListener('abort',aborted,{once:true});image.addTo(images);
        })));
      }
      if(!run.signal.aborted)setStatus('ready');
    };
    void load().catch(()=>{if(!run.signal.aborted)setStatus('error');});
    return()=>{run.abort();images.remove();};
  },[assetKey,records,selected,attempt,locale]);
  useEffect(applyMask,[position,mode,frame]);
  useEffect(()=>{
    if(mode!=='blink'||!playing||status!=='ready')return;
    const timer=setInterval(()=>setFrame(value=>value==='before'?'after':'before'),delay);
    return ()=>clearInterval(timer);
  },[mode,playing,delay,status]);
  const sourceCredit=kind==='sar'?'Copernicus Sentinel-1':'© Planet Labs PBC';
  const credit=`${sourceCredit}, ${imagerySource.name}`;
  const exportGif=async()=>{
    if(!host.current||!before||!after)return;
    setGifState('working');
    try{
      const title=(vi:string,en:string)=>kind==='sar'?`SAR ${sarMode.toUpperCase()}, ${t(vi,en)}`:t(vi,en);
      const blob=await comparisonGif({container:host.current,credit,delayMs:delay,toneBasemap:tone,frames:[
        {pane:'comparison-before',title:title('Trước','Before'),date:acquisitionLabel(before)},
        {pane:'comparison-after',title:title('Sau','After'),date:acquisitionLabel(after)}]});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=`${kind==='sar'?'DEAR-SAR-'+sarMode.toUpperCase():'DEAR-Planet'}-before-after.gif`;link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      setGifState('idle');
    }catch{setGifState('error');}
  };
  return <div className="modal-overlay" onClick={onClose}><section className="modal-dialog prepared-comparison" role="dialog" aria-modal="true" aria-labelledby="prepared-comparison-title" onClick={event=>event.stopPropagation()}>
    <header className="modal-head"><h2 id="prepared-comparison-title">{t('Đối chiếu vùng sạt trên ảnh','Compare mapped extents with imagery')}</h2><button className="icon-button" aria-label={t('Đóng','Close')} onClick={onClose}><UiIcon name="close"/></button></header>
    <div className="prepared-comparison-sources">
      <div className="prepared-comparison-modes" role="group" aria-label={t('Loại ảnh','Imagery type')}>
        {available.map(value=><button key={value} type="button" disabled={gifState==='working'} aria-pressed={kind===value} onClick={()=>{setRequestedKind(value);setFrame('before');}}>{value==='sar'?'Sentinel-1 SAR':'PlanetScope'}</button>)}
      </div>
      {kind==='sar'&&<>
        <label>{t('Kênh SAR','SAR channel')}<select aria-label={t('Kênh SAR','SAR channel')} value={sarMode} disabled={gifState==='working'} onChange={event=>setSarMode(event.target.value as SarMode)}><option value="vv">VV</option><option value="vh">VH</option><option value="rgb">{t('Tổ hợp','Composite')}</option></select></label>
        <span className="prepared-comparison-sar-scale">{sarMode==='rgb'?'R: VV, G: VH, B: VV/VH':before?.kind==='sar'?`${before.rangesDb[sarMode][0]} – ${before.rangesDb[sarMode][1]} dB`:''}</span>
      </>}
    </div>
    <div className="prepared-comparison-stage">
      <div className="prepared-comparison-map" ref={host}/>
      {before&&after&&mode==='blink'&&<p className="prepared-comparison-badge" aria-live="polite"><strong>{frame==='before'?t('Trước','Before'):t('Sau','After')}</strong>{acquisitionLabel(frame==='before'?before:after)}</p>}
    </div>
    {/* The basemap takes the Planet scene's measured tone, as on the main map; Planet pixels stay original. */}
    <BasemapToneFilters host={host} active={tone}/>
    <div className="prepared-comparison-controls">
      <div className="prepared-comparison-modes" role="group" aria-label={t('Cách so sánh','Comparison mode')}>
        <button type="button" aria-pressed={mode==='swipe'} onClick={()=>setMode('swipe')}>{t('Kéo so sánh','Swipe')}</button>
        <button type="button" aria-pressed={mode==='blink'} onClick={()=>{setMode('blink');setPlaying(true);}}>{t('Nhấp nháy','Blink')}</button>
      </div>
      {before&&after&&(mode==='swipe'
        ? <label className="prepared-comparison-slider"><span>{t('Trước','Before')}<small>{acquisitionLabel(before)}</small></span><input type="range" min="0" max="100" aria-label={t('Vị trí so ảnh','Image comparison position')} value={position} onChange={event=>setPosition(Number(event.target.value))}/><span>{t('Sau','After')}<small>{acquisitionLabel(after)}</small></span></label>
        : <div className="prepared-comparison-blink">
            <button type="button" className="button" onClick={()=>setPlaying(value=>!value)}>{playing?t('Dừng','Pause'):t('Chạy','Play')}</button>
            <div className="prepared-comparison-frames" role="group" aria-label={t('Ảnh đang xem','Shown image')}>
              <button type="button" aria-pressed={frame==='before'} onClick={()=>{setPlaying(false);setFrame('before');}}>{t('Trước','Before')}</button>
              <button type="button" aria-pressed={frame==='after'} onClick={()=>{setPlaying(false);setFrame('after');}}>{t('Sau','After')}</button>
            </div>
            <label className="prepared-comparison-speed">{t('Mỗi ảnh','Each image')}<select value={delay} onChange={event=>setDelay(Number(event.target.value))}>{speeds.map(([ms,vi,en])=><option key={ms} value={ms}>{t(vi,en)}</option>)}</select></label>
          </div>)}
      <button type="button" className="button prepared-comparison-gif" disabled={status!=='ready'||gifState==='working'} onClick={()=>void exportGif()}>
        <UiIcon name="download" size={16}/>{gifState==='working'?t('Đang tạo GIF','Creating GIF'):t('Tải GIF','Download GIF')}
      </button>
    </div>
    <footer><p>{kind==='sar'?t('Cùng thang dB. Chưa xác minh cùng quỹ đạo; khác biệt độ sáng không tự xác nhận sạt lở.','Shared dB scale. Matching orbit not verified; brightness differences do not confirm landslides.'):t('Màu ảnh gốc. Ranh KML chưa xác nhận cùng ngày ảnh.','Original image colours. KML extents have not been verified against these acquisition dates.')}</p><small>{sourceCredit}. {t('Ảnh nền','Basemap')}: {imagerySource.name}</small>
      {gifState==='error'&&<span role="alert">{t('Chưa tạo được GIF. Đợi ảnh nền tải xong rồi thử lại.','Could not create the GIF. Wait for the basemap to load and retry.')}</span>}
      {status==='loading'&&<span role="status">{t('Đang tải ảnh','Loading imagery')}</span>}
      {status==='error'&&<span role="status">{t('Chưa tải được cặp ảnh.','Could not load the image pair.')} <button className="text-button" onClick={()=>setAttempt(value=>value+1)}>{t('Thử lại','Retry')}</button></span>}
    </footer>
  </section></div>;
}
