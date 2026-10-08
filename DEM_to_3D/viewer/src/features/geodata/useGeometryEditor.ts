import { useRef, useState } from 'react';
import type { VectorGeometry } from '../../geo/vector/types';
import { validateGeometry } from '../../geo/vector/validateGeometry';
import { drawnPolygon, geometryHistory, moveVertex } from './geometryEditing';

export type GeometryMode = 'browse' | 'polygon' | 'rectangle' | 'edit';
type Draft = { vertices: number[][]; geometry: VectorGeometry | null };
const empty = (): Draft => ({ vertices: [], geometry: null });

/** Draft geometry is isolated from persisted records until Apply/Finish succeeds. */
export function useGeometryEditor() {
  const [mode, setMode] = useState<GeometryMode>('browse');
  const [history, setHistory] = useState({
    past: [] as Draft[],
    present: empty(),
    future: [] as Draft[]
  });
  const latest = useRef(history);
  latest.current = history;
  const [recordId, setRecordId] = useState<string | null>(null);
  const change = (draft: Draft) => {
    const next = {
      past: [...latest.current.past, latest.current.present].slice(-25),
      present: draft,
      future: [] as Draft[]
    };
    latest.current = next;
    setHistory(next);
  };
  const start = (
    next: GeometryMode,
    id: string | null = null,
    geometry: VectorGeometry | null = null
  ) => {
    const state = {
      past: [] as Draft[],
      present: {
        vertices: [],
        geometry: geometry ? structuredClone(geometry) : null
      },
      future: [] as Draft[]
    };
    latest.current = state;
    setHistory(state);
    setRecordId(id);
    setMode(next);
  };
  const travel = (action: 'undo' | 'redo') => {
    const state = latest.current;
    const next = geometryHistory(state.past, state.present, state.future, action);
    latest.current = next;
    setHistory(next);
  };
  return {
    mode,
    active: mode !== 'browse',
    recordId,
    draft: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    start,
    cancel: () => start('browse'),
    undo: () => travel('undo'),
    redo: () => travel('redo'),
    add: (point: number[]) => {
      const current = latest.current.present;
      change({ ...current, vertices: [...current.vertices, point] });
    },
    move: (path: number[], point: number[]) => {
      const current = latest.current.present;
      if (current.geometry)
        change({
          ...current,
          geometry: moveVertex(current.geometry, path, point)
        });
    },
    result: () =>
      mode === 'edit'
        ? validateGeometry(latest.current.present.geometry)
        : drawnPolygon(latest.current.present.vertices, mode === 'rectangle')
  };
}
