import type { CommunityFilter, DetailTab, ImpactTab, RoadFilter, WorkspaceView } from '../types/dear';

type ObjectView = Exclude<WorkspaceView, 'priority'>;
export type WorkspaceNavigation = {
  view: WorkspaceView;
  selectedCommunityId: string | null;
  selectedRouteType: 'candidate' | 'direct';
  routeSectionId: string | null;
  objectIds: Record<ObjectView, string | null>;
  detailTab: DetailTab;
  roadFilter: RoadFilter;
  communityFilter: CommunityFilter;
  roadQuery: string;
  communityQuery: string;
  impactTab: ImpactTab;
};

export const initialWorkspaceNavigation: WorkspaceNavigation = {
  view: 'incident', selectedCommunityId: null, selectedRouteType: 'candidate', routeSectionId: null,
  objectIds: { incident: null, impact: null, rescue: null },
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
    : { ...state, objectIds: { ...state.objectIds, [view]: null } };
}

/** Tabs retain their selection; closing a detail clears it without navigating elsewhere. */
export function workspaceNavigationReducer(state: WorkspaceNavigation, action: NavigationAction): WorkspaceNavigation {
  switch (action.type) {
    case 'select-community': {
      if (state.selectedCommunityId === action.id) return { ...state, view: 'priority' };
      return { ...state, view: 'priority', selectedCommunityId: action.id,
        selectedRouteType: 'candidate', detailTab: 'decision', routeSectionId: null };
    }
    case 'inspect-object': {
      // Roads and hazards belong to the road tab, teams to the rescue tab. Other places open where
      // the user already is, so picking a staging site from the road or rescue tab does not switch tabs.
      const owner: ObjectView = action.id.startsWith('team:') ? 'rescue'
        : action.id.startsWith('road:') || action.id.startsWith('hazard:') || state.view === 'impact' ? 'impact'
        : state.view === 'rescue' ? 'rescue' : 'incident';
      return { ...state, view: owner, objectIds: { ...state.objectIds, [owner]: action.id } };
    }
    case 'view': {
      const next = action.list || action.view === state.view ? clearDetail(state, action.view) : state;
      return { ...next, view: action.view };
    }
    case 'route-section': return state.selectedCommunityId ? { ...state, view: 'priority', detailTab: 'decision', routeSectionId: action.id } : state;
    case 'close-community': return clearDetail(state, 'priority');
    case 'close-object': return state.view === 'priority' ? state : clearDetail(state, state.view);
    case 'filters': return { ...state, ...action.values,
      routeSectionId: action.values.selectedRouteType !== undefined && action.values.selectedRouteType !== state.selectedRouteType
        ? null : state.routeSectionId };
    case 'road-list': return { ...clearDetail(state, 'impact'), view: 'impact', impactTab: 'roads', roadFilter: action.filter, roadQuery: '' };
    case 'reset': return initialWorkspaceNavigation;
  }
}
