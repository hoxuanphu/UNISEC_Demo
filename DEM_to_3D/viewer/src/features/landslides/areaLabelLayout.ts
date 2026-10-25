import type { ScreenRect } from '../../terrain/markerLayout';

export const areaLabelObstacleSelector = '#response-details,.map-toolbar,.map-advanced-tools,.layers-panel,.map-tools,.profile-panel,.map-attribution,.map-source-popover,.map-object-chooser,.map-pin,.map-pin-label,.survey-reference-point,.map-location-panel,.analysis-load-status,.tracked-device-card';

/** Visible map symbols and application controls take precedence over extent labels. */
export function areaLabelObstacles(host: HTMLElement): ScreenRect[] {
  const bounds=host.getBoundingClientRect();
  const scope=host.closest('.workspace, .geodata-workspace') ?? host.parentElement ?? host;
  return [...scope.querySelectorAll<HTMLElement>(areaLabelObstacleSelector)]
    .filter(element=>!element.hidden && getComputedStyle(element).visibility!=='hidden' && getComputedStyle(element).display!=='none')
    .map(element=>element.getBoundingClientRect()).filter(rect=>rect.width>0 && rect.height>0)
    .map(rect=>({x:rect.left-bounds.left,y:rect.top-bounds.top,width:rect.width,height:rect.height}));
}
