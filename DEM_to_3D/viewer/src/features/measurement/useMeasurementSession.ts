import { useLayoutEffect, useReducer } from 'react';
import { initialMeasurementSession, measurementSessionReducer } from './measurementSession';

/** Closing a tool preserves a drawing and restores any uncommitted edit. */
export function useMeasurementSession(mapMode: '2d' | '3d', open: boolean) {
  const [session, dispatch] = useReducer(measurementSessionReducer, initialMeasurementSession);

  useLayoutEffect(() => {
    if (!open || mapMode === '3d') dispatch({ type: 'pause' });
  }, [open, mapMode]);

  return { session, dispatch };
}
