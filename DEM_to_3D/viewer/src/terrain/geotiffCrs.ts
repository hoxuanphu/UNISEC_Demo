import proj4 from 'proj4';

type GeoKeys = Record<string, unknown>;

export function registerCrs(crs: string): void {
  const match = /^EPSG:(326|327)(\d{2})$/i.exec(crs);
  if (match && Number(match[2]) >= 1 && Number(match[2]) <= 60 && !proj4.defs(crs)) {
    proj4.defs(crs, `+proj=utm +zone=${Number(match[2])} ${match[1] === '327' ? '+south' : ''} +datum=WGS84 +units=m +no_defs`);
  }
}

function unsupported(detail: string): never {
  throw new Error(`GeoTIFF CRS không hỗ trợ: ${detail}. Hãy reproject ảnh sang EPSG:4326 hoặc WGS84 UTM trước khi tải; không chỉ gán lại CRS.`);
}

function parameter(keys: GeoKeys, key: string, fallback?: number): number {
  const value = keys[key] ?? fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) unsupported(`thiếu hoặc sai ${key}`);
  return value;
}

export function geoTiffCrs(keys: GeoKeys): string {
  const projected = keys.GTModelTypeGeoKey === 1 || (keys.GTModelTypeGeoKey == null &&
    (keys.ProjectedCSTypeGeoKey != null || keys.ProjCoordTransGeoKey != null));
  if (keys.GTModelTypeGeoKey != null && keys.GTModelTypeGeoKey !== 1 && keys.GTModelTypeGeoKey !== 2) {
    unsupported('chỉ nhận hệ tọa độ phẳng hoặc kinh/vĩ độ');
  }
  const epsg = projected ? keys.ProjectedCSTypeGeoKey : keys.GeographicTypeGeoKey;
  if (typeof epsg === 'number' && Number.isInteger(epsg) && epsg > 0 && epsg !== 32767) {
    const crs = `EPSG:${epsg}`;
    registerCrs(crs);
    try { proj4(crs); } catch { unsupported(crs); }
    return crs;
  }
  if (!projected || keys.ProjCoordTransGeoKey !== 17) {
    unsupported(projected ? `phép chiếu tùy chỉnh ${String(keys.ProjCoordTransGeoKey ?? 'không xác định')}` : 'thiếu mã EPSG địa lý');
  }
  if (keys.ProjLinearUnitsGeoKey !== 9001 || keys.GeogAngularUnitsGeoKey !== 9102) {
    unsupported('Equirectangular cần đơn vị mét và độ');
  }
  const a = parameter(keys, 'GeogSemiMajorAxisGeoKey');
  const inverseFlattening = keys.GeogSemiMinorAxisGeoKey == null ? parameter(keys, 'GeogInvFlatteningGeoKey') : 0;
  const b = keys.GeogSemiMinorAxisGeoKey != null
    ? parameter(keys, 'GeogSemiMinorAxisGeoKey')
    : inverseFlattening === 0 ? a : a * (1 - 1 / inverseFlattening);
  // proj4's eqc implementation is spherical; an ellipsoidal CRS must not be approximated silently.
  if (a <= 0 || b !== a) unsupported('Equirectangular chỉ hỗ trợ ellipsoid hình cầu được khai báo rõ');
  if (parameter(keys, 'GeogPrimeMeridianLongGeoKey', 0) !== 0 ||
      (keys.GeogPrimeMeridianGeoKey != null && keys.GeogPrimeMeridianGeoKey !== 8901 && keys.GeogPrimeMeridianGeoKey !== 32767)) {
    unsupported('kinh tuyến gốc không phải Greenwich');
  }
  const lon = parameter(keys, 'ProjCenterLongGeoKey');
  const lat = parameter(keys, 'ProjCenterLatGeoKey');
  const parallel = parameter(keys, 'ProjStdParallel1GeoKey');
  if (Math.abs(lon) > 180 || Math.abs(lat) > 90 || Math.abs(parallel) >= 90) unsupported('góc chiếu Equirectangular không hợp lệ');
  const x = parameter(keys, 'ProjFalseEastingGeoKey', 0);
  const y = parameter(keys, 'ProjFalseNorthingGeoKey', 0);
  return `+proj=eqc +lat_ts=${parallel} +lat_0=${lat} +lon_0=${lon} +x_0=${x} +y_0=${y} +a=${a} +b=${b} +units=m +no_defs`;
}
