import type { Locale, RoadSegment } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { roadConditionLabel, roadConditionMessage } from '../routes/localRoadLabels';
import { roadCondition } from '../routes/roadConditions';
import { projectedPathLength } from '../../terrain/pathGeometry';
import './local-road-card.css';

export function LocalRoadCard({road,locale,onClose,onDirections}: {
  road: RoadSegment; locale: Locale; onClose:()=>void; onDirections:()=>void;
}) {
  const vi=locale==='vi', condition=roadCondition(road);
  return <aside className="local-road-card" aria-label={vi?'Đường trong xã Chế Tạo':'Chế Tạo local road'}>
    <header><div><small>{vi?'Đường trong xã Chế Tạo':'Chế Tạo local road'}</small><h2>{road.name[vi?0:1]}</h2></div>
      <button className="icon-button" onClick={onClose} aria-label={vi?'Đóng đoạn đường':'Close road section'}><UiIcon name="close"/></button></header>
    <div className="local-road-body"><dl><div><dt>{vi?'Chiều dài đoạn':'Section length'}</dt><dd>{(projectedPathLength(road.points)/1000).toLocaleString(vi?'vi-VN':'en-GB',{maximumFractionDigits:2})} km</dd></div>
      <div><dt>{vi?'Tình trạng':'Condition'}</dt><dd data-condition={condition}>{roadConditionLabel(condition,locale,true)}</dd></div></dl>
    {condition==='blocked'||condition==='risk'?<p data-condition={condition}>{roadConditionMessage(road,locale,true)}</p>:null}
    <button className="button" onClick={onDirections}><UiIcon name="route" size={18}/>{vi?'Tìm đường trong xã':'Find a local route'}</button>
    </div>
  </aside>;
}
