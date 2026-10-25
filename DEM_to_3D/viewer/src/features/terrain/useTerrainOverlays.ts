import { useEffect, useRef, useState } from 'react';
import type { SarRaster } from '../../terrain/sarOverlay';

export type TerrainOverlayOptions = {
  contours: boolean;
  interval: number;
  sar: SarRaster | null;
  band: number;
  sarVisible: boolean;
  opacity: number;
};

/** Display-only raster state. Import generations prevent stale file reads winning. */
export function useTerrainOverlays() {
  const [options, setOptions] = useState<TerrainOverlayOptions>({ contours: false, interval: 100, sar: null, band: 0, sarVisible: true, opacity: .65 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const importSar = async (file: File | null) => {
    const run = ++generation.current;
    setError(null);
    // Clear the old acquisition immediately while the next file is decoded.
    setOptions(previous => ({ ...previous, sar: null, band: 0 }));
    if (!file) { setBusy(false); return; }
    setBusy(true);
    try {
      const { readSarRaster } = await import('../../terrain/sarOverlay');
      const sar = await readSarRaster(file);
      if (run === generation.current) setOptions(previous => ({ ...previous, sar, band: 0, sarVisible: true }));
    } catch (reason) {
      if (run === generation.current) setError(reason instanceof Error ? reason.message : String(reason));
    } finally { if (run === generation.current) setBusy(false); }
  };
  const suspendSar = () => {
    generation.current++;
    setBusy(false);setError(null);
    setOptions(previous=>({...previous,sarVisible:false}));
  };
  return { options, setOptions, busy, error, setError, status, setStatus, importSar, suspendSar };
}
