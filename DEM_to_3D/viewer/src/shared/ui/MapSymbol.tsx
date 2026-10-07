import { mapSymbolPaths, type MapSymbolName } from '../../terrain/mapSymbols';

export function MapSymbol({ name, size = 18 }: { name: MapSymbolName; size?: number }): JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={name === 'community' ? 'currentColor' : 'none'} stroke={name === 'community' ? 'none' : 'currentColor'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={mapSymbolPaths[name]} /></svg>;
}
