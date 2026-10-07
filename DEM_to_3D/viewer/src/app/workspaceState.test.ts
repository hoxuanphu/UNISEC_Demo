import { describe, expect, it } from 'vitest';
import { initialWorkspaceNavigation as initial, selectedMapObject, workspaceNavigationReducer as navigate } from './workspaceNavigation';
import { initialWorkspaceInteraction, workspaceInteractionReducer as interact } from './workspaceInteraction';

describe('workspace navigation', () => {
  it('preserves the community and chosen route across tabs and road inspection', () => {
    let state = navigate(initial, { type: 'select-community', id: 'NK' });
    state = navigate(state, { type: 'filters', values: { selectedRouteType: 'direct', detailTab: 'evidence' } });
    state = navigate(state, { type: 'inspect-object', id: 'road:E13' });
    state = navigate(state, { type: 'inspect-object', id: 'hazard:U-1' });
    state = navigate(state, { type: 'close-object' });
    expect(state.view).toBe('priority');
    expect(state.selectedCommunityId).toBe('NK');
    expect(state.selectedRouteType).toBe('direct');
    expect(state.detailTab).toBe('evidence');
    expect(selectedMapObject(state)).toBeNull();
    state = navigate(state, { type: 'view', view: 'incident' });
    state = navigate(state, { type: 'view', view: 'priority' });
    expect(state.selectedCommunityId).toBe('NK');
    state = navigate(state, { type: 'view', view: 'priority' });
    expect(state.selectedCommunityId).toBeNull();
  });

  it('keeps each object detail separate and closes back to the opening context', () => {
    let state = navigate(initial, { type: 'inspect-object', id: 'aoi:AOI' });
    state = navigate(state, { type: 'inspect-object', id: 'road:E3' });
    expect(selectedMapObject(state)).toBe('road:E3');
    state = navigate(state, { type: 'close-object' });
    expect(state.view).toBe('incident');
    expect(selectedMapObject(state)).toBe('aoi:AOI');
    state = navigate(state, { type: 'select-community', id: 'KM' });
    state = navigate(state, { type: 'close-community' });
    expect(selectedMapObject(state)).toBe('aoi:AOI');
  });

  it('opens a road count as the exact list, clearing stale detail and query', () => {
    const state = navigate(navigate(initial, { type: 'inspect-object', id: 'hazard:B-2' }),
      { type: 'filters', values: { roadQuery: 'old query', impactTab: 'hazards' } });
    const list = navigate(state, { type: 'road-list', filter: 'blocked' });
    expect(list.view).toBe('impact'); expect(list.roadFilter).toBe('blocked');
    expect(list.impactTab).toBe('roads'); expect(list.roadQuery).toBe('');
    expect(selectedMapObject(list)).toBeNull();
    expect(state.roadQuery).toBe('old query');
  });
});

describe('workspace interaction ownership', () => {
  it('transfers input between tools and switches to 2D before measuring', () => {
    let state = interact(initialWorkspaceInteraction, { type: 'map-mode', mode: '3d' });
    for (const tool of ['location', 'profile', 'measure'] as const) {
      state = interact(state, { type: 'toggle-tool', tool });
      expect(state.tool).toBe(tool); expect(state.dialog).toBeNull();
    }
    expect(state.mapMode).toBe('2d');
    state = interact(state, { type: 'dialog', dialog: 'layers' });
    expect(state.tool).toBe('browse');
    state = interact(state, { type: 'toggle-tool', tool: 'measure' });
    expect(state.dialog).toBeNull();
    state = interact(state, { type: 'map-mode', mode: '3d' });
    expect(state.tool).toBe('browse');
  });

  it('ignores stale close and profile hover callbacks after a tool switch', () => {
    let state = interact(initialWorkspaceInteraction, { type: 'toggle-tool', tool: 'profile' });
    state = interact(state, { type: 'focus-distance', distance: 150 });
    state = interact(state, { type: 'toggle-tool', tool: 'measure' });
    expect(interact(state, { type: 'close-tool', tool: 'profile' })).toBe(state);
    expect(interact(state, { type: 'focus-distance', distance: 200 })).toBe(state);
    expect(state.focusDistance).toBeNull();
  });

  it('recovers 2D without changing the inspected profile and resets tools explicitly', () => {
    let state = interact(initialWorkspaceInteraction, { type: 'toggle-tool', tool: 'profile' });
    state = interact(state, { type: 'map-mode', mode: '3d' });
    state = interact(state, { type: 'fallback-2d' });
    expect(state.mapMode).toBe('2d'); expect(state.tool).toBe('profile');
    expect(state.fallbackVersion).toBe(1);
    expect(interact(state, { type: 'navigate' }).tool).toBe('browse');
    expect(interact(state, { type: 'reset' }).dialog).toBeNull();
  });
});
