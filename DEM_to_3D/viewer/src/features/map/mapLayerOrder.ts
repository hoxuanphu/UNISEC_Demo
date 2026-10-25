/** Bottom to top. Navigation warnings, symbols and tools stay above editable layers. */
export const mapLayerOrder = {
  imagery: 1,
  analysis: 1.5,
  boundary: 2,
  landslides: 2.5,
  reference: 3,
  roads: 3.5,
  route: 4,
  roadStatus: 5,
  selection: 6,
  tools: 7,
} as const;
export type MapPane = keyof typeof mapLayerOrder;
export const mapPane = (name: MapPane) => `dear-${name}`;
/** Top to bottom, the cartographic convention: lines over polygons, rasters below.
 * Fixed, so every map draws the same stack the layers panel lists. */
export const defaultDrawingOrder = ['roads', 'reference', 'landslides', 'boundary'] as const;
export type DrawingLayer = typeof defaultDrawingOrder[number];
export function drawingLayerRank(name: MapPane, order: readonly DrawingLayer[] = defaultDrawingOrder): number {
  const index = order.indexOf(name as DrawingLayer);
  // Reserve [2, 3.75] between imagery and navigation overlays.
  return index < 0 ? mapLayerOrder[name] : 2 + (order.length - 1 - index) * .5;
}
/** Tag only vector primitives. Terrain depth testing and source geometry are unchanged. */
export function setDrawingLayer<T extends { userData: Record<string, unknown>; renderOrder: number }>(object: T, layer: DrawingLayer, offset = 0): T {
  object.userData.drawingLayer = layer;
  object.userData.drawingOffset = offset;
  object.renderOrder = drawingLayerRank(layer, defaultDrawingOrder) * 2 + offset;
  return object;
}
export function applyDrawingOrder(root: { traverse: (visit: (object: {userData: Record<string, unknown>; renderOrder: number}) => void) => void }, order: readonly DrawingLayer[] = defaultDrawingOrder): void {
  root.traverse(object => {
    const layer = object.userData.drawingLayer;
    if (defaultDrawingOrder.includes(layer as DrawingLayer))
      object.renderOrder = drawingLayerRank(layer as DrawingLayer, order) * 2 + Number(object.userData.drawingOffset ?? 0);
  });
}
