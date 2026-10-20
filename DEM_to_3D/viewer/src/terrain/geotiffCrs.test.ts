import { expect, it } from 'vitest';
import proj4 from 'proj4';
import { geoTiffCrs } from './geotiffCrs';

const custom = {
  GTModelTypeGeoKey: 1, ProjectedCSTypeGeoKey: 32767, GeographicTypeGeoKey: 32767,
  ProjCoordTransGeoKey: 17, ProjLinearUnitsGeoKey: 9001, GeogAngularUnitsGeoKey: 9102,
  GeogSemiMajorAxisGeoKey: 6378166.17539632, GeogSemiMinorAxisGeoKey: 6378166.17539632,
  ProjCenterLongGeoKey: 104.023498585448, ProjCenterLatGeoKey: 21.7330101664615,
  ProjStdParallel1GeoKey: 21.7330101664615, ProjFalseEastingGeoKey: 0, ProjFalseNorthingGeoKey: 0,
};

it('resolves standard geographic, Web Mercator and north/south WGS84 UTM CRS', () => {
  expect(geoTiffCrs({ GeographicTypeGeoKey: 4326 })).toBe('EPSG:4326');
  for (const epsg of [3857, 32648, 32748]) {
    expect(geoTiffCrs({ GTModelTypeGeoKey: 1, ProjectedCSTypeGeoKey: epsg, GeographicTypeGeoKey: 4326 })).toBe(`EPSG:${epsg}`);
  }
});

it('reconstructs the original SAR spherical Equirectangular from GeoKeys', () => {
  const crs = geoTiffCrs(custom);
  expect(proj4(crs, 'EPSG:4326', [0, 0])).toEqual([custom.ProjCenterLongGeoKey, custom.ProjCenterLatGeoKey]);
  const radius = custom.GeogSemiMajorAxisGeoKey;
  const radians = Math.PI / 180;
  const lon = custom.ProjCenterLongGeoKey + 0.01;
  const lat = custom.ProjCenterLatGeoKey + 0.02;
  const [x, y] = proj4('EPSG:4326', crs, [lon, lat]);
  expect(x).toBeCloseTo(radius * Math.cos(custom.ProjStdParallel1GeoKey * radians) * 0.01 * radians, 6);
  expect(y).toBeCloseTo(radius * 0.02 * radians, 6);
  const shifted = geoTiffCrs({ ...custom, ProjFalseEastingGeoKey: 500, ProjFalseNorthingGeoKey: -600 });
  const center = proj4('EPSG:4326', shifted, [custom.ProjCenterLongGeoKey, custom.ProjCenterLatGeoKey]);
  expect(center[0]).toBeCloseTo(500);
  expect(center[1]).toBeCloseTo(-600);
});

it('supports a sphere expressed by zero inverse flattening', () => {
  const { GeogSemiMinorAxisGeoKey: _, ...keys } = custom;
  expect(geoTiffCrs({ ...keys, GeogInvFlatteningGeoKey: 0 })).toBe(geoTiffCrs(custom));
});

it('never falls back to a base geographic CRS for an unsupported projected CRS', () => {
  for (const epsg of [32767, undefined, 999999]) {
    expect(() => geoTiffCrs({ GTModelTypeGeoKey: 1, ProjectedCSTypeGeoKey: epsg, GeographicTypeGeoKey: 4326 })).toThrow('reproject');
  }
  expect(() => geoTiffCrs({ GTModelTypeGeoKey: 3, GeographicTypeGeoKey: 4326 })).toThrow('CRS');
  expect(() => geoTiffCrs({})).toThrow('CRS');
});

it('rejects custom projections with missing, nonfinite or unsupported parameters without guessing WGS84', () => {
  for (const patch of [
    { ProjCoordTransGeoKey: 1 }, { ProjCenterLongGeoKey: undefined }, { ProjCenterLatGeoKey: NaN },
    { ProjStdParallel1GeoKey: 90 }, { GeogSemiMajorAxisGeoKey: -1 }, { GeogSemiMinorAxisGeoKey: 6356752 },
    { ProjLinearUnitsGeoKey: 9002 }, { GeogAngularUnitsGeoKey: 9101 }, { GeogPrimeMeridianLongGeoKey: 2 },
    { GeogPrimeMeridianGeoKey: 8903 },
  ]) expect(() => geoTiffCrs({ ...custom, ...patch })).toThrow('CRS');
});
