import { describe, expect, it } from 'vitest';
import { initialWorkspaceNavigation as initial, selectedMapObject, workspaceNavigationReducer as navigate } from './workspaceNavigation';
import { initialWorkspaceInteraction, workspaceInteractionReducer as interact } from './workspaceInteraction';

describe('workspace navigation', () => {
  it('opens a rescue team in the rescue tab while retaining the previous road selection',()=>{
    const road=navigate(initial,{type:'inspect-object',id:'road:E1'});
    const team=navigate(road,{type:'inspect-object',id:'team:CH-03'});
    expect(team.view).toBe('rescue');expect(selectedMapObject(team)).toBe('team:CH-03');
    const back=navigate(team,{type:'view',view:'impact'});
    expect(selectedMapObject(back)).toBe('road:E1');
  });
  it('keeps road inspection inside the selected route and clears it when changing routes', () => {
    const community = navigate(initial, { type: 'select-community', id: 'NK' });
    const section = navigate(community, { type: 'route-section', id: 'E13' });
    expect(section.view).toBe('priority');
    expect(section.selectedCommunityId).toBe('NK');
    expect(selectedMapObject(section)).toBe('road:E13');
    const details = navigate(section, { type: 'inspect-object', id: 'road:E13' });
    const returned = navigate(details, { type: 'close-object' });
    expect(returned.view).toBe('impact');
    expect(selectedMapObject(returned)).toBeNull();
    expect(returned.routeSectionId).toBe('E13');
    const changed = navigate(returned, { type: 'filters', values: { selectedRouteType: 'direct' } });
    expect(changed.routeSectionId).toBeNull();
    expect(selectedMapObject(changed)).toBeNull();
    expect(navigate(changed, { type: 'select-community', id: 'KM' }).routeSectionId).toBeNull();
    expect(navigate(initial, { type: 'route-section', id: 'E13' })).toBe(initial);
  });
  it('preserves the community and chosen route across tabs and road inspection', () => {
    let state = navigate(initial, { type: 'select-community', id: 'NK' });
    state = navigate(state, { type: 'filters', values: { selectedRouteType: 'direct', detailTab: 'evidence' } });
    state = navigate(state, { type: 'inspect-object', id: 'road:E13' });
    state = navigate(state, { type: 'inspect-object', id: 'hazard:U-1' });
    state = navigate(state, { type: 'close-object' });
    expect(selectedMapObject(state)).toBeNull();
    state = navigate(state, { type: 'close-object' });
    expect(state.view).toBe('impact');
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

  it('closes the current detail without switching to the opening tab or its selected object', () => {
    let state = navigate(initial, { type: 'inspect-object', id: 'aoi:AOI' });
    state = navigate(state, { type: 'inspect-object', id: 'road:E3' });
    expect(selectedMapObject(state)).toBe('road:E3');
    state = navigate(state, { type: 'close-object' });
    expect(state.view).toBe('impact');
    expect(selectedMapObject(state)).toBeNull();
    state = navigate(state, { type: 'select-community', id: 'KM' });
    state = navigate(state, { type: 'close-community' });
    expect(state.view).toBe('priority');
    expect(state.selectedCommunityId).toBeNull();
    expect(state.routeSectionId).toBeNull();
    expect(selectedMapObject(state)).toBeNull();
  });

  it('opens other places in the road tab without switching tabs', () => {
    const roads = navigate(initial, { type: 'view', view: 'impact' });
    const site = navigate(roads, { type: 'inspect-object', id: 'poi:staging' });
    expect(site.view).toBe('impact');
    expect(selectedMapObject(site)).toBe('poi:staging');
  });

  it('closes a linked road without reopening the landslide and stays closed on a repeated close', () => {
    let state = navigate(initial, { type: 'inspect-object', id: 'hazard:L1' });
    state = navigate(state, { type: 'inspect-object', id: 'road:E1' });
    state = navigate(state, { type: 'inspect-object', id: 'road:E1' });
    state = navigate(state, { type: 'close-object' });
    expect(selectedMapObject(state)).toBeNull();
    state = navigate(state, { type: 'close-object' });
    expect(state.view).toBe('impact');
    expect(selectedMapObject(state)).toBeNull();
  });

  it('keeps an explicit road list after closing another selected road', () => {
    let state = navigate(initial, { type: 'inspect-object', id: 'hazard:L1' });
    state = navigate(state, { type: 'inspect-object', id: 'road:E1' });
    state = navigate(state, { type: 'road-list', filter: 'blocked' });
    expect(selectedMapObject(state)).toBeNull();
    state = navigate(state, { type: 'inspect-object', id: 'road:E2' });
    state = navigate(state, { type: 'close-object' });
    expect(state.view).toBe('impact');
    expect(selectedMapObject(state)).toBeNull();
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
    const help = interact(state, { type: 'dialog', dialog: 'help' });
    expect(help.tool).toBe('measure');
    expect(interact(help, { type: 'dialog', dialog: null }).tool).toBe('measure');
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


describe('tracked resident navigation',()=>{
  it('opens a device in Incident and keeps the road selection for later',()=>{
    const road=navigate(initial,{type:'inspect-object',id:'road:E8'});
    const person=navigate(road,{type:'inspect-object',id:'device:GPS-AP01'});
    expect(person.view).toBe('incident');expect(person.objectIds.impact).toBe('road:E8');
    expect(selectedMapObject(person)).toBe('device:GPS-AP01');
    expect(selectedMapObject(navigate(person,{type:'close-object'}))).toBeNull();
  });
});
