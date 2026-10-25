import {expect,it} from 'vitest';
import {projectedToWgs84} from './coordinate';
import {validateMetadata} from './validation';
import metadataJson from '../../public/terrain/che_tao_v2_tex.terrain.json';

it('reuses the geographic conversion without retaining an obsolete CRS',()=>{
  const metadata=validateMetadata(structuredClone(metadataJson));
  metadata.crs={authority:'EPSG',code:32648,linear_unit:'metre'};
  for(let i=0;i<3;i++){
    const result=projectedToWgs84(metadata,{x:500000,y:0});
    expect(result.longitude).toBeCloseTo(105,8);expect(result.latitude).toBeCloseTo(0,8);
  }
  metadata.crs.code=32649;
  expect(projectedToWgs84(metadata,{x:500000,y:0}).longitude).toBeCloseTo(111,8);
  metadata.crs={authority:'EPSG',code:4326,linear_unit:'degree'};
  expect(projectedToWgs84(metadata,{x:104,y:21})).toEqual({longitude:104,latitude:21});
  metadata.crs.code=999999;
  expect(projectedToWgs84(metadata,{x:0,y:0})).toEqual({});
  metadata.crs={authority:'EPSG',code:32648,linear_unit:'metre'};
  expect(projectedToWgs84(metadata,{x:500000,y:0}).longitude).toBeCloseTo(105,8);
});
