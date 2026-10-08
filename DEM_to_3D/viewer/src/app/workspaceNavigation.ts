import type { CommunityFilter, DetailTab, ImpactTab, RoadFilter, WorkspaceView } from '../types/dear';

type ObjectView = Exclude<WorkspaceView, 'priority'>;
export type WorkspaceNavigation = {
  view: WorkspaceView;
  selectedCommunityId: string | null;
  communityOrigin: WorkspaceView;
  selectedRouteType: 'candidate' | 'direct';
  routeSectionId: string | null;
  objectIds: Record<ObjectView, string | null>;
  objectOrigins: Record<ObjectView, WorkspaceView | null>;
  detailTab: DetailTab;
  roadFilter: RoadFilter;
  communityFilter: CommunityFilter;
  roadQuery: string;
  communityQuery: string;
  impactTab: ImpactTab;
};

export const initialWorkspaceNavigation: WorkspaceNavigation = {
  view: 'incident', selectedCommunityId: null, communityOrigin: 'priority', selectedRouteType: 'candidate', routeSectionId: null,
  objectIds: { incident: null, impact: null }, objectOrigins: { incident: null, impact: null },
  detailTab: 'decision', roadFilter: 'all', communityFilter: 'all', roadQuery: '', communityQuery: '', impactTab: 'roads'
};

type Filters = Pick<WorkspaceNavigation, 'roadFilter' | 'communityFilter' | 'roadQuery' | 'communityQuery' | 'impactTab' | 'detailTab' | 'selectedRouteType'>;
export type NavigationAction =
  | { type: 'select-community'; id: string }
  | { type: 'inspect-object'; id: string }
  | { type: 'route-section'; id: string | null }
  | { type: 'view'; view: WorkspaceView; list?: boolean }
  | { type: 'close-community' }
  | { type: 'close-object' }
  | { type: 'filters'; values: Partial<Filters> }
  | { type: 'road-list'; filter: RoadFilter }
  | { type: 'reset' };

export function selectedMapObject(state: WorkspaceNavigation): string | null {
  return state.view === 'priority'
    ? state.selectedCommunityId && state.detailTab === 'decision' && state.routeSectionId ? `road:${state.routeSectionId}` : null
    : state.objectIds[state.view];
}

function clearDetail(state: WorkspaceNavigation, view: WorkspaceView): WorkspaceNavigation {
  return view === 'priority' ? { ...state, selectedCommunityId: null, routeSectionId: null }
    : { ...state, objectIds: { ...state.objectIds, [view]: null }, objectOrigins: { ...state.objectOrigins, [view]: null } };
}

/** Navigation keeps each tab's detail. Only explicit list/back actions clear it. */
export function workspaceNavigationReducer(state: WorkspaceNavigation, action: NavigationAction): WorkspaceNavigation {
  switch (action.type) {
    case 'select-community': {
      const origin = state.view !== 'priority' ? state.view : state.selectedCommunityId ? state.communityOrigin : 'priority';
      if (state.selectedCommunityId === action.id) return { ...state, view: 'priority', communityOrigin: origin };
      return { ...state, view: 'priority', selectedCommunityId: action.id, communityOrigin: origin,
        selectedRouteType: 'candidate', detailTab: 'decision', routeSectionId: null };
    }
    case 'inspect-object': {
      const owner: ObjectView = action.id.startsWith('road:') || action.id.startsWith('hazard:') ? 'impact' : 'incident';
      const origin = owner !== state.view ? state.view : state.objectIds[owner] ? state.objectOrigins[owner] : null;
      return { ...state, view: owner, objectIds: { ...state.objectIds, [owner]: action.id },
        objectOrigins: { ...state.objectOrigins, [owner]: origin } };
    }
    case 'view': {
      const next = action.list || action.view === state.view ? clearDetail(state, action.view) : state;
      return { ...next, view: action.view,
        objectOrigins: { ...next.objectOrigins, ...(action.view !== 'priority' ? { [action.view]: null } : {}) } };
    }
    case 'route-section': return state.selectedCommunityId ? { ...state, view: 'priority', detailTab: 'decision', routeSectionId: action.id } : state;
    case 'close-community': return { ...state, selectedCommunityId: null, routeSectionId: null, view: state.communityOrigin };
    case 'close-object': return state.view === 'priority' ? state : {
      ...clearDetail(state, state.view), view: state.objectOrigins[state.view] ?? state.view
    };
    case 'filters': return { ...state, ...action.values,
      routeSectionId: action.values.selectedRouteType !== undefined && action.values.selectedRouteType !== state.selectedRouteType
        ? null : state.routeSectionId };
    case 'road-list': return { ...clearDetail(state, 'impact'), view: 'impact', impactTab: 'roads', roadFilter: action.filter, roadQuery: '' };
    case 'reset': return initialWorkspaceNavigation;
  }
}
