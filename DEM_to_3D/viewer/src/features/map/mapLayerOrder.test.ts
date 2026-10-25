import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyDrawingOrder, defaultDrawingOrder, drawingLayerRank, mapLayerOrder, moveDrawingLayer, normaliseDrawingOrder, setDrawingLayer } from './mapLayerOrder';
describe('GIS drawing order', () => {
  it('repairs incomplete, obsolete and duplicate saved layer stacks', () => {
    expect(normaliseDrawingOrder(['landslides', 'obsolete', 'landslides', null])).toEqual(['landslides', 'roads', 'reference', 'boundary']);
    expect(normaliseDrawingOrder({roads: 9})).toEqual(defaultDrawingOrder);
  });
  it('moves only the requested layer and bounds moves at the stack edges', () => {
    const next = moveDrawingLayer(defaultDrawingOrder, 'roads', 1);
    expect(next).toEqual(['reference', 'roads', 'landslides', 'boundary']);
    expect(defaultDrawingOrder[0]).toBe('roads');
    expect(moveDrawingLayer(defaultDrawingOrder, 'roads', -1)).toEqual(defaultDrawingOrder);
  });
  it('draws upper layers later in both pane and terrain ordering, retaining casings and warnings', () => {
    const root = new THREE.Group();
    const road = setDrawingLayer(new THREE.Object3D(), 'roads', .2);
    const fill = setDrawingLayer(new THREE.Object3D(), 'landslides');
    const outline = setDrawingLayer(new THREE.Object3D(), 'landslides', .2);
    const warning = new THREE.Object3D(); warning.renderOrder = mapLayerOrder.roadStatus * 2;
    root.add(road, fill, outline, warning);
    applyDrawingOrder(root, defaultDrawingOrder);
    expect(road.renderOrder).toBeGreaterThan(outline.renderOrder);
    const reordered = normaliseDrawingOrder(['landslides']);
    applyDrawingOrder(root, reordered);
    expect(fill.renderOrder).toBeGreaterThan(road.renderOrder);
    expect(outline.renderOrder).toBeGreaterThan(fill.renderOrder);
    expect(drawingLayerRank('landslides', reordered)).toBeGreaterThan(drawingLayerRank('roads', reordered));
    expect(outline.renderOrder).toBeLessThan(mapLayerOrder.route * 2);
    expect(warning.renderOrder).toBe(mapLayerOrder.roadStatus * 2);
    expect(drawingLayerRank('analysis', reordered)).toBeLessThan(drawingLayerRank('boundary', reordered));
    expect(drawingLayerRank('imagery', reordered)).toBeLessThan(drawingLayerRank('analysis', reordered));
    for (const layer of defaultDrawingOrder) {
      expect(drawingLayerRank(layer,reordered)).toBeGreaterThan(mapLayerOrder.analysis);
      expect(drawingLayerRank(layer,reordered)).toBeLessThan(mapLayerOrder.route);
    }
  });
});
