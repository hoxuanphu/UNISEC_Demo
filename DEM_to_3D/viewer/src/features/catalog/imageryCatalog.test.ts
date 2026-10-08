import { describe, expect, it } from 'vitest';
import raw from '../../../public/catalog/che-tao.json';
import {
  parseImageryCatalog,
  reviewScenePair,
  sceneCoverage,
  searchImagery
} from './imageryCatalog';
import { drawnPolygon } from '../geodata/geometryEditing';
import { isPolygon } from '../../geo/vector/types';

const catalog = parseImageryCatalog(raw);
const geometry = drawnPolygon(
  [
    [104.02, 21.76],
    [104.08, 21.82]
  ],
  true
);
if (!isPolygon(geometry)) throw new Error('Expected AOI');
const aoi = geometry;
describe('Prepared imagery catalog', () => {
  it('validates real STAC metadata and keeps SAR spacing separate from GSD/cloud cover', () => {
    expect(catalog.scenes).toHaveLength(12);
    const sar = catalog.scenes.find((scene) => scene.sensor === 'sar')!;
    expect(sar.pixelSpacing).toBe(10);
    expect(sar.gsd).toBeNull();
    expect(sar.cloudCover).toBeNull();
    expect(sar.metadataUrl).toMatch(/^https:\/\/stac\.dataspace\.copernicus\.eu/);
    expect(() =>
      parseImageryCatalog({
        ...raw,
        features: [raw.features[0], raw.features[0]]
      })
    ).toThrow();
  });
  it('searches actual polygon intersections, dates and clouds without treating missing quality as zero', () => {
    expect(
      searchImagery(catalog, aoi, {
        sensor: 'sar',
        from: '2026-09-01',
        to: '2026-10-08',
        cloud: null
      }).length
    ).toBeGreaterThan(0);
    const optical = catalog.scenes.find((scene) => scene.sensor === 'optical')!;
    expect(
      searchImagery({ ...catalog, scenes: [{ ...optical, cloudCover: null }] }, aoi, {
        sensor: 'optical',
        from: '2026-09-01',
        to: '2026-10-08',
        cloud: 30
      })
    ).toHaveLength(0);
    expect(sceneCoverage(aoi, optical)).toBeGreaterThanOrEqual(0);
    expect(
      searchImagery(catalog, aoi, {
        sensor: 'sar',
        from: '2027-01-01',
        to: '2027-01-31',
        cloud: null
      })
    ).toHaveLength(0);
    expect(() =>
      searchImagery(catalog, aoi, {
        sensor: 'all',
        from: '2027-01-01',
        to: '2026-01-01',
        cloud: null
      })
    ).toThrow();
    for (const filters of [
      { sensor: 'all', from: '2026-02-31', to: '2026-03-10', cloud: null },
      { sensor: 'optical', from: '2026-09-01', to: '2026-10-08', cloud: -1 }
    ])
      expect(() => searchImagery(catalog, aoi, filters)).toThrow();
  });
  it('does not approve a processing pair from scene selection alone', () => {
    const first = catalog.scenes.find(
      (scene) => scene.sensor === 'sar' && sceneCoverage(aoi, scene) > 0
    )!;
    expect(
      reviewScenePair([first, { ...first, id: 'other', acquiredAt: '2026-09-01T11:00:00Z' }], aoi)
    ).toBe('metadata-only');
    expect(
      reviewScenePair(
        [
          first,
          {
            ...first,
            id: 'other',
            orbit: null,
            acquiredAt: '2026-09-01T11:00:00Z'
          }
        ],
        aoi
      )
    ).toBe('orbit');
    expect(reviewScenePair([first, { ...first, id: 'other' }], aoi)).toBe('time');
    expect(
      reviewScenePair([first, catalog.scenes.find((scene) => scene.sensor === 'optical')!], aoi)
    ).toBe('sensor');
  });
});
