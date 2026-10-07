import { useCallback, useReducer } from 'react';
import { initialWorkspaceInteraction, workspaceInteractionReducer } from './workspaceInteraction';
import type { WorkspaceDialog } from './workspaceInteraction';

export function useWorkspaceInteraction() {
  const [state, dispatch] = useReducer(workspaceInteractionReducer, initialWorkspaceInteraction);
  const recover2D = useCallback(() => dispatch({ type: 'fallback-2d' }), []);
  const setActiveDialog = useCallback((dialog: WorkspaceDialog) => dispatch({ type: 'dialog', dialog }), []);
  const setMapMode = useCallback((mode: '2d' | '3d') => dispatch({ type: 'map-mode', mode }), []);
  const setFocusDistance = useCallback((distance: number | null) => dispatch({ type: 'focus-distance', distance }), []);
  const resetTools = useCallback(() => dispatch({ type: 'navigate' }), []);
  return { ...state, dispatch, recover2D, setActiveDialog, setMapMode, setFocusDistance, resetTools,
    measurementOpen: state.tool === 'measure', locationOpen: state.tool === 'location', showProfile: state.tool === 'profile',
    activeDialog: state.dialog === 'upload' ? null : state.dialog, showCustomUploadModal: state.dialog === 'upload'
  };
}
