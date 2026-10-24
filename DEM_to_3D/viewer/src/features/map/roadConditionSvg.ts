import { roadColors } from '../../terrain/roadStyle';
export type RoadCondition = 'blocked' | 'risk';

/** Renderer-neutral artwork shared by DOM, Leaflet and the React legend. */
export function roadConditionSvg(condition: RoadCondition): string {
  const shape = condition === 'blocked'
    ? `<circle cx="12" cy="12" r="11" fill="${roadColors.blockedSymbol}" stroke="white" stroke-width="2"/><rect x="6" y="10.5" width="12" height="3" rx=".6" fill="white"/>`
    : `<path d="M12 2 23 21H1Z" fill="${roadColors.riskSymbol}" stroke="white" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 8v6" stroke="white" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.5" r="1.2" fill="white"/>`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${shape}</svg>`;
}
