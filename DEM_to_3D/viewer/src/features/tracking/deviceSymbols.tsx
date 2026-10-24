import type { DeviceRole } from './deviceFeed';
export function deviceGlyph(role:DeviceRole) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${role==='resident'
    ? '<circle cx="12" cy="7" r="3"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/>'
    : '<path d="m12 2 8 3v6c0 5-8 11-8 11S4 16 4 11V5Z"/><path d="M12 7v9m-4.5-4.5h9"/>'}</svg>`;
}
export function DeviceLegendSymbol({role}:{role:DeviceRole}) {
  return <i className={'tracked-device-symbol is-'+role} aria-hidden="true" dangerouslySetInnerHTML={{__html:deviceGlyph(role)}}/>;
}
