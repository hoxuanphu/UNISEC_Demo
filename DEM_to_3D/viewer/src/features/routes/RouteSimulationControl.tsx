import { useSyncExternalStore } from 'react';
import type { Locale } from '../../types/dear';
import type { RouteSimulation } from './routeSimulation';
import { UiIcon } from '../../shared/ui/UiIcon';
import './route-simulation.css';
export function RouteSimulationControl({simulation,locale,onPlay}:{simulation:RouteSimulation;locale:Locale;onPlay?:()=>void}) {
  const state=useSyncExternalStore(simulation.subscribe,simulation.getSnapshot);
  const t=(vi:string,en:string)=>locale==='vi'?vi:en;
  const playing=state.status==='playing';
  const distance=(metres:number)=>metres<1000 ? `${Math.round(metres)} m` : `${(metres/1000).toLocaleString(locale==='vi'?'vi-VN':'en-GB',{maximumFractionDigits:2})} km`;
  return <section className="route-simulation-control" aria-live="off" aria-label={t('Di chuyển trên tuyến','Movement along route')}>
    <div className="route-simulation-heading"><strong>{simulation.name}</strong><span>{playing?t('Đang di chuyển','Moving'):state.status==='finished'?t('Cuối tuyến','End of route'):state.status==='paused'?t('Đã dừng','Paused'):t('Vị trí trên tuyến','Route position')}</span></div>
    <div className="route-simulation-actions">
      <button type="button" className="button" onClick={()=>{if(playing)simulation.pause();else{if(state.status==='idle'||state.status==='finished')onPlay?.();simulation.play();}}}
        aria-label={playing?t('Tạm dừng di chuyển','Pause movement'):t('Xem di chuyển','Show movement')}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">{playing?<path d="M4 3h3v10H4Zm5 0h3v10H9Z"/>:<path d="m5 2 8 6-8 6Z"/>}</svg>{playing?t('Tạm dừng','Pause'):state.status==='finished'?t('Phát lại','Replay'):t('Xem di chuyển','Show movement')}
      </button>
      <button type="button" className="icon-button" aria-label={t('Về đầu tuyến','Return to route start')} title={t('Về đầu tuyến','Return to route start')} disabled={state.status==='idle' && state.progress===0} onClick={simulation.reset}><UiIcon name="undo" size={18}/></button>
      <select aria-label={t('Tốc độ phát di chuyển','Movement playback speed')} value={state.rate} onChange={e=>simulation.setRate(Number(e.target.value))}>
        {[.5,1,2].map(rate=><option key={rate} value={rate}>{rate}×</option>)}
      </select>
    </div>
    <label className="route-simulation-progress"><span>{state.status==='finished'?t('Đã tới cuối tuyến','End of mapped route'):t('Đã đi trên tuyến','Along the route')} <output>{distance(state.distance)} / {distance(state.total)}</output></span>
      <input type="range" aria-label={t('Vị trí trên tuyến','Route position')} min="0" max="1000" step="1" value={Math.round(state.progress*1000)} onChange={e=>simulation.seek(Number(e.target.value)/1000)}/>
    </label>
  </section>;
}
