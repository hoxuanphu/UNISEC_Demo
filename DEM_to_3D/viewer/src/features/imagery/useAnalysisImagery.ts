import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ScenarioAsset } from '../../data/scenarioManifest';
import { defaultAnalysisSelection, latestOpticalLayer, selectionForCatalog, loadImageryCatalog, selectedRasters, type AnalysisLayer, type AnalysisSelection } from './analysisImagery';

/** Prepared EO catalog plus the viewer's current choice; shared by the response map and GIS editing. */
export function useAnalysisImagery(asset: ScenarioAsset | undefined) {
  const [balanceBasemap,setBalanceBasemap]=useState(true);
  const [catalogState,setCatalogState]=useState<'off'|'loading'|'ready'|'error'>('off');
  const [attempt,setAttempt]=useState(0);
  const [layers, setLayers] = useState<AnalysisLayer[]>([]);
  const [selection, updateSelection] = useState<AnalysisSelection>(defaultAnalysisSelection);
  const chosen = useRef(false);
  const setSelection = useCallback((value: AnalysisSelection) => {chosen.current = true; updateSelection(selectionForCatalog(layers,value,true));},[layers]);
  useEffect(() => {
    setLayers([]);
    if (!asset) {setCatalogState('off');return;}
    setCatalogState('loading');
    const run = new AbortController();
    loadImageryCatalog(asset, run.signal).then(catalog => {
      if (run.signal.aborted) return;
      setLayers(catalog);
      setCatalogState('ready');
      updateSelection(value=>selectionForCatalog(catalog,value,chosen.current));
    }, () => { if (!run.signal.aborted) {setLayers([]);setCatalogState('error');} });
    return () => run.abort();
  }, [asset?.url, asset?.sha256,attempt]);
  const rasters = useMemo(() => selectedRasters(layers, selection), [layers, selection.layer, selection.sarMode]);
  const resetSelection = () => {
    chosen.current = false;
    setBalanceBasemap(true);
    updateSelection({...defaultAnalysisSelection,layer:latestOpticalLayer(layers)?.id ?? defaultAnalysisSelection.layer});
  };
  return { balanceBasemap,setBalanceBasemap, layers, selection, setSelection, resetSelection, rasters, catalogState, retryCatalog:()=>setAttempt(value=>value+1) };
}
export type AnalysisImageryState = ReturnType<typeof useAnalysisImagery>;
