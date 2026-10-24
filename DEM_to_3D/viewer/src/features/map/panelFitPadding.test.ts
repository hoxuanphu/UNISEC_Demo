import {describe,expect,it} from 'vitest';
import {panelFitPadding} from './panelFitPadding';
const rect=(left:number,top:number,width:number,height:number)=>({left,top,width,height,right:left+width,bottom:top+height});
describe('map framing around floating cards',()=>{
  it('uses the free strip to the left of a desktop detail card',()=>{
    expect(panelFitPadding(rect(384,180,640,700),rect(672,192,340,380))).toEqual({paddingTopLeft:[40,40],paddingBottomRight:[376,40]});
  });
  it('focuses below a card on a mobile map',()=>{
    expect(panelFitPadding(rect(0,140,390,700),rect(12,152,366,300))).toEqual({paddingTopLeft:[40,336],paddingBottomRight:[40,40]});
  });
  it('keeps a route above a mobile directions sheet',()=>{
    expect(panelFitPadding(rect(0,100,390,700),rect(12,520,366,260))).toEqual({paddingTopLeft:[40,40],paddingBottomRight:[40,304]});
  });
  it('ignores cards outside the map and hidden cards',()=>{
    expect(panelFitPadding(rect(384,96,640,700),rect(0,96,384,700))).toEqual({paddingTopLeft:[40,40],paddingBottomRight:[40,40]});
    expect(panelFitPadding(rect(0,0,640,700),rect(0,0,0,0))).toEqual({paddingTopLeft:[40,40],paddingBottomRight:[40,40]});
  });
});
