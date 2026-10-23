import { describe, expect, it } from 'vitest';
import catalog from '../../../public/scenarios/che-tao/imagery/imagery.json';
import { acquisitionLabel, defaultAnalysisSelection, latestOpticalLayer, selectionForCatalog, selectedRasters, validateImageryCatalog } from './analysisImagery';

const url = '/scenarios/che-tao/imagery/imagery.json';

describe('prepared analysis imagery', () => {
  const layers = validateImageryCatalog(catalog, url);

  it('defaults to the latest optical imagery independently of catalog order or newer SAR', () => {
    expect(defaultAnalysisSelection.layer).toBe('planet-post');
    expect(latestOpticalLayer([...layers].reverse())?.id).toBe('planet-post');
    const post=layers[0];
    if(post.kind!=='optical') throw new Error('Optical fixture required');
    const later={...post,id:'later-planet',parts:post.parts.map(part=>({...part,acquired:'2026-10-19T00:00:00Z'}))};
    expect(latestOpticalLayer([later,...layers])?.id).toBe('later-planet');
    expect(latestOpticalLayer(layers.filter(layer=>layer.kind==='sar'))).toBeUndefined();
  });

  it('offers the clearer 1 September reference as a separate acquisition without changing the latest default',()=>{
    const layer=layers.find(layer=>layer.id==='planet-sep01');
    if(layer?.kind!=='optical')throw new Error('Reference scene missing');
    expect(layer.parts).toHaveLength(2);
    expect(layer.parts.every(part=>part.acquired.startsWith('2026-09-01'))).toBe(true);
    expect(acquisitionLabel(layer)).toBe('1/9/2026');
    expect(selectedRasters(layers,{...defaultAnalysisSelection,layer:layer.id})[0].terrain.url).toContain('planet-sep01-mosaic');
  });

  it('retains an explicit off choice but replaces an unavailable layer after a catalog change',()=>{
    const before={...defaultAnalysisSelection,layer:'old-dataset-layer',opacity:.6};
    expect(selectionForCatalog(layers,before,true)).toEqual({...before,layer:'planet-post'});
    const off={...before,layer:null};expect(selectionForCatalog(layers,off,true)).toBe(off);
    const valid={...before,layer:'planet-sep01'};expect(selectionForCatalog(layers,valid,true)).toBe(valid);
  });

  it('keeps optical parts and SAR modes with resolved, checksummed assets', () => {
    expect(layers.map(layer => layer.id)).toEqual(['planet-post', 'planet-pre', 'planet-sep01', 'sentinel1', 'sentinel1-oct11']);
    const post = layers[0];
    expect(post.kind === 'optical' && post.parts).toHaveLength(3);
    expect(selectedRasters(layers,{layer:'planet-post',sarMode:'vv',opacity:1})).toHaveLength(1);
    expect(selectedRasters(layers,{layer:'planet-post',sarMode:'vv',opacity:1})[0].terrain.url).toContain('mosaic');
    const raster = selectedRasters(layers, { layer: 'sentinel1', sarMode: 'vh', opacity: 1 })[0];
    expect(raster.terrain.url).toMatch(/^\/scenarios\/che-tao\/imagery\/sentinel1-vh\.utm\.webp$/);
    expect(raster.web.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(selectedRasters(layers, { layer: null, sarMode: 'vv', opacity: 1 })).toEqual([]);
  });

  it('covers the required interpretation point with optical and SAR renderings', () => {
    // 21.74146 N, 104.03 E in EPSG:32648
    const point = { x: 399692, y: 2404525 };
    const covers = (bounds: number[]) => bounds[0] <= point.x && point.x <= bounds[2] && bounds[1] <= point.y && point.y <= bounds[3];
    expect(selectedRasters(layers, { layer: 'planet-post', sarMode: 'vv', opacity: 1 }).some(r => covers(r.terrain.bounds))).toBe(true);
    expect(covers(selectedRasters(layers, { layer: 'sentinel1', sarMode: 'vv', opacity: 1 })[0].terrain.bounds)).toBe(true);
  });

  it('labels every acquisition day of a mixed-date optical layer', () => {
    expect(acquisitionLabel(layers[0])).toBe('1/9, 12/9/2026');
    expect(acquisitionLabel(layers[1])).toBe('12/4/2026');
    const pre=layers[1];
    expect(pre.kind==='optical' && pre.parts.every(part=>part.cloudPercent===0)).toBe(true);
    expect(acquisitionLabel(layers.find(layer=>layer.kind==='sar')!)).toBe('18/10/2026');
  });

  it('rejects inverted bounds, foreign CRS and unsafe file names', () => {
    const clone = () => JSON.parse(JSON.stringify(catalog));
    const inverted = clone(); inverted.layers[0].parts[0].terrain.bounds = [10, 0, 0, 10];
    const foreign = clone(); foreign.layers[0].parts[0].terrain.crs = 'EPSG:4326';
    const brokenMosaic=clone(); brokenMosaic.layers[0].mosaic.terrain.bounds=[0,1,0,2];
    const unsafe = clone(); unsafe.layers.find((layer:{kind:string})=>layer.kind==='sar')!.modes!.vv.web.url = '../incident.json';
    for (const value of [inverted, foreign, unsafe, brokenMosaic]) expect(() => validateImageryCatalog(value, url)).toThrow(/Invalid imagery catalog/);
  });
});
