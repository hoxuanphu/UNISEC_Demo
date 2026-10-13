import type { HoverInfo } from '../types/terrain';

export function HoverInfoPanel({ info }: { info: HoverInfo | null }): JSX.Element {
  if (!info) return <aside className="hover-info muted">Move the pointer over the terrain</aside>;
  return (
    <aside className="hover-info" aria-live="polite">
      <div className="hover-title">Surface point</div>
      <dl>
        <dt>Projected X</dt><dd>{info.projected.x.toFixed(2)} m</dd>
        <dt>Projected Y</dt><dd>{info.projected.y.toFixed(2)} m</dd>
        {info.longitude !== undefined && <><dt>Longitude</dt><dd>{info.longitude.toFixed(6)}°</dd></>}
        {info.latitude !== undefined && <><dt>Latitude</dt><dd>{info.latitude.toFixed(6)}°</dd></>}
        <dt>Elevation</dt><dd>{info.elevation.toFixed(2)} m</dd>
        <dt>Pixel</dt><dd>row {info.row}, col {info.column}</dd>
        <dt>Sampling</dt><dd>{info.interpolated ? 'bilinear grid' : 'nearest / mesh fallback'}</dd>
      </dl>
    </aside>
  );
}

export function AdministrativeInfoPanel({
  info,
  visible,
}: {
  info: import('../types/terrain').TerrainMetadata['administrative'];
  visible: boolean;
}): JSX.Element | null {
  if (!visible || !info) return null;
  const units = info.units ?? [info];
  return (
    <aside className='administrative-info' aria-label='Administrative information'>
      <div className='hover-title'>Administrative area</div>
      {info.source && <div className='administrative-source'>Source: {info.source}</div>}
      {units.map((unit, index) => <dl className='administrative-unit' key={`${unit.commune_code ?? unit.commune_name ?? 'unit'}-${index}`}>
        {unit.commune_name && <><dt>Commune / ward</dt><dd>{unit.commune_name}</dd></>}
        {unit.province_name && <><dt>Province</dt><dd>{unit.province_name}</dd></>}
        {unit.type && <><dt>Type</dt><dd>{unit.type}</dd></>}
        {unit.commune_code && <><dt>Commune code</dt><dd>{unit.commune_code}</dd></>}
        {unit.headquarters && <><dt>Headquarters</dt><dd>{unit.headquarters}</dd></>}
        {unit.area_km2 !== undefined && <><dt>Diện tích</dt><dd>{unit.area_km2.toFixed(2)} km²</dd></>}
        {unit.population !== undefined && <><dt>Dân số</dt><dd>{unit.population.toLocaleString('vi-VN')}</dd></>}
        {unit.density_per_km2 !== undefined && <><dt>Mật độ</dt><dd>{unit.density_per_km2.toFixed(2)} người/km²</dd></>}
      </dl>)}
    </aside>
  );
}
