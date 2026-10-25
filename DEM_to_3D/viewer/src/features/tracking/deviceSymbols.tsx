import type { DeviceRole } from './deviceFeed';
/** Legend and map share a restrained two-colour location encoding. */
export function DeviceLegendSymbol({role}:{role:DeviceRole}) {
  return <i className={'tracked-device-symbol is-'+role} aria-hidden="true"/>;
}

/** Rescue cross for lists, cards and navigation; map locations remain plain coloured dots. */
export function RescueCross({size=16}:{size?:number}) {
  return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><path d="M6.4 2h3.2v4.4H14v3.2H9.6V14H6.4V9.6H2V6.4h4.4z" fill="currentColor"/></svg>;
}
