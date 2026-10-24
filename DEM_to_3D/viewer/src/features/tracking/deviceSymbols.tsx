import type { DeviceRole } from './deviceFeed';
/** Legend and map share a restrained two-colour location encoding. */
export function DeviceLegendSymbol({role}:{role:DeviceRole}) {
  return <i className={'tracked-device-symbol is-'+role} aria-hidden="true"/>;
}
