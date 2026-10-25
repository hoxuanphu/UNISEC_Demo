import { useModalFocus } from '../../shared/hooks/useModalFocus';
import { useMemo,useState,useRef } from 'react';
import type { LocalNetwork } from '../route-film/localNetwork';
import type { RescueBase } from './rescueBase';
import type { DispatchTarget } from './dispatchOrders';
import type { Locale } from '../../types/dear';
import { plannedGuidance,guidanceRoute } from './residentGuidance';
import { UiIcon } from '../../shared/ui/UiIcon';
export function GuidanceDialog({network,bases,target,locale,onIssue,onClose,proposal,activeTeam,onOpenTeam}:{network:LocalNetwork;bases:readonly RescueBase[];target:DispatchTarget;locale:Locale;activeTeam?:string|null;onOpenTeam?:()=>void;proposal?:{destination:RescueBase;roadIds:string[]}|null;onIssue:(destination:RescueBase|null,roadIds?:string[])=>boolean;onClose:()=>void}){
  const root=useRef<HTMLDivElement>(null);
  useModalFocus(root,'guidance',onClose);
  const [destination,setDestination]=useState(proposal?'proposal':'hold'),[error,setError]=useState(false);
  const chosen=destination==='proposal'?proposal?.destination??null:bases.find(base=>base.id===destination)??null;
  const approvedRoadIds=destination==='proposal'?proposal?.roadIds:undefined;
  const plan=useMemo(()=>plannedGuidance(approvedRoadIds?network.roads.filter(road=>approvedRoadIds.includes(road.id)):network.roads,target,chosen,'Coordination'),[network,target,chosen,approvedRoadIds]);
  const route=useMemo(()=>plan?guidanceRoute(network,plan):null,[network,plan]);
  const t=(vi:string,en:string)=>locale==='vi'?vi:en;
  return <div ref={root} className="modal-overlay" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="guidance-title" className="modal-dialog guidance-dialog" onClick={event=>event.stopPropagation()}>
    <header className="modal-head"><div><h2 id="guidance-title">{t('Hướng dẫn di chuyển','Travel guidance')}</h2><p>{target.name[locale==='vi'?0:1]}</p></div><button className="icon-button" aria-label={t('Đóng','Close')} onClick={onClose}><UiIcon name="close"/></button></header>
    <div className="modal-body"><label className="geodata-field">{t('Phương án','Instruction')}<select value={destination} onChange={event=>{setDestination(event.target.value);setError(false);}}><option value="hold">{t('Chờ hỗ trợ tại vị trí an toàn','Wait at a safe location')}</option>{proposal&&<option value="proposal">{t(`Đề xuất: ${proposal.destination.name[0]}`,`Proposal: ${proposal.destination.name[1]}`)}</option>}{bases.map(base=><option key={base.id} value={base.id}>{base.name[locale==='vi'?0:1]}</option>)}</select></label>
      {chosen&&activeTeam&&<p role="status">{t(`${activeTeam} đang được giao cho vị trí này.`,`${activeTeam} is assigned to this location.`)} <button className="text-button" onClick={onOpenTeam}>{t('Mở đội được giao','Open assigned team')}</button></p>}
      {chosen&&<p role="status">{route?t(`${route.lengthKm.toFixed(1)} km đi bộ`,`${route.lengthKm.toFixed(1)} km on foot`):t('Chưa có tuyến nối được từ vị trí người dân.','No connected route from the resident’s position.')}</p>}
      {error&&<p className="field-error" role="alert">{t('Chưa gửi được hướng dẫn.','Guidance could not be sent.')}</p>}
    </div><footer className="modal-foot"><button className="button" onClick={onClose}>{t('Hủy','Cancel')}</button><button className="button primary" disabled={!!chosen&&(!route||!!activeTeam)} onClick={()=>{if(onIssue(chosen,approvedRoadIds))onClose();else setError(true);}}>{destination==='proposal'?t('Duyệt và giao tuyến','Approve route'):t('Gửi hướng dẫn','Send guidance')}</button></footer>
  </section></div>;
}
