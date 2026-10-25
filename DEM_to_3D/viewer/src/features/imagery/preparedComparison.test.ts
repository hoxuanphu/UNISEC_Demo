import { describe, expect, it } from 'vitest';
import catalog from '../../../public/scenarios/che-tao/imagery/imagery.json';
import { acquisitionLabel, selectedRasters, validateImageryCatalog } from './analysisImagery';
import { preparedComparisonPair } from './preparedComparison';
const layers=validateImageryCatalog(catalog,'/scenarios/che-tao/imagery/imagery.json');
describe('prepared before/after pairs',()=>{
  it('orders SAR by actual acquisition, independently of catalog order',()=>{
    const pair=preparedComparisonPair([...layers].reverse(),'sar')!;
    expect(pair.before.id).toBe('sentinel1-oct11');expect(pair.after.id).toBe('sentinel1');
    expect(acquisitionLabel(pair.before)).toBe('11/10/2026');expect(acquisitionLabel(pair.after)).toBe('18/10/2026');
    for(const band of ['vv','vh','rgb'] as const){
      const before=selectedRasters(layers,{layer:pair.before.id,sarMode:band,opacity:1})[0];
      const after=selectedRasters(layers,{layer:pair.after.id,sarMode:band,opacity:1})[0];
      expect(before.web.sha256).not.toBe(after.web.sha256);
      // The real dates have different footprints. Do not stretch one to the other.
      expect(before.web.latLngBounds).not.toEqual(after.web.latLngBounds);
      const b=before.terrain.bounds;expect(399692>=b[0]&&399692<=b[2]&&2404525>=b[1]&&2404525<=b[3]).toBe(true);
    }
  });
  it('keeps Planet comparisons separate from the newer radar dates',()=>{
    const pair=preparedComparisonPair(layers,'optical')!;
    expect(pair.before.id).toBe('planet-pre');expect(pair.after.id).toBe('planet-post');
  });
  it('does not compare a single STRIX acquisition with Sentinel-1 or invent extra bands',()=>{
    const strix=layers.find(layer=>layer.id==='strix007-oct20')!;
    const sentinel=layers.find(layer=>layer.id==='sentinel1')!;
    expect(preparedComparisonPair([sentinel,strix],'sar')).toBeUndefined();
    expect(preparedComparisonPair(layers,'sar')?.after.id).toBe('sentinel1');
  });
  it('does not call a single acquisition or two copies of the same acquisition a temporal pair',()=>{
    const one=layers.find(layer=>layer.id==='sentinel1')!;
    expect(preparedComparisonPair([one],'sar')).toBeUndefined();
    expect(preparedComparisonPair([one,{...one,id:'duplicate'}],'sar')).toBeUndefined();
    expect(preparedComparisonPair([], 'optical')).toBeUndefined();
  });
  it('does not offer spatially disjoint SAR scenes as a comparison pair',()=>{
    const pair=preparedComparisonPair(layers,'sar')!;
    if(pair.after.kind!=='sar')throw new Error('SAR fixture required');
    const raster=pair.after.modes.vv;
    const other={...pair.after,modes:{...pair.after.modes,vv:{...raster,web:{...raster.web,latLngBounds:[[30,110],[31,111]] as [[number,number],[number,number]]}}}};
    expect(preparedComparisonPair([pair.before,other],'sar')).toBeUndefined();
  });
  it('requires the same fixed dB ranges on both dates, including the composite ratio',()=>{
    const pair=preparedComparisonPair(layers,'sar')!;
    if(pair.before.kind!=='sar'||pair.after.kind!=='sar')throw new Error('SAR fixtures required');
    for(const band of ['vv','vh','ratio'] as const){
      const changed={...pair.after,rangesDb:{...pair.after.rangesDb,[band]:[-99,10] as [number,number]}};
      expect(preparedComparisonPair([pair.before,changed],'sar')).toBeUndefined();
    }
  });
});
