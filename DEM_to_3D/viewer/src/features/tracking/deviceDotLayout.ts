export type DotAnchor = {id:string;x:number;y:number};
export type DotObstacle = {left:number;top:number;right:number;bottom:number};
export type DotPlacement = DotAnchor & {anchorX:number;anchorY:number};
const spacing=22, radius=8;
const offsets=[{x:0,y:0},...[16,24,32,40,48].flatMap(distance=>Array.from({length:12},(_,index)=>({x:Math.cos(index*Math.PI/6)*distance,y:Math.sin(index*Math.PI/6)*distance})))];
/** Displace only crowded screen symbols; leader lines retain each original geographic anchor. */
export function layoutDeviceDots(anchors:readonly DotAnchor[],obstacles:readonly DotObstacle[],width:number,height:number):DotPlacement[] {
  const placed:DotPlacement[]=[];
  for(const anchor of [...anchors].sort((a,b)=>a.id.localeCompare(b.id))){
    const candidates=offsets.map(offset=>({x:anchor.x+offset.x,y:anchor.y+offset.y})).filter(point=>point.x>=radius&&point.y>=radius&&point.x<=width-radius&&point.y<=height-radius);
    const clearance=(point:{x:number;y:number})=>Math.min(spacing,
      ...placed.map(other=>Math.hypot(point.x-other.x,point.y-other.y)),
      ...obstacles.map(box=>Math.hypot(Math.max(box.left-point.x,0,point.x-box.right),Math.max(box.top-point.y,0,point.y-box.bottom))+spacing-radius));
    const best=candidates.find(point=>clearance(point)>=spacing)??candidates.reduce<{x:number;y:number}|null>((best,point)=>!best||clearance(point)>clearance(best)?point:best,null)??anchor;
    placed.push({id:anchor.id,x:best.x,y:best.y,anchorX:anchor.x,anchorY:anchor.y});
  }
  return placed;
}
