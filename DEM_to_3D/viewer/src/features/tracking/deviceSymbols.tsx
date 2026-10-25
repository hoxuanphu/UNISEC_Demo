import type { DeviceRole } from './deviceFeed';
/** Legend and map share a restrained two-colour location encoding. */
export function DeviceLegendSymbol({role}:{role:DeviceRole}) {
  return <i className={'tracked-device-symbol is-'+role} aria-hidden="true"/>;
}

/** The rescue cross, as on a team's map dot, for lists, cards and tabs. On whole pixels at 16 px, so it sits centred. */
export function RescueCross({size=16}:{size?:number}) {
  return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2h4v4h4v4h-4v4H6v-4H2V6h4z" fill="currentColor"/></svg>;
}
