import type { RoadSegment } from '../../types/dear';
import { roadColors } from '../../terrain/roadStyle';
import { roadCondition } from '../routes/roadConditions';
import { defaultLayerAppearance } from './layerAppearance';

/** Pixel widths shared by map and terrain. Local roads stay subordinate to the
 * operational network; a close view reveals detail without adding road labels. */
export function contextRoadStyle(road: RoadSegment, zoom: number, imagery: boolean, status: boolean, selected = false,
  networkOpacity = defaultLayerAppearance.networkOpacity) {
  const condition = roadCondition(road);
  const warning = status && condition !== 'open';
  const detail = Math.max(0, Math.min(1, (zoom - 12) / 3));
  return {
    color: warning ? condition === 'blocked' ? roadColors.blocked : roadColors.uncertain : imagery ? roadColors.reference : roadColors.networkTerrain,
    casing: selected && !(warning && condition === 'blocked') ? roadColors.inspectedCasing : roadColors.referenceCasing,
    weight: selected ? 3 : warning ? 2.4 : .9 + detail * .9,
    opacity: selected || warning ? 1 : Math.min(1, (.5 + detail * .25) * networkOpacity / defaultLayerAppearance.networkOpacity),
    dashed: warning && condition !== 'blocked',
    // Keep the complete graph visible. At overview scale it is a fine context line.
    casingWidth: selected ? 5 : warning ? 3.6 : 1.9 + detail,
  };
}
