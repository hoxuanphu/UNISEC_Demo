export type SurfaceRect={left:number;top:number;width:number;height:number};
const right=(r:SurfaceRect)=>r.left+r.width,bottom=(r:SurfaceRect)=>r.top+r.height;
export const surfacesOverlap=(a:SurfaceRect,b:SurfaceRect,gap=8)=>a.left<right(b)+gap&&b.left<right(a)+gap&&a.top<bottom(b)+gap&&b.top<bottom(a)+gap;
/** Primary work keeps its space. A secondary map yields to a compact, free slot. */
export function placeSecondarySurface(requested:SurfaceRect,bounds:SurfaceRect,obstacles:readonly SurfaceRect[]){
 const fits=(r:SurfaceRect)=>r.left>=bounds.left&&r.top>=bounds.top&&right(r)<=right(bounds)+1&&bottom(r)<=bottom(bounds)+1;
 const free=(r:SurfaceRect)=>fits(r)&&!obstacles.some(other=>surfacesOverlap(r,other));
 if(free(requested))return {compact:false,rect:requested};
 const width=Math.min(248,requested.width,bounds.width),height=38;
 const xs=[requested.left,bounds.left,right(bounds)-width,...obstacles.flatMap(r=>[r.left-width-10,right(r)+10])];
 const ys=[requested.top,bottom(bounds)-height,bounds.top,...obstacles.flatMap(r=>[r.top-height-10,bottom(r)+10])];
 for(const top of ys)for(const left of xs){const rect={left,top,width,height};if(free(rect))return {compact:true,rect};}
 return {compact:true,rect:null};
}
