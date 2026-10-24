/** Internal A/B identifiers stay stable; people see an origin dot and destination pin. */
export function routeStopSvg(start: boolean): string {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${start
    ? '<circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>'
    : '<path d="M18 10c0 4-6 10-6 10S6 14 6 10a6 6 0 1 1 12 0Z"/><circle cx="12" cy="10" r="2"/>'}</svg>`;
}
