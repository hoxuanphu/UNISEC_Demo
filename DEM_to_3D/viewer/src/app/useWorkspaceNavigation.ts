import { useReducer } from 'react';
import { initialWorkspaceNavigation, selectedMapObject, workspaceNavigationReducer } from './workspaceNavigation';

export function useWorkspaceNavigation() {
  const [state, dispatch] = useReducer(workspaceNavigationReducer, initialWorkspaceNavigation);
  return { ...state, selectedObjectId: selectedMapObject(state), dispatch };
}
