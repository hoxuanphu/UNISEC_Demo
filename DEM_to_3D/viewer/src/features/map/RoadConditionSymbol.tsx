import { roadConditionSvg, type RoadCondition } from './roadConditionSvg';

export function RoadConditionSymbol({condition}: {condition: RoadCondition}) {
  return <span className="road-condition-icon" aria-hidden="true" dangerouslySetInnerHTML={{__html: roadConditionSvg(condition)}}/>;
}
