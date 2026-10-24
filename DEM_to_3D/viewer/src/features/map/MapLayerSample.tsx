import { landslideAreaStyle } from '../landslides/landslideAreas';
import { MapSymbol } from '../../shared/ui/MapSymbol';
import { POI_FRAME_PATH } from '../../terrain/poiFrame';
import { roadColors } from '../../terrain/roadStyle';
import type { MapSymbolName } from '../../terrain/mapSymbols';
import './map-legend.css';

export function MapPoiSample({symbol,kind}: {symbol: MapSymbolName;kind: string}) {
  return <i className={'legend-symbol ' + kind} aria-hidden="true"><svg viewBox="0 0 28 28"><path d={POI_FRAME_PATH}/></svg><MapSymbol name={symbol} size={14}/></i>;
}

/** The layer picker previews the actual map encoding rather than a colored UI badge. */
export function MapLayerSample({kind,imagery}: {kind: string;imagery: boolean}) {
  const potential = landslideAreaStyle({state:'potential',review:'unreviewed'});
  const observed = landslideAreaStyle({state:'occurred',review:'reviewed'});
  const symbol: MapSymbolName | undefined = kind === 'communities' ? 'community' : kind === 'crossings' ? 'bridge' : ['staging','hlz','flood'].includes(kind) ? kind as MapSymbolName : undefined;
  if (symbol) return <span className="layer-key-sample"><MapPoiSample symbol={symbol} kind={symbol}/></span>;
  return <svg className="layer-key-sample" viewBox="0 0 32 24" fill="none" aria-hidden="true">
    {kind === 'landslide' ? <><path d="m2 17 5-11 9 3-1 12Z" fill={potential.color} fillOpacity={potential.fillOpacity} stroke={potential.color} strokeWidth={potential.weight} strokeDasharray={potential.dashArray}/><path d="m19 15 4-11 7 5-3 11Z" fill={observed.color} fillOpacity={observed.fillOpacity} stroke={observed.color} strokeWidth={observed.weight}/></>
    : kind === 'aoi' ? <rect x="3" y="4" width="26" height="16" rx="1" stroke="#85aa9d" strokeDasharray="4 3"/>
    : kind === 'status' ? <><path d="M2 7h28" stroke={roadColors.blocked} strokeWidth="2"/><path d="M2 17h28" stroke={roadColors.uncertain} strokeWidth="2" strokeDasharray="5 3"/></>
    : <><path d="m2 18 9-7 10 2 9-8" stroke={roadColors.neutralCasing} strokeWidth={kind==='localRoads'?2.8:4} strokeLinecap="round" strokeLinejoin="round"/><path d="m2 18 9-7 10 2 9-8" stroke={kind === 'route' ? roadColors.selected : kind==='localRoads' && imagery ? roadColors.reference : imagery ? roadColors.networkImagery : roadColors.networkTerrain} strokeWidth={kind==='localRoads'?1.5:2.2} strokeLinecap="round" strokeLinejoin="round"/></>}
  </svg>;
}
