import type { ActiveDialog } from '../types/dear';

export type MapTool = 'browse' | 'measure' | 'location' | 'profile';
export type WorkspaceDialog = ActiveDialog | 'upload';
export type WorkspaceInteraction = {
  tool: MapTool;
  dialog: WorkspaceDialog;
  mapMode: '2d' | '3d';
  focusDistance: number | null;
  fallbackVersion: number;
};
export const initialWorkspaceInteraction: WorkspaceInteraction = {
  tool: 'browse', dialog: null, mapMode: '2d', focusDistance: null, fallbackVersion: 0
};
export type InteractionAction =
  | { type: 'toggle-tool'; tool: Exclude<MapTool, 'browse'> }
  | { type: 'close-tool'; tool: Exclude<MapTool, 'browse'> }
  | { type: 'dialog'; dialog: WorkspaceDialog }
  | { type: 'navigate' }
  | { type: 'map-mode'; mode: '2d' | '3d' }
  | { type: 'focus-distance'; distance: number | null }
  | { type: 'fallback-2d' }
  | { type: 'reset' };

/** One tool owns map input. Opening/closing a tool never changes its saved result. */
export function workspaceInteractionReducer(state: WorkspaceInteraction, action: InteractionAction): WorkspaceInteraction {
  switch (action.type) {
    case 'toggle-tool': return { ...state, tool: state.tool === action.tool ? 'browse' : action.tool,
      dialog: null, focusDistance: null, mapMode: action.tool === 'measure' ? '2d' : state.mapMode };
    case 'close-tool': return state.tool !== action.tool ? state : { ...state, tool: 'browse', focusDistance: null };
    case 'dialog': return action.dialog ? { ...state, dialog: action.dialog, tool: 'browse', focusDistance: null } : { ...state, dialog: null };
    case 'navigate': return { ...state, tool: 'browse', dialog: null, focusDistance: null };
    case 'map-mode': return { ...state, mapMode: action.mode,
      tool: action.mode === '3d' && state.tool === 'measure' ? 'browse' : state.tool };
    case 'focus-distance': return state.tool === 'profile' ? { ...state, focusDistance: action.distance } : state;
    case 'fallback-2d': return { ...state, mapMode: '2d', fallbackVersion: state.fallbackVersion + 1 };
    case 'reset': return { ...initialWorkspaceInteraction, fallbackVersion: state.fallbackVersion };
  }
}
