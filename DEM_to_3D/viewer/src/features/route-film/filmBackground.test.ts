import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({defer:vi.fn(),note:vi.fn()}));
vi.mock('../map/imagerySource',()=>({imagerySource:{url:'/local/{z}/{x}/{y}',maxNativeZoom:14,credit:'local'},internetImagerySource:{url:'https://detail/{z}/{x}/{y}',maxNativeZoom:16},noteInternetDetail:mocks.note}));
vi.mock('../map/imageryDetail',()=>({internetDetailAvailable:()=>true,deferInternetDetail:mocks.defer}));
vi.mock('../map/localMapSource',()=>({localMapSource:()=>({})}));
import { loadFilmBackground } from './filmBackground';
const view={cx:11580000,cy:2480000,metresPerPixel:3};
function environment(fetcher:typeof fetch){
  vi.stubGlobal('fetch',fetcher);
  vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>({fillRect:vi.fn(),drawImage:vi.fn()})}),fonts:{load:async()=>[]}});
  vi.stubGlobal('createImageBitmap',async()=>({close:vi.fn()}));
}
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
describe('atomic adaptive movie imagery',()=>{
  it('does not treat a cancelled camera frame as an Internet outage',async()=>{
    let began!:()=>void;
    const detailBegan=new Promise<void>(resolve=>{began=resolve;});
    environment(vi.fn(async(url,options)=>{
      if(String(url).startsWith('/local/'))return new Response(new Blob(['tile']));
      began();return await new Promise<Response>((_,reject)=>options?.signal?.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')),{once:true}));
    }));
    const controller=new AbortController(),publish=vi.fn();
    const task=loadFilmBackground(view,controller.signal,publish);
    await detailBegan;controller.abort();
    await expect(task).rejects.toThrow();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(mocks.defer).not.toHaveBeenCalled();
  });
  it('retains the complete local frame when any Internet tile fails',async()=>{
    let count=0;
    environment(vi.fn(async url=>new Response(new Blob(['tile']),{status:String(url).startsWith('https:')&&++count===2?503:200})));
    const publish=vi.fn();await loadFilmBackground(view,new AbortController().signal,publish);
    expect(publish).toHaveBeenCalledTimes(1);expect(mocks.note).not.toHaveBeenCalled();expect(mocks.defer).toHaveBeenCalled();
  });
  it('publishes a complete detailed revision independently of the local canvas',async()=>{
    environment(vi.fn(async()=>new Response(new Blob(['tile']))));
    const publish=vi.fn();await loadFilmBackground(view,new AbortController().signal,publish);
    expect(publish).toHaveBeenCalledTimes(2);expect(publish.mock.calls[0][0]).not.toBe(publish.mock.calls[1][0]);expect(mocks.note).toHaveBeenCalledTimes(1);
  });
});
