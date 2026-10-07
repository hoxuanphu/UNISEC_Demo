/** Shared SVG geometry for map markers and their legend. */
export const mapSymbolPaths = {
  community: 'M8.5 3.5a3 3 0 1 0 0 6a3 3 0 1 0 0-6ZM2 20v-2.5a6.5 6.5 0 0 1 13 0V20ZM17.5 5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5ZM17 12.5h.5a5 5 0 0 1 5 5V20h-5v-2.5c0-1.8-.2-3.3-.5-5Z',
  landslide: 'M3 20h18M3 20 10 7l4 7.5M15 17.5a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0-2.5 0M18.5 13a1 1 0 1 0 2 0a1 1 0 1 0-2 0M12 18.25a.75.75 0 1 0 1.5 0a.75.75 0 1 0-1.5 0',
  bridge: 'M2.5 9.5h19M5 9.5V19M19 9.5V19M5 15.5c3 0 4-4 7-4s4 4 7 4',
  crossing: 'M9 3v5M15 3v5M9 16v5M15 16v5M2.5 12q2.4-3.6 4.8 0t4.8 0 4.8 0 4.8 0',
  staging: 'M6 21V4h12l-2.5 4.5L18 13H6M3.5 21h5',
  hlz: 'M7 6v12M17 6v12M7 12h10',
  flood: 'M3 8c3-4 3 4 6 0s3 4 6 0 3 4 6 0M3 14c3-4 3 4 6 0s3 4 6 0 3 4 6 0M3 20c3-4 3 4 6 0s3 4 6 0 3 4 6 0'
} as const;

export type MapSymbolName = keyof typeof mapSymbolPaths;

export function mapSymbolSvg(symbol: MapSymbolName, size = 18): string {
  const fill = symbol === 'community' ? 'currentColor' : 'none';
  const stroke = symbol === 'community' ? 'none' : 'currentColor';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${mapSymbolPaths[symbol]}"/></svg>`;
}
