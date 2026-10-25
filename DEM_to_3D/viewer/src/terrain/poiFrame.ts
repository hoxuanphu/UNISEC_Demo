import { drawMapSymbol, type MapSymbolName } from './mapSymbols';

/** Web-map POI: a filled disc in the category colour with a white glyph, centred on its coordinate. */
export const POI_FRAME_PATH='M14 3a11 11 0 1 1 0 22 11 11 0 0 1 0-22Z';
/** The selected place: a larger teardrop in the same colour, its tip on the coordinate. */
export const SELECTED_PIN = { width: 34, height: 46, tipY: 44 } as const;
export const SELECTED_PIN_PATH='M17 44S4 30.4 4 17a13 13 0 1 1 26 0C30 30.4 17 44 17 44Z';
export function poiFrameSvg(selected=false):string {
  return selected
    ? `<svg width="${SELECTED_PIN.width}" height="${SELECTED_PIN.height}" viewBox="0 0 ${SELECTED_PIN.width} ${SELECTED_PIN.height}" aria-hidden="true"><path d="${SELECTED_PIN_PATH}"/></svg>`
    : `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><path d="${POI_FRAME_PATH}"/></svg>`;
}
export function selectedPinSvg():string {return poiFrameSvg(true);}
/** A survey station has its own cross; it is not an inferred hazard. */
export function surveyPointSvg(selected=false):string {
  return `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><path d="${POI_FRAME_PATH}" fill="#fcfcf9" stroke="#746650" stroke-width="${selected?2:1}"/><path d="M14 8v12M8 14h12" fill="none" stroke="#746650" stroke-width="1.4" stroke-linecap="round"/></svg>`;
}
export function drawPoiMarker(ctx:CanvasRenderingContext2D,symbol:MapSymbolName,x:number,y:number,color:string,size=28,unconfirmed=false):void {
  const {half,tip}=poiMetrics(size);
  ctx.save();ctx.translate(x-half,y-tip);ctx.scale(size/28,size/28);
  const frame=new Path2D(POI_FRAME_PATH);
  ctx.shadowColor='rgba(0,0,0,.3)';ctx.shadowBlur=2;ctx.shadowOffsetY=1;
  ctx.globalAlpha=unconfirmed?.82:1;ctx.fillStyle=color;ctx.fill(frame);
  ctx.shadowColor='transparent';ctx.globalAlpha=1;ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;ctx.stroke(frame);
  drawMapSymbol(ctx,symbol,6,6,16,'#ffffff');ctx.restore();
}
export function markerSize(clustered:boolean,selected:boolean):number {return selected?SELECTED_PIN.width:clustered?32:28;}
export function poiMetrics(size:number,selected=false):{half:number;tip:number;height:number} {
  return selected ? {half:SELECTED_PIN.width/2,tip:SELECTED_PIN.tipY,height:SELECTED_PIN.height} : {half:size/2,tip:size/2,height:size};
}
