import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyDrawingOrder, defaultDrawingOrder, drawingLayerRank, mapLayerOrder, setDrawingLayer, type DrawingLayer } from './mapLayerOrder';
describe('GIS drawing order', () => {
  it('stacks lines over polygons over rasters, as the layers panel lists them', () => {
    expect(defaultDrawingOrder).toEqual(['roads', 'reference', 'landslides', 'boundary']);
    expect(drawingLayerRank('roads')).toBeGreaterThan(drawingLayerRank('landslides'));
    expect(drawingLayerRank('landslides')).toBeGreaterThan(drawingLayerRank('analysis'));
    expect(drawingLayerRank('analysis')).toBeGreaterThan(drawingLayerRank('imagery'));
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
    const reordered: DrawingLayer[] = ['landslides', 'roads', 'reference', 'boundary'];
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
