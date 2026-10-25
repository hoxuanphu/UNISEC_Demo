export type DotAnchor = {id:string;x:number;y:number};
export type DotGroup = DotAnchor & {members:string[]};
/** Co-located symbols share an inspectable group at an actual member coordinate. Never displace a point. */
export function groupDeviceDots(anchors:readonly DotAnchor[]):DotGroup[] {
  const groups:DotGroup[]=[];
  for(const anchor of [...anchors].sort((a,b)=>a.id.localeCompare(b.id))){
    // Dots are up to 18 px across: closer centres would overlap.
    const group=groups.find(item=>Math.hypot(anchor.x-item.x,anchor.y-item.y)<20);
    if(group)group.members.push(anchor.id);
    else groups.push({...anchor,members:[anchor.id]});
  }
  return groups;
}
