import { useSyncExternalStore } from 'react';
import type { Locale } from '../../types/dear';
import type { RouteSimulation } from '../routes/routeSimulation';
import { RouteSimulationControl } from '../routes/RouteSimulationControl';
import { UiIcon } from '../../shared/ui/UiIcon';
/** Keep route advice compact; expose playback separately at the top of the map. */
export function CitizenMovementControl({simulation,locale}:{simulation:RouteSimulation;locale:Locale}) {
  const state=useSyncExternalStore(simulation.subscribe,simulation.getSnapshot);
  const vi=locale==='vi',playing=state.status==='playing';
  return <details className="citizen-movement-control">
    <summary><UiIcon name="profile" size={18}/><span>{simulation.name}</span>
      <button type="button" className="icon-button" aria-label={playing?vi?'Tạm dừng di chuyển':'Pause movement':vi?'Xem di chuyển':'Show movement'}
        onClick={e=>{e.preventDefault();if(playing)simulation.pause();else simulation.play();}}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">{playing?<path d="M4 3h3v10H4Zm5 0h3v10H9Z"/>:<path d="m5 2 8 6-8 6Z"/>}</svg>
      </button>
    </summary>
    <RouteSimulationControl simulation={simulation} locale={locale}/>
  </details>;
}
