/** Display-only seam treatment. RGB values, opaque interiors, clouds and source files
 * stay untouched. A bounded distance transform fades only the coverage boundary. */
export function featherCoverageAlpha(image: {data:Uint8ClampedArray;width:number;height:number}, radiusPx:number): void {
  for (const _step of coverageFeatherSteps(image, radiusPx)) { /* Complete synchronously for small fixtures. */ }
}

function* coverageFeatherSteps(image: {data:Uint8ClampedArray;width:number;height:number}, radiusPx:number) {
  const radius=Math.min(32,Math.max(0,Math.round(radiusPx)));
  if(!radius)return;
  const {data,width,height}=image,limit=radius+1,distances=new Uint8Array(width*height);
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const i=y*width+x;
      distances[i]=data[i*4+3]===0?0:Math.min(limit,x===0||y===0?1:limit,x?distances[i-1]+1:limit,y?distances[i-width]+1:limit);
    }
    if(y%32===31)yield;
  }
  for(let y=height-1;y>=0;y--){
    for(let x=width-1;x>=0;x--){
      const i=y*width+x;
      distances[i]=Math.min(distances[i],x===width-1||y===height-1?1:limit,x<width-1?distances[i+1]+1:limit,y<height-1?distances[i+width]+1:limit);
    }
    if(y%32===0)yield;
  }
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const i=y*width+x;
      if(distances[i]<=radius){
        const t=Math.max(0,(distances[i]-.5)/radius);
        data[i*4+3]=Math.round(data[i*4+3]*t*t*(3-2*t));
      }
    }
    if(y%32===31)yield;
  }
}

/** Keep image processing interruptible without changing a pixel of its result. */
export async function featherCoverageAlphaAsync(image: {data:Uint8ClampedArray;width:number;height:number}, radiusPx:number, signal?:AbortSignal):Promise<void> {
  signal?.throwIfAborted();
  let started = performance.now();
  for (const _step of coverageFeatherSteps(image, radiusPx)) {
    signal?.throwIfAborted();
    if (performance.now() - started >= 8) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      signal?.throwIfAborted();
      started = performance.now();
    }
  }
  signal?.throwIfAborted();
}

export async function softenCoverageEdgeAsync(canvas:HTMLCanvasElement,metresPerPixel:number,signal?:AbortSignal):Promise<void> {
  if(!(metresPerPixel>0))return;
  signal?.throwIfAborted();
  const context=canvas.getContext('2d',{willReadFrequently:true});
  if(!context)return;
  const pixels=context.getImageData(0,0,canvas.width,canvas.height);
  await featherCoverageAlphaAsync(pixels,30/metresPerPixel,signal);
  context.putImageData(pixels,0,0);
}
