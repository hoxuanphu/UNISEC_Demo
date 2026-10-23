import type { FlyoverMoment } from '../../features/flyover/flyoverPlan';

export type ScreenPoint = { x: number; y: number; visible: boolean; occluded: boolean };
export type OverlayStop = { id?:string; label: string; status: 'reported' | 'suspected'; distance: number; photo?: {image: ImageBitmap; caption: string;illustrative?:boolean}; screen: ScreenPoint };
export type OverlayFrame = {
  context?:{areas:Array<{id:string}>;closures:ScreenPoint[]};
  width: number; height: number; moment: FlyoverMoment; font: string;
  start: { label: string; screen: ScreenPoint }; end: { label: string; screen: ScreenPoint };
  head: ScreenPoint; stops: OverlayStop[]; attribution: string;
};

/** Adds map annotations only. Never clear the caller's rendered terrain frame. */
export function drawFlyoverOverlay(ctx: CanvasRenderingContext2D, frame: OverlayFrame): void {
  const {width,height,moment,font}=frame, scale=Math.max(.7,Math.min(1.2,height/900));
  ctx.save();
  ctx.font=`600 ${14*scale}px ${font}`;
  ctx.textBaseline='middle'; ctx.lineJoin='round';
  const label=(value: string, point: ScreenPoint) => {
    ctx.lineWidth=4*scale; ctx.strokeStyle='rgba(15,22,18,.8)';ctx.strokeText(value,point.x+13*scale,point.y);
    ctx.fillStyle='#fff';ctx.fillText(value,point.x+13*scale,point.y);
  };
  const overview=moment.phase==='intro' || moment.phase==='final';
  for(const point of frame.context?.closures??[]){
    if(!point.visible||point.occluded)continue;
    ctx.fillStyle='#d9574e';ctx.strokeStyle='#fff';ctx.lineWidth=1.5*scale;
    ctx.beginPath();ctx.arc(point.x,point.y,8*scale,0,2*Math.PI);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(point.x-4*scale,point.y);ctx.lineTo(point.x+4*scale,point.y);ctx.lineWidth=2*scale;ctx.stroke();
  }
  for (const [index,stop] of frame.stops.entries()) {
    if(frame.context?.areas.some(area=>area.id===stop.id)){
      if(moment.stop===index&&stop.screen.visible&&!stop.screen.occluded)label(stop.label,stop.screen);
      continue;
    }
    if (!stop.screen.visible || stop.screen.occluded) continue;
    const active=moment.stop===index;
    ctx.fillStyle=stop.status==='reported'?'#c8453e':'#c79837';
    ctx.strokeStyle='#fff';ctx.lineWidth=2*scale;
    ctx.beginPath();ctx.arc(stop.screen.x,stop.screen.y,(active?7:5)*scale,0,Math.PI*2);ctx.fill();ctx.stroke();
    if (active) label(stop.label,stop.screen);
  }
  if (overview) for (const endpoint of [frame.start,frame.end]) {
    if (endpoint.label && endpoint.screen.visible && !endpoint.screen.occluded) label(endpoint.label,endpoint.screen);
  }
  if (!overview && moment.stop < 0 && frame.head.visible && !frame.head.occluded) {
    ctx.fillStyle=frame.context?.areas.length?'#368df0':'#d87030';ctx.strokeStyle='#fff';ctx.lineWidth=2*scale;
    ctx.beginPath();ctx.arc(frame.head.x,frame.head.y,4*scale,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  // One real survey photograph at its matching stop. Keep its full frame: the
  // edge of the scar is evidence, so don't crop it to fill a decorative card.
  const active=frame.stops[moment.stop], photo=active?.photo;
  if (photo) {
    const fade=Math.min(1,moment.stopProgress/.07,(1-moment.stopProgress)/.07);
    const maxW=Math.min(width*(width<600?.38:.28),310*scale), maxH=Math.min(height*.42,340*scale);
    const fit=Math.min(maxW/photo.image.width,maxH/photo.image.height);
    const w=photo.image.width*fit,h=photo.image.height*fit,pad=7*scale,captionH=(photo.illustrative?45:29)*scale;
    const x=24*scale,y=width<600 ? 18 : height-64*scale-h-captionH-pad*2;
    ctx.save();ctx.globalAlpha=Math.max(0,fade);
    ctx.shadowColor='rgba(0,0,0,.28)';ctx.shadowBlur=18*scale;ctx.shadowOffsetY=5*scale;
    ctx.fillStyle='#f4f2e9';ctx.fillRect(x,y,w+pad*2,h+pad*2+captionH);
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.drawImage(photo.image,x+pad,y+pad,w,h);
    ctx.textAlign='left';ctx.textBaseline='middle';ctx.font=`400 ${Math.max(11,12*scale)}px ${font}`;ctx.fillStyle='#343c34';
    if(photo.illustrative){
      const words=photo.caption.split(' ');let first='';
      while(words.length&&ctx.measureText(first+' '+words[0]).width<w*.95)first+=(first?' ':'')+words.shift();
      ctx.fillText(first,x+pad,y+pad+h+15*scale,w);
      if(words.length)ctx.fillText(words.join(' '),x+pad,y+pad+h+31*scale,w);
    }else ctx.fillText(photo.caption,x+pad,y+pad+h+captionH*.56,w);
    ctx.restore();
  }
  // Source credit stays in the frame, without tables or explanatory paragraphs.
  ctx.textAlign='right';ctx.textBaseline='bottom';ctx.font=`400 ${10*scale}px ${font}`;
  ctx.fillStyle='rgba(255,255,255,.8)';ctx.shadowColor='#162019';ctx.shadowBlur=3*scale;
  ctx.fillText(frame.attribution,width-16*scale,height-12*scale,width-32*scale);
  ctx.restore();
}
