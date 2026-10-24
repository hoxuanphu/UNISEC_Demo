import {poiMetrics,markerSize} from './poiFrame';
import {placeMapLabel} from './markerLayout';
import { describe, expect, it } from 'vitest';
import { layoutMarkerGroups, layoutPlaceMarkers, markerPriority, overlaps } from './markerLayout';
import { SELECTED_PIN } from './poiFrame';

describe('map symbol layout', () => {
  it('keeps named featured hazards separate unless their symbols actually cover each other', () => {
    const points = [
      {id:'scar-1',x:100,y:100,priority:40,category:'landslide',featured:true},
      {id:'scar-2',x:102,y:136,priority:40,category:'landslide',featured:true}
    ];
    expect(layoutMarkerGroups(points,400,300,[])).toHaveLength(2);
    expect(layoutMarkerGroups([points[0],{...points[1],y:112}],400,300,[])).toHaveLength(1);
  });
  it('keeps touching symbols of different categories separate and clickable', () => {
    const groups = layoutMarkerGroups([
      { id: 'community:priority', x: 100, y: 100, priority: 50, category: 'community' },
      { id: 'hazard:landslide', x: 128, y: 124, priority: 80, category: 'landslide' },
      { id: 'community:other', x: 118, y: 96, priority: 10, category: 'community' }
    ], 400, 300, []);
    expect(groups.map(group => [group.anchor.id, group.members.map(member => member.id)])).toEqual([
      ['hazard:landslide', ['hazard:landslide']],
      ['community:priority', ['community:priority', 'community:other']]
    ]);
  });
  it('lets a reported landslide anchor a community it would cover', () => {
    const groups = layoutMarkerGroups([
      { id: 'community:priority', x: 100, y: 100, priority: 50, category: 'community' },
      { id: 'hazard:landslide', x: 106, y: 104, priority: 80, category: 'landslide' }
    ], 400, 300, []);
    expect(groups).toHaveLength(1);
    expect(groups[0].anchor.id).toBe('hazard:landslide');
    expect(groups[0].members.map(member => member.id)).toEqual(['hazard:landslide', 'community:priority']);
  });
  it('ranks the selection, reported hazards, priority communities, unverified hazards, then staging', () => {
    const ranks = [
      markerPriority({ selected: true }),
      markerPriority({ selected: false, hazard: true }),
      markerPriority({ selected: false, priorityCommunity: true }),
      markerPriority({ selected: false, hazard: true, suspected: true }),
      markerPriority({ selected: false, staging: true }),
      markerPriority({ selected: false })
    ];
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
    expect(new Set(ranks).size).toBe(ranks.length);
  });
  it('retains every nearby object in a selectable group anchored at the selected point', () => {
    const points = [
      { id: 'hazard', x: 100, y: 100, priority: 10 },
      { id: 'community', x: 118, y: 110, priority: 100 },
      { id: 'other', x: 220, y: 150, priority: 50 }
    ];
    const groups = layoutMarkerGroups(points, 400, 300, []);
    expect(groups).toHaveLength(2);
    expect(groups[0].anchor).toEqual(points[1]);
    expect(groups.flatMap(g => g.members.map(p => p.id)).sort()).toEqual(['community', 'hazard', 'other']);
    expect(overlaps(groups[0].rect, groups[1].rect)).toBe(false);
  });
  it('keeps a selected teardrop pin tip on its true coordinate while grouping an overlapping bridge', () => {
    const points = [
      { id: 'selected', x: 100, y: 120, priority: 100, selected: true },
      { id: 'bridge', x: 100, y: 106, priority: 10 }
    ];
    const groups = layoutMarkerGroups(points, 400, 300, []);
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map(point => point.id)).toEqual(['selected', 'bridge']);
    expect(groups[0].rect.x+groups[0].rect.width/2).toBe(points[0].x);
    // The rect carries 1 px of selection padding around the pin box.
    expect(groups[0].rect.y+1+SELECTED_PIN.tipY).toBe(points[0].y);
  });
  it('retains every coincident feature when any member becomes a selected teardrop',()=>{
    const points=[{id:'a',x:260,y:210,category:'community'},{id:'b',x:263,y:214,category:'community'},{id:'c',x:258,y:217,category:'landslide'},{id:'d',x:262,y:218,category:'hlz'}];
    for(const selected of points){
      const groups=layoutMarkerGroups(points.map(point=>({...point,selected:point.id===selected.id,priority:point.id===selected.id?100:10})),620,430,[]);
      expect(groups).toHaveLength(1);expect(groups[0].anchor.id).toBe(selected.id);
      expect(groups[0].members.map(point=>point.id).sort()).toEqual(['a','b','c','d']);
    }
  });
  it('does not cover a map control, including a neighbour behind that control', () => {
    const control = { x: 0, y: 0, width: 80, height: 150 };
    const groups = layoutMarkerGroups([
      { id: 'selected', x: 76, y: 100, priority: 100 },
      { id: 'hazard', x: 110, y: 100, priority: 10 },
      { id: 'occluded', x: 30, y: 30, priority: 10 }
    ], 320, 240, [control]);
    expect(groups).toHaveLength(1);
    expect(groups[0].anchor.id).toBe('hazard');
    expect(groups[0].members.map(p => p.id).sort()).toEqual(['hazard', 'selected']);
    expect(overlaps(groups[0].rect, control, 6)).toBe(false);
  });
  it('has deterministic, non-overlapping groups as the map zooms', () => {
    const points = Array.from({ length: 20 }, (_, i) => ({ id: `point-${i}`, x: 50 + i * 12, y: 100, priority: 10 }));
    const near = layoutMarkerGroups(points, 400, 300, []);
    expect(near).toHaveLength(1);
    expect(near[0].members).toHaveLength(20);
    const far = layoutMarkerGroups(points.map(p => ({ ...p, x: p.x * 5 })), 1800, 300, []);
    expect(far).toHaveLength(20);
    expect(layoutMarkerGroups([...points].reverse(), 400, 300, [])).toEqual(near);
    expect(layoutMarkerGroups([{ id: 'bad', x: NaN, y: 30, priority: 100 }], 400, 300, [])).toEqual([]);
  });
});

describe('contextual extent label placement',()=>{
  it('moves a label around the station symbol and its text, never covering either',()=>{
    const obstacles=[{x:180,y:155,width:40,height:50},{x:170,y:205,width:120,height:24}];
    const position=placeMapLabel({x:200,y:200},{width:160,height:48},{width:700,height:500},obstacles);
    expect(position).toBeDefined();
    expect(obstacles.some(rect=>overlaps(position!,rect,6))).toBe(false);
  });
  it('suppresses a label when the viewport is occupied and respects the panel edge',()=>{
    expect(placeMapLabel({x:100,y:100},{width:120,height:40},{width:200,height:200},[{x:0,y:0,width:200,height:200}])).toBeUndefined();
    const position=placeMapLabel({x:480,y:200},{width:140,height:40},{width:700,height:400},[{x:500,y:0,width:200,height:400}]);
    expect(position).toBeDefined();expect(position!.x+position!.width).toBeLessThan(500);
  });
});

describe('individual web-map places', () => {
  it('keeps nearby places separate at their real coordinates without enlarging symbols', () => {
    const points = [
      {id:'a', x:100, y:100, priority:10, category:'community'},
      {id:'b', x:134, y:100, priority:10, category:'community'},
      {id:'c', x:168, y:100, priority:10, category:'community'},
    ];
    const layout = layoutPlaceMarkers(points, 400, 300, []);
    expect(layout).toHaveLength(3);
    expect(layout.every(item => item.rect.width === 28 && item.members.length === 1)).toBe(true);
    expect(layout.map(item => item.anchor.x)).toEqual([100, 134, 168]);
  });
  it('retains coincident items behind a normal hazard symbol without moving any point', () => {
    const points = [
      {id:'place',x:100,y:100,priority:10,category:'community'},
      {id:'hazard',x:100,y:100,priority:80,category:'landslide'},
    ];
    const [item] = layoutPlaceMarkers(points, 400, 300, []);
    expect(item.anchor.id).toBe('hazard');
    expect(item.rect.width).toBe(28);
    expect(item.members.map(member => member.id)).toEqual(['hazard','place']);
    expect(layoutPlaceMarkers(points, 400, 300, [item.rect])).toHaveLength(0);
  });
});
