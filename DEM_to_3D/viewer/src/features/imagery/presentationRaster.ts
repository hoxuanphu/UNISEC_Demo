import {rasterUrl,type ImageryRaster} from './analysisImagery';
import {softenCoverageEdgeAsync} from './coverageFeather';

const previews=new Map<string,Promise<string>>();
/** One derived preview per source; the original checksummed image is retained. */
export function presentationRasterUrl(raster:ImageryRaster,signal:AbortSignal):Promise<string>{
  const key=raster.web.sha256;
  let preview=previews.get(key);
  if(!preview){
    const pending=(async()=>{
      const url=await rasterUrl(raster.web,new AbortController().signal);
      const bitmap=await createImageBitmap(await(await fetch(url)).blob());
      try{
        const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
        const context=canvas.getContext('2d',{willReadFrequently:true});
        if(!context)throw new Error('Canvas unavailable');
        context.drawImage(bitmap,0,0);
        const [[south,west],[north,east]]=raster.web.latLngBounds;
        await softenCoverageEdgeAsync(canvas,(east-west)*111320*Math.cos((north+south)/2*Math.PI/180)/canvas.width);
        const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Preview unavailable')),'image/png'));
        return URL.createObjectURL(blob);
      }finally{bitmap.close();}
    })();
    pending.catch(()=>previews.delete(key));previews.set(key,pending);preview=pending;
  }
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(signal.reason);return;}
    const abort=()=>reject(signal.reason);
    signal.addEventListener('abort',abort,{once:true});
    preview!.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
  });
}
