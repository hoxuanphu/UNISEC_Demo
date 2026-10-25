export type SurfaceRect={left:number;top:number;width:number;height:number};
const right=(r:SurfaceRect)=>r.left+r.width,bottom=(r:SurfaceRect)=>r.top+r.height;
export const surfacesOverlap=(a:SurfaceRect,b:SurfaceRect,gap=8)=>a.left<right(b)+gap&&b.left<right(a)+gap&&a.top<bottom(b)+gap&&b.top<bottom(a)+gap;
/** Fold in place when space is occupied. Never hunt for another horizontal slot. */
export function placeSecondarySurface(requested:SurfaceRect,bounds:SurfaceRect,obstacles:readonly SurfaceRect[],compactWidth=248,compactHeight=38,anchor:'bottom-right'|'bottom-left'|'top-left'='bottom-right'){
 const fits=(r:SurfaceRect)=>r.left>=bounds.left&&r.top>=bounds.top&&right(r)<=right(bounds)+1&&bottom(r)<=bottom(bounds)+1;
 const free=(r:SurfaceRect)=>fits(r)&&!obstacles.some(other=>surfacesOverlap(r,other));
 if(free(requested))return {compact:false,rect:requested};
 const width=Math.min(compactWidth,requested.width,bounds.width),height=compactHeight;
 const compact={left:anchor==='bottom-right'?right(requested)-width:requested.left,
  top:anchor==='top-left'?requested.top:bottom(requested)-height,width,height};
 return {compact:true,rect:free(compact)?compact:null};
}
